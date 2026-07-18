<script lang="ts">
  import { browse } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';
  import HomeContinueSection from '../lib/components/home/HomeContinueSection.svelte';
  import HomeFollowedUpdates from '../lib/components/home/HomeFollowedUpdates.svelte';
  import HomeComickSection from '../lib/components/home/HomeComickSection.svelte';
  import ProxiedImg from '../lib/components/ProxiedImg.svelte';
  import TitleCard from '../lib/components/TitleCard.svelte';
  import { go } from '../lib/router';
  import {
    fetchLatestUpdates,
    fetchPopularOngoing,
    fetchTrending,
    fetchTopFollowNew,
    type ComickLatestItem,
  } from '../lib/scraper/comickLatest';
  import {
    buildContinueReading,
    buildFollowedUpdates,
    type ContinueReadingItem,
  } from '../lib/media/continueReading';
  import { openTitleCandidate } from '../lib/media/openTitleCandidate';
  import { loadPinnedTitles } from '../lib/media/pinnedTitles';
  import { buildGenreSuggestions, type GenreSuggestion } from '../lib/media/genreSuggestions';
  import type { TrackedTitle } from '../lib/tracker/local';

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
  let pinnedTitles = $state<TrackedTitle[]>([]);
  let genreSuggestions = $state<GenreSuggestion[]>([]);
  let personalizationLoading = $state(true);

  // Navigating state for ComicK card clicks
  let navigatingTo = $state('');

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

  async function loadPersonalization() {
    personalizationLoading = true;
    try {
      const [pinned, suggestions] = await Promise.all([
        loadPinnedTitles(),
        buildGenreSuggestions(1, 8),
      ]);
      pinnedTitles = pinned;
      genreSuggestions = suggestions;
    } catch {
      pinnedTitles = [];
      genreSuggestions = [];
    } finally {
      personalizationLoading = false;
    }
  }

  $effect(() => {
    loadComickSections();
    loadTrending();
    loadPopularNew();
    loadContinueReading();
    loadFollowedUpdates();
    loadPersonalization();
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
      await openTitleCandidate(title);
    } catch {
      go(`/search?q=${encodeURIComponent(title)}`);
    } finally {
      navigatingTo = '';
    }
  }
</script>

<HomeContinueSection
  {continueItems}
  {continueLoading}
  {chapterLabel}
  {resumeUrl}
/>

{#if !personalizationLoading && pinnedTitles.length > 0}
  <section class="section pinned-section">
    <div class="section-head">
      <h2 class="h2">Pinned Titles</h2>
      <button class="btn small-btn" onclick={() => go('/library')}>Library</button>
    </div>
    <div class="grid">
      {#each pinnedTitles as item (item.mediaId)}
        <button class="card tcard-ck" onclick={() => go(`/media/${item.mediaId}`)}>
          {#if item.cover}
            <ProxiedImg src={item.cover} alt={item.name} />
          {:else}
            <div class="nocover">{item.name}</div>
          {/if}
          <div class="tname">{item.name}</div>
          <div class="tcard-footer"><span class="tcard-btn">Open</span></div>
        </button>
      {/each}
    </div>
  </section>
{/if}

{#if !personalizationLoading && genreSuggestions.length > 0}
  {#each genreSuggestions as suggestion (suggestion.genre)}
    <section class="section genre-suggestion">
      <div class="section-head">
        <div>
          <h2 class="h2">Because you read {suggestion.seedTitle}</h2>
          <p class="section-sub">Trending {suggestion.genre} titles from AniList</p>
        </div>
        <button class="btn small-btn" onclick={() => go(`/search?genres=${encodeURIComponent(suggestion.genre)}`)}>View genre</button>
      </div>
      <div class="grid">
        {#each suggestion.titles as title (title.id)}
          <TitleCard {title} />
        {/each}
      </div>
    </section>
  {/each}
{/if}

<HomeFollowedUpdates
  {followedUpdates}
  {followedUpdatesLoading}
  {chapterLabel}
  {resumeUrl}
/>

<HomeComickSection
  title="Latest Updates"
  loading={latestLoading}
  err={latestErr}
  items={latestUpdates}
  fallbackTitles={trending}
  {navigatingTo}
  layout="strip"
  onRetry={loadComickSections}
  onClickItem={(item) => goToMedia(item.title, item.slug)}
/>

<HomeComickSection
  title="Trending Now"
  loading={trendingCkLoading}
  items={trendingCk}
  fallbackTitles={trending}
  {navigatingTo}
  onRetry={loadComickSections}
  onClickItem={(item) => goToMedia(item.title, item.slug)}
/>

<HomeComickSection
  title="Popular Ongoing"
  loading={popularLoading}
  err={popularErr}
  items={popularOngoing}
  fallbackTitles={popularNew}
  {navigatingTo}
  layout="strip"
  onRetry={loadComickSections}
  onClickItem={(item) => goToMedia(item.title, item.slug)}
/>

<HomeComickSection
  title="Top New"
  loading={topNewLoading}
  items={topNew}
  fallbackTitles={[]}
  {navigatingTo}
  onRetry={loadComickSections}
  onClickItem={(item) => goToMedia(item.title, item.slug)}
/>

<style>
  .section { margin-bottom: var(--gap-lg); }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .section-sub { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .small-btn { min-height: 30px; padding: 0 10px; font-size: 12px; }
  .tcard-ck { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s, opacity .15s; }
  .tcard-ck:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .tcard-ck :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .tcard-ck .tname { min-height: 52px; padding: 9px 10px 0; font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tcard-footer { padding: 6px 10px 10px; }
  .tcard-btn { display: inline-block; font-size: 11px; font-weight: 650; color: var(--accent); padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; transition: background .15s; }
  .nocover { aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; background: var(--elevated); }
</style>
