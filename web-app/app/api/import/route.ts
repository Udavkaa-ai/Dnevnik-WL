import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user) return null;
  return (session.user as typeof session.user & { id?: string }).id ?? null;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let data: {
    entries?: Array<{
      date: string;
      text: string;
      moodScore?: number | null;
      photos?: string[];
    }>;
    tasks?: Array<{
      text: string;
      date?: string | null;
      status?: string;
      movedTo?: string | null;
    }>;
  };

  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let entriesImported = 0;
  let tasksImported = 0;

  // Import diary entries
  if (Array.isArray(data.entries)) {
    for (const entry of data.entries) {
      if (!entry.date || !entry.text) continue;
      try {
        await prisma.diaryEntry.upsert({
          where: { userId_date: { userId, date: entry.date } },
          update: {
            text: entry.text,
            moodScore: entry.moodScore ?? null,
            photos: entry.photos ?? [],
          },
          create: {
            userId,
            date: entry.date,
            text: entry.text,
            moodScore: entry.moodScore ?? null,
            photos: entry.photos ?? [],
          },
        });
        entriesImported++;
      } catch (e) {
        console.error('Error importing entry:', e);
      }
    }
  }

  // Import tasks
  if (Array.isArray(data.tasks)) {
    for (const task of data.tasks) {
      if (!task.text) continue;
      try {
        await prisma.plan.create({
          data: {
            userId,
            text: task.text,
            date: task.date ?? null,
            status: task.status ?? 'pending',
            movedTo: task.movedTo ?? null,
          },
        });
        tasksImported++;
      } catch (e) {
        console.error('Error importing task:', e);
      }
    }
  }

  return NextResponse.json({
    success: true,
    entriesImported,
    tasksImported,
  });
}
