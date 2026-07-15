import assert from 'node:assert/strict';
import {
  DEFAULT_SEARCH_SORT,
  emptySearchRouteState,
  hasSearchRouteState,
  parseSearchRouteParams,
  searchRoutePath,
} from '../src/lib/search/searchRouteState';

assert.deepEqual(parseSearchRouteParams('#/search'), emptySearchRouteState());
assert.deepEqual(parseSearchRouteParams('#/search?q=solo%20leveling&genres=Action,Adventure&status=completed&country=kr&sort=POPULARITY_DESC'), {
  q: 'solo leveling',
  selectedGenres: ['Action', 'Adventure'],
  country: 'kr',
  sort: 'POPULARITY_DESC',
  status: 'completed',
});

assert.deepEqual(parseSearchRouteParams('#/search?genres=Action,, Adventure '), {
  ...emptySearchRouteState(),
  selectedGenres: ['Action', 'Adventure'],
});

assert.equal(hasSearchRouteState(emptySearchRouteState()), false);
assert.equal(hasSearchRouteState({ ...emptySearchRouteState(), selectedGenres: ['Action'] }), true);
assert.equal(hasSearchRouteState({ ...emptySearchRouteState(), sort: 'POPULARITY_DESC' }), true);

assert.equal(searchRoutePath(emptySearchRouteState()), '/search');
assert.equal(searchRoutePath({
  q: '  solo leveling  ',
  selectedGenres: ['Action', 'Adventure'],
  country: 'kr',
  sort: 'POPULARITY_DESC',
  status: 'completed',
}), '/search?q=solo+leveling&genres=Action%2CAdventure&status=completed&country=kr&sort=POPULARITY_DESC');

assert.equal(searchRoutePath({
  ...emptySearchRouteState(),
  sort: DEFAULT_SEARCH_SORT,
}), '/search');

console.log('search route state tests passed');
