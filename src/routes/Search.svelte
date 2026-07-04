<script lang="ts">
  import { onMount } from 'svelte';
  import { search } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';
  import TitleCard from '../lib/components/TitleCard.svelte';
  import EmptyState from '../lib/components/EmptyState.svelte';
  import { route, go } from '../lib/router';
  import { getSource } from '../lib/scraper/sources';
  import { getChapters } from '../lib/scraper/scraper';

  let q = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);
  let titles = $state<Title[]>([]);
  let loading = $state(false);
  let err = $state('');
  let done = $state(false);
  let comickUrl = $state('');
  let comickTitle = $state('');
  let comickChapters = $state<{ url: string; label: string }[]>([]);
  let comickLoading = $state(false);

  async function run() {
    const query = q.trim();
    if (!query) { titles = []; done = false; return; }
    loading = true; err = ''; done = false; comickUrl = ''; comickTitle = ''; comickChapters = [];
    try { titles = await search(query); }
    catch (e) { err = String(e); titles = []; }
    finally { loading = false; done = true; }
    if (titles.length === 0 && comickUrl) {
      await loadComickChapters();
    }
  }

  async function loadComickChapters() {
    if (!comickUrl) return;
    comickLoading = true;
    try {
      const ck = await getSource('comickz.co.uk');
      if (ck) {
        const chs = await getChapters(ck, comickUrl);
        comickChapters = chs.slice(0, 20).map((ch) => ({
          url: ch.url,
          label: ch.title || `Chapter ${ch.number}`,
        }));
      }
    } catch { /* non-critical */ }
    finally { comickLoading = false; }
  }

  function routeQuery(): string {
    const raw = location.hash.replace(/^#/, '');
    const [, params = ''] = raw.split('?');
    const sp = new URLSearchParams(params);
    if (sp.get('source') === 'comick' && sp.get('url')) {
      comickUrl = sp.get('url')!;
      comickTitle = sp.get('q') ?? '';
    }
    return sp.get('q')?.trim() ?? '';
  }

  let qFromRoute = $derived.by(() => {
    $route;
    return routeQuery();
  });

  $effect(() => {
    if (!qFromRoute || qFromRoute === q.trim()) return;
    q = qFromRoute;
    void run();
  });

  onMount(() => inputEl?.focus());
</script>

<form class="searchbar" onsubmit={(e) => { e.preventDefault(); run(); }}>
  <input bind:this={inputEl} bind:value={q} placeholder="Search manga, manhwa, manhua…" />
  <button class="btn btn-primary" type="submit">Search</button>
</form>

{#if err}
  <div class="card err">{err}</div>
{:else if loading}
  <div class="grid">{#each Array(8) as _, i (i)}<div class="card skel"></div>{/each}</div>
{:else if done && titles.length === 0}
  <div class="card results-empty">
    <EmptyState id="search" context={q} compact />
    {#if comickChapters.length > 0}
      <div class="empty-fallback">
        <p>Found on ComicK — pick a chapter to start reading:</p>
        <div class="ck-chapters">
          {#each comickChapters as ch (ch.url)}
            <button class="btn tiny-btn" onclick={() => go(`/reader/0/comickz.co.uk/${encodeURIComponent(comickUrl)}/${encodeURIComponent(ch.url)}`)}>
              {ch.label}
            </button>
          {/each}
        </div>
      </div>
    {:else if comickLoading}
      <div class="empty-fallback"><p>Loading chapters from ComicK…</p></div>
    {/if}
  </div>
{:else if done}
  <div class="grid">{#each titles as t (t.id)}<TitleCard title={t} />{/each}</div>
{:else}
  <EmptyState id="generic" context="Search for a title to get started." />
{/if}

<style>
  .searchbar { display: flex; gap: 8px; margin-bottom: 18px; }
  .searchbar input { flex: 1; max-width: 640px; min-height: 46px; padding: 0 14px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 15px; }
  .searchbar input:focus { border-color: var(--accent); outline: none; }
  .skel { aspect-ratio: 3/4; }
  .results-empty { padding: 28px; }
  .results-empty :global(.empty-state) { background: transparent; border: 0; }
  .empty-fallback { margin-top: 16px; text-align: center; }
  .empty-fallback p { margin: 0 0 10px; color: var(--muted); }
  .ck-chapters { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; max-width: 500px; margin: 0 auto; }
  .err { color: var(--danger); padding: 16px; }
  @media (max-width: 560px) {
    .searchbar { flex-direction: column; }
    .searchbar input, .searchbar .btn { width: 100%; max-width: none; }
  }
</style>
