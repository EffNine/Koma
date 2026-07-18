import { GENRE_COLLECTION } from '../catalog/anilist';

export const DEFAULT_SEARCH_SORT = 'TRENDING_DESC';

export interface SearchRouteState {
  q: string;
  selectedGenres: string[];
  country: string;
  sort: string;
  status: string;
}

/** ComicK-style sort keys → AniList MediaSort values. */
const SORT_ALIASES: Record<string, string> = {
  user_follow_count: 'POPULARITY_DESC',
  trending: 'TRENDING_DESC',
  created_at: 'START_DATE_DESC',
  newest: 'START_DATE_DESC',
  popularity: 'POPULARITY_DESC',
  popularity_desc: 'POPULARITY_DESC',
  trending_desc: 'TRENDING_DESC',
  start_date_desc: 'START_DATE_DESC',
};

const VALID_SORTS = new Set(['TRENDING_DESC', 'POPULARITY_DESC', 'START_DATE_DESC']);

export function emptySearchRouteState(): SearchRouteState {
  return {
    q: '',
    selectedGenres: [],
    country: '',
    sort: DEFAULT_SEARCH_SORT,
    status: '',
  };
}

export function normalizeSearchSort(sort: string | null | undefined): string {
  if (!sort) return DEFAULT_SEARCH_SORT;
  if (VALID_SORTS.has(sort)) return sort;
  const aliased = SORT_ALIASES[sort] ?? SORT_ALIASES[sort.toLowerCase()];
  return aliased && VALID_SORTS.has(aliased) ? aliased : DEFAULT_SEARCH_SORT;
}

/** Map slug/lowercase genre tokens onto AniList genre names when possible. */
export function normalizeSearchGenres(raw: string[]): string[] {
  const out: string[] = [];
  for (const token of raw) {
    const normalized = normalizeSearchGenre(token);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

export function normalizeSearchGenre(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const direct = GENRE_COLLECTION.find((g) => g === trimmed);
  if (direct) return direct;
  const lower = trimmed.toLowerCase();
  const byLower = GENRE_COLLECTION.find((g) => g.toLowerCase() === lower);
  if (byLower) return byLower;
  const slug = lower.replace(/[_\s]+/g, '-');
  const bySlug = GENRE_COLLECTION.find((g) => g.toLowerCase().replace(/[_\s]+/g, '-') === slug);
  return bySlug ?? null;
}

export function parseSearchRouteParams(hash: string): SearchRouteState {
  const raw = hash.replace(/^#/, '');
  const [, params = ''] = raw.split('?');
  const sp = new URLSearchParams(params);
  const state = emptySearchRouteState();

  state.q = sp.get('q')?.trim() ?? '';
  state.selectedGenres = normalizeSearchGenres(parseCsv(sp.get('genres')));
  state.status = sp.get('status') ?? '';
  state.country = sp.get('country') ?? '';
  state.sort = normalizeSearchSort(sp.get('sort'));

  return state;
}

export function hasSearchRouteState(state: SearchRouteState): boolean {
  return Boolean(
    state.q ||
    state.selectedGenres.length > 0 ||
    state.status ||
    state.country ||
    state.sort !== DEFAULT_SEARCH_SORT,
  );
}

export function searchRoutePath(state: SearchRouteState): string {
  const params = new URLSearchParams();
  const query = state.q.trim();

  if (query) params.set('q', query);
  if (state.selectedGenres.length > 0) params.set('genres', state.selectedGenres.join(','));
  if (state.status) params.set('status', state.status);
  if (state.country) params.set('country', state.country);
  if (state.sort !== DEFAULT_SEARCH_SORT) params.set('sort', state.sort);

  const qs = params.toString();
  return `/search${qs ? '?' + qs : ''}`;
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
