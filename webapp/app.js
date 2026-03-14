const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ─── API ─────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-init-data': tg.initData || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

function fmtDateLong(s) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${parseInt(d)} ${MONTHS_GEN[parseInt(m) - 1]}`;
}
function fmtDateShort(s) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${parseInt(d)} ${MONTHS_SHORT[parseInt(m) - 1]}`;
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

function moodEmoji(score) {
  if (score >= 9) return '🔥';
  if (score >= 7) return '👍';
  if (score >= 5) return '😐';
  if (score >= 3) return '😔';
  return '😩';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Навигация ────────────────────────────────────────────────────────────────
function showScreen(name, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = btn || document.querySelector(`.nav-btn[data-screen="${name}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (name === 'today') loadToday();
  if (name === 'history') loadHistory();
  if (name === 'mood') loadMood();
  if (name === 'entry') initEntry();
}

// ─── Сегодня ─────────────────────────────────────────────────────────────────
async function loadToday() {
  const now = new Date();
  document.getElementById('today-date').textContent =
    `${now.getDate()} ${MONTHS_GEN[now.getMonth()]} ${now.getFullYear()}`;

  try {
    const { entry, plans } = await api('GET', '/api/today');

    // Карточка итога дня
    const card = document.getElementById('today-entry-card');
    if (entry) {
      document.getElementById('today-entry-done').textContent = entry.done;
      document.getElementById('today-entry-mood').textContent =
        entry.mood_score ? `${moodEmoji(entry.mood_score)} ${entry.mood_score}/10` : '';
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }

    // Чеклист
    const wrap = document.getElementById('today-checklist');
    const empty = document.getElementById('today-empty');
    const title = document.getElementById('plans-section-title');

    if (!plans.length) {
      wrap.innerHTML = '';
      title.textContent = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      title.textContent = 'Планы на сегодня';
      wrap.innerHTML = plans.map(p => `
        <div class="checklist-item" onclick="togglePlan(${p.id}, this)" data-status="${p.status}">
          <span class="check-icon">${p.status === 'done' ? '✅' : '☐'}</span>
          <span class="check-text${p.status === 'done' ? ' done' : ''}">${escHtml(p.task_text)}</span>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('loadToday:', e);
  }
}

async function togglePlan(id, el) {
  try {
    const { status } = await api('PATCH', `/api/plans/${id}/toggle`);
    el.dataset.status = status;
    el.querySelector('.check-icon').textContent = status === 'done' ? '✅' : '☐';
    el.querySelector('.check-text').classList.toggle('done', status === 'done');
    tg.HapticFeedback?.impactOccurred('light');
  } catch (e) {
    console.error('togglePlan:', e);
  }
}

// ─── Итог (форма) ─────────────────────────────────────────────────────────────
let selectedMood = 5;
let taskList = [];

function initEntry() {
  showStep(1);
  document.getElementById('input-done').value = '';
  document.getElementById('input-not-done').value = '';
  selectedMood = 5;
  taskList = [];
  renderTaskList();

  // Сетка оценок
  const grid = document.getElementById('mood-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className = 'mood-btn' + (i === 5 ? ' selected' : '');
    btn.textContent = i;
    btn.onclick = () => selectMood(i);
    grid.appendChild(btn);
  }
  updateMoodDisplay(5);
}

function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('step-' + n);
  if (el) el.classList.add('active');
}

function entryNext(fromStep) {
  if (fromStep === 1) {
    const val = document.getElementById('input-done').value.trim();
    if (!val) {
      tg.HapticFeedback?.notificationOccurred('error');
      document.getElementById('input-done').focus();
      return;
    }
  }
  if (fromStep === 3) {
    // задачи задаются на шаге 4, а не 3 — мудрость уже записана
  }
  showStep(fromStep + 1);
}

function selectMood(score) {
  selectedMood = score;
  document.querySelectorAll('.mood-btn').forEach((b, i) => {
    b.classList.toggle('selected', i + 1 === score);
  });
  updateMoodDisplay(score);
  tg.HapticFeedback?.selectionChanged?.();
}

function updateMoodDisplay(score) {
  document.getElementById('mood-num').textContent = score;
  document.getElementById('mood-emoji').textContent = moodEmoji(score);
}

function renderTaskList() {
  document.getElementById('plans-input-list').innerHTML = taskList.map((t, i) => `
    <div class="task-item">
      <span class="task-item-text">${escHtml(t)}</span>
      <button class="task-remove" onclick="removeTask(${i})">×</button>
    </div>
  `).join('');
}

function addTask() {
  const input = document.getElementById('task-input');
  const val = input.value.trim();
  if (!val) return;
  taskList.push(val);
  input.value = '';
  renderTaskList();
  tg.HapticFeedback?.impactOccurred('light');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'task-input') {
    e.preventDefault();
    addTask();
  }
});

function removeTask(i) {
  taskList.splice(i, 1);
  renderTaskList();
}

async function submitEntry() {
  const done = document.getElementById('input-done').value.trim();
  const notDone = document.getElementById('input-not-done').value.trim() || 'ничего';

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Сохраняю...';

  try {
    await api('POST', '/api/entry', {
      done,
      not_done: notDone,
      mood_score: selectedMood,
      plans: taskList,
    });
    tg.HapticFeedback?.notificationOccurred('success');
    showStep('success');
  } catch (e) {
    console.error('submitEntry:', e);
    tg.HapticFeedback?.notificationOccurred('error');
    btn.disabled = false;
    btn.textContent = 'Сохранить ✓';
    alert('Ошибка при сохранении. Попробуй ещё раз.');
  }
}

// ─── История ─────────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const { entries } = await api('GET', '/api/week');
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');

    if (!entries.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = entries.map(e => `
      <div class="history-item">
        <div class="history-date">${fmtDateLong(e.date)}</div>
        <div class="history-done">${escHtml(e.done)}</div>
        ${e.not_done && e.not_done.toLowerCase() !== 'ничего'
          ? `<div class="history-not-done">❌ ${escHtml(e.not_done)}</div>` : ''}
        ${e.mood_score
          ? `<span class="history-mood">${moodEmoji(e.mood_score)} ${e.mood_score}/10</span>` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error('loadHistory:', e);
  }
}

// ─── Настроение ───────────────────────────────────────────────────────────────
async function loadMood() {
  try {
    const { mood } = await api('GET', '/api/mood');
    const chart = document.getElementById('mood-chart');
    const wrap = document.getElementById('mood-chart-wrap');
    const empty = document.getElementById('mood-empty');

    if (!mood.length) {
      wrap.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    wrap.classList.remove('hidden');
    empty.classList.add('hidden');

    chart.innerHTML = mood.map(({ date, mood_score }) => {
      const pct = (mood_score / 10) * 100;
      return `
        <div class="bar-col">
          <div class="bar-inner">
            <div class="bar" style="height:${pct}%"></div>
          </div>
          <div class="bar-score">${mood_score}</div>
          <div class="bar-date">${fmtDateShort(date)}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('loadMood:', e);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadToday();
