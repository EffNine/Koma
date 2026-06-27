<script lang="ts">
  import { route, go } from '../lib/router';
  import { media } from '../lib/catalog/anilist';
  import { titleName } from '../lib/catalog/types';
  import type { Title } from '../lib/catalog/types';
  import { stripHtml } from '../lib/util';

  let id = $derived(Number($route.path.split('/').filter(Boolean)[1]));
  let t = $state<Title | undefined>();
  let loading = $state(true);
  let err = $state('');

  $effect(() => {
    const cur = id;
    if (!cur) return;
    loading = true; err = '';
    media(cur).then((x) => { t = x; loading = false; })
      .catch((e) => { err = String(e); loading = false; });
  });

  const countryLabel: Record<string, string> = { JP: 'Manga', KR: 'Manhwa', CN: 'Manhua' };
  let name = $derived(t ? titleName(t) : '');
  let desc = $derived(t?.description ? stripHtml(t.description) : '');
</script>

<button class="btn back" onclick={() => go('/')}>← Back</button>

{#if err}
  <div class="card err">{err}</div>
{:else if loading || !t}
  <div class="card skel" style="height:260px" />
{:else}
  <div class="detail">
    <img class="cover" src={t.cover} alt={name} />
    <div class="info">
      <h1 class="h1">{name}</h1>
      <div class="meta">
        {#if t.country}<span class="chip">{countryLabel[t.country] ?? t.country}</span>{/if}
        {#if t.status}<span>{t.status}</span>{/if}
        {#if t.year}<span>{t.year}</span>{/if}
        {#if t.chapters}<span>{t.chapters} ch.</span>{/if}
        {#if t.averageScore}<span>★ {(t.averageScore / 10).toFixed(1)}</span>{/if}
      </div>
      {#if t.genres?.length}
        <div class="genres">{#each t.genres as g (g)}<span class="gchip">{g}</span>{/each}</div>
      {/if}
      <p class="desc">{desc}</p>
      <div class="actions">
        <button class="btn" disabled title="Sources arrive in Stage 2">Read</button>
        <button class="btn" disabled title="Follow arrives in Stage 4">Follow</button>
        {#if t.siteUrl}<a class="btn" href={t.siteUrl} target="_blank" rel="noopener">AniList ↗</a>{/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .back { margin-bottom: 16px; }
  .detail { display: flex; gap: 22px; align-items: flex-start; }
  .cover { width: 190px; aspect-ratio: 3/4; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
  .info { flex: 1; min-width: 0; }
  .meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 14px; margin: 6px 0 14px; align-items: center; }
  .chip { background: var(--accent); color: #fff; padding: 2px 9px; border-radius: 20px; font-size: 12px; }
  .genres { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .gchip { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 3px 10px; font-size: 12px; color: var(--muted); }
  .desc { white-space: pre-wrap; color: var(--text); font-size: 14.5px; line-height: 1.65; max-width: 720px; }
  .actions { display: flex; gap: 8px; margin-top: 18px; }
  .btn[disabled] { opacity: .5; cursor: not-allowed; }
  .err { color: var(--danger); }
  .skel { }
  @media (max-width: 600px) { .detail { flex-direction: column; } .cover { width: 150px; } }
</style>