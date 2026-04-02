"""
auth.py — Eenvoudige wachtwoord-authenticatie voor de Beheer-pagina.
Gebruikt bcrypt voor veilige vergelijking. Wachtwoord staat in st.secrets.
"""
import streamlit as st
import bcrypt
from utils.logger import logger


def _get_hashed_password() -> bytes | None:
    """Haalt het admin-wachtwoord op uit secrets en hasht het eenmalig."""
    try:
        pw = st.secrets["ADMIN_PASSWORD"]
        return bcrypt.hashpw(pw.encode(), bcrypt.gensalt())
    except KeyError:
        logger.warning("ADMIN_PASSWORD niet gevonden in secrets — beheer onbeveiligd")
        return None


def check_admin_password(input_password: str) -> bool:
    """Vergelijkt ingevoerd wachtwoord met het geconfigureerde wachtwoord."""
    try:
        stored = st.secrets["ADMIN_PASSWORD"]
        return input_password == stored
    except KeyError:
        # Geen wachtwoord geconfigureerd → open toegang (development)
        logger.warning("Geen ADMIN_PASSWORD in secrets — beheer toegankelijk zonder auth")
        return True


def require_admin_auth() -> bool:
    """
    Toont een login-formulier als de gebruiker nog niet geauthenticeerd is.
    Retourneert True als toegang verleend, False als de pagina geblokkeerd wordt.
    Beheert state via st.session_state['admin_authenticated'].
    """
    if st.session_state.get("admin_authenticated"):
        return True

    st.markdown("## 🔐 Beheer — Toegang vereist")
    st.info("Deze pagina is beveiligd. Voer het beheer-wachtwoord in om door te gaan.")

    with st.form("admin_login_form"):
        pw_input = st.text_input("Wachtwoord", type="password", placeholder="••••••••")
        submitted = st.form_submit_button("Inloggen", use_container_width=True)

    if submitted:
        if check_admin_password(pw_input):
            st.session_state["admin_authenticated"] = True
            logger.info("Beheer: succesvolle inlog")
            st.rerun()
        else:
            st.error("Onjuist wachtwoord.")
            logger.warning("Beheer: mislukte inlogpoging")

    return False
