// scripts/prove-supervisor-cli.ts
//
// Phase 6 · VERIFICATION CLOSURE · exercises scripts/supervisor-resolve.mjs
// against disposable burner data only. Verifies the four sub-invariants Philip
// listed:
//
//   1. preserved-KJ guard REFUSES with exit 2 when target uuid begins with one
//      of the 10 preserved 8-char prefixes (already tested separately, re-run
//      here for closure).
//   2. terminal-transition behaviour · a burner (created fresh via createJob,
//      set to 'claimed') is moved to 'completed' by the CLI.
//   3. audit behaviour · the CLI writes an audit_log row for the burner (on
//      the current NEX_BRAIN_BACKEND · Supabase).
//   4. no production records touched · the 10 preserved fixture kjids remain
//      claimed/progress=0/completion_result=null before AND after the run.
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-supervisor-cli.ts
//
// EXIT CODES · 0 PASS · 2 FAIL · 1 runner exception

import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { createJob, getJob, updateJob } from "@/lib/nex/jobs/fs-store";

const PRESERVED_KJIDS = [
  "46a8eb51-617c-404b-8237-6a515ad6125a",
  "56e1da78-6a97-461a-bc38-cc505d25e00a",
  "ab5835b8-05c8-485e-b1ef-399fe9a48b0a",
  "47e0cf43-5e4c-4d69-a509-59e232e141f1",
  "7fc668ef-cbbc-42a4-b2ef-16e1cde41680",
  "270865e6-f2ca-4fc0-8648-151417c85f64",
  "b1772902-7348-49cd-aed4-48d221ea2d69",
  "1e09c119-f9ed-4400-9dc7-722fc7ae223d",
  "6381641c-eb29-4007-8f3c-2942933cb62d",
  "7e1fc4f9-efb5-4892-8d55-51b347babe1c",
];

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new Pool({ connectionString: pgUrl, max: 2 });

function resolveSupabase() {
  const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not resolvable");
  return createClient(url, key, { auth: { persistSession: false } });
}

type PreservedRow = { status: string; progress: number; completion_result: unknown };
async function snapshotPreserved(): Promise<Map<string, PreservedRow>> {
  const q = await pool.query(
    `SELECT job_id, status, progress, completion_result FROM nex.knowledge_dump_jobs WHERE job_id = ANY($1::text[])`,
    [PRESERVED_KJIDS],
  );
  const m = new Map<string, PreservedRow>();
  for (const r of q.rows) m.set(String(r.job_id), { status: r.status, progress: Number(r.progress), completion_result: r.completion_result });
  return m;
}
function preservedDiff(before: Map<string, PreservedRow>, after: Map<string, PreservedRow>): string[] {
  const diffs: string[] = [];
  for (const [kjid, b] of before.entries()) {
    const a = after.get(kjid);
    if (!a) { diffs.push(`${kjid}: MISSING post-run`); continue; }
    if (a.status !== b.status) diffs.push(`${kjid}: status ${b.status} → ${a.status}`);
    if (Number(a.progress) !== Number(b.progress)) diffs.push(`${kjid}: progress ${b.progress} → ${a.progress}`);
    if (JSON.stringify(a.completion_result) !== JSON.stringify(b.completion_result)) diffs.push(`${kjid}: completion_result changed`);
  }
  return diffs;
}

async function main(): Promise<void> {
  console.log("=== Phase 6 · CLI closure probe · burner-only ===\n");

  // --- Sub-invariant 4a · preflight preservation state ---
  const pre = await snapshotPreserved();
  if (pre.size !== 10) throw new Error(`pre-flight · expected 10 preserved rows · got ${pre.size}`);
  for (const [kjid, s] of pre.entries()) {
    if (s.status !== "claimed" || Number(s.progress) !== 0 || s.completion_result !== null) {
      throw new Error(`pre-flight · preserved ${kjid} not in restored state · status=${s.status} progress=${s.progress}`);
    }
  }
  console.log("preflight · 10 preserved fixtures in restored state (claimed/0/null)\n");

  // --- Sub-invariant 1 · preserved-KJ guard re-check (canonical prefix, invented tail) ---
  const guardTarget = "b1772902-0000-4000-8000-000000000000";
  console.log(`--- Sub-invariant 1 · guard · target ${guardTarget} ---`);
  const guardRun = spawnSync("npx", ["tsx", "scripts/supervisor-resolve.mjs", guardTarget, "--action=complete", "--note", "guard test"], {
    cwd: process.cwd(), env: process.env, encoding: "utf8", shell: true,
  });
  console.log(`  stdout: ${guardRun.stdout.trim()}`);
  console.log(`  stderr: ${guardRun.stderr.trim()}`);
  console.log(`  exit:   ${guardRun.status}`);
  const guardPassed = guardRun.status === 2 && (guardRun.stderr + guardRun.stdout).includes("REFUSED");
  console.log(`  → ${guardPassed ? "PASS" : "FAIL"} · guard refuses preserved-prefix target without --force-preserved\n`);
  if (!guardPassed) { process.exitCode = 2; await pool.end(); return; }

  // --- Sub-invariants 2 + 3 · burner happy-path (create → claimed → CLI complete) ---
  const stamp = Date.now();
  const created = await createJob({
    inbox_item_id: `cli-closure-${stamp}-inbox`,
    title: `cli-closure burner ${stamp}`,
    source: "burner-probe",
    knowledge_type: null,
    owner: "prove-supervisor-cli",
  });
  if (!created) throw new Error("createJob returned null");
  const burnerUuid = created.job_id;
  console.log(`--- Sub-invariants 2 + 3 · burner uuid ${burnerUuid} ---`);
  if (PRESERVED_KJIDS.includes(burnerUuid)) {
    throw new Error("SAFETY VIOLATION · burner uuid collides with preserved kjid · aborting");
  }
  if (PRESERVED_KJIDS.some((k) => burnerUuid.slice(0, 8) === k.slice(0, 8))) {
    throw new Error("SAFETY VIOLATION · burner uuid shares 8-char prefix with preserved · aborting");
  }

  const sb = resolveSupabase();
  try {
    // Move burner into 'claimed' to mimic the intended operator scenario.
    // fs-store's shadow write is fire-and-forget · wait for it to settle before
    // reading back or invoking the CLI (which reads from the same store).
    await updateJob(burnerUuid, { status: "claimed" });
    await new Promise((r) => setTimeout(r, 500));

    const preBurner = await getJob(burnerUuid);
    console.log(`  pre-CLI  · burner status=${preBurner?.status} · progress=${preBurner?.progress}`);
    // CLI accepts any pre-state so we don't fail here · continue to verify the
    // transition instead.

    // --- Run the CLI ---
    console.log(`  running · npx tsx scripts/supervisor-resolve.mjs ${burnerUuid} --action=complete --note ...`);
    const run = spawnSync("npx", ["tsx", "scripts/supervisor-resolve.mjs", burnerUuid, "--action=complete", "--note", `cli-closure ${stamp}`], {
      cwd: process.cwd(), env: process.env, encoding: "utf8", shell: true,
    });
    console.log(`  stdout: ${run.stdout.trim()}`);
    if (run.stderr.trim()) console.log(`  stderr: ${run.stderr.trim()}`);
    console.log(`  exit:   ${run.status}`);

    // --- Sub-invariant 2 · terminal transition ---
    const postBurner = await getJob(burnerUuid);
    console.log(`  post-CLI · burner status=${postBurner?.status} · progress=${postBurner?.progress} · completion_result=${JSON.stringify(postBurner?.completion_result ?? null)}`);
    const transitionPassed = postBurner?.status === "completed" && Number(postBurner?.progress ?? 0) === 100;
    console.log(`  → ${transitionPassed ? "PASS" : "FAIL"} · terminal transition to completed / progress=100`);
    if (!transitionPassed) { process.exitCode = 2; return; }

    // --- Sub-invariant 3 · audit row landed (Supabase backend) ---
    const auditQ = await sb.from("audit_log").select("id, entity_id, action, actor, notes, created_at").eq("entity_id", burnerUuid).order("created_at", { ascending: false }).limit(5);
    const auditRows = auditQ.data ?? [];
    console.log(`  audit rows for burner on Supabase · count=${auditRows.length}`);
    auditRows.forEach((row) => console.log(`    · ${JSON.stringify(row)}`));
    const auditPassed = auditRows.length >= 1 && auditRows.some((r) => String((r as any).action ?? "").toLowerCase().includes("complete"));
    console.log(`  → ${auditPassed ? "PASS" : "FAIL"} · audit row written for CLI action\n`);
    if (!auditPassed) { process.exitCode = 2; return; }

    // --- Sub-invariant 4b · post-flight preservation invariant ---
    const post_preserved = await snapshotPreserved();
    const diffs = preservedDiff(pre, post_preserved);
    if (diffs.length > 0) {
      console.error("FATAL PRESERVATION VIOLATION · preserved fixtures changed during CLI probe:");
      diffs.forEach((d) => console.error("  · " + d));
      process.exitCode = 2;
      return;
    }
    console.log("post-flight · all 10 preserved fixtures unchanged (verified diff)\n");

    console.log("PASS · CLI closure probe · guard + transition + audit + preservation invariant all green");
    process.exitCode = 0;
  } catch (e) {
    console.error("exception:", e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exitCode = 2;
  } finally {
    // Cleanup burner rows (KJ + Supabase audit rows for the burner).
    try {
      await pool.query(`DELETE FROM nex.knowledge_dump_jobs WHERE job_id = $1`, [burnerUuid]);
      console.log(`cleanup · burner KJ deleted (uuid=${burnerUuid})`);
    } catch (e) {
      console.warn("cleanup pg failed:", (e as Error).message);
    }
    try {
      const del = await sb.from("audit_log").delete().eq("entity_id", burnerUuid);
      console.log(`cleanup · burner Supabase audit_log rows deleted · error=${JSON.stringify((del as any).error ?? null)}`);
    } catch (e) {
      console.warn("cleanup supabase audit failed:", (e as Error).message);
    }
    console.log(`cleanup NOTE · fs-store jobs.jsonl retains snapshots for burner ${burnerUuid} (append-only)`);
    await pool.end();
  }
}

main().catch((e) => {
  process.stderr.write(`prove-supervisor-cli · runner exception:\n${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  try { void pool.end(); } catch { /* swallow */ }
  process.exit(1);
});
