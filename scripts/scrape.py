"""
Entry point unificado para scrapers.

Uso:
  python scripts/scrape.py boats [--auto|--urls|--editar]
  python scripts/scrape.py samboat
  python scripts/scrape.py flights [--auto|--urls|--editar]
  python scripts/scrape.py accommodations [--auto|--urls|--editar]
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

MODULES = {
    'boats': 'scrapers.boats',
    'samboat': 'scrapers.boats_samboat',
    'flights': 'scrapers.flights',
    'accommodations': 'scrapers.accommodations',
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in MODULES:
        print(__doc__)
        sys.exit(1)

    module_path = MODULES[sys.argv[1]]
    sys.argv = [sys.argv[0]] + sys.argv[2:]
    __import__(module_path).main()
