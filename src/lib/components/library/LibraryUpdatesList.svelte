<script lang="ts">
  import { go } from '../../router';
  import type { UnreadUpdate } from '../../media/chapterSnapshots';
  import { timeAgo } from '../../util';

  let {
    updates,
    updatesLoading,
    refreshingId,
    onRefresh,
  }: {
    updates: UnreadUpdate[];
    updatesLoading: boolean;
    refreshingId: number | null;
    onRefresh: (mediaId: number) => void;
  } = $props();
</script>

{#if updatesLoading}
  <div class="card empty">Checking for updates…</div>
{:else if updates.length === 0}
  <div class="card empty">No new updates for your followed titles.</div>
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
        <button class="btn small-btn" onclick={() => onRefresh(u.mediaId)} disabled={refreshingId === u.mediaId}>
          {refreshingId === u.mediaId ? '…' : '↻'}
        </button>
      </article>
    {/each}
  </section>
{/if}

<style>
  .rows { display: flex; flex-direction: column; gap: 8px; }
  .title-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 10px 12px; }
  .cover { width: 48px; aspect-ratio: 3 / 4; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border); background: var(--elevated); flex-shrink: 0; }
  .row-main { min-width: 0; flex: 1; }
  .row-main h2 { margin: 0; font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; color: var(--muted); font-size: 13px; }
  .meta span { display: inline-flex; align-items: center; min-height: 20px; }
  .update-badge { color: color-mix(in srgb, var(--accent) 82%, white); background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); border-radius: 999px; padding: 0 7px; font-weight: 700; }
  .staleness { font-size: 12px; color: var(--muted-2); }
  .empty { padding: 28px; color: var(--muted); text-align: center; }
  .small-btn { min-height: 30px; padding: 0 8px; font-size: 12px; min-width: 30px; text-align: center; }
  @media (max-width: 720px) {
    .title-row { grid-template-columns: 42px minmax(0, 1fr) auto; }
    .title-row .btn:not(.small-btn) { min-height: 32px; padding: 0 10px; font-size: 12px; }
    .cover { width: 42px; }
    .row-main h2 { white-space: normal; }
  }
</style>
