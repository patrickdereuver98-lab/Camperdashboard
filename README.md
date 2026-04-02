# VrijStaan v2.0 — Volledige Codebase

## Gewijzigde & nieuwe bestanden

| Bestand | Status | Belangrijkste wijzigingen |
|---|---|---|
| `main.py` | ✅ Herschreven | Premium landing: hero, stats, features, provincie-shortcuts |
| `ui/theme.py` | ✅ Herschreven | Volledig design-systeem, gedeelde CSS-klassen, robuuste sidebar |
| `utils/helpers.py` | 🆕 Nieuw | `clean_val()`, `safe_html()`, `format_score()`, `facility_badges_html()` |
| `utils/ai_helper.py` | ✅ Gefixed | Search Grounding gerepareerd, lazy init, AI-query caching |
| `utils/enrichment.py` | ✅ Gefixed | JSON-bug (`telefoonummer`), SSRF-guard, UI ontkoppeld |
| `pages/2_⚙️_Beheer.py` | ✅ Gefixed | Batch-save elke 10 locaties (was: elke 1 → quota crash) |
| `pages/3_🚐_Camperplaatsen.py` | ✅ Compleet herschreven | Alle 13 bugs gefixed |
| `pages/1_📍_Kaart.py` | ✅ Redirect | Stuurt naar pagina 3 voor backward-compat. |
| `fetch_osm_data.py` | ✅ Gefixed | Nominatim provincie-lookup, deduplicatie |

## Bestanden die je ZELF moet bewaren (niet in ZIP)

Deze bestanden zijn niet gewijzigd maar vereist:
- `utils/data_handler.py` — Google Sheets connectie
- `utils/favorites.py` — Favorieten opslag
- `utils/auth.py` — Admin authenticatie
- `utils/logger.py` — Logging
- `.streamlit/secrets.toml` — API keys

## Installatie & Deployment

### Vereiste dependencies
```
streamlit>=1.32
google-generativeai
folium
beautifulsoup4
requests
pandas
```

### Aanbevolen toevoegingen
```
streamlit-folium  # Betere folium integratie (optioneel)
```

### secrets.toml structuur
```toml
GEMINI_API_KEY = "..."

[gcp_service_account]
type = "service_account"
project_id = "..."
# ... rest van Google Cloud credentials
```

## Opgeloste bugs (samenvatting)

### 🔴 Kritiek
- **JSON-crash `enrichment.py`**: `"telefoonummer",` was ongeldige JSON-key → altijd parse-fout
- **Search Grounding werkte niet**: `tools=` parameter ontbrak bij `generate_content()`
- **Scroll-container kapot**: `st.markdown('<div overflow-y>')` vangt geen Streamlit widgets

### 🟡 Performance
- **Rate limit crash Beheer**: `save_data()` na elke locatie → nu elke 10 + finaal
- **Kaart traag**: 150 DivIcon-markers → nu MarkerCluster
- **AI query herhaling**: elke rerender herriep Gemini → nu `@st.cache_data(ttl=600)`

### 🔵 UX
- Favoriet-knoppen op elke card (waren geïmporteerd maar nooit aangeroepen)
- Sorteeropties toegevoegd (naam, prijs, beoordeling)
- "Zoekopdracht wissen" knop
- Waterfront-badge hersteld
- Provincie-preset vanuit landing-page
- Dynamische locatietelling in hero

### 🟢 Architectuur/Veiligheid
- XSS-fix: naam/provincie worden nu HTML-geëscaped in cards
- SSRF-guard in `scrape_website()`
- Centrale `clean_val()` vervangt 20+ losse `str(val) in ("nan",...)` checks
- `apply_theme()` nu op elke pagina als eerste aanroep
