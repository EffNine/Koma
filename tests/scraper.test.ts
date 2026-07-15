// ponytail: one runnable self-check for the non-trivial scraper extraction logic.
// Pure — no network, no Tauri. DOMParser polyfilled from linkedom.
import { DOMParser } from 'linkedom';
import { readFileSync } from 'node:fs';
import { compareChapterDesc, extractSeriesLinks, extractChapters, extractPages, parseChapterNumber, matchSeries } from '../src/lib/scraper/engine.ts';
import type { Source } from '../src/lib/scraper/sources';
import { presetById } from '../src/lib/scraper/presets';

globalThis.DOMParser = DOMParser as unknown as typeof DOMParser;

const madara: Source = {
  id: 'manga.example',
  name: 'ex',
  url: 'https://manga.example/',
  preset: 'madara',
  enabled: true,
  addedAt: 0,
};

const asura: Source = {
  id: 'asurascans.com',
  name: 'Asura Scans',
  url: 'https://asurascans.com/',
  preset: 'asura',
  enabled: true,
  addedAt: 0,
};

const mangaFire: Source = {
  id: 'mangafire.to',
  name: 'MangaFire',
  url: 'https://mangafire.to/',
  preset: 'mangafire',
  enabled: true,
  addedAt: 0,
};

const mangaPill: Source = {
  id: 'mangapill.com',
  name: 'MangaPill',
  url: 'https://mangapill.com/',
  preset: 'mangapill',
  enabled: true,
  addedAt: 0,
};

const weebCentral: Source = {
  id: 'weebcentral.com',
  name: 'WeebCentral',
  url: 'https://weebcentral.com/',
  preset: 'weebcentral',
  enabled: true,
  addedAt: 0,
};

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL: ' + msg); failures++; }
  else console.log('ok: ' + msg);
}

const series = extractSeriesLinks(readFileSync('tests/fixtures/madara-search.html', 'utf8'), madara);
assert(series.length === 2, 'search finds 2 series');
assert(series[0].url === 'https://manga.example/one-piece/', 'series[0] is one-piece');
assert(matchSeries(series, 'one piece')?.url === 'https://manga.example/one-piece/', 'matchSeries picks one piece');
assert(matchSeries(series, 'bleach') === null, 'matchSeries returns null when nothing matches');
assert(matchSeries(series, '나태 공자, 노력 천재 되다') === null, 'matchSeries returns null for non-empty aliases that normalize to nothing');

const chaps = extractChapters(readFileSync('tests/fixtures/madara-chapters.html', 'utf8'), madara);
assert(chaps.length === 3, '3 chapters found');
assert(chaps[0].number === '2', 'sorted ascending → first is ch 2');
assert(chaps[2].number === '1050', 'last is ch 1050');
assert(chaps[2].url.endsWith('chapter-1050/'), 'chapter url resolved absolute');

const pages = extractPages(readFileSync('tests/fixtures/madara-chapter.html', 'utf8'), madara);
assert(pages.length === 3, '3 pages');
assert(pages[0].endsWith('/1.jpg'), 'page0 uses data-src over placeholder src');
assert(pages[2].endsWith('/3.jpg'), 'page2 falls back to src');

const spacedAttrPages = extractPages(
  '<div class="reading-content"><div class="page-break"><img data-src=" https://cdn.example/one-piece/4.jpg" /></div></div>',
  madara,
);
assert(spacedAttrPages[0] === 'https://cdn.example/one-piece/4.jpg', 'page image attrs are trimmed before validation');
assert(['1', '1186', '10'].toSorted(compareChapterDesc).join(',') === '1186,10,1', 'chapter display sort puts latest chapter first');

assert(parseChapterNumber('Chapter 12.5') === '12.5', 'parse decimal chapter');
assert(parseChapterNumber('Vol.2 Ch. 7') === '2', 'parse first number (ponytail: volume taken as first number)');

const asuraSearch = extractSeriesLinks(
  `
  <div class="series-card">
    <a href="/comics/solo-leveling-fc4c7eba"><h3>Solo Leveling</h3></a>
  </div>
  <div class="series-card">
    <a href="/comics/solo-leveling-ragnarok-fc4c7eba"><h3>Solo Leveling: Ragnarok</h3></a>
  </div>
  `,
  asura,
);
assert(asuraSearch.length === 2, 'asura search selectors find 2 series');
assert(matchSeries(asuraSearch, 'solo leveling')?.url.endsWith('/comics/solo-leveling-fc4c7eba'), 'asura matchSeries picks solo leveling');

const asuraChapters = extractChapters(
  `
  <a href="/comics/solo-leveling-fc4c7eba/chapter/201">Chapter 201</a>
  <a href="/comics/solo-leveling-fc4c7eba/chapter/200">Chapter 200</a>
  <a href="/comics/solo-leveling-fc4c7eba/chapter/199">Chapter 199</a>
  `,
  asura,
);
assert(asuraChapters.length === 3, 'asura chapter selectors find chapters');
assert(asuraChapters[0].number === '199', 'asura chapters are sorted ascending');

const asuraPages = extractPages(
  `
  <div class="select-none">
    <img src="https://cdn.asurascans.com/asura-images/chapters/solo/200/001.webp" />
    <img src="https://cdn.asurascans.com/asura-images/chapters/solo/200/002.webp" />
  </div>
  `,
  asura,
);
assert(asuraPages.length === 2, 'asura chapter page selectors find images');

const mangaFireSearch = extractSeriesLinks(
  `
  <div class="unit">
    <div class="info"><a href="/manga/one-piecee.dkw">One Piece</a></div>
  </div>
  <div class="swiper-slide">
    <div class="above"><a class="unit" href="/manga/berserkk.m2vv">Berserk</a></div>
  </div>
  `,
  mangaFire,
);
assert(mangaFireSearch.length === 2, 'mangafire fallback search scans home-page cards');

const mangaFireChapters = extractChapters(
  `
  <section class="m-list">
    <div class="list-body">
      <ul class="scroll-sm">
        <li class="item" data-number="2"><a href="/read/one-piecee.dkw/en/chapter-2"><span>Chapter 2</span></a></li>
        <li class="item" data-number="1"><a href="/read/one-piecee.dkw/en/chapter-1"><span>Chapter 1</span></a></li>
      </ul>
    </div>
  </section>
  `,
  mangaFire,
);
assert(mangaFireChapters.length === 2, 'mangafire chapter selectors find chapter list');
assert(mangaFireChapters[0].number === '1', 'mangafire chapters are sorted ascending');

// ── MangaPill preset ──
const mangaPillSearch = extractSeriesLinks(
  `
  <a href="/manga/2/one-piece" class="relative block">
    <h2 class="font-bold">One Piece</h2>
  </a>
  <a href="/manga/3/naruto" class="relative block">
    <h3 class="font-bold">Naruto</h3>
  </a>
  `,
  mangaPill,
);
assert(mangaPillSearch.length === 2, 'mangapill search finds 2 series');
assert(mangaPillSearch[0].title === 'One Piece', 'mangapill search extracts title');

const mangaPillChapters = extractChapters(
  `
  <div id="chapters">
    <a href="/chapters/2-11186000/one-piece-chapter-1186">Chapter 1186</a>
    <a href="/chapters/2-11185000/one-piece-chapter-1185">Chapter 1185</a>
  </div>
  `,
  mangaPill,
);
assert(mangaPillChapters.length === 2, 'mangapill chapter selectors find chapters');
assert(mangaPillChapters[0].number === '1185', 'mangapill chapters sorted ascending');

const mangaPillPages = extractPages(
  `
  <img class="js-page" data-src="https://cdn.readdetectiveconan.com/file/mangapill/1.webp" />
  <img class="js-page" data-src="https://cdn.readdetectiveconan.com/file/mangapill/2.webp" />
  `,
  mangaPill,
);
assert(mangaPillPages.length === 2, 'mangapill page selectors find images');
assert(mangaPillPages[0].includes('1.webp'), 'mangapill page uses data-src');

// ── WeebCentral preset ──
const weebCentralSearch = extractSeriesLinks(
  `
  <article>
    <a href="/series/01J76XY123/solo-leveling" class="link">
      <span data-tip="Solo Leveling">Solo Leveling</span>
    </a>
  </article>
  <article>
    <a href="/series/01J76XY456/one-piece" class="link">
      <span data-tip="One Piece">One Piece</span>
    </a>
  </article>
  `,
  weebCentral,
);
assert(weebCentralSearch.length === 2, 'weebcentral search finds 2 series');
assert(weebCentralSearch[0].title === 'Solo Leveling', 'weebcentral search extracts title');

const weebCentralChapters = extractChapters(
  `
  <a href="/chapters/01J76XY789/chapter-1">Chapter 1</a>
  <a href="/chapters/01J76XY790/chapter-2">Chapter 2</a>
  `,
  weebCentral,
);
assert(weebCentralChapters.length === 2, 'weebcentral chapter selectors find chapters');
assert(weebCentralChapters[0].number === '1', 'weebcentral chapters sorted ascending');

const weebCentralPages = extractPages(
  `
  <main>
    <section>
      <img alt="Page 1" src="https://cdn.weebcentral.com/page1.webp" />
      <img alt="Page 2" src="https://cdn.weebcentral.com/page2.webp" />
    </section>
  </main>
  `,
  weebCentral,
);
assert(weebCentralPages.length === 2, 'weebcentral page selectors find images');
assert(weebCentralPages[0].includes('page1.webp'), 'weebcentral page uses src');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall scraper checks passed');
