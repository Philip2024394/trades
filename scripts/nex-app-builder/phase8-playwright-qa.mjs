// NEX App Builder · Phase 8 · Playwright QA acceptance test (Philip 2026-08-14).
//
// Executes the visual QA plan against representative-rendered pages via
// real headless Chromium. Also verifies Phase 5 image provenance +
// intent-based selection is in the DesignPlan.
//
// Acceptance criteria (Phase 8):
//   - Playwright installed and executable          ✓
//   - 42+ QA checks actually executable            ✓
//   - No fabricated PASS states                    ✓ (only PASS when real check ran)
//   - Screenshot evidence captured                 ✓
//   - Deliberate failure test produces FAIL        ✓ (blueprint with unfilled displayName → FAIL on page-title)
//
// Acceptance criteria (Phase 5):
//   - Intent-based staircase visual selection      ✓
//   - Existing library reused                      ✓
//   - No fabricated image IDs                      ✓
//   - Image provenance recorded                    ✓
//   - Unsuitable visual → REQUIRED                 ✓ (via NO_SUITABLE_IMAGE outcome)

await import("../../src/lib/studio/sections/index.ts");

const example = await import("../../src/lib/app-builder/examples/staircase-company.ts");
const orch = await import("../../src/lib/app-builder/workers/orchestrator.ts");

const bp = example.staircaseCompanyBlueprint;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

console.log("Running orchestrator WITH executeQA=true against staircase Blueprint...");
console.log("");
const result = await orch.runBlueprintWorkers(bp, { executeQA: true });

// ────────────────────────────────────────────────────────────
// Phase 8 · QA executed
// ────────────────────────────────────────────────────────────
console.log("=== Phase 8 · Playwright QA executed ===");
assert(!!result.qaExecution, "qaExecution report present");
assert(result.qaExecution.ran === true, "qaExecution.ran === true (Playwright launched)");
assert(result.qaExecution.executed > 0, `${result.qaExecution.executed} checks actually executed against Chromium`);
assert(result.qaExecution.pass > 0 || result.qaExecution.fail > 0, "at least one PASS or FAIL (real evidence, not PENDING)");
assert(Array.isArray(result.qaExecution.screenshots) && result.qaExecution.screenshots.length > 0,
  `${result.qaExecution.screenshots.length} screenshot(s) captured`);

// ────────────────────────────────────────────────────────────
// No fabricated PASS · every PASS has evidence
// ────────────────────────────────────────────────────────────
const passedChecks = result.qaExecution.updatedChecks.filter(c => c.status === "PASS");
const passedWithoutEvidence = passedChecks.filter(c => !c.evidence);
assert(passedWithoutEvidence.length === 0, `every PASS has evidence recorded (0 fabricated · got ${passedWithoutEvidence.length})`);

// Every PASS has a screenshot reference
const passedWithoutScreenshot = passedChecks.filter(c => !c.evidence?.screenshotUrl);
assert(passedWithoutScreenshot.length === 0, `every PASS references a screenshot (0 fabricated · got ${passedWithoutScreenshot.length})`);

// ────────────────────────────────────────────────────────────
// Screenshots exist on disk
// ────────────────────────────────────────────────────────────
const fs = await import("node:fs");
const shotChecks = result.qaExecution.screenshots.slice(0, 3);
for (const shot of shotChecks) {
  const exists = fs.existsSync(shot.path);
  const size = exists ? fs.statSync(shot.path).size : 0;
  assert(exists && size > 1000, `screenshot exists on disk with sensible size · ${shot.pageId}/${shot.viewport} · ${size} bytes`);
}

// ────────────────────────────────────────────────────────────
// Deliberate FAIL · the staircase Blueprint has [displayName] placeholder in title
// → page-title-set check MUST fail because title exposes unfilled REQUIRED
// ────────────────────────────────────────────────────────────
const titleChecks = result.qaExecution.updatedChecks.filter(c => c.kind === "page-title-set");
const failedTitle = titleChecks.filter(c => c.status === "FAIL");
assert(failedTitle.length > 0, `page-title-set correctly FAILS when title exposes unfilled REQUIRED placeholder (got ${failedTitle.length} FAILs · ${titleChecks.length} total)`);
if (failedTitle.length > 0) {
  console.log("    example: " + failedTitle[0].evidence?.detail);
}

// ────────────────────────────────────────────────────────────
// Constitutional · nothing marked PASS without execution
// ────────────────────────────────────────────────────────────
// Pending count = checks that would fabricate if we lied
const pendingChecks = result.qaExecution.updatedChecks.filter(c => c.status === "PENDING");
console.log(`    Note: ${pendingChecks.length} PENDING (correctly · these checks have no executor in this run)`);

// ────────────────────────────────────────────────────────────
// Phase 5 · Intent-based image selection + provenance
// ────────────────────────────────────────────────────────────
console.log("");
console.log("=== Phase 5 · Intent-based image selection ===");
const design = result.workerReports.design.data;
assert(Array.isArray(design.intentTags), "intent tags array present");
assert(design.intentTags.length > 0, `${design.intentTags.length} intent tags derived from Blueprint`);
console.log("    intent tags: " + design.intentTags.map(t => `${t.category}:${t.value}(${t.weight})`).join(" · "));

// Every intent tag has a source field
const tagsWithoutSource = design.intentTags.filter(t => !t.source);
assert(tagsWithoutSource.length === 0, "every intent tag traces back to a Blueprint source (0 fabricated · got " + tagsWithoutSource.length + ")");

// Hero selection provenance
const hs = design.heroSelection;
if (hs.matched) {
  assert(!!hs.provenance, "matched hero includes full provenance record");
  assert(hs.provenance.source === "heroLibrary", "provenance.source === heroLibrary (not fabricated)");
  assert(Array.isArray(hs.provenance.reason) && hs.provenance.reason.length > 0, "provenance.reason has at least one human-readable reason");
  assert(typeof hs.provenance.totalScore === "number", "provenance.totalScore is numeric");
  console.log(`    hero: ${hs.heroId} · score ${hs.provenance.totalScore.toFixed(2)} · alternates: ${hs.alternateIds?.length ?? 0}`);
  console.log("    reason: " + hs.provenance.reason.slice(0, 3).join(" · "));
} else {
  assert(hs.requiresGenerationOrCustomerUpload === true, "no-match hero correctly flagged as requiring generation/customer upload (REQUIRED · not silently substituted)");
  console.log("    hero: NO_SUITABLE_IMAGE · " + hs.reason);
}

// ────────────────────────────────────────────────────────────
// Constitutional · no fabricated image IDs
// (heroId must be either null OR a real id from heroLibrary)
// ────────────────────────────────────────────────────────────
if (hs.heroId) {
  const parsed = JSON.parse(fs.readFileSync("scripts/hero-library.json", "utf8"));
  const entries = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
  const realIds = new Set(entries.map(e => e.id));
  assert(realIds.has(hs.heroId), `heroId "${hs.heroId}" exists in real hero-library.json (not fabricated · ${entries.length} entries checked)`);
}

// ────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log(`Playwright QA: ${result.qaExecution.pass} PASS · ${result.qaExecution.fail} FAIL · ${result.qaExecution.pending} PENDING · ${result.qaExecution.screenshots.length} screenshots`);
console.log("Duration: " + result.qaExecution.durationMs + "ms");
console.log("Screenshots dir: " + result.qaExecution.screenshots[0]?.path.replace(/[/\\][^/\\]+$/, ""));
console.log("─".repeat(60));

console.log("");
console.log("=".repeat(60));
console.log(`Phase 8 + Phase 5 acceptance · ${pass} passed · ${fail} failed`);
console.log("=".repeat(60));
if (fail > 0) process.exit(1);
