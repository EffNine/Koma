<script lang="ts">
  import type { TrackerAdapter, TrackerConnection } from '../../tracker/adapters';
  import { ANILIST_REDIRECT_URI, type TrackerId } from '../../tracker/sync';

  let {
    trackers,
    trackerConns,
    trackerBusy,
    trackerMsg,
    trackerMsgTone,
    anilistClientId = $bindable(''),
    anilistClientSecret = $bindable(''),
    malClientId = $bindable(''),
    muUsername = $bindable(''),
    muPassword = $bindable(''),
    onToggleTracker,
    onConnectTracker,
    onDisconnectRequest,
  }: {
    trackers: TrackerAdapter[];
    trackerConns: Record<string, TrackerConnection | undefined>;
    trackerBusy: Record<string, boolean>;
    trackerMsg: string;
    trackerMsgTone: 'info' | 'ok' | 'warn' | 'err';
    anilistClientId: string;
    anilistClientSecret: string;
    malClientId: string;
    muUsername: string;
    muPassword: string;
    onToggleTracker: (id: TrackerId, event: Event) => void | Promise<void>;
    onConnectTracker: (id: TrackerId) => void | Promise<void>;
    onDisconnectRequest: (tracker: TrackerAdapter) => void;
  } = $props();
</script>

<div class="card sec">
  <h2>Trackers</h2>
  <p class="hint">Connect external progress trackers.</p>

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
          <input type="checkbox" checked={enabled} onchange={(e) => onToggleTracker(t.id, e)} />
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
            <button class="btn small" onclick={() => onDisconnectRequest(t)} disabled={busy}>{busy ? 'Working…' : 'Disconnect'}</button>
          {:else}
            <button class="btn small" onclick={() => onConnectTracker(t.id)} disabled={busy}>{busy ? 'Working…' : 'Connect'}</button>
          {/if}
        </div>
      </div>

      {#if t.id === 'anilist'}
        <div class="tracker-config">
          <input bind:value={anilistClientId} placeholder="AniList client id" class="inp" />
          <input bind:value={anilistClientSecret} type="password" placeholder="Client secret" class="inp" />
          <div class="config-note">AniList redirect URL: <code>{ANILIST_REDIRECT_URI}</code></div>
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
