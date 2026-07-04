<script lang="ts">
  import { messageClass, type MessageTone } from '../ui/feedback';

  let { text, tone = 'info', onDismiss }: { text: string; tone?: MessageTone; onDismiss?: () => void } = $props();

  $effect(() => {
    if (tone === 'err' || tone === 'warn') return;
    const t = setTimeout(() => onDismiss?.(), 3200);
    return () => clearTimeout(t);
  });
</script>

<div class={messageClass(tone)} role="status">
  <span class="msg-text">{text}</span>
  {#if onDismiss}
    <button class="msg-close" onclick={onDismiss} aria-label="Dismiss">✕</button>
  {/if}
</div>

<style>
  .msg {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    border-radius: var(--radius-sm);
    padding: 9px 11px;
    background: var(--accent-soft);
    border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  }
  .msg.ok {
    background: var(--ok-soft);
    border-color: color-mix(in srgb, var(--ok) 30%, transparent);
  }
  .msg.warn {
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    border-color: color-mix(in srgb, var(--warning) 26%, transparent);
  }
  .msg.errbox {
    background: var(--danger-soft);
    border-color: color-mix(in srgb, var(--danger) 30%, transparent);
    color: var(--danger);
  }
  .msg-text { line-height: 1.45; }
  .msg-close {
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    opacity: 0.7;
  }
  .msg-close:hover { opacity: 1; }
</style>
