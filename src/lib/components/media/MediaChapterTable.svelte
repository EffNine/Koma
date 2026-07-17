<script lang="ts">
  import { go } from '../../router';
  import type { Source } from '../../scraper/sources';
  import type { ScrapedChapter } from '../../scraper/engine';
  import type { ChapterGroup } from '../../media/chapterGroups';
  import type { DownloadProgress } from '../../reader/chapterCache';
  import EmptyState from '../EmptyState.svelte';
  import MediaChapterRow from './MediaChapterRow.svelte';
  import { chapterSummary } from '../../ui/formatting';

  let {
    chapterGroups,
    paginatedGroups,
    chapterLoading,
    sources,
    chapterErr,
    chapters,
    chapterPage,
    chapterPerPage,
    totalPages,
    currentPage,
    gotoChapter,
    readChapters,
    groupLinks,
    preferredGroup,
    cachedChapterUrls,
    downloadingChapterUrl,
    downloadProgress,
    onReadChapter,
    onReadAlt,
    onMarkUnread,
    onDownloadChapter,
    onGotoChapter,
    onPrevPage,
    onNextPage,
    onBindGotoChapter,
  }: {
    chapterGroups: ChapterGroup[];
    paginatedGroups: ChapterGroup[];
    chapterLoading: boolean;
    sources: Source[];
    chapterErr: string;
    chapters: ScrapedChapter[];
    chapterPage: number;
    chapterPerPage: number;
    totalPages: number;
    currentPage: number;
    gotoChapter: string;
    readChapters: Set<string>;
    groupLinks: Map<string, string>;
    preferredGroup: string | undefined;
    cachedChapterUrls: Set<string>;
    downloadingChapterUrl: string;
    downloadProgress: DownloadProgress | null;
    onReadChapter: (ch: ScrapedChapter) => void;
    onReadAlt: (g: ChapterGroup, value: string) => void;
    onMarkUnread: (num: string | null) => void;
    onDownloadChapter: (ch: ScrapedChapter) => void;
    onGotoChapter: () => void;
    onPrevPage: () => void;
    onNextPage: () => void;
    onBindGotoChapter: (val: string) => void;
  } = $props();
</script>

<section class="chapters-section">
  <div class="chap-head">
    <h2 class="h2">Chapters</h2>
    {#if chapters.length}
      <div class="chap-meta">
        <span>{chapterSummary(chapterGroups.length, chapters.length)}</span>
      </div>
    {/if}
  </div>

  {#if chapterLoading}
    <div class="card loading-chapters">Loading chapters…</div>
  {:else if sources.length === 0}
    <EmptyState id="sources" compact />
  {:else if chapterErr}
    <div class="card errbox">{chapterErr} <button class="btn small-btn" onclick={() => go('/settings')}>Manage Reading Sites</button></div>
  {:else if chapters.length === 0}
    <EmptyState id="chapters" compact />
  {:else}
    <div class="chap-table-header">
      <span class="chap-col-chap">Chap</span>
      <span class="chap-col-uploaded">Uploaded</span>
      <span class="chap-col-group">Group</span>
      <span class="chap-col-actions"></span>
    </div>

    <div class="chapters">
      {#each paginatedGroups as g (g.preferred.url)}
        <MediaChapterRow
          group={g}
          {readChapters}
          {groupLinks}
          {preferredGroup}
          cached={cachedChapterUrls.has(g.preferred.url)}
          downloading={downloadingChapterUrl === g.preferred.url}
          downloadProgress={downloadingChapterUrl === g.preferred.url ? downloadProgress : null}
          {onReadChapter}
          {onReadAlt}
          {onMarkUnread}
          {onDownloadChapter}
        />
      {/each}
    </div>

    {#if chapterGroups.length > chapterPerPage}
      <div class="chap-footer">
        <div class="chap-pages">
          Showing chapters 1–{Math.min(chapterPage * chapterPerPage, chapterGroups.length)} of {chapterGroups.length}
          — page {currentPage}/{totalPages}
        </div>
        <div class="chap-nav">
          {#if chapterPage > 1}
            <button class="btn small-btn" onclick={onPrevPage}>← Prev</button>
          {/if}
          {#if chapterPage < totalPages}
            <button class="btn small-btn" onclick={onNextPage}>Next →</button>
          {/if}
        </div>
        <form class="chap-goto" onsubmit={(e) => { e.preventDefault(); onGotoChapter(); }}>
          <span class="goto-label">Go to chap</span>
          <input value={gotoChapter} oninput={(e) => onBindGotoChapter(e.currentTarget.value)} class="goto-input" placeholder="#" />
          <button class="btn small-btn" type="submit">Go</button>
        </form>
      </div>
    {/if}
  {/if}
</section>

<style>
  .chapters-section { margin-top: 24px; }
  .chap-head { display: flex; justify-content: space-between; gap: 10px; align-items: end; margin-bottom: 10px; flex-wrap: wrap; }
  .chap-head h2 { margin: 0; }
  .chap-meta { color: var(--muted); font-size: 13px; }
  .chap-table-header { display: grid; grid-template-columns: 1fr 100px 1fr auto; gap: 10px; padding: 8px 12px; font-size: 12px; font-weight: 700; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
  .chapters { display: flex; flex-direction: column; max-height: 540px; overflow: auto; padding-right: 2px; border: 1px solid var(--border-soft); border-radius: var(--radius); background: color-mix(in srgb, var(--surface) 76%, transparent); }
  .loading-chapters { padding: 24px; text-align: center; color: var(--muted); }
  .errbox { color: var(--danger); padding: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .small-btn { min-height: 30px; padding: 0 8px; font-size: 12px; min-width: 30px; text-align: center; }
  .chap-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--border); }
  .chap-pages { font-size: 13px; color: var(--muted); }
  .chap-nav { display: flex; gap: 6px; }
  .chap-goto { display: flex; align-items: center; gap: 6px; }
  .goto-label { font-size: 12px; color: var(--muted); }
  .goto-input { width: 60px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; text-align: center; }
  @media (max-width: 800px) {
    .chap-table-header { display: none; }
    .chap-footer { flex-direction: column; align-items: stretch; }
    .chap-goto { justify-content: center; }
  }
</style>
