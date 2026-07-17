// ponytail: PWA service-worker registration smoke test.
// Builds the project, starts a preview server, fetches the manifest
// and index HTML, and confirms the SW scaffolding is in place.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL: ' + msg); failures++; }
  else console.log('ok: ' + msg);
}

/** Find a free TCP port on localhost. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** Wait until the server responds 200 at /, polling every 300ms. */
async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* server not ready yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  // 1. Build
  console.log('Building...');
  const build = spawn('pnpm', ['build'], { cwd: ROOT, stdio: 'pipe', shell: true });
  const buildOut: string[] = [];
  build.stdout.on('data', (d: Buffer) => buildOut.push(d.toString()));
  build.stderr.on('data', (d: Buffer) => buildOut.push(d.toString()));
  const buildCode = await new Promise<number>(r => build.on('exit', r));
  if (buildCode !== 0) {
    console.error('BUILD FAILED:\n' + buildOut.join(''));
    process.exit(1);
  }
  console.log('Build OK');

  // 2. Start preview
  const port = await freePort();
  const serverUrl = `http://127.0.0.1:${port}`;
  // Spawn in a new process group so we can kill the whole tree (pnpm -> node -> vite preview).
  const preview = spawn('pnpm', ['preview', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: false,
    detached: true,
  });

  let killed = false;
  function cleanup() {
    if (killed) return;
    killed = true;
    // Kill the entire process group created by the detached spawn.
    if (preview.pid) {
      try { process.kill(-preview.pid, 'SIGTERM'); } catch { /* ok */ }
      setTimeout(() => {
        try { process.kill(-preview.pid, 'SIGKILL'); } catch { /* ok */ }
      }, 2000);
    }
  }
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(); });
  process.on('SIGTERM', () => { cleanup(); process.exit(); });

  try {
    await waitForServer(serverUrl);

    // 3. Fetch /manifest.webmanifest
    {
      const r = await fetch(`${serverUrl}/manifest.webmanifest`);
      assert(r.status === 200, '/manifest.webmanifest returns 200');
      assert(
        ['application/json', 'json', 'manifest'].some(t => r.headers.get('content-type')?.includes(t) ?? false),
        'manifest response has JSON/manifest content-type',
      );
      const body = await r.json();
      assert(typeof body.name === 'string', 'manifest has a name');
      assert(typeof body.short_name === 'string', 'manifest has a short_name');
      assert(Array.isArray(body.icons), 'manifest has icons array');
      assert(body.icons.length >= 1, 'manifest has at least one icon');
      console.log('  manifest icons:', JSON.stringify(body.icons));
    }

    // 4. Fetch / and check for <link rel="manifest">
    {
      const r = await fetch(serverUrl);
      assert(r.status === 200, 'index returns 200');
      const html = await r.text();
      assert(html.includes('<link rel="manifest"'), 'index.html contains <link rel="manifest">');
    }

    // 5. Confirm service-worker file exists in dist/
    {
      const swPath = resolve(DIST, 'sw.js');
      assert(existsSync(swPath), 'dist/sw.js exists (vite-plugin-pwa generated service worker)');
      if (existsSync(swPath)) {
        const sw = readFileSync(swPath, 'utf-8');
        assert(sw.includes('workbox'), 'service worker contains workbox precache logic');
      }
    }

    console.log('\nAll PWA smoke checks passed');
  } finally {
    cleanup();
  }

  if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
