<script lang="ts">
  import { go } from '../lib/router';
  import {
    listFollowedTitles,
    listHistory,
    listProgress,
    getProgress,
    type HistoryEntry,
    type ProgressEntry,
    type TrackedTitle,
  } from '../lib/tracker/local';
  import { computeUnreadUpdates, type UnreadUpdate } from '../lib/media/chapterSnapshots';
  import { getSource, enabledSources } from '../lib/scraper/sources';
  import { resolveChapters } from '../lib/media/chapterResolver';
  import { db } from '../lib/db';
  import { media } from '../lib/catalog/anilist';

  type Tab = 'updates' | 'followed' | 'history';

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

  let progressByMedia = $derived(new Map(progress.map((row) => [row.mediaId, row])));
  let titleByMedia = $derived(new Map(followed.map((row) => [row.mediaId, row])));

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
      // Load title names for history entries
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

  // Load updates when tab switches to 'updates'
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

      // Build a map of mediaId -> { source, seriesUrl } by trying to resolve each followed title
      const sourceMap = new Map<number, { source: import('../lib/scraper/sources').Source; seriesUrl: string }>();
      const progressMap = new Map<number, { chapterNumber?: string }>();

      for (const title of followed) {
        const p = progressByMedia.get(title.mediaId);
        if (p) progressMap.set(title.mediaId, { chapterNumber: p.chapterNumber });

        // Try each enabled source to find chapters for this title
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
      // Reload updates
      await loadUpdates();
    } finally {
      refreshingId = null;
    }
  }

  function titleFor(mediaId: number): string {
    return titleNames.get(mediaId) ?? titleByMedia.get(mediaId)?.name ?? `Title ${mediaId}`;
  }

  function progressLabel(row: ProgressEntry | undefined): string {
    if (!row) return 'No chapters read yet';
    const chapter = row.chapterNumber ?? '?';
    return row.status === 'COMPLETED' ? `Completed at chapter ${chapter}` : `Chapter ${chapter}`;
  }

  function historyLabel(row: HistoryEntry): string {
    if (row.chapterTitle) return row.chapterTitle;
    if (row.chapterNumber) return `Chapter ${row.chapterNumber}`;
    return 'Chapter';
  }

  function when(ts: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  }

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
</script>

<div class="library-head">
  <div>
    <h1 class="h1">Library</h1>
    <p class="sub">Followed titles and local reading history.</p>
  </div>
  <button class="btn" onclick={loadLibrary} disabled={loading}>Refresh</button>
</div>

<div class="tabs">
  <button class:active={tab === 'updates'} onclick={() => (tab = 'updates')}>Updates</button>
  <button class:active={tab === 'followed'} onclick={() => (tab = 'followed')}>Followed</button>
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
    <div class="card empty">No new updates. Follow titles and read some chapters to see what's new.</div>
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
          <button class="btn btn-primary" onclick={() => go(`/media/${u.mediaId}`)}>Continue</button>
          <button class="btn small-btn" onclick={() => refreshTitle(u.mediaId)} disabled={refreshingId === u.mediaId}>
            {refreshingId === u.mediaId ? '…' : '↻'}
          </button>
        </article>
      {/each}
    </section>
  {/if}
{:else if tab === 'followed'}
  {#if followed.length === 0}
    <div class="card empty">Follow a title from its Media page to pin it here.</div>
  {:else}
    <section class="rows">
      {#each followed as title (title.mediaId)}
        <article class="card title-row">
          {#if title.cover}
            <img class="cover" src={title.cover} alt={title.name} />
          {/if}
          <div class="row-main">
            <h2>{title.name}</h2>
            <div class="meta">
              {#if title.country}<span>{title.country}</span>{/if}
              {#if title.status}<span>{title.status}</span>{/if}
              {#if title.totalChapters}<span>{title.totalChapters} ch.</span>{/if}
              <span>{progressLabel(progressByMedia.get(title.mediaId))}</span>
            </div>
          </div>
          <button class="btn" onclick={() => go(`/media/${title.mediaId}`)}>Open</button>
          {#if progressByMedia.get(title.mediaId)?.chapterNumber}
            <button class="btn btn-primary" onclick={() => go(`/media/${title.mediaId}`)}>Continue</button>
          {/if}
        </article>
      {/each}
    </section>
  {/if}
{:else}
  {#if history.length === 0}
    <div class="card empty">Read a chapter to start local history.</div>
  {:else}
    <section class="rows">
      {#each history as row (row.id)}
        <article class="card history-row">
          <div class="row-main">
            <h2>{titleFor(row.mediaId)}</h2>
            <div class="meta">
              <span>{historyLabel(row)}</span>
              {#if row.page !== undefined}<span>Page {row.page + 1}</span>{/if}
              <span>{when(row.readAt)}</span>
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
  .library-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .tabs { display: inline-flex; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); margin-bottom: 16px; }
  .tabs button { min-width: 96px; border: 0; border-radius: calc(var(--radius-sm) - 2px); background: transparent; color: var(--muted); padding: 8px 12px; cursor: pointer; }
  .tabs button.active { color: #fff; background: var(--accent); }
  .rows { display: flex; flex-direction: column; gap: 10px; }
  .title-row, .history-row { display: flex; align-items: center; gap: 12px; }
  .cover { width: 52px; aspect-ratio: 3 / 4; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border); background: var(--elevated); flex-shrink: 0; }
  .row-main { min-width: 0; flex: 1; }
  .row-main h2 { margin: 0; font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; color: var(--muted); font-size: 13px; }
  .update-badge { color: var(--accent); font-weight: 600; }
  .staleness { font-size: 12px; color: var(--muted-2); }
  .empty, .errbox { padding: 28px; color: var(--muted); text-align: center; }
  .errbox { color: var(--danger); }
  .small-btn { padding: 4px 8px; font-size: 12px; min-width: 28px; text-align: center; }
  @media (max-width: 720px) {
    .title-row, .history-row { align-items: flex-start; flex-direction: column; }
    .cover { width: 64px; }
    .row-main h2 { white-space: normal; }
  }
</style>
