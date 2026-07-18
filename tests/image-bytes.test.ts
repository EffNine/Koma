import assert from 'node:assert/strict';
import { detectImageMime } from '../src/lib/util/imageBytes';

assert.equal(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), 'image/png');
assert.equal(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
assert.equal(detectImageMime(new Uint8Array([0x47, 0x49, 0x46, 0x38])), 'image/gif');
assert.equal(
  detectImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
  'image/webp',
);
assert.equal(detectImageMime(new Uint8Array([0x46, 0x69, 0x6c, 0x65])), null); // "File"
assert.equal(detectImageMime(new Uint8Array([0x3c, 0x21, 0x64, 0x6f])), null); // "<!do"
assert.equal(detectImageMime(new Uint8Array([1, 2])), null);

console.log('image bytes tests passed');
