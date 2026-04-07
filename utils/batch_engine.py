"""
utils/batch_engine.py — VrijStaan High-Performance Batch Engine v5.
Pijler 3: 1-op-1 Sequentiële Architectuur ("Slow & Steady").

Nieuw in v5:
  - 1-op-1 verwerking: Maximale AI-focus, geen array-fouten meer.
  - Micro-checkpoints: Lokale CSV save na ELKE locatie, Sheets na elke 5.
  - Beoordeling normalisatie: Converteert 10-punts schalen automatisch naar /5.
  - Telefoonnummer fix: Voorkomt dubbele kolommen in de DataFrame.
  - Exponential Backoff & Fallback chain behouden voor maximale stabiliteit.
"""
from __future__ import annotations

import json
import os
import re
import time
import random
import logging
import requests
import streamlit as st
from dataclasses import dataclass, field
from typing import Callable

import pandas as pd

logger = logging.getLogger("vrijstaan.batch_engine")

# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
CHECKPOINT_CSV_N    = 1       # CSV-save na ELKE locatie
CHECKPOINT_SHEETS_N = 5       # Sheets-save elke 5 locaties
SCRAPE_TIMEOUT      = 10      # HTTP timeout per request
CHECKPOINT_DIR      = "data/checkpoints"
CHECKPOINT_FILE     = f"{CHECKPOINT_DIR}/batch_progress.csv"
RATE_LIMIT_DELAY    = 1.5     # Rustige adempauze tussen locaties


# ── NORMALISATIE FUNCTIES ──────────────────────────────────────────────────────

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

def normalize_phone(raw: str) -> str:
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

def normalize_rating(raw: str) -> str:
    """Extraheert het getal en converteert een 10-punts schaal naar maximaal 5."""
    s = str(raw).strip().lower()
    if s in ("onbekend", "nan", "none", "", "-", "null"):
        return "Onbekend"
    
    matches = re.findall(r"\d+[\.,]?\d*", s)
    if not matches:
        return "Onbekend"
    
    try:
        score = float(matches[0].replace(",", "."))
        # Als score boven 5 is (bijv 8.4 op 10), deel door 2
        if score > 5.0 and score <= 10.0:
            score = score / 2.0
        elif score > 10.0:
            return "Onbekend" # Foutieve data
        return f"{round(score, 1)}"
    except ValueError:
        return "Onbekend"

def _postprocess_result(res: dict) -> dict:
    """Toepassen van datahygiëne op het AI resultaat."""
    if not isinstance(res, dict):
        return res
    if "provincie" in res:
        res["provincie"] = normalize_province(str(res.get("provincie", "")))
    if "telefoonnummer" in res:
        res["telefoonnummer"] = normalize_phone(str(res.get("telefoonnummer", "")))
    if "beoordeling" in res:
        res["beoordeling"] = normalize_rating(str(res.get("beoordeling", "")))
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


# ── STAP 1: SYNCHRONE SCRAPER (1-OP-1) ─────────────────────────────────────────

def scrape_single_location(naam: str, provincie: str, website: str) -> dict:
    """Scrapet data voor exact één locatie synchroon."""
    from utils.enrichment import (
        scrape_website, scrape_photos,
        scrape_campercontact, scrape_park4night,
    )
    ws     = scrape_website(website)
    photos = scrape_photos(website, max_photos=6)
    cc     = scrape_campercontact(naam, provincie)
    p4n    = scrape_park4night(naam, provincie)
    
    return {
        "website": ws,
        "photos": photos,
        "campercontact": cc,
        "park4night": p4n,
    }


# ── STAP 2: GEMINI REST API (1-OP-1) ───────────────────────────────────────────

def _direct_gemini_call(prompt: str, model_name: str = "gemini-2.5-flash") -> str:
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
    except (KeyError, Exception):
        raise ValueError("GEMINI_API_KEY ontbreekt in st.secrets")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={api_key}"
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


def _build_single_prompt(loc_data: dict) -> str:
    """Bouwt een scherpe, gefocuste prompt voor exact één locatie."""
    b = loc_data.get("_bronnen", {})
    
    bronnen_blok = (
        f"Website: {b.get('website','')[:3000] or '(niet beschikbaar)'}\n"
        f"Campercontact: {b.get('campercontact','')[:2000] or '(niet gevonden)'}\n"
        f"Park4Night: {b.get('park4night','')[:2000] or '(niet gevonden)'}\n"
    )
    
    return f"""
Je bent expert data-analist voor VrijStaan (NL camperplatform).
Onderzoek uitsluitend de volgende locatie: 
Naam: {loc_data.get('naam')}
Provincie: {loc_data.get('provincie')}

BRONINHOUD:
{bronnen_blok}

INSTRUCTIES:
• Ja=aanwezig | Nee=afwezig (deductie) | Onbekend=echt niet te vinden
• Parkeerplaatsen: stroom=Nee, sanitair=Nee (tenzij bewijs anders)
• Jachthavens: water_tanken=Ja, sanitair=Ja (standaard)
• Telefoon: +31 formaat (0612345678 → "+31 6 1234 5678")
• beoordeling: uitsluitend een getal op een schaal van 5 (bijv. 4.2). Geen /5 erachter.
• beschrijving: 2-4 sfeervolle zinnen
• samenvatting_reviews: doorlopende Gasten-zin 20-40 woorden
• loc_type: "Camping"/"Camperplaats"/"Parking"/"Jachthaven"/"Boerderij"

Retourneer UITSLUITEND een enkel JSON-object (geen array):
{{
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
  "beoordeling": "4.2 of Onbekend",
  "samenvatting_reviews": "Gasten-zin of Onbekend",
  "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
  "roken": "Ja/Nee/Onbekend",
  "feesten": "Ja/Nee/Onbekend",
  "faciliteiten_extra": "CSV extra faciliteiten of Onbekend",
  "huisregels": "tekst of Onbekend",
  "loc_type": "Camping/Camperplaats/etc.",
  "ai_gecheckt": "Ja"
}}
"""


def ai_single_enrich(
    loc_data: dict,
    status_cb: Callable | None = None,
    max_retries_per_model: int = 4,
) -> dict | None:
    """Verrijkt één locatie met Exponential Backoff & Fallback Chain."""
    prompt = _build_single_prompt(loc_data)
    
    fallback_models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash"
    ]

    for model_name in fallback_models:
        for poging in range(max_retries_per_model):
            try:
                if status_cb and (poging > 0 or model_name != fallback_models[0]):
                    status_cb(f"⏳ {model_name} | Retry {poging}/{max_retries_per_model}…")
                
                response = _direct_gemini_call(prompt, model_name=model_name)
                
                clean = response.strip()
                for fence in ("```json", "```"):
                    clean = clean.replace(fence, "")
                clean = clean.strip()
                
                # We verwachten nu één JSON object, geen array
                start = clean.find("{")
                end   = clean.rfind("}") + 1
                if start == -1 or end == 0:
                    raise ValueError("Geen JSON-object gevonden in response")
                
                resultaat: dict = json.loads(clean[start:end])
                
                # Behoud metadata
                resultaat["_idx"] = loc_data.get("_idx")
                photos = loc_data.get("_bronnen", {}).get("photos", [])
                if photos:
                    resultaat["photos"] = json.dumps(photos, ensure_ascii=False)
                
                return _postprocess_result(resultaat)

            except requests.exceptions.Timeout:
                if status_cb:
                    status_cb(f"⚠️ {model_name} API timeout. Retry over 5s…")
                time.sleep(5)
            except Exception as e:
                msg = str(e).lower()
                if any(k in msg for k in ("429", "quota", "503", "500", "unavailable", "high demand")):
                    if poging < max_retries_per_model - 1:
                        wacht = (2 ** poging) + random.uniform(0, 1)
                        if status_cb:
                            status_cb(f"⏳ {model_name} druk (503/429). Wacht {wacht:.1f}s…")
                        time.sleep(wacht)
                    else:
                        if status_cb:
                            status_cb(f"⚠️ {model_name} blijft falen. Fallback...")
                        break 
                else:
                    logger.warning(f"AI harde fout via {model_name}: {e}")
                    if status_cb:
                        status_cb(f"⚠️ Fout bij {model_name}: {e}")
                    break 
                    
    logger.error("Alle API fallback-modellen zijn gefaald voor deze locatie.")
    return None


# ── CHECKPOINT MANAGER ─────────────────────────────────────────────────────────

class CheckpointManager:
    """Beheert incrementele opslag. Nu geoptimaliseerd voor 1-op-1 opslag."""

    def __init__(self, master_df: pd.DataFrame) -> None:
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)
        self.df = master_df.copy()
        
        # Telefoonnummer De-duplicatie: zorg dat alles schoon is voor we starten
        self._deduplicate_columns()
        
        self.laatste_csv_save     = 0
        self.laatste_sheets_save  = 0
        self.verwerkt_sinds_start = 0

    def _deduplicate_columns(self):
        """Voegt dubbele kolommen zoals 'Telefoonnummer' en 'telefoonnummer' samen."""
        cols = self.df.columns.tolist()
        lower_cols = [c.lower() for c in cols]
        
        # Als we exacte duplicaten in naam hebben (hoofdletter genegeerd)
        if len(lower_cols) != len(set(lower_cols)):
            logger.info("Dubbele kolommen gedetecteerd, de-duplicatie gestart.")
            # Zorg dat de officiële kolom altijd lowercase is
            self.df.columns = lower_cols
            # Pandas maakt er 'telefoonnummer', 'telefoonnummer_1' etc van
            self.df = self.df.loc[:, ~self.df.columns.duplicated(keep='first')]

    def update(self, idx: int, data: dict) -> None:
        if data:
            for key, val in data.items():
                if key.startswith("_"):
                    continue
                
                # Zorg dat de key altijd lowercase is om nieuwe duplicaten te voorkomen
                clean_key = key.lower()
                
                if clean_key not in self.df.columns:
                    self.df[clean_key] = "Onbekend"
                
                if isinstance(val, list):
                    val = json.dumps(val, ensure_ascii=False)
                elif isinstance(val, dict):
                    val = str(val)
                
                self.df.at[idx, clean_key] = val
        self.df.at[idx, "ai_gecheckt"] = "Ja"
        self.verwerkt_sinds_start += 1

    def maybe_save(self, force: bool = False) -> bool:
        n = self.verwerkt_sinds_start
        sheets_saved = False
        
        # Lokale CSV save (gebeurt nu veel vaker)
        if force or (n - self.laatste_csv_save) >= CHECKPOINT_CSV_N:
            try:
                self.df.to_csv(CHECKPOINT_FILE, index=False)
                self.laatste_csv_save = n
            except Exception as e:
                logger.error(f"CSV checkpoint fout: {e}")
                
        # Google Sheets push
        if force or (n - self.laatste_sheets_save) >= CHECKPOINT_SHEETS_N:
            try:
                from utils.data_handler import save_data
                save_data(self.df)
                self.laatste_sheets_save = n
                sheets_saved = True
            except Exception as e:
                logger.error(f"Sheets checkpoint fout: {e}")
                
        return sheets_saved

    def load_checkpoint(self) -> pd.DataFrame | None:
        if os.path.exists(CHECKPOINT_FILE):
            try:
                df = pd.read_csv(CHECKPOINT_FILE).astype(object).fillna("Onbekend")
                df.columns = [c.lower() for c in df.columns]
                return df.loc[:, ~df.columns.duplicated(keep='first')]
            except Exception:
                pass
        return None


# ── HOOFD: VOLAUTOMATISCHE 1-OP-1 RUN ─────────────────────────────────────────

def run_full_batch(
    master_df:     pd.DataFrame,
    max_locations: int = 0,           # 0 = onbeperkt
    progress_cb:   Callable | None = None,
    status_cb:     Callable | None = None,
    stop_flag:     Callable | None = None, 
) -> pd.DataFrame:
    """
    Pijler 3: Volledig automatische sequentiële verwerking (1 voor 1).
    Maximale stabiliteit, focus en data-integriteit.
    """
    stats      = BatchStats()
    checkpoint = CheckpointManager(master_df)

    vorig = checkpoint.load_checkpoint()
    if vorig is not None and len(vorig) == len(master_df):
        if status_cb:
            status_cb("♻️ Vorig checkpoint hersteld — hervat verwerking")
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
        if status_cb:
            status_cb("✅ Alle locaties zijn al verrijkt!")
        return checkpoint.df

    if status_cb:
        status_cb(
            f"🚀 Start 1-op-1 Engine: {stats.totaal} locaties te verwerken "
            f"({stats.overgeslagen} al klaar)"
        )

    # ── Sequentiële 1-op-1 Loop ──────────────────────────────
    for idx, row in to_process.iterrows():
        if stop_flag and stop_flag():
            if status_cb:
                status_cb(f"🛑 Gestopt op verzoek bij {stats.verwerkt}/{stats.totaal}")
            break

        naam = str(row.get("naam", "Onbekend"))
        provincie = str(row.get("provincie", "Nederland"))
        
        if status_cb:
            status_cb(f"🔍 Scrapen ({stats.verwerkt + 1}/{stats.totaal}): {naam}...")

        # 1. Scrapen (Synchroon)
        bronnen = scrape_single_location(
            naam, 
            provincie, 
            str(row.get("website", ""))
        )

        loc_input = {
            "_idx":      idx,
            "_bronnen":  bronnen,
            "naam":      naam,
            "provincie": provincie,
        }

        if status_cb:
            status_cb(f"🤖 AI Analyse: {naam}...")

        # 2. AI Verrijking (Synchroon)
        verrijkt_resultaat = ai_single_enrich(loc_input, status_cb=status_cb)

        # 3. Update & Save
        if verrijkt_resultaat:
            checkpoint.update(idx, verrijkt_resultaat)
            stats.succesvol += 1
        else:
            # AI faalde volledig, markeer als gecheckt zodat we niet in een loop blijven steken
            checkpoint.update(idx, {"ai_gecheckt": "Ja - Gedeeltelijk gefaald"})
            stats.mislukt += 1

        stats.verwerkt += 1

        if progress_cb:
            progress_cb(
                stats.verwerkt,
                stats.totaal,
                f"⚙️ {stats.verwerkt}/{stats.totaal} verwerkt · ETA {stats.eta}",
            )

        sheets_saved = checkpoint.maybe_save()
        if status_cb and sheets_saved:
            status_cb(f"💾 Cloud Save: {stats.verwerkt}/{stats.totaal} · {stats.elapsed}")

        time.sleep(RATE_LIMIT_DELAY)

    # ── Finale opslag ──────────────────────────────────────────────────
    checkpoint.maybe_save(force=True)

    if status_cb:
        status_cb(
            f"🎉 Klaar! {stats.succesvol} gelukt, {stats.mislukt} overgeslagen "
            f"in {stats.elapsed}."
        )

    return checkpoint.df


# ── HULPFUNCTIES VOOR BEHEER-PAGINA ───────────────────────────────────────────

def get_onbekend_stats(df: pd.DataFrame) -> dict:
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
    # Aangezien we nu 1-op-1 doen, duurt alles wat langer maar is het veel stabieler.
    scrape  = (n * 3) / 60   # aanname: 3 sec per scrape
    ai      = (n * 6) / 60   # aanname: 6 sec per AI call
    overhead = (n * RATE_LIMIT_DELAY) / 60
    totaal = scrape + ai + overhead
    return f"~{int(totaal)} minuten"
