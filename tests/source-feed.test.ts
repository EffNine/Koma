import assert from 'node:assert/strict';
import {
  COMICK_SOURCE_FEED_ID,
  comickSearchUrl,
  mapComickSearchHit,
  sourceFeedGenreSlug,
} from '../src/lib/sourceFeeds/comick';

assert.equal(sourceFeedGenreSlug('Long Strip'), 'long-strip');
assert.equal(sourceFeedGenreSlug('Slice of Life'), 'slice-of-life');

const url = new URL(comickSearchUrl({
  q: 'solo leveling',
  genres: ['action', 'long-strip'],
  excludeGenres: ['horror'],
  country: 'kr',
  status: 'completed',
  sort: 'user_follow_count',
  time: '180',
  page: 2,
  limit: 30,
}));

assert.equal(url.origin, 'https://comickz.co.uk');
assert.equal(url.pathname, '/api/search');
assert.equal(url.searchParams.get('q'), 'solo leveling');
assert.deepEqual(url.searchParams.getAll('genres[]'), ['action', 'long-strip']);
assert.deepEqual(url.searchParams.getAll('excludes[]'), ['horror']);
assert.equal(url.searchParams.get('country'), 'kr');
assert.equal(url.searchParams.get('status'), '2');
assert.equal(url.searchParams.get('order_by'), 'user_follow_count');
assert.equal(url.searchParams.get('order_direction'), 'desc');
assert.equal(url.searchParams.get('time'), '180');
assert.equal(url.searchParams.get('page'), '2');
assert.equal(url.searchParams.get('limit'), '30');

assert.deepEqual(mapComickSearchHit({
  id: 123,
  hid: 'abc123',
  slug: 'sample-title',
  title: 'Sample Title',
  default_thumbnail: 'https://img.example/cover.jpg',
  last_chapter: 42,
  country: 'kr',
  content_rating: 'safe',
  user_follow_count: 9001,
  year: 2024,
  status: 1,
  genres: [{ slug: 'action', name: 'Action' }],
}), {
  sourceFeedId: COMICK_SOURCE_FEED_ID,
  sourceTitleId: 'abc123',
  slug: 'sample-title',
  title: 'Sample Title',
  cover: 'https://img.example/cover.jpg',
  country: 'kr',
  status: 'ongoing',
  lastChapter: 42,
  genres: ['Action'],
  rating: 'safe',
  followCount: 9001,
  year: 2024,
});

console.log('source feed tests passed');
