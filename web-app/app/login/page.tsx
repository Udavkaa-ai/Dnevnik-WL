'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace('/home');
    }
  }, [session, router]);

  const handleLogin = async (provider: 'yandex' | 'google') => {
    setLoading(true);
    await signIn(provider, { callbackUrl: '/home' });
  };

  if (status === 'loading' || session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3d6b8e 0%, #1e3a5f 100%)' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(135deg, #3d6b8e 0%, #1e3a5f 100%)' }}
    >
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 shadow-xl">
            <span className="text-5xl">📔</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Дневник</h1>
          <p className="text-blue-100/80 text-base">Личный дневник и планировщик</p>
        </div>

        {/* Features */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-8 space-y-3">
          {[
            { icon: '✍️', text: 'Ведите дневник каждый день' },
            { icon: '✅', text: 'Управляйте задачами и планами' },
            { icon: '📊', text: 'Отслеживайте настроение и прогресс' },
            { icon: '🤖', text: 'AI анализ ваших записей' },
          ].map((feature) => (
            <div key={feature.text} className="flex items-center gap-3">
              <span className="text-xl">{feature.icon}</span>
              <span className="text-white/90 text-sm">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Login buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleLogin('google')}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl font-semibold text-base transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3 bg-white text-gray-700"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Войти через Google
          </button>

          <button
            onClick={() => handleLogin('yandex')}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl font-semibold text-base transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3"
            style={{ background: '#fc3f1d', color: 'white', boxShadow: '0 4px 20px rgba(252, 63, 29, 0.4)' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M13.832 11.784L18.6 4.5H16.5l-3.6 5.4L9.3 4.5H7.2l4.776 7.284L7.2 19.5h2.1l3.9-5.85 3.9 5.85H19.2l-5.368-7.716z"/>
            </svg>
            Войти через Яндекс
          </button>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          Ваши данные хранятся безопасно и принадлежат только вам
        </p>
      </div>
    </div>
  );
}
