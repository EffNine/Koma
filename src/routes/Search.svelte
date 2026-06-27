<script lang="ts">
  import { search } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';
  import TitleCard from '../lib/components/TitleCard.svelte';

  let q = $state('');
  let titles = $state<Title[]>([]);
  let loading = $state(false);
  let err = $state('');
  let done = $state(false);

  async function run() {
    const query = q.trim();
    if (!query) { titles = []; done = false; return; }
    loading = true; err = ''; done = false;
    try { titles = await search(query); }
    catch (e) { err = String(e); titles = []; }
    finally { loading = false; done = true; }
  }
</script>

<form class="searchbar" onsubmit={(e) => { e.preventDefault(); run(); }}>
  <input bind:value={q} placeholder="Search manga, manhwa, manhua…" autofocus />
  <button class="btn btn-primary" type="submit">Search</button>
</form>

{#if err}
  <div class="card err">{err}</div>
{:else if loading}
  <div class="grid">{#each Array(8) as _, i (i)}<div class="card skel" />{/each}</div>
{:else if done && titles.length === 0}
  <div class="card empty">No results for "{q}".</div>
{:else}
  <div class="grid">{#each titles as t (t.id)}<TitleCard title={t} />{/each}</div>
{/if}

<style>
  .searchbar { display: flex; gap: 8px; margin-bottom: 18px; }
  .searchbar input { flex: 1; max-width: 540px; padding: 11px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 15px; }
  .skel { aspect-ratio: 3/4; }
  .empty { text-align: center; color: var(--muted); padding: 40px; }
  .err { color: var(--danger); }
</style>