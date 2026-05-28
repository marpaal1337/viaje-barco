"""
Scraper de veleros en Ibiza desde SamBoat (con paginación completa).
"""
import os
import sys
import re
import json
from datetime import datetime

from .base import configure_stdout, get_data_dir, print_header, make_metadata, save_json

OUTPUT_FILE = os.path.join(get_data_dir(), "barcos.json")
BASE_URL = "https://www.samboat.es/alquiler-velero/ibiza"


def scrape_page(page, page_num):
    url = BASE_URL if page_num == 1 else f"{BASE_URL}?page={page_num}"
    print(f"  Page {page_num}: {url}")

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
    except Exception as e:
        print(f"    Error: {e}")
        return []

    html = page.content()
    body_text = page.query_selector("body").inner_text()

    scripts = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL
    )

    boats = []
    for script in scripts:
        try:
            data = json.loads(script)
            if data.get("@type") == "Product":
                offers = data.get("offers", {})
                offers_list = offers.get("offers", []) if isinstance(offers, dict) else []
                for offer in offers_list:
                    boat = {
                        "modelo": offer.get("name", "Desconocido"),
                        "precio_dia": float(offer.get("price", 0)),
                        "moneda": "EUR",
                        "plataforma": "samboat.es",
                        "url": offer.get("url", ""),
                        "isla": "Ibiza",
                        "tipo": "Velero",
                        "con_patron": None,
                        "plazas": 0,
                        "camarotes": 0,
                        "eslora_m": 0,
                        "ano": 0,
                        "rating": 0,
                        "reseñas": 0,
                        "puerto_base": "",
                        "disponibilidad": "Sep 2026 - consultar",
                        "licencia": "",
                        "fianza": "",
                    }

                    desc = offer.get("description", "")
                    m = re.search(r'(\d+)\s*camarotes', desc)
                    if m: boat["camarotes"] = int(m.group(1))
                    m = re.search(r'capacidad de (\d+) personas', desc)
                    if m: boat["plazas"] = int(m.group(1))
                    m = re.search(r'eslora total de ([\d.]+) metros', desc)
                    if m: boat["eslora_m"] = float(m.group(1))
                    m = re.search(r'Fabricado en.*?(\d{4})', desc)
                    if m: boat["ano"] = int(m.group(1))

                    addr = offer.get("areaServed", {})
                    if isinstance(addr, dict):
                        address = addr.get("address", {})
                        if isinstance(address, dict):
                            boat["puerto_base"] = address.get("addressLocality", "")

                    bname = boat["modelo"]
                    idx = body_text.find(bname)
                    if idx >= 0:
                        chunk = body_text[max(0, idx-100):idx+800]
                        lower = chunk.lower()

                        m = re.search(r'([\d.]+)\s*\((\d+)\)', chunk)
                        if m:
                            try:
                                boat["rating"] = float(m.group(1))
                                boat["reseñas"] = int(m.group(2))
                            except: pass

                        if boat["plazas"] == 0:
                            m = re.search(r'(\d+)\s*p(?:ers?|lazas?)', chunk)
                            if m: boat["plazas"] = int(m.group(1))
                        if boat["camarotes"] == 0:
                            m = re.search(r'(\d+)\s*cabinas', chunk)
                            if m: boat["camarotes"] = int(m.group(1))
                        if boat["eslora_m"] == 0:
                            m = re.search(r'([\d,.]+)\s*metros', chunk)
                            if m: boat["eslora_m"] = float(m.group(1).replace(",", "."))
                        if boat["ano"] == 0:
                            m = re.search(r'\b(19\d\d|20\d\d)\b', chunk)
                            if m: boat["ano"] = int(m.group(1))

                        if "con o sin patrón" in lower:
                            boat["con_patron"] = False; boat["licencia"] = "Con o sin patrón"
                        elif "barco solo" in lower:
                            boat["con_patron"] = False; boat["licencia"] = "Barco solo (sin patrón)"
                        elif "patrón opcional" in lower:
                            boat["con_patron"] = False; boat["licencia"] = "Patrón opcional"
                        elif "patrón obligatorio" in lower or "con patrón" in lower:
                            boat["con_patron"] = True; boat["licencia"] = "Con patrón"
                        elif "sin licencia" in lower:
                            boat["con_patron"] = False; boat["licencia"] = "Sin licencia"
                        elif "patrón incluido" in lower:
                            boat["con_patron"] = True; boat["licencia"] = "Patrón incluido"

                    boats.append(boat)
                break
        except json.JSONDecodeError:
            pass

    return boats


def scrape_all():
    from playwright.sync_api import sync_playwright

    all_boats = []
    total_pages = 6

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(locale="es-ES", viewport={"width": 1920, "height": 1080})

        for page_num in range(1, total_pages + 1):
            boats = scrape_page(page, page_num)
            print(f"    Boats: {len(boats)}")
            all_boats.extend(boats)

        browser.close()

    seen_urls = set()
    unique_boats = []
    for b in all_boats:
        if b["url"] and b["url"] not in seen_urls:
            seen_urls.add(b["url"])
            unique_boats.append(b)

    return unique_boats


def build_id(modelo, plataforma):
    code = "".join(w[0].upper() for w in modelo.split() if w)
    platform_code = "".join(c[0] for c in plataforma.split(".") if c)
    return f"ibiza-{code.lower()}-{platform_code.lower()}"


def main():
    configure_stdout()
    print_header("Scraper de Veleros Ibiza - SamBoat")

    print("\nScrapeando 6 páginas de veleros en Ibiza...")
    boats = scrape_all()

    if not boats:
        print("\n  No se obtuvieron datos.")
        return

    for b in boats:
        b["id"] = build_id(b.get("modelo", ""), "samboat.es")
        b["extras_dia"] = "Consultar en web"
        b["seguro"] = "Incluido"
        if not b.get("fianza"):
            b["fianza"] = "Consultar"

    boats.sort(key=lambda b: b.get("precio_dia", 9999))

    bareboat = [b for b in boats if b.get("con_patron") is False]
    with_skipper = [b for b in boats if b.get("con_patron") is True]
    unknown = [b for b in boats if b.get("con_patron") is None]

    print(f"\n  Total veleros encontrados: {len(boats)}")
    print(f"  Con opción sin patrón: {len(bareboat)}")
    print(f"  Solo con patrón: {len(with_skipper)}")
    print(f"  Sin info de patrón: {len(unknown)}")

    if bareboat:
        print("\n--- BARCOS SIN PATRÓN (mejores relación calidad/precio) ---")
        candidates = [b for b in bareboat if b.get("plazas", 0) >= 6 or b.get("plazas", 0) == 0]
        for b in candidates[:15]:
            print(f"  {b['modelo']:35s} | {b['precio_dia']:>5.0f}€/d | "
                  f"{b.get('plazas', '?'):>2}pers | {b.get('camarotes', '?'):>1}cab | "
                  f"{b.get('eslora_m', 0):4.1f}m | {b.get('puerto_base', ''):20s} | {b.get('licencia', '?')}")

    data = {
        "metadata": make_metadata("scrapers/boats_samboat.py (Playwright - SamBoat)"),
        "barcos": boats,
    }
    data["metadata"]["fechas_referencia"] = "1-3 Sep 2026"
    data["metadata"]["resumen"] = {
        "total_veleros": len(boats),
        "sin_patron": len(bareboat),
        "con_patron": len(with_skipper),
        "sin_info": len(unknown),
    }

    save_json(OUTPUT_FILE, data)


if __name__ == "__main__":
    main()
