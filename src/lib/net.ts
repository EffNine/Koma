import { invoke } from '@tauri-apps/api/core';

// ponytail: one cross-origin fetch primitive. Rust on desktop, proxy on web/PWA (ADR 0001/0002).
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const env = ((import.meta as ImportMeta & {
  env?: { VITE_SCRAPER_PROXY?: string; DEV?: boolean };
}).env ?? {});
const PROXY = env.VITE_SCRAPER_PROXY ?? (env.DEV ? '/__koma_scrape' : 'http://localhost:8788');

export interface RawResp {
  status: number;
  headers: Record<string, string>;
  body_b64: string; // matches the Rust FetchResp field names (serde default)
  final_url: string;
}

export interface FetchOptions {
  referer?: string;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: string;
}

export function fetchRawInvokeArgs(url: string, opts: FetchOptions = {}) {
  const host = new URL(url).host;
  const cfCookies = getStoredCfCookies(host) || null;
  return {
    url,
    referer: opts.referer ?? null,
    headers: opts.headers ?? null,
    cfCookies,
    method: opts.method ?? null,
    bodyB64: opts.body ? btoa(opts.body) : null,
  };
}

// Cloudflare cookie store — persists cookies keyed by hostname.
// On desktop, cookies are stored in the Rust backend.
// On web/PWA, we use localStorage (limited utility since proxy can't use them).
const CF_COOKIES_KEY = 'koma.cf_cookies';

function getCfCookiesSync(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(CF_COOKIES_KEY) || '{}');
  } catch { return {}; }
}

function setCfCookiesSync(store: Record<string, string>) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CF_COOKIES_KEY, JSON.stringify(store));
}

export function getStoredCfCookies(host: string): string {
  return getCfCookiesSync()[host] || '';
}

export function storeCfCookies(host: string, cookies: string) {
  const store = getCfCookiesSync();
  store[host] = cookies;
  setCfCookiesSync(store);
}

export function clearCfCookies(host: string) {
  const store = getCfCookiesSync();
  delete store[host];
  setCfCookiesSync(store);
}

export function listCfCookies(): string[] {
  return Object.keys(getCfCookiesSync());
}

export async function fetchRaw(url: string, opts: FetchOptions = {}): Promise<RawResp> {
  if (isTauri) {
    return invoke<RawResp>('fetch_raw', fetchRawInvokeArgs(url, opts));
  }
  const u = PROXY.startsWith('/')
    ? new URL(PROXY, window.location.origin)
    : new URL(PROXY);
  u.searchParams.set('url', url);
  if (opts.referer) u.searchParams.set('referer', opts.referer);
  if (opts.headers && Object.keys(opts.headers).length > 0) {
    u.searchParams.set('headers', JSON.stringify(opts.headers));
  }
  if (opts.method && opts.method !== 'GET') {
    u.searchParams.set('method', opts.method);
  }
  if (opts.body) {
    u.searchParams.set('body_b64', btoa(opts.body));
  }
  let r: Response;
  try {
    r = await fetch(u.toString());
  } catch (e) {
    throw new Error(
      env.DEV
        ? `Scraper proxy unavailable in browser dev mode: ${String(e)}`
        : String(e),
    );
  }
  if (!r.ok) throw new Error(`proxy ${r.status}`);
  const json = (await r.json()) as RawResp & { error?: string };
  if (json.status === 0 && json.error) throw new Error(json.error);
  return json;
}

/** Unlock a Cloudflare-walled site on desktop. Opens a webview to pass the challenge. */
export async function unlockCloudflare(url: string): Promise<{ host: string; success: boolean; message: string }> {
  if (!isTauri) {
    throw new Error('Cloudflare unlock is only available on the desktop app.');
  }
  const result = await invoke<{ host: string; success: boolean; message: string }>('unlock_cloudflare', { url });
  // Also store in localStorage for persistence
  const host = new URL(url).host;
  const cookies = await invoke<string>('get_cf_cookies', { host });
  if (cookies) {
    storeCfCookies(host, cookies);
  }
  return result;
}

/** Listen for Cloudflare unlock progress events. */
export function onCfUnlockProgress(cb: (progress: { host: string; status: string; message: string }) => void): () => void {
  if (!isTauri) return () => {};
  let unlisten: (() => void) | undefined;
  // Dynamic import to avoid bundling Tauri event API in web builds
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('cf-unlock-progress', (event: any) => {
      cb(event.payload);
    }).then((fn) => { unlisten = fn; });
  });
  return () => { unlisten?.(); };
}

function bytesOf(resp: RawResp): Uint8Array {
  const bin = atob(resp.body_b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function textOf(resp: RawResp): string {
  return new TextDecoder().decode(bytesOf(resp));
}
export async function fetchText(url: string, opts?: FetchOptions): Promise<string> {
  return textOf(await fetchRaw(url, opts));
}
export async function fetchBytes(
  url: string,
  opts?: FetchOptions,
): Promise<Uint8Array> {
  return bytesOf(await fetchRaw(url, opts));
}
export async function fetchJson<T = unknown>(url: string, opts?: FetchOptions): Promise<T> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }
}
