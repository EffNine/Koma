export interface Title {
  id: number;
  idMal?: number;
  title: { romaji?: string; english?: string; native?: string };
  cover?: string;
  banner?: string;
  description?: string; // AniList returns HTML; stripped to text by the UI
  country?: string; // countryOfOrigin: JP | KR | CN | null
  status?: string;
  year?: number;
  chapters?: number;
  volumes?: number;
  genres?: string[];
  averageScore?: number;
  siteUrl?: string;
  synonyms?: string[];
}

export function titleName(t: Title): string {
  return t.title.english || t.title.romaji || t.title.native || String(t.id);
}

/** Common alternative / cleaned forms of a manga/manhwa/manhua title used for source search. */
export function titleAliases(t: Title): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  function push(name: string) {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  }

  const baseNames = [
    t.title.english,
    t.title.romaji,
    t.title.native,
    ...(t.synonyms ?? []),
  ];
  for (const raw of baseNames) {
    const name = raw?.trim();
    if (name) push(name);
  }

  // Cleaned form: replace punctuation with spaces, drop leading "The", collapse spaces.
  for (const name of [...out]) {
    const cleaned = name
      .replace(/[^\w\s]/g, ' ')
      .replace(/^\s*The\b\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned) push(cleaned);
  }

  // Stemmed form: remove trailing season/part/arc numbers and common suffixes.
  for (const name of [...out]) {
    const stemmed = name
      .replace(/\s+(?:season|part|arc)\s*\d+$/i, '')
      .replace(/\s*:\s*\d+$/, '')
      .replace(/\s+\d+$/i, '')
      .replace(/\s+R$/i, '')
      .trim();
    if (stemmed) push(stemmed);
  }

  if (out.length === 0) out.push(String(t.id));
  return out;
}

export type Country = 'JP' | 'KR' | 'CN' | null;

export const GENRE_COLLECTION = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy',
  'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller',
] as const;

export type Genre = (typeof GENRE_COLLECTION)[number];
