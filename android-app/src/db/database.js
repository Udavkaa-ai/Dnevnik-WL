import * as SQLite from 'expo-sqlite';

let db = null;
let dbInitPromise = null;

export async function openDatabase() {
  if (db) return db;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('diary.db');
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
          user_id       INTEGER PRIMARY KEY,
          name          TEXT,
          morning_time  TEXT DEFAULT '09:00',
          evening_time  TEXT DEFAULT '21:00',
          gender        TEXT,
          family_status TEXT,
          openrouter_key TEXT,
          bio           TEXT
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
      // Migration: add bio column if not exists (for existing DBs)
      try {
        await database.execAsync('ALTER TABLE users ADD COLUMN bio TEXT');
      } catch (_) { /* column already exists */ }
      db = database;
      return db;
    })();
  }
  return dbInitPromise;
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
    "SELECT * FROM plans WHERE user_id = 1 AND plan_date = ? AND status IN ('pending', 'done') ORDER BY id",
    [date]
  );
}

export async function getUndatedPlans() {
  const db = await openDatabase();
  return await db.getAllAsync(
    "SELECT * FROM plans WHERE user_id = 1 AND plan_date = 'undated' AND status = 'pending' ORDER BY id"
  );
}

export async function moveToUndated(id) {
  const db = await openDatabase();
  await db.runAsync(
    "UPDATE plans SET plan_date = 'undated', status = 'pending' WHERE id = ?",
    [id]
  );
}

export async function getPendingPlans() {
  const db = await openDatabase();
  return await db.getAllAsync(
    `SELECT * FROM plans WHERE user_id = 1 AND status = 'pending'
     ORDER BY plan_date ASC, id ASC`
  );
}

// Returns all tasks for the planner tab EXCEPT today's pending tasks
// (today's pending tasks are shown on the Home screen checklist)
export async function getAllTasksForPlanner() {
  const db = await openDatabase();
  const todayStr = new Date().toISOString().split('T')[0];
  return await db.getAllAsync(
    `SELECT * FROM plans WHERE user_id = 1
     AND NOT (plan_date = ? AND status = 'pending')
     ORDER BY
       CASE WHEN plan_date = 'undated' THEN '9999-99-99' ELSE plan_date END ASC,
       id ASC`,
    [todayStr]
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
  await db.execAsync('BEGIN');
  try {
    for (const task of tasks) {
      if (task.trim()) {
        await db.runAsync(
          'INSERT INTO plans (user_id, plan_date, task_text) VALUES (1, ?, ?)',
          [date, task.trim()]
        );
      }
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function updatePlanStatus(id, status, extra = {}) {
  const db = await openDatabase();
  const { reason, moved_to } = extra;
  if (status === 'pending') {
    await db.runAsync(
      `UPDATE plans SET status = 'pending', checked_at = NULL WHERE id = ?`,
      [id]
    );
  } else if (status === 'done') {
    await db.runAsync(
      `UPDATE plans SET status = 'done', checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  } else if (status === 'moved' && moved_to) {
    await db.runAsync(
      `UPDATE plans SET status = 'moved', moved_to = ?, reason = ? WHERE id = ?`,
      [moved_to, reason || null, id]
    );
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

// ─── Export / Import ─────────────────────────────────────────────────────────

export async function exportDiary() {
  const db = await openDatabase();
  const entries = await db.getAllAsync(
    'SELECT * FROM entries WHERE user_id = 1 ORDER BY date ASC'
  );
  const plans = await db.getAllAsync(
    'SELECT * FROM plans WHERE user_id = 1 ORDER BY plan_date ASC, id ASC'
  );

  let text = 'ЛИЧНЫЙ ДНЕВНИК\n';
  text += '═'.repeat(40) + '\n\n';

  // ── Entries section ──
  text += '━━━ ЗАПИСИ ━━━\n\n';
  for (const e of entries) {
    text += `📅 ${e.date}\n`;
    text += `✅ Текст: ${e.done || '—'}\n`;
    if (e.not_done) text += `❌ Не получилось: ${e.not_done}\n`;
    if (e.mood_score) text += `🎯 Оценка дня: ${e.mood_score}/10\n`;
    if (e.ai_tip) text += `💡 Совет: ${e.ai_tip}\n`;
    text += '\n';
  }

  // ── Tasks section ──
  text += '━━━ ЗАДАЧИ ━━━\n\n';
  for (const p of plans) {
    // Header line: 📋 <date> | <status> [| <moved_to>]
    let header = `📋 ${p.plan_date} | ${p.status}`;
    if (p.status === 'moved' && p.moved_to) header += ` | ${p.moved_to}`;
    text += header + '\n';
    text += p.task_text + '\n\n';
  }

  return text;
}

export async function importDiary(text) {
  const lines = text.split('\n');

  // ── Split into sections ──
  let entriesSection = text;
  let tasksSection = '';

  const tasksSep = text.indexOf('━━━ ЗАДАЧИ ━━━');
  if (tasksSep !== -1) {
    entriesSection = text.slice(0, tasksSep);
    tasksSection = text.slice(tasksSep + '━━━ ЗАДАЧИ ━━━'.length);
  }

  // ── Parse entries ──
  const entries = [];
  let current = null;

  const flushEntry = () => {
    if (current && current.date) entries.push(current);
    current = null;
  };

  for (const line of entriesSection.split('\n')) {
    const dateMatch = line.match(/📅\s+(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      flushEntry();
      current = { date: dateMatch[1], done: null, not_done: null, mood_score: null, ai_tip: null };
      continue;
    }
    if (!current) continue;

    // Support both old format (✅ Сделал:) and new (✅ Текст:)
    const doneMatch = line.match(/✅\s+(?:Сделал|Текст):\s*(.*)/);
    if (doneMatch) {
      const val = doneMatch[1].trim();
      current.done = (val === '—' || val === '') ? null : val;
      continue;
    }
    const notDoneMatch = line.match(/❌\s+Не получилось:\s*(.*)/);
    if (notDoneMatch) {
      const val = notDoneMatch[1].trim();
      current.not_done = (val === '—' || val === '') ? null : val;
      continue;
    }
    const moodMatch = line.match(/🎯\s+Оценка дня:\s*(\d+)\/10/);
    if (moodMatch) {
      current.mood_score = parseInt(moodMatch[1], 10);
      continue;
    }
    const tipMatch = line.match(/💡\s+Совет:\s*(.*)/);
    if (tipMatch) {
      current.ai_tip = tipMatch[1].trim() || null;
      continue;
    }
  }
  flushEntry();

  // ── Parse tasks ──
  const tasks = [];
  if (tasksSection) {
    let currentTask = null;

    const flushTask = () => {
      if (currentTask && currentTask.task_text) tasks.push(currentTask);
      currentTask = null;
    };

    for (const line of tasksSection.split('\n')) {
      // 📋 <date> | <status> [| <moved_to>]
      const taskHeaderMatch = line.match(/📋\s+(\S+)\s+\|\s+(\w+)(?:\s+\|\s+(\S+))?/);
      if (taskHeaderMatch) {
        flushTask();
        currentTask = {
          plan_date: taskHeaderMatch[1],
          status: taskHeaderMatch[2],
          moved_to: taskHeaderMatch[3] || null,
          task_text: null,
        };
        continue;
      }
      if (!currentTask) continue;
      const trimmed = line.trim();
      if (trimmed && !currentTask.task_text) {
        currentTask.task_text = trimmed;
      }
    }
    flushTask();
  }

  if (entries.length === 0 && tasks.length === 0) {
    throw new Error('Данные не найдены. Проверь формат файла.');
  }

  const db = await openDatabase();
  let imported = 0;
  let skipped = 0;
  let tasksImported = 0;
  let tasksSkipped = 0;

  await db.execAsync('BEGIN');
  try {
    // Import entries
    for (const e of entries) {
      const existing = await db.getFirstAsync(
        'SELECT id FROM entries WHERE user_id = 1 AND date = ?', [e.date]
      );
      if (existing) {
        skipped++;
      } else {
        const fields = {};
        if (e.done !== null) fields.done = e.done;
        if (e.not_done !== null) fields.not_done = e.not_done;
        if (e.mood_score !== null) fields.mood_score = e.mood_score;
        if (e.ai_tip !== null) fields.ai_tip = e.ai_tip;
        const allFields = { user_id: 1, date: e.date, ...fields };
        const keys = Object.keys(allFields);
        await db.runAsync(
          `INSERT INTO entries (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map(k => allFields[k])
        );
        imported++;
      }
    }

    // Import tasks — deduplicate by task_text + plan_date + status
    for (const t of tasks) {
      if (!t.task_text || !t.plan_date || !t.status) continue;
      const existing = await db.getFirstAsync(
        'SELECT id FROM plans WHERE user_id = 1 AND task_text = ? AND plan_date = ? AND status = ?',
        [t.task_text, t.plan_date, t.status]
      );
      if (existing) {
        tasksSkipped++;
      } else {
        const fields = { user_id: 1, plan_date: t.plan_date, task_text: t.task_text, status: t.status };
        if (t.moved_to) fields.moved_to = t.moved_to;
        const keys = Object.keys(fields);
        await db.runAsync(
          `INSERT INTO plans (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map(k => fields[k])
        );
        tasksImported++;
      }
    }

    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }

  return {
    imported, skipped, total: entries.length,
    tasksImported, tasksSkipped, tasksTotal: tasks.length,
  };
}
