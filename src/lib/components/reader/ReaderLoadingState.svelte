<script lang="ts">
  let {
    loadingTitle,
    loadingSub,
    totalPages,
    pageLoadPercent,
    pageLoadLabel,
  }: {
    loadingTitle: string;
    loadingSub: string;
    totalPages: number;
    pageLoadPercent: number;
    pageLoadLabel: string;
  } = $props();
</script>

<div class="card loading-card">
  <div class="loading-title">{loadingTitle}</div>
  <div class="loading-sub">{loadingSub}</div>
  {#if totalPages > 0}
    <div class="page-load-progress" aria-label="Page loading progress {pageLoadPercent}%">
      <div class="page-load-track">
        <span style="width: {pageLoadPercent}%"></span>
      </div>
      <span class="page-load-count">{pageLoadLabel}</span>
    </div>
  {/if}
</div>

<style>
  .loading-card { padding: 18px; }
  .loading-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .loading-sub { color: var(--muted); font-size: 13px; line-height: 1.5; max-width: 620px; }
  .page-load-progress { display: flex; gap: 12px; align-items: center; margin-top: 14px; max-width: 420px; }
  .page-load-track { flex: 1; height: 4px; border-radius: 999px; background: var(--elevated); overflow: hidden; border: 1px solid var(--border-soft); }
  .page-load-track span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--ok)); border-radius: inherit; transition: width .2s ease; }
  .page-load-count { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
</style>
