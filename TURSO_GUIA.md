# 🗄️ Guía Paso a Paso para Crear y Conectar tu Base de Datos en Turso

[Turso](https://turso.tech) es una base de datos distribuida en la nube basada en **libSQL / SQLite**, ideal para este proyecto porque:
- Tiene un plan gratuito muy generoso.
- Es ultrarrápida y compatible con las sentencias SQL de SQLite.
- Permite que tu aplicación guarde el avance de los pequeños historiadores en la nube.

---

## 📌 Opción 1: Crear la Base de Datos desde la Web (Recomendado, Sin Instalar Nada)

1. **Crear tu cuenta:**
   - Ve a [https://turso.tech](https://turso.tech) y haz clic en **Sign Up** (puedes iniciar sesión con tu cuenta de GitHub).
2. **Crear una nueva base de datos:**
   - En tu panel de control (*Dashboard*), haz clic en el botón **Create Database**.
   - Nombre de la base de datos: `historia-divertida`.
   - Selecciona la región más cercana a ti y haz clic en **Create Database**.
3. **Obtener la URL de conexión:**
   - En la página de tu base de datos verás la URL con formato:
     `libsql://historia-divertida-tu-usuario.turso.io`
4. **Generar el Token de Autenticación (Auth Token):**
   - En la pestaña **Settings** o **Generate Token**, crea un nuevo token de acceso y cópialo.
5. **Ejecutar el esquema SQL:**
   - En el menú lateral de Turso, entra a **Editor** o **SQL Shell**.
   - Abre el archivo [`schema.sql`](schema.sql) de este proyecto, copia todo su contenido, pégalo en el editor de Turso y presiona **Execute**. ¡Listo, tus tablas estarán creadas!

---

## 📌 Opción 2: Crear la Base de Datos desde la Terminal (Turso CLI)

Si prefieres usar la consola de PowerShell en Windows:

1. **Instalar Turso CLI:**
   ```powershell
   irm https://get.tur.so/install.ps1 | iex
   ```
2. **Iniciar sesión:**
   ```powershell
   turso auth signup
   # o si ya tienes cuenta:
   turso auth login
   ```
3. **Crear la base de datos:**
   ```powershell
   turso db create historia-divertida
   ```
4. **Obtener la URL y el Token:**
   ```powershell
   # Ver URL:
   turso db show historia-divertida --url

   # Crear y ver Token:
   turso db tokens create historia-divertida
   ```
5. **Aplicar el esquema de tablas:**
   ```powershell
   turso db shell historia-divertida < schema.sql
   ```

---

## ⚙️ Conectar Turso a tu Aplicación

1. En la carpeta de tu proyecto, crea un archivo llamado `.env` (puedes duplicar el archivo `.env.example`).
2. Pega tu URL y Token:
   ```env
   TURSO_DATABASE_URL=libsql://historia-divertida-tu-usuario.turso.io
   TURSO_AUTH_TOKEN=tu_token_secreto_de_turso_aqui
   ```
3. **Migrar tus usuarios existentes a Turso (opcional):**
   Para subir a Turso a los usuarios que ya tenías creados (como `daya`), ejecuta:
   ```powershell
   python turso_db.py migrate
   ```
4. **Iniciar la aplicación:**
   ```powershell
   python app.py
   ```
   Verás en la consola:
   ```text
   🗄️  Base de Datos: ☁️ Turso Cloud (LibSQL)
   ```

> [!NOTE]
> Si no configuras las credenciales de Turso en `.env`, el proyecto seguirá funcionando automáticamente con la base de datos local **SQLite (`historia.db`)** sin que tengas que cambiar nada en el código.
