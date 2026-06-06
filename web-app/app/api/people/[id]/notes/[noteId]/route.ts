import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, noteId } = await params

  // Verify ownership of the connection
  const conn = await prisma.connection.findFirst({ where: { id, ownerId: userId } })
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.personNote.findFirst({
    where: { id: parseInt(noteId), connectionId: id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { text, isShared } = body

  const note = await prisma.personNote.update({
    where: { id: parseInt(noteId) },
    data: {
      text: text !== undefined ? text : existing.text,
      isShared: isShared !== undefined ? isShared : existing.isShared,
    },
  })

  return NextResponse.json(note)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, noteId } = await params

  // Verify ownership of the connection
  const conn = await prisma.connection.findFirst({ where: { id, ownerId: userId } })
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.personNote.deleteMany({
    where: { id: parseInt(noteId), connectionId: id },
  })

  return NextResponse.json({ ok: true })
}
