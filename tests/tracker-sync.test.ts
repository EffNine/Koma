import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { importRemoteLibraryEntries, mappedTrackerProgress, pushFollow, pushProgress, pushUnfollow } from '../src/lib/tracker/sync.ts';
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

const emptyFollowResult = await pushFollow(title);
assert(emptyFollowResult.pushed.length === 0, 'no connected trackers means follow is not pushed');
assert(emptyFollowResult.failed.length === 0, 'no connected trackers means follow has no failures');

const emptyUnfollowResult = await pushUnfollow(title.id);
assert(emptyUnfollowResult.pushed.length === 0, 'no connected trackers means unfollow is not pushed');
assert(emptyUnfollowResult.failed.length === 0, 'no connected trackers means unfollow has no failures');

const importResult = await importRemoteLibraryEntries('anilist', [
  {
    title,
    progress: 7,
    status: 'READING',
    remoteStatus: 'CURRENT',
    updatedAt: 700,
  },
  {
    title: {
      id: 202,
      title: { romaji: 'Planning Title' },
      cover: 'https://img.example/cover.jpg',
      country: 'KR',
      chapters: 40,
      status: 'RELEASING',
    },
    progress: 0,
    status: 'READING',
    remoteStatus: 'PLANNING',
    updatedAt: 800,
  },
]);
assert(importResult.importedTitles === 2, 'AniList import reports imported title count');
assert(importResult.importedProgress === 1, 'AniList import only stores non-zero progress rows');

const importedTitle = await db.trackedTitles.get(title.id);
assert(importedTitle?.followed === true, 'AniList import follows imported titles locally');
assert(importedTitle?.name === 'Sync Test Title', 'AniList import snapshots title names');

const importedProgress = await db.progress.get(`${title.id}:anilist`);
assert(importedProgress?.chapterNumberValue === 7, 'AniList import stores remote progress under anilist source');
assert(importedProgress?.status === 'READING', 'AniList import maps remote progress status');

const planningTitle = await db.trackedTitles.get(202);
assert(planningTitle?.followed === true, 'AniList planning entries still appear in local library');
assert(await db.progress.get('202:anilist') === undefined, 'AniList planning entries without progress do not create chapter 0 progress');

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
