<script lang="ts">
  let {
    cfUnlockUrl = $bindable(''),
    cfUnlockMsg,
    cfUnlockTone,
    cfUnlockBusy,
    cfCookies,
    onUnlock,
    onClearCookieRequest,
  }: {
    cfUnlockUrl: string;
    cfUnlockMsg: string;
    cfUnlockTone: 'info' | 'ok' | 'warn' | 'err';
    cfUnlockBusy: boolean;
    cfCookies: Record<string, string>;
    onUnlock: (event?: Event) => void | Promise<void>;
    onClearCookieRequest: (host: string) => void;
  } = $props();
</script>

<div class="card sec">
  <h2>Cloudflare Unlock (Desktop only)</h2>
  <p class="hint">Store desktop cookies for sources that require a browser challenge.</p>
  <form onsubmit={onUnlock} class="row">
    <input class="inp" type="url" placeholder="https://mangasite.example" bind:value={cfUnlockUrl} disabled={cfUnlockBusy} />
    <button class="btn" type="submit" disabled={cfUnlockBusy || !cfUnlockUrl.trim()}>{cfUnlockBusy ? 'Unlocking…' : 'Unlock'}</button>
  </form>
  {#if cfUnlockMsg}
    <div class:ok={cfUnlockTone === 'ok'} class:warn={cfUnlockTone === 'warn'} class:errbox={cfUnlockTone === 'err'} class="msg">{cfUnlockMsg}</div>
  {/if}
  {#if Object.keys(cfCookies).length > 0}
    <div class="slist">
      {#each Object.keys(cfCookies) as host (host)}
        <div class="srow">
          <div class="sinfo">
            <div class="sname">{host} <span class="state ready">Unlocked</span></div>
          </div>
          <div class="sactions">
            <button class="btn small" onclick={() => onClearCookieRequest(host)}>Clear</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
