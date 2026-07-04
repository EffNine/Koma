import { needsConfirmation, confirmPrompt } from '../src/lib/ui/confirm';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  }
}

assert(needsConfirmation('unfollow'), 'unfollow needs confirmation');
assert(needsConfirmation('removeSource'), 'removeSource needs confirmation');
assert(needsConfirmation('clearCache'), 'clearCache needs confirmation');

const unfollow = confirmPrompt('unfollow', 'One Piece');
assert(unfollow.title === 'Unfollow One Piece?', 'unfollow title');
assert(unfollow.destructive, 'unfollow is destructive');
assert(unfollow.confirm === 'Unfollow', 'unfollow confirm label');

const remove = confirmPrompt('removeSource', 'ComicK');
assert(remove.title === 'Remove ComicK?', 'remove source title');
assert(remove.confirm === 'Remove', 'remove source confirm label');

const clear = confirmPrompt('clearCache');
assert(clear.title === 'Clear catalog cache?', 'clear cache title');

if (failures) {
  console.error(`\n${failures} confirmation check(s) failed`);
  process.exit(1);
}
console.log('\nall confirmation checks passed');
