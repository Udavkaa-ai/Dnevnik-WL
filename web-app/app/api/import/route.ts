import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';

type OldEntry = {
  date: string;
  done?: string | null;
  not_done?: string | null;
  mood_score?: number | null;
  ai_tip?: string | null;
  photo?: string | null;
};

type OldPlan = {
  plan_date?: string | null;
  task_text?: string;
  status?: string;
  moved_to?: string | null;
};

type NewEntry = {
  date: string;
  text?: string;
  moodScore?: number | null;
  photos?: string[];
};

type NewTask = {
  text?: string;
  date?: string | null;
  status?: string;
  movedTo?: string | null;
};

function combineText(done?: string | null, notDone?: string | null): string {
  const parts = [];
  if (done?.trim()) parts.push(done.trim());
  if (notDone?.trim()) parts.push(`Не успел:\n${notDone.trim()}`);
  return parts.join('\n\n');
}

async function parsePayload(file: File): Promise<{ entries: NewEntry[]; tasks: NewTask[] }> {
  const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';

  if (isZip) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const jsonFile = zip.file('diary.json');
    if (!jsonFile) throw new Error('diary.json not found in ZIP');

    const jsonText = await jsonFile.async('string');
    const data = JSON.parse(jsonText);

    // Load photos from ZIP as base64 data URLs
    const photoCache: Record<string, string> = {};
    for (const [path, zipObj] of Object.entries(zip.files)) {
      if (path.startsWith('photos/') && !zipObj.dir) {
        const b64 = await zipObj.async('base64');
        const ext = path.split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        photoCache[path] = `data:${mime};base64,${b64}`;
      }
    }

    const entries: NewEntry[] = (data.entries || []).map((e: OldEntry) => ({
      date: e.date,
      text: combineText(e.done, e.not_done),
      moodScore: e.mood_score ?? null,
      photos: e.photo && photoCache[e.photo] ? [photoCache[e.photo]] : [],
    }));

    const tasks: NewTask[] = (data.plans || []).map((p: OldPlan) => ({
      text: p.task_text || '',
      date: p.plan_date || null,
      status: p.status || 'pending',
      movedTo: p.moved_to || null,
    }));

    return { entries, tasks };
  }

  // Plain JSON — support both web format and old mobile format
  const text = await file.text();
  const data = JSON.parse(text);

  // Web format: { entries, tasks }
  // Old text backup or web format
  const rawEntries: NewEntry[] = Array.isArray(data.entries)
    ? data.entries.map((e: OldEntry & NewEntry) => {
        // If it has 'done' field — old mobile format without zip
        if ('done' in e || 'not_done' in e) {
          return {
            date: e.date,
            text: combineText(e.done, e.not_done),
            moodScore: e.mood_score ?? null,
            photos: [],
          };
        }
        return {
          date: e.date,
          text: e.text || '',
          moodScore: e.moodScore ?? null,
          photos: e.photos || [],
        };
      })
    : [];

  const rawTasks: NewTask[] = Array.isArray(data.tasks)
    ? data.tasks
    : Array.isArray(data.plans)
      ? data.plans.map((p: OldPlan) => ({
          text: p.task_text || '',
          date: p.plan_date || null,
          status: p.status || 'pending',
          movedTo: p.moved_to || null,
        }))
      : [];

  return { entries: rawEntries, tasks: rawTasks };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let entries: NewEntry[] = [];
  let tasks: NewTask[] = [];

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
      ({ entries, tasks } = await parsePayload(file));
    } else {
      // Legacy: JSON body
      const data = await request.json();
      entries = data.entries || [];
      tasks = data.tasks || [];
    }
  } catch (e) {
    console.error('Parse error:', e);
    return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });
  }

  let entriesImported = 0;
  let tasksImported = 0;

  for (const entry of entries) {
    if (!entry.date || !entry.text) continue;
    try {
      await prisma.diaryEntry.upsert({
        where: { userId_date: { userId, date: entry.date } },
        update: { text: entry.text, moodScore: entry.moodScore ?? null, photos: entry.photos ?? [] },
        create: { userId, date: entry.date, text: entry.text, moodScore: entry.moodScore ?? null, photos: entry.photos ?? [] },
      });
      entriesImported++;
    } catch (e) { console.error('Entry import error:', e); }
  }

  for (const task of tasks) {
    if (!task.text) continue;
    try {
      await prisma.plan.create({
        data: { userId, text: task.text, date: task.date ?? null, status: task.status ?? 'pending', movedTo: task.movedTo ?? null },
      });
      tasksImported++;
    } catch (e) { console.error('Task import error:', e); }
  }

  return NextResponse.json({ success: true, entriesImported, tasksImported });
}
