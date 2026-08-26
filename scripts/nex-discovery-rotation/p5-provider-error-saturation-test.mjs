// P5 · PROVIDER_ERROR does NOT count toward saturation · evidence test.
//
// Philip 2026-08-26: "A provider outage should not consume a saturation attempt
// in the same way as a successful zero-result discovery."
//
// This test proves:
//   1. isSaturationCountable() correctly classifies each cycle_outcome
//   2. rotation-tick's evaluate() actually uses this filter (DB-integrated test)
//
// DB test: uses a real surface with clean recent history · inserts synthetic
// cycles with mixed outcomes · runs rotation-tick · verifies counter.
// Cleans up its own synthetic cycles at the end.

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { isSaturationCountable } from "../nex-worker/persistence-contract.mjs";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
});

const line = (s = "") => console.log(s);
const hr   = () => console.log("─".repeat(70));

function runNode(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; child.stdout.on("data", (d) => { out += d.toString(); });
    child.on("close", () => resolve(out));
  });
}

// ── PART 1 · Unit test of isSaturationCountable helper ──────────────────
line("═══════════════════════════════════════════════════════════════════════");
line("  P5 · PROVIDER_ERROR SATURATION FIX · EVIDENCE TEST");
line("═══════════════════════════════════════════════════════════════════════");
line("");
line("── PART 1 · isSaturationCountable() pure-function classification ──");
hr();
const classifications = [
  ["PRODUCTIVE",         true,  "reset saturation"],
  ["PARTIAL",            true,  "reset saturation"],
  ["ALL_DEDUPED",        true,  "genuine zero · counts toward saturation"],
  ["PROVIDER_EMPTY",     true,  "genuine zero · counts toward saturation"],
  ["NO_NEW_CANDIDATES",  true,  "genuine zero · counts toward saturation"],
  ["PROVIDER_ERROR",     false, "infrastructural noise · does NOT count"],
  ["FATAL",              false, "infrastructural noise · does NOT count"],
  [null,                 true,  "legacy pre-Phase-1 cycle · defaults to counted"],
];
let unitPass = true;
for (const [outcome, expected, why] of classifications) {
  const actual = isSaturationCountable(outcome);
  const ok = actual === expected;
  if (!ok) unitPass = false;
  line(`  ${String(outcome).padEnd(20)} → ${actual ? "COUNT ✓" : "SKIP  ✗"}   expected=${expected}  ${ok ? "✓" : "✗ FAIL"}   (${why})`);
}
line("");
line(`  Unit test: ${unitPass ? "PASS ✓" : "FAIL ✗"}`);
line("");

// ── PART 2 · DB-integrated test · pollute + clean up ──────────────────
line("── PART 2 · DB-integrated · fabricated cycles with mixed outcomes ──");
hr();
const TARGET = { city: "Bandung", category: "food", surface: "bandung" };
const WORKER_CONFIG = `${TARGET.category}:${TARGET.city}:${TARGET.surface}`;
line(`  target surface: ${WORKER_CONFIG}`);

const before = await pool.query(
  `SELECT consecutive_zero_new_cycles, state FROM nex.discovery_rotation_state
    WHERE city=$1 AND category=$2 AND surface=$3 AND round=1`,
  [TARGET.city, TARGET.category, TARGET.surface]
);
line(`  BEFORE:  state=${before.rows[0]?.state}  consecutive_zero=${before.rows[0]?.consecutive_zero_new_cycles}`);

// Insert 5 fabricated cycles with mixed outcomes · all records_new=0
// Ordered chronologically (oldest first · rotation-tick reads DESC so newest is first)
const now = Date.now();
const fabricatedCycles = [
  { outcome: "ALL_DEDUPED",    minutesAgo: 5 },  // newest (will be at index 0 in DESC)
  { outcome: "PROVIDER_ERROR", minutesAgo: 6 },
  { outcome: "ALL_DEDUPED",    minutesAgo: 7 },
  { outcome: "PROVIDER_ERROR", minutesAgo: 8 },
  { outcome: "ALL_DEDUPED",    minutesAgo: 9 },
];
const testCycleIds = [];
for (const c of fabricatedCycles) {
  const id = randomUUID();
  testCycleIds.push(id);
  const startedAt = new Date(now - c.minutesAgo * 60 * 1000).toISOString();
  const finishedAt = new Date(now - c.minutesAgo * 60 * 1000 + 30_000).toISOString();
  await pool.query(
    `INSERT INTO nex.worker_cycle_run
       (id, worker_id, worker_type, worker_config, started_at, finished_at,
        status, records_processed, records_new, summary)
     VALUES ($1, 'p5-test:food:Bandung', 'acquisition', $2, $3, $4,
             'completed', 0, 0, $5::jsonb)`,
    [id, WORKER_CONFIG, startedAt, finishedAt,
     JSON.stringify({ cycle_outcome: c.outcome, note: "P5 fabricated test cycle" })]
  );
}
line(`  Inserted 5 synthetic cycles: ${fabricatedCycles.map(c => c.outcome).join(", ")}`);
line("");

// Run rotation-tick
line(`  Running rotation-tick...`);
const rt = await runNode("scripts/nex-discovery-rotation/_rotation-tick.mjs");
const relevant = rt.split("\n").find((l) => l.includes(TARGET.city) && l.includes(TARGET.category) && l.includes(TARGET.surface));
line(`  rotation-tick output for target: ${relevant?.trim() ?? "(not seen)"}`);
line("");

const after = await pool.query(
  `SELECT consecutive_zero_new_cycles, state, cooldown_until FROM nex.discovery_rotation_state
    WHERE city=$1 AND category=$2 AND surface=$3 AND round=1`,
  [TARGET.city, TARGET.category, TARGET.surface]
);
const cz = after.rows[0]?.consecutive_zero_new_cycles;
line(`  AFTER:   state=${after.rows[0]?.state}  consecutive_zero=${cz}  cooldown_until=${after.rows[0]?.cooldown_until?.toISOString() ?? "null"}`);
line("");

// The DELTA is what proves the filter works · absolute count includes historical.
// Inserted 5 synthetic (3 ALL_DEDUPED + 2 PROVIDER_ERROR). If filter works:
//   delta = 3 (only ALL_DEDUPED counted)
// If filter broken (old behavior):
//   delta = 5 (all counted regardless of outcome)
const beforeCz = before.rows[0]?.consecutive_zero_new_cycles ?? 0;
const delta    = cz - beforeCz;
const dbTestPass = delta === 3;
line(`  BEFORE (real cycles only)     consecutive_zero = ${beforeCz}`);
line(`  AFTER  (real + 5 synthetic)   consecutive_zero = ${cz}`);
line(`  DELTA                                          = ${delta}`);
line("");
line(`  Filter WORKING  → delta = 3 (only 3 ALL_DEDUPED counted · 2 PROVIDER_ERROR skipped)`);
line(`  Filter BROKEN   → delta = 5 (all 5 counted regardless of outcome)`);
line(`  DB test: ${dbTestPass ? "PASS ✓  filter correctly excluded PROVIDER_ERROR from count" : "FAIL ✗  filter did not exclude PROVIDER_ERROR"}`);
line("");

// ── CLEANUP ────────────────────────────────────────────────────────────
line("── CLEANUP · removing synthetic cycles + restoring state ──");
const del = await pool.query(
  `DELETE FROM nex.worker_cycle_run WHERE id = ANY($1::uuid[])`,
  [testCycleIds]
);
line(`  deleted ${del.rowCount} synthetic cycle rows`);
// Re-run rotation-tick to recompute state from real cycles only
await runNode("scripts/nex-discovery-rotation/_rotation-tick.mjs");
const restored = await pool.query(
  `SELECT consecutive_zero_new_cycles, state FROM nex.discovery_rotation_state
    WHERE city=$1 AND category=$2 AND surface=$3 AND round=1`,
  [TARGET.city, TARGET.category, TARGET.surface]
);
line(`  restored state: ${restored.rows[0]?.state}  consecutive_zero=${restored.rows[0]?.consecutive_zero_new_cycles}`);
line("");

// ── VERDICT ────────────────────────────────────────────────────────────
line("═══════════════════════════════════════════════════════════════════════");
line(unitPass && dbTestPass
  ? "  ✓ P5 PROVIDER_ERROR SATURATION FIX VALIDATED"
  : "  ✗ P5 PROVIDER_ERROR SATURATION FIX FAILED · investigate before P6");
line("═══════════════════════════════════════════════════════════════════════");

await pool.end();
