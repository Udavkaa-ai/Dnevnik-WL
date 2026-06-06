import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connections = await prisma.connection.findMany({
    where: { subjectId: userId, accepted: true },
    include: {
      owner: { select: { name: true, avatar: true } },
      notes: { where: { isShared: true }, orderBy: { date: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(connections)
}
