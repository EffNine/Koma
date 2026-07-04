import { fetchText } from '../net';
import { compareChapterAsc, matchSeries } from './engine';
import type { ScraperDriver } from './driver';
import type { Source } from './sources';

// ComicK driver — scrapes the SSR HTML pages and API endpoints.
// ComicK embeds JSON data in <script> tags on its SSR pages.
// The chapter-list API endpoint is also directly accessible.

const CK_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

interface CKSearchResult {
  slug: string;
  title: string;
  id: number;
  hid: string;
  default_thumbnail?: string;
  last_chapter?: number;
  country?: string;
  content_rating?: string;
}

interface CKChapterListItem {
  id: number;
  hid: string;
  chap: string;
  title: string;
  lang: string;
  group_name: string[];
  created_at: string;
}

interface CKChapterImage {
  url: string;
  h: number;
  w: number;
  name: string;
}

interface CKChapterData {
  chapter: {
    id: number;
    chap: string;
    hid: string;
    lang: string;
    title: string;
    comic: {
      id: number;
      title: string;
      slug: string;
    };
    images: CKChapterImage[];
  };
  chapterList?: Array<{ hid: string; chap: string; lang: string }>;
}

interface CKChapterListResponse {
  data: CKChapterListItem[];
  pagination?: {
    current_page?: number;
    last_page?: number;
  };
}

function findJson<T>(html: string, matches: (data: unknown) => boolean): T | null {
  for (const m of html.matchAll(/<script[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as T;
      if (matches(data)) return data;
    } catch {
      // Not every script block that starts with "{" is app data.
    }
  }
  return null;
}

/** Extract search results from the ComicK search page. */
export function extractSearchData(html: string): CKSearchResult[] {
  const data = findJson<{ data: CKSearchResult[] }>(
    html,
    (value) => Array.isArray((value as { data?: unknown }).data),
  );
  return data?.data ?? [];
}

/** Extract chapter data from a ComicK chapter page. */
export function extractChapterData(html: string): CKChapterData | null {
  return findJson<CKChapterData>(
    html,
    (value) => Array.isArray((value as { chapter?: { images?: unknown } }).chapter?.images),
  );
}

function baseUrl(source: Source): string {
  return source.url.replace(/\/+$/, '');
}

export const comickDriver: ScraperDriver = {
  async findSeries(source: Source, query: string) {
    const url = `${baseUrl(source)}/search?q=${encodeURIComponent(query)}`;
    const html = await fetchText(url, { referer: source.url, headers: CK_HEADERS });
    const results = extractSearchData(html);
    const candidates = results.map((r) => ({
      url: `${baseUrl(source)}/comic/${r.slug}`,
      title: r.title,
    }));
    return matchSeries(candidates, query);
  },

  async getChapters(source: Source, seriesUrl: string) {
    // Extract the slug from the series URL
    const slug = seriesUrl.split('/').filter(Boolean).pop() ?? '';
    const base = baseUrl(source);
    const apiBase = `${base}/api/comics/${slug}/chapter-list?lang=en`;
    const first = await fetchChapterListPage(apiBase, source.url, 1);
    const lastPage = Math.max(1, first.pagination?.last_page ?? 1);
    const pages = [first, ...(await fetchRemainingChapterPages(apiBase, source.url, lastPage))];
    const seen = new Set<string>();
    return pages
      .flatMap((page) => page.data)
      .filter((ch) => {
        const key = `${ch.hid}:${ch.chap}:${ch.lang}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((ch) => ({
        url: `${base}/comic/${slug}/${ch.hid}-chapter-${ch.chap}-${ch.lang}`,
        number: ch.chap,
        title: ch.title ? `Chapter ${ch.chap}: ${ch.title}` : `Chapter ${ch.chap}`,
        group: ch.group_name?.[0],
        createdAt: ch.created_at,
      }))
      .sort((a, b) => compareChapterAsc(a.number, b.number));
  },

  async getPages(source: Source, chapterUrl: string) {
    const html = await fetchText(chapterUrl, { referer: source.url, headers: CK_HEADERS });
    const data = extractChapterData(html);
    if (!data?.chapter?.images?.length) return [];
    return data.chapter.images.map((img) => img.url);
  },
};

async function fetchChapterListPage(baseUrl: string, referer: string, page: number): Promise<CKChapterListResponse> {
  const sep = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl}${sep}page=${page}`;
  const json = await fetchText(url, { referer, headers: { ...CK_HEADERS, Accept: 'application/json' } });
  return JSON.parse(json) as CKChapterListResponse;
}

async function fetchRemainingChapterPages(baseUrl: string, referer: string, lastPage: number): Promise<CKChapterListResponse[]> {
  const pages: CKChapterListResponse[] = [];
  const concurrency = 6;
  for (let page = 2; page <= lastPage; page += concurrency) {
    const batch = Array.from(
      { length: Math.min(concurrency, lastPage - page + 1) },
      (_, idx) => fetchChapterListPage(baseUrl, referer, page + idx),
    );
    pages.push(...await Promise.all(batch));
  }
  return pages;
}
