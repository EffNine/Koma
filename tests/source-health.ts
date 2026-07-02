// Source health check — tests all presets against real sites via the dev proxy.
// Usage: tsx tests/source-health.ts
// Requires the dev proxy running on localhost:8788

import { fingerprint } from '../src/lib/scraper/fingerprint.ts';

const PROXY = 'http://localhost:8788';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  result?: unknown;
  error?: string;
}

async function fetchViaProxy(url: string, opts: { referer?: string; headers?: Record<string, string> } = {}): Promise<string> {
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

function findJson<T>(html: string, predicate: (data: unknown) => boolean): T | null {
  for (const m of html.matchAll(/<script[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as T;
      if (predicate(data)) return data;
    } catch { /* not JSON */ }
  }
  return null;
}

const results: TestResult[] = [];

async function run(name: string, fn: () => Promise<unknown>) {
  process.stdout.write(`  ${name} ... `);
  try {
    const result = await fn();
    console.log('✅', typeof result === 'object' ? JSON.stringify(result) : result);
    results.push({ name, status: 'pass', result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('❌', msg);
    results.push({ name, status: 'fail', error: msg });
  }
}

async function main() {
  console.log('\n=== Source Health Check ===\n');

  // ── ComicK (comick driver) ──
  console.log('── ComicK ──');

  await run('ComicK - search', async () => {
    const html = await fetchViaProxy('https://comickz.co.uk/search?q=one+piece', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const data = findJson<{ data: Array<{ slug: string; title: string }> }>(
      html, (v) => Array.isArray((v as { data?: unknown })?.data),
    );
    if (!data?.data?.length) throw new Error('No search results found');
    return { slug: data.data[0].slug, title: data.data[0].title };
  });

  await run('ComicK - chapters', async () => {
    const html = await fetchViaProxy('https://comickz.co.uk/api/comics/one-piece/chapter-list?lang=en', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    const data = JSON.parse(html) as { data: Array<{ chap: string }> };
    if (!data?.data?.length) throw new Error('No chapters found');
    return { count: data.data.length, first: data.data[0].chap, last: data.data[data.data.length - 1].chap };
  });

  await run('ComicK - pages', async () => {
    const html = await fetchViaProxy('https://comickz.co.uk/comic/one-piece/KWuhBVi-chapter-1186-en', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const data = findJson<{ chapter: { images: Array<{ url: string }> } }>(
      html, (v) => Array.isArray((v as { chapter?: { images?: unknown } })?.chapter?.images),
    );
    if (!data?.chapter?.images?.length) throw new Error('No page images found');
    return { count: data.chapter.images.length, sample: data.chapter.images[0].url };
  });

  await run('ComicK - home feed', async () => {
    const html = await fetchViaProxy('https://comickz.co.uk/home', {
      referer: 'https://comickz.co.uk/',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const m = html.match(/<script[^>]*id="sv-data"[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (!m) throw new Error('No sv-data found');
    const parsed = JSON.parse(m[1]) as { data?: { recent_add?: unknown[]; popular_ongoing?: unknown[]; trending?: Record<string, unknown[]> } };
    const d = parsed?.data;
    if (!d?.recent_add?.length) throw new Error('No recent_add in home data');
    return {
      recent_add: d.recent_add.length,
      popular_ongoing: d.popular_ongoing?.length || 0,
      trending_7d: d.trending?.['7']?.length || 0,
    };
  });

  // ── Comick Source API ──
  console.log('\n── Comick Source API ──');

  await run('Comick API (atsumoe) - search', async () => {
    const r = await fetch('https://comick-source-api.notaspider.dev/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'solo leveling', source: 'atsumoe' }),
    });
    const data = await r.json() as { results?: Array<{ title: string; url: string }> };
    if (!data?.results?.length) throw new Error('No search results');
    return { count: data.results.length, first: data.results[0].title };
  });

  await run('Comick API (atsumoe) - chapters', async () => {
    const r = await fetch('https://comick-source-api.notaspider.dev/api/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://atsu.moe/manga/oZOG5', source: 'atsumoe' }),
    });
    const data = await r.json() as { chapters?: Array<{ number: number }> };
    if (!data?.chapters?.length) throw new Error('No chapters found');
    return { count: data.chapters.length, first: data.chapters[0].number, last: data.chapters[data.chapters.length - 1].number };
  });

  await run('Comick API (weebcentral) - search', async () => {
    const r = await fetch('https://comick-source-api.notaspider.dev/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'solo leveling', source: 'weebcentral' }),
    });
    const data = await r.json() as { results?: Array<{ title: string }> };
    if (!data?.results?.length) throw new Error('No search results');
    return { count: data.results.length, first: data.results[0].title };
  });

  await run('Comick API (mangakatana) - search', async () => {
    const r = await fetch('https://comick-source-api.notaspider.dev/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'solo leveling', source: 'mangakatana' }),
    });
    const data = await r.json() as { results?: Array<{ title: string }> };
    if (!data?.results?.length) throw new Error('No search results');
    return { count: data.results.length, first: data.results[0].title };
  });

  // ── Madara sites ──
  console.log('\n── Madara Preset (HTML driver) ──');

  const MADARA_SITES = [
    { name: 'MangaBuddy', url: 'https://mangabuddy.com/', search: 'one+piece' },
    { name: 'MangaBat', url: 'https://mangabat.com/', search: 'one+piece' },
    { name: 'FlameComics', url: 'https://flamecomics.xyz/', search: 'solo+leveling' },
  ];

  for (const site of MADARA_SITES) {
    await run(`Madara - ${site.name} - search`, async () => {
      const searchUrl = site.url.replace(/\/+$/, '') + '/?s=' + site.search + '&post_type=wp-manga';
      const html = await fetchViaProxy(searchUrl, { referer: site.url });
      const isMadara = /wp-manga|madara/i.test(html);
      const hasResults = /c-tabs-item|page-item-detail|post-title/i.test(html);
      return { isMadara, hasResults, bodyLen: html.length };
    });
  }

  // ── MangaPill ──
  console.log('\n── MangaPill Preset ──');

  await run('MangaPill - search', async () => {
    const html = await fetchViaProxy('https://mangapill.com/search?q=one+piece', { referer: 'https://mangapill.com/' });
    const cards = html.match(/<div>\s*<a href="\/manga\/\d+\/[^"]*" class="relative block">/g);
    if (!cards?.length) throw new Error('No search cards found');
    return { count: cards.length };
  });

  await run('MangaPill - chapters', async () => {
    const html = await fetchViaProxy('https://mangapill.com/manga/2/one-piece', { referer: 'https://mangapill.com/' });
    const chapters = html.match(/href="\/chapters\/[^"]*"/g);
    if (!chapters?.length) throw new Error('No chapters found');
    return { count: chapters.length };
  });

  await run('MangaPill - pages', async () => {
    const html = await fetchViaProxy('https://mangapill.com/chapters/2-11186000/one-piece-chapter-1186', { referer: 'https://mangapill.com/' });
    const pages = html.match(/<img class="js-page" data-src="[^"]+"/g);
    if (!pages?.length) throw new Error('No page images found');
    return { count: pages.length };
  });

  // ── MangaStream sites ──
  console.log('\n── MangaStream Preset (HTML driver) ──');

  const MANGASTREAM_SITES = [
    { name: 'MangaNato', url: 'https://readmanganato.com/', search: 'one+piece' },
  ];

  for (const site of MANGASTREAM_SITES) {
    await run(`MangaStream - ${site.name} - search`, async () => {
      const searchUrl = site.url.replace(/\/+$/, '') + '/?s=' + encodeURIComponent(site.search);
      const html = await fetchViaProxy(searchUrl, { referer: site.url });
      const hasResults = /listupd|bsx|bs\b/i.test(html);
      return { bodyLen: html.length, hasResults };
    });
  }

  // ── Genkan sites ──
  console.log('\n── Genkan Preset (HTML driver) ──');

  const GENKAN_SITES = [
    { name: 'Reaper Scans', url: 'https://reaperscans.com/', search: 'solo+leveling' },
  ];

  for (const site of GENKAN_SITES) {
    await run(`Genkan - ${site.name} - search`, async () => {
      const searchUrl = site.url.replace(/\/+$/, '') + '/search?q=' + encodeURIComponent(site.search);
      const html = await fetchViaProxy(searchUrl, { referer: site.url });
      const isGenkan = /__NEXT_DATA__|chakra/i.test(html);
      const hasResults = /series|manga/i.test(html);
      return { isGenkan, hasResults, bodyLen: html.length };
    });
  }

  // ── Fingerprint detection ──
  console.log('\n── Fingerprint Detection (add-by-URL) ──');

  const FINGERPRINT_SITES = [
    { name: 'MangaBuddy', url: 'https://mangabuddy.com/' },
    { name: 'MangaBat', url: 'https://mangabat.com/' },
    { name: 'FlameComics', url: 'https://flamecomics.xyz/' },
    { name: 'Reaper Scans', url: 'https://reaperscans.com/' },
    { name: 'MangaPill', url: 'https://mangapill.com/' },
    { name: 'ComicK', url: 'https://comickz.co.uk/' },
  ];

  for (const site of FINGERPRINT_SITES) {
    await run(`Fingerprint - ${site.name}`, async () => {
      const html = await fetchViaProxy(site.url, { referer: site.url });
      const detected = fingerprint(html);
      return { detected: detected || 'none' };
    });
  }

  // ── Summary ──
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total\n`);

  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : '❌';
    const detail = r.status === 'pass'
      ? JSON.stringify(r.result)
      : r.error;
    console.log(`  ${icon} ${r.name}`);
    console.log(`     ${detail}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
