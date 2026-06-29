import type { Source, SourceConfig } from './sources';

export interface PresetConfig {
  search: { url: string; results: string; link: string; title: string };
  chapters: { list: string; link: string };
  chapter: { pages: string; imgAttr: string[] };
}

export interface Preset {
  id: string;
  name: string;
  hosts?: string[];
  detect: RegExp;
  driver?: 'html' | 'mangadex';
  config?: PresetConfig;
}

// Madara is the most common WordPress manga theme and is HTML-scrapable.
export const madara: Preset = {
  id: 'madara',
  name: 'Madara (WordPress manga theme)',
  hosts: [],
  detect: /wp-manga-theme|wp-manga|madara/i,
  driver: 'html',
  config: {
    search: {
      url: '/?s={q}&post_type=wp-manga',
      results: '.c-tabs-item__content, .c-tabs-item',
      link: 'a.tab-thumb, .post-title a, .tab-thumb a',
      title: '.post-title, .h4, .tab-summary .post-title',
    },
    chapters: {
      list: '.listing-chapters .wp-manga-chapter, ul.main-version-chapter li.wp-manga-chapter, .listing-chapters > li.wp-manga-chapter',
      link: 'a',
    },
    chapter: {
      pages: '.reading-content .page-break img, .reading-content img',
      imgAttr: ['data-src', 'data-wpfc-src', 'data-lazy-src', 'src'],
    },
  },
};

export const mangaReader: Preset = {
  id: 'mangareader',
  name: 'MangaReader theme',
  hosts: [],
  detect: /wp-theme-mangareader|themes\/mangareader|class="[^"]*wp-theme-mangareader/i,
  driver: 'html',
  config: {
    search: {
      url: '/?s={q}&post_type=wp-manga',
      results: '.magma-grid .legend-card',
      link: '.legend-poster, .legend-title a',
      title: '.legend-title a',
    },
    chapters: {
      list: '.ch-list-grid .ch-item, #chapterlist ul li',
      link: 'a.ch-main-anchor, #chapterlist ul li a',
    },
    chapter: {
      pages: '.reader-area img, .reader-area p img',
      imgAttr: ['data-src', 'data-lazy-src', 'src'],
    },
  },
};

export const mangaDex: Preset = {
  id: 'mangadex',
  name: 'MangaDex',
  hosts: ['mangadex.org'],
  detect: /MangaDex|Unsupported Browser/i,
  driver: 'mangadex',
};

export const asura: Preset = {
  id: 'asura',
  name: 'Asura Scans',
  hosts: ['asurascans.com'],
  detect: /Asura Scans|api\.asurascans\.com|series-card/i,
  driver: 'html',
  config: {
    search: {
      url: '/browse?search={q}',
      results: '.series-card',
      link: 'a[href^="/comics/"]',
      title: 'h3',
    },
    chapters: {
      list: 'a[href^="/comics/"][href*="/chapter/"]',
      link: ':scope',
    },
    chapter: {
      pages: '.select-none img, img[data-page-index]',
      imgAttr: ['src'],
    },
  },
};

export const mangaFire: Preset = {
  id: 'mangafire',
  name: 'MangaFire',
  hosts: ['mangafire.to'],
  detect: /MangaFire|s\.mfcdn\.nl|data-a="/i,
  driver: 'html',
  config: {
    search: {
      // ponytail: MangaFire's real filter route returns 403 to non-browser scrapers.
      // We still scan the home page for recognizable titles as a best-effort fallback.
      url: '/home',
      results: '.unit, .swiper-slide',
      link: 'a[href^="/manga/"]',
      title: '.info > a[href^="/manga/"], .above .unit',
    },
    chapters: {
      list: '.m-list .list-body li.item',
      link: 'a',
    },
    chapter: {
      pages: '#page-wrapper img',
      imgAttr: ['data-src', 'src'],
    },
  },
};

export const PRESETS: Preset[] = [madara, mangaReader, mangaDex, asura, mangaFire];

export function presetById(id?: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function presetByHost(host?: string): Preset | undefined {
  const clean = host?.replace(/^www\./, '').toLowerCase();
  if (!clean) return undefined;
  return PRESETS.find((p) => p.hosts?.includes(clean));
}

// Merge preset selectors with per-source overrides (override wins).
export function effectiveConfig(source: Source): PresetConfig | null {
  const base = presetById(source.preset)?.config;
  const o = source.config;
  if (!base && !o) return null;
  return {
    search: { ...(base?.search ?? { url: '', results: '', link: '', title: '' }), ...(o?.search ?? {}) },
    chapters: { ...(base?.chapters ?? { list: '', link: '' }), ...(o?.chapters ?? {}) },
    chapter: { ...(base?.chapter ?? { pages: '', imgAttr: [] }), ...(o?.chapter ?? {}) },
  };
}

export function searchUrl(source: Source, q: string): string {
  const tpl = effectiveConfig(source)?.search.url || '/?s={q}&post_type=wp-manga';
  return source.url.replace(/\/+$/, '') + tpl.replace('{q}', encodeURIComponent(q));
}
