// scripts/prove-concurrent-claim-3.ts
//
// D13 · Extend concurrent-claim proof from 2 workers to 3.
//
// Existing parity harness (Wave 11) proves that with 2 concurrent
// claimants against nex.claim_next_job, each gets a distinct job or
// null. Production topology has 3 (2 Fly historical + 1 Vercel), so
// we extend the proof.
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-concurrent-claim-3.ts
//
// EXIT CODES
//   0 · PASS · at most one claimant claims each job
//   2 · FAIL · duplicate claim detected
//   1 · runner exception
//
// GUARDRAILS
//   · Creates 6 disposable worker_jobs of a synthetic worker_type
//     "concurrent-claim-probe-<epoch>". Cleans up on exit.
//   · Uses the SAME claim helper (SKIP LOCKED) that production uses.

import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const pool = new Pool({ connectionString: pgUrl, max: 6 });
const workerType = `concurrent-claim-probe-${Date.now()}`;
const NUM_JOBS    = 6;
const NUM_WORKERS = 3;

async function seedJobs(): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < NUM_JOBS; i++) {
    const r = await pool.query(
      `INSERT INTO nex.worker_jobs (worker_type, input_kind, input_ref, input_payload)
       VALUES ($1, 'probe', $2, '{}'::jsonb)
       RETURNING id`,
      [workerType, `probe-${i}-${randomUUID().slice(0, 8)}`],
    );
    ids.push(String(r.rows[0].id));
  }
  return ids;
}

async function claimOne(workerId: string): Promise<string | null> {
  const r = await pool.query(
    `SELECT * FROM nex.claim_next_job($1, $2, 60)`,
    [workerType, workerId],
  );
  const row = r.rows[0] as { id: string | null } | undefined;
  return row && row.id ? String(row.id) : null;
}

async function main(): Promise<void> {
  console.log(`probe worker_type: ${workerType}`);
  const seededIds = await seedJobs();
  console.log(`seeded ${seededIds.length} jobs`);

  // Fire NUM_WORKERS concurrent claims, three rounds — total 3 x 3 = 9
  // claim calls against 6 jobs. Expect 6 unique job IDs plus some nulls.
  const roundResults: Array<Array<string | null>> = [];
  for (let round = 0; round < 3; round++) {
    const results = await Promise.all(
      Array.from({ length: NUM_WORKERS }, (_, i) => claimOne(`worker-${i + 1}`)),
    );
    roundResults.push(results);
    console.log(`round ${round + 1} results:`, results);
  }

  // Flatten and check uniqueness of non-null claims
  const claimed = roundResults.flat().filter((x): x is string => x !== null);
  const set = new Set(claimed);
  const duplicates = claimed.length !== set.size;

  console.log(`total claims: ${claimed.length} · unique: ${set.size} · duplicates: ${duplicates}`);

  if (duplicates) {
    console.error("FAIL · duplicate claim detected");
    await cleanup(seededIds);
    process.exit(2);
  }
  // Every seeded job should have been claimed (6 jobs, 9 attempts)
  const claimedSet = new Set(claimed);
  const missed = seededIds.filter((id) => !claimedSet.has(id));
  if (missed.length > 0) {
    console.error(`FAIL · ${missed.length} seeded jobs never claimed`);
    console.error(missed);
    await cleanup(seededIds);
    process.exit(2);
  }

  console.log("PASS · 3-worker concurrent claim · zero duplicates · all seeded jobs claimed");
  await cleanup(seededIds);
  process.exit(0);
}

async function cleanup(ids: string[]): Promise<void> {
  try {
    if (ids.length > 0) {
      await pool.query(`DELETE FROM nex.worker_jobs WHERE id = ANY($1::uuid[])`, [ids]);
    }
    console.log("cleanup · probe jobs deleted");
  } catch (e) {
    console.warn(`cleanup failed: ${(e as Error).message}`);
  } finally {
    await pool.end();
  }
}

main().catch(async (e) => {
  const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
  process.stderr.write(`prove-concurrent-claim-3 · runner exception:\n${msg}\n`);
  try { await pool.end(); } catch { /* swallow */ }
  process.exit(1);
});
