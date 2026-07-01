import { db } from '../db';
import type { ReaderDirection } from './state';

export interface ReaderSettings {
  key: 'defaults';
  defaultDirection: ReaderDirection;
}

const SETTINGS_KEY = 'defaults';

export async function loadReaderSettings(): Promise<ReaderSettings> {
  const s = await db.readerSettings.get(SETTINGS_KEY);
  return s ?? { key: SETTINGS_KEY, defaultDirection: 'rtl' };
}

export async function saveReaderSettings(settings: ReaderSettings): Promise<void> {
  await db.readerSettings.put(settings);
}
