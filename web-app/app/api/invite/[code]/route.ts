import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const conn = await prisma.connection.findUnique({
    where: { inviteCode: code },
    include: { owner: { select: { name: true, avatar: true } } },
  })

  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    nickname: conn.nickname,
    ownerName: conn.owner.name,
    ownerAvatar: conn.owner.avatar,
    accepted: conn.accepted,
  })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params

  const conn = await prisma.connection.findUnique({ where: { inviteCode: code } })
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (conn.accepted) return NextResponse.json({ error: 'Already accepted' }, { status: 400 })
  if (conn.ownerId === userId) {
    return NextResponse.json({ error: 'Cannot accept own invite' }, { status: 400 })
  }

  const updated = await prisma.connection.update({
    where: { inviteCode: code },
    data: { subjectId: userId, accepted: true },
  })

  return NextResponse.json(updated)
}
