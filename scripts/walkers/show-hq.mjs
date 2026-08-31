#!/usr/bin/env node
// show-hq.mjs · NEX Indonesia Knowledge Machine · HQ command centre.
//
// Consolidated view of every layer:
//   · Workforce · workers by state, by branch, incidents, breakers
//   · Coverage  · 38-province × active-category matrix + pct
//   · Data      · records total, by lifecycle, by kind, by source tier
//   · Knowledge · records by branch, corpus size, provenance coverage
//
// This is the "we know what NEX knows" surface.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__HQ_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __HQ_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { WorkforceRegistry } = await import("../../src/lib/nex/indonesia/workforce/registry.ts");
  const { buildReport }        = await import("../../src/lib/nex/indonesia/workforce/reporter.ts");
  const { listAllRecords }     = await import("../../src/lib/nex/indonesia/knowledge.ts");
  const { listAllWalkerSpecs, BRANCH_LABELS } = await import("../../src/lib/nex/indonesia/walkers/taxonomy.ts");
  const { listProvinces, buildCoverageMatrix, summariseByProvince } = await import("../../src/lib/nex/indonesia/data/geo.ts");
  const { BudgetRegistry }     = await import("../../src/lib/nex/indonesia/live/budget.ts");
  const { GapRegistry }        = await import("../../src/lib/nex/indonesia/gaps/gap-registry.ts");
  const { analyseCorpus }      = await import("../../src/lib/nex/indonesia/data/dedupe-blocking.ts");
  const { readFileSync, readdirSync, existsSync } = await import("node:fs");

  const registry = new WorkforceRegistry();
  const workforce = buildReport(registry);
  const records = listAllRecords();
  const specs = listAllWalkerSpecs();
  const provinces = listProvinces();
  const activeSpecs = specs.filter((s) => s.status === "active" || s.status === "mature");
  const activeCategories = activeSpecs.map((s) => s.id);

  // Coverage matrix reads the CANONICAL EntityRecord corpus (post-
  // migration + seed) · falls back to legacy records where an entity
  // has no geo.province.
  const entFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
  const entityCorpus = existsSync(entFile) ? JSON.parse(readFileSync(entFile, "utf8")) : { entities: [] };
  const entities = entityCorpus.entities ?? [];

  const obs = [];
  // Entity-corpus contribution · uses geo.province slug directly.
  for (const e of entities) {
    if (!e.geo?.province) continue;
    // Category derived from `category` prefix (e.g. "safety.earthquake" → "safety"),
    // falls back to entity kind so seed places register under "geo".
    const category = e.category ? e.category.split(".")[0] : e.kind;
    obs.push({ province: e.geo.province, category, recordCount: 1, lastAcquiredAt: e.provenance?.[0]?.observedAt ?? e.freshness?.lastVerifiedAt });
  }
  // Legacy-record contribution · resolves display name → province slug.
  for (const rec of records) {
    const p = provinces.find((pp) => pp.name === rec.region);
    if (!p) continue;
    const category = rec.walker_id || (rec.topic?.split(".")[0] ?? "unknown");
    obs.push({ province: p.slug, category, recordCount: 1, lastAcquiredAt: rec.acquired_at ?? rec.last_verified });
  }

  // Category axis · union of active-walker categories AND every
  // category we actually observe in the corpus. Prevents the matrix
  // ignoring real data that doesn't have a walker spec yet (e.g. "geo").
  const observedCategories = [...new Set(obs.map((o) => o.category))];
  const matrixCategories = [...new Set([...(activeCategories.length > 0 ? activeCategories : []), ...observedCategories])];
  const matrix = buildCoverageMatrix(obs, matrixCategories.length > 0 ? matrixCategories : ["destinations", "food"]);
  const provinceSummary = summariseByProvince(matrix);

  // ─── PRINT ─────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  NEX INDONESIA KNOWLEDGE MACHINE · HQ COMMAND CENTRE`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`═══════════════════════════════════════════════════════════════════`);

  console.log(`\n▶ WORKFORCE`);
  console.log(`  Workers total: ${workforce.totals.workers}`);
  for (const [s, n] of Object.entries(workforce.totals.byState)) if (n > 0) console.log(`    ${s.padEnd(10)} ${n}`);
  console.log(`  Records today: ${workforce.totals.recordsToday}`);
  console.log(`  Last publish : ${workforce.totals.lastPublishAt ?? "(none yet)"}`);
  if (workforce.recentIncidents.length > 0) {
    console.log(`  Recent incidents: ${workforce.recentIncidents.length}`);
    for (const i of workforce.recentIncidents.slice(0, 3)) {
      console.log(`    · ${i.workerId} · ${i.state} · ${i.reason ?? ""}`);
    }
  }
  if (workforce.openBreakers.length > 0) console.log(`  🔴 Open breakers: ${workforce.openBreakers.length}`);
  console.log(`  Dead letter  : ${workforce.deadLetterCount} entries`);

  console.log(`\n▶ COVERAGE · ${matrix.totals.provinces} provinces × ${matrix.totals.categories} active categories`);
  console.log(`  Covered      ${String(matrix.totals.covered).padStart(4)}  ${bar(matrix.totals.covered,  matrix.cells.length)}`);
  console.log(`  Partial      ${String(matrix.totals.partial).padStart(4)}  ${bar(matrix.totals.partial,  matrix.cells.length)}`);
  console.log(`  Not covered  ${String(matrix.totals.notCovered).padStart(4)}  ${bar(matrix.totals.notCovered, matrix.cells.length)}`);
  console.log(`  Coverage %   ${matrix.totals.coveragePct}%`);

  console.log(`\n  BY PROVINCE`);
  const grouped = groupBy(provinceSummary, (p) => p.islandName);
  for (const [island, entries] of Object.entries(grouped)) {
    const totalCov = entries.reduce((s, e) => s + e.covered, 0);
    const totalMax = entries.reduce((s, e) => s + e.total, 0);
    console.log(`    ${island.padEnd(18)} ${totalCov}/${totalMax}`);
    for (const e of entries) {
      const pct = String(e.pct).padStart(3);
      const icon = e.pct >= 80 ? "🟢" : e.pct > 0 ? "🟡" : "⚪";
      console.log(`      ${icon} ${e.province.padEnd(32)} ${pct}% (${e.covered}/${e.total})`);
    }
  }

  console.log(`\n▶ KNOWLEDGE`);
  console.log(`  Canonical entities (EntityRecord corpus): ${entities.length}`);
  const entityByKind = entities.reduce((acc, e) => (acc[e.kind] = (acc[e.kind] ?? 0) + 1, acc), {});
  console.log(`    by kind:      ${Object.entries(entityByKind).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
  const entitiesWithGeo = entities.filter((e) => e.geo?.province).length;
  console.log(`    with geo.province: ${entitiesWithGeo} / ${entities.length}`);
  const hiQuality = entities.filter((e) => (e.quality?.overall ?? 0) >= 0.7).length;
  console.log(`    quality ≥ 0.7:     ${hiQuality} / ${entities.length}`);
  // Market-scoped view · Philip 2026-08-31 doctrine.
  const byMarket = {};
  let noMarket = 0;
  for (const e of entities) {
    const m = e.provenance?.[0]?.market;
    if (!m) { noMarket++; continue; }
    byMarket[m] = (byMarket[m] || 0) + 1;
  }
  const marketSummary = Object.entries(byMarket).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}:${n}`).join(" · ");
  const noMarketFlag = noMarket > 0 ? ` · 🔴 ${noMarket} missing market` : ` · ✅ 0 missing`;
  console.log(`    by market:         ${marketSummary}${noMarketFlag}`);
  console.log(`  Legacy KnowledgeRecord store: ${records.length}`);
  const byStability = groupCount(records, (r) => r.stability);
  console.log(`  By stability:  ${Object.entries(byStability).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
  const byLang = groupCount(records, (r) => r.language ?? "?");
  console.log(`  By language:   ${Object.entries(byLang).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
  const byWalker = groupCount(records.filter((r) => r.walker_id), (r) => r.walker_id ?? "?");
  console.log(`  Records with walker_id: ${Object.values(byWalker).reduce((a, b) => a + b, 0)} / ${records.length}`);
  console.log(`  Records with provenance (source set): ${records.filter((r) => r.source).length} / ${records.length}`);

  console.log(`\n▶ WALKER TAXONOMY`);
  const byStatus = groupCount(specs, (s) => s.status);
  console.log(`  Total: ${specs.length}`);
  for (const [k, v] of Object.entries(byStatus)) console.log(`    ${k.padEnd(15)} ${v}`);

  console.log(`\n▶ NEXT PRIORITIES (Tier-A planned)`);
  const tierA = specs.filter((s) => s.priority === 1 && s.status === "planned");
  for (const s of tierA.slice(0, 10)) {
    console.log(`    ⚪ ${s.id.padEnd(52)} · ${s.purpose.slice(0, 60)}`);
  }
  if (tierA.length > 10) console.log(`    ... +${tierA.length - 10} more Tier-A planned`);

  // ─── LIVE SOURCES ────────────────────────────────────────────────
  console.log(`\n▶ LIVE SOURCES`);
  const liveGate = process.env.NEX_LIVE_SOURCES_ENABLED === "1";
  console.log(`  Live-source HTTP gate: ${liveGate ? "🟢 ENABLED" : "⚪ disabled (NEX_LIVE_SOURCES_ENABLED not set)"}`);

  // Latest burn-in reports (per connector · deterministic prefix).
  const dataDir = path.join(repoRoot, "data/indonesia");
  const burnInFiles = existsSync(dataDir)
    ? readdirSync(dataDir).filter((f) => f.startsWith("burn-in-") && f.endsWith(".json"))
    : [];
  const burnInsByConnector = new Map();
  for (const f of burnInFiles) {
    try {
      const payload = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
      const cid = payload.connectorId ?? f.split("-").slice(2, -1).join("-");
      const existing = burnInsByConnector.get(cid);
      if (!existing || (payload.endedAt ?? "") > (existing.endedAt ?? "")) {
        burnInsByConnector.set(cid, payload);
      }
    } catch { /* ignore malformed */ }
  }
  if (burnInsByConnector.size === 0) {
    console.log(`  No burn-in reports recorded yet. Run: npm run live:burn-in:bmkg`);
  } else {
    console.log(`  Connector                       Verdict    Ticks  Ent  Latp95  LastRun`);
    for (const [cid, r] of [...burnInsByConnector].sort()) {
      const verdict = (r.verdict ?? "?").toUpperCase();
      const icon = verdict === "CLEAN" ? "🟢" : verdict === "DEGRADED" ? "🟡" : "🔴";
      const ticks = String(r.ticksTotal ?? "?").padStart(5);
      const ent = String(r.entitiesPublished ?? "?").padStart(4);
      const p95 = String(r.latency?.p95 ?? "?").padStart(5);
      const when = (r.endedAt ?? "?").slice(0, 16);
      console.log(`  ${icon} ${cid.padEnd(30)} ${verdict.padEnd(9)} ${ticks} ${ent} ${p95}ms  ${when}`);
    }
  }
  // Retired-but-known connectors · honest status so operator sees
  // gaps in real-world coverage without pretending they're active.
  console.log(`  🟡 live.magma.volcano             RETIRED   no viable public JSON API · JWT-gated · awaiting credentials`);
  console.log(`  🟡 live.bpjph.halal               RETIRED   no viable public API yet · awaiting authoritative access`);

  // ─── TSUNAMI SIGNAL (derived from BMKG earthquake · fix (a)) ────
  console.log(`\n▶ TSUNAMI SIGNAL (from BMKG earthquake data)`);
  const quakeReport = burnInsByConnector.get("live.bmkg.earthquake");
  const samples = quakeReport?.samplePublished ?? [];
  const quakes = samples.filter((s) => s.category === "safety.earthquake");
  if (quakes.length === 0) {
    console.log(`  No earthquake samples retained yet. Run a live BMKG burn-in first.`);
  } else {
    const latest = quakes[quakes.length - 1];
    const p = latest.attributes?.tsunamiPotential ?? "unknown";
    const icon = p === "yes" ? "🚨" : p === "no" ? "🟢" : "🟡";
    console.log(`  ${icon} tsunamiPotential = ${p.toUpperCase()}`);
    console.log(`     from: ${latest.name}`);
    console.log(`     raw Potensi: "${latest.attributes?.potensi ?? "(absent)"}"`);
    console.log(`     source: BMKG · observedAt=${latest.provenance?.[0]?.observedAt}`);
  }

  // ─── BUDGETS ─────────────────────────────────────────────────────
  console.log(`\n▶ RATE-LIMIT / BUDGET STATE`);
  const budgetReg = new BudgetRegistry();
  const budgetRows = budgetReg.summary();
  if (budgetRows.length === 0) {
    console.log(`  No live sources registered yet.`);
  } else {
    console.log(`  Source                         60s   24h   Today$   Policy         Next?`);
    for (const b of budgetRows) {
      const policyLabel = b.policy ? `${b.policy.maxPerMinute ?? "-"}/m ${b.policy.maxPerDay ?? "-"}/d` : "(no policy)";
      const next = b.nextEligibleAt ? `⚠ ${b.nextEligibleAt.slice(11, 19)}` : "";
      console.log(`  ${b.sourceId.padEnd(30)} ${String(b.last60s).padStart(3)}  ${String(b.last24h).padStart(4)}  ${String(b.todayCost.toFixed(4)).padStart(8)} ${b.costUnit.padEnd(4)} ${policyLabel.padEnd(14)} ${next}`);
    }
  }

  // ─── GAPS ────────────────────────────────────────────────────────
  console.log(`\n▶ KNOWLEDGE GAP BACKLOG`);
  const gaps = new GapRegistry();
  const gapSum = gaps.summary();
  console.log(`  Total gaps: ${gapSum.total}`);
  if (gapSum.total > 0) {
    console.log(`  By status:  ${Object.entries(gapSum.byStatus).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
    console.log(`  By intent:  ${Object.entries(gapSum.byIntent).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
    console.log(`  Top-5 open (by priority):`);
    for (const g of gaps.topOpenGaps(5)) {
      console.log(`    · [p=${String(g.priority).padStart(4)} f=${String(g.frequency).padStart(3)}] ${g.reason.padEnd(20)} ${g.lastRawQuery.slice(0, 60)}`);
    }
  }

  // ─── DEDUPE ──────────────────────────────────────────────────────
  console.log(`\n▶ DEDUPE (against migrated corpus)`);
  if (entities.length === 0) {
    console.log(`  Migrated entity corpus not found. Run: npm run data:migrate`);
  } else {
    try {
      const rep = analyseCorpus(entities);
      console.log(`  Entities scanned:   ${entities.length}`);
      console.log(`  Candidate pairs:    ${rep.candidatePairs} (${rep.wallMs}ms)`);
      console.log(`  Strong merges:      ${rep.strongMerges.length}`);
      console.log(`  Review candidates:  ${rep.reviewCandidates.length}`);
    } catch (err) {
      console.log(`  Failed to analyse corpus: ${err.message}`);
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════════════════\n`);
}

// ─── helpers ─────────────────────────────────────────────────────

function bar(value, total, width = 30) {
  if (total === 0) return "";
  const filled = Math.round((value / total) * width);
  return "█".repeat(filled) + "·".repeat(width - filled);
}

function groupBy(arr, fn) {
  const out = {};
  for (const x of arr) {
    const k = fn(x);
    (out[k] ??= []).push(x);
  }
  return out;
}

function groupCount(arr, fn) {
  const out = {};
  for (const x of arr) {
    const k = fn(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
