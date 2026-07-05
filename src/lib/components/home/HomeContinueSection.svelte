<script lang="ts">
  import ProxiedImg from '../ProxiedImg.svelte';
  import { go } from '../../router';
  import type { ContinueReadingItem } from '../../media/continueReading';

  let {
    continueItems,
    continueLoading,
    chapterLabel,
    resumeUrl,
  }: {
    continueItems: ContinueReadingItem[];
    continueLoading: boolean;
    chapterLabel: (item: ContinueReadingItem) => string;
    resumeUrl: (item: ContinueReadingItem) => string;
  } = $props();
</script>

{#if !continueLoading}
  <section class="section continue-section">
    <div class="section-head">
      <h2 class="h2">Continue Reading</h2>
      {#if continueItems.length > 0}
        <button class="btn small-btn" onclick={() => go('/library')}>View Library</button>
      {/if}
    </div>
    {#if continueItems.length > 0}
      {@const primary = continueItems[0]}
      <div class="continue-card">
        {#if primary.cover}
          <div class="continue-cover">
            <ProxiedImg src={primary.cover} alt={primary.title} />
          </div>
        {:else}
          <div class="continue-cover nocover">{primary.title}</div>
        {/if}
        <div class="continue-info">
          <span class="continue-label">Continue Reading</span>
          <h2 class="continue-title">{primary.title}</h2>
          {#if chapterLabel(primary)}
            <p class="continue-desc">{chapterLabel(primary)}</p>
          {/if}
          <div class="continue-actions">
            <button class="btn btn-primary" onclick={() => go(resumeUrl(primary))}>Resume</button>
            <button class="btn" onclick={() => go(`/media/${primary.mediaId}`)}>Details</button>
          </div>
        </div>
      </div>
      {#if continueItems.length > 1}
        <div class="grid continue-grid">
          {#each continueItems.slice(1) as item (item.mediaId)}
            <button class="card tcard-ck" onclick={() => go(resumeUrl(item))}>
              {#if item.cover}
                <ProxiedImg src={item.cover} alt={item.title} />
              {:else}
                <div class="nocover">{item.title}</div>
              {/if}
              <div class="tname">{item.title}</div>
              <div class="tcard-footer">
                <span class="tcard-btn">{chapterLabel(item) || 'Resume'}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="continue-card continue-empty">
        <div class="continue-info">
          <span class="continue-label">Welcome to Koma</span>
          <h2 class="continue-title">Start Reading</h2>
          <p class="continue-desc">Search for a title or browse trending manga to get started.</p>
          <div class="continue-actions">
            <button class="btn btn-primary" onclick={() => go('/search')}>Search Titles</button>
            <button class="btn" onclick={() => go('/library')}>Open Library</button>
          </div>
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .section { margin-bottom: var(--gap-lg); }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .small-btn { min-height: 30px; padding: 0 10px; font-size: 12px; }
  .continue-section { margin-bottom: 32px; }
  .continue-card {
    display: flex; align-items: center; gap: clamp(12px, 2vw, 18px); padding: clamp(12px, 2vw, 18px);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, var(--surface)), var(--surface) 58%),
      var(--surface);
    border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    text-align: left;
  }
  .continue-cover {
    flex: 0 0 auto;
    width: clamp(72px, 16vw, 120px);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--elevated);
  }
  .continue-cover :global(img), .continue-cover.nocover { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
  .continue-cover.nocover { display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; }
  .continue-empty { background: var(--surface); box-shadow: none; }
  .continue-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .continue-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight: 760; }
  .continue-title { margin: 0; font-size: clamp(16px, 2.4vw, 22px); line-height: 1.15; font-weight: 760; }
  .continue-desc { color: var(--muted); font-size: 13px; margin: 0; max-width: 420px; }
  .continue-actions { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
  .continue-grid { margin-top: 16px; }
  .tcard-ck { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s, opacity .15s; }
  .tcard-ck:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .tcard-ck :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .tcard-ck .tname { min-height: 52px; padding: 9px 10px 0; font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tcard-footer { padding: 6px 10px 10px; }
  .tcard-btn { display: inline-block; font-size: 11px; font-weight: 650; color: var(--accent); padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; transition: background .15s; }
  .tcard-btn:hover { background: var(--accent-soft); }
  .nocover { aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; background: var(--elevated); }
  @media (max-width: 680px) {
    .continue-card { align-items: flex-start; }
  }
</style>
