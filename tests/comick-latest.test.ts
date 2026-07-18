import assert from 'node:assert/strict';
import { isPlaceholderCover } from '../src/lib/scraper/comickLatest';

assert.equal(
  isPlaceholderCover('https://cdn1.comicknew.pictures/foo/covers/40bb6193.webp'),
  true,
);
assert.equal(
  isPlaceholderCover('https://cdn1.comicknew.pictures/foo/covers/89483fcd.webp'),
  false,
);
assert.equal(isPlaceholderCover(''), true);
assert.equal(isPlaceholderCover(null), true);

console.log('comick latest tests passed');
