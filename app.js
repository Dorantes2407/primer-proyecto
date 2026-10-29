/**
 * Historia Divertida - Lógica de interacción para Pequeños Historiadores
 */

let currentHistorian = null;
let currentGrade = "1";
let badges = [];
let completedStories = [];

// Elementos del DOM - Pantalla de Bienvenida
const welcomeScreen = document.getElementById("welcome-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const statsScreen = document.getElementById("stats-screen");

const onboardingForm = document.getElementById("onboarding-form");
const explorerNameInput = document.getElementById("explorer-name");
const selectedGradeInput = document.getElementById("selected-grade");
const gradeCards = document.querySelectorAll(".grade-card");

// Elementos del DOM - Tablero
const displayHistorianName = document.getElementById("display-historian-name");
const displayGradeText = document.getElementById("display-grade-text");
const btnSwitchHistorian = document.getElementById("btn-switch-historian");
const btnViewStats = document.getElementById("btn-view-stats");
const badgeCount = document.getElementById("badge-count");
const badgesContainer = document.getElementById("badges-container");
const dashboardGradeTabs = document.querySelectorAll("#dashboard-grade-tabs .tab-btn");
const storiesContainer = document.getElementById("stories-container");
const serverStatus = document.getElementById("server-status");

// Elementos del DOM - Pantalla de Estadísticas
const btnBackToDashboard = document.getElementById("btn-back-to-dashboard");
const statsHistorianName = document.getElementById("stats-historian-name");
const statsLevelIcon = document.getElementById("stats-level-icon");
const statsLevelTitle = document.getElementById("stats-level-title");
const statsXpValue = document.getElementById("stats-xp-value");
const statsLevelBarFill = document.getElementById("stats-level-bar-fill");
const statsProgressPercent = document.getElementById("stats-progress-percent");
const statsNextTarget = document.getElementById("stats-next-target");
const masteredCount = document.getElementById("mastered-count");
const notMasteredCount = document.getElementById("not-mastered-count");
const masteredTopicsList = document.getElementById("mastered-topics-list");
const notMasteredTopicsList = document.getElementById("not-mastered-topics-list");

// Nombres descriptivos de los grados escolares
const GRADE_NAMES = {
    "1": "1º de Primaria (Prehistoria y Dinosaurios)",
    "2": "2º de Primaria (Antiguo Egipto y Faraones)",
    "3": "3º de Primaria (Grecia y Roma Antigua)",
    "4": "4º de Primaria (Mayas y Castillos Medievales)",
    "5": "5º de Primaria (Mesoamérica y Grandes Navegantes)",
    "6": "6º de Primaria (Revoluciones y Viaje a la Luna)"
};

// 1. Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", async () => {
    setupGradeCardSelection();
    setupDashboardTabs();
    setupEventListeners();
    await checkProfile();
});

// 2. Comprobar si ya hay un pequeño historiador registrado
async function checkProfile() {
    try {
        const response = await fetch("/api/profile");
        if (!response.ok) throw new Error("No se pudo conectar con el servidor local");

        const data = await response.json();
        badges = data.badges || [];
        completedStories = data.completed_stories || [];

        if (data.historian && data.historian.name) {
            currentHistorian = data.historian;
            currentGrade = String(currentHistorian.grade || "1");
            showDashboard();
        } else {
            showWelcomeScreen();
        }
    } catch (error) {
        console.warn("Servidor local no disponible o cargando modo offline:", error);
        serverStatus.textContent = "Modo demostración local (ejecuta 'python app.py' para guardar avances).";
        showWelcomeScreen();
    }
}

// 3. Selección interactiva de grado escolar en el inicio
function setupGradeCardSelection() {
    gradeCards.forEach(card => {
        card.addEventListener("click", () => {
            gradeCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            const grade = card.dataset.grade;
            selectedGradeInput.value = grade;
        });
    });
}

// 4. Configurar pestañas de grados en el tablero principal
function setupDashboardTabs() {
    dashboardGradeTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            dashboardGradeTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentGrade = tab.dataset.grade;
            loadStories(currentGrade);
        });
    });
}

// 5. Configurar eventos del formulario y botones
function setupEventListeners() {
    // Enviar formulario de inicio
    onboardingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = explorerNameInput.value.trim();
        const grade = selectedGradeInput.value;

        if (!name) {
            alert("¡Por favor escribe tu nombre o apodo, pequeño historiador!");
            explorerNameInput.focus();
            return;
        }

        try {
            const response = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, grade })
            });

            if (!response.ok) throw new Error("Error al registrar perfil");

            const result = await response.json();
            currentHistorian = result.historian;
            currentGrade = grade;
            showDashboard();
        } catch (error) {
            console.error("Error al guardar perfil:", error);
            currentHistorian = { name, grade };
            currentGrade = grade;
            showDashboard();
        }
    });

    // Botón para cambiar de pequeño historiador
    btnSwitchHistorian.addEventListener("click", async () => {
        const confirmar = confirm("¿Deseas cambiar o ingresar como otro pequeño historiador?");
        if (!confirmar) return;

        try {
            await fetch("/api/reset-profile", { method: "POST" });
        } catch (err) {
            console.error(err);
        }

        currentHistorian = null;
        explorerNameInput.value = "";
        showWelcomeScreen();
    });

    // Botón para ver estadísticas
    btnViewStats.addEventListener("click", () => {
        showStatsScreen();
    });

    // Botón para regresar al tablero desde estadísticas
    btnBackToDashboard.addEventListener("click", () => {
        showDashboard();
    });
}

// 6. Transiciones de pantalla
function showWelcomeScreen() {
    dashboardScreen.classList.remove("active");
    statsScreen.classList.remove("active");
    welcomeScreen.classList.add("active");
    explorerNameInput.focus();
}

function showDashboard() {
    welcomeScreen.classList.remove("active");
    statsScreen.classList.remove("active");
    dashboardScreen.classList.add("active");

    // Actualizar textos con el nombre del usuario
    displayHistorianName.textContent = currentHistorian.name;
    displayGradeText.textContent = GRADE_NAMES[currentGrade] || `${currentGrade}º de Primaria`;

    // Sincronizar pestaña activa
    dashboardGradeTabs.forEach(tab => {
        if (tab.dataset.grade === currentGrade) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    renderBadges();
    loadStories(currentGrade);
}

function showStatsScreen() {
    welcomeScreen.classList.remove("active");
    dashboardScreen.classList.remove("active");
    statsScreen.classList.add("active");

    statsHistorianName.textContent = currentHistorian.name;
    loadStats();
}

// 7. Cargar relatos y trivias por grado escolar
async function loadStories(grade, targetStoryId = null) {
    storiesContainer.innerHTML = `<div class="loading-state">⏳ Viajando en el tiempo al grado ${grade}º...</div>`;

    try {
        const response = await fetch(`/api/stories?grade=${grade}`);
        if (!response.ok) throw new Error("Error al consultar historias");

        const data = await response.json();
        renderStories(data.stories || []);

        if (targetStoryId) {
            setTimeout(() => {
                const targetElement = document.getElementById(`story-card-${targetStoryId}`);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
                    targetElement.classList.add("highlight-pulse");
                    setTimeout(() => targetElement.classList.remove("highlight-pulse"), 2500);
                }
            }, 100);
        }
    } catch (error) {
        console.error("Error cargando relatos:", error);
        storiesContainer.innerHTML = `<p class="error-msg">No se pudieron cargar los relatos. Verifica que el servidor Python esté encendido.</p>`;
    }
}

// 8. Renderizar tarjetas de relatos y trivias
function renderStories(stories) {
    storiesContainer.innerHTML = "";

    if (stories.length === 0) {
        storiesContainer.innerHTML = `<p class="empty-state">No hay misiones disponibles para este grado en este momento.</p>`;
        return;
    }

    stories.forEach(story => {
        const isCompleted = completedStories.includes(story.id);

        const card = document.createElement("article");
        card.className = `story-card ${isCompleted ? "completed-mission" : ""}`;
        card.id = `story-card-${story.id}`;

        const optionsHtml = story.trivia.options.map((opt, idx) => `
            <button 
                type="button" 
                class="trivia-option-btn ${isCompleted && idx === story.trivia.answer ? 'correct' : ''}" 
                data-story-id="${story.id}" 
                data-option-idx="${idx}"
                ${isCompleted ? "disabled" : ""}
            >
                <span class="option-bullet">${String.fromCharCode(65 + idx)}</span>
                <span class="option-text">${escapeHtml(opt)}</span>
            </button>
        `).join("");

        card.innerHTML = `
            <div class="story-header">
                <span class="story-icon">${story.icon}</span>
                <div class="story-header-text">
                    <span class="story-period">${escapeHtml(story.period)}</span>
                    <h4>${escapeHtml(story.title)}</h4>
                </div>
                ${isCompleted ? '<span class="status-badge-earned">🏅 ¡Medalla Ganada!</span>' : ''}
            </div>

            <div class="story-body">
                <p class="story-summary">${escapeHtml(story.summary)}</p>

                <div class="fun-fact-box">
                    <span class="fact-icon">💡</span>
                    <p><strong>Dato curioso para el pequeño historiador:</strong> ${escapeHtml(story.fun_fact)}</p>
                </div>
            </div>

            <div class="story-trivia">
                <div class="trivia-header">
                    <span class="trivia-badge">🎯 Reto de la Época</span>
                    <p class="trivia-question">${escapeHtml(story.trivia.question)}</p>
                </div>
                <div class="trivia-options-list">
                    ${optionsHtml}
                </div>
                <div class="trivia-feedback hidden" id="feedback-${story.id}"></div>
            </div>
        `;

        // Agregar eventos a las opciones de trivia
        const optionButtons = card.querySelectorAll(".trivia-option-btn");
        optionButtons.forEach(btn => {
            btn.addEventListener("click", () => handleAnswer(story.id, parseInt(btn.dataset.optionIdx, 10), card));
        });

        storiesContainer.appendChild(card);
    });
}

// 9. Manejar la respuesta a la trivia histórica
async function handleAnswer(storyId, selectedOption, cardElement) {
    const feedbackBox = cardElement.querySelector(`#feedback-${storyId}`);
    const optionButtons = cardElement.querySelectorAll(".trivia-option-btn");

    try {
        const response = await fetch("/api/complete-mission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ story_id: storyId, selected_option: selectedOption })
        });

        const result = await response.json();

        if (result.correct) {
            feedbackBox.className = "trivia-feedback feedback-success";
            feedbackBox.innerHTML = `🎉 <strong>¡Excelente respuesta, pequeño historiador ${escapeHtml(currentHistorian.name)}!</strong> Has demostrado tu sabiduría histórica y has ganado una nueva medalla.`;
            feedbackBox.classList.remove("hidden");

            // Marcar botón correcto y deshabilitar opciones
            optionButtons.forEach((b, idx) => {
                b.disabled = true;
                if (idx === result.correct_option) {
                    b.classList.add("correct");
                }
            });

            cardElement.classList.add("completed-mission");

            // Actualizar medallas
            badges = result.badges || [];
            completedStories = result.completed_stories || [];
            renderBadges();
        } else {
            feedbackBox.className = "trivia-feedback feedback-error";
            feedbackBox.innerHTML = `🤔 <em>¡Cerca, pequeño historiador!</em> Inténtalo de nuevo o repasa el relato para encontrar la pista.`;
            feedbackBox.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Error al verificar respuesta:", err);
    }
}

// 10. Renderizar la vitrina de medallas del pequeño historiador
function renderBadges() {
    badgeCount.textContent = `${badges.length} Medalla${badges.length === 1 ? '' : 's'} Ganada${badges.length === 1 ? '' : 's'}`;

    if (badges.length === 0) {
        badgesContainer.innerHTML = `<p class="empty-badges">¡Resuelve las trivias históricas para ganar tus primeras medallas de pequeño historiador!</p>`;
        return;
    }

    badgesContainer.innerHTML = badges.map(badge => `
        <div class="badge-item">
            <span class="badge-icon">🏅</span>
            <span class="badge-title">${escapeHtml(badge)}</span>
        </div>
    `).join("");
}

// 11. Cargar y renderizar la pantalla de Estadísticas y Nivel
async function loadStats() {
    try {
        const response = await fetch("/api/stats");
        if (!response.ok) throw new Error("Error al obtener estadísticas");

        const data = await response.json();

        // 1. Nivel y Puntos
        statsLevelIcon.textContent = data.level.icon;
        statsLevelTitle.textContent = `Nivel ${data.level.num}: ${data.level.title}`;
        statsXpValue.textContent = `${data.xp} ⭐`;
        statsNextTarget.textContent = data.level.next_target;

        // 2. Barra de nivel animada
        statsProgressPercent.textContent = `${data.percent}% Dominado (${data.completed_count} de ${data.total_missions} épocas)`;
        statsLevelBarFill.style.width = "0%";
        setTimeout(() => {
            statsLevelBarFill.style.width = `${data.percent}%`;
        }, 100);

        // 3. Contadores
        masteredCount.textContent = `${data.mastered.length} tema${data.mastered.length === 1 ? '' : 's'}`;
        notMasteredCount.textContent = `${data.not_mastered.length} tema${data.not_mastered.length === 1 ? '' : 's'}`;

        // 4. Renderizar lista de temas que domina
        if (data.mastered.length === 0) {
            masteredTopicsList.innerHTML = `
                <div class="empty-topics-card">
                    <span class="empty-icon">🌱</span>
                    <p><strong>Aún no has dominado ningún tema, pequeño historiador.</strong></p>
                    <p>Ve a tus relatos históricos, responde las trivias correctamente y verás tus temas dominados aquí con orgullo.</p>
                </div>
            `;
        } else {
            masteredTopicsList.innerHTML = data.mastered.map(item => `
                <div class="topic-item-card topic-mastered">
                    <span class="topic-item-icon">${item.icon}</span>
                    <div class="topic-item-info">
                        <div class="topic-item-top">
                            <span class="topic-grade-tag">${item.grade}º Primaria</span>
                            <span class="topic-period-tag">${escapeHtml(item.period)}</span>
                        </div>
                        <h4 class="topic-item-title">${escapeHtml(item.title)}</h4>
                    </div>
                    <span class="topic-status-badge status-mastered">${item.status_badge}</span>
                </div>
            `).join("");
        }

        // 5. Renderizar lista de temas que no domina tanto / por explorar
        if (data.not_mastered.length === 0) {
            notMasteredTopicsList.innerHTML = `
                <div class="empty-topics-card congrats-card">
                    <span class="empty-icon">👑</span>
                    <p><strong>¡Increíble, pequeño historiador!</strong></p>
                    <p>Has dominado absolutamente todas las épocas históricas disponibles en la máquina del tiempo.</p>
                </div>
            `;
        } else {
            notMasteredTopicsList.innerHTML = data.not_mastered.map(item => {
                const isNeedPractice = item.status_type === "needs_practice";
                return `
                    <div class="topic-item-card ${isNeedPractice ? 'topic-needs-practice' : 'topic-pending'}">
                        <span class="topic-item-icon">${item.icon}</span>
                        <div class="topic-item-info">
                            <div class="topic-item-top">
                                <span class="topic-grade-tag">${item.grade}º Primaria</span>
                                <span class="topic-period-tag">${escapeHtml(item.period)}</span>
                            </div>
                            <h4 class="topic-item-title">${escapeHtml(item.title)}</h4>
                            <p class="topic-item-reason">${escapeHtml(item.reason)}</p>
                        </div>
                        <div class="topic-actions">
                            <span class="topic-status-badge ${isNeedPractice ? 'status-needs-practice' : 'status-pending'}">
                                ${item.status_badge}
                            </span>
                            <button class="btn btn-challenge-action" data-grade="${item.grade}" data-story-id="${item.id}">
                                Aceptar Reto ➔
                            </button>
                        </div>
                    </div>
                `;
            }).join("");

            // Agregar evento a los botones de "Aceptar Reto"
            const challengeButtons = notMasteredTopicsList.querySelectorAll(".btn-challenge-action");
            challengeButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    const grade = btn.dataset.grade;
                    const storyId = btn.dataset.storyId;
                    currentGrade = grade;
                    showDashboard();
                    loadStories(grade, storyId);
                });
            });
        }

    } catch (err) {
        console.error("Error al cargar estadísticas:", err);
    }
}

// Función auxiliar para escapar texto en HTML
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
