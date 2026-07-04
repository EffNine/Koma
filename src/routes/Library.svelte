<script lang="ts">
  import { go } from '../lib/router';
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
  import { progressLabel, historyLabel } from '../lib/ui/formatting';
  import { formatDateTime, timeAgo } from '../lib/util';

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
            const result = await resolveChapters(s, { id: title.mediaId, name: title.name, cover: title.cover ?? '' } as any);
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
          const result = await resolveChapters(s, { id: mediaId, name: title.name, cover: title.cover ?? '' } as any);
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

<div class="tabs">
  <button class:active={tab === 'updates'} onclick={() => (tab = 'updates')}>Updates</button>
  <button class:active={tab === 'all'} onclick={() => (tab = 'all')}>All</button>
  <button class:active={tab === 'reading'} onclick={() => (tab = 'reading')}>Reading</button>
  <button class:active={tab === 'plan'} onclick={() => (tab = 'plan')}>Plan to Read</button>
  <button class:active={tab === 'completed'} onclick={() => (tab = 'completed')}>Completed</button>
  <button class:active={tab === 'history'} onclick={() => (tab = 'history')}>History</button>
</div>

{#if err}
  <div class="card errbox">{err}</div>
{:else if loading}
  <div class="card empty">Loading library…</div>
{:else if tab === 'updates'}
  {#if updatesLoading}
    <div class="card empty">Checking for updates…</div>
  {:else if updates.length === 0}
    <EmptyState id="updates" compact />
  {:else}
    <section class="rows">
      {#each updates as u (u.mediaId)}
        <article class="card title-row">
          {#if u.cover}
            <img class="cover" src={u.cover} alt={u.name} />
          {/if}
          <div class="row-main">
            <h2>{u.name}</h2>
            <div class="meta">
              <span class="update-badge">New: Ch. {u.latestChapter}</span>
              {#if u.progressChapter}
                <span>Read: Ch. {u.progressChapter}</span>
              {/if}
              {#if u.latestGroup}
                <span>{u.latestGroup}</span>
              {/if}
              <span class="staleness">checked {timeAgo(u.checkedAt)}</span>
            </div>
          </div>
          <button class="btn" onclick={() => go(`/media/${u.mediaId}`)}>Open</button>
          <button class="btn small-btn" onclick={() => refreshTitle(u.mediaId)} disabled={refreshingId === u.mediaId}>
            {refreshingId === u.mediaId ? '…' : '↻'}
          </button>
        </article>
      {/each}
    </section>
  {/if}
{:else if tab === 'all' || tab === 'reading' || tab === 'plan' || tab === 'completed'}
  {#if followed.length === 0}
    <EmptyState id="library" />
  {:else if displayedTitles.length === 0}
    <EmptyState id="generic" context={`No titles in this list. Move titles here from their Media page.`} />
  {:else}
    <section class="rows">
      {#each displayedTitles as title (title.mediaId)}
        {@const p = progressByMedia.get(title.mediaId)}
        {@const listLabel = listBadge(p, title.readingList)}
        <article class="card title-row">
          {#if title.cover}
            <img class="cover" src={title.cover} alt={title.name} />
          {/if}
          <div class="row-main">
            <div class="row-head">
              <h2>{title.name}</h2>
              <span class="list-badge">{listLabel}</span>
            </div>
            <div class="meta">
              {#if title.country}<span>{title.country}</span>{/if}
              {#if title.status}<span>{title.status}</span>{/if}
              {#if title.totalChapters}<span>{title.totalChapters} ch.</span>{/if}
              <span>{progressLabel(p)}</span>
            </div>
          </div>
          <button class="btn" onclick={() => go(`/media/${title.mediaId}`)}>Open</button>
          {#if p?.chapterNumber}
            <button class="btn btn-primary" onclick={() => go(`/media/${title.mediaId}`)}>Continue</button>
          {/if}
        </article>
      {/each}
    </section>
  {/if}
{:else}
  {#if history.length === 0}
    <EmptyState id="history" />
  {:else}
    <section class="rows">
      {#each history as row (row.id)}
        <article class="card history-row">
          <div class="row-main">
            <h2>{titleFor(row.mediaId)}</h2>
            <div class="meta">
              <span>{historyLabel(row)}</span>
              {#if row.page !== undefined}<span>Page {row.page + 1}</span>{/if}
              <span>{formatDateTime(row.readAt)}</span>
            </div>
          </div>
          <a class="btn" href={row.chapterUrl} target="_blank" rel="noopener">Source</a>
          <button class="btn" onclick={() => go(`/media/${row.mediaId}`)}>Media</button>
        </article>
      {/each}
    </section>
  {/if}
{/if}

<style>
  .library-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 8px; }
  .head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .tabs { display: inline-flex; padding: 3px; border: 1px solid var(--border-soft); border-radius: var(--radius); background: var(--surface); margin-bottom: 16px; }
  .tabs button { min-width: 96px; min-height: 32px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--muted); padding: 0 12px; cursor: pointer; font-weight: 650; }
  .tabs button.active { color: #17110a; background: var(--accent); }
  .rows { display: flex; flex-direction: column; gap: 8px; }
  .title-row, .history-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 10px 12px; }
  .history-row { grid-template-columns: minmax(0, 1fr) auto auto; }
  .cover { width: 48px; aspect-ratio: 3 / 4; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border); background: var(--elevated); flex-shrink: 0; }
  .row-main { min-width: 0; flex: 1; }
  .row-main h2 { margin: 0; font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .list-badge { display: inline-flex; align-items: center; min-height: 18px; padding: 0 6px; border-radius: 999px; background: var(--accent-soft); color: color-mix(in srgb, var(--accent) 82%, white); border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; color: var(--muted); font-size: 13px; }
  .meta span { display: inline-flex; align-items: center; min-height: 20px; }
  .update-badge { color: color-mix(in srgb, var(--accent) 82%, white); background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); border-radius: 999px; padding: 0 7px; font-weight: 700; }
  .staleness { font-size: 12px; color: var(--muted-2); }
  .empty, .errbox { padding: 28px; color: var(--muted); text-align: center; }
  .errbox { color: var(--danger); }
  .small-btn { min-height: 30px; padding: 0 8px; font-size: 12px; min-width: 30px; text-align: center; }
  @media (max-width: 720px) {
    .title-row { grid-template-columns: 42px minmax(0, 1fr) auto; }
    .title-row .btn:not(.small-btn) { min-height: 32px; padding: 0 10px; font-size: 12px; }
    .history-row { grid-template-columns: minmax(0, 1fr) auto; }
    .history-row .btn:first-of-type { display: none; }
    .cover { width: 42px; }
    .row-main h2 { white-space: normal; }
    .tabs button { min-width: auto; padding: 0 10px; font-size: 12px; }
  }
</style>
