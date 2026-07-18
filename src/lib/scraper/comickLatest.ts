import { fetchText } from '../net';

// ComicK home page latest updates — scrapes the embedded SSR JSON data.
// ComicK embeds a <script id="sv-data"> tag on the home page with trending,
// recent_add, popular_ongoing, topFollowNewComics, completed, and rank data.

export interface ComickLatestItem {
  slug: string;
  title: string;
  cover: string;
  lastChapter: number | null;
  country?: string;
}

interface CKHomeData {
  data: {
    recent_add?: Array<{
      slug: string;
      title: string;
      last_chapter: number | null;
      full_image_path: string;
    }>;
    popular_ongoing?: Array<{
      slug: string;
      title: string;
      last_chapter: number | null;
      full_image_path: string;
    }>;
    completed?: Array<{
      slug: string;
      title: string;
      last_chapter: number | null;
      full_image_path: string;
    }>;
    trending?: Record<string, Array<{
      slug: string;
      title: string;
      md_covers?: Array<{ b2key: string }>;
    }>>;
    topFollowNewComics?: Record<string, Array<{
      slug: string;
      title: string;
      md_covers?: Array<{ b2key: string }>;
    }>>;
    rank?: Array<{
      slug: string;
      title: string;
      md_covers?: Array<{ b2key: string }>;
    }>;
  };
}

const CK_HOME = 'https://comickz.co.uk/home';
const CK_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function extractHomeData(html: string): CKHomeData['data'] | null {
  const m = html.match(/<script[^>]*id="sv-data"[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]) as CKHomeData;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

/** ComicK sometimes ships a shared placeholder hash that always 404s. */
const PLACEHOLDER_COVER_RE = /\/covers\/40bb6193\./i;

export function isPlaceholderCover(url: string | undefined | null): boolean {
  if (!url) return true;
  return PLACEHOLDER_COVER_RE.test(url);
}

function mapItem(item: {
  slug: string;
  title: string;
  last_chapter?: number | null;
  full_image_path?: string;
  md_covers?: Array<{ b2key: string; width?: number; height?: number }>;
}): ComickLatestItem {
  let cover = '';
  if (item.full_image_path && !isPlaceholderCover(item.full_image_path)) {
    cover = item.full_image_path;
  } else if (item.md_covers?.length) {
    // meo.comick.pictures covers are frequently 404 now; prefer a full_image_path
    // from the same comic if available, otherwise fall back to the meo CDN key.
    const b2 = item.md_covers[0].b2key;
    cover = b2.startsWith('http') ? b2 : `https://meo.comick.pictures/${b2}`;
  }
  return {
    slug: item.slug,
    title: item.title,
    cover,
    lastChapter: item.last_chapter ?? null,
  };
}

function withUsableCovers(items: ComickLatestItem[]): ComickLatestItem[] {
  return items.filter((item) => item.cover && !isPlaceholderCover(item.cover));
}

/** Fetch the latest recently added comics from ComicK home page. */
export async function fetchLatestUpdates(): Promise<ComickLatestItem[]> {
  try {
    const html = await fetchText(CK_HOME, { headers: CK_HEADERS });
    const data = extractHomeData(html);
    if (!data?.recent_add) return [];
    // recent_add currently ships placeholder covers for every item; drop them so
    // Home can fall back to AniList covers instead of a strip of broken images.
    const mapped = data.recent_add.map(mapItem);
    const usable = withUsableCovers(mapped);
    if (usable.length > 0) return usable;
    return await resolveCovers(mapped).then(withUsableCovers);
  } catch {
    return [];
  }
}

/** Fetch popular ongoing comics from ComicK home page. */
export async function fetchPopularOngoing(): Promise<ComickLatestItem[]> {
  try {
    const html = await fetchText(CK_HOME, { headers: CK_HEADERS });
    const data = extractHomeData(html);
    if (!data?.popular_ongoing) return [];
    return withUsableCovers(data.popular_ongoing.map(mapItem));
  } catch {
    return [];
  }
}

/** Fetch completed comics from ComicK home page. */
export async function fetchCompleted(): Promise<ComickLatestItem[]> {
  try {
    const html = await fetchText(CK_HOME, { headers: CK_HEADERS });
    const data = extractHomeData(html);
    if (!data?.completed) return [];
    const mapped = data.completed.map(mapItem);
    const usable = withUsableCovers(mapped);
    if (usable.length > 0) return usable;
    return await resolveCovers(mapped).then(withUsableCovers);
  } catch {
    return [];
  }
}

/**
 * Resolve a ComicK cover URL for a slug.
 *
 * The home-page `md_covers` references (meo.comick.pictures) are frequently 404.
 * The canonical cover lives on the comic detail page as `og:image` and is
 * served from cdn1/2.comicknew.pictures. We fetch the detail page once and
 * extract that meta tag.
 */
export async function fetchCoverForSlug(slug: string): Promise<string | null> {
  try {
    const html = await fetchText(`https://comickz.co.uk/comic/${slug}`, { headers: CK_HEADERS });
    const m = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
    if (!m || isPlaceholderCover(m[1])) return null;
    return m[1];
  } catch {
    return null;
  }
}

/** Fetch trending comics (7-day) from ComicK home page. */
export async function fetchTrending(days: '7' | '30' | '90' = '7'): Promise<ComickLatestItem[]> {
  try {
    const html = await fetchText(CK_HOME, { headers: CK_HEADERS });
    const data = extractHomeData(html);
    if (!data?.trending?.[days]) return [];
    const items = data.trending[days].map(mapItem);
    // trending items only have meo.comick.pictures md_covers, which are often 404.
    // Resolve each canonical cover from the comic detail page in parallel.
    return await resolveCovers(items);
  } catch {
    return [];
  }
}

/** Fetch top new followed comics from ComicK home page. */
export async function fetchTopFollowNew(days: '7' | '30' | '90' = '7'): Promise<ComickLatestItem[]> {
  try {
    const html = await fetchText(CK_HOME, { headers: CK_HEADERS });
    const data = extractHomeData(html);
    if (!data?.topFollowNewComics?.[days]) return [];
    const items = data.topFollowNewComics[days].map(mapItem);
    return await resolveCovers(items);
  } catch {
    return [];
  }
}

async function resolveCovers(items: ComickLatestItem[]): Promise<ComickLatestItem[]> {
  const resolved = await Promise.all(
    items.map(async (item) => {
      // Keep a working cover; only replace missing/placeholder/meo fallbacks.
      if (item.cover && !isPlaceholderCover(item.cover) && !item.cover.includes('meo.comick.pictures')) {
        return item;
      }
      const cover = await fetchCoverForSlug(item.slug);
      if (cover) return { ...item, cover };
      if (isPlaceholderCover(item.cover)) return { ...item, cover: '' };
      return item;
    })
  );
  return resolved;
}
