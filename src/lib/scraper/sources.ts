import { db } from '../db';
import { fetchText } from '../net';
import { fingerprint } from './fingerprint';
import { presetByHost, presetById } from './presets';

export interface SourceConfig {
  search?: { results?: string; link?: string; title?: string; url?: string };
  chapters?: { list?: string; link?: string };
  chapter?: { pages?: string; imgAttr?: string[] };
}

export interface Source {
  id: string; // host
  name: string;
  url: string; // base
  preset?: string; // CMS preset id
  enabled: boolean;
  priority: number; // lower = higher priority, used for ordering
  config?: SourceConfig; // selector overrides
  addedAt: number;
  status?: 'ready' | 'needs-config' | 'unreachable';
  statusNote?: string;
  checkedAt?: number;
}

export interface SourceCheck {
  base: string;
  preset?: string;
  status: NonNullable<Source['status']>;
  statusNote: string;
  checkedAt: number;
}

export interface AddedSource {
  source: Source;
  check: SourceCheck;
}

const BUILTIN_SOURCE_URLS = [
  'https://mangadex.org/',
  'https://asurascans.com/',
  'https://mangafire.to/home',
];

const INITIAL_SOURCES_KEY = 'koma.sources.seeded.v1';
let ensureInitialSourcesPromise: Promise<void> | null = null;

export async function listSources(): Promise<Source[]> {
  await ensureInitialSources();
  const rows = await db.sources.orderBy('addedAt').reverse().toArray();
  return rows.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}
export async function getSource(id: string): Promise<Source | undefined> {
  await ensureInitialSources();
  return db.sources.get(id);
}
export async function removeSource(id: string): Promise<void> {
  await db.sources.delete(id);
}
export async function toggleSource(id: string, enabled: boolean): Promise<void> {
  await db.sources.update(id, { enabled });
}
export async function updateSource(id: string, patch: Partial<Source>): Promise<void> {
  await db.sources.update(id, patch);
}
export async function updateSourcePriority(id: string, priority: number): Promise<void> {
  await db.sources.update(id, { priority });
}

export async function checkSourceUrl(rawUrl: string): Promise<SourceCheck> {
  const base = normalizeBase(rawUrl);
  const host = new URL(base).host.replace(/^www\./, '');
  const knownPreset = presetByHost(host)?.id;
  try {
    const html = await fetchText(base, { referer: base });
    const preset = fingerprint(html) || knownPreset;
    if (preset) {
      const presetName = presetById(preset)?.name ?? preset;
      return {
        base,
        preset,
        status: 'ready',
        statusNote: `Detected ${presetName}. Source looks ready.`,
        checkedAt: Date.now(),
      };
    }
    return {
      base,
      status: 'needs-config',
      statusNote: 'Saved, but no supported preset was detected yet.',
      checkedAt: Date.now(),
    };
  } catch (e) {
    if (knownPreset) {
      const presetName = presetById(knownPreset)?.name ?? knownPreset;
      return {
        base,
        preset: knownPreset,
        status: 'ready',
        statusNote: `Recognized ${presetName}. Live site check failed, but this source is supported.`,
        checkedAt: Date.now(),
      };
    }
    return {
      base,
      status: 'unreachable',
      statusNote: `Saved, but the site could not be checked: ${String(e)}`,
      checkedAt: Date.now(),
    };
  }
}

// Add a site by URL: fetch its home page, fingerprint the CMS, and save a visible status.
export async function addByUrl(rawUrl: string): Promise<AddedSource> {
  const check = await checkSourceUrl(rawUrl);
  const count = await db.sources.count();
  const source: Source = {
    id: new URL(check.base).host,
    name: friendlySourceName(check.base),
    url: check.base,
    preset: check.preset,
    enabled: true,
    priority: count, // append at end
    addedAt: Date.now(),
    status: check.status,
    statusNote: check.statusNote,
    checkedAt: check.checkedAt,
  };
  await db.sources.put(source);
  return { source, check };
}

export async function importSources(json: string): Promise<Source[]> {
  const arr = JSON.parse(json) as Partial<Source>[];
  const out: Source[] = [];
  let idx = await db.sources.count();
  for (const s of arr) {
    if (!s?.url) continue;
    const base = normalizeBase(s.url);
    const src: Source = {
      id: new URL(base).host,
      name: s.name || friendlySourceName(base),
      url: base,
      preset: s.preset,
      enabled: s.enabled ?? true,
      priority: s.priority ?? idx++,
      config: s.config,
      addedAt: Date.now(),
      status: s.status ?? (s.preset ? 'ready' : 'needs-config'),
      statusNote: s.statusNote ?? (s.preset ? 'Imported with preset.' : 'Imported without a detected preset.'),
      checkedAt: s.checkedAt ?? Date.now(),
    };
    await db.sources.put(src);
    out.push(src);
  }
  return out;
}

export async function recheckSource(id: string): Promise<Source | undefined> {
  const source = await getSource(id);
  if (!source) return undefined;
  const check = await checkSourceUrl(source.url);
  const updated: Source = {
    ...source,
    preset: check.preset ?? source.preset,
    status: check.status,
    statusNote: check.statusNote,
    checkedAt: check.checkedAt,
  };
  await db.sources.put(updated);
  return updated;
}

export async function enabledSources(): Promise<Source[]> {
  await ensureInitialSources();
  return (await listSources()).filter((s) => s.enabled);
}
export async function nextPriority(): Promise<number> {
  const all = await listSources();
  return all.length > 0 ? Math.max(...all.map((s) => s.priority ?? 0)) + 1 : 0;
}

async function ensureInitialSources(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(INITIAL_SOURCES_KEY) === '1') return;
  if (ensureInitialSourcesPromise) return ensureInitialSourcesPromise;
  ensureInitialSourcesPromise = (async () => {
    const existing = await db.sources.count();
    if (existing > 0) {
      window.localStorage.setItem(INITIAL_SOURCES_KEY, '1');
      return;
    }
    for (const url of BUILTIN_SOURCE_URLS) {
      await addByUrl(url);
    }
    window.localStorage.setItem(INITIAL_SOURCES_KEY, '1');
  })();
  try {
    await ensureInitialSourcesPromise;
  } finally {
    ensureInitialSourcesPromise = null;
  }
}

function normalizeBase(u: string): string {
  let url = u.trim();
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  // strip trailing path beyond the origin for a base
  try {
    const p = new URL(url);
    return p.origin + '/';
  } catch {
    return url.replace(/\/+$/, '') + '/';
  }
}

function friendlySourceName(base: string): string {
  const host = new URL(base).host.replace(/^www\./, '');
  const known: Record<string, string> = {
    'mangadex.org': 'MangaDex',
    'asurascans.com': 'Asura Scans',
    'mangafire.to': 'MangaFire',
  };
  return known[host] ?? host;
}
