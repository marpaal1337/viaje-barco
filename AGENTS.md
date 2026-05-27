# Viaje Velero Baleares — Contexto del Proyecto

## ¿Qué es?
Planificación de un viaje en velero sin patrón a Ibiza para 5 personas (3 Valencia, 1 Madrid, 1 Módena/Bolonia). Objetivo: mínimo coste posible.

## Decisión tomada
- **Destino:** Ibiza (IBZ)
- **Fecha:** 31 Ago (noche San Antonio) + 1-3 Sep 2026 (3 días barco)
- **Barco:** objetivo Sun Odyssey 349 (~350€/día sin patrón).
  Datos scrapeados de SamBoat (105 veleros en Ibiza, 39 sin patrón).
  Mejores candidatos sin patrón:
  - 🥇 **Visiers 35** - 250€/día | 6pers | 2cab | 15m | 2020 | Ibiza Ciudad | Barco solo ⭐5.0
  - 🥇 **Dufour 37** - 357€/día | 6pers | 3cab | 2023 | San Antonio | Barco solo ⭐5.0
  - 🥇 **Bénéteau Oceanis 41.1** - 356€/día | 8pers | 3cab | 12m | 2019 | Ibiza | Patrón opcional
- **Alojamiento 31 Ago:** En San Antonio. 3 opciones:
  - 🥇 Apartamentos San Francisco (~311€, ⭐8.4) 
  - Aparthotel Vibra Club Maritim (~328€, ⭐8.4)
  - Hostal Sunset Ibiza (~385€, ⭐7.6)
- **Coste:** ~466€/pers (vuelos+barco+alojamiento+extras)

## Estructura del proyecto
```
viaje-barco/
├── AGENTS.md                    # Este archivo — contexto acumulativo
├── plan-viaje-ibiza.html        # Plan interactivo con mapa, timeline, chart.js
├── informe-viaje.md             # Informe de viabilidad en markdown
├── informe-viaje-baleares.xlsx  # Excel con vuelos/barcos/escenarios/calendario
├── generar_excel.py             # Genera el Excel con openpyxl
├── scraper_vuelos.py            # Scraper Google Flights (Playwright o manual)
├── scraper_barcos.py            # Scraper Click&Boat (Playwright o manual)
├── scraper_barcos_samboat.py    # Scraper SamBoat (Playwright) — genera datos reales
├── scraper_alojamientos.py      # Scraper Booking/Airbnb (Playwright o manual)
├── comparador-barcos.html       # Visual comparador de barcos
├── comparador-vuelos.html       # Visual comparador de vuelos
├── planeamiento-nautico.md      # Planeamiento náutico: waypoints, peligros, fondeos, amarres
├── requirements.txt             # Python dependencies
├── .env.example                 # No requiere API keys
└── data/
    ├── vuelos.json              # Datos de vuelos scrapeados
    ├── barcos.json              # Datos de barcos scrapeados
    └── alojamientos.json        # Datos de alojamientos scrapeados
```

## Ruta navegación (3 días)
| Día | Ruta | MN | Pernocta |
|-----|------|:--:|----------|
| Mar 1 Sep | Puerto → Cala Comte → Cala d'Hort → Puerto | ~28.5 | Amarre ~30€ |
| Mié 2 Sep | Puerto → Tagomago → Cala Benirràs → Puerto | ~37 | Amarre ~30€ |
| Jue 3 Sep | Porroig/Cala d'en Serra → Puerto (check-out 18:00) | ~16 | Vuelta a casa |

Fondeos gratis en Cala Comte, Cala d'Hort, Tagomago, Benirràs, Porroig, Cala d'en Serra.
Zonas de peligro: Bajo Caragoler, L'Esponja (S Es Vedrà), Es Freus, Baix des Caló, Roca sa Gorra.

## Grupo (5 personas)
| Nombre | Origen | Vuelos | Coste |
|--------|--------|--------|:-----:|
| Martín | VLC | Ryanair 31Ago 05:45 + Iberia 3Sep 22:10 | 143€ |
| Gemma | VLC | Ryanair 31Ago 05:45 + Iberia 3Sep 22:10 | 143€ |
| Adrián | VLC | Ryanair 31Ago 05:45 + Iberia 3Sep 22:10 | 143€ |
| Nereida | MAD | Iberia Express 31Ago 21:45 + Ryanair 3Sep 22:40 | 112€ |
| Alberto | BLQ | Ryanair 31Ago 20:05 + Ryanair 3Sep 23:05 | 227€ |

## Costes confirmados (vuelos)
- VLC→IBZ (3 pers): Ryanair 05:45 31Ago (45€) + Iberia 22:10 3Sep (98€) = 143€/pers → 429€
- MAD→IBZ (1 pers): Iberia Express 21:45 31Ago (58€) + Ryanair 22:40 3Sep (54€) = 112€/pers → 112€
- BLQ→IBZ (1 pers): Ryanair 20:05 31Ago (82€) + Ryanair 23:05 3Sep (145€) = 227€/pers → 227€
- **Total vuelos: 768€ ✅**

## Datos scrapeados (barcos)
105 veleros en Ibiza scrapeados de SamBoat.es con Playwright:
- 39 ofrecen opción sin patrón (bareboat)
- 66 solo con patrón
- Rango precios sin patrón: 120-1150€/día
- Media sin patrón: ~499€/día
- Puertos principales: Ibiza Ciudad (60), San Antonio (23), La Savina (11)

## Herramientas / dependencias
- Python 3 + playwright (scraping) + openpyxl (Excel)
- HTML+JS vanilla con Leaflet (mapas), Chart.js, sin framework
- Fuentes: SamBoat (scrapeado), Google Flights, Click&Boat, Booking, Ryanair
