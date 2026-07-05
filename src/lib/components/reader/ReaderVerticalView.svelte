<script lang="ts">
  import type { ImageFit } from '../../reader/settings';

  let {
    pageUrls,
    pageBlobs,
    imageFit,
    pageAnchor,
  }: {
    pageUrls: string[];
    pageBlobs: string[];
    imageFit: ImageFit;
    pageAnchor: (node: HTMLElement, index: number) => { update: (nextIndex: number) => void; destroy: () => void };
  } = $props();
</script>

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

<style>
  .vertical-strip { display: flex; flex-direction: column; gap: 0; align-items: center; overflow-anchor: none; }
  .strip-page { width: min(100%, 980px); padding: 0; background: none; border: none; border-radius: 0; contain: layout paint; content-visibility: auto; contain-intrinsic-size: 900px 1300px; }
  .strip-image { width: 100%; display: block; user-select: none; -webkit-user-drag: none; transform: translateZ(0) scale(calc(var(--reader-zoom, 100) / 100)); backface-visibility: hidden; filter: brightness(var(--reader-brightness, 100%)) contrast(var(--reader-contrast, 100%)); transition: opacity .25s ease, filter .2s ease; }
  .strip-screen { max-width: 100%; max-height: 100vh; object-fit: contain; margin: 0 auto; }
  .strip-original { width: auto; max-width: 100%; margin: 0 auto; }
  .page-placeholder { min-height: min(78vh, 920px); aspect-ratio: 3 / 4; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%; background: var(--elevated); animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
</style>
