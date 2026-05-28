"""
Scraper de alojamientos para el viaje a Baleares.
"""
import os
import sys
import re
from datetime import datetime

from .base import (
    configure_stdout, get_data_dir, build_id_accommodation,
    make_metadata, print_header, save_json, edit_prompt_generic, load_scrape_params
)

OUTPUT_FILE = os.path.join(get_data_dir(), "alojamientos.json")

_PARAMS = load_scrape_params()

DESTINATIONS = _PARAMS.get("destinations", [
    {"ciudad": "Ibiza", "zona": "Ibiza", "termino": "Ibiza", "coords": {"lat": 38.9067, "lng": 1.4206}},
    {"ciudad": "Eivissa (centro)", "zona": "Eivissa", "termino": "Eivissa", "coords": {"lat": 38.9085, "lng": 1.4333}},
    {"ciudad": "Ibiza - Marina", "zona": "Marina Ibiza", "termino": "Marina Ibiza", "coords": {"lat": 38.9093, "lng": 1.4476}},
])

CHECKIN = _PARAMS.get("checkin", "2026-08-31")
CHECKOUT = _PARAMS.get("checkout", "2026-09-01")
ADULTOS = _PARAMS.get("adultos", 5)
MENORES = _PARAMS.get("menores", 0)

SERVICES_MAP = {
    "wifi": "WiFi", "piscina": "Piscina", "parking": "Parking",
    "aire acondicionado": "Aire acondicionado", "cocina": "Cocina",
    "lavadora": "Lavadora", "balcon": "Balcón", "terraza": "Terraza",
    "desayuno": "Desayuno incluido", "gimnasio": "Gimnasio",
    "playa": "Cerca de la playa", "admitemascotas": "Admite mascotas",
    "tv": "TV", "jacuzzi": "Jacuzzi",
}


def format_price(text):
    nums = re.findall(r'[\d.,]+', text.replace(',', '.'))
    for n in nums:
        try:
            return round(float(n), 2)
        except ValueError:
            continue
    return None


def extract_services(texts):
    found = []
    for t in texts:
        t_lower = t.lower()
        for key, label in SERVICES_MAP.items():
            if key in t_lower and label not in found:
                found.append(label)
    return found


def normalize_accommodations(items, source, ciudad):
    for item in items:
        item["id"] = build_id_accommodation(item.get("nombre", ""), source, ciudad)
        item["ciudad"] = ciudad
        item["fuente"] = source
    return items


def fetch_playwright_all():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  pip install playwright && playwright install chromium")
        return None

    all_items = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="es-ES",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        )

        for dest in DESTINATIONS:
            ciudad = dest["ciudad"]
            termino = dest["termino"]
            print(f"  {ciudad}")

            page = context.new_page()
            page.set_default_timeout(60000)

            try:
                print("    Booking.com...")
                booking = _scrape_booking(page, termino)
                if booking:
                    booking = normalize_accommodations(booking, "booking", ciudad)
                    all_items.extend(booking)
                    print(f"    -> {len(booking)} alojamientos")
                else:
                    print("    -> sin resultados")
            except Exception as e:
                print(f"    -> error Booking.com: {e}")

            page.close()

        for dest in DESTINATIONS:
            ciudad = dest["ciudad"]
            termino = dest["termino"]

            page = context.new_page()
            page.set_default_timeout(60000)

            try:
                print(f"    Airbnb ({ciudad})...")
                airbnb = _scrape_airbnb(page, termino)
                if airbnb:
                    airbnb = normalize_accommodations(airbnb, "airbnb", ciudad)
                    all_items.extend(airbnb)
                    print(f"    -> {len(airbnb)} alojamientos")
                else:
                    print("    -> sin resultados")
            except Exception as e:
                print(f"    -> error Airbnb: {e}")

            page.close()

        browser.close()

    return all_items if all_items else None


def _scrape_booking(page, termino):
    url = f"https://www.booking.com/searchresults.es.html?ss={termino}&checkin={CHECKIN}&checkout={CHECKOUT}&group_adults={ADULTOS}&group_children={MENORES}&no_rooms=1&order=distance_from_search"

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
        try:
            cookie_btn = page.query_selector('[id^="onetrust-accept"]')
            if cookie_btn:
                cookie_btn.click()
                page.wait_for_timeout(1500)
        except Exception:
            pass
    except Exception as e:
        print(f"    goto error: {e}")
        return None

    items = []
    try:
        page.wait_for_selector('[data-testid="property-card"]', timeout=20000)
        cards = page.query_selector_all('[data-testid="property-card"]')
        print(f"    tarjetas encontradas: {len(cards)}")

        for card in cards[:15]:
            try:
                name_el = card.query_selector('[data-testid="title"]')
                name = name_el.inner_text().strip() if name_el else "Sin nombre"

                price_el = card.query_selector('[data-testid="price-and-discounted-price"], [data-testid="price-for-x-nights"]')
                price = None
                if price_el:
                    price = format_price(price_el.inner_text())
                if not price:
                    price_el2 = card.query_selector('span[data-testid="price-for-x-nights"]')
                    if price_el2:
                        price = format_price(price_el2.inner_text())

                url_el = card.query_selector('a[data-testid="title-link"]')
                href = ""
                if url_el:
                    href = url_el.get_attribute("href") or ""
                    if href and not href.startswith("http"):
                        href = "https://www.booking.com" + href

                rating_el = card.query_selector('[data-testid="review-score"]')
                rating = None
                rating_text = None
                if rating_el:
                    text = rating_el.inner_text().strip()
                    nums = re.findall(r'[\d.,]+', text)
                    if nums:
                        try:
                            rating = float(nums[-1].replace(",", "."))
                        except ValueError:
                            pass
                    rating_text = text[:80]

                location_el = card.query_selector('[data-testid="distance"]')
                location = location_el.inner_text().strip() if location_el else ""

                service_els = card.query_selector_all('[data-testid="facility-badge"]')
                services = [s.inner_text().strip() for s in service_els] if service_els else []

                items.append({
                    "nombre": name,
                    "precio_total_eur": price,
                    "url": href,
                    "puntuacion": rating,
                    "puntuacion_texto": rating_text,
                    "ubicacion": location,
                    "servicios": services,
                    "noche": CHECKIN,
                    "noche_texto": f"{CHECKIN} -> {CHECKOUT} (1 noche)",
                })
            except Exception as e:
                print(f"    error en tarjeta: {e}")
                continue
    except Exception as e:
        print(f"    error general: {e}")

    items.sort(key=lambda x: x["precio_total_eur"] if x["precio_total_eur"] is not None else float('inf'))
    return items


def _scrape_airbnb(page, termino):
    url = f"https://www.airbnb.es/s/{termino}/homes?checkin={CHECKIN}&checkout={CHECKOUT}&adults={ADULTOS}&children={MENORES}&price_max=1000&price_min=30"

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
        try:
            cookie_btn = page.query_selector('button[data-testid="accept-btn"]')
            if not cookie_btn:
                cookie_btn = page.query_selector('[data-testid="cypress-headernav-cookies"] button')
            if cookie_btn:
                cookie_btn.click()
                page.wait_for_timeout(1500)
        except Exception:
            pass
    except Exception as e:
        print(f"    goto error: {e}")
        return None

    items = []
    try:
        page.wait_for_selector('[data-testid="card-container"], [itemprop="itemListElement"]', timeout=20000)
        cards = page.query_selector_all('[data-testid="card-container"], [itemprop="itemListElement"]')
        print(f"    tarjetas encontradas: {len(cards)}")

        for card in cards[:15]:
            try:
                name_el = card.query_selector('[data-testid="listing-card-title"], span[itemprop="name"]')
                name = name_el.inner_text().strip() if name_el else "Sin nombre"

                price_el = card.query_selector('[data-testid="price-element"], span[data-testid="price-availability-rate"]')
                price = None
                if price_el:
                    price = format_price(price_el.inner_text())

                url_el = card.query_selector('a[href*="/rooms/"]')
                href = ""
                if url_el:
                    href = url_el.get_attribute("href") or ""
                    if href and not href.startswith("http"):
                        href = "https://www.airbnb.es" + href

                rating_el = card.query_selector('[data-testid="listing-card-review-score"], span[aria-label*="estrellas"]')
                rating = None
                rating_text = None
                if rating_el:
                    text = rating_el.inner_text().strip()
                    nums = re.findall(r'[\d.,]+', text)
                    if nums:
                        try:
                            rating = float(nums[0].replace(",", "."))
                        except ValueError:
                            pass
                    rating_text = text[:80]

                location_el = card.query_selector('div[data-testid="listing-card-subtitle"]')
                location = location_el.inner_text().strip() if location_el else ""

                service_els = card.query_selector_all('[data-testid="listing-card-amenities"] span, div[data-testid="listing-card-amenities"] div')
                services_raw = [s.inner_text().strip() for s in service_els] if service_els else []
                services = extract_services(services_raw)

                items.append({
                    "nombre": name,
                    "precio_total_eur": price,
                    "url": href,
                    "puntuacion": rating,
                    "puntuacion_texto": rating_text,
                    "ubicacion": location,
                    "servicios": services,
                    "noche": CHECKIN,
                    "noche_texto": f"{CHECKIN} -> {CHECKOUT} (1 noche)",
                })
            except Exception as e:
                print(f"    error en tarjeta: {e}")
                continue
    except Exception as e:
        print(f"    error general: {e}")

    items.sort(key=lambda x: x["precio_total_eur"] if x["precio_total_eur"] is not None else float('inf'))
    return items


def generate_urls():
    print("\n=== URLs para consulta manual ===\n")
    for dest in DESTINATIONS:
        ciudad = dest["ciudad"]
        termino = dest["termino"]

        b_url = f"https://www.booking.com/searchresults.es.html?ss={termino}&checkin={CHECKIN}&checkout={CHECKOUT}&group_adults={ADULTOS}&group_children={MENORES}&no_rooms=1"
        print(f"Booking.com - {ciudad}")
        print(f"  {b_url}\n")

        a_url = f"https://www.airbnb.es/s/{termino}/homes?checkin={CHECKIN}&checkout={CHECKOUT}&adults={ADULTOS}&children={MENORES}"
        print(f"Airbnb - {ciudad}")
        print(f"  {a_url}\n")


def create_template():
    items = []
    for dest in DESTINATIONS:
        for fuente in ("booking", "airbnb"):
            items.append({
                "id": "",
                "nombre": "",
                "fuente": fuente,
                "ciudad": dest["ciudad"],
                "precio_total_eur": None,
                "url": "",
                "puntuacion": None,
                "puntuacion_texto": "",
                "ubicacion": "",
                "servicios": [],
                "noche": CHECKIN,
                "noche_texto": f"{CHECKIN} -> {CHECKOUT} (1 noche)",
            })
    return {
        "metadata": {
            **make_metadata("plantilla"),
            "checkin": CHECKIN,
            "checkout": CHECKOUT,
            "adultos": ADULTOS,
            "niños": MENORES,
        },
        "alojamientos": items,
        "combinaciones": [],
    }


def main():
    configure_stdout()
    print_header(f"Scraper de Alojamientos - {CHECKIN} -> {CHECKOUT} | {ADULTOS} adultos")

    if "--auto" in sys.argv:
        print("\nModo automático (Playwright)...")
        items = fetch_playwright_all()
        if not items:
            print("\n  No se obtuvieron datos. Usa --urls para generar enlaces manuales.")
            return

        data = {
            "metadata": {
                **make_metadata("scrapers/accommodations.py (Playwright)"),
                "checkin": CHECKIN, "checkout": CHECKOUT,
                "adultos": ADULTOS, "niños": MENORES,
            },
            "alojamientos": items,
            "combinaciones": [],
        }
        save_json(OUTPUT_FILE, data)
        print(f"  {len(items)} alojamientos guardados")

    elif "--urls" in sys.argv:
        generate_urls()

    elif "--editar" in sys.argv or "-e" in sys.argv:
        edit_prompt_generic(
            OUTPUT_FILE,
            ["alojamientos"],
            [("precio_total_eur", "Precio total (EUR)")],
            lambda a: f"{a['fuente'].upper()} - {a['nombre']}"
        )

    else:
        data = create_template()
        save_json(OUTPUT_FILE, data)
        print("\n  Uso:")
        print("    python -m scrapers.accommodations --auto")
        print("    python -m scrapers.accommodations --urls")
        print("    python -m scrapers.accommodations --editar")


if __name__ == "__main__":
    main()
