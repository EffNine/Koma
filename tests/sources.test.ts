import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { listSources, type Source } from '../src/lib/scraper/sources.ts';

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

const older: Source = {
  id: 'older.example',
  name: 'Older',
  url: 'https://older.example/',
  preset: 'madara',
  enabled: true,
  addedAt: 10,
};

const newer: Source = {
  id: 'newer.example',
  name: 'Newer',
  url: 'https://newer.example/',
  preset: 'madara',
  enabled: true,
  addedAt: 20,
};

await db.sources.bulkPut([older, newer]);

const rows = await listSources();
assert(rows.length === 2, 'listSources returns saved sources');
assert(rows[0]?.id === newer.id, 'listSources sorts newest source first');
assert(rows[1]?.id === older.id, 'listSources keeps older source after newer one');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall source checks passed');
