import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import {
  followTitle,
  setReadingList,
  listTitlesByReadingList,
  autoUpdateReadingList,
  readingListFromStatus,
  readingListFromProgress,
  recordChapterRead,
  type Title,
} from '../src/lib/tracker/local.ts';
import {
  savePreferredSource,
  savePreferredGroup,
  getTitlePreference,
} from '../src/lib/media/titlePreferences.ts';

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

function makeTitle(id: number, name: string, chapters?: number): Title {
  return {
    id,
    title: { romaji: name },
    chapters,
  };
}

await resetDb();

// readingListFromStatus / readingListFromProgress
assert(readingListFromStatus('COMPLETED') === 'Completed', 'status completed maps to Completed list');
assert(readingListFromStatus('READING') === 'Reading', 'status reading maps to Reading list');
assert(readingListFromStatus(undefined, 'Plan to Read') === 'Plan to Read', 'preserves explicit plan to read');
assert(readingListFromProgress(5, 10) === 'Reading', 'progress below total is Reading');
assert(readingListFromProgress(11, 10) === 'Completed', 'progress past total is Completed');
assert(readingListFromProgress(-1) === undefined, 'no progress maps to undefined');

// Save and query reading lists
const alpha = makeTitle(1, 'Alpha');
const beta = makeTitle(2, 'Beta');
const gamma = makeTitle(3, 'Gamma', 5);

await followTitle(alpha);
await followTitle(beta);
await followTitle(gamma);

await setReadingList(1, 'Reading');
await setReadingList(2, 'Plan to Read');
await setReadingList(3, 'Completed');

const reading = await listTitlesByReadingList('Reading');
assert(reading.length === 1 && reading[0]?.mediaId === 1, 'Reading list contains Alpha');

const planning = await listTitlesByReadingList('Plan to Read');
assert(planning.length === 1 && planning[0]?.mediaId === 2, 'Plan to Read list contains Beta');

const completed = await listTitlesByReadingList('Completed');
assert(completed.length === 1 && completed[0]?.mediaId === 3, 'Completed list contains Gamma');

// autoUpdateReadingList infers from progress
await recordChapterRead({
  title: alpha,
  sourceId: 'src-a',
  chapterUrl: 'https://example.com/a/1',
  chapterNumber: '1',
  chapterTitle: 'Chapter 1',
  readAt: 1000,
});
await autoUpdateReadingList(1);
const afterRead = await db.trackedTitles.get(1);
assert(afterRead?.readingList === 'Reading', 'autoUpdate sets Reading after a chapter read');

await recordChapterRead({
  title: gamma,
  sourceId: 'src-c',
  chapterUrl: 'https://example.com/c/6',
  chapterNumber: '6',
  chapterTitle: 'Chapter 6',
  readAt: 2000,
});
await autoUpdateReadingList(3);
const afterComplete = await db.trackedTitles.get(3);
assert(afterComplete?.readingList === 'Completed', 'autoUpdate keeps Completed when past total');

// Title preferences: preferred source and group
await savePreferredSource(1, 'src-a');
let pref = await getTitlePreference(1);
assert(pref?.preferredSourceId === 'src-a', 'saves preferred source');

await savePreferredGroup(1, 'Asura');
pref = await getTitlePreference(1);
assert(pref?.preferredGroup === 'Asura', 'saves preferred group');
assert(pref?.preferredSourceId === 'src-a', 'preferred source survives group update');

await savePreferredSource(1, undefined);
pref = await getTitlePreference(1);
assert(pref?.preferredSourceId === undefined, 'can clear preferred source');
assert(pref?.preferredGroup === 'Asura', 'preferred group survives source clear');

await resetDb();

if (failures) {
  console.error(`\n${failures} library check(s) failed`);
  process.exit(1);
}
console.log('\nall library checks passed');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});
