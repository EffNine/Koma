<script lang="ts">
  type Tab = 'updates' | 'all' | 'reading' | 'plan' | 'completed' | 'history';

  let {
    tab,
    onTabChange,
  }: {
    tab: Tab;
    onTabChange: (t: Tab) => void;
  } = $props();
</script>

<div class="tabs">
  <button class:active={tab === 'updates'} onclick={() => onTabChange('updates')}>Updates</button>
  <button class:active={tab === 'all'} onclick={() => onTabChange('all')}>All</button>
  <button class:active={tab === 'reading'} onclick={() => onTabChange('reading')}>Reading</button>
  <button class:active={tab === 'plan'} onclick={() => onTabChange('plan')}>Plan to Read</button>
  <button class:active={tab === 'completed'} onclick={() => onTabChange('completed')}>Completed</button>
  <button class:active={tab === 'history'} onclick={() => onTabChange('history')}>History</button>
</div>

<style>
  .tabs { display: inline-flex; padding: 3px; border: 1px solid var(--border-soft); border-radius: var(--radius); background: var(--surface); margin-bottom: 16px; }
  .tabs button { min-width: 96px; min-height: 32px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--muted); padding: 0 12px; cursor: pointer; font-weight: 650; }
  .tabs button.active { color: #17110a; background: var(--accent); }
  @media (max-width: 720px) {
    .tabs button { min-width: auto; padding: 0 10px; font-size: 12px; }
  }
</style>
