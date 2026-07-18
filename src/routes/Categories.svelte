<script lang="ts">
  import { go } from '../lib/router';

  const categories = [
    {
      label: 'Ongoing Popular',
      href: '/search?status=ongoing&sort=POPULARITY_DESC',
      blurb: 'Titles still releasing, ranked by popularity',
    },
    {
      label: 'Most Popular Webtoon Right Now',
      href: '/search?country=kr&sort=POPULARITY_DESC',
      blurb: 'Korean comics readers are following most',
    },
    {
      label: 'Most Popular Manga Right Now',
      href: '/search?country=jp&sort=POPULARITY_DESC',
      blurb: 'Japanese manga ranked by popularity',
    },
    {
      label: 'Browse Comics by Genre',
      href: '/genres',
      blurb: 'Jump into Action, Romance, Fantasy, and more',
    },
  ];
</script>

<div class="categories-page">
  <div class="page-head">
    <h1 class="h1">Categories</h1>
    <p class="page-sub">Quick paths into the catalog — pick a lane and start browsing.</p>
  </div>

  <ul class="cat-list" role="list">
    {#each categories as cat (cat.href)}
      <li class="cat-item">
        <a
          href={'/#' + cat.href}
          class="cat-link"
          onclick={(e) => { e.preventDefault(); go(cat.href); }}
        >
          <span class="cat-label">{cat.label}</span>
          <span class="cat-blurb">{cat.blurb}</span>
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .categories-page { display: flex; flex-direction: column; gap: var(--gap-lg); }
  .page-head { margin-bottom: 4px; }
  .page-sub { margin: 6px 0 0; color: var(--muted); font-size: 14px; max-width: 520px; }
  .cat-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .cat-item { border-bottom: 1px solid var(--border-soft); }
  .cat-item:last-child { border-bottom: none; }
  .cat-link {
    display: flex; flex-direction: column; gap: 4px; padding: 16px 0; color: var(--text);
    text-decoration: none; transition: color .15s; cursor: pointer;
  }
  .cat-link:hover { color: var(--accent); }
  .cat-label { font-size: 16px; font-weight: 650; }
  .cat-blurb { font-size: 13px; color: var(--muted); font-weight: 400; }
  .cat-link:hover .cat-blurb { color: color-mix(in srgb, var(--accent) 70%, var(--muted)); }
</style>
