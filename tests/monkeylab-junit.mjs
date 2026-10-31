#!/usr/bin/env node
/**
 * MonkeyLab containment adapter for Koma's tsx test suites.
 *
 * Product runs stay on `pnpm test` (the plain chain). This runner exists for
 * the MonkeyLab Engine, which invokes it inside a network-none containment
 * cage as `npm run test:monkeylab` with
 * `--outputFile=.monkeylab-cache/monkeylab-junit.xml`.
 *
 * It re-runs the same suite list declared in `scripts.test` (one `tsx`
 * process per suite file, in package.json order) and emits a JUnit XML
 * report with one testcase per suite. Exit code 0 only when every suite
 * passed; any timeout or failure exits non-zero.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PER_SUITE_TIMEOUT_MS = 300_000;

function argValue(flag) {
  const argv = process.argv.slice(2);
  for (const a of argv) {
    if (a === `--${flag}=`) {
      return "";
    }
    if (a.startsWith(`--${flag}=`)) return a.slice(flag.length + 3);
    if (a === `--${flag}`) {
      const i = argv.indexOf(a);
      if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
    }
  }
  return null;
}

function xmlEscape(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function main() {
  const outPath = argValue("outputFile");
  if (outPath === null) {
    console.error("monkeylab-junit: --outputFile=<path> is required");
    process.exit(2);
  }
  const cwd = process.cwd();
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
  } catch (e) {
    console.error(`monkeylab-junit: cannot read package.json: ${e}`);
    process.exit(3);
  }
  const chain = String((pkg.scripts || {}).test || "");
  const suites = [];
  for (const m of chain.matchAll(/(?:^|&&\s*)tsx\s+(tests\/[A-Za-z0-9._/-]+\.ts)/g)) {
    const file = m[1];
    if (!suites.includes(file)) suites.push(file);
  }
  // Rollback-probe collection (MonkeyLab Wave M): the Engine may drop a
  // synthetic failing probe (tests/monkeylab_rollback_probe*.test.{ts,mjs})
  // into the disposable worktree to prove that the REAL runner detects
  // failures. Collect it here even though it is not listed in scripts.test;
  // it is Engine-owned, never committed, and must never silently vanish from
  // the report (that would break the quick-mode rollback proof).
  try {
    const probeDir = path.join(cwd, "tests");
    for (const fn of fs.readdirSync(probeDir)) {
      if (/^monkeylab_rollback_probe[^]*\.test\.(ts|mjs|mts)$/.test(fn)) {
        const file = `tests/${fn}`;
        if (!suites.includes(file)) suites.push(file);
      }
    }
  } catch {
    /* no tests dir (should not happen) — nothing to add */
  }
  if (suites.length === 0) {
    console.error("monkeylab-junit: no `tsx tests/*.test.ts` suites found in scripts.test");
    process.exit(4);
  }

  const bin = path.join(cwd, "node_modules", ".bin", "tsx");
  const cases = [];
  for (const suite of suites) {
    const started = Date.now();
    // Spawn the installed bin directly (shebang semantics, like `pnpm test`
    // does) — the .bin entry is a cmd-shim shell script, so executing it
    // through `node <shim>` would parse shell as JavaScript and always fail.
    const r = spawnSync(bin, [suite], {
      cwd,
      encoding: "utf8",
      timeout: PER_SUITE_TIMEOUT_MS,
      killSignal: "SIGKILL",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const durSec = Math.max(0, ((Date.now() - started) / 1000).toFixed(3));
    const timedOut =
      r.signal === "SIGKILL" || (r.error && r.error.code === "ETIMEDOUT");
    const passed = !timedOut && r.status === 0 && !(r.error && r.error.code === "ENOENT");
    const tail = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    // Bounded evidence: keep BOTH the error head (setup/transform lines) and
    // the tail (final stack). Build-tool errors often sit in the middle of
    // the produced log (e.g. a vite-plugin-pwa generateSW failure between
    // transform warnings and the closeBundle stack), so the head/tail
    // windows are generous (5k each) and jointly cover typical suite output.
    const message = tail.length > 10000
      ? `${tail.slice(0, 5000)}\n... [truncated] ...\n${tail.slice(-5000)}`
      : tail;
    cases.push({ suite, passed, timedOut, durSec, message });
    console.log(
      `monkeylab-junit: ${suite} ${passed ? "passed" : "failed"} (${durSec}s)`,
    );
  }

  const failed = cases.filter((c) => !c.passed).map((c) => c.suite);
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<testsuite name="koma.test:monkeylab" tests="${cases.length}" failures="${failed.length}" time="${cases.reduce((a, c) => a + Number(c.durSec), 0).toFixed(3)}">`,
    ...cases.map((c) => {
      const attrs =
        ` classname="koma" name="${xmlEscape(c.suite)}" time="${c.durSec}"`;
      if (c.passed) return `<testcase${attrs}/>`;
      const reason = c.timedOut
        ? `suite timeout after ${PER_SUITE_TIMEOUT_MS}ms`
        : "suite failed in containment cage";
      const body = xmlEscape(
        c.message && c.message.length ? c.message : reason,
      );
      return `<testcase${attrs}><failure message="${xmlEscape(reason)}">${body}</failure></testcase>`;
    }),
    "</testsuite>",
    "",
  ].join("\n");

  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, xml, "utf8");

  // Worktree hygiene: in the MonkeyLab containment cage the runner executes as
  // user 65534, so build outputs it produced (dist/, .vite, etc. from the pwa
  // suite's `pnpm build`) are nobody-owned 0755 dirs — the host user cannot
  // remove their contents afterwards, which breaks the Engine's disposable
  // worktree cleanup promise. Only suite-created artifacts are removed here,
  // after every suite has finished, while we still run as their owner.
  for (const generated of ["dist", ".vite", "node_modules/.vite"]) {
    try {
      fs.rmSync(path.join(cwd, generated), { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }

  console.log(
    `monkeylab-junit: suites=${cases.length} failed=${failed.length} -> exit ${failed.length ? 1 : 0}`,
  );
  process.exit(failed.length ? 1 : 0);
}

main();
