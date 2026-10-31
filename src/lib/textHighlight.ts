// ponytail: pure text→HTML helpers for CommandSearch's {@html} sink.
// They live outside the component so they are unit-testable: the {@html}
// render at the call site is a live XSS seam if escaping ever regresses, so
// these functions carry regression tests (tests/xss-regression.test.ts) that
// fire hostile remote-title and user-query payloads at them.

// Highlight matching text in a string.
// Title text comes from a remote catalog and the query is user input —
// both are HTML-escaped here because the result is rendered via {@html}.
export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function highlightText(text: string, q: string) {
  if (!q.trim()) return escapeHtml(text);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase()
      ? `<mark>${escapeHtml(part)}</mark>`
      : escapeHtml(part),
  ).join('');
}
