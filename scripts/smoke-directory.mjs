#!/usr/bin/env node
// scripts/smoke-directory.mjs
//
// Founder Phase 27 · P27-4 · NEX Directory regression.
//
// Verifies:
//   A · GET /api/nex/directory?q=hotel returns cards[] + counts
//   B · every card carries required fields (ref_id, title, doctrine_6_label, trust_layer, product_count)
//   C · missing q → 400 missing_query
//   D · verified_only filter drops unconfirmed
//   E · GET /api/nex/directory/[ref_id] returns detail + products[]
//   F · unknown ref_id → 404
//   G · doctrine_note names Doctrine #6
//   H · /nex/directory page renders 200 with brand + cards-grid marker
//   I · page contains card-toggle markers (expand affordance) + view-website marker (in JS)
//   J · counts.verified + counts.unconfirmed = cards.length

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function j(pth, opts = {}) {
  const res = await fetch(`${HOST}${pth}`, opts);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body };
}

// ══ A · basic listing
console.log("\n══ A · directory cards + counts");
let firstCard;
{
  const r = await j("/api/nex/directory?q=hotel");
  console.log(`  status=${r.status} cards=${r.body?.cards?.length} counts=${JSON.stringify(r.body?.counts)}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!Array.isArray(r.body?.cards)) failures.push({ case: "A", reason: "no_cards_array" });
  if ((r.body?.cards ?? []).length === 0) failures.push({ case: "A", reason: "empty_cards_for_hotel" });
  firstCard = r.body?.cards?.[0];
}

// ══ B · card shape
console.log("\n══ B · every card has required fields");
{
  const r = await j("/api/nex/directory?q=hotel");
  const required = ["ref_id", "title", "doctrine_6_label", "trust_layer", "product_count", "verified", "amenities_preview", "categories"];
  for (const c of (r.body?.cards ?? []).slice(0, 8)) {
    for (const k of required) {
      if (!(k in c)) { failures.push({ case: "B", reason: `missing_${k}` }); break; }
    }
    if (!Array.isArray(c.amenities_preview)) failures.push({ case: "B", reason: "amenities_preview_not_array" });
    if (!["verified", "unconfirmed"].includes(c.doctrine_6_label)) failures.push({ case: "B", reason: `bad_label_${c.doctrine_6_label}` });
  }
  console.log(`  checked=${Math.min(8, r.body?.cards?.length ?? 0)}`);
}

// ══ C · missing query
console.log("\n══ C · missing q → 400");
{
  const r = await j("/api/nex/directory");
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "C", reason: `status_${r.status}` });
}

// ══ D · verified_only
console.log("\n══ D · verified_only=1 excludes unconfirmed");
{
  const r = await j("/api/nex/directory?q=hotel&verified_only=1");
  const allV = (r.body?.cards ?? []).every((c) => c.verified === true && c.doctrine_6_label === "verified");
  console.log(`  cards=${r.body?.cards?.length} all_verified=${allV}`);
  if (!allV) failures.push({ case: "D", reason: "unconfirmed_leaked" });
}

// ══ E · listing detail with products
console.log("\n══ E · listing detail returns products[]");
{
  if (!firstCard) failures.push({ case: "E", reason: "no_first_card" });
  else {
    const r = await j(`/api/nex/directory/${encodeURIComponent(firstCard.ref_id)}`);
    console.log(`  status=${r.status} products=${r.body?.detail?.products?.length} amenities_full=${r.body?.detail?.amenities_full?.length}`);
    if (r.status !== 200) failures.push({ case: "E", reason: `status_${r.status}` });
    if (!Array.isArray(r.body?.detail?.products)) failures.push({ case: "E", reason: "no_products_array" });
    if (r.body?.detail?.ref_id !== firstCard.ref_id) failures.push({ case: "E", reason: "ref_mismatch" });
  }
}

// ══ F · unknown ref → 404
console.log("\n══ F · unknown ref → 404");
{
  const r = await j(`/api/nex/directory/${encodeURIComponent("accom:definitely-not-a-real-ref-xyz")}`);
  console.log(`  status=${r.status}`);
  if (r.status !== 404) failures.push({ case: "F", reason: `status_${r.status}` });
}

// ══ G · doctrine banner
console.log("\n══ G · doctrine_note names Doctrine #6");
{
  const r = await j("/api/nex/directory?q=hotel");
  const note = String(r.body?.doctrine_note ?? "").toLowerCase();
  console.log(`  names_d6=${/doctrine\s*#?\s*6/.test(note)}`);
  if (!/doctrine\s*#?\s*6/.test(note)) failures.push({ case: "G", reason: "d6_not_named" });
}

// ══ H · page renders
console.log("\n══ H · /nex/directory page renders + cards-grid marker");
{
  const r = await j("/nex/directory");
  console.log(`  status=${r.status} hasBrand=${r.text.includes("NEX")} hasGrid=${r.text.includes("data-cards-grid")}`);
  if (r.status !== 200) failures.push({ case: "H", reason: `status_${r.status}` });
  if (!r.text.includes("data-cards-grid")) failures.push({ case: "H", reason: "no_grid_marker" });
  if (!r.text.toLowerCase().includes("directory")) failures.push({ case: "H", reason: "no_brand" });
}

// ══ I · expand + website-view affordances present in bundle
console.log("\n══ I · JS bundle contains card-toggle + view-website markers");
{
  const html = (await j("/nex/directory")).text;
  const chunkMatch = html.match(/\/_next\/static\/[^"'\s]+\.(js|mjs)/g) ?? [];
  const uniq = [...new Set(chunkMatch)];
  let sawToggle = false, sawViewSite = false, sawBack = false;
  for (const url of uniq.slice(0, 25)) {
    try {
      const src = await (await fetch(`${HOST}${url}`)).text();
      if (/data-card-toggle/.test(src)) sawToggle = true;
      if (/data-view-website/.test(src)) sawViewSite = true;
      if (/data-back-to-directory/.test(src)) sawBack = true;
      if (sawToggle && sawViewSite && sawBack) break;
    } catch { /* ignore */ }
  }
  console.log(`  card-toggle=${sawToggle} view-website=${sawViewSite} back-btn=${sawBack}`);
  if (!sawToggle) failures.push({ case: "I", reason: "no_card_toggle" });
  if (!sawViewSite) failures.push({ case: "I", reason: "no_view_website" });
  if (!sawBack) failures.push({ case: "I", reason: "no_back_btn" });
}

// ══ J · counts math
console.log("\n══ J · counts.verified + counts.unconfirmed = cards.length");
{
  const r = await j("/api/nex/directory?q=hotel");
  const cards = r.body?.cards ?? [];
  const c = r.body?.counts ?? {};
  const sum = (c.verified ?? 0) + (c.unconfirmed ?? 0);
  console.log(`  cards=${cards.length} verified=${c.verified} unconfirmed=${c.unconfirmed} sum=${sum}`);
  if (sum !== cards.length) failures.push({ case: "J", reason: `sum_${sum}_vs_${cards.length}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · NEX Directory live · landscape cards · expand-in-place products · website-view floater · Doctrine #6 chips.");
  process.exit(0);
}
