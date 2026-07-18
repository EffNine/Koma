import { media as loadCatalogTitle } from '../catalog/anilist';
import type { Title } from '../catalog/types';
import type { ChapterResolution } from '../media/chapterResolver';
import { resolveChapters as resolveSourceChapters } from '../media/chapterResolver';
import {
  findFallbackChapter as findFallback,
  type FallbackResult,
  withRetryOnce,
  extractChapterNumber,
} from '../media/fallback';
import {
  getTitlePreference as loadTitlePreference,
  type TitlePreference,
} from '../media/titlePreferences';
import type { ScrapedChapter } from '../scraper/engine';
import { getChapters as loadSourceChapters, getPages as loadSourcePages } from '../scraper/scraper';
import { enabledSources as loadEnabledSources, getSource as loadSource, type Source } from '../scraper/sources';
import { recordHealth as recordSourceHealth } from '../scraper/sourceHealth';
import {
  loadReaderState as loadSavedReaderState,
  type ReaderState,
} from './state';
import {
  loadReaderSettings as loadDefaultReaderSettings,
  type ReaderSettings,
} from './settings';

export type ReaderSessionPhase = 'resolving' | 'retrying' | 'fallback' | 'loading' | '';

export interface ReaderChapterSessionInput {
  mediaId: number;
  sourceId: string;
  seriesUrl: string;
  chapterUrl: string;
  signal?: AbortSignal;
  onPhase?: (phase: ReaderSessionPhase) => void;
}

export type ResolveChaptersFn = (
  source: Source,
  title: Title,
) => Promise<ChapterResolution | { err: string }>;

export interface ReaderChapterSessionDeps {
  media?: (mediaId: number) => Promise<Title | undefined>;
  getSource?: (sourceId: string) => Promise<Source | undefined>;
  enabledSources?: () => Promise<Source[]>;
  resolveChapters?: ResolveChaptersFn;
  getPages?: (source: Source, chapterUrl: string) => Promise<string[]>;
  getChapters?: (source: Source, seriesUrl: string) => Promise<ScrapedChapter[]>;
  loadReaderState?: (
    mediaId: number,
    sourceId: string,
    chapterUrl: string,
  ) => Promise<ReaderState | undefined>;
  loadReaderSettings?: () => Promise<ReaderSettings>;
  getTitlePreference?: (mediaId: number) => Promise<TitlePreference | undefined>;
  recordHealth?: (
    sourceId: string,
    outcome: 'success' | 'failure',
    kind: 'chapter-resolution' | 'page-load',
    error?: unknown,
  ) => Promise<void>;
  findFallbackChapter?: (
    title: Title,
    currentSourceId: string,
    currentChapterUrl: string,
  ) => Promise<FallbackResult | null>;
  retryDelayMs?: number;
}

export type ReaderChapterSessionResult =
  | {
      status: 'ready';
      title: Title;
      source: Source;
      sourceId: string;
      seriesUrl: string;
      chapterUrl: string;
      pageUrls: string[];
      chapters: ScrapedChapter[];
      saved?: ReaderState;
      settings: ReaderSettings;
      titlePreference?: TitlePreference;
    }
  | {
      status: 'redirect';
      route: string;
      /** Human-readable source name for toast copy when auto-switching. */
      sourceName?: string;
      reason?: 'fallback' | 'missing-source';
    };

export async function resolveReaderChapterSession(
  input: ReaderChapterSessionInput,
  deps: ReaderChapterSessionDeps = {},
): Promise<ReaderChapterSessionResult> {
  const media = deps.media ?? loadCatalogTitle;
  const getSource = deps.getSource ?? loadSource;
  const enabledSources = deps.enabledSources ?? loadEnabledSources;
  const resolveChapters = deps.resolveChapters ?? resolveSourceChapters;
  const getPages = deps.getPages ?? loadSourcePages;
  const getChapters = deps.getChapters ?? loadSourceChapters;
  const loadReaderState = deps.loadReaderState ?? loadSavedReaderState;
  const loadReaderSettings = deps.loadReaderSettings ?? loadDefaultReaderSettings;
  const getTitlePreference = deps.getTitlePreference ?? loadTitlePreference;
  const recordHealth = deps.recordHealth ?? recordSourceHealth;
  const findFallbackChapter = deps.findFallbackChapter ?? findFallback;

  const title = await media(input.mediaId);
  if (!title) throw new Error(`Catalog title ${input.mediaId} was not found.`);
  if (input.signal?.aborted) throw new Error('aborted');

  const source = await getSource(input.sourceId);
  if (!source) {
    return resolveMissingSourceRedirect(input, title, enabledSources, resolveChapters);
  }

  let pageUrls: string[];
  try {
    pageUrls = await withRetryOnce(async () => {
      const urls = await getPages(source, input.chapterUrl);
      if (urls.length === 0) throw new Error('No page images were extracted for this chapter.');
      return urls;
    }, deps.retryDelayMs ?? 800, () => input.onPhase?.('retrying'), input.signal);
    await recordHealth(source.id, 'success', 'page-load');
  } catch (e) {
    await recordHealth(source.id, 'failure', 'page-load', e);
    input.onPhase?.('fallback');
    const fallback = await findFallbackChapter(title, source.id, input.chapterUrl);
    input.onPhase?.('');
    if (fallback) {
      return {
        status: 'redirect',
        route: readerRoute(input.mediaId, fallback.source.id, fallback.seriesUrl, fallback.chapter.url),
        sourceName: fallback.source.name,
        reason: 'fallback',
      };
    }
    throw e;
  }

  const [chapters, saved, settings, titlePreference] = await Promise.all([
    input.seriesUrl
      ? getChapters(source, safeDecodeRouteParam(input.seriesUrl)).catch(() => [] as ScrapedChapter[])
      : Promise.resolve([] as ScrapedChapter[]),
    loadReaderState(input.mediaId, source.id, input.chapterUrl),
    loadReaderSettings(),
    getTitlePreference(input.mediaId),
  ]);

  input.onPhase?.('loading');
  return {
    status: 'ready',
    title,
    source,
    sourceId: source.id,
    seriesUrl: input.seriesUrl,
    chapterUrl: input.chapterUrl,
    pageUrls,
    chapters,
    saved,
    settings,
    titlePreference,
  };
}

async function resolveMissingSourceRedirect(
  input: ReaderChapterSessionInput,
  title: Title,
  enabledSources: () => Promise<Source[]>,
  resolveChapters: ResolveChaptersFn,
): Promise<ReaderChapterSessionResult> {
  const targetNumber = extractChapterNumber(input.chapterUrl);
  const sources = await enabledSources();
  for (const source of sources) {
    const result = await resolveChapters(source, title).catch(() => null);
    if (!result || 'err' in result || result.chapters.length === 0) continue;
    const match = targetNumber
      ? result.chapters.find((chapter) => chapter.number === targetNumber)
      : undefined;
    if (match) {
      return {
        status: 'redirect',
        route: readerRoute(input.mediaId, source.id, result.seriesUrl, match.url),
        sourceName: source.name,
        reason: 'missing-source',
      };
    }
  }

  throw new Error(
    'Saved source was removed. Re-add it in Settings, or open this title from the Media page to auto-resolve.',
  );
}

function readerRoute(mediaId: number, sourceId: string, seriesUrl: string, chapterUrl: string): string {
  return `/reader/${mediaId}/${sourceId}/${encodeURIComponent(seriesUrl)}/${encodeURIComponent(chapterUrl)}`;
}

function safeDecodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
