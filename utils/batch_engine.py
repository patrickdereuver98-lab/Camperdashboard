_api_health() via pure REST (geen SDK init).
"""
from __future__ import annotations

import json
import os
import re
import time
import random
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import pandas as pd
import requests
import streamlit as st

try:
    from utils.logger import logger
except ImportError:
    logger = logging.getLogger("vrijstaan.batch")

# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
MAX_SCRAPE_WORKERS   = 10     # I/O fase — parallel HTTP workers
AI_SEQUENTIAL_DELAY  = 1.5   # Seconden rust tussen AI-aanroepen (rate limit)
AI_BATCH_SIZE        = 5     # Locaties per Gemini-batch prompt
CHECKPOINT_CSV_N     = 25    # CSV-checkpoint elke N locaties
CHECKPOINT_SHEETS_N  = 50    # Sheets-checkpoint elke N locaties
SCRAPE_TIMEOUT       = 18    # HTTP timeout (cloudscraper)
CHECKPOINT_DIR       = "data/checkpoints"
CHECKPOINT_FILE      = f"{CHECKPOINT_DIR}/batch_progress.csv"

# OSM Overpass endpoints
_OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]
_OSM_UA = "VrijStaan/5.1 (Streamlit; NL-camperplaatsen; contact:admin@vrijstaan.nl)"


# ── PROVINCIE NORMALISATIE ─────────────────────────────────────────────────────

_PROVINCE_MAP: dict[str, str] = {
    "fryslân":       "Friesland",    "fryslan":        "Friesland",
    "frisian":       "Friesland",    "friesland":      "Friesland",
    "north holland": "Noord-Holland","north-holland":   "Noord-Holland",
    "noord holland": "Noord-Holland","noordholland":    "Noord-Holland",
    "south holland": "Zuid-Holland", "south-holland":   "Zuid-Holland",
    "zuidholland":   "Zuid-Holland", "south holand":    "Zuid-Holland",
    "north brabant": "Noord-Brabant","north-brabant":   "Noord-Brabant",
    "noord brabant": "Noord-Brabant","noordbrabant":    "Noord-Brabant",
    "nb":            "Noord-Brabant",
    "groningen":     "Groningen",    "drenthe":         "Drenthe",
    "overijssel":    "Overijssel",   "flevoland":       "Flevoland",
    "gelderland":    "Gelderland",   "guelders":        "Gelderland",
    "utrecht":       "Utrecht",      "zeeland":         "Zeeland",
    "zealand":       "Zeeland",      "limburg":         "Limburg",
    "sud-holland":   "Zuid-Holland", "sud holland":     "Zuid-Holland",
}
_NL_PROVINCES = {
    "groningen", "friesland", "drenthe", "overijssel", "flevoland",
    "gelderland", "utrecht", "noord-holland", "zuid-holland",
    "zeeland", "noord-brabant", "limburg",
}


def normalize_province(raw: str) -> str:
    """Converteert naar officiële NL provincienaam."""
    if not raw:
        return "Onbekend"
    s = str(raw).strip()
    if s.lower() in ("onbekend", "nan", "none", "", "-", "unknown"):
        return "Onbekend"
    mapped = _PROVINCE_MAP.get(s.lower())
    if mapped:
        return mapped
    if s.lower() in _NL_PROVINCES:
        return s  # Al correct
    for variant, canonical in _PROVINCE_MAP.items():
        if variant in s.lower():
            return canonical
    return s


# ── TELEFOON NORMALISATIE ──────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    """NL telefoonnummer → +31 uniform formaat."""
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
    nat = digits[1:]
    if nat.startswith("6") and len(nat) == 9:
        return f"+31 6 {nat[1:5]} {nat[5:]}"
    if len(nat) == 9:
        two_d = {"20","10","30","70","40","45","46","50","55","58",
                 "73","76","77","78","79"}
        a2 = nat[:2]
        if a2 in two_d:
            return f"+31 {a2} {nat[2:5]} {nat[5:]}"
        return f"+31 {nat[:3]} {nat[3:6]} {nat[6:]}"
    return s


# ── POST-PROCESSOR ─────────────────────────────────────────────────────────────

def _postprocess(res: dict) -> dict:
    """Datahygiëne op één AI-resultaat."""
    if not isinstance(res, dict):
        return res
    if "provincie" in res:
        res["provincie"] = normalize_province(str(res.get("provincie", "")))
    if "telefoonnummer" in res:
        res["telefoonnummer"] = normalize_phone(str(res.get("telefoonnummer", "")))
    if res.get("stroom", "").lower() == "nee":
        res["stroom_prijs"] = "Nee (geen stroom)"
    if isinstance(res.get("extra"), list):
        res["extra"] = ", ".join(str(v) for v in res["extra"])
    return res


# ── BATCH STATISTIEKEN ────────────────────────────────────────────────────────

@dataclass
class BatchStats:
    totaal:        int   = 0
    verwerkt:      int   = 0
    succesvol:     int   = 0
    hash_skipped:  int   = 0     # MD5-skip
    ai_fallback:   int   = 0     # Agentic fallback gebruikt
    mislukt:       int   = 0
    overgeslagen:  int   = 0
    start_tijd:    float = field(default_factory=time.time)

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


# ══════════════════════════════════════════════════════════════════════════════
# STAP 1 — I/O FASE: PARALLEL SCRAPEN (ThreadPoolExecutor, max 10 workers)
# ══════════════════════════════════════════════════════════════════════════════

def _scrape_one(row_tuple: tuple) -> tuple:
    """
    Scrapet één locatie in een worker-thread.
    Retourneert (idx, naam, ws_tekst, photos, cc_tekst, p4n_tekst, tekst_len).
    """
    from utils.enrichment import (
        scrape_website,
        scrape_campercontact,
        scrape_park4night,
        website_changed,
    )
    idx, naam, provincie, website = row_tuple

    # Eigen website (cloudscraper)
    ws_tekst, photos = scrape_website(website) if website else ("", [])
    changed = website_changed(website, ws_tekst) if (website and ws_tekst) else True

    # Externe bronnen
    cc  = scrape_campercontact(naam, provincie)
    p4n = scrape_park4night(naam, provincie)

    total_len = len(ws_tekst) + len(cc) + len(p4n)
    return idx, naam, ws_tekst, photos, cc, p4n, changed, total_len


def parallel_scrape(
    df: pd.DataFrame,
    progress_cb: Callable | None = None,
) -> dict[int, dict]:
    """
    I/O Fase: scrapet alle locaties PARALLEL via ThreadPoolExecutor (max 10 workers).
    Elke worker gebruikt cloudscraper om Cloudflare te bypassen.

    Returns:
        {idx: {website, photos, campercontact, park4night, changed, total_len}}
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
            t = futures[future]
            try:
                idx, naam, ws, photos, cc, p4n, changed, total_len = future.result(
                    timeout=SCRAPE_TIMEOUT + 5
                )
                resultaten[idx] = {
                    "website":       ws,
                    "photos":        photos,
                    "campercontact": cc,
                    "park4night":    p4n,
                    "changed":       changed,
                    "total_len":     total_len,
                }
            except Exception as e:
                logger.warning(f"Scrape mislukt voor '{t[1]}': {e}")
                resultaten[t[0]] = {
                    "website": "", "photos": [], "campercontact": "",
                    "park4night": "", "changed": True, "total_len": 0,
                }
            klaar += 1
            if progress_cb:
                progress_cb(klaar, len(taken), f"🌐 Scraping ({klaar}/{len(taken)})…")

    return resultaten


# ══════════════════════════════════════════════════════════════════════════════
# STAP 2 — COMPUTE FASE: SEQUENTIËLE AI VERRIJKING (main thread)
# ══════════════════════════════════════════════════════════════════════════════

def _build_batch_prompt(batch: list[dict]) -> str:
    """
    Bouwt de Gemini batch-prompt met deductie-regels en camper-specifieke velden.
    Max 5 locaties per prompt voor optimale kwaliteit en token-gebruik.
    """
    locaties_json = json.dumps(
        [{k: v for k, v in loc.items() if not k.startswith("_")} for loc in batch],
        ensure_ascii=False, indent=2,
    )
    bronnen_blok = ""
    for i, loc in enumerate(batch, 1):
        b   = loc.get("_bronnen", {})
        ws  = b.get("website",       "")[:2500] or "(niet beschikbaar)"
        cc  = b.get("campercontact", "")[:1500] or "(niet gevonden)"
        p4n = b.get("park4night",    "")[:1500] or "(niet gevonden)"
        bronnen_blok += (
            f"\n--- Locatie {i}: {loc.get('naam','?')} "
            f"({loc.get('provincie','?')}) ---\n"
            f"Website ({b.get('total_len',0)} tekens): {ws}\n"
            f"Campercontact: {cc}\n"
            f"Park4Night: {p4n}\n"
        )

    return f"""
Je bent expert data-analist voor VrijStaan (NL camperplatform).
Verrijk {len(batch)} locaties met ACTUELE, ACCURATE data.

BRONINHOUD:
{bronnen_blok}

DATA TE VERRIJKEN:
{locaties_json}

VERPLICHTE DEDUCTIE-REGELS (pas toe VOORDAT je "Onbekend" schrijft):
• "parking"/"parkeer" in naam → stroom=Nee, sanitair=Nee (tenzij bewijs)
• "jachthaven"/"marina" → water_tanken=Ja, afvalwater=Ja, sanitair=Ja
• "camping"/"vakantiepark" → sanitair=Ja, water_tanken=Ja
• Reviews: "muntjes douche" → sanitair=Ja
• "24u/7d" of "altijd open" → check_in_out="Vrij"
• Stroom-aansluitingen beschreven → stroom=Ja
• Honden welkom in naam → honden_toegestaan=Ja
• Gebruik "Nee" bij logische afwezigheid
• Gebruik "Onbekend" ALLEEN als echt niets te vinden is

PROVINCIE: altijd officieel NL (Fryslân→Friesland, North Holland→Noord-Holland)
TELEFOON: +31 formaat (0612345678 → "+31 6 1234 5678")

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
  "loc_type": "Camping/Camperplaats/Parking/Jachthaven/Boerderij",
  "drukte_indicator": "omschrijving of Onbekend",
  "max_lengte": "'8m' / 'Geen beperking' / 'Onbekend'",
  "max_gewicht": "'3.5t' / 'Geen beperking' / 'Onbekend'",
  "remote_work_score": "kwaliteitsomschrijving of Onbekend",
  "voertuig_types": "'Campervan, Caravan' of Onbekend",
  "tarieftype": "Per nacht/Gratis/Onbekend",
  "ai_gecheckt": "Ja"
}}]
"""


def ai_batch_enrich(
    batch: list[dict],
    stats: BatchStats,
    status_cb: Callable | None = None,
    max_retries: int = 4,
) -> list[dict]:
    """
    Compute fase: verrijkt een batch van max 5 locaties SEQUENTIEEL via Gemini.

    MD5 hash-check: als website niet gewijzigd én al gecheckt → skip AI.
    Agentic fallback: < MIN_SCRAPE_CHARS OF > 4 onbekend → Google Grounding.
    Rate-limit buffer: AI_SEQUENTIAL_DELAY seconden na elke batch-aanroep.
    """
    from utils.ai_helper import parse_json_response, run_agentic_fallback, MIN_SCRAPE_CHARS

    if not batch:
        return []

    # ── MD5 skip check ────────────────────────────────────────────────────
    to_process: list[dict] = []
    skip_results: list[dict] = []

    for entry in batch:
        bronnen  = entry.get("_bronnen", {})
        changed  = bronnen.get("changed", True)
        gecheckt = str(entry.get("ai_gecheckt", "Nee")).lower()
        # Skip als: website ongewijzigd EN eerder al verrijkt
        if not changed and gecheckt == "ja":
            stats.hash_skipped += 1
            skip_results.append({**entry, "_skip": True, "ai_gecheckt": "Ja"})
        else:
            to_process.append(entry)

    if not to_process:
        return skip_results

    # ── Batch AI aanroep ──────────────────────────────────────────────────
    from utils.ai_helper import _generate

    try:
        api_key = st.secrets["GEMINI_API_KEY"]
    except (KeyError, Exception):
        if status_cb:
            status_cb("⚠️ GEMINI_API_KEY ontbreekt — batch overgeslagen")
        return skip_results + to_process

    prompt = _build_batch_prompt(to_process)

    raw_response = ""
    for attempt in range(max_retries):
        try:
            if status_cb and attempt > 0:
                status_cb(f"⏳ Retry {attempt}/{max_retries}…")

            # Gebruik de centrale _generate uit ai_helper
            raw_response = _generate(prompt, use_grounding=False)
            break

        except Exception as e:
            msg = str(e).lower()
            if "429" in msg or "rate limit" in msg:
                wait = (2 ** attempt) * 5 + random.uniform(0, 3)
                if status_cb:
                    status_cb(f"⏳ Rate limit. Wacht {wait:.0f}s…")
                time.sleep(wait)
            else:
                logger.error(f"Batch AI fout (poging {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    return skip_results + to_process

    # ── JSON parsen ────────────────────────────────────────────────────────
    parsed = parse_json_response(raw_response)
    if not isinstance(parsed, list):
        logger.error(f"Batch AI response geen array: {raw_response[:200]}")
        return skip_results + to_process

    resultaten: list[dict] = []
    for i, res in enumerate(parsed):
        if i >= len(to_process):
            break
        if not isinstance(res, dict):
            continue

        entry    = to_process[i]
        bronnen  = entry.get("_bronnen", {})
        total_len = bronnen.get("total_len", 0)
        photos    = bronnen.get("photos", [])

        # ── Agentic fallback check ─────────────────────────────────────────
        n_onbekend = sum(
            1 for v in res.values()
            if isinstance(v, str) and v.strip().lower() == "onbekend"
        )
        needs_fallback = (
            total_len < MIN_SCRAPE_CHARS
            or n_onbekend > 4
        )
        if needs_fallback:
            stats.ai_fallback += 1
            if status_cb:
                status_cb(
                    f"🤖 Agentic fallback: {res.get('naam', '?')} "
                    f"(total={total_len}c, onbekend={n_onbekend})"
                )
            verbeterd = run_agentic_fallback(
                naam=str(entry.get("naam", "")),
                provincie=str(entry.get("provincie", "Nederland")),
                current_data=res,
                scrape_text_len=total_len,
            )
            if verbeterd and isinstance(verbeterd, dict):
                for key, val in verbeterd.items():
                    if res.get(key, "").strip().lower() == "onbekend":
                        new_val = str(val).strip()
                        if new_val.lower() != "onbekend":
                            res[key] = val

        # Foto's toevoegen
        if photos:
            res["photos"] = json.dumps(photos, ensure_ascii=False)

        # Post-processing
        res["_idx"] = entry.get("_idx")
        res.pop("_bronnen", None)
        res.pop("_skip", None)
        _postprocess(res)
        resultaten.append(res)

    # ── Rate-limit buffer ─────────────────────────────────────────────────
    time.sleep(AI_SEQUENTIAL_DELAY)

    return skip_results + resultaten


# ══════════════════════════════════════════════════════════════════════════════
# CHECKPOINT MANAGER
# ══════════════════════════════════════════════════════════════════════════════

class CheckpointManager:
    """Beheert incrementele opslag tijdens lange batch-runs."""

    def __init__(self, master_df: pd.DataFrame) -> None:
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)
        self.df                   = master_df.copy()
        self.laatste_csv_save     = 0
        self.laatste_sheets_save  = 0
        self.verwerkt_count       = 0

    def update(self, idx: int, data: dict) -> None:
        """Past één rij bij in de master DataFrame."""
        if data and not data.get("_skip"):
            for key, val in data.items():
                if key.startswith("_"):
                    continue
                if key not in self.df.columns:
                    self.df[key] = "Onbekend"
                if isinstance(val, (list, dict)):
                    val = json.dumps(val, ensure_ascii=False)
                self.df.at[idx, key] = val
        self.df.at[idx, "ai_gecheckt"] = "Ja"
        self.verwerkt_count += 1

    def maybe_save(self, force: bool = False) -> bool:
        """Sla op naar CSV (elke 25) en Sheets (elke 50). Retourneert True bij Sheets-sync."""
        n = self.verwerkt_count

        if force or (n - self.laatste_csv_save) >= CHECKPOINT_CSV_N:
            try:
                self.df.to_csv(CHECKPOINT_FILE, index=False)
                self.laatste_csv_save = n
            except Exception as e:
                logger.error(f"CSV checkpoint fout: {e}")

        if force or (n - self.laatste_sheets_save) >= CHECKPOINT_SHEETS_N:
            try:
                from utils.data_handler import save_data  # noqa: PLC0415
                save_data(self.df)
                self.laatste_sheets_save = n
                return True
            except Exception as e:
                logger.error(f"Sheets checkpoint fout: {e}")

        return False

    def load_checkpoint(self) -> pd.DataFrame | None:
        """Laad vorig checkpoint voor auto-resume."""
        if Path(CHECKPOINT_FILE).exists():
            try:
                df = pd.read_csv(CHECKPOINT_FILE).astype(object).fillna("Onbekend")
                logger.info(f"Checkpoint geladen: {len(df)} rijen")
                return df
            except Exception as e:
                logger.warning(f"Checkpoint laden mislukt: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# HOOFD: VOLAUTOMATISCHE BATCH RUN
# ══════════════════════════════════════════════════════════════════════════════

def run_full_batch(
    master_df:     pd.DataFrame,
    max_locations: int = 0,
    progress_cb:   Callable | None = None,
    status_cb:     Callable | None = None,
    stop_flag:     Callable | None = None,
) -> pd.DataFrame:
    """
    Volledig automatische batch-run voor alle locaties.

    Pipeline:
      1. Vorig checkpoint herstellen (auto-resume)
      2. I/O fase: websites PARALLEL scrapen (max 10 workers, cloudscraper)
      3. Compute fase: AI verrijking SEQUENTIEEL (main thread, sleep(1.5))
      4. MD5 check: ongewijzigde sites overslaan
      5. Agentic fallback bij blokkades of te veel onbekend
      6. Checkpoint-saves elke 25/50 locaties

    Args:
        master_df:     Volledige dataset
        max_locations: Max te verwerken (0 = alles)
        progress_cb:   fn(done, total, label)
        status_cb:     fn(message)
        stop_flag:     fn() → bool — True = vroegtijdig stoppen

    Returns:
        Verrijkte DataFrame
    """
    stats      = BatchStats()
    checkpoint = CheckpointManager(master_df)

    # ── Auto-resume ────────────────────────────────────────────────────────
    vorig = checkpoint.load_checkpoint()
    if vorig is not None and len(vorig) == len(master_df):
        if status_cb:
            status_cb("♻️ Vorig checkpoint hersteld — hervatten")
        checkpoint.df = vorig

    # ── Subset bepalen ─────────────────────────────────────────────────────
    gecheckt_col = checkpoint.df.get(
        "ai_gecheckt",
        pd.Series("Nee", index=checkpoint.df.index),
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
            f"🚀 Auto-pilot gestart: {stats.totaal} te verwerken, "
            f"{stats.overgeslagen} al klaar. "
            f"Scraping met {MAX_SCRAPE_WORKERS} parallelle workers…"
        )

    rijen          = list(to_process.iterrows())
    totaal_batches = (len(rijen) + AI_BATCH_SIZE - 1) // AI_BATCH_SIZE

    for batch_nr in range(totaal_batches):
        # Vroegtijdig stoppen
        if stop_flag and stop_flag():
            if status_cb:
                status_cb(f"🛑 Gestopt bij {stats.verwerkt}/{stats.totaal}")
            break

        start_i     = batch_nr * AI_BATCH_SIZE
        end_i       = min(start_i + AI_BATCH_SIZE, len(rijen))
        batch_rijen = rijen[start_i:end_i]

        # ── I/O fase: parallel scrapen ─────────────────────────────────────
        sub_df = to_process.iloc[start_i:end_i]
        if status_cb:
            status_cb(
                f"🌐 [{batch_nr+1}/{totaal_batches}] "
                f"Scraping {len(batch_rijen)} locaties (parallel, {MAX_SCRAPE_WORKERS} workers)…"
            )

        scrape_res = parallel_scrape(sub_df)

        # ── Compute fase: sequentieel AI ───────────────────────────────────
        batch_input: list[dict] = []
        for idx, row in batch_rijen:
            bronnen = scrape_res.get(idx, {})
            batch_input.append({
                "_idx":        idx,
                "_bronnen":    bronnen,
                "naam":        str(row.get("naam", "")),
                "provincie":   str(row.get("provincie", "Nederland")),
                "website":     str(row.get("website", "")),
                "ai_gecheckt": str(row.get("ai_gecheckt", "Nee")),
            })

        if status_cb:
            status_cb(
                f"🤖 [{batch_nr+1}/{totaal_batches}] "
                f"AI verrijking {len(batch_input)} locaties · ETA {stats.eta}"
            )

        batch_resultaten = ai_batch_enrich(
            batch_input, stats, status_cb=status_cb
        )

        # ── Resultaten opslaan ─────────────────────────────────────────────
        for i, res in enumerate(batch_resultaten):
            if i < len(batch_rijen):
                orig_idx = batch_rijen[i][0]
                checkpoint.update(orig_idx, res)
                stats.verwerkt  += 1
                stats.succesvol += 1 if isinstance(res, dict) and res.get("naam") else 0

        if progress_cb:
            progress_cb(
                stats.verwerkt, stats.totaal,
                f"🤖 Batch {batch_nr+1}/{totaal_batches} · "
                f"{stats.verwerkt}/{stats.totaal} klaar · "
                f"Hash-skip: {stats.hash_skipped} · Fallback: {stats.ai_fallback} · "
                f"ETA {stats.eta}",
            )

        sheets_saved = checkpoint.maybe_save()
        if status_cb and sheets_saved:
            status_cb(
                f"💾 Checkpoint: {stats.verwerkt}/{stats.totaal} · "
                f"{stats.elapsed} verstreken"
            )

    # ── Finale opslag ──────────────────────────────────────────────────────
    checkpoint.maybe_save(force=True)

    if status_cb:
        status_cb(
            f"🎉 Klaar! {stats.succesvol}/{stats.totaal} verrijkt · "
            f"Hash-skipped: {stats.hash_skipped} · "
            f"Agentic fallback: {stats.ai_fallback}× · "
            f"Totale tijd: {stats.elapsed}"
        )

    return checkpoint.df


# ══════════════════════════════════════════════════════════════════════════════
# OSM OVERPASS MET EXPONENTIAL BACKOFF
# ══════════════════════════════════════════════════════════════════════════════

def fetch_osm_with_backoff(query: str, max_retries: int = 5) -> dict:
    """
    Haalt OSM Overpass data op met:
      - Rotatie over 3 endpoints
      - Custom User-Agent (voorkomt blokkades)
      - Exponential Backoff + Jitter bij 429/503
    """
    headers = {"User-Agent": _OSM_UA, "Accept": "application/json"}

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
                wait = (2 ** attempt) * 5 + random.uniform(0, 4)
                logger.warning(
                    f"OSM {endpoint} → {resp.status_code}. "
                    f"Wacht {wait:.0f}s (poging {attempt+1}/{max_retries})"
                )
                time.sleep(wait)
                continue
            resp.raise_for_status()
        except requests.exceptions.Timeout:
            wait = (2 ** attempt) * 3 + random.uniform(0, 2)
            logger.warning(f"OSM timeout op {endpoint}. Wacht {wait:.0f}s")
            time.sleep(wait)
        except Exception as e:
            logger.error(f"OSM fout op {endpoint}: {e}")
            if attempt < max_retries - 1:
                time.sleep(5 + random.uniform(0, 2))

    raise RuntimeError(
        f"OSM Overpass API onbereikbaar na {max_retries} pogingen op alle endpoints"
    )


# ══════════════════════════════════════════════════════════════════════════════
# API HEALTH CHECK (pure REST, geen SDK)
# ══════════════════════════════════════════════════════════════════════════════

def check_api_health() -> dict[str, bool | str]:
    """
    Controleert de gezondheid van alle kritieke services via pure HTTP.
    Geen Google SDK initialisatie — veilig en snel.

    Returns:
        {"Gemini API": (bool, str), "OSM Overpass": bool, "Google Sheets": bool}
    """
    result: dict[str, bool | str] = {}

    # ── Gemini API (REST key validatie) ────────────────────────────────────
    try:
        from utils.ai_helper import validate_gemini_key  # noqa: PLC0415
        api_key = st.secrets.get("GEMINI_API_KEY", "")
        is_ok, msg = validate_gemini_key(api_key)
        result["Gemini API"]  = is_ok
        result["Gemini Status"] = msg
    except Exception as e:
        result["Gemini API"]    = False
        result["Gemini Status"] = str(e)[:80]

    # ── OSM Overpass ────────────────────────────────────────────────────────
    try:
        resp = requests.get(
            "https://overpass-api.de/api/status",
            headers={"User-Agent": _OSM_UA},
            timeout=8,
        )
        result["OSM Overpass"] = resp.status_code == 200
    except Exception:
        result["OSM Overpass"] = False

    # ── Google Sheets ───────────────────────────────────────────────────────
    try:
        from utils.data_handler import get_connection  # noqa: PLC0415
        conn = get_connection()
        result["Google Sheets"] = conn is not None
    except Exception:
        result["Google Sheets"] = False

    return result


# ══════════════════════════════════════════════════════════════════════════════
# HULPFUNCTIES VOOR BEHEER-PAGINA
# ══════════════════════════════════════════════════════════════════════════════

def get_onbekend_stats(df: pd.DataFrame) -> dict:
    """Telt 'Onbekend'-waarden per relevant veld."""
    velden = [
        "prijs", "honden_toegestaan", "stroom", "sanitair", "wifi",
        "water_tanken", "afvalwater", "beoordeling", "beschrijving",
        "telefoonnummer", "provincie", "drukte_indicator",
        "max_lengte", "remote_work_score",
    ]
    result: dict[str, dict] = {}
    for veld in velden:
        if veld in df.columns:
            n   = int((df[veld].astype(str).str.lower() == "onbekend").sum())
            pct = round(n / max(len(df), 1) * 100, 1)
            result[veld] = {"onbekend": n, "pct": pct}
    return result


def estimate_batch_time(n: int) -> str:
    """Ruwe schatting van verwerkingstijd voor n locaties."""
    # Parallel scrape: n / MAX_SCRAPE_WORKERS * 3s gemiddeld per batch
    scrape_min  = (n / MAX_SCRAPE_WORKERS * 3) / 60
    # Sequentieel AI: n / AI_BATCH_SIZE batches * (4s AI + 1.5s sleep)
    ai_min      = (n / AI_BATCH_SIZE * (4.0 + AI_SEQUENTIAL_DELAY)) / 60
    totaal = scrape_min + ai_min
    return f"~{int(totaal)} – {int(totaal * 1.4)} minuten"
