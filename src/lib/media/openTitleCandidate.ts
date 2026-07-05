import { search } from '../catalog/anilist';
import { go } from '../router';

export interface CatalogTitleMatch {
  id: number;
}

export type CatalogSearchFn = (query: string) => Promise<CatalogTitleMatch[]>;

export type TitleCandidateRoute =
  | { kind: 'media'; route: string; mediaId: number }
  | { kind: 'search'; route: string };

export async function titleCandidateRoute(
  title: string,
  searchCatalog: CatalogSearchFn = search,
): Promise<TitleCandidateRoute> {
  const query = title.trim();
  if (!query) return { kind: 'search', route: '/search' };

  const results = await searchCatalog(query);
  const match = results[0];
  if (match) {
    return { kind: 'media', route: `/media/${match.id}`, mediaId: match.id };
  }

  return { kind: 'search', route: `/search?q=${encodeURIComponent(query)}` };
}

export async function openTitleCandidate(title: string): Promise<TitleCandidateRoute> {
  const result = await titleCandidateRoute(title);
  go(result.route);
  return result;
}
