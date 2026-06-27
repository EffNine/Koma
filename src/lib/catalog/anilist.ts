import { cached } from '../db';
import type { Country, Title } from './types';

// ponytail: AniList GraphQL client. Browser-CORS-callable (ADR 0002) — no fetchRaw needed for catalog.
const ENDPOINT = 'https://graphql.anilist.co';
const TTL = 6 * 60 * 60 * 1000;

const FRAG = `id idMal title{romaji english native} coverImage{large extraLarge large} countryOfOrigin status startDate{year} chapters volumes genres averageScore siteUrl bannerImage`;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error(`AniList ${r.status}`);
  const json = await r.json();
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

export async function media(id: number): Promise<Title | undefined> {
  return cached(`media:${id}`, TTL, async () => {
    const data = await gql<{ Media: any }>(`query($id:Int){ Media(id:$id, type:MANGA){ ${FRAG} description } }`, { id });
    return data.Media ? mapMedia(data.Media) : undefined;
  });
}