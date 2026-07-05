<script lang="ts">
  import ProxiedImg from '../ProxiedImg.svelte';
  import { go } from '../../router';
  import type { ContinueReadingItem } from '../../media/continueReading';

  let {
    followedUpdates,
    followedUpdatesLoading,
    chapterLabel,
    resumeUrl,
  }: {
    followedUpdates: ContinueReadingItem[];
    followedUpdatesLoading: boolean;
    chapterLabel: (item: ContinueReadingItem) => string;
    resumeUrl: (item: ContinueReadingItem) => string;
  } = $props();
</script>

{#if !followedUpdatesLoading && followedUpdates.length > 0}
  <section class="section">
    <div class="section-head">
      <h2 class="h2">Followed Titles</h2>
      <button class="btn small-btn" onclick={() => go('/library')}>View Library</button>
    </div>
    <div class="grid">
      {#each followedUpdates as item (item.mediaId)}
        <button class="card tcard-ck" onclick={() => go(resumeUrl(item))}>
          {#if item.cover}
            <ProxiedImg src={item.cover} alt={item.title} />
          {:else}
            <div class="nocover">{item.title}</div>
          {/if}
          <div class="tname">{item.title}</div>
          <div class="tcard-footer">
            <span class="tcard-btn">{chapterLabel(item) || 'Continue'}</span>
          </div>
        </button>
      {/each}
    </div>
  </section>
{/if}

<style>
  .section { margin-bottom: var(--gap-lg); }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .small-btn { min-height: 30px; padding: 0 10px; font-size: 12px; }
  .tcard-ck { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s, opacity .15s; }
  .tcard-ck:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .tcard-ck :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .tcard-ck .tname { min-height: 52px; padding: 9px 10px 0; font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tcard-footer { padding: 6px 10px 10px; }
  .tcard-btn { display: inline-block; font-size: 11px; font-weight: 650; color: var(--accent); padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; transition: background .15s; }
  .tcard-btn:hover { background: var(--accent-soft); }
  .nocover { aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; background: var(--elevated); }
</style>
