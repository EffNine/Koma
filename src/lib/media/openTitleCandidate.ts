import { search } from '../catalog/anilist';
import { go } from '../router';

export interface CatalogTitleMatch {
  id: number;
}

export type CatalogSearchFn = (query: string) => Promise<CatalogTitleMatch[]>;

export type TitleCandidateRoute =
  | { kind: 'media'; route: string; mediaId: number }
  | { kind: 'search'; route: string };

/**
 * Generate progressively-broadened search queries from a source title.
 * Helps when source titles include subtitles, brackets, or suffixes not on AniList.
 *
 * Strategy:
 * 1. Exact title as-is.
 * 2. Remove parenthetical/bracketed subtitles and common suffixes (Manga, Official, etc.).
 * 3. Split on colon/dash to drop subtitle ("Title: Subtitle" → "Title").
 */
export function broadenTitleQueries(title: string): string[] {
  const queries = new Set<string>();
  const normalized = title.trim();
  if (!normalized) return [];

  queries.add(normalized);

  // Remove parenthetical / bracketed content and common suffixes
  const cleaned = normalized
    .replace(/\s*[(\[{].*?[)\]}]\s*/g, ' ')
    .replace(/\s*(Manga|Manhwa|Manhua|Webtoon|Comic|Official|Novel)\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned && cleaned !== normalized) queries.add(cleaned);

  // Split on colon or dash to drop subtitle
  const subtitleSplit = normalized.split(/\s*[:(—–-]\s+/);
  if (subtitleSplit.length > 1 && subtitleSplit[0].trim()) {
    queries.add(subtitleSplit[0].trim());
  }

  return Array.from(queries);
}

export async function titleCandidateRoute(
  title: string,
  searchCatalog: CatalogSearchFn = search,
): Promise<TitleCandidateRoute> {
  const queries = broadenTitleQueries(title);
  if (queries.length === 0) return { kind: 'search', route: '/search' };

  for (const query of queries) {
    const results = await searchCatalog(query);
    const match = results[0];
    if (match) {
      return { kind: 'media', route: `/media/${match.id}`, mediaId: match.id };
    }
  }

  return { kind: 'search', route: `/search?q=${encodeURIComponent(queries[0])}` };
}

export async function openTitleCandidate(title: string): Promise<TitleCandidateRoute> {
  const result = await titleCandidateRoute(title);
  go(result.route);
  return result;
}
