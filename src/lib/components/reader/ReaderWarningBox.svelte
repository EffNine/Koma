<script lang="ts">
  let {
    note,
    failureCategory,
    failedPages,
    retrying,
    sameNumberAlts,
    onRetryFailed,
  }: {
    note: string;
    failureCategory: string;
    failedPages: number[];
    retrying: boolean;
    sameNumberAlts: unknown[];
    onRetryFailed: () => void;
  } = $props();
</script>

<div class="card warnbox">
  <div class="warnbox-content">
    <span>{note}</span>
    {#if failureCategory}
      <span class="warnbox-detail">{failureCategory}</span>
    {/if}
  </div>
  <div class="warnbox-actions">
    {#if failedPages.length > 0}
      <button class="btn small-btn" onclick={onRetryFailed} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry failed pages'}
      </button>
    {/if}
    {#if sameNumberAlts.length > 0}
      <span class="warnbox-hint">or switch group above</span>
    {/if}
  </div>
</div>

<style>
  .warnbox { padding: 18px; color: color-mix(in srgb, #fff 92%, var(--warning, #d9a441) 8%); background: color-mix(in srgb, #d9a441 10%, transparent); border: 1px solid color-mix(in srgb, #d9a441 30%, transparent); }
  .warnbox-content { display: flex; flex-direction: column; gap: 6px; }
  .warnbox-detail { font-size: 13px; opacity: 0.8; }
  .warnbox-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  .warnbox-hint { font-size: 12px; opacity: 0.7; }
</style>
