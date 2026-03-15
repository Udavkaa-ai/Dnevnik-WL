const Database = require('better-sqlite3');
const db = new Database('diary.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id       INTEGER PRIMARY KEY,
    name          TEXT,
    morning_time  TEXT DEFAULT '09:00',
    evening_time  TEXT DEFAULT '21:00'
  );

  CREATE TABLE IF NOT EXISTS entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    date        TEXT NOT NULL,
    done        TEXT,
    not_done    TEXT,
    mood_score  INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  CREATE TABLE IF NOT EXISTS plans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    plan_date    TEXT NOT NULL,
    task_text    TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    reason       TEXT,
    moved_to     TEXT,
    checked_at   DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  -- Хранит message_id чеклиста чтобы редактировать его при тапе на кнопку
  CREATE TABLE IF NOT EXISTS checklists (
    user_id    INTEGER NOT NULL,
    plan_date  TEXT NOT NULL,
    msg_id     INTEGER NOT NULL,
    chat_id    INTEGER NOT NULL,
    PRIMARY KEY (user_id, plan_date)
  );
`);

// Миграции: добавляем поля если их нет
try { db.exec(`ALTER TABLE entries ADD COLUMN ai_tip TEXT`); } catch (_) {}
['gender', 'family_status'].forEach(col => {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`); } catch (_) {}
});

module.exports = db;
