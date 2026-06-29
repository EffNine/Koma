import Dexie, { type Table } from 'dexie';
import type { Source } from './scraper/sources';
import type { ReaderState } from './reader/state';
import type { ReaderSettings } from './reader/settings';
import type { ChapterRead, HistoryEntry, ProgressEntry, TrackedTitle } from './tracker/local';
import type { TrackerConnection } from './tracker/adapters/base';

interface CacheEntry {
  key: string;
  data: unknown;
  ts: number;
}

class KomaDB extends Dexie {
  catalog!: Table<CacheEntry, string>;
  sources!: Table<Source, string>;
  readerState!: Table<ReaderState, string>;
  readerSettings!: Table<ReaderSettings, string>;
  trackedTitles!: Table<TrackedTitle, number>;
  chapterReads!: Table<ChapterRead, string>;
  progress!: Table<ProgressEntry, string>;
  history!: Table<HistoryEntry, string>;
  trackerConnections!: Table<TrackerConnection, string>;
  constructor() {
    super('koma');
    this.version(1).stores({ catalog: 'key, ts' });
    this.version(2).stores({ catalog: 'key, ts', sources: 'id, enabled, preset' });
    this.version(3).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset',
      readerState: 'key, mediaId, sourceId, updatedAt',
    });
    this.version(4).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status',
      readerState: 'key, mediaId, sourceId, updatedAt',
    });
    this.version(5).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status',
      readerState: 'key, mediaId, sourceId, updatedAt',
      trackedTitles: 'mediaId, followed, followedAt, updatedAt',
      chapterReads: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, readAt',
      progress: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, updatedAt, status',
      history: 'id, mediaId, sourceId, readAt',
    });
    this.version(6).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status',
      readerState: 'key, mediaId, sourceId, updatedAt',
      trackedTitles: 'mediaId, followed, followedAt, updatedAt',
      chapterReads: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, readAt',
      progress: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, updatedAt, status',
      history: 'id, mediaId, sourceId, readAt',
      trackerConnections: 'id, enabled, updatedAt',
    });
    this.version(7).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status, priority',
      readerState: 'key, mediaId, sourceId, updatedAt',
      readerSettings: 'key',
      trackedTitles: 'mediaId, followed, followedAt, updatedAt',
      chapterReads: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, readAt',
      progress: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, updatedAt, status',
      history: 'id, mediaId, sourceId, readAt',
      trackerConnections: 'id, enabled, updatedAt',
    });
  }
}

export const db = new KomaDB();

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await db.catalog.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data as T;
  const data = await fetcher();
  await db.catalog.put({ key, data, ts: Date.now() });
  return data;
}

export const clearCatalogCache = () => db.catalog.clear();
