<script lang="ts">
  import { browseFiltered, SORTS, GENRE_COLLECTION } from '../lib/catalog/anilist';
  import type { Country, Title } from '../lib/catalog/types';
  import TitleCard from '../lib/components/TitleCard.svelte';

  const countryOptions: { label: string; value: Country }[] = [
    { label: 'All', value: null },
    { label: 'Manga (JP)', value: 'JP' },
    { label: 'Manhwa (KR)', value: 'KR' },
    { label: 'Manhua (CN)', value: 'CN' },
  ];

  const statusOptions = [
    { label: 'All', value: '' },
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Completed', value: 'completed' },
    { label: 'Hiatus', value: 'hiatus' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  const sorts = Object.keys(SORTS) as (keyof typeof SORTS)[];

  // Filter state
  let country = $state<Country>(null);
  let sort = $state<keyof typeof SORTS>('Trending');
  let selectedGenres = $state<Set<string>>(new Set());
  let excludedGenres = $state<Set<string>>(new Set());
  let status = $state('');
  let yearFrom = $state<number | undefined>();
  let yearTo = $state<number | undefined>();
  let minChapters = $state<number | undefined>();

  // Results
  let titles = $state<Title[]>([]);
  let loading = $state(false);
  let err = $state('');
  let hasSearched = $state(false);

  // Show/hide filter panel
  let showFilters = $state(true);

  function toggleGenre(genre: string) {
    if (selectedGenres.has(genre)) {
      selectedGenres.delete(genre);
      selectedGenres = new Set(selectedGenres);
    } else if (excludedGenres.has(genre)) {
      excludedGenres.delete(genre);
      excludedGenres = new Set(excludedGenres);
    } else {
      selectedGenres.add(genre);
      selectedGenres = new Set(selectedGenres);
    }
  }

  function excludeGenre(genre: string) {
    if (excludedGenres.has(genre)) {
      excludedGenres.delete(genre);
      excludedGenres = new Set(excludedGenres);
    } else if (selectedGenres.has(genre)) {
      selectedGenres.delete(genre);
      selectedGenres = new Set(selectedGenres);
    } else {
      excludedGenres.add(genre);
      excludedGenres = new Set(excludedGenres);
    }
  }

  function genreClass(genre: string): string {
    if (selectedGenres.has(genre)) return 'genre-tag selected';
    if (excludedGenres.has(genre)) return 'genre-tag excluded';
    return 'genre-tag';
  }

  function clearFilters() {
    country = null;
    sort = 'Trending';
    selectedGenres = new Set();
    excludedGenres = new Set();
    status = '';
    yearFrom = undefined;
    yearTo = undefined;
    minChapters = undefined;
  }

  function hasActiveFilters(): boolean {
    return country !== null || selectedGenres.size > 0 || excludedGenres.size > 0 ||
      status !== '' || yearFrom !== undefined || yearTo !== undefined ||
      minChapters !== undefined;
  }

  async function run() {
    loading = true; err = ''; hasSearched = true;
    try {
      titles = await browseFiltered({
        country: country ?? undefined,
        genres: selectedGenres.size > 0 ? [...selectedGenres] : undefined,
        excludeGenres: excludedGenres.size > 0 ? [...excludedGenres] : undefined,
        sort: SORTS[sort],
        status: status || undefined,
        yearFrom,
        yearTo,
        minChapters,
        page: 1,
        perPage: 30,
      });
    } catch (e) {
      err = String(e);
      titles = [];
    } finally {
      loading = false;
    }
  }
</script>

<div class="filter-page">
  <div class="filter-head">
    <h1 class="h1">Browse</h1>
    <p class="sub">Filter manga, manhwa, and manhua by genre, country, status, and more.</p>
  </div>

  <!-- Filter panel — ComicK-style collapsible -->
  <section class="card filter-panel">
    <div class="filter-panel-head">
      <button class="btn filter-toggle" onclick={() => (showFilters = !showFilters)}>
        {showFilters ? '▼' : '▶'} Filters
        {#if hasActiveFilters()}
          <span class="filter-badge">{[
            country ? 1 : 0,
            selectedGenres.size,
            excludedGenres.size,
            status ? 1 : 0,
            yearFrom || yearTo ? 1 : 0,
            minChapters ? 1 : 0,
          ].reduce((a, b) => a + b, 0)}</span>
        {/if}
      </button>
      {#if hasActiveFilters()}
        <button class="btn small-btn" onclick={clearFilters}>Clear all</button>
      {/if}
    </div>

    {#if showFilters}
      <div class="filter-body">
        <!-- Country / Origin -->
        <div class="filter-group">
          <span class="filter-label">Origin</span>
          <div class="filter-chips">
            {#each countryOptions as opt (opt.label)}
              <button
                class="chip-btn"
                class:active={country === opt.value}
                onclick={() => (country = opt.value)}
              >{opt.label}</button>
            {/each}
          </div>
        </div>

        <!-- Sort -->
        <div class="filter-group">
          <span class="filter-label">Sort</span>
          <div class="filter-chips">
            {#each sorts as s (s)}
              <button
                class="chip-btn"
                class:active={sort === s}
                onclick={() => (sort = s)}
              >{s}</button>
            {/each}
          </div>
        </div>

        <!-- Status -->
        <div class="filter-group">
          <span class="filter-label">Status</span>
          <div class="filter-chips">
            {#each statusOptions as opt (opt.value)}
              <button
                class="chip-btn"
                class:active={status === opt.value}
                onclick={() => (status = opt.value)}
              >{opt.label}</button>
            {/each}
          </div>
        </div>

        <!-- Year range -->
        <div class="filter-group">
          <span class="filter-label">Year</span>
          <div class="filter-range">
            <input type="number" bind:value={yearFrom} placeholder="From" class="range-input" min="1900" max="2026" />
            <span class="range-sep">–</span>
            <input type="number" bind:value={yearTo} placeholder="To" class="range-input" min="1900" max="2026" />
          </div>
        </div>

        <!-- Min chapters -->
        <div class="filter-group">
          <span class="filter-label">Min Chapters</span>
          <input type="number" bind:value={minChapters} placeholder="0" class="range-input" min="0" style="width:80px" />
        </div>

        <!-- Genres — ComicK-style: click to include, right-click to exclude -->
        <div class="filter-group">
          <span class="filter-label">
            Genres
            <span class="genre-hint">Click to include · Right-click to exclude</span>
          </span>
          <div class="genre-grid">
            {#each GENRE_COLLECTION as genre (genre)}
              <button
                class={genreClass(genre)}
                onclick={() => toggleGenre(genre)}
                oncontextmenu={(e) => { e.preventDefault(); excludeGenre(genre); }}
              >
                {genre}
                {#if selectedGenres.has(genre)}
                  <span class="genre-mark">✓</span>
                {:else if excludedGenres.has(genre)}
                  <span class="genre-mark">✕</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Apply button -->
        <button class="btn btn-primary apply-btn" onclick={run}>
          {loading ? 'Searching…' : 'Apply Filters'}
        </button>
      </div>
    {/if}
  </section>

  <!-- Results -->
  <section class="results-section">
    {#if err}
      <div class="card err">{err}. <button class="btn" onclick={run}>Retry</button></div>
    {:else if loading}
      <div class="grid">
        {#each Array(12) as _, i (i)}<div class="card skel"></div>{/each}
      </div>
    {:else if hasSearched && titles.length === 0}
      <div class="card empty">No results match your filters. Try adjusting them.</div>
    {:else if hasSearched}
      <div class="result-count">{titles.length} result{titles.length === 1 ? '' : 's'}</div>
      <div class="grid">
        {#each titles as t (t.id)}<TitleCard title={t} />{/each}
      </div>
    {:else}
      <div class="card empty">Select filters and click "Apply Filters" to browse.</div>
    {/if}
  </section>
</div>

<style>
  .filter-page { display: flex; flex-direction: column; gap: var(--gap); }
  .filter-head { margin-bottom: 4px; }

  /* Filter panel */
  .filter-panel { padding: 0; overflow: hidden; }
  .filter-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .filter-toggle { font-size: 14px; font-weight: 600; gap: 8px; }
  .filter-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 600; }
  .filter-body { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  .filter-group { display: flex; flex-direction: column; gap: 8px; }
  .filter-label { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .genre-hint { font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--muted-2); }
  .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 13px; cursor: pointer; transition: all .15s; }
  .chip-btn:hover { border-color: var(--accent); color: var(--text); }
  .chip-btn.active { background: var(--accent); border-color: transparent; color: #fff; }
  .filter-range { display: flex; align-items: center; gap: 8px; }
  .range-input { width: 100px; padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
  .range-input:focus { border-color: var(--accent); outline: none; }
  .range-sep { color: var(--muted-2); font-size: 14px; }

  /* Genre tags — ComicK-style */
  .genre-grid { display: flex; gap: 6px; flex-wrap: wrap; }
  .genre-tag { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 13px; cursor: pointer; transition: all .15s; }
  .genre-tag:hover { border-color: var(--accent); }
  .genre-tag.selected { background: color-mix(in srgb, var(--accent) 20%, transparent); border-color: var(--accent); color: var(--text); }
  .genre-tag.excluded { background: color-mix(in srgb, var(--danger) 15%, transparent); border-color: color-mix(in srgb, var(--danger) 50%, transparent); color: var(--danger); text-decoration: line-through; }
  .genre-mark { font-size: 11px; font-weight: 700; }
  .apply-btn { align-self: flex-start; margin-top: 4px; }

  /* Results */
  .results-section { display: flex; flex-direction: column; gap: var(--gap); }
  .result-count { font-size: 13px; color: var(--muted); }
  .skel { aspect-ratio: 3/4; }
  .empty { text-align: center; color: var(--muted); padding: 40px; }
  .err { color: var(--danger); display: flex; align-items: center; gap: 12px; }
</style>
