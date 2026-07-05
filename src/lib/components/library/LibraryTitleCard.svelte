<script lang="ts">
  import { go } from '../../router';
  import type { TrackedTitle, ProgressEntry } from '../../tracker/local';
  import { progressLabel } from '../../ui/formatting';

  let {
    title,
    progress,
    listLabel,
    newChapters = 0,
  }: {
    title: TrackedTitle;
    progress: ProgressEntry | undefined;
    listLabel: string;
    newChapters?: number;
  } = $props();
</script>

<article class="card title-row">
  {#if title.cover}
    <img class="cover" src={title.cover} alt={title.name} />
  {/if}
  <div class="row-main">
    <div class="row-head">
      <h2>{title.name}</h2>
      {#if newChapters > 0}
        <span class="new-badge">+{newChapters}</span>
      {/if}
      <span class="list-badge">{listLabel}</span>
    </div>
    <div class="meta">
      {#if title.country}<span>{title.country}</span>{/if}
      {#if title.status}<span>{title.status}</span>{/if}
      {#if title.totalChapters}<span>{title.totalChapters} ch.</span>{/if}
      <span>{progressLabel(progress)}</span>
    </div>
  </div>
  <button class="btn" onclick={() => go(`/media/${title.mediaId}`)}>Open</button>
  {#if progress?.chapterNumber}
    <button class="btn btn-primary" onclick={() => go(`/media/${title.mediaId}`)}>Continue</button>
  {/if}
</article>

<style>
  .title-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 10px 12px; }
  .cover { width: 48px; aspect-ratio: 3 / 4; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border); background: var(--elevated); flex-shrink: 0; }
  .row-main { min-width: 0; flex: 1; }
  .row-main h2 { margin: 0; font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .new-badge { display: inline-flex; align-items: center; min-height: 18px; padding: 0 6px; border-radius: 999px; background: var(--ok-soft); color: color-mix(in srgb, var(--ok) 82%, white); border: 1px solid color-mix(in srgb, var(--ok) 28%, transparent); font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .list-badge { display: inline-flex; align-items: center; min-height: 18px; padding: 0 6px; border-radius: 999px; background: var(--accent-soft); color: color-mix(in srgb, var(--accent) 82%, white); border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; color: var(--muted); font-size: 13px; }
  .meta span { display: inline-flex; align-items: center; min-height: 20px; }
  @media (max-width: 720px) {
    .title-row { grid-template-columns: 42px minmax(0, 1fr) auto; }
    .title-row .btn:not(.small-btn) { min-height: 32px; padding: 0 10px; font-size: 12px; }
    .cover { width: 42px; }
    .row-main h2 { white-space: normal; }
  }
</style>
