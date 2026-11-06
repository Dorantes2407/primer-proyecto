/**
 * Historia Divertida - Lógica de interacción para Pequeños Historiadores
 * Soporte Multi-usuario con Historial de Avance individual.
 */

let currentHistorian = null;
let currentGrade = "1";
let badges = [];
let badgesExpanded = false;   // la vitrina arranca plegada si hay muchas medallas
let completedStories = [];

// Elementos del DOM - Pantalla de Bienvenida y Selección de Usuario
const welcomeScreen = document.getElementById("welcome-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const statsScreen = document.getElementById("stats-screen");

const existingUsersPanel = document.getElementById("existing-users-panel");
const existingUsersList = document.getElementById("existing-users-list");
const existingUsersCount = document.getElementById("existing-users-count");

const onboardingForm = document.getElementById("onboarding-form");
const explorerNameInput = document.getElementById("explorer-name");
const selectedGradeInput = document.getElementById("selected-grade");
const gradeCards = document.querySelectorAll(".grade-card");

// Elementos del DOM - Tablero
const displayHistorianName = document.getElementById("display-historian-name");
const displayGradeText = document.getElementById("display-grade-text");
const displayLevelText = document.getElementById("display-level-text");
const dashboardUserAvatar = document.getElementById("dashboard-user-avatar");
const btnSwitchHistorian = document.getElementById("btn-switch-historian");
const btnViewStats = document.getElementById("btn-view-stats");
const badgeCount = document.getElementById("badge-count");
const badgesContainer = document.getElementById("badges-container");
const badgesToggle = document.getElementById("badges-toggle");
const badgesPanel = badgesContainer.closest(".badges-panel");
const dashboardGradeTabs = document.querySelectorAll("#dashboard-grade-tabs .tab-btn");
const storiesContainer = document.getElementById("stories-container");
const serverStatus = document.getElementById("server-status");

// Elementos del DOM - Pantalla de Estadísticas
const btnBackToDashboard = document.getElementById("btn-back-to-dashboard");
const btnStatsSwitchUser = document.getElementById("btn-stats-switch-user");
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

// Mapeos visuales de grado escolar
const GRADE_NAMES = {
    "1": "1º de Primaria (Prehistoria y Dinosaurios)",
    "2": "2º de Primaria (Antiguo Egipto y Faraones)",
    "3": "3º de Primaria (Grecia y Roma Antigua)",
    "4": "4º de Primaria (Mayas y Castillos Medievales)",
    "5": "5º de Primaria (Mesoamérica y Grandes Navegantes)",
    "6": "6º de Primaria (Revoluciones y Viaje a la Luna)"
};

const GRADE_ICONS = {
    "1": "🦖",
    "2": "🏺",
    "3": "🏛️",
    "4": "🏰",
    "5": "🧭",
    "6": "🚀"
};

// 1. Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", async () => {
    setupGradeCardSelection();
    setupDashboardTabs();
    setupEventListeners();
    await checkServerStatus();
    await loadRegisteredUsers();
});

// Verificar estado y modo de base de datos (Turso o SQLite)
async function checkServerStatus() {
    try {
        const res = await fetch("/api/status");
        if (res.ok) {
            const data = await res.json();
            serverStatus.textContent = `🟢 En línea | BD: ${data.database_mode}`;
        }
    } catch (e) {
        serverStatus.textContent = "Modo demostración local (ejecuta 'python app.py' para sincronizar).";
    }
}

// 2. Cargar y visualizar la lista de usuarios ya ingresados
async function loadRegisteredUsers() {
    try {
        const response = await fetch("/api/users");
        if (!response.ok) throw new Error("Error al consultar usuarios");

        const data = await response.json();
        const users = data.users || [];

        renderExistingUsers(users, data.current_user);

        // Si no hay ningún usuario activo seleccionado, mostramos la pantalla de inicio
        // para que puedan visualizar y seleccionar a su pequeño historiador
        showWelcomeScreen();

    } catch (error) {
        console.warn("Servidor local no disponible o error al cargar usuarios:", error);
        serverStatus.textContent = "Modo demostración local (ejecuta 'python app.py' para sincronizar).";
        showWelcomeScreen();
    }
}

// 3. Renderizar las tarjetas de usuarios en la pantalla de bienvenida
function renderExistingUsers(users, currentUserId) {
    if (!users || users.length === 0) {
        existingUsersPanel.classList.add("hidden");
        return;
    }

    existingUsersPanel.classList.remove("hidden");
    existingUsersCount.textContent = `${users.length} Perfil${users.length === 1 ? '' : 'es'}`;

    existingUsersList.innerHTML = users.map((user, idx) => {
        const isCurrent = user.id === currentUserId;
        const icon = user.grade_icon || GRADE_ICONS[user.grade] || "🧭";

        return `
            <div class="user-profile-card ${isCurrent ? 'active-user-card' : ''}" id="user-card-${user.id}" style="--i:${idx}">
                ${isCurrent ? '<span class="current-user-tag">🌟 Última Sesión</span>' : ''}
                
                <div class="user-card-header">
                    <span class="user-card-avatar">${icon}</span>
                    <div class="user-card-info">
                        <h4 class="user-card-name">${escapeHtml(user.name)}</h4>
                        <span class="user-card-grade-tag">${escapeHtml(user.grade_desc)}</span>
                    </div>
                    <button class="btn-delete-user" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}" title="Eliminar este perfil">
                        🗑️
                    </button>
                </div>

                <!-- Nivel e insignias -->
                <div class="user-card-level-row">
                    <span class="user-level-badge">
                        ${user.level.icon} Nivel ${user.level.num}: ${escapeHtml(user.level.title)}
                    </span>
                </div>

                <!-- Barra de avance en miniatura -->
                <div class="user-mini-progress">
                    <div class="user-mini-progress-bar">
                        <div class="user-mini-progress-fill" style="width: ${user.percent}%;"></div>
                    </div>
                    <div class="user-mini-progress-labels">
                        <span><strong>${user.percent}%</strong> Dominado</span>
                        <span>${user.completed_count} de ${user.total_missions} misiones</span>
                    </div>
                </div>

                <!-- Resumen de logros -->
                <div class="user-card-stats-pills">
                    <span class="stat-pill">🏅 ${user.badges_count} Medallas</span>
                    <span class="stat-pill">⭐ ${user.xp} XP</span>
                </div>

                <!-- Botón para seleccionar y continuar -->
                <button type="button" class="btn btn-select-user" data-user-id="${user.id}">
                    <span>¡Continuar mi Aventura!</span>
                    <span class="btn-arrow">➔</span>
                </button>
            </div>
        `;
    }).join("");

    // Eventos para seleccionar usuario existente
    const selectButtons = existingUsersList.querySelectorAll(".btn-select-user");
    selectButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            selectUser(btn.dataset.userId);
        });
    });

    // Eventos para eliminar usuario
    const deleteButtons = existingUsersList.querySelectorAll(".btn-delete-user");
    deleteButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteUser(btn.dataset.userId, btn.dataset.userName);
        });
    });
}

// 4. Seleccionar un usuario ya existente
async function selectUser(userId) {
    try {
        const response = await fetch("/api/users/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: userId })
        });

        if (!response.ok) throw new Error("No se pudo seleccionar el usuario");

        const data = await response.json();
        currentHistorian = data.historian;
        currentGrade = String(currentHistorian.grade || "1");
        badges = data.badges || [];
        completedStories = data.completed_stories || [];

        showDashboard();

    } catch (err) {
        console.error("Error al seleccionar usuario:", err);
        alert("Ocurrió un error al seleccionar el usuario.");
    }
}

// 5. Eliminar un perfil de usuario
async function deleteUser(userId, userName) {
    const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar el historial de avance de "${userName}"? Esta acción borrará todas sus medallas y niveles.`);
    if (!confirmDelete) return;

    try {
        const response = await fetch("/api/users/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: userId })
        });

        if (!response.ok) throw new Error("Error al eliminar el perfil");

        // Recargar la lista de usuarios
        await loadRegisteredUsers();

    } catch (err) {
        console.error("Error eliminando perfil:", err);
        alert("No se pudo eliminar el perfil seleccionado.");
    }
}

// 6. Selección de grado en el formulario de registro
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

// 7. Configurar pestañas de grados en el tablero principal
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

// 8. Event listeners principales
function setupEventListeners() {
    // Formulario para crear un nuevo usuario o ingresar apodo nuevo
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

            // Recargar datos del perfil activo
            await refreshActiveUserProfile();
            showDashboard();

        } catch (error) {
            console.error("Error al guardar perfil:", error);
            currentHistorian = { name, grade };
            currentGrade = grade;
            showDashboard();
        }
    });

    // Botón para cambiar de usuario (desde Dashboard)
    btnSwitchHistorian.addEventListener("click", async () => {
        await switchToUserSelection();
    });

    // Botón para cambiar de usuario (desde Estadísticas)
    btnStatsSwitchUser.addEventListener("click", async () => {
        await switchToUserSelection();
    });

    // Botón para ver estadísticas
    btnViewStats.addEventListener("click", () => {
        showStatsScreen();
    });

    // Botón para regresar al tablero desde estadísticas
    btnBackToDashboard.addEventListener("click", () => {
        showDashboard();
    });

    // Plegar / desplegar la vitrina de medallas
    badgesToggle.addEventListener("click", () => {
        badgesExpanded = !badgesExpanded;
        updateBadgesToggle();
    });
}

// 9. Volver a la pantalla de selección de usuarios
async function switchToUserSelection() {
    try {
        await fetch("/api/reset-profile", { method: "POST" });
    } catch (err) {
        console.error(err);
    }
    explorerNameInput.value = "";
    await loadRegisteredUsers();
    showWelcomeScreen();
}

// 10. Refrescar el perfil del usuario activo
async function refreshActiveUserProfile() {
    try {
        const response = await fetch("/api/profile");
        if (response.ok) {
            const data = await response.json();
            badges = data.badges || [];
            completedStories = data.completed_stories || [];
        }
    } catch (e) {
        console.warn("No se pudo refrescar perfil:", e);
    }
}

// 11. Transiciones de pantalla
function showWelcomeScreen() {
    dashboardScreen.classList.remove("active");
    statsScreen.classList.remove("active");
    welcomeScreen.classList.add("active");
    focusScreen(welcomeScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function showDashboard() {
    welcomeScreen.classList.remove("active");
    statsScreen.classList.remove("active");
    dashboardScreen.classList.add("active");
    focusScreen(dashboardScreen);

    // Actualizar saludo y datos del usuario activo
    displayHistorianName.textContent = currentHistorian.name;
    displayGradeText.textContent = GRADE_NAMES[currentGrade] || `${currentGrade}º de Primaria`;

    // Avatar del grado escolar
    const avatarEmoji = GRADE_ICONS[currentGrade] || "🧭";
    dashboardUserAvatar.textContent = avatarEmoji;

    // Sincronizar pestaña activa
    dashboardGradeTabs.forEach(tab => {
        if (tab.dataset.grade === currentGrade) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    // Obtener nivel actual para mostrar en el encabezado
    try {
        const statsRes = await fetch("/api/stats");
        if (statsRes.ok) {
            const statsData = await statsRes.json();
            displayLevelText.textContent = `${statsData.level.icon} Nivel ${statsData.level.num}: ${statsData.level.title}`;
        }
    } catch (e) {
        displayLevelText.textContent = "Novato del Tiempo";
    }

    renderBadges();
    loadStories(currentGrade);
}

function showStatsScreen() {
    welcomeScreen.classList.remove("active");
    dashboardScreen.classList.remove("active");
    statsScreen.classList.add("active");
    focusScreen(statsScreen);

    statsHistorianName.textContent = currentHistorian.name;
    loadStats();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// 12. Cargar relatos y trivias por grado escolar
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

// 13. Renderizar tarjetas de relatos y trivias
function renderStories(stories) {
    storiesContainer.innerHTML = "";

    if (stories.length === 0) {
        storiesContainer.innerHTML = `<p class="empty-state">No hay misiones disponibles para este grado en este momento.</p>`;
        return;
    }

    stories.forEach((story, idx) => {
        const isCompleted = completedStories.includes(story.id);

        const card = document.createElement("article");
        card.className = `story-card ${isCompleted ? "completed-mission" : ""}`;
        card.id = `story-card-${story.id}`;
        card.style.setProperty("--i", idx);

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

        // Eventos en opciones de trivia
        const optionButtons = card.querySelectorAll(".trivia-option-btn");
        optionButtons.forEach(btn => {
            btn.addEventListener("click", () => handleAnswer(story.id, parseInt(btn.dataset.optionIdx, 10), card));
        });

        storiesContainer.appendChild(card);
    });
}

// 14. Manejar respuesta a trivia histórica
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
            const botonElegido = optionButtons[selectedOption];
            optionButtons.forEach((b, idx) => {
                b.disabled = true;
                if (idx === result.correct_option) {
                    b.classList.add("correct");
                }
            });

            cardElement.classList.add("completed-mission");
            if (botonElegido) burstParticles(cardElement, botonElegido);

            // Actualizar medallas (guardamos las anteriores para estampar la nueva)
            const medallasPrevias = badges;
            badges = result.badges || [];
            completedStories = result.completed_stories || [];
            renderBadges(medallasPrevias);

            announce(`¡Correcto! Has ganado una medalla. Ya tienes ${formatBadgeCount(badges.length)}.`);
        } else {
            feedbackBox.className = "trivia-feedback feedback-error";
            feedbackBox.innerHTML = `🤔 <em>¡Cerca, pequeño historiador!</em> Inténtalo de nuevo o repasa el relato para encontrar la pista.`;
            feedbackBox.classList.remove("hidden");

            if (!prefersReducedMotion()) {
                cardElement.classList.add("shake-once");
                setTimeout(() => cardElement.classList.remove("shake-once"), 400);
            }

            announce("Respuesta incorrecta. Inténtalo de nuevo o repasa el relato.");
        }
    } catch (err) {
        console.error("Error al verificar respuesta:", err);
    }
}

// Nº de medallas que caben en una fila sin plegar
const BADGES_VISIBLES = 4;

// 15. Renderizar vitrina de medallas del usuario activo
// `previousBadges` solo se pasa al resolver una trivia: sirve para estampar la recién ganada.
function renderBadges(previousBadges = null) {
    const nuevaMedalla = previousBadges
        ? badges.find(badge => !previousBadges.includes(badge))
        : null;

    // Al ganar una medalla se despliega la vitrina para que se vea el sello
    if (nuevaMedalla) badgesExpanded = true;

    const total = badges.length;
    badgeCount.textContent = formatBadgeCount(total);

    if (previousBadges && total !== previousBadges.length) {
        countUp(previousBadges.length, total);
        announce(nuevaMedalla
            ? `¡Nueva medalla ganada: ${nuevaMedalla}! Ya tienes ${formatBadgeCount(total)}.`
            : `Ahora tienes ${formatBadgeCount(total)}.`);
    }

    if (total === 0) {
        badgesContainer.innerHTML = `<p class="empty-badges">¡Resuelve las trivias históricas para ganar tus primeras medallas de pequeño historiador!</p>`;
        updateBadgesToggle();
        return;
    }

    badgesContainer.innerHTML = badges.map((badge, idx) => `
        <div class="badge-item ${badge === nuevaMedalla ? "badge-new" : ""}" style="--i:${idx}">
            <span class="badge-icon">🏅</span>
            <span class="badge-title">${escapeHtml(badge)}</span>
        </div>
    `).join("");

    updateBadgesToggle();
}

// Muestra u oculta el botón "Ver todas" y aplica el plegado
function updateBadgesToggle() {
    const haySuficientes = badges.length > BADGES_VISIBLES;

    badgesToggle.classList.toggle("hidden", !haySuficientes);
    badgesPanel.classList.toggle("is-collapsed", haySuficientes && !badgesExpanded);

    if (!haySuficientes) return;

    badgesToggle.textContent = badgesExpanded
        ? "Ver menos ▴"
        : `Ver todas (${badges.length}) ▾`;
    badgesToggle.setAttribute("aria-expanded", String(badgesExpanded));
}

// 16. Cargar y renderizar la pantalla de Estadísticas y Nivel
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
            masteredTopicsList.innerHTML = data.mastered.map((item, idx) => `
                <div class="topic-item-card topic-mastered" style="--i:${idx}">
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
            notMasteredTopicsList.innerHTML = data.not_mastered.map((item, idx) => {
                const isNeedPractice = item.status_type === "needs_practice";
                return `
                    <div class="topic-item-card ${isNeedPractice ? 'topic-needs-practice' : 'topic-pending'}" style="--i:${idx}">
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

            // Evento en botones "Aceptar Reto"
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

// --- Utilidades de movimiento y accesibilidad ---

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatBadgeCount(total) {
    return `${total} Medalla${total === 1 ? '' : 's'} Ganada${total === 1 ? '' : 's'}`;
}

// Sube el contador de medallas de `desde` a `hasta` en ~700 ms
function countUp(desde, hasta) {
    if (prefersReducedMotion() || desde === hasta) {
        badgeCount.textContent = formatBadgeCount(hasta);
        return;
    }
    const inicio = performance.now();
    const duracion = 700;

    function paso(ahora) {
        const avance = Math.min(1, (ahora - inicio) / duracion);
        const suave = 1 - Math.pow(1 - avance, 3);
        badgeCount.textContent = formatBadgeCount(Math.round(desde + (hasta - desde) * suave));
        if (avance < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
}

// Aviso para lectores de pantalla
function announce(mensaje) {
    const region = document.getElementById("live-region");
    if (!region) return;
    region.textContent = "";
    setTimeout(() => { region.textContent = mensaje; }, 50);
}

// 12 partículas de tinta saliendo del botón acertado
function burstParticles(contenedor, origen) {
    if (prefersReducedMotion()) return;

    const caja = contenedor.getBoundingClientRect();
    const punto = origen.getBoundingClientRect();

    const burst = document.createElement("div");
    burst.className = "particle-burst";
    burst.style.left = `${punto.left - caja.left + punto.width / 2}px`;
    burst.style.top = `${punto.top - caja.top + punto.height / 2}px`;

    for (let i = 0; i < 12; i++) {
        const particula = document.createElement("span");
        particula.className = "ink-particle";
        particula.style.setProperty("--a", `${i * 30}deg`);
        particula.style.setProperty("--d", `${26 + Math.random() * 26}px`);
        particula.style.animationDelay = `${Math.random() * 60}ms`;
        burst.appendChild(particula);
    }

    contenedor.appendChild(burst);
    setTimeout(() => burst.remove(), 900);
}

// Al cambiar de pantalla, lleva el foco al contenedor (sin robar scroll)
function focusScreen(elemento) {
    elemento.setAttribute("tabindex", "-1");
    elemento.focus({ preventScroll: true });
}
