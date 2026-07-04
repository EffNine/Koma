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

export async function fetchRaw(
  url: string,
  opts: { referer?: string; headers?: Record<string, string> } = {},
): Promise<RawResp> {
  if (isTauri) {
    return invoke<RawResp>('fetch_raw', {
      url,
      referer: opts.referer ?? null,
      headers: opts.headers ?? null,
    });
  }
  const u = PROXY.startsWith('/')
    ? new URL(PROXY, window.location.origin)
    : new URL(PROXY);
  u.searchParams.set('url', url);
  if (opts.referer) u.searchParams.set('referer', opts.referer);
  if (opts.headers && Object.keys(opts.headers).length > 0) {
    u.searchParams.set('headers', JSON.stringify(opts.headers));
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

function bytesOf(resp: RawResp): Uint8Array {
  const bin = atob(resp.body_b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function textOf(resp: RawResp): string {
  return new TextDecoder().decode(bytesOf(resp));
}
export async function fetchText(
  url: string,
  opts?: { referer?: string; headers?: Record<string, string> },
): Promise<string> {
  return textOf(await fetchRaw(url, opts));
}
export async function fetchBytes(
  url: string,
  opts?: { referer?: string; headers?: Record<string, string> },
): Promise<Uint8Array> {
  return bytesOf(await fetchRaw(url, opts));
}
export async function fetchJson<T = unknown>(
  url: string,
  opts?: { referer?: string; headers?: Record<string, string> },
): Promise<T> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }
}
