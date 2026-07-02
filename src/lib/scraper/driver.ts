import type { ScrapedChapter, ScrapedSeries } from './engine';
import type { Source } from './sources';

export interface ScraperDriver {
  findSeries(source: Source, query: string): Promise<ScrapedSeries | null>;
  getChapters(source: Source, seriesUrl: string): Promise<ScrapedChapter[]>;
  getPages(source: Source, chapterUrl: string): Promise<string[]>;
}

export type DriverId = 'html';
