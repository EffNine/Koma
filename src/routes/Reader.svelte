<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { media } from '../lib/catalog/anilist';
  import type { Title } from '../lib/catalog/types';
  import { titleName } from '../lib/catalog/types';
  import { deriveDirection, loadReaderState, saveReaderState, type ReaderDirection } from '../lib/reader/state';
  import { loadReaderSettings, saveReaderSettings, type ImageFit } from '../lib/reader/settings';
  import { loadChapterImages, revokeBlobUrls, retryFailedPages, categorizeFailure } from '../lib/reader/chapterLoader';
  import { match, go, route } from '../lib/router';
  import { clamp } from '../lib/util';
  import Toast from '../lib/components/Toast.svelte';
  import EmptyState from '../lib/components/EmptyState.svelte';
  import { getTitlePreference, savePreferredGroup, saveTitleReaderSettings } from '../lib/media/titlePreferences';
  import { getChapters, getPages } from '../lib/scraper/scraper';
  import { getSource, enabledSources, type Source } from '../lib/scraper/sources';
  import { recordReaderPage } from '../lib/tracker/local';
  import type { ScrapedChapter } from '../lib/scraper/engine';
  import { resolveChapters } from '../lib/media/chapterResolver';
import { recordHealth } from '../lib/scraper/sourceHealth';
import { findFallbackChapter, withRetryOnce, extractChapterNumber } from '../lib/media/fallback';
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
  let showShortcuts = $state(false);

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

      let urls: string[] = [];
      try {
        urls = await withRetryOnce(async () => {
          const resolved = await getPages(nextSource, nextChapterUrl);
          if (resolved.length === 0) throw new Error('No page images were extracted for this chapter.');
          return resolved;
        }, 800, () => { loadPhase = 'retrying'; }, signal);
        await recordHealth(nextSource.id, 'success', 'page-load');
      } catch (e) {
        await recordHealth(nextSource.id, 'failure', 'page-load', e);
        // Before giving up, try to fall back to another enabled source.
        const fallback = await tryFallbackForSource(nextSource.id, nextChapterUrl);
        if (fallback) {
          go(`/reader/${nextMediaId}/${fallback.source.id}/${encodeURIComponent(fallback.seriesUrl)}/${encodeURIComponent(fallback.chapter.url)}`);
          return;
        }
        throw e;
      }

      const [allChapters, saved, settings, titlePref] = await Promise.all([
        seriesUrl ? getChapters(nextSource, decodeURIComponent(seriesUrl)).catch(() => [] as ScrapedChapter[]) : Promise.resolve([] as ScrapedChapter[]),
        loadReaderState(nextMediaId, nextSourceId, nextChapterUrl),
        loadReaderSettings(),
        getTitlePreference(nextMediaId),
      ]);
      if (signal.aborted) return;

      chapters = allChapters;
      preferredChapterGroup = preferredGroupForChapter(allChapters, nextChapterUrl, titlePref?.preferredGroup);
      sameNumberAlts = sameNumberChapters(allChapters, nextChapterUrl);

      const currentGroup = allChapters.find((c) => c.url === nextChapterUrl)?.group;
      if (currentGroup) {
        void savePreferredGroup(nextMediaId, currentGroup);
      }

      pageUrls = urls;
      pageBlobs = Array(urls.length).fill('');
      loadPhase = 'loading';
      // Precedence: chapter state > per-title settings > global settings > country default
      direction = saved?.direction ?? titlePref?.readerDirection ?? settings.defaultDirection ?? deriveDirection(nextTitle.country);
      imageFit = saved?.imageFit ?? titlePref?.imageFit ?? settings.imageFit ?? 'width';
      const restoredPage = clamp(saved?.page ?? 0, 0, urls.length - 1);
      page = restoredPage;
      if (saved && restoredPage > 0) {
        showResumeNotice = true;
        resumedFromPage = restoredPage;
      }
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
    void saveReaderSettings({ key: 'defaults', defaultDirection: direction, imageFit: next });
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

  // Auto-dismiss resume notice after a few seconds
  $effect(() => {
    if (!showResumeNotice) return;
    const t = setTimeout(() => { showResumeNotice = false; }, 6000);
    return () => clearTimeout(t);
  });

  // Bind keyboard listener
  $effect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="reader-shell" class:chrome-open={showChrome}>
  <button class="chrome-toggle" onclick={() => (showChrome = !showChrome)} aria-label="Toggle reader controls">
    {showChrome ? '✕' : '☰'}
  </button>
  {#if toast}
    <div class="reader-toast">
      <Toast text={toast.text} tone={toast.tone} onDismiss={() => (toast = null)} />
    </div>
  {/if}
  {#if showShortcuts}
    <div class="shortcuts-panel card" role="dialog" aria-label="Keyboard shortcuts">
      <h3>Reader shortcuts</h3>
      <div class="shortcut-grid">
        <span><kbd>← / →</kbd></span> <span>Previous / next page</span>
        <span><kbd>↑ / ↓</kbd> or <kbd>Space</kbd></span> <span>Scroll vertical mode</span>
        <span><kbd>F</kbd></span> <span>Cycle image fit</span>
        <span><kbd>D</kbd></span> <span>Cycle reading direction</span>
        <span><kbd>G</kbd></span> <span>Jump to page</span>
        <span><kbd>H</kbd></span> <span>Toggle controls</span>
        <span><kbd>?</kbd></span> <span>Show this help</span>
      </div>
      <button class="btn tiny-btn" onclick={() => (showShortcuts = false)}>Close</button>
    </div>
  {/if}
  <div class="reader-chrome">
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

    <section class="toolbar">
      <div class="toolbar-block">
        <span class="toolbar-label">Dir</span>
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
        <span class="toolbar-label">Fit</span>
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
        <span class="toolbar-label">Pg</span>
        <strong class="toolbar-page">{pageLabel}</strong>
        <div class="progress-track" aria-label={`Reading progress ${progressPercent}%`}>
          <span style={`width: ${progressPercent}%`}></span>
        </div>
        <button class="btn tiny-btn" onclick={jumpToPagePrompt} title="Jump to page (G)">Jump</button>
      </div>

      <div class="toolbar-block">
        <span class="toolbar-label">Loaded</span>
        <span class="toolbar-page">{pageLoadLabel || '–'}</span>
        {#if loadCount > 0 && loadCount < totalPages}
          <div class="progress-track loading-track" aria-label={`Page loading progress ${pageLoadPercent}%`}>
            <span style={`width: ${pageLoadPercent}%`}></span>
          </div>
        {/if}
      </div>

      <div class="toolbar-block toolbar-shortcuts">
        <kbd>←→</kbd>
        <kbd>F</kbd>
        <kbd>D</kbd>
        <kbd>G</kbd>
        <button class="btn tiny-btn" onclick={() => (showShortcuts = !showShortcuts)} title="Keyboard shortcuts (?)">?</button>
      </div>

      {#if prevChapter || nextChapter}
        <div class="toolbar-block toolbar-chapter-nav">
          {#if prevChapter}
            <button class="btn tiny-btn" onclick={() => goToChapter(prevChapter)} title={prevChapter.title || `Ch. ${prevChapter.number ?? '?'}`}>
              ← Prev
            </button>
          {/if}
          <button class="btn tiny-btn" onclick={backToMedia} title="Back to Media">Media</button>
          {#if nextChapter}
            <button class="btn btn-primary tiny-btn" onclick={() => goToChapter(nextChapter)} title={nextChapter.title || `Ch. ${nextChapter.number ?? '?'}`}>
              Next →
            </button>
          {/if}
        </div>
      {/if}
    </section>
  </div>

  {#if showResumeNotice}
    <div class="card resume-notice" role="status">
      <span>Resumed from page {resumedFromPage + 1}</span>
      <button class="btn tiny-btn" onclick={() => { dismissResumeNotice(); jumpTo(resumedFromPage, 'auto'); }}>Go there</button>
      <button class="btn tiny-btn" onclick={dismissResumeNotice} aria-label="Dismiss">✕</button>
    </div>
  {/if}

  {#if err}
    <div class="card errbox">
      <EmptyState id="reader-failed" context={err} compact />
      <div class="errbox-actions">
        <button class="btn" onclick={retryChapter} disabled={loading}>Retry chapter</button>
        <button class="btn" onclick={tryFallback} disabled={loading}>Try another source</button>
        <button class="btn" onclick={backToMedia}>Back to Media</button>
        {#if chapterUrl}
          <a href={chapterUrl} target="_blank" rel="noopener">Open source chapter ↗</a>
        {/if}
      </div>
    </div>
  {:else if loading}
    <div class="card loading-card">
      <div class="loading-title">{loadingTitle}</div>
      <div class="loading-sub">{loadingSub}</div>
      {#if totalPages > 0}
        <div class="page-load-progress" aria-label={`Page loading progress ${pageLoadPercent}%`}>
          <div class="page-load-track">
            <span style={`width: ${pageLoadPercent}%`}></span>
          </div>
          <span class="page-load-count">{pageLoadLabel}</span>
        </div>
      {/if}
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
        <section class="paged spread">
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
        <section class="paged">
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
  .shortcuts-panel {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 90; padding: 18px; max-width: min(420px, calc(100vw - 24px));
    background: var(--panel); border: 1px solid var(--border);
  }
  .shortcuts-panel h3 { margin: 0 0 12px; font-size: 15px; }
  .shortcut-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: 13px; color: var(--muted); margin-bottom: 14px; }
  .shortcut-grid kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 20px; padding: 0 5px; border-radius: 3px; border: 1px solid var(--border); background: var(--surface); font-size: 11px; color: var(--text); }
  /* Chrome is always hidden by default, only visible on hover */
  .reader-chrome {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    padding-top: max(env(safe-area-inset-top, 0px), 8px);
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border-soft);
    opacity: 0;
    pointer-events: none;
    transition: opacity .2s ease;
  }
  /* Hover zone at top of reader-shell triggers chrome */
  .reader-shell::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 50px;
    z-index: 49;
  }
  .reader-shell:hover .reader-chrome,
  .reader-shell.chrome-open .reader-chrome {
    opacity: 1;
    pointer-events: auto;
  }
  .reader-shell.chrome-open .chrome-toggle {
    background: var(--surface);
  }
  .reader-top { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
  .reader-head { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .reader-head h1 { margin: 0; font-size: clamp(16px, 1.8vw, 22px); line-height: 1.1; }
  .reader-chapter-label { font-size: 12px; color: var(--accent); font-weight: 500; }
  .reader-meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
  .reader-meta a { color: var(--muted); }
  .reader-meta a:hover { color: var(--text); }
  .toolbar {
    display: flex; gap: 8px; justify-content: flex-start; align-items: center; flex-wrap: wrap;
    padding: 0;
    border: none;
    background: none;
    backdrop-filter: none;
  }
  .toolbar-block { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
  .toolbar-label { color: var(--muted-2); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .toolbar-page { font-size: 12px; font-weight: 650; }
  .segmented { display: inline-flex; padding: 2px; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); }
  .seg-btn { min-width: 48px; min-height: 24px; padding: 0 7px; border: 0; border-radius: calc(var(--radius-sm) - 2px); background: transparent; color: var(--muted); font-size: 11px; font-weight: 650; }
  .seg-btn.active { background: var(--accent); color: #17110a; }
  .progress-track { width: 80px; height: 4px; border-radius: 999px; background: var(--elevated); overflow: hidden; border: 1px solid var(--border-soft); }
  .progress-track span { display: block; height: 100%; background: linear-gradient(90deg, var(--ok), var(--accent)); border-radius: inherit; }
  .toolbar-shortcuts { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; font-size: 11px; color: var(--muted-2); }
  .toolbar-shortcuts kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 3px; border: 1px solid var(--border); background: var(--surface); font-family: inherit; font-size: 10px; color: var(--muted); }
  .toolbar-chapter-nav { margin-left: auto; }
  .loading-card, .warnbox, .errbox { padding: 18px; }
  .loading-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .loading-sub { color: var(--muted); font-size: 13px; line-height: 1.5; max-width: 620px; }
  .page-load-progress { display: flex; gap: 12px; align-items: center; margin-top: 14px; max-width: 420px; }
  .page-load-track { flex: 1; height: 4px; border-radius: 999px; background: var(--elevated); overflow: hidden; border: 1px solid var(--border-soft); }
  .page-load-track span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--ok)); border-radius: inherit; transition: width .2s ease; }
  .page-load-count { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .loading-track span { background: var(--accent); }
  .warnbox { color: color-mix(in srgb, #fff 92%, var(--warning, #d9a441) 8%); background: color-mix(in srgb, #d9a441 10%, transparent); border: 1px solid color-mix(in srgb, #d9a441 30%, transparent); }
  .warnbox-content { display: flex; flex-direction: column; gap: 6px; }
  .warnbox-detail { font-size: 13px; opacity: 0.8; }
  .warnbox-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  .warnbox-hint { font-size: 12px; opacity: 0.7; }
  .errbox { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); }
  .errbox-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .errbox-body { color: var(--text); font-size: 14px; line-height: 1.5; margin-bottom: 12px; max-width: 620px; }
  .errbox-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .errbox-actions a { color: var(--text); font-size: 13px; text-decoration: underline; }
  .resume-notice {
    position: fixed;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 14px;
    background: var(--panel);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    font-size: 13px;
    animation: resume-in .25s ease;
  }
  @keyframes resume-in { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
  .meta-sep { color: var(--muted-2); }
  .group-switch { font-size: 12px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px 6px; max-width: 200px; }
  .tiny-btn { min-height: 28px; padding: 0 8px; font-size: 11px; min-width: auto; }
  .paged { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: min(78vh, 980px); border-radius: var(--radius); }
  .paged.spread { grid-template-columns: auto minmax(0, 1fr) auto; }
  .spread-stage { min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center; }
  .spread-page { display: flex; gap: 4px; max-width: 100%; max-height: 76vh; align-items: center; justify-content: center; }
  .spread-half { max-width: 50%; max-height: 76vh; object-fit: contain; }
  .nav-btn { width: 62px; height: 48px; border-radius: var(--radius-sm); border: 1px solid var(--border-soft); background: color-mix(in srgb, var(--surface) 74%, transparent); color: var(--muted); font-size: 12px; font-weight: 700; }
  .nav-btn:hover:not([disabled]) { color: var(--text); background: var(--elevated); border-color: var(--border); }
  .nav-btn[disabled] { opacity: .45; cursor: not-allowed; }
  .page-stage { min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center; }
  .page-image { max-width: 100%; max-height: 76vh; object-fit: contain; border-radius: calc(var(--radius-sm) - 2px); box-shadow: 0 20px 60px rgba(0, 0, 0, .36); }
  .page-image.rtl { direction: rtl; }
  .page-image.ltr { direction: ltr; }
  .page-placeholder { min-height: min(78vh, 920px); aspect-ratio: 3 / 4; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%; background: var(--elevated); }
  .vertical-strip { display: flex; flex-direction: column; gap: 0; align-items: center; overflow-anchor: none; }
  .strip-page { width: min(100%, 980px); padding: 0; background: none; border: none; border-radius: 0; contain: layout paint; content-visibility: auto; contain-intrinsic-size: 900px 1300px; }
  .strip-image { width: 100%; display: block; user-select: none; -webkit-user-drag: none; transform: translateZ(0); backface-visibility: hidden; }
  .strip-screen { max-width: 100%; max-height: 100vh; object-fit: contain; margin: 0 auto; }
  .strip-original { width: auto; max-width: 100%; margin: 0 auto; }
  .chapter-end-nav { text-align: center; padding: 24px 18px; }
  .chapter-end-title { margin: 0 0 14px; font-size: 15px; font-weight: 600; color: var(--muted); }
  .chapter-end-buttons { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .floating-nav-btn { padding: 8px 14px; font-size: 13px; white-space: nowrap; }
  @media (max-width: 900px) {
    .toolbar { top: 96px; }
    .paged { grid-template-columns: 1fr; min-height: auto; }
    .nav-btn { width: 100%; min-height: 44px; }
    .page-placeholder { min-height: 320px; }
    .toolbar-chapter-nav { width: 100%; margin-left: 0; }
    .toolbar-chapter-nav .btn { flex: 1; min-height: 36px; }
  }
  @media (max-width: 560px) {
    .reader-head h1 { font-size: 15px; }
    .reader-meta { font-size: 11px; gap: 6px; }
    .toolbar-shortcuts kbd { display: none; }
    .toolbar-shortcuts .btn { margin-left: auto; }
    .seg-btn { min-width: 40px; padding: 0 6px; }
    .chrome-toggle { width: 40px; height: 40px; }
  }
</style>
