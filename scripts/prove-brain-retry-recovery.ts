// scripts/prove-brain-retry-recovery.ts
//
// Wave 8 · G.retry-recovery closure · operator script.
//
// Runs the brain-worker retry-recovery scenario from
// src/lib/nex/testing/brain-recovery.ts against WHATEVER backend
// brainStore() selects (filesystem in dev · postgres if
// NEX_BRAIN_BACKEND=postgres · supabase if NEX_BRAIN_BACKEND=supabase).
//
// Produces ONE fresh nex.worker_jobs row that satisfies the
// six-worker-proveout G.retry-recovery query
//   attempts > 1 AND status = 'completed'
// then cleans it up. Pass --keep-evidence to leave the row so the
// proveout runner can observe it within its FRESH_MINUTES window.
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-brain-retry-recovery.ts
//   npx tsx --env-file=.env.local scripts/prove-brain-retry-recovery.ts --keep-evidence
//   npx tsx --env-file=.env.local scripts/prove-brain-retry-recovery.ts --label=pre-cutover
//
// EXIT CODES
//   0 · scenario PASS
//   2 · scenario FAIL
//   1 · runner exception
//
// GUARDRAILS
//   · Uses brainStore() · no adapter-private access.
//   · Only writes: one worker_jobs row + one worker_results row · both
//     tagged with input_ref='retry-recovery-<timestamp>'.
//   · Cleanup runs even on failure (best-effort) · absent --keep-evidence.
//   · READ-ONLY against every other table.

import { brainStore, activeBackend, type BrainStore } from "@/lib/nex/brain/storage";
import {
  scenarioBrainWorkerRetryRecovery,
  filesystemResetJobToWaiting,
  filesystemCleanupScenarioRows,
  type RunOptions,
} from "@/lib/nex/testing/brain-recovery";

const args = process.argv.slice(2);
const KEEP = args.includes("--keep-evidence");
const labelArg = args.find((a) => a.startsWith("--label="));
const LABEL = labelArg ? labelArg.slice("--label=".length) : "operator-manual";

async function backendHelpers(backend: string): Promise<{
  reset: RunOptions["resetJobToWaiting"];
  cleanup: RunOptions["cleanupRows"];
  teardown: () => Promise<void>;
}> {
  if (backend === "postgres") {
    const { Pool } = await import("pg");
    const url =
      process.env.NEX_POSTGRES_URL ??
      "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
    const pool = new Pool({ connectionString: url, max: 2 });
    return {
      reset: async (id: string) => {
        await pool.query(
          "UPDATE nex.worker_jobs SET status='waiting', assigned_worker_id=NULL, assigned_at=NULL, lease_expires_at=NULL, updated_at=NOW() WHERE id=$1",
          [id],
        );
      },
      cleanup: async (jobId: string, resultId: string | null) => {
        if (KEEP) return;
        if (resultId) await pool.query("DELETE FROM nex.worker_results WHERE id=$1", [resultId]);
        await pool.query("DELETE FROM nex.worker_jobs WHERE id=$1", [jobId]);
      },
      teardown: async () => { await pool.end(); },
    };
  }
  if (backend === "supabase") {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEX_SUPABASE_URL
             ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL
             ?? "";
    const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) throw new Error("Supabase env vars missing (NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY)");
    const client = createClient(url, key, { auth: { persistSession: false } });
    return {
      reset: async (id: string) => {
        await client.from("worker_jobs").update({
          status: "waiting",
          assigned_worker_id: null,
          assigned_at: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", id);
      },
      cleanup: async (jobId: string, resultId: string | null) => {
        if (KEEP) return;
        if (resultId) await client.from("worker_results").delete().eq("id", resultId);
        await client.from("worker_jobs").delete().eq("id", jobId);
      },
      teardown: async () => { /* nothing */ },
    };
  }
  // filesystem fallback
  return {
    reset: filesystemResetJobToWaiting,
    cleanup: KEEP ? (async () => {}) : filesystemCleanupScenarioRows,
    teardown: async () => { /* nothing */ },
  };
}

async function main(): Promise<void> {
  const backend = activeBackend();
  const helpers = await backendHelpers(backend);
  const store: BrainStore = brainStore();

  const result = await scenarioBrainWorkerRetryRecovery(store, {
    resetJobToWaiting: helpers.reset,
    cleanupRows: helpers.cleanup,
    label: LABEL,
  });

  await helpers.teardown();

  const summary = {
    backend,
    label: LABEL,
    keep_evidence: KEEP,
    status: result.status,
    duration_ms: result.duration_ms,
    detail: result.detail,
    observations: result.observations,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(result.status === "pass" ? 0 : 2);
}

main().catch((e) => {
  const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
  process.stderr.write(`prove-brain-retry-recovery · runner exception:\n${msg}\n`);
  process.exit(1);
});
