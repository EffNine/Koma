<script lang="ts">
  import { onMount } from 'svelte';
  import { go } from '../lib/router';
  import { listHistory, type HistoryEntry } from '../lib/tracker/local';
  import { db } from '../lib/db';
  import { media } from '../lib/catalog/anilist';
  import { titleName } from '../lib/catalog/types';

  let history = $state<HistoryEntry[]>([]);
  let loading = $state(true);
  let err = $state('');
  let titleNames = $state<Map<number, string>>(new Map());

  onMount(() => load());

  async function load() {
    loading = true; err = '';
    try {
      const h = await listHistory(200);
      history = h;
      // Load title names from tracked titles table, fall back to AniList
      const names = new Map<number, string>();
      for (const row of h) {
        if (!names.has(row.mediaId)) {
          const tracked = await db.trackedTitles.get(row.mediaId);
          if (tracked?.name) {
            names.set(row.mediaId, tracked.name);
          } else {
            try {
              const title = await media(row.mediaId);
              if (title) names.set(row.mediaId, titleName(title));
            } catch {}
          }
        }
      }
      titleNames = names;
    } catch (e) { err = String(e); }
    finally { loading = false; }
  }

  function nameFor(mediaId: number): string {
    return titleNames.get(mediaId) ?? `Title #${mediaId}`;
  }

  function when(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  }

  function historyLabel(row: HistoryEntry): string {
    if (row.chapterTitle) return row.chapterTitle;
    if (row.chapterNumber) return `Chapter ${row.chapterNumber}`;
    return 'Chapter';
  }

  // Group history by date
  let groups = $derived.by(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const row of history) {
      const d = new Date(row.readAt);
      const key = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
      const arr = map.get(key);
      if (arr) arr.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()];
  });
</script>

<div class="activity-head">
  <h1 class="h1">Activity</h1>
  <p class="sub">Your reading history, newest first.</p>
  <button class="btn" onclick={load} disabled={loading}>Refresh</button>
</div>

{#if err}
  <div class="card errbox">{err}</div>
{:else if loading}
  <div class="card empty">Loading activity…</div>
{:else if history.length === 0}
  <div class="card empty">
    <span class="empty-icon">📖</span>
    <p>No reading activity yet.</p>
    <p class="empty-sub">Read a chapter to start tracking your history here.</p>
  </div>
{:else}
  <div class="timeline">
    {#each groups as [date, rows] (date)}
      <div class="day-group">
        <div class="day-label">{date}</div>
        <div class="day-entries">
          {#each rows as row (row.id)}
            <div class="card entry-row">
              <div class="entry-icon">{row.page !== undefined ? '📄' : '📖'}</div>
              <div class="entry-main">
                <div class="entry-title">{nameFor(row.mediaId)}</div>
                <div class="entry-meta">
                  <span>{historyLabel(row)}</span>
                  {#if row.page !== undefined}<span>· Page {row.page + 1}</span>{/if}
                  <span>· {when(row.readAt)}</span>
                </div>
              </div>
              <button class="btn small-btn" onclick={() => go(`/media/${row.mediaId}`)}>Open</button>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .activity-head { margin-bottom: var(--gap-lg); display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .timeline { display: flex; flex-direction: column; gap: var(--gap-lg); }
  .day-label { font-size: 14px; font-weight: 600; color: var(--muted); margin-bottom: 8px; padding-left: 4px; }
  .day-entries { display: flex; flex-direction: column; gap: 6px; }
  .entry-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
  .entry-icon { font-size: 18px; flex-shrink: 0; }
  .entry-main { min-width: 0; flex: 1; }
  .entry-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .entry-meta { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .small-btn { padding: 5px 10px; font-size: 13px; }
  .empty { text-align: center; padding: 40px; color: var(--muted); }
  .empty-icon { font-size: 40px; display: block; margin-bottom: 12px; }
  .empty-sub { font-size: 13px; margin-top: 4px; }
  .errbox { color: var(--danger); }
</style>
