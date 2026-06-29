<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { media } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';
  import { titleName } from '../lib/catalog/types';
  import { fetchBytes } from '../lib/net';
  import {
    deriveDirection,
    loadReaderState,
    saveReaderState,
    type ReaderDirection,
  } from '../lib/reader/state';
  import { match, go, route } from '../lib/router';
  import { getPages } from '../lib/scraper/scraper';
  import { getSource, type Source } from '../lib/scraper/sources';
  import { recordReaderPage } from '../lib/tracker/local';

  const directionLabel: Record<ReaderDirection, string> = {
    rtl: 'RTL',
    ltr: 'LTR',
    vertical: 'Vertical',
  };

  type JumpBehavior = 'smooth' | 'auto';

  let params = $derived(match('/reader/:mediaId/:sourceId/:chapterUrl', $route.path));
  let mediaId = $derived(params ? Number(params.mediaId) : 0);
  let sourceId = $derived(params?.sourceId ?? '');
  let chapterUrl = $derived(params?.chapterUrl ?? '');
  let t = $state<Title | undefined>();
  let source = $state<Source | undefined>();
  let pageUrls = $state<string[]>([]);
  let pageBlobs = $state<string[]>([]);
  let failedPages = $state<number[]>([]);
  let loading = $state(true);
  let err = $state('');
  let note = $state('');
  let page = $state(0);
  let direction = $state<ReaderDirection>('rtl');
  let loadCount = $state(0);
  let loadSeq = 0;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  let observer: IntersectionObserver | null = null;
  const pageNodes = new Map<number, HTMLElement>();

  let name = $derived(t ? titleName(t) : 'Reader');
  let currentBlob = $derived(pageBlobs[page] ?? '');
  let currentSourceUrl = $derived(pageUrls[page] ?? '');
  let totalPages = $derived(pageUrls.length);
  let pageLabel = $derived(totalPages ? `${page + 1} / ${totalPages}` : '0 / 0');
  let pagedMode = $derived(direction !== 'vertical');
  let canPrev = $derived(page > 0);
  let canNext = $derived(page + 1 < totalPages);

  $effect(() => {
    const p = params;
    if (!p) {
      err = 'Invalid reader route.';
      loading = false;
      return;
    }
    untrack(() => {
      void loadChapter(Number(p.mediaId), p.sourceId, p.chapterUrl);
    });
  });

  $effect(() => {
    const p = params;
    const count = totalPages;
    const currentPage = page;
    const currentDirection = direction;
    const currentTitle = t;
    if (!p || count === 0) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void saveReaderState({
        mediaId: Number(p.mediaId),
        sourceId: p.sourceId,
        chapterUrl: p.chapterUrl,
        page: clamp(currentPage, 0, count - 1),
        direction: currentDirection,
      });
      if (currentTitle) {
        void recordReaderPage({
          title: currentTitle,
          sourceId: p.sourceId,
          chapterUrl: p.chapterUrl,
          page: clamp(currentPage, 0, count - 1),
        });
      }
    }, 120);
    return () => clearTimeout(persistTimer);
  });

  $effect(() => {
    const mode = direction;
    const count = totalPages;
    if (mode !== 'vertical' || count === 0) return;
    observer?.disconnect();
    observer = new IntersectionObserver(onIntersect, {
      rootMargin: '-20% 0px -45% 0px',
      threshold: [0.25, 0.5, 0.75],
    });
    for (const node of pageNodes.values()) observer.observe(node);
    void tick().then(() => scrollToPage(page, 'auto'));
    return () => {
      observer?.disconnect();
      observer = null;
    };
  });

  onDestroy(() => {
    clearTimeout(persistTimer);
    observer?.disconnect();
    revokeBlobs(untrack(() => pageBlobs));
  });

  async function loadChapter(nextMediaId: number, nextSourceId: string, nextChapterUrl: string) {
    const seq = ++loadSeq;
    loading = true;
    err = '';
    note = '';
    loadCount = 0;
    t = undefined;
    source = undefined;
    failedPages = [];
    revokeBlobs(pageBlobs);
    pageUrls = [];
    pageBlobs = [];
    page = 0;

    try {
      const [nextTitle, nextSource] = await Promise.all([
        media(nextMediaId),
        getSource(nextSourceId),
      ]);
      if (seq !== loadSeq) return;
      if (!nextTitle) throw new Error(`Catalog title ${nextMediaId} was not found.`);
      if (!nextSource) throw new Error('Saved source not found. Re-add or re-enable it in Settings.');

      t = nextTitle;
      source = nextSource;

      const urls = await getPages(nextSource, nextChapterUrl);
      if (seq !== loadSeq) return;
      if (!urls.length) throw new Error('No page images were extracted for this chapter.');

      const saved = await loadReaderState(nextMediaId, nextSourceId, nextChapterUrl);
      if (seq !== loadSeq) return;

      pageUrls = urls;
      pageBlobs = Array(urls.length).fill('');
      direction = saved?.direction ?? deriveDirection(nextTitle.country);
      page = clamp(saved?.page ?? 0, 0, urls.length - 1);
      loading = false;

      for (let i = 0; i < urls.length; i++) {
        try {
          const bytes = await fetchBytes(urls[i], { referer: nextChapterUrl });
          if (seq !== loadSeq) return;
          const blobUrl = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: guessImageType(urls[i], bytes) }));
          pageBlobs[i] = blobUrl;
          pageBlobs = [...pageBlobs];
          loadCount = i + 1;
        } catch (e) {
          if (seq !== loadSeq) return;
          failedPages = [...failedPages, i + 1];
          note = `Some pages could not be loaded from the source CDNs: ${failedPages.join(', ')}.`;
          console.error(e);
        }
      }
    } catch (e) {
      if (seq !== loadSeq) return;
      err = String(e);
      loading = false;
    }
  }

  function onIntersect(entries: IntersectionObserverEntry[]) {
    if (direction !== 'vertical') return;
    let bestIndex = page;
    let bestRatio = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const idx = Number((entry.target as HTMLElement).dataset.index);
      if (!Number.isFinite(idx)) continue;
      if (entry.intersectionRatio >= bestRatio) {
        bestRatio = entry.intersectionRatio;
        bestIndex = idx;
      }
    }
    if (bestRatio > 0) page = bestIndex;
  }

  function pageAnchor(node: HTMLElement, index: number) {
    node.dataset.index = String(index);
    pageNodes.set(index, node);
    if (observer && direction === 'vertical') observer.observe(node);
    return {
      update(nextIndex: number) {
        if (observer) observer.unobserve(node);
        pageNodes.delete(index);
        index = nextIndex;
        node.dataset.index = String(index);
        pageNodes.set(index, node);
        if (observer && direction === 'vertical') observer.observe(node);
      },
      destroy() {
        if (observer) observer.unobserve(node);
        pageNodes.delete(index);
      },
    };
  }

  function setDirection(next: ReaderDirection) {
    direction = next;
    if (next === 'vertical') void tick().then(() => scrollToPage(page, 'auto'));
  }

  function step(delta: number) {
    jumpTo(page + delta);
  }

  function jumpTo(index: number, behavior: JumpBehavior = 'smooth') {
    if (!totalPages) return;
    const next = clamp(index, 0, totalPages - 1);
    page = next;
    if (direction === 'vertical') scrollToPage(next, behavior);
  }

  function scrollToPage(index: number, behavior: JumpBehavior) {
    pageNodes.get(index)?.scrollIntoView({ behavior, block: 'start' });
  }

  function backToMedia() {
    if (!mediaId) return go('/');
    go(`/media/${mediaId}`);
  }

  function revokeBlobs(blobs: string[]) {
    for (const blob of blobs) {
      if (blob) URL.revokeObjectURL(blob);
    }
  }

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function guessImageType(url: string, bytes: Uint8Array): string {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
    if (/\.png($|\?)/i.test(url)) return 'image/png';
    if (/\.gif($|\?)/i.test(url)) return 'image/gif';
    if (/\.webp($|\?)/i.test(url)) return 'image/webp';
    return 'image/jpeg';
  }

  function toBlobPart(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
</script>

<div class="reader-shell">
  <div class="reader-top">
    <button class="btn" onclick={backToMedia}>← Back</button>
    <div class="reader-head">
      <h1>{name}</h1>
      <div class="reader-meta">
        <span>{source?.name ?? sourceId}</span>
        {#if chapterUrl}
          <a href={chapterUrl} target="_blank" rel="noopener">Source chapter ↗</a>
        {/if}
        {#if currentSourceUrl}
          <a href={currentSourceUrl} target="_blank" rel="noopener">Current image ↗</a>
        {/if}
      </div>
    </div>
  </div>

  <section class="card toolbar">
    <div class="toolbar-block">
      <span class="toolbar-label">Direction</span>
      <div class="segmented">
        {#each ['rtl', 'vertical', 'ltr'] as mode (mode)}
          <button
            class:active={direction === mode}
            class="seg-btn"
            onclick={() => setDirection(mode as ReaderDirection)}
          >
            {directionLabel[mode as ReaderDirection]}
          </button>
        {/each}
      </div>
    </div>

    <div class="toolbar-block">
      <span class="toolbar-label">Progress</span>
      <div class="progress">
        <strong>{pageLabel}</strong>
        {#if totalPages}
          <span>{loadCount} loaded</span>
        {/if}
      </div>
    </div>
  </section>

  {#if err}
    <div class="card errbox">{err}</div>
  {:else if loading}
    <div class="card loading-card">
      <div class="loading-title">Preparing chapter…</div>
      <div class="loading-sub">Resolving the source, extracting page URLs, and restoring the saved reading position.</div>
    </div>
  {:else}
    {#if note}
      <div class="card warnbox">{note}</div>
    {/if}

    {#if pagedMode}
      <section class="card paged">
        <button class="nav-btn" onclick={() => step(-1)} disabled={!canPrev}>Prev</button>
        <div class="page-stage">
          {#if currentBlob}
            <img
              class:rtl={direction === 'rtl'}
              class:ltr={direction === 'ltr'}
              class="page-image"
              src={currentBlob}
              alt={`Page ${page + 1}`}
            />
          {:else}
            <div class="page-placeholder">Loading page {page + 1}…</div>
          {/if}
        </div>
        <button class="nav-btn" onclick={() => step(1)} disabled={!canNext}>Next</button>
      </section>
    {:else}
      <section class="vertical-strip">
        {#each pageUrls as _, i (`${i}-${pageUrls[i]}`)}
          <article class="card strip-page" use:pageAnchor={i}>
            {#if pageBlobs[i]}
              <img class="strip-image" src={pageBlobs[i]} alt={`Page ${i + 1}`} />
            {:else}
              <div class="page-placeholder">Loading page {i + 1}…</div>
            {/if}
          </article>
        {/each}
      </section>
    {/if}

    {#if totalPages}
      <section class="card filmstrip">
        {#each pageUrls as _, i (`thumb-${i}`)}
          <button class:active={page === i} class="film-btn" onclick={() => jumpTo(i)}>
            {i + 1}
          </button>
        {/each}
      </section>
    {/if}
  {/if}
</div>

<style>
  .reader-shell { display: flex; flex-direction: column; gap: 14px; }
  .reader-top { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
  .reader-head { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .reader-head h1 { margin: 0; font-size: clamp(22px, 2.6vw, 32px); }
  .reader-meta { display: flex; gap: 12px; flex-wrap: wrap; color: var(--muted); font-size: 13px; }
  .reader-meta a { color: var(--text); }
  .toolbar { display: flex; gap: 16px; justify-content: space-between; align-items: center; flex-wrap: wrap; }
  .toolbar-block { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .toolbar-label { color: var(--muted); font-size: 13px; }
  .segmented { display: inline-flex; padding: 4px; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); }
  .seg-btn { min-width: 78px; padding: 7px 12px; border: 0; border-radius: calc(var(--radius-sm) - 2px); background: transparent; color: var(--muted); font-size: 13px; }
  .seg-btn.active { background: var(--accent); color: #fff; }
  .progress { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
  .progress strong { font-size: 15px; }
  .loading-card, .warnbox, .errbox { padding: 18px; }
  .loading-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .loading-sub { color: var(--muted); font-size: 13px; line-height: 1.5; max-width: 620px; }
  .warnbox { color: color-mix(in srgb, #fff 92%, var(--warning, #d9a441) 8%); background: color-mix(in srgb, #d9a441 10%, transparent); border: 1px solid color-mix(in srgb, #d9a441 30%, transparent); }
  .errbox { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); }
  .paged { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: min(78vh, 980px); }
  .nav-btn { width: 72px; height: 44px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
  .nav-btn[disabled] { opacity: .45; cursor: not-allowed; }
  .page-stage { min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center; }
  .page-image { max-width: 100%; max-height: 76vh; object-fit: contain; border-radius: calc(var(--radius-sm) - 2px); }
  .page-image.rtl { direction: rtl; }
  .page-image.ltr { direction: ltr; }
  .page-placeholder { min-height: 480px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%; }
  .vertical-strip { display: flex; flex-direction: column; gap: 12px; }
  .strip-page { padding: 10px; }
  .strip-image { width: 100%; display: block; border-radius: calc(var(--radius-sm) - 2px); }
  .filmstrip { display: flex; flex-wrap: wrap; gap: 8px; }
  .film-btn { min-width: 40px; height: 34px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 13px; }
  .film-btn.active { border-color: color-mix(in srgb, var(--accent) 75%, var(--border)); color: #fff; background: color-mix(in srgb, var(--accent) 25%, var(--surface)); }
  @media (max-width: 900px) {
    .paged { grid-template-columns: 1fr; }
    .nav-btn { width: 100%; }
    .page-placeholder { min-height: 320px; }
  }
</style>
