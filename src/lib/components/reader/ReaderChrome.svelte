<script lang="ts">
  import type { ImageFit } from '../../reader/settings';
  import type { ReaderDirection } from '../../reader/state';
  import type { SpreadMode } from '../../reader/spread';
  import type { ScrapedChapter } from '../../scraper/engine';

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

  let {
    name,
    chapterLabel,
    sourceName,
    chapterUrl,
    currentSourceUrl,
    currentGroup,
    sameNumberAlts,
    direction,
    imageFit,
    spreadMode = $bindable<SpreadMode>('single'),
    pagedMode,
    pageLabel,
    progressPercent,
    pageLoadLabel,
    pageLoadPercent,
    loadCount,
    totalPages,
    prevChapter,
    nextChapter,
    showShortcuts = $bindable(false),
    onBack,
    onSwitchGroup,
    onSetDirection,
    onSaveDirection,
    onSetImageFit,
    onSaveImageFit,
    onJumpToPage,
    onGoToChapter,
    onToggleFullscreen,
    isFullscreen,
    brightness,
    contrast,
    zoom,
    onSetBrightness,
    onSetContrast,
    onSetZoom,
  }: {
    name: string;
    chapterLabel: string;
    sourceName: string;
    chapterUrl: string;
    currentSourceUrl: string;
    currentGroup: string;
    sameNumberAlts: ScrapedChapter[];
    direction: ReaderDirection;
    imageFit: ImageFit;
    spreadMode: SpreadMode;
    pagedMode: boolean;
    pageLabel: string;
    progressPercent: number;
    pageLoadLabel: string;
    pageLoadPercent: number;
    loadCount: number;
    totalPages: number;
    prevChapter?: ScrapedChapter | null;
    nextChapter?: ScrapedChapter | null;
    showShortcuts: boolean;
    onBack: () => void;
    onSwitchGroup: (chapter: ScrapedChapter) => void;
    onSetDirection: (direction: ReaderDirection) => void;
    onSaveDirection: (direction: ReaderDirection) => void | Promise<void>;
    onSetImageFit: (fit: ImageFit) => void;
    onSaveImageFit: (fit: ImageFit) => void | Promise<void>;
    onJumpToPage: () => void;
    onGoToChapter: (chapter: ScrapedChapter) => void;
    onToggleFullscreen: () => void;
    isFullscreen: boolean;
    brightness: number;
    contrast: number;
    zoom: number;
    onSetBrightness: (val: number) => void;
    onSetContrast: (val: number) => void;
    onSetZoom: (val: number) => void;
  } = $props();
</script>

{#if showShortcuts}
  <div class="shortcuts-panel card" role="dialog" aria-label="Keyboard shortcuts">
    <h3>Reader shortcuts</h3>
    <div class="shortcut-grid">
      <span><kbd>← / →</kbd></span> <span>Previous / next page</span>
      <span><kbd>↑ / ↓</kbd> or <kbd>Space</kbd></span> <span>Scroll vertical mode</span>
      <span><kbd>F</kbd></span> <span>Cycle image fit</span>
      <span><kbd>D</kbd></span> <span>Cycle reading direction</span>
      <span><kbd>G</kbd></span> <span>Jump to page</span>
      <span><kbd>+ / -</kbd></span> <span>Zoom in / out</span>
      <span><kbd>0</kbd></span> <span>Reset zoom</span>
      <span><kbd>H</kbd></span> <span>Toggle controls</span>
      <span><kbd>F11</kbd></span> <span>Toggle fullscreen</span>
      <span><kbd>?</kbd></span> <span>Show this help</span>
    </div>
    <button class="btn tiny-btn" onclick={() => (showShortcuts = false)}>Close</button>
  </div>
{/if}

<div class="reader-chrome">
  <div class="reader-top">
    <button class="btn" onclick={onBack}>← Back</button>
    <div class="reader-head">
      <h1>{name}</h1>
      {#if chapterLabel}
        <div class="reader-chapter-label">{chapterLabel}</div>
      {/if}
      <div class="reader-meta">
        <span>{sourceName}</span>
        {#if sameNumberAlts.length > 0}
          <span class="meta-sep">|</span>
          <select class="group-switch" onchange={(e) => {
            const alt = sameNumberAlts.find((chapter) => chapter.url === e.currentTarget.value);
            if (alt) onSwitchGroup(alt);
          }}>
            <option value={chapterUrl} selected={true}>
              {currentGroup} (current)
            </option>
            {#each sameNumberAlts as alt (alt.url)}
              <option value={alt.url}>
                {alt.group ?? sourceName}
              </option>
            {/each}
          </select>
        {:else if currentGroup}
          <span>{currentGroup}</span>
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
            onclick={() => onSetDirection(mode as ReaderDirection)}
          >
            {directionLabel[mode as ReaderDirection]}
          </button>
        {/each}
      </div>
      <button class="btn tiny-btn" onclick={() => onSaveDirection(direction)} title="Save direction for this title">Save</button>
    </div>

    <div class="toolbar-block">
      <span class="toolbar-label">Fit</span>
      <div class="segmented">
        {#each ['width', 'screen', 'original'] as fit (fit)}
          <button
            class:active={imageFit === fit}
            class="seg-btn"
            onclick={() => onSetImageFit(fit as ImageFit)}
          >
            {imageFitLabel[fit as ImageFit]}
          </button>
        {/each}
      </div>
      <button class="btn tiny-btn" onclick={() => onSaveImageFit(imageFit)} title="Save image fit for this title">Save</button>
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
      <button class="btn tiny-btn" onclick={onJumpToPage} title="Jump to page (G)">Jump</button>
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

    <div class="toolbar-block toolbar-filter">
      <span class="toolbar-label">Zoom</span>
      <input type="range" min="50" max="200" value={zoom} oninput={(e) => onSetZoom(Number(e.currentTarget.value))} class="filter-slider" aria-label="Zoom" />
      <span class="toolbar-label">{zoom}%</span>
    </div>
    <div class="toolbar-block toolbar-filter">
      <span class="toolbar-label">Bright</span>
      <input type="range" min="50" max="150" value={brightness} oninput={(e) => onSetBrightness(Number(e.currentTarget.value))} class="filter-slider" aria-label="Brightness" />
      <span class="toolbar-label">Contrast</span>
      <input type="range" min="50" max="150" value={contrast} oninput={(e) => onSetContrast(Number(e.currentTarget.value))} class="filter-slider" aria-label="Contrast" />
    </div>
    <div class="toolbar-block toolbar-shortcuts">
      <kbd>←→</kbd>
      <kbd>F</kbd>
      <kbd>D</kbd>
      <kbd>G</kbd>
      <button class="btn tiny-btn" onclick={onToggleFullscreen} title="Toggle fullscreen (F11)">
        {isFullscreen ? '⊟' : '⛶'}
      </button>
      <button class="btn tiny-btn" onclick={() => (showShortcuts = !showShortcuts)} title="Keyboard shortcuts (?)">?</button>
    </div>

    {#if prevChapter || nextChapter}
      <div class="toolbar-block toolbar-chapter-nav">
        {#if prevChapter}
          <button class="btn tiny-btn" onclick={() => onGoToChapter(prevChapter)} title={prevChapter.title || `Ch. ${prevChapter.number ?? '?'}`}>
            ← Prev
          </button>
        {/if}
        <button class="btn tiny-btn" onclick={onBack} title="Back to Media">Media</button>
        {#if nextChapter}
          <button class="btn btn-primary tiny-btn" onclick={() => onGoToChapter(nextChapter)} title={nextChapter.title || `Ch. ${nextChapter.number ?? '?'}`}>
            Next →
          </button>
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .shortcuts-panel {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 90; padding: 18px; max-width: min(420px, calc(100vw - 24px));
    background: var(--panel); border: 1px solid var(--border);
  }
  .shortcuts-panel h3 { margin: 0 0 12px; font-size: 15px; }
  .shortcut-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: 13px; color: var(--muted); margin-bottom: 14px; }
  .shortcut-grid kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 20px; padding: 0 5px; border-radius: 3px; border: 1px solid var(--border); background: var(--surface); font-size: 11px; color: var(--text); }
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
  :global(.reader-shell:hover) .reader-chrome,
  :global(.reader-shell.chrome-open) .reader-chrome {
    opacity: 1;
    pointer-events: auto;
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
  .loading-track span { background: var(--accent); }
  .toolbar-shortcuts { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; font-size: 11px; color: var(--muted-2); }
  .toolbar-shortcuts kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 3px; border: 1px solid var(--border); background: var(--surface); font-family: inherit; font-size: 10px; color: var(--muted); }
  .toolbar-filter { display: flex; gap: 4px; align-items: center; }
  .filter-slider { width: 60px; height: 4px; accent-color: var(--accent); cursor: pointer; }
  .toolbar-chapter-nav { margin-left: auto; }
  .meta-sep { color: var(--muted-2); }
  .group-switch { font-size: 12px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px 6px; max-width: 200px; }
  .tiny-btn { min-height: 28px; padding: 0 8px; font-size: 11px; min-width: auto; }

  @media (max-width: 900px) {
    .toolbar { top: 96px; }
    .toolbar-chapter-nav { width: 100%; margin-left: 0; }
    .toolbar-chapter-nav .btn { flex: 1; min-height: 36px; }
  }
  @media (max-width: 560px) {
    .reader-head h1 { font-size: 15px; }
    .reader-meta { font-size: 11px; gap: 6px; }
    .toolbar-shortcuts kbd { display: none; }
    .toolbar-shortcuts .btn { margin-left: auto; }
    .seg-btn { min-width: 40px; padding: 0 6px; }
  }
</style>
