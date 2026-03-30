import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('diary-reminders', {
      name: 'Напоминания дневника',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6c63ff',
    });
  }

  return finalStatus === 'granted';
}

export async function scheduleDailyNotification(identifier, hour, minute, title, body) {
  // Cancel existing notification with same identifier
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

  const id = await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
      channelId: 'diary-reminders',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      repeats: true,
    },
  });

  return id;
}

export async function scheduleMorningReminder(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return scheduleDailyNotification(
    'morning-checkin',
    hour,
    minute,
    '☀️ Доброе утро!',
    'Проверь задачи на сегодня и открой дневник.'
  );
}

export async function scheduleEveningReminder(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return scheduleDailyNotification(
    'evening-summary',
    hour,
    minute,
    '🌙 Время подвести итоги',
    'Запиши что было сегодня и поставь оценку дню.'
  );
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

export async function scheduleTaskReminder(planId, dateStr, timeStr, minutesBefore, taskText) {
  await cancelTaskReminder(planId);
  if (!minutesBefore || minutesBefore <= 0) return;

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const taskDate = new Date(year, month - 1, day, hour, minute, 0);
  const reminderDate = new Date(taskDate.getTime() - minutesBefore * 60 * 1000);
  if (reminderDate <= new Date()) return;

  const label = minutesBefore >= 60
    ? `через ${minutesBefore / 60} ч`
    : `через ${minutesBefore} мин`;

  await Notifications.scheduleNotificationAsync({
    identifier: `task-${planId}`,
    content: {
      title: `⏰ Задача ${label}`,
      body: taskText,
      sound: true,
      channelId: 'diary-reminders',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}

export async function cancelTaskReminder(planId) {
  await Notifications.cancelScheduledNotificationAsync(`task-${planId}`).catch(() => {});
}

export async function notifyAnalysisReady(title) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧠 Анализ готов',
      body: title,
      sound: true,
      channelId: 'diary-reminders',
    },
    trigger: null,
  });
}
