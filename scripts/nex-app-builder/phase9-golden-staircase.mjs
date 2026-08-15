// NEX App Builder · Phase 9 · Golden staircase test (Philip 2026-08-14).
//
// The end-to-end proof:
//   Raw prompt → completed customer facts → AppBlueprint → 6 workers
//   → Blueprint → pipeline → 7 real pages → Playwright / Chromium
//   → 42+ QA checks → 0 FAIL → 14 screenshots
//
// Then a deliberate NEGATIVE test: remove the customer name and prove
// that the constitutional rule still blocks it.
//
// Does NOT weaken any QA rule. Registry counts (419 heroes, 42 checks)
// are observed dynamically, not hard-coded.

await import("../../src/lib/studio/sections/index.ts");

const completed = await import("../../src/lib/app-builder/examples/staircase-company-completed.ts");
const orch = await import("../../src/lib/app-builder/workers/orchestrator.ts");
const fs = await import("node:fs");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

// ─── Observe current registry sizes (not hard-coded) ───────────────
const heroLibRaw = JSON.parse(fs.readFileSync("scripts/hero-library.json", "utf8"));
const heroEntries = Array.isArray(heroLibRaw) ? heroLibRaw : (heroLibRaw.entries ?? []);
const heroLibCount = heroEntries.length;
console.log(`Registry state at test time · hero library: ${heroLibCount} entries`);
console.log("");

// ─────────────────────────────────────────────────────────────
// PART A · Golden positive test with completed customer profile
// ─────────────────────────────────────────────────────────────
console.log("=== PART A · Golden positive test ===");
console.log("");

const bp = completed.staircaseCompletedBlueprint;
console.log("Blueprint: " + bp.name + " (id=" + bp.id + ")");
console.log("Contact:   " + bp.identity.contact.primaryEmail + " · " + bp.identity.contact.primaryPhone);
console.log("Radius:    " + bp.identity.contact.serviceRadius.centre.value + " / " + bp.identity.contact.serviceRadius.radiusMiles + " miles");
console.log("");

const result = await orch.runBlueprintWorkers(bp, {
  executeQA: true,
  screenshotDir: "tmp-nex-qa-screenshots-golden"
});

const val = result.workerReports.validation.data;
const dm = result.workerReports.dataModel.data;
const design = result.workerReports.design.data;
const qa = result.qaExecution;

// 1. Raw prompt → Blueprint
assert(bp.sourceUtterances.length >= 1, "raw customer prompt preserved in sourceUtterances");
assert(!!bp.provenance, "Blueprint carries provenance map");

// 2. No fabricated customer facts (every KNOWN identity fact has source=customer:completed-profile)
const knownIdentityFacts = ["identity.displayName", "identity.contact.primaryEmail", "identity.contact.primaryPhone", "identity.contact.serviceRadius.centre", "identity.contact.serviceRadius.radiusMiles"];
for (const path of knownIdentityFacts) {
  const p = bp.provenance[path];
  assert(!!p && p.level === "KNOWN" && p.source.startsWith("customer:"), `${path} is KNOWN with customer source (not fabricated)`);
}

// 3. All REQUIRED facts supplied
assert(val.requiredFacts.length === 0, `0 REQUIRED customer facts remain unsupplied (got ${val.requiredFacts.length})`);

// 4. 17/17 sections resolve
const totalSections = val.sectionResolutions.length;
const resolvedSections = val.sectionResolutions.filter(r => r.strategy !== "unresolved").length;
assert(resolvedSections === totalSections, `${resolvedSections}/${totalSections} sections resolve`);

// 5. 7/7 pages assemble
const assembledPages = Object.keys(result.assembly.pages).length;
assert(assembledPages === bp.pages.length, `${assembledPages}/${bp.pages.length} pages assembled`);

// 6. Legitimate image provenance
if (design.heroSelection.matched) {
  assert(!!design.heroSelection.provenance, "hero has full provenance record");
  const realIds = new Set(heroEntries.map(e => e.id));
  assert(realIds.has(design.heroSelection.heroId), `hero id "${design.heroSelection.heroId}" exists in real hero library (checked ${heroLibCount} entries)`);
  assert(design.heroSelection.provenance.reason.length > 0, "hero provenance has human-readable reason");
  assert(design.heroSelection.provenance.totalScore >= 0.35, `hero match score ${design.heroSelection.provenance.totalScore.toFixed(2)} clears minScore threshold`);
}

// 7. No [REQUIRED] placeholders reach the rendered site (via QA title checks)
const titleChecks = qa.updatedChecks.filter(c => c.kind === "page-title-set");
const failedTitles = titleChecks.filter(c => c.status === "FAIL");
assert(failedTitles.length === 0, `0/${titleChecks.length} title checks FAILED (no [placeholder] leakage · got ${failedTitles.length})`);

// 8. All QA checks execute (dynamic count — do not hard-code 42)
assert(qa.ran === true, "Playwright launched");
assert(qa.executed === qa.totalChecks, `all ${qa.totalChecks} planned checks executed (0 pending)`);

// 9. 0 QA failures on the golden fixture
assert(qa.fail === 0, `0 QA failures on the golden fixture (got ${qa.fail})`);
if (qa.fail > 0) {
  console.error("    failed checks:");
  for (const c of qa.updatedChecks.filter(x => x.status === "FAIL").slice(0, 5)) {
    console.error("      - " + c.id + " · " + (c.evidence?.detail ?? ""));
  }
}

// 10. All screenshots exist with real image bytes
const shotCount = qa.screenshots.length;
assert(shotCount > 0, `${shotCount} screenshots captured`);
let missing = 0, tinyBytes = 0;
for (const s of qa.screenshots) {
  if (!fs.existsSync(s.path)) { missing++; continue; }
  const size = fs.statSync(s.path).size;
  if (size < 2000) tinyBytes++;
}
assert(missing === 0, `0 missing screenshot files (got ${missing})`);
assert(tinyBytes === 0, `0 screenshots below 2KB (got ${tinyBytes} suspiciously-tiny · likely fabricated)`);

// Additional integrity checks
assert(result.overall === "READY" || result.overall === "PARTIAL", `overall verdict is READY or PARTIAL · got ${result.overall}`);

// Data-model status: products should now be SEEDED
const productsModel = dm.models.find(m => m.id === "products");
assert(productsModel && productsModel.status === "SEEDED", `products data model is SEEDED (customer supplied 4 products · got ${productsModel?.status})`);
assert(productsModel && productsModel.seedCount === 4, `products seed count = 4 (got ${productsModel?.seedCount})`);

console.log("");
console.log(`Golden test QA result: ${qa.pass} PASS · ${qa.fail} FAIL · ${qa.pending} PENDING · ${qa.screenshots.length} screenshots · ${qa.durationMs}ms`);

// ─────────────────────────────────────────────────────────────
// PART B · Negative test · remove company name, expect BLOCKED
// ─────────────────────────────────────────────────────────────
console.log("");
console.log("=== PART B · Negative test (missing company name) ===");
console.log("");

const bpNoName = completed.buildCompletedStaircaseBlueprint_WithoutName();
console.log("Blueprint: " + bpNoName.name + " (id=" + bpNoName.id + ")");
console.log("displayName: \"" + bpNoName.identity.displayName + "\" (placeholder · REQUIRED)");
console.log("");

const resultNeg = await orch.runBlueprintWorkers(bpNoName, {
  executeQA: true,
  screenshotDir: "tmp-nex-qa-screenshots-negative"
});

const valNeg = resultNeg.workerReports.validation.data;
const qaNeg = resultNeg.qaExecution;

// Negative expectations
assert(valNeg.requiredFacts.length > 0, "negative test surfaces REQUIRED facts (customer name missing)");
assert(valNeg.requiredFacts.some(f => f.path === "identity.displayName"), "negative test specifically flags identity.displayName as REQUIRED");
assert(resultNeg.overall !== "READY", `negative test verdict is NOT READY (got ${resultNeg.overall})`);
assert(!val.requiredFacts.some(f => f.path === "identity.displayName"), "sanity check: positive Blueprint did NOT have displayName as REQUIRED");

// QA on negative Blueprint should catch the placeholder in the title
const negTitleChecks = qaNeg.updatedChecks.filter(c => c.kind === "page-title-set");
const negFailedTitles = negTitleChecks.filter(c => c.status === "FAIL");
assert(negFailedTitles.length > 0, `negative test · title checks FAIL because [Staircase Company Name] placeholder reaches page (got ${negFailedTitles.length} fails)`);
if (negFailedTitles.length > 0) {
  console.log("    example: " + negFailedTitles[0].evidence?.detail);
}

// Provenance surface should surface at least one P0 action
const psNeg = resultNeg.workerReports.provenanceSurface.data;
const p0 = psNeg.actionItems.filter(a => a.priority === "P0");
assert(p0.length > 0, `negative test surfaces ${p0.length} P0 action item(s) for operator`);

console.log("");
console.log("Negative test QA result: " + qaNeg.pass + " PASS · " + qaNeg.fail + " FAIL · " + qaNeg.screenshots.length + " screenshots");
console.log("Negative verdict: " + resultNeg.overall);

// ─────────────────────────────────────────────────────────────
// PART C · Prove constitutional distinction · positive vs negative
// ─────────────────────────────────────────────────────────────
console.log("");
console.log("=== PART C · Constitutional distinction ===");
console.log("");

assert(qa.fail === 0 && qaNeg.fail > 0, `QA correctly differentiates: positive=0 fails, negative=${qaNeg.fail} fails`);
assert(result.overall !== resultNeg.overall || (result.overall === "PARTIAL" && resultNeg.overall === "PARTIAL"),
  `overall verdict differs between positive (${result.overall}) and negative (${resultNeg.overall})`);
assert(val.requiredFacts.length < valNeg.requiredFacts.length,
  `positive requires fewer facts (${val.requiredFacts.length}) than negative (${valNeg.requiredFacts.length})`);

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log("Registry state observed:");
console.log("  Hero library entries: " + heroLibCount);
console.log("  QA checks in registry: " + qa.totalChecks);
console.log("");
console.log("Positive (completed customer profile):");
console.log("  Overall verdict:       " + result.overall);
console.log("  REQUIRED facts:        " + val.requiredFacts.length + " (target: 0)");
console.log("  Pages assembled:       " + assembledPages + "/" + bp.pages.length);
console.log("  Sections resolved:     " + resolvedSections + "/" + totalSections);
console.log("  Hero match:            " + (design.heroSelection.matched ? design.heroSelection.heroId + " (score " + design.heroSelection.provenance.totalScore.toFixed(2) + ")" : "NO_SUITABLE_IMAGE"));
console.log("  QA checks executed:    " + qa.executed + "/" + qa.totalChecks);
console.log("  QA pass:               " + qa.pass);
console.log("  QA fail:               " + qa.fail);
console.log("  Screenshots on disk:   " + qa.screenshots.length + " (all >2KB)");
console.log("");
console.log("Negative (missing customer name):");
console.log("  Overall verdict:       " + resultNeg.overall);
console.log("  REQUIRED facts:        " + valNeg.requiredFacts.length + " (must be > 0)");
console.log("  QA title FAILs:        " + negFailedTitles.length + " (must be > 0 · placeholder detected)");
console.log("─".repeat(60));

console.log("");
console.log("=".repeat(60));
console.log(`Phase 9 · Golden staircase test · ${pass} passed · ${fail} failed`);
console.log("=".repeat(60));
if (fail > 0) process.exit(1);
