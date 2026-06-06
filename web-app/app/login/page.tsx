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

  const handleLogin = async () => {
    setLoading(true);
    await signIn('yandex', { callbackUrl: '/home' });
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

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl font-semibold text-base transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3"
          style={{ background: '#fc3f1d', color: 'white', boxShadow: '0 4px 20px rgba(252, 63, 29, 0.4)' }}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
              <span>Входим...</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                <path d="M2.04 12c0-5.523 4.476-10 9.998-10C17.522 2 22 6.477 22 12s-4.478 10-10.002 10C6.516 22 2.04 17.523 2.04 12zm7.78-2.007h1.737c.99 0 1.51.49 1.51 1.3v1.43c0 .81-.52 1.3-1.51 1.3H9.82V10h-.001zm-.001 5.5h1.62c1.56 0 2.61-.96 2.61-2.64V12.3c0-1.68-1.05-2.7-2.61-2.7H8.32v5.9h1.5z"/>
              </svg>
              Войти через Яндекс
            </>
          )}
        </button>

        <p className="text-center text-white/50 text-xs mt-6">
          Ваши данные хранятся безопасно и принадлежат только вам
        </p>
      </div>
    </div>
  );
}
