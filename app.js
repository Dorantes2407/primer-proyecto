/**
 * Lógica de cliente para la Aplicación Local.
 * Se comunica con el backend de Python a través de Fetch API.
 */

let tasks = [];
let currentFilter = "all";

// Elementos del DOM
const taskForm = document.getElementById("task-form");
const taskTitleInput = document.getElementById("task-title");
const taskCategorySelect = document.getElementById("task-category");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const backendBadge = document.getElementById("backend-badge");
const backendStatusText = document.getElementById("backend-status-text");
const systemInfo = document.getElementById("system-info");

const statTotal = document.getElementById("stat-total");
const statPending = document.getElementById("stat-pending");
const statCompleted = document.getElementById("stat-completed");
const filterButtons = document.querySelectorAll(".filter-btn");

// 1. Verificar estado del servidor Python
async function checkBackendStatus() {
    try {
        const response = await fetch("/api/status");
        if (!response.ok) throw new Error("Servidor no disponible");
        
        const data = await response.json();
        backendBadge.className = "badge badge-online";
        backendStatusText.textContent = "Python Online";
        systemInfo.textContent = `Python ${data.python_version} | Sistema: ${data.platform} | Directorio: ${data.project_dir}`;
    } catch (error) {
        backendBadge.className = "badge badge-offline";
        backendStatusText.textContent = "Desconectado";
        systemInfo.textContent = "No se pudo conectar con el servidor local. Asegúrate de ejecutar 'python app.py'.";
    }
}

// 2. Cargar tareas desde el servidor
async function loadTasks() {
    try {
        const response = await fetch("/api/items");
        if (!response.ok) throw new Error("Error al obtener tareas");
        const data = await response.json();
        tasks = data.items || [];
        renderTasks();
    } catch (error) {
        console.error("Error al cargar tareas:", error);
    }
}

// 3. Crear una nueva tarea
async function handleAddTask(e) {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    const category = taskCategorySelect.value;

    if (!title) return;

    try {
        const response = await fetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, category }),
        });

        if (!response.ok) throw new Error("Error al guardar la tarea");
        const newItem = await response.json();

        tasks.push(newItem);
        taskTitleInput.value = "";
        renderTasks();
    } catch (error) {
        alert("No se pudo guardar la tarea. Revisa la consola para más detalles.");
        console.error(error);
    }
}

// 4. Cambiar estado completado / pendiente
async function toggleTask(id) {
    try {
        const response = await fetch("/api/items/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });

        if (!response.ok) throw new Error("Error al cambiar estado");
        const updated = await response.json();

        tasks = tasks.map(t => (t.id === id ? updated : t));
        renderTasks();
    } catch (error) {
        console.error("Error al alternar estado:", error);
    }
}

// 5. Eliminar tarea
async function deleteTask(id) {
    try {
        const response = await fetch("/api/items/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });

        if (!response.ok) throw new Error("Error al eliminar");
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
    } catch (error) {
        console.error("Error al eliminar la tarea:", error);
    }
}

// 6. Renderizar lista en la vista
function renderTasks() {
    taskList.innerHTML = "";

    const filtered = tasks.filter(task => {
        if (currentFilter === "pending") return !task.completed;
        if (currentFilter === "completed") return task.completed;
        return true;
    });

    if (filtered.length === 0) {
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");
    }

    filtered.forEach(task => {
        const li = document.createElement("li");
        li.className = `task-item ${task.completed ? "completed" : ""}`;

        li.innerHTML = `
            <div class="task-info">
                <input 
                    type="checkbox" 
                    ${task.completed ? "checked" : ""} 
                    class="task-checkbox"
                >
                <div class="task-text-container">
                    <span class="task-title">${escapeHtml(task.title)}</span>
                    <span class="task-category-tag tag-${task.category.toLowerCase()}">${task.category}</span>
                </div>
            </div>
            <button class="btn-delete" title="Eliminar tarea">✕</button>
        `;

        // Eventos
        const checkbox = li.querySelector(".task-checkbox");
        checkbox.addEventListener("change", () => toggleTask(task.id));

        const deleteBtn = li.querySelector(".btn-delete");
        deleteBtn.addEventListener("click", () => deleteTask(task.id));

        taskList.appendChild(li);
    });

    updateStats();
}

// 7. Actualizar contadores
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    statTotal.textContent = total;
    statPending.textContent = pending;
    statCompleted.textContent = completed;
}

// Función auxiliar de sanitización
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// 8. Event listeners
taskForm.addEventListener("submit", handleAddTask);

filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderTasks();
    });
});

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
    checkBackendStatus();
    loadTasks();
    // Actualizar estado periódicamente cada 10 segundos
    setInterval(checkBackendStatus, 10000);
});
