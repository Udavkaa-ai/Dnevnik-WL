'use client';

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useState } from 'react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export default function AppHeader({ title, subtitle }: AppHeaderProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = session?.user as
    | { name?: string | null; email?: string | null; image?: string | null; id?: string }
    | undefined;

  return (
    <header className="app-header">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-blue-100 opacity-80">{subtitle}</p>}
        </div>
        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full p-1 hover:bg-white/10 transition-colors"
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || 'User'}
                  width={36}
                  height={36}
                  className="rounded-full border-2 border-white/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold">
                  {(user.name || 'U')[0].toUpperCase()}
                </div>
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 min-w-[180px] z-50">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.name || 'Пользователь'}
                  </p>
                  {user.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: '/login' });
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Выйти
                </button>
              </div>
            )}
            {menuOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}
