import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOUR_STEPS = [
  {
    id: 'welcome',
    tab: null,
    targetRef: null,
    title: 'Добро пожаловать! 👋',
    description: 'Давайте быстро покажем, как пользоваться приложением. Это займёт меньше минуты.',
    tooltipPosition: 'center',
  },
  {
    id: 'diary_button',
    tab: 'Home',
    targetRef: 'homeEntryBtn',
    title: '📝 Итог дня',
    description: 'Каждый вечер нажимай сюда, чтобы записать мысли о дне и оценить своё настроение по шкале от 1 до 10.',
    tooltipPosition: 'bottom',
  },
  {
    id: 'today_tasks',
    tab: 'Home',
    targetRef: 'homeTodayCard',
    title: '✅ Задачи на сегодня',
    description: 'Здесь видны все задачи на сегодня. Нажми на задачу, чтобы отметить её выполненной. Прогресс отображается в виде счётчика.',
    tooltipPosition: 'bottom',
  },
  {
    id: 'add_task_home',
    tab: 'Home',
    targetRef: 'homeAddTaskBtn',
    title: '➕ Добавить задачу',
    description: 'Нажми «+», чтобы быстро добавить задачу. Выбери дату: сегодня, завтра, послезавтра или без даты.',
    tooltipPosition: 'bottom',
  },
  {
    id: 'ai_analysis',
    tab: 'Home',
    targetRef: 'homeAiCard',
    title: '🤖 AI Анализ',
    description: 'ИИ анализирует твои записи и даёт персональные рекомендации: общий разбор за 7 дней, психологический анализ за 14 дней и баланс работа/жизнь за 30 дней.',
    tooltipPosition: 'top',
  },
  {
    id: 'tasks_screen',
    tab: 'Tasks',
    targetRef: 'tasksFab',
    title: '📋 Планировщик задач',
    description: 'Здесь все задачи сгруппированы по датам: просроченные, сегодня, запланированные, без даты. Нажми «+», чтобы добавить задачу на любую дату или создать повторяющуюся.',
    tooltipPosition: 'top',
  },
  {
    id: 'tasks_actions',
    tab: 'Tasks',
    targetRef: null,
    title: '👆 Управление задачей',
    description: 'Нажми на задачу — выполнить. Удержи или нажми «•••» — появится меню: перенести на другую дату, убрать без даты или отменить.',
    tooltipPosition: 'center',
  },
  {
    id: 'diary_screen',
    tab: 'Diary',
    targetRef: 'diaryList',
    title: '📖 История записей',
    description: 'Здесь хранятся все записи дневника с оценками настроения. Нажми на запись, чтобы прочитать её полностью. Через календарь можно добавить запись за любой прошлый день.',
    tooltipPosition: 'bottom',
  },
  {
    id: 'stats_screen',
    tab: 'Stats',
    targetRef: 'statsChart',
    title: '📊 Статистика',
    description: 'График показывает динамику настроения за последние 7, 14 или 30 дней. Ниже — процент выполнения задач: сколько выполнено, перенесено и отменено.',
    tooltipPosition: 'bottom',
  },
  {
    id: 'done',
    tab: null,
    targetRef: null,
    title: '🎉 Всё готово!',
    description: 'Теперь ты знаешь, как пользоваться приложением. Начинай фиксировать свой день, ставить задачи и следить за прогрессом!',
    tooltipPosition: 'center',
  },
];

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children, navigationRef }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const refsMap = useRef({});

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then(done => {
      if (!done) {
        setTimeout(() => setIsActive(true), 800);
      }
    });
  }, []);

  const registerRef = (key) => (ref) => {
    if (ref) refsMap.current[key] = ref;
  };

  const getRef = (key) => refsMap.current[key] || null;

  const startTour = () => {
    setCurrentStep(0);
    if (navigationRef?.current) {
      try { navigationRef.current.navigate('Home'); } catch (_) {}
    }
    setIsActive(true);
  };

  const skipTour = async () => {
    setIsActive(false);
    await AsyncStorage.setItem('onboarding_done', 'true');
  };

  const nextStep = () => {
    const nextIdx = currentStep + 1;
    if (nextIdx >= TOUR_STEPS.length) {
      skipTour();
      return;
    }
    const nextStepData = TOUR_STEPS[nextIdx];
    if (nextStepData.tab && navigationRef?.current) {
      try { navigationRef.current.navigate(nextStepData.tab); } catch (_) {}
    }
    setCurrentStep(nextIdx);
  };

  return (
    <OnboardingContext.Provider value={{ isActive, currentStep, registerRef, getRef, startTour, skipTour, nextStep }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
