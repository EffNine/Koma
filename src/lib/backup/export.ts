import { db } from '../db';
import type { Source } from '../scraper/sources';
import type { TitlePreference } from '../media/titlePreferences';
import type { TrackedTitle, ChapterRead, ProgressEntry } from '../tracker/local';
import type { ReaderState } from '../reader/state';
import type { ReaderSettings } from '../reader/settings';
import type { TrackerConnection } from '../tracker/adapters/base';

export interface BackupData {
  version: 1;
  exportedAt: number;
  sources: Source[];
  titlePreferences: TitlePreference[];
  trackedTitles: TrackedTitle[];
  chapterReads: ChapterRead[];
  progress: ProgressEntry[];
  readerState: ReaderState[];
  readerSettings: ReaderSettings[];
  trackerConnections: TrackerConnection[];
}

export async function exportBackup(): Promise<BackupData> {
  const [sources, titlePreferences, trackedTitles, chapterReads, progress, readerState, readerSettings, trackerConnections] = await Promise.all([
    db.sources.toArray(),
    db.titlePreferences.toArray(),
    db.trackedTitles.toArray(),
    db.chapterReads.toArray(),
    db.progress.toArray(),
    db.readerState.toArray(),
    db.readerSettings.toArray(),
    db.trackerConnections.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: Date.now(),
    sources,
    titlePreferences,
    trackedTitles,
    chapterReads,
    progress,
    readerState,
    readerSettings,
    trackerConnections,
  };
}

export async function importBackup(data: BackupData): Promise<{ imported: string[]; skipped: string[] }> {
  const imported: string[] = [];
  const skipped: string[] = [];

  if (data.version !== 1) {
    throw new Error(`Unsupported backup version: ${data.version}`);
  }

  // Import sources
  if (data.sources?.length) {
    let count = 0;
    for (const source of data.sources) {
      const existing = await db.sources.get(source.id);
      if (!existing) {
        await db.sources.put(source);
        count++;
      } else {
        skipped.push(`source:${source.id}`);
      }
    }
    if (count > 0) imported.push(`${count} sources`);
  }

  // Import title preferences (merge by mediaId, keep newest updatedAt)
  if (data.titlePreferences?.length) {
    let count = 0;
    for (const pref of data.titlePreferences) {
      const existing = await db.titlePreferences.get(pref.mediaId);
      if (!existing || (existing.updatedAt ?? 0) < (pref.updatedAt ?? 0)) {
        await db.titlePreferences.put(pref);
        count++;
      } else {
        skipped.push(`titlePreference:${pref.mediaId}`);
      }
    }
    if (count > 0) imported.push(`${count} title preferences`);
  }

  // Import tracked titles (merge by mediaId, keep newest updatedAt)
  if (data.trackedTitles?.length) {
    let count = 0;
    for (const title of data.trackedTitles) {
      const existing = await db.trackedTitles.get(title.mediaId);
      if (!existing || (existing.updatedAt ?? 0) < (title.updatedAt ?? 0)) {
        await db.trackedTitles.put(title);
        count++;
      } else {
        skipped.push(`trackedTitle:${title.mediaId}`);
      }
    }
    if (count > 0) imported.push(`${count} tracked titles`);
  }

  // Import chapter reads (merge by key, keep newest readAt)
  if (data.chapterReads?.length) {
    let count = 0;
    for (const read of data.chapterReads) {
      const existing = await db.chapterReads.get(read.key);
      if (!existing || existing.readAt < read.readAt) {
        await db.chapterReads.put(read);
        count++;
      } else {
        skipped.push(`chapterRead:${read.key}`);
      }
    }
    if (count > 0) imported.push(`${count} chapter reads`);
  }

  // Import progress (merge by key, keep newest updatedAt)
  if (data.progress?.length) {
    let count = 0;
    for (const entry of data.progress) {
      const existing = await db.progress.get(entry.key);
      if (!existing || existing.updatedAt < entry.updatedAt) {
        await db.progress.put(entry);
        count++;
      } else {
        skipped.push(`progress:${entry.key}`);
      }
    }
    if (count > 0) imported.push(`${count} progress entries`);
  }

  // Import reader state (merge by key, keep newest updatedAt)
  if (data.readerState?.length) {
    let count = 0;
    for (const state of data.readerState) {
      const existing = await db.readerState.get(state.key);
      if (!existing || existing.updatedAt < state.updatedAt) {
        await db.readerState.put(state);
        count++;
      } else {
        skipped.push(`readerState:${state.key}`);
      }
    }
    if (count > 0) imported.push(`${count} reader states`);
  }

  // Import reader settings (overwrite)
  if (data.readerSettings?.length) {
    for (const s of data.readerSettings) {
      await db.readerSettings.put(s);
    }
    imported.push(`${data.readerSettings.length} reader settings`);
  }

  // Import tracker connections (merge by id, keep newest updatedAt)
  if (data.trackerConnections?.length) {
    let count = 0;
    for (const conn of data.trackerConnections) {
      const existing = await db.trackerConnections.get(conn.id);
      if (!existing || (existing.updatedAt ?? 0) < (conn.updatedAt ?? 0)) {
        await db.trackerConnections.put(conn);
        count++;
      } else {
        skipped.push(`trackerConnection:${conn.id}`);
      }
    }
    if (count > 0) imported.push(`${count} tracker connections`);
  }

  return { imported, skipped };
}

export function downloadBackup(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `koma-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
