import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { mappedTrackerProgress, pushProgress } from '../src/lib/tracker/sync.ts';
import { trackerChapterNumber } from '../src/lib/tracker/adapters/base.ts';
import type { Title } from '../src/lib/catalog/types.ts';

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

assert(trackerChapterNumber(3.5) === 3, 'fractional chapter floors to 3');
assert(trackerChapterNumber(3) === 3, 'integer chapter stays 3');
assert(trackerChapterNumber(-1) === 0, 'negative chapter clamps to 0');
assert(mappedTrackerProgress(12.9) === 12, 'mappedTrackerProgress floors to integer');

const title: Title = {
  id: 101,
  title: { english: 'Sync Test Title' },
  country: 'JP',
  chapters: 12,
};

const emptyResult = await pushProgress(title, 5, 'READING');
assert(emptyResult.pushed.length === 0, 'no connected trackers means nothing pushed');
assert(emptyResult.failed.length === 0, 'no connected trackers means no failures');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});

if (failures) {
  console.error(`\n${failures} tracker-sync check(s) failed`);
  process.exit(1);
}

console.log('\nall tracker-sync checks passed');
