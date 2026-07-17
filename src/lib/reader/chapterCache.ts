import { db } from '../db';
import { fetchBytes } from '../net';

export interface ChapterCacheEntry {
  key: string;
  mediaId: number;
  sourceId: string;
  chapterUrl: string;
  createdAt: number;
  sizeBytes: number;
}

export interface ChapterCachePage {
  key: string;
  chapterKey: string;
  pageIndex: number;
  blob: Blob;
}

const CACHE_PREFIX = 'ch:';

function chapterKey(mediaId: number, sourceId: string, chapterUrl: string): string {
  return `${CACHE_PREFIX}${mediaId}:${sourceId}:${chapterUrl}`;
}

function pageKey(chapterKey: string, pageIndex: number): string {
  return `${chapterKey}:p${pageIndex}`;
}

export async function getCachedPage(
  mediaId: number,
  sourceId: string,
  chapterUrl: string,
  pageIndex: number,
): Promise<Blob | undefined> {
  const ck = chapterKey(mediaId, sourceId, chapterUrl);
  const entry = await db.chapterCachePages.get(pageKey(ck, pageIndex));
  return entry?.blob;
}

export async function cacheChapterPages(
  mediaId: number,
  sourceId: string,
  chapterUrl: string,
  blobUrls: string[],
  pageUrls: string[],
): Promise<void> {
  const ck = chapterKey(mediaId, sourceId, chapterUrl);
  let totalBytes = 0;

  for (let i = 0; i < blobUrls.length; i++) {
    const blobUrl = blobUrls[i];
    if (!blobUrl) continue;

    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      totalBytes += blob.size;

      await db.chapterCachePages.put({
        key: pageKey(ck, i),
        chapterKey: ck,
        pageIndex: i,
        blob,
      });
    } catch {
      // Skip pages that can't be cached
    }
  }

  if (totalBytes > 0) {
    await db.chapterCache.put({
      key: ck,
      mediaId,
      sourceId,
      chapterUrl,
      createdAt: Date.now(),
      sizeBytes: totalBytes,
    });
  }
}

export async function isChapterCached(
  mediaId: number,
  sourceId: string,
  chapterUrl: string,
): Promise<boolean> {
  const ck = chapterKey(mediaId, sourceId, chapterUrl);
  const entry = await db.chapterCache.get(ck);
  return !!entry;
}

export async function getCachedChapterSize(
  mediaId: number,
  sourceId: string,
  chapterUrl: string,
): Promise<number> {
  const ck = chapterKey(mediaId, sourceId, chapterUrl);
  const entry = await db.chapterCache.get(ck);
  return entry?.sizeBytes ?? 0;
}

export async function removeCachedChapter(
  mediaId: number,
  sourceId: string,
  chapterUrl: string,
): Promise<void> {
  const ck = chapterKey(mediaId, sourceId, chapterUrl);
  await db.chapterCachePages.where('chapterKey').equals(ck).delete();
  await db.chapterCache.delete(ck);
}

export async function clearAllChapterCache(): Promise<void> {
  await db.chapterCachePages.clear();
  await db.chapterCache.clear();
}

export async function getTotalCacheSize(): Promise<number> {
  const entries = await db.chapterCache.toArray();
  return entries.reduce((sum, e) => sum + e.sizeBytes, 0);
}

export async function listCachedChapters(): Promise<ChapterCacheEntry[]> {
  return db.chapterCache.toArray();
}

export async function removeCachedChaptersForMedia(mediaId: number): Promise<void> {
  const entries = await db.chapterCache.where('mediaId').equals(mediaId).toArray();
  for (const entry of entries) {
    await db.chapterCachePages.where('chapterKey').equals(entry.key).delete();
  }
  await db.chapterCache.where('mediaId').equals(mediaId).delete();
}

export interface DownloadProgress {
  loaded: number;
  total: number;
}

export interface CacheByTitle {
  mediaId: number;
  titleName: string;
  chapterCount: number;
  sizeBytes: number;
}

/** Proactively download chapter page images for offline reading. */
export async function downloadChapter(
  mediaId: number,
  sourceId: string,
  chapterUrl: string,
  pageUrls: string[],
  referer: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<{ ok: boolean; failedPages: number[] }> {
  const ck = chapterKey(mediaId, sourceId, chapterUrl);
  let totalBytes = 0;
  const failedPages: number[] = [];

  for (let i = 0; i < pageUrls.length; i++) {
    onProgress?.({ loaded: i, total: pageUrls.length });
    try {
      const existing = await db.chapterCachePages.get(pageKey(ck, i));
      if (existing?.blob) {
        totalBytes += existing.blob.size;
        continue;
      }
      const bytes = await fetchBytes(pageUrls[i], { referer });
      const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as BlobPart], {
        type: guessImageType(pageUrls[i], bytes),
      });
      totalBytes += blob.size;
      await db.chapterCachePages.put({
        key: pageKey(ck, i),
        chapterKey: ck,
        pageIndex: i,
        blob,
      });
    } catch {
      failedPages.push(i + 1);
    }
  }

  if (totalBytes > 0) {
    await db.chapterCache.put({
      key: ck,
      mediaId,
      sourceId,
      chapterUrl,
      createdAt: Date.now(),
      sizeBytes: totalBytes,
    });
  }

  onProgress?.({ loaded: pageUrls.length, total: pageUrls.length });
  return { ok: failedPages.length === 0, failedPages };
}

export async function getCacheBreakdownByTitle(
  titleNames: Map<number, string>,
): Promise<CacheByTitle[]> {
  const entries = await db.chapterCache.toArray();
  const byMedia = new Map<number, { count: number; size: number }>();
  for (const e of entries) {
    const cur = byMedia.get(e.mediaId) ?? { count: 0, size: 0 };
    cur.count++;
    cur.size += e.sizeBytes;
    byMedia.set(e.mediaId, cur);
  }
  return [...byMedia.entries()]
    .map(([mediaId, v]) => ({
      mediaId,
      titleName: titleNames.get(mediaId) ?? `Title ${mediaId}`,
      chapterCount: v.count,
      sizeBytes: v.size,
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes);
}

function guessImageType(url: string, bytes: Uint8Array): string {
  const ext = url.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}
