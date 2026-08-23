# Viaje Velero Baleares — Contexto del Proyecto

## ¿Qué es?
Planificación náutica de un viaje en velero sin patrón a Ibiza y Formentera (5 personas, 1-3 Sep 2026). El resto del viaje (vuelos, alojamiento, comidas, costes) está cerrado y fuera del ámbito de este proyecto.

## Decisión tomada
- **Destino:** Ibiza + Formentera · **Fecha:** 31 Ago (noche San Antonio) + 1-3 Sep 2026 (3 días barco)
- **Barco:** Dufour 43 de Toni (Click&Boat) · oferta 1.250€ (1-3 Sep) · check-in 10:00 · check-out 18:00 · fianza 1.000€
- **Ruta:** Formentera primero, 2 noches fondeado, Es Vedrà al atardecer · ~47 MN totales

## Ruta navegación (3 días) — REVISADA: Formentera primero, 2 noches fondeado
| Día | Ruta | MN | Pernocta |
|-----|------|:--:|----------|
| Mar 1 Sep | Puerto → Es Freus (Freu Grande) → Espalmador/Illetes | ~11.5 | Fondeo/boya Espalmador (gratis/~20€) |
| Mié 2 Sep | Illetes → (opc. Cala Saona) → Freu Grande → Cala d'Hort → Porroig | ~15 | Fondeo Porroig (gratis) |
| Jue 3 Sep | Porroig → Cala Comte → Puerto (check-out 18:00) | ~17 | Vuelta a casa |

Fondeos gratis: Espalmador, Illetes, Cala Saona, Cala d'Hort, Porroig, Cala Comte.
Es Freus: **solo Freu Grande** (balizado, 6-8.5 m, pasar al N de la torrebaliza del bajo d'en Pou). No usar Freu Mediano/Chico.
Zonas de peligro: Bajo Caragoler, L'Esponja (S Es Vedrà), Roca sa Gorra, bajo d'en Pou, corrientes Es Freus.

## Barco confirmado: Dufour 43 de Toni ✅
- **Plataforma:** Click&Boat
- **Url:** https://www.clickandboat.com/es/alquiler-barcos/ibiza/velero/dufour-43-bp1q8q
- **Oferta:** 1.250€ (1-3 Sep 2026)
- **Check-in:** 10:00 · **Check-out:** 18:00
- **Fianza:** 1.000€
- **Puerto base:** Marina Ibiza
- **Con/sin patrón:** Sí, sin licencia requerida
- **Características:** 14m · 4 cabinas · 6 camas · 2 baños · 2006 (reacond. 2017) · calado 1.8m · motor 25CV · ~80L gasoil · 5-6 nudos crucero · 1.5-2L/h
- **Equipamiento:** Paddle board, piloto automático, toldo, GPS, ducha exterior, horno, plataforma baño
- **⚠️ Verificar con Toni:** auxiliar a bordo (necesario para bajar a Illetes/Espalmador/Comte)

## Pendientes antes del viaje (registrado 23 Ago)
- 🔴 **Preguntar a Toni (Click&Boat) antes de reservar:** 1) permiso de navegación a Formentera, 2) auxiliar a bordo (imprescindible para bajar a Illetes/Espalmador/Comte), 3) política de fondeo nocturno (seguro). Sin estas 3 confirmaciones no se puede cerrar la ruta Formentera.
- 🟡 **Reservar boya ecológica S'Espalmador** (noche 1, ~20€) en marinaibiza.com/eco-puerto/fondeos — fondeo nocturno en Ses Salines solo en zonas habilitadas.
- 🟡 **Parte meteorológico antes del 31 Ago:** fondeo nocturno solo con vientos térmicos ligeros. Si Llevant/mar de fondo → plan B: noche 1 Marina La Savina, noche 2 Marina Ibiza (amarre).
- 🟢 **Cruzar Es Freus solo por el Freu Grande** (balizado 6-8.5m, pasar al N de la torrebaliza del bajo d'en Pou) · mar en calma y de día · vigilar tráfico de ferris.
- 🟢 **Navionics:** descargar cartas de Es Freus/Formentera + verificar balizas antes de salir.

## Estructura del proyecto (módulo náutico)
```
viaje-barco/
├── AGENTS.md                    # Contexto acumulativo del proyecto
├── index.html                   # Redirige a html/plan-viaje-ibiza.html
├── planeamiento-nautico.md      # Documento de navegación: waypoints, peligros, fondeos
│
├── html/
│   └── plan-viaje-ibiza.html    # Página náutica: mapa + planeamiento + timeline
│
├── css/
│   └── shared.css               # CSS compartido
│
└── js/
    └── pages/
        └── plan-viaje.js        # Lógica del plan: mapa Leaflet + rutas + peligros
```

## Herramientas / dependencias
- HTML+JS vanilla con Leaflet (mapas), sin framework
- Fuentes: derrotero masmar (Es Freus), marinaibiza.com (boyas), Navionics/Windy (parte)