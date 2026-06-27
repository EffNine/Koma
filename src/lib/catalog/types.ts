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
}

export function titleName(t: Title): string {
  return t.title.romaji || t.title.english || t.title.native || String(t.id);
}

export type Country = 'JP' | 'KR' | 'CN' | null;