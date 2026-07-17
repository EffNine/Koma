import { browseFiltered } from '../catalog/anilist';
import type { Title } from '../catalog/types';
import { db } from '../db';
import { listFollowedTitles } from '../tracker/local';

export interface GenreSuggestion {
  genre: string;
  seedTitle: string;
  titles: Title[];
}

/** Pick a genre from followed titles and browse similar titles on AniList. */
export async function buildGenreSuggestions(limit = 1, perGenre = 8): Promise<GenreSuggestion[]> {
  const followed = await listFollowedTitles();
  if (followed.length === 0) return [];

  const genreCounts = new Map<string, number>();
  let seedTitle = followed[0].name;

  for (const f of followed.slice(0, 10)) {
    const cached = await db.catalog.get(`1:media:${f.mediaId}`);
    const title = cached?.data as Title | undefined;
    if (!title?.genres?.length) continue;
    for (const g of title.genres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
    if (title.genres?.length) seedTitle = f.name;
  }

  if (genreCounts.size === 0) return [];

  const sorted = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);
  const suggestions: GenreSuggestion[] = [];

  for (const [genre] of sorted.slice(0, limit)) {
    try {
      const titles = await browseFiltered({ genres: [genre], sort: 'TRENDING_DESC', perPage: perGenre });
      const followedIds = new Set(followed.map((f) => f.mediaId));
      const filtered = titles.filter((t) => !followedIds.has(t.id));
      if (filtered.length > 0) {
        suggestions.push({ genre, seedTitle, titles: filtered.slice(0, perGenre) });
      }
    } catch {
      // non-critical
    }
  }

  return suggestions;
}
