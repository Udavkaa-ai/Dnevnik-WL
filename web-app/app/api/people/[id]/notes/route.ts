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

  const conn = await prisma.connection.findFirst({ where: { id, ownerId: userId } })
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const notes = await prisma.personNote.findMany({
    where: { connectionId: id },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(notes)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const conn = await prisma.connection.findFirst({ where: { id, ownerId: userId } })
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { text, date, isShared } = await req.json()
  if (!text?.trim() || !date) {
    return NextResponse.json({ error: 'text and date are required' }, { status: 400 })
  }

  const note = await prisma.personNote.create({
    data: {
      connectionId: id,
      authorId: userId,
      text: text.trim(),
      date,
      isShared: isShared ?? false,
    },
  })

  return NextResponse.json(note, { status: 201 })
}
