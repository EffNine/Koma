import type { ProgressStatus } from './local';

export interface ProgressInput {
  chapterNumber: string | undefined;
  chapterNumberValue: number;
  chapterUrl: string;
  chapterTitle: string | undefined;
  totalChapters: number | undefined;
  readAt: number;
}

export interface ProgressResult {
  chapterUrl: string;
  chapterNumber: string | undefined;
  chapterNumberValue: number;
  chapterTitle: string | undefined;
  status: ProgressStatus;
}

export interface ProgressDelta {
  chapterUrl: string;
  chapterNumber: string | undefined;
  chapterNumberValue: number;
  chapterTitle: string | undefined;
  status: ProgressStatus;
}

export function computeProgress(
  current: { chapterNumberValue: number; status: ProgressStatus } | undefined,
  input: ProgressInput,
): ProgressDelta {
  const shouldAdvance = !current || input.chapterNumberValue >= current.chapterNumberValue;
  if (!shouldAdvance && current) {
    return {
      chapterUrl: '',
      chapterNumber: current.chapterNumberValue === -1 ? undefined : String(current.chapterNumberValue),
      chapterNumberValue: current.chapterNumberValue,
      chapterTitle: '',
      status: current.status,
    };
  }
  return {
    chapterUrl: input.chapterUrl,
    chapterNumber: input.chapterNumber,
    chapterNumberValue: input.chapterNumberValue,
    chapterTitle: input.chapterTitle,
    status: progressStatus(input.chapterNumberValue, input.totalChapters),
  };
}

export function computeRollback(reads: { chapterUrl: string; chapterNumber?: string; chapterNumberValue: number; chapterTitle?: string }[], cutoff: number): ProgressResult | null {
  const remaining = reads
    .filter((row) => row.chapterNumberValue < cutoff)
    .sort((a, b) => b.chapterNumberValue - a.chapterNumberValue)[0];

  if (!remaining) return null;

  return {
    chapterUrl: remaining.chapterUrl,
    chapterNumber: remaining.chapterNumber,
    chapterNumberValue: remaining.chapterNumberValue,
    chapterTitle: remaining.chapterTitle,
    status: 'READING',
  };
}

export function chapterValue(chapterNumber: string | null | undefined): number {
  if (!chapterNumber) return -1;
  const parsed = Number.parseFloat(chapterNumber);
  return Number.isFinite(parsed) ? parsed : -1;
}

export function progressStatus(chapterNumberValue: number, totalChapters: number | undefined): ProgressStatus {
  if (totalChapters && chapterNumberValue > totalChapters) return 'COMPLETED';
  return 'READING';
}
