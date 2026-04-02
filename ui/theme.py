"""
theme.py — Centraal design systeem voor VrijStaan.
Coast & Horizon thema: Geforceerde Light Mode + Custom Navigatie.
"""
import streamlit as st

def apply_theme():
    st.markdown("""
    <style>
        /* 1. Verberg de standaard lelijke Streamlit navigatie bovenaan */
        [data-testid="stSidebarNav"] { display: none !important; }
        
        /* 2. Strakke styling voor de applicatie */
        h1, h2, h3 { color: #0077B6 !important; font-weight: 700 !important; font-family: 'Helvetica Neue', sans-serif; }
        
        .stButton>button {
            background-color: #0077B6; color: white;
            border-radius: 6px; border: none; padding: 0.5rem 1rem;
            font-weight: bold; transition: all 0.2s ease;
        }
        .stButton>button:hover { background-color: #FFB703; color: #2B2D42; }
        
        /* 3. Locatie Cards */
        .locatie-card {
            background: white; border-radius: 8px;
            border: 1px solid #E0E0E0; padding: 1rem;
            margin-bottom: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        
        /* 4. Badges */
        .badge {
            display: inline-block; padding: 3px 8px;
            border-radius: 4px; font-size: 0.75rem; font-weight: 600;
            margin-right: 5px; margin-top: 5px;
        }
        .badge-gratis { background: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9; }
        .badge-betaald { background: #FFF3E0; color: #E65100; border: 1px solid #FFE0B2; }
        .badge-onbekend { background: #F5F5F5; color: #616161; border: 1px solid #E0E0E0; }
        .badge-facility { background: #E3F2FD; color: #1565C0; border: 1px solid #BBDEFB; }
    </style>
    """, unsafe_allow_html=True)

def render_sidebar_header():
    """Rendert het logo bovenaan en bouwt direct de navigatie op."""
    with st.sidebar:
        # 1. Het Logo
        st.markdown("""
        <div style="text-align:center; padding: 1rem 0 0.5rem 0;">
            <svg width="60" height="42" viewBox="0 0 24 24" fill="none" stroke="#0077B6"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
                         s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
                         A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
            </svg>
            <h2 style="margin: 5px 0 0 0; color: #0077B6; font-size: 1.4rem;">VrijStaan</h2>
            <p style="color: #6c757d; font-size: 0.8rem; font-style: italic; margin-top: 0;">Camperplaatsen zonder vertrektijden</p>
        </div>
        """, unsafe_allow_html=True)
        
        # 2. De Logische Navigatie Menu
        st.page_link("main.py", label="Startpagina", icon="🏠")
        st.page_link("pages/1_📍_Kaart.py", label="Dashboard & Kaart", icon="📍")
        st.page_link("pages/2_⚙️_Beheer.py", label="Data Beheer (Admin)", icon="⚙️")
        st.divider()

def price_badge(prijs: str) -> str:
    p = str(prijs).lower()
    if p == "gratis": return '<span class="badge badge-gratis">💰 Gratis</span>'
    elif p in ("onbekend", ""): return '<span class="badge badge-onbekend">❓ Onbekend</span>'
    else: return f'<span class="badge badge-betaald">💶 {prijs}</span>'
