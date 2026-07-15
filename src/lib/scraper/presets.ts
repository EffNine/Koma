import type { Source, SourceConfig } from './sources';

export interface PresetConfig {
  search: { url: string; results: string; link: string; title: string };
  chapters: { list: string; link: string };
  chapter: { pages: string; imgAttr: string[] };
}

import type { DriverId } from './driver';

export interface Preset {
  id: string;
  name: string;
  hosts?: string[];
  detect: RegExp;
  driver?: DriverId;
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
  detect: /MangaDex|Unsupported Browser|api\.mangadex\.org/i,
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

// MangaStream — a common custom PHP theme used by many scanlation groups.
// Similar structure to Madara but with different class names.
export const mangaStream: Preset = {
  id: 'mangastream',
  name: 'MangaStream (custom PHP theme)',
  hosts: [],
  detect: /mangastream|MangaStream|class="[^"]*chapter-content[^"]*"|id="readerarea"/i,
  driver: 'html',
  config: {
    search: {
      url: '/?s={q}',
      results: '.listupd .bs, .listupd .bsx, .listupd article',
      link: 'a[href*="manga/"], a[href*="series/"], a[href*="comic/"]',
      title: '.tt, h4, .bs .tt',
    },
    chapters: {
      list: '#chapterlist li, .clstyle li, .eplister li, ul.chapter-list li',
      link: 'a',
    },
    chapter: {
      pages: '#readerarea img, .chapter-content img, .read-content img, #images img',
      imgAttr: ['data-src', 'data-lazy-src', 'src'],
    },
  },
};

// Genkan — a modern React-based CMS used by many scanlation groups (Reaper Scans, etc.).
// SSR-rendered, so the HTML is available.
export const genkan: Preset = {
  id: 'genkan',
  name: 'Genkan (React-based CMS)',
  hosts: [],
  detect: /genkan|__NEXT_DATA__|chakra-ui|@chakra/gi,
  driver: 'html',
  config: {
    search: {
      url: '/search?q={q}',
      results: 'a[href*="/series/"], a[href*="/manga/"]',
      link: ':scope',
      title: 'h3, h4, .title, [class*="title"]',
    },
    chapters: {
      list: 'a[href*="/chapter/"], a[href*="/read/"]',
      link: ':scope',
    },
    chapter: {
      pages: 'img[alt*="Page"], .chapter-images img, [class*="page"] img',
      imgAttr: ['src', 'data-src'],
    },
  },
};

// WP Manga — another common WordPress manga theme, similar to Madara.
export const wpManga: Preset = {
  id: 'wpmanga',
  name: 'WP Manga (WordPress theme)',
  hosts: [],
  detect: /wp-manga|manga\s*reading\s*theme|mangabooth/i,
  driver: 'html',
  config: {
    search: {
      url: '/?s={q}&post_type=wp-manga',
      results: '.c-tabs-item__content, .c-tabs-item, .page-item-detail',
      link: 'a[href*="manga/"], a.tab-thumb, .post-title a',
      title: '.post-title, h3, h4',
    },
    chapters: {
      list: '.wp-manga-chapter, li.wp-manga-chapter, .listing-chapters li',
      link: 'a',
    },
    chapter: {
      pages: '.reading-content img, .page-break img, .text-center img',
      imgAttr: ['data-src', 'data-lazy-src', 'src'],
    },
  },
};

export const mangaPill: Preset = {
  id: 'mangapill',
  name: 'MangaPill',
  hosts: ['mangapill.com'],
  detect: /MangaPill|mangapill\.com/i,
  driver: 'html',
  config: {
    search: {
      url: '/search?q={q}',
      results: 'a[href^="/manga/"]',
      link: ':scope',
      title: 'h2, h3, .font-bold, [class*="title"]',
    },
    chapters: {
      list: '#chapters a[href^="/chapters/"], a[href*="/chapters/"], .grid a[href*="/chapters/"]',
      link: ':scope',
    },
    chapter: {
      pages: 'img.js-page, img[data-src][class*="page"], .js-page img',
      imgAttr: ['data-src', 'src'],
    },
  },
};

export const weebCentral: Preset = {
  id: 'weebcentral',
  name: 'WeebCentral',
  hosts: ['weebcentral.com'],
  detect: /weebcentral\.com|Weeb\s*Central/i,
  driver: 'html',
  config: {
    search: {
      url: '/search/data?text={q}&sort=Best+Match&order=Descending&display_mode=Full+Display',
      results: 'article > a.link, span.tooltip a, a[href*="/series/"]',
      link: ':scope',
      title: 'span[data-tip], article[data-tip], [class*="grow"]',
    },
    chapters: {
      list: 'a[href*="/chapters/"]',
      link: ':scope',
    },
    chapter: {
      pages: 'main section img[alt*="Page"], section img[alt*="Page"]',
      imgAttr: ['src', 'data-src'],
    },
  },
};

export const comick: Preset = {
  id: 'comick',
  name: 'ComicK (HTML + API hybrid)',
  hosts: ['comickz.co.uk'],
  detect: /ComicK|comickz\.co\.uk/i,
  driver: 'comick',
};

export const comickApi: Preset = {
  id: 'comick-api',
  name: 'ComicK API (direct api.comick.io)',
  hosts: ['api.comick.io'],
  detect: /api\.comick\.io/i,
  driver: 'comick-api',
};

export const PRESETS: Preset[] = [madara, mangaReader, mangaDex, asura, mangaFire, mangaStream, genkan, wpManga, mangaPill, weebCentral, comick, comickApi];

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
