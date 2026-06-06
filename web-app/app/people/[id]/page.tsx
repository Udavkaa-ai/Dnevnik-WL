'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import BottomNav from '@/components/BottomNav'
import { getTodayString, formatDate } from '@/lib/utils'

interface PersonNote {
  id: number
  text: string
  date: string
  isShared: boolean
  createdAt: string
}

interface Connection {
  id: string
  nickname: string
  inviteCode: string
  accepted: boolean
  subject: { name: string | null; avatar: string | null } | null
  notes: PersonNote[]
}

export default function PersonPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [connection, setConnection] = useState<Connection | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddNote, setShowAddNote] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteDate, setNewNoteDate] = useState(getTodayString())
  const [newNoteShared, setNewNoteShared] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const loadConnection = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/people/${id}`)
      if (res.ok) {
        const data = await res.json()
        setConnection(data)
      } else {
        router.replace('/people')
      }
    } catch {
      router.replace('/people')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    if (status === 'authenticated') loadConnection()
  }, [status, loadConnection])

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !newNoteDate) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/people/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newNoteText.trim(),
          date: newNoteDate,
          isShared: newNoteShared,
        }),
      })
      if (res.ok) {
        const note = await res.json()
        setConnection((prev) =>
          prev ? { ...prev, notes: [note, ...prev.notes] } : prev
        )
        setNewNoteText('')
        setNewNoteDate(getTodayString())
        setNewNoteShared(false)
        setShowAddNote(false)
      }
    } finally {
      setSavingNote(false)
    }
  }

  const handleToggleShared = async (note: PersonNote) => {
    const res = await fetch(`/api/people/${id}/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isShared: !note.isShared }),
    })
    if (res.ok) {
      const updated = await res.json()
      setConnection((prev) =>
        prev
          ? { ...prev, notes: prev.notes.map((n) => (n.id === note.id ? updated : n)) }
          : prev
      )
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Удалить эту заметку?')) return
    await fetch(`/api/people/${id}/notes/${noteId}`, { method: 'DELETE' })
    setConnection((prev) =>
      prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev
    )
  }

  const handleDeleteConnection = async () => {
    if (!confirm(`Удалить связь с ${connection?.nickname}? Все заметки будут удалены.`)) return
    await fetch(`/api/people/${id}`, { method: 'DELETE' })
    router.replace('/people')
  }

  const copyInviteLink = async () => {
    if (!connection) return
    const url = `${window.location.origin}/invite/${connection.inviteCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(url)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="app-shell">
        <AppHeader title="Близкий" />
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!connection) return null

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white flex-1">{connection.nickname}</h1>
          <button
            onClick={handleDeleteConnection}
            className="p-2 rounded-xl text-white/70 hover:text-red-300 hover:bg-white/10 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Status card */}
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
            >
              {connection.subject?.avatar ? (
                <img src={connection.subject.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                connection.nickname[0].toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                {connection.nickname}
              </p>
              {connection.accepted ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Связан{connection.subject?.name ? ` с ${connection.subject.name}` : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Ожидает принятия
                    </p>
                  </div>
                  <button
                    onClick={copyInviteLink}
                    className="mt-2 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                    style={{ background: copied ? '#22c55e' : 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
                  >
                    {copied ? '✓ Скопировано!' : 'Скопировать ссылку-приглашение'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes header */}
        <div className="flex items-center justify-between mb-2">
          <div className="section-header" style={{ margin: 0 }}>
            Заметки ({connection.notes.length})
          </div>
          <button
            onClick={() => setShowAddNote(true)}
            className="text-sm font-medium px-3 py-1.5 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
          >
            + Новая
          </button>
        </div>

        {connection.notes.length === 0 && (
          <div className="card p-6 text-center mb-4">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Нет заметок. Добавьте первую заметку о {connection.nickname}
            </p>
          </div>
        )}

        {/* Notes list */}
        <div className="space-y-2 mb-4">
          {connection.notes.map((note) => (
            <div key={note.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(note.date)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleShared(note)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                      note.isShared
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {note.isShared ? '👁 Видна им' : '🔒 Скрыта'}
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {note.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Add note modal */}
      {showAddNote && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddNote(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-t-2xl p-6 w-full max-w-[480px] fade-in">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Новая заметка о {connection.nickname}
            </h3>

            <div className="mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Дата</label>
              <input
                type="date"
                value={newNoteDate}
                onChange={(e) => setNewNoteDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:text-white outline-none focus:border-blue-400"
              />
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Заметка</label>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder={`Что хотите записать о ${connection.nickname}?`}
                rows={4}
                autoFocus
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:text-white outline-none focus:border-blue-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-between mb-4 py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Показать {connection.nickname}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {newNoteShared ? 'Заметка будет видна им' : 'Только для вас'}
                </p>
              </div>
              <button
                onClick={() => setNewNoteShared(!newNoteShared)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  newNoteShared ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    newNoteShared ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddNote(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleAddNote}
                disabled={savingNote || !newNoteText.trim()}
                className="flex-1 py-3 rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
              >
                {savingNote ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
