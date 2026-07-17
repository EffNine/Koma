import { db } from '../db';
import type { TrackedTitle } from '../tracker/local';

const PINNED_KEY = 'koma.pinned';
const MAX_PINNED = 5;

export async function listPinnedMediaIds(): Promise<number[]> {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw) as number[];
    return ids.filter((id) => Number.isFinite(id)).slice(0, MAX_PINNED);
  } catch {
    return [];
  }
}

export async function isPinned(mediaId: number): Promise<boolean> {
  const ids = await listPinnedMediaIds();
  return ids.includes(mediaId);
}

export async function togglePinned(mediaId: number): Promise<boolean> {
  const ids = await listPinnedMediaIds();
  const idx = ids.indexOf(mediaId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    savePinned(ids);
    return false;
  }
  if (ids.length >= MAX_PINNED) {
    ids.shift();
  }
  ids.push(mediaId);
  savePinned(ids);
  return true;
}

function savePinned(ids: number[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

export async function loadPinnedTitles(): Promise<TrackedTitle[]> {
  const ids = await listPinnedMediaIds();
  if (ids.length === 0) return [];
  const titles: TrackedTitle[] = [];
  for (const id of ids) {
    const row = await db.trackedTitles.get(id);
    if (row) titles.push(row);
  }
  return titles;
}
