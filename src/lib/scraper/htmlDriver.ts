import { fetchText } from '../net';
import { extractSeriesLinks, extractChapters, extractPages, matchSeries } from './engine';
import { searchUrl } from './presets';
import type { ScraperDriver } from './driver';
import type { Source } from './sources';

export const htmlDriver: ScraperDriver = {
  async findSeries(source: Source, query: string) {
    const html = await fetchText(searchUrl(source, query), { referer: source.url });
    return matchSeries(extractSeriesLinks(html, source), query);
  },
  async getChapters(source: Source, seriesUrl: string) {
    const html = await fetchText(seriesUrl, { referer: source.url });
    return extractChapters(html, source);
  },
  async getPages(source: Source, chapterUrl: string) {
    const html = await fetchText(chapterUrl, { referer: source.url });
    return extractPages(html, source);
  },
};
