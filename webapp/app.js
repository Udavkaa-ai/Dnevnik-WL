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
  if (name === 'insights') loadInsights();
  if (name === 'entry') initEntry();
  if (name === 'ai') loadAiScreen();
  if (name === 'friends') loadFriends();
}

// ─── Сегодня ─────────────────────────────────────────────────────────────────
async function loadToday() {
  const now = new Date();
  document.getElementById('today-date').textContent =
    `${now.getDate()} ${MONTHS_GEN[now.getMonth()]} ${now.getFullYear()}`;

  try {
    const { entry, plans, entry_count, last_tip } = await api('GET', '/api/today');

    // Тизер AI
    const teaser = document.getElementById('ai-teaser');
    if (entry_count >= 3) teaser.classList.remove('hidden');
    else teaser.classList.add('hidden');

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
let selectedEntryDate = null; // null = сегодня

function initEntry() {
  showStep(0);
  selectedEntryDate = null;
  document.getElementById('input-done').value = '';
  document.getElementById('input-not-done').value = '';
  selectedMood = 5;
  taskList = [];
  renderTaskList();

  // Установить max дату в custom input = сегодня
  document.getElementById('date-custom-input').max = todayStr();
  document.getElementById('date-custom-input').value = '';

  // Снять выделение с кнопок дат
  document.querySelectorAll('.date-opt-btn').forEach(b => b.classList.remove('selected'));

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

async function selectEntryDate(type) {
  if (type === 'today') {
    selectedEntryDate = todayStr();
    document.querySelectorAll('.date-opt-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('date-today-btn').classList.add('selected');
  } else if (type === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    selectedEntryDate = d.toISOString().split('T')[0];
    document.querySelectorAll('.date-opt-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('date-yesterday-btn').classList.add('selected');
  } else if (type === 'custom') {
    const val = document.getElementById('date-custom-input').value;
    if (!val) { tg.HapticFeedback?.notificationOccurred('error'); return; }
    selectedEntryDate = val;
  }
  // Предзаполняем из существующей записи
  await prefillFromExisting(selectedEntryDate);
  showStep(1);
}

async function prefillFromExisting(date) {
  try {
    const { entry, plans } = await api('GET', `/api/entry/${date}`);
    if (entry) {
      document.getElementById('input-done').value = entry.done !== '—' ? (entry.done || '') : '';
      document.getElementById('input-not-done').value = entry.not_done || '';
      if (entry.mood_score) {
        selectedMood = entry.mood_score;
        document.querySelectorAll('.mood-btn').forEach((b, i) => {
          b.classList.toggle('selected', i + 1 === selectedMood);
        });
        updateMoodDisplay(selectedMood);
      }
    }
    if (plans.length) {
      taskList = plans.map(p => p.task_text);
      renderTaskList();
    }
  } catch (_) {}
}

function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('step-' + n);
  if (el) el.classList.add('active');
}

function entryNext(fromStep) {
  showStep(fromStep + 1);
}

// Принудительный переход к шагу (для кнопки «Пропустить»)
function skipToStep(n) {
  tg.HapticFeedback?.selectionChanged?.();
  showStep(n);
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
      date: selectedEntryDate || todayStr(),
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

// ─── Инсайты (История + График настроения) ───────────────────────────────────
async function loadInsights() {
  try {
    const [{ mood }, { entries }] = await Promise.all([
      api('GET', '/api/mood'),
      api('GET', '/api/week'),
    ]);

    // График
    const chart = document.getElementById('mood-chart');
    const wrap = document.getElementById('mood-chart-wrap');
    const moodEmpty = document.getElementById('mood-empty');
    if (mood.length) {
      wrap.classList.remove('hidden');
      moodEmpty.classList.add('hidden');
      chart.innerHTML = mood.map(({ date, mood_score }) => {
        const pct = (mood_score / 10) * 100;
        return `
          <div class="bar-col">
            <div class="bar-inner"><div class="bar" style="height:${pct}%"></div></div>
            <div class="bar-score">${mood_score}</div>
            <div class="bar-date">${fmtDateShort(date)}</div>
          </div>`;
      }).join('');
    } else {
      wrap.classList.add('hidden');
      moodEmpty.classList.remove('hidden');
    }

    // История
    const list = document.getElementById('history-list');
    const histEmpty = document.getElementById('history-empty');
    if (entries.length) {
      histEmpty.classList.add('hidden');
      list.innerHTML = entries.map(e => `
        <div class="history-item">
          <div class="history-date">${fmtDateLong(e.date)}</div>
          <div class="history-done">${escHtml(e.done)}</div>
          ${e.not_done && e.not_done.toLowerCase() !== 'ничего'
            ? `<div class="history-not-done">❌ ${escHtml(e.not_done)}</div>` : ''}
          ${e.mood_score
            ? `<span class="history-mood">${moodEmoji(e.mood_score)} ${e.mood_score}/10</span>` : ''}
        </div>`).join('');
    } else {
      list.innerHTML = '';
      histEmpty.classList.remove('hidden');
    }
  } catch (e) {
    console.error('loadInsights:', e);
  }
}

// ─── AI-анализ ────────────────────────────────────────────────────────────────
const AI_LABELS = {
  general: '📊 Общий анализ',
  psych:   '🧠 Психологический анализ',
  balance: '⚖️ Work-life баланс',
};

async function loadAiScreen() {
  // Показываем совет дня если есть (подгружаем из today)
  try {
    const { last_tip } = await api('GET', '/api/today');
    const tipCard = document.getElementById('ai-tip-card');
    if (last_tip?.ai_tip) {
      document.getElementById('ai-tip-text').textContent = last_tip.ai_tip;
      tipCard.classList.remove('hidden');
    } else {
      tipCard.classList.add('hidden');
    }
  } catch (_) {}
}

let aiLoading = false;

async function requestAnalysis(type) {
  if (aiLoading) return;
  aiLoading = true;

  // Состояние кнопки
  const btn = document.getElementById(`opt-${type}`);
  const arr = document.getElementById(`arr-${type}`);
  btn.classList.add('loading');
  arr.textContent = '…';

  // Скрываем предыдущий результат
  document.getElementById('ai-result').classList.add('hidden');
  document.getElementById('ai-need-more').classList.add('hidden');
  document.getElementById('ai-loading').classList.remove('hidden');

  // Скролл к загрузке
  document.getElementById('ai-loading').scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const { result } = await api('POST', '/api/analyze', { type });

    document.getElementById('ai-result-label').textContent = AI_LABELS[type];
    document.getElementById('ai-result-text').textContent = result;
    document.getElementById('ai-result').classList.remove('hidden');
    document.getElementById('ai-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    tg.HapticFeedback?.notificationOccurred('success');

  } catch (e) {
    let msg = 'Ошибка. Попробуй позже.';
    try { msg = JSON.parse(e.message)?.error || msg; } catch (_) {}

    const needMore = document.getElementById('ai-need-more');
    document.getElementById('ai-need-more-text').textContent = msg;
    needMore.classList.remove('hidden');
    needMore.scrollIntoView({ behavior: 'smooth', block: 'start' });
    tg.HapticFeedback?.notificationOccurred('error');

  } finally {
    document.getElementById('ai-loading').classList.add('hidden');
    btn.classList.remove('loading');
    arr.textContent = '›';
    aiLoading = false;
  }
}

// ─── Друзья ───────────────────────────────────────────────────────────────────
let inviteLink = '';

async function loadFriends() {
  try {
    const { friends } = await api('GET', '/api/friends');
    const list = document.getElementById('friends-list');
    const empty = document.getElementById('friends-empty');

    if (!friends.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    list.innerHTML = friends.map(f => {
      const initial = (f.name || '?')[0].toUpperCase();
      const moodVal = f.avg_mood ? `${f.avg_mood}` : '—';
      const compVal = f.completion_pct !== null ? `${f.completion_pct}%` : '—';

      const miniChart = f.mood_history.length
        ? `<div class="friend-chart">${f.mood_history.map(m => {
            const pct = (m.mood_score / 10) * 100;
            return `<div class="friend-bar-col">
              <div class="friend-bar-inner"><div class="friend-bar" style="height:${pct}%"></div></div>
              <div class="friend-bar-date">${fmtDateShort(m.date)}</div>
            </div>`;
          }).join('')}</div>` : '';

      return `
        <div class="friend-card">
          <div class="friend-header">
            <div class="friend-avatar">${initial}</div>
            <div class="friend-name">${escHtml(f.name)}</div>
          </div>
          <div class="friend-stats">
            <div class="friend-stat">
              <div class="friend-stat-val">${moodVal}</div>
              <div class="friend-stat-lbl">настроение / 10</div>
            </div>
            <div class="friend-stat">
              <div class="friend-stat-val">${compVal}</div>
              <div class="friend-stat-lbl">задач выполнено</div>
            </div>
          </div>
          ${miniChart}
        </div>`;
    }).join('');
  } catch (e) {
    console.error('loadFriends:', e);
  }
}

async function createInvite() {
  try {
    const { link } = await api('POST', '/api/invite/create', {});
    inviteLink = link;
    document.getElementById('invite-link-text').textContent = link;
    document.getElementById('invite-result').classList.remove('hidden');
    tg.HapticFeedback?.notificationOccurred('success');
  } catch (e) {
    alert('Не удалось создать приглашение. Попробуй позже.');
  }
}

function copyInvite() {
  if (!inviteLink) return;
  navigator.clipboard?.writeText(inviteLink).then(() => {
    tg.HapticFeedback?.notificationOccurred('success');
    const btn = document.querySelector('#invite-result .btn-primary');
    if (btn) { btn.textContent = '✓ Скопировано!'; setTimeout(() => btn.textContent = '📋 Скопировать ссылку', 2000); }
  }).catch(() => {
    // Фолбэк для старых браузеров
    const el = document.getElementById('invite-link-text');
    el.click();
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Открываем Дневник по умолчанию
showScreen('entry');
