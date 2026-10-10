// scripts/nex-canonical/_ingest-accommodation-candidates.mjs
//
// NEX Directory · Accommodation Clearance Prep · F3 wave · 2026-10-10.
//
// Thin wrapper around the sealed `_vertical-ingestion-runner.ts` that
// invokes it with the accommodation adapter and routes output to a
// clearance-prep-scoped pending queue + decision log + checkpoint log.
//
// WHY A SEPARATE WRAPPER (not reusing _ingest-accommodation.mjs)
//   `_ingest-accommodation.mjs` already exists and writes to the shared
//   `data/nex-canonical/pending-review.jsonl` under the default
//   verticals-agent generation-run-id. The F3 clearance-prep wave needs
//   a bounded, operator-identifiable run that:
//     (a) emits candidates to a distinct clearance-prep file so the
//         output of this wave is auditable in isolation,
//     (b) names its generation-run-id with a `clearance-prep-` prefix,
//     (c) defaults --limit=100 (ceiling for the live run, per directive),
//     (d) explicitly refuses to auto-approve or publish anything.
//
//   This wrapper does NOT modify the sealed source adapter, the sealed
//   `_vertical-ingestion-core.ts`, or `_vertical-ingestion-runner.ts`.
//
// DISCOVERY-ONLY GUARANTEES (inherited from the sealed core)
//   · Downstream write stubs throw if ever invoked
//   · Approval provider is the file-backed queue (never auto-approve)
//   · Read-only session: `SET default_transaction_read_only = on`
//   · Never flips can_display · never promotes to VERIFIED
//
// USAGE
//   node --env-file=.env.local \
//     scripts/nex-canonical/_ingest-accommodation-candidates.mjs \
//     [--limit=100] [--generation-run-id=<id>] [--dry-run]
//
//   # Suggested first run · dry-run (probe, no candidates written)
//   node --env-file=.env.local \
//     scripts/nex-canonical/_ingest-accommodation-candidates.mjs \
//     --limit=100 --dry-run
//
//   # Then · live --limit=100 (candidates land in the clearance-prep queue)
//   node --env-file=.env.local \
//     scripts/nex-canonical/_ingest-accommodation-candidates.mjs \
//     --limit=100
//
// EXIT
//   whatever the sealed `_vertical-ingestion-runner.ts` emits.

import { spawn } from "node:child_process";
import * as path from "node:path";

const VERTICAL = "accommodation";
const DEFAULT_LIMIT = 100;
const PENDING = "data/nex-canonical/pending-review-accommodation-clearance-prep.jsonl";
const DECISIONS = "data/nex-canonical/decisions-accommodation-clearance-prep.jsonl";
const CHECKPOINTS = "data/nex-canonical/checkpoints-accommodation-clearance-prep.jsonl";

function readFlag(name) {
  return process.argv.includes(`--${name}`);
}

function readArg(name) {
  const prefix = `--${name}=`;
  for (const a of process.argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return undefined;
}

const dryRun = readFlag("dry-run");
const limit = readArg("limit") ?? String(DEFAULT_LIMIT);

// Clearance-prep-scoped run id. Operator can override but default
// prefix is `clearance-prep-accommodation-<iso>` so the pending-queue
// output is attributable.
const sessionTs = new Date().toISOString().replace(/[:.]/g, "-");
const generationRunId =
  readArg("generation-run-id") ??
  `clearance-prep-${VERTICAL}-${sessionTs}`;

// Hard ceiling: --limit must not exceed the directive-sealed 100 for
// the live run. If an operator passes --limit=500 with --dry-run that's
// fine (dry-run doesn't persist anything), but the live run is capped.
const limitAsInt = Number.parseInt(limit, 10);
if (!Number.isFinite(limitAsInt) || limitAsInt <= 0) {
  console.error(
    `[ingest-${VERTICAL}-clearance-prep] FATAL · invalid --limit=${limit}`,
  );
  process.exit(1);
}
if (!dryRun && limitAsInt > DEFAULT_LIMIT) {
  console.error(
    `[ingest-${VERTICAL}-clearance-prep] FATAL · live run --limit must be ≤ ${DEFAULT_LIMIT} (got ${limitAsInt}). Use --dry-run for larger probes.`,
  );
  process.exit(1);
}

const args = [
  "tsx",
  path.join("scripts", "nex-canonical", "_vertical-ingestion-runner.ts"),
  `--vertical=${VERTICAL}`,
  `--limit=${limitAsInt}`,
  `--generation-run-id=${generationRunId}`,
];

if (!dryRun) {
  args.push(`--pending-queue=${PENDING}`);
  args.push(`--decision-log=${DECISIONS}`);
  args.push(`--checkpoint-log=${CHECKPOINTS}`);
  args.push("--batch-size=50");
  args.push("--max-batches=10");
} else {
  args.push("--dry-run");
}

console.log(
  `[ingest-${VERTICAL}-clearance-prep] spawning: npx ${args.join(" ")}`,
);
console.log(
  `[ingest-${VERTICAL}-clearance-prep] discovery-only · never flips can_display · never promotes to VERIFIED`,
);
console.log(
  `[ingest-${VERTICAL}-clearance-prep] generation-run-id=${generationRunId}`,
);

const child = spawn("npx", args, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
