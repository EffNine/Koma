import type { Title } from '../../catalog/types';
import type { ProgressStatus } from '../local';
import { db } from '../../db';

export type TrackerId = 'anilist' | 'mal' | 'mangaupdates';

export interface TrackerConnection {
  id: TrackerId;
  enabled: boolean;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  userName?: string;
  seriesCache?: Record<number, string>; // mediaId -> MangaUpdates series id
  createdAt: number;
  updatedAt: number;
}

export interface TrackerAdapter {
  readonly id: TrackerId;
  readonly name: string;
  /** Whether the adapter can run on the current platform (e.g. desktop Tauri). */
  supportsPlatform(): boolean;
  /** True when a saved, non-expired connection exists and is enabled. */
  isConnected(): Promise<boolean>;
  /** Start OAuth or token capture and return the connection. */
  connect(): Promise<TrackerConnection>;
  /** Remove the saved connection. */
  disconnect(): Promise<void>;
  /** Push progress for the title. chapterNumber is the local chapter value. */
  push(media: Title, chapterNumber: number, status: ProgressStatus): Promise<void>;
  /** Pull remote progress and return the highest chapter number known remotely. */
  pull(media: Title): Promise<{ chapterNumber: number; status: ProgressStatus } | undefined>;
}

/** Each tracker expects an integer chapter count; floor fractional values. */
export function trackerChapterNumber(value: number): number {
  return Math.max(0, Math.floor(value));
}

export function isCompleted(status: ProgressStatus): boolean {
  return status === 'COMPLETED';
}

/** Build a human-readable sync error while keeping the original cause accessible. */
export class TrackerError extends Error {
  constructor(
    public readonly trackerId: TrackerId,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${trackerId}: ${message}`);
  }
}

export async function loadConnection(id: TrackerId): Promise<TrackerConnection | undefined> {
  return db.trackerConnections.get(id);
}

export async function saveConnection(conn: TrackerConnection): Promise<TrackerConnection> {
  const row = { ...conn, updatedAt: Date.now() };
  await db.trackerConnections.put(row);
  return row;
}

export async function removeConnection(id: TrackerId): Promise<void> {
  await db.trackerConnections.delete(id);
}

export async function isConnectionEnabled(id: TrackerId): Promise<boolean> {
  const conn = await loadConnection(id);
  return conn?.enabled ?? false;
}

export async function setConnectionEnabled(id: TrackerId, enabled: boolean): Promise<void> {
  const conn = await loadConnection(id);
  if (!conn) return;
  await saveConnection({ ...conn, enabled });
}
