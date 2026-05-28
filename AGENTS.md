# Viaje Velero Baleares — Contexto del Proyecto

## ¿Qué es?
Planificación de un viaje en velero sin patrón a Ibiza para 5 personas (3 Valencia, 1 Madrid, 1 Módena/Bolonia). Objetivo: mínimo coste posible.

## Decisión tomada
- **Destino:** Ibiza (IBZ)
- **Fecha:** 31 Ago (noche San Antonio) + 1-3 Sep 2026 (3 días barco)
- **Barco:** Dufour 43 de Toni (Click&Boat).
  14m · 4 cabinas · 6 camas · 2 baños · 2006 (reacondicionado 2017)
  Puerto base: Marina Ibiza · Con o sin patrón
  Oferta: 1.250€ (1-3 Sep) · Fianza 1.000€ · Rating ⭐4.4 (13 opiniones)
  Equipamiento: Paddle, piloto automático, toldo, GPS, ducha exterior, horno
- **Alojamiento 31 Ago:** En San Antonio. 3 opciones:
  - 🥇 Apartamentos San Francisco (~311€, ⭐8.4) 
  - Aparthotel Vibra Club Maritim (~328€, ⭐8.4)
  - Hostal Sunset Ibiza (~385€, ⭐7.6)
- **Coste:** ~588€/pers (vuelos+barco+alojamiento+taxis+comidas)

## Estructura del proyecto (modular)
```
viaje-barco/
├── AGENTS.md                    # Contexto acumulativo del proyecto
├── index.html                   # Redirige a plan-viaje-ibiza.html
├── plan-viaje-ibiza.html        # Plan interactivo (mapa + timeline + chart) — shell thin
├── comparador-barcos.html       # Comparador de barcos — shell thin
├── comparador-vuelos.html       # Comparador de vuelos — shell thin
├── comparador-alojamientos.html # Comparador de alojamientos — shell thin
├── comparador-viaje.html        # Comparador unificado (tabs) — shell thin
├── planeamiento-nautico.md      # Documento de navegación: waypoints, peligros, fondeos
├── requirements.txt             # Python dependencies
├── .env.example
│
├── css/
│   └── shared.css               # CSS compartido: variables, reset, utilidades, componentes
│
├── js/
│   ├── core/
│   │   ├── utils.js             # Utilidades: fechas, horas, colores, helpers
│   │   ├── data-io.js           # Import/export JSON, localStorage edits, workflow status
│   │   └── ui.js                # Componentes UI: edit-in-place, charts, bar charts, buckets
│   ├── components/
│   │   ├── flight-timeline.js   # Timeline de vuelos (gantt horizontal con tooltips)
│   │   └── map.js               # Mapa Leaflet con capas, rutas, marcadores
│   └── pages/
│       ├── plan-viaje.js        # Lógica del plan: mapa, gráfico donut, toggleDay
│       ├── comparador-barcos.js # Filtros, tabla, escenarios, chart (barcos)
│       ├── comparador-vuelos.js # Filtros, timeline, combos, selección (vuelos)
│       ├── comparador-alojamientos.js # Filtros, zonas, cards, tabla (alojamientos)
│       └── comparador-viaje.js  # Tabs unificado con los 3 tipos de datos
│
├── scrapers/
│   ├── __init__.py
│   ├── base.py                  # BaseScraper: CLI, build_id, metadata, edit_prompt
│   ├── boats.py                 # Scraper Click&Boat (——auto, --urls, --editar)
│   ├── boats_samboat.py         # Scraper SamBoat (paginación completa)
│   ├── flights.py               # Scraper Google Flights/Ryanair
│   └── accommodations.py        # Scraper Booking + Airbnb
│
├── scraper_barcos.py            # Entry point thin → scrapers.boats
├── scraper_barcos_samboat.py    # Entry point thin → scrapers.boats_samboat
├── scraper_vuelos.py            # Entry point thin → scrapers.flights
├── scraper_alojamientos.py      # Entry point thin → scrapers.accommodations
│
└── data/
    ├── vuelos.json              # Datos de vuelos scrapeados/importados
    ├── barcos.json              # Datos de barcos scrapeados/importados
    └── alojamientos.json        # Datos de alojamientos scrapeados/importados
```

### Arquitectura
- **HTMLs** son shells finos: estructura + imports → toda la lógica en JS/Python externo
- **CSS compartido** (`css/shared.css`) evita duplicación de estilos entre las 5 páginas
- **JS core** (`js/core/*`): utilidades reutilizables (fechas, charts, edit-in-place, import/export)
- **JS components** (`js/components/*`): componentes complejos (timeline de vuelos, mapa Leaflet)
- **JS pages** (`js/pages/*`): lógica específica de cada página
- **scrapers package** (`scrapers/`): `base.py` con CLI compartido + módulos por fuente
- **scraper_*.py**: entry points thin que delegan al package

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

## Costes totales (~588 €/pers)
| Concepto | Coste | ~/pers |
|----------|:-----:|:------:|
| Vuelos (5 pers) | 768 € | 154 € |
| Barco (3d + gasoil + amarres) | 1.345 € | 269 € |
| Alojamiento 31 Ago | 311 € | 62 € |
| Taxis/transportes | 141 € | 28 € |
| Comidas + provisiones | 375 € | 75 € |
| **Total grupo** | **~2.940 €** | **~588 €** |

### Provisiones barco (Mercadona, ~100€ total)
Desayunos: leche, cereales, café, pan, mermelada, galletas, fruta
Comidas: embutido, queso, tomates, atún, paté, ensaladas, pasta, arroz, huevos
Snacks/bebidas: frutos secos, patatas, chocolate, agua, cervezas, refrescos, hielo
Básicos: sal/aceite/vinagre, platos/vasos, bolsas basura

### Taxis confirmados
- Bus L10 aeropuerto→centro: 3,50€/pers (VLC)
- Taxi centro→San Antonio: 25€ (VLC 3pers)
- Taxi aeropuerto→San Antonio: 20€ (Nereida) + 20€ (Alberto)
- Taxi San Antonio→Marina Ibiza: 35€ (5pers)
- Taxi Marina Ibiza→Aeropuerto: 30€ (5pers)

### Fondo común recomendado: ~100€/pers
Gasoil 35€ + amarres 60€ + provisiones 100€ + taxis compartidos 140€ = ~515€ ÷ 5
Fianza 1.000€ reembolsable a dividir entre todos (~200€/pers devueltos)

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

## Barco confirmado: Dufour 43 de Toni ✅
- **Plataforma:** Click&Boat
- **Url:** https://www.clickandboat.com/es/alquiler-barcos/ibiza/velero/dufour-43-bp1q8q
- **Oferta:** 1.250€ (1-3 Sep 2026)
- **Check-in:** 10:00 · **Check-out:** 18:00
- **Fianza:** 1.000€
- **Puerto base:** Marina Ibiza
- **Con/sin patrón:** Sí, sin licencia requerida
- **Características:** 14m · 4 cabinas · 6 camas · 2 baños · 2006 (reacond. 2017)
- **Equipamiento:** Paddle board, piloto automático, toldo, GPS, ducha exterior, horno, plataforma baño

## Herramientas / dependencias
- Python 3 + playwright (scraping) + openpyxl (Excel)
- HTML+JS vanilla con Leaflet (mapas), Chart.js, sin framework
- Fuentes: SamBoat (scrapeado), Google Flights, Click&Boat, Booking, Ryanair
