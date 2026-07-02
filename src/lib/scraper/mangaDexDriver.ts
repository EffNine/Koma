import { fetchText } from '../net';
import { matchSeries } from './engine';
import type { ScraperDriver } from './driver';
import type { Source } from './sources';

interface MangaDexMangaResponse {
  data: Array<{
    id: string;
    attributes: {
      title?: Record<string, string>;
      altTitles?: Array<Record<string, string>>;
    };
  }>;
}

interface MangaDexFeedResponse {
  total: number;
  data: Array<{
    id: string;
    attributes: {
      chapter?: string | null;
      title?: string | null;
      externalUrl?: string | null;
    };
  }>;
}

interface MangaDexAtHomeResponse {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

const MD_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://mangadex.org',
  Referer: 'https://mangadex.org/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

export const mangaDexDriver: ScraperDriver = {
  async findSeries(_source: Source, query: string) {
    const url =
      'https://api.mangadex.org/manga?limit=10&includes[]=cover_art&availableTranslatedLanguage[]=en&title=' +
      encodeURIComponent(query);
    const json = await mdJson<MangaDexMangaResponse>(url);
    const candidates = json.data.map((manga) => ({
      url: `https://mangadex.org/title/${manga.id}`,
      title: mdTitle(manga.attributes.title, manga.attributes.altTitles) || manga.id,
    }));
    return matchSeries(candidates, query);
  },
  async getChapters(_source: Source, seriesUrl: string) {
    const mangaId = trailingId(seriesUrl);
    const out: { url: string; number: string | null; title: string }[] = [];
    let offset = 0;
    let total = 1;
    while (offset < total) {
      const url =
        `https://api.mangadex.org/manga/${mangaId}/feed?limit=100&offset=${offset}` +
        '&translatedLanguage[]=en&order%5Bchapter%5D=desc';
      const json = await mdJson<MangaDexFeedResponse>(url);
      total = json.total;
      for (const ch of json.data) {
        const chapterNum = ch.attributes.chapter ?? null;
        const title = chapterLabel(chapterNum, ch.attributes.title ?? null);
        out.push({
          url: `https://mangadex.org/chapter/${ch.id}`,
          number: chapterNum,
          title: ch.attributes.externalUrl ? `${title} (external)` : title,
        });
      }
      offset += json.data.length;
      if (json.data.length === 0) break;
    }
    return out.sort((a, b) => chapterSort(a.number, b.number));
  },
  async getPages(_source: Source, chapterUrl: string) {
    const chapterId = trailingId(chapterUrl);
    const json = await mdJson<MangaDexAtHomeResponse>(`https://api.mangadex.org/at-home/server/${chapterId}`);
    if (!json.baseUrl || !json.chapter?.hash || !json.chapter?.data?.length) return [];
    return json.chapter.data.map((file) => `${json.baseUrl}/data/${json.chapter.hash}/${file}`);
  },
};

async function mdJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url, { referer: 'https://mangadex.org/', headers: MD_HEADERS })) as T;
}

function mdTitle(
  title?: Record<string, string>,
  altTitles?: Array<Record<string, string>>,
): string | null {
  const direct = title ? preferLocale(title) : null;
  if (direct) return direct;
  for (const alt of altTitles ?? []) {
    const pick = preferLocale(alt);
    if (pick) return pick;
  }
  return null;
}

function preferLocale(map: Record<string, string>): string | null {
  return map.en || map['en-us'] || map['ja-ro'] || map['ko-ro'] || Object.values(map)[0] || null;
}

function trailingId(url: string): string {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function chapterLabel(number: string | null, title: string | null): string {
  if (number && title) return `Chapter ${number}: ${title}`;
  if (number) return `Chapter ${number}`;
  return title || 'Chapter';
}

function chapterSort(a: string | null, b: string | null): number {
  const x = a ? parseFloat(a) : -1;
  const y = b ? parseFloat(b) : -1;
  return x - y;
}
