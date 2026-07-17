export type ConfirmActionId =
  | 'unfollow'
  | 'removeSource'
  | 'clearCache'
  | 'clearChapterCache'
  | 'clearTitleChapterCache'
  | 'clearHistory'
  | 'disconnectTracker'
  | 'clearCfCookies'
  | 'importBackup';

export interface ConfirmPrompt {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  destructive: boolean;
}

export function needsConfirmation(action: ConfirmActionId): boolean {
  return true;
}

export function confirmPrompt(action: ConfirmActionId, subject?: string): ConfirmPrompt {
  switch (action) {
    case 'unfollow':
      return {
        title: `Unfollow ${subject ?? 'this title'}?`,
        body: 'It will be removed from your library and local tracking.',
        confirm: 'Unfollow',
        cancel: 'Keep',
        destructive: true,
      };
    case 'removeSource':
      return {
        title: `Remove ${subject ?? 'source'}?`,
        body: 'This source will be removed from the app. You can re-add it later.',
        confirm: 'Remove',
        cancel: 'Cancel',
        destructive: true,
      };
    case 'clearCache':
      return {
        title: 'Clear catalog cache?',
        body: 'Cached catalog entries will be removed and re-fetched as needed.',
        confirm: 'Clear',
        cancel: 'Cancel',
        destructive: true,
      };
    case 'clearChapterCache':
      return {
        title: 'Clear chapter cache?',
        body: 'Downloaded chapter images will be removed. They will re-download when opened.',
        confirm: 'Clear',
        cancel: 'Cancel',
        destructive: true,
      };
    case 'clearTitleChapterCache':
      return {
        title: `Clear cached chapters for ${subject ?? 'this title'}?`,
        body: 'Downloaded images for this title will be removed. They will re-download when opened.',
        confirm: 'Clear',
        cancel: 'Cancel',
        destructive: true,
      };
    case 'clearHistory':
      return {
        title: 'Clear reading history?',
        body: 'This cannot be undone. Your followed titles will not be affected.',
        confirm: 'Clear',
        cancel: 'Cancel',
        destructive: true,
      };
    case 'disconnectTracker':
      return {
        title: `Disconnect ${subject ?? 'tracker'}?`,
        body: 'Sync will stop until you connect it again.',
        confirm: 'Disconnect',
        cancel: 'Cancel',
        destructive: true,
      };
    case 'clearCfCookies':
      return {
        title: `Clear cookies for ${subject ?? 'this host'}?`,
        body: 'You may need to unlock this source again.',
        confirm: 'Clear',
        cancel: 'Cancel',
        destructive: true,
      };
    case 'importBackup':
      return {
        title: 'Import backup data?',
        body: 'Existing data may be overwritten if the backup is newer.',
        confirm: 'Import',
        cancel: 'Cancel',
        destructive: true,
      };
  }
}
