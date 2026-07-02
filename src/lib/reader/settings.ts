import { db } from '../db';
import type { ReaderDirection } from './state';

export type ImageFit = 'width' | 'screen' | 'original';

export interface ReaderSettings {
  key: 'defaults';
  defaultDirection: ReaderDirection;
  imageFit: ImageFit;
}

const SETTINGS_KEY = 'defaults';

export async function loadReaderSettings(): Promise<ReaderSettings> {
  const s = await db.readerSettings.get(SETTINGS_KEY);
  return s ?? { key: SETTINGS_KEY, defaultDirection: 'rtl', imageFit: 'width' };
}

export async function saveReaderSettings(settings: ReaderSettings): Promise<void> {
  await db.readerSettings.put({
    key: settings.key,
    defaultDirection: settings.defaultDirection,
    imageFit: settings.imageFit,
  });
}
