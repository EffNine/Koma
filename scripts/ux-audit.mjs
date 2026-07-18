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

// Fresh visit — onboarding
await page.goto(BASE + '/');
await waitSettle(2500);
await shot('01-fresh-home');

const onboardingVisible = await page.locator('.onboarding, [class*="onboard"], dialog, .wizard').first().isVisible().catch(() => false)
  || await page.getByText(/welcome|get started|add a reading site|reading site/i).first().isVisible().catch(() => false);
note('info', 'Onboarding presence', onboardingVisible ? 'Onboarding/welcome UI visible on fresh load' : 'No onboarding overlay detected');

// Complete onboarding if present
const skipBtn = page.getByRole('button', { name: /skip|later|close|not now|done/i }).first();
if (await skipBtn.isVisible().catch(() => false)) {
  await skipBtn.click();
  await waitSettle(800);
  note('info', 'Onboarding dismiss', 'Dismissed via skip/close button');
}

// Nav click test
for (const label of ['Library', 'Search', 'Categories', 'Activity', 'Settings', 'Home']) {
  const link = page.locator('header.topbar nav a', { hasText: label }).first();
  if (!(await link.count())) {
    note('major', 'Nav missing', `No topnav link for ${label}`);
    continue;
  }
  await link.click();
  await waitSettle(800);
  const hash = await page.evaluate(() => location.hash);
  const expected = label === 'Home' ? '#/' : `#/${label.toLowerCase()}`;
  const bodyText = await page.locator('main.view').innerText().catch(() => '');
  const okHash = hash === expected || (label === 'Home' && (hash === '' || hash === '#/' || hash === '#'));
  if (!okHash) note('critical', 'Nav hash wrong', `${label} click -> hash=${hash}, expected=${expected}`);
  else note('ok', `Nav ${label}`, `hash=${hash}, contentLen=${bodyText.length}`);
  await shot(`02-nav-${label.toLowerCase()}`);
}

// Search page: form submit
await page.goto(BASE + '/#/search');
await waitSettle(1000);
const trendingActive = await page.locator('.sort-tabs button.active, .sort-tabs .active, button.active').first().textContent().catch(() => '');
const emptyBefore = await page.getByText(/search for a title to get started/i).isVisible().catch(() => false);
note(emptyBefore ? 'major' : 'ok', 'Search trending empty', `Trending/default tab="${trendingActive?.trim()}", emptyState=${emptyBefore}`);

await page.fill('.search-input, input[placeholder*="Search"]', 'Naruto');
await page.click('button:has-text("Search")');
await waitSettle(3000);
await shot('03-search-naruto');
const resultCount = await page.locator('.grid .card, .tcard, a[href*="/media/"]').count();
const stillEmpty = await page.getByText(/search for a title to get started/i).isVisible().catch(() => false);
if (stillEmpty || resultCount === 0) {
  note('critical', 'Search broken', `After submit: results=${resultCount}, empty=${stillEmpty}`);
} else {
  note('ok', 'Search works', `results≈${resultCount}`);
}

// Top search bar
await page.goto(BASE + '/#/');
await waitSettle(1000);
await page.fill('.top-search-input', 'One Piece');
await page.press('.top-search-input', 'Enter');
await waitSettle(3000);
await shot('04-top-search');
const hashAfterTop = await page.evaluate(() => location.hash);
const topResults = await page.locator('.grid .card, .tcard, a[href*="/media/"]').count();
note(hashAfterTop.includes('/search') && topResults > 0 ? 'ok' : 'major', 'Top search', `hash=${hashAfterTop}, results≈${topResults}`);

// Command search
await page.goto(BASE + '/#/');
await waitSettle(800);
await page.keyboard.down('Control');
await page.keyboard.press('k');
await page.keyboard.up('Control');
await waitSettle(500);
const cmdVisible = await page.locator('.command-search, [class*="command"]').first().isVisible().catch(() => false)
  || await page.getByPlaceholder(/search|find/i).count() > 1;
note(cmdVisible ? 'ok' : 'minor', 'Cmd+K', `visible=${cmdVisible}`);
await shot('05-cmdk');
await page.keyboard.press('Escape');

// Home content / images
await page.goto(BASE + '/#/');
await waitSettle(5000);
await shot('06-home-loaded');
const welcome = await page.getByText(/welcome to koma/i).isVisible().catch(() => false);
const because = await page.getByText(/because you read/i).isVisible().catch(() => false);
if (welcome && because) note('major', 'Home state contradiction', 'Welcome empty continue + Because you read both visible');
else note('ok', 'Home personalization coherence', `welcome=${welcome}, because=${because}`);

const latestSection = page.locator('section', { has: page.getByRole('heading', { name: 'Latest Updates' }) }).first();
const latestImgs = latestSection.locator('img');
const latestFallbacks = latestSection.locator('.proxied-fallback');
const latestSkels = latestSection.locator('.proxied-skel');
await waitSettle(4000);
note('info', 'Latest Updates images', `imgs=${await latestImgs.count()}, fallbacks=${await latestFallbacks.count()}, skels=${await latestSkels.count()}`);
if ((await latestFallbacks.count()) > 3) note('major', 'Latest Updates covers broken', `${await latestFallbacks.count()} fallback placeholders`);

const emojiQuick = await page.locator('.quick-link .ql-icon').count();
if (emojiQuick > 0) note('polish', 'Emoji quick links', `${emojiQuick} emoji quick-link icons clutter home`);

// Open a title from search results
await page.goto(BASE + '/#/search?q=Naruto');
await waitSettle(3500);
const firstTitle = page.locator('a[href*="#/media/"], a[href*="/media/"], .tcard a, .card a').first();
if (await firstTitle.count()) {
  await firstTitle.click();
  await waitSettle(2500);
  await shot('07-media');
  const mediaHash = await page.evaluate(() => location.hash);
  note(mediaHash.includes('/media/') ? 'ok' : 'major', 'Open title', `hash=${mediaHash}`);

  const follow = page.getByRole('button', { name: /follow/i }).first();
  if (await follow.isVisible().catch(() => false)) {
    await follow.click();
    await waitSettle(800);
    note('ok', 'Follow click', 'Follow button clicked');
  }

  const startBtn = page.getByRole('button', { name: /start reading|continue reading|read/i }).first();
  const chapterLink = page.locator('a[href*="/reader/"], button:has-text("Read")').first();
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await waitSettle(4000);
    await shot('08-reader-attempt');
    note('info', 'Start reading', `hash=${await page.evaluate(() => location.hash)}`);
  } else if (await chapterLink.isVisible().catch(() => false)) {
    await chapterLink.click();
    await waitSettle(4000);
    await shot('08-reader-attempt');
    note('info', 'Chapter open', `hash=${await page.evaluate(() => location.hash)}`);
  } else {
    const noSites = await page.getByText(/no reading sites|add a.*site/i).first().isVisible().catch(() => false);
    note(noSites ? 'major' : 'info', 'Cannot start reading', `noSitesEmpty=${noSites}`);
  }
} else {
  note('critical', 'No searchable titles', 'Could not open media from search');
}

// Library after follow
await page.goto(BASE + '/#/library');
await waitSettle(1500);
await shot('09-library');
const libText = await page.locator('main.view').innerText();
note('info', 'Library content', libText.slice(0, 200).replace(/\s+/g, ' '));

// Categories
await page.goto(BASE + '/#/categories');
await waitSettle(1500);
await shot('10-categories');
const catLinks = await page.locator('main.view a, main.view button').count();
note(catLinks < 6 ? 'polish' : 'ok', 'Categories density', `interactive items=${catLinks}`);

// Settings
await page.goto(BASE + '/#/settings');
await waitSettle(1500);
await shot('11-settings');
const settingsText = await page.locator('main.view').innerText();
note('info', 'Settings sections', /reading site|source|tracker|cache/i.test(settingsText) ? 'core sections present' : 'missing expected sections');

// Back/forward
await page.goto(BASE + '/#/');
await waitSettle(500);
await page.goto(BASE + '/#/library');
await waitSettle(500);
await page.goBack();
await waitSettle(800);
const backHash = await page.evaluate(() => location.hash);
const backMain = await page.locator('main.view h2, main.view .h2, main.view').first().innerText().catch(() => '');
note(backHash === '#/' || backHash === '' || backHash === '#' ? 'ok' : 'major', 'Browser back', `hash=${backHash}`);

if (consoleErrors.length) {
  note('major', 'Console errors', consoleErrors.slice(0, 8).join(' | '));
} else {
  note('ok', 'Console clean', 'No page errors captured');
}

fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
console.log('\n=== SUMMARY ===');
for (const f of findings.filter((x) => !['ok', 'info'].includes(x.severity))) {
  console.log(`- [${f.severity}] ${f.title}: ${f.detail}`);
}
await browser.close();
