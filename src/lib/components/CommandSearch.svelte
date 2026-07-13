<script lang="ts">
  import { search } from '../catalog/anilist';
  import { titleName, type Title } from '../catalog/types';
  import { go } from '../router';
  import ProxiedImg from './ProxiedImg.svelte';

  let {
    show,
    onClose,
  }: {
    show: boolean;
    onClose: () => void;
  } = $props();

  let query = $state('');
  let results = $state<Title[]>([]);
  let loading = $state(false);
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Auto-focus input when overlay opens
  $effect(() => {
    if (show) {
      // Reset state on open
      query = '';
      results = [];
      loading = false;
      selectedIndex = 0;
      // Focus after render
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  // Debounced search
  $effect(() => {
    const q = query.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.length === 0) {
      results = [];
      loading = false;
      selectedIndex = 0;
      return;
    }

    loading = true;
    debounceTimer = setTimeout(async () => {
      try {
        const data = await search(q, 1, 20);
        results = data;
        selectedIndex = 0;
      } catch {
        results = [];
      } finally {
        loading = false;
      }
    }, 300);
  });

  function selectResult(index: number) {
    const item = results[index];
    if (!item) return;
    go(`/media/${item.id}`);
    onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!show) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
      scrollIntoView(selectedIndex);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      scrollIntoView(selectedIndex);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      selectResult(selectedIndex);
      return;
    }
  }

  function scrollIntoView(index: number) {
    const el = panelEl?.querySelector(`[data-index="${index}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function onAdvancedSearch(e: Event) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      go(`/search?q=${encodeURIComponent(q)}`);
    } else {
      go('/search');
    }
    onClose();
  }

  // Highlight matching text in a string
  function highlightText(text: string, q: string) {
    if (!q.trim()) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? `<mark>${part}</mark>`
        : part,
    ).join('');
  }

  // Country badge label
  function countryLabel(country?: string | null): string {
    if (country === 'JP') return 'JP';
    if (country === 'KR') return 'KR';
    if (country === 'CN') return 'CN';
    return '';
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="command-backdrop" onclick={onBackdropClick} role="dialog" aria-modal="true" aria-label="Search manga">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="command-panel" bind:this={panelEl} onclick={(e) => e.stopPropagation()} onkeydown={onKeydown}>
      <div class="command-input-wrap">
        <svg class="command-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          bind:this={inputEl}
          bind:value={query}
          placeholder="Search manga, manhwa, manhua…"
          class="command-input"
          onkeydown={onKeydown}
          autocomplete="off"
          spellcheck="false"
        />
        {#if query}
          <button class="command-clear" onclick={() => { query = ''; inputEl?.focus(); }} aria-label="Clear search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        {/if}
      </div>

      <div class="command-results">
        {#if loading}
          <div class="command-loading">
            <div class="command-spinner"></div>
            <span>Searching…</span>
          </div>
        {:else if query.trim() && results.length === 0}
          <div class="command-empty">
            No titles found for '<strong>{query.trim()}</strong>'
          </div>
        {:else if results.length > 0}
          {#each results as item, i (item.id)}
            <button
              class="command-result"
              class:command-result-selected={i === selectedIndex}
              data-index={i}
              onclick={() => selectResult(i)}
              onmouseenter={() => (selectedIndex = i)}
              type="button"
            >
              {#if item.cover}
                <div class="command-result-cover">
                  <ProxiedImg src={item.cover} alt="" loading="eager" />
                </div>
              {:else}
                <div class="command-result-cover command-result-nocover">
                  {titleName(item)[0]?.toUpperCase() ?? '?'}
                </div>
              {/if}
              <div class="command-result-info">
                <div class="command-result-title">
                  {@html highlightText(titleName(item), query.trim())}
                </div>
                <div class="command-result-meta">
                  {#if countryLabel(item.country)}
                    <span class="command-badge command-badge-country">{countryLabel(item.country)}</span>
                  {/if}
                  {#if item.year}
                    <span class="command-badge">{item.year}</span>
                  {/if}
                  {#if item.genres}
                    {#each item.genres.slice(0, 3) as genre}
                      <span class="command-badge command-badge-genre">{genre}</span>
                    {/each}
                  {/if}
                </div>
              </div>
            </button>
          {/each}
        {/if}
      </div>

      {#if query.trim() || results.length > 0}
        <div class="command-footer">
          <a
            href="#/search?q={encodeURIComponent(query.trim())}"
            class="command-advanced-link"
            onclick={onAdvancedSearch}
          >
            Advanced Search →
          </a>
          <span class="command-hint">
            <kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>esc</kbd> close
          </span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .command-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
  }

  .command-panel {
    width: 100%;
    max-width: 560px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 70vh;
  }

  .command-input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .command-search-icon {
    flex-shrink: 0;
    color: var(--muted-2);
  }

  .command-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 16px;
    font-family: var(--font);
    outline: none;
    padding: 0;
  }
  .command-input::placeholder {
    color: var(--muted-2);
  }

  .command-clear {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: var(--elevated);
    color: var(--muted);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .command-clear:hover {
    background: var(--panel);
    color: var(--text);
  }

  .command-results {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .command-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 16px;
    color: var(--muted);
    font-size: 14px;
  }

  .command-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .command-empty {
    padding: 32px 16px;
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }

  .command-result {
    display: flex;
    gap: 12px;
    padding: 10px 16px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    font-family: var(--font);
    transition: background 0.1s;
  }
  .command-result:hover,
  .command-result-selected {
    background: var(--elevated);
  }
  .command-result:not(:last-child) {
    border-bottom: 1px solid var(--border-soft);
  }

  .command-result-cover {
    flex-shrink: 0;
    width: 44px;
    height: 59px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--elevated);
  }
  .command-result-cover :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .command-result-nocover {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: var(--muted-2);
  }

  .command-result-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .command-result-title {
    font-size: 14px;
    font-weight: 620;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .command-result-title :global(mark) {
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: 2px;
    padding: 0 1px;
  }

  .command-result-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }

  .command-badge {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 650;
    color: var(--muted);
    background: var(--elevated);
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-soft);
    line-height: 1.5;
  }
  .command-badge-country {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 32%, transparent);
    background: var(--accent-soft);
  }
  .command-badge-genre {
    color: var(--muted);
  }

  .command-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--border-soft);
    background: var(--bg);
  }

  .command-advanced-link {
    font-size: 13px;
    font-weight: 620;
    color: var(--accent);
    text-decoration: none;
    transition: color 0.15s;
  }
  .command-advanced-link:hover {
    color: color-mix(in srgb, var(--accent) 82%, white);
  }

  .command-hint {
    font-size: 11px;
    color: var(--muted-2);
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .command-hint kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    font-size: 10px;
    font-family: inherit;
    background: var(--elevated);
    border: 1px solid var(--border-soft);
    border-radius: 3px;
    color: var(--muted);
    line-height: 1;
  }
</style>
