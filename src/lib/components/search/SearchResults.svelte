<script lang="ts">
  import type { SourceFeedTitle } from '../../sourceFeeds/types';
  import EmptyState from '../EmptyState.svelte';
  import SourceFeedCard from '../SourceFeedCard.svelte';

  let {
    err,
    loading,
    hasSearched,
    query,
    results,
    openErr,
    navigatingTo,
    onRetry,
    onOpen,
  }: {
    err: string;
    loading: boolean;
    hasSearched: boolean;
    query: string;
    results: SourceFeedTitle[];
    openErr: string;
    navigatingTo: string;
    onRetry: () => void | Promise<void>;
    onOpen: (title: SourceFeedTitle) => void | Promise<void>;
  } = $props();
</script>

<section class="results-section">
  {#if err}
    <div class="card err">{err}. <button class="btn" onclick={onRetry}>Retry</button></div>
  {:else if loading}
    <div class="grid">{#each Array(12) as _, i (i)}<div class="card skel"></div>{/each}</div>
  {:else if hasSearched && results.length === 0}
    <EmptyState id="search" context={query || 'No results'} />
  {:else if hasSearched}
    {#if openErr}
      <div class="card warn">{openErr}</div>
    {/if}
    <div class="result-count">{results.length} result{results.length === 1 ? '' : 's'}</div>
    <div class="grid">
      {#each results as item (item.slug)}
        <SourceFeedCard title={item} busy={navigatingTo === item.slug} onOpen={onOpen} />
      {/each}
    </div>
  {:else}
    <EmptyState id="generic" context="Search for a title to get started." />
  {/if}
</section>

<style>
  .results-section { flex: 1; display: flex; flex-direction: column; gap: var(--gap); min-width: 0; }
  .result-count { font-size: 13px; color: var(--muted); }
  .skel { aspect-ratio: 3/4; }
  .err { color: var(--danger); display: flex; align-items: center; gap: 12px; }
  .warn { color: #f3cb7e; background: color-mix(in srgb, var(--warning) 12%, transparent); border-color: color-mix(in srgb, var(--warning) 26%, transparent); padding: 12px; }
</style>
