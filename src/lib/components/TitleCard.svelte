<script lang="ts">
  import type { Title } from '../catalog/types';
  import { titleName } from '../catalog/types';
  import { go } from '../router';

  let { title }: { title: Title } = $props();
  let name = $derived(titleName(title));
</script>

<button class="card tcard" onclick={() => go(`/media/${title.id}`)}>
  {#if title.cover}
    <img src={title.cover} alt={name} loading="lazy" />
  {:else}
    <div class="nocover">{name}</div>
  {/if}
  <div class="tname">{name}</div>
</button>

<style>
  .tcard { padding: 0; overflow: hidden; text-align: left; display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, transform .15s; }
  .tcard:hover { border-color: var(--accent); transform: translateY(-2px); }
  .tcard img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; background: var(--surface); }
  .nocover { aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; padding: 10px; color: var(--muted); font-size: 13px; text-align: center; background: var(--elevated); }
  .tname { padding: 9px 10px 11px; font-size: 13px; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style>