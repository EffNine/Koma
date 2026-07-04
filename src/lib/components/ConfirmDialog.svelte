<script lang="ts">
  import { confirmPrompt, type ConfirmActionId } from '../ui/confirm';

  let {
    action,
    subject,
    onConfirm,
    onCancel,
  }: {
    action: ConfirmActionId;
    subject?: string;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  const prompt = $derived(confirmPrompt(action, subject));

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onCancel();
  }
</script>

<div
  class="confirm-backdrop"
  role="alertdialog"
  aria-modal="true"
  tabindex="-1"
  onclick={onBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') onCancel(); }}
>
  <div class="confirm-box" role="document" tabindex="-1">
    <h3 class="confirm-title">{prompt.title}</h3>
    {#if prompt.body}
      <p class="confirm-body">{prompt.body}</p>
    {/if}
    <div class="confirm-actions">
      <button class="btn" onclick={onCancel}>{prompt.cancel}</button>
      <button class="btn {prompt.destructive ? '' : 'btn-primary'}" class:btn-danger={prompt.destructive} onclick={onConfirm}>
        {prompt.confirm}
      </button>
    </div>
  </div>
</div>

<style>
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
  }
  .confirm-box {
    width: min(100%, 420px);
    padding: 20px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .confirm-title {
    margin: 0 0 8px;
    font-size: 17px;
    font-weight: 720;
  }
  .confirm-body {
    margin: 0 0 18px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.5;
  }
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .btn-danger {
    background: var(--danger);
    border-color: transparent;
    color: #fff;
  }
  .btn-danger:hover {
    background: color-mix(in srgb, var(--danger) 86%, #fff);
  }
</style>
