"""
Entry point para scraper de barcos (Click&Boat).
Delegates to scrapers.boats module.

Uso:
  python scraper_barcos.py --auto      # Scraping automático
  python scraper_barcos.py --urls      # URLs para consulta manual
  python scraper_barcos.py --editar    # Editar precios
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from scrapers.boats import main

if __name__ == "__main__":
    main()
