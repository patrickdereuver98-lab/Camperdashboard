import streamlit as st

def apply_theme():
    """Injecteert de centrale CSS styling in de applicatie."""
    custom_css = """
    <style>
        /* Kleurvariabelen */
        :root {
            --pine-green: #2A5A4A;
            --sand: #E5D9C5;
            --slate: #2C3E50;
            --light-bg: #F8F9FA;
        }
        
        /* Headers strakker maken */
        h1, h2, h3 {
            color: var(--pine-green) !important;
            font-family: 'Helvetica Neue', sans-serif;
        }
        
        /* Knoppen styling */
        .stButton>button {
            background-color: var(--pine-green);
            color: white;
            border-radius: 5px;
            border: none;
            padding: 0.5rem 1rem;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .stButton>button:hover {
            background-color: var(--slate);
            border-color: var(--slate);
        }
        
        /* Achtergrond van de hoofdcontainer */
        .block-container {
            padding-top: 2rem;
            padding-bottom: 2rem;
        }
    </style>
    """
    st.markdown(custom_css, unsafe_allow_html=True)

def render_logo():
    """Rendert het gecentraliseerde SVG logo inclusief de slogan."""
    svg_logo = """
    <div style="text-align: center; margin-bottom: 2rem;">
        <svg width="120" height="80" viewBox="0 0 24 24" fill="none" stroke="#2A5A4A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
            <path d="M14 10h5"/>
            <path d="M5 10h4"/>
        </svg>
        <h1 style="margin-bottom: 0; padding-bottom: 0;">VrijStaan</h1>
        <p style="color: #2C3E50; font-size: 1.1rem; font-style: italic; margin-top: -5px;">Camperplaatsen zonder vertrektijden</p>
    </div>
    """
    st.markdown(svg_logo, unsafe_allow_html=True)
