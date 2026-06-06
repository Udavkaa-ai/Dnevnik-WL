'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'

interface InviteInfo {
  nickname: string
  ownerName: string | null
  ownerAvatar: string | null
  accepted: boolean
}

export default function InvitePage() {
  const { code } = useParams() as { code: string }
  const { data: session, status } = useSession()
  const router = useRouter()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error === 'Not found' ? 'Ссылка-приглашение не найдена' : data.error)
        } else {
          setInfo(data)
        }
      })
      .catch(() => setError('Не удалось загрузить информацию о приглашении'))
      .finally(() => setLoading(false))
  }, [code])

  const accept = async () => {
    setAccepting(true)
    setError('')
    try {
      const res = await fetch(`/api/invite/${code}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/people'), 1500)
      } else {
        setError(
          data.error === 'Already accepted'
            ? 'Это приглашение уже было принято'
            : data.error === 'Cannot accept own invite'
            ? 'Нельзя принять собственное приглашение'
            : data.error || 'Ошибка при принятии'
        )
      }
    } catch {
      setError('Ошибка при принятии приглашения')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
      >
        <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
      </div>
    )
  }

  if (error && !info) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
      >
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
      >
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Приглашение принято!</h1>
          <p className="text-sm text-gray-500">Переходим на страницу близких...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">💑</div>
          {info?.ownerAvatar ? (
            <img
              src={info.ownerAvatar}
              alt=""
              className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-blue-200"
            />
          ) : null}
          <h1 className="text-xl font-bold text-gray-900">
            {info?.ownerName || 'Пользователь'} приглашает вас
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Приглашение: <strong className="text-gray-700">{info?.nickname}</strong>
          </p>
          {info?.accepted && (
            <div className="mt-2 px-3 py-1 bg-gray-100 rounded-full inline-block">
              <p className="text-xs text-gray-500">Это приглашение уже принято</p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center mb-4">{error}</p>
        )}

        {!info?.accepted && (
          <>
            {status === 'authenticated' ? (
              <button
                onClick={accept}
                disabled={accepting}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #3d6b8e, #2d5070)' }}
              >
                {accepting ? 'Принимаем...' : 'Принять приглашение'}
              </button>
            ) : status === 'loading' ? (
              <div className="flex justify-center py-3">
                <div className="spinner" />
              </div>
            ) : (
              <button
                onClick={() => signIn('yandex', { callbackUrl: `/invite/${code}` })}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 flex items-center justify-center gap-3"
                style={{ background: '#FC3F1D' }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0">
                  <path d="M13.832 11.784L18.6 4.5H16.5l-3.6 5.4L9.3 4.5H7.2l4.776 7.284L7.2 19.5h2.1l3.9-5.85 3.9 5.85H19.2l-5.368-7.716z"/>
                </svg>
                Войти через Яндекс и принять
              </button>
            )}
          </>
        )}

        {session && !info?.accepted && (
          <p className="text-xs text-center text-gray-400 mt-3">
            Вы вошли как <span className="font-medium">{session.user?.name}</span>
          </p>
        )}
      </div>
    </div>
  )
}
