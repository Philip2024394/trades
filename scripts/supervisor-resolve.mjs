// scripts/supervisor-resolve.mjs
//
// Wave 2 · Phase 6 · operator CLI for resolving Path B review-queue KJs.
// Governed by: docs/headquarters-production-readiness/W-C-COMPANION-PHASE-6-DESIGN.md §13
//
// USAGE
//   npx tsx scripts/supervisor-resolve.mjs <kjid> --action=requeue|mark_failed|complete
//   npx tsx scripts/supervisor-resolve.mjs <kjid> --action=requeue --note "Operator says re-drive is safe"
//
// Invoked via `tsx` (not plain `node`) because the CLI imports TypeScript
// modules (fs-store.ts, brain/storage.ts). Confirmed during Phase 6 closure
// probe · 2026-08-10.
//
// SAFETY
//   · Never operates on any of the 10 preserved real stuck kjids unless the
//     operator explicitly acknowledges by adding --force-preserved.
//   · Writes an audit_log row per action for provenance.
//
// EXIT CODES
//   0 · KJ resolved · audit row written
//   1 · runner exception / invalid args
//   2 · KJ not found or preserved-kjid without --force-preserved

const PRESERVED_KJIDS = new Set([
  "b1772902", "1e09c119", "6381641c", "7e1fc4f9", "270865e6",
  "7fc668ef", "47e0cf43", "ab5835b8", "56e1da78", "46a8eb51",
]);
// The full-length kjids of the 10 preserved fixtures are unknown to this
// script (they'd have to be looked up in production data). We compare on the
// 8-char prefix that appears in the stuck-claimed investigation. Operator
// intending to touch a preserved fixture MUST pass --force-preserved.

const args = process.argv.slice(2);
if (args.length < 1 || args[0].startsWith("--")) {
  console.error("usage: npx tsx scripts/supervisor-resolve.mjs <kjid> --action=requeue|mark_failed|complete [--note \"text\"] [--force-preserved]");
  process.exit(1);
}
const kjid = args[0];
const actionArg = args.find((a) => a.startsWith("--action="));
const noteArg   = args.find((a) => a.startsWith("--note="));
const noteIdx   = args.indexOf("--note");
const forcePreserved = args.includes("--force-preserved");

const action = actionArg ? actionArg.slice("--action=".length) : null;
const note   = noteArg ? noteArg.slice("--note=".length) : (noteIdx >= 0 ? args[noteIdx + 1] : "");

if (!["requeue", "mark_failed", "complete"].includes(action ?? "")) {
  console.error("--action= must be one of: requeue | mark_failed | complete");
  process.exit(1);
}

if (PRESERVED_KJIDS.has(kjid.slice(0, 8)) && !forcePreserved) {
  console.error(`REFUSED · kjid ${kjid} matches a preserved fixture prefix. Add --force-preserved to override.`);
  process.exit(2);
}

async function main() {
  const { getJob, updateJob } = await import("../src/lib/nex/jobs/fs-store.ts");
  const { brainStore } = await import("../src/lib/nex/brain/storage.ts");

  const kj = await getJob(kjid);
  if (!kj) { console.error(`kjid ${kjid} not found`); process.exit(2); }

  const store = brainStore();

  let patch = null;
  if (action === "requeue")     patch = { status: "queued",    progress: 0 };
  if (action === "mark_failed") patch = { status: "failed",    progress: 100, completion_result: { error: note || "operator-marked-failed" } };
  if (action === "complete")    patch = { status: "completed", progress: 100, completion_result: { memories_added: 0, brains_linked: [], operator_note: note || "operator-attested" } };

  const updated = await updateJob(kjid, patch);
  if (!updated) { console.error("updateJob returned null"); process.exit(1); }

  await store.insertAudit({
    entity_type: "knowledge_jobs",
    entity_id: kjid,
    action: `supervisor-resolve-${action}`,
    actor: `operator:supervisor-resolve.mjs@${process.env.USER ?? "unknown"}`,
    before_state: { status: kj.status, progress: kj.progress },
    after_state:  { status: updated.status, progress: updated.progress, completion_result: updated.completion_result },
    notes: note || null,
  });

  console.log(JSON.stringify({ ok: true, kjid, from: kj.status, to: updated.status, action }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error("runner exception:", e instanceof Error ? e.message : e);
  process.exit(1);
});
