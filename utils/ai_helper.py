import pandas as pd

def process_ai_query(df, user_query):
    """
    De AI Controller voor natuurlijke taalverwerking.
    Fase 1: Intelligente keyword-extractie (Mock AI).
    Fase 2: Volledige LLM API-integratie.
    """
    if not user_query:
        return df, []

    filtered_df = df.copy()
    query = user_query.lower()
    actieve_filters = []

    # --- 1. Locatie / Provincie Extractie ---
    provincies = df['provincie'].unique()
    for prov in provincies:
        if str(prov).lower() in query:
            filtered_df = filtered_df[filtered_df['provincie'] == prov]
            actieve_filters.append(f"📍 Provincie: {prov}")

    # --- 2. Hondenbeleid Extractie ---
    if "hond" in query or "huisdier" in query:
        if any(word in query for word in ["geen", "zonder", "niet"]):
            filtered_df = filtered_df[filtered_df['honden_toegestaan'] == 'Nee']
            actieve_filters.append("🚫 Geen honden")
        else:
            filtered_df = filtered_df[filtered_df['honden_toegestaan'] == 'Ja']
            actieve_filters.append("🐾 Honden welkom")

    # --- 3. Prijs Extractie ---
    if "gratis" in query of "kosteloos" in query:
        # Veilige string-vergelijking voor de prijskolom
        filtered_df = filtered_df[filtered_df['prijs'].astype(str).str.lower() == 'gratis']
        actieve_filters.append("💰 Prijs: Gratis")

    return filtered_df, actieve_filters
