/**
 * Backup service — creates and restores ZIP archives containing diary data + photos.
 *
 * ZIP structure:
 *   diary.json      — all entries, plans, recurring tasks, profile
 *   photos/         — photo files named by entry date (e.g. "2024-01-15.jpg")
 *
 * JSON format version 2:
 * {
 *   "version": 2, "app": "dnevnik", "exportedAt": "<ISO>",
 *   "profile": { ... },
 *   "entries": [ { ..., "photo": "photos/2024-01-15.jpg" | null } ],
 *   "plans": [ ... ],
 *   "recurring": [ ... ]
 * }
 */
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { openDatabase } from '../db/database';

const PHOTOS_DIR = FileSystem.documentDirectory + 'diary_photos/';

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Creates a ZIP backup.
 * @param {boolean} withPhotos  Include photos in the archive.
 * @returns {Promise<{ path: string, entryCount: number, photoCount: number }>}
 */
export async function createBackupZip(withPhotos) {
  const db = await openDatabase();

  const user = await db.getFirstAsync('SELECT * FROM users WHERE user_id = 1');
  const entries = await db.getAllAsync(
    'SELECT * FROM entries WHERE user_id = 1 ORDER BY date ASC'
  );
  const plans = await db.getAllAsync(
    'SELECT * FROM plans WHERE user_id = 1 ORDER BY plan_date ASC, id ASC'
  );
  const recurring = await db.getAllAsync(
    'SELECT * FROM recurring_plans WHERE user_id = 1 ORDER BY id ASC'
  );

  const zip = new JSZip();
  let photoCount = 0;

  // Build entries list, optionally reading photos
  const entriesOut = [];
  for (const e of entries) {
    let photoName = null;

    if (withPhotos && e.photo_path) {
      try {
        const info = await FileSystem.getInfoAsync(e.photo_path);
        if (info.exists) {
          const ext = e.photo_path.split('.').pop().toLowerCase() || 'jpg';
          photoName = `photos/${e.date}.${ext}`;
          const photoB64 = await FileSystem.readAsStringAsync(e.photo_path, {
            encoding: FileSystem.EncodingType.Base64,
          });
          zip.file(photoName, photoB64, { base64: true });
          photoCount++;
        }
      } catch (_) {
        // Skip unreadable photo — don't abort the whole backup
      }
    }

    entriesOut.push({
      date: e.date,
      done: e.done ?? null,
      not_done: e.not_done ?? null,
      mood_score: e.mood_score ?? null,
      ai_tip: e.ai_tip ?? null,
      photo: photoName,
    });
  }

  const profile = user
    ? {
        name: user.name,
        gender: user.gender,
        family_status: user.family_status,
        morning_time: user.morning_time,
        evening_time: user.evening_time,
        bio: user.bio,
      }
    : null;

  const plansOut = plans.map(p => ({
    plan_date: p.plan_date,
    task_text: p.task_text,
    status: p.status,
    reason: p.reason ?? null,
    moved_to: p.moved_to ?? null,
    time_start: p.time_start ?? null,
    time_end: p.time_end ?? null,
    reminder_minutes: p.reminder_minutes ?? 0,
  }));

  const recurringOut = recurring.map(r => ({
    task_text: r.task_text,
    recurrence_type: r.recurrence_type,
    recurrence_day: r.recurrence_day ?? null,
    active: r.active ?? 1,
  }));

  const payload = {
    version: 2,
    app: 'dnevnik',
    exportedAt: new Date().toISOString(),
    profile,
    entries: entriesOut,
    plans: plansOut,
    recurring: recurringOut,
  };

  zip.file('diary.json', JSON.stringify(payload, null, 2));

  const zipB64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  const date = new Date().toISOString().split('T')[0];
  const suffix = withPhotos ? '_with_photos' : '';
  const fileName = `diary_backup_${date}${suffix}.zip`;
  const outPath = FileSystem.documentDirectory + fileName;
  await FileSystem.writeAsStringAsync(outPath, zipB64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { path: outPath, entryCount: entries.length, photoCount };
}

// ─── Import ──────────────────────────────────────────────────────────────────

/**
 * Restores data from a ZIP backup.
 * @param {string} zipPath  Local URI to the .zip file.
 * @returns {Promise<{ imported, skipped, total, photosRestored }>}
 */
export async function restoreBackupZip(zipPath) {
  const db = await openDatabase();

  // Load ZIP
  const zipB64 = await FileSystem.readAsStringAsync(zipPath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(zipB64, { base64: true });

  // Parse diary.json
  const jsonFile = zip.file('diary.json');
  if (!jsonFile) throw new Error('Файл diary.json не найден в архиве');
  const jsonText = await jsonFile.async('text');
  const data = JSON.parse(jsonText);

  if (data.app !== 'dnevnik') {
    throw new Error('Это не бэкап приложения «Дневник»');
  }

  // Ensure photos dir exists
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });

  // ── Restore profile ──
  if (data.profile) {
    const p = data.profile;
    await db.runAsync(
      `UPDATE users SET
        name = COALESCE(?, name),
        gender = COALESCE(?, gender),
        family_status = COALESCE(?, family_status),
        morning_time = COALESCE(?, morning_time),
        evening_time = COALESCE(?, evening_time),
        bio = COALESCE(?, bio)
       WHERE user_id = 1`,
      [p.name || null, p.gender || null, p.family_status || null,
       p.morning_time || null, p.evening_time || null, p.bio || null]
    );
  }

  // ── Restore entries ──
  let imported = 0, skipped = 0, photosRestored = 0;
  const total = (data.entries || []).length;

  for (const e of (data.entries || [])) {
    if (!e.date) continue;

    // Restore photo if present in ZIP
    let localPhotoPath = null;
    if (e.photo) {
      const photoFile = zip.file(e.photo);
      if (photoFile) {
        try {
          const ext = e.photo.split('.').pop() || 'jpg';
          const destPath = PHOTOS_DIR + `photo_${e.date}.${ext}`;
          const photoB64 = await photoFile.async('base64');
          await FileSystem.writeAsStringAsync(destPath, photoB64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          localPhotoPath = destPath;
          photosRestored++;
        } catch (_) {
          // Skip photo if can't write — still import the text
        }
      }
    }

    // Upsert: skip if entry already exists (same date)
    const existing = await db.getFirstAsync(
      'SELECT id FROM entries WHERE user_id = 1 AND date = ?',
      [e.date]
    );
    if (existing) {
      skipped++;
      continue;
    }

    await db.runAsync(
      `INSERT INTO entries (user_id, date, done, not_done, mood_score, ai_tip, photo_path)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [e.date, e.done || null, e.not_done || null,
       e.mood_score || null, e.ai_tip || null, localPhotoPath]
    );
    imported++;
  }

  // ── Restore plans ──
  let tasksImported = 0, tasksSkipped = 0;
  for (const p of (data.plans || [])) {
    if (!p.plan_date || !p.task_text) continue;
    const exists = await db.getFirstAsync(
      'SELECT id FROM plans WHERE user_id = 1 AND plan_date = ? AND task_text = ?',
      [p.plan_date, p.task_text]
    );
    if (exists) { tasksSkipped++; continue; }
    await db.runAsync(
      `INSERT INTO plans (user_id, plan_date, task_text, status, reason, moved_to, time_start, time_end, reminder_minutes)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.plan_date, p.task_text, p.status || 'pending',
       p.reason || null, p.moved_to || null,
       p.time_start || null, p.time_end || null, p.reminder_minutes || 0]
    );
    tasksImported++;
  }

  // ── Restore recurring ──
  let recurringImported = 0;
  for (const r of (data.recurring || [])) {
    if (!r.task_text || !r.recurrence_type) continue;
    const exists = await db.getFirstAsync(
      'SELECT id FROM recurring_plans WHERE user_id = 1 AND task_text = ? AND recurrence_type = ?',
      [r.task_text, r.recurrence_type]
    );
    if (!exists) {
      await db.runAsync(
        'INSERT INTO recurring_plans (user_id, task_text, recurrence_type, recurrence_day, active) VALUES (1, ?, ?, ?, ?)',
        [r.task_text, r.recurrence_type, r.recurrence_day ?? null, r.active ?? 1]
      );
      recurringImported++;
    }
  }

  return {
    imported,
    skipped,
    total,
    photosRestored,
    tasksImported,
    tasksSkipped,
    recurringImported,
  };
}
