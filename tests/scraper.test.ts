// ponytail: one runnable self-check for the non-trivial scraper extraction logic.
// Pure — no network, no Tauri. DOMParser polyfilled from linkedom.
import { DOMParser } from 'linkedom';
import { readFileSync } from 'node:fs';
import { extractSeriesLinks, extractChapters, extractPages, parseChapterNumber, matchSeries } from '../src/lib/scraper/engine.ts';
import type { Source } from '../src/lib/scraper/sources';

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

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall scraper checks passed');
