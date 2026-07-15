<script lang="ts">
  let {
    visible,
    genres,
    selectedGenres = $bindable<string[]>([]),
    excludedGenres = $bindable<string[]>([]),
    country = $bindable(''),
    status = $bindable(''),
    onChange,
    onClear,
  }: {
    visible: boolean;
    genres: readonly string[];
    selectedGenres: string[];
    excludedGenres: string[];
    country: string;
    status: string;
    onChange: () => void | Promise<void>;
    onClear: () => void;
  } = $props();

  let genreDropdownOpen = $state(false);

  function isGenreSelected(slug: string): boolean {
    return selectedGenres.includes(slug);
  }

  function isGenreExcluded(slug: string): boolean {
    return excludedGenres.includes(slug);
  }

  function toggleGenre(slug: string) {
    if (isGenreExcluded(slug)) {
      excludedGenres = excludedGenres.filter((genre) => genre !== slug);
    } else if (isGenreSelected(slug)) {
      selectedGenres = selectedGenres.filter((genre) => genre !== slug);
    } else {
      selectedGenres = [...selectedGenres, slug];
    }
  }

  function excludeGenre(slug: string) {
    if (isGenreSelected(slug)) {
      selectedGenres = selectedGenres.filter((genre) => genre !== slug);
      excludedGenres = [...excludedGenres, slug];
    } else if (isGenreExcluded(slug)) {
      excludedGenres = excludedGenres.filter((genre) => genre !== slug);
    } else {
      excludedGenres = [...excludedGenres, slug];
    }
  }

  function hasActiveFilters(): boolean {
    return selectedGenres.length > 0 || excludedGenres.length > 0 || country !== '' || status !== '';
  }
</script>

<aside class="filter-sidebar" class:visible>
  <div class="filter-block">
    <strong class="filter-heading">Genres</strong>
    <div class="genre-select-wrap">
      <button class="genre-select-btn" aria-label="Open genre picker" onclick={() => (genreDropdownOpen = !genreDropdownOpen)}>
        <input
          class="genre-search-input"
          readonly
          placeholder="Search Genres"
          value={selectedGenres.join(', ')}
        />
      </button>
      {#if genreDropdownOpen}
        <div
          class="genre-dropdown"
          role="button"
          tabindex="0"
          aria-label="Close genre picker"
          onclick={() => (genreDropdownOpen = false)}
          onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') genreDropdownOpen = false; }}
        >
          <div
            class="genre-dropdown-inner"
            role="dialog"
            tabindex="0"
            aria-label="Genres"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
          >
            <div class="genre-dropdown-header">
              <span class="genre-dropdown-title">Genres</span>
            </div>
            <ul class="genre-list">
              {#each genres as genre (genre)}
                <li class="genre-item">
                  <label class="genre-checkbox-label" class:excluded={isGenreExcluded(genre)}>
                    <input
                      type="checkbox"
                      class="genre-checkbox"
                      checked={isGenreSelected(genre) || isGenreExcluded(genre)}
                      onchange={() => toggleGenre(genre)}
                      oncontextmenu={(e) => { e.preventDefault(); excludeGenre(genre); }}
                    />
                    <span class="genre-name" class:line-through={isGenreExcluded(genre)}>{genre}</span>
                  </label>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="filter-block">
    <strong class="filter-heading">Status</strong>
    <select class="filter-select" bind:value={status} onchange={onChange}>
      <option value="">-- (All) --</option>
      <option value="ongoing">Ongoing</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
      <option value="hiatus">Hiatus</option>
    </select>
  </div>

  <div class="filter-block">
    <strong class="filter-heading">Origin</strong>
    <div class="filter-chips">
      {#each [{ label: 'All', value: '' }, { label: 'JP', value: 'jp' }, { label: 'KR', value: 'kr' }, { label: 'CN', value: 'cn' }] as opt (opt.value)}
        <button class="chip-btn" class:active={country === opt.value} onclick={() => { country = opt.value; void onChange(); }}>{opt.label}</button>
      {/each}
    </div>
  </div>

  {#if hasActiveFilters()}
    <button class="btn small-btn" onclick={onClear}>Clear all</button>
  {/if}
</aside>

<style>
  .filter-sidebar {
    flex: 0 0 220px; display: flex; flex-direction: column; gap: 16px;
  }
  @media (max-width: 768px) {
    .filter-sidebar { display: none; flex: none; width: 100%; }
    .filter-sidebar.visible { display: flex; }
  }

  .filter-block { display: flex; flex-direction: column; gap: 6px; }
  .filter-heading { font-size: 14px; font-weight: 700; color: var(--text); }

  .genre-select-wrap { position: relative; }
  .genre-select-btn { width: 100%; padding: 0; border: 0; background: transparent; cursor: pointer; }
  .genre-search-input {
    width: 100%; min-height: 36px; padding: 0 10px; border-radius: var(--radius-sm);
    border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; cursor: pointer;
  }
  .genre-search-input:focus { border-color: var(--accent); outline: none; }

  .genre-dropdown {
    position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.4);
  }
  .genre-dropdown-inner {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; max-width: 640px; width: 90%; max-height: 80vh; overflow-y: auto;
  }
  .genre-dropdown-header { margin-bottom: 12px; }
  .genre-dropdown-title { font-size: 16px; font-weight: 700; color: var(--text); }

  .genre-list {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px;
  }
  @media (max-width: 560px) {
    .genre-list { grid-template-columns: repeat(2, 1fr); }
  }
  .genre-item { display: flex; align-items: center; }
  .genre-checkbox-label {
    display: flex; align-items: center; gap: 6px; padding: 4px 6px; cursor: pointer;
    border-radius: 4px; width: 100%; transition: background .15s;
  }
  .genre-checkbox-label:hover { background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
  .genre-checkbox-label.excluded { background: color-mix(in srgb, var(--danger) 10%, var(--surface)); }
  .genre-checkbox { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
  .genre-name { font-size: 13px; color: var(--text); }
  .genre-name.line-through { text-decoration: line-through; color: var(--danger); }

  .filter-select {
    width: 100%; min-height: 36px; padding: 0 10px; border-radius: var(--radius-sm);
    border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; cursor: pointer;
  }
  .filter-select:focus { border-color: var(--accent); outline: none; }

  .filter-chips { display: flex; gap: 4px; flex-wrap: wrap; }
  .chip-btn { min-height: 30px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 12px; cursor: pointer; transition: all .15s; }
  .chip-btn:hover { border-color: var(--accent); color: var(--text); }
  .chip-btn.active { background: var(--accent); border-color: transparent; color: #17110a; font-weight: 700; }

  .small-btn { min-height: 30px; padding: 0 10px; font-size: 12px; }
</style>
