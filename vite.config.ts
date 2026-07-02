import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const DEV_PROXY_PATH = '/__koma_scrape';

async function handleScrapeProxy(req: unknown, res: unknown) {
  const request = req as { url?: string };
  const response = res as { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void };
  const u = new URL(request.url ?? DEV_PROXY_PATH, 'http://localhost');
  const target = u.searchParams.get('url');
  if (!target) {
    response.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify({ error: 'no url' }));
    return;
  }

  const referer = u.searchParams.get('referer') || new URL(target).origin + '/';
  try {
    const r = await fetch(target, {
      headers: { 'User-Agent': UA, Referer: referer, Accept: '*/*' },
      redirect: 'follow',
    });
    const NodeBuffer = (globalThis as unknown as {
      Buffer: { from: (input: ArrayBuffer) => { toString: (enc: string) => string } };
    }).Buffer;
    const buf = NodeBuffer.from(await r.arrayBuffer());
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify({ status: r.status, headers, body_b64: buf.toString('base64'), final_url: r.url }));
  } catch (e) {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify({ status: 0, headers: {}, body_b64: '', final_url: target, error: String(e) }));
  }
}

function devScrapeProxy(): Plugin {
  return {
    name: 'koma-dev-scrape-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(DEV_PROXY_PATH, (req, res) => {
        void handleScrapeProxy(req, res);
      });
    },
  };
}

// ponytail: single app, no SSR. Tauri uses ../dist as frontendDist.
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
      manifest: false,
    }),
    devScrapeProxy(),
  ],
  clearScreen: false,
  server: { port: 5174, strictPort: true },
  build: { target: 'esnext' },
});
