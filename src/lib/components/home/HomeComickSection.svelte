<script lang="ts">
  import { go } from '../../router';
  import type { Title } from '../../catalog/types';
  import type { ComickLatestItem } from '../../scraper/comickLatest';
  import TitleCard from '../TitleCard.svelte';
  import HomeComickCard from './HomeComickCard.svelte';
  import HomeComickStripCard from './HomeComickStripCard.svelte';

  type Layout = 'grid' | 'strip';

  let {
    title,
    loading,
    err,
    items,
    fallbackTitles,
    navigatingTo,
    layout = 'grid',
    onRetry,
    onClickItem,
  }: {
    title: string;
    loading: boolean;
    err?: string;
    items: ComickLatestItem[];
    fallbackTitles: Title[];
    navigatingTo: string;
    layout?: Layout;
    onRetry: () => void;
    onClickItem: (item: ComickLatestItem) => void;
  } = $props();
</script>

<section class="section">
  <div class="section-head">
    <h2 class="h2">{title}</h2>
    <button class="btn small-btn" onclick={() => go('/search')}>View All</button>
  </div>
  {#if loading}
    <div class="grid">
      {#each Array(6) as _, i (i)}<div class="card skel"></div>{/each}
    </div>
  {:else if err}
    <div class="card errbox">
      {err}
      <button class="btn small-btn" onclick={onRetry}>Retry</button>
    </div>
  {:else if items.length > 0}
    {#if layout === 'strip'}
      <div class="latest-strip">
        {#each items.slice(0, 12) as item (item.slug)}
          <HomeComickStripCard {item} busy={navigatingTo === item.slug} onClick={() => onClickItem(item)} />
        {/each}
      </div>
    {:else}
      <div class="grid">
        {#each items.slice(0, 12) as item (item.slug)}
          <HomeComickCard {item} busy={navigatingTo === item.slug} onClick={() => onClickItem(item)} />
        {/each}
      </div>
    {/if}
  {:else}
    <div class="grid">
      {#each fallbackTitles as t (t.id)}<TitleCard title={t} />{/each}
    </div>
  {/if}
</section>

<style>
  .section { margin-bottom: var(--gap-lg); }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .small-btn { min-height: 30px; padding: 0 10px; font-size: 12px; }
  .skel { aspect-ratio: 3/4; }
  .errbox { color: var(--danger); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px; }
  .latest-strip { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 8px; scroll-snap-type: x mandatory; }
  .latest-strip::-webkit-scrollbar { height: 6px; }
</style>
