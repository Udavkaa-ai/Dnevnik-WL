'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import Image from 'next/image';
import { formatDate, getMoodEmoji, getMoodColor } from '@/lib/utils';

interface DiaryEntry {
  id: number;
  date: string;
  text: string;
  moodScore: number | null;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export default function DiaryEntryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editMood, setEditMood] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const loadEntry = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/diary/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
        setEditText(data.text);
        setEditMood(data.moodScore ?? 7);
      } else {
        router.replace('/diary');
      }
    } catch {
      router.replace('/diary');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadEntry();
    }
  }, [status, loadEntry]);

  const handleSave = async () => {
    if (!entry || !editText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/diary/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim(), moodScore: editMood }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEntry(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!confirm('Удалить эту запись? Это действие нельзя отменить.')) return;
    await fetch(`/api/diary/${entry.id}`, { method: 'DELETE' });
    router.replace('/diary');
  };

  if (loading || status === 'loading') {
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

  if (!entry) return null;

  const moodColor = getMoodColor(entry.moodScore);

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white flex-1">
            {formatDate(entry.date)}
          </h1>
          <div className="flex gap-2">
            {!editing && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 rounded-xl text-white/80 hover:text-red-300 hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
            {editing && (
              <>
                <button
                  onClick={() => { setEditing(false); setEditText(entry.text); setEditMood(entry.moodScore ?? 7); }}
                  className="px-3 py-1.5 rounded-xl text-sm text-white/80 hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-white/20 text-white hover:bg-white/30 disabled:opacity-50"
                >
                  {saving ? '...' : 'Сохранить'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Mood badge */}
        <div
          className="card p-4 mb-4 flex items-center gap-4"
          style={{ borderLeft: `4px solid ${moodColor}` }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
            style={{ backgroundColor: moodColor + '20' }}
          >
            <span className="text-3xl">{getMoodEmoji(entry.moodScore)}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Настроение</p>
            {editing ? (
              <div className="mt-1">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={editMood}
                  onChange={(e) => setEditMood(parseInt(e.target.value))}
                  className="w-40"
                />
                <p className="text-sm font-bold" style={{ color: getMoodColor(editMood) }}>
                  {editMood}/10
                </p>
              </div>
            ) : (
              <p
                className="text-2xl font-bold"
                style={{ color: moodColor }}
              >
                {entry.moodScore ? `${entry.moodScore}/10` : 'Не указано'}
              </p>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="card p-4 mb-4">
          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={12}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white outline-none resize-none leading-relaxed"
              autoFocus
            />
          ) : (
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {entry.text}
            </p>
          )}
        </div>

        {/* Photos */}
        {entry.photos && entry.photos.length > 0 && (
          <div className="card p-4 mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Фотографии ({entry.photos.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {entry.photos.map((photo, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Фото ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="text-center py-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Создано: {new Date(entry.createdAt).toLocaleString('ru-RU')}
          </p>
          {entry.updatedAt !== entry.createdAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Изменено: {new Date(entry.updatedAt).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
