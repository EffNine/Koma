import {
  chapterUnavailableMessage,
  cloudflareDesktopHint,
  noReadingSitesMessage,
  readingSiteName,
  readingSitesDownMessage,
  titleNotFoundMessage,
} from '../src/lib/ui/readingSiteCopy.ts';
import type { Source } from '../src/lib/scraper/sources.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

const site: Source = {
  id: 'example.test',
  name: 'Example Manga',
  url: 'https://example.test',
  enabled: true,
  priority: 0,
  addedAt: 1,
  status: 'ready',
};

assert(readingSiteName(site) === 'Example Manga', 'uses source display name as reading site name');
assert(readingSiteName(undefined) === 'reading site', 'falls back to generic reading site');
assert(noReadingSitesMessage().includes('No reading sites'), 'no site message uses reading sites');
assert(readingSitesDownMessage(['Site A']).includes('Site A is unreachable'), 'single down site message names site');
assert(readingSitesDownMessage(['A', 'B']).includes('A, B'), 'multiple down site message lists sites');
assert(titleNotFoundMessage([]) === noReadingSitesMessage(), 'title not found without sites uses setup message');
assert(titleNotFoundMessage(['Site A']).includes('Try another reading site'), 'title not found suggests another reading site');
assert(chapterUnavailableMessage('Site A', 'Chapter 4', 'Site B').includes('Try Site B?'), 'chapter unavailable suggests alternate site');
assert(cloudflareDesktopHint().includes('desktop app'), 'cloudflare hint points to desktop app');

if (failures) {
  console.error(`\n${failures} reading-site copy check(s) failed`);
  process.exit(1);
}
console.log('\nall reading-site copy checks passed');
