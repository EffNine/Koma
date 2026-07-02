import type { Title } from '../catalog/types';
import { titleName } from '../catalog/types';
import { db } from '../db';
import { followTitle as followLocal, unfollowTitle as unfollowLocal, type TrackedTitle } from '../tracker/local';

export interface TitleDetail {
  title: Title;
  followed: boolean;
  followedAt?: number;
}

export async function loadTitleDetail(mediaId: number): Promise<TitleDetail | undefined> {
  const title = await import('../catalog/anilist').then((m) => m.media(mediaId));
  if (!title) return undefined;
  const tracked = await db.trackedTitles.get(mediaId);
  return { title, followed: tracked?.followed ?? false, followedAt: tracked?.followedAt };
}

export async function followTitle(title: Title): Promise<void> {
  await followLocal(title);
}

export async function unfollowTitle(mediaId: number): Promise<void> {
  await unfollowLocal(mediaId);
}

export function snapshotTitle(
  title: Title,
  state: Pick<TrackedTitle, 'followed' | 'followedAt' | 'updatedAt'>,
): TrackedTitle {
  return {
    mediaId: title.id,
    name: titleName(title),
    cover: title.cover,
    country: title.country,
    status: title.status,
    totalChapters: title.chapters,
    followed: state.followed,
    followedAt: state.followedAt,
    updatedAt: state.updatedAt,
  };
}
