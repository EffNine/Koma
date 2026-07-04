// Minimal DOM mock for the tiny hash router, then dynamic import.
const loc = { _hash: '' };
Object.defineProperty(globalThis, 'location', {
  get() {
    return {
      get hash() { return loc._hash; },
      set hash(v: string) { loc._hash = v.startsWith('#') ? v : '#' + v; },
    };
  },
  configurable: true,
});
(globalThis as any).window = {
  addEventListener() {},
  removeEventListener() {},
};

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  }
}

async function run() {
  const { match, go } = await import('../src/lib/router');

  // match
  assert(JSON.stringify(match('/media/:id', '/media/123')) === JSON.stringify({ id: '123' }), 'match extracts id');
  assert(match('/media/:id', '/library/123') === null, 'match rejects different prefix');
  assert(match('/reader/:a/:b/:c/:d', '/reader/1/src/series/chapter') !== null, 'match accepts multiple params');
  assert(match('/reader/:a/:b/:c/:d', '/reader/1/src/series') === null, 'match rejects short path');
  assert(match('/search', '/search') !== null, 'match accepts static path');

  // go
  const before = location.hash;
  go('/test-route');
  assert(location.hash === '#/test-route', 'go sets hash');
  location.hash = before;

  if (failures) {
    console.error(`\n${failures} router check(s) failed`);
    process.exit(1);
  }
  console.log('\nall router checks passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
