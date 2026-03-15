require('dotenv').config();
const { setBotUsername } = require('./api'); // Express API + static webapp
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const db = require('./db');
const { analyzeGeneral, analyzePsych, analyzeBalance, dailyTip, parseMorningCheckin } = require('./ai');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ─── Состояние диалога ────────────────────────────────────────────────────────
const userStates = new Map();
function getState(uid) { return userStates.get(uid) || { step: 'idle', data: {} }; }
function setState(uid, step, data = {}) { userStates.set(uid, { step, data }); }

// ─── Подсказки ───────────────────────────────────────────────────────────────
const HINT = {
  done:
    '_Например:_\n' +
    '• Закрыл квартальный отчёт, провёл планёрку\n' +
    '• Забрал дочку из школы, вместе сделали уроки\n' +
    '• Вечером читал, лёг раньше обычного\n\n' +
    '_Пиши как есть — одним сообщением или списком_',

  not_done:
    '_Например:_\n' +
    '• Не позвонил в банк — не было времени\n' +
    '• Хотел погулять, но пошёл дождь\n\n' +
    '_Или напиши_ `ничего` _если всё по плану_',

  plans:
    '_Например:_\n' +
    '• Закрыть акт с подрядчиком\n' +
    '• Позвонить в банк до 12:00\n' +
    '• Вечером прогулка с семьёй\n\n' +
    '_Пиши каждую задачу с новой строки или через запятую_',
};

// ─── Утилиты ─────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0];
}
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
}
function dayAfterStr() {
  const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0];
}
// Следующий день после произвольной даты
function nextDayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
function fmtDate(s) {
  if (!s) return '?';
  const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`;
}
function moodEmoji(score) {
  if (score >= 8) return '🔥'; if (score >= 6) return '👍'; if (score >= 4) return '😐'; return '😔';
}
function moodBar(score) {
  return ['▁','▂','▃','▄','▅','▆','▇','█','█','█'][Math.min(score - 1, 9)];
}
function fmtEntry(e) {
  let t = `📅 *${fmtDate(e.date)}*\n✅ ${e.done}\n`;
  if (e.not_done && e.not_done.toLowerCase() !== 'ничего') t += `❌ Не получилось: ${e.not_done}\n`;
  if (e.mood_score) t += `${moodEmoji(e.mood_score)} Оценка: ${e.mood_score}/10`;
  return t;
}
function parseTasks(text) {
  return text.split(/\n|,/).map(s => s.replace(/^[-•*\d.]+\s*/, '').trim()).filter(Boolean);
}
function send(chatId, text, extra = {}) {
  return bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', ...extra });
}

// ─── Чеклист: построить текст и клавиатуру ───────────────────────────────────
function buildChecklist(plans, title = 'Планы на завтра') {
  const lines = plans.map(p => {
    const icon = p.status === 'done' ? '✅' : '☐';
    return `${icon} ${p.task_text}`;
  });
  const text = `📋 *${title}:*\n\n${lines.join('\n')}\n\n_Тапай чтобы отметить выполненное_`;

  const keyboard = plans.map(p => {
    const icon = p.status === 'done' ? '✅' : '☐';
    return [Markup.button.callback(`${icon} ${p.task_text}`, `check:${p.id}`)];
  });

  return { text, keyboard: Markup.inlineKeyboard(keyboard) };
}

// ─── Обновить чеклист в сообщении ────────────────────────────────────────────
async function refreshChecklist(uid, planDate) {
  const cl = db.prepare('SELECT * FROM checklists WHERE user_id = ? AND plan_date = ?')
    .get(uid, planDate);
  if (!cl) return;

  const plans = db.prepare(
    `SELECT * FROM plans WHERE user_id = ? AND plan_date = ? ORDER BY id`
  ).all(uid, planDate);
  if (!plans.length) return;

  const title = planDate === todayStr() ? 'Планы на сегодня' : `Планы на ${fmtDate(planDate)}`;
  const { text, keyboard } = buildChecklist(plans, title);
  try {
    await bot.telegram.editMessageText(cl.chat_id, cl.msg_id, null, text, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (e) {
    if (!e.message.includes('not modified')) console.error('refreshChecklist:', e.message);
  }
}

// ─── Утренний чекин ───────────────────────────────────────────────────────────
async function startMorningFlow(uid) {
  const plans = db.prepare(
    `SELECT * FROM plans WHERE user_id = ? AND plan_date = ? AND status = 'pending' ORDER BY id`
  ).all(uid, todayStr());

  if (!plans.length) {
    await send(uid, `☀️ Доброе утро! Планов на сегодня нет.\n\nДобавь задачи вечером через /итог.`);
    return;
  }

  await send(uid, `☀️ *Доброе утро!* Вот что запланировано на сегодня:`);

  const { text, keyboard } = buildChecklist(plans, 'Планы на сегодня');
  const msg = await bot.telegram.sendMessage(uid, text, {
    parse_mode: 'Markdown',
    ...keyboard
  });

  db.prepare(`
    INSERT INTO checklists (user_id, plan_date, msg_id, chat_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, plan_date) DO UPDATE SET msg_id = excluded.msg_id, chat_id = excluded.chat_id
  `).run(uid, todayStr(), msg.message_id, msg.chat.id);
}

// ─── Вечерний поток (итог дня) ───────────────────────────────────────────────
async function startEveningFlow(uid, targetDate) {
  const date = targetDate || todayStr();
  const label = date === todayStr() ? 'сегодня' : `за ${fmtDate(date)}`;
  setState(uid, 'evening_done', { targetDate: date });
  await send(uid, `🌙 Подводим итог — *${label}*!\n\n*Что сделал?*\n\n${HINT.done}`);
}

// ─── Вечерний разбор незакрытых задач ────────────────────────────────────────
async function startEveningTaskReview(uid) {
  const pending = db.prepare(
    `SELECT * FROM plans WHERE user_id = ? AND plan_date = ? AND status = 'pending' ORDER BY id`
  ).all(uid, todayStr());

  if (!pending.length) return;

  await send(uid, `⏰ *Незакрытые задачи за сегодня:*\n\nПо каждой — что с ней делаем?`);

  for (const plan of pending) {
    await send(uid,
      `📌 *${plan.task_text}*`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Сделал', `ev_done:${plan.id}`),
          Markup.button.callback('📅 Перенести', `ev_move:${plan.id}`),
          Markup.button.callback('🗑 Отменить', `ev_cancel:${plan.id}`),
        ]
      ])
    );
  }
}

// ─── Callback: тап на чеклист (переключение галочки) ─────────────────────────
bot.action(/^check:(\d+)$/, async (ctx) => {
  const planId = parseInt(ctx.match[1]);
  const uid = ctx.from.id;

  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(planId, uid);
  if (!plan) return ctx.answerCbQuery('Задача не найдена');

  const newStatus = plan.status === 'done' ? 'pending' : 'done';
  db.prepare(
    `UPDATE plans SET status = ?, checked_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?`
  ).run(newStatus, newStatus, planId);

  await refreshChecklist(uid, plan.plan_date);
  await ctx.answerCbQuery(newStatus === 'done' ? '✅ Отмечено!' : 'Снято');
});

// ─── Callback: вечерний разбор — Сделал ──────────────────────────────────────
bot.action(/^ev_done:(\d+)$/, async (ctx) => {
  const planId = parseInt(ctx.match[1]);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return ctx.answerCbQuery();

  db.prepare(`UPDATE plans SET status = 'done', checked_at = CURRENT_TIMESTAMP WHERE id = ?`).run(planId);
  await ctx.editMessageText(`✅ ${plan.task_text} — выполнено`, { parse_mode: 'Markdown' });
  await ctx.answerCbQuery('Отлично! 👍');
});

// ─── Callback: вечерний разбор — Перенести (показать даты) ───────────────────
bot.action(/^ev_move:(\d+)$/, async (ctx) => {
  const planId = parseInt(ctx.match[1]);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return ctx.answerCbQuery();

  await ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      [
        Markup.button.callback(`Сегодня (${fmtDate(todayStr())})`, `mv_date:${planId}:${todayStr()}`),
        Markup.button.callback(`Завтра (${fmtDate(tomorrowStr())})`, `mv_date:${planId}:${tomorrowStr()}`),
      ],
      [
        Markup.button.callback(`Послезавтра (${fmtDate(dayAfterStr())})`, `mv_date:${planId}:${dayAfterStr()}`),
        Markup.button.callback('📝 Другая дата', `mv_custom:${planId}`),
      ]
    ]).reply_markup
  );
  await ctx.answerCbQuery('Выбери дату');
});

// ─── Callback: выбрана конкретная дата переноса ───────────────────────────────
bot.action(/^mv_date:(\d+):(.+)$/, async (ctx) => {
  const planId = parseInt(ctx.match[1]);
  const newDate = ctx.match[2];
  const uid = ctx.from.id;

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return ctx.answerCbQuery();

  db.prepare(`UPDATE plans SET status = 'moved', moved_to = ? WHERE id = ?`).run(newDate, planId);
  db.prepare(`INSERT INTO plans (user_id, plan_date, task_text) VALUES (?, ?, ?)`)
    .run(uid, newDate, plan.task_text);

  await ctx.editMessageText(
    `📅 *${plan.task_text}*\n↳ Перенесено на ${fmtDate(newDate)}`, { parse_mode: 'Markdown' }
  );
  await ctx.answerCbQuery(`Перенесено на ${fmtDate(newDate)}`);
  await refreshChecklist(uid, newDate);
});

// ─── Callback: произвольная дата переноса ────────────────────────────────────
bot.action(/^mv_custom:(\d+)$/, async (ctx) => {
  const planId = parseInt(ctx.match[1]);
  setState(ctx.from.id, `awaiting_move_date`, { planId });
  await ctx.answerCbQuery();
  await send(ctx.from.id, `Напиши дату в формате ДД.ММ (например: 25.03)`);
});

// ─── Callback: вечерний разбор — Отменить ────────────────────────────────────
bot.action(/^ev_cancel:(\d+)$/, async (ctx) => {
  const planId = parseInt(ctx.match[1]);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return ctx.answerCbQuery();

  await ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Да, убрать', `confirm_cancel:${planId}`),
        Markup.button.callback('Нет, оставить', `ev_move:${planId}`),
      ]
    ]).reply_markup
  );
  await ctx.answerCbQuery();
});

bot.action(/^confirm_cancel:(\d+)$/, async (ctx) => {
  const planId = parseInt(ctx.match[1]);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return ctx.answerCbQuery();

  db.prepare(`UPDATE plans SET status = 'cancelled' WHERE id = ?`).run(planId);
  await ctx.editMessageText(`🗑 ${plan.task_text} — отменено`, { parse_mode: 'Markdown' });
  await ctx.answerCbQuery('Убрано');
});

// ─── Настройка времени: меню и пикер ─────────────────────────────────────────
function buildTimeMenu(user) {
  return {
    text:
      `⏰ *Настройка времени напоминаний*\n\n` +
      `☀️ Утро: *${user.morning_time}*\n` +
      `🌙 Вечер: *${user.evening_time}*`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback('☀️ Изменить утреннее', 'time_pick:morning')],
      [Markup.button.callback('🌙 Изменить вечернее', 'time_pick:evening')],
    ])
  };
}

function buildTimePicker(type) {
  const isMorning = type === 'morning';
  const hours = isMorning
    ? [6, 7, 8, 9, 10, 11, 12]
    : [17, 18, 19, 20, 21, 22, 23];

  const buttons = [];
  for (let i = 0; i < hours.length; i += 3) {
    const row = hours.slice(i, i + 3).map(h => {
      const hhmm = `${String(h).padStart(2, '0')}:00`;
      return Markup.button.callback(hhmm, `time_set:${type}:${hhmm}`);
    });
    buttons.push(row);
  }
  buttons.push([Markup.button.callback('← Назад', 'time_menu')]);

  return {
    text: isMorning
      ? '☀️ Выбери время *утреннего* напоминания:'
      : '🌙 Выбери время *вечернего* напоминания:',
    keyboard: Markup.inlineKeyboard(buttons)
  };
}

bot.action('time_menu', async (ctx) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(ctx.from.id);
  if (!user) return ctx.answerCbQuery();
  const { text, keyboard } = buildTimeMenu(user);
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  await ctx.answerCbQuery();
});

bot.action(/^time_pick:(morning|evening)$/, async (ctx) => {
  const type = ctx.match[1];
  const { text, keyboard } = buildTimePicker(type);
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  await ctx.answerCbQuery();
});

bot.action(/^time_set:(morning|evening):(\d{2}:\d{2})$/, async (ctx) => {
  const type = ctx.match[1];
  const time = ctx.match[2];
  const uid = ctx.from.id;

  if (type === 'morning') {
    db.prepare('UPDATE users SET morning_time = ? WHERE user_id = ?').run(time, uid);
  } else {
    db.prepare('UPDATE users SET evening_time = ? WHERE user_id = ?').run(time, uid);
  }

  const label = type === 'morning' ? '☀️ Утреннее' : '🌙 Вечернее';
  await ctx.answerCbQuery(`${label} напоминание: ${time} ✅`);

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(uid);
  const { text, keyboard } = buildTimeMenu(user);
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
});

// ─── Обработка текстовых сообщений ───────────────────────────────────────────
bot.on('text', async (ctx) => {
  const uid = ctx.from.id;
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;

  const { step, data } = getState(uid);

  // ── Ожидание даты для /итог ────────────────────────────────────────────────
  if (step === 'awaiting_itog_date') {
    const match = text.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!match) {
      await ctx.reply('Не понял формат. Напиши дату как ДД.ММ, например 14.03');
      return;
    }
    const year = new Date().getFullYear();
    const date = `${year}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    setState(uid, 'idle');
    return startEveningFlow(uid, date);
  }

  // ── Ожидание произвольной даты переноса ────────────────────────────────────
  if (step === 'awaiting_move_date') {
    const match = text.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!match) {
      await ctx.reply('Не понял формат. Напиши дату как ДД.ММ, например 25.03');
      return;
    }
    const year = new Date().getFullYear();
    const newDate = `${year}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    const { planId } = data;
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) { setState(uid, 'idle'); return; }

    db.prepare(`UPDATE plans SET status = 'moved', moved_to = ? WHERE id = ?`).run(newDate, planId);
    db.prepare(`INSERT INTO plans (user_id, plan_date, task_text) VALUES (?, ?, ?)`)
      .run(uid, newDate, plan.task_text);

    setState(uid, 'idle');
    await send(uid, `📅 *${plan.task_text}*\n↳ Перенесено на ${fmtDate(newDate)}`);
    await refreshChecklist(uid, newDate);
    return;
  }

  // ── Вечерний поток ──────────────────────────────────────────────────────────
  if (step === 'evening_done') {
    setState(uid, 'evening_not_done', { done: text });
    await send(uid, `Записал ✓\n\n*Что планировал, но не получилось?*\n\n${HINT.not_done}`);
    return;
  }

  if (step === 'evening_not_done') {
    setState(uid, 'evening_mood', { ...data, not_done: text });
    await send(uid,
      `Записал ✓\n\n*Оцени день от 1 до 10*\n\n` +
      `1-3 — тяжело 😔  |  4-6 — нормально 😐  |  7-9 — хорошо 👍  |  10 — отлично 🔥`
    );
    return;
  }

  if (step === 'evening_mood') {
    const score = parseInt(text);
    if (isNaN(score) || score < 1 || score > 10) {
      await ctx.reply('Пожалуйста, напиши цифру от 1 до 10');
      return;
    }
    setState(uid, 'evening_plans', { ...data, mood_score: score });
    await send(uid, `${moodEmoji(score)} Принял!\n\n*Что планируешь сделать завтра?*\n\n${HINT.plans}`);
    return;
  }

  if (step === 'evening_plans') {
    const { done, not_done, mood_score, targetDate } = data;
    const entryDate = targetDate || todayStr();
    const nextDay = nextDayOf(entryDate);

    // Сохраняем запись дня
    db.prepare(`
      INSERT INTO entries (user_id, date, done, not_done, mood_score)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        done = excluded.done, not_done = excluded.not_done, mood_score = excluded.mood_score
    `).run(uid, entryDate, done, not_done, mood_score);

    // Парсим задачи
    const tasks = parseTasks(text);

    // Удаляем старые pending на следующий день
    db.prepare(`DELETE FROM plans WHERE user_id = ? AND plan_date = ? AND status = 'pending'`)
      .run(uid, nextDay);

    // Вставляем новые
    const insertPlan = db.prepare(`INSERT INTO plans (user_id, plan_date, task_text) VALUES (?, ?, ?)`);
    tasks.forEach(t => insertPlan.run(uid, nextDay, t));

    setState(uid, 'idle');

    // Строим чеклист
    const plans = db.prepare(
      `SELECT * FROM plans WHERE user_id = ? AND plan_date = ? ORDER BY id`
    ).all(uid, nextDay);

    const { text: clText, keyboard } = buildChecklist(plans, `Планы на ${fmtDate(nextDay)}`);
    const msg = await bot.telegram.sendMessage(uid, clText, {
      parse_mode: 'Markdown',
      ...keyboard
    });

    // Сохраняем message_id чеклиста
    db.prepare(`
      INSERT INTO checklists (user_id, plan_date, msg_id, chat_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, plan_date) DO UPDATE SET msg_id = excluded.msg_id, chat_id = excluded.chat_id
    `).run(uid, nextDay, msg.message_id, msg.chat.id);

    // Проактивный AI-совет
    setTimeout(async () => {
      try {
        const entry = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date = ?').get(uid, entryDate);
        const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(uid);
        if (entry) {
          const tip = await dailyTip(entry, user);
          db.prepare('UPDATE entries SET ai_tip = ? WHERE user_id = ? AND date = ?').run(tip, uid, entryDate);
          await send(uid, `💡 *Совет на завтра:*\n\n${tip}`);
        }
      } catch (e) { console.error('dailyTip:', e.message); }
    }, 2000);

    return;
  }

  await ctx.reply('Используй /итог чтобы записать день, или /помощь для списка команд.');
});

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const uid = ctx.from.id;
  const name = ctx.from.first_name || 'друг';
  const payload = ctx.startPayload; // часть после /start (deep link)

  // Убеждаемся что пользователь есть в БД (мог быть создан через webapp)
  if (!db.prepare('SELECT 1 FROM users WHERE user_id = ?').get(uid)) {
    db.prepare('INSERT INTO users (user_id, name) VALUES (?, ?)').run(uid, name);
  } else {
    // Обновляем имя на случай если изменилось
    db.prepare('UPDATE users SET name = ? WHERE user_id = ?').run(name, uid);
  }

  // ── Обработка invite deep link ─────────────────────────────────────────────
  if (payload?.startsWith('invite_')) {
    const code = payload.replace('invite_', '');
    console.log(`[invite] uid=${uid} name="${name}" code="${code}"`);

    const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(code);
    console.log(`[invite] db lookup:`, invite
      ? `creator=${invite.creator_id} used_by=${invite.used_by ?? 'null'}`
      : 'NOT FOUND');

    if (!invite) {
      await ctx.reply('❌ Приглашение не найдено. Попроси друга создать новую ссылку.');
    } else if (invite.used_by !== null && invite.used_by !== uid) {
      // Уже использовано кем-то другим
      await ctx.reply('❌ Эта ссылка уже была использована. Попроси друга создать новую.');
    } else if (invite.creator_id === uid) {
      await ctx.reply('😄 Нельзя добавить себя в друзья — перешли ссылку другому человеку!');
    } else {
      try {
        // Создаём дружбу в обе стороны
        db.prepare('UPDATE invites SET used_by = ? WHERE code = ?').run(uid, code);
        const r1 = db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(invite.creator_id, uid);
        const r2 = db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(uid, invite.creator_id);
        console.log(`[invite] friendships inserted: A→B changes=${r1.changes} B→A changes=${r2.changes}`);

        const creator = db.prepare('SELECT name FROM users WHERE user_id = ?').get(invite.creator_id);
        const creatorName = creator?.name || 'пользователем';
        console.log(`[invite] success: ${uid}(${name}) ↔ ${invite.creator_id}(${creatorName})`);

        await send(uid, `🤝 Отлично! Ты подружился с *${creatorName.replace(/([_*`])/g,'\\$1')}*.\n\nОткрой вкладку Друзья в дневнике — там уже виден его прогресс.`);
        await send(invite.creator_id, `👥 *${name.replace(/([_*`])/g,'\\$1')}* принял твоё приглашение! Откройте вкладку Друзья в дневнике.`).catch(e =>
          console.warn(`[invite] не удалось уведомить creator ${invite.creator_id}:`, e.message)
        );
      } catch (e) {
        console.error('[invite] ERROR creating friendship:', e.message);
        await ctx.reply('Произошла ошибка при добавлении в друзья. Попробуй ещё раз.');
      }
    }
    // Продолжаем — показываем онбординг или приветствие
  }

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(uid);

  // Если профиль не заполнен — запускаем анкету
  if (!user.gender) {
    // Экранируем спецсимволы MarkdownV1 в имени (_, *, `)
    const safeName = name.replace(/([_*`])/g, '\\$1');
    await bot.telegram.sendMessage(ctx.chat.id,
      `Привет, ${safeName}! 👋 Я бот-дневник с AI-советами по work-life балансу.\n\n` +
      `Чтобы советы были точнее — пара вопросов. *Ты:*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('👨 Мужчина', 'reg:gender:male'),
            Markup.button.callback('👩 Женщина', 'reg:gender:female'),
          ]
        ])
      }
    ).catch(async (e) => {
      console.error('[/start questionnaire] Markdown error, fallback:', e.message);
      // Фолбэк — без форматирования
      await bot.telegram.sendMessage(ctx.chat.id,
        `Привет, ${name}! 👋 Я бот-дневник с AI-советами по work-life балансу.\n\n` +
        `Чтобы советы были точнее — пара вопросов. Ты:`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('👨 Мужчина', 'reg:gender:male'),
            Markup.button.callback('👩 Женщина', 'reg:gender:female'),
          ]
        ])
      );
    });
    return;
  }

  // Профиль уже есть — просто приветствие
  await sendWelcome(ctx.chat.id);
});

async function sendWelcome(chatId) {
  await send(chatId,
    `☀️ *Утро:* чекин по планам\n` +
    `🌙 *Вечер:* итог дня + планы на завтра\n\n` +
    `/итог — записать день\n` +
    `/время — настроить напоминания\n` +
    `/профиль — посмотреть и изменить профиль\n` +
    `/помощь — все команды`
  );
}

// ─── Регистрация: выбор пола ─────────────────────────────────────────────────
bot.action(/^reg:gender:(male|female)$/, async (ctx) => {
  const gender = ctx.match[1];
  db.prepare('UPDATE users SET gender = ? WHERE user_id = ?').run(gender, ctx.from.id);
  await ctx.editMessageText(
    `Отлично! Теперь семейное положение:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🧍 Один/Одна', 'reg:family:single'),
        Markup.button.callback('❤️ В отношениях', 'reg:family:partner'),
      ],
      [
        Markup.button.callback('💍 В браке', 'reg:family:married'),
        Markup.button.callback('👨‍👩‍👧 Есть дети', 'reg:family:children'),
      ]
    ])
  );
  await ctx.answerCbQuery();
});

// ─── Регистрация: выбор семейного положения ───────────────────────────────────
bot.action(/^reg:family:(single|partner|married|children)$/, async (ctx) => {
  const family = ctx.match[1];
  db.prepare('UPDATE users SET family_status = ? WHERE user_id = ?').run(family, ctx.from.id);
  await ctx.editMessageText(`✅ Готово! Профиль сохранён.`);
  await ctx.answerCbQuery('Сохранено!');
  await sendWelcome(ctx.from.id);
});

// ─── /профиль ─────────────────────────────────────────────────────────────────
bot.command('профиль', async (ctx) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(ctx.from.id);
  if (!user) return ctx.reply('Сначала напиши /start');

  const genderLabel = { male: '👨 Мужчина', female: '👩 Женщина' }[user.gender] || '—';
  const familyLabel = {
    single: '🧍 Один/Одна', partner: '❤️ В отношениях',
    married: '💍 В браке', children: '👨‍👩‍👧 Есть дети'
  }[user.family_status] || '—';

  await send(ctx.chat.id,
    `👤 *Профиль*\n\n` +
    `Пол: ${genderLabel}\n` +
    `Семейное положение: ${familyLabel}\n\n` +
    `_Изменить:_`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Изменить пол', 'profile:edit:gender')],
      [Markup.button.callback('Изменить семейное положение', 'profile:edit:family')],
    ])
  );
});

bot.action('profile:edit:gender', async (ctx) => {
  await ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      [
        Markup.button.callback('👨 Мужчина', 'reg:gender:male'),
        Markup.button.callback('👩 Женщина', 'reg:gender:female'),
      ]
    ]).reply_markup
  );
  await ctx.answerCbQuery();
});

bot.action('profile:edit:family', async (ctx) => {
  await ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🧍 Один/Одна', 'reg:family:single'),
        Markup.button.callback('❤️ В отношениях', 'reg:family:partner'),
      ],
      [
        Markup.button.callback('💍 В браке', 'reg:family:married'),
        Markup.button.callback('👨‍👩‍👧 Есть дети', 'reg:family:children'),
      ]
    ]).reply_markup
  );
  await ctx.answerCbQuery();
});

// ─── /друзья ──────────────────────────────────────────────────────────────────
bot.command('друзья', async (ctx) => {
  const uid = ctx.from.id;
  const crypto = require('crypto');
  const code = crypto.randomBytes(5).toString('hex');
  db.prepare('INSERT INTO invites (code, creator_id) VALUES (?, ?)').run(code, uid);
  const botUsername = ctx.botInfo?.username || process.env.BOT_USERNAME;
  const link = `https://t.me/${botUsername}?start=invite_${code}`;

  const friends = db.prepare(`
    SELECT u.name FROM friendships f JOIN users u ON u.user_id = f.friend_id WHERE f.user_id = ?
  `).all(uid);

  let text = `👥 *Друзья в дневнике*\n\n`;
  if (friends.length) {
    text += `Твои друзья:\n${friends.map(f => `• ${f.name}`).join('\n')}\n\n`;
  } else {
    text += `Друзей пока нет.\n\n`;
  }
  text += `📤 *Пригласи друга:*\n\`${link}\`\n\n_Ссылка одноразовая. Когда друг перейдёт — вы увидите прогресс друг друга в приложении._`;

  await send(ctx.chat.id, text);
});

// ─── /debug — диагностика дружб и инвайтов ───────────────────────────────────
bot.command('debug', async (ctx) => {
  const uid = ctx.from.id;

  const friends = db.prepare(`
    SELECT u.user_id, u.name FROM friendships f
    JOIN users u ON u.user_id = f.friend_id WHERE f.user_id = ?
  `).all(uid);

  const myInvites = db.prepare(
    `SELECT code, used_by, created_at FROM invites WHERE creator_id = ? ORDER BY created_at DESC LIMIT 5`
  ).all(uid);

  const usedInvites = db.prepare(
    `SELECT i.code, u.name as creator_name, i.created_at FROM invites i
     JOIN users u ON u.user_id = i.creator_id WHERE i.used_by = ?`
  ).all(uid);

  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalFriendships = db.prepare('SELECT COUNT(*) as c FROM friendships').get().c;

  let text = `🔧 *Debug — uid: ${uid}*\n\n`;
  text += `👥 Мои друзья (${friends.length}):\n`;
  text += friends.length ? friends.map(f => `• ${f.name} (${f.user_id})`).join('\n') : '— нет —';
  text += `\n\n📤 Мои инвайты (последние 5):\n`;
  text += myInvites.length
    ? myInvites.map(i => `• \`${i.code}\` → used_by: ${i.used_by ?? 'null'}`).join('\n')
    : '— нет —';
  text += `\n\n📥 Инвайты по которым я пришёл:\n`;
  text += usedInvites.length
    ? usedInvites.map(i => `• от ${i.creator_name}: \`${i.code}\``).join('\n')
    : '— нет —';
  text += `\n\n📊 В БД: ${totalUsers} юзеров, ${totalFriendships} дружб`;

  await send(ctx.chat.id, text);
});

// ─── /помощь ──────────────────────────────────────────────────────────────────
bot.command('помощь', async (ctx) => {
  await send(ctx.chat.id,
    `📋 *Команды:*\n\n` +
    `*Дневник*\n` +
    `/итог — начать вечерний итог\n` +
    `/сегодня — запись за сегодня\n` +
    `/неделя — последние 7 дней\n` +
    `/настроение — график оценок\n\n` +
    `*Планы*\n` +
    `/планы — активные задачи с чеклистом\n` +
    `/хвост — задачи с 2+ переносами\n\n` +
    `*AI-анализ*\n` +
    `/анализ 7 — общий анализ за 7 дней\n` +
    `/анализ 30 — анализ за месяц\n` +
    `/психо — психологический анализ\n` +
    `/баланс — советы по work-life балансу\n\n` +
    `*Прочее*\n` +
    `/экспорт — выгрузка в .txt\n` +
    `/время — настроить время напоминаний`
  );
});

// ─── /время ───────────────────────────────────────────────────────────────────
bot.command('время', async (ctx) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(ctx.from.id);
  if (!user) return ctx.reply('Сначала напиши /start');
  const { text, keyboard } = buildTimeMenu(user);
  await send(ctx.chat.id, text, keyboard);
});

// ─── /дневник — открыть Mini App ─────────────────────────────────────────────
bot.command('дневник', async (ctx) => {
  const url = process.env.WEBAPP_URL;
  if (!url) return ctx.reply('WEBAPP_URL не настроен в .env');
  await ctx.reply('Открывай 👇', {
    reply_markup: {
      inline_keyboard: [[{ text: '📖 Открыть дневник', web_app: { url } }]]
    }
  });
});

// ─── /итог — с выбором даты ───────────────────────────────────────────────────
bot.command('итог', async (ctx) => {
  const arg = ctx.message.text.split(' ').slice(1).join(' ').trim();

  // /итог вчера
  if (arg === 'вчера') return startEveningFlow(ctx.from.id, yesterdayStr());

  // /итог 14.03
  const matchDate = arg.match(/^(\d{1,2})\.(\d{2})$/);
  if (matchDate) {
    const year = new Date().getFullYear();
    const date = `${year}-${matchDate[2].padStart(2,'0')}-${matchDate[1].padStart(2,'0')}`;
    return startEveningFlow(ctx.from.id, date);
  }

  // Без аргумента — показываем выбор
  await send(ctx.chat.id, `За какой день подводим итог?`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(`Сегодня (${fmtDate(todayStr())})`, `itog_date:${todayStr()}`),
        Markup.button.callback(`Вчера (${fmtDate(yesterdayStr())})`, `itog_date:${yesterdayStr()}`),
      ],
      [Markup.button.callback('📅 Другая дата', 'itog_date:custom')],
    ])
  );
});

bot.action(/^itog_date:(.+)$/, async (ctx) => {
  const val = ctx.match[1];
  await ctx.answerCbQuery();
  await ctx.deleteMessage().catch(() => {});

  if (val === 'custom') {
    setState(ctx.from.id, 'awaiting_itog_date', {});
    await send(ctx.from.id, `Напиши дату в формате ДД.ММ (например: 14.03)`);
  } else {
    startEveningFlow(ctx.from.id, val);
  }
});

// ─── Просмотр записей ─────────────────────────────────────────────────────────
bot.command('сегодня', async (ctx) => {
  const entry = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date = ?').get(ctx.from.id, todayStr());
  if (!entry) return ctx.reply('Записи за сегодня нет. Используй /итог вечером.');
  await send(ctx.chat.id, fmtEntry(entry));
});

bot.command('неделя', async (ctx) => {
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC LIMIT 7').all(ctx.from.id);
  if (!entries.length) return ctx.reply('Записей пока нет.');
  let msg = '';
  for (const e of entries) {
    const chunk = fmtEntry(e);
    if ((msg + chunk).length > 3600) { await send(ctx.chat.id, msg); msg = chunk; }
    else msg = msg ? msg + '\n\n─────\n\n' + chunk : chunk;
  }
  if (msg) await send(ctx.chat.id, msg);
});

bot.command('настроение', async (ctx) => {
  const entries = db.prepare(
    `SELECT date, mood_score FROM entries WHERE user_id = ? AND mood_score IS NOT NULL ORDER BY date DESC LIMIT 14`
  ).all(ctx.from.id);
  if (!entries.length) return ctx.reply('Оценок пока нет.');
  const lines = [...entries].reverse().map(e => `${fmtDate(e.date)}  ${moodBar(e.mood_score)} ${e.mood_score}/10`).join('\n');
  await send(ctx.chat.id, `📊 *Настроение за 2 недели:*\n\n\`\`\`\n${lines}\n\`\`\``);
});

// ─── Планы ────────────────────────────────────────────────────────────────────
bot.command('планы', async (ctx) => {
  const uid = ctx.from.id;
  const plans = db.prepare(
    `SELECT * FROM plans WHERE user_id = ? AND status = 'pending' AND plan_date >= ? ORDER BY plan_date, id`
  ).all(uid, todayStr());

  if (!plans.length) return ctx.reply('Активных планов нет. Добавь их через /итог.');

  const grouped = {};
  plans.forEach(p => { if (!grouped[p.plan_date]) grouped[p.plan_date] = []; grouped[p.plan_date].push(p); });

  for (const [date, datePlans] of Object.entries(grouped)) {
    const title = date === todayStr() ? 'Планы на сегодня' : `Планы на ${fmtDate(date)}`;
    const { text, keyboard } = buildChecklist(datePlans, title);
    const msg = await send(uid, text, keyboard);

    db.prepare(`
      INSERT INTO checklists (user_id, plan_date, msg_id, chat_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, plan_date) DO UPDATE SET msg_id = excluded.msg_id, chat_id = excluded.chat_id
    `).run(uid, date, msg.message_id, msg.chat.id);
  }
});

// Фикс: считаем только строки со status='moved', чтобы корректно определять число переносов
bot.command('хвост', async (ctx) => {
  const rows = db.prepare(
    `SELECT task_text, COUNT(*) as moves, MAX(plan_date) as last_date
     FROM plans WHERE user_id = ? AND status = 'moved'
     GROUP BY task_text HAVING moves >= 2 ORDER BY moves DESC`
  ).all(ctx.from.id);
  if (!rows.length) return ctx.reply('Задач с многократными переносами нет 👍');
  let text = `⚠️ *Задачи которые переносились 2+ раз:*\n\n`;
  rows.forEach(r => { text += `• ${r.task_text} _(${r.moves}x, последний: ${fmtDate(r.last_date)})_\n`; });
  text += `\nЭти задачи стоит пересмотреть — сделать, делегировать или убрать совсем.`;
  await send(ctx.chat.id, text);
});

// ─── AI-анализ ────────────────────────────────────────────────────────────────
bot.command('анализ', async (ctx) => {
  const days = parseInt(ctx.message.text.split(' ')[1]) || 7;
  const uid = ctx.from.id;
  const from = new Date(); from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split('T')[0];
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date >= ? ORDER BY date').all(uid, fromStr);
  if (entries.length < 3) return ctx.reply(`Нужно хотя бы 3 записи. Сейчас: ${entries.length}`);
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? AND plan_date >= ? ORDER BY plan_date').all(uid, fromStr);
  const userProfile = db.prepare('SELECT * FROM users WHERE user_id = ?').get(uid);
  await ctx.reply(`🔍 Анализирую ${days} дней...`);
  try {
    const result = await analyzeGeneral(entries, plans, days, userProfile);
    await send(uid, `📊 *Анализ за ${days} дней:*\n\n${result}`);
  } catch (e) { await ctx.reply('Ошибка при анализе. Попробуй позже.'); }
});

bot.command('психо', async (ctx) => {
  const uid = ctx.from.id;
  const from = new Date(); from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().split('T')[0];
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date >= ? ORDER BY date').all(uid, fromStr);
  if (entries.length < 5) return ctx.reply(`Нужно хотя бы 5 записей. Сейчас: ${entries.length}`);
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? AND plan_date >= ? ORDER BY plan_date').all(uid, fromStr);
  const userProfilePsych = db.prepare('SELECT * FROM users WHERE user_id = ?').get(uid);
  await ctx.reply('🧠 Провожу психологический анализ...');
  try {
    const result = await analyzePsych(entries, plans, 30, userProfilePsych);
    const chunks = result.match(/[\s\S]{1,3800}/g) || [result];
    for (let i = 0; i < chunks.length; i++) {
      await send(uid, i === 0 ? `🧠 *Психологический анализ:*\n\n${chunks[i]}` : chunks[i]);
    }
  } catch (e) { await ctx.reply('Ошибка при анализе. Попробуй позже.'); }
});

bot.command('баланс', async (ctx) => {
  const uid = ctx.from.id;
  const from = new Date(); from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().split('T')[0];
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date >= ? ORDER BY date').all(uid, fromStr);
  if (entries.length < 5) return ctx.reply(`Нужно хотя бы 5 записей. Сейчас: ${entries.length}`);
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? AND plan_date >= ? ORDER BY plan_date').all(uid, fromStr);
  const userProfileBal = db.prepare('SELECT * FROM users WHERE user_id = ?').get(uid);
  await ctx.reply('⚖️ Анализирую work-life баланс...');
  try {
    const result = await analyzeBalance(entries, plans, userProfileBal);
    const chunks = result.match(/[\s\S]{1,3800}/g) || [result];
    for (let i = 0; i < chunks.length; i++) {
      await send(uid, i === 0 ? `⚖️ *Work-life баланс:*\n\n${chunks[i]}` : chunks[i]);
    }
  } catch (e) { await ctx.reply('Ошибка при анализе. Попробуй позже.'); }
});

// ─── Экспорт ──────────────────────────────────────────────────────────────────
bot.command('экспорт', async (ctx) => {
  const uid = ctx.from.id;
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY date ASC').all(uid);
  if (!entries.length) return ctx.reply('Записей пока нет.');
  let text = `ДНЕВНИК — экспорт ${new Date().toLocaleDateString('ru')}\n${'='.repeat(40)}\n\n`;
  for (const e of entries) {
    text += `=== ${fmtDate(e.date)} ===\nСделал: ${e.done}\n`;
    if (e.not_done && e.not_done !== 'ничего') text += `Не получилось: ${e.not_done}\n`;
    if (e.mood_score) text += `Оценка: ${e.mood_score}/10\n`;
    text += '\n';
  }
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY plan_date').all(uid);
  if (plans.length) {
    text += `\n${'='.repeat(40)}\nПЛАНЫ\n${'='.repeat(40)}\n\n`;
    plans.forEach(p => {
      text += `[${fmtDate(p.plan_date)}] ${p.task_text} — ${p.status}`;
      if (p.reason) text += ` (${p.reason})`;
      text += '\n';
    });
  }
  await ctx.replyWithDocument(
    { source: Buffer.from(text, 'utf8'), filename: `diary_${todayStr()}.txt` },
    { caption: `📄 Дневник: ${entries.length} записей` }
  );
});

// ─── Cron: рассылка по расписанию ────────────────────────────────────────────
cron.schedule('* * * * *', async () => {
  const hhmm = new Date().toTimeString().slice(0, 5);
  const users = db.prepare('SELECT * FROM users').all();

  for (const user of users) {
    try {
      // Утренний чекин
      if (user.morning_time === hhmm) {
        await startMorningFlow(user.user_id);
      }

      // Вечерний итог
      if (user.evening_time === hhmm) {
        await startEveningFlow(user.user_id);
      }

      // Разбор незакрытых задач — через 30 минут после вечернего итога
      // Фикс: правильный перенос через полночь
      const [eh, em] = user.evening_time.split(':').map(Number);
      const totalMin = eh * 60 + em + 30;
      const reviewTime =
        `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
      if (reviewTime === hhmm) {
        await startEveningTaskReview(user.user_id);
      }
    } catch (e) {
      console.error(`Cron error user ${user.user_id}:`, e.message);
    }
  }
});

// ─── Запуск ───────────────────────────────────────────────────────────────────
bot.launch()
  .then(() => {
    const username = bot.botInfo?.username || '';
    console.log(`✅ Бот запущен (@${username})`);
    if (username) setBotUsername(username);
    else console.warn('⚠️  Не удалось получить username бота — invite-ссылки могут не работать');
  })
  .catch(e => console.error('❌ Ошибка запуска бота:', e.message));

// Не даём процессу падать от ошибок бота — Express продолжает работать
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  // Не выходим — Express и cron продолжают работать
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
