require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { analyzeGeneral, analyzePsych, analyzeBalance } = require('./ai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'webapp')));

// ─── Утилиты ─────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
}

// ─── Валидация initData от Telegram ──────────────────────────────────────────
function validateInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    const expectedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (hash !== expectedHash) return null;
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const initData = req.headers['x-init-data'];
  if (!initData) return res.status(401).json({ error: 'Unauthorized' });

  const user = validateInitData(initData);
  if (!user?.id) return res.status(401).json({ error: 'Invalid initData' });

  req.uid = user.id;

  if (!db.prepare('SELECT 1 FROM users WHERE user_id = ?').get(req.uid)) {
    db.prepare('INSERT INTO users (user_id, name) VALUES (?, ?)').run(req.uid, user.first_name || '');
  }

  next();
}

// ─── GET /api/today ───────────────────────────────────────────────────────────
app.get('/api/today', auth, (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date = ?').get(req.uid, todayStr());
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? AND plan_date = ? ORDER BY id').all(req.uid, todayStr());
  const entryCount = db.prepare('SELECT COUNT(*) as c FROM entries WHERE user_id = ?').get(req.uid).c;
  // Последний AI-совет (из вчерашней или предыдущей записи)
  const lastTip = db.prepare(
    `SELECT ai_tip, date FROM entries WHERE user_id = ? AND ai_tip IS NOT NULL AND date < ? ORDER BY date DESC LIMIT 1`
  ).get(req.uid, todayStr());
  res.json({ entry: entry || null, plans, entry_count: entryCount, last_tip: lastTip || null });
});

// ─── GET /api/week ────────────────────────────────────────────────────────────
app.get('/api/week', auth, (req, res) => {
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC LIMIT 7').all(req.uid);
  res.json({ entries });
});

// ─── GET /api/mood ────────────────────────────────────────────────────────────
app.get('/api/mood', auth, (req, res) => {
  const mood = db.prepare(
    `SELECT date, mood_score FROM entries WHERE user_id = ? AND mood_score IS NOT NULL ORDER BY date DESC LIMIT 14`
  ).all(req.uid).reverse();
  res.json({ mood });
});

// ─── PATCH /api/plans/:id/toggle ─────────────────────────────────────────────
app.patch('/api/plans/:id/toggle', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.uid);
  if (!plan) return res.status(404).json({ error: 'Not found' });

  const newStatus = plan.status === 'done' ? 'pending' : 'done';
  db.prepare(
    `UPDATE plans SET status = ?, checked_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?`
  ).run(newStatus, newStatus, plan.id);

  res.json({ id: plan.id, status: newStatus });
});

// ─── GET /api/profile ────────────────────────────────────────────────────────
app.get('/api/profile', auth, (req, res) => {
  const user = db.prepare('SELECT gender, family_status FROM users WHERE user_id = ?').get(req.uid);
  res.json(user || {});
});

// ─── PATCH /api/profile ───────────────────────────────────────────────────────
app.patch('/api/profile', auth, (req, res) => {
  const { gender, family_status } = req.body;
  if (gender) db.prepare('UPDATE users SET gender = ? WHERE user_id = ?').run(gender, req.uid);
  if (family_status) db.prepare('UPDATE users SET family_status = ? WHERE user_id = ?').run(family_status, req.uid);
  res.json({ ok: true });
});

// ─── POST /api/entry ─────────────────────────────────────────────────────────
app.post('/api/entry', auth, (req, res) => {
  const { done, not_done, mood_score, plans, date } = req.body;
  if (!done?.trim() || !mood_score) return res.status(400).json({ error: 'done и mood_score обязательны' });

  // Дата из тела или сегодня; не позволяем будущие даты
  const entryDate = date && date <= todayStr() ? date : todayStr();
  const nextDay = (() => {
    const d = new Date(entryDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  db.prepare(`
    INSERT INTO entries (user_id, date, done, not_done, mood_score)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      done = excluded.done, not_done = excluded.not_done, mood_score = excluded.mood_score
  `).run(req.uid, entryDate, done.trim(), not_done?.trim() || null, mood_score);

  if (Array.isArray(plans) && plans.length) {
    db.prepare(`DELETE FROM plans WHERE user_id = ? AND plan_date = ? AND status = 'pending'`).run(req.uid, nextDay);
    const insert = db.prepare(`INSERT INTO plans (user_id, plan_date, task_text) VALUES (?, ?, ?)`);
    plans.filter(t => t?.trim()).forEach(t => insert.run(req.uid, nextDay, t.trim()));
  }

  res.json({ ok: true, entryDate, nextDay });
});

// ─── POST /api/analyze ───────────────────────────────────────────────────────
app.post('/api/analyze', auth, async (req, res) => {
  const { type } = req.body;
  const uid = req.uid;

  const LIMITS = { general: { days: 7, min: 2 }, psych: { days: 30, min: 5 }, balance: { days: 30, min: 5 } };
  if (!LIMITS[type]) return res.status(400).json({ error: 'Неизвестный тип анализа' });

  const { days, min } = LIMITS[type];
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC LIMIT ?').all(uid, days);
  if (entries.length < min) {
    return res.status(400).json({ error: `Нужно минимум ${min} записи для этого анализа. У тебя пока ${entries.length}.` });
  }

  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY plan_date DESC LIMIT 100').all(uid);
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(uid);

  try {
    let result;
    if (type === 'general') result = await analyzeGeneral(entries, plans, entries.length, user);
    if (type === 'psych')   result = await analyzePsych(entries, plans, entries.length, user);
    if (type === 'balance') result = await analyzeBalance(entries, plans, user);
    res.json({ result });
  } catch (e) {
    console.error('analyze error:', e.message);
    res.status(500).json({ error: 'Ошибка AI. Попробуй позже.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 API на порту ${PORT}`));
