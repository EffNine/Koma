import type { Title } from '../src/lib/catalog/types.ts';
import type { ChapterResolution } from '../src/lib/media/chapterResolver.ts';
import { resolveTitleChapterSource } from '../src/lib/media/titleChapterSource.ts';
import type { ScrapedChapter } from '../src/lib/scraper/engine.ts';
import type { Source } from '../src/lib/scraper/sources.ts';
import type { SourceHealth } from '../src/lib/scraper/sourceHealth.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  } else {
    console.log('ok: ' + msg);
  }
}

function source(id: string, priority = 0): Source {
  return {
    id,
    name: id,
    url: `https://${id}.example/`,
    enabled: true,
    priority,
    addedAt: 0,
  };
}

function chapter(number: string): ScrapedChapter {
  return {
    url: `https://source.example/chapter-${number}`,
    number,
    title: `Chapter ${number}`,
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

function health(
  sourceId: string,
  successes: number,
  failures: number,
  lastSuccessAt?: number,
  lastFailureAt?: number,
): SourceHealth {
  return {
    sourceId,
    chapterResolutionSuccesses: successes,
    chapterResolutionFailures: failures,
    pageLoadSuccesses: 0,
    pageLoadFailures: 0,
    lastSuccessAt,
    lastFailureAt,
    updatedAt: 0,
  };
}

const title: Title = {
  id: 1,
  title: { romaji: 'Test Title' },
};

const noSources = await resolveTitleChapterSource(title, {
  enabledSources: async () => [],
  getTitlePreference: async () => undefined,
  loadSourceHealth: async () => ({}),
});
assert(noSources.status === 'no-sources', 'no enabled sources returns no-sources');
assert(noSources.sources.length === 0, 'no-sources has empty source list');

const preferredSources = [source('a', 0), source('b', 1)];
const preferredCalls: string[] = [];
const preferred = await resolveTitleChapterSource(title, {
  enabledSources: async () => preferredSources,
  getTitlePreference: async () => ({ mediaId: 1, preferredSourceId: 'b', updatedAt: 0 }),
  loadSourceHealth: async () => ({}),
  resolveChapters: async (s) => {
    preferredCalls.push(s.id);
    return resolution(s.id, [chapter('1')]);
  },
});
assert(preferred.status === 'resolved', 'preferred healthy source resolves');
assert(preferred.status === 'resolved' && preferred.source.id === 'b', 'healthy preferred source is tried first');
assert(preferredCalls[0] === 'b', 'resolver order starts with preferred source');

const unhealthyPreferredSources = [source('healthy', 0), source('unhealthy', 1)];
const unhealthyPreferred = await resolveTitleChapterSource(title, {
  enabledSources: async () => unhealthyPreferredSources,
  getTitlePreference: async () => ({ mediaId: 1, preferredSourceId: 'unhealthy', updatedAt: 0 }),
  loadSourceHealth: async () => ({
    healthy: health('healthy', 10, 0, 200),
    unhealthy: health('unhealthy', 1, 9, 100, 300),
  }),
  resolveChapters: async (s) => resolution(s.id, [chapter('2')]),
});
assert(
  unhealthyPreferred.status === 'resolved' && unhealthyPreferred.source.id === 'healthy',
  'unhealthy preferred source is not boosted',
);

const fallbackSources = [source('empty', 0), source('throws', 1), source('working', 2)];
const fallbackCalls: string[] = [];
const fallback = await resolveTitleChapterSource(title, {
  enabledSources: async () => fallbackSources,
  getTitlePreference: async () => undefined,
  loadSourceHealth: async () => ({}),
  resolveChapters: async (s) => {
    fallbackCalls.push(s.id);
    if (s.id === 'empty') return resolution(s.id, []);
    if (s.id === 'throws') throw new Error('source failed');
    return resolution(s.id, [chapter('3')]);
  },
});
assert(fallback.status === 'resolved', 'resolver skips empty and throwing sources');
assert(fallback.status === 'resolved' && fallback.source.id === 'working', 'working source is selected');
assert(
  fallbackCalls.join(',') === 'empty,throws,working',
  'sources are tried in ranked order until one resolves',
);

const notFound = await resolveTitleChapterSource(title, {
  enabledSources: async () => [source('a')],
  getTitlePreference: async () => undefined,
  loadSourceHealth: async () => ({}),
  resolveChapters: async () => ({ err: 'no match' }),
});
assert(notFound.status === 'not-found', 'all misses returns not-found');
assert(
  notFound.status === 'not-found' && notFound.message.includes('This title was not found on a'),
  'not-found includes user-facing message',
);

if (failures) {
  console.error(`\n${failures} title chapter source check(s) failed`);
  process.exit(1);
}
console.log('\nall title chapter source checks passed');
