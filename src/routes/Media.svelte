<script lang="ts">
  import { route, go } from '../lib/router';
  import { titleName } from '../lib/catalog/types';
  import type { Title } from '../lib/catalog/types';
  import { stripHtml } from '../lib/util';
  import { enabledSources, type Source } from '../lib/scraper/sources';
  import type { ScrapedChapter } from '../lib/scraper/engine';
  import { compareChapterDesc } from '../lib/scraper/engine';
  import {
    followTitle as followDetail,
    unfollowTitle as unfollowDetail,
    loadTitleDetail,
  } from '../lib/media/titleDetail';
  import { getTitlePreference } from '../lib/media/titlePreferences';
  import { resolveChapters } from '../lib/media/chapterResolver';
  import {
    markChapterUnread,
    recordChapterRead,
    getProgress,
    getReadChapters,
  } from '../lib/tracker/local';
  import { savePreferredGroup } from '../lib/media/titlePreferences';
  import { groupChapters, type ChapterGroup } from '../lib/media/chapterGroups';

  let id = $derived(Number($route.path.split('/').filter(Boolean)[1]));
  let t = $state<Title | undefined>();
  let loading = $state(true);
  let err = $state('');
  let sources = $state<Source[]>([]);
  let chapterSource = $state<Source | undefined>();
  let chapters = $state<ScrapedChapter[]>([]);
  let matchUrl = $state('');
  let chapterLoading = $state(false);
  let chapterErr = $state('');
  let followed = $state(false);
  let followBusy = $state(false);
  let groupLinks = $state<Map<string, string>>(new Map());
  let progress = $state<{ chapterNumber?: string } | undefined>();
  let readChapters = $state<Set<string>>(new Set());
  let preferredGroup = $state<string | undefined>(undefined);

  // Load title detail
  $effect(() => {
    const cur = id;
    if (!cur) return;
    loading = true;
    err = '';
    chapters = [];
    chapterSource = undefined;
    matchUrl = '';
    chapterErr = '';
    loadTitleDetail(cur)
      .then((detail) => {
        t = detail?.title;
        followed = detail?.followed ?? false;
        loading = false;
      })
      .catch((e) => { err = String(e); loading = false; });
  });

  // Auto-resolve chapters once title + sources are ready
  $effect(() => {
    const title = t;
    if (!title) return;
    chapterLoading = true;
    chapterErr = '';
    autoResolve(title);
  });

  async function loadPreferredGroup() {
    if (!t) return;
    try {
      const pref = await getTitlePreference(t.id);
      preferredGroup = pref?.preferredGroup;
    } catch {}
  }

  async function autoResolve(title: Title) {
    const allSources = await enabledSources();
    sources = allSources;
    if (allSources.length === 0) {
      chapterSource = undefined;
      chapterLoading = false;
      return;
    }
    // Try each enabled source in priority order until one returns chapters
    for (const source of allSources) {
      try {
        const result = await resolveChapters(source, title);
        if ('err' in result) continue;
        if (result.chapters.length > 0) {
          matchUrl = result.seriesUrl;
          chapterSource = source;
          chapters = result.chapters;
          chapterLoading = false;
          // Load progress for Start Reading button
          loadProgress(source.id);
          // Load read chapters for status indicators
          loadReadChapters(source.id);
          // Load preferred group for selection and grouping
          loadPreferredGroup();
          // Load group links in background
          loadGroupLinks(result.chapters);
          return;
        }
      } catch {
        continue;
      }
    }
    chapterLoading = false;
    chapterSource = undefined;
    chapterErr = 'No chapters found from any enabled source. Add or enable a source in Settings.';
  }

  async function loadGroupLinks(chapters: ScrapedChapter[]) {
    const uniqueGroups = new Set(chapters.map((c) => c.group).filter(Boolean));
    const links = new Map<string, string>();
    groupLinks = links;
  }

  async function loadProgress(sourceId: string) {
    if (!t) return;
    try {
      const p = await getProgress(t.id, sourceId);
      progress = p;
    } catch {}
  }

  async function loadReadChapters(sourceId: string) {
    if (!t) return;
    try {
      readChapters = await getReadChapters(t.id, sourceId);
    } catch {}
  }

  const countryLabel: Record<string, string> = { JP: 'Manga', KR: 'Manhwa', CN: 'Manhua' };
  let name = $derived(t ? titleName(t) : '');
  let desc = $derived(t?.description ? stripHtml(t.description) : '');
  let chapterGroups = $derived(groupChapters(chapters, preferredGroup));
  let chapterPage = $state(1);
  let chapterPerPage = $state(60);
  let gotoChapter = $state('');
  let paginatedGroups = $derived(chapterGroups.slice(0, chapterPage * chapterPerPage));
  let totalPages = $derived(Math.ceil(chapterGroups.length / chapterPerPage));
  let currentPage = $derived(Math.min(chapterPage, totalPages));

  function relativeTime(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  function scrollToChapter(num: string) {
    const el = document.getElementById(`ch-${num}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function onGotoChapter() {
    const num = gotoChapter.trim();
    if (!num) return;
    const idx = chapterGroups.findIndex((g) => g.number === num);
    if (idx >= 0) {
      chapterPage = Math.floor(idx / chapterPerPage) + 1;
      requestAnimationFrame(() => scrollToChapter(num));
    }
    gotoChapter = '';
  }

  async function startReading() {
    if (!t || chapters.length === 0) return;
    const source = chapterSource ?? sources.find((s) => s.enabled);
    if (!source) return;

    // If we have progress, resume from the last-read chapter
    if (progress?.chapterNumber) {
      const resume = chapterGroups.find((g) => g.number === progress!.chapterNumber);
      if (resume) {
        await readChapter(resume.preferred);
        return;
      }
    }

    // Otherwise start from the last chapter (lowest number = chapter 1).
    const last = chapterGroups[chapterGroups.length - 1]?.preferred;
    if (last) await readChapter(last);
  }

  async function startFromBeginning() {
    if (!t || chapters.length === 0) return;
    const source = chapterSource ?? sources.find((s) => s.enabled);
    if (!source) return;
    // Start from the last chapter in the list (lowest number = chapter 1).
    const first = chapterGroups[chapterGroups.length - 1]?.preferred;
    if (first) await readChapter(first);
  }

  async function toggleFollow() {
    if (!t || followBusy) return;
    followBusy = true;
    try {
      if (followed) {
        await unfollowDetail(t.id);
        followed = false;
      } else {
        await followDetail(t);
        followed = true;
      }
    } finally {
      followBusy = false;
    }
  }

  function groupLabel(group: string | undefined, altCount: number, pref?: string): string {
    if (!group) return `${altCount + 1} groups`;
    const suffix = group === pref ? '' : ' (fallback)';
    if (altCount === 0) return group + suffix;
    return `${group} +${altCount}${suffix}`;
  }

  async function readAlt(group: ChapterGroup, selectedValue: string) {
    const alt = group.alternatives.find((a) => (a.group ?? a.url) === selectedValue);
    if (alt) await readChapter(alt);
  }

  async function readChapter(chapter: ScrapedChapter) {
    if (!t) return;
    const source = chapterSource ?? sources.find((s) => s.enabled);
    if (!source) return;
    if (chapter.group) {
      await savePreferredGroup(t.id, chapter.group);
    }
    await recordChapterRead({
      title: t,
      sourceId: source.id,
      chapterUrl: chapter.url,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
    });
    go(`/reader/${t.id}/${source.id}/${encodeURIComponent(matchUrl)}/${encodeURIComponent(chapter.url)}`);
  }

  async function markUnreadNumber(chapterNumber: string | null) {
    if (!t || !chapterNumber) return;
    const source = chapterSource ?? sources.find((s) => s.enabled);
    if (!source) return;
    const progress = await markChapterUnread(t.id, source.id, chapterNumber);
    // no feedback needed, tracker handles it silently
  }
</script>

<button class="btn back" onclick={() => go('/')}>← Back</button>

{#if err}
  <div class="card err">{err}</div>
{:else if loading || !t}
  <div class="card skel" style="height:260px"></div>
{:else}
  <div class="detail">
    <img class="cover" src={t.cover} alt={name} />
    <div class="info">
      <h1 class="h1">{name}</h1>
      <div class="meta">
        {#if t.country}<span class="chip">{countryLabel[t.country] ?? t.country}</span>{/if}
        {#if t.status}<span>{t.status}</span>{/if}
        {#if t.year}<span>{t.year}</span>{/if}
        {#if t.chapters}<span>{t.chapters} ch.</span>{/if}
        {#if t.averageScore}<span>★ {(t.averageScore / 10).toFixed(1)}</span>{/if}
      </div>
      {#if t.genres?.length}
        <div class="genres">{#each t.genres as g (g)}<span class="gchip">{g}</span>{/each}</div>
      {/if}
      <p class="desc">{desc}</p>
      <div class="actions">
        {#if chapters.length > 0}
          {#if progress?.chapterNumber}
            <button class="btn btn-primary" onclick={startReading}>Continue Reading</button>
            <button class="btn" onclick={startFromBeginning}>Start Over</button>
          {:else}
            <button class="btn btn-primary" onclick={startReading}>Start Reading</button>
          {/if}
        {/if}
        <button class="btn" onclick={toggleFollow} disabled={followBusy}>
          {followBusy ? 'Saving…' : followed ? 'Following' : 'Follow'}
        </button>
        {#if t.siteUrl}<a class="btn" href={t.siteUrl} target="_blank" rel="noopener">AniList ↗</a>{/if}
      </div>
    </div>
  </div>

  <!-- Chapters section — ComicK-style, no source picker -->
  <section class="chapters-section">
    <div class="chap-head">
      <h2>Chapters</h2>
      {#if chapters.length}
        <div class="chap-meta">
          <span>{chapters.length} chapter{chapters.length === 1 ? '' : 's'}</span>
        </div>
      {/if}
    </div>

    {#if chapterLoading}
      <div class="card loading-chapters">Loading chapters…</div>
    {:else if chapterErr}
      <div class="card errbox">{chapterErr} <button class="btn small-btn" onclick={() => go('/settings')}>Manage Sources</button></div>
    {:else if chapters.length === 0}
      <div class="card empty-chapters">
        No chapters found. Add a source in Settings to find chapters for this title.
        <button class="btn small-btn" onclick={() => go('/settings')} style="margin-top:10px">Manage Sources</button>
      </div>
    {:else}
      <!-- ComicK-style chapter table header -->
      <div class="chap-table-header">
        <span class="chap-col-chap">Chap</span>
        <span class="chap-col-uploaded">Uploaded</span>
        <span class="chap-col-group">Group</span>
        <span class="chap-col-actions"></span>
      </div>

      <div class="chapters">
        {#each paginatedGroups as g (g.preferred.url)}
          {@const c = g.preferred}
          <div class="chapter-row" id={g.number ? `ch-${g.number}` : ''} class:read={g.number ? readChapters.has(g.number) : false}>
            <div class="chap-col-chap">
              <button class="chap-link" onclick={() => readChapter(c)}>
                <span class="chap-num">Ch. {g.number ?? '?'}</span>
                {#if g.number && readChapters.has(g.number)}
                  <span class="chap-read-badge" title="Read">✓</span>
                {/if}
              </button>
            </div>
            <div class="chap-col-uploaded">
              <span class="chap-time">{relativeTime(c.createdAt)}</span>
            </div>
            <div class="chap-col-group">
              {#if g.alternatives.length > 0}
                <select class="chap-group-select" value={c.group ?? ''} onchange={(e) => readAlt(g, e.currentTarget.value)}>
                  <option value={c.group ?? ''}>{groupLabel(c.group, g.alternatives.length, preferredGroup)}</option>
                  {#each g.alternatives as alt (alt.url)}
                    <option value={alt.group ?? alt.url}>{alt.group ?? alt.url}</option>
                  {/each}
                </select>
              {:else if c.group}
                {@const link = groupLinks.get(c.group)}
                {#if link}
                  <a class="chap-group-link" href={link} target="_blank" rel="noopener">{c.group}</a>
                {:else}
                  <span class="chap-group">{c.group}</span>
                {/if}
              {/if}
            </div>
            <div class="chap-col-actions">
              <button class="btn small-btn btn-primary" onclick={() => readChapter(c)} title="Read">▶</button>
              {#if g.number}
                <button class="btn small-btn" onclick={() => markUnreadNumber(g.number)} title="Mark unread">↩</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Pagination + Goto -->
      {#if chapterGroups.length > chapterPerPage}
        <div class="chap-footer">
          <div class="chap-pages">
            Showing chapters 1–{Math.min(chapterPage * chapterPerPage, chapterGroups.length)} of {chapterGroups.length}
            — page {currentPage}/{totalPages}
          </div>
          <div class="chap-nav">
            {#if chapterPage > 1}
              <button class="btn small-btn" onclick={() => (chapterPage = chapterPage - 1)}>← Prev</button>
            {/if}
            {#if chapterPage < totalPages}
              <button class="btn small-btn" onclick={() => (chapterPage = chapterPage + 1)}>Next →</button>
            {/if}
          </div>
          <form class="chap-goto" onsubmit={(e) => { e.preventDefault(); onGotoChapter(); }}>
            <span class="goto-label">Go to chap</span>
            <input bind:value={gotoChapter} class="goto-input" placeholder="#" />
            <button class="btn small-btn" type="submit">Go</button>
          </form>
        </div>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .back { margin-bottom: 16px; }
  .detail { display: flex; gap: 22px; align-items: flex-start; }
  .cover { width: 190px; aspect-ratio: 3/4; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
  .info { flex: 1; min-width: 0; }
  .meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 14px; margin: 6px 0 14px; align-items: center; }
  .chip { background: var(--accent); color: #fff; padding: 2px 9px; border-radius: 20px; font-size: 12px; }
  .genres { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .gchip { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 3px 10px; font-size: 12px; color: var(--muted); }
  .desc { white-space: pre-wrap; color: var(--text); font-size: 14.5px; line-height: 1.65; max-width: 720px; }
  .actions { display: flex; gap: 8px; margin-top: 18px; }
  .btn[disabled] { opacity: .5; cursor: not-allowed; }
  .err { color: var(--danger); }

  /* Chapters section — ComicK-style */
  .chapters-section { margin-top: 24px; }
  .chap-head { display: flex; justify-content: space-between; gap: 10px; align-items: end; margin-bottom: 10px; flex-wrap: wrap; }
  .chap-head h2 { margin: 0; font-size: 18px; font-weight: 650; }
  .chap-meta { color: var(--muted); font-size: 13px; }
  .chap-table-header { display: grid; grid-template-columns: 1fr 100px 1fr auto; gap: 10px; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
  .chapters { display: flex; flex-direction: column; max-height: 540px; overflow: auto; padding-right: 2px; }
  .chapter-row { display: grid; grid-template-columns: 1fr 100px 1fr auto; gap: 10px; align-items: center; padding: 8px 12px; border-radius: var(--radius-sm); transition: background .1s; }
  .chapter-row:hover { background: var(--elevated); }
  .chapter-row.read { opacity: 0.6; }
  .chapter-row.read .chap-num { color: var(--muted-2); }
  .chap-read-badge { display: inline-flex; align-items: center; justify-content: center; margin-left: 6px; font-size: 11px; color: var(--accent); }
  .chap-link { background: none; border: 0; color: var(--text); cursor: pointer; font-size: 14px; padding: 0; text-align: left; font-family: inherit; }
  .chap-link:hover { color: var(--accent); }
  .chap-num { font-weight: 500; }
  .chap-time { font-size: 13px; color: var(--muted); }
  .chap-group { font-size: 12px; color: var(--muted-2); }
  .chap-group-link { font-size: 12px; color: var(--accent); text-decoration: none; }
  .chap-group-link:hover { text-decoration: underline; }
  .chap-group-select { font-size: 12px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 6px; max-width: 160px; }
  .chap-col-actions { display: flex; gap: 4px; }
  .small-btn { padding: 4px 8px; font-size: 12px; min-width: 28px; text-align: center; }
  .chap-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--border); }
  .chap-pages { font-size: 13px; color: var(--muted); }
  .chap-nav { display: flex; gap: 6px; }
  .chap-goto { display: flex; align-items: center; gap: 6px; }
  .goto-label { font-size: 12px; color: var(--muted); }
  .goto-input { width: 60px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; text-align: center; }
  .loading-chapters { padding: 24px; text-align: center; color: var(--muted); }
  .errbox { color: var(--danger); padding: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .empty-chapters { padding: 24px; text-align: center; color: var(--muted); }

  @media (max-width: 800px) {
    .detail { flex-direction: column; }
    .cover { width: 150px; }
    .chap-table-header { display: none; }
    .chapter-row { grid-template-columns: 1fr auto; grid-template-rows: auto auto; }
    .chap-col-chap { grid-column: 1; grid-row: 1; }
    .chap-col-uploaded { grid-column: 1; grid-row: 2; }
    .chap-col-group { display: none; }
    .chap-col-actions { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
    .chap-footer { flex-direction: column; align-items: stretch; }
    .chap-goto { justify-content: center; }
  }
</style>
