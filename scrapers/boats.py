"""
Scraper de barcos para el viaje a Baleares (Click&Boat).
"""
import os
import sys
import re
from datetime import datetime

from .base import (
    configure_stdout, get_data_dir, build_id_boat,
    make_metadata, print_header, save_json, edit_prompt_generic, load_scrape_params
)

OUTPUT_FILE = os.path.join(get_data_dir(), "barcos.json")

_PARAMS = load_scrape_params()

ISLANDS = _PARAMS.get("islands", [
    {
        "isla": "Ibiza",
        "puertos": ["Marina Ibiza", "Club de Mar Ibiza", "Marina Botafoc", "Port Ibiza", "San Antonio", "Santa Eulalia"],
        "slug": "ibiza"
    },
    {
        "isla": "Menorca",
        "puertos": ["Mahón", "Ciutadella", "Cala'n Bosch", "Fornells"],
        "slug": "menorca"
    },
    {
        "isla": "Mallorca",
        "puertos": ["Palma", "Port Adriano", "Puerto Portals", "Alcudia", "Pollensa", "Andratx"],
        "slug": "mallorca"
    },
    {
        "isla": "Formentera",
        "puertos": ["La Savina"],
        "slug": "formentera"
    },
])

BOAT_TYPES = {
    "velero": "Velero",
    "catamaran": "Catamarán",
    "yate": "Yate a motor",
}


def fetch_playwright_all():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  pip install playwright && playwright install chromium")
        return None

    all_boats = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="es-ES",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        )

        for island in ISLANDS:
            isla = island["isla"]
            slug = island["slug"]
            print(f"  {isla}")

            page = context.new_page()
            page.set_default_timeout(60000)

            try:
                boats = _scrape_clickandboat(page, slug, isla)
                if boats:
                    all_boats.extend(boats)
                    print(f"    -> {len(boats)} barcos")
                else:
                    print(f"    -> sin resultados")
            except Exception as e:
                print(f"    -> error: {e}")

            page.close()

        browser.close()

    return all_boats if all_boats else None


def _scrape_clickandboat(page, slug, isla):
    url = f"https://www.clickandboat.com/es/boat-rental/{slug}?boatType=sailboat&sortBy=price"

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
    except Exception:
        return None

    boats = []
    try:
        page.wait_for_selector('[data-testid="boat-card"]', timeout=20000)
        cards = page.query_selector_all('[data-testid="boat-card"]')

        for card in cards[:20]:
            try:
                name_el = card.query_selector('[data-testid="boat-name"]')
                modelo = name_el.inner_text().strip() if name_el else "Desconocido"
                details = _parse_boat_card(card)

                if details:
                    details.update({
                        "modelo": modelo,
                        "isla": isla,
                        "plataforma": "clickandboat.com",
                        "url": url,
                        "con_patron": False,
                        "id": build_id_boat(isla, modelo, "clickandboat.com"),
                    })
                    boats.append(details)
            except Exception:
                continue

        boats.sort(key=lambda b: b.get("precio_dia_baja", 9999))
    except Exception:
        pass

    return boats


def _parse_boat_card(card):
    details = {}

    try:
        type_el = card.query_selector('[data-testid="boat-type"]')
        if type_el:
            details["tipo"] = type_el.inner_text().strip()
    except Exception:
        details["tipo"] = "Velero"

    try:
        length_el = card.query_selector('[data-testid="boat-length"]')
        if length_el:
            text = length_el.inner_text().strip()
            m = re.search(r'([\d.]+)\s*m', text)
            if m:
                details["eslora_m"] = float(m.group(1))
    except Exception:
        pass

    try:
        cab_el = card.query_selector('[data-testid="boat-capacity"]')
        if cab_el:
            text = cab_el.inner_text().strip()
            m = re.search(r'(\d+)', text)
            if m:
                details["plazas"] = int(m.group(1))
    except Exception:
        pass

    try:
        price_el = card.query_selector('[data-testid="boat-price"]')
        if price_el:
            price_text = price_el.inner_text().strip()
            price = float(re.sub(r'[^\d.,]', '', price_text).replace(',', '.'))
            details["precio_dia_baja"] = price
            details["precio_dia_alta"] = round(price * 1.3, 2)
    except Exception:
        pass

    try:
        loc_el = card.query_selector('[data-testid="boat-location"]')
        if loc_el:
            details["puerto_base"] = loc_el.inner_text().strip()
    except Exception:
        pass

    return details


def generate_urls():
    print("\n=== URLs de Click&Boat para consulta manual ===\n")
    for island in ISLANDS:
        for boat_type_key, boat_type_label in BOAT_TYPES.items():
            url = f"https://www.clickandboat.com/es/boat-rental/{island['slug']}?boatType={boat_type_key}&sortBy=price"
            print(f"{island['isla']} — {boat_type_label}")
            print(f"  {url}\n")


def _get_sample_data():
    return [
        {"id": "ibiza-sun-odyssey-349-cnb", "tipo": "Velero", "modelo": "Sun Odyssey 349", "fabricante": "Jeanneau", "eslora_m": 10.3, "ano": 2020, "camarotes": 3, "plazas": 6, "puerto_base": "Marina Botafoc", "isla": "Ibiza", "precio_dia_alta": 500, "precio_dia_baja": 350, "moneda": "EUR", "extras_dia": "50 (seguro+combustible)", "seguro": "incluido en extras", "fianza": "1000 €", "licencia": "PER o similar", "con_patron": False, "plataforma": "clickandboat.com", "url": "https://www.clickandboat.com/es/boat-rental/ibiza", "disponibilidad": "Sep 2026 disponible", "rating": 4.5},
        {"id": "ibiza-dufour-390-cnb", "tipo": "Velero", "modelo": "Dufour 390", "fabricante": "Dufour", "eslora_m": 11.9, "ano": 2021, "camarotes": 3, "plazas": 8, "puerto_base": "Club de Mar Ibiza", "isla": "Ibiza", "precio_dia_alta": 580, "precio_dia_baja": 400, "moneda": "EUR", "extras_dia": "55 (seguro+combustible)", "seguro": "incluido en extras", "fianza": "1200 €", "licencia": "PER o similar", "con_patron": False, "plataforma": "clickandboat.com", "url": "https://www.clickandboat.com/es/boat-rental/ibiza", "disponibilidad": "Sep 2026 disponible", "rating": 4.7},
        {"id": "ibiza-bavaria-40-cnb", "tipo": "Velero", "modelo": "Bavaria 40", "fabricante": "Bavaria", "eslora_m": 12.5, "ano": 2019, "camarotes": 4, "plazas": 8, "puerto_base": "Marina Ibiza", "isla": "Ibiza", "precio_dia_alta": 650, "precio_dia_baja": 450, "moneda": "EUR", "extras_dia": "60 (seguro+combustible)", "seguro": "incluido en extras", "fianza": "1500 €", "licencia": "PER o similar", "con_patron": False, "plataforma": "clickandboat.com", "url": "https://www.clickandboat.com/es/boat-rental/ibiza", "disponibilidad": "Sep 2026 disponible", "rating": 4.6},
        {"id": "ibiza-oceanis-411-cnb", "tipo": "Velero", "modelo": "Oceanis 41.1", "fabricante": "Beneteau", "eslora_m": 12.4, "ano": 2022, "camarotes": 4, "plazas": 8, "puerto_base": "Port Ibiza", "isla": "Ibiza", "precio_dia_alta": 700, "precio_dia_baja": 480, "moneda": "EUR", "extras_dia": "65 (seguro+combustible)", "seguro": "incluido en extras", "fianza": "1500 €", "licencia": "PER o similar", "con_patron": False, "plataforma": "clickandboat.com", "url": "https://www.clickandboat.com/es/boat-rental/ibiza", "disponibilidad": "Sep 2026 disponible", "rating": 4.8},
        {"id": "ibiza-lagoon-42-cnb", "tipo": "Catamarán", "modelo": "Lagoon 42", "fabricante": "Lagoon", "eslora_m": 12.8, "ano": 2023, "camarotes": 4, "plazas": 10, "puerto_base": "Marina Botafoc", "isla": "Ibiza", "precio_dia_alta": 1200, "precio_dia_baja": 800, "moneda": "EUR", "extras_dia": "100 (seguro+combustible)", "seguro": "incluido en extras", "fianza": "2000 €", "licencia": "PER o similar", "con_patron": False, "plataforma": "clickandboat.com", "url": "https://www.clickandboat.com/es/boat-rental/ibiza", "disponibilidad": "Sep 2026 bajo petición", "rating": 4.9},
        {"id": "menorca-sun-odyssey-349-cnb", "tipo": "Velero", "modelo": "Sun Odyssey 349", "fabricante": "Jeanneau", "eslora_m": 10.3, "ano": 2021, "camarotes": 3, "plazas": 6, "puerto_base": "Mahón", "isla": "Menorca", "precio_dia_alta": 450, "precio_dia_baja": 320, "moneda": "EUR", "extras_dia": "45 (seguro+combustible)", "seguro": "incluido en extras", "fianza": "800 €", "licencia": "PER o similar", "con_patron": False, "plataforma": "clickandboat.com", "url": "https://www.clickandboat.com/es/boat-rental/menorca", "disponibilidad": "Sep 2026 disponible", "rating": 4.4},
        {"id": "mallorca-bavaria-46-cnb", "tipo": "Velero", "modelo": "Bavaria 46", "fabricante": "Bavaria", "eslora_m": 14.0, "ano": 2022, "camarotes": 4, "plazas": 10, "puerto_base": "Palma", "isla": "Mallorca", "precio_dia_alta": 800, "precio_dia_baja": 550, "moneda": "EUR", "extras_dia": "70 (seguro+combustible)", "seguro": "incluido en extras", "fianza": "2000 €", "licencia": "PER o similar", "con_patron": False, "plataforma": "clickandboat.com", "url": "https://www.clickandboat.com/es/boat-rental/mallorca", "disponibilidad": "Sep 2026 bajo petición", "rating": 4.7},
    ]


def main():
    configure_stdout()
    print_header("Scraper de Barcos - Click&Boat")

    if "--auto" in sys.argv:
        print("\nModo automático (Playwright)...")
        boats = fetch_playwright_all()
        if not boats:
            print("\n  No se obtuvieron datos. Usa --urls para generar enlaces manuales.")
            return

        data = {
            "metadata": make_metadata("scrapers/boats.py (Playwright - Click&Boat)"),
            "barcos": boats,
        }
        save_json(OUTPUT_FILE, data)
        print(f"  {len(boats)} barcos guardados")

    elif "--urls" in sys.argv:
        generate_urls()

    elif "--editar" in sys.argv or "-e" in sys.argv:
        edit_prompt_generic(
            OUTPUT_FILE,
            ["barcos"],
            [("precio_dia_baja", "Precio temp. baja (€/día)"), ("precio_dia_alta", "Precio temp. alta (€/día)"), ("extras_dia", "Extras/día")],
            lambda b: f"{b['modelo']} — {b['isla']} — {b.get('puerto_base', '?')}"
        )

    else:
        data = {
            "metadata": {**make_metadata("datos de ejemplo"), "nota": "Ejecutar --auto para datos reales de Click&Boat."},
            "barcos": _get_sample_data(),
        }
        save_json(OUTPUT_FILE, data)


if __name__ == "__main__":
    main()
