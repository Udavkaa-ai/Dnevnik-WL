import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connections = await prisma.connection.findMany({
    where: { ownerId: userId },
    include: {
      subject: { select: { name: true, avatar: true } },
      _count: { select: { notes: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(connections)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nickname } = await req.json()
  if (!nickname?.trim()) {
    return NextResponse.json({ error: 'nickname is required' }, { status: 400 })
  }

  const connection = await prisma.connection.create({
    data: { ownerId: userId, nickname: nickname.trim() },
  })

  return NextResponse.json(connection, { status: 201 })
}
