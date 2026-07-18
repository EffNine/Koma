import { fetchBytes } from '../net';
import { getCachedPage, cacheChapterPages } from './chapterCache';
import { recordHealth } from '../scraper/sourceHealth';

export interface ChapterLoadResult {
  blobUrls: string[];
  failedPages: number[];
  cachedPages: number;
}

export interface ChapterLoadOptions {
  concurrency?: number;
  onPageLoaded?: (index: number, blobUrl: string) => void;
  /** Media ID for caching. If provided, pages will be cached after loading. */
  mediaId?: number;
  /** Source ID for caching and health tracking. */
  sourceId?: string;
  /** Chapter URL for caching. */
  chapterUrl?: string;
}

export async function loadChapterImages(
  urls: string[],
  referer: string,
  signal?: AbortSignal,
  options: ChapterLoadOptions = {},
): Promise<ChapterLoadResult> {
  const blobUrls: string[] = Array(urls.length).fill('');
  const failedPages: number[] = [];
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8));
  let cachedPages = 0;
  let nextIndex = 0;

  // Try loading from cache first
  if (options.mediaId && options.sourceId && options.chapterUrl) {
    for (let i = 0; i < urls.length; i++) {
      if (signal?.aborted) return { blobUrls: revoke(blobUrls), failedPages, cachedPages };
      try {
        const cached = await getCachedPage(options.mediaId, options.sourceId, options.chapterUrl, i);
        if (cached) {
          const blobUrl = URL.createObjectURL(cached);
          blobUrls[i] = blobUrl;
          cachedPages++;
          options.onPageLoaded?.(i, blobUrl);
        }
      } catch {
        // Cache miss, will fetch from network
      }
    }
  }

  async function worker() {
    while (!signal?.aborted) {
      const i = nextIndex++;
      if (i >= urls.length) return;
      // Skip if already loaded from cache
      if (blobUrls[i]) continue;
      await loadOne(i);
    }
  }

  async function loadOne(i: number) {
    try {
      const bytes = await fetchBytes(urls[i], { referer });
      if (signal?.aborted) return { blobUrls: revoke(blobUrls), failedPages, cachedPages };
      const blobUrl = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: guessImageType(urls[i], bytes) }));
      blobUrls[i] = blobUrl;
      options.onPageLoaded?.(i, blobUrl);
    } catch (e) {
        if (signal?.aborted) return { blobUrls: revoke(blobUrls), failedPages, cachedPages };
      failedPages.push(i + 1);
      console.error(e);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  if (signal?.aborted) return { blobUrls: revoke(blobUrls), failedPages, cachedPages };

  // Cache loaded pages in background
  if (options.mediaId && options.sourceId && options.chapterUrl && failedPages.length === 0) {
    cacheChapterPages(options.mediaId, options.sourceId, options.chapterUrl, blobUrls, urls).catch(() => {});
  }

  if (options.sourceId && !signal?.aborted) {
    await recordHealth(
      options.sourceId,
      failedPages.length === 0 ? 'success' : 'failure',
      'page-load',
      failedPages.length ? 'Some pages failed to load' : undefined,
    );
  }

  return { blobUrls, failedPages, cachedPages };
}

export function revokeBlobUrls(urls: string[]): void {
  for (const url of urls) {
    if (url) URL.revokeObjectURL(url);
  }
}

/**
 * Re-fetch only the pages that failed during the initial load.
 * Returns updated blob URLs and the new set of failed pages.
 */
export async function retryFailedPages(
  urls: string[],
  failedPages: number[],
  referer: string,
  signal?: AbortSignal,
  sourceId?: string,
): Promise<ChapterLoadResult> {
  const blobUrls: string[] = Array(urls.length).fill('');
  const stillFailed: number[] = [];

  for (const pageNum of failedPages) {
    if (signal?.aborted) return { blobUrls, failedPages: stillFailed, cachedPages: 0 };
    const i = pageNum - 1;
    if (i < 0 || i >= urls.length) continue;
    try {
      const bytes = await fetchBytes(urls[i], { referer });
      if (signal?.aborted) return { blobUrls, failedPages: stillFailed, cachedPages: 0 };
      const blobUrl = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: guessImageType(urls[i], bytes) }));
      blobUrls[i] = blobUrl;
    } catch {
      stillFailed.push(pageNum);
    }
  }

  if (sourceId && !signal?.aborted) {
    await recordHealth(
      sourceId,
      stillFailed.length === 0 ? 'success' : 'failure',
      'page-load',
      stillFailed.length ? 'Retry still failed' : undefined,
    );
  }

  return { blobUrls, failedPages: stillFailed, cachedPages: 0 };
}

export function categorizeFailure(e: unknown): string {
  const msg = String(e);
  if (msg.includes('proxy') || msg.includes('proxy 0') || msg.includes('proxy 502') || msg.includes('proxy 503')) {
    return 'The scraper proxy is unavailable or returned an error. Check that the proxy is running and reachable.';
  }
  if (msg.includes('No page images') || msg.includes('No pages')) {
    return 'The reading site returned no image URLs for this chapter. The chapter may be unavailable or the site format may have changed.';
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) {
    return 'The image fetch timed out. The CDN may be slow or blocking requests. Try retrying or switching groups.';
  }
  if (msg.match(/\b(4\d\d|5\d\d)\b/)) {
    return `The reading site returned HTTP ${msg.match(/\b(4\d\d|5\d\d)\b/)?.[0] ?? 'error'}. The chapter may be restricted or unavailable.`;
  }
  return msg;
}

/**
 * Warm the first few pages of a chapter through the real fetch path
 * (proxy / fetch_raw with referer), so next-chapter transitions are less cold.
 * Failures are ignored — preload is best-effort.
 */
export async function warmChapterPages(
  urls: string[],
  referer: string,
  count = 3,
  signal?: AbortSignal,
): Promise<number> {
  const n = Math.min(Math.max(0, count), urls.length);
  let warmed = 0;
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) return warmed;
    try {
      await fetchBytes(urls[i], { referer });
      warmed++;
    } catch {
      // preload failure is non-critical
    }
  }
  return warmed;
}

function revoke(urls: string[]): string[] {
  revokeBlobUrls(urls);
  return Array(urls.length).fill('');
}

function toBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as BlobPart;
}

function guessImageType(url: string, bytes: Uint8Array): string {
  const ext = url.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (bytes.length > 2) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
    if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
  }
  return 'image/jpeg';
}
