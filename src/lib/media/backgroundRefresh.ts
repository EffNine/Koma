import type { Title } from '../catalog/types';
import { enabledSources } from '../scraper/sources';
import { resolveChapters } from './chapterResolver';
import { computeUnreadUpdates, refreshFollowedTitleChapters, type UnreadUpdate } from './chapterSnapshots';
import type { ProgressEntry, TrackedTitle } from '../tracker/local';

export const BACKGROUND_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 500;

export interface RefreshProgress {
  done: number;
  total: number;
  current?: string;
}

export function isSnapshotStale(checkedAt: number | undefined, now = Date.now(), force = false): boolean {
  if (force) return true;
  if (!checkedAt) return true;
  return now - checkedAt >= BACKGROUND_REFRESH_INTERVAL_MS;
}

export function chunkForRefresh<T>(items: T[], batchSize = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) out.push(items.slice(i, i + batchSize));
  return out;
}

function titleStub(title: TrackedTitle): Title {
  return {
    id: title.mediaId,
    title: { english: title.name, romaji: title.name, native: title.name },
    name: title.name,
    cover: title.cover ?? '',
  } as Title;
}

export async function resolveSourceMap(
  followed: TrackedTitle[],
): Promise<Map<number, { source: import('../scraper/sources').Source; seriesUrl: string }>> {
  const allSources = await enabledSources();
  const sourceMap = new Map<number, { source: import('../scraper/sources').Source; seriesUrl: string }>();
  if (allSources.length === 0) return sourceMap;

  for (const title of followed) {
    for (const s of allSources) {
      try {
        const result = await resolveChapters(s, titleStub(title));
        if (!('err' in result) && result.chapters.length > 0) {
          sourceMap.set(title.mediaId, { source: s, seriesUrl: result.seriesUrl });
          break;
        }
      } catch {
        continue;
      }
    }
  }
  return sourceMap;
}

export async function refreshFollowedTitlesStaggered(
  followed: TrackedTitle[],
  onProgress?: (p: RefreshProgress) => void,
  force = false,
): Promise<void> {
  const allSources = await enabledSources();
  if (allSources.length === 0 || followed.length === 0) return;

  const { getSnapshot } = await import('./chapterSnapshots');
  const stale: TrackedTitle[] = [];

  for (const title of followed) {
    let isStale = force;
    if (!force) {
      for (const s of allSources) {
        const snap = await getSnapshot(title.mediaId, s.id);
        if (isSnapshotStale(snap?.checkedAt)) {
          isStale = true;
          break;
        }
      }
    }
    if (isStale) stale.push(title);
  }

  if (stale.length === 0) return;

  let done = 0;
  onProgress?.({ done: 0, total: stale.length });

  const batches = chunkForRefresh(stale);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await Promise.all(
      batch.map(async (title) => {
        onProgress?.({ done, total: stale.length, current: title.name });
        for (const s of allSources) {
          try {
            const result = await resolveChapters(s, titleStub(title));
            if (!('err' in result) && result.chapters.length > 0) {
              await refreshFollowedTitleChapters(title.mediaId, s, result.seriesUrl);
              break;
            }
          } catch {
            continue;
          }
        }
        done++;
        onProgress?.({ done, total: stale.length, current: title.name });
      }),
    );
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}

export async function computeUpdatesForFollowed(
  followed: TrackedTitle[],
  progress: ProgressEntry[],
): Promise<UnreadUpdate[]> {
  const progressMap = new Map<number, { chapterNumber?: string }>();
  const seen = new Set<number>();
  for (const p of [...progress].sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (!seen.has(p.mediaId)) {
      seen.add(p.mediaId);
      progressMap.set(p.mediaId, { chapterNumber: p.chapterNumber });
    }
  }
  const sourceMap = await resolveSourceMap(followed);
  return computeUnreadUpdates(followed, progressMap, sourceMap);
}

export async function notifyNewChapters(updates: UnreadUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') return;

  const total = updates.reduce((sum, u) => sum + (u.newChapterCount ?? 1), 0);
  const body =
    updates.length === 1
      ? `${updates[0].name} has ${updates[0].newChapterCount ?? 1} new chapter(s)`
      : `${updates.length} titles have ${total} new chapters`;

  new Notification('Koma — New chapters', { body, tag: 'koma-updates' });
}
