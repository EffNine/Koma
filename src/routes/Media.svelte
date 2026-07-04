<script lang="ts">
  import { route, go } from '../lib/router';
  import { titleName } from '../lib/catalog/types';
  import type { Title } from '../lib/catalog/types';
  import { stripHtml } from '../lib/util';
  import { enabledSources, type Source } from '../lib/scraper/sources';
  import type { ScrapedChapter } from '../lib/scraper/engine';
  import {
    followTitle as followDetail,
    unfollowTitle as unfollowDetail,
    loadTitleDetail,
  } from '../lib/media/titleDetail';
  import {
    getTitlePreference,
    savePreferredSource,
    type TitlePreference,
  } from '../lib/media/titlePreferences';
  import { resolveChapters } from '../lib/media/chapterResolver';
  import { loadSourceHealth, rankSources } from '../lib/scraper/sourceHealth';
  import { db } from '../lib/db';
  import {
    markChapterUnread,
    recordChapterRead,
    getProgress,
    getReadChapters,
    setReadingList,
    type ReadingList,
  } from '../lib/tracker/local';
  import { savePreferredGroup } from '../lib/media/titlePreferences';
  import { groupChapters, type ChapterGroup } from '../lib/media/chapterGroups';
  import { groupUrl } from '../lib/scraper/groupMapping';
  import EmptyState from '../lib/components/EmptyState.svelte';
  import Toast from '../lib/components/Toast.svelte';
  import ConfirmDialog from '../lib/components/ConfirmDialog.svelte';
  import { chapterSummary, groupLabel } from '../lib/ui/formatting';
  import { relativeTime } from '../lib/util';
  import type { ConfirmActionId } from '../lib/ui/confirm';

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
  let titlePref = $state<TitlePreference | undefined>(undefined);
  let readingList = $state<ReadingList | undefined>(undefined);

  // Feedback + confirmation
  let toast = $state<{ text: string; tone: 'ok' | 'err' | 'warn' | 'info' } | null>(null);
  let confirm = $state<{ action: ConfirmActionId; subject?: string; onConfirm: () => void } | null>(null);

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

  async function loadTitleMetadata() {
    if (!t) return;
    try {
      const pref = await getTitlePreference(t.id);
      titlePref = pref;
      preferredGroup = pref?.preferredGroup;
    } catch {}
    try {
      const tracked = await db.trackedTitles.get(t.id);
      readingList = tracked?.readingList;
    } catch {}
  }

  async function autoResolve(title: Title) {
    const allSources = await enabledSources();
    if (allSources.length === 0) {
      sources = [];
      chapterSource = undefined;
      chapterLoading = false;
      chapterErr = '';
      return;
    }
    const health = await loadSourceHealth(allSources);
    const ranked = rankSources(allSources, health, titlePref?.preferredSourceId);
    sources = ranked;
    if (ranked.length === 0) {
      chapterSource = undefined;
      chapterLoading = false;
      return;
    }
    for (const source of ranked) {
      try {
        const result = await resolveChapters(source, title);
        if ('err' in result) continue;
        if (result.chapters.length > 0) {
          matchUrl = result.seriesUrl;
          chapterSource = source;
          chapters = result.chapters;
          chapterLoading = false;
          loadProgress(source.id);
          loadReadChapters(source.id);
          loadTitleMetadata();
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
    for (const name of uniqueGroups) {
      const url = await groupUrl(name!);
      if (url) links.set(name!, url);
    }
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
    if (progress?.chapterNumber) {
      const resume = chapterGroups.find((g) => g.number === progress!.chapterNumber);
      if (resume) {
        await readChapter(resume.preferred);
        return;
      }
    }
    const last = chapterGroups[chapterGroups.length - 1]?.preferred;
    if (last) await readChapter(last);
  }

  async function startFromBeginning() {
    if (!t || chapters.length === 0) return;
    const source = chapterSource ?? sources.find((s) => s.enabled);
    if (!source) return;
    const first = chapterGroups[chapterGroups.length - 1]?.preferred;
    if (first) await readChapter(first);
  }

  function askUnfollow() {
    if (!t) return;
    confirm = {
      action: 'unfollow',
      subject: name,
      onConfirm: () => {
        void doUnfollow();
        confirm = null;
      },
    };
  }

  async function doUnfollow() {
    if (!t || followBusy) return;
    followBusy = true;
    try {
      await unfollowDetail(t.id);
      followed = false;
      toast = { text: `Unfollowed ${name}`, tone: 'ok' };
    } catch (e) {
      toast = { text: 'Unfollow failed: ' + String(e), tone: 'err' };
    } finally {
      followBusy = false;
    }
  }

  async function doFollow() {
    if (!t || followBusy) return;
    followBusy = true;
    try {
      await followDetail(t);
      followed = true;
      toast = { text: `Following ${name}`, tone: 'ok' };
    } catch (e) {
      toast = { text: 'Follow failed: ' + String(e), tone: 'err' };
    } finally {
      followBusy = false;
    }
  }

  async function toggleFollow() {
    if (!t) return;
    if (followed) askUnfollow();
    else await doFollow();
  }

  async function onSetReadingList(next: ReadingList | undefined) {
    if (!t) return;
    await setReadingList(t.id, next);
    readingList = next;
    toast = { text: next ? `Saved to ${next}` : 'Reading list cleared', tone: 'ok' };
  }

  async function onSetPreferredSource(sourceId: string | undefined) {
    if (!t) return;
    await savePreferredSource(t.id, sourceId);
    titlePref = { ...(titlePref ?? { mediaId: t.id, updatedAt: 0 }), preferredSourceId: sourceId, updatedAt: Date.now() };
    toast = { text: sourceId ? 'Preferred source saved' : 'Reverted to automatic source', tone: 'ok' };
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
    await markChapterUnread(t.id, source.id, chapterNumber);
    readChapters = new Set(readChapters);
    readChapters.delete(chapterNumber);
    toast = { text: `Marked chapter ${chapterNumber} unread`, tone: 'ok' };
  }

  function back() {
    history.length > 1 ? history.back() : go('/');
  }
</script>

<button class="btn back" onclick={back}>Back</button>

{#if toast}
  <Toast text={toast.text} tone={toast.tone} onDismiss={() => (toast = null)} />
{/if}

{#if confirm}
  <ConfirmDialog
    action={confirm.action}
    subject={confirm.subject}
    onConfirm={confirm.onConfirm}
    onCancel={() => (confirm = null)}
  />
{/if}

{#if err}
  <EmptyState id="generic" context={err} compact />
{:else if loading || !t}
  <div class="card skel" style="height:260px"></div>
{:else}
  <div class="detail">
    <div class="cover-wrap">
      <img class="cover" src={t.cover} alt={name} />
      {#if followed}
        <span class="follow-badge">Following</span>
      {/if}
    </div>
    <div class="info">
      <h1 class="h1">{name}</h1>
      <div class="meta">
        {#if t.country}<span class="chip">{countryLabel[t.country] ?? t.country}</span>{/if}
        {#if t.status}<span>{t.status}</span>{/if}
        {#if t.year}<span>{t.year}</span>{/if}
        {#if t.chapters}<span>{t.chapters} ch.</span>{/if}
        {#if t.averageScore}<span>★ {(t.averageScore / 10).toFixed(1)}</span>{/if}
        {#if progress?.chapterNumber}<span class="progress-chip">Read Ch. {progress.chapterNumber}</span>{/if}
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
          <span class="pref-label">Source</span>
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
          Resolving chapters from enabled sources...
        {:else if chapterSource}
          Chapters from {chapterSource.name}{#if preferredGroup} with {preferredGroup} preferred{/if}
        {:else if sources.length === 0}
          Add a source in Settings to start reading.
        {:else if chapterErr}
          {chapterErr}
        {/if}
      </div>
    </div>
  </div>

  <!-- Chapters section -->
  <section class="chapters-section">
    <div class="chap-head">
      <h2 class="h2">Chapters</h2>
      {#if chapters.length}
        <div class="chap-meta">
          <span>{chapterSummary(chapterGroups.length, chapters.length)}</span>
        </div>
      {/if}
    </div>

    {#if chapterLoading}
      <div class="card loading-chapters">Loading chapters…</div>
    {:else if sources.length === 0}
      <EmptyState id="sources" compact />
    {:else if chapterErr}
      <div class="card errbox">{chapterErr} <button class="btn small-btn" onclick={() => go('/settings')}>Manage Sources</button></div>
    {:else if chapters.length === 0}
      <EmptyState id="chapters" compact />
    {:else}
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
  .detail {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 24px;
    align-items: flex-start;
    padding: clamp(16px, 2.4vw, 24px);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), var(--surface) 54%),
      var(--surface);
  }
  .cover-wrap { position: relative; width: 190px; flex-shrink: 0; }
  .cover { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); display: block; box-shadow: 0 16px 36px rgba(0, 0, 0, .34); }
  .follow-badge { position: absolute; left: 10px; bottom: 10px; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; color: color-mix(in srgb, var(--ok) 76%, white); background: color-mix(in srgb, var(--ok) 22%, #0b0c0d); border: 1px solid color-mix(in srgb, var(--ok) 38%, transparent); }
  .info { flex: 1; min-width: 0; }
  .info .h1 { font-size: clamp(28px, 4vw, 44px); line-height: 1.04; margin-bottom: 8px; }
  .meta { display: flex; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 13px; margin: 6px 0 14px; align-items: center; }
  .chip, .progress-chip { background: var(--accent); color: #17110a; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 720; }
  .progress-chip { background: var(--ok-soft); color: color-mix(in srgb, var(--ok) 76%, white); border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent); }
  .genres { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .gchip { background: color-mix(in srgb, var(--elevated) 80%, transparent); border: 1px solid var(--border-soft); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--muted); }
  .desc { white-space: pre-wrap; color: var(--text); font-size: 14.5px; line-height: 1.65; max-width: 720px; }
  .actions { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
  .btn[disabled] { opacity: .5; cursor: not-allowed; }
  .source-line { min-height: 22px; margin-top: 12px; color: var(--muted); font-size: 13px; }
  .preferences-line { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
  .pref-block { display: flex; gap: 8px; align-items: center; }
  .pref-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); }
  .pref-select { min-height: 30px; padding: 0 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
  .pref-value { font-size: 13px; color: var(--muted); }

  /* Chapters section */
  .chapters-section { margin-top: 24px; }
  .chap-head { display: flex; justify-content: space-between; gap: 10px; align-items: end; margin-bottom: 10px; flex-wrap: wrap; }
  .chap-head h2 { margin: 0; }
  .chap-meta { color: var(--muted); font-size: 13px; }
  .chap-table-header { display: grid; grid-template-columns: 1fr 100px 1fr auto; gap: 10px; padding: 8px 12px; font-size: 12px; font-weight: 700; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
  .chapters { display: flex; flex-direction: column; max-height: 540px; overflow: auto; padding-right: 2px; border: 1px solid var(--border-soft); border-radius: var(--radius); background: color-mix(in srgb, var(--surface) 76%, transparent); }
  .chapter-row { display: grid; grid-template-columns: 1fr 100px 1fr auto; gap: 10px; align-items: center; padding: 9px 12px; border-radius: 0; border-bottom: 1px solid var(--border-soft); transition: background .1s; }
  .chapter-row:last-child { border-bottom: 0; }
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
  .chap-group-select { font-size: 12px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 6px; max-width: 180px; }
  .chap-col-actions { display: flex; gap: 4px; }
  .small-btn { min-height: 30px; padding: 0 8px; font-size: 12px; min-width: 30px; text-align: center; }
  .chap-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--border); }
  .chap-pages { font-size: 13px; color: var(--muted); }
  .chap-nav { display: flex; gap: 6px; }
  .chap-goto { display: flex; align-items: center; gap: 6px; }
  .goto-label { font-size: 12px; color: var(--muted); }
  .goto-input { width: 60px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; text-align: center; }
  .loading-chapters { padding: 24px; text-align: center; color: var(--muted); }
  .errbox { color: var(--danger); padding: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

  @media (max-width: 800px) {
    .detail { grid-template-columns: 112px minmax(0, 1fr); gap: 14px; padding: 14px; }
    .cover-wrap { width: 112px; grid-row: 1 / 4; }
    .info { display: contents; }
    .info .h1 { font-size: 24px; }
    .info .h1, .meta, .genres { grid-column: 2; }
    .desc, .actions, .source-line { grid-column: 1 / -1; }
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
