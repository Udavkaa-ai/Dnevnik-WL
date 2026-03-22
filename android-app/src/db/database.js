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
          recurring_id INTEGER,
          checked_at   DATETIME,
          created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS recurring_plans (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER NOT NULL DEFAULT 1,
          task_text       TEXT NOT NULL,
          recurrence_type TEXT NOT NULL,
          recurrence_day  INTEGER,
          active          INTEGER DEFAULT 1,
          created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        INSERT OR IGNORE INTO users (user_id, name, morning_time, evening_time)
        VALUES (1, 'Пользователь', '09:00', '21:00');
      `);
      // Migrations for existing DBs
      try { await database.execAsync('ALTER TABLE users ADD COLUMN bio TEXT'); } catch (_) {}
      try { await database.execAsync('ALTER TABLE plans ADD COLUMN recurring_id INTEGER'); } catch (_) {}
      try { await database.execAsync('ALTER TABLE plans ADD COLUMN time_start TEXT'); } catch (_) {}
      try { await database.execAsync('ALTER TABLE plans ADD COLUMN time_end TEXT'); } catch (_) {}
      try {
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS recurring_plans (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL DEFAULT 1,
            task_text       TEXT NOT NULL,
            recurrence_type TEXT NOT NULL,
            recurrence_day  INTEGER,
            active          INTEGER DEFAULT 1,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (_) {}
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

export async function getAllTasksForPlanner() {
  const db = await openDatabase();
  return await db.getAllAsync(
    `SELECT * FROM plans WHERE user_id = 1
     ORDER BY
       CASE WHEN plan_date = 'undated' THEN '9999-99-99' ELSE plan_date END ASC,
       id ASC`
  );
}

export async function getOverduePlans() {
  const db = await openDatabase();
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return await db.getAllAsync(
    `SELECT * FROM plans WHERE user_id = 1 AND status = 'pending' AND plan_date < ?
     ORDER BY plan_date ASC`,
    [today]
  );
}

export async function addPlan(date, taskText, timeStart = null, timeEnd = null) {
  const db = await openDatabase();
  const result = await db.runAsync(
    'INSERT INTO plans (user_id, plan_date, task_text, time_start, time_end) VALUES (1, ?, ?, ?, ?)',
    [date, taskText, timeStart || null, timeEnd || null]
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
    const plan = await db.getFirstAsync('SELECT task_text, time_start, time_end FROM plans WHERE id = ?', [id]);
    if (plan) {
      await db.runAsync(
        'INSERT INTO plans (user_id, plan_date, task_text, time_start, time_end) VALUES (1, ?, ?, ?, ?)',
        [moved_to, plan.task_text, plan.time_start, plan.time_end]
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

export async function updatePlan(id, taskText, planDate, timeStart = null, timeEnd = null) {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE plans SET task_text = ?, plan_date = ?, time_start = ?, time_end = ? WHERE id = ?',
    [taskText, planDate, timeStart || null, timeEnd || null, id]
  );
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
  const user = await db.getFirstAsync('SELECT * FROM users WHERE user_id = 1');
  const entries = await db.getAllAsync(
    'SELECT * FROM entries WHERE user_id = 1 ORDER BY date ASC'
  );
  const plans = await db.getAllAsync(
    'SELECT * FROM plans WHERE user_id = 1 ORDER BY plan_date ASC, id ASC'
  );
  const recurring = await db.getAllAsync(
    'SELECT * FROM recurring_plans WHERE user_id = 1 ORDER BY id ASC'
  );

  let text = 'ЛИЧНЫЙ ДНЕВНИК\n';
  text += '═'.repeat(40) + '\n\n';

  // ── Profile section ──
  if (user) {
    text += '━━━ ПРОФИЛЬ ━━━\n\n';
    text += `👤 Имя: ${user.name || ''}\n`;
    text += `⚧ Пол: ${user.gender || ''}\n`;
    text += `👨‍👩‍👧 Семья: ${user.family_status || ''}\n`;
    text += `🕐 Утро: ${user.morning_time || ''}\n`;
    text += `🌙 Вечер: ${user.evening_time || ''}\n`;
    text += `📝 О себе: ${user.bio || ''}\n`;
    text += `🔑 OpenRouter: ${user.openrouter_key || ''}\n`;
    text += '\n';
  }

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
    let header = `📋 ${p.plan_date} | ${p.status}`;
    if (p.status === 'moved' && p.moved_to) header += ` | ${p.moved_to}`;
    text += header + '\n';
    if (p.time_start) text += `🕐 ${p.time_start}${p.time_end ? ' – ' + p.time_end : ''}\n`;
    text += p.task_text + '\n\n';
  }

  // ── Recurring section ──
  if (recurring.length > 0) {
    text += '━━━ ПОВТОРЯЮЩИЕСЯ ━━━\n\n';
    for (const r of recurring) {
      let header = `🔄 ${r.recurrence_type}`;
      if (r.recurrence_day != null) header += ` | ${r.recurrence_day}`;
      text += header + '\n';
      text += r.task_text + '\n\n';
    }
  }

  return text;
}

// ─── Recurring tasks ──────────────────────────────────────────────────────────

function _localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Returns the date string of the current/next occurrence for a recurring task.
// daily   → today
// weekly  → this week's target day (or next week if that day already passed this week... wait, actually: if today IS the day, return today; if day hasn't come yet this week, return it; if day already passed, return next week's)
// Actually: always return the NEAREST upcoming date (today or future) for the given recurrence.
function _recurringTargetDate(type, day) {
  const now = new Date();
  if (type === 'daily') return _localDateStr(now);

  if (type === 'weekly') {
    // day: 1=Mon..7=Sun → JS getDay: 0=Sun,1=Mon..6=Sat
    const targetJs = day === 7 ? 0 : day;
    const currentJs = now.getDay();
    let diff = targetJs - currentJs;
    if (diff < 0) diff += 7; // next week if already passed
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return _localDateStr(t);
  }

  if (type === 'monthly') {
    const todayDay = now.getDate();
    let m = now.getMonth(), y = now.getFullYear();
    if (todayDay > day) { // this month's day already passed → next month
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    const maxDay = new Date(y, m + 1, 0).getDate();
    const t = new Date(y, m, Math.min(day, maxDay));
    return _localDateStr(t);
  }
  return null;
}

export async function getRecurringTasks() {
  const db = await openDatabase();
  return await db.getAllAsync(
    'SELECT * FROM recurring_plans WHERE user_id = 1 ORDER BY id'
  );
}

export async function addRecurringTask(taskText, recurrenceType, recurrenceDay) {
  const db = await openDatabase();
  const result = await db.runAsync(
    'INSERT INTO recurring_plans (user_id, task_text, recurrence_type, recurrence_day) VALUES (1, ?, ?, ?)',
    [taskText, recurrenceType, recurrenceDay ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateRecurringTask(id, taskText, recurrenceType, recurrenceDay) {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE recurring_plans SET task_text = ?, recurrence_type = ?, recurrence_day = ? WHERE id = ?',
    [taskText, recurrenceType, recurrenceDay ?? null, id]
  );
}

export async function deleteRecurringTask(id) {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM recurring_plans WHERE id = ?', [id]);
}

// Creates plan instances for all active recurring tasks if they don't exist yet
// for the current occurrence period.
export async function materializeRecurringTasks() {
  const db = await openDatabase();
  const recurring = await db.getAllAsync(
    'SELECT * FROM recurring_plans WHERE user_id = 1 AND active = 1'
  );
  for (const r of recurring) {
    const targetDate = _recurringTargetDate(r.recurrence_type, r.recurrence_day);
    if (!targetDate) continue;
    // Check by recurring_id first; also check by task_text+date to avoid
    // duplicates after backup restore (imported tasks lose recurring_id).
    const existing = await db.getFirstAsync(
      `SELECT id, recurring_id FROM plans WHERE user_id = 1 AND plan_date = ?
       AND (recurring_id = ? OR (recurring_id IS NULL AND task_text = ?))
       LIMIT 1`,
      [targetDate, r.id, r.task_text]
    );
    if (!existing) {
      await db.runAsync(
        'INSERT INTO plans (user_id, plan_date, task_text, recurring_id) VALUES (1, ?, ?, ?)',
        [targetDate, r.task_text, r.id]
      );
    } else if (!existing.recurring_id) {
      // Re-link imported task back to its recurring definition
      await db.runAsync(
        'UPDATE plans SET recurring_id = ? WHERE id = ?',
        [r.id, existing.id]
      );
    }
  }
}

export async function importDiary(text) {
  // ── Split into sections ──
  const profileSep = text.indexOf('━━━ ПРОФИЛЬ ━━━');
  const entriesSep = text.indexOf('━━━ ЗАПИСИ ━━━');
  const tasksSep   = text.indexOf('━━━ ЗАДАЧИ ━━━');
  const recurringSep = text.indexOf('━━━ ПОВТОРЯЮЩИЕСЯ ━━━');

  const profileSection   = profileSep !== -1 ? text.slice(profileSep, entriesSep !== -1 ? entriesSep : undefined) : '';
  let entriesSection     = entriesSep !== -1 ? text.slice(entriesSep, tasksSep !== -1 ? tasksSep : undefined) : text;
  const tasksSection     = tasksSep !== -1   ? text.slice(tasksSep + '━━━ ЗАДАЧИ ━━━'.length, recurringSep !== -1 ? recurringSep : undefined) : '';
  const recurringSection = recurringSep !== -1 ? text.slice(recurringSep + '━━━ ПОВТОРЯЮЩИЕСЯ ━━━'.length) : '';

  // ── Parse entries ──
  const entries = [];
  let current = null;
  let currentField = null; // tracks which text field is being accumulated

  const flushEntry = () => {
    if (current && current.date) entries.push(current);
    current = null;
    currentField = null;
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
      currentField = 'done';
      continue;
    }
    const notDoneMatch = line.match(/❌\s+Не получилось:\s*(.*)/);
    if (notDoneMatch) {
      const val = notDoneMatch[1].trim();
      current.not_done = (val === '—' || val === '') ? null : val;
      currentField = 'not_done';
      continue;
    }
    const moodMatch = line.match(/🎯\s+Оценка дня:\s*(\d+)\/10/);
    if (moodMatch) {
      current.mood_score = parseInt(moodMatch[1], 10);
      currentField = null;
      continue;
    }
    const tipMatch = line.match(/💡\s+Совет:\s*(.*)/);
    if (tipMatch) {
      current.ai_tip = tipMatch[1].trim() || null;
      currentField = 'ai_tip';
      continue;
    }
    // Continuation line — append to the currently active text field
    const trimmed = line.trim();
    if (trimmed && currentField && current[currentField] !== null) {
      current[currentField] = current[currentField] + '\n' + trimmed;
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
          time_start: null,
          time_end: null,
        };
        continue;
      }
      if (!currentTask) continue;
      // 🕐 HH:MM [– HH:MM]
      const timeMatch = line.match(/🕐\s+(\d{1,2}:\d{2})(?:\s+–\s+(\d{1,2}:\d{2}))?/);
      if (timeMatch) {
        currentTask.time_start = timeMatch[1];
        currentTask.time_end   = timeMatch[2] || null;
        continue;
      }
      const trimmed = line.trim();
      if (trimmed) {
        if (!currentTask.task_text) {
          currentTask.task_text = trimmed;
        } else {
          currentTask.task_text += '\n' + trimmed;
        }
      }
    }
    flushTask();
  }

  // ── Parse profile ──
  const profile = {};
  if (profileSection) {
    for (const line of profileSection.split('\n')) {
      const nameM    = line.match(/👤\s+Имя:\s*(.*)/);       if (nameM    && nameM[1].trim())    profile.name           = nameM[1].trim();
      const genderM  = line.match(/⚧\s+Пол:\s*(.*)/);        if (genderM  && genderM[1].trim())  profile.gender         = genderM[1].trim();
      const familyM  = line.match(/👨‍👩‍👧\s+Семья:\s*(.*)/);     if (familyM  && familyM[1].trim())  profile.family_status  = familyM[1].trim();
      const morningM = line.match(/🕐\s+Утро:\s*(.*)/);       if (morningM && morningM[1].trim()) profile.morning_time   = morningM[1].trim();
      const eveningM = line.match(/🌙\s+Вечер:\s*(.*)/);      if (eveningM && eveningM[1].trim()) profile.evening_time   = eveningM[1].trim();
      const bioM     = line.match(/📝\s+О себе:\s*(.*)/);     if (bioM     && bioM[1].trim())     profile.bio            = bioM[1].trim();
      const keyM     = line.match(/🔑\s+OpenRouter:\s*(.*)/); if (keyM     && keyM[1].trim())     profile.openrouter_key = keyM[1].trim();
    }
  }

  // ── Parse recurring tasks ──
  const recurringTasks = [];
  if (recurringSection) {
    let curR = null;
    const flushR = () => { if (curR && curR.task_text) recurringTasks.push(curR); curR = null; };
    for (const line of recurringSection.split('\n')) {
      const rMatch = line.match(/🔄\s+(\w+)(?:\s+\|\s+(\d+))?/);
      if (rMatch) {
        flushR();
        curR = { recurrence_type: rMatch[1], recurrence_day: rMatch[2] ? parseInt(rMatch[2], 10) : null, task_text: null };
        continue;
      }
      if (!curR) continue;
      const t = line.trim();
      if (t && !curR.task_text) curR.task_text = t;
    }
    flushR();
  }

  if (entries.length === 0 && tasks.length === 0 && recurringTasks.length === 0 && Object.keys(profile).length === 0) {
    throw new Error('Данные не найдены. Проверь формат файла.');
  }

  const db = await openDatabase();
  let imported = 0;
  let skipped = 0;
  let tasksImported = 0;
  let tasksSkipped = 0;
  let recurringImported = 0;
  let recurringSkipped = 0;
  let profileUpdated = false;

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
        if (t.moved_to)   fields.moved_to   = t.moved_to;
        if (t.time_start) fields.time_start  = t.time_start;
        if (t.time_end)   fields.time_end    = t.time_end;
        const keys = Object.keys(fields);
        await db.runAsync(
          `INSERT INTO plans (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map(k => fields[k])
        );
        tasksImported++;
      }
    }

    // Import recurring tasks — deduplicate by task_text + recurrence_type + recurrence_day
    for (const r of recurringTasks) {
      if (!r.task_text || !r.recurrence_type) continue;
      const existing = await db.getFirstAsync(
        'SELECT id FROM recurring_plans WHERE user_id = 1 AND task_text = ? AND recurrence_type = ? AND recurrence_day IS ?',
        [r.task_text, r.recurrence_type, r.recurrence_day]
      );
      if (existing) {
        recurringSkipped++;
      } else {
        await db.runAsync(
          'INSERT INTO recurring_plans (user_id, task_text, recurrence_type, recurrence_day) VALUES (1, ?, ?, ?)',
          [r.task_text, r.recurrence_type, r.recurrence_day ?? null]
        );
        recurringImported++;
      }
    }

    // Restore profile fields (only non-empty values that don't overwrite existing)
    if (Object.keys(profile).length > 0) {
      const currentUser = await db.getFirstAsync('SELECT * FROM users WHERE user_id = 1');
      const toSet = {};
      for (const [k, v] of Object.entries(profile)) {
        if (v && (!currentUser[k] || currentUser[k] === '' || currentUser[k] === 'Пользователь')) {
          toSet[k] = v;
        }
      }
      if (Object.keys(toSet).length > 0) {
        const sets = Object.keys(toSet).map(k => `${k} = ?`).join(', ');
        await db.runAsync(`UPDATE users SET ${sets} WHERE user_id = 1`, Object.values(toSet));
        profileUpdated = true;
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
    recurringImported, recurringSkipped, recurringTotal: recurringTasks.length,
    profileUpdated,
  };
}

// ─── Calendar ICS Export ──────────────────────────────────────────────────────

// Exports pending tasks (with dates) as iCalendar (.ics) format.
// daysAhead: how many days into the future to include (default 90).
// Pass daysAhead = -1 to export all future pending tasks with no limit.
export async function exportCalendarICS(daysAhead = 90) {
  const db = await openDatabase();

  const today = new Date();
  const todayStr = _localDateStr(today);

  let query = `SELECT * FROM plans WHERE user_id = 1 AND status = 'pending' AND plan_date != 'undated' AND plan_date >= ? ORDER BY plan_date ASC, id ASC`;
  const params = [todayStr];

  if (daysAhead >= 0) {
    const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead);
    const limitStr = _localDateStr(limit);
    query = `SELECT * FROM plans WHERE user_id = 1 AND status = 'pending' AND plan_date != 'undated' AND plan_date >= ? AND plan_date <= ? ORDER BY plan_date ASC, id ASC`;
    params.push(limitStr);
  }

  const plans = await db.getAllAsync(query, params);

  const dtstamp = _icsDateTimeNow();

  const escape = (s) => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const events = plans.map(p => {
    const [y, mo, d] = p.plan_date.split('-').map(Number);

    if (p.time_start) {
      // Timed event — floating local time (no Z = device local)
      const toIcsTime = (hhmm) => {
        const [h, m] = hhmm.split(':');
        return `${p.plan_date.replace(/-/g, '')}T${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}00`;
      };
      const dtstart = toIcsTime(p.time_start);
      let dtend;
      if (p.time_end) {
        dtend = toIcsTime(p.time_end);
      } else {
        // Default duration: 1 hour
        const [h, m] = p.time_start.split(':').map(Number);
        const endDate = new Date(y, mo - 1, d, h + 1, m);
        const endDateStr = _localDateStr(endDate).replace(/-/g, '');
        const endH = String(endDate.getHours()).padStart(2, '0');
        const endM = String(endDate.getMinutes()).padStart(2, '0');
        dtend = `${endDateStr}T${endH}${endM}00`;
      }
      return [
        'BEGIN:VEVENT',
        `UID:dnevnik-task-${p.id}@app`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${escape(p.task_text)}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ].join('\r\n');
    }

    // All-day event
    const dtstart = p.plan_date.replace(/-/g, '');
    const nextDay = new Date(y, mo - 1, d + 1);
    const dtend = _localDateStr(nextDay).replace(/-/g, '');
    return [
      'BEGIN:VEVENT',
      `UID:dnevnik-task-${p.id}@app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${escape(p.task_text)}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    ].join('\r\n');
  });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Дневник//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Мои задачи',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';

  return { ics, count: plans.length };
}

// ─── Calendar ICS Import ──────────────────────────────────────────────────────

// Imports events from .ics text into plans/recurring_plans.
// Filtering rules:
//   - Non-recurring: only events starting today, tomorrow, or day-after-tomorrow
//   - Recurring: imported as recurring_plans (materialized by materializeRecurringTasks)
//   - Multi-day events: imported as single task on start day with "(до DD.MM)" suffix
//   - Simple RRULE (daily / single weekday / single monthday) → recurring_plans
//   - Complex RRULE (multi-day-of-week) → one recurring_plans per weekday
//   - Unsupported RRULE (yearly, ordinal weekday, etc.) → skipped
export async function importCalendarICS(text) {
  // Unfold long lines (RFC 5545: CRLF + space/tab continues previous line)
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  // ── Parse VEVENT blocks ──────────────────────────────────────────────────
  const events = [];
  let cur = null;
  for (const line of lines) {
    const t = line.trim();
    if (t === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (t === 'END:VEVENT')   { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const rawName = line.slice(0, colonIdx);
    const value   = line.slice(colonIdx + 1).trim();
    const parts   = rawName.split(';');
    const name    = parts[0].toUpperCase();
    if (cur[name]) continue; // keep first occurrence only
    const params  = {};
    for (const p of parts.slice(1)) {
      const eq = p.indexOf('=');
      if (eq !== -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    cur[name] = { value, params };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pad2 = (n) => String(n).padStart(2, '0');

  const parseDT = (prop) => {
    if (!prop) return null;
    const { value, params } = prop;
    const isAllDay = params.VALUE === 'DATE' || value.length === 8;
    const isUTC    = value.endsWith('Z');
    const raw      = value.replace('Z', '');

    const y  = parseInt(raw.slice(0, 4), 10);
    const mo = parseInt(raw.slice(4, 6), 10) - 1;
    const d  = parseInt(raw.slice(6, 8), 10);

    if (isAllDay) {
      return { dateObj: new Date(y, mo, d), time: null };
    }

    const h   = parseInt(raw.slice(9, 11), 10)  || 0;
    const min = parseInt(raw.slice(11, 13), 10) || 0;
    const full = isUTC
      ? new Date(Date.UTC(y, mo, d, h, min, 0))
      : new Date(y, mo, d, h, min, 0);

    return {
      dateObj: new Date(full.getFullYear(), full.getMonth(), full.getDate()),
      time: `${pad2(full.getHours())}:${pad2(full.getMinutes())}`,
    };
  };

  const unescape = (s) => (s || '')
    .replace(/\\n/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();

  // 3-day window: today … day-after-tomorrow
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxDate    = new Date(todayLocal);
  maxDate.setDate(maxDate.getDate() + 2);

  const BYDAY_MAP = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };

  // ── Process events ───────────────────────────────────────────────────────
  let plansImported = 0;
  let recurringImported = 0;
  let skipped = 0;

  const db = await openDatabase();
  await db.execAsync('BEGIN');
  try {
    for (const ev of events) {
      const summary = unescape(ev.SUMMARY?.value);
      if (!summary) { skipped++; continue; }

      const dtstart = parseDT(ev.DTSTART);
      if (!dtstart) { skipped++; continue; }

      // ── Recurring ────────────────────────────────────────────────────────
      if (ev.RRULE) {
        const rule = {};
        for (const p of ev.RRULE.value.split(';')) {
          const eq = p.indexOf('=');
          if (eq !== -1) rule[p.slice(0, eq)] = p.slice(eq + 1);
        }
        const { FREQ, BYDAY, BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYSETPOS } = rule;

        // Skip unsupported frequencies / modifiers
        if (!FREQ || BYYEARDAY || BYWEEKNO || BYSETPOS ||
            FREQ === 'YEARLY' || FREQ === 'HOURLY' || FREQ === 'MINUTELY' || FREQ === 'SECONDLY') {
          skipped++;
          continue;
        }

        const taskText = dtstart.time ? `${summary} (${dtstart.time})` : summary;
        let entries = [];

        if (FREQ === 'DAILY' && !BYDAY) {
          entries = [{ recurrence_type: 'daily', recurrence_day: null }];

        } else if (FREQ === 'WEEKLY' && BYDAY) {
          const days = BYDAY.split(',')
            .map(s => {
              const t = s.trim().toUpperCase();
              if (/^\d/.test(t)) return null; // ordinal weekday like 2MO → skip
              return BYDAY_MAP[t.slice(-2)];
            })
            .filter(Boolean);
          if (days.length === 0) { skipped++; continue; }
          entries = days.map(day => ({ recurrence_type: 'weekly', recurrence_day: day }));

        } else if (FREQ === 'MONTHLY' && BYMONTHDAY) {
          const days = BYMONTHDAY.split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => n >= 1 && n <= 31);
          if (days.length === 0) { skipped++; continue; }
          entries = days.map(day => ({ recurrence_type: 'monthly', recurrence_day: day }));

        } else {
          skipped++;
          continue;
        }

        for (const entry of entries) {
          const existing = await db.getFirstAsync(
            'SELECT id FROM recurring_plans WHERE user_id = 1 AND task_text = ? AND recurrence_type = ? AND recurrence_day IS ?',
            [taskText, entry.recurrence_type, entry.recurrence_day ?? null]
          );
          if (!existing) {
            await db.runAsync(
              'INSERT INTO recurring_plans (user_id, task_text, recurrence_type, recurrence_day) VALUES (1, ?, ?, ?)',
              [taskText, entry.recurrence_type, entry.recurrence_day ?? null]
            );
            recurringImported++;
          }
        }
        continue;
      }

      // ── Non-recurring: check 3-day window ───────────────────────────────
      if (dtstart.dateObj < todayLocal || dtstart.dateObj > maxDate) {
        skipped++;
        continue;
      }

      // Multi-day detection
      let taskText = summary;
      const dtend = parseDT(ev.DTEND);
      if (dtend) {
        const diffDays = Math.round((dtend.dateObj - dtstart.dateObj) / 86400000);
        const isEndAllDay = !ev.DTEND?.value.includes('T');
        // For all-day events DTEND is exclusive, so diffDays > 1 = multi-day
        // For timed events diffDays >= 2 = truly multi-day (> 1 day boundary crossed)
        const multiDayThreshold = isEndAllDay ? 1 : 2;
        if (diffDays >= multiDayThreshold) {
          const effectiveEnd = isEndAllDay
            ? new Date(dtend.dateObj.getTime() - 86400000)
            : dtend.dateObj;
          taskText = `${summary} (до ${pad2(effectiveEnd.getDate())}.${pad2(effectiveEnd.getMonth() + 1)})`;
        }
      }

      const planDate  = _localDateStr(dtstart.dateObj);
      const timeStart = dtstart.time || null;
      const timeEnd   = (dtend?.time && dtend.time !== dtstart.time) ? dtend.time : null;

      const existing = await db.getFirstAsync(
        "SELECT id FROM plans WHERE user_id = 1 AND task_text = ? AND plan_date = ? AND status = 'pending'",
        [taskText, planDate]
      );
      if (!existing) {
        await db.runAsync(
          'INSERT INTO plans (user_id, plan_date, task_text, time_start, time_end) VALUES (1, ?, ?, ?, ?)',
          [planDate, taskText, timeStart, timeEnd]
        );
        plansImported++;
      }
    }

    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }

  return { plansImported, recurringImported, skipped, total: events.length };
}

function _icsDateTimeNow() {
  const n = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`;
}
