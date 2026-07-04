<script lang="ts">
  import { browse, search, SORTS } from '../lib/catalog/anilist';
  import type { Country, Title } from '../lib/catalog/types';
  import TitleCard from '../lib/components/TitleCard.svelte';
  import ProxiedImg from '../lib/components/ProxiedImg.svelte';
  import EmptyState from '../lib/components/EmptyState.svelte';
  import { go } from '../lib/router';
  import {
    fetchLatestUpdates,
    fetchPopularOngoing,
    fetchTrending,
    fetchTopFollowNew,
    type ComickLatestItem,
  } from '../lib/scraper/comickLatest';
  import { findSeries } from '../lib/scraper/scraper';
  import {
    buildContinueReading,
    buildFollowedUpdates,
    type ContinueReadingItem,
  } from '../lib/media/continueReading';
  import { relativeTime } from '../lib/util';

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
  let latestErr = $state('');
  let popularOngoing = $state<ComickLatestItem[]>([]);
  let popularLoading = $state(true);
  let popularErr = $state('');
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
  let continueItems = $state<ContinueReadingItem[]>([]);
  let continueLoading = $state(true);
  let followedUpdates = $state<ContinueReadingItem[]>([]);
  let followedUpdatesLoading = $state(true);

  // Navigating state for ComicK card clicks
  let navigatingTo = $state('');

  async function load() {
    loading = true; err = '';
    try { titles = await browse(tab, SORTS[sort]); }
    catch (e) { err = String(e); titles = []; }
    finally { loading = false; }
  }
  $effect(() => { tab; sort; load(); });

  async function loadComickSection(
    fetcher: () => Promise<ComickLatestItem[]>,
    setter: (items: ComickLatestItem[]) => void,
    errSetter: (err: string) => void,
    doneSetter: () => void,
  ) {
    try {
      const items = await fetcher();
      setter(items);
    } catch (e) {
      errSetter(String(e));
    } finally {
      doneSetter();
    }
  }

  // Load ComicK-sourced sections in parallel with independent error handling
  function loadComickSections() {
    latestLoading = true; latestErr = '';
    popularLoading = true; popularErr = '';
    trendingCkLoading = true;
    topNewLoading = true;
    void loadComickSection(fetchLatestUpdates, (v) => latestUpdates = v, (v) => latestErr = v, () => latestLoading = false);
    void loadComickSection(fetchPopularOngoing, (v) => popularOngoing = v, (v) => popularErr = v, () => popularLoading = false);
    void loadComickSection(() => fetchTrending('7'), (v) => trendingCk = v, () => {}, () => trendingCkLoading = false);
    void loadComickSection(() => fetchTopFollowNew('7'), (v) => topNew = v, () => {}, () => topNewLoading = false);
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
      continueItems = await buildContinueReading(6);
    } catch {
      continueItems = [];
    } finally {
      continueLoading = false;
    }
  }

  async function loadFollowedUpdates() {
    followedUpdatesLoading = true;
    try {
      followedUpdates = await buildFollowedUpdates(6);
    } catch {
      followedUpdates = [];
    } finally {
      followedUpdatesLoading = false;
    }
  }

  $effect(() => {
    loadComickSections();
    loadTrending();
    loadPopularNew();
    loadContinueReading();
    loadFollowedUpdates();
  });

  function readerUrl(item: ContinueReadingItem): string {
    if (!item.seriesUrl) return '';
    return `/reader/${item.mediaId}/${item.sourceId}/${encodeURIComponent(item.seriesUrl)}/${encodeURIComponent(item.chapterUrl)}`;
  }

  function resumeUrl(item: ContinueReadingItem): string {
    const url = readerUrl(item);
    if (url) return url;
    return `/media/${item.mediaId}`;
  }

  function chapterLabel(item: ContinueReadingItem): string {
    const parts: string[] = [];
    if (item.chapterNumber) parts.push(`Ch. ${item.chapterNumber}`);
    else if (item.chapterTitle) parts.push(item.chapterTitle);
    if (item.page > 0) parts.push(`page ${item.page + 1}`);
    return parts.join(' · ');
  }

  async function goToMedia(title: string, slug: string) {
    navigatingTo = slug;
    try {
      const results = await search(title);
      if (results.length > 0) {
        go(`/media/${results[0].id}`);
        return;
      }
    } catch { /* fall through to ComicK */ }
    // Fallback: search ComicK directly and go to first chapter
    try {
      const all = await (await import('../lib/scraper/sources')).enabledSources();
      const ck = all.find((s) => s.preset === 'comick');
      if (ck) {
        const series = await findSeries(ck, title);
        if (series) {
          const chapters = await (await import('../lib/scraper/scraper')).getChapters(ck, series.url);
          if (chapters.length > 0) {
            go(`/reader/0/comickz.co.uk/${encodeURIComponent(series.url)}/${encodeURIComponent(chapters[0].url)}`);
          }
          return;
        }
      }
    } catch { /* fall through to search page */ }
    go(`/search?q=${encodeURIComponent(title)}`);
  }
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
          <ProxiedImg src={primary.cover} alt={primary.title} class="continue-cover" />
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
  {:else if latestErr}
    <div class="card errbox">
      {latestErr}
      <button class="btn small-btn" onclick={loadComickSections}>Retry</button>
    </div>
  {:else if latestUpdates.length > 0}
    <div class="latest-strip">
      {#each latestUpdates.slice(0, 12) as item (item.slug)}
        <button class="latest-card" class:busy={navigatingTo === item.slug} onclick={() => goToMedia(item.title, item.slug)}>
          <ProxiedImg src={item.cover} alt="" />
          <div class="latest-info">
            <span class="latest-title">{item.title}</span>
            {#if item.lastChapter}
              <span class="latest-ch">Ch. {item.lastChapter}</span>
            {/if}
          </div>
          <div class="tcard-footer">
            <span class="tcard-btn">{navigatingTo === item.slug ? 'Opening…' : 'Read'}</span>
          </div>
        </button>
      {/each}
    </div>
  {:else}
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
        <button class="card tcard-ck" class:busy={navigatingTo === item.slug} onclick={() => goToMedia(item.title, item.slug)}>
          <ProxiedImg src={item.cover} alt="" />
          <div class="tname">{item.title}</div>
          <div class="tcard-footer">
            <span class="tcard-btn">{navigatingTo === item.slug ? 'Opening…' : 'Read'}</span>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="grid">
      {#each trending as t (t.id)}<TitleCard title={t} />{/each}
    </div>
  {/if}
</section>

<!-- Popular Ongoing -- ComicK-style -->
<section class="section">
  <div class="section-head">
    <h2 class="h2">Popular Ongoing</h2>
    <button class="btn small-btn" onclick={() => go('/search')}>View All</button>
  </div>
  {#if popularLoading}
    <div class="grid">
      {#each Array(6) as _, i (i)}<div class="card skel"></div>{/each}
    </div>
  {:else if popularErr}
    <div class="card errbox">
      {popularErr}
      <button class="btn small-btn" onclick={loadComickSections}>Retry</button>
    </div>
  {:else if popularOngoing.length > 0}
    <div class="latest-strip">
      {#each popularOngoing.slice(0, 12) as item (item.slug)}
        <button class="latest-card" class:busy={navigatingTo === item.slug} onclick={() => goToMedia(item.title, item.slug)}>
          <ProxiedImg src={item.cover} alt="" />
          <div class="latest-info">
            <span class="latest-title">{item.title}</span>
            {#if item.lastChapter}
              <span class="latest-ch">Ch. {item.lastChapter}</span>
            {/if}
          </div>
          <div class="tcard-footer">
            <span class="tcard-btn">{navigatingTo === item.slug ? 'Opening…' : 'Read'}</span>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="grid">
      {#each popularNew as t (t.id)}<TitleCard title={t} />{/each}
    </div>
  {/if}
</section>

<!-- Top New Follows -- ComicK-style -->
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
        <button class="card tcard-ck" class:busy={navigatingTo === item.slug} onclick={() => goToMedia(item.title, item.slug)}>
          <ProxiedImg src={item.cover} alt="" />
          <div class="tname">{item.title}</div>
          <div class="tcard-footer">
            <span class="tcard-btn">{navigatingTo === item.slug ? 'Opening…' : 'Read'}</span>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <EmptyState id="generic" context="No trending data right now." compact />
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
    <div class="card errbox">
      {err}. <button class="btn" onclick={load}>Retry</button>
    </div>
  {:else if loading}
    <div class="grid">
      {#each Array(12) as _, i (i)}<div class="card skel"></div>{/each}
    </div>
  {:else if titles.length === 0}
    <EmptyState id="generic" context="No titles match these filters." compact />
  {:else}
    <div class="grid">
      {#each titles as t (t.id)}<TitleCard title={t} />{/each}
    </div>
  {/if}
</section>

<style>
  .section { margin-bottom: var(--gap-lg); }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .small-btn { min-height: 30px; padding: 0 10px; font-size: 12px; }
  .browsebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .tabs { display: flex; gap: 3px; background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 3px; }
  .tab { min-height: 31px; background: transparent; border: 0; color: var(--muted); padding: 0 12px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 620; }
  .tab.active { background: var(--accent); color: #17110a; }
  .sort { min-height: var(--control-h); background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-sm); padding: 0 10px; font-size: 14px; }
  .skel { aspect-ratio: 3/4; }
  .errbox { color: var(--danger); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px; }

  /* ComicK-style latest updates strip */
  .latest-strip { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 8px; scroll-snap-type: x mandatory; }
  .latest-strip::-webkit-scrollbar { height: 6px; }
  .latest-card { flex: 0 0 154px; scroll-snap-align: start; background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s, opacity .15s; color: inherit; padding: 0; text-align: left; font-family: inherit; font-size: inherit; }
  .latest-card:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .latest-card.busy { opacity: .7; cursor: wait; }
  .latest-card :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .latest-info { padding: 8px 10px 0; display: flex; flex-direction: column; gap: 3px; }
  .latest-title { font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .latest-ch { font-size: 12px; color: var(--muted-2); }

  /* ComicK-style grid cards */
  .tcard-ck { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s, opacity .15s; }
  .tcard-ck:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .tcard-ck.busy { opacity: .7; cursor: wait; }
  .tcard-ck :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .tcard-ck .tname { min-height: 52px; padding: 9px 10px 0; font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tcard-footer { padding: 6px 10px 10px; }
  .tcard-btn { display: inline-block; font-size: 11px; font-weight: 650; color: var(--accent); padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; transition: background .15s; }
  .tcard-btn:hover { background: var(--accent-soft); }

  /* Continue reading section */
  .continue-section { margin-bottom: 32px; }
  .continue-card {
    display: flex; align-items: center; gap: clamp(14px, 3vw, 24px); padding: clamp(16px, 3vw, 24px);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, var(--surface)), var(--surface) 58%),
      var(--surface);
    border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    text-align: left;
  }
  .continue-cover {
    flex: 0 0 auto;
    width: clamp(96px, 22vw, 160px);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--elevated);
  }
  .continue-cover :global(img), .continue-cover.nocover { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
  .continue-cover.nocover { display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; }
  .continue-empty { background: var(--surface); box-shadow: none; }
  .continue-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .continue-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight: 760; }
  .continue-title { margin: 0; font-size: clamp(20px, 3vw, 28px); line-height: 1.12; font-weight: 780; }
  .continue-desc { color: var(--muted); font-size: 14px; margin: 0; max-width: 480px; }
  .continue-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .continue-grid { margin-top: 16px; }
  .nocover { aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; background: var(--elevated); }

  @media (max-width: 680px) {
    .latest-card { flex-basis: 136px; }
    .continue-card { align-items: flex-start; }
  }
</style>
