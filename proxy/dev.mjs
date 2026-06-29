// ponytail: dumb CORS-bypassing forwarder with spoofed Referer, for PWA/browser dev.
// Ceiling: open proxy, no rate limiting, no allowlist — dev only. In prod use the
// user-hosted Cloudflare Worker (Stage 7) with a site allowlist.
import http from 'node:http';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const PORT = process.env.PORT || 8788;

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost`);
  const target = u.searchParams.get('url');
  if (!target) {
    res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
    res.end('no url');
    return;
  }
  const referer = u.searchParams.get('referer') || new URL(target).origin + '/';
  const extraHeaders = (() => {
    const raw = u.searchParams.get('headers');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  })();
  try {
    const r = await fetch(target, {
      headers: {
        'User-Agent': UA,
        Referer: referer,
        Accept: '*/*',
        ...extraHeaders,
      },
      redirect: 'follow',
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const headers = {};
    r.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: r.status, headers, body_b64: buf.toString('base64'), final_url: r.url }));
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 0, headers: {}, body_b64: '', final_url: target, error: String(e) }));
  }
}).listen(PORT, () => console.log(`koma proxy on http://localhost:${PORT}`));
