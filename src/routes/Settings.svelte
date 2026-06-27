<script lang="ts">
  const groups = ['Trackers', 'Sources', 'Reader', 'Cache'];
</script>

<h1 class="h1">Settings</h1>
<p class="sub">Trackers, sources, reader defaults &amp; cache — built in Stages 5–6.</p>
{#each groups as g (g)}
  <div class="card" style="margin-bottom:var(--gap)">
    <h2 style="font-size:16px;font-weight:600;margin:0 0 6px">{g}</h2>
    <p style="color:var(--muted);font-size:14px;margin:0">Coming soon.</p>
  </div>
{/each}