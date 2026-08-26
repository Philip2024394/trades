// One-shot chained-mode verifier · exits 0 when both walkers have logged
// ≥3 completed cycles since scheduler start AND the mean gap between
// consecutive cycles per walker is under the chained ceiling (60 s).
// Exits 2 if scheduler PID dies · 3 on timeout.
//
// Chained ceiling rationale: cycles run ~30 s + 3 s polite floor = ~33 s.
// A gap over 60 s means the loop is NOT chaining (would be interval-timed).
//
// Usage:
//   node --env-file=.env.local scripts/nex-acquisition/_watch-nonstop-chain.mjs \
//     --pid=23616 --schedStart=2026-08-23T09:07:27.239Z

import pg from "pg";
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);
const PID = Number(args.pid);
const SCHED_START = args.schedStart;
if (!PID || !SCHED_START) {
  console.error("Usage: --pid=<num> --schedStart=<ISO>");
  process.exit(1);
}

const CHAIN_CEILING_S = 90; // per-walker mean gap ceiling · above this means NOT chained
const REQUIRED_CYCLES = 3;
const POLL_MS = 15_000;
const MAX_WATCH_MS = 15 * 60_000;

function pidAlive(pid) {
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`], { encoding: "utf8" });
    return out.includes(String(pid));
  } catch {
    return false;
  }
}

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

async function stats() {
  const r = await pool.query(
    `SELECT
        CASE WHEN worker_config LIKE 'food:%'          THEN 'food'
             WHEN worker_config LIKE 'accommodation:%' THEN 'accommodation'
        END AS vertical,
        started_at, finished_at, status
       FROM nex.worker_cycle_run
      WHERE worker_type='acquisition'
        AND (worker_config LIKE 'food:Yogyakarta:%' OR worker_config LIKE 'accommodation:Yogyakarta:%')
        AND started_at >= $1::timestamptz
      ORDER BY started_at ASC`,
    [SCHED_START],
  );
  const byVertical = { food: [], accommodation: [] };
  for (const row of r.rows) {
    if (row.vertical) byVertical[row.vertical].push(row);
  }
  const summarise = (rows) => {
    const completed = rows.filter((r) => r.status === "completed");
    if (completed.length < 2) return { count: completed.length, meanGapS: null, maxGapS: null };
    const gaps = [];
    for (let i = 1; i < completed.length; i++) {
      const prevEnd = completed[i - 1].finished_at ? new Date(completed[i - 1].finished_at).getTime() : new Date(completed[i - 1].started_at).getTime();
      const currStart = new Date(completed[i].started_at).getTime();
      gaps.push(Math.max(0, (currStart - prevEnd) / 1000));
    }
    return {
      count: completed.length,
      meanGapS: gaps.reduce((a, b) => a + b, 0) / gaps.length,
      maxGapS: Math.max(...gaps),
    };
  };
  return { food: summarise(byVertical.food), accom: summarise(byVertical.accommodation) };
}

const started = Date.now();
while (true) {
  if (!pidAlive(PID)) {
    console.log(`[${new Date().toISOString()}] FATAL · scheduler PID ${PID} not in tasklist · exit 2`);
    await pool.end();
    process.exit(2);
  }
  const s = await stats();
  console.log(
    `[${new Date().toISOString()}] food count=${s.food.count} meanGap=${s.food.meanGapS?.toFixed(1) ?? "-"}s maxGap=${s.food.maxGapS?.toFixed(1) ?? "-"}s · accom count=${s.accom.count} meanGap=${s.accom.meanGapS?.toFixed(1) ?? "-"}s maxGap=${s.accom.maxGapS?.toFixed(1) ?? "-"}s`,
  );
  const foodOk  = s.food.count  >= REQUIRED_CYCLES && s.food.meanGapS  != null && s.food.meanGapS  <= CHAIN_CEILING_S;
  const accomOk = s.accom.count >= REQUIRED_CYCLES && s.accom.meanGapS != null && s.accom.meanGapS <= CHAIN_CEILING_S;
  if (foodOk && accomOk) {
    console.log(`[${new Date().toISOString()}] CHAINED MODE PROVEN · both walkers ≥${REQUIRED_CYCLES} cycles · mean gap ≤${CHAIN_CEILING_S}s`);
    await pool.end();
    process.exit(0);
  }
  if (Date.now() - started > MAX_WATCH_MS) {
    console.log(`[${new Date().toISOString()}] TIMEOUT · exit 3`);
    await pool.end();
    process.exit(3);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
