// scripts/nex-canonical/_vertical-ingestion-runner.ts
//
// NEX Directory · Verticals agent · generic CLI entry for the four
// non-food verticals (accommodation, service, mp_seller, transport).
//
// Picks the right sealed source adapter based on --vertical= and
// delegates to _vertical-ingestion-core.ts for the actual discovery-
// only run.
//
// This script is invoked by the per-vertical .mjs wrapper scripts
// (_ingest-accommodation.mjs etc). It is NOT meant to be a drop-in
// replacement for the sealed food runner; it is a verticals-agent
// utility.
//
// CLI
//   tsx scripts/nex-canonical/_vertical-ingestion-runner.ts \
//     --vertical=<accommodation|service|mp_seller|transport> \
//     --limit=<n>                     (required · operator cap)
//     --generation-run-id=<id>        (required)
//     --pending-queue=<path>          (required)
//     --decision-log=<path>           (required)
//     --checkpoint-log=<path>         (required)
//     [--batch-size=<n>]              (optional · default 10)
//     [--max-batches=<n>]             (optional · default 100)
//     [--dry-run]                     (optional · probe only, no candidates emitted)
//
// EXIT
//   0 · runner_completed (or dry-run completed)
//   1 · preflight (env / cli args) refused
//   2 · fingerprint mismatch
//   3 · downstream not-permitted (sealed logic error)
//  99 · unexpected error (sanitised)

import * as fs from "node:fs/promises";
import {
  runVerticalIngestion,
  type VerticalIngestionIO,
  type VerticalIngestionConfig,
  type VerticalSourceFactory,
} from "./_vertical-ingestion-core";
import { createLegacyAccommodationBusinessSource } from "./source-legacy-accommodation-business";
import { createLegacyServiceBusinessSource } from "./source-legacy-service-business";
import { createLegacyMpSellerSource } from "./source-legacy-mp-seller";
import { createLegacyTransportSource } from "./source-legacy-transport";

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
    if (u.username.length > 0) env.NEX_CANONICAL_PG_USER = decodeURIComponent(u.username);
    if (u.password.length > 0) env.NEX_CANONICAL_PG_PASSWORD = decodeURIComponent(u.password);
    if (!env.NEX_CANONICAL_PG_SSL) env.NEX_CANONICAL_PG_SSL = "false";
  } catch {
    /* fail-closed · adapter config will error out */
  }
}

function readArg(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const a of argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return undefined;
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

type VerticalName = "accommodation" | "service" | "mp_seller" | "transport";

const SOURCE_FACTORIES: Record<VerticalName, VerticalSourceFactory> = {
  accommodation: (deps) =>
    createLegacyAccommodationBusinessSource({
      session_factory: deps.session_factory,
      config: {
        generationRunId: deps.generationRunId,
        nowIso: deps.nowIso,
        batchSize: deps.batchSize,
      },
    }),
  service: (deps) =>
    createLegacyServiceBusinessSource({
      session_factory: deps.session_factory,
      config: {
        generationRunId: deps.generationRunId,
        nowIso: deps.nowIso,
        batchSize: deps.batchSize,
      },
    }),
  mp_seller: (deps) =>
    createLegacyMpSellerSource({
      session_factory: deps.session_factory,
      config: {
        generationRunId: deps.generationRunId,
        nowIso: deps.nowIso,
        batchSize: deps.batchSize,
      },
    }),
  transport: (deps) =>
    createLegacyTransportSource({
      session_factory: deps.session_factory,
      config: {
        generationRunId: deps.generationRunId,
        nowIso: deps.nowIso,
        batchSize: deps.batchSize,
      },
    }),
};

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
  const slash = path.lastIndexOf("/");
  const backslash = path.lastIndexOf("\\");
  const sep = Math.max(slash, backslash);
  if (sep > 0) {
    const dir = path.slice(0, sep);
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.appendFile(path, line + "\n", "utf8");
}

function buildFsIO(env: NodeJS.ProcessEnv): VerticalIngestionIO {
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

async function main(): Promise<number> {
  const rest = process.argv.slice(2);
  const verticalRaw = readArg(rest, "vertical") ?? "";
  if (!(verticalRaw in SOURCE_FACTORIES)) {
    // eslint-disable-next-line no-console
    console.error(
      `_vertical-ingestion-runner · missing/invalid --vertical= (got "${verticalRaw}") · expected one of: ${Object.keys(SOURCE_FACTORIES).join(", ")}`,
    );
    return 1;
  }
  const vertical = verticalRaw as VerticalName;

  const limitRaw = readArg(rest, "limit");
  const limit = limitRaw === undefined ? 100 : Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    // eslint-disable-next-line no-console
    console.error(`_vertical-ingestion-runner · --limit must be positive integer · got "${limitRaw}"`);
    return 1;
  }

  const generationRunId =
    readArg(rest, "generation-run-id") ??
    `verticals-${vertical}-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  const pendingQueuePath = readArg(rest, "pending-queue");
  const decisionLogPath = readArg(rest, "decision-log");
  const checkpointLogPath = readArg(rest, "checkpoint-log");
  const dryRun = hasFlag(rest, "dry-run");

  if (!dryRun) {
    if (!pendingQueuePath || !decisionLogPath || !checkpointLogPath) {
      // eslint-disable-next-line no-console
      console.error(
        `_vertical-ingestion-runner · live run requires --pending-queue, --decision-log, --checkpoint-log`,
      );
      return 1;
    }
  }

  const batchSizeRaw = readArg(rest, "batch-size");
  const batchSize = batchSizeRaw === undefined ? 10 : Number.parseInt(batchSizeRaw, 10);
  const maxBatchesRaw = readArg(rest, "max-batches");
  const maxBatches = maxBatchesRaw === undefined ? 100 : Number.parseInt(maxBatchesRaw, 10);

  deriveSplitCredsFromUrlIfNeeded(process.env);

  const io = buildFsIO(process.env);

  const config: VerticalIngestionConfig = {
    country: "ID",
    pendingQueuePath: pendingQueuePath ?? "/dev/null",
    decisionLogPath: decisionLogPath ?? "/dev/null",
    checkpointLogPath: checkpointLogPath ?? "/dev/null",
    generationRunId,
    batchSize,
    maxBatchesPerSource: maxBatches,
    maxCandidatesPerSource: limit,
    verticalLabel: vertical,
  };

  // eslint-disable-next-line no-console
  console.log(`=== _vertical-ingestion-runner · vertical=${vertical} · dry_run=${dryRun} ===`);
  // eslint-disable-next-line no-console
  console.log(
    `cap=${limit} · batchSize=${batchSize} · maxBatches=${maxBatches} · generation_run_id=${generationRunId}`,
  );
  if (!dryRun) {
    // eslint-disable-next-line no-console
    console.log(`pending=${pendingQueuePath} · decisions=${decisionLogPath} · checkpoints=${checkpointLogPath}`);
  }

  const report = await runVerticalIngestion({
    config,
    io,
    sourceFactory: SOURCE_FACTORIES[vertical],
    dryRun,
  });

  // eslint-disable-next-line no-console
  console.log("=== report ===");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  switch (report.stop_reason) {
    case "runner_completed":
      return 0;
    case "runner_cap_reached":
      return 0;
    case "preflight_env_missing":
      return 1;
    case "preflight_fingerprint_mismatch":
      return 2;
    case "unexpected_downstream_called":
      return 3;
    default:
      return 99;
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /_vertical-ingestion-runner(?:\.(?:ts|js|mts|cts|mjs))?$/.test(process.argv[1]);

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        "_vertical-ingestion-runner · UNEXPECTED ERROR · " +
          sanitiseErr(err instanceof Error ? err.message : String(err)),
      );
      process.exit(99);
    });
}
