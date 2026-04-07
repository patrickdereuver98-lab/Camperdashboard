"""
utils/batch_engine.py — VrijStaan High-Performance Batch Engine v3.
Pijler 2: Parallel scraping + sequentiële AI + strikte datahygiëne.

Architectuur:
  - ThreadPoolExecutor (20 workers) voor PARALLELLE website-scraping (HTTP)
  - Gemini 2.5 Flash via pure REST API — bypast gRPC deadlocks volledig
  - AI-verwerking SEQUENTIEEL op de main thread — geen race conditions
  - Checkpoint-saves: elke 25 locaties → CSV, elke 50 → Google Sheets

Datahygiëne (nieuw in v3):
  - normalize_province(): alle provincienamen uniform naar officieel Nederlands
    bijv. "Fryslân" → "Friesland", "North Holland" → "Noord-Holland"
  - normalize_phone(): uniformeer naar +31 X XXXXXXXX
    bijv. "0612345678" → "+31 6 1234 5678", "0031512..." → "+31 51 234 5678"
  - Post-processing stap na elke AI-batch: clean altijd, ongeacht AI-output
  - AI-prompt bevat expliciete instructies voor provincie + telefoon formaten
  - "Onbekend" reductie: deductie-regels per locatietype in prompt
"""
import json
import os
import re
import time
import logging
import requests
import streamlit as st
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
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


# ── DATAHYGIËNE: PROVINCIE NORMALISATIE ───────────────────────────────────────

# Officiële Nederlandse provincienamen (twaalf)
_NL_PROVINCES = {
    "groningen", "friesland", "drenthe", "overijssel", "flevoland",
    "gelderland", "utrecht", "noord-holland", "zuid-holland",
    "zeeland", "noord-brabant", "limburg",
}

# Mapping van varianten → officiële naam
_PROVINCE_MAP: dict[str, str] = {
    # Friesland varianten
    "fryslân":         "Friesland",
    "fryslan":         "Friesland",
    "frisian":         "Friesland",
    "friesland":       "Friesland",
    # Noord-Holland
    "north holland":   "Noord-Holland",
    "north-holland":   "Noord-Holland",
    "noord holland":   "Noord-Holland",
    "noordholland":    "Noord-Holland",
    # Zuid-Holland
    "south holland":   "Zuid-Holland",
    "south-holland":   "Zuid-Holland",
    "sud-holland":     "Zuid-Holland",
    "sud holland":     "Zuid-Holland",
    "zuidholland":     "Zuid-Holland",
    "south holand":    "Zuid-Holland",
    # Noord-Brabant
    "north brabant":   "Noord-Brabant",
    "north-brabant":   "Noord-Brabant",
    "noord brabant":   "Noord-Brabant",
    "noordbrabant":    "Noord-Brabant",
    "nb":              "Noord-Brabant",
    # Overige varianten
    "groningen":       "Groningen",
    "drenthe":         "Drenthe",
    "overijssel":      "Overijssel",
    "flevoland":       "Flevoland",
    "gelderland":      "Gelderland",
    "guelders":        "Gelderland",
    "utrecht":         "Utrecht",
    "zeeland":         "Zeeland",
    "zealand":         "Zeeland",
    "limburg":         "Limburg",
}


def normalize_province(raw: str) -> str:
    """
    Normaliseert een provincienaam naar de officiële Nederlandse naam.

    Voorbeelden:
      "Fryslân"       → "Friesland"
      "North Holland" → "Noord-Holland"
      "North Brabant" → "Noord-Brabant"
      "Guelders"      → "Gelderland"
      "Onbekend"      → "Onbekend"  (ongewijzigd)
    """
    if not raw:
        return "Onbekend"
    s = str(raw).strip()
    if s.lower() in ("onbekend", "nan", "none", "", "-", "unknown"):
        return "Onbekend"
    # Exacte match in map
    mapped = _PROVINCE_MAP.get(s.lower())
    if mapped:
        return mapped
    # Controleer of het al een geldige NL-provincie is (case-insensitive)
    if s.lower().replace("-", "-") in _NL_PROVINCES:
        # Zorg voor correcte hoofdletters
        return _PROVINCE_MAP.get(s.lower(), s)
    # Gedeeltelijke match: bijv. "Provincie Utrecht" → "Utrecht"
    s_lower = s.lower()
    for variant, canonical in _PROVINCE_MAP.items():
        if variant in s_lower:
            return canonical
    return s  # Ongewijzigd retourneren als er geen match is


# ── DATAHYGIËNE: TELEFOONNUMMER NORMALISATIE ──────────────────────────────────

def normalize_phone(raw: str) -> str:
    """
    Normaliseert een Nederlands telefoonnummer naar +31 formaat.

    Formaat-regels:
      Mobiel (06):  +31 6 XXXX XXXX   bijv. +31 6 1234 5678
      Vast 3-cij:   +31 XX XXXXXXX    bijv. +31 20 123 4567
      Vast 4-cij:   +31 XXX XXXXXX    bijv. +31 512 12 3456

    Voorbeelden:
      "0612345678"   → "+31 6 1234 5678"
      "06-12345678"  → "+31 6 1234 5678"
      "0031512..."   → "+31 512 ..."
      "+31512..."    → "+31 512 ..."
      "Onbekend"     → "Onbekend"
    """
    _EMPTY = {"onbekend", "nan", "none", "", "-", "–", "unknown", "n/a"}
    if not raw or str(raw).strip().lower() in _EMPTY:
        return "Onbekend"

    s = str(raw).strip()

    # Extraheer uitsluitend cijfers
    digits = re.sub(r"[^\d]", "", s)

    # Verwijder internationale prefix → nationale vorm (10 cijfers, begint met 0)
    if digits.startswith("0031") and len(digits) >= 12:
        digits = "0" + digits[4:]
    elif digits.startswith("31") and len(digits) == 11:
        digits = "0" + digits[2:]

    # Verwacht: 10 cijfers, begint met 0
    if len(digits) != 10 or not digits.startswith("0"):
        return s  # Niet normaliseerbaar, retourneer origineel

    national = digits[1:]  # Strip leading 0 → 9 cijfers

    if national.startswith("6") and len(national) == 9:
        # Mobiel: +31 6 XXXX XXXX
        return f"+31 6 {national[1:5]} {national[5:]}"
    elif len(national) == 9:
        # Vast: bepaal netnummerlengte (2 of 3 cijfers)
        # Nummers zoals 020, 010, 030, 070 = 2-cijferig netnummer
        two_digit_areas = {"20", "10", "30", "70", "40", "45", "46",
                           "50", "55", "58", "73", "76", "77", "78", "79"}
        area2 = national[:2]
        if area2 in two_digit_areas:
            return f"+31 {area2} {national[2:5]} {national[5:]}"
        else:
            # 3-cijferig netnummer
            return f"+31 {national[:3]} {national[3:6]} {national[6:]}"
    else:
        return s  # Retourneer ongewijzigd


# ── DATAHYGIËNE: POST-PROCESSOR VOOR AI RESULTATEN ───────────────────────────

def _postprocess_result(res: dict) -> dict:
    """
    Pas datahygiëne toe op één AI-resultaat:
    1. Provincienaam → officieel Nederlands
    2. Telefoonnummer → uniform +31 formaat
    3. Stroom/prijs consistentie
    """
    if not isinstance(res, dict):
        return res

    # Provincie
    if "provincie" in res:
        res["provincie"] = normalize_province(str(res.get("provincie", "")))

    # Telefoonnummer
    if "telefoonnummer" in res:
        res["telefoonnummer"] = normalize_phone(str(res.get("telefoonnummer", "")))

    # Logische consistentie: als stroom=Nee → stroom_prijs kan niet positief zijn
    if res.get("stroom", "").lower() == "nee":
        res["stroom_prijs"] = "Nee (geen stroom)"

    return res


# ── DATA KLASSEN ───────────────────────────────────────────────────────────────

@dataclass
class BatchStats:
    totaal:        int   = 0
    verwerkt:      int   = 0
    succesvol:     int   = 0
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
        per_item  = (time.time() - self.start_tijd) / self.verwerkt
        resterend = (self.totaal - self.verwerkt) * per_item
        m, s = divmod(int(resterend), 60)
        return f"~{m}m {s}s"

    @property
    def pct(self) -> float:
        return (self.verwerkt / self.totaal * 100) if self.totaal else 0


# ── STAP 1: PARALLELLE SCRAPER ─────────────────────────────────────────────────

def _scrape_one(row_tuple: tuple) -> tuple[int, str, str, str, str]:
    """Scrapet één locatie: eigen website + Campercontact + Park4Night."""
    from utils.enrichment import scrape_website, scrape_campercontact, scrape_park4night

    idx, naam, provincie, website = row_tuple
    ws  = scrape_website(website)
    cc  = scrape_campercontact(naam, provincie)
    p4n = scrape_park4night(naam, provincie)
    return idx, naam, ws, cc, p4n


def parallel_scrape(
    df: pd.DataFrame,
    progress_cb: Callable | None = None,
) -> dict[int, dict]:
    """
    Scrapet alle locaties PARALLEL (ThreadPoolExecutor, 20 workers).
    HTTP requests zijn I/O-bound: parallellisatie geeft 10-15x snelheidswinst.

    Retourneert: {idx: {"website": str, "campercontact": str, "park4night": str}}
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


# ── STAP 2: PURE HTTP REST AANROEP VOOR GEMINI ─────────────────────────────────

def _direct_gemini_call(prompt: str) -> str:
    """
    Directe HTTP REST-aanroep naar Gemini 2.5 Flash.
    Bypast de Google SDK volledig → geen gRPC deadlocks mogelijk.
    Timeout: 30 seconden hard.
    """
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
    except KeyError:
        raise ValueError("GEMINI_API_KEY ontbreekt in st.secrets")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1},  # Laag = feitelijker
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=30)

    if resp.status_code == 429:
        raise Exception("429 Too Many Requests")
    if resp.status_code != 200:
        raise Exception(f"API Error {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"Onverwachte API response structuur: {e} | {str(data)[:300]}")


def _build_batch_prompt(batch: list[dict]) -> str:
    """
    Bouwt het volledige Gemini-prompt voor een batch van max 5 locaties.

    Bevat expliciete instructies voor:
    - Provincie: altijd officieel Nederlands
    - Telefoon: altijd +31 formaat
    - Ja/Nee deductie per locatietype
    - Beschrijving: 2-4 sfeervolle zinnen
    - Reviews: doorlopende Gasten-stijl zin
    """
    locaties_json = json.dumps(
        [{k: v for k, v in loc.items() if k != "_bronnen"} for loc in batch],
        ensure_ascii=False,
        indent=2,
    )

    bronnen_blok = ""
    for i, loc in enumerate(batch, 1):
        bronnen = loc.get("_bronnen", {})
        ws_tekst  = bronnen.get("website",       "")[:3000]
        cc_tekst  = bronnen.get("campercontact", "")[:2000]
        p4n_tekst = bronnen.get("park4night",    "")[:2000]
        bronnen_blok += f"""
--- Locatie {i}: {loc.get('naam', '?')} ({loc.get('provincie', '?')}) ---
Website:       {ws_tekst  or '(niet beschikbaar)'}
Campercontact: {cc_tekst  or '(niet gevonden)'}
Park4Night:    {p4n_tekst or '(niet gevonden)'}
"""

    return f"""
Je bent een expert data-analist voor het Nederlandse camperplatform VrijStaan.
Verrijk de volgende {len(batch)} locaties met actuele, accurate data.

BRONINHOUD PER LOCATIE:
{bronnen_blok}

LOCATIEDATA OM TE VERRIJKEN:
{locaties_json}

══════════════════════════════════════════════════
VERPLICHTE INSTRUCTIES — LEES DIT ZORGVULDIG
══════════════════════════════════════════════════

REGEL 1 — JA/NEE/ONBEKEND:
• "Ja"       = faciliteit aanwezig (bewijs in bronnen OF logische deductie)
• "Nee"      = faciliteit NIET aanwezig (bewijs OF locatietype)
• "Onbekend" = ALLEEN als je na alle bronnen + deductie écht niets weet

REGEL 2 — DEDUCTIE PER LOCATIETYPE:
Locaties met "parking" of "parkeer" in naam:
  stroom=Nee, sanitair=Nee, wifi=Nee, chemisch_toilet=Nee, water_tanken=Nee
  (tenzij bronnen expliciet anders zeggen)
Jachthavens: water_tanken=Ja, afvalwater=Ja, sanitair=Ja, stroom=Ja (standaard)
Campings: sanitair=Ja, water_tanken=Ja (standaard)
Camperplaatsen: water_tanken=Ja, afvalwater=Ja (standaard)

REGEL 3 — PROVINCIE (VERPLICHT OFFICIEEL NEDERLANDSTALIG):
Gebruik ALTIJD de officiële Nederlandse spelling:
  Fryslân / Frisian      → "Friesland"
  North Holland          → "Noord-Holland"
  South Holland          → "Zuid-Holland"
  North Brabant          → "Noord-Brabant"
  Guelders / Guelderland → "Gelderland"
  Zealand                → "Zeeland"
Geldige waarden: Groningen, Friesland, Drenthe, Overijssel, Flevoland,
  Gelderland, Utrecht, Noord-Holland, Zuid-Holland, Zeeland, Noord-Brabant, Limburg

REGEL 4 — TELEFOONNUMMER (UNIFORM FORMAAT +31):
Formaat: +31 X XXXX XXXX (mobiel) of +31 XX XXX XXXX (vast)
  0612345678  → "+31 6 1234 5678"
  0512345678  → "+31 512 34 5678"
  0031...     → verwijder 0031, voeg +31 toe
Als onbekend: exact "Onbekend" (geen lege string)

REGEL 5 — BESCHRIJVING (2-4 ZINNEN):
Sfeervolle tekst over omgeving, karakter en doelgroep.
Voorbeeld: "Rustig gelegen aan de rand van het bos bij Dwingeloo. Ideaal voor wie
natuur zoekt: wandelpaden beginnen direct achter de camping."

REGEL 6 — REVIEWS (20-40 WOORDEN):
Doorlopende zin, "Gasten-stijl". Nooit steekwoorden of lijsten.
Voorbeeld: "Gasten waarderen de rust en de vriendelijke eigenaren; de faciliteiten
worden als schoon en goed onderhouden beschreven."

REGEL 7 — BEOORDELING:
Cijfer 1.0–5.0, bijv. 4.3. Geen hele getallen. "Onbekend" als echt geen reviews.

Retourneer UITSLUITEND een geldig JSON-array met exact {len(batch)} objecten (zelfde volgorde):
[
  {{
    "naam": "exacte naam",
    "provincie": "officiële NL-provincienaam",
    "prijs": "€X per nacht of Gratis of Onbekend",
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
    "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
    "ai_gecheckt": "Ja"
  }}
]
"""


def ai_batch_enrich(
    batch: list[dict],
    status_cb: Callable | None = None,
    max_retries: int = 4,
) -> list[dict]:
    """
    Verrijkt een batch van max 5 locaties via Gemini 2.5 Flash (REST HTTP).
    Draait SEQUENTIEEL op de main thread — geen gRPC deadlocks.
    Past na elke succesvolle call datahygiëne toe (provincie + telefoon).
    """
    if not batch:
        return []

    prompt = _build_batch_prompt(batch)

    for poging in range(max_retries):
        try:
            if status_cb and poging > 0:
                status_cb(f"⏳ Retry {poging}/{max_retries} naar Google API...")

            response = _direct_gemini_call(prompt)

            # JSON extractie
            clean = response.strip()
            if clean.startswith("```"):
                lines = clean.split("\n")
                clean = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
            if clean.endswith("```"):
                clean = "\n".join(clean.split("\n")[:-1])

            start = clean.find("[")
            end   = clean.rfind("]") + 1
            if start == -1 or end == 0:
                raise ValueError("Geen JSON-array gevonden in response")

            resultaten = json.loads(clean[start:end])

            # Koppel _idx + pas datahygiëne toe
            for i, res in enumerate(resultaten):
                if i < len(batch):
                    res["_idx"] = batch[i].get("_idx")
                    res.pop("_bronnen", None)
                    # ── DATAHYGIËNE: provincie + telefoon normaliseren ──
                    _postprocess_result(res)

            return resultaten

        except requests.exceptions.Timeout:
            wachttijd = 5
            if status_cb:
                status_cb(f"⚠️ API timeout (30s). Retry over {wachttijd}s...")
            time.sleep(wachttijd)

        except Exception as e:
            fout_msg = str(e).lower()
            if "429" in fout_msg or "quota" in fout_msg or "exhausted" in fout_msg:
                wachttijd = (poging + 1) * 6
                if status_cb:
                    status_cb(f"⏳ Rate limit geraakt. Wacht {wachttijd}s...")
                time.sleep(wachttijd)
            elif "json" in fout_msg or "geen json" in fout_msg:
                logger.warning(f"JSON-parse fout op poging {poging + 1}: {e}")
                if poging == max_retries - 1:
                    return batch  # Geef originele data terug bij parse-failure
            else:
                logger.error(f"Batch AI onherstelbare fout: {e}")
                if status_cb:
                    status_cb(f"⚠️ Batch fout — sla over: {e}")
                return batch

    logger.error("Alle retries uitgeput voor batch")
    return batch


# ── STAP 3: CHECKPOINT MANAGER ─────────────────────────────────────────────────

class CheckpointManager:
    """
    Beheert incrementele opslag tijdens een lange batch-run.
    CSV checkpoint: elke 25 locaties.
    Google Sheets sync: elke 50 locaties.
    """

    def __init__(self, master_df: pd.DataFrame):
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)
        self.df = master_df.copy()
        self.laatste_csv_save    = 0
        self.laatste_sheets_save = 0
        self.verwerkt_sinds_start = 0

    def update(self, idx: int, data: dict) -> None:
        """Past één rij bij in de master DataFrame."""
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
        """Sla op als drempel bereikt of force=True. Retourneert True bij Sheets-sync."""
        n = self.verwerkt_sinds_start

        if force or (n - self.laatste_csv_save) >= CHECKPOINT_CSV_N:
            try:
                self.df.to_csv(CHECKPOINT_FILE, index=False)
                self.laatste_csv_save = n
                logger.debug(f"CSV checkpoint opgeslagen ({n} items)")
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
        """Laad vorig checkpoint als het bestaat en geldig is."""
        if os.path.exists(CHECKPOINT_FILE):
            try:
                df = pd.read_csv(CHECKPOINT_FILE).astype(object).fillna("Onbekend")
                logger.info(f"Checkpoint geladen: {len(df)} rijen")
                return df
            except Exception as e:
                logger.warning(f"Checkpoint laden mislukt: {e}")
        return None


# ── HOOFD: COMPLETE BATCH RUN ──────────────────────────────────────────────────

def run_full_batch(
    master_df:     pd.DataFrame,
    max_locations: int = 700,
    progress_cb:   Callable | None = None,
    status_cb:     Callable | None = None,
) -> pd.DataFrame:
    """
    Voert een volledige batch-verrijkingsrun uit:

    Pipeline:
      1. Laad vorig checkpoint (hervat waar gebleven)
      2. Stap 1: Parallel scrapen (ThreadPoolExecutor, 20 workers)
      3. Stap 2: Sequentiële AI-verrijking (Gemini 2.5 Flash REST)
      4. Post-processing: provincie + telefoon normalisatie
      5. Checkpoint-saves elke 25/50 locaties

    Args:
      master_df:     Volledige dataset (alle camperplaatsen)
      max_locations: Max te verwerken locaties (0 = onbeperkt)
      progress_cb:   fn(gedaan, totaal, label) voor progressiebalk
      status_cb:     fn(tekst) voor statusberichten

    Returns:
      Verrijkte DataFrame (alle kolommen aangevuld)
    """
    stats      = BatchStats()
    checkpoint = CheckpointManager(master_df)

    # Vorig checkpoint herstellen
    vorig = checkpoint.load_checkpoint()
    if vorig is not None and len(vorig) == len(master_df):
        if status_cb:
            status_cb("♻️ Vorig checkpoint hersteld — hervat verwerking")
        checkpoint.df = vorig

    # Bepaal te verwerken subset (niet-gecheckte rijen)
    gecheckt_col = checkpoint.df.get(
        "ai_gecheckt", pd.Series("Nee", index=checkpoint.df.index)
    )
    mask = gecheckt_col != "Ja"
    to_process = checkpoint.df[mask]

    if max_locations > 0:
        to_process = to_process.head(max_locations)

    stats.totaal      = len(to_process)
    stats.overgeslagen = int((~mask).sum())

    if stats.totaal == 0:
        if status_cb:
            status_cb("✅ Alle locaties zijn al verrijkt! Niets te doen.")
        return checkpoint.df

    # ── STAP 1: PARALLELLE SCRAPING ────────────────────────────────────
    if status_cb:
        status_cb(
            f"🌐 Stap 1/2: Websites scrapen "
            f"({MAX_SCRAPE_WORKERS} parallelle workers, {stats.totaal} locaties)…"
        )

    def _scrape_progress(done, total, label):
        if progress_cb:
            progress_cb(done, total * 2, label)

    scrape_resultaten = parallel_scrape(to_process, progress_cb=_scrape_progress)

    if status_cb:
        gevonden = sum(1 for r in scrape_resultaten.values() if r.get("website"))
        status_cb(
            f"✅ Scraping klaar — {gevonden}/{stats.totaal} websites bereikt. "
            f"Start AI-verrijking…"
        )

    # ── STAP 2: SEQUENTIËLE AI-VERRIJKING ──────────────────────────────
    rijen = list(to_process.iterrows())
    totaal_batches = (len(rijen) + AI_BATCH_SIZE - 1) // AI_BATCH_SIZE

    for batch_nr in range(totaal_batches):
        start      = batch_nr * AI_BATCH_SIZE
        einde      = min(start + AI_BATCH_SIZE, len(rijen))
        batch_rijen = rijen[start:einde]

        # Stel batch input samen
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
                f"🤖 AI batch {batch_nr + 1}/{totaal_batches} "
                f"({einde - start} locaties) · ETA {stats.eta}"
            )

        # AI-aanroep (sequentieel, main thread)
        batch_resultaten = ai_batch_enrich(batch_input, status_cb=status_cb)

        # Resultaten verwerken
        for i, res in enumerate(batch_resultaten):
            if i < len(batch_rijen):
                orig_idx = batch_rijen[i][0]
                checkpoint.update(orig_idx, res)
                stats.verwerkt  += 1
                stats.succesvol += 1 if isinstance(res, dict) and res.get("naam") else 0

        # Voortgang rapporteren
        if progress_cb:
            progress_cb(
                len(rijen) + stats.verwerkt,
                len(rijen) * 2,
                f"🤖 AI batch {batch_nr + 1}/{totaal_batches} · "
                f"{stats.verwerkt}/{stats.totaal} verwerkt · ETA {stats.eta}",
            )

        # Checkpoint
        sheets_opgeslagen = checkpoint.maybe_save()
        if status_cb and sheets_opgeslagen:
            status_cb(
                f"💾 Checkpoint: {stats.verwerkt}/{stats.totaal} opgeslagen "
                f"| Verstreken: {stats.elapsed}"
            )

        # Rate-limit buffer (0.5s per batch = ~10 req/min voor AI)
        time.sleep(0.5)

    # Finale opslag
    checkpoint.maybe_save(force=True)

    if status_cb:
        status_cb(
            f"🎉 Klaar! {stats.succesvol}/{stats.totaal} locaties succesvol verrijkt "
            f"in {stats.elapsed}."
        )

    return checkpoint.df


# ── HULPFUNCTIES VOOR BEHEER-PAGINA ───────────────────────────────────────────

def get_onbekend_stats(df: pd.DataFrame) -> dict:
    """Telt 'Onbekend'-waarden per veld. Gebruikt door de Beheer-pagina."""
    velden = [
        "prijs", "honden_toegestaan", "stroom", "sanitair",
        "wifi", "water_tanken", "afvalwater", "beoordeling",
        "beschrijving", "telefoonnummer", "provincie",
    ]
    stats = {}
    for veld in velden:
        if veld in df.columns:
            n = int((df[veld].astype(str).str.lower() == "onbekend").sum())
            stats[veld] = {"onbekend": n, "pct": round(n / len(df) * 100, 1)}
    return stats


def estimate_batch_time(n: int) -> str:
    """Ruwe schatting van verwerkingstijd voor n locaties."""
    scrape_min  = (n / MAX_SCRAPE_WORKERS * 2) / 60
    ai_min      = (n / AI_BATCH_SIZE * 4)      / 60
    overhead_min = (n / AI_BATCH_SIZE * 0.5)   / 60
    totaal = scrape_min + ai_min + overhead_min
    return f"~{int(totaal)} – {int(totaal * 1.5)} minuten"
