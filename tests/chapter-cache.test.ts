import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import {
  downloadChapter,
  getCacheBreakdownByTitle,
  removeCachedChaptersForMedia,
} from '../src/lib/reader/chapterCache.ts';

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

await db.chapterCache.bulkPut([
  { key: 'ch:1:a:one', mediaId: 1, sourceId: 'a', chapterUrl: 'one', createdAt: 1, sizeBytes: 100 },
  { key: 'ch:1:a:two', mediaId: 1, sourceId: 'a', chapterUrl: 'two', createdAt: 2, sizeBytes: 250 },
  { key: 'ch:2:a:one', mediaId: 2, sourceId: 'a', chapterUrl: 'one', createdAt: 3, sizeBytes: 50 },
]);
await db.chapterCachePages.bulkPut([
  { key: 'ch:1:a:one:p0', chapterKey: 'ch:1:a:one', pageIndex: 0, blob: new Blob(['a']) },
  { key: 'ch:2:a:one:p0', chapterKey: 'ch:2:a:one', pageIndex: 0, blob: new Blob(['b']) },
]);

const breakdown = await getCacheBreakdownByTitle(new Map([[1, 'Alpha']]));
assert(breakdown.length === 2, 'groups cache by media title');
assert(breakdown[0]?.mediaId === 1, 'sorts largest cached title first');
assert(breakdown[0]?.titleName === 'Alpha', 'uses tracked title name');
assert(breakdown[0]?.chapterCount === 2, 'counts cached chapters');
assert(breakdown[1]?.titleName === 'Title 2', 'falls back to title id label');

await removeCachedChaptersForMedia(1);
assert((await db.chapterCache.where('mediaId').equals(1).count()) === 0, 'removes title cache entries');
assert((await db.chapterCachePages.where('chapterKey').equals('ch:1:a:one').count()) === 0, 'removes title cache pages');
assert((await db.chapterCache.where('mediaId').equals(2).count()) === 1, 'keeps other title cache');

const emptyDownload = await downloadChapter(3, 'a', 'empty', [], 'https://example.test/chapter');
assert(emptyDownload.ok, 'empty download reports success');
assert(emptyDownload.failedPages.length === 0, 'empty download has no failed pages');

await resetDb();

if (failures) {
  console.error(`\n${failures} chapter-cache check(s) failed`);
  process.exit(1);
}
console.log('\nall chapter-cache checks passed');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});
