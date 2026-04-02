import streamlit as st

def apply_theme():
    """Injecteert het 'Coast & Horizon' design systeem."""
    custom_css = """
    <style>
        /* Kleurvariabelen - Frisser en lichter */
        :root {
            --primary-blue: #0077B6;      /* Oceaan blauw */
            --accent-orange: #FFB703;     /* Zonsondergang / Actie */
            --sand-light: #F8F9FA;        /* Achtergrond */
            --sidebar-bg: #FFFFFF;        /* Puur wit voor rust */
            --text-main: #2B2D42;         /* Donkerblauw/grijs voor leesbaarheid */
        }
        
        /* Sidebar styling */
        [data-testid="stSidebar"] {
            background-color: var(--sidebar-bg);
            border-right: 1px solid #E0E0E0;
        }

        /* Hoofdtitels */
        h1, h2, h3 {
            color: var(--primary-blue) !important;
            font-weight: 700 !important;
        }

        /* Knoppen: Vriendelijk en opvallend */
        .stButton>button {
            background-color: var(--primary-blue);
            color: white;
            border-radius: 8px;
            border: none;
            padding: 0.6rem 1.2rem;
            font-weight: 600;
            transition: all 0.2s ease-in-out;
            width: 100%;
        }
        .stButton>button:hover {
            background-color: var(--accent-orange);
            color: var(--text-main);
            transform: translateY(-1px);
        }

        /* Kaarten/Cards in de lijst */
        div[data-testid="stExpander"], div.stContainer {
            border-radius: 12px !important;
            border: 1px solid #F0F0F0 !important;
            box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        }
    </style>
    """
    st.markdown(custom_css, unsafe_allow_html=True)

def render_sidebar_header():
    """Rendert het logo en de titel in de sidebar voor een dashboard look."""
    with st.sidebar:
        logo_html = """
        <div style="text-align: center; padding: 1rem 0;">
            <svg width="80" height="60" viewBox="0 0 24 24" fill="none" stroke="#0077B6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/>
                <path d="M9 17h6"/>
                <circle cx="17" cy="17" r="2"/>
            </svg>
            <h2 style="margin: 0; color: #0077B6; font-size: 1.5rem;">VrijStaan</h2>
            <p style="color: #8D99AE; font-size: 0.85rem; font-style: italic;">Vrijheid zonder vertrektijden</p>
        </div>
        <hr style="margin: 0 0 1rem 0; border: 0; border-top: 1px solid #EEE;">
        """
        st.markdown(logo_html, unsafe_allow_html=True)
