// scripts/nex-forensics-diagnosis-live-proof.mjs
// Prove the new diagnose() precedence works against live DB rows.
// Replicates the SQL query + diagnose logic without the TS import path.
import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

// Ported from src/lib/nex-hq/city-category-observability.ts (post-fix version)
function diagnose(row) {
  if (row.status === "running" || (row.status === null && row.finishedAt === null)) {
    return { diagnosis: "🔵 running", text: "Cycle in flight now" };
  }
  if (row.status === "aborted") {
    const suffix = row.reconcilerReason ? ` · ${row.reconcilerReason}` : "";
    return { diagnosis: "🟠 aborted (zombie reconciled)", text: `Zombie reconciled${suffix}` };
  }
  const processed = row.processed ?? 0;
  const persisted = row.persisted ?? 0;
  const providerReturned = row.providerReturned ?? processed;
  const providerSucceeded = row.providerStatus === "SUCCESS" || processed > 0;
  if (providerSucceeded && persisted > 0) {
    return { diagnosis: "🟢 productive", text: `Persisted ${persisted} new rows this cycle` };
  }
  if (providerSucceeded && providerReturned > 0) {
    return { diagnosis: "🟡 all deduped", text: `Examined ${processed} · all already in DB (deduped)` };
  }
  if (row.providerError) {
    return { diagnosis: "🔴 provider-error", text: `Provider error · ${row.providerError.slice(0, 80)}` };
  }
  if (row.status === "failed") {
    return { diagnosis: "🔴 failed", text: `Cycle failed · errors=${row.errors ?? 0}` };
  }
  return { diagnosis: "⚪ provider-empty", text: "Provider returned zero rows this cycle" };
}

const combos = [
  { wc: "market:solo:nominatim",              label: "Solo · market",                  expected: "🟡 all deduped" },
  { wc: "market:yogyakarta:nominatim",        label: "Yogyakarta · market",            expected: "🟠 aborted (zombie reconciled)" },
  { wc: "food:Denpasar:denpasar",             label: "Denpasar · food",                expected: "🟢 productive" },
  { wc: "food:Bandung:bandung",               label: "Bandung · food",                 expected: "🟡 all deduped" },
  { wc: "food:Jakarta:jakarta",               label: "Jakarta · food",                 expected: "(pending re-pick)" },
  { wc: "accommodation:Surabaya:surabaya",    label: "Surabaya · accommodation",       expected: "(pending re-pick)" },
  { wc: "accommodation:Bandung:bandung",      label: "Bandung · accommodation",        expected: "(pending re-pick)" },
  { wc: "market:central-java-solo:nominatim", label: "Solo · market (legacy zoneId)",  expected: "🟡 all deduped" },
  { wc: "market:yogyakarta-city:nominatim",   label: "Yogyakarta · market (legacy)",   expected: "🟡 all deduped" },
];

console.log(`\n${"═".repeat(78)}\n  LIVE DIAGNOSIS PROOF · post-fix @ ${new Date().toISOString()}\n${"═".repeat(78)}`);
console.log(`\nCITY / CATEGORY / (zoneId)                     STATUS  PROC PERS ERR  DIAGNOSIS`);
console.log("-".repeat(120));

for (const c of combos) {
  const r = await pool.query(
    `SELECT status, records_processed AS proc, records_new AS new, errors_count AS err,
            finished_at,
            NULLIF(summary->'discovery_stats'->>'records_persisted','')::int AS persisted,
            (summary->'provider_results'->0->>'provider')   AS provider_name,
            (summary->'provider_results'->0->>'status')     AS provider_status,
            NULLIF(summary->'provider_results'->0->>'returned','')::int AS provider_returned,
            (summary->>'unexpected_error')                  AS provider_error,
            (summary->>'reconciler_reason')                 AS reconciler_reason,
            started_at
       FROM nex.worker_cycle_run
      WHERE worker_config=$1
      ORDER BY started_at DESC LIMIT 1`,
    [c.wc],
  );
  if (r.rowCount === 0) {
    console.log(`${c.label.padEnd(46)}  NO CYCLE  -    -    -    (never run)  · expected ${c.expected}`);
    continue;
  }
  const row = r.rows[0];
  const diag = diagnose({
    status: row.status,
    processed: row.proc,
    persisted: row.persisted ?? row.new,
    errors: row.err,
    providerError: row.provider_error,
    providerStatus: row.provider_status,
    providerReturned: row.provider_returned,
    reconcilerReason: row.reconciler_reason,
    finishedAt: row.finished_at,
  });
  const match = diag.diagnosis === c.expected ? "✅ MATCH" : c.expected.startsWith("(pending") ? "· pending" : `❌ MISMATCH · expected ${c.expected}`;
  console.log(`${c.label.padEnd(46)}  ${(row.status ?? "?").padEnd(8)} ${String(row.proc ?? "-").padStart(4)} ${String(row.persisted ?? row.new ?? "-").padStart(4)} ${String(row.err ?? "-").padStart(3)}  ${diag.diagnosis.padEnd(28)}  ${match}`);
  console.log(`  provider_results[0].status=${row.provider_status ?? "(none)"} returned=${row.provider_returned ?? "(none)"} reconciler=${row.reconciler_reason ?? "(none)"}`);
  console.log(`  text: ${diag.text}`);
}

await pool.end();
