import { effectiveConfig } from './presets';
import type { PresetConfig } from './presets';
import type { Source } from './sources';

// Pure extraction — no fetch, no Tauri. Uses the global DOMParser (browser) so it is
// deterministically testable with fixtures (node test polyfills DOMParser from linkedom).

export interface ScrapedSeries {
  url: string;
  title: string;
}
export interface ScrapedChapter {
  url: string;
  number: string | null;
  title: string | null;
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function absUrl(base: string, href: string | null): string {
  if (!href) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function firstAttr(el: Element, attrs: string[]): string | null {
  for (const a of attrs) {
    const v = el.getAttribute(a);
    if (v && /^https?:/i.test(v)) return v;
  }
  // ponytail: some sites store protocol-relative or root-relative in data-src
  for (const a of attrs) {
    const v = el.getAttribute(a);
    if (v && v.startsWith('//')) return 'https:' + v;
  }
  return null;
}

function pickLink(root: Element, selector: string): Element | null {
  if (!selector || selector === ':scope') return root;
  if (root.matches(selector)) return root;
  return root.querySelector(selector) as Element | null;
}

export function extractSeriesLinks(html: string, source: Source): ScrapedSeries[] {
  const cfg = effectiveConfig(source);
  if (!cfg) return [];
  const doc = parse(html);
  const out = new Map<string, ScrapedSeries>();
  for (const r of doc.querySelectorAll(cfg.search.results)) {
    const a = pickLink(r as Element, cfg.search.link);
    if (!a) continue;
    const href = absUrl(source.url, a.getAttribute('href'));
    if (!href) continue;
    const t = (r.querySelector(cfg.search.title) || a).textContent?.trim() || '';
    if (!out.has(href)) out.set(href, { url: href, title: t });
  }
  return [...out.values()];
}

export function extractChapters(html: string, source: Source): ScrapedChapter[] {
  const cfg = effectiveConfig(source);
  if (!cfg) return [];
  const doc = parse(html);
  const out = new Map<string, ScrapedChapter>();
  for (const li of doc.querySelectorAll(cfg.chapters.list)) {
    const a = pickLink(li as Element, cfg.chapters.link);
    if (!a) continue;
    const href = absUrl(source.url, a.getAttribute('href'));
    if (!href) continue;
    const text = a.textContent?.trim() || '';
    out.set(href, { url: href, number: parseChapterNumber(text), title: text });
  }
  // chapters usually listed newest-first; return ascending by number when parseable
  return [...out.values()].sort((x, y) => cmpNum(x.number, y.number));
}

export function extractPages(html: string, source: Source): string[] {
  const cfg = effectiveConfig(source);
  if (!cfg) return [];
  const doc = parse(html);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const img of doc.querySelectorAll(cfg.chapter.pages)) {
    const src = firstAttr(img as Element, cfg.chapter.imgAttr);
    if (src && !seen.has(src)) {
      seen.add(src);
      out.push(absUrl(source.url, src));
    }
  }
  return out;
}

// ponytail: naive title match — normalized contains both ways. Upgrade to Levenshtein if it mismatches.
export function matchSeries(candidates: ScrapedSeries[], query: string): ScrapedSeries | null {
  if (!query.trim()) return candidates[0] ?? null;
  const q = norm(query);
  if (!q) return null;
  for (const c of candidates) if (norm(c.title).includes(q) || q.includes(norm(c.title))) return c;
  return null;
}

export function parseChapterNumber(text: string): string | null {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function cmpNum(a: string | null, b: string | null): number {
  const x = a ? parseFloat(a) : -1;
  const y = b ? parseFloat(b) : -1;
  return x - y;
}

// re-export for callers that build requests
export type { PresetConfig };
