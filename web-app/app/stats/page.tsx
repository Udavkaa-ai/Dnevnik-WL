'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import dynamic from 'next/dynamic';

const MoodChart = dynamic(() => import('@/components/MoodChart'), { ssr: false });
import { getCache, setCache } from '@/lib/cache';

interface MoodDataPoint {
  date: string;
  mood: number | null;
}

interface TaskStats {
  total: number;
  done: number;
  pending: number;
  cancelled: number;
  moved: number;
  completionRate: number;
}

interface StatsData {
  moodData: MoodDataPoint[];
  taskStats: TaskStats;
  avgMood: number | null;
  totalEntries: number;
}

export default function StatsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const loadStats = useCallback(async () => {
    const hit = getCache<StatsData>(`stats-${period}`);
    if (hit) { setStats(hit); setLoading(false); }
    else setLoading(true);

    try {
      const res = await fetch(`/api/stats?days=${period}`);
      if (!res.ok) return;
      const data = await res.json();
      setCache(`stats-${period}`, data);
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (status !== 'loading') loadStats();
  }, [status, loadStats]);

  if (status === 'loading' || loading) {
    return (
      <div className="app-shell">
        <AppHeader title="Статистика" />
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  const ts = stats?.taskStats;
  const completionColor =
    !ts || ts.total === 0
      ? '#9ca3af'
      : ts.completionRate >= 80
      ? '#22c55e'
      : ts.completionRate >= 50
      ? '#eab308'
      : '#ef4444';

  return (
    <div className="app-shell">
      <AppHeader title="Статистика" subtitle={`За ${period} дней`} />

      <div className="page-content">
        {/* Period selector */}
        <div className="flex gap-2 mb-4">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                period === d
                  ? 'text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
              style={period === d ? { background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' } : {}}
            >
              {d} дней
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              Среднее настроение
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.avgMood !== null && stats?.avgMood !== undefined
                  ? stats.avgMood
                  : '—'}
              </span>
              {stats?.avgMood !== null && stats?.avgMood !== undefined && (
                <span className="text-sm text-gray-500">/10</span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">за период</p>
          </div>

          <div className="card p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              Записей всего
            </p>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.totalEntries ?? 0}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">в дневнике</p>
          </div>
        </div>

        {/* Mood chart */}
        <div className="card p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            График настроения
          </h2>
          {stats?.moodData && <MoodChart data={stats.moodData} />}
        </div>

        {/* Task stats */}
        {ts && ts.total > 0 && (
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Задачи
              </h2>
              <span
                className="text-lg font-bold"
                style={{ color: completionColor }}
              >
                {ts.completionRate}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${ts.completionRate}%`,
                  background: `linear-gradient(to right, ${completionColor}aa, ${completionColor})`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Всего', value: ts.total, color: '#6b7280' },
                { label: 'Выполнено', value: ts.done, color: '#22c55e' },
                { label: 'Активных', value: ts.pending, color: '#3b82f6' },
                { label: 'Отменено', value: ts.cancelled, color: '#ef4444' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2 px-3 rounded-xl"
                  style={{ backgroundColor: item.color + '15' }}
                >
                  <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className="text-sm font-bold" style={{ color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ts && ts.total === 0 && (
          <div className="card p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Задачи
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              Нет задач за этот период
            </p>
          </div>
        )}

        {/* Mood distribution */}
        {stats?.moodData && stats.moodData.some((d) => d.mood !== null) && (
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Распределение настроения
            </h2>
            {(() => {
              const counts: Record<string, number> = {
                'Отлично (8-10)': 0,
                'Хорошо (6-7)': 0,
                'Нейтрально (4-5)': 0,
                'Плохо (1-3)': 0,
              };
              stats.moodData.forEach((d) => {
                if (d.mood === null) return;
                if (d.mood >= 8) counts['Отлично (8-10)']++;
                else if (d.mood >= 6) counts['Хорошо (6-7)']++;
                else if (d.mood >= 4) counts['Нейтрально (4-5)']++;
                else counts['Плохо (1-3)']++;
              });
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              const colors = ['#22c55e', '#84cc16', '#eab308', '#ef4444'];

              return (
                <div className="space-y-2">
                  {Object.entries(counts).map(([label, count], i) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 dark:text-gray-400">{label}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {count} дн. ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
