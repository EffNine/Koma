<script lang="ts">
  import { route, go } from '../lib/router';
  import { titleName } from '../lib/catalog/types';
  import type { Title } from '../lib/catalog/types';
  import { stripHtml } from '../lib/util';
  import type { Source } from '../lib/scraper/sources';
  import type { ScrapedChapter } from '../lib/scraper/engine';
  import {
    followTitle as followDetail,
    unfollowTitle as unfollowDetail,
    loadTitleDetail,
  } from '../lib/media/titleDetail';
  import {
    savePreferredSource,
    savePreferredGroup,
    type TitlePreference,
  } from '../lib/media/titlePreferences';
  import { isPinned, togglePinned } from '../lib/media/pinnedTitles';
  import { resolveTitleChapterSource } from '../lib/media/titleChapterSource';
  import { db } from '../lib/db';
  import {
    markChapterUnread,
    recordChapterRead,
    getProgress,
    getReadChapters,
    setReadingList,
    type ReadingList,
  } from '../lib/tracker/local';
  import { groupChapters, type ChapterGroup } from '../lib/media/chapterGroups';
  import { groupUrl } from '../lib/scraper/groupMapping';
  import { getPages } from '../lib/scraper/scraper';
  import {
    downloadChapter,
    isChapterCached,
    type DownloadProgress,
  } from '../lib/reader/chapterCache';
  import EmptyState from '../lib/components/EmptyState.svelte';
  import Toast from '../lib/components/Toast.svelte';
  import ConfirmDialog from '../lib/components/ConfirmDialog.svelte';
  import MediaHeader from '../lib/components/media/MediaHeader.svelte';
  import MediaPreferences from '../lib/components/media/MediaPreferences.svelte';
  import MediaChapterTable from '../lib/components/media/MediaChapterTable.svelte';
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
  let pinned = $state(false);
  let followBusy = $state(false);
  let groupLinks = $state<Map<string, string>>(new Map());
  let progress = $state<{ chapterNumber?: string } | undefined>();
  let readChapters = $state<Set<string>>(new Set());
  let preferredGroup = $state<string | undefined>(undefined);
  let titlePref = $state<TitlePreference | undefined>(undefined);
  let readingList = $state<ReadingList | undefined>(undefined);
  let cachedChapterUrls = $state<Set<string>>(new Set());
  let downloadingChapterUrl = $state('');
  let downloadProgress = $state<DownloadProgress | null>(null);

  // Feedback + confirmation
  let toast = $state<{ text: string; tone: 'ok' | 'err' | 'warn' | 'info' } | null>(null);
  let confirm = $state<{ action: ConfirmActionId; subject?: string; onConfirm: () => void } | null>(null);

  // Load title detail
  $effect(() => {
    const cur = id;
    if (!cur) return;
    loading = true;
    err = '';
    pinned = false;
    chapters = [];
    chapterSource = undefined;
    matchUrl = '';
    chapterErr = '';
    loadTitleDetail(cur)
      .then((detail) => {
        t = detail?.title;
        followed = detail?.followed ?? false;
        loading = false;
        if (detail?.title) {
          void isPinned(detail.title.id).then((value) => { pinned = value; });
        }
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

  async function loadReadingList(titleId = t?.id): Promise<void> {
    if (!titleId) return;
    try {
      const tracked = await db.trackedTitles.get(titleId);
      readingList = tracked?.readingList;
    } catch { /* non-critical: reading list is optional metadata */ }
  }

  async function autoResolve(title: Title) {
    const [result] = await Promise.all([
      resolveTitleChapterSource(title),
      loadReadingList(title.id),
    ]);
    titlePref = result.preference;
    preferredGroup = result.preference?.preferredGroup;
    sources = result.sources;

    if (result.status === 'no-sources') {
      chapterSource = undefined;
      chapterLoading = false;
      chapterErr = '';
      return;
    }

    if (result.status === 'resolved') {
      matchUrl = result.seriesUrl;
      chapterSource = result.source;
      chapters = result.chapters;
      chapterLoading = false;
      loadProgress(result.source.id);
      loadReadChapters(result.source.id);
      loadGroupLinks(result.chapters);
      loadCachedChapterUrls(result.source.id, result.chapters);
      return;
    }

    chapterLoading = false;
    chapterSource = undefined;
    chapterErr = result.message;
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

  async function loadCachedChapterUrls(sourceId: string, chapters: ScrapedChapter[]) {
    if (!t) return;
    const cached = new Set<string>();
    for (const chapter of chapters) {
      if (await isChapterCached(t.id, sourceId, chapter.url)) cached.add(chapter.url);
    }
    cachedChapterUrls = cached;
  }

  async function loadProgress(sourceId: string) {
    if (!t) return;
    try {
      const p = await getProgress(t.id, sourceId);
      progress = p;
    } catch { /* non-critical: progress is best-effort */ }
  }

  async function loadReadChapters(sourceId: string) {
    if (!t) return;
    try {
      readChapters = await getReadChapters(t.id, sourceId);
    } catch { /* non-critical: read chapters are best-effort */ }
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

  async function onTogglePinned() {
    if (!t) return;
    try {
      if (!followed) {
        await followDetail(t);
        followed = true;
      }
      pinned = await togglePinned(t.id);
      toast = { text: pinned ? `Pinned ${name}` : `Unpinned ${name}`, tone: 'ok' };
    } catch (e) {
      toast = { text: 'Pin failed: ' + String(e), tone: 'err' };
    }
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
    toast = { text: sourceId ? 'Preferred reading site saved' : 'Reverted to automatic reading site', tone: 'ok' };
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

  async function downloadMediaChapter(chapter: ScrapedChapter) {
    if (!t) return;
    const source = chapterSource ?? sources.find((s) => s.enabled);
    if (!source || !matchUrl || downloadingChapterUrl) return;
    downloadingChapterUrl = chapter.url;
    downloadProgress = { loaded: 0, total: 0 };
    try {
      const pages = await getPages(source, chapter.url);
      const result = await downloadChapter(t.id, source.id, chapter.url, pages, chapter.url, (p) => {
        downloadProgress = p;
      });
      cachedChapterUrls = new Set(cachedChapterUrls).add(chapter.url);
      toast = result.ok
        ? { text: `Downloaded chapter ${chapter.number ?? ''}`.trim(), tone: 'ok' }
        : { text: `Downloaded with ${result.failedPages.length} failed page${result.failedPages.length === 1 ? '' : 's'}`, tone: 'warn' };
    } catch (e) {
      toast = { text: 'Download failed: ' + String(e), tone: 'err' };
    } finally {
      downloadingChapterUrl = '';
      downloadProgress = null;
    }
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
  <MediaHeader
    title={t}
    {followed}
    {pinned}
    {followBusy}
    progressChapter={progress?.chapterNumber}
    hasChapters={chapters.length > 0}
    siteUrl={t.siteUrl}
    onStartReading={startReading}
    onStartFromBeginning={startFromBeginning}
    onToggleFollow={toggleFollow}
    onTogglePinned={onTogglePinned}
    onBack={back}
  />

  <MediaPreferences
    {readingList}
    {titlePref}
    {sources}
    {chapterSource}
    {preferredGroup}
    {chapterLoading}
    {chapterErr}
    onSetReadingList={onSetReadingList}
    onSetPreferredSource={onSetPreferredSource}
  />

  <MediaChapterTable
    {chapterGroups}
    {paginatedGroups}
    {chapterLoading}
    {sources}
    {chapterErr}
    {chapters}
    {chapterPage}
    {chapterPerPage}
    {totalPages}
    {currentPage}
    {gotoChapter}
    {readChapters}
    {groupLinks}
    {preferredGroup}
    {cachedChapterUrls}
    {downloadingChapterUrl}
    {downloadProgress}
    onReadChapter={readChapter}
    onReadAlt={readAlt}
    onMarkUnread={markUnreadNumber}
    onDownloadChapter={downloadMediaChapter}
    onGotoChapter={onGotoChapter}
    onPrevPage={() => (chapterPage = chapterPage - 1)}
    onNextPage={() => (chapterPage = chapterPage + 1)}
    onBindGotoChapter={(val) => (gotoChapter = val)}
  />
{/if}

<style>
  .skel { aspect-ratio: 3/1; border-radius: var(--radius); }
</style>
