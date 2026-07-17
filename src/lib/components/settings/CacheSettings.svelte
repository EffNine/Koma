<script lang="ts">
  import type { CacheByTitle } from '../../reader/chapterCache';

  let {
    cacheSize,
    chapterCacheSize,
    chapterCacheBreakdown,
    cacheMsg,
    chapterCacheMsg,
    onClearCatalog,
    onClearChapter,
    onClearTitleChapter,
  }: {
    cacheSize: number | null;
    chapterCacheSize: number | null;
    chapterCacheBreakdown: CacheByTitle[];
    cacheMsg: string;
    chapterCacheMsg: string;
    onClearCatalog: () => void;
    onClearChapter: () => void;
    onClearTitleChapter: (row: CacheByTitle) => void;
  } = $props();

  function sizeLabel(bytes: number): string {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div class="card sec">
  <h2>Cache</h2>
  <p class="hint">Review local catalog and chapter storage.</p>
  <div class="cache-controls">
    <div class="cache-info">
      {#if cacheSize !== null}
        <span>{cacheSize} catalog entr{cacheSize === 1 ? 'y' : 'ies'}</span>
      {:else}
        <span>Loading catalog cache info…</span>
      {/if}
      {#if chapterCacheSize !== null}
        <span>• {sizeLabel(chapterCacheSize)} chapter cache</span>
      {/if}
    </div>
    <button class="btn" onclick={onClearCatalog}>Clear Catalog Cache</button>
    <button class="btn" onclick={onClearChapter}>Clear Chapter Cache</button>
  </div>
  {#if cacheMsg}
    <div class="msg ok">{cacheMsg}</div>
  {/if}
  {#if chapterCacheMsg}
    <div class="msg ok">{chapterCacheMsg}</div>
  {/if}
  {#if chapterCacheBreakdown.length > 0}
    <div class="cache-breakdown">
      <h3>Downloaded by title</h3>
      {#each chapterCacheBreakdown as row (row.mediaId)}
        <div class="cache-row">
          <div>
            <strong>{row.titleName}</strong>
            <span>{row.chapterCount} chapter{row.chapterCount === 1 ? '' : 's'} • {sizeLabel(row.sizeBytes)}</span>
          </div>
          <button class="btn small-btn" onclick={() => onClearTitleChapter(row)}>Clear title cache</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cache-breakdown { margin-top: 14px; border-top: 1px solid var(--border-soft); padding-top: 12px; }
  .cache-breakdown h3 { margin: 0 0 8px; font-size: 13px; color: var(--muted); }
  .cache-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--border-soft); }
  .cache-row:first-of-type { border-top: 0; }
  .cache-row div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .cache-row strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cache-row span { color: var(--muted); font-size: 12px; }
  .small-btn { min-height: 30px; padding: 0 8px; font-size: 12px; }
</style>
