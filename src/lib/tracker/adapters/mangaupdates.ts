import type { Title } from '../../catalog/types';
import { titleName } from '../../catalog/types';
import type { ProgressStatus } from '../local';
import {
  isConnectionEnabled,
  loadConnection,
  removeConnection,
  saveConnection,
  trackerChapterNumber,
  type TrackerAdapter,
  type TrackerConnection,
  TrackerError,
} from './base';

const API_URL = 'https://api.mangaupdates.com/v1';

export interface MangaUpdatesCredentials {
  username: string;
  password: string;
}

let credentials: MangaUpdatesCredentials | undefined;

export function configureMangaUpdates(creds: MangaUpdatesCredentials): void {
  credentials = creds;
}

export function createMangaUpdatesAdapter(): TrackerAdapter {
  return {
    id: 'mangaupdates',
    name: 'MangaUpdates',
    supportsPlatform,
    isConnected,
    connect,
    disconnect,
    push,
    pull,
  };
}

function supportsPlatform(): boolean {
  return true;
}

async function isConnected(): Promise<boolean> {
  return isConnectionEnabled('mangaupdates');
}

async function connect(): Promise<TrackerConnection> {
  if (!credentials?.username || !credentials?.password) {
    throw new TrackerError('mangaupdates', 'MangaUpdates username and password are required.');
  }
  const token = await login(credentials.username, credentials.password);
  const conn: TrackerConnection = {
    id: 'mangaupdates',
    enabled: true,
    token,
    userName: credentials.username,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveConnection(conn);
  return conn;
}

async function disconnect(): Promise<void> {
  await removeConnection('mangaupdates');
}

async function login(username: string, password: string): Promise<string> {
  const r = await fetch(`${API_URL}/account/login`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const text = await r.text();
  if (!r.ok) throw new TrackerError('mangaupdates', `Login failed: ${r.status} ${text.slice(0, 200)}`);
  const json = JSON.parse(text) as { context?: string; token?: string; error?: string };
  const token = json.context ?? json.token;
  if (!token) throw new TrackerError('mangaupdates', 'Login response did not contain a token.');
  return token;
}

async function push(media: Title, chapterNumber: number, status: ProgressStatus): Promise<void> {
  const conn = await loadConnection('mangaupdates');
  if (!conn?.enabled) throw new TrackerError('mangaupdates', 'Not connected.');

  const seriesId = await resolveSeriesId(conn.token, media);
  if (!seriesId) throw new TrackerError('mangaupdates', `No MangaUpdates series match for "${titleName(media)}".`);

  const listId = await resolveListId(conn.token);
  if (!listId) throw new TrackerError('mangaupdates', 'No reading list found to update.');

  const progress = trackerChapterNumber(chapterNumber);
  const muStatus = status === 'COMPLETED' ? 'Complete' : 'Reading';

  const r = await fetch(`${API_URL}/lists/series/update`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${conn.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        series: { id: seriesId },
        list_id: listId,
        status: { chapter: progress, volume: 0 },
      },
    ]),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new TrackerError('mangaupdates', `Update failed: ${r.status} ${text.slice(0, 200)}`);
  }
}

async function pull(media: Title): Promise<{ chapterNumber: number; status: ProgressStatus } | undefined> {
  const conn = await loadConnection('mangaupdates');
  if (!conn?.enabled) return undefined;
  const seriesId = await resolveSeriesId(conn.token, media);
  if (!seriesId) return undefined;

  const r = await fetch(`${API_URL}/lists/series/${seriesId}`, {
    headers: { Authorization: `Bearer ${conn.token}` },
  });
  if (!r.ok) return undefined;
  const json = (await r.json()) as {
    list?: { status?: { chapter?: number }; series?: { id?: string } };
  };
  const entry = json.list;
  if (!entry || entry.status?.chapter == null) return undefined;
  const chapter = entry.status.chapter;
  const completed = entry.status.chapter != null && media.chapters != null && entry.status.chapter >= media.chapters;
  return { chapterNumber: chapter, status: completed ? 'COMPLETED' : 'READING' };
}

async function resolveSeriesId(token: string, media: Title): Promise<string | undefined> {
  const conn = await loadConnection('mangaupdates');
  const cached = conn?.seriesCache?.[media.id];
  if (cached) return cached;

  const r = await fetch(`${API_URL}/series/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: titleName(media), page: 1, perpage: 10 }),
  });
  if (!r.ok) return undefined;
  const json = (await r.json()) as {
    results?: { record?: { series_id?: string; title?: string } }[];
  };
  const hit = json.results?.[0]?.record;
  if (!hit?.series_id) return undefined;

  await saveConnection({
    ...conn!,
    seriesCache: { ...conn?.seriesCache, [media.id]: hit.series_id },
  });
  return hit.series_id;
}

async function resolveListId(token: string): Promise<string | undefined> {
  const r = await fetch(`${API_URL}/lists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return undefined;
  const json = (await r.json()) as {
    lists?: { list_id?: string; title?: string }[];
  };
  const list = json.lists?.find((l) => /read/i.test(l.title ?? ''));
  return list?.list_id ?? json.lists?.[0]?.list_id;
}
