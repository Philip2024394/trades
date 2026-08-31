#!/usr/bin/env node
// burn-in-bmkg.mjs · operator entry point for burning in a live BMKG
// connector.
//
// Two modes:
//   · simulated  (default) · runs against a scripted mock with
//     occasional failures + duplicates · safe · no network
//   · live       · uses the real connector · requires
//     NEX_LIVE_SOURCES_ENABLED=1 · hits data.bmkg.go.id
//
// Usage:
//   node scripts/live/burn-in-bmkg.mjs                       # simulated · 20s
//   node scripts/live/burn-in-bmkg.mjs --duration=60         # simulated · 60s
//   NEX_LIVE_SOURCES_ENABLED=1 node scripts/live/burn-in-bmkg.mjs --live --duration=300

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__BURNIN_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __BURNIN_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { createBmkgEarthquakeConnector } = await import("../../src/lib/nex/indonesia/live/bmkg.ts");
  const { BudgetRegistry, DEFAULT_BUDGETS } = await import("../../src/lib/nex/indonesia/live/budget.ts");
  const { runBurnIn } = await import("../../src/lib/nex/indonesia/live/burn-in.ts");

  const argv = process.argv.slice(2);
  const durationSec = Number(argv.find((a) => a.startsWith("--duration="))?.split("=")[1] ?? 20);
  const live = argv.includes("--live");
  const persistBudget = argv.includes("--persist-budget");
  const tickMs = Number(argv.find((a) => a.startsWith("--tick="))?.split("=")[1] ?? (live ? 60_000 : 1_000));

  console.log(`\nNEX BMKG earthquake burn-in`);
  console.log(`  mode:        ${live ? "LIVE (real HTTP)" : "SIMULATED (mock)"}`);
  console.log(`  duration:    ${durationSec}s`);
  console.log(`  tick every:  ${tickMs}ms`);
  console.log(`  budget:      ${persistBudget ? "PERSISTED (visible to HQ)" : "in-memory only (isolated from HQ)"}`);
  if (live && process.env.NEX_LIVE_SOURCES_ENABLED !== "1") {
    console.log(`  ⚠️  NEX_LIVE_SOURCES_ENABLED is not set · live mode will return "disabled" errors`);
  }

  const connector = createBmkgEarthquakeConnector();
  const budget = persistBudget ? new BudgetRegistry() : new BudgetRegistry({ inMemoryOnly: true });
  budget.setPolicy(DEFAULT_BUDGETS[connector.config.id]);

  const baseFixture = {
    Infogempa: { gempa: {
      Tanggal: "30 Aug 2026", Jam: "12:34:56 WIB",
      DateTime: "2026-08-30T05:34:56+00:00",
      Magnitude: "5.6", Kedalaman: "10 km",
      Wilayah: "35 km Barat Daya Denpasar",
      Coordinates: "-8.85,115.05",
    } },
  };
  const simulator = live ? undefined : (tickIndex) => {
    if (tickIndex % 8 === 0) return baseFixture;
    if (tickIndex % 15 === 5) return { error: true, reason: "http_status", detail: "503 upstream", status: 503 };
    return {
      Infogempa: { gempa: {
        ...baseFixture.Infogempa.gempa,
        Jam: `12:34:${String(tickIndex % 60).padStart(2, "0")} WIB`,
        Magnitude: (3 + (tickIndex % 5)).toFixed(1),
      } },
    };
  };

  let ticksSeen = 0;
  const report = await runBurnIn({
    connector, budget,
    durationMs: durationSec * 1000,
    tickIntervalMs: tickMs,
    simulator,
    onTick: (e) => {
      ticksSeen++;
      if (ticksSeen % 10 === 0 || !e.ok || e.skippedByBudget) {
        const flag = e.skippedByBudget ? "🚦" : e.ok ? "✓" : "✗";
        console.log(`  ${flag} tick ${e.tickIndex.toString().padStart(4)} · ${e.at.slice(11, 19)} · lat=${e.latencyMs}ms · +${e.entities} entities · dedup=${e.deduped}${e.reason ? " · " + e.reason : ""}`);
      }
    },
  });

  console.log(`\n═════════════ BURN-IN REPORT ═════════════`);
  console.log(`Connector       ${report.connectorId}`);
  console.log(`Duration        ${(report.durationMs / 1000).toFixed(1)}s`);
  console.log(`Ticks total     ${report.ticksTotal}`);
  console.log(`  succeeded     ${report.ticksSucceeded}`);
  console.log(`  failed        ${report.ticksFailed}`);
  console.log(`  budget-skip   ${report.ticksSkippedByBudget}`);
  console.log(`Entities        ${report.entitiesPublished} published · ${report.entitiesDeduped} deduped`);
  console.log(`Latency (ms)    min=${report.latency.min} · p50=${report.latency.p50} · p95=${report.latency.p95} · max=${report.latency.max} · avg=${report.latency.avg}`);
  console.log(`Longest run of consecutive failures: ${report.longestConsecutiveFailures}`);
  if (Object.keys(report.failureReasons).length > 0) {
    console.log(`Failure reasons: ${Object.entries(report.failureReasons).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
  }
  if (report.samplePublished.length > 0) {
    console.log(`\nSample retained EntityRecords (last ${report.samplePublished.length}):`);
    for (const e of report.samplePublished) {
      const prov = e.provenance?.[0];
      console.log(`  · id=${e.id}`);
      console.log(`    name=${e.name}`);
      console.log(`    kind=${e.kind} · category=${e.category ?? "-"}`);
      console.log(`    geo=${e.geo ? `${e.geo.lat},${e.geo.lng}` : "-"}`);
      console.log(`    attributes=${JSON.stringify(e.attributes ?? {})}`);
      console.log(`    provenance=${prov?.sourceName}/${prov?.sourceTier} · observedAt=${prov?.observedAt}`);
      console.log(`    freshness=${e.freshness?.policy} · verifiedAt=${e.freshness?.lastVerifiedAt}`);
    }
  } else {
    console.log(`\nNo EntityRecords retained (all dedup-suppressed or retention disabled).`);
  }

  console.log(`\nVERDICT · ${report.verdict.toUpperCase()}`);
  console.log(`═══════════════════════════════════════════`);

  const outDir = path.join(repoRoot, "data/indonesia");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `burn-in-bmkg-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  await writeFile(outFile, JSON.stringify(report, null, 2) + "\n");
  console.log(`\n📌 Report saved → ${path.relative(repoRoot, outFile)}`);
}
