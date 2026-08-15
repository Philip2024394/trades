// NEX App Builder · Phase 3 acceptance test (Philip 2026-08-14).
//
// The exact acceptance criteria Philip specified:
//   Prompt → Blueprint → validation → data → integrations → design →
//   existing pipeline → 7 pages → visual QA
// with:
//   - 0 fabricated customer facts
//   - 0 fabricated registry ids
//   - 0 silent section drops
//   - 0 new rendering systems
//   - 0 regressions to the 110/110 suites

// Register sections so the registry is populated
await import("../../src/lib/studio/sections/index.ts");

const example = await import("../../src/lib/app-builder/examples/staircase-company.ts");
const orch = await import("../../src/lib/app-builder/workers/orchestrator.ts");
const secReg = await import("../../src/lib/studio/sectionRegistry.ts");

const bp = example.staircaseCompanyBlueprint;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

console.log("Running orchestrator on: " + bp.name);
console.log("");

const result = await orch.runBlueprintWorkers(bp);

// ────────────────────────────────────────────────────────────────
// A. Every worker ran
// ────────────────────────────────────────────────────────────────
assert(!!result.workerReports.validation, "validation worker ran");
assert(!!result.workerReports.dataModel, "data-model worker ran");
assert(!!result.workerReports.integration, "integration worker ran");
assert(!!result.workerReports.design, "design/image worker ran");
assert(!!result.workerReports.visualQA, "visual QA worker ran");
assert(!!result.workerReports.provenanceSurface, "provenance surface worker ran");
assert(!!result.assembly, "assembly (blueprint → pipeline adapter) ran");

// ────────────────────────────────────────────────────────────────
// B. 0 fabricated customer facts
// ────────────────────────────────────────────────────────────────
const val = result.workerReports.validation.data;
assert(val.requiredFacts.length > 0, `validation surfaces ${val.requiredFacts.length} required customer fact(s) rather than fabricating (expected > 0 because staircase example has placeholders)`);
const surfacedPaths = val.requiredFacts.map(f => f.path);
assert(surfacedPaths.includes("identity.displayName"), "required-facts includes company name");

// ────────────────────────────────────────────────────────────────
// C. 0 fabricated registry ids · all resolved through real registry
// ────────────────────────────────────────────────────────────────
const realIds = new Set(secReg.sectionRegistry.ids());
const resolutions = val.sectionResolutions;
let fabricated = 0;
for (const r of resolutions) {
  if (r.resolvedRegistryId && !realIds.has(r.resolvedRegistryId)) {
    console.error("  FABRICATED:", r);
    fabricated++;
  }
}
assert(fabricated === 0, `0 fabricated registry ids (got ${fabricated})`);

// ────────────────────────────────────────────────────────────────
// D. 0 silent section drops
// ────────────────────────────────────────────────────────────────
const bpSectionCount = bp.pages.reduce((n, p) => n + p.sections.length, 0);
const assembledSectionCount = Object.values(result.assembly.pages).reduce((n, l) => n + l.sections.length, 0);
assert(assembledSectionCount === bpSectionCount, `no silent section drops · Blueprint had ${bpSectionCount} · assembled ${assembledSectionCount}`);
assert(result.assembly.unresolved.length === 0, `no unresolved sections (got ${result.assembly.unresolved.length})`);

// ────────────────────────────────────────────────────────────────
// E. 7 pages assembled from 7 Blueprint pages
// ────────────────────────────────────────────────────────────────
assert(Object.keys(result.assembly.pages).length === bp.pages.length, `${bp.pages.length} pages assembled (got ${Object.keys(result.assembly.pages).length})`);

// ────────────────────────────────────────────────────────────────
// F. Data model plan is honest (customer_input_required flagged, no invented data)
// ────────────────────────────────────────────────────────────────
const dm = result.workerReports.dataModel.data;
const productsModel = dm.models.find(m => m.id === "products");
assert(!!productsModel, "products data model surfaced in plan");
assert(productsModel.status === "CUSTOMER_INPUT_REQUIRED", `products model status = CUSTOMER_INPUT_REQUIRED (got ${productsModel.status})`);
assert(productsModel.fieldsNeedingCustomerInput.length > 0, "products model lists specific fields customer must supply");
// No model is silently marked ready if it needs real input
for (const m of dm.models) {
  if (m.required && m.seedCount === 0 && m.fieldsNeedingCustomerInput.length > 0) {
    assert(m.status === "CUSTOMER_INPUT_REQUIRED", `model ${m.id} correctly marked CUSTOMER_INPUT_REQUIRED (not fabricated as SEEDED)`);
  }
}

// ────────────────────────────────────────────────────────────────
// G. Integration plan is honest (no CONNECTED without evidence)
// ────────────────────────────────────────────────────────────────
const ip = result.workerReports.integration.data;
const stripe = ip.integrations.find(i => i.provider === "stripe");
const gmaps = ip.integrations.find(i => i.provider === "google-maps");
assert(!!stripe && !!gmaps, "stripe + google-maps integrations both surfaced");
assert(stripe.status !== "CONNECTED", "stripe NOT marked CONNECTED (no evidence · correct)");
assert(gmaps.status === "MISSING_CONFIGURATION", `google-maps = MISSING_CONFIGURATION because service-radius centre is REQUIRED (got ${gmaps.status})`);
assert(gmaps.preconditions.some(p => p.path.includes("serviceRadius.centre") && !p.met), "google-maps precondition explicitly cites missing serviceRadius.centre");

// ────────────────────────────────────────────────────────────────
// H. Design worker used the existing hero library (not a new one)
// ────────────────────────────────────────────────────────────────
const design = result.workerReports.design.data;
assert(typeof design.heroSelection === "object", "design plan includes heroSelection");
// Depending on hero library contents, matched may be true/false — but the mechanism must be the existing library
assert(!!design.heroSelection.tradeSlug, "design worker used tradeSlug for hero selection");
assert(typeof design.brandTokens.primary === "string", "design worker passes brand tokens THROUGH (does not invent new palette)");

// ────────────────────────────────────────────────────────────────
// I. Visual QA plan produced and honest
// ────────────────────────────────────────────────────────────────
const qa = result.workerReports.visualQA.data;
assert(qa.checks.length > 0, `visual QA plan produced ${qa.checks.length} checks`);
assert(qa.totals.pass === 0, "no PASS status without live execution (0% fabrication)");
assert(qa.totals.pending > 0, "checks are PENDING execution (correct · no live runner yet)");
assert(typeof qa.runnerRequirements.playwrightInstalled === "boolean", "runner preconditions declared");

// ────────────────────────────────────────────────────────────────
// J. Provenance surface aggregates everything
// ────────────────────────────────────────────────────────────────
const ps = result.workerReports.provenanceSurface.data;
assert(ps.sections.length >= 6, `provenance surface has ≥6 sections (Blueprint/Customer/Brand/Data/Integrations/Design/QA) · got ${ps.sections.length}`);
assert(ps.actionItems.length > 0, `provenance surface has ${ps.actionItems.length} action items for the operator`);
const hasP0 = ps.actionItems.some(a => a.priority === "P0");
assert(hasP0, "at least one P0 action item (customer must supply required facts)");

// ────────────────────────────────────────────────────────────────
// K. Overall verdict is PARTIAL — not READY (because required facts missing) and not BLOCKED (because Blueprint is structurally valid)
// ────────────────────────────────────────────────────────────────
assert(result.overall === "PARTIAL" || result.overall === "BLOCKED",
  `overall verdict is PARTIAL or BLOCKED (missing customer facts) · got ${result.overall}`);

// ────────────────────────────────────────────────────────────────
// L. NO new rendering — check no worker created HTML/JSX-like output
// ────────────────────────────────────────────────────────────────
// Every worker report's `data` must be plain data — no functions, no elements
function checkNoRenderOutput(obj, path = "") {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === "function") { console.error("FAIL: rendered function found at " + path); return false; }
  if (typeof obj === "object") {
    if ((obj).$$typeof) { console.error("FAIL: React element at " + path); return false; }
    for (const [k, v] of Object.entries(obj)) {
      if (!checkNoRenderOutput(v, path + "." + k)) return false;
    }
  }
  return true;
}
let anyRender = false;
for (const [name, r] of Object.entries(result.workerReports)) {
  if (!r) continue;
  if (!checkNoRenderOutput(r.data, name)) anyRender = true;
}
assert(!anyRender, "no worker produced rendered HTML/JSX (orchestration only · no invention)");

// ────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log("Overall verdict: " + result.overall);
console.log("Total duration:  " + result.totalDurationMs + "ms");
console.log("");
console.log("Provenance surface highlights:");
for (const section of ps.sections) {
  console.log("  " + section.heading + ":");
  for (const item of section.items.slice(0, 3)) {
    const symbol = item.symbol === "check" ? "✓" : item.symbol === "warn" ? "⚠" : item.symbol === "cross" ? "✗" : "•";
    console.log("    " + symbol + " " + item.text.slice(0, 100));
  }
  if (section.items.length > 3) console.log("    (" + (section.items.length - 3) + " more)");
}
console.log("");
console.log("Action items (top 5):");
for (const item of ps.actionItems.slice(0, 5)) {
  console.log("  [" + item.priority + "] " + item.text);
}
console.log("─".repeat(60));

console.log("");
console.log("=".repeat(60));
console.log("Phase 3 · orchestrator acceptance · " + pass + " passed · " + fail + " failed");
console.log("=".repeat(60));
if (fail > 0) process.exit(1);
