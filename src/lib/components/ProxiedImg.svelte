<script lang="ts">
  import { untrack } from 'svelte';
  import { fetchBytes } from '../net';

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

  function guessType(url: string, bytes: Uint8Array): string {
    // ComicK sometimes serves WebP bytes with a .jpg extension, so trust magic bytes over extension.
    if (bytes.length > 3) {
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return 'image/png';
      if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
    }
    const ext = url.split('.').pop()?.toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return 'image/jpeg';
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
      fetchBytes(url, { referer: referer || defaultReferer })
        .then((bytes) => {
          const type = guessType(url, bytes);
          const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as BlobPart], { type });
          untrack(() => { blobUrl = URL.createObjectURL(blob); });
        })
        .catch(() => { untrack(() => { failed = true; }); });
    });
  });
</script>

{#if blobUrl}
  <img src={blobUrl} alt={alt} class={className} loading={imgLoading} style="width:100%;aspect-ratio:3/4;display:block;object-fit:cover" />
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
