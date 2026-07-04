import { compareChapterAsc, matchSeries } from './engine';
import type { ScraperDriver } from './driver';
import type { Source } from './sources';
import { fetchJson, fetchText } from '../net';

// Direct api.comick.io driver.
// Talks to the public-ish ComicK REST API instead of scraping SSR HTML.
// Endpoints are reverse-engineered from community clients; the API may change.

const API_BASE = 'https://api.comick.io';

const CK_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

interface CKSearchResult {
  hid: string;
  slug: string;
  title: string;
  id?: number;
  desc?: string;
  md_covers?: Array<{ b2key?: string; url?: string }>;
  md_titles?: Array<{ title?: string }>;
}

interface CKChapterItem {
  hid: string;
  chap: string;
  title?: string;
  lang: string;
  vol?: string | null;
  group_name?: string[];
  created_at?: string;
}

interface CKChapterListResponse {
  chapters: CKChapterItem[];
  total?: number;
}

interface CKImage {
  url?: string;
  b2key?: string;
  name?: string;
}

interface CKChapterResponse {
  chapter?: {
    hid?: string;
    chap?: string;
    lang?: string;
    md_images?: CKImage[];
    images?: CKImage[];
  };
  md_images?: CKImage[];
}

function imageUrl(img: CKImage): string | null {
  if (img.url) return img.url;
  if (img.b2key) return `https://meo.comick.pictures/${img.b2key}`;
  return null;
}

function chapterUrl(source: Source, slug: string, ch: CKChapterItem): string {
  const base = source.url.replace(/\/+$/, '');
  return `${base}/comic/${slug}/${ch.hid}-chapter-${ch.chap}-${ch.lang}`;
}

export const comickApiDriver: ScraperDriver = {
  async findSeries(source: Source, query: string) {
    const url = `${API_BASE}/v1.0/search?q=${encodeURIComponent(query)}&limit=20&page=1`;
    const results = await fetchJson<CKSearchResult[]>(url, {
      referer: source.url,
      headers: CK_HEADERS,
    });
    if (!Array.isArray(results) || results.length === 0) return null;
    const candidates = results.map((r) => ({
      url: `${source.url.replace(/\/+$/, '')}/comic/${r.slug}`,
      title: r.title,
    }));
    return matchSeries(candidates, query);
  },

  async getChapters(source: Source, seriesUrl: string) {
    const slug = seriesUrl.split('/').filter(Boolean).pop() ?? '';
    const hid = await resolveHidBySlug(source, slug);
    if (!hid) return [];
    const url = `${API_BASE}/comic/${hid}/chapters?lang=en&limit=10000`;
    const data = await fetchJson<CKChapterListResponse>(url, {
      referer: source.url,
      headers: CK_HEADERS,
    });
    if (!Array.isArray(data?.chapters)) return [];
    return data.chapters
      .map((ch) => ({
        url: chapterUrl(source, slug, ch),
        number: ch.chap,
        title: ch.title ? `Chapter ${ch.chap}: ${ch.title}` : `Chapter ${ch.chap}`,
        group: ch.group_name?.[0],
        createdAt: ch.created_at,
      }))
      .sort((a, b) => compareChapterAsc(a.number, b.number));
  },

  async getPages(source: Source, chapterUrl: string) {
    // chapterUrl is the website chapter path; extract the chapter hid from it.
    const hid = chapterUrl.split('/').filter(Boolean).pop()?.split('-')[0] ?? '';
    if (!hid) return [];
    const url = `${API_BASE}/chapter/${hid}`;
    const data = await fetchJson<CKChapterResponse>(url, {
      referer: source.url,
      headers: CK_HEADERS,
    });
    const images = data?.chapter?.md_images ?? data?.chapter?.images ?? data?.md_images ?? [];
    return images.map(imageUrl).filter((u): u is string => !!u);
  },
};

async function resolveHidBySlug(source: Source, slug: string): Promise<string | null> {
  // The API search returns hid directly; try a slug search first.
  const url = `${API_BASE}/v1.0/search?q=${encodeURIComponent(slug)}&limit=10&page=1`;
  try {
    const results = await fetchJson<CKSearchResult[]>(url, {
      referer: source.url,
      headers: CK_HEADERS,
    });
    if (!Array.isArray(results)) return null;
    const match = results.find((r) => r.slug.toLowerCase() === slug.toLowerCase()) ?? results[0];
    return match?.hid ?? null;
  } catch {
    return null;
  }
}
