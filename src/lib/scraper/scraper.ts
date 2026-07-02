import { presetById } from './presets';
import type { ScrapedChapter, ScrapedSeries } from './engine';
import type { Source } from './sources';
import { htmlDriver } from './htmlDriver';

export async function findSeries(source: Source, query: string): Promise<ScrapedSeries | null> {
  return driverFor(source).findSeries(source, query);
}

export async function getChapters(source: Source, seriesUrl: string): Promise<ScrapedChapter[]> {
  return driverFor(source).getChapters(source, seriesUrl);
}

export async function getPages(source: Source, chapterUrl: string): Promise<string[]> {
  return driverFor(source).getPages(source, chapterUrl);
}

function driverFor(source: Source) {
  const driver = presetById(source.preset)?.driver;
  return htmlDriver;
}
