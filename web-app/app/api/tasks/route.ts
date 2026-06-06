import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user) return null;
  return (session.user as typeof session.user & { id?: string }).id ?? null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const status = searchParams.get('status');

  const where: {
    userId: string;
    date?: string | null;
    status?: string;
  } = { userId };

  if (date !== null && date !== undefined) {
    where.date = date === 'null' ? null : date;
  }
  if (status) {
    where.status = status;
  }

  const tasks = await prisma.plan.findMany({
    where,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { text, date } = body;

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const task = await prisma.plan.create({
    data: {
      userId,
      text,
      date: date || null,
      status: 'pending',
    },
  });

  return NextResponse.json(task, { status: 201 });
}
