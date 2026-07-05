<script lang="ts">
  import { go } from '../lib/router';
  import { comickSourceFeed, sourceFeedGenreSlug } from '../lib/sourceFeeds/comick';

  function browseGenre(genre: string) {
    go(`/search?genres=${encodeURIComponent(sourceFeedGenreSlug(genre))}`);
  }
</script>

<div class="genres-page">
  <div class="page-head">
    <h1 class="h1">Browse Comics by Genre</h1>
  </div>

  <div class="genre-grid">
    {#each comickSourceFeed.genres as genre (genre)}
      <button class="genre-pill" onclick={() => browseGenre(genre)}>
        {genre}
      </button>
    {/each}
  </div>
</div>

<style>
  .genres-page { display: flex; flex-direction: column; gap: var(--gap-lg); }
  .page-head { margin-bottom: 4px; }
  .genre-grid { display: flex; gap: 6px; flex-wrap: wrap; }
  .genre-pill {
    display: inline-flex; align-items: center; min-height: 34px; padding: 0 16px;
    border-radius: 999px; border: 1px solid var(--border); background: var(--surface);
    color: var(--text); font-size: 13px; cursor: pointer; transition: all .15s;
  }
  .genre-pill:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
</style>
