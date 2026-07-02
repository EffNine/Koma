// ponytail: one runnable self-check for the non-trivial scraper extraction logic.
// Pure — no network, no Tauri. DOMParser polyfilled from linkedom.
import { DOMParser } from 'linkedom';
import { readFileSync } from 'node:fs';
import { compareChapterDesc, extractSeriesLinks, extractChapters, extractPages, parseChapterNumber, matchSeries } from '../src/lib/scraper/engine.ts';
import type { Source } from '../src/lib/scraper/sources';
import { extractChapterData } from '../src/lib/scraper/comickDriver';
import { upstreamHtmlSource } from '../src/lib/scraper/comickApiDriver';
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

const apiSource: Source = {
  id: 'comick-source-api.notaspider.dev',
  name: 'Comick Source API',
  url: 'https://comick-source-api.notaspider.dev/',
  preset: 'comick-api',
  enabled: true,
  addedAt: 0,
};
const upstreamMadaraHtml = '<body class="wp-theme-madara"><div class="reading-content"><img data-src=" https://mangaloom.example/c/1.jpg" /></div></body>';
const upstreamSource = upstreamHtmlSource(apiSource, 'https://mangaloom.example/manga/one-piece/chapter-1/', upstreamMadaraHtml);
assert(upstreamSource.url === 'https://mangaloom.example/', 'comick-api pages use the upstream origin as HTML source base');
assert(upstreamSource.preset === 'madara', 'comick-api pages detect upstream HTML preset');
assert(extractPages(upstreamMadaraHtml, upstreamSource).length === 1, 'comick-api upstream source extracts chapter images');

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

// ComicK preset
const comickPreset = presetById('comick');
assert(comickPreset?.id === 'comick', 'comick preset exists');
assert(comickPreset?.driver === 'comick', 'comick preset uses comick driver');
assert(comickPreset?.hosts?.includes('comickz.co.uk'), 'comick preset has comickz.co.uk host');

// Comick API preset
const comickApiPreset = presetById('comick-api');
assert(comickApiPreset?.id === 'comick-api', 'comick-api preset exists');
assert(comickApiPreset?.driver === 'comick-api', 'comick-api preset uses comick-api driver');
assert(comickApiPreset?.hosts?.includes('comick-source-api.notaspider.dev'), 'comick-api preset has comick-source-api host');

// ComicK search data extraction (from embedded JSON in SSR HTML)
const comickSearchHtml = readFileSync('tests/fixtures/comick-search.html', 'utf8');
// The comickDriver.findSeries uses fetchText, so we test the JSON extraction logic directly
const comickSearchMatch = comickSearchHtml.match(/<script[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/);
assert(comickSearchMatch !== null, 'comick search HTML has embedded JSON script tag');
if (comickSearchMatch) {
  const parsed = JSON.parse(comickSearchMatch[1]);
  assert(parsed.data?.length === 2, 'comick search JSON has 2 results');
  assert(parsed.data[0].slug === 'one-piece', 'comick first result is one-piece');
  assert(parsed.data[0].title === 'One Piece', 'comick first result title is One Piece');
}

// ComicK chapter data extraction (simulated embedded JSON)
const comickChapterJson = JSON.stringify({
  chapter: {
    id: 9919656,
    chap: '345',
    hid: 'NxUBepV',
    lang: 'en',
    title: '',
    comic: { id: 55250, title: 'Blue Lock', slug: 'blue-lock' },
    images: [
      { url: 'https://cdn2.comicknew.pictures/blue-lock/0_345/en/64be7829/0.webp', h: 1378, w: 960, name: 'image 0' },
      { url: 'https://cdn2.comicknew.pictures/blue-lock/0_345/en/64be7829/1.webp', h: 1378, w: 960, name: 'image 1' },
    ],
  },
  chapterList: [{ hid: 'NxUBepV', chap: '345', lang: 'en' }],
});
const comickChapterHtml = `<html><body><script>${comickChapterJson}</script></body></html>`;
const parsedChapter = extractChapterData(comickChapterHtml);
assert(parsedChapter !== null, 'comick chapter HTML has embedded JSON');
assert(parsedChapter?.chapter.images.length === 2, 'comick chapter has 2 images');
assert(parsedChapter?.chapter.images[0].url.includes('cdn2.comicknew.pictures') ?? false, 'comick image URL is from CDN');
assert(parsedChapter?.chapter.comic.slug === 'blue-lock', 'comick chapter comic slug is blue-lock');

const comickChapterWithJsonLdFirst = `<html><body>
  <script type="application/ld+json">{"@context":"https://schema.org","url":"https://comickz.co.uk/comic/blue-lock/NxUBepV-chapter-345-en"}</script>
  <script id="sv-data" type="application/json">${comickChapterJson}</script>
</body></html>`;
assert(extractChapterData(comickChapterWithJsonLdFirst)?.chapter.images.length === 2, 'comick chapter parser skips JSON-LD before sv-data');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall scraper checks passed');
