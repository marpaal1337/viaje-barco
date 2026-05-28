"""
Scraper de vuelos para el viaje a Baleares.
"""
import os
import sys
import re
from datetime import datetime

from .base import (
    configure_stdout, get_data_dir, build_id_flight,
    make_metadata, print_header, save_json, edit_prompt_generic
)

OUTPUT_FILE = os.path.join(get_data_dir(), "vuelos.json")

ROUTES = [
    ("VLC", "IBZ", "Valencia", "Ibiza"),
    ("MAD", "IBZ", "Madrid", "Ibiza"),
    ("BLQ", "IBZ", "Bolonia", "Ibiza"),
    ("VLC", "MAH", "Valencia", "Menorca"),
    ("MAD", "MAH", "Madrid", "Menorca"),
    ("BLQ", "MAH", "Bolonia", "Menorca"),
]

DATES = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"]


def normalize_flights(flights, origin_name, dest_name, tipo):
    for f in flights:
        f["id"] = build_id_flight(f["origen"]["codigo"], f["destino"]["codigo"],
                                   f["aerolinea"], f["fecha"], f["salida"])
        f["origen"]["nombre"] = origin_name
        f["destino"]["nombre"] = dest_name
        f["tipo"] = tipo
    return flights


def fetch_playwright_all():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  pip install playwright && playwright install chromium")
        return None

    all_flights = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="es-ES",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        )

        for origin, dest, origin_name, dest_name in ROUTES:
            for date_str in DATES:
                tipo = "vuelta" if origin in ("IBZ", "MAH") else "ida"
                print(f"  {origin}->{dest} {date_str} ({tipo})")

                page = context.new_page()
                page.set_default_timeout(45000)

                try:
                    flights = _scrape_ryanair(page, origin, dest, date_str)
                    if flights:
                        flights = normalize_flights(flights, origin_name, dest_name, tipo)
                        all_flights.extend(flights)
                        print(f"    -> {len(flights)} vuelos")
                    else:
                        print(f"    -> sin resultados")
                except Exception as e:
                    print(f"    -> error: {e}")

                page.close()

        browser.close()

    return all_flights if all_flights else None


def _scrape_ryanair(page, origin, dest, date_str):
    url = f"https://www.ryanair.com/es/es/trip/flights/select?adults=1&dateOut={date_str}&originIata={origin}&destinationIata={dest}"

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
    except Exception:
        return None

    flights = []
    try:
        page.wait_for_selector('[data-e2e="flight-card"]', timeout=15000)
        cards = page.query_selector_all('[data-e2e="flight-card"]')

        for card in cards[:8]:
            try:
                time_els = card.query_selector_all('[data-e2e="time"]')
                dep = time_els[0].inner_text().strip() if len(time_els) > 0 else ""
                arr = time_els[1].inner_text().strip() if len(time_els) > 1 else ""

                price_el = card.query_selector('[data-e2e="price"]')
                price = 0
                if price_el:
                    price_text = price_el.inner_text().strip()
                    price = float(re.sub(r'[^\d.,]', '', price_text).replace(',', '.'))

                duration_el = card.query_selector('[data-e2e="duration"]')
                duration = 0
                if duration_el:
                    dur_text = duration_el.inner_text()
                    m = re.match(r'(?:(\d+)h)?\s*(?:(\d+)m)?', dur_text)
                    duration = (int(m.group(1)) * 60 if m and m.group(1) else 0) + (int(m.group(2)) if m and m.group(2) else 0)

                flight_no_el = card.query_selector('[data-e2e="flight-number"]')
                flight_no = flight_no_el.inner_text().strip() if flight_no_el else "FR"

                flights.append({
                    "aerolinea": "Ryanair",
                    "vuelo": flight_no,
                    "origen": {"codigo": origin, "nombre": ""},
                    "destino": {"codigo": dest, "nombre": ""},
                    "fecha": date_str,
                    "salida": dep,
                    "llegada": arr,
                    "duracion_min": duration,
                    "precio_eur": price,
                    "equipaje": "solo mano",
                    "escalas": 0,
                    "tipo": "ida",
                    "url": url,
                })
            except Exception:
                continue
    except Exception:
        pass

    flights.sort(key=lambda f: f["precio_eur"])
    return flights


def generate_urls():
    print("\n=== URLs de Google Flights para consulta manual ===\n")
    for origin, dest, origin_name, dest_name in ROUTES:
        for date_str in DATES:
            tipo = "vuelta" if origin in ("IBZ", "MAH") else "ida"
            gf_url = f"https://www.google.com/travel/flights?q=Flights+to+{dest}+from+{origin}+on+{date_str}&curr=EUR"
            print(f"{origin}->{dest} {date_str} ({tipo})")
            print(f"  {gf_url}\n")


def build_combinations(all_flights):
    ida = [f for f in all_flights if f["tipo"] == "ida"]
    vuelta = [f for f in all_flights if f["tipo"] == "vuelta"]
    combos = []
    for f in ida:
        dest = f["destino"]["codigo"]
        returns = [r for r in vuelta if r["origen"]["codigo"] == dest and r["destino"]["codigo"] == f["origen"]["codigo"]]
        for r in returns:
            total = round(f["precio_eur"] + r["precio_eur"], 2)
            combos.append({
                "persona": f"{f['origen']['codigo']}→{dest}",
                "origen": f["origen"]["codigo"],
                "origen_nombre": f["origen"]["nombre"],
                "ida_id": f["id"],
                "vuelta_id": r["id"],
                "precio_total": total,
            })
    return combos


def main():
    configure_stdout()
    print_header("Scraper de Vuelos - Viaje Baleares")

    if "--auto" in sys.argv:
        print("\nModo automático (Playwright)...")
        flights = fetch_playwright_all()
        if not flights:
            print("\n  No se obtuvieron datos. Usa --urls para generar enlaces manuales.")
            return

        data = {
            "metadata": make_metadata("scrapers/flights.py (Playwright)"),
            "alternativas": flights,
            "combinaciones": build_combinations(flights),
        }
        save_json(OUTPUT_FILE, data)
        print(f"  {len(flights)} vuelos guardados")

    elif "--urls" in sys.argv:
        generate_urls()

    elif "--editar" in sys.argv or "-e" in sys.argv:
        edit_prompt_generic(
            OUTPUT_FILE,
            ["alternativas"],
            [("precio_eur", "Precio (EUR)")],
            lambda f: f"{f['aerolinea']} {f['origen']['codigo']}->{f['destino']['codigo']} {f['fecha']} {f['salida']}-{f['llegada']}"
        )

    else:
        print("""
  Uso:
    python -m scrapers.flights --auto      # Scraping automático (Playwright)
    python -m scrapers.flights --urls      # Genera URLs de Google Flights
    python -m scrapers.flights --editar    # Edita precios manualmente
""")


if __name__ == "__main__":
    main()
