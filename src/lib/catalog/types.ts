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
  return t.title.english || t.title.romaji || t.title.native || String(t.id);
}

export function titleAliases(t: Title): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [t.title.english, t.title.romaji, t.title.native]) {
    const name = raw?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  if (out.length === 0) out.push(String(t.id));
  return out;
}

export type Country = 'JP' | 'KR' | 'CN' | null;
