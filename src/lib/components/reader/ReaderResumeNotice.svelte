<script lang="ts">
  let {
    resumedFromPage,
    onDismiss,
    onGoThere,
  }: {
    resumedFromPage: number;
    onDismiss: () => void;
    onGoThere: () => void;
  } = $props();
</script>

<div class="card resume-notice" role="status">
  <span>Resumed from page {resumedFromPage + 1}</span>
  <button class="btn tiny-btn" onclick={onGoThere}>Go there</button>
  <button class="btn tiny-btn" onclick={onDismiss} aria-label="Dismiss">✕</button>
</div>

<style>
  .resume-notice {
    position: fixed;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 14px;
    background: var(--panel);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    font-size: 13px;
    animation: resume-in .25s ease;
  }
  @keyframes resume-in { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
  .tiny-btn { min-height: 28px; padding: 0 8px; font-size: 11px; min-width: auto; }
</style>
