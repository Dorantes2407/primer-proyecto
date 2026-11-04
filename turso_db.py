"""
Módulo de Base de Datos para 'Historia Divertida' compatible con Turso (LibSQL) y SQLite local.
Optimizado para eliminar consultas N+1 y mejorar drásticamente el rendimiento en la nube.
"""

import json
import os
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
LOCAL_DB_FILE = BASE_DIR / "historia.db"
SCHEMA_FILE = BASE_DIR / "schema.sql"
ENV_FILE = BASE_DIR / ".env"


def load_env():
    """Lee variables del archivo .env si existe."""
    if ENV_FILE.exists():
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except Exception as e:
            print(f"Aviso al leer .env: {e}")


load_env()

TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "").strip()
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "").strip()


def is_turso_configured():
    """Verifica si las credenciales de Turso están configuradas."""
    return bool(TURSO_URL and TURSO_TOKEN)


class TursoHttpClient:
    """Cliente HTTP ligero para Turso (LibSQL v2 pipeline) con urllib estándar."""

    def __init__(self, db_url, auth_token):
        clean_url = db_url.replace("libsql://", "https://")
        if not clean_url.startswith("http"):
            clean_url = f"https://{clean_url}"
        self.endpoint = f"{clean_url.rstrip('/')}/v2/pipeline"
        self.auth_token = auth_token

    def execute_batch(self, statements):
        """Ejecuta una lista de consultas (sql, args) en Turso."""
        requests_payload = []
        for stmt in statements:
            sql = stmt[0] if isinstance(stmt, (tuple, list)) else stmt
            args = stmt[1] if isinstance(stmt, (tuple, list)) and len(stmt) > 1 else []

            formatted_args = []
            for arg in args:
                if arg is None:
                    formatted_args.append({"type": "null"})
                elif isinstance(arg, int):
                    formatted_args.append({"type": "integer", "value": str(arg)})
                elif isinstance(arg, float):
                    formatted_args.append({"type": "float", "value": arg})
                else:
                    formatted_args.append({"type": "text", "value": str(arg)})

            requests_payload.append({
                "type": "execute",
                "stmt": {
                    "sql": sql,
                    "args": formatted_args
                }
            })

        requests_payload.append({"type": "close"})

        payload_bytes = json.dumps({"requests": requests_payload}).encode("utf-8")
        req = urllib.request.Request(
            self.endpoint,
            data=payload_bytes,
            headers={
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result.get("results", [])
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Error HTTP en Turso ({e.code}): {err_msg}")
        except Exception as e:
            raise RuntimeError(f"Error de conexión con Turso: {e}")

    def execute(self, sql, args=None):
        """Ejecuta una sentencia y devuelve filas con nombres de columna."""
        args = args or []
        results = self.execute_batch([(sql, args)])
        if not results:
            return []

        first_res = results[0]
        if first_res.get("type") == "error":
            raise RuntimeError(f"Error en sentencia SQL Turso: {first_res.get('error', {}).get('message')}")

        response = first_res.get("response", {})
        result_data = response.get("result", {})
        cols = [c["name"] for c in result_data.get("cols", [])]
        rows = result_data.get("rows", [])

        parsed_rows = []
        for r in rows:
            row_dict = {}
            for idx, col_name in enumerate(cols):
                val_obj = r[idx] if idx < len(r) else None
                if isinstance(val_obj, dict):
                    val = val_obj.get("value")
                    val_type = val_obj.get("type")
                    if val_type == "integer" and val is not None:
                        val = int(val)
                    elif val_type == "float" and val is not None:
                        val = float(val)
                    elif val_type == "null":
                        val = None
                else:
                    val = val_obj
                row_dict[col_name] = val
            parsed_rows.append(row_dict)

        return parsed_rows


class LocalSqliteClient:
    """Cliente para base de datos local SQLite."""

    def __init__(self, db_path=LOCAL_DB_FILE):
        self.db_path = str(db_path)

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def execute(self, sql, args=None):
        args = args or []
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, args)
            conn.commit()
            if cursor.description:
                cols = [d[0] for d in cursor.description]
                return [dict(zip(cols, row)) for row in cursor.fetchall()]
            return []

    def execute_script(self, sql_script):
        with self._get_conn() as conn:
            conn.executescript(sql_script)
            conn.commit()


def get_db():
    """Obtiene la instancia de cliente activa (Turso o SQLite local)."""
    if is_turso_configured():
        return TursoHttpClient(TURSO_URL, TURSO_TOKEN)
    return LocalSqliteClient()


def init_database():
    """Inicializa las tablas en la base de datos (Turso o local)."""
    if not SCHEMA_FILE.exists():
        return

    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    db = get_db()
    if isinstance(db, LocalSqliteClient):
        db.execute_script(schema_sql)
        print("✅ Base de datos SQLite local inicializada (historia.db)")
    else:
        statements = [s.strip() for s in schema_sql.split(";") if s.strip()]
        for stmt in statements:
            db.execute(stmt)
        print("✅ Base de datos en la nube Turso inicializada con éxito")


def load_all_users_from_db():
    """Carga todos los usuarios con sus medallas, historias e intentos de forma altamente optimizada."""
    db = get_db()

    try:
        users = db.execute("SELECT id, name, grade, created_at, last_active FROM users ORDER BY last_active DESC")
    except Exception as e:
        print(f"Tablas no encontradas o vacías, inicializando esquema: {e}")
        init_database()
        users = db.execute("SELECT id, name, grade, created_at, last_active FROM users ORDER BY last_active DESC")

    if not users:
        return {}

    # 🚀 OPTIMIZACIÓN: Descargar todas las relaciones de una sola vez (evitando consultas N+1)
    try:
        all_badges = db.execute("SELECT user_id, badge_name FROM badges ORDER BY id ASC")
    except Exception:
        all_badges = []

    try:
        all_completed = db.execute("SELECT user_id, story_id FROM completed_stories ORDER BY id ASC")
    except Exception:
        all_completed = []

    try:
        all_attempted = db.execute("SELECT user_id, story_id, attempts, wrong_count, correct FROM attempted_stories")
    except Exception:
        all_attempted = []

    # Agrupar medallas por usuario en memoria
    badges_map = {}
    for b in all_badges:
        uid = b["user_id"]
        badges_map.setdefault(uid, []).append(b["badge_name"])

    # Agrupar historias completadas por usuario en memoria
    completed_map = {}
    for c in all_completed:
        uid = c["user_id"]
        completed_map.setdefault(uid, []).append(c["story_id"])

    # Agrupar intentos por usuario en memoria
    attempted_map = {}
    for a in all_attempted:
        uid = a["user_id"]
        attempted_map.setdefault(uid, {})[a["story_id"]] = {
            "attempts": a["attempts"],
            "wrong_count": a["wrong_count"],
            "correct": bool(a["correct"])
        }

    # Construir el diccionario final combinando los mapas
    users_dict = {}
    for u in users:
        uid = u["id"]
        users_dict[uid] = {
            "id": uid,
            "name": u["name"],
            "grade": u["grade"],
            "created_at": u["created_at"],
            "last_active": u["last_active"],
            "badges": badges_map.get(uid, []),
            "completed_stories": completed_map.get(uid, []),
            "attempted_stories": attempted_map.get(uid, {})
        }

    return users_dict


def save_user_profile(name, grade):
    """Crea o actualiza el perfil de un usuario en la base de datos."""
    db = get_db()
    uid = name.strip().lower()
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    existing = db.execute("SELECT id, created_at FROM users WHERE id = ?", [uid])
    if existing:
        db.execute(
            "UPDATE users SET name = ?, grade = ?, last_active = ? WHERE id = ?",
            [name.strip(), grade, now_str, uid]
        )
    else:
        db.execute(
            "INSERT INTO users (id, name, grade, created_at, last_active) VALUES (?, ?, ?, ?, ?)",
            [uid, name.strip(), grade, now_str, now_str]
        )

    return uid


def delete_user_from_db(user_id):
    """Elimina a un usuario y todos sus avances en cascada."""
    db = get_db()
    db.execute("DELETE FROM users WHERE id = ?", [user_id.strip().lower()])


def record_mission_completed(user_id, story_id, badge_name):
    """Registra una misión ganada y su medalla en la base de datos."""
    db = get_db()
    uid = user_id.strip().lower()
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    db.execute(
        "INSERT OR IGNORE INTO completed_stories (user_id, story_id, completed_at) VALUES (?, ?, ?)",
        [uid, story_id, now_str]
    )

    db.execute(
        "INSERT OR IGNORE INTO badges (user_id, badge_name, earned_at) VALUES (?, ?, ?)",
        [uid, badge_name, now_str]
    )

    db.execute(
        """
        INSERT INTO attempted_stories (user_id, story_id, attempts, wrong_count, correct)
        VALUES (?, ?, 1, 0, 1)
        ON CONFLICT(user_id, story_id) DO UPDATE SET
            attempts = attempts + 1,
            correct = 1
        """,
        [uid, story_id]
    )

    db.execute("UPDATE users SET last_active = ? WHERE id = ?", [now_str, uid])


def record_mission_wrong(user_id, story_id):
    """Registra un intento incorrecto en la base de datos."""
    db = get_db()
    uid = user_id.strip().lower()

    db.execute(
        """
        INSERT INTO attempted_stories (user_id, story_id, attempts, wrong_count, correct)
        VALUES (?, ?, 1, 1, 0)
        ON CONFLICT(user_id, story_id) DO UPDATE SET
            attempts = attempts + 1,
            wrong_count = wrong_count + 1
        """,
        [uid, story_id]
    )


def migrate_json_to_db(json_path=BASE_DIR / "data.json"):
    """Copia los datos de data.json a Turso o SQLite local."""
    if not Path(json_path).exists():
        print(f"No se encontró {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    users = data.get("users", {})
    if not users and data.get("current_historian"):
        ch = data["current_historian"]
        uid = ch["name"].strip().lower()
        users[uid] = {
            "id": uid,
            "name": ch["name"],
            "grade": ch.get("grade", "1"),
            "created_at": "29/10/2026",
            "last_active": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "badges": data.get("badges", []),
            "completed_stories": data.get("completed_stories", []),
            "attempted_stories": data.get("attempted_stories", {})
        }

    init_database()
    db = get_db()

    for uid, u in users.items():
        name = u.get("name", uid)
        grade = str(u.get("grade", "1"))
        created = u.get("created_at", datetime.now().strftime("%d/%m/%Y %H:%M"))
        last_active = u.get("last_active", datetime.now().strftime("%d/%m/%Y %H:%M"))

        db.execute(
            "INSERT OR REPLACE INTO users (id, name, grade, created_at, last_active) VALUES (?, ?, ?, ?, ?)",
            [uid, name, grade, created, last_active]
        )

        for b in u.get("badges", []):
            db.execute(
                "INSERT OR IGNORE INTO badges (user_id, badge_name) VALUES (?, ?)",
                [uid, b]
            )

        for s in u.get("completed_stories", []):
            db.execute(
                "INSERT OR IGNORE INTO completed_stories (user_id, story_id) VALUES (?, ?)",
                [uid, s]
            )

        for sid, att in u.get("attempted_stories", {}).items():
            db.execute(
                """
                INSERT OR REPLACE INTO attempted_stories (user_id, story_id, attempts, wrong_count, correct)
                VALUES (?, ?, ?, ?, ?)
                """,
                [uid, sid, att.get("attempts", 1), att.get("wrong_count", 0), 1 if att.get("correct") else 0]
            )

    target_name = "Turso en la nube" if is_turso_configured() else "SQLite local (historia.db)"
    print(f"🎉 Migración exitosa de {len(users)} usuario(s) a {target_name}!")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "migrate":
        migrate_json_to_db()
    else:
        init_database()