import { stripHtml, clamp, timeAgo, relativeTime, formatDateTime } from '../src/lib/util';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  }
}

// stripHtml
assert(stripHtml('<p>Hello</p>') === 'Hello', 'stripHtml removes p tags');
assert(stripHtml('a<br/>b') === 'a\nb', 'stripHtml converts br to newline');
assert(stripHtml('a</div>b') === 'a\nb', 'stripHtml converts closing div to newline');
assert(stripHtml('&amp; &lt;&gt; &quot;&#39;') === '& <> "\'', 'stripHtml decodes entities');
assert(stripHtml('  \n\n\n  ') === '', 'stripHtml trims whitespace');

// clamp
assert(clamp(5, 0, 10) === 5, 'clamp keeps value in range');
assert(clamp(-2, 0, 10) === 0, 'clamp clamps to min');
assert(clamp(12, 0, 10) === 10, 'clamp clamps to max');

// timeAgo
const now = Date.now();
assert(timeAgo(now - 30_000) === 'Just now', 'timeAgo shows just now');
assert(timeAgo(now - 120_000) === '2m ago', 'timeAgo shows minutes');
assert(timeAgo(now - 3_600_000) === '1h ago', 'timeAgo shows hours');
assert(timeAgo(now - 86_400_000 * 2) === '2d ago', 'timeAgo shows days');

// relativeTime
assert(relativeTime(undefined) === '', 'relativeTime handles undefined');
assert(relativeTime('invalid') === '', 'relativeTime handles invalid date');
assert(relativeTime(new Date().toISOString()) === 'Just now', 'relativeTime returns just now');

// formatDateTime
const dt = new Date('2026-07-05T14:30:00');
const formatted = formatDateTime(dt.getTime());
assert(formatted.includes('Jul'), 'formatDateTime includes month');
assert(formatted.includes('5'), 'formatDateTime includes day');
assert(formatted.includes(':'), 'formatDateTime includes time');

if (failures) {
  console.error(`\n${failures} util check(s) failed`);
  process.exit(1);
}
console.log('\nall util checks passed');
