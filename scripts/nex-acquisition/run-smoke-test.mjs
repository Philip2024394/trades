#!/usr/bin/env node
// NEX Universal Acquisition Engine · CLI · SMOKE TEST entry point.
//
// Runs one small controlled acquisition pass for a given vertical/city
// against the smoke-test bbox defined in the config. Outreach hard-noop.
// Dry-run by default (no DB inserts) — pass --apply to persist.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-acquisition/run-smoke-test.mjs
//     [--vertical=food] [--city=Yogyakarta] [--apply]
//
// Philip 2026-08-21: CLI mode first · verify discovery+dedupe+contact+
// provenance+no-outreach · then full sweep · only after that turn into
// 24/7 scheduled worker.

import pg from "pg";
import { runAgent } from "./engine.mjs";
import { printHumanReport } from "./report.mjs";
import { foodYogyakartaConfig } from "./configs/food-yogyakarta.mjs";

const args = process.argv.slice(2);
const vertical = args.find((a) => a.startsWith("--vertical="))?.split("=")[1] ?? "food";
const city = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "Yogyakarta";
const bboxName = args.find((a) => a.startsWith("--bbox="))?.split("=")[1] ?? null;
const apply = args.includes("--apply");

const CONFIG_REGISTRY = {
  "food:Yogyakarta": foodYogyakartaConfig,
};

const config = CONFIG_REGISTRY[`${vertical}:${city}`];
if (!config) {
  console.error(`No config registered for ${vertical}:${city}`);
  console.error(`Registered: ${Object.keys(CONFIG_REGISTRY).join(" · ")}`);
  process.exit(1);
}

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const pool = new pg.Pool({ connectionString: pgUrl });

const bbox = bboxName && config.smokeBboxes?.[bboxName]
  ? config.smokeBboxes[bboxName]
  : config.smokeBbox;
const jobBboxTag = bboxName ?? "default";

try {
  const audit = await runAgent(pool, config, {
    smokeMode: true,
    dryRun: !apply,
    bbox,
    jobId: `${vertical}-${city}-smoke-${jobBboxTag}-${new Date().toISOString().replace(/[:.]/g, "-")}`.toLowerCase(),
  });
  printHumanReport(audit);
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
} finally {
  await pool.end();
}
