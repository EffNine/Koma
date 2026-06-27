<script lang="ts">
  import { route } from './lib/router';
  import Home from './routes/Home.svelte';
  import Search from './routes/Search.svelte';
  import Library from './routes/Library.svelte';
  import Settings from './routes/Settings.svelte';

  const links = [
    { href: '/', label: 'Home' },
    { href: '/search', label: 'Search' },
    { href: '/library', label: 'Library' },
    { href: '/settings', label: 'Settings' },
  ];

  function active(href: string) {
    if (href === '/') return $route.path === '/';
    return $route.path.startsWith(href);
  }

  // ponytail: route dispatch is an if-chain. Grows as routes are added (media/[id], reader/[id]).
  let p = $derived($route.path);
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href="#/"><span class="dot"></span>Koma</a>
    <nav class="nav">
      {#each links as l (l.href)}
        <a class:active={active(l.href)} href={'#' + l.href}>{l.label}</a>
      {/each}
    </nav>
  </header>
  <main class="view">
    {#if p === '/'}
      <Home />
    {:else if p.startsWith('/search')}
      <Search />
    {:else if p.startsWith('/library')}
      <Library />
    {:else if p.startsWith('/settings')}
      <Settings />
    {:else}
      <Home />
    {/if}
  </main>
</div>