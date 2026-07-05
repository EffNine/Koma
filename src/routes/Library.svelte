<script lang="ts">
  import {
    listFollowedTitles,
    listHistory,
    listProgress,
    type HistoryEntry,
    type ProgressEntry,
    type TrackedTitle,
    type ReadingList,
  } from '../lib/tracker/local';
  import { syncAniListLibrary } from '../lib/tracker/sync';
  import { computeUnreadUpdates, type UnreadUpdate } from '../lib/media/chapterSnapshots';
  import { enabledSources } from '../lib/scraper/sources';
  import { resolveChapters } from '../lib/media/chapterResolver';
  import { db } from '../lib/db';
  import EmptyState from '../lib/components/EmptyState.svelte';
  import Toast from '../lib/components/Toast.svelte';
  import LibraryTabBar from '../lib/components/library/LibraryTabBar.svelte';
  import LibraryTitleCard from '../lib/components/library/LibraryTitleCard.svelte';
  import LibraryHistoryList from '../lib/components/library/LibraryHistoryList.svelte';
  import LibraryUpdatesList from '../lib/components/library/LibraryUpdatesList.svelte';

  type Tab = 'updates' | 'all' | 'reading' | 'plan' | 'completed' | 'history';

  let tab = $state<Tab>('updates');
  let loading = $state(true);
  let followed = $state<TrackedTitle[]>([]);
  let history = $state<HistoryEntry[]>([]);
  let progress = $state<ProgressEntry[]>([]);
  let err = $state('');
  let updates = $state<UnreadUpdate[]>([]);
  let updatesLoading = $state(false);
  let refreshingId = $state<number | null>(null);
  let titleNames = $state<Map<number, string>>(new Map());
  let anilistSyncing = $state(false);
  let toast = $state<{ text: string; tone: 'ok' | 'err' | 'info' } | null>(null);

  let progressByMedia = $derived(latestProgressByMedia(progress));
  let titleByMedia = $derived(new Map(followed.map((row) => [row.mediaId, row])));
  let displayedTitles = $derived(filterTitlesForTab(followed, tab, progressByMedia));
  let newChaptersByMedia = $derived.by(() => {
    const map = new Map<number, number>();
    for (const u of updates) {
      map.set(u.mediaId, u.newChapterCount ?? 1);
    }
    return map;
  });

  $effect(() => {
    void loadLibrary();
  });

  async function loadLibrary() {
    loading = true;
    err = '';
    try {
      const [nextFollowed, nextHistory, nextProgress] = await Promise.all([
        listFollowedTitles(),
        listHistory(),
        listProgress(),
      ]);
      followed = nextFollowed;
      history = nextHistory;
      progress = nextProgress;
      const names = new Map<number, string>();
      for (const t of nextFollowed) names.set(t.mediaId, t.name);
      for (const row of nextHistory) {
        if (!names.has(row.mediaId)) {
          const tracked = await db.trackedTitles.get(row.mediaId);
          if (tracked?.name) names.set(row.mediaId, tracked.name);
        }
      }
      titleNames = names;
    } catch (e) {
      err = String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (tab === 'updates' && followed.length > 0) {
      void loadUpdates();
    }
  });

  async function loadUpdates() {
    updatesLoading = true;
    try {
      const allSources = await enabledSources();
      if (allSources.length === 0) { updates = []; return; }

      const sourceMap = new Map<number, { source: import('../lib/scraper/sources').Source; seriesUrl: string }>();
      const progressMap = new Map<number, { chapterNumber?: string }>();

      for (const title of followed) {
        const p = progressByMedia.get(title.mediaId);
        if (p) progressMap.set(title.mediaId, { chapterNumber: p.chapterNumber });

        for (const s of allSources) {
          try {
            const result = await resolveChapters(s, { id: title.mediaId, title: { english: title.name, romaji: title.name, native: title.name }, name: title.name, cover: title.cover ?? '' } as import('../lib/catalog/types').Title);
            if (!('err' in result) && result.chapters.length > 0) {
              sourceMap.set(title.mediaId, { source: s, seriesUrl: result.seriesUrl });
              break;
            }
          } catch { continue; }
        }
      }

      updates = await computeUnreadUpdates(followed, progressMap, sourceMap);
    } catch (e) {
      console.error('Failed to load updates:', e);
    } finally {
      updatesLoading = false;
    }
  }

  async function refreshTitle(mediaId: number) {
    refreshingId = mediaId;
    try {
      const allSources = await enabledSources();
      const title = followed.find((t) => t.mediaId === mediaId);
      if (!title) return;

      for (const s of allSources) {
        try {
          const result = await resolveChapters(s, { id: mediaId, title: { english: title.name, romaji: title.name, native: title.name }, name: title.name, cover: title.cover ?? '' } as import('../lib/catalog/types').Title);
          if (!('err' in result) && result.chapters.length > 0) {
            const { refreshFollowedTitleChapters } = await import('../lib/media/chapterSnapshots');
            await refreshFollowedTitleChapters(mediaId, s, result.seriesUrl);
            break;
          }
        } catch { continue; }
      }
      await loadUpdates();
      toast = { text: `${title.name} updated`, tone: 'ok' };
    } catch (e) {
      toast = { text: 'Update check failed: ' + String(e), tone: 'err' };
    } finally {
      refreshingId = null;
    }
  }

  async function syncAniList() {
    anilistSyncing = true;
    try {
      const result = await syncAniListLibrary();
      toast = {
        text: `Imported ${result.importedTitles} title${result.importedTitles === 1 ? '' : 's'} and ${result.importedProgress} progress entr${result.importedProgress === 1 ? 'y' : 'ies'}.`,
        tone: 'ok',
      };
      await loadLibrary();
      tab = 'all';
    } catch (e) {
      toast = { text: 'AniList sync failed: ' + String(e), tone: 'err' };
    } finally {
      anilistSyncing = false;
    }
  }

  function titleFor(mediaId: number): string {
    return titleNames.get(mediaId) ?? titleByMedia.get(mediaId)?.name ?? `Title ${mediaId}`;
  }

  function latestProgressByMedia(rows: ProgressEntry[]): Map<number, ProgressEntry> {
    const out = new Map<number, ProgressEntry>();
    for (const row of rows) {
      if (!out.has(row.mediaId)) out.set(row.mediaId, row);
    }
    return out;
  }

  function filterTitlesForTab(
    rows: TrackedTitle[],
    currentTab: Tab,
    progressMap: Map<number, ProgressEntry>,
  ): TrackedTitle[] {
    if (currentTab === 'all' || currentTab === 'updates' || currentTab === 'history') return rows;
    const map: Record<string, ReadingList> = {
      reading: 'Reading',
      plan: 'Plan to Read',
      completed: 'Completed',
    };
    const target = map[currentTab];
    return rows.filter((t) => {
      if (t.readingList) return t.readingList === target;
      const p = progressMap.get(t.mediaId);
      if (target === 'Completed') return p?.status === 'COMPLETED';
      if (target === 'Reading') return p?.status === 'READING';
      if (target === 'Plan to Read') return !p;
      return false;
    });
  }

  function listBadge(p: ProgressEntry | undefined, explicitList?: ReadingList): string {
    if (explicitList) return explicitList;
    if (p?.status === 'COMPLETED') return 'Completed';
    if (p) return 'Reading';
    return 'Plan to Read';
  }
</script>

<div class="library-head">
  <div>
    <h1 class="h1">Library</h1>
    <p class="sub">Followed titles and local reading history.</p>
  </div>
  <div class="head-actions">
    <button class="btn" onclick={syncAniList} disabled={anilistSyncing}>{anilistSyncing ? 'Syncing…' : 'Sync AniList'}</button>
    <button class="btn" onclick={loadLibrary} disabled={loading}>Refresh</button>
  </div>
</div>

{#if toast}
  <Toast text={toast.text} tone={toast.tone} onDismiss={() => (toast = null)} />
{/if}

<LibraryTabBar {tab} onTabChange={(t) => (tab = t)} />

{#if err}
  <div class="card errbox">{err}</div>
{:else if loading}
  <div class="card empty">Loading library…</div>
{:else if tab === 'updates'}
  <LibraryUpdatesList
    {updates}
    {updatesLoading}
    {refreshingId}
    onRefresh={refreshTitle}
  />
{:else if tab === 'all' || tab === 'reading' || tab === 'plan' || tab === 'completed'}
  {#if followed.length === 0}
    <EmptyState id="library" />
  {:else if displayedTitles.length === 0}
    <EmptyState id="generic" context="No titles in this list. Move titles here from their Media page." />
  {:else}
    <section class="rows">
      {#each displayedTitles as title (title.mediaId)}
        {@const p = progressByMedia.get(title.mediaId)}
        {@const listLabel = listBadge(p, title.readingList)}
        <LibraryTitleCard {title} progress={p} {listLabel} newChapters={newChaptersByMedia.get(title.mediaId) ?? 0} />
      {/each}
    </section>
  {/if}
{:else}
  {#if history.length === 0}
    <EmptyState id="history" />
  {:else}
    <LibraryHistoryList {history} {titleFor} />
  {/if}
{/if}

<style>
  .library-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 8px; }
  .head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .rows { display: flex; flex-direction: column; gap: 8px; }
  .empty, .errbox { padding: 28px; color: var(--muted); text-align: center; }
  .errbox { color: var(--danger); }
</style>
