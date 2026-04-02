"""
theme.py — Centraal design systeem voor VrijStaan.
Coast & Horizon thema: pine green + ocean blue + sunset orange.
"""
import streamlit as st


def apply_theme():
    st.markdown("""
    <style>
        :root {
            --pine-green: #2A5A4A;
            --ocean-blue: #0077B6;
            --sunset-orange: #FFB703;
            --slate: #2C3E50;
            --light-bg: #F8F9FA;
            --sidebar-bg: #F0F4F3;
        }
        h1, h2, h3 { color: var(--pine-green) !important; font-family: 'Helvetica Neue', sans-serif; }
        .stButton>button {
            background-color: var(--pine-green); color: white;
            border-radius: 6px; border: none; padding: 0.5rem 1rem;
            font-weight: bold; transition: all 0.25s ease;
        }
        .stButton>button:hover {
            background-color: var(--slate);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .block-container { padding-top: 1.5rem; padding-bottom: 2rem; }
        [data-testid="stSidebar"] { background-color: var(--sidebar-bg); }
        [data-testid="metric-container"] {
            background: white; border: 1px solid #E0E0E0;
            border-radius: 8px; padding: 0.75rem;
        }
        .locatie-card {
            background: white; border-radius: 10px;
            border: 1px solid #E8EDED; padding: 0.75rem;
            margin-bottom: 0.6rem; transition: box-shadow 0.2s;
        }
        .locatie-card:hover { box-shadow: 0 4px 16px rgba(42,90,74,0.12); }
        .badge {
            display: inline-block; padding: 2px 8px;
            border-radius: 20px; font-size: 0.75rem; font-weight: 600;
            margin-right: 4px;
        }
        .badge-gratis { background: #D4EDDA; color: #155724; }
        .badge-betaald { background: #FFF3CD; color: #856404; }
        .badge-onbekend { background: #E8E8E8; color: #555; }
        .filter-tag {
            background: #E8F4F1; color: var(--pine-green);
            border-radius: 20px; padding: 3px 10px;
            font-size: 0.8rem; display: inline-block; margin: 2px;
        }
        hr { border-color: #D0D7D4; }
    </style>
    """, unsafe_allow_html=True)


def render_logo():
    st.markdown("""
    <div style="text-align:center;margin-bottom:2rem;">
        <svg width="100" height="68" viewBox="0 0 24 24" fill="none" stroke="#2A5A4A"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
                     s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
                     A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
            <path d="M14 10h5"/><path d="M5 10h4"/>
        </svg>
        <h1 style="margin-bottom:0;padding-bottom:0;">VrijStaan</h1>
        <p style="color:#2C3E50;font-size:1.05rem;font-style:italic;margin-top:-4px;">
            Camperplaatsen zonder vertrektijden
        </p>
    </div>""", unsafe_allow_html=True)


def render_sidebar_header():
    with st.sidebar:
        st.markdown("""
        <div style="text-align:center;padding:0.5rem 0 0.8rem 0;">
            <svg width="48" height="34" viewBox="0 0 24 24" fill="none" stroke="#2A5A4A"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
                         s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
                         A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
            </svg>
            <div style="font-weight:700;color:#2A5A4A;font-size:1.05rem;margin-top:3px;">VrijStaan</div>
            <div style="color:#666;font-size:0.72rem;font-style:italic;">Camperplaatsen zonder vertrektijden</div>
        </div>""", unsafe_allow_html=True)
        st.divider()


def price_badge(prijs: str) -> str:
    p = str(prijs).lower()
    if p == "gratis":
        return '<span class="badge badge-gratis">💰 Gratis</span>'
    elif p in ("onbekend", ""):
        return '<span class="badge badge-onbekend">❓ Onbekend</span>'
    else:
        return f'<span class="badge badge-betaald">💶 {prijs}</span>'
