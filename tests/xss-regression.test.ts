/**
 * XSS regression tests for the CommandSearch {@html} sink.
 *
 * The command-search results render with {@html} (see
 * src/lib/components/CommandSearch.svelte). The only thing standing between
 * a hostile remote catalog title / user query and script execution is the
 * escaping in src/lib/textHighlight.ts. These tests drive the pure helpers
 * with payload-style input and assert that no executable markup survives:
 * the strictest possible invariant is "after removing the highlighter's own
 * <mark> tags, no raw `<`, `>` or `'` from data survives".
 */
import { escapeHtml, highlightText } from '../src/lib/textHighlight';

const PAYLOAD_TITLE = 'Evil"><img src=x onerror=alert(1)><b>bold</b>&copy;';
const PAYLOAD_QUERY_SCRIPT = '"><script>alert(1)</script>';
const PAYLOAD_QUERY_QUOTE = "'; alert(1); 'x";
const PAYLOAD_QUERY_BACKTICK = '`+alert(1)+`';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`ok: ${name}`);
  } else {
    failed++;
    console.log(`X: ${name}${detail ? ` (${detail})` : ''}`);
  }
}

// --- escapeHtml primitive ---

check(
  'escapeHtml neutralizes angle brackets, quotes and ampersands',
  escapeHtml('<a href="x"&quote!>') === '&lt;a href=&quot;x&quot;&amp;quote!&gt;',
  escapeHtml('<a href="x"&quote!>'),
);

// --- no query: remote title must be fully escaped ---

const out1 = highlightText(PAYLOAD_TITLE, '');
check(
  'no-query: no raw markup survives a hostile title',
  !out1.includes('<') && !out1.includes('>') && !out1.includes('"'),
  out1,
);
check(
  'no-query: escaped entities are produced (not dropped)',
  out1.includes('&lt;img') && out1.includes('&lt;b&gt;') && out1.includes('&amp;copy;'),
  out1,
);

// --- helper: output minus the highlighter's own <mark> tags ---

function withoutMarks(out: string): string {
  return out.replace(/<\/?mark>/g, '');
}

// --- hostile query against a hostile title ---

const out2 = highlightText(PAYLOAD_TITLE, PAYLOAD_QUERY_SCRIPT);
check(
  'hostile script query: no <img>/<script> literal survives',
  !/<img|<script/i.test(out2),
  out2,
);
check(
  'hostile script query: only the highlighter emits markup (<mark>)',
  !withoutMarks(out2).includes('<'),
  withoutMarks(out2),
);

// --- quote / backtick payloads in the query ---

for (const [qname, q] of [
  ['single-quote', PAYLOAD_QUERY_QUOTE],
  ['backtick', PAYLOAD_QUERY_BACKTICK],
] as [string, string][]) {
  const out = highlightText(PAYLOAD_TITLE, q);
  const stripped = withoutMarks(out);
  check(
    `payload query "${qname}": no raw markup outside mark tags`,
    !stripped.includes('<') && !stripped.includes('>'),
    stripped,
  );
  check(
    `payload query "${qname}": no raw single-quote outside mark tags`,
    !stripped.includes("'"),
    stripped,
  );
}

// --- benign behavior must not regress ---

check(
  'benign: matched fragment is wrapped in <mark>',
  highlightText('One Piece', 'piece') === 'One <mark>Piece</mark>',
  highlightText('One Piece', 'piece'),
);
check(
  'benign: regex metachars in query are treated literally',
  highlightText('a.b*c', '.') === 'a<mark>.</mark>b*c',
  highlightText('a.b*c', '.'),
);
check(
  'benign: plain title with plain query escapes and highlights',
  highlightText('Attack On Titan', 'att') === '<mark>Att</mark>ack On Titan',
  highlightText('Attack On Titan', 'att'),
);

if (failed > 0) {
  console.error(`xss-regression: ${failed} failed / ${passed} passed`);
  process.exit(1);
}
console.log(`xss-regression: all ${passed} checks passed`);
