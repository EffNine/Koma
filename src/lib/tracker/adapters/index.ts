export { createAniListAdapter, configureAniList, type AniListAdapterOptions } from './anilist';
export { createMalAdapter, configureMal, type MalAdapterOptions } from './mal';
export {
  createMangaUpdatesAdapter,
  configureMangaUpdates,
  type MangaUpdatesCredentials,
} from './mangaupdates';
export {
  loadConnection,
  saveConnection,
  removeConnection,
  isConnectionEnabled,
  setConnectionEnabled,
  trackerChapterNumber,
  TrackerError,
  type TrackerAdapter,
  type TrackerConnection,
  type TrackerId,
} from './base';
