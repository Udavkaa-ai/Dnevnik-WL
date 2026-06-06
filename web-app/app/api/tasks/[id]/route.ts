import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, date, text, movedTo } = body;

  const existing = await prisma.plan.findFirst({
    where: { id: parseInt(id), userId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const task = await prisma.plan.update({
    where: { id: parseInt(id) },
    data: {
      status: status ?? existing.status,
      date: date !== undefined ? date : existing.date,
      text: text ?? existing.text,
      movedTo: movedTo !== undefined ? movedTo : existing.movedTo,
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.plan.findFirst({
    where: { id: parseInt(id), userId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.plan.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ success: true });
}
