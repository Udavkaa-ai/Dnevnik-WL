import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTodayString, addDays } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      analysis: 'API ключ для AI анализа не настроен. Добавьте ANTHROPIC_API_KEY в переменные окружения.',
    });
  }

  const today = getTodayString();
  const weekAgo = addDays(today, -7);

  const [recentEntries, tasks] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId, date: { gte: weekAgo, lte: today } },
      orderBy: { date: 'desc' },
      take: 7,
    }),
    prisma.plan.findMany({
      where: { userId, date: { gte: weekAgo, lte: today } },
      orderBy: { date: 'asc' },
    }),
  ]);

  const body = await request.json().catch(() => ({}));
  const customPrompt = body.prompt;

  const entriesText = recentEntries
    .map((e) => `[${e.date}] Настроение: ${e.moodScore || 'не указано'}/10\n${e.text}`)
    .join('\n\n');

  const tasksText = tasks
    .map((t) => `- ${t.text} [${t.status}] (${t.date || 'без даты'})`)
    .join('\n');

  const prompt = customPrompt || `Проанализируй мои записи за последнюю неделю и дай краткий психологический анализ моего состояния. Выдели основные паттерны настроения и продуктивности. Дай 2-3 практических совета.

Записи дневника:
${entriesText || 'Нет записей за этот период'}

Задачи:
${tasksText || 'Нет задач за этот период'}

Ответь на русском языке, кратко и по делу (3-5 предложений).`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.content?.[0]?.text || 'Не удалось получить анализ';

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({
      analysis: 'Не удалось получить AI анализ. Попробуйте позже.',
    });
  }
}
