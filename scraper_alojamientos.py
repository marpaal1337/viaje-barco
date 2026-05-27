"""
Scraper de alojamientos para el viaje a Baleares.

Modo automático (Playwright):
  pip install playwright && playwright install chromium
  python scraper_alojamientos.py --auto

Modo manual (genera URLs para rellenar):
  python scraper_alojamientos.py --urls
  # Abre cada URL, apunta precios, luego:
  python scraper_alojamientos.py --editar
"""

import os
import json
import sys
import re
import webbrowser
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "alojamientos.json")

DESTINATIONS = [
    {
        "ciudad": "Ibiza",
        "zona": "Ibiza",
        "termino": "Ibiza",
        "coords": {"lat": 38.9067, "lng": 1.4206},
    },
]

CHECKIN = "2026-08-31"
CHECKOUT = "2026-09-01"
ADULTOS = 2
MENORES = 0

SERVICES_MAP = {
    "wifi": "WiFi",
    "piscina": "Piscina",
    "parking": "Parking",
    "aire acondicionado": "Aire acondicionado",
    "cocina": "Cocina",
    "lavadora": "Lavadora",
    "balcon": "Balcón",
    "terraza": "Terraza",
    "desayuno": "Desayuno incluido",
    "gimnasio": "Gimnasio",
    "playa": "Cerca de la playa",
    "admitemascotas": "Admite mascotas",
    "tv": "TV",
    "jacuzzi": "Jacuzzi",
}


def build_id(name, source, ciudad):
    prefix = source[:2].lower()
    short = "".join(w[0].lower() for w in name.split()[:4] if w)
    return f"{prefix}-{ciudad.lower()}-{short}"


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
            if key in t_lower:
                if label not in found:
                    found.append(label)
    return found


def normalize_accommodations(items, source, ciudad):
    for item in items:
        item["id"] = build_id(item.get("nombre", ""), source, ciudad)
        item["ciudad"] = ciudad
        item["fuente"] = source
    return items


# ── Modo 1: Playwright (automático) ──


def fetch_playwright_all():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  pip install playwright && playwright install chromium")
        return None

    all_items = []
    total = len(DESTINATIONS)
    count = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="es-ES",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        )

        for dest in DESTINATIONS:
            count += 1
            ciudad = dest["ciudad"]
            termino = dest["termino"]
            print(f"[{count}/{total}] {ciudad}")

            page = context.new_page()
            page.set_default_timeout(60000)

            try:
                print("  Booking.com...")
                booking = _scrape_booking(page, termino)
                if booking:
                    booking = normalize_accommodations(booking, "booking", ciudad)
                    all_items.extend(booking)
                    print(f"  -> {len(booking)} alojamientos")
                else:
                    print("  -> sin resultados")
            except Exception as e:
                print(f"  -> error Booking.com: {e}")

            page.close()

        # Airbnb en un contexto separado (cookies distintas)
        for dest in DESTINATIONS:
            ciudad = dest["ciudad"]
            termino = dest["termino"]

            page = context.new_page()
            page.set_default_timeout(60000)

            try:
                print(f"  Airbnb ({ciudad})...")
                airbnb = _scrape_airbnb(page, termino)
                if airbnb:
                    airbnb = normalize_accommodations(airbnb, "airbnb", ciudad)
                    all_items.extend(airbnb)
                    print(f"  -> {len(airbnb)} alojamientos")
                else:
                    print("  -> sin resultados")
            except Exception as e:
                print(f"  -> error Airbnb: {e}")

            page.close()

        browser.close()

    return all_items if all_items else None


def _scrape_booking(page, termino):
    url = (
        f"https://www.booking.com/searchresults.es.html"
        f"?ss={termino}"
        f"&checkin={CHECKIN}&checkout={CHECKOUT}"
        f"&group_adults={ADULTOS}&group_children={MENORES}"
        f"&no_rooms=1&order=distance_from_search"
    )

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
        # Cerrar posible popup de cookies
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

                price_el = card.query_selector(
                    '[data-testid="price-and-discounted-price"], '
                    '[data-testid="price-for-x-nights"]'
                )
                price = None
                if price_el:
                    price = format_price(price_el.inner_text())

                if not price:
                    price_el2 = card.query_selector(
                        'span[data-testid="price-for-x-nights"]'
                    )
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
                    rating_text = text[:80] if len(text) > 80 else text

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

    items.sort(key=lambda x: (
        x["precio_total_eur"] if x["precio_total_eur"] is not None else float('inf')
    ))
    return items


def _scrape_airbnb(page, termino):
    url = (
        f"https://www.airbnb.es/s/{termino}/homes"
        f"?checkin={CHECKIN}&checkout={CHECKOUT}"
        f"&adults={ADULTOS}&children={MENORES}"
        f"&price_max=1000&price_min=30"
    )

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
        # Cerrar posible popup de cookies
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
        cards = page.query_selector_all(
            '[data-testid="card-container"], '
            '[itemprop="itemListElement"]'
        )
        print(f"    tarjetas encontradas: {len(cards)}")

        for card in cards[:15]:
            try:
                name_el = card.query_selector(
                    '[data-testid="listing-card-title"], '
                    'span[itemprop="name"]'
                )
                name = name_el.inner_text().strip() if name_el else "Sin nombre"

                price_el = card.query_selector(
                    '[data-testid="price-element"], '
                    'span[data-testid="price-availability-rate"]'
                )
                price = None
                if price_el:
                    price = format_price(price_el.inner_text())

                url_el = card.query_selector('a[href*="/rooms/"]')
                href = ""
                if url_el:
                    href = url_el.get_attribute("href") or ""
                    if href and not href.startswith("http"):
                        href = "https://www.airbnb.es" + href

                rating_el = card.query_selector(
                    '[data-testid="listing-card-review-score"], '
                    'span[aria-label*="estrellas"]'
                )
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

                location_el = card.query_selector(
                    'div[data-testid="listing-card-subtitle"]'
                )
                location = location_el.inner_text().strip() if location_el else ""

                service_els = card.query_selector_all(
                    '[data-testid="listing-card-amenities"] span, '
                    'div[data-testid="listing-card-amenities"] div'
                )
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

    items.sort(key=lambda x: (
        x["precio_total_eur"] if x["precio_total_eur"] is not None else float('inf')
    ))
    return items


# ── Modo 2: URLs manuales ──


def generate_urls():
    print("\n=== URLs para consulta manual ===\n")
    urls = []
    for dest in DESTINATIONS:
        ciudad = dest["ciudad"]
        termino = dest["termino"]

        b_url = (
            f"https://www.booking.com/searchresults.es.html"
            f"?ss={termino}"
            f"&checkin={CHECKIN}&checkout={CHECKOUT}"
            f"&group_adults={ADULTOS}&group_children={MENORES}"
            f"&no_rooms=1"
        )
        urls.append(("booking", ciudad, b_url))
        print(f"Booking.com - {ciudad}")
        print(f"  {b_url}\n")

        a_url = (
            f"https://www.airbnb.es/s/{termino}/homes"
            f"?checkin={CHECKIN}&checkout={CHECKOUT}"
            f"&adults={ADULTOS}&children={MENORES}"
        )
        urls.append(("airbnb", ciudad, a_url))
        print(f"Airbnb - {ciudad}")
        print(f"  {a_url}\n")

    print(f"Total: {len(urls)} URLs")
    return urls


# ── Modo 3: Editar JSON manualmente ──


def edit_prompt():
    if not os.path.exists(OUTPUT_FILE):
        print(f"No existe {OUTPUT_FILE}. Ejecuta primero sin args para crear plantilla.")
        return

    with open(OUTPUT_FILE, encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("alojamientos", [])
    print(f"\nEditando {len(items)} alojamientos. Deja vacío para mantener valor actual.\n")

    for i, item in enumerate(items):
        print(f"[{i+1}/{len(items)}] {item['fuente'].upper()} - {item['nombre']}")
        print(f"    Ubicación: {item.get('ubicacion', '?')}  |  "
              f"Puntuación: {item.get('puntuacion', '?')}")

        current = item["precio_total_eur"]
        inp = input(f"    Precio actual: {current} EUR -> Nuevo precio (EUR): ").strip()
        if inp:
            try:
                item["precio_total_eur"] = float(inp.replace(",", "."))
                print(f"    OK Actualizado a {item['precio_total_eur']} EUR")
            except ValueError:
                print(f"    - Mantenido: {current} EUR")

    data["metadata"]["generado"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    data["metadata"]["fuente"] = "edicion manual"

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nGuardado: {OUTPUT_FILE} ({len(items)} alojamientos)")


# ── Plantilla vacía ──


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
            "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "fuente": "plantilla",
            "checkin": CHECKIN,
            "checkout": CHECKOUT,
            "adultos": ADULTOS,
            "niños": MENORES,
        },
        "alojamientos": items,
        "combinaciones": [],
    }


def build_combinations(all_items):
    return []


# ── Main ──


def main():
    print("=" * 60)
    print("  Scraper de Alojamientos - Viaje Baleares")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  {CHECKIN} -> {CHECKOUT}  |  {ADULTOS} adultos")
    print("=" * 60)

    if "--auto" in sys.argv:
        print("\nModo automático (Playwright)...")
        items = fetch_playwright_all()
        if not items:
            print("\n  No se obtuvieron datos. Usa --urls para generar enlaces manuales.")
            return

        data = {
            "metadata": {
                "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "fuente": "scraper_alojamientos.py (Playwright)",
                "checkin": CHECKIN,
                "checkout": CHECKOUT,
                "adultos": ADULTOS,
                "niños": MENORES,
            },
            "alojamientos": items,
            "combinaciones": build_combinations(items),
        }

        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"\n  {len(items)} alojamientos guardados en {OUTPUT_FILE}")

    elif "--urls" in sys.argv:
        generate_urls()

    elif "--editar" in sys.argv or "-e" in sys.argv:
        edit_prompt()

    else:
        # Sin args: crear plantilla
        os.makedirs(DATA_DIR, exist_ok=True)
        data = create_template()
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n  Plantilla creada: {OUTPUT_FILE}")
        print("\n  Uso:")
        print("    python scraper_alojamientos.py --auto      # Scraping automático (Playwright)")
        print("    python scraper_alojamientos.py --urls      # Genera URLs para consulta manual")
        print("    python scraper_alojamientos.py --editar    # Edita precios manualmente")
        print()
        print("  Requisitos Playwright:")
        print("    pip install playwright && playwright install chromium")


if __name__ == "__main__":
    main()
