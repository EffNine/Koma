import { pairPages, pageToSpreadIndex } from '../src/lib/reader/spread.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

// RTL pairing
const rtlPairs = pairPages(5, 'rtl');
assert(rtlPairs.length === 3, 'RTL 5 pages produces 3 pairs');
assert(rtlPairs[0].left === -1 && rtlPairs[0].right === 0, 'RTL cover (page 0) is alone on the right');
assert(rtlPairs[1].left === 2 && rtlPairs[1].right === 1, 'RTL pair 1: page 2 left, page 1 right');
assert(rtlPairs[2].left === 4 && rtlPairs[2].right === 3, 'RTL pair 2: page 4 left, page 3 right');

// RTL odd pages (7 pages: 0-6, pairs: [cover], [2,1], [4,3], [6,5])
const rtl7 = pairPages(7, 'rtl');
assert(rtl7.length === 4, 'RTL 7 pages produces 4 pairs');
assert(rtl7[3].left === 6 && rtl7[3].right === 5, 'RTL last pair: page 6 left, page 5 right');

// RTL even pages (8 pages: 0-7, pairs: [cover], [2,1], [4,3], [6,5], [7 alone])
const rtl8 = pairPages(8, 'rtl');
assert(rtl8.length === 5, 'RTL 8 pages produces 5 pairs');
assert(rtl8[4].left === -1 && rtl8[4].right === 7, 'RTL last page (7) alone on the right');

// LTR pairing
const ltrPairs = pairPages(6, 'ltr');
assert(ltrPairs.length === 3, 'LTR 6 pages produces 3 pairs');
assert(ltrPairs[0].left === 0 && ltrPairs[0].right === 1, 'LTR pair 0: page 0 left, page 1 right');
assert(ltrPairs[1].left === 2 && ltrPairs[1].right === 3, 'LTR pair 1: page 2 left, page 3 right');
assert(ltrPairs[2].left === 4 && ltrPairs[2].right === 5, 'LTR pair 2: page 4 left, page 5 right');

// LTR odd pages
const ltrOdd = pairPages(3, 'ltr');
assert(ltrOdd.length === 2, 'LTR 3 pages produces 2 pairs');
assert(ltrOdd[1].left === 2 && ltrOdd[1].right === -1, 'LTR last odd page alone on the left');

// Empty
assert(pairPages(0, 'rtl').length === 0, '0 pages produces empty array');
assert(pairPages(0, 'ltr').length === 0, '0 pages produces empty array');

// pageToSpreadIndex
const pairs = pairPages(10, 'rtl');
assert(pageToSpreadIndex(0, pairs) === 0, 'page 0 is in spread 0');
assert(pageToSpreadIndex(1, pairs) === 1, 'page 1 is in spread 1');
assert(pageToSpreadIndex(2, pairs) === 1, 'page 2 is in spread 1');
assert(pageToSpreadIndex(9, pairs) === 5, 'page 9 is in spread 5');
assert(pageToSpreadIndex(99, pairs) === -1, 'out of range returns -1');

if (failures) {
  console.error(`\n${failures} spread check(s) failed`);
  process.exit(1);
}

console.log('\nall spread checks passed');
