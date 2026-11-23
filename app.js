/**
 * Historia Divertida - Lógica de interacción para Pequeños Historiadores
 * Soporte Multi-usuario con Historial de Avance individual, Progresión Estricta de Grados y Bloqueo de Navegación.
 */

let currentHistorian = null;
let currentGrade = "1";
let userProgression = null;
let badges = [];
let badgesExpanded = false;   // la vitrina arranca plegada si hay muchas medallas
let badgesAutoCollapse = null; // temporizador del plegado automático tras ganar
let completedStories = [];
let storiesCache = {}; // 🚀 Caché local para optimizar peticiones al consultar relatos

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

// Elementos del DOM - Tablero Principal
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
const streakCurrent = document.getElementById("streak-current");
const streakCurrentLabel = document.getElementById("streak-current-label");
const streakBest = document.getElementById("streak-best");
const streakGrid = document.getElementById("streak-grid");

// Elementos del DOM - Progresión de Grados y Alertas de Bloqueo
const gradeProgressionCard = document.getElementById("grade-progression-card");
const progressionGradeIcon = document.getElementById("progression-grade-icon");
const progressionStatusPill = document.getElementById("progression-status-pill");
const progressionGradeTitle = document.getElementById("progression-grade-title");
const progressionStatCount = document.getElementById("progression-stat-count");
const progressionStatPct = document.getElementById("progression-stat-pct");
const progressionBarFill = document.getElementById("progression-bar-fill");
const progressionRequirementBox = document.getElementById("progression-requirement-box");
const progressionRequirementText = document.getElementById("progression-requirement-text");

const gradeLockAlert = document.getElementById("grade-lock-alert");
const lockAlertTitle = document.getElementById("lock-alert-title");
const lockAlertMessage = document.getElementById("lock-alert-message");
const btnCloseLockAlert = document.getElementById("btn-close-lock-alert");

// Elementos del DOM - Modal de Celebración de Desbloqueo de Grado
const gradeUnlockModal = document.getElementById("grade-unlock-modal");
const unlockModalTitle = document.getElementById("unlock-modal-title");
const unlockModalSubtitle = document.getElementById("unlock-modal-subtitle");
const unlockModalMessage = document.getElementById("unlock-modal-message");
const unlockNextIcon = document.getElementById("unlock-next-icon");
const unlockNextName = document.getElementById("unlock-next-name");
const btnContinueNextGrade = document.getElementById("btn-continue-next-grade");

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
    "1": "1º de Primaria (Mi historia y mi familia)",
    "2": "2º de Primaria (Mi historia y mi comunidad)",
    "3": "3º de Primaria (Conozco la historia de Campeche)",
    "4": "4º de Primaria (La invasión española y el México colonial)",
    "5": "5º de Primaria (México independiente y sus transformaciones)",
    "6": "6º de Primaria (La Revolución Mexicana y las transformaciones políticas)"
};

const GRADE_ICONS = {
    "1": "📖",
    "2": "🏘️",
    "3": "🏛️",
    "4": "⛵",
    "5": "🇲🇽",
    "6": "🚂"
};

// ========================================================
// 1. INICIALIZACIÓN DE LA APLICACIÓN
// ========================================================
document.addEventListener("DOMContentLoaded", async () => {
    setupGradeCardSelection();
    setupDashboardTabs();
    setupEventListeners();
    await checkServerStatus();

    // Comprobar si hay una sesión activa persistente (por recarga de navegador F5)
    const sessionRestored = await checkActiveSession();
    if (!sessionRestored) {
        await loadRegisteredUsers();
    }
});

// Comprobar y restaurar sesión previa si el usuario recarga la página
async function checkActiveSession() {
    try {
        const response = await fetch("/api/profile");
        if (!response.ok) return false;

        const data = await response.json();
        if (data.historian && data.historian.name) {
            currentHistorian = data.historian;
            userProgression = data.progression;
            currentGrade = String(userProgression?.active_grade || currentHistorian.grade || "1");
            badges = data.badges || [];
            completedStories = data.completed_stories || [];
            await showDashboard();
            return true;
        }
    } catch (e) {
        console.warn("No hay sesión previa para restaurar:", e);
    }
    return false;
}

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

// ========================================================
// 2. GESTIÓN DE USUARIOS Y PERFILES
// ========================================================

// Cargar y visualizar la lista de usuarios ya ingresados
async function loadRegisteredUsers() {
    try {
        const response = await fetch("/api/users");
        if (!response.ok) throw new Error("Error al consultar usuarios");

        const data = await response.json();
        const users = data.users || [];

        renderExistingUsers(users, data.current_user);
        showWelcomeScreen();

    } catch (error) {
        console.warn("Servidor local no disponible o error al cargar usuarios:", error);
        serverStatus.textContent = "Modo demostración local (ejecuta 'python app.py' para sincronizar).";
        showWelcomeScreen();
    }
}

// Renderizar las tarjetas de usuarios en la pantalla de bienvenida
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

                <div class="user-card-level-row">
                    <span class="user-level-badge">
                        ${levelSeal(user.level.num)} Nivel ${user.level.num}: ${escapeHtml(user.level.title)}
                    </span>
                </div>

                <div class="user-mini-progress">
                    <div class="user-mini-progress-bar">
                        <div class="user-mini-progress-fill" style="width: ${user.percent}%;"></div>
                    </div>
                    <div class="user-mini-progress-labels">
                        <span><strong>${user.percent}%</strong> Dominado</span>
                        <span>${user.completed_count} de ${user.total_missions} misiones</span>
                    </div>
                </div>

                <div class="user-card-stats-pills">
                    <span class="stat-pill">🏅 ${user.badges_count} Medallas</span>
                    <span class="stat-pill">⭐ ${user.xp} XP</span>
                </div>

                <button type="button" class="btn btn-select-user" data-user-id="${user.id}">
                    <span>¡Continuar mi Aventura!</span>
                    <span class="btn-arrow">➔</span>
                </button>
            </div>
        `;
    }).join("");

    existingUsersList.querySelectorAll(".btn-select-user").forEach(btn => {
        btn.addEventListener("click", () => selectUser(btn.dataset.userId));
    });

    existingUsersList.querySelectorAll(".btn-delete-user").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteUser(btn.dataset.userId, btn.dataset.userName);
        });
    });
}

// Seleccionar un usuario ya existente
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
        userProgression = data.progression;
        currentGrade = String(userProgression?.active_grade || currentHistorian.grade || "1");
        badges = data.badges || [];
        completedStories = data.completed_stories || [];

        hideLockAlert();
        await showDashboard();

    } catch (err) {
        console.error("Error al seleccionar usuario:", err);
        alert("Ocurrió un error al seleccionar el usuario.");
    }
}

// Eliminar un perfil de usuario
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
        await loadRegisteredUsers();

    } catch (err) {
        console.error("Error eliminando perfil:", err);
        alert("No se pudo eliminar el perfil seleccionado.");
    }
}

// Selección de grado en el formulario de bienvenida para nuevos usuarios
function setupGradeCardSelection() {
    gradeCards.forEach(card => {
        card.addEventListener("click", () => {
            gradeCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            const grade = card.dataset.grade;
            selectedGradeInput.value = grade;
            if (typeof applyGradeTheme === "function") {
                applyGradeTheme(grade);
            }
        });
    });
}

// ========================================================
// 3. CONTROL DE PESTAÑAS Y BLOQUEO DE NAVEGACIÓN DE GRADOS
// ========================================================

// Configurar pestañas de grados en el tablero principal con bloqueo estricto
function setupDashboardTabs() {
    dashboardGradeTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const requestedGrade = tab.dataset.grade;

            // Si el usuario hace clic en el grado escolar que ya está activo
            if (requestedGrade === currentGrade) {
                hideLockAlert();
                storiesContainer.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            // Si intenta acceder a cualquier grado anterior o posterior: BLOQUEADO
            const gradeInfo = userProgression?.grades?.[requestedGrade];
            const activeInfo = userProgression?.grades?.[currentGrade];
            const activeName = activeInfo?.name || `${currentGrade}º de Primaria`;
            const reqName = gradeInfo?.name || `${requestedGrade}º de Primaria`;

            const lockReason = gradeInfo?.lock_reason || (
                Number(requestedGrade) < Number(currentGrade)
                    ? `Grado ${reqName} completado. El acceso a grados anteriores está bloqueado durante la partida para mantener el orden cronológico de tu aventura. Tu grado activo actual es ${activeName}.`
                    : `Grado ${reqName} bloqueado. Para desbloquearlo debes completar primero todas las actividades requeridas de tu grado activo actual (${activeName}).`
            );

            showLockAlert(
                `🔒 ¡${reqName} Bloqueado durante la Partida!`,
                lockReason
            );

            // Animar pestaña para dar retroalimentación visual al usuario
            tab.classList.add("shake-tab");
            setTimeout(() => tab.classList.remove("shake-tab"), 400);
        });
    });

    if (btnCloseLockAlert) {
        btnCloseLockAlert.addEventListener("click", hideLockAlert);
    }
}

// Mostrar aviso informativo ante intento de acceso a grado bloqueado
function showLockAlert(title, message) {
    if (!gradeLockAlert) return;
    lockAlertTitle.textContent = title;
    lockAlertMessage.textContent = message;
    gradeLockAlert.classList.remove("hidden");

    // Reiniciar animación shake
    gradeLockAlert.style.animation = "none";
    void gradeLockAlert.offsetWidth;
    gradeLockAlert.style.animation = "shakeAlert 0.4s ease-in-out";

    gradeLockAlert.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideLockAlert() {
    if (gradeLockAlert) {
        gradeLockAlert.classList.add("hidden");
    }
}

// Actualizar el estado visual de las pestañas y la tarjeta de progresión
function updateTabsAndProgressionUI(progression) {
    if (!progression) return;
    userProgression = progression;
    if (progression.active_grade) {
        currentGrade = String(progression.active_grade);
    }

    const activeInfo = progression.grades?.[currentGrade] || {};

    // 1. Actualizar Tarjeta de Progresión del grado activo
    if (progressionGradeIcon) {
        progressionGradeIcon.textContent = activeInfo.icon || GRADE_ICONS[currentGrade] || "🧭";
    }
    if (progressionGradeTitle) {
        progressionGradeTitle.textContent = activeInfo.name || `${currentGrade}º de Primaria`;
    }

    const doneCount = activeInfo.completed_count || 0;
    const totalCount = activeInfo.total_count || 2;
    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    if (progressionStatCount) {
        progressionStatCount.textContent = `${doneCount} de ${totalCount} misiones`;
    }
    if (progressionStatPct) {
        progressionStatPct.textContent = `${pct}% completado`;
    }
    if (progressionBarFill) {
        progressionBarFill.style.width = `${pct}%`;
    }

    if (progressionRequirementText) {
        progressionRequirementText.textContent = activeInfo.requirement_text || "Completa todas las actividades de tu grado para avanzar.";
    }

    if (progressionRequirementBox) {
        if (pct === 100) {
            progressionRequirementBox.classList.add("req-completed");
        } else {
            progressionRequirementBox.classList.remove("req-completed");
        }
    }

    // 2. Actualizar las 6 pestañas de navegación con sus etiquetas y estilos
    dashboardGradeTabs.forEach(tab => {
        const g = tab.dataset.grade;
        const gInfo = progression.grades?.[g] || {};
        const badge = tab.querySelector(".tab-badge") || document.getElementById(`tab-badge-${g}`);

        tab.classList.remove("active", "tab-active", "tab-completed", "tab-locked");

        if (g === currentGrade) {
            tab.classList.add("active", "tab-active");
            if (badge) badge.textContent = "🌟 Activo";
            tab.title = `Grado escolar activo de tu partida: ${gInfo.name || g}`;
        } else if (gInfo.status === "completed") {
            tab.classList.add("tab-completed");
            if (badge) badge.textContent = "✓ Hecho 🔒";
            tab.title = gInfo.lock_reason || "Grado completado anteriormente (bloqueado durante la partida).";
        } else {
            tab.classList.add("tab-locked");
            if (badge) badge.textContent = "🔒 Bloqueado";
            tab.title = gInfo.lock_reason || "Grado bloqueado.";
        }
    });

    // 3. Sincronizar encabezado principal del tablero
    if (displayGradeText) {
        displayGradeText.textContent = activeInfo.name || `${currentGrade}º de Primaria`;
    }
    if (dashboardUserAvatar) {
        dashboardUserAvatar.textContent = activeInfo.icon || GRADE_ICONS[currentGrade] || "🧭";
    }
}

// ========================================================
// 4. EVENT LISTENERS GENERALES
// ========================================================
function setupEventListeners() {
    // Registro de nuevo usuario
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
            userProgression = result.progression;
            currentGrade = String(result.progression?.active_grade || grade);
            badges = result.badges || [];
            completedStories = result.completed_stories || [];

            hideLockAlert();
            await showDashboard();

        } catch (error) {
            console.error("Error al guardar perfil:", error);
            currentHistorian = { name, grade };
            currentGrade = grade;
            await showDashboard();
        }
    });

    btnSwitchHistorian.addEventListener("click", async () => {
        await switchToUserSelection();
    });

    btnStatsSwitchUser.addEventListener("click", async () => {
        await switchToUserSelection();
    });

    btnViewStats.addEventListener("click", () => {
        showStatsScreen();
    });

    btnBackToDashboard.addEventListener("click", () => {
        showDashboard();
    });

    if (typeof badgesToggle !== "undefined" && badgesToggle) {
        badgesToggle.addEventListener("click", () => {
            clearTimeout(badgesAutoCollapse);
            badgesExpanded = !badgesExpanded;
            updateBadgesToggle();
        });
    }
}

async function switchToUserSelection() {
    try {
        await fetch("/api/reset-profile", { method: "POST" });
    } catch (err) {
        console.error(err);
    }
    explorerNameInput.value = "";
    storiesCache = {}; // Limpiar caché al salir
    hideLockAlert();
    await loadRegisteredUsers();
    showWelcomeScreen();
}

// ========================================================
// 5. NAVEGACIÓN ENTRE PANTALLAS
// ========================================================
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

    displayHistorianName.textContent = currentHistorian.name;
    displayGradeText.textContent = GRADE_NAMES[currentGrade] || `${currentGrade}º de Primaria`;
    dashboardUserAvatar.textContent = GRADE_ICONS[currentGrade] || "🧭";

    const avatarEmoji = GRADE_ICONS[currentGrade] || "🧭";
    dashboardUserAvatar.textContent = avatarEmoji;
    if (typeof applyGradeTheme === "function") {
        applyGradeTheme(currentGrade);
    }
    try {
        const statsRes = await fetch("/api/stats");
        if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData.progression) {
                userProgression = statsData.progression;
            }
            if (typeof levelSeal === "function") {
                displayLevelText.innerHTML = `${levelSeal(statsData.level.num)} Nivel ${statsData.level.num}: ${escapeHtml(statsData.level.title)}`;
            } else {
                displayLevelText.textContent = `${statsData.level.icon} Nivel ${statsData.level.num}: ${statsData.level.title}`;
            }
            if (typeof renderStreak === "function") {
                renderStreak(statsData.streak);
            }
        }
    } catch (e) {
        displayLevelText.textContent = "Novato del Tiempo";
        renderStreak(null);
    }
    initDailyFAB();


    updateTabsAndProgressionUI(userProgression);
    renderBadges();
    await loadStories(currentGrade);
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

// 11b. Fondo de la época: los colores viven en style.css (body[data-grade])
function applyGradeTheme(grade) {
    document.body.dataset.grade = String(grade || "1");
}

// ========================================================
// 6. CARGA DE RELATOS Y TRIVIAS (CON VALIDACIÓN DE BLOQUEO)
// ========================================================
async function loadStories(grade, targetStoryId = null) {
    applyGradeTheme(grade);
    if (storiesCache[grade] && !targetStoryId) {
        renderStories(storiesCache[grade]);
        return;
    }
    storiesContainer.innerHTML = `<div class="loading-state">⏳ Viajando en el tiempo al grado ${grade}º...</div>`;

    try {
        const response = await fetch(`/api/stories?grade=${grade}`);

        // Manejo ante intento de acceso a grado bloqueado retornado por el servidor (HTTP 403)
        if (response.status === 403) {
            const errData = await response.json();
            showLockAlert(
                `🔒 ¡Acceso a ${GRADE_NAMES[grade] || grade + "º Primaria"} Bloqueado!`,
                errData.lock_reason || "Este grado no está disponible durante la partida actual."
            );
            if (errData.active_grade && errData.active_grade !== grade) {
                currentGrade = String(errData.active_grade);
                if (errData.progression) {
                    updateTabsAndProgressionUI(errData.progression);
                }
                loadStories(currentGrade);
            }
            return;
        }

        if (!response.ok) throw new Error("Error al consultar historias");

        const data = await response.json();
        const stories = data.stories || [];

        if (data.progression) {
            updateTabsAndProgressionUI(data.progression);
        }

        storiesCache[grade] = stories;
        renderStories(stories);

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

// Renderizar tarjetas de relatos y trivias
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

        card.querySelectorAll(".trivia-option-btn").forEach(btn => {
            btn.addEventListener("click", () => handleAnswer(story.id, parseInt(btn.dataset.optionIdx, 10), card));
        });

        storiesContainer.appendChild(card);
    });
}

// ========================================================
// 7. RESPUESTA A TRIVIAS, DESBLOQUEO Y CELEBRACIÓN DE GRADOS
// ========================================================
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

            const medallasPrevias = badges;
            badges = result.badges || [];
            completedStories = result.completed_stories || [];
            if (typeof renderBadges === "function") {
                renderBadges(medallasPrevias);
            }
            if (typeof announce === "function" && typeof formatBadgeCount === "function") {
                announce(`¡Correcto! Has ganado una medalla. Ya tienes ${formatBadgeCount(badges.length)}.`);
            }

            if (result.progression) {
                updateTabsAndProgressionUI(result.progression);
            }

            // Si se completó el grado actual y se habilitó el siguiente
            if (result.grade_completed) {
                showGradeUnlockCelebration(result);
            }
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

// Mostrar diálogo de celebración y avance al siguiente grado
function showGradeUnlockCelebration(result) {
    if (!gradeUnlockModal) return;

    const isMax = result.progression?.is_max_grade && result.new_grade === "6";
    const nextGradeInfo = result.progression?.grades?.[result.new_grade] || {};

    if (unlockModalTitle) {
        unlockModalTitle.textContent = isMax ? "👑 ¡Gran Sabio del Tiempo Universal!" : "🎉 ¡Nuevo Grado Desbloqueado!";
    }
    if (unlockModalSubtitle) {
        unlockModalSubtitle.textContent = isMax 
            ? "¡Has completado toda la máquina del tiempo de primaria!"
            : `¡Has superado con éxito todas las actividades requeridas!`;
    }
    if (unlockModalMessage) {
        unlockModalMessage.textContent = result.congrats_message || "Tu grado activo se ha actualizado.";
    }
    if (unlockNextIcon) {
        unlockNextIcon.textContent = nextGradeInfo.icon || GRADE_ICONS[result.new_grade] || "🚀";
    }
    if (unlockNextName) {
        unlockNextName.textContent = nextGradeInfo.name || `${result.new_grade}º de Primaria`;
    }

    gradeUnlockModal.classList.remove("hidden");

    btnContinueNextGrade.onclick = () => {
        gradeUnlockModal.classList.add("hidden");
        currentGrade = String(result.new_grade);
        currentHistorian.grade = currentGrade;
        updateTabsAndProgressionUI(result.progression);
        delete storiesCache[currentGrade];
        loadStories(currentGrade);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
}

// Nº de medallas que caben en una fila sin plegar
const BADGES_VISIBLES = 4;

// Tiempo que la vitrina queda abierta tras ganar una medalla antes de plegarse sola
const BADGES_AUTOCOLLAPSE_MS = 6000;

// 15. Renderizar vitrina de medallas del usuario activo
// `previousBadges` solo se pasa al resolver una trivia: sirve para estampar la recién ganada.
function renderBadges(previousBadges = null) {
    const nuevaMedalla = previousBadges
        ? badges.find(badge => !previousBadges.includes(badge))
        : null;

    // Al ganar una medalla se despliega la vitrina un momento y se vuelve a plegar sola
    if (nuevaMedalla) {
        badgesExpanded = true;
        clearTimeout(badgesAutoCollapse);
        badgesAutoCollapse = setTimeout(() => {
            badgesExpanded = false;
            updateBadgesToggle();
        }, BADGES_AUTOCOLLAPSE_MS);
    }

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

    if (!haySuficientes) {
        clearTimeout(badgesAutoCollapse);
        return;
    }

    badgesToggle.textContent = badgesExpanded
        ? "Ver menos ▴"
        : `Ver todas (${badges.length}) ▾`;
    badgesToggle.setAttribute("aria-expanded", String(badgesExpanded));
}

// 15b. Racha de días seguidos y calendario de calor (8 semanas, estilo GitHub)
const STREAK_WEEKS = 8;

function renderStreak(streak) {
    const actual = streak?.current || 0;
    const record = streak?.best || 0;

    streakCurrent.textContent = actual;
    streakCurrentLabel.textContent = actual === 1 ? "día seguido" : "días seguidos";
    streakBest.textContent = record;

    const porDia = new Map((streak?.days || []).map(d => [d.day, d.missions]));

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaSemana = (hoy.getDay() + 6) % 7;   // 0 = lunes
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - diaSemana - (STREAK_WEEKS - 1) * 7);

    const clave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hoyClave = clave(hoy);

    const celdas = [];
    for (let i = 0; i < STREAK_WEEKS * 7; i++) {
        const dia = new Date(inicio);
        dia.setDate(inicio.getDate() + i);

        const fecha = clave(dia);
        const futuro = dia > hoy;
        const misiones = porDia.get(fecha);
        // 0 = no entró · 1 = entró sin misiones · 2-4 = 1, 2 y 3+ misiones
        const nivel = misiones === undefined ? 0 : Math.min(4, misiones + 1);

        let etiqueta = "";
        if (!futuro) {
            const fechaTexto = dia.toLocaleDateString("es", { day: "numeric", month: "short" });
            const actividad = misiones === undefined
                ? "sin actividad"
                : misiones === 0
                    ? "entró sin completar misiones"
                    : `${misiones} misión${misiones === 1 ? "" : "es"}`;
            etiqueta = ` title="${fechaTexto} · ${actividad}"`;
        }

        const clases = ["streak-cell"];
        if (futuro) clases.push("is-future");
        else if (fecha === hoyClave) clases.push("is-today");

        celdas.push(`<span class="${clases.join(" ")}" data-level="${nivel}" style="--i:${i}"${etiqueta}></span>`);
    }

    streakGrid.innerHTML = celdas.join("");
}

// ========================================================
// 8. PANTALLA DE ESTADÍSTICAS Y NIVEL
// ========================================================
async function loadStats() {
    try {
        const response = await fetch("/api/stats");
        if (!response.ok) throw new Error("Error al obtener estadísticas");

        const data = await response.json();

        // 1. Nivel y Puntos
        if (typeof levelSeal === "function") {
            statsLevelIcon.innerHTML = levelSeal(data.level.num);
        } else {
            statsLevelIcon.textContent = data.level.icon;
        }
        statsLevelTitle.textContent = `Nivel ${data.level.num}: ${data.level.title}`;
        statsXpValue.textContent = `${data.xp} ⭐`;
        statsNextTarget.textContent = data.level.next_target;

        // Barra de nivel aplicada directamente para transición inmediata
        statsProgressPercent.textContent = `${data.percent}% Dominado (${data.completed_count} de ${data.total_missions} épocas)`;
        statsLevelBarFill.style.width = `${data.percent}%`;

        masteredCount.textContent = `${data.mastered.length} tema${data.mastered.length === 1 ? '' : 's'}`;
        notMasteredCount.textContent = `${data.not_mastered.length} tema${data.not_mastered.length === 1 ? '' : 's'}`;

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
                const isLocked = item.is_locked || (String(item.grade) !== String(currentGrade));
                const lockReason = item.lock_reason || `Esta misión pertenece a ${item.grade}º de Primaria y está bloqueada durante tu partida actual (${currentGrade}º Primaria).`;

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
                            ${isLocked ? `
                                <button class="btn btn-challenge-action btn-challenge-locked" data-grade="${item.grade}" data-story-id="${item.id}" data-locked="true" data-lock-reason="${escapeHtml(lockReason)}" title="${escapeHtml(lockReason)}">
                                    🔒 Bloqueado (${item.grade}º)
                                </button>
                            ` : `
                                <button class="btn btn-challenge-action" data-grade="${item.grade}" data-story-id="${item.id}" data-locked="false">
                                    Aceptar Reto ➔
                                </button>
                            `}
                        </div>
                    </div>
                `;
            }).join("");

            notMasteredTopicsList.querySelectorAll(".btn-challenge-action").forEach(btn => {
                btn.addEventListener("click", () => {
                    const isLocked = btn.dataset.locked === "true";
                    if (isLocked) {
                        const reason = btn.dataset.lockReason || "Esta actividad pertenece a un grado bloqueado.";
                        alert(`🔒 ¡Actividad Bloqueada!\n\n${reason}`);
                        return;
                    }

                    const grade = btn.dataset.grade;
                    const storyId = btn.dataset.storyId;
                    showDashboard();
                    loadStories(grade, storyId);
                });
            });
        }

    } catch (err) {
        console.error("Error al cargar estadísticas:", err);
    }
}

// Sello del nivel: SVG local en img/niveles (sin red)
function levelSeal(num) {
    return `<img class="level-seal" src="img/niveles/nivel-${num}.svg" alt="" width="128" height="128">`;
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

/* ========================================================
   FAB: Inicializar botón flotante de pregunta del día
   ======================================================== */

function initDailyFAB() {
    const fab = document.getElementById("fab-daily");
    const panel = document.getElementById("daily-question-panel");
    const fabPanel = document.querySelector(".fab-panel");

    if (!fab || !panel) return;

    let dailyData = null;

    // Mostrar u ocultar panel cuando se hace FAB
    fab.onclick = async () => {
        if (dailyData) {
            // Ya tenemos los datos, solo mostramos/ocultamos el panel
            if (fabPanel) {
                fabPanel.classList.toggle("active");
            }
            panel.hidden = !panel.hidden;
            return;
        }

        // Fetch la pregunta diaria
        try {
            const resp = await fetch("/api/stories?grade=" + currentGrade + "&daily=1");
            if (!resp.ok) throw new Error("Error al cargar pregunta diaria");
            const data = await resp.json();

            dailyData = data;

            if (!data.daily) {
                panel.hidden = true;
                if (fabPanel) fabPanel.classList.remove("active");
                return;
            }

            const diario = data.daily;
            // Llenar el panel
            const gradeEl = panel.querySelector("#daily-question-grade") || document.createElement("p");
            gradeEl.id = "daily-question-grade";
            gradeEl.textContent = `Grado ${diario.grade}: ${GRADE_NAMES[diario.grade]}`;
            // Asegurarnos de que gradeEl esté en el DOM
            const existingGrade = document.getElementById("daily-question-grade");
            if (!existingGrade) {
                const p = document.createElement("p");
                p.id = "daily-question-grade";
                p.textContent = `Grado ${diario.grade}: ${GRADE_NAMES[diario.grade]}`;
                panel.querySelector(".daily-question-card").prepend(p);
            }

            const qtxt = panel.querySelector("#daily-question-text") || document.createElement("p");
            qtxt.id = "daily-question-text";
            qtxt.textContent = diario.trivia.question;
            if (!existingGrade) panel.querySelector(".daily-question-card").prepend(qtxt);

            // Botón empezar
            const startBtn = panel.querySelector("#btn-daily-start");
            if (startBtn) {
                startBtn.onclick = () => {
                    window.location.hash = `#story-${diario.story.id}`;
                    const storyScreen = document.getElementById("story-screen");
                    if (storyScreen) storyScreen.classList.add("active");
                    dashboardScreen.classList.remove("active");
                    panel.hidden = true;
                    if (fabPanel) fabPanel.classList.remove("active");
                };
            }

            // Mostrar panel FAB y panel principal
            panel.hidden = false;
            if (fabPanel) fabPanel.classList.add("active");
        } catch (e) {
            console.error("Error obteniendo pregunta diaria:", e);
            panel.hidden = true;
            if (fabPanel) fabPanel.classList.remove("active");
        }
    };
}
