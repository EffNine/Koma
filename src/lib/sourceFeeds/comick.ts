import { fetchJson } from '../net';
import type { SourceFeed, SourceFeedSearchParams, SourceFeedTitle } from './types';

const COMICK_BASE = 'https://comickz.co.uk';
const COMICK_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

export const COMICK_SOURCE_FEED_ID = 'comick';

export const COMICK_SOURCE_FEED_GENRES = [
  'Romance', 'Comedy', 'Drama', 'Fantasy', 'Action', 'Slice of Life',
  'Adventure', 'Sci-Fi', 'Historical', 'Mystery', 'Psychological',
  'Tragedy', 'Horror', 'Isekai', 'Sports', 'Thriller', 'Mecha',
  'Philosophical', 'Medical', 'Magical Girls', 'Superhero', 'Wuxia',
  'Mature', 'Shounen Ai', 'Shoujo Ai', 'Gender Bender', 'Oneshot',
  'Long Strip', 'Full Color', 'Web Comic', 'Doujinshi', 'Adaptation',
  'Anthology', '4-Koma', 'User Created', 'Award Winning', 'Official Colored',
  'Fan Colored', 'School Life', 'Supernatural', 'Music', 'Magic',
  'Monsters', 'Martial Arts', 'Harem', 'Animals', 'Demons',
  'Reincarnation', 'Military', 'Office Workers', 'Loli', 'Survival',
  'Crossdressing', 'Monster Girls', 'Video Games', 'Delinquents',
  'Time Travel', 'Ghosts', 'Cooking', 'Genderswap', 'Aliens', 'Police',
  'Samurai', 'Vampires', 'Mafia', 'Gyaru', 'Villainess',
  'Post-Apocalyptic', 'Reverse Harem', 'Ninja', 'Zombies',
  'Traditional Games', 'Virtual Reality',
] as const;

export const COMICK_SOURCE_FEED_SORTS = {
  'Most Followed': 'user_follow_count',
  'Trending': 'trending',
  'Latest': 'created_at',
  'Updated': 'updated_at',
  'Rating': 'rating',
  'Most Views': 'view',
  'Newest': 'newest',
  'Alphabetical': 'title',
} as const;

export type ComickSourceFeedGenre = (typeof COMICK_SOURCE_FEED_GENRES)[number];
export type ComickSourceFeedSort = keyof typeof COMICK_SOURCE_FEED_SORTS;

export interface ComickSearchHit {
  id: number;
  hid: string;
  slug: string;
  title: string;
  default_thumbnail?: string;
  last_chapter?: number | null;
  country?: string;
  content_rating?: string;
  user_follow_count?: number;
  year?: number;
  status?: number;
  genres?: Array<{ slug: string; name: string }>;
}

interface ComickSearchResponse {
  data: ComickSearchHit[];
  path: string;
  per_page: number;
  next_cursor?: string;
  next_page_url?: string | null;
  prev_cursor?: string;
  prev_page_url?: string | null;
}

const STATUS_MAP: Record<string, number> = {
  ongoing: 1,
  completed: 2,
  hiatus: 3,
  cancelled: 4,
};

export function sourceFeedGenreSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export function comickSearchUrl(params: SourceFeedSearchParams = {}): string {
  const qp = new URLSearchParams();

  if (params.q) qp.set('q', params.q);
  params.genres?.forEach((genre) => qp.append('genres[]', genre));
  params.excludeGenres?.forEach((genre) => qp.append('excludes[]', genre));
  if (params.country) qp.set('country', params.country);
  if (params.sort) {
    qp.set('order_by', params.sort);
    qp.set('order_direction', 'desc');
  }
  if (params.time) qp.set('time', params.time);
  if (params.status && STATUS_MAP[params.status]) qp.set('status', String(STATUS_MAP[params.status]));
  if (params.page) qp.set('page', String(params.page));
  if (params.limit) qp.set('limit', String(params.limit));

  return `${COMICK_BASE}/api/search?${qp.toString()}`;
}

export function mapComickSearchHit(hit: ComickSearchHit): SourceFeedTitle {
  return {
    sourceFeedId: COMICK_SOURCE_FEED_ID,
    sourceTitleId: hit.hid,
    slug: hit.slug,
    title: hit.title,
    cover: hit.default_thumbnail ?? '',
    country: hit.country,
    status: hit.status !== undefined ? ['', 'ongoing', 'completed', 'hiatus', 'cancelled'][hit.status] ?? '' : '',
    lastChapter: hit.last_chapter ?? null,
    genres: hit.genres?.map((genre) => genre.name),
    rating: hit.content_rating,
    followCount: hit.user_follow_count,
    year: hit.year,
  };
}

async function searchComickSourceFeed(params: SourceFeedSearchParams = {}): Promise<SourceFeedTitle[]> {
  const data = await fetchJson<ComickSearchResponse>(comickSearchUrl(params), {
    referer: COMICK_BASE,
    headers: COMICK_HEADERS,
  });

  if (!data?.data) return [];
  return data.data.map(mapComickSearchHit);
}

export const comickSourceFeed: SourceFeed = {
  id: COMICK_SOURCE_FEED_ID,
  label: 'ComicK',
  genres: COMICK_SOURCE_FEED_GENRES,
  search: searchComickSourceFeed,
};

export async function fetchComickOngoingPopular(page = 1, limit = 20): Promise<SourceFeedTitle[]> {
  return comickSourceFeed.search({ status: 'ongoing', sort: 'user_follow_count', page, limit });
}

export async function fetchComickPopularWebtoon(page = 1, limit = 20): Promise<SourceFeedTitle[]> {
  return comickSourceFeed.search({ genres: ['long-strip'], sort: 'user_follow_count', page, limit });
}

export async function fetchComickPopularManga(page = 1, limit = 20): Promise<SourceFeedTitle[]> {
  return comickSourceFeed.search({ country: 'jp', sort: 'user_follow_count', page, limit });
}

export async function browseComickGenre(
  genre: string,
  sort: string = 'user_follow_count',
  page = 1,
  limit = 20,
): Promise<SourceFeedTitle[]> {
  return comickSourceFeed.search({ genres: [genre], sort, page, limit });
}
