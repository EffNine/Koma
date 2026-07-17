import {
  BACKGROUND_REFRESH_INTERVAL_MS,
  chunkForRefresh,
  isSnapshotStale,
} from '../src/lib/media/backgroundRefresh.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

const now = 1_000_000;

assert(isSnapshotStale(undefined, now), 'missing snapshot is stale');
assert(isSnapshotStale(now - BACKGROUND_REFRESH_INTERVAL_MS, now), 'snapshot at interval boundary is stale');
assert(!isSnapshotStale(now - BACKGROUND_REFRESH_INTERVAL_MS + 1, now), 'fresh snapshot is not stale');
assert(isSnapshotStale(now, now, true), 'force refresh makes fresh snapshot stale');

const chunks = chunkForRefresh([1, 2, 3, 4, 5, 6, 7], 3);
assert(chunks.length === 3, 'chunks items into batches');
assert(chunks[0]?.join(',') === '1,2,3', 'first batch has batch size');
assert(chunks[2]?.join(',') === '7', 'last batch carries remainder');
assert(chunkForRefresh<number>([]).length === 0, 'empty refresh batch is empty');

if (failures) {
  console.error(`\n${failures} background-refresh check(s) failed`);
  process.exit(1);
}
console.log('\nall background-refresh checks passed');
