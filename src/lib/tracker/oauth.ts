import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { start as startServer, cancel as cancelServer, onUrl, onInvalidUrl } from '@fabianlars/tauri-plugin-oauth';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface OAuthResult {
  redirectUrl: string;
  redirectUri: string;
}

export interface OAuthFlow {
  start(): Promise<OAuthResult>;
  cancel(): void;
}

export function oauthAvailable(): boolean {
  return isTauri;
}

export function generateCodeVerifier(length = 128): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let out = '';
  const crypto = window.crypto;
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

export async function codeChallenge(verifier: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await window.crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateState(): string {
  return generateCodeVerifier(32);
}

interface OAuthOptions {
  authorizeUrl: string;
  clientId: string;
  responseType?: 'code' | 'token';
  extraParams?: Record<string, string>;
  title?: string;
  /** Fixed port(s) to bind the OAuth callback server. First available is used. */
  ports?: number[];
}

interface OAuthAuthorizeUrlOptions {
  authorizeUrl: string;
  clientId: string;
  redirectUri: string;
  responseType?: 'code' | 'token';
  extraParams?: Record<string, string>;
}

export function buildOAuthAuthorizeUrl(options: OAuthAuthorizeUrlOptions): string {
  const url = new URL(options.authorizeUrl);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', options.responseType ?? 'code');
  for (const [k, v] of Object.entries(options.extraParams ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export function startOAuth(options: OAuthOptions): OAuthFlow {
  if (!isTauri) {
    throw new Error('OAuth is only available in the Tauri desktop app.');
  }

  let webview: WebviewWindow | undefined;
  let port = 0;
  let done = false;
  let unlistenUrl: (() => void) | undefined;
  let unlistenInvalid: (() => void) | undefined;
  let rejectRef: ((reason?: unknown) => void) | undefined;

  async function start(): Promise<OAuthResult> {
    port = await startServer({
      ports: options.ports,
      response: '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee}p{font-size:1.25rem}</style></head><body><p>Authorization complete. You may close this window.</p></body></html>',
    });
    const redirectUri = `http://localhost:${port}`;
    const authUrl = buildOAuthAuthorizeUrl({ ...options, redirectUri });

    return new Promise<OAuthResult>(async (resolve, reject) => {
      rejectRef = reject;

      unlistenUrl = await onUrl((redirectUrl) => {
        if (done) return;
        if (!redirectUrl.startsWith(redirectUri)) return;
        const parsed = new URL(redirectUrl);
        // The Tauri OAuth plugin emits the full browser URL via an injected
        // callback script. Code grants arrive as query params; implicit grants
        // arrive in the hash; provider errors usually arrive as query params.
        if (parsed.searchParams.has('code') || parsed.searchParams.has('error') || parsed.hash) {
          done = true;
          resolve({ redirectUrl, redirectUri });
          // Give the webview a moment to render the server's response page
          // before tearing down the server/window, otherwise the load can fail
          // with "TypeError: Load failed".
          setTimeout(cleanup, 600);
          return;
        }
      });

      unlistenInvalid = await onInvalidUrl((error) => {
        if (done) return;
        console.warn('[oauth] invalid redirect URL:', error);
      });

      webview = new WebviewWindow('koma-oauth', {
        url: authUrl,
        title: options.title ?? 'Connect Tracker',
        width: 520,
        height: 720,
        center: true,
        focus: true,
      });

      webview.once('tauri://error', (e: unknown) => {
        if (done) return;
        done = true;
        cleanup();
        const msg = typeof e === 'object' && e !== null
          ? JSON.stringify(e)
          : String(e);
        reject(new Error('Failed to open auth window: ' + msg));
      });

      webview.once('tauri://destroyed', () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('Auth window was closed before completing.'));
      });
    });
  }

  function cancel() {
    done = true;
    cleanup();
  }

  function cleanup() {
    rejectRef = undefined;
    unlistenUrl?.();
    unlistenUrl = undefined;
    unlistenInvalid?.();
    unlistenInvalid = undefined;
    webview?.close().catch(() => {});
    webview = undefined;
    if (port) {
      cancelServer(port).catch(() => {});
      port = 0;
    }
  }

  return { start, cancel };
}
