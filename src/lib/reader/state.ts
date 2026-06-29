export type ReaderDirection = 'rtl' | 'ltr' | 'vertical';

export interface ReaderState {
  key: string;
  mediaId: number;
  sourceId: string;
  chapterUrl: string;
  page: number;
  direction: ReaderDirection;
  updatedAt: number;
}

export function deriveDirection(country: string | null | undefined): ReaderDirection {
  if (country === 'KR') return 'vertical';
  if (country === 'CN') return 'ltr';
  return 'rtl';
}

export function readerKey(mediaId: number, sourceId: string, chapterUrl: string): string {
  return `${mediaId}:${sourceId}:${chapterUrl}`;
}

export async function loadReaderState(
  mediaId: number,
  sourceId: string,
  chapterUrl: string,
): Promise<ReaderState | undefined> {
  const { db } = await import('../db');
  return db.readerState.get(readerKey(mediaId, sourceId, chapterUrl));
}

export async function saveReaderState(
  input: Omit<ReaderState, 'key' | 'updatedAt'>,
): Promise<ReaderState> {
  const { db } = await import('../db');
  const state: ReaderState = {
    ...input,
    key: readerKey(input.mediaId, input.sourceId, input.chapterUrl),
    updatedAt: Date.now(),
  };
  await db.readerState.put(state);
  return state;
}
