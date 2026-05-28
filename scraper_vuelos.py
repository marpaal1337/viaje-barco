"""
Entry point para scraper de vuelos.
Delegates to scrapers.flights module.

Uso:
  python scraper_vuelos.py --auto      # Scraping automático
  python scraper_vuelos.py --urls      # URLs de Google Flights
  python scraper_vuelos.py --editar    # Editar precios
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from scrapers.flights import main

if __name__ == "__main__":
    main()
