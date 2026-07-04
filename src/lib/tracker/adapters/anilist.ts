import type { Title } from '../../catalog/types';
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
import { generateState, oauthAvailable, startOAuth } from '../oauth';
import { fetchJson, fetchRaw, textOf } from '../../net';

const AUTH_URL = 'https://anilist.co/api/v2/oauth/authorize';
const TOKEN_URL = 'https://anilist.co/api/v2/oauth/token';
const GQL_URL = 'https://graphql.anilist.co';
export const ANILIST_REDIRECT_PORT = 34725;
export const ANILIST_REDIRECT_URI = `http://localhost:${ANILIST_REDIRECT_PORT}`;

export interface AniListAdapterOptions {
  clientId: string;
  clientSecret?: string;
}

export interface AniListLibraryEntry {
  title: Title;
  progress: number;
  status: ProgressStatus;
  remoteStatus?: string;
  updatedAt?: number;
}

const DEFAULT_OPTIONS: AniListAdapterOptions = {
  clientId: '',
  clientSecret: '',
};

let options = { ...DEFAULT_OPTIONS };

export function configureAniList(opts: AniListAdapterOptions): void {
  options = { ...options, ...opts };
}

export function createAniListAdapter(): TrackerAdapter {
  return {
    id: 'anilist',
    name: 'AniList',
    supportsPlatform,
    isConnected,
    connect,
    disconnect,
    push,
    pull,
    follow,
    unfollow,
  };
}

function supportsPlatform(): boolean {
  return oauthAvailable();
}

async function isConnected(): Promise<boolean> {
  return isConnectionEnabled('anilist');
}

async function connect(): Promise<TrackerConnection> {
  if (!options.clientId) {
    throw new TrackerError('anilist', 'AniList client id is not configured.');
  }
  if (!options.clientSecret) {
    throw new TrackerError('anilist', 'AniList client secret is required for the authorization code flow.');
  }

  const state = generateState();

  const flow = startOAuth({
    authorizeUrl: AUTH_URL,
    clientId: options.clientId,
    responseType: 'code',
    title: 'Connect AniList',
    ports: [ANILIST_REDIRECT_PORT],
    extraParams: {
      state,
    },
  });

  let redirectUrl: string;
  let redirectUri: string;
  try {
    ({ redirectUrl, redirectUri } = await flow.start());
  } catch (e) {
    flow.cancel();
    const causeMsg = e instanceof Error ? ` — ${e.message}` : '';
    throw new TrackerError('anilist', `OAuth flow failed${causeMsg}`, e);
  }

  const url = new URL(redirectUrl);
  const authError = url.searchParams.get('error');
  if (authError) {
    const description = url.searchParams.get('error_description');
    throw new TrackerError('anilist', `OAuth authorization failed: ${description ?? authError}`);
  }
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) throw new TrackerError('anilist', 'No authorization code in redirect.');
  if (returnedState !== state) throw new TrackerError('anilist', 'OAuth state mismatch.');

  const token = await exchangeCode(code, redirectUri);
  const userName = await fetchViewer(token);

  const conn: TrackerConnection = {
    id: 'anilist',
    enabled: true,
    token,
    userName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveConnection(conn);
  return conn;
}

async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const body = JSON.stringify({
    grant_type: 'authorization_code',
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const redactedBody = body
    .replace(/"client_secret":"[^"]*"/, '"client_secret":"***"')
    .replace(/"code":"[^"]*"/, '"code":"***"');
  const resp = await fetchRaw(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  });
  const raw = textOf(resp);
  let json: { access_token?: string; error?: string; message?: string };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    throw new TrackerError('anilist', `Token endpoint returned non-JSON. Request: ${redactedBody}. Response: ${raw.slice(0, 500)}`);
  }
  if (json.error || !json.access_token) {
    throw new TrackerError('anilist', `${json.message ?? json.error ?? 'No access token.'} | Request: ${redactedBody} | Response: ${raw.slice(0, 500)}`);
  }
  return json.access_token;
}

async function disconnect(): Promise<void> {
  await removeConnection('anilist');
}

export async function fetchAniListMangaList(): Promise<AniListLibraryEntry[]> {
  const conn = await loadConnection('anilist');
  if (!conn?.enabled || !conn.token) throw new TrackerError('anilist', 'Not connected.');

  const viewer = await gql<{ Viewer?: { id?: number } }>(
    conn.token,
    'query{Viewer{id}}',
    {},
  );
  const userId = viewer.Viewer?.id;
  if (!userId) throw new TrackerError('anilist', 'Could not resolve AniList user.');

  const entries: AniListLibraryEntry[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await gql<{
      Page?: {
        pageInfo?: { hasNextPage?: boolean };
        mediaList?: AniListMediaListRow[];
      };
    }>(
      conn.token,
      `query($userId:Int,$page:Int,$perPage:Int){
        Page(page:$page,perPage:$perPage){
          pageInfo{hasNextPage}
          mediaList(userId:$userId,type:MANGA,sort:UPDATED_TIME_DESC){
            progress
            status
            updatedAt
            media{
              id
              idMal
              title{romaji english native}
              coverImage{large}
              countryOfOrigin
              status
              chapters
              volumes
              genres
              averageScore
              siteUrl
            }
          }
        }
      }`,
      { userId, page, perPage: 50 },
    );

    for (const row of data.Page?.mediaList ?? []) {
      if (!row.media?.id) continue;
      entries.push({
        title: mapAniListMedia(row.media),
        progress: row.progress ?? 0,
        status: row.status === 'COMPLETED' ? 'COMPLETED' : 'READING',
        remoteStatus: row.status,
        updatedAt: row.updatedAt ? row.updatedAt * 1000 : undefined,
      });
    }

    hasNextPage = data.Page?.pageInfo?.hasNextPage ?? false;
    page += 1;
  }

  return entries;
}

interface AniListMediaListRow {
  progress?: number;
  status?: string;
  updatedAt?: number;
  media?: AniListMedia;
}

interface AniListMedia {
  id: number;
  idMal?: number | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  coverImage?: { large?: string | null } | null;
  countryOfOrigin?: string | null;
  status?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  genres?: string[] | null;
  averageScore?: number | null;
  siteUrl?: string | null;
}

function mapAniListMedia(media: AniListMedia): Title {
  return {
    id: media.id,
    idMal: media.idMal ?? undefined,
    title: {
      romaji: media.title?.romaji ?? undefined,
      english: media.title?.english ?? undefined,
      native: media.title?.native ?? undefined,
    },
    cover: media.coverImage?.large ?? undefined,
    country: media.countryOfOrigin ?? undefined,
    status: media.status ?? undefined,
    chapters: media.chapters ?? undefined,
    volumes: media.volumes ?? undefined,
    genres: media.genres ?? undefined,
    averageScore: media.averageScore ?? undefined,
    siteUrl: media.siteUrl ?? undefined,
  };
}

async function fetchViewer(token: string): Promise<string | undefined> {
  try {
    const data = await gql<{ Viewer?: { name?: string } }>(
      token,
      'query{Viewer{name}}',
      {},
    );
    return data.Viewer?.name;
  } catch {
    return undefined;
  }
}

async function push(media: Title, chapterNumber: number, status: ProgressStatus): Promise<void> {
  const conn = await loadConnection('anilist');
  if (!conn?.enabled) throw new TrackerError('anilist', 'Not connected.');
  const progress = trackerChapterNumber(chapterNumber);
  const listStatus = status === 'COMPLETED' ? 'COMPLETED' : 'CURRENT';
  await gql<{ SaveMediaListEntry?: { id: number } }>(
    conn.token,
    `mutation($mediaId:Int,$progress:Int,$status:MediaListStatus){SaveMediaListEntry(mediaId:$mediaId,progress:$progress,status:$status){id}}`,
    { mediaId: media.id, progress, status: listStatus },
  );
}

async function follow(media: Title): Promise<void> {
  const conn = await loadConnection('anilist');
  if (!conn?.enabled) throw new TrackerError('anilist', 'Not connected.');
  const existing = await fetchMediaListEntry(conn.token, media.id);
  if (existing) return;
  await gql<{ SaveMediaListEntry?: { id: number } }>(
    conn.token,
    `mutation($mediaId:Int,$status:MediaListStatus){SaveMediaListEntry(mediaId:$mediaId,status:$status){id}}`,
    { mediaId: media.id, status: 'PLANNING' },
  );
}

async function unfollow(mediaId: number): Promise<void> {
  const conn = await loadConnection('anilist');
  if (!conn?.enabled) throw new TrackerError('anilist', 'Not connected.');
  const existing = await fetchMediaListEntry(conn.token, mediaId);
  if (!existing?.id) return;
  await gql<{ DeleteMediaListEntry?: { deleted?: boolean } }>(
    conn.token,
    `mutation($id:Int){DeleteMediaListEntry(id:$id){deleted}}`,
    { id: existing.id },
  );
}

async function pull(media: Title): Promise<{ chapterNumber: number; status: ProgressStatus } | undefined> {
  const conn = await loadConnection('anilist');
  if (!conn?.enabled) return undefined;
  const entry = await fetchMediaListEntry(conn.token, media.id);
  if (!entry || entry.progress == null) return undefined;
  return {
    chapterNumber: entry.progress,
    status: entry.status === 'COMPLETED' ? 'COMPLETED' : 'READING',
  };
}

async function fetchMediaListEntry(
  token: string,
  mediaId: number,
): Promise<{ id?: number; progress?: number; status?: string } | undefined> {
  try {
    const data = await gql<{ MediaList?: { id?: number; progress?: number; status?: string } }>(
      token,
      `query($mediaId:Int){MediaList(mediaId:$mediaId){id progress status}}`,
      { mediaId },
    );
    return data.MediaList;
  } catch (e) {
    if (e instanceof TrackerError && /not found/i.test(e.message)) return undefined;
    throw e;
  }
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const json = await fetchJson<{ errors?: { message: string }[]; data?: T }>(GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ');
    throw new TrackerError('anilist', msg);
  }
  if (json.data === undefined) throw new TrackerError('anilist', 'Empty GraphQL response.');
  return json.data as T;
}
