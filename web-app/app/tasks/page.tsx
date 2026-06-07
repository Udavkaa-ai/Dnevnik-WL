'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import TaskItem from '@/components/TaskItem';
import { getTodayString, getDayLabel } from '@/lib/utils';
import { getCache, setCache, bustCache } from '@/lib/cache';

interface Task {
  id: number;
  text: string;
  date: string | null;
  status: string;
  movedTo: string | null;
}

interface TaskGroup {
  label: string;
  tasks: Task[];
  defaultDate?: string;
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const today = getTodayString();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const loadTasks = useCallback(async () => {
    const hit = getCache<Task[]>('tasks');
    if (hit) { setTasks(hit); setLoading(false); }

    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) return;
      const data = await res.json();
      setCache('tasks', data);
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'loading') loadTasks();
  }, [status, loadTasks]);

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTaskText.trim(), date: newTaskDate || null }),
    });
    if (res.ok) {
      const newTask = await res.json();
      setTasks((prev) => { const next = [...prev, newTask]; bustCache('tasks', 'home'); return next; });
      setNewTaskText('');
      setNewTaskDate('');
      setShowAddForm(false);
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

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  // Group tasks
  const overdue = filteredTasks.filter(
    (t) => t.date && t.date < today && t.status === 'pending'
  );
  const todayTasks = filteredTasks.filter((t) => t.date === today);
  const upcoming = filteredTasks.filter((t) => t.date && t.date > today);
  const noDate = filteredTasks.filter((t) => !t.date);

  // Group upcoming by date
  const upcomingByDate = upcoming.reduce<Record<string, Task[]>>((acc, task) => {
    const d = task.date!;
    if (!acc[d]) acc[d] = [];
    acc[d].push(task);
    return acc;
  }, {});

  const groups: TaskGroup[] = [
    ...(overdue.length > 0 ? [{ label: 'Просроченные', tasks: overdue }] : []),
    { label: getDayLabel(today), tasks: todayTasks, defaultDate: today },
    ...Object.entries(upcomingByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dateTasks]) => ({
        label: getDayLabel(date),
        tasks: dateTasks,
        defaultDate: date,
      })),
    ...(noDate.length > 0 ? [{ label: 'Без даты', tasks: noDate }] : []),
  ];

  if (status === 'loading' || loading) {
    return (
      <div className="app-shell">
        <AppHeader title="Задачи" />
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="app-shell">
      <AppHeader
        title="Задачи"
        subtitle={pendingCount > 0 ? `${pendingCount} активных` : 'Все выполнено!'}
      />

      <div className="page-content">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'all', label: 'Все' },
            { key: 'pending', label: 'Активные' },
            { key: 'done', label: 'Выполненные' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                filter === f.key
                  ? 'text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
              style={filter === f.key ? { background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Task groups */}
        {groups.map((group) => (
          <div key={group.label}>
            <div className="section-header">{group.label}</div>
            <div className="card p-3">
              {group.tasks.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
                  Нет задач
                </p>
              )}
              {group.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteTask}
                  onMoveToDate={handleMoveTask}
                />
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Нет задач
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Добавьте первую задачу
            </p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddForm(true)}>
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Add task modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddForm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-t-2xl p-6 w-full max-w-[480px] fade-in">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Новая задача
            </h3>
            <textarea
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Описание задачи..."
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white dark:bg-gray-700 mb-3 resize-none outline-none focus:border-blue-400"
              autoFocus
            />
            <div className="mb-4">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                Дата (необязательно)
              </label>
              <input
                type="date"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white dark:bg-gray-700 outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTaskText.trim()}
                className="flex-1 py-3 rounded-xl text-white font-medium disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
