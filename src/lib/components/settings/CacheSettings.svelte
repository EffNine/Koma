<script lang="ts">
  let {
    cacheSize,
    chapterCacheSize,
    cacheMsg,
    chapterCacheMsg,
    onClearCatalog,
    onClearChapter,
  }: {
    cacheSize: number | null;
    chapterCacheSize: number | null;
    cacheMsg: string;
    chapterCacheMsg: string;
    onClearCatalog: () => void;
    onClearChapter: () => void;
  } = $props();
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
        <span>• {chapterCacheSize > 0 ? `${(chapterCacheSize / 1024 / 1024).toFixed(1)} MB` : '0 B'} chapter cache</span>
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
</div>
