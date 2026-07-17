<script lang="ts">
  import type { ChapterGroup } from '../../media/chapterGroups';
  import type { DownloadProgress } from '../../reader/chapterCache';
  import { groupLabel } from '../../ui/formatting';
  import { relativeTime } from '../../util';

  let {
    group,
    readChapters,
    groupLinks,
    preferredGroup,
    cached,
    downloading,
    downloadProgress,
    onReadChapter,
    onReadAlt,
    onMarkUnread,
    onDownloadChapter,
  }: {
    group: ChapterGroup;
    readChapters: Set<string>;
    groupLinks: Map<string, string>;
    preferredGroup: string | undefined;
    cached: boolean;
    downloading: boolean;
    downloadProgress: DownloadProgress | null;
    onReadChapter: (ch: import('../../scraper/engine').ScrapedChapter) => void;
    onReadAlt: (g: ChapterGroup, value: string) => void;
    onMarkUnread: (num: string | null) => void;
    onDownloadChapter: (ch: import('../../scraper/engine').ScrapedChapter) => void;
  } = $props();

  let c = $derived(group.preferred);
</script>

<div class="chapter-row" id={group.number ? `ch-${group.number}` : ''} class:read={group.number ? readChapters.has(group.number) : false}>
  <div class="chap-col-chap">
    <button class="chap-link" onclick={() => onReadChapter(c)}>
      <span class="chap-num">Ch. {group.number ?? '?'}</span>
      {#if group.number && readChapters.has(group.number)}
        <span class="chap-read-badge" title="Read">✓</span>
      {/if}
    </button>
  </div>
  <div class="chap-col-uploaded">
    <span class="chap-time">{relativeTime(c.createdAt)}</span>
  </div>
  <div class="chap-col-group">
    {#if group.alternatives.length > 0}
      <select class="chap-group-select" value={c.group ?? ''} onchange={(e) => onReadAlt(group, e.currentTarget.value)}>
        <option value={c.group ?? ''}>{groupLabel(c.group, group.alternatives.length, preferredGroup)}</option>
        {#each group.alternatives as alt (alt.url)}
          <option value={alt.group ?? alt.url}>{alt.group ?? alt.url}</option>
        {/each}
      </select>
    {:else if c.group}
      {@const link = groupLinks.get(c.group)}
      {#if link}
        <a class="chap-group-link" href={link} target="_blank" rel="noopener">{c.group}</a>
      {:else}
        <span class="chap-group">{c.group}</span>
      {/if}
    {/if}
  </div>
  <div class="chap-col-actions">
    <button class="btn small-btn btn-primary" onclick={() => onReadChapter(c)} title="Read">▶</button>
    <button class="btn small-btn" onclick={() => onDownloadChapter(c)} disabled={downloading} title={cached ? 'Downloaded' : 'Download for offline'}>
      {#if downloading}
        {downloadProgress?.total ? `${downloadProgress.loaded}/${downloadProgress.total}` : '...'}
      {:else if cached}
        ✓
      {:else}
        ⬇
      {/if}
    </button>
    {#if group.number}
      <button class="btn small-btn" onclick={() => onMarkUnread(group.number)} title="Mark unread">↩</button>
    {/if}
  </div>
</div>

<style>
  .chapter-row { display: grid; grid-template-columns: 1fr 100px 1fr auto; gap: 10px; align-items: center; padding: 9px 12px; border-radius: 0; border-bottom: 1px solid var(--border-soft); transition: background .1s; }
  .chapter-row:last-child { border-bottom: 0; }
  .chapter-row:hover { background: var(--elevated); }
  .chapter-row.read { opacity: 0.6; }
  .chapter-row.read .chap-num { color: var(--muted-2); }
  .chap-read-badge { display: inline-flex; align-items: center; justify-content: center; margin-left: 6px; font-size: 11px; color: var(--accent); }
  .chap-link { background: none; border: 0; color: var(--text); cursor: pointer; font-size: 14px; padding: 0; text-align: left; font-family: inherit; }
  .chap-link:hover { color: var(--accent); }
  .chap-num { font-weight: 500; }
  .chap-time { font-size: 13px; color: var(--muted); }
  .chap-group { font-size: 12px; color: var(--muted-2); }
  .chap-group-link { font-size: 12px; color: var(--accent); text-decoration: none; }
  .chap-group-link:hover { text-decoration: underline; }
  .chap-group-select { font-size: 12px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 6px; max-width: 180px; }
  .chap-col-actions { display: flex; gap: 4px; }
  .small-btn { min-height: 30px; padding: 0 8px; font-size: 12px; min-width: 30px; text-align: center; }
  .small-btn[disabled] { opacity: .65; cursor: wait; }
  @media (max-width: 800px) {
    .chapter-row { grid-template-columns: 1fr auto; grid-template-rows: auto auto; }
    .chap-col-chap { grid-column: 1; grid-row: 1; }
    .chap-col-uploaded { grid-column: 1; grid-row: 2; }
    .chap-col-group { display: none; }
    .chap-col-actions { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
  }
</style>
