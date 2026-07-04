import { titleAliases } from '../catalog/types';
import type { Title } from '../catalog/types';
import type { ScrapedChapter } from '../scraper/engine';
import { findSeries, getChapters, getPages } from '../scraper/scraper';
import type { Source } from '../scraper/sources';
import { recordHealth } from '../scraper/sourceHealth';

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
    try {
      const series = await findSeries(source, alias);
      if (!series) continue;
      const chapters = await getChapters(source, series.url);
      if (chapters.length === 0) {
        await recordHealth(source.id, 'failure', 'chapter-resolution', 'No chapters extracted');
        return {
          query: alias,
          seriesUrl: series.url,
          seriesTitle: series.title || alias,
          chapters,
          msg: `Matched "${series.title || alias}" on ${source.name}, but no chapters were extracted.`,
        };
      }
      await recordHealth(source.id, 'success', 'chapter-resolution');
      return {
        query: alias,
        seriesUrl: series.url,
        seriesTitle: series.title || alias,
        chapters,
        msg: `Matched "${series.title || alias}" on ${source.name}.`,
      };
    } catch (e) {
      await recordHealth(source.id, 'failure', 'chapter-resolution', e);
      throw e;
    }
  }
  await recordHealth(source.id, 'failure', 'chapter-resolution', 'No series match');
  return { err: `No series match found on ${source.name}.` };
}

export async function inspectPages(source: Source, chapter: ScrapedChapter): Promise<PageInspection | { err: string }> {
  try {
    const pageUrls = await getPages(source, chapter.url);
    if (pageUrls.length === 0) {
      await recordHealth(source.id, 'failure', 'page-load', 'No page images');
      return { err: 'No page images were extracted from this chapter.' };
    }
    await recordHealth(source.id, 'success', 'page-load');
    return { chapterTitle: chapter.title || `Chapter ${chapter.number ?? '?'}`, pageUrls };
  } catch (e) {
    await recordHealth(source.id, 'failure', 'page-load', e);
    throw e;
  }
}
