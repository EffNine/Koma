import type { ScrapedChapter } from '../scraper/engine';

export interface ChapterGroup {
  /** Normalized chapter number; null means the chapter has no parsable number. */
  number: string | null;
  /** Display title taken from the preferred chapter. */
  title: string;
  /** Selected chapter for this group row. */
  preferred: ScrapedChapter;
  /** Other uploads for the same chapter number, ordered by source appearance. */
  alternatives: ScrapedChapter[];
}

export function chapterNumberKey(number: string | null | undefined): string {
  if (!number) return '';
  const value = Number.parseFloat(number);
  if (!Number.isFinite(value)) return number.trim();
  return String(value);
}

export function groupChapters(
  chapters: ScrapedChapter[],
  preferredGroup?: string | null,
): ChapterGroup[] {
  const byNumber = new Map<string, ScrapedChapter[]>();
  const unknowns: ScrapedChapter[] = [];

  for (const chapter of chapters) {
    const key = chapterNumberKey(chapter.number);
    if (!key) {
      unknowns.push(chapter);
    } else {
      const list = byNumber.get(key);
      if (list) list.push(chapter);
      else byNumber.set(key, [chapter]);
    }
  }

  const sortedKeys = [...byNumber.keys()].sort((a, b) => {
    const av = Number.parseFloat(a);
    const bv = Number.parseFloat(b);
    if (Number.isFinite(av) && Number.isFinite(bv)) return bv - av;
    return b.localeCompare(a);
  });

  const out: ChapterGroup[] = [];
  for (const key of sortedKeys) {
    const list = byNumber.get(key)!;
    const preferred = pickPreferredChapter(list, preferredGroup);
    const alternatives = list.filter((c) => c.url !== preferred.url);
    out.push({
      number: preferred.number ?? key,
      title: preferred.title ?? `Chapter ${preferred.number ?? key}`,
      preferred,
      alternatives,
    });
  }

  for (const chapter of unknowns) {
    out.push({
      number: null,
      title: chapter.title ?? 'Unknown chapter',
      preferred: chapter,
      alternatives: [],
    });
  }

  return out;
}

function pickPreferredChapter(
  chapters: ScrapedChapter[],
  preferredGroup?: string | null,
): ScrapedChapter {
  if (preferredGroup) {
    const match = chapters.find((c) => c.group === preferredGroup);
    if (match) return match;
  }
  return chapters[0];
}
