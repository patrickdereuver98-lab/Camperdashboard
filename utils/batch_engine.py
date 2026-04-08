"""
utils/batch_engine.py — VrijStaan v5 High-Performance Batch Engine.
Pijler 5: IO/Compute split, MD5 hash-check, agentic workflow, auto-pilot.
Pijler 7: Exponential backoff voor OSM Overpass API.
"""
from __future__ import annotations

import hashlib
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
CHECKPOINT_DIR      = "data/checkpoints"
CHECKPOINT_FILE     = f"{CHECKPOINT_DIR}/batch_progress.csv"
RATE_LIMIT_DELAY    = 0.6

# OSM Overpass endpoints met Exponential Backoff (Pijler 5/7)
_OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]
_OSM_USER_AGENT = (
    "VrijStaan/5.0 (Streamlit; camperplaatsen-NL; "
    "contact: admin@vrijstaan.nl)"
)


# ── PROVINCIE NORMALISATIE ─────────────────────────────────────────────────────

_PROVINCE_MAP: dict[str, str] = {
    "fryslân": "Friesland",        "fryslan": "Friesland",
    "frisian": "Friesland",        "friesland": "Friesland",
    "north holland": "Noord-Holland","north-holland": "Noord-Holland",
    "noord holland": "Noord-Holland","noordholland": "Noord-Holland",
    "south holland": "Zuid-Holland","south-holland": "Zuid-Holland",
    "zuidholland": "Zuid-Holland",  "south holand": "Zuid-Holland",
    "north brabant": "Noord-Brabant","north-brabant": "Noord-Brabant",
    "noord brabant": "Noord-Brabant","noordbrabant": "Noord-Brabant",
    "nb": "Noord-Brabant",
    "groningen": "Groningen",       "drenthe": "Drenthe",
    "overijssel": "Overijssel",     "flevoland": "Flevoland",
    "gelderland": "Gelderland",     "guelders": "Gelderland",
    "utrecht": "Utrecht",           "zeeland": "Zeeland",
    "zealand": "Zeeland",           "limburg": "Limburg",
    "sud-holland": "Zuid-Holland",  "sud holland": "Zuid-Holland",
}

_NL_PROVINCES = {
    "groningen", "friesland", "drenthe", "overijssel", "flevoland",
    "gelderland", "utrecht", "noord-holland", "zuid-holland",
    "zeeland", "noord-brabant", "limburg",
}


def normalize_province(raw: str) -> str:
    """Officiële NL provincienaam normalisatie."""
    if not raw:
        return "Onbekend"
    s = str(raw).strip()
    if s.lower() in ("onbekend", "nan", "none", "", "-", "unknown"):
        return "Onbekend"
    mapped = _PROVINCE_MAP.get(s.lower())
    if mapped:
        return mapped
    if s.lower() in _NL_PROVINCES:
        return s.title()
    for variant, canonical in _PROVINCE_MAP.items():
        if variant in s.lower():
            return canonical
    return s


# ── TELEFOON NORMALISATIE ──────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    """NL telefoonnummer → +31 formaat."""
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
        two = {"20","10","30","70","40","45","46","50","55","58","73","76","77","78","79"}
        a2 = national[:2]
        if a2 in two:
            return f"+31 {a2} {national[2:5]} {national[5:]}"
        return f"+31 {national[:3]} {national[3:6]} {national[6:]}"
    return s


# ── POST-PROCESSOR ─────────────────────────────────────────────────────────────

def _postprocess_result(res: dict) -> dict:
    """Provincie + telefoon normalisatie + logische consistentie."""
    if not isinstance(res, dict):
        return res
    if "provincie" in res:
        res["provincie"] = normalize_province(str(res.get("provincie", "")))
    if "telefoonnummer" in res:
        res["telefoonnummer"] = normalize_phone(str(res.get("telefoonnummer", "")))
    if res.get("stroom", "").lower() == "nee":
        res["stroom_prijs"] = "Nee (geen stroom)"
    return res


# ── STATS DATACLASS ────────────────────────────────────────────────────────────

@dataclass
class BatchStats:
    totaal:       int   = 0
    verwerkt:     int   = 0
    succesvol:    int   = 0
    mislukt:      int   = 0
    overgeslagen: int   = 0
    hash_skipped: int   = 0   # Pijler 5: MD5 skip
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


# ── PARALLELLE SCRAPER ─────────────────────────────────────────────────────────

def _scrape_one(row_tuple: tuple) -> tuple:
    """Scrapet één locatie: tekst + foto's + externe bronnen."""
    from utils.enrichment import (
        scrape_website, scrape_photos,
        scrape_campercontact, scrape_park4night,
        website_changed,
    )
    idx, naam, provincie, website = row_tuple
    ws     = scrape_website(website)
    changed = website_changed(website, ws)
    photos = scrape_photos(website, max_photos=6) if ws else []
    cc     = scrape_campercontact(naam, provincie)
    p4n    = scrape_park4night(naam, provincie)
    return idx, naam, ws, photos, cc, p4n, changed


def parallel_scrape(
    df: pd.DataFrame,
    progress_cb: Callable | None = None,
) -> dict[int, dict]:
    """
    IO-fase: Parallelle HTTP scraping (ThreadPoolExecutor, 20 workers).
    Pijler 5: Bevat website_changed flag per locatie.
    """
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    taken = [
        (idx, str(row.get("naam", "")),
         str(row.get("provincie", "Nederland")),
         str(row.get("website", "")))
        for idx, row in df.iterrows()
    ]
    resultaten: dict[int, dict] = {}
    klaar = 0

    with ThreadPoolExecutor(max_workers=MAX_SCRAPE_WORKERS) as executor:
        futures = {executor.submit(_scrape_one, t): t for t in taken}
        for future in as_completed(futures):
            try:
                idx, naam, ws, photos, cc, p4n, changed = future.result(
                    timeout=SCRAPE_TIMEOUT + 5
                )
                resultaten[idx] = {
                    "website": ws, "photos": photos,
                    "campercontact": cc, "park4night": p4n,
                    "website_changed": changed,
                }
            except Exception as e:
                t = futures[future]
                logger.warning(f"Scrape mislukt voor {t[1]}: {e}")
                resultaten[t[0]] = {
                    "website": "", "photos": [],
                    "campercontact": "", "park4night": "",
                    "website_changed": True,
                }
            klaar += 1
            if progress_cb:
                progress_cb(klaar, len(taken), f"🌐 Scraping ({klaar}/{len(taken)})…")

    return resultaten


# ── GEMINI REST AANROEP ────────────────────────────────────────────────────────

def _direct_gemini_call(prompt: str) -> str:
    """Directe REST-aanroep naar Gemini 2.5 Flash. Bypast gRPC."""
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


# ── AI BATCH PROMPT ────────────────────────────────────────────────────────────

def _build_batch_prompt(batch: list[dict]) -> str:
    """Pijler 6: Bevat camper-specifieke velden in batch prompt."""
    locaties_json = json.dumps(
        [{k: v for k, v in loc.items() if not k.startswith("_")} for loc in batch],
        ensure_ascii=False, indent=2,
    )
    bronnen_blok = ""
    for i, loc in enumerate(batch, 1):
        b = loc.get("_bronnen", {})
        bronnen_blok += (
            f"\n--- Locatie {i}: {loc.get('naam','?')} ---\n"
            f"Website: {b.get('website','')[:2000] or '(niet beschikbaar)'}\n"
            f"Campercontact: {b.get('campercontact','')[:1500] or '(niet gevonden)'}\n"
            f"Park4Night: {b.get('park4night','')[:1500] or '(niet gevonden)'}\n"
        )

    return f"""
Je bent expert data-analist voor VrijStaan (NL camperplatform).
Verrijk {len(batch)} locaties met ACTUELE, ACCURATE data.

BRONINHOUD:
{bronnen_blok}

DATA:
{locaties_json}

INSTRUCTIES:
• Ja=aanwezig | Nee=afwezig (deductie) | Onbekend=echt niet te vinden
• Parkeerplaatsen: stroom=Nee, sanitair=Nee (tenzij bewijs)
• Jachthavens: water_tanken=Ja, sanitair=Ja (standaard)
• Provincie OFFICIEEL NL: Fryslân→Friesland, North Holland→Noord-Holland etc.
• Telefoon: +31 formaat
• beschrijving: 2-4 sfeervolle zinnen
• drukte_indicator: "Snel vol", "Druk", "Vaak plek", "Buiten seizoen rustig" etc.
• max_lengte: maximale voertuiglengte (bijv. "8m", "12m", "Geen beperking")
• max_gewicht: maximaal gewicht (bijv. "3.5t", "Geen beperking")
• remote_work_score: 4G/5G kwaliteit omschrijving
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
  "samenvatting_reviews": "Gasten-zin 20-40 woorden of Onbekend",
  "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
  "roken": "Ja/Nee/Onbekend",
  "feesten": "Ja/Nee/Onbekend",
  "faciliteiten_extra": "CSV extra faciliteiten of Onbekend",
  "huisregels": "tekst of Onbekend",
  "loc_type": "Camping/Camperplaats/etc.",
  "drukte_indicator": "omschrijving drukte of Onbekend",
  "max_lengte": "bijv. '8m' of 'Geen beperking' of 'Onbekend'",
  "max_gewicht": "bijv. '3.5t' of 'Geen beperking' of 'Onbekend'",
  "remote_work_score": "bijv. 'Goed (4G LTE)' of 'Onbekend'",
  "voertuig_types": "bijv. 'Campervan, Caravan' of 'Onbekend'",
  "tarieftype": "Per nacht/Gratis/Onbekend",
  "ai_gecheckt": "Ja"
}}]
"""


def ai_batch_enrich(
    batch: list[dict],
    status_cb: Callable | None = None,
    max_retries: int = 4,
) -> list[dict]:
    """
    Compute-fase: Sequentieel AI verrijken (main thread, geen race conditions).
    Pijler 5: Slaat AI over voor locaties waarbij website_changed=False EN al gecheckt.
    """
    if not batch:
        return []

    # Pijler 5: Skip batch entries waarbij website niet veranderd is
    to_process = []
    skipped_results = []
    for entry in batch:
        bronnen = entry.get("_bronnen", {})
        changed = bronnen.get("website_changed", True)
        # Als website niet veranderd en al eerder verrijkt → skip AI
        if not changed and entry.get("ai_gecheckt", "Nee") == "Ja":
            skipped_results.append({**entry, "_skip": True})
        else:
            to_process.append(entry)

    if not to_process:
        return skipped_results

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
                raise ValueError("Geen JSON-array gevonden")

            resultaten: list[dict] = json.loads(clean[start:end])

            for i, res in enumerate(resultaten):
                if i < len(to_process):
                    res["_idx"] = to_process[i].get("_idx")
                    res.pop("_bronnen", None)
                    # Photo's toevoegen
                    photos = to_process[i].get("_bronnen", {}).get("photos", [])
                    if photos:
                        res["photos"] = json.dumps(photos, ensure_ascii=False)
                    _postprocess_result(res)

            return skipped_results + resultaten

        except requests.exceptions.Timeout:
            if status_cb:
                status_cb("⚠️ Timeout. Retry over 5s…")
            time.sleep(5)
        except Exception as e:
            msg = str(e).lower()
            if "429" in msg or "quota" in msg:
                # Exponential backoff + jitter
                wacht = (2 ** poging) * 5 + random.uniform(0, 3)
                if status_cb:
                    status_cb(f"⏳ Rate limit. Wacht {wacht:.0f}s…")
                time.sleep(wacht)
            else:
                logger.error(f"Batch AI fout: {e}")
                if status_cb:
                    status_cb(f"⚠️ Fout: {e}")
                return skipped_results + to_process

    return skipped_results + to_process


# ── CHECKPOINT MANAGER ─────────────────────────────────────────────────────────

class CheckpointManager:
    def __init__(self, master_df: pd.DataFrame) -> None:
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)
        self.df                   = master_df.copy()
        self.laatste_csv_save     = 0
        self.laatste_sheets_save  = 0
        self.verwerkt_sinds_start = 0

    def update(self, idx: int, data: dict) -> None:
        if data and not data.get("_skip"):
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
                logger.error(f"CSV save fout: {e}")

        if force or (n - self.laatste_sheets_save) >= CHECKPOINT_SHEETS_N:
            try:
                from utils.data_handler import save_data
                save_data(self.df)
                self.laatste_sheets_save = n
                return True
            except Exception as e:
                logger.error(f"Sheets save fout: {e}")
        return False

    def load_checkpoint(self) -> pd.DataFrame | None:
        if os.path.exists(CHECKPOINT_FILE):
            try:
                return pd.read_csv(CHECKPOINT_FILE).astype(object).fillna("Onbekend")
            except Exception:
                pass
        return None


# ── AUTO-PILOT BATCH RUN (Pijler 5) ───────────────────────────────────────────

def run_full_batch(
    master_df:     pd.DataFrame,
    max_locations: int = 0,
    progress_cb:   Callable | None = None,
    status_cb:     Callable | None = None,
    stop_flag:     Callable | None = None,
) -> pd.DataFrame:
    """
    Pijler 5: Volledig automatische batch-run.
    IO/Compute split: scraping parallel (20 workers), AI sequentieel.
    MD5 hash-check: slaat AI over voor ongewijzigde websites.
    Exponential backoff bij rate limits.
    Auto-resume via checkpoint.
    """
    stats      = BatchStats()
    checkpoint = CheckpointManager(master_df)

    vorig = checkpoint.load_checkpoint()
    if vorig is not None and len(vorig) == len(master_df):
        if status_cb:
            status_cb("♻️ Checkpoint hersteld — hervatten")
        checkpoint.df = vorig

    gecheckt = checkpoint.df.get("ai_gecheckt", pd.Series("Nee", index=checkpoint.df.index))
    mask     = gecheckt != "Ja"
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
        status_cb(f"🚀 Auto-pilot gestart: {stats.totaal} locaties te verwerken")

    rijen = list(to_process.iterrows())
    totaal_batches = (len(rijen) + AI_BATCH_SIZE - 1) // AI_BATCH_SIZE

    for batch_nr in range(totaal_batches):
        if stop_flag and stop_flag():
            if status_cb:
                status_cb(f"🛑 Gestopt bij {stats.verwerkt}/{stats.totaal}")
            break

        start_i = batch_nr * AI_BATCH_SIZE
        end_i   = min(start_i + AI_BATCH_SIZE, len(rijen))
        batch_rijen = rijen[start_i:end_i]

        # IO-fase: parallel scrapen
        sub_df = to_process.iloc[start_i:end_i]
        if status_cb:
            status_cb(f"🌐 Scraping batch {batch_nr + 1}/{totaal_batches}…")
        scrape_res = parallel_scrape(sub_df)

        # Compute-fase: sequentieel AI verrijken
        batch_input = []
        for idx, row in batch_rijen:
            bronnen = scrape_res.get(idx, {})
            batch_input.append({
                "_idx":      idx,
                "_bronnen":  bronnen,
                "naam":      str(row.get("naam", "")),
                "provincie": str(row.get("provincie", "Nederland")),
                "website":   str(row.get("website", "")),
                "ai_gecheckt": str(row.get("ai_gecheckt", "Nee")),
            })

        if status_cb:
            status_cb(f"🤖 AI batch {batch_nr + 1}/{totaal_batches} · ETA {stats.eta}")

        batch_resultaten = ai_batch_enrich(batch_input, status_cb=status_cb)

        # Checkpoint updates
        for i, res in enumerate(batch_resultaten):
            if i < len(batch_rijen):
                orig_idx = batch_rijen[i][0]
                if res.get("_skip"):
                    stats.hash_skipped += 1
                checkpoint.update(orig_idx, res)
                stats.verwerkt  += 1
                stats.succesvol += 1 if isinstance(res, dict) else 0

        if progress_cb:
            progress_cb(
                stats.verwerkt, stats.totaal,
                f"🤖 Batch {batch_nr + 1}/{totaal_batches} · "
                f"{stats.verwerkt}/{stats.totaal} · ETA {stats.eta}",
            )

        saved = checkpoint.maybe_save()
        if status_cb and saved:
            status_cb(
                f"💾 {stats.verwerkt}/{stats.totaal} opgeslagen · "
                f"Hash-skipped: {stats.hash_skipped} · {stats.elapsed}"
            )

        time.sleep(RATE_LIMIT_DELAY)

    checkpoint.maybe_save(force=True)

    if status_cb:
        status_cb(
            f"🎉 Klaar! {stats.succesvol} verrijkt, {stats.hash_skipped} ongewijzigd "
            f"overgeslagen in {stats.elapsed}."
        )

    return checkpoint.df


# ── OSM SYNC MET EXPONENTIAL BACKOFF (Pijler 5/7) ────────────────────────────

def fetch_osm_with_backoff(query: str, max_retries: int = 5) -> dict:
    """
    Pijler 5/7: Fetch OSM Overpass met:
    - Custom User-Agent (voorkomt blokkades)
    - Rotation over meerdere endpoints
    - Exponential Backoff + Jitter
    """
    headers = {
        "User-Agent": _OSM_USER_AGENT,
        "Accept": "application/json",
    }
    for attempt in range(max_retries):
        endpoint = _OVERPASS_ENDPOINTS[attempt % len(_OVERPASS_ENDPOINTS)]
        try:
            resp = requests.post(
                endpoint,
                data={"data": query},
                headers=headers,
                timeout=120,
            )
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in (429, 503):
                wacht = (2 ** attempt) * 5 + random.uniform(0, 5)
                logger.warning(
                    f"OSM {endpoint} status {resp.status_code}. "
                    f"Wacht {wacht:.0f}s (poging {attempt + 1}/{max_retries})"
                )
                time.sleep(wacht)
                continue
            resp.raise_for_status()
        except requests.exceptions.Timeout:
            wacht = (2 ** attempt) * 3 + random.uniform(0, 2)
            logger.warning(f"OSM timeout op {endpoint}. Wacht {wacht:.0f}s")
            time.sleep(wacht)
        except Exception as e:
            logger.error(f"OSM fout op {endpoint}: {e}")
            if attempt < max_retries - 1:
                time.sleep(5)

    raise RuntimeError("OSM Overpass API onbereikbaar na meerdere pogingen")


# ── HULPFUNCTIES ───────────────────────────────────────────────────────────────

def get_onbekend_stats(df: pd.DataFrame) -> dict:
    velden = [
        "prijs", "honden_toegestaan", "stroom", "sanitair", "wifi",
        "water_tanken", "afvalwater", "beoordeling", "beschrijving",
        "telefoonnummer", "provincie", "drukte_indicator",
        "max_lengte", "remote_work_score",
    ]
    result = {}
    for veld in velden:
        if veld in df.columns:
            n = int((df[veld].astype(str).str.lower() == "onbekend").sum())
            result[veld] = {"onbekend": n, "pct": round(n / max(len(df), 1) * 100, 1)}
    return result


def estimate_batch_time(n: int) -> str:
    scrape  = (n / MAX_SCRAPE_WORKERS * 2.5) / 60
    ai      = (n / AI_BATCH_SIZE * 5)        / 60
    overhead = (n / AI_BATCH_SIZE * RATE_LIMIT_DELAY) / 60
    t = scrape + ai + overhead
    return f"~{int(t)} – {int(t * 1.4)} minuten"


def check_api_health() -> dict[str, bool]:
    """
    Pijler 5: Controleer gezondheid van Gemini API en OSM Overpass.
    Retourneert {service: is_healthy}.
    """
    result: dict[str, bool] = {}

    # Gemini check
    try:
        api_key = st.secrets.get("GEMINI_API_KEY", "")
        if not api_key:
            result["Gemini API"] = False
        else:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-2.5-flash:generateContent?key={api_key}"
            )
            payload = {"contents": [{"parts": [{"text": "test"}]}]}
            resp = requests.post(url, json=payload, timeout=8)
            result["Gemini API"] = resp.status_code == 200
    except Exception:
        result["Gemini API"] = False

    # OSM check
    try:
        resp = requests.get(
            "https://overpass-api.de/api/status",
            headers={"User-Agent": _OSM_USER_AGENT},
            timeout=8,
        )
        result["OSM Overpass"] = resp.status_code == 200
    except Exception:
        result["OSM Overpass"] = False

    # Google Sheets (connection test via data_handler)
    try:
        from utils.data_handler import get_connection
        conn = get_connection()
        result["Google Sheets"] = conn is not None
    except Exception:
        result["Google Sheets"] = False

    return result
