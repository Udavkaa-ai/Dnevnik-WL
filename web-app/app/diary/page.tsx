'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import DiaryCard from '@/components/DiaryCard';
import Link from 'next/link';
import { getCache, setCache } from '@/lib/cache';

interface DiaryEntry {
  id: number;
  date: string;
  text: string;
  moodScore: number | null;
  photos: string[];
}

export default function DiaryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const loadEntries = useCallback(async (offset = 0, replace = true) => {
    if (offset === 0) {
      const hit = getCache<{ entries: DiaryEntry[]; total: number }>('diary-list');
      if (hit) { setEntries(hit.entries); setTotal(hit.total); setLoading(false); }
      else setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetch(`/api/diary?limit=${limit}&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json();
      if (replace) {
        setCache('diary-list', { entries: data.entries || [], total: data.total || 0 });
        setEntries(data.entries || []);
      } else {
        setEntries((prev) => [...prev, ...(data.entries || [])]);
      }
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'loading') loadEntries(0);
  }, [status, loadEntries]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const hasMore = entries.length < total;

  if (status === 'loading' || (loading && entries.length === 0)) {
    return (
      <div className="app-shell">
        <AppHeader title="Записи" />
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader
        title="Записи"
        subtitle={total > 0 ? `${total} записей` : 'Начните вести дневник'}
      />

      <div className="page-content">
        {entries.length === 0 && !loading && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📔</p>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Нет записей
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Начните вести дневник — это занимает всего 5 минут
            </p>
            <Link
              href="/diary/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
            >
              <span>✍️</span> Написать первую запись
            </Link>
          </div>
        )}

        {entries.map((entry) => (
          <DiaryCard key={entry.id} entry={entry} onDelete={handleDelete} />
        ))}

        {hasMore && (
          <button
            onClick={() => loadEntries(entries.length, false)}
            disabled={loadingMore}
            className="w-full py-3 text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                Загрузка...
              </>
            ) : (
              'Загрузить ещё'
            )}
          </button>
        )}
      </div>

      {/* FAB */}
      <Link href="/diary/new" className="fab">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </Link>

      <BottomNav />
    </div>
  );
}
