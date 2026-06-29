<script lang="ts">
  import { browse, SORTS } from '../lib/catalog/anilist';
  import type { Country, Title } from '../lib/catalog/types';
  import TitleCard from '../lib/components/TitleCard.svelte';

  const tabs: { label: string; country: Country }[] = [
    { label: 'All', country: null },
    { label: 'Manga', country: 'JP' },
    { label: 'Manhwa', country: 'KR' },
    { label: 'Manhua', country: 'CN' },
  ];
  const sorts = Object.keys(SORTS) as (keyof typeof SORTS)[];

  let tab = $state<Country>(null);
  let sort = $state<keyof typeof SORTS>('Trending');
  let titles = $state<Title[]>([]);
  let loading = $state(false);
  let err = $state('');

  async function load() {
    loading = true; err = '';
    try { titles = await browse(tab, SORTS[sort]); }
    catch (e) { err = String(e); titles = []; }
    finally { loading = false; }
  }
  // re-fetch when tab or sort changes
  $effect(() => { tab; sort; load(); });
</script>

<div class="browsebar">
  <div class="tabs">
    {#each tabs as t (t.label)}
      <button class="tab" class:active={tab === t.country} onclick={() => (tab = t.country)}>{t.label}</button>
    {/each}
  </div>
  <select bind:value={sort} class="sort">
    {#each sorts as s (s)}<option value={s}>{s}</option>{/each}
  </select>
</div>

{#if err}
  <div class="card err">{err}. <button class="btn" onclick={load}>Retry</button></div>
{:else if loading}
  <div class="grid">
    {#each Array(12) as _, i (i)}<div class="card skel"></div>{/each}
  </div>
{:else}
  <div class="grid">
    {#each titles as t (t.id)}<TitleCard title={t} />{/each}
  </div>
{/if}

<style>
  .browsebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .tabs { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 3px; }
  .tab { background: transparent; border: 0; color: var(--muted); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .tab.active { background: var(--accent); color: #fff; }
  .sort { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 7px; padding: 7px 10px; font-size: 14px; }
  .skel { aspect-ratio: 3/4; }
  .err { color: var(--danger); display: flex; align-items: center; gap: 12px; }
</style>
