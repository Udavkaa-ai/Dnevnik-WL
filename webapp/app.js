const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ─── API ─────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000); // 20с таймаут
  try {
    const res = await fetch(path, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-init-data': tg.initData || '',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch (_) { try { msg = await res.text() || msg; } catch (_) {} }
      throw new Error(msg);
    }
    return res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Сервер не ответил за 20 секунд. Проверь соединение.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayStr() { return localDateStr(new Date()); }

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

    // Чеклист
    const wrap = document.getElementById('today-checklist');
    const empty = document.getElementById('today-empty');
    const title = document.getElementById('plans-section-title');
    renderChecklist(plans, wrap, empty, title);
  } catch (e) {
    console.error('loadToday:', e);
  }
}

function renderChecklist(plans, wrap, empty, title) {
  const pending = plans.filter(p => p.status !== 'moved' && p.status !== 'cancelled');
  if (!pending.length) {
    wrap.innerHTML = '';
    if (title) title.textContent = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    if (title) title.textContent = 'Планы на сегодня';
    wrap.innerHTML = pending.map(p => `
      <div class="checklist-item" data-status="${p.status}" data-id="${p.id}">
        <span class="check-icon" onclick="togglePlan(${p.id}, this.closest('.checklist-item'))">
          ${p.status === 'done' ? '✅' : '☐'}
        </span>
        <span class="check-text${p.status === 'done' ? ' done' : ''}"
              onclick="togglePlan(${p.id}, this.closest('.checklist-item'))">
          ${escHtml(p.task_text)}
        </span>
        ${p.status !== 'done'
          ? `<button class="task-move-btn" data-id="${p.id}" data-name="${escHtml(p.task_text)}" onclick="showMoveTask(+this.dataset.id, this.dataset.name)">→</button>`
          : ''}
      </div>
    `).join('');
  }
}

async function togglePlan(id, el) {
  try {
    const { status } = await api('PATCH', `/api/plans/${id}/toggle`);
    el.dataset.status = status;
    el.querySelector('.check-icon').textContent = status === 'done' ? '✅' : '☐';
    el.querySelector('.check-text').classList.toggle('done', status === 'done');
    // Скрываем кнопку переноса если задача выполнена
    const moveBtn = el.querySelector('.task-move-btn');
    if (moveBtn) moveBtn.style.display = status === 'done' ? 'none' : '';
    tg.HapticFeedback?.impactOccurred('light');
  } catch (e) {
    console.error('togglePlan:', e);
  }
}

// ─── Добавить задачу на сегодня ───────────────────────────────────────────────
async function addTodayTask() {
  const input = document.getElementById('today-task-input');
  const text = input.value.trim();
  if (!text) return;
  input.disabled = true;
  try {
    await api('POST', '/api/plans', { task_text: text, plan_date: todayStr() });
    input.value = '';
    tg.HapticFeedback?.impactOccurred('light');
    await loadToday();
  } catch (e) {
    alert('Ошибка: ' + e.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'today-task-input') {
    e.preventDefault();
    addTodayTask();
  }
});

// ─── Перенос задачи с причиной ────────────────────────────────────────────────
let _movingPlanId = null;

function showMoveTask(id, taskName) {
  _movingPlanId = id;
  document.getElementById('move-task-name').textContent = taskName;
  document.getElementById('move-reason').value = '';
  document.getElementById('move-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('move-reason').focus(), 150);
}

function closeMoveModal() {
  document.getElementById('move-modal').classList.add('hidden');
  _movingPlanId = null;
}

async function confirmMove(daysOffset) {
  const reason = document.getElementById('move-reason').value.trim();
  if (!reason) {
    tg.HapticFeedback?.notificationOccurred('error');
    document.getElementById('move-reason').focus();
    return;
  }
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const moveTo = localDateStr(d);
  try {
    await api('PATCH', `/api/plans/${_movingPlanId}/move`, { move_to: moveTo, reason });
    closeMoveModal();
    tg.HapticFeedback?.notificationOccurred('success');
    await loadToday();
  } catch (e) {
    alert('Ошибка: ' + e.message);
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
    selectedEntryDate = localDateStr(d);
    document.querySelectorAll('.date-opt-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('date-yesterday-btn').classList.add('selected');
  } else if (type === 'custom') {
    const val = document.getElementById('date-custom-input').value;
    if (!val) { tg.HapticFeedback?.notificationOccurred('error'); return; }
    selectedEntryDate = val;
  }
  // Предзаполняем из существующей записи
  await prefillFromExisting(selectedEntryDate);
  updateStep4Title(selectedEntryDate);
  showStep(1);
}

function updateStep4Title(entryDate) {
  const d = new Date(entryDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const nextDay = localDateStr(d);
  const isToday = nextDay === todayStr();
  const label = isToday ? 'Планы на сегодня' : `Планы на ${fmtDateLong(nextDay)}`;
  const hint = isToday
    ? 'Эти задачи появятся в "Сделано" прямо сейчас'
    : `Появятся в "Сделано" ${fmtDateLong(nextDay)}`;
  const title = document.getElementById('step4-title');
  const hintEl = document.getElementById('step4-hint');
  if (title) title.textContent = label;
  if (hintEl) hintEl.textContent = hint;
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
    const { nextDay } = await api('POST', '/api/entry', {
      done,
      not_done: notDone,
      mood_score: selectedMood,
      plans: taskList,
      date: selectedEntryDate || todayStr(),
    });
    tg.HapticFeedback?.notificationOccurred('success');

    // Показываем экран успеха и СБРАСЫВАЕМ кнопку
    showStep('success');
    btn.disabled = false;
    btn.textContent = 'Сохранить ✓';

    // Обновляем заголовок успеха чтобы показать куда ушли планы
    const successTitle = document.querySelector('#step-success .step-hint');
    if (successTitle && taskList.length && nextDay) {
      successTitle.textContent = `Планы на ${fmtDateLong(nextDay)} сохранены`;
    }

    // Сбрасываем форму
    selectedEntryDate = null;
    taskList = [];

  } catch (e) {
    console.error('submitEntry:', e);
    tg.HapticFeedback?.notificationOccurred('error');
    btn.disabled = false;
    btn.textContent = 'Сохранить ✓';
    alert(`Ошибка: ${e.message}`);
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

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // Проверяем профиль — если не заполнен, показываем модал
  try {
    const profile = await api('GET', '/api/profile');
    if (!profile.gender) showProfileSetupBanner();
  } catch (_) {}
  showScreen('entry');
}

function showProfileSetupBanner() {
  const banner = document.getElementById('profile-banner');
  if (banner) banner.classList.remove('hidden');
}

function hideProfileBanner() {
  const banner = document.getElementById('profile-banner');
  if (banner) banner.classList.add('hidden');
}

async function setProfileField(field, value) {
  try {
    await api('PATCH', '/api/profile', { [field]: value });
    // Обновляем кнопку
    document.querySelectorAll(`.profile-btn[data-field="${field}"]`).forEach(b => {
      b.classList.toggle('selected', b.dataset.value === value);
    });
    // Если оба поля заполнены — скрываем баннер
    const gender = document.querySelector('.profile-btn[data-field="gender"].selected');
    const family = document.querySelector('.profile-btn[data-field="family_status"].selected');
    if (gender && family) {
      setTimeout(hideProfileBanner, 500);
      tg.HapticFeedback?.notificationOccurred('success');
    }
  } catch (e) {
    console.error('setProfileField:', e);
  }
}

init();
