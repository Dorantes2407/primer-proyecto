"""
Servidor local para la aplicación de gestión de tareas y notas.
Utiliza únicamente la librería estándar de Python (no requiere pip install).
"""

import http.server
import json
import os
import socketserver
import sys
import urllib.parse
import webbrowser
from pathlib import Path

PORT = 5000
BASE_DIR = Path(__file__).parent.resolve()
DATA_FILE = BASE_DIR / "data.json"


def load_data():
    """Carga los datos desde data.json o crea un archivo inicial si no existe."""
    if not DATA_FILE.exists():
        initial_data = {
            "items": [
                {
                    "id": 1,
                    "title": "¡Bienvenido a tu aplicación local!",
                    "category": "General",
                    "completed": False,
                },
                {
                    "id": 2,
                    "title": "Modificar el archivo index.html o app.js para personalizar la interfaz",
                    "category": "Desarrollo",
                    "completed": False,
                },
            ]
        }
        save_data(initial_data)
        return initial_data
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"items": []}


def save_data(data):
    """Guarda los datos en data.json con codificación UTF-8."""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class LocalAppHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def _send_json(self, status_code, payload):
        response_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/status":
            self._send_json(200, {
                "status": "online",
                "python_version": sys.version.split()[0],
                "platform": sys.platform,
                "project_dir": str(BASE_DIR)
            })
            return

        if parsed.path == "/api/items":
            data = load_data()
            self._send_json(200, data)
            return

        # Servir archivos estáticos (HTML, JS, CSS)
        if parsed.path == "/":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self._send_json(400, {"error": "JSON inválido"})
            return

        data = load_data()

        if parsed.path == "/api/items":
            title = payload.get("title", "").strip()
            category = payload.get("category", "General").strip()

            if not title:
                self._send_json(400, {"error": "El título es obligatorio"})
                return

            new_id = max([item["id"] for item in data["items"]], default=0) + 1
            new_item = {
                "id": new_id,
                "title": title,
                "category": category,
                "completed": False,
            }
            data["items"].append(new_item)
            save_data(data)
            self._send_json(201, new_item)
            return

        if parsed.path == "/api/items/toggle":
            item_id = payload.get("id")
            for item in data["items"]:
                if item["id"] == item_id:
                    item["completed"] = not item.get("completed", False)
                    save_data(data)
                    self._send_json(200, item)
                    return
            self._send_json(404, {"error": "Elemento no encontrado"})
            return

        if parsed.path == "/api/items/delete":
            item_id = payload.get("id")
            data["items"] = [item for item in data["items"] if item["id"] != item_id]
            save_data(data)
            self._send_json(200, {"success": True, "deleted_id": item_id})
            return

        self._send_json(404, {"error": "Ruta no encontrada"})


def start_server():
    server_address = ("", PORT)
    # Permite reusar el puerto inmediatamente al reiniciar
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(server_address, LocalAppHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 50)
        print(f"🚀 Aplicación Local iniciada con éxito")
        print(f"🌐 URL: {url}")
        print("📁 Presiona CTRL+C para detener el servidor")
        print("=" * 50)
        
        # Abrir el navegador automáticamente
        webbrowser.open(url)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Servidor detenido por el usuario.")


if __name__ == "__main__":
    start_server()
