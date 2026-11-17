"""
Verificación in-memory exhaustiva para Historia Divertida sin depender de sockets de red.
"""

import io
import json
import app
import turso_db


class MockHTTPHandler:
    """Invoca la lógica de HistoryAppHandler directamente sin sockets."""

    def __init__(self):
        self.handler_class = app.HistoryAppHandler

    def get(self, path):
        rfile = io.BytesIO()
        wfile = io.BytesIO()

        # Instancia ficticia
        instance = object.__new__(self.handler_class)
        instance.path = path
        instance.rfile = rfile
        instance.wfile = wfile
        instance.headers = {}
        status_holder = {}

        def mock_send_response(code, message=None):
            status_holder["code"] = code

        def mock_send_header(keyword, value):
            pass

        def mock_end_headers():
            pass

        instance.send_response = mock_send_response
        instance.send_header = mock_send_header
        instance.end_headers = mock_end_headers

        instance.do_GET()

        output_bytes = wfile.getvalue()
        try:
            body = json.loads(output_bytes.decode("utf-8")) if output_bytes else None
        except Exception:
            body = output_bytes.decode("utf-8")

        return status_holder.get("code", 200), body

    def post(self, path, payload_dict):
        body_bytes = json.dumps(payload_dict).encode("utf-8")
        rfile = io.BytesIO(body_bytes)
        wfile = io.BytesIO()

        instance = object.__new__(self.handler_class)
        instance.path = path
        instance.rfile = rfile
        instance.wfile = wfile
        instance.headers = {"Content-Length": str(len(body_bytes))}
        status_holder = {}

        def mock_send_response(code, message=None):
            status_holder["code"] = code

        def mock_send_header(keyword, value):
            pass

        def mock_end_headers():
            pass

        instance.send_response = mock_send_response
        instance.send_header = mock_send_header
        instance.end_headers = mock_end_headers

        instance.do_POST()

        output_bytes = wfile.getvalue()
        try:
            body = json.loads(output_bytes.decode("utf-8")) if output_bytes else None
        except Exception:
            body = output_bytes.decode("utf-8")

        return status_holder.get("code", 200), body


def run_tests():
    print("=" * 65)
    print("🧪 INICIANDO VERIFICACIÓN DE PROGRESIÓN DE GRADOS Y BLOQUEO")
    print("=" * 65)

    client = MockHTTPHandler()

    # 0. Limpieza previa
    client.post("/api/reset-profile", {})
    client.post("/api/users/delete", {"id": "exploradortest1"})
    client.post("/api/users/delete", {"id": "exploradortest2"})

    # =====================================================================
    # CASO 1: REGISTRO Y GRADO INCOMPLETO (ExploradorTest1 en Grado 1)
    # =====================================================================
    print("\n--- CASO 1: Grado Incompleto y Bloqueo de Grados ---")
    status, res = client.post("/api/profile", {"name": "ExploradorTest1", "grade": "1"})
    assert status == 200, f"Error al crear perfil: {res}"
    assert res["historian"]["grade"] == "1"
    prog = res["progression"]
    assert prog["active_grade"] == "1"
    assert prog["grades"]["1"]["is_active"] is True
    assert prog["grades"]["1"]["is_locked"] is False
    assert prog["grades"]["2"]["is_locked"] is True
    assert prog["grades"]["3"]["is_locked"] is True
    assert prog["grades"]["4"]["is_locked"] is True
    assert prog["grades"]["5"]["is_locked"] is True
    assert prog["grades"]["6"]["is_locked"] is True
    assert "La Primera Fogata de la Humanidad" in prog["grades"]["1"]["requirement_text"]
    print("✓ Perfil creado con Grado 1 activo.")

    # Intentar acceder a Grado 2 (posterior bloqueado) -> Esperar HTTP 403
    status_g2, res_g2 = client.get("/api/stories?grade=2")
    assert status_g2 == 403, f"Se esperaba 403 para grado bloqueado 2, se obtuvo {status_g2}"
    assert res_g2["error"] == "grade_locked"
    assert "Grado bloqueado" in res_g2["lock_reason"]
    print(f"✓ Grado 2 bloqueado por el servidor con HTTP 403: {res_g2['lock_reason'][:70]}...")

    # Acceder a Grado 1 (activo) -> Esperar HTTP 200
    status_g1, res_g1 = client.get("/api/stories?grade=1")
    assert status_g1 == 200, f"Error al cargar historias de grado activo: {res_g1}"
    assert len(res_g1["stories"]) == 2
    assert res_g1["stories"][0]["id"] == "1-1"
    print("✓ Grado activo 1 accesible correctamente con HTTP 200 (2 misiones disponibles).")

    # =====================================================================
    # CASO 2: COMPLETAR PARCIALMENTE Y LUEGO COMPLETAR EL GRADO
    # =====================================================================
    print("\n--- CASO 2: Completar Grado y Desbloqueo Automático ---")
    # 1. Completar primera historia de grado 1 (1-1: Triceratops, opción 1)
    status_m1, res_m1 = client.post("/api/complete-mission", {"story_id": "1-1", "selected_option": 1})
    assert status_m1 == 200 and res_m1["correct"] is True
    assert res_m1["grade_completed"] is False, "Aún no debe completar el grado con 1 sola misión"
    assert res_m1["progression"]["active_grade"] == "1"
    assert res_m1["progression"]["grades"]["1"]["completed_count"] == 1
    print("✓ Misión 1-1 completada. Grado activo sigue siendo 1 (1 de 2 completadas).")

    # Intentar acceder a Grado 2 todavía bloqueado -> Esperar HTTP 403
    status_g2_still, _ = client.get("/api/stories?grade=2")
    assert status_g2_still == 403, "Grado 2 no debería estar accesible antes de terminar 1-2"
    print("✓ Grado 2 continúa estrictamente bloqueado (falta 1 misión).")

    # 2. Completar segunda historia de grado 1 (1-2: Fuego/cuevas, opción 1)
    status_m2, res_m2 = client.post("/api/complete-mission", {"story_id": "1-2", "selected_option": 1})
    assert status_m2 == 200 and res_m2["correct"] is True
    assert res_m2["grade_completed"] is True, "¡Debe detectar grado completado!"
    assert res_m2["new_grade"] == "2", f"El nuevo grado debe ser 2, se obtuvo {res_m2['new_grade']}"
    assert "desbloqueado 2º de Primaria" in res_m2["congrats_message"]
    assert res_m2["progression"]["active_grade"] == "2"
    print("✓ Misión 1-2 completada. ¡Grado 1 finalizado, grado 2 desbloqueado!")
    print(f"  Mensaje de felicitación: {res_m2['congrats_message'][:75]}...")

    # =====================================================================
    # CASO 3: RECARGA DE LA APLICACIÓN (F5) Y BLOQUEO DE ANTERIORES
    # =====================================================================
    print("\n--- CASO 3: Recarga de la App (F5) y Persistencia de Grado Activo ---")
    status_prof, res_prof = client.get("/api/profile")
    assert status_prof == 200
    assert res_prof["historian"]["grade"] == "2", f"El grado persistente debe ser 2, se obtuvo {res_prof['historian']['grade']}"
    assert set(res_prof["completed_stories"]) == {"1-1", "1-2"}
    assert len(res_prof["badges"]) == 2
    assert res_prof["progression"]["active_grade"] == "2"
    assert res_prof["progression"]["grades"]["1"]["status"] == "completed"
    assert res_prof["progression"]["grades"]["1"]["is_locked"] is True
    print("✓ Al recargar (/api/profile), el grado activo persiste como 2 y conserva todas las medallas.")

    # Acceso al nuevo grado activo 2 -> HTTP 200
    status_g2_now, res_g2_now = client.get("/api/stories?grade=2")
    assert status_g2_now == 200
    assert len(res_g2_now["stories"]) == 2
    print("✓ Grado 2 ahora responde HTTP 200 y entrega sus relatos.")

    # Intentar acceder a Grado 1 (anterior ya completado) -> HTTP 403 (bloqueado durante la partida)
    status_g1_back, res_g1_back = client.get("/api/stories?grade=1")
    assert status_g1_back == 403, f"El grado anterior debe estar bloqueado durante la partida, se obtuvo {status_g1_back}"
    print(f"✓ Grado anterior 1 bloqueado con HTTP 403: {res_g1_back['lock_reason'][:70]}...")

    # =====================================================================
    # CASO 4: CAMBIO DE SESIÓN ENTRE USUARIOS DISTINTOS
    # =====================================================================
    print("\n--- CASO 4: Cambio de Sesión y Múltiples Historiadores ---")
    # Cerrar sesión del usuario actual
    status_reset, _ = client.post("/api/reset-profile", {})
    assert status_reset == 200

    # Crear nuevo usuario independiente en Grado 3
    status_u2, res_u2 = client.post("/api/profile", {"name": "ExploradorTest2", "grade": "3"})
    assert status_u2 == 200
    assert res_u2["historian"]["grade"] == "3"
    assert res_u2["progression"]["active_grade"] == "3"
    print("✓ Segundo usuario creado con Grado 3 activo.")

    # Verificar que segundo usuario no puede acceder a Grado 1, 2 ni 4
    assert client.get("/api/stories?grade=1")[0] == 403
    assert client.get("/api/stories?grade=2")[0] == 403
    assert client.get("/api/stories?grade=4")[0] == 403
    assert client.get("/api/stories?grade=3")[0] == 200
    print("✓ Segundo usuario tiene Grados 1, 2 y 4 bloqueados, y Grado 3 activo.")

    # Cambiar de sesión de vuelta a ExploradorTest1
    status_sel, res_sel = client.post("/api/users/select", {"name": "ExploradorTest1"})
    assert status_sel == 200
    assert res_sel["historian"]["grade"] == "2"
    assert res_sel["progression"]["active_grade"] == "2"
    assert set(res_sel["completed_stories"]) == {"1-1", "1-2"}
    print("✓ Cambio de vuelta a ExploradorTest1 exitoso: mantiene su grado activo 2 y sus misiones completadas.")

    # =====================================================================
    # CASO 5: VERIFICACIÓN EN BASE DE DATOS Y RESPALDO data.json
    # =====================================================================
    print("\n--- CASO 5: Verificación de Persistencia en BD y data.json ---")
    db_state = app.load_database()
    assert "exploradortest1" in db_state["users"]
    user1_stored = db_state["users"]["exploradortest1"]
    assert user1_stored["grade"] == "2"
    assert set(user1_stored["completed_stories"]) == {"1-1", "1-2"}
    print("✓ Datos verificados en SQLite/Turso y data.json:")
    print(f"  Usuario: {user1_stored['name']}, Grado activo: {user1_stored['grade']}, Historias completadas: {user1_stored['completed_stories']}")

    # =====================================================================
    # LIMPIEZA DE USUARIOS DE PRUEBA
    # =====================================================================
    print("\n--- Limpieza de Usuarios de Prueba ---")
    client.post("/api/users/delete", {"id": "exploradortest1"})
    client.post("/api/users/delete", {"id": "exploradortest2"})
    client.post("/api/reset-profile", {})
    print("✓ Usuarios de prueba eliminados correctamente.")

    print("\n" + "=" * 65)
    print("🎉 ¡TODAS LAS PRUEBAS DE PROGRESIÓN PASARON CON ÉXITO! (100%)")
    print("=" * 65)


if __name__ == "__main__":
    run_tests()
