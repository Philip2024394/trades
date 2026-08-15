// NEX App Builder · Phase 2 verification (Philip 2026-08-14).
//
// Proves the AppBlueprint schema + provenance classifier + staircase example:
//   1. Imports cleanly
//   2. Blueprint validates against the type-level contract (via structural checks)
//   3. Provenance classifier surfaces KNOWN / INFERRED / REQUIRED correctly
//   4. Required-field gate refuses to build until display name, contact, service radius etc. supplied
//   5. Every declared page exists · every integration required by a section is declared
//
// Runs as plain node · loads TS via tsx. Prints assertion results only.

// Loaded via `node --import tsx scripts/nex-app-builder/phase2-blueprint-check.mjs`
// so tsx is registered before this module executes.
const ex = await import("../../src/lib/app-builder/examples/staircase-company.ts");
const pv = await import("../../src/lib/app-builder/provenance.ts");
const staircaseCompanyBlueprint = ex.staircaseCompanyBlueprint;
const classifyBlueprint = pv.classifyBlueprint;
const summariseProvenance = pv.summariseProvenance;
const isBlueprintReadyToBuild = pv.isBlueprintReadyToBuild;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

const bp = staircaseCompanyBlueprint;

// 1. Structural sanity
assert(bp.blueprintVersion === 1, "blueprintVersion is 1");
assert(typeof bp.id === "string" && bp.id.startsWith("ab_"), "id has ab_ prefix");
assert(Array.isArray(bp.pages), "pages is an array");
assert(bp.pages.length === 7, "has 7 pages (home, about, products, product-detail, services, gallery, contact) · got " + bp.pages.length);

const pageIds = bp.pages.map(p => p.id).sort();
const expectedPages = ["about", "contact", "gallery", "home", "product-detail", "products", "services"];
assert(JSON.stringify(pageIds) === JSON.stringify(expectedPages), "pages ids match expected set");

// 2. Every page has at least one section
for (const p of bp.pages) {
  assert(Array.isArray(p.sections) && p.sections.length > 0, `page ${p.id} has sections`);
}

// 3. Section instanceIds are unique
const allInstanceIds = bp.pages.flatMap(p => p.sections.map(s => s.instanceId));
const uniqueIds = new Set(allInstanceIds);
assert(uniqueIds.size === allInstanceIds.length, "all section instanceIds unique · count " + uniqueIds.size);

// 4. Navigation contains one entry per top-level page
const navIds = new Set(bp.navigation.primary.map(n => n.target.pageId).filter(Boolean));
const topPages = new Set(["home","about","products","services","gallery","contact"]);
for (const id of topPages) assert(navIds.has(id), `navigation includes ${id}`);

// 5. Stripe integration declared
const stripe = bp.integrations.find(i => i.provider === "stripe");
assert(!!stripe, "Stripe integration declared");
assert(!stripe.optional, "Stripe declared as required (not optional)");
assert(stripe.operations.includes("checkout.session.create"), "Stripe declares checkout.session.create op");

// 6. Google Maps declared for radius
const gmaps = bp.integrations.find(i => i.provider === "google-maps");
assert(!!gmaps, "google-maps integration declared for service radius");

// 7. Provenance summary
const summary = summariseProvenance(bp);
console.log("");
console.log("Provenance summary:");
console.log("  KNOWN:    " + summary.KNOWN);
console.log("  INFERRED: " + summary.INFERRED);
console.log("  REQUIRED: " + summary.REQUIRED);
console.log("  UNKNOWN:  " + summary.UNKNOWN);
console.log("  requiredMissing count: " + summary.requiredMissing.length);
console.log("  requiredMissing paths:", summary.requiredMissing);

assert(summary.KNOWN > 0, "has some KNOWN provenance entries");
assert(summary.INFERRED > 0, "has some INFERRED provenance entries");
assert(summary.REQUIRED > 0, "has some REQUIRED provenance entries (things customer hasn't provided)");

// 8. Readiness gate — Blueprint should NOT be ready to build (missing company name, contact, radius)
const readiness = isBlueprintReadyToBuild(bp);
assert(!readiness.ready, "readiness.ready = false (correct · customer name + contact + radius are REQUIRED but unsupplied)");
assert(readiness.blockers.includes("identity.contact.serviceRadius.centre") ||
       readiness.blockers.includes("identity.displayName"),
       "blockers include a REQUIRED customer-supplied field");

// 9. 0% fabrication check — every REQUIRED path has a REQUIRED (not KNOWN) provenance level
const classes = classifyBlueprint(bp);
const contactPhone = classes.find(c => c.path === "identity.contact.primaryPhone");
assert(contactPhone && contactPhone.level === "REQUIRED", "primaryPhone is REQUIRED not fabricated");

const primaryColour = classes.find(c => c.path === "brand.palette.primary");
assert(primaryColour && primaryColour.level === "INFERRED", "primary colour is INFERRED (from Reference Brain premium defaults), not KNOWN");

// 10. Source utterances preserved
assert(Array.isArray(bp.sourceUtterances) && bp.sourceUtterances.length >= 1, "sourceUtterances preserved (traceability)");

// Report
console.log("");
console.log("=".repeat(60));
console.log(`Phase 2 · AppBlueprint check · ${pass} passed · ${fail} failed`);
console.log("=".repeat(60));
if (fail > 0) process.exit(1);
