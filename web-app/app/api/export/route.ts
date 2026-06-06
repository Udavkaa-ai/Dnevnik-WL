import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [user, entries, tasks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.diaryEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.plan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    user: {
      name: user?.name,
      email: user?.email,
    },
    entries,
    tasks,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="dnevnik-backup-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}
