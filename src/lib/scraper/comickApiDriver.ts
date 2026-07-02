import { compareChapterAsc, extractPages, matchSeries } from './engine';
import type { ScraperDriver } from './driver';
import type { Source } from './sources';
import { fetchText } from '../net';
import { fingerprint } from './fingerprint';

// Comick Source API — a unified REST API that proxies 50+ manga sources.
// Handles search + chapter listing. Page images fall back to scraping the
// upstream chapter HTML since the API only serves metadata.
// Docs: https://comick-source-api.notaspider.dev

const API_BASE = 'https://comick-source-api.notaspider.dev/api';

interface ApiSearchResult {
  id: string;
  title: string;
  url: string;
  coverImage?: string;
  latestChapter?: number;
  lastUpdated?: string;
  rating?: number;
}

interface ApiChapterResult {
  id: string;
  number: number;
  title: string;
  url: string;
}

interface ApiSearchResponse {
  results: ApiSearchResult[];
  source: string;
}

interface ApiChaptersResponse {
  chapters: ApiChapterResult[];
  source: string;
  totalChapters: number;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Comick API ${r.status}`);
  const text = await r.text();
  // Guard against non-JSON responses
  if (!text.startsWith('{') && !text.startsWith('[')) {
    throw new Error(`Comick API returned non-JSON: ${text.substring(0, 100)}`);
  }
  return JSON.parse(text) as T;
}

export function upstreamHtmlSource(source: Source, chapterUrl: string, html: string): Source {
  const origin = new URL(chapterUrl).origin + '/';
  return {
    ...source,
    id: new URL(origin).host,
    name: new URL(origin).host,
    url: origin,
    preset: fingerprint(html) || 'madara',
  };
}

export const comickApiDriver: ScraperDriver = {
  async findSeries(source: Source, query: string) {
    const apiSource = source.config?.apiSourceId || 'atsumoe';
    const data = await apiPost<ApiSearchResponse>('/search', { query, source: apiSource });
    if (!data.results?.length) return null;
    const candidates = data.results.map((r) => ({
      url: r.url,
      title: r.title,
    }));
    return matchSeries(candidates, query);
  },

  async getChapters(source: Source, seriesUrl: string) {
    const apiSource = source.config?.apiSourceId || 'atsumoe';
    const data = await apiPost<ApiChaptersResponse>('/chapters', { url: seriesUrl, source: apiSource });
    if (!data.chapters?.length) return [];
    return data.chapters.map((ch) => ({
      url: ch.url,
      number: String(ch.number),
      title: ch.title || `Chapter ${ch.number}`,
    })).sort((a, b) => compareChapterAsc(a.number, b.number));
  },

  async getPages(source: Source, chapterUrl: string) {
    // The API doesn't serve page images. Fetch the upstream chapter page and
    // scrape it with the upstream site's own detected HTML preset.
    try {
      const referer = new URL(chapterUrl).origin + '/';
      const html = await fetchText(chapterUrl, { referer });
      return extractPages(html, upstreamHtmlSource(source, chapterUrl, html));
    } catch {
      return [];
    }
  },
};
