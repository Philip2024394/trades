// NEX App Builder · Phase 6 verification (Philip 2026-08-14).
//
// Proves the Blueprint → existing-pipeline adapter materialises real
// pages with real registered sections — no fabrication, all pages of
// the staircase Blueprint resolve to actual sectionRegistry entries.
//
// Run: node --import tsx scripts/nex-app-builder/phase6-blueprint-to-pages.mjs

// Register every section so sectionRegistry is populated.
await import("../../src/lib/studio/sections/index.ts");

const bp_module = await import("../../src/lib/app-builder/examples/staircase-company.ts");
const adapter = await import("../../src/lib/app-builder/blueprint-to-pipeline.ts");

const bp = bp_module.staircaseCompanyBlueprint;
const result = adapter.assembleFromBlueprint(bp);

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

console.log("Blueprint · " + bp.name);
console.log("Blueprint pages: " + bp.pages.length);
console.log("Assembled pages: " + Object.keys(result.pages).length);
console.log("Unresolved sections: " + result.unresolved.length);
console.log("");

// 1. All 7 Blueprint pages materialised
const bpPageIds = bp.pages.map(p => p.id).sort();
const assembledPageIds = Object.keys(result.pages).sort();
assert(assembledPageIds.length === bpPageIds.length,
  `every Blueprint page materialised (${assembledPageIds.length}/${bpPageIds.length})`);
for (const pid of bpPageIds) {
  assert(result.pages[pid], `page "${pid}" materialised`);
}

// 2. Every page has at least one section
for (const pid of assembledPageIds) {
  const layout = result.pages[pid];
  assert(layout.sections.length > 0, `page "${pid}" has ${layout.sections.length} section(s)`);
}

// 3. All Blueprint SectionInstance.instanceId preserved (Blueprint provides stable ids)
const bpInstanceIds = new Set(bp.pages.flatMap(p => p.sections.map(s => s.instanceId)));
const assembledInstanceIds = new Set(Object.values(result.pages).flatMap(l => l.sections.map(s => s.instanceId)));
const preserved = [...bpInstanceIds].filter(id => assembledInstanceIds.has(id));
assert(preserved.length === bpInstanceIds.size,
  `all ${bpInstanceIds.size} Blueprint instanceIds preserved in assembled pages`);

// 4. All resolved registry ids are REAL sections (constitutional 0% fabrication check)
const secReg = await import("../../src/lib/studio/sectionRegistry.ts");
const realIds = new Set(secReg.sectionRegistry.ids());
for (const r of result.resolutions) {
  assert(realIds.has(r.resolvedRegistryId),
    `resolved ${r.requestedRegistryId} → ${r.resolvedRegistryId} exists in real registry (${r.strategy})`);
}

// 5. Report resolution strategies used
const byStrategy = { exact: 0, alias: 0, "library-fallback": 0 };
for (const r of result.resolutions) byStrategy[r.strategy]++;
console.log("");
console.log("Resolution strategies:");
console.log("  exact:            " + byStrategy.exact);
console.log("  alias:            " + byStrategy.alias);
console.log("  library-fallback: " + byStrategy["library-fallback"]);

// 6. Every page in Blueprint's navigation.primary is materialised
const navPageIds = bp.navigation.primary
  .map(n => n.target.pageId)
  .filter(Boolean);
for (const nid of navPageIds) {
  assert(result.pages[nid], `nav-referenced page "${nid}" materialised`);
}

// 7. Data bindings preserved in section config (Blueprint's data.source flows through)
const productsPage = result.pages["products"];
const productsGridSection = productsPage?.sections.find(s => s.key.startsWith("product_grid"));
assert(
  !!productsGridSection && !!productsGridSection.config.__nex_data,
  "products page's product_grid section carries __nex_data binding through the adapter"
);

// 8. Actions preserved (Stripe checkout ref on product-detail page)
const productDetailPage = result.pages["product-detail"];
const detailSection = productDetailPage?.sections[0];
assert(
  !!detailSection && !!detailSection.config.__nex_actions,
  "product-detail section carries __nex_actions (Stripe checkout binding)"
);

// 9. Nothing unresolved — every section resolved to something real
assert(result.unresolved.length === 0,
  `0 unresolved sections (got ${result.unresolved.length})`);
if (result.unresolved.length > 0) {
  for (const u of result.unresolved) {
    console.error("  unresolved:", u);
  }
}

// 10. Section count matches Blueprint (nothing silently dropped)
const bpSectionCount = bp.pages.reduce((n, p) => n + p.sections.length, 0);
const assembledSectionCount = Object.values(result.pages).reduce((n, l) => n + l.sections.length, 0);
assert(assembledSectionCount === bpSectionCount,
  `assembled ${assembledSectionCount} sections · Blueprint has ${bpSectionCount} · no silent drops`);

// Summary
console.log("");
console.log("=".repeat(60));
console.log(`Phase 6 · Blueprint → pipeline adapter · ${pass} passed · ${fail} failed`);
console.log("=".repeat(60));
if (fail > 0) process.exit(1);
