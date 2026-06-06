'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import BottomNav from '@/components/BottomNav'

export default function NewPersonPage() {
  const { status } = useSession()
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ id: string; inviteCode: string; nickname: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  if (status === 'unauthenticated') {
    router.replace('/login')
    return null
  }

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError('Введите имя или прозвище')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })
      if (res.ok) {
        const conn = await res.json()
        setCreated(conn)
      } else {
        const data = await res.json()
        setError(data.error || 'Ошибка при создании')
      }
    } catch {
      setError('Ошибка при создании')
    } finally {
      setSaving(false)
    }
  }

  const inviteUrl = created
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${created.inviteCode}`
    : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = inviteUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white flex-1">Добавить близкого</h1>
        </div>
      </div>

      <div className="page-content">
        {!created ? (
          <>
            <div className="card p-4 mb-4">
              <div className="text-center mb-6 mt-2">
                <div className="text-5xl mb-3">💑</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Создайте связь с близким человеком. После создания вы получите ссылку-приглашение,
                  которую нужно отправить ему.
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Как вы называете этого человека?
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Например: Маша, Мама, Друг..."
                autoFocus
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white dark:bg-gray-700 outline-none focus:border-blue-400 mb-4"
              />

              {error && (
                <p className="text-sm text-red-500 mb-3">{error}</p>
              )}

              <button
                onClick={handleCreate}
                disabled={saving || !nickname.trim()}
                className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
              >
                {saving ? 'Создание...' : 'Создать и получить ссылку'}
              </button>
            </div>
          </>
        ) : (
          <div className="card p-6 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Связь создана!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Отправьте эту ссылку <strong>{created.nickname}</strong>, чтобы они приняли приглашение
            </p>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-4 break-all text-xs text-gray-600 dark:text-gray-300 font-mono">
              {inviteUrl}
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-3 rounded-xl text-white font-medium transition-all active:scale-95 mb-3"
              style={{ background: copied ? '#22c55e' : 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
            >
              {copied ? '✓ Скопировано!' : 'Скопировать ссылку'}
            </button>

            <button
              onClick={() => router.push(`/people/${created.id}`)}
              className="w-full py-3 rounded-xl font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Открыть страницу
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
