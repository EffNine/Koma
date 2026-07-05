export type EmptyStateId =
  | 'sources'
  | 'library'
  | 'search'
  | 'history'
  | 'chapters'
  | 'updates'
  | 'browse'
  | 'reader-failed'
  | 'reader-loading'
  | 'tracker'
  | 'backup'
  | 'generic';

export interface EmptyStateAction {
  label: string;
  href?: string;
  variant?: 'primary' | 'secondary';
}

export interface EmptyStateContent {
  title: string;
  body: string;
  action?: EmptyStateAction;
  secondary?: EmptyStateAction;
}

export function emptyState(id: EmptyStateId, context?: string): EmptyStateContent {
  switch (id) {
    case 'sources':
      return {
        title: 'No sources yet',
        body: 'Add a manga source so Koma can find chapters for you.',
        action: { label: 'Add Source', href: '/settings', variant: 'primary' },
      };
    case 'library':
      return {
        title: 'Library is empty',
        body: 'Follow titles from their details page to keep them here.',
        action: { label: 'Browse Titles', href: '/categories', variant: 'primary' },
        secondary: { label: 'Search', href: '/search', variant: 'secondary' },
      };
    case 'search':
      return {
        title: context ? `No results for “${context}”` : 'No results',
        body: 'Try a different title, or browse the home page for ideas.',
        action: { label: 'Browse Home', href: '/', variant: 'primary' },
      };
    case 'history':
      return {
        title: 'No activity yet',
        body: 'Read a chapter and your history will appear here.',
        action: { label: 'Browse Titles', href: '/categories', variant: 'primary' },
      };
    case 'chapters':
      return {
        title: 'No chapters found',
        body: 'This title has no available chapters from your enabled sources. Add or enable a source to continue.',
        action: { label: 'Manage Sources', href: '/settings', variant: 'primary' },
      };
    case 'updates':
      return {
        title: 'No new updates',
        body: 'Followed titles will show new chapters here when sources are checked.',
        action: { label: 'Open Library', href: '/library', variant: 'primary' },
      };
    case 'browse':
      return {
        title: 'No results match your filters',
        body: 'Try relaxing the filters to find more titles.',
      };
    case 'reader-failed':
      return {
        title: 'Unable to load chapter',
        body: context || 'The chapter could not be loaded. You can retry or try another source.',
      };
    case 'reader-loading':
      return {
        title: 'Loading chapter…',
        body: context || 'Please wait while the chapter is prepared.',
      };
    case 'tracker':
      return {
        title: 'No trackers connected',
        body: 'Connect a tracker in Settings to sync your reading progress.',
        action: { label: 'Manage Trackers', href: '/settings', variant: 'primary' },
      };
    case 'backup':
      return {
        title: 'No backup data',
        body: 'Export your data to create a backup file you can import later.',
      };
    case 'generic':
    default:
      return {
        title: context || 'Nothing here',
        body: '',
      };
  }
}
