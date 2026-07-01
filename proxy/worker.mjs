// Production CORS-bypassing forwarder with spoofed Referer headers.
// Deploy as a user-hosted Cloudflare Worker and set ALLOWED_SITES to a
// comma-separated list of allowed origins.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

const JSON_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env = {}) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return json({ error: 'no url' }, 400);

    let targetUrl;
    try {
      targetUrl = new URL(target);
      if (!/^https?:$/.test(targetUrl.protocol)) return json({ error: 'unsupported protocol' }, 400);
    } catch {
      return json({ error: 'invalid url' }, 400);
    }

    const allowed = allowedSites(env);
    if (allowed.length === 0) return json({ error: 'no allowed sites configured' }, 403);
    if (!isAllowed(targetUrl.origin, allowed)) return json({ error: 'site not allowed' }, 403);

    const referer = url.searchParams.get('referer') || `${targetUrl.origin}/`;
    const extraHeaders = parseHeaders(url.searchParams.get('headers'));

    try {
      const upstream = await fetch(targetUrl.toString(), {
        headers: { 'User-Agent': UA, Referer: referer, Accept: '*/*', ...extraHeaders },
        redirect: 'follow',
      });
      const buf = await upstream.arrayBuffer();
      const headers = {};
      upstream.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      return json({
        status: upstream.status,
        headers,
        body_b64: bytesToBase64(new Uint8Array(buf)),
        final_url: upstream.url,
      });
    } catch (e) {
      return json({
        status: 0,
        headers: {},
        body_b64: '',
        final_url: targetUrl.toString(),
        error: String(e),
      });
    }
  },
};

function allowedSites(env) {
  const raw = env.ALLOWED_SITES || globalThis.ALLOWED_SITES || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isAllowed(origin, allowed) {
  const host = new URL(origin).host;
  return allowed.some((entry) => {
    const allowedOrigin = entry.startsWith('http') ? entry : `https://${entry}`;
    const allowedHost = new URL(allowedOrigin).host;
    return origin === new URL(allowedOrigin).origin || host.endsWith(`.${allowedHost}`);
  });
}

function parseHeaders(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function bytesToBase64(bytes) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
