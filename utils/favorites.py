"""
favorites.py — Persistente favorieten via lokaal JSON-bestand.
Per sessie geladen in session_state, weggeschreven bij elke wijziging.
"""
import json
import os
from pathlib import Path

import streamlit as st
from utils.logger import logger

FAV_PATH = Path("data/favorieten.json")
FAV_KEY = "vrijstaan_favorieten"


def _load_from_disk() -> list[str]:
    try:
        if FAV_PATH.exists():
            return json.loads(FAV_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"Favorieten laden mislukt: {e}")
    return []


def _save_to_disk(favs: list[str]) -> None:
    try:
        FAV_PATH.parent.mkdir(parents=True, exist_ok=True)
        FAV_PATH.write_text(json.dumps(favs, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error(f"Favorieten opslaan mislukt: {e}")


def init_favorites() -> None:
    """Laad favorieten van schijf naar session_state (eenmalig per sessie)."""
    if FAV_KEY not in st.session_state:
        st.session_state[FAV_KEY] = _load_from_disk()


def get_favorites() -> list[str]:
    init_favorites()
    return st.session_state[FAV_KEY]


def is_favorite(naam: str) -> bool:
    return naam in get_favorites()


def toggle_favorite(naam: str) -> None:
    init_favorites()
    favs = st.session_state[FAV_KEY]
    if naam in favs:
        favs.remove(naam)
        logger.info(f"Favoriet verwijderd: {naam}")
    else:
        favs.append(naam)
        logger.info(f"Favoriet toegevoegd: {naam}")
    _save_to_disk(favs)
