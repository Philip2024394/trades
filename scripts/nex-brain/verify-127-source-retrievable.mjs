// scripts/nex-brain/verify-127-source-retrievable.mjs
//
// Migration Verification Protocol · step 2: verify source retrievable.
// HEAD-check every one of the 127 trades-hosted NEX-manifest URLs before
// any migration step touches them. Writes a per-URL result log so we know
// exactly which are ready to migrate and which land on the exception list
// regardless of which upload path Philip chooses.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const AUDIT_FILE = join(process.cwd(), "data", "audit", "trades-hosted-images-2026-08-14.json");
const audit      = JSON.parse(readFileSync(AUDIT_FILE, "utf8"));
const urls       = Object.values(audit.by_bucket).flatMap((b) => b.urls);
console.log(`Verifying ${urls.length} source URLs (HEAD)...`);

const RESULTS = [];
const CONCURRENCY = 6;
let inflight = 0, idx = 0, done = 0;

async function checkOne(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const size = Number(res.headers.get("content-length") ?? 0);
    const ct   = res.headers.get("content-type") ?? "";
    return {
      url,
      status: res.status,
      ok: res.ok,
      size_bytes: size,
      content_type: ct,
      duration_ms: Date.now() - t0,
    };
  } catch (err) {
    let cause = err;
    for (let i = 0; i < 5 && cause?.cause; i++) cause = cause.cause;
    return {
      url,
      status: 0,
      ok: false,
      error_name: err?.name ?? null,
      error_message: err?.message ?? String(err),
      cause_code: cause?.code ?? null,
      cause_message: cause?.message ?? null,
      duration_ms: Date.now() - t0,
    };
  }
}

await new Promise((resolve) => {
  function pump() {
    while (inflight < CONCURRENCY && idx < urls.length) {
      const u = urls[idx++]; inflight++;
      checkOne(u).then((r) => {
        RESULTS.push(r);
        inflight--; done++;
        if (done % 20 === 0 || done === urls.length) {
          process.stdout.write(`  ${done}/${urls.length}   `);
        }
        if (done === urls.length) resolve();
        else pump();
      });
    }
  }
  pump();
});
console.log("");

const okCount   = RESULTS.filter((r) => r.ok).length;
const failCount = RESULTS.length - okCount;
const byStatus  = {};
for (const r of RESULTS) {
  const key = r.ok ? `ok_${r.status}` : `${r.status || "err"}_${r.cause_code || r.error_name || "?"}`;
  byStatus[key] = (byStatus[key] ?? 0) + 1;
}
const totalBytes = RESULTS.filter((r) => r.ok).reduce((a, r) => a + (r.size_bytes || 0), 0);

console.log("");
console.log("─".repeat(60));
console.log(`Retrievable (2xx) : ${okCount}`);
console.log(`Not retrievable   : ${failCount}`);
console.log(`Total bytes (ok)  : ${(totalBytes/1024/1024).toFixed(1)} MB`);
console.log("");
console.log("Breakdown:");
for (const [k, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}
console.log("");

const failList = RESULTS.filter((r) => !r.ok).map((r) => ({
  url: r.url, status: r.status, error: r.error_message ?? null, cause_code: r.cause_code ?? null,
}));
if (failList.length) {
  console.log("Failed sources (exception-list candidates):");
  for (const f of failList.slice(0, 30)) console.log(`  · ${f.status || "err"}  ${f.url}`);
  if (failList.length > 30) console.log(`  · … and ${failList.length - 30} more`);
}

const OUT_DIR = join(process.cwd(), "data", "audit");
mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT   = join(OUT_DIR, `verify-127-sources-${stamp}.json`);
writeFileSync(OUT, JSON.stringify({
  ran_at: new Date().toISOString(),
  totals: { checked: RESULTS.length, ok: okCount, fail: failCount, total_bytes_ok: totalBytes },
  by_status: byStatus,
  results: RESULTS,
}, null, 2), "utf8");
console.log("");
console.log(`Full report: ${OUT}`);
