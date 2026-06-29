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
import { codeChallenge, generateCodeVerifier, generateState, oauthAvailable, startOAuth } from '../oauth';

const AUTH_URL = 'https://anilist.co/api/v2/oauth/authorize';
const TOKEN_URL = 'https://anilist.co/api/v2/oauth/token';
const GQL_URL = 'https://graphql.anilist.co';

export interface AniListAdapterOptions {
  clientId: string;
  clientSecret?: string;
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
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = await codeChallenge(verifier);

  const flow = startOAuth({
    authorizeUrl: AUTH_URL,
    clientId: options.clientId,
    title: 'Connect AniList',
    extraParams: {
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    },
  });

  let redirectUrl: string;
  let redirectUri: string;
  try {
    ({ redirectUrl, redirectUri } = await flow.start());
  } catch (e) {
    flow.cancel();
    throw new TrackerError('anilist', 'OAuth flow failed', e);
  }

  const url = new URL(redirectUrl);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) throw new TrackerError('anilist', 'No authorization code returned.');
  if (returnedState !== state) throw new TrackerError('anilist', 'OAuth state mismatch.');

  const token = await exchangeCode(code, verifier, redirectUri);
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

async function disconnect(): Promise<void> {
  await removeConnection('anilist');
}

async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('client_id', options.clientId);
  if (options.clientSecret) params.set('client_secret', options.clientSecret);
  params.set('redirect_uri', redirectUri);
  params.set('code', code);
  params.set('code_verifier', verifier);

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!r.ok) throw new TrackerError('anilist', `Token exchange failed: ${r.status}`);
  const json = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (json.error) throw new TrackerError('anilist', `${json.error}: ${json.error_description ?? ''}`);
  if (!json.access_token) throw new TrackerError('anilist', 'No access token in response.');
  return json.access_token;
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

async function pull(media: Title): Promise<{ chapterNumber: number; status: ProgressStatus } | undefined> {
  const conn = await loadConnection('anilist');
  if (!conn?.enabled) return undefined;
  const data = await gql<{ MediaList?: { progress?: number; status?: string } }>(
    conn.token,
    `query($mediaId:Int){MediaList(mediaId:$mediaId){progress status}}`,
    { mediaId: media.id },
  );
  const entry = data.MediaList;
  if (!entry || entry.progress == null) return undefined;
  return {
    chapterNumber: entry.progress,
    status: entry.status === 'COMPLETED' ? 'COMPLETED' : 'READING',
  };
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await r.text();
  let json: { errors?: { message: string }[]; data?: T } | undefined;
  try {
    json = JSON.parse(text) as { errors?: { message: string }[]; data?: T };
  } catch {
    throw new TrackerError('anilist', `AniList returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!r.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join('; ') ?? `HTTP ${r.status}`;
    throw new TrackerError('anilist', msg);
  }
  if (json.data === undefined) throw new TrackerError('anilist', 'Empty GraphQL response.');
  return json.data as T;
}
