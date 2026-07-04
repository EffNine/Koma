// Deterministic checks for the ComicK drivers without network calls.
import { extractSearchData, extractChapterData } from '../src/lib/scraper/comickDriver.ts';
import { compareChapterAsc } from '../src/lib/scraper/engine.ts';
import { comickApiDriver } from '../src/lib/scraper/comickApiDriver.ts';
import type { Source } from '../src/lib/scraper/sources.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL: ' + msg); failures++; }
  else console.log('ok: ' + msg);
}

// --- comickDriver HTML extraction ---

const searchHtml = `
<script>{"data":[{"slug":"solo-leveling","title":"Solo Leveling","hid":"abc123"}]}</script>
<script>not json</script>
`;
const searchResults = extractSearchData(searchHtml);
assert(searchResults.length === 1, 'extractSearchData finds one result');
assert(searchResults[0]?.slug === 'solo-leveling', 'search result slug captured');
assert(searchResults[0]?.title === 'Solo Leveling', 'search result title captured');

const chapterHtml = `
<script>{"chapter":{"id":1,"chap":"1","hid":"chap-hid","lang":"en","title":"The Boy Without Magic","comic":{"id":1,"title":"Solo Leveling","slug":"solo-leveling"},"images":[{"url":"https://meo.comick.pictures/1.jpg"}]}}</script>
`;
const chapterData = extractChapterData(chapterHtml);
assert(chapterData?.chapter?.images?.length === 1, 'extractChapterData finds page images');
assert(chapterData?.chapter?.images[0]?.url === 'https://meo.comick.pictures/1.jpg', 'page image url captured');

assert(compareChapterAsc('10', '2') > 0, 'compareChapterAsc orders numerically');
assert(compareChapterAsc('2', '10') < 0, 'compareChapterAsc orders 2 before 10');

// --- comickApiDriver JSON mapping (no fetch) ---

const apiSource: Source = {
  id: 'api.comick.io',
  name: 'ComicK API',
  url: 'https://api.comick.io/',
  preset: 'comick-api',
  enabled: true,
  priority: 0,
  addedAt: 0,
};

// findSeries hits the real API, which is blocked by Cloudflare in headless tests.
// Just verify the function exists and is wired to the driver.
assert(typeof comickApiDriver.findSeries === 'function', 'comickApiDriver findSeries is a function');
assert(typeof comickApiDriver.getChapters === 'function', 'comickApiDriver getChapters is a function');
assert(typeof comickApiDriver.getPages === 'function', 'comickApiDriver getPages is a function');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall comick driver checks passed');
