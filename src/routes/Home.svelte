<script lang="ts">
  import { browse, SORTS } from '../lib/catalog/anilist';
  import type { Country, Title } from '../lib/catalog/types';
  import { titleName } from '../lib/catalog/types';
  import TitleCard from '../lib/components/TitleCard.svelte';
  import ProxiedImg from '../lib/components/ProxiedImg.svelte';
  import { go } from '../lib/router';
  import {
    fetchLatestUpdates,
    fetchPopularOngoing,
    fetchTrending,
    fetchTopFollowNew,
    fetchCompleted,
    type ComickLatestItem,
  } from '../lib/scraper/comickLatest';
  import { listHistory } from '../lib/tracker/local';
  import { db } from '../lib/db';
  import { media } from '../lib/catalog/anilist';

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

  // ComicK-sourced sections
  let latestUpdates = $state<ComickLatestItem[]>([]);
  let latestLoading = $state(true);
  let popularOngoing = $state<ComickLatestItem[]>([]);
  let popularLoading = $state(true);
  let trendingCk = $state<ComickLatestItem[]>([]);
  let trendingCkLoading = $state(true);
  let topNew = $state<ComickLatestItem[]>([]);
  let topNewLoading = $state(true);

  // AniList-sourced sections (fallback)
  let trending = $state<Title[]>([]);
  let trendingLoading = $state(true);
  let popularNew = $state<Title[]>([]);
  let popularNewLoading = $state(true);

  // Continue reading state
  let recentHistory = $state<import('../lib/tracker/local').HistoryEntry[]>([]);
  let continueLoading = $state(true);
  let titleNames = $state<Map<number, string>>(new Map());

  async function load() {
    loading = true; err = '';
    try { titles = await browse(tab, SORTS[sort]); }
    catch (e) { err = String(e); titles = []; }
    finally { loading = false; }
  }
  $effect(() => { tab; sort; load(); });

  // Load ComicK-sourced sections in parallel
  async function loadComickSections() {
    const [updates, ongoing, trend, newFollow] = await Promise.all([
      fetchLatestUpdates(),
      fetchPopularOngoing(),
      fetchTrending('7'),
      fetchTopFollowNew('7'),
    ]);
    latestUpdates = updates;
    latestLoading = false;
    popularOngoing = ongoing;
    popularLoading = false;
    trendingCk = trend;
    trendingCkLoading = false;
    topNew = newFollow;
    topNewLoading = false;
  }

  // Fallback AniList sections
  async function loadTrending() {
    trendingLoading = true;
    try { trending = await browse(null, 'TRENDING_DESC', 1, 12); }
    catch { /* non-critical */ }
    finally { trendingLoading = false; }
  }

  async function loadPopularNew() {
    popularNewLoading = true;
    try { popularNew = await browse(null, 'POPULARITY_DESC', 1, 12); }
    catch { /* non-critical */ }
    finally { popularNewLoading = false; }
  }

  // Load continue reading data
  async function loadContinueReading() {
    continueLoading = true;
    try {
      const hist = await listHistory(5);
      recentHistory = hist;
      // Load title names from tracked titles table, fall back to AniList catalog
      const names = new Map<number, string>();
      for (const h of hist) {
        if (!names.has(h.mediaId)) {
          const tracked = await db.trackedTitles.get(h.mediaId);
          if (tracked?.name) {
            names.set(h.mediaId, tracked.name);
          } else {
            // Try fetching from AniList catalog
            try {
              const title = await media(h.mediaId);
              if (title) names.set(h.mediaId, titleName(title));
            } catch {
              // Keep showing mediaId as fallback
            }
          }
        }
      }
      titleNames = names;
    } catch {
      recentHistory = [];
    } finally {
      continueLoading = false;
    }
  }

  $effect(() => { loadComickSections(); loadTrending(); loadPopularNew(); loadContinueReading(); });

  // Derive the most recent unique title for continue reading
  let continueTitle = $derived.by(() => {
    const seen = new Set<number>();
    for (const h of recentHistory) {
      if (!seen.has(h.mediaId)) {
        seen.add(h.mediaId);
        return h;
      }
    }
    return null;
  });

  function titleFor(mediaId: number): string {
    return titleNames.get(mediaId) ?? `Title ${mediaId}`;
  }
</script>

{#if !continueLoading && continueTitle}
  <section class="section continue-section">
    <div class="card continue-card">
      <div class="continue-info">
        <span class="continue-label">Continue Reading</span>
        <h2 class="continue-title">{titleFor(continueTitle.mediaId)}</h2>
        <div class="continue-meta">
          {#if continueTitle.chapterNumber}
            <span>Chapter {continueTitle.chapterNumber}</span>
          {/if}
          {#if continueTitle.chapterTitle}
            <span>— {continueTitle.chapterTitle}</span>
          {/if}
        </div>
        <div class="continue-actions">
          <button class="btn btn-primary" onclick={() => go(`/media/${continueTitle.mediaId}`)}>Continue Reading</button>
          <button class="btn" onclick={() => go('/library')}>View Library</button>
        </div>
      </div>
    </div>
  </section>
{:else if !continueLoading}
  <section class="section continue-section">
    <div class="card continue-card continue-empty">
      <div class="continue-info">
        <span class="continue-label">Welcome to Koma</span>
        <h2 class="continue-title">Start Reading</h2>
        <p class="continue-desc">Search for a title or browse trending manga to get started.</p>
        <div class="continue-actions">
          <button class="btn btn-primary" onclick={() => go('/search')}>Search Titles</button>
          <button class="btn" onclick={() => go('/settings')}>Add a Source</button>
        </div>
      </div>
    </div>
  </section>
{/if}

<!-- Latest Updates — ComicK-style -->
<section class="section">
  <div class="section-head">
    <h2 class="h2">Latest Updates</h2>
    <button class="btn small-btn" onclick={() => go('/search')}>View All</button>
  </div>
  {#if latestLoading}
    <div class="grid">
      {#each Array(6) as _, i (i)}<div class="card skel"></div>{/each}
    </div>
  {:else if latestUpdates.length > 0}
    <div class="latest-strip">
      {#each latestUpdates.slice(0, 12) as item (item.slug)}
        <a class="latest-card" href={`#/search?q=${encodeURIComponent(item.title)}`}>
          <ProxiedImg src={item.cover} alt={item.title} />
          <div class="latest-info">
            <span class="latest-title">{item.title}</span>
            {#if item.lastChapter}
              <span class="latest-ch">Ch. {item.lastChapter}</span>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <!-- Fallback to AniList trending -->
    <div class="grid">
      {#each trending as t (t.id)}<TitleCard title={t} />{/each}
    </div>
  {/if}
</section>

<!-- Trending Now — ComicK-sourced -->
<section class="section">
  <div class="section-head">
    <h2 class="h2">Trending Now</h2>
    <button class="btn small-btn" onclick={() => go('/search')}>View All</button>
  </div>
  {#if trendingCkLoading}
    <div class="grid">
      {#each Array(6) as _, i (i)}<div class="card skel"></div>{/each}
    </div>
  {:else if trendingCk.length > 0}
    <div class="grid">
      {#each trendingCk.slice(0, 12) as item (item.slug)}
        <a class="card tcard-ck" href={`#/search?q=${encodeURIComponent(item.title)}`}>
          <ProxiedImg src={item.cover} alt={item.title} />
          <div class="tname">{item.title}</div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="grid">
      {#each trending as t (t.id)}<TitleCard title={t} />{/each}
    </div>
  {/if}
</section>

<!-- Popular Ongoing — ComicK-style -->
<section class="section">
  <div class="section-head">
    <h2 class="h2">Popular Ongoing</h2>
    <button class="btn small-btn" onclick={() => go('/search')}>View All</button>
  </div>
  {#if popularLoading}
    <div class="grid">
      {#each Array(6) as _, i (i)}<div class="card skel"></div>{/each}
    </div>
  {:else if popularOngoing.length > 0}
    <div class="latest-strip">
      {#each popularOngoing.slice(0, 12) as item (item.slug)}
        <a class="latest-card" href={`#/search?q=${encodeURIComponent(item.title)}`}>
          <ProxiedImg src={item.cover} alt={item.title} />
          <div class="latest-info">
            <span class="latest-title">{item.title}</span>
            {#if item.lastChapter}
              <span class="latest-ch">Ch. {item.lastChapter}</span>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="grid">
      {#each popularNew as t (t.id)}<TitleCard title={t} />{/each}
    </div>
  {/if}
</section>

<!-- Top New Follows — ComicK-style -->
<section class="section">
  <div class="section-head">
    <h2 class="h2">Top New</h2>
    <button class="btn small-btn" onclick={() => go('/search')}>View All</button>
  </div>
  {#if topNewLoading}
    <div class="grid">
      {#each Array(6) as _, i (i)}<div class="card skel"></div>{/each}
    </div>
  {:else if topNew.length > 0}
    <div class="grid">
      {#each topNew.slice(0, 12) as item (item.slug)}
        <a class="card tcard-ck" href={`#/search?q=${encodeURIComponent(item.title)}`}>
          <ProxiedImg src={item.cover} alt={item.title} />
          <div class="tname">{item.title}</div>
        </a>
      {/each}
    </div>
  {/if}
</section>

<!-- Browse -->
<section class="section">
  <div class="section-head">
    <h2 class="h2">Browse</h2>
  </div>
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
</section>

<style>
  .section { margin-bottom: var(--gap-lg); }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .h2 { font-size: 20px; font-weight: 650; margin: 0; }
  .small-btn { padding: 5px 10px; font-size: 13px; }
  .browsebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .tabs { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 3px; }
  .tab { background: transparent; border: 0; color: var(--muted); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .tab.active { background: var(--accent); color: #fff; }
  .sort { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 7px; padding: 7px 10px; font-size: 14px; }
  .skel { aspect-ratio: 3/4; }
  .err { color: var(--danger); display: flex; align-items: center; gap: 12px; }

  /* ComicK-style latest updates strip */
  .latest-strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x mandatory; }
  .latest-strip::-webkit-scrollbar { height: 6px; }
  .latest-card { flex: 0 0 160px; scroll-snap-align: start; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: border-color .15s, transform .15s; text-decoration: none; color: inherit; }
  .latest-card:hover { border-color: var(--accent); transform: translateY(-2px); }
  .latest-card :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .latest-info { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 3px; }
  .latest-title { font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .latest-ch { font-size: 12px; color: var(--muted-2); }

  /* ComicK-style grid cards */
  .tcard-ck { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s; }
  .tcard-ck:hover { border-color: var(--accent); transform: translateY(-2px); }
  .tcard-ck :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .tcard-ck .tname { padding: 9px 10px 11px; font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  /* Continue reading section */
  .continue-section { margin-bottom: var(--gap-lg); }
  .continue-card { display: flex; align-items: center; gap: 20px; padding: 24px; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border)); }
  .continue-empty { background: var(--surface); }
  .continue-info { display: flex; flex-direction: column; gap: 6px; }
  .continue-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--accent); font-weight: 600; }
  .continue-title { margin: 0; font-size: 20px; font-weight: 650; }
  .continue-meta { color: var(--muted); font-size: 14px; }
  .continue-desc { color: var(--muted); font-size: 14px; margin: 0; max-width: 480px; }
  .continue-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
