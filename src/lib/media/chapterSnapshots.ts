import { db } from '../db';
import type { ScrapedChapter } from '../scraper/engine';
import { getChapters } from '../scraper/scraper';
import type { Source } from '../scraper/sources';
import { getTitlePreference } from './titlePreferences';
import { groupChapters } from './chapterGroups';

export interface TitleChapterSnapshot {
  key: string;
  mediaId: number;
  sourceId: string;
  seriesUrl: string;
  chapters: Array<{
    url: string;
    number: string | null;
    title: string | null;
    group?: string;
    createdAt?: string;
  }>;
  checkedAt: number;
}

export interface UnreadUpdate {
  mediaId: number;
  name: string;
  cover?: string;
  latestChapter: string | null;
  latestChapterTitle: string | null;
  latestGroup?: string;
  progressChapter?: string;
  checkedAt: number;
}

const SNAPSHOT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function snapshotKey(mediaId: number, sourceId: string): string {
  return `${mediaId}:${sourceId}`;
}

export async function getSnapshot(mediaId: number, sourceId: string): Promise<TitleChapterSnapshot | undefined> {
  return db.titleChapterSnapshots.get(snapshotKey(mediaId, sourceId));
}

export async function refreshFollowedTitleChapters(
  mediaId: number,
  source: Source,
  seriesUrl: string,
): Promise<TitleChapterSnapshot> {
  const chapters = await getChapters(source, seriesUrl);
  const snapshot: TitleChapterSnapshot = {
    key: snapshotKey(mediaId, source.id),
    mediaId,
    sourceId: source.id,
    seriesUrl,
    chapters: chapters.map((c) => ({
      url: c.url,
      number: c.number,
      title: c.title,
      group: c.group,
      createdAt: c.createdAt,
    })),
    checkedAt: Date.now(),
  };
  await db.titleChapterSnapshots.put(snapshot);
  return snapshot;
}

export async function getOrRefreshSnapshot(
  mediaId: number,
  source: Source,
  seriesUrl: string,
): Promise<TitleChapterSnapshot> {
  const existing = await getSnapshot(mediaId, source.id);
  if (existing && Date.now() - existing.checkedAt < SNAPSHOT_TTL_MS) {
    return existing;
  }
  return refreshFollowedTitleChapters(mediaId, source, seriesUrl);
}

export async function computeUnreadUpdates(
  followedTitles: Array<{ mediaId: number; name: string; cover?: string }>,
  progressMap: Map<number, { chapterNumber?: string }>,
  sourceMap: Map<number, { source: Source; seriesUrl: string }>,
): Promise<UnreadUpdate[]> {
  const updates: UnreadUpdate[] = [];

  for (const title of followedTitles) {
    const srcInfo = sourceMap.get(title.mediaId);
    if (!srcInfo) continue;

    const pref = await getTitlePreference(title.mediaId);
    const snapshot = await getOrRefreshSnapshot(title.mediaId, srcInfo.source, srcInfo.seriesUrl);
    const progress = progressMap.get(title.mediaId);

    // Reconstruct ScrapedChapter[] from snapshot for grouping
    const scrapedChapters: ScrapedChapter[] = snapshot.chapters.map((c) => ({
      url: c.url,
      number: c.number,
      title: c.title,
      group: c.group,
      createdAt: c.createdAt,
    }));

    const grouped = groupChapters(scrapedChapters, pref?.preferredGroup);
    if (grouped.length === 0) continue;

    // The first group is the latest chapter (sorted descending)
    const latest = grouped[0];
    const latestNumber = latest.number;

    if (!latestNumber) continue;

    const progressValue = progress?.chapterNumber ? Number.parseFloat(progress.chapterNumber) : -1;
    const latestValue = Number.parseFloat(latestNumber);

    if (Number.isFinite(latestValue) && latestValue > progressValue) {
      updates.push({
        mediaId: title.mediaId,
        name: title.name,
        cover: title.cover,
        latestChapter: latestNumber,
        latestChapterTitle: latest.title,
        latestGroup: latest.preferred.group,
        progressChapter: progress?.chapterNumber,
        checkedAt: snapshot.checkedAt,
      });
    }
  }

  return updates.sort((a, b) => {
    // Sort by latest chapter number descending
    const av = Number.parseFloat(a.latestChapter ?? '0');
    const bv = Number.parseFloat(b.latestChapter ?? '0');
    if (Number.isFinite(av) && Number.isFinite(bv)) return bv - av;
    return 0;
  });
}
