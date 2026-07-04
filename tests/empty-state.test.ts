import { emptyState } from '../src/lib/ui/emptyState';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  }
}

const sources = emptyState('sources');
assert(sources.title === 'No sources yet', 'sources title');
assert(sources.action?.label === 'Add Source', 'sources primary action');
assert(sources.action?.href === '/settings', 'sources action href');

const library = emptyState('library');
assert(library.title === 'Library is empty', 'library title');
assert(library.action?.label === 'Browse Titles', 'library action');
assert(library.secondary?.label === 'Search', 'library secondary action');

const search = emptyState('search', 'Ninja');
assert(search.title.includes('Ninja'), 'search title includes query');
assert(search.action?.label === 'Browse Home', 'search action');

const history = emptyState('history');
assert(history.title === 'No activity yet', 'history title');

const chapters = emptyState('chapters');
assert(chapters.title === 'No chapters found', 'chapters title');
assert(chapters.action?.href === '/settings', 'chapters action href');

const updates = emptyState('updates');
assert(updates.title === 'No new updates', 'updates title');

const browse = emptyState('browse');
assert(browse.title === 'No results match your filters', 'browse title');

if (failures) {
  console.error(`\n${failures} empty-state check(s) failed`);
  process.exit(1);
}
console.log('\nall empty-state checks passed');
