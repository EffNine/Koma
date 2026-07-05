<script lang="ts">
  import type { ReaderDirection } from '../../reader/state';
  import type { ImageFit } from '../../reader/settings';

  let {
    currentBlob,
    page,
    direction,
    imageFit,
    canPrev,
    canNext,
    onStep,
    onPageClick,
  }: {
    currentBlob: string;
    page: number;
    direction: ReaderDirection;
    imageFit: ImageFit;
    canPrev: boolean;
    canNext: boolean;
    onStep: (delta: number) => void;
    onPageClick: (e: MouseEvent) => void;
  } = $props();
</script>

<section class="paged">
  <button class="nav-btn" onclick={() => onStep(-1)} disabled={!canPrev}>Prev</button>
  <div class="page-stage" onclick={onPageClick} role="presentation">
    {#if currentBlob}
      <img
        class:rtl={direction === 'rtl'}
        class:ltr={direction === 'ltr'}
        class:pan-mode={imageFit === 'original'}
        class="page-image"
        src={currentBlob}
        alt={`Page ${page + 1}`}
        decoding="async"
        draggable="false"
      />
    {:else}
      <div class="page-placeholder">Loading page {page + 1}…</div>
    {/if}
  </div>
  <button class="nav-btn" onclick={() => onStep(1)} disabled={!canNext}>Next</button>
</section>

<style>
  .paged { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: min(78vh, 980px); border-radius: var(--radius); }
  .nav-btn { width: 62px; height: 48px; border-radius: var(--radius-sm); border: 1px solid var(--border-soft); background: color-mix(in srgb, var(--surface) 74%, transparent); color: var(--muted); font-size: 12px; font-weight: 700; }
  .nav-btn:hover:not([disabled]) { color: var(--text); background: var(--elevated); border-color: var(--border); }
  .nav-btn[disabled] { opacity: .45; cursor: not-allowed; }
  .page-stage { min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center; }
  .page-image { max-width: 100%; max-height: 76vh; object-fit: contain; border-radius: calc(var(--radius-sm) - 2px); box-shadow: 0 20px 60px rgba(0, 0, 0, .36); filter: brightness(var(--reader-brightness, 100%)) contrast(var(--reader-contrast, 100%)); transform: scale(calc(var(--reader-zoom, 100) / 100)); transition: opacity .25s ease, filter .2s ease; }
  .page-image.pan-mode { cursor: grab; max-width: none; max-height: none; }
  .page-image.pan-mode:active { cursor: grabbing; }
  .page-placeholder { min-height: min(78vh, 920px); aspect-ratio: 3 / 4; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%; background: var(--elevated); animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
  @media (max-width: 900px) {
    .paged { grid-template-columns: 1fr; min-height: auto; }
    .nav-btn { width: 100%; min-height: 44px; }
    .page-placeholder { min-height: 320px; }
  }
  @media (max-width: 560px) {
    .nav-btn { min-height: 52px; font-size: 14px; }
  }
</style>
