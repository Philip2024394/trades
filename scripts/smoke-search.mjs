#!/usr/bin/env node
// scripts/smoke-search.mjs
//
// Founder Phase 26 · P26-3 · NEX Search regression.
//
// Verifies:
//   A · GET /api/nex/search?q= returns 200 with results array + counts
//   B · every result carries required fields (ref_id, doctrine_6_label, trust_layer, verified)
//   C · every doctrine_6_label ∈ {"verified","unconfirmed"}
//   D · every trust_layer ∈ known set
//   E · GET with missing q → 400 missing_query
//   F · verified_only=1 filter returns only results where verified=true
//   G · POST body works identically to GET
//   H · doctrine_note names Doctrine #6 + "verified|unconfirmed"
//   I · /nex/search page renders 200 with brand + doctrine footer
//   J · counts.verified + counts.unconfirmed = results.length

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function j(pth, opts = {}) {
  const res = await fetch(`${HOST}${pth}`, opts);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body };
}
async function post(pth, body) {
  return j(pth, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// ══ Seed a conversation so we're guaranteed to have at least one indexed row ══
{
  const cid = randomUUID();
  const marker = `bluewhale-${randomUUID().slice(0, 6)}`;
  // Signup + post a message so FTS has something
  const jar = { header: () => "", cookies: new Map() };
  const signupRes = await fetch(`${HOST}/api/nex/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: `p26-${randomUUID().slice(0, 6)}` }),
  });
  const setCookie = signupRes.headers.get("set-cookie") ?? "";
  const cookieHeader = setCookie.split(/,\s*(?=[^ ]+=)/).map((c) => c.match(/^([^=]+)=([^;]*)/))
    .filter(Boolean).map((m) => `${m[1]}=${m[2]}`).join("; ");
  await fetch(`${HOST}/api/nex/conversations/${cid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ role: "user", content: `Hello — this is a NEX search seed marker: ${marker}` }),
  });
  await new Promise((r) => setTimeout(r, 300));

  // ══ A · basic search
  console.log("\n══ A · GET /api/nex/search returns 200 + results + counts");
  const r = await j(`/api/nex/search?q=${encodeURIComponent(marker)}`);
  console.log(`  status=${r.status} results=${r.body?.results?.length} counts=${JSON.stringify(r.body?.counts)}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!Array.isArray(r.body?.results)) failures.push({ case: "A", reason: "no_results_array" });
  if (!r.body?.counts) failures.push({ case: "A", reason: "no_counts" });
  if ((r.body?.results?.length ?? 0) < 1) failures.push({ case: "A", reason: "seed_not_found" });
}

// ══ B · result shape
console.log("\n══ B · every result has required fields");
{
  const r = await j("/api/nex/search?q=hotel");
  const results = r.body?.results ?? [];
  const required = ["ref_id", "doctrine_6_label", "trust_layer", "verified", "kind", "title", "snippet"];
  for (const res of results.slice(0, 8)) {
    for (const k of required) {
      if (!(k in res)) { failures.push({ case: "B", reason: `missing_${k}_in_${res.ref_id ?? "?"}` }); break; }
    }
  }
  console.log(`  checked=${Math.min(8, results.length)} of ${results.length}`);
}

// ══ C · doctrine_6_label enum
console.log("\n══ C · doctrine_6_label ∈ {verified,unconfirmed}");
{
  const r = await j("/api/nex/search?q=hotel");
  for (const res of r.body?.results ?? []) {
    if (!["verified", "unconfirmed"].includes(res.doctrine_6_label)) {
      failures.push({ case: "C", reason: `bad_label_${res.doctrine_6_label}_in_${res.ref_id}` });
    }
  }
  console.log(`  all_labels_ok=${(r.body?.results ?? []).every((x) => ["verified", "unconfirmed"].includes(x.doctrine_6_label))}`);
}

// ══ D · trust_layer enum
console.log("\n══ D · trust_layer ∈ known set");
{
  const known = new Set(["canonical_verified", "canonical_authoritative", "provisional", "unknown"]);
  const r = await j("/api/nex/search?q=hotel");
  for (const res of r.body?.results ?? []) {
    if (!known.has(res.trust_layer)) failures.push({ case: "D", reason: `bad_layer_${res.trust_layer}` });
  }
  console.log(`  ok=${(r.body?.results ?? []).every((x) => known.has(x.trust_layer))}`);
}

// ══ E · missing query
console.log("\n══ E · missing q → 400 missing_query");
{
  const r = await j("/api/nex/search");
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "E", reason: `status_${r.status}` });
  if (r.body?.error !== "missing_query") failures.push({ case: "E", reason: `err_${r.body?.error}` });
}

// ══ F · verified_only filter
console.log("\n══ F · verified_only=1 filters out unconfirmed");
{
  const r = await j("/api/nex/search?q=hotel&verified_only=1");
  const all_verified = (r.body?.results ?? []).every((res) => res.verified === true && res.doctrine_6_label === "verified");
  console.log(`  results=${r.body?.results?.length} all_verified=${all_verified}`);
  if (!all_verified) failures.push({ case: "F", reason: "unconfirmed_leaked" });
}

// ══ G · POST equivalence
console.log("\n══ G · POST returns same shape as GET");
{
  const g = await j("/api/nex/search?q=hotel");
  const p = await post("/api/nex/search", { q: "hotel" });
  const gKeys = Object.keys(g.body ?? {}).sort();
  const pKeys = Object.keys(p.body ?? {}).sort();
  console.log(`  get_keys=${gKeys.length} post_keys=${pKeys.length}`);
  if (gKeys.join(",") !== pKeys.join(",")) failures.push({ case: "G", reason: `keys_differ` });
}

// ══ H · doctrine banner
console.log("\n══ H · doctrine_note names Doctrine #6 + verified/unconfirmed");
{
  const r = await j("/api/nex/search?q=hotel");
  const note = String(r.body?.doctrine_note ?? "").toLowerCase();
  const namedD6 = /doctrine\s*#?\s*6/.test(note);
  const namedLabels = note.includes("verified") && note.includes("unconfirmed");
  console.log(`  doctrine_6=${namedD6} labels_mentioned=${namedLabels}`);
  if (!namedD6) failures.push({ case: "H", reason: "d6_not_named" });
  if (!namedLabels) failures.push({ case: "H", reason: "labels_not_named" });
}

// ══ I · page renders
console.log("\n══ I · /nex/search page renders 200 with brand + doctrine footer");
{
  const r = await j("/nex/search");
  const text = r.text;
  const hasBrand = text.includes("NEX") && text.toLowerCase().includes("search");
  const hasDoctrine = text.toLowerCase().includes("doctrine #6") || text.toLowerCase().includes("truth or unconfirmed");
  console.log(`  status=${r.status} brand=${hasBrand} doctrine_footer=${hasDoctrine}`);
  if (r.status !== 200) failures.push({ case: "I", reason: `status_${r.status}` });
  if (!hasBrand) failures.push({ case: "I", reason: "no_brand" });
  if (!hasDoctrine) failures.push({ case: "I", reason: "no_doctrine_footer" });
}

// ══ J · counts math
console.log("\n══ J · counts.verified + counts.unconfirmed = results.length");
{
  const r = await j("/api/nex/search?q=hotel");
  const results = r.body?.results ?? [];
  const c = r.body?.counts ?? {};
  const sum = (c.verified ?? 0) + (c.unconfirmed ?? 0);
  console.log(`  results=${results.length} verified=${c.verified} unconfirmed=${c.unconfirmed} sum=${sum}`);
  if (sum !== results.length) failures.push({ case: "J", reason: `sum_${sum}_vs_${results.length}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · NEX Search live · Doctrine #6 chip on every result · Google-style page renders.");
  process.exit(0);
}
