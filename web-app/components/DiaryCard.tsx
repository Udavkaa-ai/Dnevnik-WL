'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDate, getMoodEmoji, getMoodColor } from '@/lib/utils';

interface DiaryEntry {
  id: number;
  date: string;
  text: string;
  moodScore: number | null;
  photos: string[];
}

interface DiaryCardProps {
  entry: DiaryEntry;
  onDelete?: (id: number) => void;
}

export default function DiaryCard({ entry, onDelete }: DiaryCardProps) {
  const preview = entry.text.length > 150 ? entry.text.slice(0, 150) + '...' : entry.text;
  const moodColor = getMoodColor(entry.moodScore);
  const moodEmoji = getMoodEmoji(entry.moodScore);

  return (
    <div className="card mb-3 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        {/* Mood indicator */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center"
          style={{ backgroundColor: moodColor + '20', border: `2px solid ${moodColor}40` }}
        >
          <span className="text-xl leading-none">{moodEmoji}</span>
          {entry.moodScore && (
            <span className="text-xs font-bold mt-0.5" style={{ color: moodColor }}>
              {entry.moodScore}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {formatDate(entry.date)}
            </p>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm('Удалить эту запись?')) {
                    onDelete(entry.id);
                  }
                }}
                className="p-1 rounded-lg text-gray-300 hover:text-red-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          <Link href={`/diary/${entry.id}`}>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3">
              {preview}
            </p>
          </Link>

          {entry.photos && entry.photos.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {entry.photos.slice(0, 3).map((photo, i) => (
                <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                  <Image
                    src={photo}
                    alt={`Photo ${i + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
              {entry.photos.length > 3 && (
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-500">+{entry.photos.length - 3}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
