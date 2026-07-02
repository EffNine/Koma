import 'fake-indexeddb/auto';
import { htmlDriver } from '../src/lib/scraper/htmlDriver.ts';
import { mangaDexDriver } from '../src/lib/scraper/mangaDexDriver.ts';
import { comickDriver } from '../src/lib/scraper/comickDriver.ts';
import { comickApiDriver } from '../src/lib/scraper/comickApiDriver.ts';
import type { Source } from '../src/lib/scraper/sources.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL: ' + msg); failures++; }
  else console.log('ok: ' + msg);
}

// The html driver is tested via the existing engine fixtures; here we verify the seam shape.
const madara: Source = {
  id: 'manga.example',
  name: 'ex',
  url: 'https://manga.example/',
  preset: 'madara',
  enabled: true,
  priority: 0,
  addedAt: 0,
};

assert(typeof htmlDriver.findSeries === 'function', 'htmlDriver has findSeries');
assert(typeof htmlDriver.getChapters === 'function', 'htmlDriver has getChapters');
assert(typeof htmlDriver.getPages === 'function', 'htmlDriver has getPages');

assert(typeof mangaDexDriver.findSeries === 'function', 'mangaDexDriver has findSeries');
assert(typeof mangaDexDriver.getChapters === 'function', 'mangaDexDriver has getChapters');
assert(typeof mangaDexDriver.getPages === 'function', 'mangaDexDriver has getPages');

assert(htmlDriver.findSeries.length === 2, 'htmlDriver.findSeries takes 2 args');
assert(mangaDexDriver.findSeries.length === 2, 'mangaDexDriver.findSeries takes 2 args');

assert(typeof comickDriver.findSeries === 'function', 'comickDriver has findSeries');
assert(typeof comickDriver.getChapters === 'function', 'comickDriver has getChapters');
assert(typeof comickDriver.getPages === 'function', 'comickDriver has getPages');
assert(comickDriver.findSeries.length === 2, 'comickDriver.findSeries takes 2 args');

assert(typeof comickApiDriver.findSeries === 'function', 'comickApiDriver has findSeries');
assert(typeof comickApiDriver.getChapters === 'function', 'comickApiDriver has getChapters');
assert(typeof comickApiDriver.getPages === 'function', 'comickApiDriver has getPages');
assert(comickApiDriver.findSeries.length === 2, 'comickApiDriver.findSeries takes 2 args');

if (failures) {
  console.error(`\n${failures} driver check(s) failed`);
  process.exit(1);
}

console.log('\nall driver seam checks passed');
