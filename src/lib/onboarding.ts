import { enabledSources } from './scraper/sources';

const ONBOARDING_KEY = 'koma.onboarding.complete';
const FIRST_SOURCE_KEY = 'koma.onboarding.first-source';

export function isOnboardingComplete(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function completeOnboarding(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export function markFirstSourceAdded(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FIRST_SOURCE_KEY, '1');
}

export function hasSeenFirstSourceToast(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(FIRST_SOURCE_KEY) === '1';
}

export async function hasReadySources(): Promise<boolean> {
  const sources = await enabledSources();
  return sources.some((s) => s.status === 'ready');
}

export async function shouldShowOnboarding(): Promise<boolean> {
  if (isOnboardingComplete()) return false;
  return !(await hasReadySources());
}
