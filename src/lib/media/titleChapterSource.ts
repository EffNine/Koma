import type { Title } from '../catalog/types';
import type { ScrapedChapter } from '../scraper/engine';
import { enabledSources, type Source } from '../scraper/sources';
import {
  loadSourceHealth,
  rankSources,
  type SourceHealth,
} from '../scraper/sourceHealth';
import { titleNotFoundMessage } from '../ui/readingSiteCopy';
import { getTitlePreference, type TitlePreference } from './titlePreferences';
import { resolveChapters, type ChapterResolution } from './chapterResolver';

export type ResolveChaptersFn = (
  source: Source,
  title: Title,
) => Promise<ChapterResolution | { err: string }>;

export interface TitleChapterSourceDeps {
  enabledSources?: () => Promise<Source[]>;
  getTitlePreference?: (mediaId: number) => Promise<TitlePreference | undefined>;
  loadSourceHealth?: (sources: Source[]) => Promise<Record<string, SourceHealth>>;
  rankSources?: (
    sources: Source[],
    healthById: Record<string, SourceHealth>,
    preferredSourceId?: string,
  ) => Source[];
  resolveChapters?: ResolveChaptersFn;
}

export type TitleChapterSourceResult =
  | {
      status: 'no-sources';
      sources: Source[];
      preference?: TitlePreference;
    }
  | {
      status: 'resolved';
      sources: Source[];
      source: Source;
      seriesUrl: string;
      chapters: ScrapedChapter[];
      preference?: TitlePreference;
      message: string;
    }
  | {
      status: 'not-found';
      sources: Source[];
      preference?: TitlePreference;
      message: string;
    };

export async function resolveTitleChapterSource(
  title: Title,
  deps: TitleChapterSourceDeps = {},
): Promise<TitleChapterSourceResult> {
  const loadPreference = deps.getTitlePreference ?? getTitlePreference;
  const listEnabledSources = deps.enabledSources ?? enabledSources;
  const loadHealth = deps.loadSourceHealth ?? loadSourceHealth;
  const rank = deps.rankSources ?? rankSources;
  const resolve = deps.resolveChapters ?? resolveChapters;

  const preference = await loadPreference(title.id);
  const allSources = await listEnabledSources();
  if (allSources.length === 0) {
    return { status: 'no-sources', sources: [], preference };
  }

  const health = await loadHealth(allSources);
  const ranked = rank(allSources, health, preference?.preferredSourceId);

  for (const source of ranked) {
    try {
      const result = await resolve(source, title);
      if ('err' in result || result.chapters.length === 0) continue;
      return {
        status: 'resolved',
        sources: ranked,
        source,
        seriesUrl: result.seriesUrl,
        chapters: result.chapters,
        preference,
        message: result.msg,
      };
    } catch {
      continue;
    }
  }

  return {
    status: 'not-found',
    sources: ranked,
    preference,
    message: titleNotFoundMessage(ranked.map((source) => source.name)),
  };
}
