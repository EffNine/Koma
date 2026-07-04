<script lang="ts">
  import type { Title } from '../catalog/types';
  import { titleName } from '../catalog/types';
  import { go } from '../router';
  import ProxiedImg from './ProxiedImg.svelte';

  let { title }: { title: Title } = $props();
  let name = $derived(titleName(title));
</script>

<button class="card tcard" onclick={() => go(`/media/${title.id}`)} title={name}>
  {#if title.cover}
    <ProxiedImg src={title.cover} alt="" />
  {:else}
    <div class="nocover">{name}</div>
  {/if}
  <div class="tname">{name}</div>
  <div class="tcard-footer">
    <span class="tcard-btn">Read</span>
  </div>
</button>

<style>
  .tcard { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s; }
  .tcard:hover { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); }
  .tcard :global(img) { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .nocover { aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; background: var(--elevated); }
  .tname { min-height: 52px; padding: 9px 10px 0; font-size: 13px; line-height: 1.35; color: var(--text); overflow: hidden; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tcard-footer { padding: 6px 10px 10px; }
  .tcard-btn { display: inline-block; font-size: 11px; font-weight: 650; color: var(--accent); padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; transition: background .15s; }
  .tcard-btn:hover { background: var(--accent-soft); }
</style>
