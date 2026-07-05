<script lang="ts">
  import { go } from '../lib/router';
</script>

<div class="categories-page">
  <div class="page-head">
    <h1 class="h1">Categories</h1>
  </div>

  <ul class="cat-list" role="list">
    <li class="cat-item">
      <a href="/#/search?status=ongoing&sort=user_follow_count" class="cat-link" onclick={(e) => { e.preventDefault(); go('/search?status=ongoing&sort=user_follow_count'); }}>
        <span class="cat-label">Ongoing Popular</span>
      </a>
    </li>
    <li class="cat-item">
      <a href="/#/search?time=180&genres=long-strip" class="cat-link" onclick={(e) => { e.preventDefault(); go('/search?time=180&genres=long-strip'); }}>
        <span class="cat-label">Most Popular Webtoon Right Now</span>
      </a>
    </li>
    <li class="cat-item">
      <a href="/#/search?time=180&country=jp" class="cat-link" onclick={(e) => { e.preventDefault(); go('/search?time=180&country=jp'); }}>
        <span class="cat-label">Most Popular Manga Right Now</span>
      </a>
    </li>
    <li class="cat-item">
      <a href="/#/genres" class="cat-link" onclick={(e) => { e.preventDefault(); go('/genres'); }}>
        <span class="cat-label">Browse Comics by Genre</span>
      </a>
    </li>
  </ul>
</div>

<style>
  .categories-page { display: flex; flex-direction: column; gap: var(--gap-lg); }
  .page-head { margin-bottom: 4px; }
  .cat-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .cat-item { border-bottom: 1px solid var(--border-soft); }
  .cat-item:last-child { border-bottom: none; }
  .cat-link {
    display: block; padding: 14px 0; color: var(--text); text-decoration: none;
    font-size: 15px; font-weight: 600; transition: color .15s; cursor: pointer;
  }
  .cat-link:hover { color: var(--accent); }
</style>
