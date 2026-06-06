'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import BottomNav from '@/components/BottomNav'

interface PersonNote {
  id: number
  text: string
  date: string
  isShared: boolean
}

interface ConnectionWithNotes {
  id: string
  nickname: string
  inviteCode: string
  accepted: boolean
  subject: { name: string | null; avatar: string | null } | null
  owner: { name: string | null; avatar: string | null }
  notes: PersonNote[]
  _count?: { notes: number }
}

interface OwnedConnection {
  id: string
  nickname: string
  inviteCode: string
  accepted: boolean
  subject: { name: string | null; avatar: string | null } | null
  _count: { notes: number }
}

export default function PeoplePage() {
  const { status } = useSession()
  const router = useRouter()
  const [connections, setConnections] = useState<OwnedConnection[]>([])
  const [aboutMe, setAboutMe] = useState<ConnectionWithNotes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [connRes, meRes] = await Promise.all([
        fetch('/api/people'),
        fetch('/api/me/notes'),
      ])
      const connData = await connRes.json()
      const meData = await meRes.json()
      setConnections(Array.isArray(connData) ? connData : [])
      setAboutMe(Array.isArray(meData) ? meData : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') loadData()
  }, [status, loadData])

  if (status === 'loading' || loading) {
    return (
      <div className="app-shell">
        <AppHeader title="Близкие" />
        <div className="page-content flex items-center justify-center">
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    )
  }

  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Ссылка скопирована!')
    })
  }

  return (
    <div className="app-shell">
      <AppHeader title="Близкие" subtitle={connections.length > 0 ? `${connections.length} связей` : 'Добавьте близких'} />

      <div className="page-content">
        {/* Мои близкие */}
        <div className="flex items-center justify-between mb-2">
          <div className="section-header" style={{ margin: 0 }}>Мои близкие</div>
          <Link
            href="/people/new"
            className="text-sm font-medium px-3 py-1.5 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
          >
            + Добавить
          </Link>
        </div>

        {connections.length === 0 ? (
          <div className="card p-6 mb-4 text-center">
            <div className="text-4xl mb-3">💑</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Нет связей
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Добавьте близких людей и делитесь с ними заметками
            </p>
            <Link
              href="/people/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
            >
              Добавить близкого
            </Link>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {connections.map((conn) => (
              <div key={conn.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <Link href={`/people/${conn.id}`} className="flex items-center gap-3 flex-1">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
                    >
                      {conn.subject?.avatar ? (
                        <img src={conn.subject.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        conn.nickname[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {conn.nickname}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {conn.accepted
                          ? conn.subject?.name
                            ? `Связан: ${conn.subject.name}`
                            : 'Приглашение принято'
                          : 'Ожидает принятия'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {conn._count.notes} заметок
                      </p>
                    </div>
                  </Link>
                  {!conn.accepted && (
                    <button
                      onClick={() => copyInviteLink(conn.inviteCode)}
                      className="flex-shrink-0 p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Скопировать ссылку-приглашение"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Обо мне */}
        {aboutMe.length > 0 && (
          <>
            <div className="section-header">Обо мне</div>
            <div className="space-y-2 mb-4">
              {aboutMe.map((conn) => (
                <Link key={conn.id} href={`/people/${conn.id}/about-me`} className="card p-4 flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #5a8ab5, #3d6b8e)' }}
                  >
                    {conn.owner.avatar ? (
                      <img src={conn.owner.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      (conn.owner.name || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {conn.owner.name || 'Пользователь'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {conn.notes.length > 0
                        ? `${conn.notes.length} заметок обо мне`
                        : 'Пока нет заметок обо мне'}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
