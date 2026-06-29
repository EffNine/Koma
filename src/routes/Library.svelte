<script lang="ts">
  import { go } from '../lib/router';
  import {
    listFollowedTitles,
    listHistory,
    listProgress,
    type HistoryEntry,
    type ProgressEntry,
    type TrackedTitle,
  } from '../lib/tracker/local';

  type Tab = 'followed' | 'history';

  let tab = $state<Tab>('followed');
  let loading = $state(true);
  let followed = $state<TrackedTitle[]>([]);
  let history = $state<HistoryEntry[]>([]);
  let progress = $state<ProgressEntry[]>([]);
  let err = $state('');

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
    } catch (e) {
      err = String(e);
    } finally {
      loading = false;
    }
  }

  function titleFor(mediaId: number): string {
    return titleByMedia.get(mediaId)?.name ?? `Title ${mediaId}`;
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
</script>

<div class="library-head">
  <div>
    <h1 class="h1">Library</h1>
    <p class="sub">Followed titles and local reading history.</p>
  </div>
  <button class="btn" onclick={loadLibrary} disabled={loading}>Refresh</button>
</div>

<div class="tabs">
  <button class:active={tab === 'followed'} onclick={() => (tab = 'followed')}>Followed</button>
  <button class:active={tab === 'history'} onclick={() => (tab = 'history')}>History</button>
</div>

{#if err}
  <div class="card errbox">{err}</div>
{:else if loading}
  <div class="card empty">Loading library…</div>
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
  .empty, .errbox { padding: 28px; color: var(--muted); text-align: center; }
  .errbox { color: var(--danger); }
  @media (max-width: 720px) {
    .title-row, .history-row { align-items: flex-start; flex-direction: column; }
    .cover { width: 64px; }
    .row-main h2 { white-space: normal; }
  }
</style>
