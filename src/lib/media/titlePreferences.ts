import { db } from '../db';

export type ReaderDirection = 'rtl' | 'ltr' | 'vertical';
export type ImageFit = 'width' | 'screen' | 'original';

export interface TitlePreference {
  mediaId: number;
  preferredGroup?: string;
  readerDirection?: ReaderDirection;
  imageFit?: ImageFit;
  updatedAt: number;
}

export async function getTitlePreference(mediaId: number): Promise<TitlePreference | undefined> {
  return db.titlePreferences.get(mediaId);
}

export async function savePreferredGroup(
  mediaId: number,
  group: string | undefined,
): Promise<TitlePreference> {
  const existing = await db.titlePreferences.get(mediaId);
  const next: TitlePreference = {
    ...existing,
    mediaId,
    preferredGroup: group,
    updatedAt: Date.now(),
  };
  await db.titlePreferences.put(next);
  return next;
}

export async function clearPreferredGroup(mediaId: number): Promise<void> {
  const existing = await db.titlePreferences.get(mediaId);
  if (!existing) return;
  await db.titlePreferences.put({
    ...existing,
    mediaId,
    preferredGroup: undefined,
    updatedAt: Date.now(),
  });
}

export async function saveTitleReaderSettings(
  mediaId: number,
  settings: { readerDirection?: ReaderDirection; imageFit?: ImageFit },
): Promise<TitlePreference> {
  const existing = await db.titlePreferences.get(mediaId);
  const next: TitlePreference = {
    ...existing,
    mediaId,
    readerDirection: settings.readerDirection,
    imageFit: settings.imageFit,
    updatedAt: Date.now(),
  };
  await db.titlePreferences.put(next);
  return next;
}
