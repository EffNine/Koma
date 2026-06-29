import type { Title } from '../catalog/types';
import { setChapterReadHook, type ProgressStatus } from './local';
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

export { configureAniList, configureMal, configureMangaUpdates, type TrackerId } from './adapters';

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
