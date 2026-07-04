import { db } from '../db';
import { titleName } from '../catalog/types';
import type { Title } from '../catalog/types';
import { loadLastReaderStateForMedia } from '../reader/state';
import { listHistory, listProgress, listFollowedTitles } from '../tracker/local';

export interface ContinueReadingItem {
  mediaId: number;
  title: string;
  cover?: string;
  sourceId: string;
  chapterUrl: string;
  seriesUrl?: string;
  page: number;
  chapterNumber?: string;
  chapterTitle?: string;
  updatedAt: number;
  canResume: boolean;
}

/** Build the best continue-reading list from recent history and saved reader state. */
export async function buildContinueReading(limit = 6): Promise<ContinueReadingItem[]> {
  const [history, progressRows] = await Promise.all([
    listHistory(30),
    listProgress(),
  ]);

  // Index progress by mediaId, preferring the most recently updated source.
  const progressByMedia: Map<number, typeof progressRows[number]> = new Map();
  for (const p of progressRows.sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (!progressByMedia.has(p.mediaId)) progressByMedia.set(p.mediaId, p);
  }

  const seen = new Set<number>();
  const items: ContinueReadingItem[] = [];

  // Use history as the primary signal of "recently opened".
  for (const entry of history) {
    if (seen.has(entry.mediaId)) continue;
    seen.add(entry.mediaId);

    const state = await loadLastReaderStateForMedia(entry.mediaId);
    const progress = progressByMedia.get(entry.mediaId);
    const tracked = await db.trackedTitles.get(entry.mediaId);
    const titleRow = tracked ?? (await fetchTitle(entry.mediaId));

    const sourceId = state?.sourceId ?? entry.sourceId;
    const chapterUrl = state?.chapterUrl ?? entry.chapterUrl;
    const seriesUrl = state?.seriesUrl;
    const page = state?.page ?? entry.page ?? 0;
    const chapterNumber = state ? undefined : entry.chapterNumber;
    const chapterTitle = state ? undefined : entry.chapterTitle;

    items.push({
      mediaId: entry.mediaId,
      title: titleRow?.name ?? `Title ${entry.mediaId}`,
      cover: titleRow?.cover,
      sourceId,
      chapterUrl,
      seriesUrl,
      page,
      chapterNumber,
      chapterTitle,
      updatedAt: state?.updatedAt ?? entry.readAt,
      canResume: !!sourceId && !!chapterUrl && !!seriesUrl,
    });

    if (items.length >= limit) break;
  }

  return items;
}

/** Build a list of followed titles with unread chapters from progress and snapshots. */
export async function buildFollowedUpdates(limit = 6): Promise<ContinueReadingItem[]> {
  const followed = await listFollowedTitles();
  if (followed.length === 0) return [];

  const progressRows = await listProgress();
  const progressByMedia: Map<number, typeof progressRows[number]> = new Map();
  for (const p of progressRows) {
    if (!progressByMedia.has(p.mediaId)) progressByMedia.set(p.mediaId, p);
  }

  const items: ContinueReadingItem[] = [];
  for (const f of followed.slice(0, limit)) {
    const progress = progressByMedia.get(f.mediaId);
    if (!progress) continue;

    const state = await loadLastReaderStateForMedia(f.mediaId);
    items.push({
      mediaId: f.mediaId,
      title: f.name,
      cover: f.cover,
      sourceId: state?.sourceId ?? progress.sourceId,
      chapterUrl: state?.chapterUrl ?? progress.chapterUrl,
      seriesUrl: state?.seriesUrl,
      page: state?.page ?? 0,
      chapterNumber: progress.chapterNumber,
      chapterTitle: progress.chapterTitle,
      updatedAt: state?.updatedAt ?? progress.updatedAt,
      canResume: !!(state?.sourceId && state?.chapterUrl && state?.seriesUrl),
    });
  }
  return items;
}

async function fetchTitle(mediaId: number): Promise<{ name: string; cover?: string } | undefined> {
  // Lazy import to avoid pulling the catalog module into tests unless needed.
  const { media } = await import('../catalog/anilist');
  const title = await media(mediaId).catch(() => undefined);
  if (!title) return undefined;
  return { name: titleName(title), cover: title.cover };
}
