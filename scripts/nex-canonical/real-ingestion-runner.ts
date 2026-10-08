// scripts/nex-canonical/real-ingestion-runner.ts
//
// NEX Canonical · Thin CLI around the sealed
// `runRealDirectoryIngestionID` discovery-only ingestion library
// (scripts/nex-canonical/directory-ingestion-runner.ts).
//
// Objective
//   Execute the sealed `nex_food_business_legacy` source adapter against
//   the real `nex.food_business` table, run every candidate through the
//   sealed candidate-generation + validation + review pipeline, and
//   append each ReviewPackage line to the file-backed pending-review
//   queue. STOPS BEFORE ANY FOUNDER DECISION. STOPS BEFORE ANY
//   CANONICAL WRITE.
//
// Scope mirrored from the sealed library
//   · Does NOT invoke executeWritePlan.
//   · Does NOT invoke precheckHandoff for a write.
//   · Does NOT mutate nex.source_registry.
//   · Does NOT set can_derive = true (that is migration 179's job).
//   · Does NOT auto-approve any candidate.
//   · Does NOT invoke decideCandidate on behalf of the founder.
//   · Does NOT fabricate businesses, images, phones, coordinates.
//   · Does NOT silently expand to another country · scope = "ID".
//   The sealed library wires throw-on-call stubs for every post-
//   approval dependency so any logic error would surface as a loud
//   `DownstreamNotPermittedError` rather than a silent write.
//
// CLI shape · explicit · never defaults the cap
//   tsx scripts/nex-canonical/real-ingestion-runner.ts \
//     --max-candidates=<n>              (required · operator-chosen cap)
//     --generation-run-id=<id>          (required)
//     --pending-queue=<path>            (required)
//     --decision-log=<path>             (required)
//     --checkpoint-log=<path>           (required)
//     [--batch-size=<n>]                (optional · default 10)
//     [--max-batches=<n>]               (optional · default 100)
//
// The pending queue, decision log, and checkpoint log are append-only
// JSONL files produced by this run · they are RUNTIME DATA and must be
// gitignored (see .gitignore entry for data/nex-canonical/).
//
// EXIT CODES
//   0  · runner_completed
//   1  · preflight (env or CLI args) refused · no connection opened
//   2  · fingerprint mismatch · stopped before any discovery query
//   3  · downstream not-permitted was invoked (sealed library logic
//        error · never fires under correct operation)
//  99  · unexpected error (sanitised)

import * as fs from "node:fs/promises";
import {
  runRealDirectoryIngestionID,
  type IngestionIO,
  type RealIngestionConfig,
} from "./directory-ingestion-runner";

/** Minimal credential-safe redactor for diagnostic strings. Mirrors
 *  the sanitiser in first-live-write-runner.ts. */
function sanitiseErr(message: string): string {
  let out = message;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:]*:[^@]*@[^\s'"]+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password=[redacted]");
  out = out.replace(/password\s*=\s*\S+/gi, "password=[redacted]");
  return out;
}

/** Local-dev convenience: derive split NEX_CANONICAL_PG_* credential
 *  env vars from NEX_POSTGRES_URL when the split form is unset. Does
 *  NOT derive the EXPECTED_* oracle values · those must be set
 *  explicitly by the operator. Same pattern as first-live-write-runner. */
function deriveSplitCredsFromUrlIfNeeded(env: NodeJS.ProcessEnv): void {
  if (env.NEX_CANONICAL_PG_HOST) return;
  const url = env.NEX_POSTGRES_URL;
  if (!url) return;
  try {
    const u = new URL(url);
    env.NEX_CANONICAL_PG_HOST = u.hostname;
    if (u.port) env.NEX_CANONICAL_PG_PORT = u.port;
    const db = u.pathname.replace(/^\//, "");
    if (db.length > 0) env.NEX_CANONICAL_PG_DATABASE = db;
    if (u.username.length > 0) {
      env.NEX_CANONICAL_PG_USER = decodeURIComponent(u.username);
    }
    if (u.password.length > 0) {
      env.NEX_CANONICAL_PG_PASSWORD = decodeURIComponent(u.password);
    }
    if (!env.NEX_CANONICAL_PG_SSL) env.NEX_CANONICAL_PG_SSL = "false";
  } catch {
    // Malformed URL · adapter config parsing will fail-closed below.
  }
}

// ═════════════════════════════════════════════════════════════════════
// §1 · CLI arg parsing · explicit · no silent defaults for the cap
// ═════════════════════════════════════════════════════════════════════

export interface CliArgs {
  readonly maxCandidates: number;
  readonly generationRunId: string;
  readonly pendingQueuePath: string;
  readonly decisionLogPath: string;
  readonly checkpointLogPath: string;
  readonly batchSize: number;
  readonly maxBatches: number;
}

export class CliArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgError";
  }
}

function readArg(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const a of argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return undefined;
}

function requireInt(name: string, raw: string | undefined): number {
  if (raw === undefined || raw.length === 0) {
    throw new CliArgError(`missing required CLI arg --${name}=<n>`);
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new CliArgError(
      `CLI arg --${name} must be a positive integer · got "${raw}"`,
    );
  }
  return n;
}

function requireString(name: string, raw: string | undefined): string {
  if (raw === undefined || raw.length === 0) {
    throw new CliArgError(`missing required CLI arg --${name}=<value>`);
  }
  return raw;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  // argv[0..1] are node + script path when launched via tsx.
  const rest = argv.slice(2);
  const maxCandidates = requireInt(
    "max-candidates",
    readArg(rest, "max-candidates"),
  );
  const generationRunId = requireString(
    "generation-run-id",
    readArg(rest, "generation-run-id"),
  );
  const pendingQueuePath = requireString(
    "pending-queue",
    readArg(rest, "pending-queue"),
  );
  const decisionLogPath = requireString(
    "decision-log",
    readArg(rest, "decision-log"),
  );
  const checkpointLogPath = requireString(
    "checkpoint-log",
    readArg(rest, "checkpoint-log"),
  );
  const batchSizeRaw = readArg(rest, "batch-size");
  const batchSize =
    batchSizeRaw === undefined ? 10 : requireInt("batch-size", batchSizeRaw);
  const maxBatchesRaw = readArg(rest, "max-batches");
  const maxBatches =
    maxBatchesRaw === undefined
      ? 100
      : requireInt("max-batches", maxBatchesRaw);
  return {
    maxCandidates,
    generationRunId,
    pendingQueuePath,
    decisionLogPath,
    checkpointLogPath,
    batchSize,
    maxBatches,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Filesystem IO adapter · mirrors first-live-write-runner shape
// ═════════════════════════════════════════════════════════════════════

async function readTextOrEmptyFs(path: string): Promise<string> {
  try {
    return await fs.readFile(path, "utf8");
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : null;
    if (code === "ENOENT") return "";
    throw err;
  }
}

async function appendLineFs(path: string, line: string): Promise<void> {
  // Ensure parent dir exists · idempotent · same pattern as the sealed
  // first-live-write-runner's file IO.
  const slash = path.lastIndexOf("/");
  const backslash = path.lastIndexOf("\\");
  const sep = Math.max(slash, backslash);
  if (sep > 0) {
    const dir = path.slice(0, sep);
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.appendFile(path, line + "\n", "utf8");
}

function buildFsIO(env: NodeJS.ProcessEnv): IngestionIO & {
  readonly env: NodeJS.ProcessEnv;
} {
  // The sealed IngestionIO uses `env` at runtime but omits it from the
  // interface declaration; cast narrows the shape to match the sealed
  // runner's usage (`args.io.env`).
  return {
    env,
    nowIso: () => new Date().toISOString(),
    sleep: (ms: number) => new Promise((res) => setTimeout(res, ms)),
    readTextOrEmpty: readTextOrEmptyFs,
    appendLine: appendLineFs,
    print: (m: string) => {
      // eslint-disable-next-line no-console
      console.log(m);
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Main
// ═════════════════════════════════════════════════════════════════════

async function main(): Promise<number> {
  // 3.1 Parse CLI args.
  let cli: CliArgs;
  try {
    cli = parseCliArgs(process.argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`real-ingestion-runner · ${msg}`);
    // eslint-disable-next-line no-console
    console.error(
      "usage: tsx scripts/nex-canonical/real-ingestion-runner.ts \\\n" +
        "  --max-candidates=<n> --generation-run-id=<id> \\\n" +
        "  --pending-queue=<path> --decision-log=<path> \\\n" +
        "  --checkpoint-log=<path> [--batch-size=<n>] [--max-batches=<n>]",
    );
    return 1;
  }

  // 3.2 Local-dev credential derivation.
  deriveSplitCredsFromUrlIfNeeded(process.env);

  // 3.3 Build the IO adapter.
  const io = buildFsIO(process.env);

  // 3.4 Build the sealed config · the max-candidates cap is the
  // operator-chosen ceiling · passed through to maxCandidatesPerSource.
  const config: RealIngestionConfig = {
    country: "ID",
    pendingQueuePath: cli.pendingQueuePath,
    decisionLogPath: cli.decisionLogPath,
    checkpointLogPath: cli.checkpointLogPath,
    generationRunId: cli.generationRunId,
    batchSize: cli.batchSize,
    maxBatchesPerSource: cli.maxBatches,
    maxCandidatesPerSource: cli.maxCandidates,
  };

  // eslint-disable-next-line no-console
  console.log("=== real-ingestion-runner ===");
  // eslint-disable-next-line no-console
  console.log(
    `cap · maxCandidatesPerSource = ${config.maxCandidatesPerSource} ` +
      `· batchSize = ${config.batchSize} · maxBatchesPerSource = ${config.maxBatchesPerSource}`,
  );
  // eslint-disable-next-line no-console
  console.log(`generation_run_id    = ${config.generationRunId}`);
  // eslint-disable-next-line no-console
  console.log(`pending_queue_path   = ${config.pendingQueuePath}`);
  // eslint-disable-next-line no-console
  console.log(`decision_log_path    = ${config.decisionLogPath}`);
  // eslint-disable-next-line no-console
  console.log(`checkpoint_log_path  = ${config.checkpointLogPath}`);

  // 3.5 Delegate to the sealed library · all preflight gates
  // (env, fingerprint) and discovery-only guarantees live there.
  const report = await runRealDirectoryIngestionID({ config, io });

  // eslint-disable-next-line no-console
  console.log("=== report ===");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  switch (report.stop_reason) {
    case "runner_completed":
      return 0;
    case "preflight_env_missing":
      return 1;
    case "preflight_fingerprint_mismatch":
      return 2;
    case "unexpected_downstream_called":
      return 3;
    case "runner_cap_reached":
      return 0;
    default:
      // eslint-disable-next-line no-console
      console.error(
        `real-ingestion-runner · unknown stop_reason "${report.stop_reason}"`,
      );
      return 99;
  }
}

// Only run main() when executed as the entry point · identical guard
// pattern to bulk-approve-runner.ts.
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /real-ingestion-runner(?:\.(?:ts|js|mts|cts|mjs))?$/.test(process.argv[1]);
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        "real-ingestion-runner · UNEXPECTED ERROR · " +
          sanitiseErr(err instanceof Error ? err.message : String(err)),
      );
      process.exit(99);
    });
}
