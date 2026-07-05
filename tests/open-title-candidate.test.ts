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
  const { titleCandidateRoute } = await import('../src/lib/media/openTitleCandidate');

  const media = await titleCandidateRoute('Solo Leveling', async () => [{ id: 42 }]);
  assert(media.kind === 'media', 'catalog match opens Media');
  assert(media.route === '/media/42', 'catalog match route includes media id');

  const search = await titleCandidateRoute('Unknown Source Title', async () => []);
  assert(search.kind === 'search', 'missing catalog match falls back to Search');
  assert(search.route === '/search?q=Unknown%20Source%20Title', 'search fallback keeps query');

  const empty = await titleCandidateRoute('   ', async () => {
    throw new Error('should not search empty title');
  });
  assert(empty.kind === 'search', 'empty title falls back to Search');
  assert(empty.route === '/search', 'empty title uses plain Search route');

  if (failures) {
    console.error(`\n${failures} open title candidate check(s) failed`);
    process.exit(1);
  }
  console.log('\nall open title candidate checks passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
