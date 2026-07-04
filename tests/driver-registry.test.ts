// Deterministic checks for the pluggable driver registry and source manifest import/export.
import 'fake-indexeddb/auto';
import { DRIVERS, driverFor, registerDriver, type ScraperDriver } from '../src/lib/scraper/driver.ts';
import { htmlDriver } from '../src/lib/scraper/htmlDriver.ts';
import { comickDriver } from '../src/lib/scraper/comickDriver.ts';
import { comickApiDriver } from '../src/lib/scraper/comickApiDriver.ts';
import { db } from '../src/lib/db.ts';
import { exportSources, importSources, type Source } from '../src/lib/scraper/sources.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL: ' + msg); failures++; }
  else console.log('ok: ' + msg);
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

// Registry
assert(DRIVERS.html === htmlDriver, 'html driver registered');
assert(DRIVERS.comick === comickDriver, 'comick driver registered');
assert(DRIVERS['comick-api'] === comickApiDriver, 'comick-api driver registered');

const htmlSource: Source = { id: 'html.example', name: 'HTML', url: 'https://html.example/', preset: 'madara', enabled: true, priority: 0, addedAt: 0 };
const comickSource: Source = { id: 'comickz.co.uk', name: 'ComicK', url: 'https://comickz.co.uk/', preset: 'comick', enabled: true, priority: 0, addedAt: 0 };
const comickApiSource: Source = { id: 'api.comick.io', name: 'ComicK API', url: 'https://api.comick.io/', preset: 'comick-api', enabled: true, priority: 0, addedAt: 0 };

assert(driverFor(htmlSource) === htmlDriver, 'driverFor resolves html preset');
assert(driverFor(comickSource) === comickDriver, 'driverFor resolves comick preset');
assert(driverFor(comickApiSource) === comickApiDriver, 'driverFor resolves comick-api preset');

let called = false;
const testDriver: ScraperDriver = {
  async findSeries() { called = true; return null; },
  async getChapters() { return []; },
  async getPages() { return []; },
};
registerDriver('html', testDriver);
const htmlTestSource: Source = { ...htmlSource, url: 'https://html-test.example/', id: 'html-test.example' };
await driverFor(htmlTestSource).findSeries(htmlTestSource, 'test');
assert(called, 'registerDriver can override a driver');
registerDriver('html', htmlDriver); // restore

// verify restoration
assert(driverFor(htmlSource).findSeries === htmlDriver.findSeries, 'html driver restored');

// Source manifest import/export
await db.sources.clear();
const manifest = [
  { id: 'comickz.co.uk', name: 'ComicK', url: 'https://comickz.co.uk/', preset: 'comick', enabled: true, priority: 0 },
  { id: 'api.comick.io', name: 'ComicK API', url: 'https://api.comick.io/', preset: 'comick-api', enabled: true, priority: 1 },
];
const imported = await importSources(JSON.stringify(manifest));
assert(imported.length === 2, 'importSources imports manifest sources');
assert(imported[0]?.id === 'comickz.co.uk', 'import preserves source id');

const wrapped = await importSources(JSON.stringify({ sources: manifest.slice(1) }));
assert(wrapped.length === 1, 'importSources accepts {sources: [...]} wrapper');

const exported = await exportSources();
assert(exported.includes('"sources"'), 'exportSources produces {sources: [...]} wrapper');
assert(exported.includes('comickz.co.uk'), 'export includes comick source');
assert(exported.includes('api.comick.io'), 'export includes comick-api source');

try {
  await importSources('not json');
  assert(false, 'importSources rejects invalid JSON');
} catch {
  assert(true, 'importSources rejects invalid JSON');
}

try {
  await importSources('{}');
  assert(false, 'importSources rejects empty object without sources array');
} catch {
  assert(true, 'importSources rejects empty object without sources array');
}

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall driver registry checks passed');
