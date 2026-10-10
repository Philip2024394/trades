// scripts/nex-canonical/_ingest-accommodation.mjs
//
// NEX Directory · Verticals agent · thin wrapper that invokes the
// shared `_vertical-ingestion-runner.ts` with the accommodation
// adapter.
//
// Pattern reference · sealed `real-ingestion-runner.ts` (food).
//
// USAGE
//   node --env-file=.env.local scripts/nex-canonical/_ingest-accommodation.mjs \
//     [--limit=100] [--generation-run-id=<id>] [--dry-run]
//
// Discovery-only. Never flips can_display. Never admin-promotes. Never
// writes to business_canonical. Candidates land in pending-review.jsonl.
//
// When the four accommodation legacy columns and the sealed candidate
// validator are all healthy, the runner emits ReviewPackage rows to
// pending-review.jsonl for later founder review. The accommodation
// source_registry row has can_display=FALSE so even after approval the
// rows would stay invisible in business_directory_v. A separate legal-
// clearance step (see docs/doctrine/nex-directory-vertical-clearance-
// paths-2026-10-10.md) is required to flip can_display=TRUE.

import { spawn } from "node:child_process";
import * as path from "node:path";

const VERTICAL = "accommodation";
const DEFAULT_LIMIT = 100;
const PENDING = "data/nex-canonical/pending-review.jsonl";
const DECISIONS = "data/nex-canonical/decisions.jsonl";
const CHECKPOINTS = `data/nex-canonical/checkpoints-${VERTICAL}.jsonl`;

function readFlag(name) {
  return process.argv.includes(`--${name}`);
}
function readArg(name) {
  const prefix = `--${name}=`;
  for (const a of process.argv) if (a.startsWith(prefix)) return a.slice(prefix.length);
  return undefined;
}

const dryRun = readFlag("dry-run");
const limit = readArg("limit") ?? String(DEFAULT_LIMIT);
const sessionTs = new Date().toISOString().replace(/[:.]/g, "-");
const generationRunId = readArg("generation-run-id") ?? `verticals-${VERTICAL}-${sessionTs}`;

const args = [
  "tsx",
  path.join("scripts", "nex-canonical", "_vertical-ingestion-runner.ts"),
  `--vertical=${VERTICAL}`,
  `--limit=${limit}`,
  `--generation-run-id=${generationRunId}`,
];

if (!dryRun) {
  args.push(`--pending-queue=${PENDING}`);
  args.push(`--decision-log=${DECISIONS}`);
  args.push(`--checkpoint-log=${CHECKPOINTS}`);
  args.push(`--batch-size=50`);
  args.push(`--max-batches=10`);
} else {
  args.push("--dry-run");
}

console.log(`[ingest-${VERTICAL}] spawning: npx ${args.join(" ")}`);
const child = spawn("npx", args, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
