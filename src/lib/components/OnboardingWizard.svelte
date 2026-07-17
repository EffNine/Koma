<script lang="ts">
  import { addByUrl, importSources } from '../scraper/sources';
  import { go } from '../router';
  import { completeOnboarding, markFirstSourceAdded } from '../onboarding';
  import { search } from '../catalog/anilist';
  import type { Title } from '../catalog/types';
  import { titleName } from '../catalog/types';

  let {
    show,
    onClose,
    onSourceAdded,
  }: {
    show: boolean;
    onClose: () => void;
    onSourceAdded?: () => void;
  } = $props();

  let step = $state(1);
  let urlInput = $state('');
  let busy = $state(false);
  let msg = $state('');
  let msgTone = $state<'info' | 'ok' | 'err' | 'warn'>('info');
  let searchQ = $state('');
  let searchResults = $state<Title[]>([]);
  let searchLoading = $state(false);

  $effect(() => {
    if (show) {
      step = 1;
      urlInput = '';
      msg = '';
      searchQ = '';
      searchResults = [];
    }
  });

  async function addSource(e?: Event) {
    e?.preventDefault();
    const u = urlInput.trim();
    if (!u) return;
    busy = true;
    msgTone = 'info';
    msg = 'Checking reading site…';
    try {
      const { source, check } = await addByUrl(u);
      markFirstSourceAdded();
      urlInput = '';
      if (check.status === 'ready') {
        msgTone = 'ok';
        msg = `${source.name} is ready. You can search for titles next.`;
      } else {
        msgTone = 'warn';
        msg = `${source.name} was saved. ${check.statusNote}`;
      }
      onSourceAdded?.();
      step = 3;
    } catch (e) {
      msgTone = 'err';
      msg = 'Failed: ' + String(e);
    } finally {
      busy = false;
    }
  }

  async function onImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    try {
      const imported = await importSources(await file.text());
      markFirstSourceAdded();
      msgTone = 'ok';
      msg = `Imported ${imported.length} reading site${imported.length === 1 ? '' : 's'}.`;
      onSourceAdded?.();
      step = 3;
    } catch (e) {
      msgTone = 'err';
      msg = 'Import failed: ' + String(e);
    } finally {
      busy = false;
      input.value = '';
    }
  }

  async function doSearch(e?: Event) {
    e?.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    searchLoading = true;
    try {
      searchResults = await search(q, 1, 12);
    } catch {
      searchResults = [];
    } finally {
      searchLoading = false;
    }
  }

  function finish(title?: Title) {
    completeOnboarding();
    onClose();
    if (title) go(`/media/${title.id}`);
    else go('/search');
  }

  function skip() {
    completeOnboarding();
    onClose();
  }
</script>

{#if show}
  <div class="overlay" role="dialog" aria-label="Setup wizard">
    <div class="wizard card">
      <div class="steps">
        <span class:active={step === 1}>1. Welcome</span>
        <span class:active={step === 2}>2. Add site</span>
        <span class:active={step === 3}>3. Find a title</span>
      </div>

      {#if step === 1}
        <h2>Welcome to Koma</h2>
        <p>Koma is a manga reader and tracker. It does not host chapters — you add <strong>reading sites</strong> you trust, and Koma finds chapters from them.</p>
        <ul class="bullets">
          <li>Browse and search titles via AniList</li>
          <li>Read with RTL, LTR, or vertical scroll</li>
          <li>Track progress locally — no account required</li>
        </ul>
        <div class="actions">
          <button class="btn btn-primary" onclick={() => (step = 2)}>Get started</button>
          <button class="btn" onclick={skip}>Skip for now</button>
        </div>
      {:else if step === 2}
        <h2>Add a reading site</h2>
        <p>Paste the homepage URL of a manga site you use. Koma will detect its format automatically.</p>
        <form class="row" onsubmit={addSource}>
          <input bind:value={urlInput} placeholder="https://manga-example.site" class="inp" disabled={busy} />
          <button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Add & Check'}</button>
        </form>
        <label class="btn import-btn">
          Import sources.json
          <input type="file" accept="application/json" onchange={onImport} hidden disabled={busy} />
        </label>
        {#if msg}
          <div class="msg" class:ok={msgTone === 'ok'} class:warn={msgTone === 'warn'} class:errbox={msgTone === 'err'}>{msg}</div>
        {/if}
        <div class="actions">
          <button class="btn" onclick={() => (step = 1)}>Back</button>
          <button class="btn" onclick={() => (step = 3)} disabled={busy}>Continue without adding</button>
        </div>
      {:else}
        <h2>Find your first title</h2>
        <p>Search AniList to open a title and start reading.</p>
        <form class="row" onsubmit={doSearch}>
          <input bind:value={searchQ} placeholder="Search a manga title…" class="inp" />
          <button class="btn btn-primary" type="submit" disabled={searchLoading}>Search</button>
        </form>
        {#if searchLoading}
          <p class="hint">Searching…</p>
        {:else if searchResults.length > 0}
          <ul class="results">
            {#each searchResults as t (t.id)}
              <li>
                <button class="result-btn" onclick={() => finish(t)}>
                  {titleName(t)}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <div class="actions">
          <button class="btn" onclick={() => (step = 2)}>Back</button>
          <button class="btn btn-primary" onclick={() => finish()}>Go to Search</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 200;
    background: color-mix(in srgb, var(--bg) 55%, transparent);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }
  .wizard { max-width: 520px; width: 100%; padding: 24px; }
  .wizard h2 { margin: 0 0 10px; font-size: 20px; }
  .wizard p { margin: 0 0 14px; color: var(--muted); font-size: 14px; line-height: 1.5; }
  .steps { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .steps span { font-size: 12px; color: var(--muted-2); padding: 4px 8px; border-radius: 999px; border: 1px solid var(--border-soft); }
  .steps span.active { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); background: var(--accent-soft); }
  .bullets { margin: 0 0 18px; padding-left: 18px; color: var(--muted); font-size: 14px; }
  .bullets li { margin-bottom: 6px; }
  .row { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .row .inp { flex: 1; min-width: 200px; }
  .import-btn { display: inline-block; margin-bottom: 12px; cursor: pointer; }
  .actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
  .results { list-style: none; margin: 0; padding: 0; max-height: 200px; overflow-y: auto; }
  .result-btn {
    width: 100%; text-align: left; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--border-soft);
    background: none; color: var(--text); cursor: pointer; font-family: inherit; font-size: 14px;
  }
  .result-btn:hover { background: var(--elevated); color: var(--accent); }
  .hint { color: var(--muted); font-size: 13px; }
</style>
