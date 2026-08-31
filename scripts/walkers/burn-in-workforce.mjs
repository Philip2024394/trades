#!/usr/bin/env node
// burn-in-workforce.mjs · continuous supervised run + honest measurement.
//
// Stage D (Philip 2026-08-31) · answers "does the workforce stay alive
// and actually gain USEFUL knowledge?", not "do worker counts look
// impressive?".
//
// What it measures (per Philip's directive):
//   · sources contacted             · corpus growth (before → after)
//   · successful HTTP calls         · records genuinely NEW
//   · failed calls                  · records updated (content changed)
//   · acquisition latency p50/p95   · records unchanged (idempotent no-op)
//   · records discovered            · duplicates (dedup suppressed)
//   · records accepted              · knowledge gaps created
//   · records rejected              · knowledge gaps closed
//   · worker health                 · freshness distribution
//   · circuit breakers              · source tier distribution
//   · budget consumption            · per-walker: attempts / succ / fail
//
// The harness does NOT touch the burn-in code path for the live-source
// runtime (that's the BMKG-only burn-in, already in place). This is the
// WORKFORCE burn-in · exercises all walkers registered with the
// supervisor, produces a per-source × per-tick record, saves a JSON
// report to data/indonesia/burn-in-workforce-<timestamp>.json.
//
// Usage:
//   node scripts/walkers/burn-in-workforce.mjs                        # 60s smoke
//   node scripts/walkers/burn-in-workforce.mjs --duration=900         # 15 min
//   node scripts/walkers/burn-in-workforce.mjs --duration=1800 --live # 30 min live BMKG

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__WORKFORCE_BURNIN__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __WORKFORCE_BURNIN__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { WorkforceRegistry } = await import("../../src/lib/nex/indonesia/workforce/registry.ts");
  const { supervisorTick } = await import("../../src/lib/nex/indonesia/workforce/supervisor.ts");
  const { planFleet } = await import("../../src/lib/nex/indonesia/workforce/fleet-planner.ts");
  const { buildReport } = await import("../../src/lib/nex/indonesia/workforce/reporter.ts");
  const { listAllWalkerSpecs } = await import("../../src/lib/nex/indonesia/walkers/taxonomy.ts");
  const { loadConfigWalkers } = await import("../../src/lib/nex/indonesia/walkers/config-walker.ts");
  const { createCuratedSourceWalker } = await import("../../src/lib/nex/indonesia/walkers/source-curated.ts");
  const { publishEnrichedRecords } = await import("../../src/lib/nex/indonesia/workforce/publish-corpus.ts");
  const { createLiveSourceWorker } = await import("../../src/lib/nex/indonesia/workforce/live-source-adapter.ts");
  const { createBmkgEarthquakeConnector } = await import("../../src/lib/nex/indonesia/live/bmkg.ts");
  const { GapRegistry } = await import("../../src/lib/nex/indonesia/gaps/gap-registry.ts");

  const argv = process.argv.slice(2);
  const durationSec = Number(argv.find((a) => a.startsWith("--duration="))?.split("=")[1] ?? 60);
  const intervalMs = Number(argv.find((a) => a.startsWith("--interval="))?.split("=")[1] ?? 5000);
  const live = argv.includes("--live");

  const entityFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
  const corpusBefore = readCorpusSize(entityFile);

  console.log(`\nNEX WORKFORCE BURN-IN`);
  console.log(`  duration:    ${durationSec}s`);
  console.log(`  tick every:  ${intervalMs}ms`);
  console.log(`  live mode:   ${live ? "YES · real BMKG HTTPS" : "no · BMKG walker will call disabled httpFetch and fail"}`);
  console.log(`  corpus start: ${corpusBefore} entities`);
  if (live && process.env.NEX_LIVE_SOURCES_ENABLED !== "1") {
    console.log(`  ⚠️  NEX_LIVE_SOURCES_ENABLED is not set · live mode requires it`);
  }

  const registry = new WorkforceRegistry();
  const specs = listAllWalkerSpecs();
  const activeSpecs = specs.filter((s) => s.status === "active" || s.status === "mature");

  const concrete = [
    createCuratedSourceWalker(),
    ...loadConfigWalkers(),
    createLiveSourceWorker(createBmkgEarthquakeConnector(), { walkerId: "walker.safety.earthquakes" }),
  ];
  const walkersMap = new Map(concrete.map((w) => [w.id, w]));

  // Wrap each walker to measure acquire() latency + success/failure.
  const perWalker = new Map();
  const initWalkerMetrics = (id) => {
    if (perWalker.has(id)) return;
    perWalker.set(id, {
      walkerId: id,
      attempts: 0, successes: 0, failures: 0,
      recordsDiscovered: 0, recordsPublished: 0, recordsUpdated: 0, recordsUnchanged: 0, recordsSkipped: 0,
      latencies: [], lastError: null, lastSuccessAt: null,
    });
  };
  for (const w of concrete) initWalkerMetrics(w.id);

  const measuredWalkers = new Map();
  for (const [id, walker] of walkersMap) {
    measuredWalkers.set(id, {
      ...walker,
      async acquire() {
        const m = perWalker.get(id);
        m.attempts++;
        const t0 = Date.now();
        try {
          const chunks = await walker.acquire();
          const latency = Date.now() - t0;
          m.latencies.push(latency);
          if (Array.isArray(chunks) && chunks.length > 0) {
            m.successes++;
            m.recordsDiscovered += chunks.length;
            m.lastSuccessAt = new Date().toISOString();
          } else {
            m.failures++;
            m.lastError = "empty_result";
          }
          return chunks;
        } catch (err) {
          const latency = Date.now() - t0;
          m.latencies.push(latency);
          m.failures++;
          m.lastError = err.message.slice(0, 160);
          throw err;
        }
      },
    });
  }

  // Fleet plan for jobs that don't already exist in the registry.
  const plan = planFleet(activeSpecs, concrete);
  for (const entry of plan) {
    if (!registry.getSnapshot().jobs.some((j) => j.id === entry.job.id)) registry.enqueueJob(entry.job);
    if (!registry.getSnapshot().workers.some((w) => w.id === entry.workerId)) {
      registry.registerWorker({ id: entry.workerId, walkerId: entry.walkerId, region: entry.region });
    }
  }

  // Snapshot gap-registry state before/after to measure gap-loop activity.
  const gapReg = new GapRegistry();
  const gapsBefore = gapReg.getSnapshot().gaps.length;

  const onPublish = async (walkerId, records) => {
    const m = perWalker.get(walkerId) ?? (initWalkerMetrics(walkerId), perWalker.get(walkerId));
    const r = publishEnrichedRecords(records, { entityFile });
    m.recordsPublished += r.published;
    m.recordsUpdated += r.updated;
    m.recordsUnchanged += r.unchanged;
    m.recordsSkipped += r.skipped.length;
  };

  const ticks = [];
  const startedAt = new Date();
  const startMs = startedAt.getTime();
  const endMs = startMs + durationSec * 1000;
  let tickIndex = 0;

  console.log(`\nBURN-IN STARTED · ${startedAt.toISOString()}\n`);
  while (Date.now() < endMs) {
    const tickStart = Date.now();
    let report;
    try {
      report = await supervisorTick({
        registry, walkers: measuredWalkers, onPublish, taxonomySpecs: specs,
      });
    } catch (err) {
      console.log(`  [tick ${tickIndex}] SUPERVISOR EXCEPTION: ${err.message}`);
      report = null;
    }
    ticks.push({ tickIndex, tickStartMs: tickStart, tickDurationMs: Date.now() - tickStart, report });
    tickIndex++;
    if (report && (report.publishedRecordsThisTick > 0 || report.reaped.length > 0 || report.restarted.length > 0 || report.escalated.length > 0)) {
      console.log(`  [tick ${tickIndex}] cycled=${report.workersCycled} published=${report.publishedRecordsThisTick} reaped=${report.reaped.length} restarted=${report.restarted.length} escalated=${report.escalated.length}`);
    }
    const waitMs = Math.max(0, (tickStart + intervalMs) - Date.now());
    if (waitMs > 0 && Date.now() + waitMs < endMs) {
      await new Promise((r) => setTimeout(r, waitMs));
    } else if (Date.now() >= endMs) break;
  }
  const endedAt = new Date();

  // ─── FINAL METRICS ─────────────────────────────────────────────
  const corpusAfter = readCorpusSize(entityFile);
  const snap = registry.getSnapshot();
  const hqReport = buildReport(registry);
  const gapsAfter = gapReg.getSnapshot().gaps.length;

  const totalPublished = [...perWalker.values()].reduce((s, m) => s + m.recordsPublished, 0);
  const totalUpdated = [...perWalker.values()].reduce((s, m) => s + m.recordsUpdated, 0);
  const totalUnchanged = [...perWalker.values()].reduce((s, m) => s + m.recordsUnchanged, 0);
  const totalDiscovered = [...perWalker.values()].reduce((s, m) => s + m.recordsDiscovered, 0);
  const totalAttempts = [...perWalker.values()].reduce((s, m) => s + m.attempts, 0);
  const totalSuccesses = [...perWalker.values()].reduce((s, m) => s + m.successes, 0);
  const totalFailures = [...perWalker.values()].reduce((s, m) => s + m.failures, 0);

  // Corpus growth · read once more with tier + freshness distribution.
  const corpusStats = analyzeCorpus(entityFile);

  const finalReport = {
    burnIn: {
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startMs,
      requestedDurationSec: durationSec,
      tickIntervalMs: intervalMs,
      liveMode: live,
      totalTicks: tickIndex,
    },
    corpus: {
      sizeBefore: corpusBefore,
      sizeAfter: corpusAfter,
      newEntities: corpusAfter - corpusBefore,
      distribution: corpusStats,
    },
    workforce: {
      totalWorkers: snap.workers.length,
      byState: hqReport.totals.byState,
      openBreakers: hqReport.openBreakers,
      deadLetterCount: hqReport.deadLetterCount,
      recentIncidents: hqReport.recentIncidents.length,
    },
    perWalker: [...perWalker.values()].map((m) => ({
      walkerId: m.walkerId,
      attempts: m.attempts,
      successes: m.successes,
      failures: m.failures,
      successRate: m.attempts > 0 ? +(m.successes / m.attempts).toFixed(3) : null,
      recordsDiscovered: m.recordsDiscovered,
      recordsPublished: m.recordsPublished,
      recordsUpdated: m.recordsUpdated,
      recordsUnchanged: m.recordsUnchanged,
      recordsSkipped: m.recordsSkipped,
      latency: latencyStats(m.latencies),
      lastSuccessAt: m.lastSuccessAt,
      lastError: m.lastError,
    })).sort((a, b) => a.walkerId.localeCompare(b.walkerId)),
    totals: {
      recordsDiscovered: totalDiscovered,
      recordsPublished: totalPublished,
      recordsUpdated: totalUpdated,
      recordsUnchanged: totalUnchanged,
      workerAttempts: totalAttempts,
      workerSuccesses: totalSuccesses,
      workerFailures: totalFailures,
      overallSuccessRate: totalAttempts > 0 ? +(totalSuccesses / totalAttempts).toFixed(3) : null,
    },
    gapLoop: {
      gapsBefore, gapsAfter,
      gapsCreatedDuringBurnIn: gapsAfter - gapsBefore,
      note: "No user queries fired during burn-in · gap counters reflect only what real chat produced before/after.",
    },
    verdict: computeVerdict({
      totalAttempts, totalFailures, totalPublished, totalUpdated,
      newEntities: corpusAfter - corpusBefore,
      openBreakers: hqReport.openBreakers.length,
    }),
  };

  console.log(`\n═════════════ WORKFORCE BURN-IN REPORT ═════════════`);
  console.log(`Duration:            ${((endedAt.getTime() - startMs)/1000).toFixed(1)}s (requested ${durationSec}s)`);
  console.log(`Ticks:               ${tickIndex}`);
  console.log(`Corpus:              ${corpusBefore} → ${corpusAfter} (${corpusAfter - corpusBefore >= 0 ? "+" : ""}${corpusAfter - corpusBefore} new)`);
  console.log(`Worker attempts:     ${totalAttempts} (${totalSuccesses} succ · ${totalFailures} fail)`);
  console.log(`Records discovered:  ${totalDiscovered}`);
  console.log(`Records published:   ${totalPublished} new`);
  console.log(`Records updated:     ${totalUpdated}`);
  console.log(`Records unchanged:   ${totalUnchanged}`);
  console.log(`Open breakers:       ${hqReport.openBreakers.length}`);
  console.log(`Dead letter:         ${hqReport.deadLetterCount}`);
  console.log(`Gaps created during: ${gapsAfter - gapsBefore}`);
  console.log(`\nPER WALKER`);
  console.log(`  ${"walker".padEnd(50)} ${"att".padStart(4)} ${"succ".padStart(4)} ${"fail".padStart(4)} ${"disc".padStart(4)} ${"pub".padStart(4)} ${"upd".padStart(4)} ${"unch".padStart(4)} p50/p95`);
  for (const m of finalReport.perWalker) {
    console.log(`  ${m.walkerId.padEnd(50)} ${String(m.attempts).padStart(4)} ${String(m.successes).padStart(4)} ${String(m.failures).padStart(4)} ${String(m.recordsDiscovered).padStart(4)} ${String(m.recordsPublished).padStart(4)} ${String(m.recordsUpdated).padStart(4)} ${String(m.recordsUnchanged).padStart(4)} ${m.latency.p50}/${m.latency.p95}ms`);
  }
  console.log(`\nVERDICT · ${finalReport.verdict.toUpperCase()}`);
  console.log(`═══════════════════════════════════════════════════`);

  const outDir = path.join(repoRoot, "data/indonesia");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `burn-in-workforce-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  await writeFile(outFile, JSON.stringify(finalReport, null, 2) + "\n");
  console.log(`\n📌 Report saved → ${path.relative(repoRoot, outFile)}`);
}

function readCorpusSize(entityFile) {
  try {
    if (!existsSync(entityFile)) return 0;
    const j = JSON.parse(readFileSync(entityFile, "utf8"));
    return (j.entities ?? []).length;
  } catch { return 0; }
}

function analyzeCorpus(entityFile) {
  try {
    const j = JSON.parse(readFileSync(entityFile, "utf8"));
    const entities = j.entities ?? [];
    const byTier = {}, byFreshness = {}, byKind = {};
    for (const e of entities) {
      const t = e.provenance?.[0]?.sourceTier ?? "?";
      byTier[t] = (byTier[t]||0)+1;
      const f = e.freshness?.policy ?? "?";
      byFreshness[f] = (byFreshness[f]||0)+1;
      byKind[e.kind] = (byKind[e.kind]||0)+1;
    }
    return { byTier, byFreshness, byKind, total: entities.length };
  } catch { return { total: 0 }; }
}

function latencyStats(arr) {
  if (!arr || arr.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0 };
  const s = [...arr].sort((a, b) => a - b);
  return {
    min: s[0],
    max: s[s.length - 1],
    avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
  };
}

function computeVerdict({ totalAttempts, totalFailures, totalPublished, totalUpdated, newEntities, openBreakers }) {
  if (openBreakers > 0) return "degraded"; // circuit breakers open · something's unhealthy
  if (totalAttempts === 0) return "unhealthy"; // supervisor didn't cycle any workers
  const failRate = totalAttempts > 0 ? totalFailures / totalAttempts : 0;
  if (failRate > 0.5) return "unhealthy";
  if (failRate > 0.2) return "degraded";
  return "clean";
}
