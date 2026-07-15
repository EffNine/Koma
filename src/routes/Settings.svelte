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
    listTrackers,
    setTrackerEnabled,
    type TrackerId,
  } from '../lib/tracker/sync';
  import type { TrackerAdapter, TrackerConnection } from '../lib/tracker/adapters';
  import { loadConnection } from '../lib/tracker/adapters';
  import { loadReaderSettings, saveReaderSettings, type ReaderSettings } from '../lib/reader/settings';
  import type { ReaderDirection } from '../lib/reader/state';
  import { clearCatalogCache, db } from '../lib/db';
  import { unlockCloudflare, listCfCookies, clearCfCookies, onCfUnlockProgress } from '../lib/net';
  import { exportBackup, importBackup, downloadBackup } from '../lib/backup/export';
  import { getTotalCacheSize, clearAllChapterCache } from '../lib/reader/chapterCache';
  import ConfirmDialog from '../lib/components/ConfirmDialog.svelte';
  import BackupSettings from '../lib/components/settings/BackupSettings.svelte';
  import CacheSettings from '../lib/components/settings/CacheSettings.svelte';
  import CloudflareSettings from '../lib/components/settings/CloudflareSettings.svelte';
  import ReaderDefaultsSettings from '../lib/components/settings/ReaderDefaultsSettings.svelte';
  import SourcesSettings from '../lib/components/settings/SourcesSettings.svelte';
  import TrackerSettings from '../lib/components/settings/TrackerSettings.svelte';
  import '../lib/components/settings/settings.css';
  import type { ConfirmActionId } from '../lib/ui/confirm';

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

  let readerSettings = $state<ReaderSettings>({ key: 'defaults', defaultDirection: 'rtl', imageFit: 'width' });
  let cacheSize = $state<number | null>(null);
  let cacheMsg = $state('');
  let chapterCacheSize = $state<number | null>(null);
  let chapterCacheMsg = $state('');
  let backupMsg = $state('');
  let backupMsgTone = $state<'info' | 'ok' | 'warn' | 'err'>('info');
  let importBusy = $state(false);

  // Cloudflare unlock state
  let confirm = $state<{ action: ConfirmActionId; subject?: string; onConfirm: () => void } | null>(null);
  let cfUnlockUrl = $state('');
  let cfUnlockMsg = $state('');
  let cfUnlockTone = $state<'info' | 'ok' | 'warn' | 'err'>('info');
  let cfUnlockBusy = $state(false);
  let cfCookies = $state<Record<string, string>>({});

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
    const count = await db.catalog.count();
    cacheSize = count;
    const chSize = await getTotalCacheSize();
    chapterCacheSize = chSize;
  }
  onMount(() => {
    refresh();
    refreshTrackers();
    refreshReaderSettings();
    refreshCacheSize();
    refreshCfCookies();
    // Listen for unlock progress
    const unsub = onCfUnlockProgress((p) => {
      cfUnlockMsg = p.message;
      if (p.status === 'done') { cfUnlockTone = 'ok'; cfUnlockBusy = false; refreshCfCookies(); }
      else if (p.status === 'error') { cfUnlockTone = 'err'; cfUnlockBusy = false; }
      else if (p.status === 'captcha') { cfUnlockTone = 'warn'; }
      else { cfUnlockTone = 'info'; }
    });
    return unsub;
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

  async function onClearChapterCache() {
    await clearAllChapterCache();
    chapterCacheMsg = 'Chapter cache cleared.';
    await refreshCacheSize();
  }

  // Cloudflare unlock
  function refreshCfCookies() {
    const hosts = listCfCookies();
    const map: Record<string, string> = {};
    for (const h of hosts) map[h] = 'stored';
    cfCookies = map;
  }

  function setCfMsg(tone: typeof cfUnlockTone, text: string) {
    cfUnlockTone = tone;
    cfUnlockMsg = text;
  }

  async function onUnlockCloudflare(e?: Event) {
    e?.preventDefault();
    const u = cfUnlockUrl.trim();
    if (!u) return;
    cfUnlockBusy = true;
    setCfMsg('info', `Unlocking ${u}...`);
    try {
      const result = await unlockCloudflare(u);
      if (result.success) {
        setCfMsg('ok', result.message);
        refreshCfCookies();
      } else {
        setCfMsg('err', result.message);
      }
    } catch (e) {
      setCfMsg('err', 'Failed: ' + String(e));
    } finally {
      cfUnlockBusy = false;
    }
  }

  async function onClearCfCookies(host: string) {
    clearCfCookies(host);
    refreshCfCookies();
    setCfMsg('ok', `Cleared cookies for ${host}.`);
  }

  async function onExport() {
    try {
      const data = await exportBackup();
      downloadBackup(data);
      setBackupMsg('ok', `Exported ${data.sources.length} sources, ${data.trackedTitles.length} tracked titles, ${data.chapterReads.length} chapter reads, and more.`);
    } catch (e) {
      setBackupMsg('err', 'Export failed: ' + String(e));
    }
  }

  async function onImportBackup(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importBusy = true;
    setBackupMsg('info', 'Importing…');
    try {
      const text = await file.text();
      const data = JSON.parse(text) as import('../lib/backup/export').BackupData;
      const result = await importBackup(data);
      setBackupMsg('ok', `Imported ${result.imported.join(', ') || 'nothing new'}. ${result.skipped.length} entries skipped (newer local data exists).`);
      await refresh();
      await refreshCacheSize();
    } catch (e) {
      setBackupMsg('err', 'Import failed: ' + String(e));
    } finally {
      importBusy = false;
      input.value = '';
    }
  }

  function setBackupMsg(tone: typeof backupMsgTone, text: string) {
    backupMsgTone = tone;
    backupMsg = text;
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

  function requestRemoveSource(source: Source) {
    confirm = {
      action: 'removeSource',
      subject: source.name,
      onConfirm: async () => {
        await removeSource(source.id);
        refresh();
        confirm = null;
      },
    };
  }

  function requestClearCfCookies(host: string) {
    confirm = {
      action: 'clearCfCookies',
      subject: host,
      onConfirm: () => {
        onClearCfCookies(host);
        confirm = null;
      },
    };
  }

  function requestDisconnectTracker(tracker: TrackerAdapter) {
    confirm = {
      action: 'disconnectTracker',
      subject: tracker.name,
      onConfirm: () => {
        onDisconnectTracker(tracker.id);
        confirm = null;
      },
    };
  }

  function requestClearCatalogCache() {
    confirm = {
      action: 'clearCache',
      onConfirm: () => {
        onClearCache();
        confirm = null;
      },
    };
  }

  function requestClearChapterCache() {
    confirm = {
      action: 'clearChapterCache',
      onConfirm: () => {
        onClearChapterCache();
        confirm = null;
      },
    };
  }

  const APP_VERSION = '0.1.0';

  function requestImportBackup(event: Event) {
    confirm = {
      action: 'importBackup',
      onConfirm: () => {
        onImportBackup(event);
        confirm = null;
      },
    };
  }
</script>

<h1 class="h1">Settings</h1>
<p class="sub">Manage sources, trackers, reader defaults, and cache.</p>

{#if confirm}
  <ConfirmDialog
    action={confirm.action}
    subject={confirm.subject}
    onConfirm={confirm.onConfirm}
    onCancel={() => (confirm = null)}
  />
{/if}

<SourcesSettings
  sources={sources}
  bind:urlInput
  msg={msg}
  msgTone={msgTone}
  busy={busy}
  checkingId={checkingId}
  lastSavedId={lastSavedId}
  lastSavedSource={lastSavedSource}
  readyCount={readyCount}
  statusLabel={statusLabel}
  savedAt={savedAt}
  onAdd={add}
  onImport={onImport}
  onToggle={toggle}
  onCheckAgain={checkAgain}
  onMoveUp={moveUp}
  onMoveDown={moveDown}
  onRemoveRequest={requestRemoveSource}
/>

<CloudflareSettings
  bind:cfUnlockUrl
  cfUnlockMsg={cfUnlockMsg}
  cfUnlockTone={cfUnlockTone}
  cfUnlockBusy={cfUnlockBusy}
  cfCookies={cfCookies}
  onUnlock={onUnlockCloudflare}
  onClearCookieRequest={requestClearCfCookies}
/>

<TrackerSettings
  trackers={trackers}
  trackerConns={trackerConns}
  trackerBusy={trackerBusy}
  trackerMsg={trackerMsg}
  trackerMsgTone={trackerMsgTone}
  bind:anilistClientId
  bind:anilistClientSecret
  bind:malClientId
  bind:muUsername
  bind:muPassword
  onToggleTracker={toggleTracker}
  onConnectTracker={onConnectTracker}
  onDisconnectRequest={requestDisconnectTracker}
/>

<ReaderDefaultsSettings
  readerSettings={readerSettings}
  directionLabel={directionLabel}
  onDirectionChange={onReaderDirectionChange}
/>

<CacheSettings
  cacheSize={cacheSize}
  chapterCacheSize={chapterCacheSize}
  cacheMsg={cacheMsg}
  chapterCacheMsg={chapterCacheMsg}
  onClearCatalog={requestClearCatalogCache}
  onClearChapter={requestClearChapterCache}
/>

<BackupSettings
  backupMsg={backupMsg}
  backupMsgTone={backupMsgTone}
  importBusy={importBusy}
  onExport={onExport}
  onImportRequest={requestImportBackup}
/>

<section class="section version-info">
  <p class="version-text">Koma v{APP_VERSION}</p>
</section>

<style>
  .version-info { margin-top: 32px; text-align: center; }
  .version-text { font-size: 12px; color: var(--muted-2); }
</style>
