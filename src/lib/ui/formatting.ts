import type { HistoryEntry, ProgressEntry } from '../tracker/local';

export function chapterLabel(chapterNumber?: string | null, chapterTitle?: string | null, page?: number): string {
  const parts: string[] = [];
  if (chapterNumber) parts.push(`Ch. ${chapterNumber}`);
  else if (chapterTitle) parts.push(chapterTitle);
  if (page !== undefined && page > 0) parts.push(`page ${page + 1}`);
  return parts.join(' · ');
}

export function historyLabel(row: HistoryEntry): string {
  if (row.chapterTitle) return row.chapterTitle;
  if (row.chapterNumber) return `Chapter ${row.chapterNumber}`;
  return 'Chapter';
}

export function progressLabel(row: ProgressEntry | undefined): string {
  if (!row) return 'No chapters read yet';
  const chapter = row.chapterNumber ?? '?';
  return row.status === 'COMPLETED' ? `Completed at chapter ${chapter}` : `Chapter ${chapter}`;
}

export function chapterSummary(groupCount: number, uploadCount: number): string {
  const groupLabel = `${groupCount} chapter${groupCount === 1 ? '' : 's'}`;
  if (groupCount === uploadCount) return groupLabel;
  return `${groupLabel} · ${uploadCount} upload${uploadCount === 1 ? '' : 's'}`;
}

export function groupLabel(group: string | undefined, altCount: number, pref?: string): string {
  if (!group) return `${altCount + 1} groups`;
  const suffix = pref && group !== pref ? ' (fallback)' : '';
  if (altCount === 0) return group + suffix;
  return `${group} +${altCount}${suffix}`;
}
