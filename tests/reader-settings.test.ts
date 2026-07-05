import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { loadReaderSettings, saveReaderSettings } from '../src/lib/reader/settings.ts';

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

// Default settings
const defaults = await loadReaderSettings();
assert(defaults.defaultDirection === 'rtl', 'default direction is rtl');
assert(defaults.imageFit === 'width', 'default image fit is width');
assert(defaults.brightness === 100, 'default brightness is 100');
assert(defaults.contrast === 100, 'default contrast is 100');

// Save and reload
await saveReaderSettings({
  key: 'defaults',
  defaultDirection: 'ltr',
  imageFit: 'screen',
  brightness: 120,
  contrast: 90,
});
const loaded = await loadReaderSettings();
assert(loaded.defaultDirection === 'ltr', 'saved direction is ltr');
assert(loaded.imageFit === 'screen', 'saved image fit is screen');
assert(loaded.brightness === 120, 'saved brightness is 120');
assert(loaded.contrast === 90, 'saved contrast is 90');

// Overwrite
await saveReaderSettings({
  key: 'defaults',
  defaultDirection: 'vertical',
  imageFit: 'original',
  brightness: 80,
  contrast: 110,
});
const overwritten = await loadReaderSettings();
assert(overwritten.defaultDirection === 'vertical', 'overwritten direction is vertical');
assert(overwritten.imageFit === 'original', 'overwritten image fit is original');
assert(overwritten.brightness === 80, 'overwritten brightness is 80');
assert(overwritten.contrast === 110, 'overwritten contrast is 110');

// Partial save (backward compat: missing brightness/contrast)
await saveReaderSettings({
  key: 'defaults',
  defaultDirection: 'rtl',
  imageFit: 'width',
});
const partial = await loadReaderSettings();
assert(partial.brightness === undefined, 'partial save leaves brightness undefined');
assert(partial.contrast === undefined, 'partial save leaves contrast undefined');

await resetDb();

if (failures) {
  console.error(`\n${failures} reader settings check(s) failed`);
  process.exit(1);
}

console.log('\nall reader settings checks passed');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});
