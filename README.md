# Gestor de Tareas y Notas Local

Aplicación local desarrollada con **Python** (backend y servidor HTTP local) y **HTML5 + JavaScript + CSS3** (frontend interactivo).

## 🚀 Características
- **Cero dependencias externas**: Funciona directamente con la librería estándar de Python (`http.server`, `json`, `webbrowser`). No requiere `pip install`.
- **Apertura automática**: Al iniciar el servidor, abre automáticamente tu navegador predeterminado en `http://localhost:5000`.
- **Persistencia local**: Guarda y lee los datos en un archivo local `data.json`.
- **API REST**: Endpoints `/api/items`, `/api/status`, etc.
- **Interfaz moderna**: Diseño responsivo, filtros (todas, pendientes, completadas), estadísticas en tiempo real y etiquetas por categoría.

## 🛠️ Cómo ejecutar el proyecto

### Opción 1: Desde la terminal
Ejecuta el siguiente comando en la carpeta del proyecto:
```bash
python app.py
```

### Opción 2: Desde Visual Studio Code
1. Abre el archivo `app.py`.
2. Presiona `F5` o el botón **Run Python File** (ícono de reproducir en la esquina superior derecha).
3. Tu navegador se abrirá en `http://localhost:5000`.

## 📁 Estructura del Proyecto
- `app.py`: Servidor backend en Python con API REST y servidor de archivos estáticos.
- `index.html`: Estructura principal de la interfaz web.
- `app.js`: Lógica del cliente, llamadas a la API y reactividad.
- `style.css`: Estilos visuales modernos.
- `data.json`: Base de datos local en formato JSON (se genera automáticamente).
