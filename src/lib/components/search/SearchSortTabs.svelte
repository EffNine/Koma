<script lang="ts">
  let {
    sort = $bindable('TRENDING_DESC'),
    onChange,
  }: {
    sort: string;
    onChange: () => void | Promise<void>;
  } = $props();

  function selectSort(nextSort: string) {
    sort = nextSort;
    void onChange();
  }
</script>

<div class="sort-tabs">
  <button class="sort-tab" class:active={sort === 'TRENDING_DESC'} onclick={() => selectSort('TRENDING_DESC')}>Trending</button>
  <button class="sort-tab" class:active={sort === 'POPULARITY_DESC'} onclick={() => selectSort('POPULARITY_DESC')}>Popular</button>
  <button class="sort-tab" class:active={sort === 'START_DATE_DESC'} onclick={() => selectSort('START_DATE_DESC')}>Latest</button>
</div>

<style>
  .sort-tabs { display: flex; gap: 0; }
  .sort-tab {
    min-height: 34px; padding: 0 18px; border: 1px solid var(--border); background: var(--surface);
    color: var(--muted); font-size: 14px; cursor: pointer; transition: all .15s;
  }
  .sort-tab:first-child { border-radius: 6px 0 0 6px; }
  .sort-tab:last-child { border-radius: 0 6px 6px 0; margin-left: -1px; }
  .sort-tab:hover { color: var(--text); }
  .sort-tab.active { background: var(--accent); border-color: var(--accent); color: #17110a; font-weight: 700; }
</style>
