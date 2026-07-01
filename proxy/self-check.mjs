// Self-check for the Koma proxy (dev or worker).
// Usage: node proxy/self-check.mjs [proxy-url]

const PROXY = process.argv[2] || 'http://localhost:8788';
const TEST_URL = 'https://httpbin.org/get';
const TEST_REFERER = 'https://example.com/';

let failures = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ok: ${label}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL: ${label}: ${e.message}`);
  }
}

async function proxyJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`non-JSON response: ${text.slice(0, 80)}`);
    }
    return { r, json };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`koma proxy self-check: ${PROXY}\n`);

await check('proxy responds with bytes', async () => {
  const { r, json } = await proxyJson(`${PROXY}?url=${encodeURIComponent(TEST_URL)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!json.body_b64) throw new Error('missing body_b64');
  if (!json.final_url) throw new Error('missing final_url');
});

await check('Referer param is accepted', async () => {
  const { json } = await proxyJson(
    `${PROXY}?url=${encodeURIComponent(TEST_URL)}&referer=${encodeURIComponent(TEST_REFERER)}`,
  );
  if (json.status === 0) throw new Error(json.error || 'proxy error');
});

await check('CORS header is present', async () => {
  const { r } = await proxyJson(`${PROXY}?url=${encodeURIComponent(TEST_URL)}`);
  if (r.headers.get('Access-Control-Allow-Origin') !== '*') throw new Error('missing CORS header');
});

await check('missing url returns 400', async () => {
  const { r } = await proxyJson(PROXY);
  if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
});

await check('invalid target returns status 0', async () => {
  const { json } = await proxyJson(`${PROXY}?url=${encodeURIComponent('https://nonexistent.invalid/')}`);
  if (json.status !== 0) throw new Error(`expected status 0, got ${json.status}`);
  if (!json.error) throw new Error('missing error message');
});

if (failures) {
  console.error(`\n${failures} proxy check(s) failed`);
  process.exit(1);
}

console.log('\nall proxy checks passed');
