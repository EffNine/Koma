<script lang="ts">
  import EmptyState from '../EmptyState.svelte';

  let {
    err,
    loading,
    chapterUrl,
    onRetry,
    onFallback,
    onBack,
  }: {
    err: string;
    loading: boolean;
    chapterUrl: string;
    onRetry: () => void;
    onFallback: () => void;
    onBack: () => void;
  } = $props();
</script>

<div class="card errbox">
  <EmptyState id="reader-failed" context={err} compact />
  <div class="errbox-actions">
    <button class="btn" onclick={onRetry} disabled={loading}>Retry chapter</button>
    <button class="btn" onclick={onFallback} disabled={loading}>Try another source</button>
    <button class="btn" onclick={onBack}>Back to Media</button>
    {#if chapterUrl}
      <a href={chapterUrl} target="_blank" rel="noopener">Open source chapter ↗</a>
    {/if}
  </div>
</div>

<style>
  .errbox { padding: 18px; color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); }
  .errbox-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .errbox-actions a { color: var(--text); font-size: 13px; text-decoration: underline; }
</style>
