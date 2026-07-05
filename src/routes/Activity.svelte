<script lang="ts">
  import { onMount } from 'svelte';
  import { go } from '../lib/router';
  import { listHistory, type HistoryEntry } from '../lib/tracker/local';
  import { db } from '../lib/db';
  import { media } from '../lib/catalog/anilist';
  import { titleName } from '../lib/catalog/types';
  import EmptyState from '../lib/components/EmptyState.svelte';
  import { historyLabel } from '../lib/ui/formatting';
  import { timeAgo } from '../lib/util';

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
            } catch { /* non-critical: fallback to generic title name */ }
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
  <EmptyState id="history" />
{:else}
  <div class="timeline">
    {#each groups as [date, rows] (date)}
      <div class="day-group">
        <div class="day-label">{date}</div>
        <div class="day-entries">
          {#each rows as row (row.id)}
            <div class="card entry-row">
              <div class="entry-icon">{row.page !== undefined ? 'P' : 'C'}</div>
              <div class="entry-main">
                <div class="entry-title">{nameFor(row.mediaId)}</div>
                <div class="entry-meta">
                  <span>{historyLabel(row)}</span>
                  {#if row.page !== undefined}<span>· Page {row.page + 1}</span>{/if}
                  <span>· {timeAgo(row.readAt)}</span>
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
  .timeline { display: flex; flex-direction: column; gap: 24px; }
  .day-label { font-size: 13px; font-weight: 740; color: var(--muted); margin-bottom: 8px; padding-left: 4px; text-transform: uppercase; letter-spacing: .06em; }
  .day-entries { display: flex; flex-direction: column; gap: 6px; }
  .entry-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px 12px; }
  .entry-icon { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); background: var(--elevated); color: var(--accent); font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .entry-main { min-width: 0; flex: 1; }
  .entry-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .entry-meta { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .small-btn { min-height: 30px; padding: 0 10px; font-size: 13px; }
  .empty, .errbox { padding: 28px; color: var(--muted); text-align: center; }
  .errbox { color: var(--danger); }
  @media (max-width: 640px) {
    .entry-row { grid-template-columns: 24px minmax(0, 1fr) auto; padding: 9px 10px; }
    .entry-icon { width: 24px; height: 24px; font-size: 11px; }
    .entry-title { white-space: normal; }
  }
</style>
