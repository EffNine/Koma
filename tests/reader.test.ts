import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import {
  deriveDirection,
  loadReaderState,
  saveReaderState,
  loadLastReaderStateForMedia,
} from '../src/lib/reader/state.ts';
import {
  preferredGroupForChapter,
  selectAdjacentChapter,
  sameNumberChapters,
} from '../src/lib/reader/chapterNavigation.ts';
import { categorizeFailure } from '../src/lib/reader/chapterLoader.ts';
import type { ScrapedChapter } from '../src/lib/scraper/engine';

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

await resetDb();

assert(deriveDirection('JP') === 'rtl', 'JP defaults to rtl manga paging');
assert(deriveDirection('KR') === 'vertical', 'KR uses vertical webtoon scroll');
assert(deriveDirection('CN') === 'ltr', 'CN uses ltr paging');
assert(deriveDirection(null) === 'rtl', 'null country falls back to rtl');
assert(deriveDirection(undefined) === 'rtl', 'undefined country falls back to rtl');

const chapterGroups: ScrapedChapter[] = [
  chapter('29', 'Asura'),
  chapter('29', 'Flame'),
  chapter('30', 'Flame'),
  chapter('31', 'Flame'),
  chapter('34', 'Flame'),
  chapter('35', 'Asura'),
  chapter('35', 'Flame'),
  chapter('36', 'Asura'),
];

assert(
  selectAdjacentChapter(chapterGroups, url('29', 'Asura'), 'next', 'Asura')?.url === url('30', 'Flame'),
  'next falls back to another group when preferred group is missing the next chapter',
);
assert(
  selectAdjacentChapter(chapterGroups, url('30', 'Flame'), 'next', 'Asura')?.url === url('31', 'Flame'),
  'next keeps using the fallback group while preferred group is still missing',
);
assert(
  selectAdjacentChapter(chapterGroups, url('34', 'Flame'), 'next', 'Asura')?.url === url('35', 'Asura'),
  'next switches back to the preferred group when it has the chapter again',
);
assert(
  selectAdjacentChapter(chapterGroups, url('35', 'Asura'), 'prev', 'Asura')?.url === url('34', 'Flame'),
  'prev also falls back when preferred group is missing the previous chapter',
);

const duplicateNumbers: ScrapedChapter[] = [
  chapter('1', 'Asura'),
  chapter('1', 'Flame'),
  chapter('2', 'Asura'),
  chapter('2', 'Flame'),
];
assert(
  selectAdjacentChapter(duplicateNumbers, url('1', 'Asura'), 'next', 'Asura')?.url === url('2', 'Asura'),
  'next skips same-number duplicate uploads from other groups',
);
assert(
  preferredGroupForChapter(duplicateNumbers, url('1', 'Asura')) === 'Asura',
  'reader captures the initial chapter group as the preferred group',
);
assert(
  preferredGroupForChapter(duplicateNumbers, url('1', 'Flame'), 'Asura') === 'Asura',
  'saved preferred group overrides the initial chapter group',
);
assert(
  preferredGroupForChapter(duplicateNumbers, url('1', 'Flame'), undefined) === 'Flame',
  'no saved preferred group falls back to the current chapter group',
);

// sameNumberChapters tests
const multiGroupChapters: ScrapedChapter[] = [
  chapter('30', 'Asura'),
  chapter('30', 'Flame'),
  chapter('30', 'Reaper'),
  chapter('31', 'Flame'),
  chapter('32', 'Asura'),
];

const altsForAsura30 = sameNumberChapters(multiGroupChapters, url('30', 'Asura'));
assert(altsForAsura30.length === 2, 'sameNumberChapters finds 2 alternatives for ch 30');
assert(altsForAsura30.some((c) => c.group === 'Flame'), 'Flame is an alternative for ch 30');
assert(altsForAsura30.some((c) => c.group === 'Reaper'), 'Reaper is an alternative for ch 30');
assert(!altsForAsura30.some((c) => c.group === 'Asura'), 'current chapter is excluded from alternatives');

const altsForCh31 = sameNumberChapters(multiGroupChapters, url('31', 'Flame'));
assert(altsForCh31.length === 0, 'sameNumberChapters returns empty when no alternatives for ch 31');

const altsForCh32 = sameNumberChapters(multiGroupChapters, url('32', 'Asura'));
assert(altsForCh32.length === 0, 'sameNumberChapters returns empty when only one group for ch 32');

// categorizeFailure tests
assert(
  categorizeFailure(new Error('proxy 502')) === 'The scraper proxy is unavailable or returned an error. Check that the proxy is running and reachable.',
  'categorizeFailure identifies proxy errors',
);
assert(
  categorizeFailure(new Error('No page images were extracted')) === 'The source returned no image URLs for this chapter. The chapter may be unavailable or the source format may have changed.',
  'categorizeFailure identifies no-page errors',
);
assert(
  categorizeFailure(new Error('The operation timed out')) === 'The image fetch timed out. The CDN may be slow or blocking requests. Try retrying or switching groups.',
  'categorizeFailure identifies timeout errors',
);
assert(
  categorizeFailure(new Error('HTTP 403')) === 'The source returned HTTP 403. The chapter may be restricted or unavailable.',
  'categorizeFailure identifies HTTP status errors',
);
assert(
  categorizeFailure(new Error('Something unexpected')) === 'Error: Something unexpected',
  'categorizeFailure passes through unknown errors',
);

// Reader state persistence
await saveReaderState({
  mediaId: 42,
  sourceId: 'src-a',
  chapterUrl: 'https://example.com/ch/1',
  page: 7,
  direction: 'ltr',
  imageFit: 'original',
});
const loaded = await loadReaderState(42, 'src-a', 'https://example.com/ch/1');
assert(loaded?.page === 7, 'loadReaderState restores saved page');
assert(loaded?.direction === 'ltr', 'loadReaderState restores saved direction');
assert(loaded?.imageFit === 'original', 'loadReaderState restores saved image fit');

// Updating the same key overwrites state
await saveReaderState({
  mediaId: 42,
  sourceId: 'src-a',
  chapterUrl: 'https://example.com/ch/1',
  page: 12,
  direction: 'vertical',
  imageFit: 'screen',
});
const updated = await loadReaderState(42, 'src-a', 'https://example.com/ch/1');
assert(updated?.page === 12, 'saveReaderState overwrites page');
assert(updated?.direction === 'vertical', 'saveReaderState overwrites direction');
assert(updated?.imageFit === 'screen', 'saveReaderState overwrites image fit');

// Last state for media picks the most recently updated
await saveReaderState({
  mediaId: 99,
  sourceId: 'src-old',
  chapterUrl: 'https://example.com/ch/old',
  page: 1,
  direction: 'rtl',
});
await new Promise((resolve) => setTimeout(resolve, 30));
await saveReaderState({
  mediaId: 99,
  sourceId: 'src-new',
  chapterUrl: 'https://example.com/ch/new',
  page: 5,
  direction: 'ltr',
});
const last = await loadLastReaderStateForMedia(99);
assert(last?.sourceId === 'src-new', 'loadLastReaderStateForMedia returns the most recent source');
assert(last?.page === 5, 'loadLastReaderStateForMedia returns the most recent page');

await resetDb();

if (failures) {
  console.error(`\n${failures} reader check(s) failed`);
  process.exit(1);
}

console.log('\nall reader checks passed');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});

function chapter(number: string, group: string): ScrapedChapter {
  return {
    url: url(number, group),
    number,
    title: `Chapter ${number}`,
    group,
  };
}

function url(number: string, group: string): string {
  return `https://source.example/chapter-${number}-${group.toLowerCase()}`;
}
