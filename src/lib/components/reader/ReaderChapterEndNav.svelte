<script lang="ts">
  import type { ScrapedChapter } from '../../scraper/engine';

  let {
    prevChapter,
    nextChapter,
    onGoToChapter,
    onBackToMedia,
  }: {
    prevChapter: ScrapedChapter | null | undefined;
    nextChapter: ScrapedChapter | null | undefined;
    onGoToChapter: (ch: ScrapedChapter) => void;
    onBackToMedia: () => void;
  } = $props();
</script>

<section class="card chapter-end-nav">
  <h3 class="chapter-end-title">End of chapter</h3>
  <div class="chapter-end-buttons">
    {#if prevChapter}
      <button class="btn" onclick={() => onGoToChapter(prevChapter)}>
        ← {prevChapter.title || `Ch. ${prevChapter.number ?? '?'}`}
      </button>
    {/if}
    <button class="btn" onclick={onBackToMedia}>Back to Media</button>
    {#if nextChapter}
      <button class="btn btn-primary" onclick={() => onGoToChapter(nextChapter)}>
        {nextChapter.title || `Ch. ${nextChapter.number ?? '?'}`} →
      </button>
    {/if}
  </div>
</section>

<style>
  .chapter-end-nav { text-align: center; padding: 24px 18px; }
  .chapter-end-title { margin: 0 0 14px; font-size: 15px; font-weight: 600; color: var(--muted); }
  .chapter-end-buttons { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
</style>
