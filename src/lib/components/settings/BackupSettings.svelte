<script lang="ts">
  let {
    backupMsg,
    backupMsgTone,
    importBusy,
    onExport,
    onImportRequest,
  }: {
    backupMsg: string;
    backupMsgTone: 'info' | 'ok' | 'warn' | 'err';
    importBusy: boolean;
    onExport: () => void | Promise<void>;
    onImportRequest: (event: Event) => void;
  } = $props();
</script>

<div class="card sec">
  <h2>Backup &amp; Restore</h2>
  <p class="hint">Export or restore sources, progress, and reader settings.</p>
  <div class="backup-controls">
    <button class="btn" onclick={onExport}>Export Data</button>
    <label class="btn" class:disabled={importBusy}>
      {importBusy ? 'Importing…' : 'Import Data'}
      <input type="file" accept="application/json" onchange={onImportRequest} hidden disabled={importBusy} />
    </label>
  </div>
  {#if backupMsg}
    <div class:ok={backupMsgTone === 'ok'} class:warn={backupMsgTone === 'warn'} class:errbox={backupMsgTone === 'err'} class="msg">{backupMsg}</div>
  {/if}
</div>
