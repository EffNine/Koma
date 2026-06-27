<script lang="ts">
  let q = $state('');
</script>

<h1 class="h1">Search</h1>
<p class="sub">Catalog search arrives in Stage 1.</p>
<input
  bind:value={q}
  placeholder="Search titles…"
  style="width:100%;max-width:480px;padding:11px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:15px"
/>