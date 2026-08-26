// One-shot watcher · exits 0 when BOTH walkers have completed >=2 cycles
// since a given scheduler start · exits 2 if the scheduler PID dies before then.
// Windows-safe · uses tasklist to check PID · single-file · zero deps beyond pg.
//
// Usage:
//   node --env-file=.env.local scripts/nex-acquisition/_watch-second-cycle.mjs \
//     --pid=8400 --schedStart=2026-08-23T09:00:40.633Z
//
// Not committed to the doctrine boundary of Walker code · this is a runtime
// diagnostic script under the same directory · never imported by Walker itself.

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

function pidAlive(pid) {
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`], { encoding: "utf8" });
    return out.includes(String(pid));
  } catch {
    return false;
  }
}

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

async function counts() {
  const r = await pool.query(
    `SELECT worker_config, COUNT(*)::int AS c
       FROM nex.worker_cycle_run
      WHERE worker_type='acquisition'
        AND status='completed'
        AND (worker_config LIKE 'food:Yogyakarta:%' OR worker_config LIKE 'accommodation:Yogyakarta:%')
        AND started_at >= $1::timestamptz
      GROUP BY worker_config`,
    [SCHED_START],
  );
  const food  = r.rows.filter((x) => x.worker_config.startsWith("food:")).reduce((a, x) => a + x.c, 0);
  const accom = r.rows.filter((x) => x.worker_config.startsWith("accommodation:")).reduce((a, x) => a + x.c, 0);
  return { food, accom };
}

const pollMs = 30_000;
const startedWatchAt = Date.now();
const maxWatchMs = 25 * 60 * 1000;

while (true) {
  if (!pidAlive(PID)) {
    console.log(`[${new Date().toISOString()}] FATAL · scheduler PID ${PID} not in tasklist · exit 2`);
    await pool.end();
    process.exit(2);
  }
  const { food, accom } = await counts();
  console.log(`[${new Date().toISOString()}] food=${food} accom=${accom} (need >=2 each) · pid ${PID} alive`);
  if (food >= 2 && accom >= 2) {
    console.log(`[${new Date().toISOString()}] BOTH SECOND CYCLES OBSERVED · exit 0`);
    await pool.end();
    process.exit(0);
  }
  if (Date.now() - startedWatchAt > maxWatchMs) {
    console.log(`[${new Date().toISOString()}] TIMEOUT after ${Math.round(maxWatchMs / 60000)}m · exit 3`);
    await pool.end();
    process.exit(3);
  }
  await new Promise((r) => setTimeout(r, pollMs));
}
