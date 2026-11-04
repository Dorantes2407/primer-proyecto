# 📜 Historia Divertida ✨

Una aplicación web educativa y local diseñada especialmente para **pequeños historiadores** de educación primaria (1º a 6º de primaria).

## 🚀 Características Principales

- **👥 Historial Multiusuario y Selección de Perfil**:
  - Cada pequeño historiador (con su nombre o apodo) cuenta con su propio historial independiente de avance, medallas, nivel y temas dominados.
  - Al ingresar a la web, se visualiza la lista de usuarios ya registrados en tarjetas interactivas con su grado, nivel, barra de progreso y medallas ganadas.
  - Selección con un solo clic para continuar la partida de cualquier usuario registrado, o formulario para crear un nuevo pasaporte de explorador.
  - Opción para cambiar de usuario o eliminar un perfil en cualquier momento.
- **🎒 Selector de Grado Escolar**: Aventuras adaptadas de 1º a 6º de primaria:
  - 🦖 **1º Primaria:** Prehistoria y Dinosaurios
  - 🏺 **2º Primaria:** Antiguo Egipto y Faraones
  - 🏛️ **3º Primaria:** Antigua Grecia y el Imperio Romano
  - 🏰 **4º Primaria:** Culturas Mayas y Castillos Medievales
  - 🧭 **5º Primaria:** Tenochtitlan y Grandes Navegantes
  - 🚀 **6º Primaria:** Revolución de las Máquinas y el Viaje a la Luna
- **📊 Pantalla de Estadísticas y Nivel**:
  - Barra de nivel dinámica (desde *Nivel 1: Novato del Tiempo 🐣* hasta *Nivel 6: Gran Sabio del Tiempo Universal 👑*).
  - Dos columnas detalladas: **Temas que Dominas** vs. **Temas que no dominas tanto** (con botón directo de *Aceptar Reto*).
- **🏅 Salón de Medallas y Trivias**: Desafíos históricos interactivos por período para coleccionar insignias y ganar puntos XP.
- **💻 100% Local y Sin Dependencias**: Funciona inmediatamente con Python estándar (`http.server`, `json`, `webbrowser`). Cero instalación de librerías externas.
- **💾 Persistencia en `data.json`**: Guarda de forma permanente el avance de todos los pequeños historiadores.

## 🛠️ Cómo iniciar la aplicación

1. Abre la terminal en esta carpeta y ejecuta:
   ```powershell
   python app.py
   ```
   *(o presiona <kbd>F5</kbd> en Visual Studio Code)*.
2. Tu navegador se abrirá automáticamente en `http://localhost:5000`.
3. Selecciona un perfil ya existente o ingresa uno nuevo para empezar a viajar en el tiempo.
