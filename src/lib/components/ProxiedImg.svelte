<script lang="ts">
  import { untrack } from 'svelte';
  import { fetchRaw } from '../net';
  import { detectImageMime } from '../util/imageBytes';

  let { src, alt = '', referer = '', class: className = '', loading: imgLoading = 'lazy' as 'lazy' | 'eager' }: {
    src: string;
    alt?: string;
    referer?: string;
    class?: string;
    loading?: 'lazy' | 'eager';
  } = $props();

  let blobUrl = $state('');
  let failed = $state(false);
  let loadedSrc = '';

  function markFailed() {
    untrack(() => {
      failed = true;
      blobUrl = '';
    });
  }

  $effect(() => {
    const url = src;
    if (!url || url === loadedSrc) return;
    loadedSrc = url;
    blobUrl = '';
    failed = false;

    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      blobUrl = url;
      return;
    }

    // ComicK CDN blocks cover requests unless the referer is a ComicK origin.
    const defaultReferer = url.includes('comick') ? 'https://comickz.co.uk' : new URL(url).origin + '/';

    untrack(() => {
      fetchRaw(url, { referer: referer || defaultReferer })
        .then((resp) => {
          if (!resp.status || resp.status >= 400 || !resp.body_b64) {
            markFailed();
            return;
          }
          const bin = atob(resp.body_b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const type = detectImageMime(bytes);
          if (!type) {
            markFailed();
            return;
          }
          const blob = new Blob(
            [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as BlobPart],
            { type },
          );
          untrack(() => { blobUrl = URL.createObjectURL(blob); });
        })
        .catch(() => { markFailed(); });
    });
  });
</script>

{#if blobUrl}
  <img
    src={blobUrl}
    alt={alt}
    class={className}
    loading={imgLoading}
    style="width:100%;aspect-ratio:3/4;display:block;object-fit:cover"
    onerror={markFailed}
  />
{:else if failed}
  <div class="proxied-fallback {className}">{alt?.[0]?.toUpperCase() ?? '?'}</div>
{:else}
  <div class="proxied-skel {className}"></div>
{/if}

<style>
  .proxied-fallback {
    aspect-ratio: 3/4;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--elevated);
    color: var(--muted-2);
    font-size: 24px;
    font-weight: 700;
  }
  .proxied-skel {
    aspect-ratio: 3/4;
    width: 100%;
    background: var(--surface);
  }
</style>
