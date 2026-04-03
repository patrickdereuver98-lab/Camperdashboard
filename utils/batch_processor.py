"""
utils/batch_processor.py — Hoge-snelheid batch verrijking voor VrijStaan.

Architectuur:
  - ThreadPoolExecutor (20 workers) voor parallelle website-scraping
  - Pure HTTP REST API aanroep voor Gemini (Bypast gRPC deadlocks volledig!)
  - Batch Gemini-aanroepen: 5 locaties per prompt
  - Checkpoint-saves: elke 25 locaties naar CSV + elke 50 naar Sheets
"""
import json
import os
import time
import logging
import requests
import streamlit as st
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

import pandas as pd

logger = logging.getLogger("vrijstaan.batch")

# ── CONFIGURATIE ──────────────────────────────────────────────────────────────
MAX_SCRAPE_WORKERS  = 20    
AI_BATCH_SIZE       = 5     
CHECKPOINT_CSV_N    = 25    
CHECKPOINT_SHEETS_N = 50    
SCRAPE_TIMEOUT      = 10    
CHECKPOINT_DIR      = "data/checkpoints"
CHECKPOINT_FILE     = f"{CHECKPOINT_DIR}/batch_progress.csv"


# ── DATA KLASSEN ──────────────────────────────────────────────────────────────

@dataclass
class BatchStats:
    totaal:         int   = 0
    verwerkt:       int   = 0
    succesvol:      int   = 0
    mislukt:        int   = 0
    overgeslagen:   int   = 0
    onbekend_voor:  int   = 0
    onbekend_na:    int   = 0
    start_tijd:     float = field(default_factory=time.time)

    @property
    def elapsed(self) -> str:
        s = int(time.time() - self.start_tijd)
        return f"{s//60}m {s%60}s"

    @property
    def eta(self) -> str:
        if self.verwerkt == 0:
            return "–"
        per_item = (time.time() - self.start_tijd) / self.verwerkt
        resterend = (self.totaal - self.verwerkt) * per_item
        m, s = divmod(int(resterend), 60)
        return f"~{m}m {s}s"

    @property
    def pct(self) -> float:
        return (self.verwerkt / self.totaal * 100) if self.totaal else 0


# ── STAP 1: PARALLELLE SCRAPER ────────────────────────────────────────────────

def _scrape_one(row_tuple: tuple) -> tuple[int, str, str, str, str]:
    from utils.enrichment import scrape_website
    
    # Dummy functies voor ontbrekende scrapers
    def scrape_campercontact(n, p): return ""
    def scrape_park4night(n, p): return ""

    idx, naam, provincie, website = row_tuple
    ws  = scrape_website(website)
    cc  = scrape_campercontact(naam, provincie)
    p4n = scrape_park4night(naam, provincie)
    return idx, naam, ws, cc, p4n


def parallel_scrape(df: pd.DataFrame,
                    progress_cb: Callable | None = None) -> dict[int, dict]:
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
                idx, naam, ws, cc, p4n = future.result(timeout=SCRAPE_TIMEOUT + 5)
                resultaten[idx] = {
                    "website":       ws,
                    "campercontact": cc,
                    "park4night":    p4n,
                }
            except Exception as e:
                t = futures[future]
                logger.warning(f"Scrape mislukt voor {t[1]}: {e}")
                resultaten[t[0]] = {"website": "", "campercontact": "", "park4night": ""}

            klaar += 1
            if progress_cb:
                progress_cb(klaar, len(taken), f"🌐 Scraping ({klaar}/{len(taken)})…")

    return resultaten


# ── STAP 2: PURE HTTP REST AANROEP VOOR GEMINI ────────────────────────────────

def _direct_gemini_call(prompt: str) -> str:
    """
    Volledige bypass van de Google SDK. HTTP requests kunnen niet deadloacken.
    """
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
    except KeyError:
        raise ValueError("API key ontbreekt in st.secrets")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    # Een ijzersterke timeout van 30 seconden. Als hij niet antwoordt, klapt hij.
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    
    if resp.status_code != 200:
        if resp.status_code == 429:
            raise Exception("429 Too Many Requests")
        raise Exception(f"API Error {resp.status_code}: {resp.text}")
        
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise ValueError(f"Onverwachte API response: {data}")


def _build_batch_prompt(batch: list[dict]) -> str:
    locaties_json = json.dumps(
        [{k: v for k, v in loc.items() if k != "_bronnen"} for loc in batch],
        ensure_ascii=False,
        indent=2,
    )

    bronnen_blok = ""
    for i, loc in enumerate(batch, 1):
        bronnen = loc.get("_bronnen", {})
        ws_tekst = bronnen.get("website", "")[:3000]
        cc_tekst = bronnen.get("campercontact", "")[:2000]
        p4n_tekst = bronnen.get("park4night", "")[:2000]
        bronnen_blok += f"""
--- Locatie {i}: {loc.get('naam', '?')} ---
Website: {ws_tekst or '(niet beschikbaar)'}
Campercontact: {cc_tekst or '(niet gevonden)'}
Park4Night: {p4n_tekst or '(niet gevonden)'}
"""

    return f"""
Je bent een expert data-analist voor het Nederlandse camperplatform VrijStaan.
Verrijk de volgende {len(batch)} locaties met actuele data.

BRONINHOUD PER LOCATIE:
{bronnen_blok}

LOCATIEDATA OM TE VERRIJKEN:
{locaties_json}

══════════════════════════════
INSTRUCTIES (VERPLICHT)
══════════════════════════════

REGEL 1 — JA/NEE/ONBEKEND:
• "Ja"       = faciliteit aanwezig (bewijs OF logische deductie)
• "Nee"      = faciliteit NIET aanwezig (bewijs OF locatietype)
• "Onbekend" = ALLEEN als je het na alle bronnen echt niet kunt bepalen

REGEL 2 — DEDUCTIE PARKEERPLAATSEN:
Locaties met "parking" of "parkeer" in de naam: stroom=Nee, sanitair=Nee,
wifi=Nee, chemisch_toilet=Nee, water_tanken=Nee — tenzij bewijs zegt anders.

REGEL 3 — BESCHRIJVING (2-4 zinnen):
Sfeervolle tekst over omgeving, karakter en doelgroep.

REGEL 4 — REVIEWS (20-40 woorden):
Doorlopende zin, "Gasten-stijl": "Gasten waarderen..." of "Bezoekers zijn enthousiast..."
Nooit steekwoorden of lijsten.

Retourneer UITSLUITEND een geldig JSON-array met exact {len(batch)} objecten (zelfde volgorde):
[
  {{
    "naam": "exacte naam",
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
    "beoordeling": "bijv. 4.3 of Onbekend",
    "samenvatting_reviews": "doorlopende Gasten-zin 20-40 woorden of Onbekend",
    "telefoonnummer": "0XXXXXXXXX of Onbekend",
    "ai_gecheckt": "Ja"
  }}
]
"""


def ai_batch_enrich(batch: list[dict], status_cb: Callable | None = None, max_retries: int = 4) -> list[dict]:
    if not batch:
        return []

    prompt = _build_batch_prompt(batch)
    
    for poging in range(max_retries):
        try:
            if status_cb and poging > 0:
                status_cb(f"⏳ Retry {poging} naar Google API...")

            # De ultieme deadlock-bypass via REST
            response = _direct_gemini_call(prompt)

            clean = response.strip()
            if clean.startswith("```"):
                lines = clean.split("\n")
                clean = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
            if clean.endswith("```"):
                clean = "\n".join(clean.split("\n")[:-1])

            start = clean.find("[")
            end   = clean.rfind("]") + 1
            if start == -1 or end == 0:
                raise ValueError("Geen JSON-array in batch response")

            resultaten = json.loads(clean[start:end])

            for i, res in enumerate(resultaten):
                if i < len(batch):
                    res["_idx"] = batch[i].get("_idx")
                    res.pop("_bronnen", None)

            return resultaten

        except requests.exceptions.Timeout:
            wachttijd = 5
            if status_cb:
                status_cb(f"⚠️ API timeout (30s). Retry over {wachttijd}s...")
            time.sleep(wachttijd)
        except Exception as e:
            fout_msg = str(e).lower()
            if "429" in fout_msg or "quota" in fout_msg or "exhausted" in fout_msg:
                wachttijd = (poging + 1) * 5
                if status_cb:
                    status_cb(f"⏳ Rate limit geraakt. Wacht {wachttijd}s...")
                time.sleep(wachttijd)
            else:
                logger.error(f"Batch AI fout: {e}")
                if status_cb:
                    status_cb(f"⚠️ Batch fout, sla over: {e}")
                return batch

    return batch


# ── STAP 3: CHECKPOINT MANAGER ────────────────────────────────────────────────

class CheckpointManager:
    def __init__(self, master_df: pd.DataFrame):
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)
        self.df = master_df.copy()
        self.laatste_csv_save    = 0
        self.laatste_sheets_save = 0
        self.verwerkt_sinds_start = 0

    def update(self, idx: int, data: dict) -> None:
        if data:
            for key, val in data.items():
                if key.startswith("_"):
                    continue
                if key not in self.df.columns:
                    self.df[key] = "Onbekend"
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
                df = pd.read_csv(CHECKPOINT_FILE).astype(object).fillna("Onbekend")
                return df
            except Exception:
                pass
        return None


# ── HOOFD: COMPLETE BATCH RUN ─────────────────────────────────────────────────

def run_full_batch(
    master_df:      pd.DataFrame,
    max_locations:  int = 700,
    progress_cb:    Callable | None = None,
    status_cb:      Callable | None = None,
) -> pd.DataFrame:
    
    stats     = BatchStats()
    checkpoint = CheckpointManager(master_df)

    vorig = checkpoint.load_checkpoint()
    if vorig is not None and len(vorig) == len(master_df):
        if status_cb:
            status_cb("♻️ Vorig checkpoint hersteld")
        checkpoint.df = vorig

    mask = checkpoint.df.get("ai_gecheckt", pd.Series("Nee", index=checkpoint.df.index)) != "Ja"
    to_process = checkpoint.df[mask]

    if max_locations > 0:
        to_process = to_process.head(max_locations)

    stats.totaal = len(to_process)
    stats.overgeslagen = int((~mask).sum())

    if stats.totaal == 0:
        if status_cb:
            status_cb("✅ Alle locaties zijn al verrijkt!")
        return checkpoint.df

    if status_cb:
        status_cb(f"🌐 Stap 1/2: Websites parallel scrapen ({MAX_SCRAPE_WORKERS} workers)…")

    def _scrape_progress(done, total, label):
        if progress_cb:
            progress_cb(done, total * 2, label) 

    scrape_resultaten = parallel_scrape(to_process, progress_cb=_scrape_progress)

    if status_cb:
        status_cb(f"✅ Scraping klaar. Start AI-verrijking…")

    rijen = list(to_process.iterrows())
    totaal_batches = (len(rijen) + AI_BATCH_SIZE - 1) // AI_BATCH_SIZE

    for batch_nr in range(totaal_batches):
        start  = batch_nr * AI_BATCH_SIZE
        einde  = min(start + AI_BATCH_SIZE, len(rijen))
        batch_rijen = rijen[start:einde]

        batch_input = []
        for idx, row in batch_rijen:
            bronnen = scrape_resultaten.get(idx, {})
            entry = {
                "_idx":     idx,
                "_bronnen": bronnen,
                "naam":     str(row.get("naam", "")),
                "provincie": str(row.get("provincie", "Nederland")),
                "website":  str(row.get("website", "")),
            }
            batch_input.append(entry)

        if status_cb:
            status_cb(f"🤖 Verbinden met Google REST API voor batch {batch_nr+1}/{totaal_batches}...")

        batch_resultaten = ai_batch_enrich(batch_input, status_cb=status_cb)

        for i, res in enumerate(batch_resultaten):
            orig_idx = batch_rijen[i][0]
            checkpoint.update(orig_idx, res)
            stats.verwerkt += 1
            stats.succesvol += 1 if res else 0

        if progress_cb:
            progress_cb(
                len(rijen) + stats.verwerkt,  
                len(rijen) * 2,
                f"🤖 AI batch {batch_nr+1}/{totaal_batches} · "
                f"{stats.verwerkt}/{stats.totaal} verwerkt · ETA {stats.eta}"
            )

        sheets_opgeslagen = checkpoint.maybe_save()
        if status_cb and sheets_opgeslagen:
            status_cb(
                f"💾 Checkpoint: {stats.verwerkt}/{stats.totaal} opgeslagen "
                f"| Verstreken: {stats.elapsed}"
            )

        time.sleep(0.5)

    checkpoint.maybe_save(force=True)

    if status_cb:
        status_cb(
            f"🎉 Klaar! {stats.succesvol}/{stats.totaal} locaties verrijkt "
            f"in {stats.elapsed}."
        )

    return checkpoint.df


def get_onbekend_stats(df: pd.DataFrame) -> dict:
    velden = [
        "prijs", "honden_toegestaan", "stroom", "sanitair",
        "wifi", "water_tanken", "afvalwater", "beoordeling",
        "beschrijving", "telefoonnummer",
    ]
    stats = {}
    for veld in velden:
        if veld in df.columns:
            n = int((df[veld].astype(str).str.lower() == "onbekend").sum())
            stats[veld] = {"onbekend": n, "pct": round(n / len(df) * 100, 1)}
    return stats


def estimate_batch_time(n: int) -> str:
    scrape_min = (n / MAX_SCRAPE_WORKERS * 2) / 60
    ai_min = (n / AI_BATCH_SIZE * 4) / 60
    overhead_min = (n / AI_BATCH_SIZE * 0.5) / 60
    totaal = scrape_min + ai_min + overhead_min
    return f"~{int(totaal)} – {int(totaal * 1.5)} minuten"
