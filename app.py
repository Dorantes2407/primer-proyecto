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
from datetime import datetime
from pathlib import Path

import turso_db

PORT = 5000
BASE_DIR = Path(__file__).parent.resolve()
DATA_FILE = BASE_DIR / "data.json"

# Historias y misiones educativas adaptadas por grado escolar
STORIES_DATA = {
    "1": [
        {
            "id": "1-1",
            "title": "El Gran Viaje con los Dinosaurios",
            "period": "Prehistoria",
            "icon": "🦖",
            "summary": "Hace millones de años, enormes criaturas habitaban la Tierra. ¡Descubre cómo vivía el T-Rex y el Triceratops!",
            "fun_fact": "¿Sabías que algunos dinosaurios tenían plumas de colores brillantes?",
            "trivia": {
                "question": "¿Cuál de estos dinosaurios era famoso por sus 3 cuernos y un gran escudo?",
                "options": ["Tiranosaurio Rex", "Triceratops", "Velociraptor"],
                "answer": 1
            }
        },
        {
            "id": "1-2",
            "title": "La Primera Fogata de la Humanidad",
            "period": "Edad de Piedra",
            "icon": "🔥",
            "summary": "Los primeros humanos aprendieron a hacer fuego frotando piedras y maderas para calentarse en las cavernas.",
            "fun_fact": "El fuego no solo daba calor, ¡también servía para contar historias en la noche y protegerse de animales salvajes!",
            "trivia": {
                "question": "¿En qué lugares pintaban los primeros seres humanos a los animales?",
                "options": ["En cuadernos de papel", "En las paredes de las cuevas", "En computadoras"],
                "answer": 1
            }
        }
    ],
    "2": [
        {
            "id": "2-1",
            "title": "El Misterio de las Pirámides y Faraones",
            "period": "Antiguo Egipto",
            "icon": "🏺",
            "summary": "A orillas del río Nilo, los antiguos egipcios construyeron monumentos gigantescos que aún asombran al mundo.",
            "fun_fact": "Los gatos eran tan sagrados en Egipto que se creía que traían buena suerte a las casas de los faraones.",
            "trivia": {
                "question": "¿Cómo se llamaba la escritura egipcia hecha con dibujos y símbolos?",
                "options": ["Jeroglíficos", "Código Morse", "Alfabeto romano"],
                "answer": 0
            }
        },
        {
            "id": "2-2",
            "title": "Navegantes del Nilo",
            "period": "Egipto y Comercio",
            "icon": "⛵",
            "summary": "Gracias a los barcos de papiro, los egipcios podían transportar trigo, piedras enormes y tesoros.",
            "fun_fact": "El papiro fue el abuelo del papel moderno; se hacía con tallos de plantas acuáticas.",
            "trivia": {
                "question": "¿Cuál es el río más famoso donde floreció la civilización egipcia?",
                "options": ["Río Amazonas", "Río Nilo", "Río Bravo"],
                "answer": 1
            }
        }
    ],
    "3": [
        {
            "id": "3-1",
            "title": "El Primer Estadio de los Juegos Olímpicos",
            "period": "Antigua Grecia",
            "icon": "🏛️",
            "summary": "En la ciudad de Olimpia, los atletas competían en carreras y lanzamiento de disco en honor a los dioses griegos.",
            "fun_fact": "A los campeones no les daban medallas de oro, ¡les colocaban coronas hechas con ramas de olivo silvestre!",
            "trivia": {
                "question": "¿Cada cuántos años se celebraban los Juegos Olímpicos en la antigua Grecia?",
                "options": ["Cada 10 años", "Cada 4 años", "Cada semana"],
                "answer": 1
            }
        },
        {
            "id": "3-2",
            "title": "El Coliseo y los Acueductos Romanos",
            "period": "Imperio Romano",
            "icon": "🛡️",
            "summary": "Los ingenieros romanos inventaron puentes gigantes llamados acueductos para llevar agua limpia a ciudades enteras.",
            "fun_fact": "Los romanos inventaron un tipo de concreto tan resistente que sus edificios siguen en pie después de 2,000 años.",
            "trivia": {
                "question": "¿Cómo se llamaba la prenda de vestir blanca que usaban los ciudadanos de Roma?",
                "options": ["Sombraje", "Toga", "Armadura de cuero"],
                "answer": 1
            }
        }
    ],
    "4": [
        {
            "id": "4-1",
            "title": "Los Astrónomos de Chichén Itzá y Palenque",
            "period": "Cultura Maya",
            "icon": "🌽",
            "summary": "Los sabios mayas contaban los días observando las estrellas y el movimiento de los planetas con asombrosa exactitud.",
            "fun_fact": "Los mayas fueron de los primeros pueblos en inventar y utilizar el número CERO.",
            "trivia": {
                "question": "¿Qué bebida deliciosa y amarga preparaban con semillas de cacao?",
                "options": ["Té de limón", "Chocolate sagrado (xocolātl)", "Jugo de naranja"],
                "answer": 1
            }
        },
        {
            "id": "4-2",
            "title": "Torneos y Castillos Medievales",
            "period": "Edad Media",
            "icon": "🏰",
            "summary": "Caballeros con pesadas armaduras de metal cuidaban fortalezas con puentes levadizos y altas torres vigía.",
            "fun_fact": "Una armadura completa de caballero podía llegar a pesar más de 25 kilos.",
            "trivia": {
                "question": "¿Qué rodeaba los castillos para evitar que los enemigos se acercaran fácilmente?",
                "options": ["Un foso con agua", "Una autopista", "Campos de girasoles"],
                "answer": 0
            }
        }
    ],
    "5": [
        {
            "id": "5-1",
            "title": "La Gran Tenochtitlan sobre el Lago",
            "period": "Cultura Mexica",
            "icon": "🦅",
            "summary": "Una impresionante ciudad fundada sobre islotes en medio del lago de Texcoco, con calzadas, canales y chinampas flotantes.",
            "fun_fact": "Las chinampas eran huertos flotantes donde cultivaban maíz, frijol y flores durante todo el año.",
            "trivia": {
                "question": "¿Qué señal vieron los mexicas para fundar su ciudad?",
                "options": ["Un arcoíris doble", "Un águila devorando una serpiente sobre un nopal", "Un cometa de oro"],
                "answer": 1
            }
        },
        {
            "id": "5-2",
            "title": "Grandes Navegantes y Nuevos Horizontes",
            "period": "Era de las Exploraciones",
            "icon": "🧭",
            "summary": "Capitanes valientes cruzaron océanos desconocidos guiados por la brújula y las constelaciones marinas.",
            "fun_fact": "Para orientarse de noche en alta mar, los marineros usaban un instrumento llamado astrolabio.",
            "trivia": {
                "question": "¿Qué instrumento con una aguja imantada siempre apunta hacia el Norte?",
                "options": ["Telescopio", "Brújula", "Reloj de arena"],
                "answer": 1
            }
        }
    ],
    "6": [
        {
            "id": "6-1",
            "title": "La Revolución de las Máquinas de Vapor",
            "period": "Revolución Industrial",
            "icon": "🚂",
            "summary": "El ferrocarril y las locomotoras cambiaron la forma en que los seres humanos viajaban y comerciaban en todo el planeta.",
            "fun_fact": "Antes de los trenes, un viaje entre dos ciudades podía tardar varias semanas en diligencia o a caballo.",
            "trivia": {
                "question": "¿Qué elemento hacía funcionar a las primeras locomotoras de la Revolución Industrial?",
                "options": ["Vapor de agua generado por carbón", "Baterías de litio", "Gasolina espacial"],
                "answer": 0
            }
        },
        {
            "id": "6-2",
            "title": "El Salto a las Estrellas: Llegada a la Luna",
            "period": "Historia Contemporánea",
            "icon": "🚀",
            "summary": "En 1969, la nave Apolo 11 llevó a los primeros seres humanos a pisar la superficie de la Luna.",
            "fun_fact": "La computadora del Apolo 11 tenía menos potencia de cálculo que cualquier reloj inteligente de hoy en día.",
            "trivia": {
                "question": "¿Quién fue el astronauta que pronunció la famosa frase: 'Un pequeño paso para el hombre, un gran salto para la humanidad'?",
                "options": ["Neil Armstrong", "Galileo Galilei", "Julio Verne"],
                "answer": 0
            }
        }
    ]
}

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


def load_database():
    """Carga los usuarios desde Turso/SQLite con respaldo en data.json."""
    try:
        users = turso_db.load_all_users_from_db()
    except Exception as e:
        print(f"Aviso al cargar de la base de datos: {e}")
        users = {}

    current_user = None
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                backup = json.load(f)
                current_user = backup.get("current_user")
                # Si la base de datos estaba vacía, rescatamos de data.json
                if not users and backup.get("users"):
                    users = backup.get("users")
        except Exception:
            pass

    return {
        "current_user": current_user,
        "users": users
    }


def save_backup(data):
    """Guarda copia de respaldo local en data.json."""
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
    if completed_count == 0:
        level_num = 1
        level_title = "Novato del Tiempo"
        level_icon = "🐣"
        next_target = "Completa 1 misión histórica para subir al Nivel 2"
    elif completed_count < 3:
        level_num = 2
        level_title = "Explorador Curioso"
        level_icon = "🧭"
        next_target = f"¡Te faltan {3 - completed_count} misión(es) para el Nivel 3!"
    elif completed_count < 6:
        level_num = 3
        level_title = "Guardián de Civilizaciones"
        level_icon = "🛡️"
        next_target = f"¡Te faltan {6 - completed_count} misión(es) para el Nivel 4!"
    elif completed_count < 9:
        level_num = 4
        level_title = "Cronista de la Historia"
        level_icon = "📜"
        next_target = f"¡Te faltan {9 - completed_count} misión(es) para el Nivel 5!"
    elif completed_count < 12:
        level_num = 5
        level_title = "Maestro de las Eras"
        level_icon = "🏛️"
        next_target = f"¡Te faltan {12 - completed_count} misión(es) para el Nivel Máximo!"
    else:
        level_num = 6
        level_title = "Gran Sabio del Tiempo Universal"
        level_icon = "👑"
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
            save_backup(db)

            # Actualizar última actividad en base de datos
            turso_db.save_user_profile(found_user["name"], found_user.get("grade", "1"))

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
            # Recargar de DB y respaldar
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

            # Recargar estado actualizado desde la BD
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
