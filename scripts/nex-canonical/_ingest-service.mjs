// scripts/nex-canonical/_ingest-service.mjs
//
// NEX Directory · Verticals agent · thin wrapper for the service /
// vehicle-rental legacy vertical. Delegates to
// _vertical-ingestion-runner.ts with --vertical=service.
//
// Discovery-only · never flips can_display · never admin-promotes ·
// never auto-approves. Candidates land in pending-review.jsonl.

import { spawn } from "node:child_process";
import * as path from "node:path";

const VERTICAL = "service";
const DEFAULT_LIMIT = 100;
const PENDING = "data/nex-canonical/pending-review.jsonl";
const DECISIONS = "data/nex-canonical/decisions.jsonl";
const CHECKPOINTS = `data/nex-canonical/checkpoints-${VERTICAL}.jsonl`;

function readFlag(name) { return process.argv.includes(`--${name}`); }
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
