<script lang="ts">
  import type { Source } from '../../scraper/sources';
  import type { TitlePreference } from '../../media/titlePreferences';
  import type { ReadingList } from '../../tracker/local';

  let {
    readingList,
    titlePref,
    sources,
    chapterSource,
    preferredGroup,
    chapterLoading,
    chapterErr,
    onSetReadingList,
    onSetPreferredSource,
  }: {
    readingList: ReadingList | undefined;
    titlePref: TitlePreference | undefined;
    sources: Source[];
    chapterSource: Source | undefined;
    preferredGroup: string | undefined;
    chapterLoading: boolean;
    chapterErr: string;
    onSetReadingList: (next: ReadingList | undefined) => void;
    onSetPreferredSource: (sourceId: string | undefined) => void;
  } = $props();
</script>

<div class="preferences-line">
  <div class="pref-block">
    <span class="pref-label">List</span>
    <select class="pref-select" value={readingList ?? ''} onchange={(e) => onSetReadingList((e.currentTarget.value || undefined) as ReadingList | undefined)}>
      <option value="">Auto</option>
      <option value="Reading">Reading</option>
      <option value="Plan to Read">Plan to Read</option>
      <option value="Completed">Completed</option>
    </select>
  </div>
  <div class="pref-block">
    <span class="pref-label">Reading Site</span>
    <select class="pref-select" value={titlePref?.preferredSourceId ?? ''} onchange={(e) => onSetPreferredSource(e.currentTarget.value || undefined)}>
      <option value="">Auto ({chapterSource?.name ?? 'best'})</option>
      {#each sources as s (s.id)}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>
  </div>
  {#if preferredGroup}
    <div class="pref-block">
      <span class="pref-label">Group</span>
      <span class="pref-value">{preferredGroup}</span>
    </div>
  {/if}
</div>
<div class="source-line">
  {#if chapterLoading}
    Resolving chapters from enabled reading sites...
  {:else if chapterSource}
    Chapters from {chapterSource.name}{#if preferredGroup} with {preferredGroup} preferred{/if}
    {#if chapterSource.name === 'MangaDex'}
      <span class="attribution">— Chapters provided by <a href="https://mangadex.org" target="_blank" rel="noopener">MangaDex</a> and scanlation groups.</span>
    {/if}
  {:else if sources.length === 0}
    Add a reading site in Settings to start reading.
  {:else if chapterErr}
    {chapterErr}
  {/if}
</div>

<style>
  .preferences-line { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
  .pref-block { display: flex; gap: 8px; align-items: center; }
  .pref-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); }
  .pref-select { min-height: 30px; padding: 0 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
  .pref-value { font-size: 13px; color: var(--muted); }
  .source-line { min-height: 22px; margin-top: 12px; color: var(--muted); font-size: 13px; }
  .attribution { font-size: 11px; color: var(--muted-2); }
  .attribution a { color: var(--muted-2); text-decoration: underline; }
  .attribution a:hover { color: var(--accent); }
</style>
