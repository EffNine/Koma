<script lang="ts">
  import type { ReaderSettings } from '../../reader/settings';
  import type { ReaderDirection } from '../../reader/state';

  let {
    readerSettings,
    directionLabel,
    onDirectionChange,
  }: {
    readerSettings: ReaderSettings;
    directionLabel: Record<ReaderDirection, string>;
    onDirectionChange: (event: Event) => void | Promise<void>;
  } = $props();
</script>

<div class="card sec">
  <h2>Reader</h2>
  <p class="hint">Default direction for new chapters.</p>
  <div class="reader-defaults">
    <label class="sel-wrap">
      <span>Default direction</span>
      <select class="sel" value={readerSettings.defaultDirection} onchange={onDirectionChange}>
        {#each Object.entries(directionLabel) as [val, label] (val)}
          <option value={val}>{label}</option>
        {/each}
      </select>
    </label>
  </div>
</div>
