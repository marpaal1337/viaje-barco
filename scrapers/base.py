"""
Base scraper module with shared utilities for all Viaje Velero scrapers.
"""
import os
import json
import re
import sys
from datetime import datetime


def configure_stdout():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass


def get_data_dir():
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def build_id(*parts):
    code = []
    for part in parts:
        if part:
            w = "".join(p[0].upper() for p in part.split() if p)
            code.append(w.lower())
    return "-".join(code)


def build_id_flight(origin, dest, airline, date_str, dep_time):
    code = "".join(w[0].upper() for w in airline.split() if w)
    time_part = dep_time.replace(":", "") if dep_time else "0000"
    return f"{origin.lower()}-{dest.lower()}-{code.lower()}-{date_str.replace('-','')}-{time_part}"


def build_id_boat(isla, modelo, plataforma):
    model_code = "".join(w[0].upper() for w in modelo.split() if w)
    platform_code = "".join(c[0] for c in plataforma.split(".") if c)
    return f"{isla.lower()}-{model_code.lower()}-{platform_code.lower()}"


def build_id_accommodation(name, source, ciudad):
    prefix = source[:2].lower()
    short = "".join(w[0].lower() for w in name.split()[:4] if w)
    return f"{prefix}-{ciudad.lower()}-{short}"


def make_metadata(source_desc):
    return {
        "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "fuente": source_desc,
    }


def print_header(title):
    width = 60
    print("=" * width)
    print(f"  {title}")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * width)


def edit_prompt_generic(output_file, items, fields, label_fn):
    """
    Generic interactive price editor.
    fields: list of (field_name, display_label)
    label_fn: function(item) -> string for display
    """
    if not os.path.exists(output_file):
        print(f"No existe {output_file}. Genera datos primero.")
        return

    with open(output_file, encoding="utf-8") as f:
        data = json.load(f)

    arr = data.get(list(data.keys())[1], [])  # First key after metadata
    print(f"\nEditando {len(arr)} items. Deja vacío para mantener valor actual.\n")

    for i, item in enumerate(arr):
        print(f"[{i+1}/{len(arr)}] {label_fn(item)}")
        for field_name, display_label in fields:
            current = item.get(field_name, "")
            inp = input(f"  {display_label} (actual: {current}) -> Nuevo: ").strip()
            if inp:
                try:
                    if isinstance(current, float):
                        item[field_name] = float(inp.replace(",", "."))
                    elif isinstance(current, int):
                        item[field_name] = int(inp)
                    else:
                        item[field_name] = inp
                    print(f"  OK")
                except ValueError:
                    print(f"  Mantenido: {current}")
        print()

    data["metadata"]["generado"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    data["metadata"]["fuente"] = "edicion manual"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Guardado: {output_file} ({len(arr)} items)")


def save_json(output_file, data):
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    count = len(data.get(list(data.keys())[1], []))
    print(f"  Guardado: {output_file} ({count} items)")
