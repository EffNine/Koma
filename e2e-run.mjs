import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const OUT = '.playwright-mcp/e2e-session';
const PORT = 5174;
const BASE = `http://localhost:${PORT}`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function isPortOpen() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE}/`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(deadline = Date.now() + 30000) {
  while (Date.now() < deadline) {
    if (await isPortOpen()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Vite dev server did not start in time');
}

let server;
if (await isPortOpen()) {
  console.log(`Using existing dev server on ${BASE}`);
} else {
  console.log(`Starting dev server on ${BASE}...`);
  server = spawn('pnpm', ['vite', 'dev', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: false,
  });
  server.stdout?.on('data', (d) => fs.appendFileSync(`${OUT}/server.log`, d));
  server.stderr?.on('data', (d) => fs.appendFileSync(`${OUT}/server.log`, d));
  await waitForServer();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => {
  localStorage.setItem('koma.onboarding.complete', '1');
  localStorage.setItem('koma.sources.seeded.v6', '1');
});
const page = await context.newPage();

const logs = [];
const errors = [];
const network = [];

page.on('console', (msg) => {
  const line = `[${msg.type()}] ${msg.text()}`;
  logs.push(line);
  if (msg.type() === 'error' || msg.type() === 'warning') errors.push(line);
});

page.on('pageerror', (err) => {
  const line = `[pageerror] ${err.message}`;
  errors.push(line);
  logs.push(line);
});

page.on('request', (req) => {
  const u = req.url();
  if (u.includes('__koma_scrape') || u.includes('mangadex') || u.includes('asura') || u.includes('mangafire')) {
    network.push(`[request] ${req.method()} ${u}`);
  }
});

page.on('requestfailed', (req) => {
  const u = req.url();
  const failure = req.failure()?.errorText ?? '';
  if (failure.includes('ERR_ABORTED')) return;
  if (u.includes('__koma_scrape') || u.includes('mangadex') || u.includes('asura') || u.includes('mangafire')) {
    const line = `[requestfailed] ${req.method()} ${u} ${failure}`;
    errors.push(line);
    network.push(line);
  }
});

page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('__koma_scrape') || u.includes('mangadex') || u.includes('asura') || u.includes('mangafire')) {
    const ok = res.ok();
    network.push(`[response] ${res.status()} ${u} ok=${ok}`);
    if (!ok) {
      try {
        const body = await res.text();
        network.push(`[response-body] ${body.slice(0, 500)}`);
      } catch {}
    }
  }
});

async function capture(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const html = await page.content();
  fs.writeFileSync(`${OUT}/${name}.html`, html);
}

async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('nav').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
}

async function seedTestReadingSite() {
  await goto('/');
  await page.evaluate(async () => {
    const { db } = await import('/src/lib/db.ts');
    await db.sources.put({
      id: 'mangapill.com',
      name: 'MangaPill',
      url: 'https://mangapill.com/',
      preset: 'madara',
      enabled: true,
      priority: 0,
      addedAt: Date.now(),
      status: 'ready',
      statusNote: 'E2E test seed',
      checkedAt: Date.now(),
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('nav').first().waitFor({ timeout: 15000 });
}

async function step(name, action) {
  logs.push(`\n--- ${name} ---`);
  await action();
  await capture(name);
}

let runnerError = '';
try {
  await step('home', () => goto('/'));
  await step('seed-source', () => seedTestReadingSite());

  await step('search', async () => {
    await goto('/#/search');
    await page.fill('.searchbar input[placeholder*="Search"]', 'One Piece');
    await page.click('.searchbar button[type="submit"]');
    await page.locator('.tcard, .empty, .err').first().waitFor({ timeout: 20000 });
  });

  await step('search-route-query', async () => {
    await goto('/#/search?q=One%20Piece');
    await page.locator('.searchbar input').waitFor({ timeout: 5000 });
    await page.locator('.tcard, .empty, .err').first().waitFor({ timeout: 20000 });
    const value = await page.locator('.searchbar input').inputValue();
    if (value !== 'One Piece') throw new Error(`Search route query was not reflected in input, got "${value}"`);
  });

  await step('media', async () => {
    await page.click('.tcard');
    await page.waitForTimeout(2000);
  });

  await step('media-find-chapters', async () => {
    const loading = page.locator('text=Loading chapters…');
    try { await loading.waitFor({ state: 'visible', timeout: 5000 }); } catch {}
    try { await loading.waitFor({ state: 'hidden', timeout: 30000 }); } catch {}
    await page.locator('.chapters, .empty, .errbox, .loading-chapters').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  await step('library', () => goto('/#/library'));
  await step('settings', () => goto('/#/settings'));
} catch (e) {
  runnerError = `[runner] ${e.message}`;
  errors.push(runnerError);
  await capture('error');
}

fs.writeFileSync(`${OUT}/console.log`, logs.join('\n'));
fs.writeFileSync(`${OUT}/network.log`, network.join('\n'));
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));

await browser.close();
if (server) {
  server.kill('SIGTERM');
}

// Report visible app-level failures even when console is clean.
const mediaHtml = fs.existsSync(`${OUT}/media-find-chapters.html`)
  ? fs.readFileSync(`${OUT}/media-find-chapters.html`, 'utf8')
  : '';
const appIssues = [];
const externalWarnings = [];
if (mediaHtml.includes('No reading sites yet')) appIssues.push('Media: no reading sites configured');
if (mediaHtml.includes('No reading sites configured yet')) appIssues.push('Media: no reading sites configured');
if (mediaHtml.includes('This title was not found on')) {
  externalWarnings.push('Title not found on seeded reading site (live network / site availability)');
}
if (mediaHtml.includes('No chapters found')) appIssues.push('Media: no chapters resolved');
if (mediaHtml.includes('blocked by Cloudflare') || mediaHtml.includes('Cloudflare protection')) {
  externalWarnings.push('Reading site blocked by Cloudflare through proxy (external, not a code regression)');
}

const allIssues = [...appIssues, ...(runnerError ? [runnerError] : []), ...errors];

if (externalWarnings.length) {
  console.warn('EXTERNAL WARNINGS:');
  externalWarnings.forEach((w) => console.warn(w));
}

if (allIssues.length) {
  console.error('ISSUES FOUND:');
  allIssues.forEach((e) => console.error(e));
  process.exit(1);
}
console.log('E2E smoke passed: no console errors or visible failures.');
