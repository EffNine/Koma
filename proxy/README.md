# Koma Proxy

CORS-bypassing HTTP forwarder with spoofed Referer headers, used by the Koma web/PWA to scrape Sources that block cross-origin requests.

## Files

| File | Purpose |
| --- | --- |
| `dev.mjs` | Dev proxy (Node.js, open, no allowlist). Started automatically by `pnpm dev`. |
| `worker.mjs` | Production proxy (Cloudflare Worker). User-hosted with a site allowlist. |
| `wrangler.toml` | Wrangler config for deploying `worker.mjs`. |
| `self-check.mjs` | Smoke test against any running proxy. |

## Deploy

```bash
npx wrangler secret put ALLOWED_SITES
# Enter comma-separated origins, for example:
# https://mangadex.org,https://asurascans.com,https://mangafire.to

npx wrangler deploy
```

Configure the web/PWA build with:

```bash
VITE_SCRAPER_PROXY=https://koma-proxy.your-name.workers.dev pnpm build
```

## Self-Check

```bash
node proxy/dev.mjs
node proxy/self-check.mjs
```

The proxy API is:

```text
GET /?url=<encoded-target-url>&referer=<encoded-referer>&headers=<json>
```

It returns `{ status, headers, body_b64, final_url, error? }`.
