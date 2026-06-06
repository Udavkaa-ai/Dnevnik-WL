'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import Image from 'next/image';
import { getTodayString, getMoodEmoji, formatDate } from '@/lib/utils';

export default function NewDiaryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [date, setDate] = useState(getTodayString());
  const [text, setText] = useState('');
  const [moodScore, setMoodScore] = useState(7);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (status === 'unauthenticated') {
    router.replace('/login');
    return null;
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedPaths: string[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          uploadedPaths.push(data.path);
        }
      } catch (e) {
        console.error('Upload error:', e);
      }
    }

    setPhotos((prev) => [...prev, ...uploadedPaths]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);

    try {
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, text: text.trim(), moodScore, photos }),
      });

      if (res.ok) {
        const entry = await res.json();
        router.push(`/diary/${entry.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const moodLabels: Record<number, string> = {
    1: 'Ужасно', 2: 'Очень плохо', 3: 'Плохо', 4: 'Не очень',
    5: 'Нейтрально', 6: 'Неплохо', 7: 'Хорошо', 8: 'Отлично',
    9: 'Прекрасно', 10: 'Великолепно',
  };

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
          <h1 className="text-lg font-semibold text-white flex-1">Новая запись</h1>
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-white/20 text-white hover:bg-white/30 disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Date selector */}
        <div className="card p-4 mb-4">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
            Дата
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={getTodayString()}
            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(date)}</p>
        </div>

        {/* Mood score */}
        <div className="card p-4 mb-4">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">
            Настроение
          </label>
          <div className="text-center mb-3">
            <span className="text-4xl">{getMoodEmoji(moodScore)}</span>
            <div className="mt-1">
              <span className="text-2xl font-bold text-gray-800 dark:text-white">{moodScore}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/10 — {moodLabels[moodScore]}</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={moodScore}
            onChange={(e) => setMoodScore(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Text editor */}
        <div className="card p-4 mb-4">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
            Запись
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что произошло сегодня? Как вы себя чувствуете? О чём думаете?.."
            rows={10}
            className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none resize-none leading-relaxed"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
            {text.length} символов
          </p>
        </div>

        {/* Photos */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Фотографии
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
            >
              {uploading ? 'Загрузка...' : '+ Добавить'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />

          {photos.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
              Нет фотографий
            </p>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                  <Image src={photo} alt={`Photo ${i + 1}`} fill className="object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="w-full py-4 rounded-2xl text-white font-semibold text-base disabled:opacity-50 transition-all active:scale-95 mb-4"
          style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
        >
          {saving ? 'Сохранение...' : 'Сохранить запись'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
