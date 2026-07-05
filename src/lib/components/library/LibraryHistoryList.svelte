<script lang="ts">
  import { go } from '../../router';
  import type { HistoryEntry } from '../../tracker/local';
  import { historyLabel } from '../../ui/formatting';
  import { formatDateTime } from '../../util';

  let {
    history,
    titleFor,
  }: {
    history: HistoryEntry[];
    titleFor: (mediaId: number) => string;
  } = $props();
</script>

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

<style>
  .rows { display: flex; flex-direction: column; gap: 8px; }
  .history-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 10px 12px; }
  .row-main { min-width: 0; flex: 1; }
  .row-main h2 { margin: 0; font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; color: var(--muted); font-size: 13px; }
  .meta span { display: inline-flex; align-items: center; min-height: 20px; }
  @media (max-width: 720px) {
    .history-row { grid-template-columns: minmax(0, 1fr) auto; }
    .history-row .btn:first-of-type { display: none; }
    .row-main h2 { white-space: normal; }
  }
</style>
