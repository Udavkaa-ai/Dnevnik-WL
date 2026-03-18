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

export async function updatePlan(id, taskText, planDate) {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE plans SET task_text = ?, plan_date = ? WHERE id = ?',
    [taskText, planDate, id]
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
    const existing = await db.getFirstAsync(
      'SELECT id FROM plans WHERE user_id = 1 AND recurring_id = ? AND plan_date = ?',
      [r.id, targetDate]
    );
    if (!existing) {
      await db.runAsync(
        'INSERT INTO plans (user_id, plan_date, task_text, recurring_id) VALUES (1, ?, ?, ?)',
        [targetDate, r.task_text, r.id]
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
        if (t.moved_to) fields.moved_to = t.moved_to;
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
