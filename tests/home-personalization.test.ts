import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { buildGenreSuggestions } from '../src/lib/media/genreSuggestions.ts';
import {
  isPinned,
  listPinnedMediaIds,
  loadPinnedTitles,
  togglePinned,
} from '../src/lib/media/pinnedTitles.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function installLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    },
  });
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

installLocalStorage();
await resetDb();
localStorage.clear();

assert((await buildGenreSuggestions()).length === 0, 'genre suggestions are empty without followed titles');
assert(!(await isPinned(1)), 'title starts unpinned');
assert(await togglePinned(1), 'toggle pins title');
assert(await isPinned(1), 'pinned title is detected');
assert(!(await togglePinned(1)), 'toggle unpins title');
assert(!(await isPinned(1)), 'unpinned title is detected');

for (let id = 1; id <= 6; id++) await togglePinned(id);
const pinnedIds = await listPinnedMediaIds();
assert(pinnedIds.length === 5, 'pinned list is capped at five');
assert(!pinnedIds.includes(1), 'oldest pin is removed when capped');

await db.trackedTitles.put({
  mediaId: 2,
  name: 'Pinned Two',
  followed: true,
  followedAt: 1,
  updatedAt: 1,
});
const pinnedTitles = await loadPinnedTitles();
assert(pinnedTitles.length === 1 && pinnedTitles[0]?.name === 'Pinned Two', 'loads pinned titles from tracked library rows');

await resetDb();

if (failures) {
  console.error(`\n${failures} home-personalization check(s) failed`);
  process.exit(1);
}
console.log('\nall home-personalization checks passed');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});
