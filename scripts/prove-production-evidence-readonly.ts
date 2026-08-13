// scripts/prove-production-evidence-readonly.ts
//
// Wave 3 · STEP 4 · production evidence · READ-ONLY.
// Governed by: docs/headquarters-production-readiness/STEP-4-PRODUCTION-EVIDENCE-READONLY.md
//
// SAFETY  Every query below is a SELECT. Zero writes. Zero schema changes.
//         Zero migration application. Zero flag flips. Zero preserved-KJ
//         modification. Uses only the service_role key that is already
//         resolvable from .env.local.
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-production-evidence-readonly.ts
//
// EXIT CODES  0 · probe complete (regardless of individual VERIFIED/OPEN/UNKNOWN outcomes)
//             1 · runner exception

import { createClient } from "@supabase/supabase-js";

type Result = { name: string; verdict: "VERIFIED · PRODUCTION" | "OPEN · PRODUCTION" | "NOT TESTABLE" | "UNKNOWN"; detail: string };
const results: Result[] = [];

function resolveNex() {
  const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, client: createClient(url, key, { auth: { persistSession: false } }) };
}
function resolveHammerex() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, client: createClient(url, key, { auth: { persistSession: false } }) };
}

async function main(): Promise<void> {
  console.log("=== Wave 3 · STEP 4 · production evidence · READ-ONLY ===\n");
  console.log("Note: only SELECT operations. Zero writes. Zero schema changes.\n");

  const nex = resolveNex();
  const ham = resolveHammerex();

  console.log("--- Reachable production surfaces ---");
  console.log(`  NEX Supabase       : ${nex ? nex.url.replace(/https?:\/\//, "").split(".")[0] : "UNREACHABLE (creds absent)"}`);
  console.log(`  Hammerex Supabase  : ${ham ? ham.url.replace(/https?:\/\//, "").split(".")[0] : "UNREACHABLE (creds absent)"}`);
  console.log(`  Production NEX Postgres (direct pg) : NOT AVAILABLE (no NEX_PROD_POSTGRES_URL in .env.local)`);
  console.log(`  Production HTTP deployment URL      : NOT AVAILABLE (no NEX_APP_URL / Vercel URL in .env.local)`);
  console.log("");

  // ── NEX Supabase probes (schema=nex must be exposed on PostgREST) ──
  if (!nex) {
    results.push({ name: "NEX Supabase reachability", verdict: "NOT TESTABLE", detail: "no service_role key resolvable" });
  } else {
    // Existence probes use LIMIT 1 (not head:true count-exact · which returns
    // silent-null on foreign-schema queries) and interpret rows/error as:
    //   error 42P01 or /does not exist|schema cache/  → MISSING (verified)
    //   error otherwise                                → UNKNOWN
    //   no error · at least one row shape returned    → PRESENT (verified)
    //   no error · empty rows                          → PRESENT-BUT-EMPTY
    async function existencePlusSample(schema: string, table: string) {
      const q = await nex!.client.schema(schema).from(table).select("*").limit(1);
      return q;
    }

    console.log("--- NEX Supabase · probe 1 · service_role reach via public.knowledge_records ---");
    const p1 = await nex.client.from("knowledge_records").select("record_id").limit(1);
    if (p1.error) {
      console.log(`  ERR ${p1.error.code ?? ""} ${p1.error.message}`);
      results.push({ name: "NEX Supabase service_role reachability", verdict: "UNKNOWN", detail: `error: ${p1.error.message}` });
    } else {
      console.log(`  OK · rows returned=${p1.data?.length ?? 0}`);
      results.push({ name: "NEX Supabase service_role reachability (public schema)", verdict: "VERIFIED · PRODUCTION", detail: `service_role SELECT public.knowledge_records succeeded · rows_returned=${p1.data?.length ?? 0}` });
    }

    console.log("\n--- NEX Supabase · probe 2 · H4 target · nex.analytics_rollup_queue existence ---");
    const p2 = await existencePlusSample("nex", "analytics_rollup_queue");
    const p2msg = p2.error?.message ?? "";
    if (p2.error && (p2.error.code === "42P01" || /does not exist|Could not find the table|schema cache/i.test(p2msg))) {
      console.log(`  MISSING · nex.analytics_rollup_queue absent on production NEX Supabase`);
      results.push({ name: "H4 · migration 049 (nex.analytics_rollup_queue) applied on production", verdict: "OPEN · PRODUCTION", detail: `absent · matches H4 known-open item · rollup-gate would refuse activation if NEX_ANALYTICS_ROLLUP_ASYNC=1` });
    } else if (p2.error && !p2msg) {
      console.log(`  UNKNOWN · empty-error return · Supabase quirk on foreign-schema queries · cannot conclude`);
      results.push({ name: "H4 · migration 049 (nex.analytics_rollup_queue) applied on production", verdict: "UNKNOWN", detail: "empty-error return from Supabase JS · common with foreign-schema queries when the schema is not exposed on PostgREST OR when zero rows exist · cannot distinguish · needs direct pg access to confirm" });
    } else if (p2.error) {
      console.log(`  ERR ${p2.error.code ?? ""} ${p2msg}`);
      results.push({ name: "H4 · migration 049 (nex.analytics_rollup_queue) applied on production", verdict: "UNKNOWN", detail: `error: ${p2msg}` });
    } else {
      console.log(`  PRESENT · rows_returned=${p2.data?.length ?? 0}`);
      results.push({ name: "H4 · migration 049 (nex.analytics_rollup_queue) applied on production", verdict: "VERIFIED · PRODUCTION", detail: `table exists · SELECT returned ${p2.data?.length ?? 0} row(s)` });
    }

    console.log("\n--- NEX Supabase · probe 3 · nex.worker_jobs existence ---");
    const p3 = await existencePlusSample("nex", "worker_jobs");
    const p3msg = p3.error?.message ?? "";
    if (p3.error && (p3.error.code === "42P01" || /does not exist|Could not find the table|schema cache/i.test(p3msg))) {
      console.log(`  MISSING`);
      results.push({ name: "H1 · nex.worker_jobs on production", verdict: "OPEN · PRODUCTION", detail: "table absent" });
    } else if (p3.error && !p3msg) {
      console.log(`  UNKNOWN (empty error)`);
      results.push({ name: "H1 · nex.worker_jobs on production", verdict: "UNKNOWN", detail: "empty-error return · nex schema exposure unclear · direct pg required" });
    } else if (p3.error) {
      console.log(`  ERR ${p3msg}`);
      results.push({ name: "H1 · nex.worker_jobs on production", verdict: "UNKNOWN", detail: `error: ${p3msg}` });
    } else {
      console.log(`  PRESENT · rows_returned=${p3.data?.length ?? 0}`);
      results.push({ name: "H1 · nex.worker_jobs on production", verdict: "VERIFIED · PRODUCTION", detail: `table exists · ${p3.data?.length ?? 0} row(s) in sample · index (046) verification requires direct pg` });
    }

    console.log("\n--- NEX Supabase · probe 4 · nex.alert_rules seeded (021) ---");
    const p4 = await existencePlusSample("nex", "alert_rules");
    const p4msg = p4.error?.message ?? "";
    if (p4.error && (p4.error.code === "42P01" || /does not exist|Could not find the table|schema cache/i.test(p4msg))) {
      console.log(`  MISSING`);
      results.push({ name: "021 · nex.alert_rules on production", verdict: "OPEN · PRODUCTION", detail: "table absent · alert engine A never provisioned on prod" });
    } else if (p4.error && !p4msg) {
      console.log(`  UNKNOWN (empty error)`);
      results.push({ name: "021 · nex.alert_rules on production", verdict: "UNKNOWN", detail: "empty-error return · direct pg required" });
    } else if (p4.error) {
      console.log(`  ERR ${p4msg}`);
      results.push({ name: "021 · nex.alert_rules on production", verdict: "UNKNOWN", detail: `error: ${p4msg}` });
    } else {
      console.log(`  PRESENT · rows_returned=${p4.data?.length ?? 0}`);
      results.push({ name: "021 · nex.alert_rules on production", verdict: "VERIFIED · PRODUCTION", detail: `table exists · sample rows=${p4.data?.length ?? 0}` });
    }

    console.log("\n--- NEX Supabase · probe 5 · nex.knowledge_records existence ---");
    const p5 = await existencePlusSample("nex", "knowledge_records");
    const p5msg = p5.error?.message ?? "";
    if (p5.error && (p5.error.code === "42P01" || /does not exist|Could not find the table|schema cache/i.test(p5msg))) {
      console.log(`  MISSING`);
      results.push({ name: "nex.knowledge_records on production", verdict: "OPEN · PRODUCTION", detail: "table absent" });
    } else if (p5.error && !p5msg) {
      console.log(`  UNKNOWN (empty error)`);
      results.push({ name: "nex.knowledge_records on production", verdict: "UNKNOWN", detail: "empty-error return · direct pg required" });
    } else if (p5.error) {
      console.log(`  ERR ${p5msg}`);
      results.push({ name: "nex.knowledge_records on production", verdict: "UNKNOWN", detail: `error: ${p5msg}` });
    } else {
      console.log(`  PRESENT · rows_returned=${p5.data?.length ?? 0}`);
      results.push({ name: "nex.knowledge_records on production", verdict: "VERIFIED · PRODUCTION", detail: `nex schema table exists · sample rows=${p5.data?.length ?? 0}` });
    }
  }

  // ── Hammerex Supabase probes (public schema) ──
  console.log("\n--- Hammerex Supabase · probe 1 · service_role auth via public.hammerex_trade_off_listings count ---");
  if (!ham) {
    console.log(`  UNREACHABLE (creds absent)`);
    results.push({ name: "Hammerex auth + PostgREST(public) reachability", verdict: "NOT TESTABLE", detail: "no service_role key resolvable" });
  } else {
    const h1 = await ham.client.from("hammerex_trade_off_listings").select("id", { count: "exact", head: true });
    if (h1.error) {
      console.log(`  ERR ${h1.error.code ?? ""} ${h1.error.message}`);
      results.push({ name: "Hammerex auth + PostgREST(public) reachability", verdict: "UNKNOWN", detail: `error: ${h1.error.message}` });
    } else {
      console.log(`  count = ${h1.count} rows in public.hammerex_trade_off_listings`);
      results.push({ name: "Hammerex auth + PostgREST(public) reachability", verdict: "VERIFIED · PRODUCTION", detail: `service_role SELECT succeeded · ${h1.count} rows` });
    }
  }

  // ── Rows that are NOT TESTABLE without additional production surface ──
  console.log("\n--- Rows that require additional production surface ---");
  const notTestable: Array<[string, string]> = [
    ["V-2b prod · F5 rule catalogue populated on production", "requires HTTP endpoint /api/nex/observability/alert-rules + prod URL"],
    ["V-2c prod · F5 evaluator observable on production", "requires HTTP endpoint /api/nex/brain/llm-health + prod URL · also blocked by 021/048 collision"],
    ["V-4a-prod · HMAC valid sig accepted on production route", "requires HTTP endpoint + CRON_SECRET verification in prod runtime · not exercisable from here"],
    ["V-5a-prod · scoped-token hit against production supervisor-sweep", "requires HTTP endpoint + supervisor to be enabled (which is prohibited)"],
    ["V-8a · production smoke via scripts/prod-smoke.mjs", "requires NEX_APP_URL / Vercel deployment URL"],
    ["V-9a · load test", "requires staging URL · deliberately excluded from this batch"],
    ["V-10b · restore rehearsal", "requires separately-hosted target"],
    ["H1 · migration index verification on production (046, 047, 048, 049)", "requires direct pg access to production NEX Postgres · REST does not expose pg_indexes"],
    ["H2 R-3 · production log-drain observation", "no log-drain vendor pick yet"],
    ["H3 · production P99 measurement", "requires pg_stat_statements installed on prod · not exercisable from REST"],
    ["H6 · production RLS policy coverage per pg_policies", "REST cannot query pg_policies · direct pg access required"],
  ];
  for (const [name, why] of notTestable) {
    console.log(`  · ${name} — ${why}`);
    results.push({ name, verdict: "NOT TESTABLE", detail: why });
  }

  // Summary
  console.log("\n=== Aggregate ===");
  const buckets: Record<string, number> = {};
  for (const r of results) buckets[r.verdict] = (buckets[r.verdict] ?? 0) + 1;
  for (const [k, v] of Object.entries(buckets)) console.log(`  ${k} = ${v}`);
  console.log(`\ntotal rows = ${results.length}`);

  console.log("\n=== Structured evidence ===");
  console.log(JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));
  process.exitCode = 0;
}

main().catch((e) => { console.error("runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(1); });
