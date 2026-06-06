'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import TaskItem from '@/components/TaskItem';
import Link from 'next/link';
import { getTodayString, addDays, getDayLabel, formatDate, getMoodEmoji } from '@/lib/utils';

interface Task {
  id: number;
  text: string;
  date: string | null;
  status: string;
  movedTo: string | null;
}

interface DiaryEntry {
  id: number;
  date: string;
  text: string;
  moodScore: number | null;
  photos: string[];
}

interface AddTaskInputProps {
  onAdd: (text: string, date?: string) => void;
  defaultDate?: string;
  placeholder?: string;
}

function AddTaskInput({ onAdd, defaultDate, placeholder = 'Добавить задачу...' }: AddTaskInputProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = () => {
    if (text.trim()) {
      onAdd(text.trim(), defaultDate);
      setText('');
    }
  };

  return (
    <div className={`flex gap-2 mt-2 transition-all ${focused ? 'opacity-100' : 'opacity-70'}`}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder={placeholder}
        className="flex-1 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:border-blue-400 dark:focus:border-blue-500"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
      >
        +
      </button>
    </div>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = getTodayString();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, diaryRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/diary?limit=1'),
      ]);
      const tasksData = await tasksRes.json();
      const diaryData = await diaryRes.json();

      setTasks(tasksData);

      const todayE = diaryData.entries?.find((e: DiaryEntry) => e.date === today);
      setTodayEntry(todayE || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status, loadData]);

  const handleAddTask = async (text: string, date?: string) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, date: date || null }),
    });
    if (res.ok) {
      const newTask = await res.json();
      setTasks((prev) => [...prev, newTask]);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  const handleDeleteTask = async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleMoveTask = async (id: number, newDate: string) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'moved', movedTo: newDate, date: newDate }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  const loadAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch('/api/analysis', { method: 'POST' });
      const data = await res.json();
      setAnalysis(data.analysis || '');
    } catch {
      setAnalysis('Не удалось загрузить анализ');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const getTasksForDate = (date: string) =>
    tasks.filter((t) => t.date === date && t.status !== 'cancelled');

  if (status === 'loading' || loading) {
    return (
      <div className="app-shell">
        <div className="app-header">
          <div className="px-4 py-3">
            <div className="h-6 w-32 bg-white/20 rounded animate-pulse" />
          </div>
        </div>
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  const userName = (session?.user as { name?: string | null } | undefined)?.name;
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  return (
    <div className="app-shell">
      <AppHeader
        title="Дневник"
        subtitle={`${greeting()}${userName ? `, ${userName.split(' ')[0]}` : ''}!`}
      />

      <div className="page-content">
        {/* Today's diary entry card */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                Запись за сегодня
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(today)}</p>
            </div>
            {todayEntry && (
              <div className="text-2xl">{getMoodEmoji(todayEntry.moodScore)}</div>
            )}
          </div>

          {todayEntry ? (
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3 mb-3">
                {todayEntry.text}
              </p>
              <Link
                href={`/diary/${todayEntry.id}`}
                className="text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                Читать полностью →
              </Link>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Вы ещё не написали запись сегодня
              </p>
              <Link
                href="/diary/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
              >
                <span>✍️</span> Написать запись
              </Link>
            </div>
          )}
        </div>

        {/* Tasks for today */}
        <div>
          <div className="section-header">{getDayLabel(today)}</div>
          <div className="card p-3">
            {getTasksForDate(today).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
                Нет задач на сегодня
              </p>
            )}
            {getTasksForDate(today).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTask}
                onMoveToDate={handleMoveTask}
              />
            ))}
            <AddTaskInput onAdd={handleAddTask} defaultDate={today} />
          </div>
        </div>

        {/* Tasks for tomorrow */}
        <div>
          <div className="section-header">{getDayLabel(tomorrow)}</div>
          <div className="card p-3">
            {getTasksForDate(tomorrow).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
                Нет задач на завтра
              </p>
            )}
            {getTasksForDate(tomorrow).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTask}
                onMoveToDate={handleMoveTask}
              />
            ))}
            <AddTaskInput onAdd={handleAddTask} defaultDate={tomorrow} />
          </div>
        </div>

        {/* Tasks for day after tomorrow */}
        <div>
          <div className="section-header">{getDayLabel(dayAfter)}</div>
          <div className="card p-3">
            {getTasksForDate(dayAfter).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
                Нет задач
              </p>
            )}
            {getTasksForDate(dayAfter).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTask}
                onMoveToDate={handleMoveTask}
              />
            ))}
            <AddTaskInput onAdd={handleAddTask} defaultDate={dayAfter} />
          </div>
        </div>

        {/* AI Analysis card */}
        <div className="card p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                AI Анализ
              </h2>
            </div>
            <button
              onClick={loadAnalysis}
              disabled={analysisLoading}
              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
            >
              {analysisLoading ? '...' : analysis ? 'Обновить' : 'Анализировать'}
            </button>
          </div>

          {analysisLoading && (
            <div className="flex items-center gap-3 py-2">
              <div className="spinner" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Анализирую ваши записи...
              </p>
            </div>
          )}

          {!analysisLoading && analysis && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis}</p>
          )}

          {!analysisLoading && !analysis && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Нажмите «Анализировать» чтобы получить персональный анализ на основе ваших записей
            </p>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
