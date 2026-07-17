import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import {
  completeOnboarding,
  hasReadySources,
  isOnboardingComplete,
  markFirstSourceAdded,
  hasSeenFirstSourceToast,
  shouldShowOnboarding,
} from '../src/lib/onboarding.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function installLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    },
  });
}

async function resetDb() {
  db.close();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('koma');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
  await db.open();
}

installLocalStorage();
await resetDb();
localStorage.clear();

assert(!isOnboardingComplete(), 'onboarding starts incomplete');
assert(await shouldShowOnboarding(), 'shows onboarding with no ready reading sites');

markFirstSourceAdded();
assert(hasSeenFirstSourceToast(), 'tracks first source added flag');

await db.sources.put({
  id: 'example.test',
  name: 'Example',
  url: 'https://example.test',
  enabled: true,
  priority: 0,
  addedAt: Date.now(),
  status: 'ready',
});
assert(await hasReadySources(), 'detects ready enabled reading site');
assert(!(await shouldShowOnboarding()), 'skips onboarding when a ready reading site exists');

completeOnboarding();
assert(isOnboardingComplete(), 'can complete onboarding');
await db.sources.clear();
assert(!(await shouldShowOnboarding()), 'completed onboarding stays hidden');

await resetDb();

if (failures) {
  console.error(`\n${failures} onboarding check(s) failed`);
  process.exit(1);
}
console.log('\nall onboarding checks passed');

db.close();
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.deleteDatabase('koma');
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('deleteDatabase blocked'));
});
