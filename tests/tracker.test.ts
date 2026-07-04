import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import type { Title } from '../src/lib/catalog/types.ts';
import {
  followTitle,
  getProgress,
  isFollowed,
  listHistory,
  markChapterUnread,
  recordChapterRead,
  recordReaderPage,
  setChapterReadHook,
  unfollowTitle,
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

await resetDb();

const title: Title = {
  id: 101,
  title: { english: 'Stage Four Title' },
  country: 'JP',
  chapters: 12,
};

await followTitle(title, 100);
assert(await isFollowed(title.id), 'followTitle marks title followed');

await unfollowTitle(title.id);
assert(!(await isFollowed(title.id)), 'unfollowTitle clears followed state');

await recordChapterRead({
  title,
  sourceId: 'asurascans.com',
  chapterUrl: 'https://asurascans.com/chapter-2',
  chapterNumber: '2',
  chapterTitle: 'Chapter 2',
  readAt: 200,
});
await recordChapterRead({
  title,
  sourceId: 'asurascans.com',
  chapterUrl: 'https://asurascans.com/chapter-5',
  chapterNumber: '5',
  chapterTitle: 'Chapter 5',
  readAt: 500,
});

let progress = await getProgress(title.id, 'asurascans.com');
assert(progress?.chapterNumber === '5', 'read chapter 5 advances progress to 5');
assert(progress?.status === 'READING', 'incomplete title remains reading');

progress = await markChapterUnread(title.id, 'asurascans.com', '3');
assert(progress?.chapterNumber === '2', 'mark chapter 3 unread rolls progress back to 2');

progress = await recordChapterRead({
  title,
  sourceId: 'asurascans.com',
  chapterUrl: 'https://asurascans.com/chapter-13',
  chapterNumber: '13',
  chapterTitle: 'Chapter 13',
  readAt: 1300,
});
assert(progress.status === 'COMPLETED', 'advance past total chapters marks completed');

const history = await listHistory();
assert(history.length >= 3, 'chapter reads create history entries');
assert(history[0]?.chapterNumber === '13', 'history sorts newest read first');

let hookCalls = 0;
setChapterReadHook(() => {
  hookCalls += 1;
});

await recordReaderPage({
  title,
  sourceId: 'asurascans.com',
  chapterUrl: 'https://asurascans.com/chapter-14',
  chapterNumber: '14',
  chapterTitle: 'Chapter 14',
  page: 1,
  totalPages: 3,
  readAt: 1400,
});
assert(hookCalls === 0, 'reader page progress before the last page does not push trackers');

await recordReaderPage({
  title,
  sourceId: 'asurascans.com',
  chapterUrl: 'https://asurascans.com/chapter-14',
  chapterNumber: '14',
  chapterTitle: 'Chapter 14',
  page: 2,
  totalPages: 3,
  readAt: 1500,
});
progress = await getProgress(title.id, 'asurascans.com');
assert(progress?.chapterNumber === '14', 'reader reaching the last page marks the chapter read');
assert(hookCalls === 1, 'reader reaching the last page pushes tracker sync once');

await recordReaderPage({
  title,
  sourceId: 'asurascans.com',
  chapterUrl: 'https://asurascans.com/chapter-14',
  chapterNumber: '14',
  chapterTitle: 'Chapter 14',
  page: 2,
  totalPages: 3,
  readAt: 1600,
});
assert(hookCalls === 1, 're-saving the same completed reader page does not push tracker sync again');
setChapterReadHook(undefined);

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});

if (failures) {
  console.error(`\n${failures} tracker check(s) failed`);
  process.exit(1);
}

console.log('\nall tracker checks passed');
