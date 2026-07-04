import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { buildContinueReading, buildFollowedUpdates } from '../src/lib/media/continueReading.ts';
import { saveReaderState, loadLastReaderStateForMedia } from '../src/lib/reader/state.ts';
import {
  recordHistory,
  followTitle,
  recordChapterRead,
  type Title,
} from '../src/lib/tracker/local.ts';

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

function makeTitle(id: number, name: string): Title {
  return {
    id,
    title: { romaji: name },
  };
}

await resetDb();

// Empty state
const empty = await buildContinueReading();
assert(empty.length === 0, 'continue reading is empty with no history');

const emptyFollowed = await buildFollowedUpdates();
assert(emptyFollowed.length === 0, 'followed updates is empty with no followed titles');

// Record history entries and a reader state
const titleA: Title = makeTitle(1, 'Alpha');
const titleB: Title = makeTitle(2, 'Beta');

await recordHistory({
  title: titleA,
  sourceId: 'src-a',
  chapterUrl: 'https://example.com/a/1',
  chapterNumber: '1',
  chapterTitle: 'Chapter 1',
  page: 3,
  readAt: 1000,
});

await recordHistory({
  title: titleB,
  sourceId: 'src-b',
  chapterUrl: 'https://example.com/b/5',
  chapterNumber: '5',
  chapterTitle: 'Chapter 5',
  page: 0,
  readAt: 2000,
});

// Reader state for A should override history values
await saveReaderState({
  mediaId: 1,
  sourceId: 'src-a',
  chapterUrl: 'https://example.com/a/2',
  seriesUrl: 'https://example.com/a/series',
  page: 7,
  direction: 'ltr',
  imageFit: 'original',
});

const items = await buildContinueReading();
assert(items.length === 2, 'continue reading deduplicates history by mediaId');
assert(items[0]?.mediaId === 2, 'most recent history title is first');
assert(items[0]?.title === 'Beta', 'title name is loaded from history snapshot');
assert(items[0]?.chapterNumber === '5', 'history chapter number is preserved when no reader state');
assert(items[0]?.page === 0, 'history page is preserved when no reader state');
assert(items[0]?.canResume === false, 'item without seriesUrl cannot resume directly');

assert(items[1]?.mediaId === 1, 'second item is Alpha');
assert(items[1]?.sourceId === 'src-a', 'reader state source overrides history');
assert(items[1]?.chapterUrl === 'https://example.com/a/2', 'reader state chapter overrides history');
assert(items[1]?.seriesUrl === 'https://example.com/a/series', 'reader state seriesUrl is preserved');
assert(items[1]?.page === 7, 'reader state page overrides history');
assert(items[1]?.canResume === true, 'item with sourceId, chapterUrl, and seriesUrl can resume');

// Followed titles updates
await followTitle(titleA);
await recordChapterRead({
  title: titleA,
  sourceId: 'src-a',
  chapterUrl: 'https://example.com/a/1',
  chapterNumber: '1',
  chapterTitle: 'Chapter 1',
  readAt: 1000,
});

const updates = await buildFollowedUpdates();
assert(updates.length === 1, 'followed updates includes title with progress');
assert(updates[0]?.mediaId === 1, 'followed update is for Alpha');
assert(updates[0]?.chapterNumber === '1', 'followed update uses progress chapter number');

await resetDb();

if (failures) {
  console.error(`\n${failures} continue-reading check(s) failed`);
  process.exit(1);
}
console.log('\nall continue-reading checks passed');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});
