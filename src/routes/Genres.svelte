<script lang="ts">
  import { go } from '../lib/router';
  import { GENRE_COLLECTION } from '../lib/catalog/anilist';

  function browseGenre(genre: string) {
    go(`/search?genres=${encodeURIComponent(genre)}`);
  }
</script>

<div class="genres-page">
  <div class="page-head">
    <h1 class="h1">Browse Comics by Genre</h1>
    <p class="page-sub">Open a genre to see trending titles from the catalog.</p>
  </div>

  <div class="genre-grid">
    {#each GENRE_COLLECTION as genre (genre)}
      <button class="genre-pill" onclick={() => browseGenre(genre)}>
        {genre}
      </button>
    {/each}
  </div>
</div>

<style>
  .genres-page { display: flex; flex-direction: column; gap: var(--gap-lg); }
  .page-head { margin-bottom: 4px; }
  .page-sub { margin: 6px 0 0; color: var(--muted); font-size: 14px; max-width: 520px; }
  .genre-grid { display: flex; gap: 8px; flex-wrap: wrap; }
  .genre-pill {
    display: inline-flex; align-items: center; min-height: 36px; padding: 0 16px;
    border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface);
    color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s;
  }
  .genre-pill:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); color: var(--accent); }
</style>
