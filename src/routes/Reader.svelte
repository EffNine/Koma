<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import type { Title } from '../lib/catalog/types';
  import { titleName } from '../lib/catalog/types';
  import { deriveDirection, saveReaderState, type ReaderDirection } from '../lib/reader/state';
  import { saveReaderSettings, type ImageFit } from '../lib/reader/settings';
  import { loadChapterImages, revokeBlobUrls, retryFailedPages, categorizeFailure } from '../lib/reader/chapterLoader';
  import { match, go, route } from '../lib/router';
  import { clamp } from '../lib/util';
  import Toast from '../lib/components/Toast.svelte';
  import ReaderChrome from '../lib/components/reader/ReaderChrome.svelte';
  import ReaderLoadingState from '../lib/components/reader/ReaderLoadingState.svelte';
  import ReaderErrorState from '../lib/components/reader/ReaderErrorState.svelte';
  import ReaderWarningBox from '../lib/components/reader/ReaderWarningBox.svelte';
  import ReaderResumeNotice from '../lib/components/reader/ReaderResumeNotice.svelte';
  import ReaderPagedView from '../lib/components/reader/ReaderPagedView.svelte';
  import ReaderSpreadView from '../lib/components/reader/ReaderSpreadView.svelte';
  import ReaderVerticalView from '../lib/components/reader/ReaderVerticalView.svelte';
  import ReaderChapterEndNav from '../lib/components/reader/ReaderChapterEndNav.svelte';
  import { savePreferredGroup, saveTitleReaderSettings } from '../lib/media/titlePreferences';
  import { getPages } from '../lib/scraper/scraper';
  import type { Source } from '../lib/scraper/sources';
  import { recordReaderPage } from '../lib/tracker/local';
  import type { ScrapedChapter } from '../lib/scraper/engine';
  import { findFallbackChapter } from '../lib/media/fallback';
  import { resolveReaderChapterSession } from '../lib/reader/chapterSession';
  import { preferredGroupForChapter, selectAdjacentChapter, sameNumberChapters } from '../lib/reader/chapterNavigation';
  import { pairPages, pageToSpreadIndex, type SpreadMode } from '../lib/reader/spread';

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
  let brightness = $state(100);
  let contrast = $state(100);
  let zoom = $state(100);
  let loadCount = $state(0);
  let abortController: AbortController | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  let observer: IntersectionObserver | null = null;
  const pageNodes = new Map<number, HTMLElement>();
  let chapters = $state<ScrapedChapter[]>([]);
  let preferredChapterGroup = $state<string | null>(null);
  let retrying = $state(false);
  let sameNumberAlts = $state<ScrapedChapter[]>([]);
  let failureCategory = $state('');
  let spreadMode = $state<SpreadMode>('single');
  let loadPhase = $state<'resolving' | 'loading' | 'retrying' | 'fallback' | ''>('');
  let fallbackAttempted = $state(false);
  let showResumeNotice = $state(false);
  let resumedFromPage = $state(0);
  let toast = $state<{ text: string; tone: 'ok' | 'err' } | null>(null);
  let showChrome = $state(false);
  let chromeAutoShow = $state(false);
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;
  let showShortcuts = $state(false);
  let isFullscreen = $state(false);

  let name = $derived(t ? titleName(t) : 'Reader');
  let loadingTitle = $derived(
    loadPhase === 'resolving' ? 'Resolving chapter…' :
    loadPhase === 'retrying' ? 'Retrying…' :
    loadPhase === 'fallback' ? 'Trying another source…' :
    loadPhase === 'loading' ? 'Loading pages…' :
    'Preparing chapter…'
  );
  let loadingSub = $derived(
    loadPhase === 'resolving' ? 'Finding the series and chapter on the selected source.' :
    loadPhase === 'retrying' ? 'The first attempt failed. Trying once more before giving up.' :
    loadPhase === 'fallback' ? 'Looking for this chapter on another enabled source.' :
    loadPhase === 'loading' ? 'Fetching page images from the source CDN.' :
    'Resolving the source, extracting page URLs, and restoring the saved reading position.'
  );
  let currentChapter = $derived(chapters.find((c) => c.url === chapterUrl));
  let chapterLabel = $derived(currentChapter?.title ?? (currentChapter?.number ? `Chapter ${currentChapter.number}` : ''));
  let currentChapterGroup = $derived(currentChapter?.group ?? '');
  let sourceName = $derived(source?.name ?? sourceId);
  let currentBlob = $derived(pageBlobs[page] ?? '');
  let currentSourceUrl = $derived(pageUrls[page] ?? '');
  let totalPages = $derived(pageUrls.length);
  let pageLabel = $derived(totalPages ? `${page + 1} / ${totalPages}` : '0 / 0');
  let progressPercent = $derived(totalPages ? Math.round(((page + 1) / totalPages) * 100) : 0);
  let pageLoadPercent = $derived(totalPages ? Math.round((loadCount / totalPages) * 100) : 0);
  let pageLoadLabel = $derived(totalPages ? `${loadCount} / ${totalPages} loaded` : '');
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
    const currentImageFit = imageFit;
    const currentSeriesUrl = seriesUrl;
    const currentTitle = t;
    const chapter = currentChapter;
    if (!p || count === 0) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void saveReaderState({
        mediaId: Number(p.mediaId),
        sourceId: p.sourceId,
        chapterUrl: p.chapterUrl,
        seriesUrl: currentSeriesUrl,
        page: clamp(currentPage, 0, count - 1),
        direction: currentDirection,
        imageFit: currentImageFit,
      });
      if (currentTitle) {
        void recordReaderPage({
          title: currentTitle,
          sourceId: p.sourceId,
          chapterUrl: p.chapterUrl,
          chapterNumber: chapter?.number,
          chapterTitle: chapter?.title,
          page: clamp(currentPage, 0, count - 1),
          totalPages: count,
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
    if (e.key === '?') {
      e.preventDefault();
      showShortcuts = !showShortcuts;
    }
    if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      showChrome = !showChrome;
    }
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      setZoom(Math.min(200, zoom + 10));
    }
    if (e.key === '-') {
      e.preventDefault();
      setZoom(Math.max(50, zoom - 10));
    }
    if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setZoom(100);
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
    clearTimeout(hideTimeout);
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
    loadPhase = 'resolving';
    fallbackAttempted = false;
    showResumeNotice = false;
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

    try {
      const session = await resolveReaderChapterSession({
        mediaId: nextMediaId,
        sourceId: nextSourceId,
        seriesUrl,
        chapterUrl: nextChapterUrl,
        signal,
        onPhase: (phase) => { loadPhase = phase; },
      });
      if (signal.aborted) return;
      if (session.status === 'redirect') {
        go(session.route);
        return;
      }

      const nextTitle = session.title;
      const nextSource = session.source;
      const urls = session.pageUrls;
      const allChapters = session.chapters;
      const saved = session.saved;
      const settings = session.settings;
      const titlePref = session.titlePreference;

      t = nextTitle;
      source = nextSource;
      seriesUrl = session.seriesUrl;
      chapterUrl = session.chapterUrl;
      chapters = allChapters;
      preferredChapterGroup = preferredGroupForChapter(allChapters, session.chapterUrl, titlePref?.preferredGroup);
      sameNumberAlts = sameNumberChapters(allChapters, session.chapterUrl);

      const currentGroup = allChapters.find((c) => c.url === session.chapterUrl)?.group;
      if (currentGroup) {
        void savePreferredGroup(nextMediaId, currentGroup);
      }

      pageUrls = urls;
      pageBlobs = Array(urls.length).fill('');
      loadPhase = 'loading';
      // Precedence: chapter state > per-title settings > global settings > country default
      direction = saved?.direction ?? titlePref?.readerDirection ?? settings.defaultDirection ?? deriveDirection(nextTitle.country);
      imageFit = saved?.imageFit ?? titlePref?.imageFit ?? settings.imageFit ?? 'width';
      brightness = settings.brightness ?? 100;
      contrast = settings.contrast ?? 100;
      zoom = settings.zoom ?? 100;
      const restoredPage = clamp(saved?.page ?? 0, 0, urls.length - 1);
      page = restoredPage;
      if (saved && restoredPage > 0) {
        showResumeNotice = true;
        resumedFromPage = restoredPage;
      }
      loading = false;

      const result = await loadChapterImages(urls, session.chapterUrl, signal, {
        concurrency: direction === 'vertical' ? 5 : 3,
        mediaId: nextMediaId,
        sourceId: nextSource.id,
        chapterUrl: session.chapterUrl,
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
      loadPhase = '';
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

  function onReaderMouseMove(e: MouseEvent) {
    const nearTop = e.clientY < 60;
    if (nearTop) {
      clearTimeout(hideTimeout);
      hideTimeout = undefined;
      chromeAutoShow = true;
    } else if (chromeAutoShow) {
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        chromeAutoShow = false;
      }, 1200);
    }
  }

  function onReaderMouseLeave() {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      chromeAutoShow = false;
    }, 400);
  }

  function setDirection(next: ReaderDirection) {
    direction = next;
    if (next === 'vertical') void tick().then(() => scrollToPage(page, 'auto'));
  }

  async function saveDirectionForTitle(next: ReaderDirection) {
    direction = next;
    try {
      await saveTitleReaderSettings(mediaId, { readerDirection: next, imageFit });
      toast = { text: 'Reading direction saved for this title', tone: 'ok' };
    } catch {
      toast = { text: 'Failed to save reading direction', tone: 'err' };
    }
    if (next === 'vertical') void tick().then(() => scrollToPage(page, 'auto'));
  }

  function setImageFit(next: ImageFit) {
    imageFit = next;
    void saveReaderSettings({ key: 'defaults', defaultDirection: direction, imageFit: next, brightness, contrast, zoom });
  }

  async function saveImageFitForTitle(next: ImageFit) {
    imageFit = next;
    try {
      await saveTitleReaderSettings(mediaId, { readerDirection: direction, imageFit: next });
      toast = { text: 'Image fit saved for this title', tone: 'ok' };
    } catch {
      toast = { text: 'Failed to save image fit', tone: 'err' };
    }
  }

  function setBrightness(val: number) {
    brightness = val;
    void saveReaderSettings({ key: 'defaults', defaultDirection: direction, imageFit, brightness: val, contrast, zoom });
  }

  function setContrast(val: number) {
    contrast = val;
    void saveReaderSettings({ key: 'defaults', defaultDirection: direction, imageFit, brightness, contrast: val, zoom });
  }

  function setZoom(val: number) {
    zoom = val;
    void saveReaderSettings({ key: 'defaults', defaultDirection: direction, imageFit, brightness, contrast, zoom: val });
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

  function jumpToPagePrompt() {
    if (totalPages === 0) return;
    const input = prompt(`Go to page (1-${totalPages}):`);
    if (!input) return;
    const n = parseInt(input, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) jumpTo(n - 1, 'smooth');
  }

  function dismissResumeNotice() {
    showResumeNotice = false;
  }

  function scrollToPage(index: number, behavior: JumpBehavior) {
    pageNodes.get(index)?.scrollIntoView({ behavior, block: 'start' });
  }

  async function retryFailed() {
    if (retrying || failedPages.length === 0 || !source) return;
    retrying = true;
    try {
      const result = await retryFailedPages(pageUrls, failedPages, chapterUrl, undefined, source.id);
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

  async function tryFallbackForSource(currentSourceId: string, currentChapterUrl: string) {
    if (!t || fallbackAttempted) return null;
    fallbackAttempted = true;
    loadPhase = 'fallback';
    try {
      return await findFallbackChapter(t, currentSourceId, currentChapterUrl);
    } finally {
      loadPhase = '';
    }
  }

  async function retryChapter() {
    if (!sourceId || !chapterUrl) return;
    err = '';
    failureCategory = '';
    loading = true;
    loadPhase = 'resolving';
    await loadChapter(mediaId, sourceId, chapterUrl);
  }

  async function tryFallback() {
    if (!t || !source) return;
    const fallback = await tryFallbackForSource(source.id, chapterUrl);
    if (fallback) {
      go(`/reader/${mediaId}/${fallback.source.id}/${encodeURIComponent(fallback.seriesUrl)}/${encodeURIComponent(fallback.chapter.url)}`);
    } else {
      err = 'No other enabled source could load this chapter.';
      failureCategory = '';
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

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      isFullscreen = true;
    } else {
      document.exitFullscreen().catch(() => {});
      isFullscreen = false;
    }
  }

  // Track fullscreen changes from browser UI (Esc key, etc.)
  $effect(() => {
    function onChange() {
      isFullscreen = !!document.fullscreenElement;
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  });

  // Auto-dismiss resume notice after a few seconds
  $effect(() => {
    if (!showResumeNotice) return;
    const t = setTimeout(() => { showResumeNotice = false; }, 6000);
    return () => clearTimeout(t);
  });

</script>

<svelte:window onkeydown={onKeyDown} />

<div class="reader-shell" class:chrome-open={showChrome} class:chrome-auto={chromeAutoShow} style="--reader-brightness: {brightness}%; --reader-contrast: {contrast}%; --reader-zoom: {zoom}" onmousemove={onReaderMouseMove} onmouseleave={onReaderMouseLeave}>
  <button class="chrome-toggle" onclick={() => (showChrome = !showChrome)} aria-label="Toggle reader controls">
    {showChrome ? '✕' : '☰'}
  </button>
  {#if toast}
    <div class="reader-toast">
      <Toast text={toast.text} tone={toast.tone} onDismiss={() => (toast = null)} />
    </div>
  {/if}
  <ReaderChrome
    {name}
    {chapterLabel}
    {sourceName}
    {chapterUrl}
    {currentSourceUrl}
    currentGroup={currentChapterGroup}
    {sameNumberAlts}
    {direction}
    {imageFit}
    bind:spreadMode
    {pagedMode}
    {pageLabel}
    {progressPercent}
    {pageLoadLabel}
    {pageLoadPercent}
    {loadCount}
    {totalPages}
    {prevChapter}
    {nextChapter}
    bind:showShortcuts
    onBack={backToMedia}
    onSwitchGroup={switchToGroupChapter}
    onSetDirection={setDirection}
    onSaveDirection={saveDirectionForTitle}
    onSetImageFit={setImageFit}
    onSaveImageFit={saveImageFitForTitle}
    onJumpToPage={jumpToPagePrompt}
    onGoToChapter={goToChapter}
    onToggleFullscreen={toggleFullscreen}
    {isFullscreen}
    {brightness}
    {contrast}
    {zoom}
    onSetBrightness={setBrightness}
    onSetContrast={setContrast}
    onSetZoom={setZoom}
  />

  {#if showResumeNotice}
    <ReaderResumeNotice
      {resumedFromPage}
      onDismiss={dismissResumeNotice}
      onGoThere={() => { dismissResumeNotice(); jumpTo(resumedFromPage, 'auto'); }}
    />
  {/if}

  {#if err}
    <ReaderErrorState
      {err}
      {loading}
      {chapterUrl}
      onRetry={retryChapter}
      onFallback={tryFallback}
      onBack={backToMedia}
    />
  {:else if loading}
    <ReaderLoadingState
      {loadingTitle}
      {loadingSub}
      {totalPages}
      {pageLoadPercent}
      {pageLoadLabel}
    />
  {:else}
    {#if note}
      <ReaderWarningBox
        {note}
        {failureCategory}
        {failedPages}
        {retrying}
        {sameNumberAlts}
        onRetryFailed={retryFailed}
      />
    {/if}

    {#if pagedMode}
      {#if spreadMode === 'double' && spreadPairs.length > 0}
        <ReaderSpreadView
          {spreadPairs}
          {currentSpread}
          {pageBlobs}
          {canSpreadPrev}
          {canSpreadNext}
          onSpreadPrev={() => { const s = currentSpread - 1; if (s >= 0) { const p = spreadPairs[s]; page = p.right >= 0 ? p.right : p.left; } }}
          onSpreadNext={() => { const s = currentSpread + 1; if (s < spreadPairs.length) { const p = spreadPairs[s]; page = p.right >= 0 ? p.right : p.left; } }}
          onPageClick={onPageClick}
        />
      {:else}
        <ReaderPagedView
          {currentBlob}
          {page}
          {direction}
          {imageFit}
          {canPrev}
          {canNext}
          onStep={step}
          {onPageClick}
        />
      {/if}
    {:else}
      <ReaderVerticalView
        {pageUrls}
        {pageBlobs}
        {imageFit}
        {pageAnchor}
      />

      {#if direction === 'vertical' && (prevChapter || nextChapter)}
        <ReaderChapterEndNav
          {prevChapter}
          {nextChapter}
          onGoToChapter={goToChapter}
          onBackToMedia={backToMedia}
        />
      {/if}
    {/if}

    <!-- Chapter-end nav for paged mode -->
    {#if pagedMode && (prevChapter || nextChapter)}
      <ReaderChapterEndNav
        {prevChapter}
        {nextChapter}
        onGoToChapter={goToChapter}
        onBackToMedia={backToMedia}
      />
    {/if}
  {/if}
</div>

<style>
  .reader-shell { display: flex; flex-direction: column; gap: 14px; position: relative; }
  .chrome-toggle {
    position: fixed; top: 10px; right: 10px; z-index: 55;
    width: 36px; height: 36px; border-radius: var(--radius-sm);
    border: 1px solid var(--border); background: color-mix(in srgb, var(--bg) 80%, transparent);
    color: var(--text); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px);
  }
  .reader-toast {
    position: fixed; top: 52px; right: 10px; z-index: 55;
    max-width: min(320px, calc(100vw - 20px));
  }

  .reader-shell.chrome-open .chrome-toggle {
    background: var(--surface);
  }
  @media (max-width: 560px) {
    .chrome-toggle { width: 40px; height: 40px; }
  }
</style>
