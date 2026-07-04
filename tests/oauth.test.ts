import { buildOAuthAuthorizeUrl } from '../src/lib/tracker/oauth.ts';
import { ANILIST_REDIRECT_URI } from '../src/lib/tracker/adapters/anilist.ts';
import { fetchRawInvokeArgs } from '../src/lib/net.ts';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

const authUrl = new URL(buildOAuthAuthorizeUrl({
  authorizeUrl: 'https://anilist.co/api/v2/oauth/authorize',
  clientId: '1234',
  redirectUri: ANILIST_REDIRECT_URI,
  responseType: 'code',
  extraParams: { state: 'state-123' },
}));

assert(authUrl.origin + authUrl.pathname === 'https://anilist.co/api/v2/oauth/authorize', 'AniList authorize URL uses the expected endpoint');
assert(authUrl.searchParams.get('client_id') === '1234', 'authorize URL includes client id');
assert(authUrl.searchParams.get('redirect_uri') === 'http://localhost:34725', 'authorize URL uses the fixed AniList redirect URI');
assert(authUrl.searchParams.get('response_type') === 'code', 'authorize URL requests authorization code grant');
assert(authUrl.searchParams.get('state') === 'state-123', 'authorize URL includes OAuth state');

const implicitUrl = new URL(buildOAuthAuthorizeUrl({
  authorizeUrl: 'https://example.test/oauth',
  clientId: 'client',
  redirectUri: 'http://localhost:1234',
  responseType: 'token',
}));

assert(implicitUrl.searchParams.get('response_type') === 'token', 'authorize URL can request implicit grant when needed');

const invokeArgs = fetchRawInvokeArgs('https://anilist.co/api/v2/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{"grant_type":"authorization_code"}',
});

assert('bodyB64' in invokeArgs, 'Tauri fetch args use camelCase bodyB64 for Rust body_b64');
assert(!('body_b64' in invokeArgs), 'Tauri fetch args do not use snake_case body_b64');
assert(atob(invokeArgs.bodyB64 ?? '') === '{"grant_type":"authorization_code"}', 'Tauri fetch args include the encoded POST body');

if (failures) {
  console.error(`\n${failures} oauth check(s) failed`);
  process.exit(1);
}

console.log('\nall oauth checks passed');
