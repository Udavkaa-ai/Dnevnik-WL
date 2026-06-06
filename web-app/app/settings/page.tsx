'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import Image from 'next/image';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dnevnik-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка при экспорте');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      setImportResult('');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/import', { method: 'POST', body: formData });
        const result = await res.json();

        if (result.success) {
          setImportResult(`Импортировано: ${result.entriesImported} записей, ${result.tasksImported} задач`);
        } else {
          setImportResult(`Ошибка: ${result.error || 'неверный формат'}`);
        }
      } catch {
        setImportResult('Ошибка при чтении файла');
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null; id?: string; provider?: string } | undefined;
  const providerLabel = user?.provider === 'google' ? 'Google аккаунт' : 'Яндекс аккаунт';

  if (status === 'loading') {
    return (
      <div className="app-shell">
        <AppHeader title="Настройки" />
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader title="Настройки" />

      <div className="page-content">
        {/* User profile */}
        {user && (
          <div className="card p-4 mb-4 flex items-center gap-4">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || 'User'}
                width={56}
                height={56}
                className="rounded-full border-2 border-gray-100 dark:border-gray-700 object-cover"
                style={{ width: 56, height: 56 }}
              />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
              >
                {(user.name || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {user.name || 'Пользователь'}
              </p>
              {user.email && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {providerLabel}
              </p>
            </div>
          </div>
        )}

        {/* Appearance */}
        <div className="section-header">Внешний вид</div>
        <div className="card mb-4">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                <span className="text-xl">{darkMode ? '🌙' : '☀️'}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Тёмная тема
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {darkMode ? 'Включена' : 'Выключена'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                darkMode ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Data */}
        <div className="section-header">Данные</div>
        <div className="card mb-4 overflow-hidden">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 dark:bg-green-900/30">
              <span className="text-xl">📤</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {exporting ? 'Экспорт...' : 'Экспорт данных'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Скачать резервную копию JSON
              </p>
            </div>
            <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="border-t border-gray-100 dark:border-gray-700" />

          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
              <span className="text-xl">📥</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {importing ? 'Импорт...' : 'Импорт данных'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Восстановить из резервной копии
              </p>
            </div>
            <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {importResult && (
            <div className={`px-4 pb-3 text-sm ${
              importResult.includes('Успешно')
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-500 dark:text-red-400'
            }`}>
              {importResult}
            </div>
          )}
        </div>

        {/* About */}
        <div className="section-header">О приложении</div>
        <div className="card mb-4 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
            >
              <span className="text-2xl">📔</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Дневник</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Версия 1.0</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Личный дневник и планировщик с AI анализом. Ваши данные хранятся безопасно
            и принадлежат только вам.
          </p>
        </div>

        {/* PWA Install hint */}
        <div className="card mb-4 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Установить приложение
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Добавьте Дневник на главный экран: нажмите «Поделиться» → «На экран Домой» в Safari
                или меню браузера
              </p>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full py-4 rounded-2xl font-semibold text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mb-4"
        >
          Выйти из аккаунта
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
