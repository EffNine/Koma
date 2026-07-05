<script lang="ts">
  import { browse } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';
  import HomeContinueSection from '../lib/components/home/HomeContinueSection.svelte';
  import HomeFollowedUpdates from '../lib/components/home/HomeFollowedUpdates.svelte';
  import HomeComickSection from '../lib/components/home/HomeComickSection.svelte';
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

<!-- Quick entry points -->
<section class="section quick-links">
  <button class="quick-link" onclick={() => go('/search')}>
    <span class="ql-icon">🔍</span>
    <span class="ql-label">Search</span>
  </button>
  <button class="quick-link" onclick={() => go('/library')}>
    <span class="ql-icon">📚</span>
    <span class="ql-label">Library</span>
  </button>
  <button class="quick-link" onclick={() => go('/categories')}>
    <span class="ql-icon">🏷️</span>
    <span class="ql-label">Categories</span>
  </button>
  <button class="quick-link" onclick={() => go('/genres')}>
    <span class="ql-icon">🎭</span>
    <span class="ql-label">Genres</span>
  </button>
  <button class="quick-link" onclick={() => go('/activity')}>
    <span class="ql-icon">📋</span>
    <span class="ql-label">Activity</span>
  </button>
  <button class="quick-link" onclick={() => go('/settings')}>
    <span class="ql-icon">⚙️</span>
    <span class="ql-label">Settings</span>
  </button>
</section>

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
  .quick-links { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: var(--gap-lg); }
  .quick-link {
    display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px;
    border-radius: var(--radius-sm); border: 1px solid var(--border-soft); background: var(--surface);
    color: var(--text); font-size: 13px; cursor: pointer; transition: all .15s;
  }
  .quick-link:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
  .ql-icon { font-size: 14px; }
  .ql-label { font-weight: 600; }
</style>
