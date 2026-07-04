import type { Title } from '../catalog/types';
import type { ScrapedChapter } from '../scraper/engine';
import { enabledSources, type Source } from '../scraper/sources';
import { loadSourceHealth, rankSources } from '../scraper/sourceHealth';
import { resolveChapters, type ChapterResolution } from './chapterResolver';

export interface FallbackResult {
  source: Source;
  seriesUrl: string;
  chapter: ScrapedChapter;
}

export type ResolveChaptersFn = (source: Source, title: Title) => Promise<ChapterResolution | { err: string }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry an async operation once after a short delay. */
export async function withRetryOnce<T>(
  fn: () => Promise<T>,
  delayMs = 800,
  onRetry?: () => void,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (signal?.aborted) throw e;
    onRetry?.();
    if (signal?.aborted) throw e;
    await sleep(delayMs);
    if (signal?.aborted) throw e;
    return fn();
  }
}

export function extractChapterNumber(chapterUrl: string): string | undefined {
  const lastSegment = chapterUrl.split('/').filter(Boolean).pop() ?? '';
  const match = lastSegment.match(/(\d+(?:\.\d+)?)/);
  return match?.[1];
}

/**
 * Find another enabled source that can resolve the same title and chapter.
 * Sources are tried in health/priority order, excluding the current one.
 */
export async function findFallbackChapter(
  title: Title,
  currentSourceId: string,
  currentChapterUrl: string,
  resolve: ResolveChaptersFn = resolveChapters,
  attempted: Set<string> = new Set(),
): Promise<FallbackResult | null> {
  const all = await enabledSources();
  const health = await loadSourceHealth(all);
  const ranked = rankSources(all, health, currentSourceId).filter(
    (s) => s.id !== currentSourceId && !attempted.has(s.id),
  );

  const targetNumber = extractChapterNumber(currentChapterUrl);

  for (const source of ranked) {
    const result = await resolve(source, title).catch(() => null);
    if (!result || 'err' in result || result.chapters.length === 0) continue;

    const match = targetNumber !== undefined
      ? result.chapters.find((c) => c.number === targetNumber)
      : result.chapters.find((c) => c.url === currentChapterUrl);

    if (match) {
      return { source, seriesUrl: result.seriesUrl, chapter: match };
    }
  }

  return null;
}
