export const DEFAULT_SEARCH_SORT = 'created_at';

export interface SearchRouteState {
  q: string;
  selectedGenres: string[];
  country: string;
  sort: string;
  status: string;
  time: string;
}

export function emptySearchRouteState(): SearchRouteState {
  return {
    q: '',
    selectedGenres: [],
    country: '',
    sort: DEFAULT_SEARCH_SORT,
    status: '',
    time: '',
  };
}

export function parseSearchRouteParams(hash: string): SearchRouteState {
  const raw = hash.replace(/^#/, '');
  const [, params = ''] = raw.split('?');
  const sp = new URLSearchParams(params);
  const state = emptySearchRouteState();

  state.q = sp.get('q')?.trim() ?? '';
  state.selectedGenres = parseCsv(sp.get('genres'));
  state.status = sp.get('status') ?? '';
  state.country = sp.get('country') ?? '';
  state.time = sp.get('time') ?? '';
  state.sort = sp.get('sort') || DEFAULT_SEARCH_SORT;

  return state;
}

export function hasSearchRouteState(state: SearchRouteState): boolean {
  return Boolean(
    state.q ||
    state.selectedGenres.length > 0 ||
    state.status ||
    state.country ||
    state.time ||
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
  if (state.time) params.set('time', state.time);
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
