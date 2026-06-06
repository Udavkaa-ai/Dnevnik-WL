'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import BottomNav from '@/components/BottomNav'
import { formatDate } from '@/lib/utils'

interface PersonNote {
  id: number
  text: string
  date: string
  isShared: boolean
}

interface ConnectionWithNotes {
  id: string
  nickname: string
  owner: { name: string | null; avatar: string | null }
  notes: PersonNote[]
}

export default function AboutMePage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [connection, setConnection] = useState<ConnectionWithNotes | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load from /api/me/notes to get connections where we are the subject
      const res = await fetch('/api/me/notes')
      if (res.ok) {
        const data: ConnectionWithNotes[] = await res.json()
        const found = data.find((c) => c.id === id)
        if (found) {
          setConnection(found)
        } else {
          router.replace('/people')
        }
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
    if (status === 'authenticated') loadData()
  }, [status, loadData])

  if (loading || status === 'loading') {
    return (
      <div className="app-shell">
        <AppHeader title="Обо мне" />
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!connection) return null

  const sharedNotes = connection.notes.filter((n) => n.isShared)

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white flex-1">Обо мне</h1>
        </div>
      </div>

      <div className="page-content">
        {/* Who wrote */}
        <div className="card p-4 mb-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5a8ab5, #3d6b8e)' }}
          >
            {connection.owner.avatar ? (
              <img src={connection.owner.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              (connection.owner.name || '?')[0].toUpperCase()
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {connection.owner.name || 'Пользователь'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Записки обо мне · {sharedNotes.length} заметок
            </p>
          </div>
        </div>

        {sharedNotes.length === 0 ? (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-3">💭</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Пока нет заметок обо вас
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {connection.owner.name || 'Ваш близкий'} пока не поделился(ась) заметками с вами
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sharedNotes.map((note) => (
              <div key={note.id} className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {formatDate(note.date)}
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {note.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
