<script lang="ts">
  import { go } from '../router';
  import { emptyState, type EmptyStateId } from '../ui/emptyState';

  let { id, context = '', compact = false }: { id: EmptyStateId; context?: string; compact?: boolean } = $props();

  const content = $derived(emptyState(id, context));

  function onAction(href: string | undefined, e: MouseEvent) {
    if (!href) return;
    e.preventDefault();
    go(href);
  }
</script>

<div class="empty-state" class:compact>
  <div class="empty-icon" aria-hidden="true">{id === 'reader-failed' ? '⚠' : '∅'}</div>
  <h3 class="empty-title">{content.title}</h3>
  {#if content.body}
    <p class="empty-body">{content.body}</p>
  {/if}
  {#if content.action || content.secondary}
    <div class="empty-actions">
      {#if content.action}
        <a
          class="btn {content.action.variant === 'primary' ? 'btn-primary' : ''}"
          href={content.action.href ? '#' + content.action.href : undefined}
          onclick={(e) => onAction(content.action?.href, e)}
        >
          {content.action.label}
        </a>
      {/if}
      {#if content.secondary}
        <a
          class="btn"
          href={content.secondary.href ? '#' + content.secondary.href : undefined}
          onclick={(e) => onAction(content.secondary?.href, e)}
        >
          {content.secondary.label}
        </a>
      {/if}
    </div>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: clamp(28px, 5vw, 48px) clamp(16px, 4vw, 32px);
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
  }
  .empty-state.compact {
    padding: 22px 18px;
  }
  .empty-icon {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .empty-title {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 720;
    color: var(--text);
  }
  .empty-body {
    margin: 0 0 14px;
    font-size: 14px;
    line-height: 1.55;
    max-width: 460px;
  }
  .empty-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
