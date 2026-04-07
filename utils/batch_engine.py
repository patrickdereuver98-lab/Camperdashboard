"""
utils/batch_engine.py — VrijStaan High-Performance Batch Engine v4.
Pijler 3: Full-Auto Batching voor 750 locaties, parallel scraping,
sequentiële AI, checkpoint-saves.

Nieuw in v4:
  - run_full_batch() volledig automatisch: geen handmatig klikken per chunk
  - Batch-grootte: 10 (voor parallel scrapen) + 5 (voor AI-prompt)
  - Auto-resume via checkpoint: start door na herstart
  - Photo-URLs meenemen in batch output
  - normalize_province() + normalize_phone() gedeeld met enrichment.py
"""
from __future__ import annotations

import json
import os
import re
import time
import logging
import requests
import streamlit as st
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Callable

import pandas as pd

logger = logging.getLogger("vrijstaan.batch_engine")

# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
MAX_SCRAPE_WORKERS  = 20      # Parallelle HTTP workers
AI_BATCH_SIZE       = 5       # Locaties per Gemini-aanroep
AUTO_BATCH_SIZE     = 10      # Scrape-batch grootte voor auto-run
CHECKPOINT_CSV_N    = 25      # CSV-save elke N locaties
CHECKPOINT_SHEETS_N = 50      # Sheets-save elke N locaties
SCRAPE_TIMEOUT      = 10      # HTTP timeout per request
CHECKPOINT_DIR      = "data/checkpoints"
CHECKPOINT_FILE     = f"{CHECKPOINT_DIR}/batch_progress.csv"
RATE_LIMIT_DELAY    = 0.5     # Seconden rust tussen AI-batches


# ── PROVINCIE NORMALISATIE ─────────────────────────────────────────────────────

_NL_PROVINCES = {
    "groningen", "friesland", "drenthe", "overijssel", "flevoland",
    "gelderland", "utrecht", "noord-holland", "zuid-holland",
    "zeeland", "noord-brabant", "limburg",
}

_PROVINCE_MAP: dict[str, str] = {
    "fryslân":       "Friesland",    "fryslan":       "Friesland",
    "frisian":       "Friesland",    "friesland":     "Friesland",
    "north holland": "Noord-Holland","north-holland":  "Noord-Holland",
    "noord holland": "Noord-Holland","noordholland":   "Noord-Holland",
    "south holland": "Zuid-Holland", "south-holland":  "Zuid-Holland",
    "zuidholland":   "Zuid-Holland", "south holand":   "Zuid-Holland",
    "north brabant": "Noord-Brabant","north-brabant":  "Noord-Brabant",
    "noord brabant": "Noord-Brabant","noordbrabant":   "Noord-Brabant",
    "nb":            "Noord-Brabant",
    "groningen":     "Groningen",    "drenthe":        "Drenthe",
    "overijssel":    "Overijssel",   "flevoland":      "Flevoland",
    "gelderland":    "Gelderland",   "guelders":       "Gelderland",
    "utrecht":       "Utrecht",      "zeeland":        "Zeeland",
    "zealand":       "Zeeland",      "limburg":        "Limburg",
    "sud-holland":   "Zuid-Holland", "sud holland":    "Zuid-Holland",
}


def normalize_province(raw: str) -> str:
    """Normaliseert provincienaam naar officieel Nederlands."""
    if not raw:
        return "Onbekend"
    s = str(raw).strip()
    if s.lower() in ("onbekend", "nan", "none", "", "-", "unknown"):
        return "Onbekend"
    mapped = _PROVINCE_MAP.get(s.lower())
    if mapped:
        return mapped
    if s.lower() in _NL_PROVINCES:
        return _PROVINCE_MAP.get(s.lower(), s)
    s_lower = s.lower()
    for variant, canonical in _PROVINCE_MAP.items():
        if variant in s_lower:
            return canonical
    return s


# ── TELEFOON NORMALISATIE ──────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    """Normaliseert NL telefoonnummer naar +31 formaat."""
    _EMPTY = {"onbekend", "nan", "none", "", "-", "–", "unknown", "n/a"}
    if not raw or str(raw).strip().lower() in _EMPTY:
        return "Onbekend"
    s      = str(raw).strip()
    digits = re.sub(r"[^\d]", "", s)
    if digits.startswith("0031") and len(digits) >= 12:
        digits = "0" + digits[4:]
    elif digits.startswith("31") and len(digits) == 11:
        digits = "0" + digits[2:]
    if len(digits) != 10 or not digits.startswith("0"):
        return s
    national = digits[1:]
    if national.startswith("6") and len(national) == 9:
        return f"+31 6 {national[1:5]} {national[5:]}"
    if len(national) == 9:
        two_digit = {"20","10","30","70","40","45","46","50","55","58","73","76","77","78","79"}
        a2 = national[:2]
        if a2 in two_digit:
            return f"+31 {a2} {national[2:5]} {national[5:]}"
        return f"+31 {national[:3]} {national[3:6]} {national[6:]}"
    return s


# ── POST-PROCESSOR ─────────────────────────────────────────────────────────────

def _postprocess_result(res: dict) -> dict:
    """Datahygiëne: provincie + telefoon + stroom-logica."""
    if not isinstance(res, dict):
        return res
    if "provincie" in res:
        res["provincie"] = normalize_province(str(res.get("provincie", "")))
    if "telefoonnummer" in res:
        res["telefoonnummer"] = normalize_phone(str(res.get("telefoonnummer", "")))
    if res.get("stroom", "").lower() == "nee":
        res["stroom_prijs"] = "Nee (geen stroom)"
    return res


# ── DATA KLASSEN ───────────────────────────────────────────────────────────────

@dataclass
class BatchStats:
    totaal:       int   = 0
    verwerkt:     int   = 0
    succesvol:    int   = 0
    mislukt:      int   = 0
    overgeslagen: int   = 0
    start_tijd:   float = field(default_factory=time.time)

    @property
    def elapsed(self) -> str:
        s = int(time.time() - self.start_tijd)
        return f"{s // 60}m {s % 60}s"

    @property
    def eta(self) -> str:
        if self.verwerkt == 0:
            return "–"
        per = (time.time() - self.start_tijd) / self.verwerkt
        rem = (self.totaal - self.verwerkt) * per
        m, s = divmod(int(rem), 60)
        return f"~{m}m {s}s"

    @property
    def pct(self) -> float:
        return (self.verwerkt / self.totaal * 100) if self.totaal else 0.0


# ── STAP 1: PARALLELLE SCRAPER ─────────────────────────────────────────────────

def _scrape_one(row_tuple: tuple) -> tuple:
    """Scrapet één locatie: website-tekst + foto's + externe bronnen."""
    from utils.enrichment import (
        scrape_website, scrape_photos,
        scrape_campercontact, scrape_park4night,
    )
    idx, naam, provincie, website = row_tuple
    ws     = scrape_website(website)
    photos = scrape_photos(website, max_photos=6)
    cc     = scrape_campercontact(naam, provincie)
    p4n    = scrape_park4night(naam, provincie)
    return idx, naam, ws, photos, cc, p4n


def parallel_scrape(
    df: pd.DataFrame,
    progress_cb: Callable | None = None,
) -> dict[int, dict]:
    """
    Scrapet alle locaties PARALLEL (ThreadPoolExecutor, 20 workers).
    Bevat nu ook photo-URLs per locatie.

    Returns:
      {idx: {"website": str, "photos": list, "campercontact": str, "park4night": str}}
    """
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    taken = [
        (
            idx,
            str(row.get("naam", "")),
            str(row.get("provincie", "Nederland")),
            str(row.get("website", "")),
        )
        for idx, row in df.iterrows()
    ]
    resultaten: dict[int, dict] = {}
    klaar = 0

    with ThreadPoolExecutor(max_workers=MAX_SCRAPE_WORKERS) as executor:
        futures = {executor.submit(_scrape_one, t): t for t in taken}
        for future in as_completed(futures):
            try:
                idx, naam, ws, photos, cc, p4n = future.result(
                    timeout=SCRAPE_TIMEOUT + 5
                )
                resultaten[idx] = {
                    "website":       ws,
                    "photos":        photos,
                    "campercontact": cc,
                    "park4night":    p4n,
                }
            except Exception as e:
                t = futures[future]
                logger.warning(f"Scrape mislukt voor {t[1]}: {e}")
                resultaten[t[0]] = {
                    "website": "", "photos": [],
                    "campercontact": "", "park4night": "",
                }
            klaar += 1
            if progress_cb:
                progress_cb(klaar, len(taken), f"🌐 Scraping ({klaar}/{len(taken)})…")

    return resultaten


# ── STAP 2: GEMINI REST API ────────────────────────────────────────────────────

def _direct_gemini_call(prompt: str) -> str:
    """
    Directe HTTP REST-aanroep naar Gemini 2.5 Flash.
    Bypast Google SDK volledig → geen gRPC deadlocks.
    """
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
    except (KeyError, Exception):
        raise ValueError("GEMINI_API_KEY ontbreekt in st.secrets")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1},
    }
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=35,
    )
    if resp.status_code == 429:
        raise Exception("429 Too Many Requests")
    if resp.status_code != 200:
        raise Exception(f"API Error {resp.status_code}: {resp.text[:400]}")
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"Onverwachte response structuur: {e}")


def _build_batch_prompt(batch: list[dict]) -> str:
    """Bouwt het Gemini-prompt voor een batch van max 5 locaties."""
    locaties_json = json.dumps(
        [{k: v for k, v in loc.items() if not k.startswith("_")} for loc in batch],
        ensure_ascii=False, indent=2,
    )
    bronnen_blok = ""
    for i, loc in enumerate(batch, 1):
        b = loc.get("_bronnen", {})
        bronnen_blok += (
            f"\n--- Locatie {i}: {loc.get('naam','?')} ---\n"
            f"Website: {b.get('website','')[:2500] or '(niet beschikbaar)'}\n"
            f"Campercontact: {b.get('campercontact','')[:1500] or '(niet gevonden)'}\n"
            f"Park4Night: {b.get('park4night','')[:1500] or '(niet gevonden)'}\n"
        )
    return f"""
Je bent expert data-analist voor VrijStaan (NL camperplatform).
Verrijk {len(batch)} locaties met actuele, accurate data.

BRONINHOUD:
{bronnen_blok}

DATA:
{locaties_json}

INSTRUCTIES:
• Ja=aanwezig | Nee=afwezig (deductie) | Onbekend=echt niet te vinden
• Parkeerplaatsen: stroom=Nee, sanitair=Nee (tenzij bewijs anders)
• Jachthavens: water_tanken=Ja, sanitair=Ja (standaard)
• Provincie ALTIJD officieel NL: Fryslân→Friesland, North Holland→Noord-Holland
• Telefoon: +31 formaat (0612345678 → "+31 6 1234 5678")
• beschrijving: 2-4 sfeervolle zinnen
• samenvatting_reviews: doorlopende Gasten-zin 20-40 woorden
• loc_type: "Camping"/"Camperplaats"/"Parking"/"Jachthaven"/"Boerderij"

Retourneer UITSLUITEND JSON-array met exact {len(batch)} objecten:
[{{
  "naam": "exacte naam",
  "provincie": "officiële NL-provincie",
  "prijs": "€X of Gratis of Onbekend",
  "honden_toegestaan": "Ja/Nee/Onbekend",
  "stroom": "Ja/Nee/Onbekend",
  "stroom_prijs": "€X/nacht of Inbegrepen of Nee (geen stroom) of Onbekend",
  "afvalwater": "Ja/Nee/Onbekend",
  "chemisch_toilet": "Ja/Nee/Onbekend",
  "water_tanken": "Ja/Nee/Onbekend",
  "aantal_plekken": "getal of Onbekend",
  "check_in_out": "tijden of Vrij of Onbekend",
  "beschrijving": "2-4 sfeervolle zinnen",
  "ondergrond": "Gras/Asfalt/Grind/Verhard/Gemengd/Onbekend",
  "toegankelijkheid": "Ja/Nee/Onbekend",
  "rust": "Rustig/Gemiddeld/Druk/Onbekend",
  "sanitair": "Ja/Nee/Onbekend",
  "wifi": "Ja/Nee/Onbekend",
  "waterfront": "Ja/Nee/Onbekend",
  "beoordeling": "bijv. 4.3 of Onbekend",
  "samenvatting_reviews": "Gasten-zin of Onbekend",
  "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
  "roken": "Ja/Nee/Onbekend",
  "feesten": "Ja/Nee/Onbekend",
  "faciliteiten_extra": "CSV extra faciliteiten of Onbekend",
  "huisregels": "tekst of Onbekend",
  "loc_type": "Camping/Camperplaats/etc.",
  "ai_gecheckt": "Ja"
}}]
"""


def ai_batch_enrich(
    batch: list[dict],
    status_cb: Callable | None = None,
    max_retries: int = 4,
) -> list[dict]:
    """
    Verrijkt een batch van max 5 locaties sequentieel via Gemini 2.5 Flash REST.
    Past datahygiëne toe op elk resultaat.
    """
    if not batch:
        return []
    prompt = _build_batch_prompt(batch)
    for poging in range(max_retries):
        try:
            if status_cb and poging > 0:
                status_cb(f"⏳ Retry {poging}/{max_retries}…")
            response = _direct_gemini_call(prompt)
            clean = response.strip()
            for fence in ("```json", "```"):
                clean = clean.replace(fence, "")
            clean = clean.strip()
            start = clean.find("[")
            end   = clean.rfind("]") + 1
            if start == -1 or end == 0:
                raise ValueError("Geen JSON-array gevonden")
            resultaten: list[dict] = json.loads(clean[start:end])
            for i, res in enumerate(resultaten):
                if i < len(batch):
                    res["_idx"] = batch[i].get("_idx")
                    res.pop("_bronnen", None)
                    # Photo's van scraper meenemen
                    bronnen = batch[i].get("_bronnen", {})
                    photos  = bronnen.get("photos", [])
                    if photos:
                        res["photos"] = json.dumps(photos, ensure_ascii=False)
                    _postprocess_result(res)
            return resultaten
        except requests.exceptions.Timeout:
            if status_cb:
                status_cb("⚠️ API timeout. Retry over 5s…")
            time.sleep(5)
        except Exception as e:
            msg = str(e).lower()
            if "429" in msg or "quota" in msg:
                wacht = (poging + 1) * 8
                if status_cb:
                    status_cb(f"⏳ Rate limit. Wacht {wacht}s…")
                time.sleep(wacht)
            else:
                logger.error(f"Batch AI fout: {e}")
                if status_cb:
                    status_cb(f"⚠️ Fout: {e}")
                return batch
    return batch


# ── CHECKPOINT MANAGER ─────────────────────────────────────────────────────────

class CheckpointManager:
    """Beheert incrementele opslag tijdens een lange batch-run."""

    def __init__(self, master_df: pd.DataFrame) -> None:
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)
        self.df                   = master_df.copy()
        self.laatste_csv_save     = 0
        self.laatste_sheets_save  = 0
        self.verwerkt_sinds_start = 0

    def update(self, idx: int, data: dict) -> None:
        if data:
            for key, val in data.items():
                if key.startswith("_"):
                    continue
                if key not in self.df.columns:
                    self.df[key] = "Onbekend"
                if isinstance(val, list):
                    val = json.dumps(val, ensure_ascii=False)
                elif isinstance(val, dict):
                    val = str(val)
                self.df.at[idx, key] = val
        self.df.at[idx, "ai_gecheckt"] = "Ja"
        self.verwerkt_sinds_start += 1

    def maybe_save(self, force: bool = False) -> bool:
        n = self.verwerkt_sinds_start
        if force or (n - self.laatste_csv_save) >= CHECKPOINT_CSV_N:
            try:
                self.df.to_csv(CHECKPOINT_FILE, index=False)
                self.laatste_csv_save = n
            except Exception as e:
                logger.error(f"CSV checkpoint fout: {e}")
        if force or (n - self.laatste_sheets_save) >= CHECKPOINT_SHEETS_N:
            try:
                from utils.data_handler import save_data
                save_data(self.df)
                self.laatste_sheets_save = n
                return True
            except Exception as e:
                logger.error(f"Sheets checkpoint fout: {e}")
        return False

    def load_checkpoint(self) -> pd.DataFrame | None:
        if os.path.exists(CHECKPOINT_FILE):
            try:
                return pd.read_csv(CHECKPOINT_FILE).astype(object).fillna("Onbekend")
            except Exception:
                pass
        return None


# ── HOOFD: VOLAUTOMATISCHE BATCH RUN ──────────────────────────────────────────

def run_full_batch(
    master_df:     pd.DataFrame,
    max_locations: int = 0,           # 0 = onbeperkt (alle)
    progress_cb:   Callable | None = None,
    status_cb:     Callable | None = None,
    stop_flag:     Callable | None = None,  # fn() → bool: True=stop
) -> pd.DataFrame:
    """
    Pijler 3: Volledig automatische batch-run voor alle 750 locaties.
    Geen handmatig klikken per chunk nodig.

    Pipeline:
      1. Herstel vorig checkpoint (auto-resume)
      2. Stap 1: Parallel scrapen in groepen van AUTO_BATCH_SIZE (HTTP)
      3. Stap 2: Sequentieel AI-verrijken in groepen van AI_BATCH_SIZE
      4. Checkpoint-saves elke 25 / 50 locaties
      5. Rate-limit buffer na elke AI-batch

    Args:
      master_df:     Volledige dataset
      max_locations: Maximaal te verwerken (0=alles)
      progress_cb:   fn(gedaan, totaal, label)
      status_cb:     fn(tekst)
      stop_flag:     fn() → bool, True=vroegtijdig stoppen

    Returns:
      Verrijkte DataFrame
    """
    stats      = BatchStats()
    checkpoint = CheckpointManager(master_df)

    # ── Vorig checkpoint herstellen ────────────────────────────────────
    vorig = checkpoint.load_checkpoint()
    if vorig is not None and len(vorig) == len(master_df):
        if status_cb:
            status_cb("♻️ Vorig checkpoint hersteld — hervat verwerking")
        checkpoint.df = vorig

    # ── Subset bepalen ─────────────────────────────────────────────────
    gecheckt_col = checkpoint.df.get(
        "ai_gecheckt", pd.Series("Nee", index=checkpoint.df.index)
    )
    mask       = gecheckt_col != "Ja"
    to_process = checkpoint.df[mask]
    if max_locations > 0:
        to_process = to_process.head(max_locations)

    stats.totaal      = len(to_process)
    stats.overgeslagen = int((~mask).sum())

    if stats.totaal == 0:
        if status_cb:
            status_cb("✅ Alle locaties zijn al verrijkt!")
        return checkpoint.df

    if status_cb:
        status_cb(
            f"🚀 Start volautomatische batch: {stats.totaal} locaties te verwerken "
            f"({stats.overgeslagen} al klaar)"
        )

    rijen = list(to_process.iterrows())
    totaal_batches = (len(rijen) + AI_BATCH_SIZE - 1) // AI_BATCH_SIZE

    # ── Volautomatische scrape + AI loop ──────────────────────────────
    # Scrapen in blokken van AUTO_BATCH_SIZE, AI per AI_BATCH_SIZE
    for batch_nr in range(totaal_batches):
        # Vroeg stoppen indien aangevraagd
        if stop_flag and stop_flag():
            if status_cb:
                status_cb(f"🛑 Gestopt op verzoek bij {stats.verwerkt}/{stats.totaal}")
            break

        start_idx = batch_nr * AI_BATCH_SIZE
        end_idx   = min(start_idx + AI_BATCH_SIZE, len(rijen))
        batch_rijen = rijen[start_idx:end_idx]

        # ── Scrapen (parallel, kleine sub-batch) ──────────────────────
        sub_df = to_process.iloc[start_idx:end_idx]
        if status_cb:
            status_cb(
                f"🌐 Scraping batch {batch_nr + 1}/{totaal_batches} "
                f"({len(batch_rijen)} locaties)…"
            )

        scrape_resultaten = parallel_scrape(sub_df)

        # ── AI verrijking (sequentieel) ────────────────────────────────
        batch_input = []
        for idx, row in batch_rijen:
            bronnen = scrape_resultaten.get(idx, {})
            batch_input.append({
                "_idx":      idx,
                "_bronnen":  bronnen,
                "naam":      str(row.get("naam", "")),
                "provincie": str(row.get("provincie", "Nederland")),
                "website":   str(row.get("website", "")),
            })

        if status_cb:
            status_cb(
                f"🤖 AI batch {batch_nr + 1}/{totaal_batches} · "
                f"ETA {stats.eta}"
            )

        batch_resultaten = ai_batch_enrich(batch_input, status_cb=status_cb)

        # ── Resultaten opslaan ─────────────────────────────────────────
        for i, res in enumerate(batch_resultaten):
            if i < len(batch_rijen):
                orig_idx = batch_rijen[i][0]
                checkpoint.update(orig_idx, res)
                stats.verwerkt  += 1
                stats.succesvol += 1 if isinstance(res, dict) and res.get("naam") else 0

        if progress_cb:
            progress_cb(
                stats.verwerkt,
                stats.totaal,
                f"🤖 Batch {batch_nr + 1}/{totaal_batches} · "
                f"{stats.verwerkt}/{stats.totaal} klaar · ETA {stats.eta}",
            )

        sheets_saved = checkpoint.maybe_save()
        if status_cb and sheets_saved:
            status_cb(
                f"💾 Opgeslagen: {stats.verwerkt}/{stats.totaal} · "
                f"Verstreken: {stats.elapsed}"
            )

        # Rate-limit buffer
        time.sleep(RATE_LIMIT_DELAY)

    # ── Finale opslag ──────────────────────────────────────────────────
    checkpoint.maybe_save(force=True)

    if status_cb:
        status_cb(
            f"🎉 Klaar! {stats.succesvol}/{stats.totaal} locaties verrijkt "
            f"in {stats.elapsed}."
        )

    return checkpoint.df


# ── HULPFUNCTIES VOOR BEHEER-PAGINA ───────────────────────────────────────────

def get_onbekend_stats(df: pd.DataFrame) -> dict:
    """Telt 'Onbekend'-waarden per veld. Gebruikt door Beheer-pagina."""
    velden = [
        "prijs", "honden_toegestaan", "stroom", "sanitair", "wifi",
        "water_tanken", "afvalwater", "beoordeling", "beschrijving",
        "telefoonnummer", "provincie",
    ]
    result = {}
    for veld in velden:
        if veld in df.columns:
            n = int((df[veld].astype(str).str.lower() == "onbekend").sum())
            result[veld] = {"onbekend": n, "pct": round(n / max(len(df), 1) * 100, 1)}
    return result


def estimate_batch_time(n: int) -> str:
    """Schatting van verwerkingstijd voor n locaties."""
    scrape  = (n / MAX_SCRAPE_WORKERS * 2) / 60
    ai      = (n / AI_BATCH_SIZE * 5)      / 60
    overhead = (n / AI_BATCH_SIZE * RATE_LIMIT_DELAY) / 60
    totaal = scrape + ai + overhead
    return f"~{int(totaal)} – {int(totaal * 1.4)} minuten"
