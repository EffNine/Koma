import { titleAliases } from '../catalog/types';
import type { Title } from '../catalog/types';
import type { ScrapedChapter } from '../scraper/engine';
import { findSeries, getChapters, getPages } from '../scraper/scraper';
import type { Source } from '../scraper/sources';

export interface ChapterResolution {
  query: string;
  seriesUrl: string;
  seriesTitle: string;
  chapters: ScrapedChapter[];
  msg: string;
}

export interface PageInspection {
  chapterTitle: string;
  pageUrls: string[];
}

export async function resolveChapters(source: Source, title: Title): Promise<ChapterResolution | { err: string }> {
  for (const alias of titleAliases(title)) {
    const series = await findSeries(source, alias);
    if (!series) continue;
    const chapters = await getChapters(source, series.url);
    const msg = chapters.length
      ? `Matched "${series.title || alias}" on ${source.name}.`
      : `Matched "${series.title || alias}" on ${source.name}, but no chapters were extracted.`;
    return { query: alias, seriesUrl: series.url, seriesTitle: series.title || alias, chapters, msg };
  }
  return { err: `No series match found on ${source.name}.` };
}

export async function inspectPages(source: Source, chapter: ScrapedChapter): Promise<PageInspection | { err: string }> {
  const pageUrls = await getPages(source, chapter.url);
  if (pageUrls.length === 0) return { err: 'No page images were extracted from this chapter.' };
  return { chapterTitle: chapter.title || `Chapter ${chapter.number ?? '?'}`, pageUrls };
}
