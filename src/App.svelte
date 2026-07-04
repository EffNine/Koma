<script lang="ts">
  import { route, go } from './lib/router';
  import Home from './routes/Home.svelte';
  import Search from './routes/Search.svelte';
  import Library from './routes/Library.svelte';
  import Settings from './routes/Settings.svelte';
  import Media from './routes/Media.svelte';
  import Reader from './routes/Reader.svelte';
  import Categories from './routes/Categories.svelte';
  import Activity from './routes/Activity.svelte';

  const links = [
    { href: '/', label: 'Home' },
    { href: '/library', label: 'Library' },
    { href: '/search', label: 'Search' },
    { href: '/categories', label: 'Categories' },
    { href: '/activity', label: 'Activity' },
    { href: '/settings', label: 'Settings' },
  ];

  function active(href: string) {
    if (href === '/') return $route.path === '/';
    return $route.path.startsWith(href);
  }

  // ponytail: route dispatch is an if-chain. Grows as routes are added (media/[id], reader/[id]).
  let p = $derived($route.path);
  let readerMode = $derived(p.startsWith('/reader/'));

  let searchQ = $state('');
  function onSearchSubmit(e: Event) {
    e.preventDefault();
    if (searchQ.trim()) {
      go(`/search?q=${encodeURIComponent(searchQ.trim())}`);
      searchQ = '';
    }
  }
</script>

<div class="shell">
  <header class="topbar" class:reader-mode={readerMode}>
    <a class="brand" href="#/"><span class="logo-k">K</span>oma</a>
    {#if !readerMode}
      <nav class="nav">
        {#each links as l (l.href)}
          <a class:active={active(l.href)} href={'#' + l.href}>{l.label}</a>
        {/each}
      </nav>
      <form class="top-search" onsubmit={onSearchSubmit}>
        <input
          bind:value={searchQ}
          placeholder="Find a title"
          class="top-search-input"
        />
      </form>
    {/if}
  </header>
  <main class="view" class:reader-view={readerMode}>
    {#if p === '/'}
      <Home />
    {:else if p.startsWith('/search')}
      <Search />
    {:else if p.startsWith('/categories')}
      <Categories />
    {:else if p.startsWith('/activity')}
      <Activity />
    {:else if p.startsWith('/media/')}
      <Media />
    {:else if p.startsWith('/reader/')}
      <Reader />
    {:else if p.startsWith('/library')}
      <Library />
    {:else if p.startsWith('/settings')}
      <Settings />
    {:else}
      <Home />
    {/if}
  </main>
</div>
