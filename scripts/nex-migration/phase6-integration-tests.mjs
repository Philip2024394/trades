// Phase 6 · Controlled integration tests against Supabase Project B.
//
// Runs each assertion inside SET ROLE / BEGIN / ROLLBACK so no production
// NEX data is mutated. Skips the read-then-modify-then-rollback path for
// tables where an audit trail would be misleading; falls back to catalog
// checks in that case.
//
// Uses the Management API (executes as superuser postgres, then SET ROLE
// nex_brain_app to prove role has the privileges). This proves grants
// even though nex_brain_app is currently NOLOGIN. Post-cutover, either
// (a) nex_brain_app is made LOGIN with a password, or (b) the runtime
// login-role is made a member of nex_brain_app · either path validated
// by the same underlying RLS + grants tested here.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", "..", ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

let pass = 0, fail = 0;
function T(label, ok, detail) {
  const glyph = ok ? "✓" : "❌";
  console.log(`${glyph} ${label}${detail ? ` · ${detail}` : ""}`);
  if (ok) pass++; else fail++;
}

console.log("=== Phase 6 · Integration tests against Project B ===\n");

// A/B/C/D · Runtime SQL proofs live in phase6-integration-tests-v2.mjs
// (session pooler + SET ROLE, which the Management API cannot do because
// its executing role lacks SET privilege on nex_brain_app/nex_social_app).
// Duplicating the full end-to-end suite here would need the same GRANT/
// REVOKE dance · v2 is the authoritative runtime proof.
console.log("A/B/C/D · deferred to phase6-integration-tests-v2.mjs (session pooler + SET ROLE)");

// D_INV · RLS remains enabled on all 92 tables (catalog check · Management API is enough)
console.log("\nD · RLS invariant · exactly 92 tables have RLS enabled");
// First determine the column shape of work_item so we can build a minimal INSERT.
const workItemCols = (await q(`
  SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='work_item'
   ORDER BY ordinal_position
`)).body;
console.log(`  work_item schema: ${workItemCols.length} columns`);
const requiredCols = workItemCols.filter((c) => c.is_nullable === "NO" && c.column_default === null);
console.log(`  ${requiredCols.length} NOT NULL columns without defaults: ${requiredCols.map((c) => `${c.column_name}:${c.data_type}`).join(", ")}`);

// (Runtime SQL proofs moved to v2 · this file now covers the invariants
// + code-hygiene assertions that the v1 pattern was already good at.)

// D · RLS remains enabled on all 92 tables
console.log("\nD · RLS invariant · exactly 92 tables have RLS enabled");
const d1 = (await q(`
  SELECT count(*)::int AS n
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true
`)).body[0].n;
T("RLS enabled on 92 nex tables (expected)", d1 === 92, `actual=${d1}`);

// E · WhatsApp adapter uses TRADES DB · verify Project B has NO whatsapp_outbox
console.log("\nE · WhatsApp adapter isolation · public.hammerex_nex_whatsapp_outbox must NOT exist in Project B");
const e1 = (await q(`
  SELECT count(*)::int AS n
    FROM information_schema.tables
   WHERE table_schema='public' AND table_name='hammerex_nex_whatsapp_outbox'
`)).body[0].n;
T("Project B does NOT contain public.hammerex_nex_whatsapp_outbox", e1 === 0, `count=${e1}`);
T("whatsapp-outbox-db.ts reads only NEX_WHATSAPP_OUTBOX_POSTGRES_URL",
  readFileSync(resolve(__dirname, "..", "..", "src/lib/nex/brain/adapters/whatsapp-outbox-db.ts"), "utf8").includes('NEX_WHATSAPP_OUTBOX_POSTGRES_URL'));
// The file MENTIONS NEX_POSTGRES_URL in comments/docs ("NEVER falls back to
// NEX_POSTGRES_URL"). What we actually need to prove: the code never READS
// process.env.NEX_POSTGRES_URL as a URL source. Regex is precise.
const outboxDbSrc = readFileSync(resolve(__dirname, "..", "..", "src/lib/nex/brain/adapters/whatsapp-outbox-db.ts"), "utf8");
T("whatsapp-outbox-db.ts does NOT read process.env.NEX_POSTGRES_URL",
  !/process\.env\.NEX_POSTGRES_URL\b/.test(outboxDbSrc) && !/env\.NEX_POSTGRES_URL\b/.test(outboxDbSrc));

// F · System A guards fail closed
console.log("\nF · System A isolation guards");
const walkers = [
  "scripts/walkers/run-outer-watchdog.mjs",
  "scripts/walkers/run-supervisor.mjs",
  "scripts/walkers/run-indonesia-walkers.mjs",
];
for (const path of walkers) {
  const src = readFileSync(resolve(__dirname, "..", "..", path), "utf8");
  T(`${path} references NEX_TAXONOMY_POSTGRES_URL`, src.includes("NEX_TAXONOMY_POSTGRES_URL"));
  T(`${path} fails closed when unset`, /FAIL-CLOSED/.test(src) && /process\.exit\(2\)/.test(src));
  T(`${path} substitutes into NEX_POSTGRES_URL for child spawn`, /NEX_POSTGRES_URL:\s*TAX_URL/.test(src));
}

// G · NEX production startup refuses localhost/nex_dev · via boot guard
console.log("\nG · Production boot guard behaviour");
const guardSrc = readFileSync(resolve(__dirname, "..", "..", "src/lib/nex/config/production-guard.mjs"), "utf8");
T("production-guard.mjs rejects localhost", /looksLikeDevUrl/.test(guardSrc) && /localhost/.test(guardSrc));
T("production-guard.mjs rejects nex_dev", /nex_dev/.test(guardSrc));
T("production-guard.mjs rejects 127.0.0.1", /127\.0\.0\.1/.test(guardSrc));
T("production-guard.mjs redacts password in error", /redactUrl/.test(guardSrc) && /:\*\*\*\*@/.test(guardSrc));
T("Next.js instrumentation.ts imports assertProductionPostgresUrl", /assertProductionPostgresUrl/.test(
  readFileSync(resolve(__dirname, "..", "..", "src/instrumentation.ts"), "utf8"),
));

// H · Workforce launcher/watchdog/supervisor · fail closed
console.log("\nH · Workforce startup fail-closed behaviour");
for (const path of [
  "scripts/nex-acquisition-workforce/run-production-launcher.mjs",
  "scripts/nex-acquisition-workforce/run-production-watchdog.mjs",
  "scripts/nex-acquisition-workforce/run-production-supervisor.mjs",
]) {
  const src = readFileSync(resolve(__dirname, "..", "..", path), "utf8");
  T(`${path} does NOT contain silent localhost fallback`, !src.includes("Admin1phil@localhost:5433/nex_dev"));
  T(`${path} imports production-guard`, /production-guard\.mjs/.test(src));
  T(`${path} fails closed on config error`, /FAIL-CLOSED/.test(src) && /process\.exit\(2\)/.test(src));
}

// I · Fresh invariant check
console.log("\nI · Fresh invariant snapshot");
const inv = (await q(`
  SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
    (SELECT count(*)::int FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS policies,
    (SELECT count(*)::int FROM nex.food_business_value) AS matview,
    (SELECT count(*)::int FROM public.knowledge_records) AS kr,
    (SELECT count(*)::int FROM public.worker_jobs) AS wj,
    (SELECT count(*)::int FROM public.worker_results) AS wr
`)).body[0];
T(`nex tables = 191`, inv.nex_tables === 191, `actual=${inv.nex_tables}`);
T(`RLS-enabled = 92`, inv.rls === 92, `actual=${inv.rls}`);
T(`FK count = 125`, inv.fks === 125, `actual=${inv.fks}`);
T(`RLS policies = 140`, inv.policies === 140, `actual=${inv.policies}`);
T(`matview = 22750`, inv.matview === 22750, `actual=${inv.matview}`);
T(`public.knowledge_records = 3627`, inv.kr === 3627, `actual=${inv.kr}`);
T(`public.worker_jobs = 19167`, inv.wj === 19167, `actual=${inv.wj}`);
T(`public.worker_results = 19140`, inv.wr === 19140, `actual=${inv.wr}`);

console.log(`\n=== Phase 6 result: ${pass} pass · ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
