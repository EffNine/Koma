import 'fake-indexeddb/auto';
import { db } from '../src/lib/db.ts';
import {
  clearPreferredGroup,
  getTitlePreference,
  savePreferredGroup,
  saveTitleReaderSettings,
} from '../src/lib/media/titlePreferences.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

async function run() {
  await db.delete();
  await db.open();

  const pref = await savePreferredGroup(42, 'Asura');
  assert(pref.mediaId === 42, 'savePreferredGroup returns mediaId');
  assert(pref.preferredGroup === 'Asura', 'savePreferredGroup sets group');
  assert(pref.updatedAt > 0, 'savePreferredGroup sets updatedAt');

  const loaded = await getTitlePreference(42);
  assert(loaded?.preferredGroup === 'Asura', 'getTitlePreference loads saved group');

  await saveTitleReaderSettings(42, { readerDirection: 'vertical', imageFit: 'screen' });
  const withSettings = await getTitlePreference(42);
  assert(withSettings?.preferredGroup === 'Asura', 'reader settings do not clear preferred group');
  assert(withSettings?.readerDirection === 'vertical', 'reader direction saved');
  assert(withSettings?.imageFit === 'screen', 'image fit saved');

  await savePreferredGroup(42, 'Flame');
  const overwritten = await getTitlePreference(42);
  assert(overwritten?.preferredGroup === 'Flame', 'preferred group can be overwritten');
  assert(overwritten?.readerDirection === 'vertical', 'reader settings survive group change');

  await clearPreferredGroup(42);
  const cleared = await getTitlePreference(42);
  assert(cleared?.preferredGroup === undefined, 'preferred group cleared');
  assert(cleared?.readerDirection === 'vertical', 'reader settings survive clear');

  await db.close();
}

run()
  .then(() => {
    if (failures) {
      console.error(`\n${failures} title preference check(s) failed`);
      process.exit(1);
    }
    console.log('\nall title preference checks passed');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
