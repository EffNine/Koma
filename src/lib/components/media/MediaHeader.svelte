<script lang="ts">
  import type { Title } from '../../catalog/types';
  import { titleName } from '../../catalog/types';
  import { stripHtml } from '../../util';

  let {
    title,
    followed,
    pinned,
    followBusy,
    progressChapter,
    hasChapters,
    siteUrl,
    onStartReading,
    onStartFromBeginning,
    onToggleFollow,
    onTogglePinned,
    onBack,
  }: {
    title: Title;
    followed: boolean;
    pinned: boolean;
    followBusy: boolean;
    progressChapter: string | undefined;
    hasChapters: boolean;
    siteUrl: string | undefined;
    onStartReading: () => void;
    onStartFromBeginning: () => void;
    onToggleFollow: () => void;
    onTogglePinned: () => void;
    onBack: () => void;
  } = $props();

  const countryLabel: Record<string, string> = { JP: 'Manga', KR: 'Manhwa', CN: 'Manhua' };
  let name = $derived(titleName(title));
  let desc = $derived(title.description ? stripHtml(title.description) : '');
</script>

<button class="btn back" onclick={onBack}>Back</button>

<div class="detail">
  <div class="cover-wrap">
    <img class="cover" src={title.cover} alt={name} />
    {#if followed}
      <span class="follow-badge">Following</span>
    {/if}
  </div>
  <div class="info">
    <h1 class="h1">{name}</h1>
    <div class="meta">
      {#if title.country}<span class="chip">{countryLabel[title.country] ?? title.country}</span>{/if}
      {#if title.status}<span>{title.status}</span>{/if}
      {#if title.year}<span>{title.year}</span>{/if}
      {#if title.chapters}<span>{title.chapters} ch.</span>{/if}
      {#if title.averageScore}<span>★ {(title.averageScore / 10).toFixed(1)}</span>{/if}
      {#if progressChapter}<span class="progress-chip">Read Ch. {progressChapter}</span>{/if}
    </div>
    {#if title.genres?.length}
      <div class="genres">{#each title.genres as g (g)}<span class="gchip">{g}</span>{/each}</div>
    {/if}
    <p class="desc">{desc}</p>
    <div class="actions">
      {#if hasChapters}
        {#if progressChapter}
          <button class="btn btn-primary" onclick={onStartReading}>Continue Reading</button>
          <button class="btn" onclick={onStartFromBeginning}>Start Over</button>
        {:else}
          <button class="btn btn-primary" onclick={onStartReading}>Start Reading</button>
        {/if}
      {/if}
      <button class="btn" onclick={onToggleFollow} disabled={followBusy}>
        {followBusy ? 'Saving…' : followed ? 'Following' : 'Follow'}
      </button>
      <button class="btn" onclick={onTogglePinned}>
        {pinned ? 'Pinned' : 'Pin to Home'}
      </button>
      {#if siteUrl}<a class="btn" href={siteUrl} target="_blank" rel="noopener">AniList ↗</a>{/if}
    </div>
  </div>
</div>

<style>
  .back { margin-bottom: 16px; }
  .detail {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 24px;
    align-items: flex-start;
    padding: clamp(16px, 2.4vw, 24px);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), var(--surface) 54%),
      var(--surface);
  }
  .cover-wrap { position: relative; width: 190px; flex-shrink: 0; }
  .cover { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); display: block; box-shadow: 0 16px 36px rgba(0, 0, 0, .34); }
  .follow-badge { position: absolute; left: 10px; bottom: 10px; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; color: color-mix(in srgb, var(--ok) 76%, white); background: color-mix(in srgb, var(--ok) 22%, #0b0c0d); border: 1px solid color-mix(in srgb, var(--ok) 38%, transparent); }
  .info { flex: 1; min-width: 0; }
  .info .h1 { font-size: clamp(28px, 4vw, 44px); line-height: 1.04; margin-bottom: 8px; }
  .meta { display: flex; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 13px; margin: 6px 0 14px; align-items: center; }
  .chip, .progress-chip { background: var(--accent); color: #17110a; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 720; }
  .progress-chip { background: var(--ok-soft); color: color-mix(in srgb, var(--ok) 76%, white); border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent); }
  .genres { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .gchip { background: color-mix(in srgb, var(--elevated) 80%, transparent); border: 1px solid var(--border-soft); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--muted); }
  .desc { white-space: pre-wrap; color: var(--text); font-size: 14.5px; line-height: 1.65; max-width: 720px; }
  .actions { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
  .btn[disabled] { opacity: .5; cursor: not-allowed; }
  @media (max-width: 800px) {
    .detail { grid-template-columns: 112px minmax(0, 1fr); gap: 14px; padding: 14px; }
    .cover-wrap { width: 112px; grid-row: 1 / 4; }
    .info { display: contents; }
    .info .h1 { font-size: 24px; }
    .info .h1, .meta, .genres { grid-column: 2; }
    .desc, .actions { grid-column: 1 / -1; }
  }
</style>
