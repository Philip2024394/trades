// scripts/prod-smoke.mjs
//
// D3 · Post-deploy smoke test for the brain API.
//
// Hits the critical endpoints and asserts:
//   · /api/nex/brain/status         returns 200
//   · /api/nex/brain/llm-health     returns 200
//   · /api/nex/brain/cloud-status   returns 200
//   · /api/nex/brain/cron-tick      returns 200 with { ok: true, scanned: N }
//
// Runs against $NEX_APP_URL. Meant to be invoked from CI/CD or a
// scheduled task immediately after deploy.
//
// USAGE
//   NEX_APP_URL=https://your-domain \
//   CRON_SECRET=... \
//   node scripts/prod-smoke.mjs
//
// EXIT CODES
//   0 · every check passed
//   1 · one or more checks failed

const NEX_APP_URL = process.env.NEX_APP_URL ?? "http://localhost:3008";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
if (!CRON_SECRET) {
  console.warn("[prod-smoke] CRON_SECRET not set · calls will 401 in production");
}

const HEADERS = { Authorization: `Bearer ${CRON_SECRET}` };

const CHECKS = [
  {
    name: "status",
    method: "GET",
    path: "/api/nex/brain/status",
    assert: (json) => (json && typeof json === "object") ? null : "not an object",
  },
  {
    name: "llm-health",
    method: "GET",
    path: "/api/nex/brain/llm-health",
    assert: (json) => (json && typeof json === "object") ? null : "not an object",
  },
  {
    name: "cloud-status",
    method: "GET",
    path: "/api/nex/brain/cloud-status",
    assert: (json) => (json && typeof json === "object") ? null : "not an object",
  },
  {
    name: "cron-tick",
    method: "GET",
    path: "/api/nex/brain/cron-tick",
    assert: (json) => {
      if (!json || typeof json !== "object") return "not an object";
      if (json.ok !== true) return `ok !== true (got ${JSON.stringify(json.ok)})`;
      if (typeof json.scanned !== "number") return `scanned not a number (got ${typeof json.scanned})`;
      return null;
    },
  },
];

async function runOne(check) {
  const started = Date.now();
  try {
    const res = await fetch(`${NEX_APP_URL}${check.path}`, { method: check.method, headers: HEADERS });
    const ms = Date.now() - started;
    if (!res.ok) return { name: check.name, ok: false, ms, status: res.status, err: `HTTP ${res.status}` };
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { return { name: check.name, ok: false, ms, status: res.status, err: `non-JSON response: ${text.slice(0, 120)}` }; }
    const assertErr = check.assert(json);
    if (assertErr) return { name: check.name, ok: false, ms, status: res.status, err: `assertion: ${assertErr}` };
    return { name: check.name, ok: true, ms, status: res.status };
  } catch (err) {
    const ms = Date.now() - started;
    return { name: check.name, ok: false, ms, status: 0, err: String(err instanceof Error ? err.message : err) };
  }
}

async function main() {
  console.log(`prod-smoke · target=${NEX_APP_URL}`);
  const results = [];
  for (const c of CHECKS) {
    const r = await runOne(c);
    results.push(r);
    const marker = r.ok ? "OK  " : "FAIL";
    console.log(`  ${marker} · ${r.name.padEnd(14)} · ${String(r.status).padStart(3)} · ${String(r.ms).padStart(5)}ms${r.err ? " · " + r.err : ""}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`FAIL · ${failed.length}/${results.length} checks failed`);
    process.exit(1);
  }
  console.log(`PASS · ${results.length}/${results.length} checks · total ${results.reduce((a, r) => a + r.ms, 0)}ms`);
  process.exit(0);
}

main().catch((e) => {
  console.error("runner exception:", e);
  process.exit(2);
});
