# 📓 Дневник — Android App

Личный дневник с AI-анализом, трекером задач и трекером настроения. Работает полностью офлайн — все данные хранятся локально на устройстве.

## Сборка APK

Открой вкладку **Actions** → **Build Android APK** → **Run workflow**.

APK появится в разделе **Artifacts** через ~5 минут.

## Функции

- **Дневник** — ежедневные записи с оценкой дня (1–10) и текстом
- **Задачи** — трекер с датами (сегодня / завтра / послезавтра / без даты)
- **AI-анализ** — анализ настроения и советы на основе записей (требует ключ Anthropic)
- **График настроения** — визуализация динамики оценок
- **Уведомления** — утренний чекин и вечерний итог по расписанию
- **Офлайн** — SQLite, никаких внешних серверов

## Структура проекта

```
android-app/        — Expo / React Native приложение
├── src/
│   ├── screens/    — HomeScreen, DiaryScreen, TasksScreen, StatsScreen
│   ├── db.js       — SQLite (expo-sqlite)
│   ├── ai.js       — Claude API (Anthropic)
│   └── utils.js    — вспомогательные функции дат и форматирования
├── assets/         — иконки и splash screen
└── app.json        — конфигурация Expo

.github/workflows/
└── build-apk.yml   — сборка APK через GitHub Actions (без EAS)
```

## Локальная разработка

```bash
cd android-app
npm install
npx expo start
```

Для AI-функций создай `android-app/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
