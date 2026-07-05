<script lang="ts">
  import type { SourceFeedTitle } from '../sourceFeeds/types';
  import ProxiedImg from './ProxiedImg.svelte';
  import { openTitleCandidate } from '../media/openTitleCandidate';

  let {
    title,
    busy = false,
    onOpen,
  }: {
    title: SourceFeedTitle;
    busy?: boolean;
    onOpen?: (title: SourceFeedTitle) => void | Promise<void>;
  } = $props();

  async function openMedia() {
    if (busy) return;
    if (onOpen) {
      await onOpen(title);
      return;
    }
    await openTitleCandidate(title.title);
  }
</script>

<button class="card tcard-ck" class:busy onclick={openMedia} title={title.title} disabled={busy}>
  {#if title.cover}
    <ProxiedImg src={title.cover} alt="" />
  {:else}
    <div class="nocover">{title.title[0]?.toUpperCase() ?? '?'}</div>
  {/if}
  <div class="tname">{title.title}</div>
  <div class="tcard-footer">
    <span class="tcard-btn">
      {busy ? 'Opening...' : title.country ? title.country : 'Read'}
    </span>
  </div>
</button>

<style>
  .tcard-ck { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s; }
  .tcard-ck:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .tcard-ck.busy { opacity: .7; cursor: wait; }
  .tcard-ck :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .nocover { aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; background: var(--elevated); }
  .tname { min-height: 52px; padding: 9px 10px 0; font-size: 13px; line-height: 1.35; color: var(--text); overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tcard-footer { padding: 6px 10px 10px; }
  .tcard-btn { display: inline-block; font-size: 11px; font-weight: 650; color: var(--accent); padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; transition: background .15s; }
  .tcard-btn:hover { background: var(--accent-soft); }
</style>
