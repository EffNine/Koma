<script lang="ts">
  import { onMount } from 'svelte';
  import { listSources, addByUrl, removeSource, toggleSource, importSources, recheckSource, updateSourcePriority } from '../lib/scraper/sources';
  import type { Source } from '../lib/scraper/sources';
  import {
    configureAniList,
    configureMal,
    configureMangaUpdates,
    connectTracker,
    disconnectTracker,
    isTrackerEnabled,
    listTrackers,
    setTrackerEnabled,
    type TrackerId,
  } from '../lib/tracker/sync';
  import type { TrackerAdapter, TrackerConnection } from '../lib/tracker/adapters';
  import { loadConnection } from '../lib/tracker/adapters';
  import { loadReaderSettings, saveReaderSettings, type ReaderSettings } from '../lib/reader/settings';
  import type { ReaderDirection } from '../lib/reader/state';
  import { clearCatalogCache } from '../lib/db';

  let sources = $state<Source[]>([]);
  let urlInput = $state('');
  let msg = $state('');
  let msgTone = $state<'info' | 'ok' | 'warn' | 'err'>('info');
  let busy = $state(false);
  let checkingId = $state('');
  let lastSavedId = $state('');

  let trackers = $state<TrackerAdapter[]>([]);
  let trackerConns = $state<Record<string, TrackerConnection | undefined>>({});
  let trackerBusy = $state<Record<string, boolean>>({});
  let trackerMsg = $state('');
  let trackerMsgTone = $state<'info' | 'ok' | 'warn' | 'err'>('info');
  let anilistClientId = $state('');
  let anilistClientSecret = $state('');
  let malClientId = $state('');
  let muUsername = $state('');
  let muPassword = $state('');

  let readerSettings = $state<ReaderSettings>({ key: 'defaults', defaultDirection: 'rtl' });
  let cacheSize = $state<number | null>(null);
  let cacheMsg = $state('');

  const directionLabel: Record<ReaderDirection, string> = { rtl: 'RTL', ltr: 'LTR', vertical: 'Vertical' };

  const statusLabel: Record<string, string> = {
    ready: 'Ready',
    'needs-config': 'Needs config',
    unreachable: 'Unreachable',
  };

  async function refresh() {
    sources = await listSources();
  }
  async function refreshTrackers() {
    trackers = listTrackers();
    const conns: Record<string, TrackerConnection | undefined> = {};
    for (const t of trackers) {
      conns[t.id] = await loadConnection(t.id);
    }
    trackerConns = conns;
  }
  async function refreshReaderSettings() {
    readerSettings = await loadReaderSettings();
  }
  async function refreshCacheSize() {
    const { db } = await import('../lib/db');
    const count = await db.catalog.count();
    cacheSize = count;
  }
  onMount(() => {
    refresh();
    refreshTrackers();
    refreshReaderSettings();
    refreshCacheSize();
  });

  function setMsg(tone: typeof msgTone, text: string) {
    msgTone = tone;
    msg = text;
  }

  function setTrackerMsg(tone: typeof trackerMsgTone, text: string) {
    trackerMsgTone = tone;
    trackerMsg = text;
  }

  async function add(e?: Event) {
    e?.preventDefault();
    const u = urlInput.trim();
    if (!u) return;
    busy = true;
    setMsg('info', 'Checking site and saving source…');
    try {
      const { source, check } = await addByUrl(u);
      lastSavedId = source.id;
      urlInput = '';
      if (check.status === 'ready') setMsg('ok', `${source.name} saved to the app. ${check.statusNote}`);
      else if (check.status === 'needs-config') setMsg('warn', `${source.name} saved to the app. ${check.statusNote}`);
      else setMsg('warn', `${source.name} saved to the app. ${check.statusNote}`);
    } catch (e) {
      setMsg('err', 'Failed: ' + String(e));
    } finally {
      busy = false;
      await refresh();
    }
  }

  async function onImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const imported = await importSources(await file.text());
    lastSavedId = imported[0]?.id ?? '';
    setMsg('ok', `Imported and saved ${imported.length} source${imported.length === 1 ? '' : 's'} to the app.`);
    input.value = '';
    refresh();
  }

  async function toggle(s: Source, e: Event) {
    await toggleSource(s.id, (e.target as HTMLInputElement).checked);
    refresh();
  }

  async function checkAgain(id: string) {
    checkingId = id;
    setMsg('info', 'Checking source…');
    try {
      const updated = await recheckSource(id);
      if (!updated) return;
      lastSavedId = updated.id;
      if (updated.status === 'ready') setMsg('ok', `${updated.name} is working. ${updated.statusNote ?? ''}`.trim());
      else if (updated.status === 'needs-config') setMsg('warn', `${updated.name} was saved, but still needs config.`);
      else setMsg('warn', `${updated.name} could not be reached right now.`);
    } catch (e) {
      setMsg('err', 'Check failed: ' + String(e));
    } finally {
      checkingId = '';
      await refresh();
    }
  }

  async function moveUp(s: Source) {
    const idx = sources.indexOf(s);
    if (idx <= 0) return;
    const above = sources[idx - 1];
    await updateSourcePriority(s.id, above.priority ?? 0);
    await updateSourcePriority(above.id, s.priority ?? 0);
    await refresh();
  }

  async function moveDown(s: Source) {
    const idx = sources.indexOf(s);
    if (idx < 0 || idx >= sources.length - 1) return;
    const below = sources[idx + 1];
    await updateSourcePriority(s.id, below.priority ?? 0);
    await updateSourcePriority(below.id, s.priority ?? 0);
    await refresh();
  }

  async function toggleTracker(id: TrackerId, e: Event) {
    await setTrackerEnabled(id, (e.target as HTMLInputElement).checked);
    await refreshTrackers();
  }

  async function onConnectTracker(id: TrackerId) {
    if (id === 'anilist') configureAniList({ clientId: anilistClientId, clientSecret: anilistClientSecret });
    if (id === 'mal') configureMal({ clientId: malClientId });
    if (id === 'mangaupdates') configureMangaUpdates({ username: muUsername, password: muPassword });

    trackerBusy = { ...trackerBusy, [id]: true };
    setTrackerMsg('info', `Connecting ${id}…`);
    try {
      await connectTracker(id);
      setTrackerMsg('ok', `Connected to ${id}.`);
    } catch (e) {
      setTrackerMsg('err', `Failed to connect ${id}: ${String(e)}`);
    } finally {
      trackerBusy = { ...trackerBusy, [id]: false };
      await refreshTrackers();
    }
  }

  async function onDisconnectTracker(id: TrackerId) {
    trackerBusy = { ...trackerBusy, [id]: true };
    try {
      await disconnectTracker(id);
      setTrackerMsg('info', `Disconnected ${id}.`);
    } catch (e) {
      setTrackerMsg('err', `Disconnect failed: ${String(e)}`);
    } finally {
      trackerBusy = { ...trackerBusy, [id]: false };
      await refreshTrackers();
    }
  }

  async function onReaderDirectionChange(e: Event) {
    const dir = (e.target as HTMLSelectElement).value as ReaderDirection;
    readerSettings = { ...readerSettings, defaultDirection: dir };
    await saveReaderSettings(readerSettings);
  }

  async function onClearCache() {
    await clearCatalogCache();
    cacheMsg = 'Catalog cache cleared.';
    await refreshCacheSize();
  }

  let readyCount = $derived(sources.filter((s) => s.status === 'ready').length);
  let lastSavedSource = $derived(sources.find((s) => s.id === lastSavedId));

  function savedAt(ts?: number) {
    if (!ts) return 'Saved time unknown';
    return `Saved ${new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(ts)}`;
  }
</script>

<h1 class="h1">Settings</h1>
<p class="sub">Manage sources, trackers, reader defaults, and cache.</p>

<div class="card sec">
  <h2>Sources</h2>
  <p class="hint">Paste a site URL and Koma will auto-check it, detect a supported preset when possible, then save the source. Import still works for existing <code>sources.json</code> bundles. Drag the up/down arrows to reorder source priority.</p>
  <form class="row" onsubmit={add}>
    <input bind:value={urlInput} placeholder="https://manga-example.site" class="inp" />
    <button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Add & Check'}</button>
    <label class="btn">Import JSON<input type="file" accept="application/json" onchange={onImport} hidden /></label>
  </form>
  {#if msg}<div class:ok={msgTone === 'ok'} class:warn={msgTone === 'warn'} class:errbox={msgTone === 'err'} class="msg">{msg}</div>{/if}
  {#if lastSavedSource}
    <div class="saved-banner">
      <div class="saved-copy">
        <strong>Saved to app</strong>
        <span>{lastSavedSource.name} is now in your saved Sources list below.</span>
      </div>
      <div class="saved-meta">
        <span>{savedAt(lastSavedSource.addedAt)}</span>
        {#if lastSavedSource.status}<span class={`state ${lastSavedSource.status}`}>{statusLabel[lastSavedSource.status]}</span>{/if}
      </div>
    </div>
  {/if}
  <div class="summary">{sources.length} saved source{sources.length === 1 ? '' : 's'} in this app • {readyCount} ready</div>

  <div class="slist">
    {#each sources as s, i (s.id)}
      <div class:saved={s.id === lastSavedId} class="srow">
        <div class="reorder">
          <button class="reorder-btn" onclick={() => moveUp(s)} disabled={i === 0} title="Move up">▲</button>
          <button class="reorder-btn" onclick={() => moveDown(s)} disabled={i >= sources.length - 1} title="Move down">▼</button>
        </div>
        <label class="switch">
          <input type="checkbox" checked={s.enabled} onchange={(e) => toggle(s, e)} />
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
          <button class="btn small" onclick={() => checkAgain(s.id)} disabled={checkingId === s.id}>{checkingId === s.id ? 'Checking…' : 'Check Again'}</button>
          <button class="btn small" onclick={async () => { await removeSource(s.id); refresh(); }}>Remove</button>
        </div>
      </div>
    {:else}
      <div class="empty">No sources saved yet. Add one above and the app will check it automatically.</div>
    {/each}
  </div>
</div>

<div class="card sec">
  <h2>Trackers</h2>
  <p class="hint">Connect AniList, MyAnimeList, or MangaUpdates to sync reading progress. OAuth flows open in a desktop window; MangaUpdates uses your site credentials.</p>

  {#if trackerMsg}
    <div class:ok={trackerMsgTone === 'ok'} class:warn={trackerMsgTone === 'warn'} class:errbox={trackerMsgTone === 'err'} class="msg">{trackerMsg}</div>
  {/if}

  <div class="slist">
    {#each trackers as t (t.id)}
      {@const conn = trackerConns[t.id]}
      {@const connected = !!conn?.token}
      {@const enabled = conn?.enabled ?? false}
      {@const busy = trackerBusy[t.id] ?? false}
      <div class="srow">
        <label class="switch">
          <input type="checkbox" checked={enabled} onchange={(e) => toggleTracker(t.id, e)} />
          <span class="slider"></span>
        </label>
        <div class="sinfo">
          <div class="sname">
            {t.name}
            {#if connected}
              <span class="state ready">Connected{conn?.userName ? ` • ${conn.userName}` : ''}</span>
            {:else if enabled}
              <span class="state needs-config">Enabled, not connected</span>
            {:else}
              <span class="state unreachable">Disabled</span>
            {/if}
          </div>
          <div class="smeta">{t.id}</div>
        </div>
        <div class="sactions">
          {#if connected}
            <button class="btn small" onclick={() => onDisconnectTracker(t.id)} disabled={busy}>{busy ? 'Working…' : 'Disconnect'}</button>
          {:else}
            <button class="btn small" onclick={() => onConnectTracker(t.id)} disabled={busy}>{busy ? 'Working…' : 'Connect'}</button>
          {/if}
        </div>
      </div>

      {#if t.id === 'anilist'}
        <div class="tracker-config">
          <input bind:value={anilistClientId} placeholder="AniList client id" class="inp" />
          <input bind:value={anilistClientSecret} placeholder="Client secret (optional)" class="inp" />
        </div>
      {:else if t.id === 'mal'}
        <div class="tracker-config">
          <input bind:value={malClientId} placeholder="MAL client id" class="inp" />
        </div>
      {:else if t.id === 'mangaupdates'}
        <div class="tracker-config">
          <input bind:value={muUsername} placeholder="MangaUpdates username" class="inp" />
          <input bind:value={muPassword} type="password" placeholder="Password" class="inp" />
        </div>
      {/if}
    {:else}
      <div class="empty">No trackers available.</div>
    {/each}
  </div>
</div>

<div class="card sec">
  <h2>Reader</h2>
  <p class="hint">Default reading direction for new chapters. Override per-chapter in the reader toolbar.</p>
  <div class="reader-defaults">
    <label class="sel-wrap">
      <span>Default direction</span>
      <select class="sel" value={readerSettings.defaultDirection} onchange={onReaderDirectionChange}>
        {#each Object.entries(directionLabel) as [val, label] (val)}
          <option value={val}>{label}</option>
        {/each}
      </select>
    </label>
  </div>
</div>

<div class="card sec">
  <h2>Cache</h2>
  <p class="hint">Koma caches catalog data (search results, title details) to reduce API calls. Clear the cache to force a fresh fetch.</p>
  <div class="cache-controls">
    <div class="cache-info">
      {#if cacheSize !== null}
        <span>{cacheSize} cached entr{cacheSize === 1 ? 'y' : 'ies'}</span>
      {:else}
        <span>Loading cache info…</span>
      {/if}
    </div>
    <button class="btn" onclick={onClearCache}>Clear Catalog Cache</button>
  </div>
  {#if cacheMsg}
    <div class="msg ok">{cacheMsg}</div>
  {/if}
</div>

<style>
  .sec { margin-bottom: var(--gap); }
  .sec h2 { font-size: 16px; font-weight: 600; margin: 0 0 6px; }
  .hint { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .inp { flex: 1; min-width: 220px; padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px; }
  .msg { font-size: 13px; margin-top: 8px; border-radius: var(--radius-sm); padding: 10px 12px; background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent); }
  .ok { background: color-mix(in srgb, var(--accent) 12%, transparent); border-color: color-mix(in srgb, var(--accent) 26%, transparent); }
  .warn { background: color-mix(in srgb, #e8b04f 12%, transparent); border-color: color-mix(in srgb, #e8b04f 26%, transparent); }
  .errbox { background: color-mix(in srgb, var(--danger) 12%, transparent); border-color: color-mix(in srgb, var(--danger) 30%, transparent); color: var(--danger); }
  .saved-banner { margin-top: 10px; padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); background: color-mix(in srgb, var(--accent) 10%, transparent); display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
  .saved-copy { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  .saved-copy strong { font-size: 14px; }
  .saved-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
  .summary { color: var(--muted); font-size: 12px; margin-top: 10px; }
  .slist { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
  .srow { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); }
  .srow.saved { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent); }
  .sinfo { flex: 1; min-width: 0; }
  .sname { font-weight: 550; font-size: 14px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .smeta { color: var(--muted); font-size: 12px; word-break: break-all; }
  .snote { color: var(--text); font-size: 12px; margin-top: 4px; }
  .tag { background: var(--accent); color: #fff; border-radius: 4px; padding: 0 6px; font-size: 11px; margin-left: 4px; }
  .saved-pill { background: color-mix(in srgb, var(--accent) 18%, transparent); color: #b6d7ff; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); border-radius: 999px; padding: 1px 7px; font-size: 11px; }
  .state { border-radius: 999px; padding: 1px 7px; font-size: 11px; border: 1px solid transparent; }
  .state.ready { background: color-mix(in srgb, #37c178 14%, transparent); border-color: color-mix(in srgb, #37c178 34%, transparent); color: #92e4b5; }
  .state.needs-config { background: color-mix(in srgb, #e8b04f 14%, transparent); border-color: color-mix(in srgb, #e8b04f 32%, transparent); color: #f3cb7e; }
  .state.unreachable { background: color-mix(in srgb, var(--danger) 14%, transparent); border-color: color-mix(in srgb, var(--danger) 34%, transparent); color: #f6a0a0; }
  .small { padding: 5px 10px; font-size: 13px; }
  .empty { color: var(--muted); font-size: 13px; padding: 8px 0; }
  .sactions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  .reorder { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
  .reorder-btn { background: transparent; border: 1px solid var(--border); border-radius: 4px; color: var(--muted); font-size: 10px; width: 24px; height: 20px; padding: 0; cursor: pointer; line-height: 1; }
  .reorder-btn:hover:not([disabled]) { color: var(--text); border-color: var(--accent); }
  .reorder-btn[disabled] { opacity: .3; cursor: not-allowed; }

  .switch { position: relative; width: 38px; height: 22px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; inset: 0; background: var(--border); border-radius: 22px; transition: .2s; }
  .slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
  .switch input:checked + .slider { background: var(--accent); }
  .switch input:checked + .slider::before { transform: translateX(16px); }
  .tracker-config { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0 0 50px; }
  .tracker-config .inp { min-width: 180px; flex: 1; }

  .reader-defaults { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; }
  .sel-wrap { display: flex; flex-direction: column; gap: 6px; color: var(--muted); font-size: 13px; }
  .sel { min-width: 180px; padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px; }

  .cache-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .cache-info { color: var(--muted); font-size: 13px; }

  @media (max-width: 700px) {
    .srow { align-items: flex-start; }
    .sactions { width: 100%; }
    .tracker-config { margin-left: 0; }
  }
</style>
