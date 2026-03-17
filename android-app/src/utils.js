function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today() {
  return localDateStr(new Date());
}

export function tomorrow(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + 1));
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}

export function formatDate(dateStr, options = {}) {
  const d = new Date(dateStr + 'T00:00:00');
  const defaults = { day: 'numeric', month: 'long' };
  return d.toLocaleDateString('ru-RU', { ...defaults, ...options });
}

export function formatDateFull(dateStr) {
  return formatDate(dateStr, { year: 'numeric', weekday: 'long' });
}

export function formatDateWithWeekday(dateStr) {
  return formatDate(dateStr, { weekday: 'long' });
}

export function formatDateRelative(dateStr) {
  const t = today();
  const tmr = addDays(t, 1);
  if (dateStr === t) return 'Сегодня';
  if (dateStr === tmr) return 'Завтра';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
}

export function moodColor(score) {
  if (!score) return '#8e8e93';
  if (score >= 8) return '#4caf50';
  if (score >= 6) return '#ff9800';
  return '#f44336';
}

export function moodEmoji(score) {
  if (!score) return '—';
  if (score >= 9) return '🚀';
  if (score >= 7) return '😊';
  if (score >= 5) return '😐';
  if (score >= 3) return '😔';
  return '😞';
}

export function moodLabel(score) {
  if (score >= 9) return '🚀 Отличный день!';
  if (score >= 7) return '😊 Хороший день';
  if (score >= 5) return '😐 Нормально';
  if (score >= 3) return '😔 Непростой день';
  return '😞 Тяжёлый день';
}
