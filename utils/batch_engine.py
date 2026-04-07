"""
utils/batch_engine.py — VrijStaan High-Performance Batch Engine v5.
Pijler 5: MD5 hash-check skip, Exponential Backoff OSM, full-auto batching,
multi-photo, Pijler 6 camper-velden.

Architectuur:
  - ThreadPoolExecutor: parallelle HTTP-scraping
  - Sequentiële AI (main thread): geen gRPC deadlocks
  - MD5 hash-check: skip AI als websitetekst ongewijzigd
  - Exponential Backoff + custom User-Agent voor OSM/Overpass
  - normalize_province() + normalize_phone(): datahygiëne
  - Checkpoint: elke 25 CSV, elke 50 Sheets
"""
from __future__ import annotations

import json
import os
import re
import time
import logging
import random
import requests
import streamlit as st
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Callable

import pandas as pd

logger = logging.getLogger("vrijstaan.batch_engine")

# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
MAX_SCRAPE_WORKERS  = 20
AI_BATCH_SIZE       = 5
CHECKPOINT_CSV_N    = 25
CHECKPOINT_SHEETS_N = 50
SCRAPE_TIMEOUT      = 10
RATE_LIMIT_DELAY    = 0.6
CHECKPOINT_DIR      = "data/checkpoints"
CHECKPOINT_FILE     = f"{CHECKPOINT_DIR}/batch_progress.csv"

# OSM Exponential Backoff (Pijler 5)
OSM_MAX_RETRIES   = 5
OSM_BASE_DELAY    = 2.0
OSM_USER_AGENT    = "VrijStaan/5.0 (vrijstaan.nl; contact@vrijstaan.nl)"


# ── PROVINCIE NORMALISATIE ─────────────────────────────────────────────────────

_NL_PROVINCES = {
    "groningen", "friesland", "drenthe", "overijssel", "flevoland",
    "gelderland", "utrecht", "noord-holland", "zuid-holland",
    "zeeland", "noord-brabant", "limburg",
}

_PROVINCE_MAP: dict[str, str] = {
    "fryslân":        "Friesland",    "fryslan":        "Friesland",
    "frisian":        "Friesland",    "friesland":      "Friesland",
    "north holland":  "Noord-Holland","north-holland":   "Noord-Holland",
    "noord holland":  "Noord-Holland","noordholland":    "Noord-Holland",
    "south holland":  "Zuid-Holland", "south-holland":   "Zuid-Holland",
    "zuidholland":    "Zuid-Holland", "south holand":    "Zuid-Holland",
    "sud-holland":    "Zuid-Holland", "sud holland":     "Zuid-Holland",
    "north brabant":  "Noord-Brabant","north-brabant":   "Noord-Brabant",
    "noord brabant":  "Noord-Brabant","noordbrabant":    "Noord-Brabant",
    "nb":             "Noord-Brabant",
    "groningen":      "Groningen",    "drenthe":         "Drenthe",
    "overijssel":     "Overijssel",   "flevoland":       "Flevoland",
    "gelderland":     "Gelderland",   "guelders":        "Gelderland",
    "utrecht":        "Utrecht",      "zeeland":         "Zeeland",
    "zealand":        "Zeeland",      "limburg":         "Limburg",
}


def normalize_province(raw: str) -> str:
    """Normaliseer naar officiële Nederlandse provincienaam."""
    if not raw:
        return "Onbekend"
    s = str(raw).strip()
    if s.lower() in ("onbekend", "nan", "none", "", "-", "unknown"):
        return "Onbekend"
    if m := _PROVINCE_MAP.get(s.lower()):
        return m
    for variant, canonical in _PROVINCE_MAP.items():
        if variant in s.lower():
            return canonical
    return s


# ── TELEFOON NORMALISATIE ──────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    """Normaliseer NL telefoonnummer naar +31 formaat."""
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


def _postprocess(res: dict) -> dict:
    """Pas datahygiëne toe + logische consistentie."""
    if not isinstance(res, dict):
        return res
    if "provincie" in res:
        res["provincie"] = normalize_province(str(res.get("provincie", "")))
    if "telefoonnummer" in res:
        res["telefoonnummer"] = normalize_phone(str(res.get("telefoonnummer", "")))
    if res.get("stroom", "").lower() == "nee":
        res["stroom_prijs"] = "Nee (geen stroom)"
    return res


# ── STATISTIEKEN ───────────────────────────────────────────────────────────────

@dataclass
class BatchStats:
    totaal:       int   = 0
    verwerkt:     int   = 0
    succesvol:    int   = 0
    overgeslagen: int   = 0   # hash-match skip
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
    """Scrapet één locatie: tekst + foto's + CC + P4N."""
    from utils.enrichment import (
        scrape_website, scrape_photos,
        scrape_campercontact, scrape_park4night,
        compute_text_hash,
    )
    idx, naam, provincie, website, stored_hash = row_tuple
    ws     = scrape_website(website)
    new_hsh = compute_text_hash(ws) if ws else ""
    # MD5 hash-check: als identiek, markeer als skip
    skip   = bool(stored_hash and stored_hash == new_hsh and new_hsh)
    photos = scrape_photos(website, max_photos=8) if not skip else []
    cc     = scrape_campercontact(naam, provincie) if not skip else ""
    p4n    = scrape_park4night(naam, provincie)   if not skip else ""
    return idx, naam, ws, photos, cc, p4n, new_hsh, skip


def parallel_scrape(
    df: pd.DataFrame,
    progress_cb: Callable | None = None,
) -> dict[int, dict]:
    """
    Scrapet alle locaties parallel (20 workers).
    Bevat MD5 hash-check per locatie.

    Returns:
      {idx: {"website": str, "photos": list, "campercontact": str,
             "park4night": str, "text_hash": str, "skip": bool}}
    """
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    taken = [
        (
            idx,
            str(row.get("naam", "")),
            str(row.get("provincie", "Nederland")),
            str(row.get("website", "")),
            str(row.get("text_hash", "")),  # opgeslagen hash
        )
        for idx, row in df.iterrows()
    ]
    resultaten: dict[int, dict] = {}
    klaar = 0

    with ThreadPoolExecutor(max_workers=MAX_SCRAPE_WORKERS) as executor:
        futures = {executor.submit(_scrape_one, t): t for t in taken}
        for future in as_completed(futures):
            try:
                idx, naam, ws, photos, cc, p4n, new_hsh, skip = future.result(
                    timeout=SCRAPE_TIMEOUT + 5
                )
                resultaten[idx] = {
                    "website": ws, "photos": photos,
                    "campercontact": cc, "park4night": p4n,
                    "text_hash": new_hsh, "skip": skip,
                }
            except Exception as e:
                t = futures[future]
                logger.warning(f"Scrape fout voor {t[1]}: {e}")
                resultaten[t[0]] = {
                    "website": "", "photos": [], "campercontact": "",
                    "park4night": "", "text_hash": "", "skip": False,
                }
            klaar += 1
            if progress_cb:
                progress_cb(klaar, len(taken), f"🌐 Scraping ({klaar}/{len(taken)})…")

    return resultaten


# ── STAP 2: GEMINI REST API ────────────────────────────────────────────────────

def _direct_gemini_call(prompt: str) -> str:
    """HTTP REST naar Gemini 2.5 Flash. Bypast SDK volledig → geen gRPC."""
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
    except Exception:
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
        url, headers={"Content-Type": "application/json"},
        json=payload, timeout=35,
    )
    if resp.status_code == 429:
        raise Exception("429 Too Many Requests")
    if resp.status_code != 200:
        raise Exception(f"API Error {resp.status_code}: {resp.text[:400]}")
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"Onverwachte response: {e}")


def _build_batch_prompt(batch: list[dict]) -> str:
    """Batch-prompt voor Gemini met Pijler 6 velden."""
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
VrijStaan data-batch voor {len(batch)} camperplaatsen.

BRONNEN:
{bronnen_blok}

DATA:
{locaties_json}

INSTRUCTIES:
• Ja=aanwezig | Nee=afwezig (deductie) | Onbekend=echt onbekend
• Parkeerplaatsen: stroom=Nee, sanitair=Nee tenzij bewijs
• drukte_indicator: "Snel vol" / "Gemiddeld druk" / "Vaak een plek vrij"
• max_lengte: voertuig max lengte (bijv. "9 meter" of "Geen beperking")
• max_gewicht: max gewicht (bijv. "3.5 ton" of "Geen beperking")
• remote_work_score: "Uitstekend (4G/5G)" / "Goed (4G)" / "Matig" / "Onbekend"
• Provincie altijd officieel NL. Telefoon: +31 formaat.
• loc_type: "Camping"/"Camperplaats"/"Parking"/"Jachthaven"/"Boerderij"

Retourneer UITSLUITEND JSON-array met exact {len(batch)} objecten:
[{{
  "naam": "exacte naam", "provincie": "NL-provincie",
  "prijs": "€X of Gratis of Onbekend",
  "honden_toegestaan": "Ja/Nee/Onbekend", "stroom": "Ja/Nee/Onbekend",
  "stroom_prijs": "...", "afvalwater": "Ja/Nee/Onbekend",
  "chemisch_toilet": "Ja/Nee/Onbekend", "water_tanken": "Ja/Nee/Onbekend",
  "aantal_plekken": "...", "check_in_out": "...",
  "beschrijving": "2-4 zinnen", "ondergrond": "...", "toegankelijkheid": "...",
  "rust": "...", "sanitair": "...", "wifi": "...", "waterfront": "...",
  "beoordeling": "...", "samenvatting_reviews": "...", "reviews_tekst": "...",
  "telefoonnummer": "+31 ...", "roken": "...", "feesten": "...",
  "faciliteiten_extra": "...", "huisregels": "...",
  "drukte_indicator": "...", "max_lengte": "...",
  "max_gewicht": "...", "remote_work_score": "...",
  "loc_type": "...", "ai_gecheckt": "Ja"
}}]
"""


def ai_batch_enrich(
    batch: list[dict],
    status_cb: Callable | None = None,
    max_retries: int = 4,
) -> list[dict]:
    """
    Verrijkt batch van max 5 locaties via Gemini REST (sequentieel).
    MD5-skip locaties worden automatisch overgeslagen.
    """
    # Filter hash-skip locaties
    to_process = [loc for loc in batch if not loc.get("_skip")]
    skip_locs  = [loc for loc in batch if loc.get("_skip")]

    results: list[dict] = list(skip_locs)  # Voeg skips direct terug

    if not to_process:
        return results

    prompt = _build_batch_prompt(to_process)
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
                raise ValueError("Geen JSON-array")
            verrijkt: list[dict] = json.loads(clean[start:end])
            for i, res in enumerate(verrijkt):
                if i < len(to_process):
                    res["_idx"]       = to_process[i].get("_idx")
                    res["text_hash"]  = to_process[i].get("_bronnen", {}).get("text_hash", "")
                    bronnen           = to_process[i].get("_bronnen", {})
                    photos            = bronnen.get("photos", [])
                    res["photos"]     = json.dumps(photos, ensure_ascii=False) if photos else "[]"
                    res.pop("_bronnen", None)
                    _postprocess(res)
            results.extend(verrijkt)
            return results
        except requests.exceptions.Timeout:
            if status_cb: status_cb("⚠️ Timeout. Retry over 5s…")
            time.sleep(5)
        except Exception as e:
            msg = str(e).lower()
            if "429" in msg or "quota" in msg:
                wacht = (2 ** poging) + random.uniform(0, 2)
                if status_cb: status_cb(f"⏳ Rate limit. Wacht {wacht:.0f}s…")
                time.sleep(wacht)
            else:
                logger.error(f"Batch AI fout: {e}")
                return batch

    return batch


# ── CHECKPOINT MANAGER ─────────────────────────────────────────────────────────

class CheckpointManager:
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
                if isinstance(val, (list, dict)):
                    val = json.dumps(val, ensure_ascii=False)
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


# ── VOLAUTOMATISCHE BATCH RUN ──────────────────────────────────────────────────

def run_full_batch(
    master_df:     pd.DataFrame,
    max_locations: int = 0,
    progress_cb:   Callable | None = None,
    status_cb:     Callable | None = None,
    stop_flag:     Callable | None = None,
) -> pd.DataFrame:
    """
    Pijler 5: Volledig automatische batch voor alle 750 locaties.

    Nieuw in v5:
    - MD5 hash-check per locatie (skip als ongewijzigd)
    - Foto-URLs worden meegenomen in batch output
    - Pijler 6 velden in batch prompt
    - Exponential backoff bij rate limits
    - stop_flag voor graceful cancel

    Returns:
      Verrijkte DataFrame
    """
    stats      = BatchStats()
    checkpoint = CheckpointManager(master_df)

    vorig = checkpoint.load_checkpoint()
    if vorig is not None and len(vorig) == len(master_df):
        if status_cb: status_cb("♻️ Checkpoint hersteld")
        checkpoint.df = vorig

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
        if status_cb: status_cb("✅ Alle locaties al verrijkt!")
        return checkpoint.df

    if status_cb:
        status_cb(
            f"🚀 Start: {stats.totaal} te verwerken "
            f"({stats.overgeslagen} al klaar)"
        )

    rijen          = list(to_process.iterrows())
    totaal_batches = (len(rijen) + AI_BATCH_SIZE - 1) // AI_BATCH_SIZE

    for batch_nr in range(totaal_batches):
        if stop_flag and stop_flag():
            if status_cb: status_cb(f"🛑 Gestopt bij {stats.verwerkt}/{stats.totaal}")
            break

        start_i     = batch_nr * AI_BATCH_SIZE
        end_i       = min(start_i + AI_BATCH_SIZE, len(rijen))
        batch_rijen = rijen[start_i:end_i]

        # Parallel scrapen
        sub_df = to_process.iloc[start_i:end_i]
        if status_cb:
            status_cb(f"🌐 Scraping batch {batch_nr+1}/{totaal_batches}…")
        scrape_res = parallel_scrape(sub_df)

        # AI-verrijking input
        batch_input = []
        for idx, row in batch_rijen:
            bronnen = scrape_res.get(idx, {})
            skip    = bronnen.get("skip", False)
            batch_input.append({
                "_idx":      idx,
                "_skip":     skip,
                "_bronnen":  bronnen,
                "naam":      str(row.get("naam", "")),
                "provincie": str(row.get("provincie", "Nederland")),
                "website":   str(row.get("website", "")),
            })
            if skip:
                stats.overgeslagen += 1

        if status_cb:
            status_cb(
                f"🤖 AI batch {batch_nr+1}/{totaal_batches} · ETA {stats.eta}"
            )

        batch_resultaten = ai_batch_enrich(batch_input, status_cb=status_cb)

        for i, res in enumerate(batch_resultaten):
            if i < len(batch_rijen):
                orig_idx = batch_rijen[i][0]
                if res.get("_hash_skip") or res.get("_skip"):
                    checkpoint.df.at[orig_idx, "ai_gecheckt"] = "Ja"
                else:
                    checkpoint.update(orig_idx, res)
                stats.verwerkt  += 1
                stats.succesvol += 1 if isinstance(res, dict) and res.get("naam") else 0

        if progress_cb:
            progress_cb(
                stats.verwerkt, stats.totaal,
                f"🤖 Batch {batch_nr+1}/{totaal_batches} · "
                f"{stats.verwerkt}/{stats.totaal} · ETA {stats.eta}",
            )

        checkpoint.maybe_save()
        time.sleep(RATE_LIMIT_DELAY)

    checkpoint.maybe_save(force=True)
    if status_cb:
        status_cb(
            f"🎉 Klaar! {stats.succesvol}/{stats.totaal} verrijkt in {stats.elapsed}. "
            f"{stats.overgeslagen} overgeslagen (hash-match)."
        )

    return checkpoint.df


# ── OSM SYNC MET EXPONENTIAL BACKOFF (Pijler 5) ───────────────────────────────

def fetch_osm_with_backoff(overpass_query: str) -> dict:
    """
    Haalt OSM-data op met Exponential Backoff + custom User-Agent.
    Pijler 5: robuuste Overpass API aanroep.

    Returns:
      Parsed JSON response of lege dict bij aanhoudende fout.
    """
    headers = {
        "User-Agent":    OSM_USER_AGENT,
        "Accept":        "application/json",
        "Content-Type":  "application/x-www-form-urlencoded",
    }
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
    ]

    for attempt in range(OSM_MAX_RETRIES):
        endpoint = endpoints[attempt % len(endpoints)]
        delay    = OSM_BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)

        try:
            resp = requests.post(
                endpoint,
                data={"data": overpass_query},
                headers=headers,
                timeout=130,
            )
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                logger.warning(f"OSM rate limit (429). Wacht {delay:.1f}s…")
                time.sleep(delay)
            elif resp.status_code in (500, 503, 504):
                logger.warning(f"OSM server fout {resp.status_code}. Wacht {delay:.1f}s…")
                time.sleep(delay)
            else:
                logger.error(f"OSM onverwacht: {resp.status_code}")
                break
        except requests.exceptions.Timeout:
            logger.warning(f"OSM timeout (poging {attempt+1}). Wacht {delay:.1f}s…")
            time.sleep(delay)
        except Exception as e:
            logger.error(f"OSM verbindingsfout: {e}")
            time.sleep(delay)

    logger.error("OSM: alle pogingen mislukt")
    return {}


# ── HULPFUNCTIES ───────────────────────────────────────────────────────────────

def get_onbekend_stats(df: pd.DataFrame) -> dict:
    """Telt 'Onbekend'-waarden per veld."""
    velden = [
        "prijs", "honden_toegestaan", "stroom", "sanitair", "wifi",
        "water_tanken", "afvalwater", "beoordeling", "beschrijving",
        "telefoonnummer", "provincie", "drukte_indicator",
        "max_lengte", "max_gewicht", "remote_work_score",
    ]
    return {
        veld: {
            "onbekend": int((df[veld].astype(str).str.lower() == "onbekend").sum()),
            "pct": round(
                int((df[veld].astype(str).str.lower() == "onbekend").sum())
                / max(len(df), 1) * 100, 1
            ),
        }
        for veld in velden
        if veld in df.columns
    }


def estimate_batch_time(n: int) -> str:
    scrape  = (n / MAX_SCRAPE_WORKERS * 2) / 60
    ai      = (n / AI_BATCH_SIZE * 5)      / 60
    overhead = n * RATE_LIMIT_DELAY         / 60
    totaal  = scrape + ai + overhead
    return f"~{int(totaal)} – {int(totaal * 1.4)} minuten"
