<script lang="ts">
  let {
    pageLoadPercent,
    pageLoadLabel,
  }: {
    pageLoadPercent: number;
    pageLoadLabel: string;
  } = $props();
</script>

<div class="page-load-hud" role="status" aria-live="polite" aria-label="Page loading progress {pageLoadPercent}%">
  <div class="page-load-track">
    <span style="width: {pageLoadPercent}%"></span>
  </div>
  <span class="page-load-count">{pageLoadLabel}</span>
</div>

<style>
  .page-load-hud {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    z-index: 50;
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: min(280px, calc(100vw - 24px));
    max-width: min(420px, calc(100vw - 24px));
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 28px rgba(0, 0, 0, .28);
    pointer-events: none;
  }
  .page-load-track {
    flex: 1;
    height: 4px;
    border-radius: 999px;
    background: var(--elevated);
    overflow: hidden;
    border: 1px solid var(--border-soft);
  }
  .page-load-track span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--ok));
    border-radius: inherit;
    transition: width .2s ease;
  }
  .page-load-count {
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
