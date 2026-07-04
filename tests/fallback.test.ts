import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { type Source } from '../src/lib/scraper/sources.ts';
import type { Title } from '../src/lib/catalog/types.ts';
import type { ScrapedChapter } from '../src/lib/scraper/engine.ts';
import type { ChapterResolution } from '../src/lib/media/chapterResolver.ts';
import {
  extractChapterNumber,
  findFallbackChapter,
  withRetryOnce,
} from '../src/lib/media/fallback.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

async function resetDb() {
  db.close();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('koma');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
  await db.open();
}

function makeSource(id: string, enabled = true, priority = 0): Source {
  return {
    id,
    name: id,
    url: `https://${id}.example/`,
    enabled,
    priority,
    addedAt: 0,
  };
}

function chapter(number: string, group: string): ScrapedChapter {
  return {
    url: `https://source.example/chapter-${number}-${group.toLowerCase()}`,
    number,
    title: `Chapter ${number}`,
    group,
  };
}

function resolution(sourceId: string, chapters: ScrapedChapter[]): ChapterResolution {
  return {
    query: '',
    seriesUrl: `https://${sourceId}.example/series`,
    seriesTitle: 'Test',
    chapters,
    msg: 'ok',
  };
}

const title: Title = {
  id: 1,
  title: { romaji: 'Test Title' },
};

await resetDb();

// withRetryOnce succeeds on second try
let calls = 0;
const succeedOnSecond = () => {
  calls++;
  if (calls === 1) return Promise.reject(new Error('first'));
  return Promise.resolve('ok');
};
const retryResult = await withRetryOnce(succeedOnSecond, 10, () => {});
assert(retryResult === 'ok', 'withRetryOnce returns second-attempt result');
assert(calls === 2, 'withRetryOnce runs exactly twice');

// withRetryOnce throws after two failures
calls = 0;
const alwaysFail = () => {
  calls++;
  return Promise.reject(new Error(`fail ${calls}`));
};
try {
  await withRetryOnce(alwaysFail, 10);
  assert(false, 'withRetryOnce should throw after two failures');
} catch (e) {
  assert(String(e).includes('fail 2'), 'withRetryOnce throws the second error');
  assert(calls === 2, 'withRetryOne runs exactly twice on failure');
}

// extractChapterNumber
assert(extractChapterNumber('https://source.example/chapter-12-foo') === '12', 'extracts integer chapter');
assert(extractChapterNumber('https://source.example/chapter-12.5-foo') === '12.5', 'extracts decimal chapter');
assert(extractChapterNumber('https://source.example/no-numbers') === undefined, 'returns undefined when no number');

// findFallbackChapter: skips current source and disabled, returns matching chapter from next source
const fallbackSources = [
  makeSource('current', true, 0),
  makeSource('fallback', true, 1),
  makeSource('disabled', false, 2),
];
await db.sources.bulkPut(fallbackSources);

const resolver = async (source: Source) => {
  if (source.id === 'current') return { err: 'current is broken' };
  if (source.id === 'fallback') return resolution('fallback', [chapter('12', 'A')]);
  return { err: 'disabled' };
};

const result = await findFallbackChapter(title, 'current', chapter('12', 'A').url, resolver);
assert(result !== null, 'findFallbackChapter returns a fallback');
assert(result?.source.id === 'fallback', 'fallback source is selected');
assert(result?.chapter.number === '12', 'matching chapter number is returned');
assert(result?.seriesUrl === 'https://fallback.example/series', 'fallback seriesUrl is returned');

// findFallbackChapter: returns null when no match
const noMatchResolver = async (source: Source) => {
  if (source.id === 'fallback') return resolution('fallback', [chapter('99', 'A')]);
  return { err: 'broken' };
};
const noMatch = await findFallbackChapter(title, 'current', chapter('12', 'A').url, noMatchResolver);
assert(noMatch === null, 'findFallbackChapter returns null when no matching chapter');

// findFallbackChapter: deprioritizes an unhealthy fallback when a healthy one exists
const healthSources = [
  makeSource('current', true, 0),
  makeSource('unhealthy', true, 1),
  makeSource('healthy', true, 2),
];
await db.sources.clear();
await db.sources.bulkPut(healthSources);

// Record a failure on the unhealthy source and successes on the healthy one
await db.sourceHealth.put({
  sourceId: 'unhealthy',
  chapterResolutionSuccesses: 1,
  chapterResolutionFailures: 9,
  pageLoadSuccesses: 0,
  pageLoadFailures: 0,
  lastFailureAt: 1000,
  updatedAt: 1000,
});
await db.sourceHealth.put({
  sourceId: 'healthy',
  chapterResolutionSuccesses: 10,
  chapterResolutionFailures: 0,
  pageLoadSuccesses: 0,
  pageLoadFailures: 0,
  lastSuccessAt: 2000,
  updatedAt: 2000,
});

const healthResolver = async (source: Source) => {
  if (source.id === 'current') return { err: 'broken' };
  return resolution(source.id, [chapter('7', 'A')]);
};

const healthResult = await findFallbackChapter(title, 'current', chapter('7', 'A').url, healthResolver);
assert(healthResult?.source.id === 'healthy', 'healthy fallback is preferred over unhealthy');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});

if (failures) {
  console.error(`\n${failures} fallback check(s) failed`);
  process.exit(1);
}
console.log('\nall fallback checks passed');
