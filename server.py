"""
Servidor HTTP para el comparador de Viaje Velero.
Sirve archivos estáticos + API para lanzar scrapers.

Uso:
    python server.py [--port PORT]

Luego abre http://localhost:PORT/html/comparador-viaje.html
"""
import http.server
import json
import os
import subprocess
import sys
import urllib.parse

PORT = int(os.environ.get("PORT", 8080))
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

SCRAPER_MAP = {
    "barcos": ("boats", "barcos.json", "barcos"),
    "vuelos": ("flights", "vuelos.json", "alternativas"),
    "alojamientos": ("accommodations", "alojamientos.json", "alojamientos"),
}


class APIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_ROOT, **kwargs)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/scrape/"):
            self._handle_scrape(parsed.path.split("/api/scrape/")[1])
        else:
            self.send_error(404)

    def _handle_scrape(self, scrape_type):
        if scrape_type not in SCRAPER_MAP:
            self._json_response({"error": f"Tipo desconocido: {scrape_type}"}, 400)
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b"{}"
        params = json.loads(body) if body else {}

        module, data_file, _ = SCRAPER_MAP[scrape_type]
        cmd = [sys.executable, os.path.join(PROJECT_ROOT, "scripts", "scrape.py"), module, "--auto"]

        env = os.environ.copy()
        if params:
            env["SCRAPE_PARAMS"] = json.dumps(params)

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=180,
                cwd=PROJECT_ROOT, env=env,
            )
            output_log = (result.stdout or "") + (result.stderr or "")
        except subprocess.TimeoutExpired:
            self._json_response({"status": "error", "error": "Timeout (180s)"}, 504)
            return
        except Exception as e:
            self._json_response({"status": "error", "error": str(e)}, 500)
            return

        data_path = os.path.join(PROJECT_ROOT, "data", data_file)
        if os.path.exists(data_path):
            try:
                with open(data_path, encoding="utf-8") as f:
                    data = json.load(f)
                self._json_response({
                    "status": "ok",
                    "data": data,
                    "log": output_log,
                })
            except json.JSONDecodeError:
                self._json_response({
                    "status": "error",
                    "error": "Error leyendo JSON generado",
                    "log": output_log,
                }, 500)
        else:
            self._json_response({
                "status": "error",
                "error": f"No se generó {data_file}",
                "log": output_log,
            }, 500)

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


if __name__ == "__main__":
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            PORT = int(sys.argv[idx + 1])

    server = http.server.HTTPServer(("", PORT), APIHandler)
    print(f"  Servidor listo en http://localhost:{PORT}")
    print(f"  Abre http://localhost:{PORT}/html/comparador-viaje.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor detenido.")
        server.shutdown()
