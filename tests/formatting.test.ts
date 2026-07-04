import { chapterLabel, historyLabel, progressLabel, chapterSummary, groupLabel } from '../src/lib/ui/formatting';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  }
}

// chapterLabel
assert(chapterLabel('5', 'Final', 3) === 'Ch. 5 · page 4', 'chapterLabel with title and page');
assert(chapterLabel(null, 'Prologue', 0) === 'Prologue', 'chapterLabel title only');
assert(chapterLabel('12', undefined, undefined) === 'Ch. 12', 'chapterLabel number only');

// historyLabel
assert(historyLabel({ chapterTitle: 'Prologue' } as any) === 'Prologue', 'historyLabel title');
assert(historyLabel({ chapterNumber: '7' } as any) === 'Chapter 7', 'historyLabel number');
assert(historyLabel({} as any) === 'Chapter', 'historyLabel default');

// progressLabel
assert(progressLabel(undefined) === 'No chapters read yet', 'progressLabel none');
assert(progressLabel({ chapterNumber: '5' } as any) === 'Chapter 5', 'progressLabel reading');
assert(progressLabel({ chapterNumber: '10', status: 'COMPLETED' } as any) === 'Completed at chapter 10', 'progressLabel completed');

// chapterSummary
assert(chapterSummary(10, 10) === '10 chapters', 'chapterSummary equal');
assert(chapterSummary(1, 3) === '1 chapter · 3 uploads', 'chapterSummary different');
assert(chapterSummary(2, 1) === '2 chapters · 1 upload', 'chapterSummary plural rules');

// groupLabel
assert(groupLabel('Alpha', 0) === 'Alpha', 'groupLabel single');
assert(groupLabel('Alpha', 2) === 'Alpha +2', 'groupLabel multiple');
assert(groupLabel(undefined, 1) === '2 groups', 'groupLabel no name');
assert(groupLabel('Beta', 0, 'Beta') === 'Beta', 'groupLabel preferred same');
assert(groupLabel('Beta', 0, 'Alpha') === 'Beta (fallback)', 'groupLabel fallback suffix');

if (failures) {
  console.error(`\n${failures} formatting check(s) failed`);
  process.exit(1);
}
console.log('\nall formatting checks passed');
