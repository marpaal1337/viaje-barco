"""
Entry point para scraper de alojamientos.
Delegates to scrapers.accommodations module.

Uso:
  python scraper_alojamientos.py --auto      # Scraping automático
  python scraper_alojamientos.py --urls      # URLs para consulta manual
  python scraper_alojamientos.py --editar    # Editar precios
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from scrapers.accommodations import main

if __name__ == "__main__":
    main()
