#!/usr/bin/env node
// run-supervisor.mjs
//
// Long-running Walker Supervisor. Boots the persistent workforce:
//   · loads the walker taxonomy
//   · loads config-driven walker instances
//   · plans the fleet (region-sharded for Tier A)
//   · enqueues jobs
//   · runs the supervisor tick loop forever until SIGINT/SIGTERM
//   · gracefully drains on shutdown
//
// This is the entry point that makes "NEX walks Indonesia 24/7"
// literal. Deploy as a Windows service / systemd unit / pm2 process.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

// System A isolation gate · same pattern as run-outer-watchdog.mjs. If this
// supervisor is invoked directly (not via the outer watchdog), we still
// substitute NEX_TAXONOMY_POSTGRES_URL into NEX_POSTGRES_URL so the child
// tsx process never sees the production NEX URL.
if (existsSync(path.join(repoRoot, ".env.local"))) {
  for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const TAX_URL = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!TAX_URL || TAX_URL.trim().length === 0) {
  console.error(
    "[supervisor] FAIL-CLOSED · NEX_TAXONOMY_POSTGRES_URL is not set · " +
    "System A refuses to boot pointed at the production NEX database.",
  );
  process.exit(2);
}
const SYSTEM_A_ENV = { ...process.env, NEX_POSTGRES_URL: TAX_URL };

if (!process.env.__SUPERVISOR_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...SYSTEM_A_ENV, __SUPERVISOR_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { WorkforceRegistry } = await import("../../src/lib/nex/indonesia/workforce/registry.ts");
  const { runSupervisor } = await import("../../src/lib/nex/indonesia/workforce/supervisor.ts");
  const { planFleet } = await import("../../src/lib/nex/indonesia/workforce/fleet-planner.ts");
  const { buildReport } = await import("../../src/lib/nex/indonesia/workforce/reporter.ts");
  const { listAllWalkerSpecs } = await import("../../src/lib/nex/indonesia/walkers/taxonomy.ts");
  const { loadConfigWalkers } = await import("../../src/lib/nex/indonesia/walkers/config-walker.ts");
  const { createCuratedSourceWalker } = await import("../../src/lib/nex/indonesia/walkers/source-curated.ts");
  const { publishEnrichedRecords, publishEntitiesDirect } = await import("../../src/lib/nex/indonesia/workforce/publish-corpus.ts");
  const { createLiveSourceWorker, consumeLiveSourceEntities } = await import("../../src/lib/nex/indonesia/workforce/live-source-adapter.ts");
  const { createBmkgEarthquakeConnector } = await import("../../src/lib/nex/indonesia/live/bmkg.ts");
  const { createOsmAccommodationConnector } = await import("../../src/lib/nex/indonesia/live/osm-overpass.ts");
  const { BudgetRegistry, DEFAULT_BUDGETS } = await import("../../src/lib/nex/indonesia/live/budget.ts");

  const argv = process.argv.slice(2);
  const oneShot = argv.includes("--once");
  const intervalMs = Number(argv.find((a) => a.startsWith("--interval="))?.split("=")[1] ?? 5000);
  const durationSec = Number(argv.find((a) => a.startsWith("--duration="))?.split("=")[1] ?? 0);

  console.log("\nNEX WALKER SUPERVISOR · starting");

  const registry = new WorkforceRegistry();
  registry.updateSupervisorHeartbeat({ processStartedAt: new Date().toISOString() });
  const specs = listAllWalkerSpecs();
  const activeSpecs = specs.filter((s) => s.status === "active" || s.status === "mature");

  // Stage-D accounting fix (Philip 2026-08-31) · a persistent
  // BudgetRegistry is passed to every live-source-adapter walker so
  // workforce polls show up in HQ's live-budgets.json alongside any
  // polls the standalone live-source runtime records. Same registry ·
  // one source of truth for poll counts.
  const budget = new BudgetRegistry();
  for (const [id, policy] of Object.entries(DEFAULT_BUDGETS)) {
    if (!budget.getPolicy(id)) budget.setPolicy(policy);
  }

  // Collect concrete walker instances: curated:seed (legacy) + all
  // config-driven walkers + Stage-C live BMKG walker (adapter over the
  // existing live-source connector · Tier A · env-gated by
  // NEX_LIVE_SOURCES_ENABLED via the connector's own httpFetch).
  const concrete = [
    createCuratedSourceWalker(),
    ...loadConfigWalkers(),
    createLiveSourceWorker(createBmkgEarthquakeConnector(), { walkerId: "walker.safety.earthquakes", budget }),
    // Stage 3 · Indonesian accommodation via OSM Overpass · Tier C ·
    // market=ID · env-gated by NEX_LIVE_SOURCES_ENABLED · daily cadence.
    createLiveSourceWorker(createOsmAccommodationConnector(), { walkerId: "walker.travel.accommodation", domain: "landmark" }),
  ];
  const walkersMap = new Map(concrete.map((w) => [w.id, w]));

  // Plan fleet · one worker per active spec (Tier-A region-sharded).
  const plan = planFleet(activeSpecs, concrete);
  console.log(`  · ${activeSpecs.length} active walker specs`);
  console.log(`  · ${concrete.length} concrete walker instances loaded`);
  console.log(`  · ${plan.length} fleet-planned worker slots`);

  // Enqueue jobs + register workers.
  for (const entry of plan) {
    registry.enqueueJob(entry.job);
    registry.registerWorker({ id: entry.workerId, walkerId: entry.walkerId, region: entry.region });
  }

  // Persist walker output to the canonical EntityRecord corpus.
  // Uses the publish-corpus adapter · idempotent · deduplicated by id ·
  // atomic write. This is the fix for the "supervisor throws records
  // into the console" defect noted in Phase 1 audit (Philip 2026-08-30).
  const runningTotals = { published: 0, updated: 0, unchanged: 0, skipped: 0 };
  const onPublish = async (walkerId, records) => {
    // Stage 3 · live-source walkers bypass the lossy RawFactChunk
    // pipeline · we publish the ORIGINAL EntityRecords the connector
    // produced (they already have geo, category, provenance intact).
    // consumeLiveSourceEntities returns [] for non-live-source walkers,
    // so config walkers still go through publishEnrichedRecords.
    const liveEntities = consumeLiveSourceEntities(walkerId);
    const r = liveEntities.length > 0
      ? publishEntitiesDirect(liveEntities)
      : publishEnrichedRecords(records);
    runningTotals.published += r.published;
    runningTotals.updated += r.updated;
    runningTotals.unchanged += r.unchanged;
    runningTotals.skipped += r.skipped.length;
    const via = liveEntities.length > 0 ? "direct" : "pipeline";
    console.log(
      `  [publish · ${via}] ${walkerId.padEnd(45)} attempted=${r.attempted} +${r.published} new · ${r.updated} updated · ${r.unchanged} unchanged · ${r.skipped.length} skipped · corpus ${r.corpusSizeBefore}→${r.corpusSizeAfter}`,
    );
    if (r.skipped.length > 0) {
      for (const s of r.skipped.slice(0, 3)) console.log(`      SKIP ${s.id} · ${s.reason}`);
    }
  };

  // Wire SIGINT / SIGTERM to abort.
  const controller = new AbortController();
  const shutdown = (sig) => {
    console.log(`\n[supervisor] ${sig} received · draining ...`);
    controller.abort();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  // Duration guard for one-shot / bounded runs.
  if (durationSec > 0) {
    setTimeout(() => shutdown(`duration:${durationSec}s`), durationSec * 1000);
  }

  if (oneShot) {
    const { supervisorTick } = await import("../../src/lib/nex/indonesia/workforce/supervisor.ts");
    const report = await supervisorTick({ registry, walkers: walkersMap, onPublish, taxonomySpecs: specs });
    console.log("\nONE-SHOT TICK REPORT");
    console.log(JSON.stringify(report, null, 2));
    console.log("\nCORPUS PERSIST TOTALS · ", JSON.stringify(runningTotals));
    const hq = buildReport(registry);
    console.log("\nHQ VIEW");
    printReport(hq);
    return;
  }

  // Feed taxonomy specs so the supervisor can regenerate the queue
  // when it empties — the "never permanently idle" guarantee.
  await runSupervisor({
    registry, walkers: walkersMap, onPublish,
    taxonomySpecs: specs,
    intervalMs,
    signal: controller.signal,
    onTick: (r) => {
      if (r.publishedRecordsThisTick > 0 || r.restarted.length > 0 || r.reaped.length > 0 || r.escalated.length > 0 || r.regenerated.length > 0) {
        console.log(`[tick ${r.tickAt}] cycled=${r.workersCycled} published=${r.publishedRecordsThisTick} reaped=${r.reaped.length} restarted=${r.restarted.length} escalated=${r.escalated.length} regen=${r.regenerated.length}`);
      }
    },
  });

  console.log("\n[supervisor] drained · exiting");
  const finalHq = buildReport(registry);
  printReport(finalHq);
}

function printReport(r) {
  console.log(`\nTAKEN AT ${r.takenAt}`);
  console.log(`WORKERS ${r.totals.workers} · records today ${r.totals.recordsToday}`);
  console.log(`BY STATE ${Object.entries(r.totals.byState).map(([s, n]) => `${s}:${n}`).join(" · ")}`);
  console.log(`LAST PUBLISH ${r.totals.lastPublishAt ?? "never"}`);
  console.log(`\nBY BRANCH`);
  for (const b of r.byBranch) {
    const bar = "🟢".repeat(b.healthy) + "🟡".repeat(b.degraded) + "🔴".repeat(b.dead);
    console.log(`  ${b.branch.padEnd(14)} ${b.healthy}/${b.workers} healthy · ${bar}`);
  }
  if (r.recentIncidents.length > 0) {
    console.log(`\nRECENT INCIDENTS`);
    for (const i of r.recentIncidents) {
      console.log(`  ⚠ ${i.workerId.padEnd(48)} ${i.state.padEnd(10)} since ${i.since} · ${i.reason ?? ""}`);
    }
  }
  if (r.openBreakers.length > 0) {
    console.log(`\nOPEN CIRCUIT BREAKERS`);
    for (const b of r.openBreakers) console.log(`  🔴 ${b.sourceKey.padEnd(40)} state=${b.state} failures=${b.failures} nextProbe=${b.nextProbeAt}`);
  }
  console.log(`\nDEAD LETTER · ${r.deadLetterCount} entries`);
}
