import Dexie, { type Table } from 'dexie';

// ponytail: one IDB store, bumped per stage as tables are added.
interface CacheEntry {
  key: string;
  data: unknown;
  ts: number;
}

class KomaDB extends Dexie {
  catalog!: Table<CacheEntry, string>;
  constructor() {
    super('koma');
    this.version(1).stores({ catalog: 'key, ts' });
  }
}

export const db = new KomaDB();

// TTL cache wrapper. Ceiling: no eviction — cache grows until Stage 6 adds an LRU cap.
export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await db.catalog.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data as T;
  const data = await fetcher();
  await db.catalog.put({ key, data, ts: Date.now() });
  return data;
}

export const clearCatalogCache = () => db.catalog.clear();