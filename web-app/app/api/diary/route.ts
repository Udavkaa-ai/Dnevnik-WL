import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const month = searchParams.get('month'); // YYYY-MM

  const where: { userId: string; date?: { startsWith: string } } = { userId };
  if (month) {
    where.date = { startsWith: month };
  }

  const entries = await prisma.diaryEntry.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.diaryEntry.count({ where });

  return NextResponse.json({ entries, total });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { date, text, moodScore, photos } = body;

  if (!date || !text) {
    return NextResponse.json({ error: 'date and text are required' }, { status: 400 });
  }

  const entry = await prisma.diaryEntry.upsert({
    where: { userId_date: { userId, date } },
    update: {
      text,
      moodScore: moodScore ?? null,
      photos: photos ?? [],
    },
    create: {
      userId,
      date,
      text,
      moodScore: moodScore ?? null,
      photos: photos ?? [],
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
