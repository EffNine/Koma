<script lang="ts">
  import type { Title } from '../../catalog/types';
  import EmptyState from '../EmptyState.svelte';
  import TitleCard from '../TitleCard.svelte';

  let {
    err,
    loading,
    hasSearched,
    query,
    results,
    onRetry,
  }: {
    err: string;
    loading: boolean;
    hasSearched: boolean;
    query: string;
    results: Title[];
    onRetry: () => void | Promise<void>;
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
    <div class="result-count">{results.length} result{results.length === 1 ? '' : 's'}</div>
    <div class="grid">
      {#each results as item (item.id)}
        <TitleCard title={item} />
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
</style>
