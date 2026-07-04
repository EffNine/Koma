import { htmlDriver } from './htmlDriver';
import { comickDriver } from './comickDriver';
import { comickApiDriver } from './comickApiDriver';
import type { ScrapedChapter, ScrapedSeries } from './engine';
import type { Source } from './sources';

export interface ScraperDriver {
  findSeries(source: Source, query: string): Promise<ScrapedSeries | null>;
  getChapters(source: Source, seriesUrl: string): Promise<ScrapedChapter[]>;
  getPages(source: Source, chapterUrl: string): Promise<string[]>;
}

export type DriverId = 'html' | 'comick' | 'comick-api';

/** Pluggable driver registry. Add new content sources here or at runtime via registerDriver. */
export const DRIVERS: Record<DriverId, ScraperDriver> = {
  html: htmlDriver,
  comick: comickDriver,
  'comick-api': comickApiDriver,
};

/** Register or override a driver at runtime (useful for tests / extensions). */
export function registerDriver(id: DriverId, driver: ScraperDriver): void {
  DRIVERS[id] = driver;
}

const DRIVER_IDS = new Set<DriverId>(['html', 'comick', 'comick-api']);

/** Resolve the driver for a source from its preset. */
export function driverFor(source: Source): ScraperDriver {
  const id = DRIVER_IDS.has(source.preset as DriverId) ? (source.preset as DriverId) : 'html';
  return DRIVERS[id] ?? htmlDriver;
}
