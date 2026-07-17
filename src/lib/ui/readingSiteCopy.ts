import type { Source } from '../scraper/sources';

/** User-facing label for a reading site (never "source"). */
export function readingSiteName(source: Source | undefined, fallbackId = ''): string {
  return source?.name ?? (fallbackId || 'reading site');
}

export function noReadingSitesMessage(): string {
  return 'No reading sites configured yet. Add one in Settings to find chapters.';
}

export function readingSitesDownMessage(siteNames: string[]): string {
  if (siteNames.length === 0) return 'Your reading sites are unreachable right now. Try again later or add another site.';
  if (siteNames.length === 1) return `${siteNames[0]} is unreachable right now. Try again later or add another reading site.`;
  return `Your reading sites (${siteNames.join(', ')}) are unreachable right now.`;
}

export function titleNotFoundMessage(siteNames: string[]): string {
  if (siteNames.length === 0) return noReadingSitesMessage();
  if (siteNames.length === 1) return `This title was not found on ${siteNames[0]}. Try another reading site.`;
  return `This title was not found on your reading sites (${siteNames.join(', ')}).`;
}

export function chapterUnavailableMessage(siteName: string, chapterLabel: string, altSiteName?: string): string {
  if (altSiteName) {
    return `${chapterLabel} isn't available on ${siteName}. Try ${altSiteName}?`;
  }
  return `${chapterLabel} isn't available on ${siteName}. Try another reading site or retry.`;
}

export function cloudflareDesktopHint(): string {
  return 'This reading site uses Cloudflare protection. Use the Koma desktop app and unlock the site in Settings → Cloudflare Unlock.';
}

export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
