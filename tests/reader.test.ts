import { deriveDirection } from '../src/lib/reader/state.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

assert(deriveDirection('JP') === 'rtl', 'JP defaults to rtl manga paging');
assert(deriveDirection('KR') === 'vertical', 'KR uses vertical webtoon scroll');
assert(deriveDirection('CN') === 'ltr', 'CN uses ltr paging');
assert(deriveDirection(null) === 'rtl', 'null country falls back to rtl');
assert(deriveDirection(undefined) === 'rtl', 'undefined country falls back to rtl');

if (failures) {
  console.error(`\n${failures} reader check(s) failed`);
  process.exit(1);
}

console.log('\nall reader checks passed');
