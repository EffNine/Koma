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
  const { titleCandidateRoute, broadenTitleQueries } = await import('../src/lib/media/openTitleCandidate');

  // ── broadenTitleQueries ──────────────────────────────────────────

  // Exact title
  const q1 = broadenTitleQueries('Solo Leveling');
  assert(q1.length === 1 && q1[0] === 'Solo Leveling', 'exact title returns one query');

  // Parenthetical subtitle
  const q2 = broadenTitleQueries('Solo Leveling (Official)');
  assert(q2.includes('Solo Leveling'), 'parenthetical subtitle is stripped');
  assert(q2.includes('Solo Leveling (Official)'), 'exact title is kept');

  // Colon subtitle
  const q3 = broadenTitleQueries('The Low-Ranking Employee Is Too Competent: I Can’t Live Without This Job!');
  assert(q3.includes('The Low-Ranking Employee Is Too Competent'), 'colon subtitle is split');
  assert(q3.includes('The Low-Ranking Employee Is Too Competent: I Can’t Live Without This Job!'), 'exact title is kept');

  // Common suffix
  const q4 = broadenTitleQueries('Tower of God Manga');
  assert(q4.includes('Tower of God'), 'Manga suffix is stripped');

  // Empty
  const q5 = broadenTitleQueries('   ');
  assert(q5.length === 0, 'empty title returns no queries');

  // ── titleCandidateRoute ──────────────────────────────────────────

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

  // Broadened query matches (simulates "The Low-Ranking Employee Is Too Competent")
  const broadened = await titleCandidateRoute(
    'The Low-Ranking Employee Is Too Competent: I Can’t Live Without This Job!',
    async (q) => {
      if (q === 'The Low-Ranking Employee Is Too Competent') return [{ id: 99 }];
      return [];
    },
  );
  assert(broadened.kind === 'media', 'broadened query matches catalog');
  assert(broadened.route === '/media/99', 'broadened match route includes media id');

  // Bracketed subtitle broadening
  const bracketed = await titleCandidateRoute('Solo Leveling (Official)', async (q) => {
    if (q === 'Solo Leveling') return [{ id: 42 }];
    return [];
  });
  assert(bracketed.kind === 'media', 'bracketed subtitle broadening matches catalog');
  assert(bracketed.route === '/media/42', 'bracketed broadening route includes media id');

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
