import Dexie, { type Table } from 'dexie';
import type { Source } from './scraper/sources';
import type { ReaderState } from './reader/state';
import type { ReaderSettings } from './reader/settings';
import type { TitlePreference } from './media/titlePreferences';
import type { ChapterRead, HistoryEntry, ProgressEntry, TrackedTitle } from './tracker/local';
import type { TrackerConnection } from './tracker/adapters/base';
import type { TitleChapterSnapshot } from './media/chapterSnapshots';
import type { ChapterCacheEntry, ChapterCachePage } from './reader/chapterCache';
import type { SourceHealth } from './scraper/sourceHealth';

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
  titlePreferences!: Table<TitlePreference, number>;
  trackedTitles!: Table<TrackedTitle, number>;
  chapterReads!: Table<ChapterRead, string>;
  progress!: Table<ProgressEntry, string>;
  history!: Table<HistoryEntry, string>;
  trackerConnections!: Table<TrackerConnection, string>;
  titleChapterSnapshots!: Table<TitleChapterSnapshot, string>;
  chapterCache!: Table<ChapterCacheEntry, string>;
  chapterCachePages!: Table<ChapterCachePage, string>;
  sourceHealth!: Table<SourceHealth, string>;
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
    this.version(8).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status, priority',
      readerState: 'key, mediaId, sourceId, updatedAt',
      readerSettings: 'key',
      titlePreferences: 'mediaId, updatedAt',
      trackedTitles: 'mediaId, followed, followedAt, updatedAt',
      chapterReads: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, readAt',
      progress: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, updatedAt, status',
      history: 'id, mediaId, sourceId, readAt',
      trackerConnections: 'id, enabled, updatedAt',
    });
    this.version(9).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status, priority',
      readerState: 'key, mediaId, sourceId, updatedAt',
      readerSettings: 'key',
      titlePreferences: 'mediaId, updatedAt',
      trackedTitles: 'mediaId, followed, followedAt, updatedAt',
      chapterReads: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, readAt',
      progress: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, updatedAt, status',
      history: 'id, mediaId, sourceId, readAt',
      trackerConnections: 'id, enabled, updatedAt',
      titleChapterSnapshots: 'key, mediaId, checkedAt',
    });
    this.version(10).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status, priority',
      readerState: 'key, mediaId, sourceId, updatedAt',
      readerSettings: 'key',
      titlePreferences: 'mediaId, updatedAt',
      trackedTitles: 'mediaId, followed, followedAt, updatedAt',
      chapterReads: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, readAt',
      progress: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, updatedAt, status',
      history: 'id, mediaId, sourceId, readAt',
      trackerConnections: 'id, enabled, updatedAt',
      titleChapterSnapshots: 'key, mediaId, checkedAt',
      chapterCache: 'key, mediaId, sourceId, createdAt',
      chapterCachePages: 'key, chapterKey, pageIndex',
    });
    this.version(11).stores({
      catalog: 'key, ts',
      sources: 'id, enabled, preset, addedAt, checkedAt, status, priority',
      readerState: 'key, mediaId, sourceId, updatedAt',
      readerSettings: 'key',
      titlePreferences: 'mediaId, updatedAt',
      trackedTitles: 'mediaId, followed, followedAt, updatedAt',
      chapterReads: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, readAt',
      progress: 'key, mediaId, sourceId, [mediaId+sourceId], chapterNumberValue, updatedAt, status',
      history: 'id, mediaId, sourceId, readAt',
      trackerConnections: 'id, enabled, updatedAt',
      titleChapterSnapshots: 'key, mediaId, checkedAt',
      chapterCache: 'key, mediaId, sourceId, createdAt',
      chapterCachePages: 'key, chapterKey, pageIndex',
      sourceHealth: 'sourceId, updatedAt',
    });
  }
}

export const db = new KomaDB();

const CATALOG_VERSION = 1;

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const vKey = `${CATALOG_VERSION}:${key}`;
  const hit = await db.catalog.get(vKey);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data as T;
  const data = await fetcher();
  await db.catalog.put({ key: vKey, data, ts: Date.now() });
  return data;
}

export const clearCatalogCache = () => db.catalog.clear();
