<script lang="ts">
  import { route, go } from '../lib/router';
  import { media } from '../lib/catalog/anilist';
  import { titleAliases, titleName } from '../lib/catalog/types';
  import type { Title } from '../lib/catalog/types';
  import { stripHtml } from '../lib/util';
  import { enabledSources, type Source } from '../lib/scraper/sources';
  import { findSeries, getChapters, getPages } from '../lib/scraper/scraper';
  import type { ScrapedChapter } from '../lib/scraper/engine';
  import {
    followTitle,
    isFollowed,
    markChapterUnread,
    recordChapterRead,
    unfollowTitle,
  } from '../lib/tracker/local';

  let id = $derived(Number($route.path.split('/').filter(Boolean)[1]));
  let t = $state<Title | undefined>();
  let loading = $state(true);
  let err = $state('');
  let sources = $state<Source[]>([]);
  let sourceId = $state('');
  let sourceBusy = $state(false);
  let sourceErr = $state('');
  let sourceMsg = $state('');
  let matchUrl = $state('');
  let matchTitle = $state('');
  let matchQuery = $state('');
  let chapters = $state<ScrapedChapter[]>([]);
  let pageBusyUrl = $state('');
  let pageErr = $state('');
  let pageUrls = $state<string[]>([]);
  let pageTitle = $state('');
  let followed = $state(false);
  let followBusy = $state(false);
  let trackerMsg = $state('');

  function resetResolvedState() {
    sourceErr = '';
    sourceMsg = '';
    matchUrl = '';
    matchTitle = '';
    matchQuery = '';
    chapters = [];
    pageBusyUrl = '';
    pageErr = '';
    pageUrls = [];
    pageTitle = '';
    trackerMsg = '';
  }

  $effect(() => {
    const cur = id;
    if (!cur) return;
    loading = true;
    err = '';
    resetResolvedState();
    media(cur).then(async (x) => {
      t = x;
      followed = x ? await isFollowed(x.id) : false;
      loading = false;
    })
      .catch((e) => { err = String(e); loading = false; });
  });

  $effect(() => {
    enabledSources().then((rows) => {
      sources = rows;
      if (!rows.some((s) => s.id === sourceId)) sourceId = rows[0]?.id ?? '';
    });
  });

  $effect(() => {
    sourceId;
    resetResolvedState();
  });

  const countryLabel: Record<string, string> = { JP: 'Manga', KR: 'Manhwa', CN: 'Manhua' };
  let name = $derived(t ? titleName(t) : '');
  let desc = $derived(t?.description ? stripHtml(t.description) : '');
  let selectedSource = $derived(sources.find((s) => s.id === sourceId));
  let visibleChapters = $derived(chapters.slice(-80).reverse());

  async function resolveChapters() {
    if (!t || !selectedSource) return;
    sourceBusy = true;
    resetResolvedState();

    try {
      for (const alias of titleAliases(t)) {
        const series = await findSeries(selectedSource, alias);
        if (!series) continue;
        matchUrl = series.url;
        matchTitle = series.title || alias;
        matchQuery = alias;
        chapters = await getChapters(selectedSource, series.url);
        sourceMsg = chapters.length
          ? `Matched "${matchTitle}" on ${selectedSource.name}.`
          : `Matched "${matchTitle}" on ${selectedSource.name}, but no chapters were extracted.`;
        return;
      }
      sourceErr = `No series match found on ${selectedSource.name}.`;
    } catch (e) {
      sourceErr = String(e);
    } finally {
      sourceBusy = false;
    }
  }

  async function inspectPages(chapter: ScrapedChapter) {
    if (!selectedSource) return;
    pageBusyUrl = chapter.url;
    pageErr = '';
    pageUrls = [];
    pageTitle = chapter.title || `Chapter ${chapter.number ?? '?'}`;
    try {
      pageUrls = await getPages(selectedSource, chapter.url);
      if (pageUrls.length === 0) pageErr = 'No page images were extracted from this chapter.';
    } catch (e) {
      pageErr = String(e);
    } finally {
      pageBusyUrl = '';
    }
  }

  async function toggleFollow() {
    if (!t || followBusy) return;
    followBusy = true;
    try {
      if (followed) {
        await unfollowTitle(t.id);
        followed = false;
      } else {
        await followTitle(t);
        followed = true;
      }
    } finally {
      followBusy = false;
    }
  }

  async function readChapter(chapter: ScrapedChapter) {
    if (!selectedSource || !t) return;
    await recordChapterRead({
      title: t,
      sourceId: selectedSource.id,
      chapterUrl: chapter.url,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
    });
    go(`/reader/${t.id}/${selectedSource.id}/${encodeURIComponent(chapter.url)}`);
  }

  async function markUnread(chapter: ScrapedChapter) {
    if (!selectedSource || !t || !chapter.number) return;
    const progress = await markChapterUnread(t.id, selectedSource.id, chapter.number);
    trackerMsg = progress?.chapterNumber
      ? `Progress rolled back to chapter ${progress.chapterNumber}.`
      : 'Progress cleared for this source.';
  }
</script>

<button class="btn back" onclick={() => go('/')}>← Back</button>

{#if err}
  <div class="card err">{err}</div>
{:else if loading || !t}
  <div class="card skel" style="height:260px"></div>
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
        <button class="btn" onclick={() => document.getElementById('source-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Find Chapters</button>
        <button class="btn" onclick={toggleFollow} disabled={followBusy}>
          {followBusy ? 'Saving…' : followed ? 'Following' : 'Follow'}
        </button>
        {#if t.siteUrl}<a class="btn" href={t.siteUrl} target="_blank" rel="noopener">AniList ↗</a>{/if}
      </div>
    </div>
  </div>

  <section class="card source-panel" id="source-panel">
    <div class="source-head">
      <div>
        <h2>Sources</h2>
        <p class="source-sub">Resolve this title against an enabled Source, then inspect the scraped chapter list and page images.</p>
      </div>
      <button class="btn" onclick={() => go('/settings')}>Manage Sources</button>
    </div>

    {#if sources.length === 0}
      <div class="empty-source">
        No enabled sources yet. Add one in Settings first, then come back here to resolve chapters.
      </div>
    {:else}
      <div class="source-controls">
        <label class="sel-wrap">
          <span>Source</span>
          <select bind:value={sourceId} class="sel">
            {#each sources as s (s.id)}
              <option value={s.id}>{s.name}{s.preset ? ` (${s.preset})` : ''}</option>
            {/each}
          </select>
        </label>
        <button class="btn btn-primary" onclick={resolveChapters} disabled={sourceBusy}>
          {sourceBusy ? 'Resolving…' : 'Find Chapters'}
        </button>
      </div>

      <div class="source-notes">
        <span class="note">Trying aliases: {titleAliases(t).join(' / ')}</span>
        {#if matchUrl}
          <a class="note link" href={matchUrl} target="_blank" rel="noopener">Matched series ↗</a>
        {/if}
      </div>

      {#if sourceMsg}
        <div class="msg ok">{sourceMsg}</div>
      {/if}
      {#if sourceErr}
        <div class="msg errbox">{sourceErr}</div>
      {/if}
      {#if trackerMsg}
        <div class="msg ok">{trackerMsg}</div>
      {/if}

      {#if chapters.length}
        <div class="chap-head">
          <h3>Chapters</h3>
          <div class="chap-meta">
            {#if chapters.length > visibleChapters.length}
              Showing newest {visibleChapters.length} of {chapters.length}
            {:else}
              {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
            {/if}
            {#if matchQuery}
              <span>matched via "{matchQuery}"</span>
            {/if}
          </div>
        </div>

        <div class="chapters">
          {#each visibleChapters as c (c.url)}
            <div class="chapter-row">
              <div class="chapter-main">
                <div class="chapter-title">{c.title || `Chapter ${c.number ?? '?'}`}</div>
              <div class="chapter-meta">
                {#if c.number}<span>Chapter {c.number}</span>{/if}
                <a href={c.url} target="_blank" rel="noopener">Open source ↗</a>
              </div>
            </div>
            <div class="chapter-actions">
              <button class="btn small-btn btn-primary" onclick={() => readChapter(c)}>Read</button>
              <button class="btn small-btn" onclick={() => inspectPages(c)} disabled={pageBusyUrl === c.url}>
                {pageBusyUrl === c.url ? 'Loading…' : 'Inspect Pages'}
              </button>
              {#if c.number}
                <button class="btn small-btn" onclick={() => markUnread(c)}>Mark Unread</button>
              {/if}
            </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if pageErr || pageUrls.length}
        <div class="pages-panel">
          <div class="pages-head">
            <h3>{pageTitle || 'Pages'}</h3>
            {#if pageUrls.length}<span>{pageUrls.length} image URL{pageUrls.length === 1 ? '' : 's'} extracted</span>{/if}
          </div>
          {#if pageErr}
            <div class="msg errbox">{pageErr}</div>
          {/if}
          {#if pageUrls.length}
            <div class="page-list">
              {#each pageUrls.slice(0, 6) as url, i (url)}
                <a class="page-link" href={url} target="_blank" rel="noopener">Page {i + 1}: {url}</a>
              {/each}
            </div>
            {#if pageUrls.length > 6}
              <div class="page-more">Showing first 6 page URLs.</div>
            {/if}
          {/if}
        </div>
      {/if}
    {/if}
  </section>
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
  .source-panel { margin-top: 18px; }
  .source-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; }
  .source-head h2, .chap-head h3, .pages-head h3 { margin: 0; font-size: 16px; font-weight: 600; }
  .source-sub, .chap-meta, .page-more { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .source-controls { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; margin-bottom: 10px; }
  .sel-wrap { display: flex; flex-direction: column; gap: 6px; color: var(--muted); font-size: 13px; min-width: min(320px, 100%); }
  .sel { min-width: min(320px, 100%); padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px; }
  .source-notes { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
  .note { color: var(--muted); font-size: 12px; }
  .note.link { color: var(--text); }
  .msg { font-size: 13px; border-radius: var(--radius-sm); padding: 10px 12px; margin-top: 10px; }
  .ok { background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); }
  .errbox { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent); }
  .empty-source { color: var(--muted); padding: 14px 0 4px; }
  .chap-head { display: flex; justify-content: space-between; gap: 10px; align-items: end; margin-top: 16px; margin-bottom: 10px; flex-wrap: wrap; }
  .chap-meta { display: flex; gap: 10px; flex-wrap: wrap; }
  .chapters { display: flex; flex-direction: column; gap: 8px; max-height: 540px; overflow: auto; padding-right: 2px; }
  .chapter-row { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--elevated); }
  .chapter-main { flex: 1; min-width: 0; }
  .chapter-title { font-size: 14px; font-weight: 550; }
  .chapter-meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; margin-top: 4px; }
  .chapter-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .small-btn { padding: 6px 10px; font-size: 13px; }
  .pages-panel { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
  .pages-head { display: flex; gap: 12px; justify-content: space-between; align-items: end; flex-wrap: wrap; margin-bottom: 10px; }
  .pages-head span { color: var(--muted); font-size: 13px; }
  .page-list { display: flex; flex-direction: column; gap: 8px; }
  .page-link { color: var(--text); font-size: 13px; overflow-wrap: anywhere; }
  .page-link:hover { color: #fff; }
  @media (max-width: 800px) {
    .detail { flex-direction: column; }
    .cover { width: 150px; }
    .chapter-row { align-items: flex-start; flex-direction: column; }
    .chapter-actions { width: 100%; }
  }
</style>
