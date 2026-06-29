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

const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const API_URL = 'https://api.myanimelist.net/v2';

export interface MalAdapterOptions {
  clientId: string;
}

const DEFAULT_OPTIONS: MalAdapterOptions = { clientId: '' };
let options = { ...DEFAULT_OPTIONS };

export function configureMal(opts: MalAdapterOptions): void {
  options = { ...options, ...opts };
}

export function createMalAdapter(): TrackerAdapter {
  return {
    id: 'mal',
    name: 'MyAnimeList',
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
  return isConnectionEnabled('mal');
}

async function connect(): Promise<TrackerConnection> {
  if (!options.clientId) {
    throw new TrackerError('mal', 'MAL client id is not configured.');
  }
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = await codeChallenge(verifier);

  const flow = startOAuth({
    authorizeUrl: AUTH_URL,
    clientId: options.clientId,
    title: 'Connect MyAnimeList',
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
    throw new TrackerError('mal', 'OAuth flow failed', e);
  }

  const url = new URL(redirectUrl);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) throw new TrackerError('mal', 'No authorization code returned.');
  if (returnedState !== state) throw new TrackerError('mal', 'OAuth state mismatch.');

  const { token, refreshToken } = await exchangeCode(code, verifier, redirectUri);
  const userName = await fetchUser(token);

  const conn: TrackerConnection = {
    id: 'mal',
    enabled: true,
    token,
    refreshToken,
    userName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveConnection(conn);
  return conn;
}

async function disconnect(): Promise<void> {
  await removeConnection('mal');
}

async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<{ token: string; refreshToken?: string }> {
  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('client_id', options.clientId);
  params.set('code', code);
  params.set('code_verifier', verifier);

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await r.text();
  if (!r.ok) throw new TrackerError('mal', `Token exchange failed: ${r.status} ${text.slice(0, 200)}`);
  const json = parseFormEncoded(text) as { access_token?: string; refresh_token?: string; error?: string };
  if (json.error || !json.access_token) throw new TrackerError('mal', json.error ?? 'No access token.');
  return { token: json.access_token, refreshToken: json.refresh_token };
}

function parseFormEncoded(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(text)) {
    out[k] = v;
  }
  return out;
}

async function fetchUser(token: string): Promise<string | undefined> {
  try {
    const r = await malGet(token, '/users/@me');
    const json = (await r.json()) as { name?: string };
    return json.name;
  } catch {
    return undefined;
  }
}

async function push(media: Title, chapterNumber: number, status: ProgressStatus): Promise<void> {
  const conn = await loadConnection('mal');
  if (!conn?.enabled) throw new TrackerError('mal', 'Not connected.');
  const malId = media.idMal;
  if (!malId) throw new TrackerError('mal', 'Title has no MAL id.');
  const progress = trackerChapterNumber(chapterNumber);
  const malStatus = status === 'COMPLETED' ? 'completed' : 'reading';
  const body = new URLSearchParams();
  body.set('num_chapters_read', String(progress));
  body.set('status', malStatus);

  const r = await fetch(`${API_URL}/manga/${malId}/my_list_status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${conn.token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new TrackerError('mal', `Update failed: ${r.status} ${text.slice(0, 200)}`);
  }
}

async function pull(media: Title): Promise<{ chapterNumber: number; status: ProgressStatus } | undefined> {
  const conn = await loadConnection('mal');
  if (!conn?.enabled) return undefined;
  const malId = media.idMal;
  if (!malId) return undefined;
  const r = await malGet(conn.token, `/manga/${malId}?fields=my_list_status{num_chapters_read,status}`);
  if (!r.ok) return undefined;
  const json = (await r.json()) as {
    my_list_status?: { num_chapters_read?: number; status?: string };
  };
  const entry = json.my_list_status;
  if (!entry || entry.num_chapters_read == null) return undefined;
  return {
    chapterNumber: entry.num_chapters_read,
    status: entry.status === 'completed' ? 'COMPLETED' : 'READING',
  };
}

async function malGet(token: string, path: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
