<script lang="ts">
  import type { Source } from '../../scraper/sources';

  let {
    sources,
    urlInput = $bindable(''),
    msg,
    msgTone,
    busy,
    checkingId,
    lastSavedId,
    lastSavedSource,
    readyCount,
    statusLabel,
    savedAt,
    onAdd,
    onImport,
    onToggle,
    onCheckAgain,
    onMoveUp,
    onMoveDown,
    onRemoveRequest,
  }: {
    sources: Source[];
    urlInput: string;
    msg: string;
    msgTone: 'info' | 'ok' | 'warn' | 'err';
    busy: boolean;
    checkingId: string;
    lastSavedId: string;
    lastSavedSource: Source | undefined;
    readyCount: number;
    statusLabel: Record<string, string>;
    savedAt: (ts?: number) => string;
    onAdd: (event?: Event) => void | Promise<void>;
    onImport: (event: Event) => void | Promise<void>;
    onToggle: (source: Source, event: Event) => void | Promise<void>;
    onCheckAgain: (id: string) => void | Promise<void>;
    onMoveUp: (source: Source) => void | Promise<void>;
    onMoveDown: (source: Source) => void | Promise<void>;
    onRemoveRequest: (source: Source) => void;
  } = $props();
</script>

<div class="card sec">
  <h2>Reading Sites</h2>
  <p class="hint">Add, check, and prioritize sites Koma can read chapters from.</p>
  <form class="row" onsubmit={onAdd}>
    <input bind:value={urlInput} placeholder="https://manga-example.site" class="inp" />
    <button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Add & Check'}</button>
    <label class="btn">Import JSON<input type="file" accept="application/json" onchange={onImport} hidden /></label>
  </form>
  {#if msg}<div class:ok={msgTone === 'ok'} class:warn={msgTone === 'warn'} class:errbox={msgTone === 'err'} class="msg">{msg}</div>{/if}
  {#if lastSavedSource}
    <div class="saved-banner">
      <div class="saved-copy">
        <strong>Saved to app</strong>
        <span>{lastSavedSource.name} is now in your saved reading sites below.</span>
      </div>
      <div class="saved-meta">
        <span>{savedAt(lastSavedSource.addedAt)}</span>
        {#if lastSavedSource.status}<span class={`state ${lastSavedSource.status}`}>{statusLabel[lastSavedSource.status]}</span>{/if}
      </div>
    </div>
  {/if}
  <div class="summary">{sources.length} saved reading site{sources.length === 1 ? '' : 's'} in this app • {readyCount} ready</div>

  <div class="slist">
    {#each sources as s, i (s.id)}
      <div class:saved={s.id === lastSavedId} class="srow">
        <div class="reorder">
          <button class="reorder-btn" onclick={() => onMoveUp(s)} disabled={i === 0} title="Move up">▲</button>
          <button class="reorder-btn" onclick={() => onMoveDown(s)} disabled={i >= sources.length - 1} title="Move down">▼</button>
        </div>
        <label class="switch">
          <input type="checkbox" checked={s.enabled} onchange={(e) => onToggle(s, e)} />
          <span class="slider"></span>
        </label>
        <div class="sinfo">
          <div class="sname">
            {s.name}
            {#if s.id === lastSavedId}<span class="saved-pill">Saved</span>{/if}
            {#if s.preset}<span class="tag">{s.preset}</span>{/if}
            {#if s.status}<span class={`state ${s.status}`}>{statusLabel[s.status]}</span>{/if}
          </div>
          <div class="smeta">{s.url}</div>
          <div class="smeta">{savedAt(s.addedAt)}</div>
          {#if s.statusNote}<div class="snote">{s.statusNote}</div>{/if}
        </div>
        <div class="sactions">
          <button class="btn small" onclick={() => onCheckAgain(s.id)} disabled={checkingId === s.id}>{checkingId === s.id ? 'Checking…' : 'Check Again'}</button>
          <button class="btn small" onclick={() => onRemoveRequest(s)}>Remove</button>
        </div>
      </div>
    {:else}
      <div class="empty">No reading sites saved yet. Add one above and the app will check it automatically.</div>
    {/each}
  </div>
</div>
