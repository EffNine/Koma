import type { Title } from '../catalog/types';
import { titleName } from '../catalog/types';
import { db } from '../db';
import { chapterValue, computeProgress, computeRollback } from './progress';

export type ProgressStatus = 'READING' | 'COMPLETED';

export type ChapterReadHook = (input: ChapterProgressInput, entry: ProgressEntry) => void | Promise<void>;

let chapterReadHook: ChapterReadHook | undefined;

export function setChapterReadHook(hook: ChapterReadHook | undefined): void {
  chapterReadHook = hook;
}

export interface TrackedTitle {
  mediaId: number;
  name: string;
  cover?: string;
  country?: string | null;
  status?: string;
  totalChapters?: number;
  followed: boolean;
  followedAt?: number;
  updatedAt: number;
}

export interface ChapterRead {
  key: string;
  mediaId: number;
  sourceId: string;
  chapterUrl: string;
  chapterNumber?: string;
  chapterNumberValue: number;
  chapterTitle?: string;
  readAt: number;
}

export interface ProgressEntry {
  key: string;
  mediaId: number;
  sourceId: string;
  chapterUrl: string;
  chapterNumber?: string;
  chapterNumberValue: number;
  chapterTitle?: string;
  status: ProgressStatus;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  mediaId: number;
  sourceId: string;
  chapterUrl: string;
  chapterNumber?: string;
  chapterNumberValue: number;
  chapterTitle?: string;
  page?: number;
  readAt: number;
}

export interface ChapterProgressInput {
  title: Title;
  sourceId: string;
  chapterUrl: string;
  chapterNumber?: string | null;
  chapterTitle?: string | null;
  page?: number;
  readAt?: number;
}

export function progressKey(mediaId: number, sourceId: string): string {
  return `${mediaId}:${sourceId}`;
}

export function chapterReadKey(mediaId: number, sourceId: string, chapterNumber: string | null | undefined, chapterUrl: string): string {
  return `${mediaId}:${sourceId}:${chapterNumber || chapterUrl}`;
}

export async function followTitle(title: Title, followedAt = Date.now()): Promise<TrackedTitle> {
  const existing = await db.trackedTitles.get(title.id);
  const row = snapshotTitle(title, {
    followed: true,
    followedAt: existing?.followedAt ?? followedAt,
    updatedAt: followedAt,
  });
  await db.trackedTitles.put(row);
  return row;
}

export async function unfollowTitle(mediaId: number): Promise<void> {
  const existing = await db.trackedTitles.get(mediaId);
  if (!existing) return;
  await db.trackedTitles.put({
    ...existing,
    followed: false,
    followedAt: undefined,
    updatedAt: Date.now(),
  });
}

export async function isFollowed(mediaId: number): Promise<boolean> {
  return (await db.trackedTitles.get(mediaId))?.followed ?? false;
}

export async function listFollowedTitles(): Promise<TrackedTitle[]> {
  // IndexedDB does not allow boolean keys, so filter in memory instead of using the index.
  const rows = await db.trackedTitles.filter((row) => row.followed).toArray();
  return rows.sort((a, b) => (b.followedAt ?? 0) - (a.followedAt ?? 0));
}

export async function listHistory(limit = 80): Promise<HistoryEntry[]> {
  const rows = await db.history.orderBy('readAt').reverse().limit(limit).toArray();
  return rows;
}

export async function getProgress(mediaId: number, sourceId: string): Promise<ProgressEntry | undefined> {
  return db.progress.get(progressKey(mediaId, sourceId));
}

export async function getReadChapters(mediaId: number, sourceId: string): Promise<Set<string>> {
  const reads = await db.chapterReads
    .where('[mediaId+sourceId]')
    .equals([mediaId, sourceId])
    .toArray();
  return new Set(reads.map((r) => r.chapterNumber).filter((n): n is string => !!n));
}

export async function listProgress(): Promise<ProgressEntry[]> {
  return db.progress.orderBy('updatedAt').reverse().toArray();
}

export async function recordChapterRead(input: ChapterProgressInput): Promise<ProgressEntry> {
  const now = input.readAt ?? Date.now();
  await upsertTitleSnapshot(input.title, now);

  const chapterNumber = input.chapterNumber?.trim() || undefined;
  const chapterNumberValue = chapterValue(chapterNumber);
  const chapterTitle = input.chapterTitle?.trim() || undefined;
  const read: ChapterRead = {
    key: chapterReadKey(input.title.id, input.sourceId, chapterNumber, input.chapterUrl),
    mediaId: input.title.id,
    sourceId: input.sourceId,
    chapterUrl: input.chapterUrl,
    chapterNumber,
    chapterNumberValue,
    chapterTitle,
    readAt: now,
  };
  await db.chapterReads.put(read);

  const current = await getProgress(input.title.id, input.sourceId);
  const computed = computeProgress(
    current ? { chapterNumberValue: current.chapterNumberValue, status: current.status } : undefined,
    { chapterNumber, chapterNumberValue, chapterUrl: input.chapterUrl, chapterTitle, totalChapters: input.title.chapters, readAt: now },
  );
  const progress: ProgressEntry = computed.chapterUrl
    ? {
        key: progressKey(input.title.id, input.sourceId),
        mediaId: input.title.id,
        sourceId: input.sourceId,
        chapterUrl: computed.chapterUrl,
        chapterNumber: computed.chapterNumber,
        chapterNumberValue: computed.chapterNumberValue,
        chapterTitle: computed.chapterTitle,
        status: computed.status,
        updatedAt: now,
      }
    : { ...current!, updatedAt: now };
  await db.progress.put(progress);
  await recordHistory({ ...input, chapterNumber, chapterTitle, readAt: now });
  if (chapterReadHook) {
    try {
      await chapterReadHook({ ...input, chapterNumber, chapterTitle, readAt: now }, progress);
    } catch (e) {
      console.error('[local] chapter read sync hook failed:', e);
    }
  }
  return progress;
}

export async function recordReaderPage(input: ChapterProgressInput): Promise<void> {
  const now = input.readAt ?? Date.now();
  await upsertTitleSnapshot(input.title, now);
  await recordHistory({ ...input, readAt: now });
}

export async function markChapterUnread(mediaId: number, sourceId: string, chapterNumber: string): Promise<ProgressEntry | undefined> {
  const cutoff = chapterValue(chapterNumber);
  const reads = await db.chapterReads
    .where('[mediaId+sourceId]')
    .equals([mediaId, sourceId])
    .toArray();
  const scopedReads = reads;
  const toDelete = scopedReads.filter((row) => row.chapterNumberValue >= cutoff).map((row) => row.key);
  await db.chapterReads.bulkDelete(toDelete);

  const rollback = computeRollback(scopedReads, cutoff);

  if (!rollback) {
    await db.progress.delete(progressKey(mediaId, sourceId));
    return undefined;
  }

  const progress: ProgressEntry = {
    key: progressKey(mediaId, sourceId),
    mediaId,
    sourceId,
    chapterUrl: rollback.chapterUrl,
    chapterNumber: rollback.chapterNumber,
    chapterNumberValue: rollback.chapterNumberValue,
    chapterTitle: rollback.chapterTitle,
    status: 'READING',
    updatedAt: Date.now(),
  };
  await db.progress.put(progress);
  return progress;
}

async function recordHistory(input: ChapterProgressInput & { readAt: number }): Promise<void> {
  const chapterNumber = input.chapterNumber?.trim() || undefined;
  const chapterTitle = input.chapterTitle?.trim() || undefined;
  await db.history.put({
    id: `${input.title.id}:${input.sourceId}:${input.chapterUrl}:${input.readAt}`,
    mediaId: input.title.id,
    sourceId: input.sourceId,
    chapterUrl: input.chapterUrl,
    chapterNumber,
    chapterNumberValue: chapterValue(chapterNumber),
    chapterTitle,
    page: input.page,
    readAt: input.readAt,
  });
}

async function upsertTitleSnapshot(title: Title, updatedAt: number): Promise<TrackedTitle> {
  const existing = await db.trackedTitles.get(title.id);
  const row = snapshotTitle(title, {
    followed: existing?.followed ?? false,
    followedAt: existing?.followedAt,
    updatedAt,
  });
  await db.trackedTitles.put(row);
  return row;
}

function snapshotTitle(
  title: Title,
  state: Pick<TrackedTitle, 'followed' | 'followedAt' | 'updatedAt'>,
): TrackedTitle {
  return {
    mediaId: title.id,
    name: titleName(title),
    cover: title.cover,
    country: title.country,
    status: title.status,
    totalChapters: title.chapters,
    followed: state.followed,
    followedAt: state.followedAt,
    updatedAt: state.updatedAt,
  };
}
