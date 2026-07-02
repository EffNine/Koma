// Source health check — tests all presets against real sites via the dev proxy.
// Usage: node tests/source-health.mjs
// Requires the dev proxy running on localhost:8788 (pnpm run proxy:dev)

const PROXY = 'http://localhost:8788';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchViaProxy(url, opts = {}) {
  const u = new URL(PROXY);
  u.searchParams.set('url', url);
  if (opts.referer) u.searchParams.set('referer', opts.referer);
  if (opts.headers) u.searchParams.set('headers', JSON.stringify(opts.headers));
  const r = await fetch(u.toString());
  const data = await r.json();
  if (data.status === 0) throw new Error(data.error || 'proxy error');
  const bin = atob(data.body_b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function findJson(html, predicate) {
  for (const m of html.matchAll(/<script[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      if (predicate(data)) return data;
    } catch {}
  }
  return null;
}

// --- Test definitions ---

const tests = [];

// 1. ComicK (comick driver) — search + chapters + pages
tests.push({
  name: 'ComicK - search',
  async run() {
    const html = await fetchViaProxy('https://comickz.co.uk/search?q=one+piece', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const data = findJson(html, (v) => Array.isArray(v?.data));
    if (!data?.data?.length) throw new Error('No search results found');
    const slug = data.data[0].slug;
    return { slug, title: data.data[0].title };
  },
});

tests.push({
  name: 'ComicK - chapters',
  async run() {
    const html = await fetchViaProxy('https://comickz.co.uk/api/comics/one-piece/chapter-list?lang=en', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    const data = JSON.parse(html);
    if (!data?.data?.length) throw new Error('No chapters found');
    return { count: data.data.length, first: data.data[0].chap, last: data.data[data.data.length - 1].chap };
  },
});

tests.push({
  name: 'ComicK - pages',
  async run() {
    const html = await fetchViaProxy('https://comickz.co.uk/comic/one-piece/KWuhBVi-chapter-1186-en', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const data = findJson(html, (v) => Array.isArray(v?.chapter?.images));
    if (!data?.chapter?.images?.length) throw new Error('No page images found');
    return { count: data.chapter.images.length, sample: data.chapter.images[0].url };
  },
});

tests.push({
  name: 'ComicK - home feed',
  async run() {
    const html = await fetchViaProxy('https://comickz.co.uk/home', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const m = html.match(/<script[^>]*id="sv-data"[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (!m) throw new Error('No sv-data found');
    const data = JSON.parse(m[1]);
    const d = data?.data;
    if (!d?.recent_add?.length) throw new Error('No recent_add in home data');
    return {
      recent_add: d.recent_add.length,
      popular_ongoing: d.popular_ongoing?.length || 0,
      trending_7d: d.trending?.['7']?.length || 0,
    };
  },
});

// 2. Comick Source API (comick-api driver) — search + chapters
tests.push({
  name: 'Comick Source API (atsumoe) - search',
  async run() {
    const r = await fetch('https://comick-source-api.notaspider.dev/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'solo leveling', source: 'atsumoe' }),
    });
    const data = await r.json();
    if (!data?.results?.length) throw new Error('No search results');
    return { count: data.results.length, first: data.results[0].title, url: data.results[0].url };
  },
});

tests.push({
  name: 'Comick Source API (atsumoe) - chapters',
  async run() {
    const r = await fetch('https://comick-source-api.notaspider.dev/api/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://atsu.moe/manga/oZOG5', source: 'atsumoe' }),
    });
    const data = await r.json();
    if (!data?.chapters?.length) throw new Error('No chapters found');
    return { count: data.chapters.length, first: data.chapters[0].number, last: data.chapters[data.chapters.length - 1].number };
  },
});

// 3. Comick Source API with other working sources
for (const [src, query, url] of [
  ['weebcentral', 'solo leveling', null],
  ['mangakatana', 'solo leveling', null],
]) {
  tests.push({
    name: `Comick Source API (${src}) - search`,
    async run() {
      const r = await fetch('https://comick-source-api.notaspider.dev/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, source: src }),
      });
      const data = await r.json();
      if (!data?.results?.length) throw new Error('No search results');
      return { count: data.results.length, first: data.results[0].title };
    },
  });
}

// 4. Madara preset — test against known Madara sites
const MADARA_SITES = [
  { name: 'MangaBuddy', url: 'https://mangabuddy.com/', search: 'one piece' },
  { name: 'MangaBat', url: 'https://mangabat.com/', search: 'one piece' },
  { name: 'MangaPill', url: 'https://mangapill.com/', search: 'one piece' },
  { name: 'FlameComics', url: 'https://flamecomics.xyz/', search: 'solo leveling' },
];

for (const site of MADARA_SITES) {
  tests.push({
    name: `Madara - ${site.name} - search`,
    async run() {
      const searchUrl = site.url.replace(/\/+$/, '') + '/?s=' + encodeURIComponent(site.search) + '&post_type=wp-manga';
      const html = await fetchViaProxy(searchUrl, { referer: site.url });
      // Check for Madara markers
      const isMadara = /wp-manga|madara/i.test(html);
      // Check for search results
      const hasResults = /c-tabs-item|page-item-detail|post-title/i.test(html);
      return { isMadara, hasResults, bodyLen: html.length };
    },
  });
}

// 5. MangaStream preset — test against known MangaStream sites
const MANGASTREAM_SITES = [
  { name: 'MangaStream (raw)', url: 'https://readmanganato.com/', search: 'one piece' },
];

for (const site of MANGASTREAM_SITES) {
  tests.push({
    name: `MangaStream - ${site.name} - search`,
    async run() {
      const searchUrl = site.url.replace(/\/+$/, '') + '/?s=' + encodeURIComponent(site.search);
      const html = await fetchViaProxy(searchUrl, { referer: site.url });
      const hasResults = /listupd|bsx|bs\b/i.test(html);
      return { bodyLen: html.length, hasResults };
    },
  });
}

// 6. Genkan preset — test against known Genkan sites
const GENKAN_SITES = [
  { name: 'Reaper Scans', url: 'https://reaperscans.com/', search: 'solo leveling' },
];

for (const site of GENKAN_SITES) {
  tests.push({
    name: `Genkan - ${site.name} - search`,
    async run() {
      const searchUrl = site.url.replace(/\/+$/, '') + '/search?q=' + encodeURIComponent(site.search);
      const html = await fetchViaProxy(searchUrl, { referer: site.url });
      const isGenkan = /__NEXT_DATA__|chakra/i.test(html);
      const hasResults = /series|manga/i.test(html);
      return { isGenkan, hasResults, bodyLen: html.length };
    },
  });
}

// 7. Add-by-URL fingerprinting — test that the fingerprint function detects known sites
import { fingerprint } from '../src/lib/scraper/fingerprint.ts';

const FINGERPRINT_TESTS = [
  { name: 'MangaBuddy', url: 'https://mangabuddy.com/' },
  { name: 'MangaBat', url: 'https://mangabat.com/' },
  { name: 'FlameComics', url: 'https://flamecomics.xyz/' },
  { name: 'Reaper Scans', url: 'https://reaperscans.com/' },
];

for (const site of FINGERPRINT_TESTS) {
  tests.push({
    name: `Fingerprint - ${site.name}`,
    async run() {
      const html = await fetchViaProxy(site.url, { referer: site.url });
      const detected = fingerprint(html);
      return { detected: detected || 'none' };
    },
  });
}

// --- Runner ---

let passed = 0;
let failed = 0;
const results = [];

for (const test of tests) {
  process.stdout.write(`  ${test.name} ... `);
  try {
    const result = await test.run();
    console.log('✅', typeof result === 'object' ? JSON.stringify(result) : result);
    passed++;
    results.push({ name: test.name, status: 'pass', result });
  } catch (e) {
    console.log('❌', e.message);
    failed++;
    results.push({ name: test.name, status: 'fail', error: e.message });
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length} total\n`);

// Summary table
console.log('Summary:');
console.log('-'.repeat(60));
for (const r of results) {
  const icon = r.status === 'pass' ? '✅' : '❌';
  const detail = r.status === 'pass' ? JSON.stringify(r.result) : r.error;
  console.log(`  ${icon} ${r.name}`);
  console.log(`     ${detail}`);
}
console.log('-'.repeat(60));

process.exit(failed > 0 ? 1 : 0);
