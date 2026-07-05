import type { Title } from '../src/lib/catalog/types.ts';
import type { ChapterResolution } from '../src/lib/media/chapterResolver.ts';
import {
  resolveReaderChapterSession,
  type ReaderSessionPhase,
} from '../src/lib/reader/chapterSession.ts';
import type { ReaderState } from '../src/lib/reader/state.ts';
import type { ReaderSettings } from '../src/lib/reader/settings.ts';
import type { ScrapedChapter } from '../src/lib/scraper/engine.ts';
import type { Source } from '../src/lib/scraper/sources.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  } else {
    console.log('ok: ' + msg);
  }
}

function source(id: string): Source {
  return {
    id,
    name: id,
    url: `https://${id}.example/`,
    enabled: true,
    priority: 0,
    addedAt: 0,
  };
}

function chapter(number: string, group = 'A'): ScrapedChapter {
  return {
    url: `https://source.example/chapter-${number}-${group}`,
    number,
    title: `Chapter ${number}`,
    group,
  };
}

function resolution(sourceId: string, chapters: ScrapedChapter[]): ChapterResolution {
  return {
    query: 'Test Title',
    seriesUrl: `https://${sourceId}.example/series`,
    seriesTitle: 'Test Title',
    chapters,
    msg: `Matched on ${sourceId}.`,
  };
}

const title: Title = {
  id: 1,
  title: { romaji: 'Test Title' },
  country: 'KR',
};

const settings: ReaderSettings = {
  key: 'defaults',
  defaultDirection: 'rtl',
  imageFit: 'width',
};

const saved: ReaderState = {
  key: '1:primary:https://primary.example/chapter-1',
  mediaId: 1,
  sourceId: 'primary',
  chapterUrl: 'https://primary.example/chapter-1',
  seriesUrl: 'https://primary.example/series',
  page: 2,
  direction: 'vertical',
  imageFit: 'screen',
  updatedAt: 100,
};

const phases: ReaderSessionPhase[] = [];
const healthCalls: string[] = [];
const ready = await resolveReaderChapterSession({
  mediaId: 1,
  sourceId: 'primary',
  seriesUrl: 'https://primary.example/series',
  chapterUrl: 'https://primary.example/chapter-1',
  onPhase: (phase) => phases.push(phase),
}, {
  media: async () => title,
  getSource: async () => source('primary'),
  getPages: async () => ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'],
  getChapters: async () => [chapter('1'), chapter('2')],
  loadReaderState: async (mediaId, sourceId, chapterUrl) => {
    assert(mediaId === 1, 'reader state media id is passed through');
    assert(sourceId === 'primary', 'reader state uses resolved source id');
    assert(chapterUrl === 'https://primary.example/chapter-1', 'reader state uses resolved chapter url');
    return saved;
  },
  loadReaderSettings: async () => settings,
  getTitlePreference: async () => ({ mediaId: 1, preferredGroup: 'A', updatedAt: 0 }),
  recordHealth: async (sourceId, outcome, kind) => {
    healthCalls.push(`${sourceId}:${outcome}:${kind}`);
  },
});

assert(ready.status === 'ready', 'successful page resolution returns ready');
if (ready.status === 'ready') {
  assert(ready.title === title, 'ready result carries title');
  assert(ready.source.id === 'primary', 'ready result carries source');
  assert(ready.pageUrls.length === 2, 'ready result carries page urls');
  assert(ready.chapters.length === 2, 'ready result carries chapters');
  assert(ready.saved?.page === 2, 'ready result carries saved reader state');
  assert(ready.settings.imageFit === 'width', 'ready result carries default settings');
  assert(ready.titlePreference?.preferredGroup === 'A', 'ready result carries title preference');
}
assert(phases.includes('loading'), 'successful session reports loading phase');
assert(healthCalls.includes('primary:success:page-load'), 'successful page load records health');

const missingSourceRedirect = await resolveReaderChapterSession({
  mediaId: 1,
  sourceId: 'removed',
  seriesUrl: 'https://removed.example/series',
  chapterUrl: 'https://removed.example/chapter-12',
}, {
  media: async () => title,
  getSource: async () => undefined,
  enabledSources: async () => [source('fallback')],
  resolveChapters: async (s) => resolution(s.id, [chapter('12')]),
});
assert(missingSourceRedirect.status === 'redirect', 'missing source can redirect to another source');
assert(
  missingSourceRedirect.status === 'redirect' && missingSourceRedirect.route.includes('/reader/1/fallback/'),
  'missing source redirect uses fallback source',
);

let pageAttempts = 0;
const fallbackPhases: ReaderSessionPhase[] = [];
const pageFallback = await resolveReaderChapterSession({
  mediaId: 1,
  sourceId: 'broken',
  seriesUrl: 'https://broken.example/series',
  chapterUrl: 'https://broken.example/chapter-5',
  onPhase: (phase) => fallbackPhases.push(phase),
}, {
  media: async () => title,
  getSource: async () => source('broken'),
  getPages: async () => {
    pageAttempts++;
    throw new Error(`page fail ${pageAttempts}`);
  },
  recordHealth: async () => {},
  findFallbackChapter: async () => ({
    source: source('healthy'),
    seriesUrl: 'https://healthy.example/series',
    chapter: chapter('5'),
  }),
  retryDelayMs: 1,
});
assert(pageAttempts === 2, 'page extraction retries once before fallback');
assert(pageFallback.status === 'redirect', 'page failure can redirect to fallback source');
assert(
  pageFallback.status === 'redirect' && pageFallback.route.includes('/reader/1/healthy/'),
  'page fallback redirect uses healthy source',
);
assert(fallbackPhases.includes('retrying'), 'page failure reports retrying phase');
assert(fallbackPhases.includes('fallback'), 'page failure reports fallback phase');

try {
  await resolveReaderChapterSession({
    mediaId: 99,
    sourceId: 'missing-title',
    seriesUrl: '',
    chapterUrl: '',
  }, {
    media: async () => undefined,
  });
  assert(false, 'missing catalog title should throw');
} catch (e) {
  assert(String(e).includes('Catalog title 99'), 'missing catalog title error is clear');
}

if (failures) {
  console.error(`\n${failures} reader chapter session check(s) failed`);
  process.exit(1);
}
console.log('\nall reader chapter session checks passed');
