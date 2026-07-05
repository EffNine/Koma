<script lang="ts">
  import type { PagePair } from '../../reader/spread';

  let {
    spreadPairs,
    currentSpread,
    pageBlobs,
    canSpreadPrev,
    canSpreadNext,
    onSpreadPrev,
    onSpreadNext,
    onPageClick,
  }: {
    spreadPairs: PagePair[];
    currentSpread: number;
    pageBlobs: string[];
    canSpreadPrev: boolean;
    canSpreadNext: boolean;
    onSpreadPrev: () => void;
    onSpreadNext: () => void;
    onPageClick: (e: MouseEvent) => void;
  } = $props();
</script>

<section class="paged spread">
  <button class="nav-btn" onclick={onSpreadPrev} disabled={!canSpreadPrev}>Prev</button>
  <div class="spread-stage" onclick={onPageClick} role="presentation">
    <div class="spread-page">
      {#if currentSpread >= 0}
        {@const pair = spreadPairs[currentSpread]}
        {#if pair.left >= 0 && pageBlobs[pair.left]}
          <img
            class="page-image spread-half"
            src={pageBlobs[pair.left]}
            alt={`Page ${pair.left + 1}`}
            decoding="async"
            draggable="false"
          />
        {:else if pair.left >= 0}
          <div class="page-placeholder spread-half">Loading page {pair.left + 1}…</div>
        {/if}
        {#if pair.right >= 0 && pageBlobs[pair.right]}
          <img
            class="page-image spread-half"
            src={pageBlobs[pair.right]}
            alt={`Page ${pair.right + 1}`}
            decoding="async"
            draggable="false"
          />
        {:else if pair.right >= 0}
          <div class="page-placeholder spread-half">Loading page {pair.right + 1}…</div>
        {/if}
      {/if}
    </div>
  </div>
  <button class="nav-btn" onclick={onSpreadNext} disabled={!canSpreadNext}>Next</button>
</section>

<style>
  .paged.spread { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: min(78vh, 980px); border-radius: var(--radius); }
  .nav-btn { width: 62px; height: 48px; border-radius: var(--radius-sm); border: 1px solid var(--border-soft); background: color-mix(in srgb, var(--surface) 74%, transparent); color: var(--muted); font-size: 12px; font-weight: 700; }
  .nav-btn:hover:not([disabled]) { color: var(--text); background: var(--elevated); border-color: var(--border); }
  .nav-btn[disabled] { opacity: .45; cursor: not-allowed; }
  .spread-stage { min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center; }
  .spread-page { display: flex; gap: 4px; max-width: 100%; max-height: 76vh; align-items: center; justify-content: center; }
  .spread-half { max-width: 50%; max-height: 76vh; object-fit: contain; }
  .page-image { max-width: 100%; max-height: 76vh; object-fit: contain; border-radius: calc(var(--radius-sm) - 2px); box-shadow: 0 20px 60px rgba(0, 0, 0, .36); filter: brightness(var(--reader-brightness, 100%)) contrast(var(--reader-contrast, 100%)); transform: scale(calc(var(--reader-zoom, 100) / 100)); transition: opacity .25s ease, filter .2s ease; }
  .page-placeholder { min-height: min(78vh, 920px); aspect-ratio: 3 / 4; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%; background: var(--elevated); animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
  @media (max-width: 900px) {
    .paged.spread { grid-template-columns: 1fr; min-height: auto; }
    .nav-btn { width: 100%; min-height: 44px; }
    .page-placeholder { min-height: 320px; }
  }
  @media (max-width: 560px) {
    .nav-btn { min-height: 52px; font-size: 14px; }
  }
</style>
