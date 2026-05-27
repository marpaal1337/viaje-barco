"""
Scraper de barcos para el viaje a Baleares.

Modo automático (Playwright):
  pip install playwright && playwright install chromium
  python scraper_barcos.py --auto

Modo manual (genera URLs de Click&Boat para rellenar):
  python scraper_barcos.py --urls
  # Abre cada URL, apunta datos, luego:
  python scraper_barcos.py --editar
"""

import os
import json
import sys
import re
import webbrowser
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "barcos.json")

# Islas y puertos base objetivo
ISLANDS = [
    {
        "isla": "Ibiza",
        "puertos": [
            "Marina Ibiza", "Club de Mar Ibiza", "Marina Botafoc",
            "Port Ibiza", "San Antonio", "Santa Eulalia"
        ],
        "slug": "ibiza"
    },
    {
        "isla": "Menorca",
        "puertos": [
            "Mahón", "Ciutadella", "Cala'n Bosch", "Fornells"
        ],
        "slug": "menorca"
    },
    {
        "isla": "Mallorca",
        "puertos": [
            "Palma", "Port Adriano", "Puerto Portals", "Alcudia",
            "Pollensa", "Andratx"
        ],
        "slug": "mallorca"
    },
    {
        "isla": "Formentera",
        "puertos": [
            "La Savina"
        ],
        "slug": "formentera"
    },
]

BOAT_TYPES = {
    "velero": "Velero",
    "catamaran": "Catamarán",
    "yate": "Yate a motor",
}

# Temporadas con rangos de precio
SEASONS = {
    "baja": {"label": "Temporada baja", "months": "Oct-Abr"},
    "media": {"label": "Temporada media", "months": "May, Jun, Sep"},
    "alta": {"label": "Temporada alta", "months": "Jul-Ago"},
}


def build_id(isla, modelo, plataforma):
    code = "".join(w[0].upper() for w in modelo.split() if w)
    platform_code = "".join(c[0] for c in plataforma.split(".") if c)
    return f"{isla.lower()}-{code.lower()}-{platform_code.lower()}"


def slugify(text):
    return re.sub(r"[^a-z0-9-]", "", text.lower().replace(" ", "-"))


# ── Modo 1: Playwright (automático) ──

def fetch_playwright_all():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  pip install playwright && playwright install chromium")
        return None

    all_boats = []
    total = len(ISLANDS)
    count = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="es-ES",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        )

        for island in ISLANDS:
            count += 1
            isla = island["isla"]
            slug = island["slug"]
            print(f"[{count}/{total}] {isla}")

            page = context.new_page()
            page.set_default_timeout(60000)

            try:
                boats = _scrape_clickandboat(page, slug, isla)
                if boats:
                    all_boats.extend(boats)
                    print(f"  -> {len(boats)} barcos")
                else:
                    print(f"  -> sin resultados")
            except Exception as e:
                print(f"  -> error: {e}")

            page.close()

        browser.close()

    return all_boats if all_boats else None


def _scrape_clickandboat(page, slug, isla):
    """Scrapea Click&Boat para una isla (veleros, sin patrón)."""
    url = (
        f"https://www.clickandboat.com/es/boat-rental/{slug}"
        f"?boatType=sailboat"
        f"&sortBy=price"
    )

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
    except Exception:
        return None

    boats = []
    try:
        # Esperar a que carguen las tarjetas de barco
        page.wait_for_selector('[data-testid="boat-card"]', timeout=20000)
        cards = page.query_selector_all('[data-testid="boat-card"]')

        for card in cards[:20]:
            try:
                # Intentar extraer datos de cada tarjeta
                name_el = card.query_selector('[data-testid="boat-name"]')
                modelo = name_el.inner_text().strip() if name_el else "Desconocido"

                # Extraer detalles del listado
                details = _parse_boat_card(card)

                if details:
                    details.update({
                        "modelo": modelo,
                        "isla": isla,
                        "plataforma": "clickandboat.com",
                        "url": url,
                        "con_patron": False,
                    })
                    details["id"] = build_id(isla, modelo, "clickandboat.com")
                    boats.append(details)
            except Exception:
                continue

        boats.sort(key=lambda b: b.get("precio_dia_baja", 9999))
    except Exception:
        pass

    return boats


def _parse_boat_card(card):
    """Parsea los detalles visibles de una tarjeta de barco en Click&Boat."""
    details = {}

    try:
        # Tipo de barco (badge)
        type_el = card.query_selector('[data-testid="boat-type"]')
        if type_el:
            details["tipo"] = type_el.inner_text().strip()
    except Exception:
        details["tipo"] = "Velero"

    try:
        # Eslora
        length_el = card.query_selector('[data-testid="boat-length"]')
        if length_el:
            text = length_el.inner_text().strip()
            m = re.search(r'([\d.]+)\s*m', text)
            if m:
                details["eslora_m"] = float(m.group(1))
    except Exception:
        pass

    try:
        # Plazas
        cab_el = card.query_selector('[data-testid="boat-capacity"]')
        if cab_el:
            text = cab_el.inner_text().strip()
            m = re.search(r'(\d+)', text)
            if m:
                details["plazas"] = int(m.group(1))
    except Exception:
        pass

    try:
        # Precio
        price_el = card.query_selector('[data-testid="boat-price"]')
        if price_el:
            price_text = price_el.inner_text().strip()
            price = float(re.sub(r'[^\d.,]', '', price_text).replace(',', '.'))
            details["precio_dia_baja"] = price
            # Estimación para temporada alta (~30% más)
            details["precio_dia_alta"] = round(price * 1.3, 2)
    except Exception:
        pass

    try:
        # Puerto base
        loc_el = card.query_selector('[data-testid="boat-location"]')
        if loc_el:
            details["puerto_base"] = loc_el.inner_text().strip()
    except Exception:
        pass

    return details


# ── Modo 2: URLs manuales ──

def generate_urls():
    print("\n=== URLs de Click&Boat para consulta manual ===\n")
    urls = []
    for island in ISLANDS:
        for boat_type_key, boat_type_label in BOAT_TYPES.items():
            url = (
                f"https://www.clickandboat.com/es/boat-rental/{island['slug']}"
                f"?boatType={boat_type_key}"
                f"&sortBy=price"
            )
            urls.append((island["isla"], boat_type_label, url))
            print(f"\n{island['isla']} — {boat_type_label}")
            print(f"  {url}")

    print(f"\nUrl directa para veleros sin patrón en Baleares:")
    print(f"  https://www.clickandboat.com/es/boat-rental/ibiza?boatType=sailboat&sortBy=price")
    print(f"  https://www.clickandboat.com/es/boat-rental/menorca?boatType=sailboat&sortBy=price")

    print(f"\nOtras plataformas:")
    print(f"  Nautal: https://www.nautal.com/es/alquiler-barco/ibiza?tipo=velero")
    print(f"  Samboat: https://www.samboat.es/alquiler-barco/ibiza")

    print(f"\nTotal: {len(urls)} combinaciones")
    return urls


# ── Modo 3: Editar JSON manualmente ──

def edit_prompt():
    if not os.path.exists(OUTPUT_FILE):
        print(f"No existe {OUTPUT_FILE}. Ejecuta primero sin args para crear plantilla.")
        return

    with open(OUTPUT_FILE, encoding="utf-8") as f:
        data = json.load(f)

    boats = data.get("barcos", [])
    print(f"\nEditando {len(boats)} barcos. Deja vacío para mantener valor actual.\n")

    for i, b in enumerate(boats):
        print(f"[{i+1}/{len(boats)}] {b['modelo']} — {b['isla']} — {b.get('puerto_base', '?')}")
        current = b.get("precio_dia_baja", 0)
        inp = input(f"  Precio temp. baja (actual: {current} €/día) -> Nuevo: ").strip()
        if inp:
            try:
                b["precio_dia_baja"] = float(inp.replace(",", "."))
                print(f"  OK")
            except ValueError:
                print(f"  Mantenido: {current}")

        current_alta = b.get("precio_dia_alta", 0)
        inp = input(f"  Precio temp. alta (actual: {current_alta} €/día) -> Nuevo: ").strip()
        if inp:
            try:
                b["precio_dia_alta"] = float(inp.replace(",", "."))
                print(f"  OK")
            except ValueError:
                print(f"  Mantenido: {current_alta}")

        extras = b.get("extras_dia", "")
        inp = input(f"  Extras/día (actual: {extras}) -> Nuevo: ").strip()
        if inp:
            b["extras_dia"] = inp

        disp = b.get("disponibilidad", "")
        inp = input(f"  Disponibilidad (actual: {disp}) -> Nueva: ").strip()
        if inp:
            b["disponibilidad"] = inp

        print()

    data["metadata"]["generado"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    data["metadata"]["fuente"] = "edicion manual"

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Guardado: {OUTPUT_FILE} ({len(boats)} barcos)")


# ── Main ──

def main():
    print("=" * 60)
    print("  Scraper de Barcos - Viaje Baleares")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)

    if "--auto" in sys.argv:
        print("\nModo automático (Playwright)...")
        boats = fetch_playwright_all()
        if not boats:
            print("\n  No se obtuvieron datos. Usa --urls para generar enlaces manuales.")
            return

        data = {
            "metadata": {
                "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "fuente": "scraper_barcos.py (Playwright - Click&Boat)",
            },
            "barcos": boats,
        }

        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"\n  {len(boats)} barcos guardados en {OUTPUT_FILE}")

    elif "--urls" in sys.argv:
        generate_urls()

    elif "--editar" in sys.argv or "-e" in sys.argv:
        edit_prompt()

    else:
        # Sin args: genera plantilla JSON con datos de ejemplo
        sample_boats = _get_sample_data()
        data = {
            "metadata": {
                "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "fuente": "datos de ejemplo",
                "nota": "Ejecutar scraper_barcos.py --auto para actualizar con datos reales de Click&Boat.",
            },
            "barcos": sample_boats,
        }
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n  Plantilla generada: {OUTPUT_FILE} ({len(sample_boats)} barcos de ejemplo)")
        print()
        print(__doc__)


def _get_sample_data():
    """Datos de ejemplo representativos del mercado balear."""
    return [
        {
            "id": "ibiza-sun-odyssey-349-cnb",
            "tipo": "Velero",
            "modelo": "Sun Odyssey 349",
            "fabricante": "Jeanneau",
            "eslora_m": 10.3,
            "ano": 2020,
            "camarotes": 3,
            "plazas": 6,
            "puerto_base": "Marina Botafoc",
            "isla": "Ibiza",
            "precio_dia_alta": 500,
            "precio_dia_baja": 350,
            "moneda": "EUR",
            "extras_dia": "50 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "1000 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/ibiza",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.5,
        },
        {
            "id": "ibiza-dufour-390-cnb",
            "tipo": "Velero",
            "modelo": "Dufour 390",
            "fabricante": "Dufour",
            "eslora_m": 11.9,
            "ano": 2021,
            "camarotes": 3,
            "plazas": 8,
            "puerto_base": "Club de Mar Ibiza",
            "isla": "Ibiza",
            "precio_dia_alta": 580,
            "precio_dia_baja": 400,
            "moneda": "EUR",
            "extras_dia": "55 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "1200 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/ibiza",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.7,
        },
        {
            "id": "ibiza-bavaria-40-cnb",
            "tipo": "Velero",
            "modelo": "Bavaria 40",
            "fabricante": "Bavaria",
            "eslora_m": 12.5,
            "ano": 2019,
            "camarotes": 4,
            "plazas": 8,
            "puerto_base": "Marina Ibiza",
            "isla": "Ibiza",
            "precio_dia_alta": 650,
            "precio_dia_baja": 450,
            "moneda": "EUR",
            "extras_dia": "60 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "1500 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/ibiza",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.6,
        },
        {
            "id": "ibiza-oceanis-411-cnb",
            "tipo": "Velero",
            "modelo": "Oceanis 41.1",
            "fabricante": "Beneteau",
            "eslora_m": 12.4,
            "ano": 2022,
            "camarotes": 4,
            "plazas": 8,
            "puerto_base": "Port Ibiza",
            "isla": "Ibiza",
            "precio_dia_alta": 700,
            "precio_dia_baja": 480,
            "moneda": "EUR",
            "extras_dia": "65 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "1500 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/ibiza",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.8,
        },
        {
            "id": "ibiza-lagoon-42-cnb",
            "tipo": "Catamarán",
            "modelo": "Lagoon 42",
            "fabricante": "Lagoon",
            "eslora_m": 12.8,
            "ano": 2023,
            "camarotes": 4,
            "plazas": 10,
            "puerto_base": "Marina Botafoc",
            "isla": "Ibiza",
            "precio_dia_alta": 1200,
            "precio_dia_baja": 800,
            "moneda": "EUR",
            "extras_dia": "100 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "2000 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/ibiza",
            "disponibilidad": "Sep 2026 bajo petición",
            "rating": 4.9,
        },
        {
            "id": "menorca-sun-odyssey-349-cnb",
            "tipo": "Velero",
            "modelo": "Sun Odyssey 349",
            "fabricante": "Jeanneau",
            "eslora_m": 10.3,
            "ano": 2021,
            "camarotes": 3,
            "plazas": 6,
            "puerto_base": "Mahón",
            "isla": "Menorca",
            "precio_dia_alta": 450,
            "precio_dia_baja": 320,
            "moneda": "EUR",
            "extras_dia": "45 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "800 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/menorca",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.4,
        },
        {
            "id": "menorca-bavaria-37-cnb",
            "tipo": "Velero",
            "modelo": "Bavaria 37",
            "fabricante": "Bavaria",
            "eslora_m": 11.3,
            "ano": 2020,
            "camarotes": 3,
            "plazas": 6,
            "puerto_base": "Mahón",
            "isla": "Menorca",
            "precio_dia_alta": 480,
            "precio_dia_baja": 350,
            "moneda": "EUR",
            "extras_dia": "50 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "1000 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/menorca",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.3,
        },
        {
            "id": "menorca-dufour-382-cnb",
            "tipo": "Velero",
            "modelo": "Dufour 382",
            "fabricante": "Dufour",
            "eslora_m": 11.5,
            "ano": 2022,
            "camarotes": 3,
            "plazas": 8,
            "puerto_base": "Ciutadella",
            "isla": "Menorca",
            "precio_dia_alta": 520,
            "precio_dia_baja": 380,
            "moneda": "EUR",
            "extras_dia": "55 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "1200 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/menorca",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.6,
        },
        {
            "id": "menorca-oceanis-381-cnb",
            "tipo": "Velero",
            "modelo": "Oceanis 38.1",
            "fabricante": "Beneteau",
            "eslora_m": 11.5,
            "ano": 2021,
            "camarotes": 3,
            "plazas": 8,
            "puerto_base": "Mahón",
            "isla": "Menorca",
            "precio_dia_alta": 500,
            "precio_dia_baja": 360,
            "moneda": "EUR",
            "extras_dia": "50 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "1000 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/menorca",
            "disponibilidad": "Sep 2026 disponible",
            "rating": 4.5,
        },
        {
            "id": "mallorca-bavaria-46-cnb",
            "tipo": "Velero",
            "modelo": "Bavaria 46",
            "fabricante": "Bavaria",
            "eslora_m": 14.0,
            "ano": 2022,
            "camarotes": 4,
            "plazas": 10,
            "puerto_base": "Palma",
            "isla": "Mallorca",
            "precio_dia_alta": 800,
            "precio_dia_baja": 550,
            "moneda": "EUR",
            "extras_dia": "70 (seguro+combustible)",
            "seguro": "incluido en extras",
            "fianza": "2000 €",
            "licencia": "PER o similar",
            "con_patron": False,
            "plataforma": "clickandboat.com",
            "url": "https://www.clickandboat.com/es/boat-rental/mallorca",
            "disponibilidad": "Sep 2026 bajo petición",
            "rating": 4.7,
        },
    ]


if __name__ == "__main__":
    main()
