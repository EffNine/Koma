import { computeProgress, computeRollback, chapterValue, progressStatus } from '../src/lib/tracker/progress.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL: ' + msg); failures++; }
  else console.log('ok: ' + msg);
}

// Advance
assert(computeProgress(undefined, { chapterNumber: '5', chapterNumberValue: 5, chapterUrl: 'u5', chapterTitle: 'c5', totalChapters: 10, readAt: 0 }).status === 'READING', 'first read sets READING');
assert(computeProgress(undefined, { chapterNumber: '5', chapterNumberValue: 5, chapterUrl: 'u5', chapterTitle: 'c5', totalChapters: 10, readAt: 0 }).chapterNumber === '5', 'first read preserves chapter number');

// Completion
assert(computeProgress(undefined, { chapterNumber: '13', chapterNumberValue: 13, chapterUrl: 'u13', chapterTitle: 'c13', totalChapters: 12, readAt: 0 }).status === 'COMPLETED', 'advance past total marks COMPLETED');

// No advance when behind
const current = { chapterNumberValue: 8, status: 'READING' as const };
const stale = computeProgress(current, { chapterNumber: '3', chapterNumberValue: 3, chapterUrl: 'u3', chapterTitle: 'c3', totalChapters: 12, readAt: 0 });
assert(stale.chapterNumberValue === 8, 'stale read keeps current chapter value');
assert(stale.status === 'READING', 'stale read keeps current status');

// Tie advances
assert(computeProgress(current, { chapterNumber: '8', chapterNumberValue: 8, chapterUrl: 'u8b', chapterTitle: 'c8b', totalChapters: 12, readAt: 0 }).chapterUrl === 'u8b', 'tie advances to newer read');

// Rollback
const reads = [
  { chapterUrl: 'u2', chapterNumber: '2', chapterNumberValue: 2, chapterTitle: 'c2' },
  { chapterUrl: 'u5', chapterNumber: '5', chapterNumberValue: 5, chapterTitle: 'c5' },
  { chapterUrl: 'u8', chapterNumber: '8', chapterNumberValue: 8, chapterTitle: 'c8' },
];
assert(computeRollback(reads, 6)?.chapterNumber === '5', 'rollback below cutoff returns latest remaining');
assert(computeRollback(reads, 2) === null, 'rollback at or below all reads clears progress');

// Helpers
assert(chapterValue('12.5') === 12.5, 'decimal chapter parsed');
assert(chapterValue(undefined) === -1, 'undefined chapter is -1');
assert(progressStatus(5, 10) === 'READING', 'below total is READING');
assert(progressStatus(11, 10) === 'COMPLETED', 'above total is COMPLETED');

if (failures) {
  console.error(`\n${failures} progress check(s) failed`);
  process.exit(1);
}

console.log('\nall progress checks passed');
