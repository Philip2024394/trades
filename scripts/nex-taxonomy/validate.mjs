#!/usr/bin/env node
// scripts/nex-taxonomy/validate.mjs · Philip 2026-09-05
//
// NEX Universal Taxonomy · T0 Validation Script
//
// Runs every check from Philip's T0 authorization §36 against the canonical
// taxonomy specification in `data/nex-taxonomy/v1/`. Exit 0 = all pass,
// Exit 1 = any failure (with structured report of what failed).
//
// Usage:  node scripts/nex-taxonomy/validate.mjs
//
// This script has ZERO runtime dependency on the application. It reads
// JSON from disk and validates. No DB · no network · no env access.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const TAXONOMY_ROOT = path.resolve(__dirname, "..", "..", "data", "nex-taxonomy", "v1");

// ── Terminal colour helpers ───────────────────────────────────────────

const isTTY = process.stdout.isTTY;
const c = {
  reset: isTTY ? "\x1b[0m" : "",
  green: isTTY ? "\x1b[32m" : "",
  red:   isTTY ? "\x1b[31m" : "",
  yellow:isTTY ? "\x1b[33m" : "",
  dim:   isTTY ? "\x1b[2m" : "",
  bold:  isTTY ? "\x1b[1m" : "",
};
const PASS = `${c.green}✓${c.reset}`;
const FAIL = `${c.red}✗${c.reset}`;
const WARN = `${c.yellow}⚠${c.reset}`;

// ── State ─────────────────────────────────────────────────────────────

const checks = []; // { name, ok, detail }
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  const glyph = ok ? PASS : FAIL;
  const suffix = detail ? ` ${c.dim}${detail}${c.reset}` : "";
  console.log(`  ${glyph} ${name}${suffix}`);
}

function section(title) {
  console.log(`\n${c.bold}${title}${c.reset}`);
}

// ── Load JSON ─────────────────────────────────────────────────────────

function loadJson(name) {
  const p = path.join(TAXONOMY_ROOT, name);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    console.error(`${FAIL} Failed to load ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log(`${c.bold}NEX Universal Taxonomy · T0 Validation${c.reset}`);
console.log(`${c.dim}Reading from: ${TAXONOMY_ROOT}${c.reset}\n`);

const metadata   = loadJson("metadata.json");
const industries = loadJson("industries.json");
const products   = loadJson("products.json");
const services   = loadJson("services.json");
const roles      = loadJson("roles.json");
const markets    = loadJson("markets.json");
const examples   = loadJson("examples.json");

const dimensions = {
  industry: industries.nodes,
  product:  products.nodes,
  service:  services.nodes,
  role:     roles.nodes,
  market:   markets.nodes,
};

const brainVocabulary = new Set(metadata.brain_domain_vocabulary);

// ── §36.1  Industry count matches target ──────────────────────────────

section("Industry count");
check(
  `45 top-level industries (target ${industries.count_target})`,
  industries.nodes.length === industries.count_target && industries.count_target === 45,
  `have ${industries.nodes.length}`,
);

// ── §36.2  No duplicate `id` within a dimension ───────────────────────

section("Duplicate IDs within each dimension");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const seen = new Set();
  const dups = [];
  for (const n of nodes) {
    if (seen.has(n.id)) dups.push(n.id);
    seen.add(n.id);
  }
  check(`[${dim}] no duplicate ids`, dups.length === 0, dups.length ? `dup: ${dups.join(", ")}` : `${nodes.length} nodes unique`);
}

// ── §36.3  No duplicate `slug` within a dimension ─────────────────────

section("Duplicate slugs within each dimension");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const seen = new Set();
  const dups = [];
  for (const n of nodes) {
    if (seen.has(n.slug)) dups.push(n.slug);
    seen.add(n.slug);
  }
  check(`[${dim}] no duplicate slugs`, dups.length === 0, dups.length ? `dup: ${dups.join(", ")}` : "");
}

// ── §36.4  No cycles in parent_id chains ──────────────────────────────

section("No cycles in parent_id chains");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const idMap = new Map(nodes.map((n) => [n.id, n]));
  const cycles = [];
  for (const n of nodes) {
    const visited = new Set();
    let cur = n;
    while (cur && cur.parent_id) {
      if (visited.has(cur.id)) { cycles.push(n.id); break; }
      visited.add(cur.id);
      cur = idMap.get(cur.parent_id);
    }
  }
  check(`[${dim}] no cycles`, cycles.length === 0, cycles.length ? `cycles at: ${cycles.join(", ")}` : "");
}

// ── §36.5  No orphan nodes (parent_id → non-existent) ─────────────────

section("No orphan nodes (parent_id must exist in same dimension)");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const idSet = new Set(nodes.map((n) => n.id));
  const orphans = nodes.filter((n) => n.parent_id !== null && !idSet.has(n.parent_id));
  check(`[${dim}] no orphans`, orphans.length === 0, orphans.length ? `orphan(s): ${orphans.map((n) => n.id).join(", ")}` : "");
}

// ── §36.6  Depth consistency (depth = ancestor count + 1) ─────────────

section("Depth consistency");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const idMap = new Map(nodes.map((n) => [n.id, n]));
  const bad = [];
  for (const n of nodes) {
    let depth = 1;
    let cur = n;
    while (cur.parent_id) {
      cur = idMap.get(cur.parent_id);
      if (!cur) break;
      depth++;
      if (depth > 10) break; // cycle safety · already checked separately
    }
    if (depth !== n.depth) bad.push(`${n.id} (stated ${n.depth}, actual ${depth})`);
  }
  check(`[${dim}] depth matches ancestor count`, bad.length === 0, bad.length ? `mismatch: ${bad.slice(0, 5).join("; ")}${bad.length > 5 ? "..." : ""}` : "");
}

// ── §36.7 / .8 / .9  Cross-dimension parent_id separation ─────────────

section("Product / Service / Role / Market dimension separation");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const otherIds = new Set();
  for (const [d2, n2s] of Object.entries(dimensions)) {
    if (d2 === dim) continue;
    for (const n of n2s) otherIds.add(n.id);
  }
  const bleed = nodes.filter((n) => n.parent_id !== null && otherIds.has(n.parent_id));
  check(`[${dim}] no parent_id crosses into another dimension`, bleed.length === 0, bleed.length ? `bleed: ${bleed.map((n) => n.id).join(", ")}` : "");
}

// ── §36.10  Valid i18n_key format ─────────────────────────────────────

section("i18n_key format (taxonomy.{domain}.{slug} · slug may already contain the domain prefix)");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const bad = nodes.filter((n) => {
    // Two accepted patterns:
    //   A) slug has no domain prefix           → key = `taxonomy.{domain}.{slug}`
    //   B) slug already begins with `{domain}.` → key = `taxonomy.{slug}`
    // Both preserve `taxonomy.{domain}...` namespace root uniquely.
    const patternA = `taxonomy.${n.domain}.${n.slug}`;
    const patternB = `taxonomy.${n.slug}`;
    const slugHasDomainPrefix = n.slug === n.domain || n.slug.startsWith(`${n.domain}.`);
    return slugHasDomainPrefix ? (n.i18n_key !== patternB) : (n.i18n_key !== patternA);
  });
  check(`[${dim}] all i18n_keys well-formed`, bad.length === 0, bad.length ? `bad: ${bad.slice(0, 3).map((n) => `${n.id} → ${n.i18n_key}`).join("; ")}` : "");
}

// ── §36.11  brain_domain_hints reference canonical vocabulary ─────────

section("brain_domain_hints reference canonical vocabulary");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const bad = [];
  for (const n of nodes) {
    const hints = Array.isArray(n.brain_domain_hints) ? n.brain_domain_hints : [];
    const invalid = hints.filter((h) => !brainVocabulary.has(h));
    if (invalid.length) bad.push(`${n.id} → [${invalid.join(", ")}]`);
  }
  check(`[${dim}] all brain_domain_hints in metadata vocabulary`, bad.length === 0, bad.length ? `invalid: ${bad.slice(0, 3).join("; ")}` : "");
}

// ── §36.12  All 20 architectural examples resolve ─────────────────────

section("All 20 architectural example classifications resolve");
const allIndustryIds = new Set(industries.nodes.map((n) => n.id));
const allRoleIds     = new Set(roles.nodes.map((n) => n.id));
const allProductIds  = new Set(products.nodes.map((n) => n.id));
const allServiceIds  = new Set(services.nodes.map((n) => n.id));
const allMarketIds   = new Set(markets.nodes.map((n) => n.id));

check(`example count = ${examples.count_target}`, examples.examples.length === examples.count_target, `have ${examples.examples.length}`);

for (const ex of examples.examples) {
  const problems = [];

  if (!allIndustryIds.has(ex.business_industry.primary)) {
    problems.push(`primary industry ${ex.business_industry.primary} unknown`);
  }
  for (const s of ex.business_industry.secondary || []) {
    if (!allIndustryIds.has(s)) problems.push(`secondary industry ${s} unknown`);
  }
  for (const r of ex.business_roles || []) {
    if (!allRoleIds.has(r)) problems.push(`role ${r} unknown`);
  }
  for (const p of ex.products || []) {
    if (!allProductIds.has(p.id)) problems.push(`product ${p.id} unknown`);
  }
  for (const s of ex.services || []) {
    if (!allServiceIds.has(s.id)) problems.push(`service ${s.id} unknown`);
  }
  for (const m of ex.target_markets || []) {
    if (!allMarketIds.has(m)) problems.push(`market ${m} unknown`);
  }
  for (const b of ex.brain_domain_expected || []) {
    if (!brainVocabulary.has(b)) problems.push(`brain domain ${b} not in vocabulary`);
  }

  check(`${ex.example_id} (${ex.business_name})`, problems.length === 0, problems.length ? problems.slice(0, 3).join(" | ") : "");
}

// ── §36.15  Multi-vertical examples work ──────────────────────────────

section("Multi-vertical / multi-role example spot-checks");
const multiIndustry = examples.examples.filter((e) => (e.business_industry.secondary || []).length > 0);
const multiRole     = examples.examples.filter((e) => (e.business_roles || []).length > 1);
const productAndService = examples.examples.filter((e) => (e.products || []).length > 0 && (e.services || []).length > 0);
const multiMarket   = examples.examples.filter((e) => (e.target_markets || []).length > 1);
check(`≥3 multi-industry examples`, multiIndustry.length >= 3, `have ${multiIndustry.length}`);
check(`≥3 multi-role examples`, multiRole.length >= 3, `have ${multiRole.length}`);
check(`≥3 product+service examples`, productAndService.length >= 3, `have ${productAndService.length}`);
check(`≥4 multi-market examples`, multiMarket.length >= 4, `have ${multiMarket.length}`);

// ── §36.16-.20  Anti-pattern name checks ──────────────────────────────

section("Anti-pattern name checks (variants/attributes/incoterms/locations/promotions never taxonomy)");

// Words that must NEVER appear as their own taxonomy slug segments · reserved concepts
const forbidden = {
  variants: ["small", "medium", "large", "xl", "500g", "1kg", "10kg", "20kg", "size_40", "size_41", "size_42", "black_color", "white_color"],
  incoterms: ["fob", "cif", "exw", "fca", "cfr"],
  currencies: ["idr", "jpy", "usd", "eur", "gbp", "sgd", "aud"],
  locations:  ["yogyakarta", "jakarta", "tokyo", "osaka", "tanjung_priok"],
  promotions: ["promo", "promotion", "discount_20", "sale_off"],
};

for (const [category, badWords] of Object.entries(forbidden)) {
  const violations = [];
  for (const [dim, nodes] of Object.entries(dimensions)) {
    for (const n of nodes) {
      const segments = n.slug.split(".").flatMap((s) => s.split("_"));
      const matched = segments.filter((seg) => badWords.includes(seg.toLowerCase()));
      if (matched.length) violations.push(`[${dim}] ${n.slug} contains: ${matched.join(", ")}`);
    }
  }
  check(`no ${category} in taxonomy slugs`, violations.length === 0, violations.length ? violations.slice(0, 2).join("; ") : "");
}

// ── §36.21  Version consistency (deprecated → replacement_id set) ─────

section("Version field consistency");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const bad = [];
  for (const n of nodes) {
    const status = n.status;
    if (status === "deprecated" || status === "replaced") {
      if (!n.replacement_id) bad.push(`${n.id} status=${status} but replacement_id missing`);
    }
    if (n.version_deprecated != null && !n.replacement_id) {
      bad.push(`${n.id} has version_deprecated but no replacement_id`);
    }
  }
  check(`[${dim}] deprecated nodes have replacement_id`, bad.length === 0, bad.length ? bad.join("; ") : "");
}

// ── Extra: label_i18n.en === label_en (consistency) ───────────────────

section("label_i18n.en matches label_en");
for (const [dim, nodes] of Object.entries(dimensions)) {
  const bad = nodes.filter((n) => (n.label_i18n?.en ?? "") !== n.label_en);
  check(`[${dim}] label_i18n.en consistency`, bad.length === 0, bad.length ? `mismatch: ${bad.slice(0, 3).map((n) => n.id).join(", ")}` : "");
}

// ── Extra: markets have ISO alpha-2 or INTL sentinel ──────────────────

section("Markets use ISO 3166-1 alpha-2 (or INTL sentinel)");
const badMarkets = markets.nodes.filter((m) => {
  if (m.id === "INTL") return m.iso_alpha2 !== null;
  return typeof m.iso_alpha2 !== "string" || m.iso_alpha2.length !== 2 || m.iso_alpha2 !== m.id;
});
check(`markets validly formed`, badMarkets.length === 0, badMarkets.length ? badMarkets.map((m) => m.id).join(", ") : "");

// ── Extra: Japan is first_class ───────────────────────────────────────

section("Japan first-class");
const jp = markets.nodes.find((m) => m.id === "JP");
check(`Japan (JP) exists`, !!jp);
check(`Japan first_class === true`, jp?.first_class === true, `first_class=${jp?.first_class}`);

// ── Summary ───────────────────────────────────────────────────────────

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok).length;
const total  = checks.length;

console.log(`\n${c.bold}Summary${c.reset}`);
console.log(`  ${passed}/${total} passed`);
if (failed > 0) {
  console.log(`  ${c.red}${failed} failed${c.reset}`);
  for (const f of checks.filter((c) => !c.ok)) {
    console.log(`    ${FAIL} ${f.name}${f.detail ? ` · ${c.dim}${f.detail}${c.reset}` : ""}`);
  }
  console.log(`\n${c.red}${c.bold}T0 VALIDATION FAILED${c.reset}`);
  process.exit(1);
}

console.log(`\n${c.green}${c.bold}T0 VALIDATION PASSED${c.reset}`);
console.log(`${c.dim}Nodes: industries=${industries.nodes.length} products=${products.nodes.length} services=${services.nodes.length} roles=${roles.nodes.length} markets=${markets.nodes.length} · Examples: ${examples.examples.length}${c.reset}`);
process.exit(0);
