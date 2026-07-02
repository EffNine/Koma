<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { media } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';
  import { titleName } from '../lib/catalog/types';
  import { deriveDirection, loadReaderState, saveReaderState, type ReaderDirection } from '../lib/reader/state';
  import { loadReaderSettings, saveReaderSettings, type ImageFit } from '../lib/reader/settings';
  import { loadChapterImages, revokeBlobUrls, retryFailedPages, categorizeFailure } from '../lib/reader/chapterLoader';
  import { match, go, route } from '../lib/router';
  import { getTitlePreference, savePreferredGroup, saveTitleReaderSettings } from '../lib/media/titlePreferences';
  import { getChapters, getPages } from '../lib/scraper/scraper';
  import { getSource, enabledSources, type Source } from '../lib/scraper/sources';
  import { recordReaderPage } from '../lib/tracker/local';
  import type { ScrapedChapter } from '../lib/scraper/engine';
  import { resolveChapters } from '../lib/media/chapterResolver';
  import { preferredGroupForChapter, selectAdjacentChapter, sameNumberChapters } from '../lib/reader/chapterNavigation';
  import { pairPages, pageToSpreadIndex, type SpreadMode } from '../lib/reader/spread';

  const directionLabel: Record<ReaderDirection, string> = {
    rtl: 'RTL',
    ltr: 'LTR',
    vertical: 'Vertical',
  };

  const imageFitLabel: Record<ImageFit, string> = {
    width: 'Fit Width',
    screen: 'Fit Screen',
    original: 'Original',
  };

  const spreadModeLabel: Record<SpreadMode, string> = {
    single: 'Single',
    double: 'Double',
  };

  type JumpBehavior = 'smooth' | 'auto';

  let params = $derived(match('/reader/:mediaId/:sourceId/:seriesUrl/:chapterUrl', $route.path));
  let mediaId = $derived(params ? Number(params.mediaId) : 0);
  let sourceId = $derived(params?.sourceId ?? '');
  let routeSeriesUrl = $derived(params?.seriesUrl ?? '');
  let routeChapterUrl = $derived(params?.chapterUrl ?? '');
  let seriesUrl = $state('');
  let chapterUrl = $state('');

  // Sync from route params on navigation
  $effect(() => {
    seriesUrl = routeSeriesUrl;
    chapterUrl = routeChapterUrl;
  });
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
  let imageFit = $state<ImageFit>('width');
  let loadCount = $state(0);
  let abortController: AbortController | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  let observer: IntersectionObserver | null = null;
  const pageNodes = new Map<number, HTMLElement>();
  let chapters = $state<ScrapedChapter[]>([]);
  let preferredChapterGroup = $state<string | null>(null);
  let atBottom = $state(false);
  let showFloatingNav = $state(false);
  let floatingNavTimer: ReturnType<typeof setTimeout> | undefined;
  let retrying = $state(false);
  let sameNumberAlts = $state<ScrapedChapter[]>([]);
  let failureCategory = $state('');
  let spreadMode = $state<SpreadMode>('single');

  let name = $derived(t ? titleName(t) : 'Reader');
  let currentChapter = $derived(chapters.find((c) => c.url === chapterUrl));
  let chapterLabel = $derived(currentChapter?.title ?? (currentChapter?.number ? `Chapter ${currentChapter.number}` : ''));
  let currentBlob = $derived(pageBlobs[page] ?? '');
  let currentSourceUrl = $derived(pageUrls[page] ?? '');
  let totalPages = $derived(pageUrls.length);
  let pageLabel = $derived(totalPages ? `${page + 1} / ${totalPages}` : '0 / 0');
  let pagedMode = $derived(direction !== 'vertical');
  let canPrev = $derived(page > 0);
  let canNext = $derived(page + 1 < totalPages);
  let prevChapter = $derived(selectAdjacentChapter(chapters, chapterUrl, 'prev', preferredChapterGroup));
  let nextChapter = $derived(selectAdjacentChapter(chapters, chapterUrl, 'next', preferredChapterGroup));
  let spreadPairs = $derived(
    spreadMode === 'double' && (direction === 'rtl' || direction === 'ltr')
      ? pairPages(totalPages, direction)
      : [],
  );
  let currentSpread = $derived(
    spreadPairs.length > 0 ? pageToSpreadIndex(page, spreadPairs) : -1,
  );
  let canSpreadPrev = $derived(currentSpread > 0);
  let canSpreadNext = $derived(currentSpread >= 0 && currentSpread < spreadPairs.length - 1);

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

  $effect(() => {
    if (direction !== 'vertical') { showFloatingNav = false; return; }
    const onScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      atBottom = docHeight - scrollBottom < 200;
      clearTimeout(floatingNavTimer);
      showFloatingNav = true;
      floatingNavTimer = setTimeout(() => { showFloatingNav = false; }, 3000);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(floatingNavTimer);
    };
  });

  // Keyboard shortcuts
  function onKeyDown(e: KeyboardEvent) {
    if (direction === 'vertical') {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        window.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'smooth' });
      }
    } else {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(direction === 'rtl' ? 1 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(direction === 'rtl' ? -1 : 1);
      }
    }
    if (e.key === 'f') {
      e.preventDefault();
      const fits: ImageFit[] = ['width', 'screen', 'original'];
      const idx = fits.indexOf(imageFit);
      setImageFit(fits[(idx + 1) % fits.length]);
    }
    if (e.key === 'd') {
      e.preventDefault();
      const dirs: ReaderDirection[] = ['rtl', 'vertical', 'ltr'];
      const idx = dirs.indexOf(direction);
      setDirection(dirs[(idx + 1) % dirs.length]);
    }
    if (e.key === 'g' && totalPages > 0) {
      e.preventDefault();
      const input = prompt(`Go to page (1-${totalPages}):`);
      if (input) {
        const n = parseInt(input, 10);
        if (!isNaN(n) && n >= 1 && n <= totalPages) jumpTo(n - 1, 'smooth');
      }
    }
  }

  // Click-to-advance on paged mode
  function onPageClick(e: MouseEvent) {
    if (direction === 'vertical') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) {
      step(direction === 'rtl' ? 1 : -1);
    } else if (x > rect.width - third) {
      step(direction === 'rtl' ? -1 : 1);
    }
  }

  // Preload next chapter images
  let preloadAbort: AbortController | null = null;
  async function preloadNextChapter() {
    const next = nextChapter;
    if (!next || !source || !seriesUrl) return;
    preloadAbort?.abort();
    preloadAbort = new AbortController();
    try {
      const urls = await getPages(source, next.url);
      if (preloadAbort.signal.aborted) return;
      // Fetch first 3 pages to warm the CDN cache
      const preloadCount = Math.min(3, urls.length);
      for (let i = 0; i < preloadCount; i++) {
        if (preloadAbort.signal.aborted) return;
        fetch(urls[i], { mode: 'no-cors' }).catch(() => {});
      }
    } catch {
      // preload failure is non-critical
    }
  }

  $effect(() => {
    // Preload next chapter when current chapter finishes loading
    if (totalPages > 0 && nextChapter) {
      void preloadNextChapter();
    }
    return () => { preloadAbort?.abort(); };
  });

  onDestroy(() => {
    clearTimeout(persistTimer);
    observer?.disconnect();
    abortController?.abort();
    preloadAbort?.abort();
    revokeBlobUrls(untrack(() => pageBlobs));
  });

  async function loadChapter(nextMediaId: number, nextSourceId: string, nextChapterUrl: string) {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    loading = true;
    err = '';
    note = '';
    failureCategory = '';
    loadCount = 0;
    t = undefined;
    source = undefined;
    failedPages = [];
    sameNumberAlts = [];
    revokeBlobUrls(pageBlobs);
    pageUrls = [];
    pageBlobs = [];
    page = 0;
    chapters = [];
    atBottom = false;

    try {
      let nextSource = await getSource(nextSourceId);
      // If the saved source no longer exists, try to find chapters from any enabled source
      if (!nextSource) {
        const title = await media(nextMediaId);
        if (!title) throw new Error(`Catalog title ${nextMediaId} was not found.`);
        t = title;

        const allSources = await enabledSources();
        for (const s of allSources) {
          const result = await resolveChapters(s, title).catch(() => null);
          if (result && !('err' in result) && result.chapters.length > 0) {
            // Find the matching chapter in the new source
            const match = result.chapters.find((c) => c.number === chapterUrl.split('/').filter(Boolean).pop()?.match(/(\d+(?:\.\d+)?)/)?.[1]);
            if (match) {
              nextSource = s;
              nextChapterUrl = match.url;
              seriesUrl = result.seriesUrl;
              break;
            }
          }
        }
        if (!nextSource) throw new Error('Saved source was removed. Re-add it in Settings, or open this title from the Media page to auto-resolve.');
      }

      const [nextTitle] = await Promise.all([
        media(nextMediaId),
      ]);
      if (signal.aborted) return;
      if (!nextTitle) throw new Error(`Catalog title ${nextMediaId} was not found.`);
      if (!nextSource) throw new Error('Saved source not found. Re-add or re-enable it in Settings.');

      if (!t) t = nextTitle;
      source = nextSource;

      const [urls, allChapters, saved, settings, titlePref] = await Promise.all([
        getPages(nextSource, nextChapterUrl),
        seriesUrl ? getChapters(nextSource, decodeURIComponent(seriesUrl)).catch(() => [] as ScrapedChapter[]) : Promise.resolve([] as ScrapedChapter[]),
        loadReaderState(nextMediaId, nextSourceId, nextChapterUrl),
        loadReaderSettings(),
        getTitlePreference(nextMediaId),
      ]);
      if (signal.aborted) return;
      if (!urls.length) throw new Error('No page images were extracted for this chapter.');

      chapters = allChapters;
      preferredChapterGroup = preferredGroupForChapter(allChapters, nextChapterUrl, titlePref?.preferredGroup);
      sameNumberAlts = sameNumberChapters(allChapters, nextChapterUrl);

      const currentGroup = allChapters.find((c) => c.url === nextChapterUrl)?.group;
      if (currentGroup) {
        void savePreferredGroup(nextMediaId, currentGroup);
      }

      pageUrls = urls;
      pageBlobs = Array(urls.length).fill('');
      // Precedence: chapter state > per-title settings > global settings > country default
      direction = saved?.direction ?? titlePref?.readerDirection ?? settings.defaultDirection ?? deriveDirection(nextTitle.country);
      imageFit = titlePref?.imageFit ?? settings.imageFit ?? 'width';
      page = clamp(saved?.page ?? 0, 0, urls.length - 1);
      loading = false;

      const result = await loadChapterImages(urls, nextChapterUrl, signal, {
        concurrency: direction === 'vertical' ? 5 : 3,
        mediaId: nextMediaId,
        sourceId: nextSourceId,
        chapterUrl: nextChapterUrl,
        onPageLoaded: (index, blobUrl) => {
          if (signal.aborted) return;
          const nextBlobs = pageBlobs.slice();
          nextBlobs[index] = blobUrl;
          pageBlobs = nextBlobs;
          loadCount = nextBlobs.filter(Boolean).length;
        },
      });
      if (signal.aborted) return;
      pageBlobs = result.blobUrls;
      failedPages = result.failedPages;
      loadCount = urls.length - failedPages.length;
      if (failedPages.length) {
        note = `Some pages could not be loaded from the source CDNs: ${failedPages.join(', ')}.`;
        failureCategory = categorizeFailure(failedPages.length > 0 ? new Error('CDN fetch failed') : null);
      }
    } catch (e) {
      if (signal.aborted) return;
      failureCategory = categorizeFailure(e);
      err = failureCategory;
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

  async function saveDirectionForTitle(next: ReaderDirection) {
    direction = next;
    await saveTitleReaderSettings(mediaId, { readerDirection: next, imageFit });
    if (next === 'vertical') void tick().then(() => scrollToPage(page, 'auto'));
  }

  function setImageFit(next: ImageFit) {
    imageFit = next;
    void saveReaderSettings({ key: 'defaults', defaultDirection: direction, imageFit: next });
  }

  async function saveImageFitForTitle(next: ImageFit) {
    imageFit = next;
    await saveTitleReaderSettings(mediaId, { readerDirection: direction, imageFit: next });
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

  async function retryFailed() {
    if (retrying || failedPages.length === 0 || !source) return;
    retrying = true;
    try {
      const result = await retryFailedPages(pageUrls, failedPages, chapterUrl);
      const nextBlobs = pageBlobs.slice();
      for (let i = 0; i < result.blobUrls.length; i++) {
        if (result.blobUrls[i]) {
          if (nextBlobs[i]) URL.revokeObjectURL(nextBlobs[i]);
          nextBlobs[i] = result.blobUrls[i];
        }
      }
      pageBlobs = nextBlobs;
      failedPages = result.failedPages;
      if (result.failedPages.length === 0) {
        note = '';
        failureCategory = '';
      } else {
        note = `Some pages could not be loaded: ${result.failedPages.join(', ')}.`;
      }
    } catch {
      note = 'Retry failed. The source may still be unavailable.';
    } finally {
      retrying = false;
    }
  }

  function switchToGroupChapter(ch: ScrapedChapter) {
    if (!source) return;
    void savePreferredGroup(mediaId, ch.group);
    go(`/reader/${mediaId}/${sourceId}/${encodeURIComponent(seriesUrl)}/${encodeURIComponent(ch.url)}`);
  }

  function goToChapter(ch: ScrapedChapter) {
    go(`/reader/${mediaId}/${sourceId}/${encodeURIComponent(seriesUrl)}/${encodeURIComponent(ch.url)}`);
  }

  function backToMedia() {
    if (!mediaId) return go('/');
    go(`/media/${mediaId}`);
  }

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  // Bind keyboard listener
  $effect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="reader-shell">
  <div class="reader-top">
    <button class="btn" onclick={backToMedia}>← Back</button>
    <div class="reader-head">
      <h1>{name}</h1>
      {#if chapterLabel}
        <div class="reader-chapter-label">{chapterLabel}</div>
      {/if}
      <div class="reader-meta">
        <span>{source?.name ?? sourceId}</span>
        {#if sameNumberAlts.length > 0}
          <span class="meta-sep">|</span>
          <select class="group-switch" onchange={(e) => {
            const alt = sameNumberAlts.find((a) => a.url === e.currentTarget.value);
            if (alt) switchToGroupChapter(alt);
          }}>
            <option value={chapterUrl} selected={true}>
              {chapters.find((c) => c.url === chapterUrl)?.group ?? source?.name ?? 'Source'} (current)
            </option>
            {#each sameNumberAlts as alt (alt.url)}
              <option value={alt.url}>
                {alt.group ?? source?.name ?? 'Source'}
              </option>
            {/each}
          </select>
        {:else if chapters.find((c) => c.url === chapterUrl)?.group}
          <span>{chapters.find((c) => c.url === chapterUrl)!.group}</span>
        {/if}
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
      <button class="btn tiny-btn" onclick={() => saveDirectionForTitle(direction)} title="Save direction for this title">Save</button>
    </div>

    <div class="toolbar-block">
      <span class="toolbar-label">Image Fit</span>
      <div class="segmented">
        {#each ['width', 'screen', 'original'] as fit (fit)}
          <button
            class:active={imageFit === fit}
            class="seg-btn"
            onclick={() => setImageFit(fit as ImageFit)}
          >
            {imageFitLabel[fit as ImageFit]}
          </button>
        {/each}
      </div>
      <button class="btn tiny-btn" onclick={() => saveImageFitForTitle(imageFit)} title="Save image fit for this title">Save</button>
    </div>

    {#if pagedMode}
      <div class="toolbar-block">
        <span class="toolbar-label">Spread</span>
        <div class="segmented">
          {#each ['single', 'double'] as mode (mode)}
            <button
              class:active={spreadMode === mode}
              class="seg-btn"
              onclick={() => { spreadMode = mode as SpreadMode; }}
            >
              {spreadModeLabel[mode as SpreadMode]}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="toolbar-block">
      <span class="toolbar-label">Progress</span>
      <div class="progress">
        <strong>{pageLabel}</strong>
        {#if totalPages}
          <span>{loadCount} loaded</span>
        {/if}
      </div>
    </div>

    <div class="toolbar-block toolbar-shortcuts">
      <span class="toolbar-label">Shortcuts</span>
      <kbd>←→</kbd>
      <kbd>F</kbd> fit
      <kbd>D</kbd> dir
      <kbd>G</kbd> goto
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
      <div class="card warnbox">
        <div class="warnbox-content">
          <span>{note}</span>
          {#if failureCategory}
            <span class="warnbox-detail">{failureCategory}</span>
          {/if}
        </div>
        <div class="warnbox-actions">
          {#if failedPages.length > 0}
            <button class="btn small-btn" onclick={retryFailed} disabled={retrying}>
              {retrying ? 'Retrying…' : 'Retry failed pages'}
            </button>
          {/if}
          {#if sameNumberAlts.length > 0}
            <span class="warnbox-hint">or switch group above</span>
          {/if}
        </div>
      </div>
    {/if}

    {#if pagedMode}
      {#if spreadMode === 'double' && spreadPairs.length > 0}
        <section class="card paged spread">
          <button class="nav-btn" onclick={() => { const s = currentSpread - 1; if (s >= 0) { const p = spreadPairs[s]; page = p.right >= 0 ? p.right : p.left; } }} disabled={!canSpreadPrev}>Prev</button>
          <div class="spread-stage" onclick={onPageClick} role="presentation">
            <div class="spread-page">
              {#if currentSpread >= 0}
                {@const pair = spreadPairs[currentSpread]}
                {#if pair.left >= 0 && pageBlobs[pair.left]}
                  <img
                    class="page-image spread-half"
                    src={pageBlobs[pair.left]}
                    alt={`Page ${pair.left + 1}`}
                    decoding="async"
                    draggable="false"
                  />
                {:else if pair.left >= 0}
                  <div class="page-placeholder spread-half">Loading page {pair.left + 1}…</div>
                {/if}
                {#if pair.right >= 0 && pageBlobs[pair.right]}
                  <img
                    class="page-image spread-half"
                    src={pageBlobs[pair.right]}
                    alt={`Page ${pair.right + 1}`}
                    decoding="async"
                    draggable="false"
                  />
                {:else if pair.right >= 0}
                  <div class="page-placeholder spread-half">Loading page {pair.right + 1}…</div>
                {/if}
              {/if}
            </div>
          </div>
          <button class="nav-btn" onclick={() => { const s = currentSpread + 1; if (s < spreadPairs.length) { const p = spreadPairs[s]; page = p.right >= 0 ? p.right : p.left; } }} disabled={!canSpreadNext}>Next</button>
        </section>
      {:else}
        <section class="card paged">
          <button class="nav-btn" onclick={() => step(-1)} disabled={!canPrev}>Prev</button>
          <div class="page-stage" onclick={onPageClick} role="presentation">
            {#if currentBlob}
              <img
                class:rtl={direction === 'rtl'}
                class:ltr={direction === 'ltr'}
                class="page-image"
                src={currentBlob}
                alt={`Page ${page + 1}`}
                decoding="async"
                draggable="false"
              />
            {:else}
              <div class="page-placeholder">Loading page {page + 1}…</div>
            {/if}
          </div>
          <button class="nav-btn" onclick={() => step(1)} disabled={!canNext}>Next</button>
        </section>
      {/if}
    {:else}
      <section class="vertical-strip">
        {#each pageUrls as _, i (`${i}-${pageUrls[i]}`)}
          <article class="strip-page" use:pageAnchor={i}>
            {#if pageBlobs[i]}
              <img
                class="strip-image strip-{imageFit}"
                src={pageBlobs[i]}
                alt={`Page ${i + 1}`}
                loading={i < 3 ? 'eager' : 'lazy'}
                decoding="async"
                draggable="false"
              />
            {:else}
              <div class="page-placeholder">Loading page {i + 1}…</div>
            {/if}
          </article>
        {/each}
      </section>

      {#if direction === 'vertical' && (prevChapter || nextChapter)}
        <section class="card chapter-end-nav">
          <h3 class="chapter-end-title">End of chapter</h3>
          <div class="chapter-end-buttons">
            {#if prevChapter}
              <button class="btn" onclick={() => goToChapter(prevChapter)}>
                ← {prevChapter.title || `Ch. ${prevChapter.number ?? '?'}`}
              </button>
            {/if}
            <button class="btn" onclick={backToMedia}>Back to Media</button>
            {#if nextChapter}
              <button class="btn btn-primary" onclick={() => goToChapter(nextChapter)}>
                {nextChapter.title || `Ch. ${nextChapter.number ?? '?'}`} →
              </button>
            {/if}
          </div>
        </section>
      {/if}
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

    <!-- Chapter-end nav for paged mode -->
    {#if pagedMode && (prevChapter || nextChapter)}
      <section class="card chapter-end-nav">
        <h3 class="chapter-end-title">End of chapter</h3>
        <div class="chapter-end-buttons">
          {#if prevChapter}
            <button class="btn" onclick={() => goToChapter(prevChapter)}>
              ← {prevChapter.title || `Ch. ${prevChapter.number ?? '?'}`}
            </button>
          {/if}
          <button class="btn" onclick={backToMedia}>Back to Media</button>
          {#if nextChapter}
            <button class="btn btn-primary" onclick={() => goToChapter(nextChapter)}>
              {nextChapter.title || `Ch. ${nextChapter.number ?? '?'}`} →
            </button>
          {/if}
        </div>
      </section>
    {/if}
  {/if}
</div>

{#if direction === 'vertical' && showFloatingNav && (prevChapter || nextChapter)}
  <nav class="floating-chapter-nav" class:visible={showFloatingNav}>
    {#if prevChapter}
      <button class="btn floating-nav-btn" onclick={() => goToChapter(prevChapter)} title={prevChapter.title || `Ch. ${prevChapter.number ?? '?'}`}>
        ← Prev
      </button>
    {/if}
    <button class="btn floating-nav-btn" onclick={backToMedia} title="Back to Media">
      Media
    </button>
    {#if nextChapter}
      <button class="btn btn-primary floating-nav-btn" onclick={() => goToChapter(nextChapter)} title={nextChapter.title || `Ch. ${nextChapter.number ?? '?'}`}>
        Next →
      </button>
    {/if}
  </nav>
{/if}

<style>
  .reader-shell { display: flex; flex-direction: column; gap: 14px; }
  .reader-top { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
  .reader-head { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .reader-head h1 { margin: 0; font-size: clamp(22px, 2.6vw, 32px); }
  .reader-chapter-label { font-size: 14px; color: var(--accent); font-weight: 500; margin-top: -2px; }
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
  .toolbar-shortcuts { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--muted-2); }
  .toolbar-shortcuts kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 20px; padding: 0 5px; border-radius: 4px; border: 1px solid var(--border); background: var(--surface); font-family: inherit; font-size: 11px; color: var(--muted); }
  .loading-card, .warnbox, .errbox { padding: 18px; }
  .loading-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .loading-sub { color: var(--muted); font-size: 13px; line-height: 1.5; max-width: 620px; }
  .warnbox { color: color-mix(in srgb, #fff 92%, var(--warning, #d9a441) 8%); background: color-mix(in srgb, #d9a441 10%, transparent); border: 1px solid color-mix(in srgb, #d9a441 30%, transparent); }
  .warnbox-content { display: flex; flex-direction: column; gap: 6px; }
  .warnbox-detail { font-size: 13px; opacity: 0.8; }
  .warnbox-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  .warnbox-hint { font-size: 12px; opacity: 0.7; }
  .errbox { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); }
  .meta-sep { color: var(--muted-2); }
  .group-switch { font-size: 12px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px 6px; max-width: 200px; }
  .tiny-btn { padding: 4px 8px; font-size: 11px; min-width: auto; }
  .paged { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: min(78vh, 980px); }
  .paged.spread { grid-template-columns: auto minmax(0, 1fr) auto; }
  .spread-stage { min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center; }
  .spread-page { display: flex; gap: 4px; max-width: 100%; max-height: 76vh; align-items: center; justify-content: center; }
  .spread-half { max-width: 50%; max-height: 76vh; object-fit: contain; }
  .nav-btn { width: 72px; height: 44px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
  .nav-btn[disabled] { opacity: .45; cursor: not-allowed; }
  .page-stage { min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center; }
  .page-image { max-width: 100%; max-height: 76vh; object-fit: contain; border-radius: calc(var(--radius-sm) - 2px); }
  .page-image.rtl { direction: rtl; }
  .page-image.ltr { direction: ltr; }
  .page-placeholder { min-height: min(78vh, 920px); display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%; }
  .vertical-strip { display: flex; flex-direction: column; gap: 0; align-items: center; overflow-anchor: none; }
  .strip-page { width: min(100%, 980px); padding: 0; background: none; border: none; border-radius: 0; contain: layout paint; content-visibility: auto; contain-intrinsic-size: 900px 1300px; }
  .strip-image { width: 100%; display: block; user-select: none; -webkit-user-drag: none; transform: translateZ(0); backface-visibility: hidden; }
  .strip-screen { max-width: 100%; max-height: 100vh; object-fit: contain; margin: 0 auto; }
  .strip-original { width: auto; max-width: 100%; margin: 0 auto; }
  .filmstrip { display: flex; flex-wrap: wrap; gap: 8px; }
  .film-btn { min-width: 40px; height: 34px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 13px; }
  .film-btn.active { border-color: color-mix(in srgb, var(--accent) 75%, var(--border)); color: #fff; background: color-mix(in srgb, var(--accent) 25%, var(--surface)); }
  .chapter-end-nav { text-align: center; padding: 24px 18px; }
  .chapter-end-title { margin: 0 0 14px; font-size: 15px; font-weight: 600; color: var(--muted); }
  .chapter-end-buttons { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .floating-chapter-nav { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; padding: 10px 14px; background: var(--elevated); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 4px 20px rgba(0,0,0,.3); z-index: 100; opacity: 0; transition: opacity .25s ease; pointer-events: none; }
  .floating-chapter-nav.visible { opacity: 1; pointer-events: auto; }
  .floating-nav-btn { padding: 8px 14px; font-size: 13px; white-space: nowrap; }
  @media (max-width: 900px) {
    .paged { grid-template-columns: 1fr; }
    .nav-btn { width: 100%; }
    .page-placeholder { min-height: 320px; }
  }
</style>
