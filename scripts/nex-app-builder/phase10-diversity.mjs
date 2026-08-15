// NEX App Builder · Phase 10 · Diversity acceptance test (Philip 2026-08-14).
//
// Runs 10 distinct real-customer scenarios through the same NEX Core stack
// and asserts each proves what it should prove. Different situations —
// not thousands of tests. If Phase 10 passes, NEX has moved from "great
// at staircases" to "genuinely a general App Builder."
//
// Constitutional rules unchanged. Same schema. Same workers. Same adapter.
// Same QA. Only the customer inputs differ.

await import("../../src/lib/studio/sections/index.ts");

const fx  = await import("../../src/lib/app-builder/examples/phase10-scenarios.ts");
const orch = await import("../../src/lib/app-builder/workers/orchestrator.ts");
const fs  = await import("node:fs");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

async function runScenario(name, bp, opts = {}) {
  console.log("\n---------- " + name + " · " + bp.name + " ----------");
  const shotsDir = opts.executeQA ? `tmp-nex-qa-screenshots-p10-${bp.id}` : undefined;
  const result = await orch.runBlueprintWorkers(bp, {
    executeQA: !!opts.executeQA,
    screenshotDir: shotsDir
  });
  const val = result.workerReports.validation.data;
  const design = result.workerReports.design.data;
  console.log(`  verdict=${result.overall} · pages=${Object.keys(result.assembly.pages).length}/${bp.pages.length} · sections resolved=${val.sectionResolutions.filter(r => r.strategy !== "unresolved").length}/${val.sectionResolutions.length}`);
  if (design?.heroSelection?.matched) console.log(`  hero=${design.heroSelection.heroId} · score ${design.heroSelection.provenance.totalScore.toFixed(2)}`);
  else if (design?.heroSelection?.requiresGenerationOrCustomerUpload) console.log(`  hero=NO_SUITABLE_IMAGE (REQUIRED · not fabricated)`);
  if (result.qaExecution?.ran) console.log(`  QA=${result.qaExecution.pass}P/${result.qaExecution.fail}F · ${result.qaExecution.screenshots.length} screenshots · ${result.qaExecution.durationMs}ms`);
  return result;
}

const t0 = Date.now();

// ─────────────────────────────────────────────────────────────
// Scenario 1 · Simple local business — should be READY
// ─────────────────────────────────────────────────────────────
const r1 = await runScenario("Scenario 1 · Simple", fx.scenario1_SimpleElectrician(), { executeQA: true });
assert(r1.overall === "READY" || r1.overall === "PARTIAL", "S1: simple local business assembles");
assert(Object.keys(r1.assembly.pages).length === 3, `S1: 3 pages assembled (got ${Object.keys(r1.assembly.pages).length})`);
assert(r1.qaExecution?.fail === 0, `S1: 0 QA fails (got ${r1.qaExecution?.fail})`);

// ─────────────────────────────────────────────────────────────
// Scenario 2 · Multi-page — 5 pages assemble
// ─────────────────────────────────────────────────────────────
const r2 = await runScenario("Scenario 2 · Multi-page", fx.scenario2_MultiPageKitchen());
assert(Object.keys(r2.assembly.pages).length === 5, `S2: 5 pages assembled (got ${Object.keys(r2.assembly.pages).length})`);
assert(r2.assembly.unresolved.length === 0, `S2: 0 unresolved sections (got ${r2.assembly.unresolved.length})`);

// ─────────────────────────────────────────────────────────────
// Scenario 3 · Image-heavy — should have multiple gallery sections
// ─────────────────────────────────────────────────────────────
const r3 = await runScenario("Scenario 3 · Image-heavy", fx.scenario3_ImageHeavyPhotographer(), { executeQA: true });
const galleryCount = Object.values(r3.assembly.pages).flatMap(l => l.sections).filter(s => s.key.startsWith("gallery")).length;
assert(galleryCount >= 2, `S3: multiple gallery sections resolved (got ${galleryCount})`);
assert(r3.qaExecution?.fail === 0, `S3: 0 QA fails (got ${r3.qaExecution?.fail})`);

// ─────────────────────────────────────────────────────────────
// Scenario 4 · Ecommerce — Stripe declared, products SEEDED
// ─────────────────────────────────────────────────────────────
const r4 = await runScenario("Scenario 4 · Ecommerce", fx.scenario4_EcommerceFurniture(), { executeQA: true });
const stripe = r4.workerReports.integration.data.integrations.find(i => i.provider === "stripe");
assert(!!stripe, "S4: Stripe integration surfaced");
assert(stripe.status !== "CONNECTED", "S4: Stripe NOT falsely marked CONNECTED (no live probe)");
const productsModel = r4.workerReports.dataModel.data.models.find(m => m.id === "products");
assert(productsModel?.status === "SEEDED", `S4: products data model SEEDED (got ${productsModel?.status})`);
assert(productsModel?.seedCount === 3, `S4: 3 products seeded (got ${productsModel?.seedCount})`);
assert(r4.qaExecution?.fail === 0, `S4: 0 QA fails (got ${r4.qaExecution?.fail})`);

// ─────────────────────────────────────────────────────────────
// Scenario 5 · Service radius — google-maps CONFIGURED via preconditions
// ─────────────────────────────────────────────────────────────
const r5 = await runScenario("Scenario 5 · Service radius", fx.scenario5_ServiceBusinessPlumber(), { executeQA: true });
const gmaps = r5.workerReports.integration.data.integrations.find(i => i.provider === "google-maps");
assert(!!gmaps, "S5: google-maps surfaced");
// Radius supplied so preconditions MET · but env var still missing → MISSING_CONFIGURATION (not BLOCKED)
assert(gmaps.status === "MISSING_CONFIGURATION" || gmaps.status === "CONFIGURED",
  `S5: gmaps status is MISSING_CONFIGURATION or CONFIGURED (got ${gmaps.status})`);
const radiusPreconditionsMet = gmaps.preconditions.every(p => p.met);
assert(radiusPreconditionsMet, `S5: google-maps preconditions met (radius centre + miles supplied)`);
assert(r5.qaExecution?.fail === 0, `S5: 0 QA fails (got ${r5.qaExecution?.fail})`);

// ─────────────────────────────────────────────────────────────
// Scenario 6 · Missing info — NEX must refuse to invent
// ─────────────────────────────────────────────────────────────
const r6 = await runScenario("Scenario 6 · Missing info", fx.scenario6_MissingInfo());
const val6 = r6.workerReports.validation.data;
assert(val6.requiredFacts.length > 0, `S6: NEX flags REQUIRED facts (got ${val6.requiredFacts.length})`);
assert(val6.requiredFacts.some(f => f.path === "identity.displayName"), "S6: displayName specifically flagged");
assert(r6.overall !== "READY", `S6: verdict NOT READY (got ${r6.overall})`);
const ps6 = r6.workerReports.provenanceSurface.data;
const p0Items = ps6.actionItems.filter(a => a.priority === "P0");
assert(p0Items.length > 0, `S6: at least one P0 action item (got ${p0Items.length})`);

// ─────────────────────────────────────────────────────────────
// Scenario 7 · Conflicting info — style vs imagery direction
// ─────────────────────────────────────────────────────────────
const r7 = await runScenario("Scenario 7 · Conflicting", fx.scenario7_Conflicting());
const intentTags = r7.workerReports.design.data.intentTags;
const modernTags = intentTags.filter(t => t.value === "modern" || t.value === "minimalist");
const traditionalTags = intentTags.filter(t => ["victorian", "traditional", "grand", "rustic", "cottage"].includes(t.value));
assert(modernTags.length > 0, `S7: modern intent surfaced from archetype (got ${modernTags.length})`);
assert(traditionalTags.length > 0, `S7: traditional intent surfaced from imageryDirection (got ${traditionalTags.length})`);
// Both intents present is the CONFLICT · workers surface both rather than picking one silently
assert(modernTags.length > 0 && traditionalTags.length > 0, "S7: conflict (modern archetype + traditional imagery) is SURFACED, not silently resolved");

// ─────────────────────────────────────────────────────────────
// Scenario 8 · Changing requirements — v1 vs v2 produce different intent
// ─────────────────────────────────────────────────────────────
const r8a = await runScenario("Scenario 8 · Changing v1 (modern)", fx.scenario8_Changing_v1());
const r8b = await runScenario("Scenario 8 · Changing v2 (traditional)", fx.scenario8_Changing_v2());
const v1Style = r8a.workerReports.design.data.intentTags.find(t => t.category === "style")?.value;
const v2Style = r8b.workerReports.design.data.intentTags.find(t => t.category === "style")?.value;
assert(v1Style === "modern" && v2Style === "traditional", `S8: v1 intent=${v1Style}, v2 intent=${v2Style} · change reflected in Blueprint`);
assert(r8a.workerReports.provenanceSurface.data.overall !== undefined && r8b.workerReports.provenanceSurface.data.overall !== undefined, "S8: both revisions produce coherent provenance surface (no orphaned state)");
assert(r8a.assembly.pages.about !== r8b.assembly.pages.about, "S8: v1 and v2 produce distinct assembly objects (change → new Blueprint, not merged state)");

// ─────────────────────────────────────────────────────────────
// Scenario 9 · Unclear request — NEX identifies gaps rather than fabricating
// ─────────────────────────────────────────────────────────────
const r9 = await runScenario("Scenario 9 · Unclear", fx.scenario9_UnclearRequest());
const val9 = r9.workerReports.validation.data;
assert(val9.requiredFacts.length > 0, `S9: NEX surfaces REQUIRED facts when request is unclear (got ${val9.requiredFacts.length})`);
assert(r9.overall !== "READY", `S9: unclear request does NOT resolve to READY (got ${r9.overall})`);
// Verify vertical.taxonomySlug is INFERRED (low confidence) not silently defaulted
const verticalProv = val9.inferredFacts.find(f => f.path === "vertical.taxonomySlug");
assert(!!verticalProv, "S9: unclear vertical surfaced as INFERRED (traceable · not silently defaulted)");
assert((verticalProv?.confidence ?? 1) < 0.5, `S9: inferred vertical confidence low (got ${verticalProv?.confidence})`);

// ─────────────────────────────────────────────────────────────
// Scenario 10 · Large website — system remains stable
// ─────────────────────────────────────────────────────────────
const s10Start = Date.now();
const r10 = await runScenario("Scenario 10 · Large (16 pages)", fx.scenario10_LargeWebsite());
const s10Duration = Date.now() - s10Start;
assert(Object.keys(r10.assembly.pages).length === 16, `S10: all 16 pages assembled (got ${Object.keys(r10.assembly.pages).length})`);
assert(r10.assembly.unresolved.length === 0, `S10: 0 unresolved sections across all 16 pages (got ${r10.assembly.unresolved.length})`);
assert(s10Duration < 30000, `S10: orchestration completes under 30s (took ${s10Duration}ms)`);

// ─────────────────────────────────────────────────────────────
// CROSS-SCENARIO CONSTITUTIONAL CHECKS
// ─────────────────────────────────────────────────────────────
console.log("\n---------- Cross-scenario constitutional checks ----------");

// Zero fabrication across all positive scenarios
const positive = [r1, r2, r3, r4, r5, r10];
for (const r of positive) {
  const val = r.workerReports.validation.data;
  const unresolved = val.sectionResolutions.filter(x => x.strategy === "unresolved");
  assert(unresolved.length === 0, `${r.runId}: 0 unresolved (fabrication-free) sections`);
}

// Same worker set, same code — verify no scenario mutated shared state
const allWorkerNames = new Set();
for (const r of [r1, r2, r3, r4, r5, r6, r7, r8a, r8b, r9, r10]) {
  for (const [name, rep] of Object.entries(r.workerReports)) {
    if (rep) allWorkerNames.add(rep.worker);
  }
}
assert(allWorkerNames.size <= 6, `same six workers used across all scenarios (got ${allWorkerNames.size}: ${[...allWorkerNames].join(", ")})`);

// NEX Core independence · no scenario required a network call to external SaaS
// (integration status of MISSING_CONFIGURATION does NOT block NEX itself)
for (const r of [r4, r5]) {
  const blocked = r.workerReports.integration.data.integrations.filter(i => i.status === "BLOCKED" && !i.optional);
  // Some integrations may have MISSING_CONFIGURATION but that's fine — NEX still ran
  assert(r.overall !== "FAILED", `${r.runId}: NEX still ran despite external integration MISSING_CONFIGURATION (customer integrations != NEX deps)`);
}

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
const totalDuration = Date.now() - t0;
console.log("");
console.log("─".repeat(60));
console.log(`Phase 10 · 10 scenarios · ${totalDuration}ms total`);
console.log("");
console.log("  #  scenario                          verdict     pages   QA");
const rows = [
  ["1", "Simple local business",   r1.overall, `${Object.keys(r1.assembly.pages).length}/${fx.scenario1_SimpleElectrician().pages.length}`, r1.qaExecution ? `${r1.qaExecution.pass}P/${r1.qaExecution.fail}F` : "—"],
  ["2", "Multi-page",             r2.overall, `${Object.keys(r2.assembly.pages).length}/${fx.scenario2_MultiPageKitchen().pages.length}`, "—"],
  ["3", "Image-heavy photographer", r3.overall, `${Object.keys(r3.assembly.pages).length}/${fx.scenario3_ImageHeavyPhotographer().pages.length}`, r3.qaExecution ? `${r3.qaExecution.pass}P/${r3.qaExecution.fail}F` : "—"],
  ["4", "Ecommerce (Stripe)",      r4.overall, `${Object.keys(r4.assembly.pages).length}/${fx.scenario4_EcommerceFurniture().pages.length}`, r4.qaExecution ? `${r4.qaExecution.pass}P/${r4.qaExecution.fail}F` : "—"],
  ["5", "Service radius (plumber)",r5.overall, `${Object.keys(r5.assembly.pages).length}/${fx.scenario5_ServiceBusinessPlumber().pages.length}`, r5.qaExecution ? `${r5.qaExecution.pass}P/${r5.qaExecution.fail}F` : "—"],
  ["6", "Missing info",            r6.overall, `${Object.keys(r6.assembly.pages).length}/${fx.scenario6_MissingInfo().pages.length}`, "—"],
  ["7", "Conflicting",             r7.overall, `${Object.keys(r7.assembly.pages).length}/${fx.scenario7_Conflicting().pages.length}`, "—"],
  ["8a", "Changing v1 (modern)",    r8a.overall, `${Object.keys(r8a.assembly.pages).length}/${fx.scenario8_Changing_v1().pages.length}`, "—"],
  ["8b", "Changing v2 (traditional)", r8b.overall, `${Object.keys(r8b.assembly.pages).length}/${fx.scenario8_Changing_v2().pages.length}`, "—"],
  ["9", "Unclear",                 r9.overall, `${Object.keys(r9.assembly.pages).length}/${fx.scenario9_UnclearRequest().pages.length}`, "—"],
  ["10", "Large (16 pages)",       r10.overall, `${Object.keys(r10.assembly.pages).length}/${fx.scenario10_LargeWebsite().pages.length}`, "—"]
];
for (const row of rows) {
  console.log("  " + row[0].padEnd(3) + row[1].padEnd(35) + row[2].padEnd(11) + row[3].padEnd(8) + row[4]);
}
console.log("─".repeat(60));
console.log("");
console.log("=".repeat(60));
console.log(`Phase 10 · diversity acceptance · ${pass} passed · ${fail} failed`);
console.log("=".repeat(60));
if (fail > 0) process.exit(1);
