#!/usr/bin/env node
// Backfill merchant_category for existing hammerex_xrated_products rows
// where it's still NULL. Uses a keyword heuristic on the product name —
// merchants can then override any miscategorisation from the product
// editor.
//
// Run: node scripts/backfill-merchant-categories.mjs
// Env required:
//   NEXT_PUBLIC_SUPABASE_URL   (read from .env.local)
//   SUPABASE_SERVICE_ROLE_KEY  (read from .env.local)
// Dry-run by default. Pass --apply to write.

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";

function loadEnv(path) {
  const out = {};
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* ignore */
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  exit(1);
}

const APPLY = argv.includes("--apply");

// Keyword → category. Order matters — first match wins, so put more
// specific patterns above generic ones (e.g. "concrete block" before
// plain "concrete").
const RULES = [
  // Specific composites first
  { re: /\b(concrete|aircrete|breeze)\s*block/i, cat: "bricks_blocks" },
  { re: /\b(roof\s*tile|slate|ridge\s*tile)\b/i, cat: "roof_tiles" },
  { re: /\b(damp\s*proof|dpc|membrane|vapour\s*barrier)\b/i, cat: "other" },
  // Single-word matches
  { re: /\b(paint|emulsion|gloss|satinwood|primer|undercoat)\b/i, cat: "paint" },
  { re: /\b(wallpaper|wall\s*paper|lining\s*paper)\b/i, cat: "wallpaper" },
  { re: /\b(laminate|lvt|engineered\s*wood|vinyl|carpet)\b/i, cat: "flooring" },
  { re: /\b(floor\s*board|floorboard|underlay|beading)\b/i, cat: "flooring" },
  { re: /\btile\b/i, cat: "tiles" },
  { re: /\b(ballast|gravel|pebbles?|sharp\s*sand|building\s*sand|mot\s*type|aggregate|sub.?base)\b/i, cat: "aggregates" },
  { re: /\bconcrete\b/i, cat: "concrete" },
  { re: /\b(mortar|cement|lime)\b/i, cat: "mortar" },
  { re: /\b(brick|block)\b/i, cat: "bricks_blocks" },
  { re: /\b(plasterboard|drywall|dry.?lining|skim)\b/i, cat: "plasterboard" },
  { re: /\b(insulation|pir|kingspan|celotex|rockwool|loft\s*roll)\b/i, cat: "insulation" },
  { re: /\b(decking|deck\s*board|deck\s*joist)\b/i, cat: "decking" },
  { re: /\b(fence|fencing|gravel\s*board|post)\b/i, cat: "fencing" },
  { re: /\b(paving|patio\s*slab|setts?|flag\s*stone)\b/i, cat: "paving" },
  { re: /\b(skirting|coving|architrave|cornice)\b/i, cat: "skirting" },
  { re: /\brender\b/i, cat: "render" },
  { re: /\b(turf|topsoil|mulch)\b/i, cat: "turf" },
  { re: /\b(hammer|saw|drill|level|trowel|spirit\s*level|chisel)\b/i, cat: "hand_tools" },
  { re: /\b(screw|nail|bolt|hanger|fixing|wall\s*plug|bracket)\b/i, cat: "fixings" }
];

function categorise(name) {
  for (const r of RULES) if (r.re.test(name)) return r.cat;
  return "other";
}

async function rest(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {})
    }
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${path} → ${r.status}: ${text}`);
  }
  return r.json();
}

const rows = await rest(
  "/hammerex_xrated_products?merchant_category=is.null&select=id,name&limit=2000"
);
console.log(`Found ${rows.length} uncategorised product rows.`);

const plan = rows.map((r) => ({ id: r.id, name: r.name, cat: categorise(r.name) }));
const summary = plan.reduce((acc, p) => {
  acc[p.cat] = (acc[p.cat] ?? 0) + 1;
  return acc;
}, {});
console.log("\nProposed assignments:");
for (const [cat, n] of Object.entries(summary).sort()) {
  console.log(`  ${cat.padEnd(16)} ${n}`);
}
console.log();
for (const p of plan) {
  console.log(`  [${p.cat.padEnd(14)}] ${p.name.slice(0, 70)}`);
}

if (!APPLY) {
  console.log("\nDry-run — pass --apply to write.");
  exit(0);
}

let updated = 0;
for (const p of plan) {
  await rest(`/hammerex_xrated_products?id=eq.${p.id}`, {
    method: "PATCH",
    body: JSON.stringify({ merchant_category: p.cat })
  });
  updated += 1;
}
console.log(`\nUpdated ${updated} rows.`);
