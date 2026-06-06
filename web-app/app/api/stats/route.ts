import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toDateString } from '@/lib/utils';

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
  const days = parseInt(searchParams.get('days') || '7');

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days + 1);
  const startDateStr = toDateString(startDate);
  const todayStr = toDateString(today);

  // Mood data
  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId,
      date: { gte: startDateStr, lte: todayStr },
    },
    select: { date: true, moodScore: true },
    orderBy: { date: 'asc' },
  });

  // Build full date range with mood data
  const moodData: { date: string; mood: number | null }[] = [];
  const entriesMap = new Map(entries.map((e) => [e.date, e.moodScore]));

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = toDateString(d);
    moodData.push({
      date: dateStr,
      mood: entriesMap.get(dateStr) ?? null,
    });
  }

  // Task stats
  const allTasks = await prisma.plan.findMany({
    where: {
      userId,
      date: { gte: startDateStr, lte: todayStr },
    },
    select: { status: true, date: true },
  });

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === 'done').length;
  const pendingTasks = allTasks.filter((t) => t.status === 'pending').length;
  const cancelledTasks = allTasks.filter((t) => t.status === 'cancelled').length;
  const movedTasks = allTasks.filter((t) => t.status === 'moved').length;

  // Average mood
  const moodEntries = entries.filter((e) => e.moodScore !== null);
  const avgMood =
    moodEntries.length > 0
      ? moodEntries.reduce((sum, e) => sum + (e.moodScore ?? 0), 0) / moodEntries.length
      : null;

  // Total diary entries count
  const totalEntries = await prisma.diaryEntry.count({ where: { userId } });

  return NextResponse.json({
    moodData,
    taskStats: {
      total: totalTasks,
      done: doneTasks,
      pending: pendingTasks,
      cancelled: cancelledTasks,
      moved: movedTasks,
      completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    },
    avgMood: avgMood !== null ? Math.round(avgMood * 10) / 10 : null,
    totalEntries,
  });
}
