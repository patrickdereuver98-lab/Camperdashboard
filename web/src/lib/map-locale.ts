/**
 * Nederlandse teksten voor de knoppen en meldingen van MapLibre (optie `locale` van `new Map`). Zonder deze lijst lezen
 * schermlezers "Zoom in" en "Toggle attribution" voor (review november R31). De sleutels volgen `defaultLocale` van
 * maplibre-gl; tests/map-locale.test.ts controleert dat er geen ontbreekt na een update.
 */
export const MAP_LOCALE_NL: Record<string, string> = {
  "AttributionControl.ToggleAttribution": "Bronvermelding tonen of verbergen",
  "AttributionControl.MapFeedback": "Fout in de kaart melden",
  "FullscreenControl.Enter": "Kaart op volledig scherm",
  "FullscreenControl.Exit": "Volledig scherm sluiten",
  "GeolocateControl.FindMyLocation": "Mijn locatie zoeken",
  "GeolocateControl.LocationNotAvailable": "Locatie niet beschikbaar",
  "LogoControl.Title": "Logo van MapLibre",
  "Map.Title": "Kaart",
  "Marker.Title": "Plek op de kaart",
  "NavigationControl.ResetBearing": "Sleep om de kaart te draaien, klik om het noorden boven te zetten",
  "NavigationControl.ZoomIn": "Inzoomen",
  "NavigationControl.ZoomOut": "Uitzoomen",
  "Popup.Close": "Sluiten",
  "ScaleControl.Feet": "ft",
  "ScaleControl.Meters": "m",
  "ScaleControl.Kilometers": "km",
  "ScaleControl.Miles": "mijl",
  "ScaleControl.NauticalMiles": "zeemijl",
  "GlobeControl.Enable": "Wereldbol aanzetten",
  "GlobeControl.Disable": "Wereldbol uitzetten",
  "TerrainControl.Enable": "Reliëf aanzetten",
  "TerrainControl.Disable": "Reliëf uitzetten",
  "CooperativeGesturesHandler.WindowsHelpText": "Gebruik Ctrl en scrollen om in te zoomen",
  "CooperativeGesturesHandler.MacHelpText": "Gebruik ⌘ en scrollen om in te zoomen",
  "CooperativeGesturesHandler.MobileHelpText": "Gebruik twee vingers om de kaart te verschuiven",
};
