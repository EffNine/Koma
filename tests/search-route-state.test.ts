import assert from 'node:assert/strict';
import {
  DEFAULT_SEARCH_SORT,
  emptySearchRouteState,
  hasSearchRouteState,
  parseSearchRouteParams,
  searchRoutePath,
} from '../src/lib/search/searchRouteState';

assert.deepEqual(parseSearchRouteParams('#/search'), emptySearchRouteState());
assert.deepEqual(parseSearchRouteParams('#/search?q=solo%20leveling&genres=action,long-strip&status=completed&country=kr&time=180&sort=user_follow_count'), {
  q: 'solo leveling',
  selectedGenres: ['action', 'long-strip'],
  country: 'kr',
  sort: 'user_follow_count',
  status: 'completed',
  time: '180',
});

assert.deepEqual(parseSearchRouteParams('#/search?genres=action,, long-strip '), {
  ...emptySearchRouteState(),
  selectedGenres: ['action', 'long-strip'],
});

assert.equal(hasSearchRouteState(emptySearchRouteState()), false);
assert.equal(hasSearchRouteState({ ...emptySearchRouteState(), selectedGenres: ['action'] }), true);
assert.equal(hasSearchRouteState({ ...emptySearchRouteState(), sort: 'user_follow_count' }), true);

assert.equal(searchRoutePath(emptySearchRouteState()), '/search');
assert.equal(searchRoutePath({
  q: '  solo leveling  ',
  selectedGenres: ['action', 'long-strip'],
  country: 'kr',
  sort: 'user_follow_count',
  status: 'completed',
  time: '180',
}), '/search?q=solo+leveling&genres=action%2Clong-strip&status=completed&country=kr&time=180&sort=user_follow_count');

assert.equal(searchRoutePath({
  ...emptySearchRouteState(),
  sort: DEFAULT_SEARCH_SORT,
}), '/search');

console.log('search route state tests passed');
