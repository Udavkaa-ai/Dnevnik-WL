const MODEL_HEAVY = 'google/gemini-2.5-flash';
const MODEL_LIGHT = 'google/gemini-2.0-flash-lite';

const ACTIVITY_LIBRARY = `
БИБЛИОТЕКА АКТИВНОСТЕЙ ДЛЯ РЕКОМЕНДАЦИЙ:

🧠 СНЯТИЕ КОГНИТИВНОЙ УСТАЛОСТИ:
- Прогулка без телефона 20-30 минут
- Порисовать
- Собрать пазл, порешать судоку
- Приготовить новое блюдо
- Полить растения, повозиться с чем-то руками

📚 ВОССТАНОВЛЕНИЕ ЧЕРЕЗ ПОГРУЖЕНИЕ:
- Почитать художественную книгу 30 минут без телефона
- Посмотреть хороший фильм осознанно
- Послушать подкаст на прогулке

🏃 ФИЗИЧЕСКАЯ РАЗРЯДКА:
- Любой спорт 30+ минут: зал, бег, плавание
- Зарядка или растяжка 10 минут
- Активные игры с детьми

🤝 СОЦИАЛЬНОЕ ВОССТАНОВЛЕНИЕ:
- Живая встреча с другом
- Настольная игра с семьёй
- Выйти куда-то вдвоём

🎨 ТВОРЧЕСТВО:
- Новый ресторан или кухня
- Выставка или музей
- Купить настолку и сыграть

🌿 ПСИХОЛОГИЧЕСКОЕ ВОССТАНОВЛЕНИЕ:
- Утренние страницы: 10 минут писать всё подряд
- Медитация 10 минут
- Лечь спать на час раньше
`;

function formatEntries(entries) {
  return entries.map(e =>
    `[${e.date}] Сделал: ${e.done || '—'} | Не сделал: ${e.not_done || 'ничего'} | Оценка: ${e.mood_score || '?'}/10`
  ).join('\n');
}

function formatEntriesRich(entries) {
  return entries.map(e => {
    const done = (e.plans || []).filter(p => p.status === 'done').map(p => `  + ${p.task_text}`);
    const moved = (e.plans || []).filter(p => p.status === 'moved').map(p => `  → ${p.task_text}${p.reason ? ` (причина: ${p.reason})` : ''}${p.moved_to ? ` [перенесено на ${p.moved_to}]` : ''}`);
    const cancelled = (e.plans || []).filter(p => p.status === 'cancelled').map(p => `  ✗ ${p.task_text}${p.reason ? ` (причина: ${p.reason})` : ''}`);
    const pending = (e.plans || []).filter(p => p.status === 'pending').map(p => `  ? ${p.task_text}`);

    const detail = (e.done || '').length + (e.not_done || '').length;
    const detailLevel = detail > 300 ? 'подробная' : detail > 100 ? 'средняя' : detail > 0 ? 'краткая' : 'нет';

    const lines = [
      `[${e.date}] Оценка: ${e.mood_score || '?'}/10 | Детальность записи: ${detailLevel}`,
      e.done ? `  Запись "Сделал": ${e.done}` : null,
      e.not_done ? `  Запись "Не сделал": ${e.not_done}` : null,
      done.length ? `  Выполненные задачи:\n${done.join('\n')}` : null,
      moved.length ? `  Перенесённые задачи:\n${moved.join('\n')}` : null,
      cancelled.length ? `  Отменённые задачи:\n${cancelled.join('\n')}` : null,
      pending.length ? `  Незакрытые задачи:\n${pending.join('\n')}` : null,
    ].filter(Boolean);

    return lines.join('\n');
  }).join('\n\n');
}

function formatUserProfile(user) {
  if (!user) return '';
  const gender = user.gender === 'male' ? 'Мужчина' : user.gender === 'female' ? 'Женщина' : null;
  const family = {
    single: 'Один/Одна',
    partner: 'В отношениях',
    married: 'В браке, детей нет',
    children: 'Семья с детьми',
  }[user.family_status] || null;
  const parts = [gender, family].filter(Boolean);
  let profile = parts.length ? `\nПрофиль: ${parts.join(', ')}.` : '';
  if (user.bio && user.bio.trim()) {
    profile += `\nО себе: ${user.bio.trim()}`;
  }
  return profile;
}

async function callAI(apiKey, model, systemMsg, userMsg, maxTokens = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'com.dnevnik.app',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg },
        ],
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Пустой ответ от AI');
  return content;
}

export async function analyzeGeneral(entries, days, user, apiKey) {
  const entriesText = formatEntries(entries);
  const profile = formatUserProfile(user);

  return callAI(
    apiKey,
    MODEL_HEAVY,
    `Ты аналитик личного дневника. Анализируй конкретно, только по данным. Пиши по-русски, кратко, без воды.${profile}`,
    `Записи дневника за ${days} дней:\n${entriesText}\n\n` +
    `Анализ по пунктам:\n\n` +
    `1. ГЛАВНЫЕ ТЕМЫ — что повторялось в записях\n` +
    `2. СООТНОШЕНИЕ СФЕР — работа / семья / личное / отдых\n` +
    `3. ДИНАМИКА НАСТРОЕНИЯ — как менялись оценки\n` +
    `4. СТАБИЛЬНЫЕ ПАТТЕРНЫ — что стабильно делается, что не делается\n` +
    `5. ГЛАВНЫЙ ВЫВОД — что бросается в глаза больше всего`
  );
}

export async function analyzePsych(entries, days, user, apiKey) {
  const entriesText = formatEntriesRich(entries);
  const profile = formatUserProfile(user);

  return callAI(
    apiKey,
    MODEL_HEAVY,
    `Ты психолог-аналитик. Пиши по-русски, конкретно. Не давай общих советов — только то что видно в данных.${profile}`,
    `Дневниковые записи за ${days} дней:\n${entriesText}\n\n` +
    `${ACTIVITY_LIBRARY}\n\n` +
    `Психологический анализ:\n\n` +
    `1. ПАТТЕРНЫ НЕЗАКРЫТОГО — что систематически не делается и почему\n` +
    `2. РАЗРЫВ ПЛАН/РЕАЛЬНОСТЬ — реалистично ли планирование\n` +
    `3. ЧТО ЗАРЯЖАЕТ, ЧТО СЛИВАЕТ — корреляция оценок с содержанием\n` +
    `4. ПСИХОЛОГИЧЕСКОЕ СОСТОЯНИЕ — общий фон за период\n` +
    `5. 3 КОНКРЕТНЫЕ РЕКОМЕНДАЦИИ — из библиотеки активностей выше`,
    3000
  );
}

export async function analyzeBalance(entries, user, apiKey) {
  const entriesText = formatEntriesRich(entries);
  const profile = formatUserProfile(user);

  return callAI(
    apiKey,
    MODEL_HEAVY,
    `Ты коуч по work-life балансу. Пиши по-русски. Советы — конкретные, применимые сразу.${profile}`,
    `Дневниковые записи за 30 дней:\n${entriesText}\n\n` +
    `${ACTIVITY_LIBRARY}\n\n` +
    `Анализ work-life баланса:\n\n` +
    `1. КАРТИНА БАЛАНСА — где перекос, конкретно\n` +
    `2. ЧТО ВЫТЕСНЯЕТСЯ — семья, здоровье, хобби, отдых\n` +
    `3. ЧТО РАБОТАЕТ — когда оценки выше 7\n` +
    `4. ПРОАКТИВНЫЙ ПЛАН НА НЕДЕЛЮ — 5 конкретных действий.\n` +
    `Каждое действие — отдельной строкой строго в формате:\n` +
    `ЗАДАЧА: [конкретное действие, 5-10 слов, без скобок]`
  );
}

export async function analyzeTransactional(entries, user, apiKey) {
  const entriesText = formatEntriesRich(entries);
  const profile = formatUserProfile(user);

  return callAI(
    apiKey,
    MODEL_HEAVY,
    `Ты психоаналитик, специалист по транзактному анализу Эрика Берна. Пиши по-русски, глубоко и конкретно — только то, что реально прослеживается в записях. Без общих фраз.${profile}`,
    `Дневниковые записи за 30 дней (с задачами по статусам и полным текстом):\n${entriesText}\n\n` +
    `Проведи глубокий транзактный анализ по следующим разделам:\n\n` +
    `1. ЭГО-СОСТОЯНИЯ — какие состояния (Родитель, Взрослый, Дитя) доминируют в записях, в каких ситуациях и как проявляются. Конкретные цитаты и примеры.\n\n` +
    `2. ПОЗИЦИЯ ОПИСАНИЯ — с какой позиции человек описывает события: наблюдатель, участник, жертва, автор. Как меняется в зависимости от темы. Примеры формулировок из записей.\n\n` +
    `3. ПАТТЕРН ЗАДАЧ — соотношение выполненных / перенесённых / отменённых задач. Что чаще переносится и отменяется — и что это говорит о внутренних конфликтах и запретах. Детальность записей: когда пишет подробно, когда кратко — и почему.\n\n` +
    `4. ЖИЗНЕННЫЙ СЦЕНАРИЙ — какой сценарий прослеживается: победитель, непобедитель, неудачник. Какие повторяющиеся паттерны подтверждают этот сценарий.\n\n` +
    `5. ПСИХОЛОГИЧЕСКИЕ ИГРЫ — какие игры по Берну разыгрываются (например: «Да, но...», «Видишь, как я стараюсь», «Если бы не ты»). Конкретные признаки из записей.\n\n` +
    `6. ДРАЙВЕРЫ И ЗАПРЕТЫ — какие драйверы поведения активны («Будь лучшим», «Торопись», «Старайся», «Радуй других», «Будь сильным»). Как они влияют на ежедневные решения и выбор задач.\n\n` +
    `7. ПСИХОЛОГИЧЕСКИЕ ПОГЛАЖИВАНИЯ — как человек получает и даёт поглаживания. Соотношение позитивных и негативных. Чего не хватает.\n\n` +
    `8. ЖИЗНЕННАЯ ПОЗИЦИЯ — какая из четырёх позиций доминирует («Я ОК — Ты ОК», «Я не ОК — Ты ОК», «Я ОК — Ты не ОК», «Я не ОК — Ты не ОК»). Обоснование.\n\n` +
    `9. РЕКОМЕНДАЦИИ — 4–5 конкретных шагов для работы с выявленными паттернами, основанных строго на данных выше.`,
    5000
  );
}

export async function dailyTip(entry, user, apiKey) {
  const profile = formatUserProfile(user);

  return callAI(
    apiKey,
    MODEL_LIGHT,
    `Ты дружелюбный коуч. По записи дня даёшь один короткий проактивный совет на завтра. Пиши по-русски, тепло, 2-3 предложения.${profile}`,
    `Запись за сегодня:\n` +
    `Сделал: ${entry.done}\n` +
    `Не получилось: ${entry.not_done || 'ничего'}\n` +
    `Оценка дня: ${entry.mood_score}/10\n\n` +
    `${ACTIVITY_LIBRARY}\n\n` +
    `Дай один конкретный совет — что сделать завтра для восстановления.`
  );
}
