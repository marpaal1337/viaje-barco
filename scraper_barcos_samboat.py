"""
Entry point para scraper de veleros (SamBoat).
Delegates to scrapers.boats_samboat module.

Uso:
  python scraper_barcos_samboat.py      # Scraping automático completo
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from scrapers.boats_samboat import main

if __name__ == "__main__":
    main()
