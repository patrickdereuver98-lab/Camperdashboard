"""
pages/1_📍_Kaart.py — Backward compatibility redirect.
Stuurt bezoekers van de oude URL direct door naar de nieuwe premiumspagina.
"""
import streamlit as st

st.set_page_config(page_title="VrijStaan | Doorsturen...", page_icon="🚐")
st.switch_page("pages/3_🚐_Camperplaatsen.py")
