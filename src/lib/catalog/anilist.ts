import { cached } from '../db';
import type { Country, Title } from './types';

// ponytail: AniList GraphQL client. Browser-CORS-callable (ADR 0002) — no fetchRaw needed for catalog.
const ENDPOINT = 'https://graphql.anilist.co';
const TTL = 6 * 60 * 60 * 1000;

const FRAG = `id idMal title{romaji english native} coverImage{large extraLarge large} countryOfOrigin status startDate{year} chapters volumes genres averageScore siteUrl bannerImage synonyms`

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const text = await r.text();
  if (!r.ok) {
    // Include response body in error for debugging
    const snippet = text.startsWith('{') ? text.substring(0, 200) : text.substring(0, 100);
    throw new Error(`AniList ${r.status}: ${snippet}`);
  }
  if (!text.startsWith('{')) throw new Error(`AniList returned non-JSON: ${text.substring(0, 100)}`);
  const json = JSON.parse(text);
  if (json.errors) throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '));
  return json.data as T;
}

function mapMedia(m: any): Title {
  return {
    id: m.id,
    idMal: m.idMal ?? undefined,
    title: m.title ?? {},
    cover: m.coverImage?.large || m.coverImage?.extraLarge,
    banner: m.bannerImage ?? undefined,
    description: m.description ?? undefined,
    country: m.countryOfOrigin ?? null,
    status: m.status ?? undefined,
    year: m.startDate?.year ?? undefined,
    chapters: m.chapters ?? undefined,
    volumes: m.volumes ?? undefined,
    genres: m.genres ?? undefined,
    averageScore: m.averageScore ?? undefined,
    siteUrl: m.siteUrl ?? undefined,
    synonyms: (m.synonyms ?? []).filter((s: unknown) => typeof s === 'string' && s.length > 0),
  };
}

export async function search(q: string, page = 1, perPage = 30): Promise<Title[]> {
  return cached(`search:${q}:${page}`, TTL, async () => {
    const data = await gql<{ Page: { media: any[] } }>(
      `query($q:String,$page:Int,$perPage:Int){ Page(page:$page,perPage:$perPage){ media(type:MANGA, search:$q, sort:SEARCH_MATCH){ ${FRAG} } } }`,
      { q, page, perPage },
    );
    return data.Page.media.map(mapMedia);
  });
}

export async function browse(country: Country, sort: string, page = 1, perPage = 30): Promise<Title[]> {
  const key = `browse:${country ?? 'ALL'}:${sort}:${page}`;
  return cached(key, TTL, async () => {
    // ponytail: AniList treats countryOfOrigin:null as "match null country" (empty), so omit the arg for All.
    const decl = country ? '$country:CountryCode,' : '';
    const arg = country ? 'countryOfOrigin:$country,' : '';
    const data = await gql<{ Page: { media: any[] } }>(
      `query(${decl}$sort:[MediaSort],$page:Int,$perPage:Int){ Page(page:$page,perPage:$perPage){ media(type:MANGA, ${arg} sort:$sort){ ${FRAG} } } }`,
      { ...(country ? { country } : {}), sort: [sort], page, perPage },
    );
    return data.Page.media.map(mapMedia);
  });
}

export const SORTS = {
  Trending: 'TRENDING_DESC',
  Popular: 'POPULARITY_DESC',
  Latest: 'START_DATE_DESC',
} as const;

export const GENRE_COLLECTION = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy',
  'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller',
] as const;

export type Genre = (typeof GENRE_COLLECTION)[number];

export async function browseByGenre(genre: Genre, sort: string, page = 1, perPage = 30): Promise<Title[]> {
  const key = `genre:${genre}:${sort}:${page}`;
  return cached(key, TTL, async () => {
    const data = await gql<{ Page: { media: any[] } }>(
      `query($genre:String,$sort:[MediaSort],$page:Int,$perPage:Int){ Page(page:$page,perPage:$perPage){ media(type:MANGA, genre:$genre, sort:$sort){ ${FRAG} } } }`,
      { genre, sort: [sort], page, perPage },
    );
    return data.Page.media.map(mapMedia);
  });
}

export async function media(id: number): Promise<Title | undefined> {
  return cached(`media:${id}`, TTL, async () => {
    const data = await gql<{ Media: any }>(`query($id:Int){ Media(id:$id, type:MANGA){ ${FRAG} description } }`, { id });
    return data.Media ? mapMedia(data.Media) : undefined;
  });
}

// --- Filtered browse (ComicK-style) ---

export interface BrowseFilters {
  country?: Country;
  genres?: string[];       // genres to include
  excludeGenres?: string[]; // genres to exclude
  sort?: string;
  yearFrom?: number;
  yearTo?: number;
  status?: string;
  minChapters?: number;
  page?: number;
  perPage?: number;
}

const ANILIST_STATUS_MAP: Record<string, string> = {
  ongoing: 'RELEASING',
  completed: 'FINISHED',
  hiatus: 'HIATUS',
  cancelled: 'CANCELLED',
};

export async function browseFiltered(filters: BrowseFilters): Promise<Title[]> {
  const {
    country,
    genres,
    excludeGenres,
    sort = 'TRENDING_DESC',
    yearFrom,
    yearTo,
    status,
    minChapters,
    page = 1,
    perPage = 30,
  } = filters;

  const key = `filtered:${JSON.stringify(filters)}`;
  return cached(key, TTL, async () => {
    // Build GraphQL variables and query conditions
    const vars: Record<string, unknown> = { type: 'MANGA', sort: [sort], page, perPage };
    const conditions: string[] = [];

    if (country) {
      conditions.push('countryOfOrigin: $country');
      vars.country = country;
    }
    if (genres && genres.length > 0) {
      conditions.push('genre_in: $genres');
      vars.genres = genres;
    }
    if (excludeGenres && excludeGenres.length > 0) {
      conditions.push('genre_not_in: $excludeGenres');
      vars.excludeGenres = excludeGenres;
    }
    if (status && ANILIST_STATUS_MAP[status]) {
      conditions.push('status: $status');
      vars.status = ANILIST_STATUS_MAP[status];
    }
    if (yearFrom) {
      conditions.push('startDate_greater: $yearFrom');
      vars.yearFrom = yearFrom * 10000 + 101; // YYYYMMDD: Jan 1
    }
    if (yearTo) {
      conditions.push('startDate_lesser: $yearTo');
      vars.yearTo = yearTo * 10000 + 1231; // YYYYMMDD: Dec 31
    }
    if (minChapters !== undefined && minChapters > 0) {
      conditions.push('chapters_greater: $minChapters');
      vars.minChapters = minChapters;
    }

    const condStr = conditions.length > 0 ? `${conditions.join(', ')},` : '';
    const varDecls = Object.keys(vars)
      .filter((k) => k !== 'type' && k !== 'sort' && k !== 'page' && k !== 'perPage')
      .map((k) => {
        const v = vars[k];
        if (k === 'country') return `$${k}: CountryCode`;
        if (Array.isArray(v)) return `$${k}: [String]`;
        if (k === 'yearFrom' || k === 'yearTo') return `$${k}: FuzzyDateInt`;
        if (typeof v === 'number') return `$${k}: Int`;
        return `$${k}: String`;
      })
      .join(',');

    const query = `query($type:MediaType,$sort:[MediaSort],$page:Int,$perPage:Int${varDecls ? ',' + varDecls : ''}){
      Page(page:$page,perPage:$perPage){
        media(type:$type, sort:$sort, ${condStr} isAdult:false){ ${FRAG} }
      }
    }`;

    const data = await gql<{ Page: { media: any[] } }>(query, vars);
    return data.Page.media.map(mapMedia);
  });
}
