import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5174';
const OUT = path.resolve('output/ux-audit');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
function note(severity, title, detail) {
  findings.push({ severity, title, detail });
  console.log(`[${severity}] ${title}: ${detail}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => {
  localStorage.setItem('koma.onboarding.complete', '1');
  localStorage.setItem('koma.sources.seeded.v6', '1');
});
const page = await context.newPage();

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function waitSettle(ms = 1500) {
  await page.waitForTimeout(ms);
}

// Home
await page.goto(BASE + '/#/');
await waitSettle(6000);
await shot('01-home');

const welcome = await page.getByText(/welcome to koma/i).isVisible().catch(() => false);
const emojiQuick = await page.locator('.quick-link .ql-icon').count();
note(emojiQuick === 0 ? 'ok' : 'polish', 'Home quick links', `emojiQuick=${emojiQuick}, welcome=${welcome}`);

const latestSection = page.locator('section', { has: page.getByRole('heading', { name: 'Latest Updates' }) }).first();
await waitSettle(2000);
const latestImgs = await latestSection.locator('img').evaluateAll((imgs) =>
  imgs.map((img) => /** @type {HTMLImageElement} */ (img).naturalWidth),
);
const latestFallbacks = await latestSection.locator('.proxied-fallback').count();
const latestBroken = latestImgs.filter((w) => w === 0).length;
note(
  latestBroken === 0 ? 'ok' : 'major',
  'Latest Updates covers',
  `imgs=${latestImgs.length}, broken=${latestBroken}, fallbacks=${latestFallbacks}, widths=[${latestImgs.slice(0, 6).join(',')}]`,
);

// Search default trending
await page.goto(BASE + '/#/search');
await waitSettle(3500);
await shot('02-search-default');
const emptySearch = await page.getByText(/search for a title to get started/i).isVisible().catch(() => false);
const searchCards = await page.locator('button.tcard, .grid .card').count();
note(!emptySearch && searchCards > 0 ? 'ok' : 'major', 'Search auto-trending', `empty=${emptySearch}, cards=${searchCards}`);

// Search query + open title
await page.fill('.search-input', 'Naruto');
await page.click('button:has-text("Search")');
await waitSettle(3500);
await shot('03-search-naruto');
const resultCards = page.locator('button.tcard');
const resultCount = await resultCards.count();
note(resultCount > 0 ? 'ok' : 'critical', 'Search results', `count=${resultCount}`);

if (resultCount > 0) {
  await resultCards.first().click();
  await waitSettle(2500);
  await shot('04-media');
  const mediaHash = await page.evaluate(() => location.hash);
  note(mediaHash.includes('/media/') ? 'ok' : 'major', 'Open title card', `hash=${mediaHash}`);

  const follow = page.getByRole('button', { name: /^Follow$/i }).first();
  if (await follow.isVisible().catch(() => false)) {
    await follow.click();
    await waitSettle(600);
    note('ok', 'Follow', 'Follow clicked');
  }
}

// Categories → Search
await page.goto(BASE + '/#/categories');
await waitSettle(800);
await shot('05-categories');
await page.getByText('Ongoing Popular').click();
await waitSettle(3500);
await shot('06-category-ongoing');
const catHash = await page.evaluate(() => location.hash);
const catCards = await page.locator('button.tcard').count();
note(
  catHash.includes('status=ongoing') && catCards > 0 ? 'ok' : 'major',
  'Categories Ongoing Popular',
  `hash=${catHash}, cards=${catCards}`,
);

// Genres → Search
await page.goto(BASE + '/#/genres');
await waitSettle(800);
await page.getByRole('button', { name: 'Action' }).click();
await waitSettle(3500);
await shot('07-genre-action');
const genreHash = await page.evaluate(() => location.hash);
const genreCards = await page.locator('button.tcard').count();
note(
  genreHash.includes('genres=Action') && genreCards > 0 ? 'ok' : 'major',
  'Genres Action',
  `hash=${genreHash}, cards=${genreCards}`,
);

// Library
await page.goto(BASE + '/#/library');
await waitSettle(1200);
await shot('08-library');
const libText = await page.locator('main.view').innerText();
note(/follow|library|history|update/i.test(libText) ? 'ok' : 'major', 'Library loads', libText.slice(0, 120).replace(/\s+/g, ' '));

// Nav smoke
for (const label of ['Home', 'Settings', 'Activity']) {
  await page.locator('header.topbar nav a', { hasText: label }).click();
  await waitSettle(600);
  note('ok', `Nav ${label}`, await page.evaluate(() => location.hash));
}
await shot('09-settings');

if (consoleErrors.length) {
  note('major', 'Console errors', consoleErrors.slice(0, 8).join(' | '));
} else {
  note('ok', 'Console clean', 'No page errors captured');
}

fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
console.log('\n=== ISSUES ===');
const issues = findings.filter((x) => !['ok', 'info'].includes(x.severity));
if (issues.length === 0) console.log('(none)');
for (const f of issues) console.log(`- [${f.severity}] ${f.title}: ${f.detail}`);
await browser.close();
