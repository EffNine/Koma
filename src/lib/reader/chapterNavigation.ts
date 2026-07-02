import type { ScrapedChapter } from '../scraper/engine';

export type ChapterDirection = 'prev' | 'next';

export function selectAdjacentChapter(
  chapters: ScrapedChapter[],
  currentUrl: string,
  direction: ChapterDirection,
  preferredGroup?: string | null,
): ScrapedChapter | null {
  const currentIndex = chapters.findIndex((chapter) => chapter.url === currentUrl);
  if (currentIndex < 0) return null;

  const current = chapters[currentIndex];
  const currentValue = chapterNumberValue(current.number);
  if (currentValue === null) {
    return chapters[currentIndex + (direction === 'next' ? 1 : -1)] ?? null;
  }

  const targetValue = direction === 'next'
    ? nextChapterValue(chapters, currentValue)
    : prevChapterValue(chapters, currentValue);
  if (targetValue === null) return null;

  const candidates = chapters.filter((chapter) => chapterNumberValue(chapter.number) === targetValue);
  return pickChapterForGroup(candidates, preferredGroup, current.group);
}

export function preferredGroupForChapter(
  chapters: ScrapedChapter[],
  currentUrl: string,
  existingPreferredGroup?: string | null,
): string | null {
  if (existingPreferredGroup) return existingPreferredGroup;
  return chapters.find((chapter) => chapter.url === currentUrl)?.group ?? null;
}

function nextChapterValue(chapters: ScrapedChapter[], currentValue: number): number | null {
  let next: number | null = null;
  for (const chapter of chapters) {
    const value = chapterNumberValue(chapter.number);
    if (value === null || value <= currentValue) continue;
    if (next === null || value < next) next = value;
  }
  return next;
}

function prevChapterValue(chapters: ScrapedChapter[], currentValue: number): number | null {
  let prev: number | null = null;
  for (const chapter of chapters) {
    const value = chapterNumberValue(chapter.number);
    if (value === null || value >= currentValue) continue;
    if (prev === null || value > prev) prev = value;
  }
  return prev;
}

function pickChapterForGroup(
  candidates: ScrapedChapter[],
  preferredGroup?: string | null,
  fallbackGroup?: string,
): ScrapedChapter | null {
  if (!candidates.length) return null;
  if (preferredGroup) {
    const preferred = candidates.find((chapter) => chapter.group === preferredGroup);
    if (preferred) return preferred;
  }
  if (fallbackGroup) {
    const fallback = candidates.find((chapter) => chapter.group === fallbackGroup);
    if (fallback) return fallback;
  }
  return candidates[0];
}

/**
 * Find all chapters with the same chapter number as the current chapter.
 * Used by the reader's group switcher to show alternative uploads.
 */
export function sameNumberChapters(
  chapters: ScrapedChapter[],
  currentUrl: string,
): ScrapedChapter[] {
  const current = chapters.find((chapter) => chapter.url === currentUrl);
  if (!current) return [];
  const currentValue = chapterNumberValue(current.number);
  if (currentValue === null) return [];
  return chapters.filter(
    (chapter) =>
      chapter.url !== currentUrl &&
      chapterNumberValue(chapter.number) === currentValue,
  );
}

function chapterNumberValue(number: string | null | undefined): number | null {
  if (!number) return null;
  const value = Number.parseFloat(number);
  return Number.isFinite(value) ? value : null;
}
