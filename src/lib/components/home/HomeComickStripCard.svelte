<script lang="ts">
  import ProxiedImg from '../ProxiedImg.svelte';
  import type { ComickLatestItem } from '../../scraper/comickLatest';

  let {
    item,
    busy,
    onClick,
  }: {
    item: ComickLatestItem;
    busy: boolean;
    onClick: () => void;
  } = $props();
</script>

<button class="latest-card" class:busy onclick={onClick}>
  <ProxiedImg src={item.cover} alt="" />
  <div class="latest-info">
    <span class="latest-title">{item.title}</span>
    {#if item.lastChapter}
      <span class="latest-ch">Ch. {item.lastChapter}</span>
    {/if}
  </div>
  <div class="tcard-footer">
    <span class="tcard-btn">{busy ? 'Opening…' : 'Read'}</span>
  </div>
</button>

<style>
  .latest-card { flex: 0 0 154px; scroll-snap-align: start; background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s, opacity .15s; color: inherit; padding: 0; text-align: left; font-family: inherit; font-size: inherit; }
  .latest-card:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .latest-card.busy { opacity: .7; cursor: wait; }
  .latest-card :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .latest-info { padding: 8px 10px 0; display: flex; flex-direction: column; gap: 3px; }
  .latest-title { font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .latest-ch { font-size: 12px; color: var(--muted-2); }
  .tcard-footer { padding: 6px 10px 10px; }
  .tcard-btn { display: inline-block; font-size: 11px; font-weight: 650; color: var(--accent); padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; transition: background .15s; }
  .tcard-btn:hover { background: var(--accent-soft); }
  @media (max-width: 680px) {
    .latest-card { flex-basis: 136px; }
  }
</style>
