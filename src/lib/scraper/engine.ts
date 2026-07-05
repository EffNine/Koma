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
  /** Scanlation group name (ComicK API provides this). */
  group?: string;
  /** ISO timestamp of when the chapter was uploaded. */
  createdAt?: string;
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
    const v = el.getAttribute(a)?.trim();
    if (v && /^https?:/i.test(v)) return v;
  }
  // ponytail: some sites store protocol-relative or root-relative in data-src
  for (const a of attrs) {
    const v = el.getAttribute(a)?.trim();
    if (v && v.startsWith('//')) return 'https:' + v;
    if (v && v.startsWith('/')) return v;
  }
  return null;
}

function pickLink(root: Element, selector: string): Element | null {
  if (!selector || selector === ':scope') return root;
  if (root.matches(selector)) return root;
  return root.querySelector(selector);
}

export function extractSeriesLinks(html: string, source: Source): ScrapedSeries[] {
  const cfg = effectiveConfig(source);
  if (!cfg) return [];
  const doc = parse(html);
  const out = new Map<string, ScrapedSeries>();
  for (const r of doc.querySelectorAll(cfg.search.results)) {
    const a = pickLink(r, cfg.search.link);
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
    const a = pickLink(li, cfg.chapters.link);
    if (!a) continue;
    const href = absUrl(source.url, a.getAttribute('href'));
    if (!href) continue;
    const text = a.textContent?.trim() || '';
    const fromText = parseChapterNumber(text);
    const fromUrl = parseChapterNumberFromUrl(href);
    const number = fromUrl ?? fromText;
    const title = number ? `Chapter ${number}` : text;
    out.set(href, { url: href, number, title });
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
    const src = firstAttr(img, cfg.chapter.imgAttr);
    if (src && !seen.has(src)) {
      seen.add(src);
      out.push(absUrl(source.url, src));
    }
  }
  return out;
}

// ponytail: fuzzy title match — token-jaccard + Levenshtein. Handles articles,
// hyphen-vs-space, extra words, and minor source slug differences.
export function matchSeries(candidates: ScrapedSeries[], query: string): ScrapedSeries | null {
  if (!query.trim()) return candidates[0] ?? null;
  const q = norm(query);
  if (!q) return null;

  // Exact / substring wins first.
  for (const c of candidates) {
    const n = norm(c.title);
    if (n.includes(q) || q.includes(n)) return c;
  }

  const qTokens = tokenSet(query);
  let best: ScrapedSeries | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const cTokens = tokenSet(c.title);
    const jaccard = tokenJaccard(qTokens, cTokens);
    const lev = 1 - levenshtein(norm(query), norm(c.title)) / Math.max(q.length, norm(c.title).length || 1);
    const score = Math.max(jaccard, lev);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 0.7 ? best : null;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0 && !STOPWORDS.has(w)),
  );
}

function tokenJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'at', 'to', 'for', 'with']);

function levenshtein(a: string, b: string): number {
  if (a.length < b.length) return levenshtein(b, a);
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr.push(Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function parseChapterNumber(text: string): string | null {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

// ponytail: Asura-style chapter URLs encode the number in the path (e.g. /chapter/127).
// Use that as a fallback when link text contains dates/noise.
export function parseChapterNumberFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\/chapter\/(\d+(?:\.\d+)?)(?:\/|$)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function compareChapterAsc(a: string | null | undefined, b: string | null | undefined): number {
  return cmpNum(a ?? null, b ?? null);
}

export function compareChapterDesc(a: string | null | undefined, b: string | null | undefined): number {
  return cmpNum(b ?? null, a ?? null);
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
