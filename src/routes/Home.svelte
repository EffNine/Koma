<script lang="ts">
  // Stage 0 placeholder. Stage 1 wires this to the COMICK catalog.
  const rows = ['Trending', 'Latest updates', 'Top charts'];
</script>

<h1 class="h1">Home</h1>
<p class="sub">Browse manga, manhwa &amp; manhua — catalog connects in Stage 1.</p>

{#each rows as r (r)}
  <section style="margin-bottom:var(--gap-lg)">
    <h2 style="font-size:16px;font-weight:600;margin:0 0 12px">{r}</h2>
    <div class="grid">
      {#each Array(6) as _, i (i)}
        <div class="card" style="padding:0;overflow:hidden">
          <div style="aspect-ratio:3/4;background:linear-gradient(150deg,var(--elevated),var(--surface))"></div>
          <div style="padding:10px 12px">
            <div style="height:10px;width:80%;background:var(--border);border-radius:4px;margin-bottom:6px"></div>
            <div style="height:9px;width:50%;background:var(--border);border-radius:4px;opacity:.7"></div>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/each}