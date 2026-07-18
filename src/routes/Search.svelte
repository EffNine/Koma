<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { route, go } from '../lib/router';
  import SearchFilters from '../lib/components/search/SearchFilters.svelte';
  import SearchResults from '../lib/components/search/SearchResults.svelte';
  import SearchSortTabs from '../lib/components/search/SearchSortTabs.svelte';
  import {
    hasSearchRouteState,
    parseSearchRouteParams,
    searchRoutePath,
    type SearchRouteState,
  } from '../lib/search/searchRouteState';
  import { search, browseFiltered, GENRE_COLLECTION } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';

  // ── Search state ────────────────────────────────────────────────────
  let q = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  // ── Filter state ──────────────────────────────────────────────────
  let selectedGenres = $state<string[]>([]);
  let excludedGenres = $state<string[]>([]);
  let country = $state('');
  let sort = $state('TRENDING_DESC');
  let status = $state('');
  let showFilters = $state(false);

  // ── Results ───────────────────────────────────────────────────────
  let results = $state<Title[]>([]);
  let loading = $state(false);
  let err = $state('');
  let hasSearched = $state(false);

  let paramsFromRoute = $derived.by(() => {
    $route;
    return parseSearchRouteParams(location.hash);
  });

  function applyRouteState(state: SearchRouteState) {
    if (state.selectedGenres.length > 0) selectedGenres = state.selectedGenres;
    if (state.status) status = state.status;
    if (state.country) country = state.country;
    if (state.sort) sort = state.sort;
    if (state.q && !q) q = state.q;
  }

  let didInit = $state(false);

  $effect(() => {
    const routeState = paramsFromRoute;
    untrack(() => {
      if (hasSearchRouteState(routeState)) {
        applyRouteState(routeState);
        void run();
        didInit = true;
        return;
      }
      // Default Search landing: Trending tab is selected, so load browse results
      // instead of leaving an empty "search to get started" state.
      if (!didInit) {
        didInit = true;
        void run();
      }
    });
  });

  function clearFilters() {
    selectedGenres = [];
    excludedGenres = [];
    country = '';
    status = '';
  }

  /** Map the UI country value ('jp'/'kr'/'cn'/'') to AniList Country ('JP'/'KR'/'CN'/null). */
  function mapCountry(c: string): 'JP' | 'KR' | 'CN' | null {
    if (c === 'jp') return 'JP';
    if (c === 'kr') return 'KR';
    if (c === 'cn') return 'CN';
    return null;
  }

  async function run() {
    const query = q.trim();
    loading = true; err = ''; hasSearched = true;
    try {
      if (query) {
        // Text search — use AniList search (SEARCH_MATCH sort)
        results = await search(query, 1, 30);
      } else {
        // Browse/filter mode — use browseFiltered
        results = await browseFiltered({
          country: mapCountry(country),
          genres: selectedGenres.length > 0 ? selectedGenres : undefined,
          excludeGenres: excludedGenres.length > 0 ? excludedGenres : undefined,
          sort: sort || undefined,
          status: status || undefined,
          page: 1,
          perPage: 30,
        });
      }
    } catch (e) {
      err = String(e);
      results = [];
    } finally {
      loading = false;
    }
  }

  function onSearchSubmit(e: Event) {
    e.preventDefault();
    go(searchRoutePath({ q, selectedGenres, country, sort, status }));
    void run();
  }

  onMount(() => inputEl?.focus());
</script>

<div class="search-page">
  <!-- Search bar -->
  <form class="searchbar" onsubmit={onSearchSubmit}>
    <input
      bind:this={inputEl}
      bind:value={q}
      placeholder="Search manga, manhwa, manhua…"
      class="search-input"
    />
    <button class="btn btn-primary" type="submit">Search</button>
  </form>

  <SearchSortTabs bind:sort onChange={run} />

  <!-- Mobile filter toggle -->
  <button class="filter-toggle-mobile" onclick={() => (showFilters = !showFilters)}>
    {showFilters ? '▼' : '▶'} Show Filter
  </button>

  <div class="content-layout">
    <SearchFilters
      visible={showFilters}
      genres={GENRE_COLLECTION}
      bind:selectedGenres
      bind:excludedGenres
      bind:country
      bind:status
      onChange={run}
      onClear={clearFilters}
    />

    <SearchResults
      {err}
      {loading}
      {hasSearched}
      query={q}
      {results}
      onRetry={run}
    />
  </div>
</div>

<style>
  .search-page { display: flex; flex-direction: column; gap: 12px; }

  /* Search bar */
  .searchbar { display: flex; gap: 8px; }
  .search-input { flex: 1; max-width: 640px; min-height: 46px; padding: 0 14px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 15px; }
  .search-input:focus { border-color: var(--accent); outline: none; }

  /* Mobile filter toggle */
  .filter-toggle-mobile {
    display: none; min-height: 34px; padding: 0 14px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text); font-size: 13px; cursor: pointer; border-radius: var(--radius-sm);
  }
  @media (max-width: 768px) {
    .filter-toggle-mobile { display: inline-flex; align-items: center; gap: 6px; }
  }

  /* Content layout: sidebar + results */
  .content-layout { display: flex; gap: 20px; align-items: flex-start; }
  @media (max-width: 768px) {
    .content-layout { flex-direction: column; }
  }

  @media (max-width: 560px) {
    .searchbar { flex-direction: column; }
    .search-input, .searchbar .btn { width: 100%; max-width: none; }
  }
</style>
