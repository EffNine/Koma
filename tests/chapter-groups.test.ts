import type { ScrapedChapter } from '../src/lib/scraper/engine.ts';
import { groupChapters } from '../src/lib/media/chapterGroups.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function chapter(number: string, group: string): ScrapedChapter {
  return {
    url: `https://source.example/chapter-${number}-${group.toLowerCase()}`,
    number,
    title: `Chapter ${number}`,
    group,
  };
}

const duplicates: ScrapedChapter[] = [
  chapter('30', 'Asura'),
  chapter('30', 'Flame'),
  chapter('29', 'Asura'),
  chapter('29', 'Flame'),
  chapter('31', 'Flame'),
];

const grouped = groupChapters(duplicates);
assert(grouped.length === 3, 'duplicate chapter numbers collapse into one row per number');
assert(grouped[0].number === '31', 'rows sorted descending by number');
assert(grouped[0].preferred.group === 'Flame', 'first group in source order selected when no preferred group');
assert(grouped[1].alternatives.length === 1, 'single alternative for ch 30');
assert(grouped[2].number === '29', 'ch 29 is last row');

const withPreferred = groupChapters(duplicates, 'Asura');
assert(withPreferred[1].preferred.group === 'Asura', 'preferred group wins when present');
assert(withPreferred[1].alternatives.length === 1, 'preferred chapter is excluded from alternatives');
assert(
  withPreferred[2].preferred.group === 'Asura',
  'preferred group wins for every chapter where it exists',
);

const fallbackMissing: ScrapedChapter[] = [
  chapter('1', 'Asura'),
  chapter('2', 'Flame'),
];
const fallbackGroup = groupChapters(fallbackMissing, 'Asura');
assert(fallbackGroup[0].number === '2', 'missing preferred group still produces a row');
assert(fallbackGroup[0].preferred.group === 'Flame', 'fallback group selected when preferred is missing');

const unknowns: ScrapedChapter[] = [
  { url: 'https://source.example/a', number: null, title: 'Prologue' },
  { url: 'https://source.example/b', number: null, title: 'Bonus' },
];
const withUnknowns = groupChapters([...duplicates, ...unknowns]);
assert(withUnknowns.length === 5, 'unknown-number chapters remain distinct rows');
assert(
  withUnknowns.filter((g) => g.number === null).length === 2,
  'unknown-number rows are separate by url',
);

if (failures) {
  console.error(`\n${failures} chapter group check(s) failed`);
  process.exit(1);
}

console.log('\nall chapter group checks passed');
