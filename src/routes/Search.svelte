<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { route, go } from '../lib/router';
  import SearchFilters from '../lib/components/search/SearchFilters.svelte';
  import SearchResults from '../lib/components/search/SearchResults.svelte';
  import SearchSortTabs from '../lib/components/search/SearchSortTabs.svelte';
  import { titleCandidateRoute } from '../lib/media/openTitleCandidate';
  import {
    hasSearchRouteState,
    parseSearchRouteParams,
    searchRoutePath,
    type SearchRouteState,
  } from '../lib/search/searchRouteState';
  import {
    comickSourceFeed,
    sourceFeedGenreSlug,
  } from '../lib/sourceFeeds/comick';
  import type { SourceFeedTitle } from '../lib/sourceFeeds/types';

  // ── Search state ────────────────────────────────────────────────────
  let q = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  // ── Filter state ──────────────────────────────────────────────────
  let selectedGenres = $state<string[]>([]);
  let excludedGenres = $state<string[]>([]);
  let country = $state('');
  let sort = $state('created_at');
  let status = $state('');
  let time = $state('');
  let showFilters = $state(false);

  // ── Results ───────────────────────────────────────────────────────
  let results = $state<SourceFeedTitle[]>([]);
  let loading = $state(false);
  let err = $state('');
  let openErr = $state('');
  let hasSearched = $state(false);
  let navigatingTo = $state('');

  let paramsFromRoute = $derived.by(() => {
    $route;
    return parseSearchRouteParams(location.hash);
  });

  function applyRouteState(state: SearchRouteState) {
    if (state.selectedGenres.length > 0) selectedGenres = state.selectedGenres;
    if (state.status) status = state.status;
    if (state.country) country = state.country;
    if (state.time) time = state.time;
    if (state.sort) sort = state.sort;
    if (state.q && !q) q = state.q;
  }

  $effect(() => {
    const routeState = paramsFromRoute;
    if (!hasSearchRouteState(routeState)) return;
    untrack(() => {
      applyRouteState(routeState);
      void run();
    });
  });

  function clearFilters() {
    selectedGenres = [];
    excludedGenres = [];
    country = '';
    status = '';
    time = '';
  }

  async function run() {
    const query = q.trim();
    loading = true; err = ''; openErr = ''; hasSearched = true;
    try {
      results = await comickSourceFeed.search({
        q: query || undefined,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
        excludeGenres: excludedGenres.length > 0 ? excludedGenres : undefined,
        country: country || undefined,
        sort: sort || undefined,
        status: status || undefined,
        time: time || undefined,
        page: 1,
        limit: 30,
      });
    } catch (e) {
      err = String(e);
      results = [];
    } finally {
      loading = false;
    }
  }

  function onSearchSubmit(e: Event) {
    e.preventDefault();
    go(searchRoutePath({ q, selectedGenres, country, sort, status, time }));
    void run();
  }

  async function openResult(item: SourceFeedTitle) {
    navigatingTo = item.slug;
    openErr = '';
    try {
      const result = await titleCandidateRoute(item.title);
      if (result.kind === 'media') {
        go(result.route);
      } else {
        openErr = `No AniList catalog match found for "${item.title}". Try a broader title search.`;
      }
    } catch (e) {
      openErr = `Could not open "${item.title}": ${String(e)}`;
    } finally {
      navigatingTo = '';
    }
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
      genres={comickSourceFeed.genres}
      bind:selectedGenres
      bind:excludedGenres
      bind:country
      bind:status
      bind:time
      genreSlug={sourceFeedGenreSlug}
      onChange={run}
      onClear={clearFilters}
    />

    <SearchResults
      {err}
      {loading}
      {hasSearched}
      query={q}
      {results}
      {openErr}
      {navigatingTo}
      onRetry={run}
      onOpen={openResult}
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
