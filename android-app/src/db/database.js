import * as SQLite from 'expo-sqlite';

let db = null;

export async function openDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('diary.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      user_id       INTEGER PRIMARY KEY,
      name          TEXT,
      morning_time  TEXT DEFAULT '09:00',
      evening_time  TEXT DEFAULT '21:00',
      gender        TEXT,
      family_status TEXT,
      openrouter_key TEXT
    );

    CREATE TABLE IF NOT EXISTS entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL DEFAULT 1,
      date        TEXT NOT NULL,
      done        TEXT,
      not_done    TEXT,
      mood_score  INTEGER,
      ai_tip      TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS plans (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL DEFAULT 1,
      plan_date    TEXT NOT NULL,
      task_text    TEXT NOT NULL,
      status       TEXT DEFAULT 'pending',
      reason       TEXT,
      moved_to     TEXT,
      checked_at   DATETIME,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO users (user_id, name, morning_time, evening_time)
    VALUES (1, 'Пользователь', '09:00', '21:00');
  `);

  return db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUser() {
  const db = await openDatabase();
  return await db.getFirstAsync('SELECT * FROM users WHERE user_id = 1');
}

export async function updateUser(fields) {
  const db = await openDatabase();
  const keys = Object.keys(fields);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  await db.runAsync(`UPDATE users SET ${sets} WHERE user_id = 1`, vals);
}

// ─── Entries ─────────────────────────────────────────────────────────────────

export async function getEntry(date) {
  const db = await openDatabase();
  return await db.getFirstAsync(
    'SELECT * FROM entries WHERE user_id = 1 AND date = ?',
    [date]
  );
}

export async function getRecentEntries(days = 14) {
  const db = await openDatabase();
  return await db.getAllAsync(
    `SELECT * FROM entries WHERE user_id = 1
     ORDER BY date DESC LIMIT ?`,
    [days]
  );
}

export async function getAllEntries() {
  const db = await openDatabase();
  return await db.getAllAsync(
    'SELECT * FROM entries WHERE user_id = 1 ORDER BY date DESC'
  );
}

export async function upsertEntry(date, fields) {
  const db = await openDatabase();
  const existing = await getEntry(date);
  if (existing) {
    const keys = Object.keys(fields);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const vals = [...keys.map(k => fields[k]), date];
    await db.runAsync(
      `UPDATE entries SET ${sets} WHERE user_id = 1 AND date = ?`,
      vals
    );
  } else {
    const allFields = { user_id: 1, date, ...fields };
    const keys = Object.keys(allFields);
    const placeholders = keys.map(() => '?').join(', ');
    const vals = keys.map(k => allFields[k]);
    await db.runAsync(
      `INSERT INTO entries (${keys.join(', ')}) VALUES (${placeholders})`,
      vals
    );
  }
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function getPlansForDate(date) {
  const db = await openDatabase();
  return await db.getAllAsync(
    'SELECT * FROM plans WHERE user_id = 1 AND plan_date = ? ORDER BY id',
    [date]
  );
}

export async function getPendingPlans() {
  const db = await openDatabase();
  return await db.getAllAsync(
    `SELECT * FROM plans WHERE user_id = 1 AND status = 'pending'
     ORDER BY plan_date ASC, id ASC`
  );
}

export async function getOverduePlans() {
  const db = await openDatabase();
  const today = new Date().toISOString().split('T')[0];
  return await db.getAllAsync(
    `SELECT * FROM plans WHERE user_id = 1 AND status = 'pending' AND plan_date < ?
     ORDER BY plan_date ASC`,
    [today]
  );
}

export async function addPlan(date, taskText) {
  const db = await openDatabase();
  const result = await db.runAsync(
    'INSERT INTO plans (user_id, plan_date, task_text) VALUES (1, ?, ?)',
    [date, taskText]
  );
  return result.lastInsertRowId;
}

export async function addPlans(date, tasks) {
  const db = await openDatabase();
  for (const task of tasks) {
    if (task.trim()) {
      await db.runAsync(
        'INSERT INTO plans (user_id, plan_date, task_text) VALUES (1, ?, ?)',
        [date, task.trim()]
      );
    }
  }
}

export async function updatePlanStatus(id, status, extra = {}) {
  const db = await openDatabase();
  const { reason, moved_to } = extra;
  if (status === 'done') {
    await db.runAsync(
      `UPDATE plans SET status = 'done', checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  } else if (status === 'moved' && moved_to) {
    await db.runAsync(
      `UPDATE plans SET status = 'moved', moved_to = ?, reason = ? WHERE id = ?`,
      [moved_to, reason || null, id]
    );
    // Create new pending task for the new date
    const plan = await db.getFirstAsync('SELECT task_text FROM plans WHERE id = ?', [id]);
    if (plan) {
      await db.runAsync(
        'INSERT INTO plans (user_id, plan_date, task_text) VALUES (1, ?, ?)',
        [moved_to, plan.task_text]
      );
    }
  } else if (status === 'cancelled') {
    await db.runAsync(
      `UPDATE plans SET status = 'cancelled', reason = ? WHERE id = ?`,
      [reason || null, id]
    );
  }
}

export async function deletePlan(id) {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM plans WHERE id = ?', [id]);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getMoodData(days = 14) {
  const db = await openDatabase();
  return await db.getAllAsync(
    `SELECT date, mood_score FROM entries
     WHERE user_id = 1 AND mood_score IS NOT NULL
     ORDER BY date DESC LIMIT ?`,
    [days]
  );
}

export async function getTaskStats(days = 7) {
  const db = await openDatabase();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const row = await db.getFirstAsync(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
       SUM(CASE WHEN status = 'moved' THEN 1 ELSE 0 END) as moved
     FROM plans
     WHERE user_id = 1 AND plan_date >= ?`,
    [sinceStr]
  );
  return row;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function exportDiary() {
  const db = await openDatabase();
  const entries = await db.getAllAsync(
    'SELECT * FROM entries WHERE user_id = 1 ORDER BY date ASC'
  );

  let text = 'ЛИЧНЫЙ ДНЕВНИК\n';
  text += '═'.repeat(40) + '\n\n';

  for (const e of entries) {
    text += `📅 ${e.date}\n`;
    text += `✅ Сделал: ${e.done || '—'}\n`;
    if (e.not_done) text += `❌ Не получилось: ${e.not_done}\n`;
    if (e.mood_score) text += `🎯 Оценка дня: ${e.mood_score}/10\n`;
    if (e.ai_tip) text += `💡 Совет: ${e.ai_tip}\n`;
    text += '\n';
  }

  return text;
}
