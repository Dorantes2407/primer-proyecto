"""
Servidor local para 'Historia Divertida'
Aplicación interactiva con soporte para Turso (LibSQL en la nube) y SQLite local.
"""

import http.server
import json
import os
import socketserver
import sys
import urllib.parse
import webbrowser
from datetime import date, datetime
from pathlib import Path

import turso_db

PORT = 5000
BASE_DIR = Path(__file__).parent.resolve()
DATA_FILE = BASE_DIR / "data.json"

# Historias y misiones educativas adaptadas por grado escolar (10 por grado)
STORIES_FILE = BASE_DIR / "stories.json"

with open(STORIES_FILE, "r", encoding="utf-8") as f:
    STORIES_DATA = json.load(f)


GRADE_ICONS = {
    "1": "🦖",
    "2": "🏺",
    "3": "🏛️",
    "4": "🏰",
    "5": "🧭",
    "6": "🚀"
}

GRADE_NAMES = {
    "1": "1º de Primaria",
    "2": "2º de Primaria",
    "3": "3º de Primaria",
    "4": "4º de Primaria",
    "5": "5º de Primaria",
    "6": "6º de Primaria"
}

# Niveles: (misiones completadas necesarias, número, título, icono)
NIVELES = [
    (0, 1, "Novato del Tiempo", "🐣"),
    (1, 2, "Explorador Curioso", "🧭"),
    (5, 3, "Guardián de Civilizaciones", "🛡️"),
    (12, 4, "Cronista de la Historia", "📜"),
    (22, 5, "Maestro de las Eras", "🏛️"),
    (35, 6, "Gran Sabio del Tiempo Universal", "👑"),
]


def load_database():
    """Carga los usuarios desde Turso/SQLite con respaldo y sincronización en data.json."""
    users = {}
    current_user = None

    try:
        users = turso_db.load_all_users_from_db()
        print(f"Usuarios cargados desde la base de datos: {len(users)}")
    except Exception as e:
        print(f"Aviso al cargar de la base de datos: {e}")

    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                backup = json.load(f)
                current_user = backup.get("current_user")
                # Si la base de datos está vacía, rescatamos los usuarios del backup local
                if not users and backup.get("users"):
                    users = backup.get("users")
        except Exception as e:
            print(f"Aviso al leer data.json: {e}")

    return {
        "current_user": current_user,
        "users": users
    }


def save_backup(data):
    """Guarda copia de respaldo local completa en data.json."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Aviso al escribir data.json: {e}")


def get_current_user_data(db):
    """Devuelve los datos del usuario activo o None."""
    current_uid = db.get("current_user")
    if not current_uid:
        return None
    users = db.get("users", {})
    return users.get(current_uid) or users.get(str(current_uid).lower())


def calculate_streak(activity_days):
    """Racha de días consecutivos con actividad, récord histórico y días del calendario."""
    hoy = date.today()
    dias = {}

    for item in activity_days or []:
        try:
            dia = datetime.strptime(str(item.get("day", "")), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        dias[dia] = int(item.get("missions", 0))

    if not dias:
        return {"current": 0, "best": 0, "days": []}

    ordenados = sorted(dias)

    # Récord histórico: la secuencia más larga de días seguidos
    best = run = 1
    for anterior, actual in zip(ordenados, ordenados[1:]):
        run = run + 1 if (actual - anterior).days == 1 else 1
        best = max(best, run)

    # Racha actual: sigue viva si el último día activo fue hoy o ayer
    current = 0
    if (hoy - ordenados[-1]).days <= 1:
        current = 1
        i = len(ordenados) - 1
        while i > 0 and (ordenados[i] - ordenados[i - 1]).days == 1:
            current += 1
            i -= 1

    return {
        "current": current,
        "best": best,
        "days": [
            {"day": dia.isoformat(), "missions": dias[dia]}
            for dia in ordenados if (hoy - dia).days <= 365
        ]
    }


def calculate_user_stats(user_data):
    """Calcula el nivel, progreso y temas dominados vs no dominados para un usuario específico."""
    if not user_data:
        user_data = {
            "name": "Invitado",
            "grade": "1",
            "badges": [],
            "completed_stories": [],
            "attempted_stories": {}
        }

    completed_ids = set(user_data.get("completed_stories", []))
    attempted = user_data.get("attempted_stories", {})

    all_stories = []
    for grade_str, story_list in STORIES_DATA.items():
        for s in story_list:
            all_stories.append({
                "id": s["id"],
                "grade": grade_str,
                "title": s["title"],
                "period": s["period"],
                "icon": s["icon"],
                "trivia_question": s["trivia"]["question"]
            })

    total = len(all_stories)
    completed_count = len(completed_ids)
    percent = round((completed_count / total) * 100) if total > 0 else 0

    # Sistema de niveles para el pequeño historiador
    idx = max(i for i, (umbral, *_) in enumerate(NIVELES) if completed_count >= umbral)
    _, level_num, level_title, level_icon = NIVELES[idx]
    if idx + 1 < len(NIVELES):
        siguiente = NIVELES[idx + 1]
        faltan = siguiente[0] - completed_count
        next_target = (
            f"¡Te {'falta' if faltan == 1 else 'faltan'} {faltan} "
            f"{'misión' if faltan == 1 else 'misiones'} para el Nivel {siguiente[1]}!"
        )
    else:
        next_target = "¡Felicidades, has alcanzado la máxima maestría histórica!"

    mastered = []
    not_mastered = []

    for s in all_stories:
        sid = s["id"]
        if sid in completed_ids:
            mastered.append({
                "id": s["id"],
                "grade": s["grade"],
                "title": s["title"],
                "period": s["period"],
                "icon": s["icon"],
                "status_badge": "¡Tema Dominado! 🌟"
            })
        else:
            att = attempted.get(sid, {})
            needs_practice = att.get("wrong_count", 0) > 0
            not_mastered.append({
                "id": s["id"],
                "grade": s["grade"],
                "title": s["title"],
                "period": s["period"],
                "icon": s["icon"],
                "status_type": "needs_practice" if needs_practice else "pending",
                "status_badge": "Necesita repaso 🤔" if needs_practice else "Por explorar 🔍",
                "reason": "Has tenido dudas en este reto" if needs_practice else "Aún no has explorado esta época"
            })

    return {
        "historian": {
            "name": user_data.get("name", "Pequeño Historiador"),
            "grade": user_data.get("grade", "1")
        },
        "total_missions": total,
        "completed_count": completed_count,
        "percent": percent,
        "xp": completed_count * 100,
        "level": {
            "num": level_num,
            "title": level_title,
            "icon": level_icon,
            "next_target": next_target
        },
        "streak": calculate_streak(user_data.get("activity_days", [])),
        "mastered": mastered,
        "not_mastered": not_mastered
    }


class HistoryAppHandler(http.server.SimpleHTTPRequestHandler):
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
            is_turso = turso_db.is_turso_configured()
            self._send_json(200, {
                "status": "online",
                "app": "Historia Divertida",
                "python_version": sys.version.split()[0],
                "database_mode": "Turso en la Nube (LibSQL)" if is_turso else "SQLite Local (historia.db)",
                "turso_configured": is_turso
            })
            return

        # Lista de todos los usuarios registrados con su resumen de avance
        if parsed.path == "/api/users":
            db = load_database()
            users_list = []
            for uid, u in db.get("users", {}).items():
                st = calculate_user_stats(u)
                users_list.append({
                    "id": uid,
                    "name": u.get("name", uid),
                    "grade": u.get("grade", "1"),
                    "grade_desc": GRADE_NAMES.get(u.get("grade", "1"), f"{u.get('grade', '1')}º Primaria"),
                    "grade_icon": GRADE_ICONS.get(u.get("grade", "1"), "🧭"),
                    "badges_count": len(u.get("badges", [])),
                    "completed_count": len(u.get("completed_stories", [])),
                    "total_missions": st["total_missions"],
                    "percent": st["percent"],
                    "level": st["level"],
                    "xp": st["xp"],
                    "streak": st["streak"],
                    "last_active": u.get("last_active", u.get("created_at", "Reciente"))
                })

            # Ordenar por mayor porcentaje completado
            users_list.sort(key=lambda x: x["percent"], reverse=True)

            self._send_json(200, {
                "current_user": db.get("current_user"),
                "users": users_list
            })
            return

        # Perfil del usuario activo
        if parsed.path == "/api/profile":
            db = load_database()
            user = get_current_user_data(db)
            if user:
                self._send_json(200, {
                    "historian": {
                        "name": user["name"],
                        "grade": user.get("grade", "1")
                    },
                    "badges": user.get("badges", []),
                    "completed_stories": user.get("completed_stories", [])
                })
            else:
                self._send_json(200, {
                    "historian": None,
                    "badges": [],
                    "completed_stories": []
                })
            return

        # Estadísticas y nivel del usuario activo
        if parsed.path == "/api/stats":
            db = load_database()
            user = get_current_user_data(db)
            stats = calculate_user_stats(user)
            self._send_json(200, stats)
            return

        # Historias por grado escolar
        if parsed.path == "/api/stories":
            query = urllib.parse.parse_qs(parsed.query)
            grade = query.get("grade", ["1"])[0]
            stories = STORIES_DATA.get(str(grade), STORIES_DATA["1"])
            self._send_json(200, {"grade": grade, "stories": stories})
            return

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
            self._send_json(400, {"error": "JSON no válido"})
            return

        db = load_database()

        # 1. Seleccionar un usuario ya existente
        if parsed.path == "/api/users/select":
            user_id = str(payload.get("id") or payload.get("name", "")).strip().lower()
            users = db.get("users", {})

            found_user = None
            for uid, u in users.items():
                if uid == user_id or u.get("name", "").strip().lower() == user_id:
                    found_user = u
                    break

            if not found_user:
                self._send_json(404, {"error": "Usuario no encontrado en los registros."})
                return

            db["current_user"] = found_user["id"]
            # Actualizar última actividad en base de datos
            turso_db.save_user_profile(found_user["name"], found_user.get("grade", "1"))
            
            # Sincronizar usuarios actualizados con el respaldo JSON
            db["users"] = turso_db.load_all_users_from_db()
            save_backup(db)

            self._send_json(200, {
                "success": True,
                "historian": {
                    "name": found_user["name"],
                    "grade": found_user.get("grade", "1")
                },
                "badges": found_user.get("badges", []),
                "completed_stories": found_user.get("completed_stories", [])
            })
            return

        # 2. Registrar o actualizar perfil del pequeño historiador
        if parsed.path == "/api/profile":
            name = payload.get("name", "").strip()
            grade = str(payload.get("grade", "1"))

            if not name:
                self._send_json(400, {"error": "Debes ingresar tu nombre o apodo, pequeño historiador."})
                return

            if grade not in ["1", "2", "3", "4", "5", "6"]:
                grade = "1"

            # Guardar en base de datos Turso / SQLite
            uid = turso_db.save_user_profile(name, grade)

            db["current_user"] = uid
            db["users"] = turso_db.load_all_users_from_db()
            save_backup(db)

            self._send_json(200, {
                "success": True,
                "historian": {
                    "name": name,
                    "grade": grade
                }
            })
            return

        # 3. Registrar respuesta a trivia en el perfil del usuario activo
        if parsed.path == "/api/complete-mission":
            user = get_current_user_data(db)
            if not user:
                self._send_json(401, {"error": "No hay ningún pequeño historiador seleccionado."})
                return

            story_id = payload.get("story_id")
            selected_option = payload.get("selected_option")

            # Buscar la historia correspondiente
            found_story = None
            for g_stories in STORIES_DATA.values():
                for s in g_stories:
                    if s["id"] == story_id:
                        found_story = s
                        break
                if found_story:
                    break

            if not found_story:
                self._send_json(404, {"error": "Misión histórica no encontrada"})
                return

            correct_index = found_story["trivia"]["answer"]
            is_correct = (selected_option == correct_index)

            if is_correct:
                badge_name = f"Medalla de {found_story['period']}"
                turso_db.record_mission_completed(user["id"], story_id, badge_name)
            else:
                turso_db.record_mission_wrong(user["id"], story_id)

            # Recargar estado actualizado desde la BD y respaldar
            updated_users = turso_db.load_all_users_from_db()
            updated_user = updated_users.get(user["id"], user)
            db["users"] = updated_users
            save_backup(db)

            self._send_json(200, {
                "correct": is_correct,
                "correct_option": correct_index,
                "badges": updated_user.get("badges", []),
                "completed_stories": updated_user.get("completed_stories", [])
            })
            return

        # 4. Eliminar perfil de un usuario
        if parsed.path == "/api/users/delete":
            target_id = str(payload.get("id") or payload.get("name", "")).strip().lower()

            turso_db.delete_user_from_db(target_id)

            if db.get("current_user") == target_id:
                db["current_user"] = None

            db["users"] = turso_db.load_all_users_from_db()
            save_backup(db)

            self._send_json(200, {"success": True, "deleted": target_id})
            return

        # 5. Salir del perfil (volver a pantalla de selección)
        if parsed.path == "/api/reset-profile":
            db["current_user"] = None
            db["users"] = turso_db.load_all_users_from_db()
            save_backup(db)
            self._send_json(200, {"success": True})
            return

        self._send_json(404, {"error": "Ruta no encontrada"})


def start_server():
    server_address = ("", PORT)
    socketserver.TCPServer.allow_reuse_address = True

    # Inicializar base de datos
    turso_db.init_database()

    is_turso = turso_db.is_turso_configured()
    db_name = "☁️ Turso Cloud (LibSQL)" if is_turso else "📁 SQLite Local (historia.db)"

    with socketserver.TCPServer(server_address, HistoryAppHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 65)
        print("📜 ¡Bienvenido a Historia Divertida! 🏰✨")
        print(f"🌟 Servidor local para Pequeños Historiadores en: {url}")
        print(f"🗄️  Base de Datos: {db_name}")
        if not is_turso:
            print("💡 Para conectar con Turso en la nube, crea tu base de datos y")
            print("   agrega tus credenciales en el archivo .env (mira .env.example)")
        print("🛑 Presiona CTRL+C para detener el servidor")
        print("=" * 65)

        webbrowser.open(url)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Servidor detenido.")


if __name__ == "__main__":
    start_server()