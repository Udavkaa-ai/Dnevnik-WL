'use client';

import { useState } from 'react';

interface Task {
  id: number;
  text: string;
  date: string | null;
  status: string;
  movedTo: string | null;
}

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onMoveToDate?: (id: number, date: string) => void;
}

export default function TaskItem({ task, onStatusChange, onDelete, onMoveToDate }: TaskItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDate, setNewDate] = useState('');

  const isDone = task.status === 'done';
  const isCancelled = task.status === 'cancelled';
  const isMoved = task.status === 'moved';

  const handleMoveConfirm = () => {
    if (newDate && onMoveToDate) {
      onMoveToDate(task.id, newDate);
      setShowDatePicker(false);
      setNewDate('');
    }
  };

  return (
    <div
      className={`flex items-start gap-3 py-3 px-4 rounded-xl mb-2 transition-all ${
        isDone
          ? 'bg-green-50 dark:bg-green-900/20 opacity-70'
          : isCancelled
          ? 'bg-gray-50 dark:bg-gray-800/50 opacity-60'
          : isMoved
          ? 'bg-blue-50 dark:bg-blue-900/20 opacity-70'
          : 'bg-white dark:bg-gray-800 shadow-sm'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onStatusChange(task.id, isDone ? 'pending' : 'done')}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          isDone
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
        }`}
      >
        {isDone && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-relaxed ${
            isDone || isCancelled
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-200'
          }`}
        >
          {task.text}
        </p>
        {isMoved && task.movedTo && (
          <p className="text-xs text-blue-500 mt-0.5">Перенесено на {task.movedTo}</p>
        )}
      </div>

      {/* Menu button */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 13a1 1 0 100-2 1 1 0 000 2zm-7 0a1 1 0 100-2 1 1 0 000 2zm14 0a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-6 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[160px] z-50">
              {!isDone && (
                <button
                  onClick={() => { onStatusChange(task.id, 'done'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Выполнено
                </button>
              )}
              {isDone && (
                <button
                  onClick={() => { onStatusChange(task.id, 'pending'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Отменить выполнение
                </button>
              )}
              {!isCancelled && (
                <button
                  onClick={() => { onStatusChange(task.id, 'cancelled'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Отменить
                </button>
              )}
              {onMoveToDate && (
                <button
                  onClick={() => { setShowDatePicker(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Перенести
                </button>
              )}
              <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                <button
                  onClick={() => { onDelete(task.id); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Удалить
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Date picker modal */}
      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDatePicker(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-t-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Перенести на дату
            </h3>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white dark:bg-gray-700 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDatePicker(false)}
                className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleMoveConfirm}
                disabled={!newDate}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
              >
                Перенести
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
