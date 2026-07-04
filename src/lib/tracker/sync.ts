import type { Title } from '../catalog/types';
import { titleName } from '../catalog/types';
import { db } from '../db';
import { setChapterReadHook, progressKey, type ProgressStatus, type TrackedTitle } from './local';
import { fetchAniListMangaList, type AniListLibraryEntry } from './adapters/anilist';
import {
  createAniListAdapter,
  createMalAdapter,
  createMangaUpdatesAdapter,
  isConnectionEnabled,
  loadConnection,
  saveConnection,
  trackerChapterNumber,
  type TrackerAdapter,
  type TrackerId,
  TrackerError,
} from './adapters';

export {
  ANILIST_REDIRECT_URI,
  configureAniList,
  configureMal,
  configureMangaUpdates,
  type TrackerId,
} from './adapters';

export interface SyncResult {
  pushed: TrackerId[];
  failed: { id: TrackerId; message: string }[];
}

export interface PulledProgress {
  mediaId: number;
  byTracker: Record<TrackerId, { chapterNumber: number; status: ProgressStatus } | undefined>;
  mergedChapterNumber?: number;
  mergedStatus?: ProgressStatus;
}

export interface LibrarySyncResult {
  trackerId: TrackerId;
  importedTitles: number;
  importedProgress: number;
}

const adapters: TrackerAdapter[] = [
  createAniListAdapter(),
  createMalAdapter(),
  createMangaUpdatesAdapter(),
];

setChapterReadHook((input, entry) => {
  void pushProgress(input.title, entry.chapterNumberValue, entry.status);
});

export function listTrackers(): TrackerAdapter[] {
  return adapters;
}

export async function pushFollow(media: Title): Promise<SyncResult> {
  const pushed: TrackerId[] = [];
  const failed: { id: TrackerId; message: string }[] = [];

  for (const adapter of adapters) {
    if (!adapter.follow) continue;
    if (!adapter.supportsPlatform()) continue;
    const connected = await adapter.isConnected();
    if (!connected) continue;

    try {
      await adapter.follow(media);
      pushed.push(adapter.id);
    } catch (e) {
      const message = e instanceof TrackerError ? e.message : String(e);
      failed.push({ id: adapter.id, message });
      console.error(`[sync] ${adapter.id} follow failed:`, e);
    }
  }

  return { pushed, failed };
}

export async function pushUnfollow(mediaId: number): Promise<SyncResult> {
  const pushed: TrackerId[] = [];
  const failed: { id: TrackerId; message: string }[] = [];

  for (const adapter of adapters) {
    if (!adapter.unfollow) continue;
    if (!adapter.supportsPlatform()) continue;
    const connected = await adapter.isConnected();
    if (!connected) continue;

    try {
      await adapter.unfollow(mediaId);
      pushed.push(adapter.id);
    } catch (e) {
      const message = e instanceof TrackerError ? e.message : String(e);
      failed.push({ id: adapter.id, message });
      console.error(`[sync] ${adapter.id} unfollow failed:`, e);
    }
  }

  return { pushed, failed };
}

export async function pushProgress(
  media: Title,
  chapterNumber: number,
  status: ProgressStatus,
): Promise<SyncResult> {
  const pushed: TrackerId[] = [];
  const failed: { id: TrackerId; message: string }[] = [];

  for (const adapter of adapters) {
    if (!adapter.supportsPlatform()) continue;
    const connected = await adapter.isConnected();
    if (!connected) continue;

    try {
      await adapter.push(media, chapterNumber, status);
      pushed.push(adapter.id);
    } catch (e) {
      const message = e instanceof TrackerError ? e.message : String(e);
      failed.push({ id: adapter.id, message });
      console.error(`[sync] ${adapter.id} push failed:`, e);
    }
  }

  return { pushed, failed };
}

export async function pullProgress(media: Title): Promise<PulledProgress> {
  const byTracker: PulledProgress['byTracker'] = {
    anilist: undefined,
    mal: undefined,
    mangaupdates: undefined,
  };
  let mergedChapterNumber: number | undefined;
  let mergedStatus: ProgressStatus | undefined;

  for (const adapter of adapters) {
    if (!adapter.supportsPlatform()) continue;
    const connected = await adapter.isConnected();
    if (!connected) continue;

    try {
      const remote = await adapter.pull(media);
      byTracker[adapter.id] = remote;
      if (remote) {
        if (mergedChapterNumber === undefined || remote.chapterNumber > mergedChapterNumber) {
          mergedChapterNumber = remote.chapterNumber;
          mergedStatus = remote.status;
        }
      }
    } catch (e) {
      console.error(`[sync] ${adapter.id} pull failed:`, e);
    }
  }

  return { mediaId: media.id, byTracker, mergedChapterNumber, mergedStatus };
}

export async function syncAniListLibrary(): Promise<LibrarySyncResult> {
  const entries = await fetchAniListMangaList();
  return importRemoteLibraryEntries('anilist', entries);
}

export async function importRemoteLibraryEntries(
  trackerId: TrackerId,
  entries: AniListLibraryEntry[],
): Promise<LibrarySyncResult> {
  const now = Date.now();
  let importedProgress = 0;

  await db.transaction('rw', db.trackedTitles, db.progress, async () => {
    for (const entry of entries) {
      const title = entry.title;
      const existing = await db.trackedTitles.get(title.id);
      const updatedAt = entry.updatedAt ?? now;
      const row: TrackedTitle = {
        mediaId: title.id,
        name: titleName(title),
        cover: title.cover,
        country: title.country,
        status: title.status,
        totalChapters: title.chapters,
        followed: true,
        followedAt: existing?.followedAt ?? updatedAt,
        readingList: entry.status === 'COMPLETED' ? 'Completed' : existing?.readingList ?? 'Reading',
        updatedAt: now,
      };
      await db.trackedTitles.put(row);

      if (entry.progress > 0 || entry.status === 'COMPLETED') {
        await db.progress.put({
          key: progressKey(title.id, trackerId),
          mediaId: title.id,
          sourceId: trackerId,
          chapterUrl: title.siteUrl ?? `https://anilist.co/manga/${title.id}`,
          chapterNumber: String(entry.progress),
          chapterNumberValue: trackerChapterNumber(entry.progress),
          chapterTitle: `${trackerId} progress`,
          status: entry.status,
          updatedAt,
        });
        importedProgress += 1;
      }
    }
  });

  return { trackerId, importedTitles: entries.length, importedProgress };
}

export async function setTrackerEnabled(id: TrackerId, enabled: boolean): Promise<void> {
  const conn = await loadConnection(id);
  if (!conn) {
    await saveConnection({
      id,
      enabled,
      token: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return;
  }
  await saveConnection({ ...conn, enabled });
}

export async function isTrackerEnabled(id: TrackerId): Promise<boolean> {
  return isConnectionEnabled(id);
}

export async function connectTracker(id: TrackerId): Promise<void> {
  const adapter = adapters.find((a) => a.id === id);
  if (!adapter) throw new Error(`Unknown tracker: ${id}`);
  if (!adapter.supportsPlatform()) {
    throw new Error(`${adapter.name} is not available on this platform.`);
  }
  await adapter.connect();
}

export async function disconnectTracker(id: TrackerId): Promise<void> {
  const adapter = adapters.find((a) => a.id === id);
  if (!adapter) throw new Error(`Unknown tracker: ${id}`);
  await adapter.disconnect();
}

export function mappedTrackerProgress(chapterNumber: number): number {
  return trackerChapterNumber(chapterNumber);
}
