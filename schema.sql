-- ========================================================
-- HISTORIA DIVERTIDA - ESQUEMA DE BASE DE DATOS PARA TURSO (LIBSQL / SQLITE)
-- ========================================================

-- 1. Tabla de Pequeños Historiadores (Usuarios)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- Identificador único (ej. 'daya', 'mateo')
    name TEXT NOT NULL,                        -- Nombre o apodo visible
    grade TEXT NOT NULL DEFAULT '1',           -- Grado escolar: '1' a '6'
    created_at TEXT NOT NULL,                  -- Fecha de creación (ISO o formato texto)
    last_active TEXT NOT NULL                  -- Última fecha/hora de actividad
);

-- 2. Tabla de Medallas ganadas por usuario
CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    badge_name TEXT NOT NULL,
    earned_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_name)
);

-- 3. Tabla de Historias / Misiones completadas
CREATE TABLE IF NOT EXISTS completed_stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    story_id TEXT NOT NULL,                    -- ID de la misión (ej. '1-1', '2-1')
    completed_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, story_id)
);

-- 4. Tabla de Intentos y Registro de Trivias
CREATE TABLE IF NOT EXISTS attempted_stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,        -- 1 si ya la contestó bien, 0 si no
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, story_id)
);

-- 5. Días con actividad (racha y calendario de calor)
CREATE TABLE IF NOT EXISTS activity_days (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,                         -- Fecha local en formato YYYY-MM-DD
    missions INTEGER NOT NULL DEFAULT 0,       -- Misiones completadas ese día
    PRIMARY KEY (user_id, day),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para optimizar consultas rápidas
CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id);
CREATE INDEX IF NOT EXISTS idx_completed_user ON completed_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_attempted_user ON attempted_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_days(user_id);

-- ========================================================
-- DATOS INICIALES (MIGRACIÓN DE EJEMPLO DE 'DAYA')
-- ========================================================
INSERT OR IGNORE INTO users (id, name, grade, created_at, last_active)
VALUES ('daya', 'daya', '1', '29/10/2026 13:00', datetime('now', 'localtime'));

-- Medallas iniciales de daya
INSERT OR IGNORE INTO badges (user_id, badge_name) VALUES
('daya', 'Medalla de Prehistoria'),
('daya', 'Medalla de Edad de Piedra'),
('daya', 'Medalla de Antiguo Egipto'),
('daya', 'Medalla de Egipto y Comercio'),
('daya', 'Medalla de Antigua Grecia'),
('daya', 'Medalla de Imperio Romano'),
('daya', 'Medalla de Cultura Maya'),
('daya', 'Medalla de Edad Media'),
('daya', 'Medalla de Cultura Mexica'),
('daya', 'Medalla de Era de las Exploraciones'),
('daya', 'Medalla de Revolución Industrial'),
('daya', 'Medalla de Historia Contemporánea');

-- Misiones completadas por daya
INSERT OR IGNORE INTO completed_stories (user_id, story_id) VALUES
('daya', '1-1'), ('daya', '1-2'),
('daya', '2-1'), ('daya', '2-2'),
('daya', '3-1'), ('daya', '3-2'),
('daya', '4-1'), ('daya', '4-2'),
('daya', '5-1'), ('daya', '5-2'),
('daya', '6-1'), ('daya', '6-2');
