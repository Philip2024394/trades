// scripts/nex-accommodation-gap-cycle-once.ts
//
// Founder BEGIN 2026-09-09 · WORKER CONSUME GAP ENGINE · one-shot proof
//
// Runs runOneGapCycle() exactly once, prints a structured outcome, exits.
// Zero external providers. Zero fabrication. Founder can inspect the JSON.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/nex-accommodation-gap-cycle-once.ts
//   npx tsx --env-file=.env.local scripts/nex-accommodation-gap-cycle-once.ts --limit=100 --attempts=10 --city=Yogyakarta

import pg from "pg";
import { runOneGapCycle } from "@/lib/nex/agent-runtime/gap-cycle";
const { Pool } = pg;

const argv = process.argv.slice(2);
function argVal(name: string, def: string | number): string {
  const idx = argv.indexOf(`--${name}`);
  const i2 = argv.findIndex((a) => a.startsWith(`--${name}=`));
  if (idx !== -1) return argv[idx + 1] ?? String(def);
  if (i2 !== -1) return argv[i2].slice(name.length + 3);
  return String(def);
}

const conn = process.env.NEX_POSTGRES_URL;
if (!conn) {
  console.error("NEX_POSTGRES_URL not set · run with --env-file=.env.local");
  process.exit(1);
}
const limit = Number(argVal("limit", 200));
const attempts = Number(argVal("attempts", 8));
const city = argVal("city", "Yogyakarta");
const country = argVal("country", "ID");

const pool = new Pool({ connectionString: conn, max: 4, connectionTimeoutMillis: 8000 });

async function main(): Promise<void> {
  console.log("━".repeat(78));
  console.log("NEX Accommodation · WORKER CONSUME GAP ENGINE · one-shot cycle proof");
  console.log(`city    : ${city}  ·  country : ${country}`);
  console.log(`limit   : ${limit} candidates`);
  console.log(`attempts: up to ${attempts} gap attempts`);
  console.log(`started : ${new Date().toISOString()}`);
  console.log("━".repeat(78));

  const t0 = Date.now();
  const result = await runOneGapCycle({
    pool,
    agentName: "accommodation",
    candidateLimit: limit,
    maxAttempts: attempts,
    city,
    country,
  });
  const durationMs = Date.now() - t0;

  // Founder-format summary
  console.log("");
  console.log(`Cycle result · duration ${durationMs}ms`);
  console.log(`  cycle_run_id            : ${result.cycle_run_id}`);
  console.log(`  candidates_loaded       : ${result.candidates_loaded}`);
  console.log(`  gaps_attempted          : ${result.gaps_attempted}`);
  console.log(`  gaps_STORED             : ${result.gaps_stored}`);
  console.log(`  gaps_UNRESOLVED         : ${result.gaps_unresolved}`);
  console.log(`  evidence_rows_written   : ${result.evidence_rows_written}`);
  console.log(`  external_calls          : ${result.external_calls}   (HARD LIMIT: 0)`);
  console.log(`  llm_calls               : ${result.llm_calls}   (HARD LIMIT: 0)`);
  console.log(`  canonical_rows_written  : ${result.canonical_rows_written}   (HARD LIMIT: 0)`);
  console.log("");
  console.log(`Attempts (up to 20 shown):`);
  for (const [i, a] of result.attempts.slice(0, 20).entries()) {
    const badge = a.outcome === "STORED" ? "🟢 STORED   " : a.outcome === "UNRESOLVED" ? "🟠 UNRESOLVED" : "⚪ SKIPPED   ";
    const facts = a.outcome === "STORED"
      ? `field=${a.extracted_field} · value="${a.extracted_value}" · conf=${a.confidence} · evidence_id=${a.evidence_id}`
      : `reason=${a.reason}`;
    console.log(`  ${(i + 1).toString().padStart(2)}. ${badge}  ${a.gap_kind.padEnd(28)} ${a.business_name.slice(0, 34).padEnd(34)}  ${facts}`);
  }
  console.log("");
  console.log(`Honest note:`);
  console.log(`  ${result.honest_note}`);
  console.log("");
  console.log("━".repeat(78));
  console.log(`Structured JSON (full result):`);
  console.log(JSON.stringify(result, null, 2));
  console.log("━".repeat(78));

  await pool.end();
}

main().catch((e) => {
  console.error(`gap-cycle FAILED:`, e?.stack ?? e);
  pool.end().finally(() => process.exit(1));
});
