import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import { type Source } from '../src/lib/scraper/sources.ts';
import {
  errorCategory,
  getSourceHealth,
  isHealthy,
  loadSourceHealth,
  rankSources,
  recordHealth,
  resetSourceHealth,
  sourceScore,
  type SourceHealth,
} from '../src/lib/scraper/sourceHealth.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

async function resetDb() {
  db.close();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('koma');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
  await db.open();
}

function makeSource(id: string, enabled = true, priority = 0): Source {
  return {
    id,
    name: id,
    url: `https://${id}.example/`,
    enabled,
    priority,
    addedAt: 0,
  };
}

function health(
  sourceId: string,
  chapterResolutionSuccesses = 0,
  chapterResolutionFailures = 0,
  pageLoadSuccesses = 0,
  pageLoadFailures = 0,
  lastSuccessAt?: number,
  lastFailureAt?: number,
): SourceHealth {
  return {
    sourceId,
    chapterResolutionSuccesses,
    chapterResolutionFailures,
    pageLoadSuccesses,
    pageLoadFailures,
    lastSuccessAt,
    lastFailureAt,
    updatedAt: 0,
  };
}

await resetDb();

// --- errorCategory ---
assert(errorCategory(new Error('proxy 502')) === 'proxy', 'categorizes proxy errors');
assert(errorCategory(new Error('The operation timed out')) === 'timeout', 'categorizes timeout errors');
assert(errorCategory(new Error('No page images')) === 'no-pages', 'categorizes missing page errors');
assert(errorCategory(new Error('HTTP 403')) === 'http', 'categorizes HTTP status errors');
assert(errorCategory(new Error('network error'), 'page-load') === 'network', 'categorizes network errors');
assert(errorCategory(new Error('weird'), 'page-load') === 'image-load', 'falls back to kind-based category');

// --- recordHealth / getSourceHealth / resetSourceHealth ---
await recordHealth('a', 'success', 'chapter-resolution');
let a = await getSourceHealth('a');
assert(a?.chapterResolutionSuccesses === 1, 'records chapter resolution success');
assert(a?.chapterResolutionFailures === 0, 'chapter resolution failures stay zero');
assert(a?.lastSuccessAt !== undefined && a.lastSuccessAt > 0, 'sets last success timestamp');
assert(a?.lastFailureAt === undefined, 'no failure timestamp on success');
assert(a?.lastErrorCategory === undefined, 'no error category on success');

await recordHealth('a', 'failure', 'page-load', new Error('proxy 502'));
a = await getSourceHealth('a');
assert(a?.pageLoadFailures === 1, 'records page load failure');
assert(a?.pageLoadSuccesses === 0, 'page load successes stay zero');
assert(a?.lastFailureAt !== undefined && a.lastFailureAt > 0, 'sets last failure timestamp');
assert(a?.lastErrorCategory === 'proxy', 'stores last error category');

await recordHealth('a', 'success', 'page-load');
a = await getSourceHealth('a');
assert(a?.pageLoadSuccesses === 1, 'records page load success');

await resetSourceHealth('a');
a = await getSourceHealth('a');
assert(a === undefined, 'reset removes health record');

// --- isHealthy / sourceScore ---
assert(isHealthy(undefined), 'unknown source is healthy');
assert(sourceScore(undefined) === 0.5, 'unknown source has neutral score');

const healthy = health('h', 5, 1);
assert(isHealthy(healthy), 'mostly-successful source is healthy');
assert(sourceScore(healthy) > 0.5 && sourceScore(healthy) < 1, 'healthy source score is above neutral');

const unhealthy = health('u', 1, 5, 0, 0, 100, 200);
assert(!isHealthy(unhealthy), 'mostly-failing source is unhealthy');
assert(sourceScore(unhealthy) < 0.5, 'unhealthy source score is below neutral');

const recentlyRecovered = health('r', 5, 5, 0, 0, 200, 100);
assert(isHealthy(recentlyRecovered), 'source with latest success is healthy despite past failures');

const justFailed = health('f', 5, 5, 0, 0, 100, 200);
assert(!isHealthy(justFailed), 'source whose latest event is a failure is unhealthy');

// --- loadSourceHealth ---
await recordHealth('src1', 'success', 'chapter-resolution');
await recordHealth('src2', 'failure', 'page-load', new Error('timeout'));
const loaded = await loadSourceHealth([makeSource('src1'), makeSource('src2'), makeSource('src3')]);
assert(loaded['src1'] !== undefined, 'loadSourceHealth returns existing health for src1');
assert(loaded['src2'] !== undefined, 'loadSourceHealth returns existing health for src2');
assert(loaded['src3'] === undefined, 'loadSourceHealth omits sources with no health');

// --- rankSources ---
const sources = [
  makeSource('healthy', true, 2),
  makeSource('unhealthy', true, 1),
  makeSource('unknown', true, 3),
  makeSource('disabled', false, 0),
];
const healthMap: Record<string, SourceHealth> = {
  healthy: health('healthy', 10, 0),
  unhealthy: health('unhealthy', 0, 10, 0, 0, 0, 100),
};

const ranked = rankSources(sources, healthMap);
assert(ranked.length === 3, 'rankSources excludes disabled sources');
assert(ranked[0]?.id === 'healthy', 'healthy source ranks first');
assert(ranked[1]?.id === 'unknown', 'unknown source ranks before unhealthy');
assert(ranked[2]?.id === 'unhealthy', 'unhealthy source ranks last');

// Preferred source is boosted when healthy
const preferred = rankSources(sources, healthMap, 'unknown');
assert(preferred[0]?.id === 'unknown', 'preferred healthy unknown source is boosted to first');
assert(preferred[1]?.id === 'healthy', 'healthy source follows preferred');

// Preferred source is not boosted when unhealthy
const preferredUnhealthy = rankSources(sources, healthMap, 'unhealthy');
assert(preferredUnhealthy[0]?.id === 'healthy', 'unhealthy preferred source is not boosted');
assert(preferredUnhealthy[preferredUnhealthy.length - 1]?.id === 'unhealthy', 'unhealthy preferred source still sorts by score');

// Manual priority is the tiebreaker
const tiedSources = [makeSource('a', true, 5), makeSource('b', true, 1), makeSource('c', true, 3)];
const tied = rankSources(tiedSources, {});
assert(tied[0]?.id === 'b', 'lower priority number wins tiebreaker');
assert(tied[1]?.id === 'c', 'priority ordering is stable');
assert(tied[2]?.id === 'a', 'highest priority number is last');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});

if (failures) {
  console.error(`\n${failures} source health check(s) failed`);
  process.exit(1);
}
console.log('\nall source health checks passed');
