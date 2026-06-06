import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const connection = await prisma.connection.findFirst({
    where: { id, ownerId: userId },
    include: {
      subject: { select: { name: true, avatar: true } },
      notes: { orderBy: { date: 'desc' } },
    },
  })

  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(connection)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.connection.findFirst({ where: { id, ownerId: userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.connection.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
