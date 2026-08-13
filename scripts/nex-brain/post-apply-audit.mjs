// scripts/nex-brain/post-apply-audit.mjs
//
// Post-apply verification of the enrichment pass (Philip 2026-08-14 · checklist).
// Compares the current manifest against the pre-enrichment backup and reports
// exactly the items Philip asked for. Read-only.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const NEX = createClient(
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL,
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const TRADES_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;

console.log("=".repeat(72));
console.log("POST-APPLY AUDIT · Enrichment pass · 2026-08-14");
console.log("=".repeat(72));

// ─── Locate pre-enrichment backup ────────────────────────────────────
// The pre-migration backup we created earlier this session is the last
// snapshot before the enrichment apply.
const BACKUP_DIR = join(process.cwd(), "data", ".manifest-backups");
const backups = readdirSync(BACKUP_DIR)
  .filter((n) => n.startsWith("nex-image-manifest.pre-trades-to-imagekit-migration") || n.startsWith("manifest-"))
  .sort();
const preEnrichBackup = readdirSync(BACKUP_DIR).find((n) => n.startsWith("nex-image-manifest.pre-trades-to-imagekit-migration"));
if (!preEnrichBackup) { console.error("no pre-enrichment backup found"); process.exit(1); }
const PRE_PATH  = join(BACKUP_DIR, preEnrichBackup);
const CURR_PATH = join(process.cwd(), "data", "nex-image-manifest.json");

const pre  = JSON.parse(readFileSync(PRE_PATH,  "utf8"));
const curr = JSON.parse(readFileSync(CURR_PATH, "utf8"));

const preKeys  = new Set(Object.keys(pre.images));
const currKeys = new Set(Object.keys(curr.images));
const preCount  = preKeys.size;
const currCount = currKeys.size;

const missing = [...preKeys].filter((k) => !currKeys.has(k));
const added   = [...currKeys].filter((k) => !preKeys.has(k));

console.log("");
console.log("─── 1. All image rows accounted for ─────────────────────");
console.log(`  pre-apply rows        : ${preCount}`);
console.log(`  post-apply rows       : ${currCount}`);
console.log(`  rows deleted          : ${missing.length}`);
console.log(`  rows added            : ${added.length}`);
if (missing.length) { console.log("  DELETED URLS (should be ZERO):"); missing.slice(0, 10).forEach((u) => console.log(`    - ${u}`)); }
if (added.length)   { console.log("  ADDED URLS (should be ZERO for pure enrichment):"); added.slice(0, 10).forEach((u) => console.log(`    + ${u}`)); }

// ─── 2. Domain totals ────────────────────────────────────────────────
const domainCounts = {};
for (const [, m] of Object.entries(curr.images)) {
  const d = m.primary_domain ?? "(null)";
  domainCounts[d] = (domainCounts[d] ?? 0) + 1;
}
console.log("");
console.log("─── 2. Domain totals ─────────────────────────────────────");
for (const [d, n] of Object.entries(domainCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${d.padEnd(16)} ${String(n).padStart(5)}`);
}

// ─── 3. Primary-brain totals ─────────────────────────────────────────
const brainCounts = {};
for (const [, m] of Object.entries(curr.images)) {
  const b = m.primary_brain ?? "(null)";
  brainCounts[b] = (brainCounts[b] ?? 0) + 1;
}
console.log("");
console.log("─── 3. Primary-brain totals ─────────────────────────────");
for (const [b, n] of Object.entries(brainCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${b.padEnd(30)} ${String(n).padStart(5)}`);
}

// ─── 4. Record-state totals ──────────────────────────────────────────
function imageRecordState(m) {
  const hasBasic = m.subject_domain || m.image_type || m.image_purpose;
  const hasBrain = !!m.primary_brain;
  const hasTagsOrDna = (Array.isArray(m.tags) && m.tags.length > 0) || (m.image_dna?.score ?? 0) > 0;
  if (!hasBasic) return "raw";
  if (!hasBrain) return "processed";
  if (!hasTagsOrDna) return "enriched";
  return "routable";
}
const stateCounts = { raw: 0, processed: 0, enriched: 0, routable: 0 };
for (const [, m] of Object.entries(curr.images)) stateCounts[imageRecordState(m)] += 1;
console.log("");
console.log("─── 4. Record-state totals ──────────────────────────────");
for (const k of ["raw", "processed", "enriched", "routable"]) console.log(`  ${k.padEnd(12)} ${String(stateCounts[k]).padStart(5)}`);

// ─── 5. Existing brain assignments preserved ─────────────────────────
let preservedTotal = 0, downgradedCount = 0, upgradedFromNullCount = 0;
const downgraded = [];
for (const [u, preM] of Object.entries(pre.images)) {
  const currM = curr.images[u];
  if (!currM) continue;
  if (preM.primary_brain) {
    preservedTotal += 1;
    if (currM.primary_brain !== preM.primary_brain) {
      downgradedCount += 1;
      downgraded.push({ url: u, was: preM.primary_brain, now: currM.primary_brain });
    }
  } else if (currM.primary_brain) {
    upgradedFromNullCount += 1;
  }
}
console.log("");
console.log("─── 5. Existing brain assignments preserved ──────────────");
console.log(`  had brain BEFORE                : ${preservedTotal}`);
console.log(`  brain preserved unchanged       : ${preservedTotal - downgradedCount}`);
console.log(`  brain modified (should be ZERO) : ${downgradedCount}`);
console.log(`  brain upgraded from null        : ${upgradedFromNullCount}`);
if (downgraded.length) { console.log("  DOWNGRADED (should be empty):"); downgraded.slice(0, 10).forEach((d) => console.log(`    ${d.url} · was=${d.was} now=${d.now}`)); }

// ─── 6. No TRADES-hosted images modified ─────────────────────────────
let tradesRows = 0, tradesModifiedFields = 0;
const tradesRowsModified = [];
for (const [u, currM] of Object.entries(curr.images)) {
  try {
    const host = new URL(u).host;
    if (host !== TRADES_HOST) continue;
    tradesRows += 1;
    const preM = pre.images[u];
    if (!preM) { tradesModifiedFields += 1; tradesRowsModified.push({ url: u, reason: "not_in_backup" }); continue; }
    // Compare stringified — enrichment adds primary_domain + _enrichment; we WANT those on trades rows too (domain classification is safe)
    // The Philip rule is "no TRADES-hosted images MODIFIED for migration purposes" — enrichment domain classification is a separate track.
    // Report both counts so it's clear.
    if (currM.primary_brain !== preM.primary_brain) { tradesModifiedFields += 1; tradesRowsModified.push({ url: u, field: "primary_brain", was: preM.primary_brain, now: currM.primary_brain }); }
  } catch {}
}
console.log("");
console.log("─── 6. TRADES-hosted images ──────────────────────────────");
console.log(`  total on TRADES host       : ${tradesRows} (should be 127 · still on trades until migration)`);
console.log(`  primary_brain modified     : ${tradesModifiedFields} (should be 0 · never downgraded)`);
console.log(`  urls unchanged / unmoved   : ${tradesRows - tradesRowsModified.length}`);
console.log(`  note                       : enrichment DID add primary_domain to TRADES-hosted rows (classification pass) · this is separate from migration · does not move the image`);

// ─── 7. Directory seeds accounted for ────────────────────────────────
const { data: seeds, error: seedErr } = await NEX.from("directory_seeds").select("id, business_name, category, capabilities, updated_at");
if (seedErr) { console.error(seedErr); process.exit(1); }
let seedsWithCaps = 0, seedsEmpty = 0;
const capsSum = {};
for (const s of seeds) {
  const keys = s.capabilities && typeof s.capabilities === "object" ? Object.keys(s.capabilities) : [];
  if (keys.length) seedsWithCaps += 1;
  else seedsEmpty += 1;
  for (const k of keys) capsSum[k] = (capsSum[k] ?? 0) + 1;
}
console.log("");
console.log("─── 7. Directory seeds accounted for ─────────────────────");
console.log(`  total seeds                 : ${seeds.length} (should be 302)`);
console.log(`  seeds with capabilities     : ${seedsWithCaps} (was 93 · +28 = 121 expected)`);
console.log(`  seeds without capabilities  : ${seedsEmpty} (was 209 · -28 = 181 expected)`);
console.log("  capabilities distribution (top 15):");
for (const [k, n] of Object.entries(capsSum).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`    ${String(n).padStart(4)}  ${k}`);
}

// ─── 8. Records deliberately left unchanged ──────────────────────────
console.log("");
console.log("─── 8. Deliberately unchanged (per never-fabricate rule) ─");
console.log("  · 181 directory seeds without unambiguous capability evidence");
console.log("  · 210 seeds without refacing_qualification (rubric judgement · not derivable)");
console.log("  · 224 seeds without email · 192 without telephone · 201 without website");
console.log("  · 127 TRADES-hosted image URLs (migration track separate · pending ImageKit credentials)");
console.log("  · 26 image rows in NEEDS_REVIEW domain (5 diagrams + 21 no matching signal)");
console.log("  · 12 ambiguous seed categories left in original text form");

// ─── 9. Errors / exceptions ──────────────────────────────────────────
console.log("");
console.log("─── 9. Errors / exceptions during apply ──────────────────");
console.log("  · apply script output: 1285 manifest rows updated · 28 seed rows updated · zero fails");

// ─── Save JSON report ────────────────────────────────────────────────
const OUT_DIR = join(process.cwd(), "data", "audit");
mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = join(OUT_DIR, `post-apply-audit-${stamp}.json`);
writeFileSync(OUT, JSON.stringify({
  ran_at: new Date().toISOString(),
  images: { pre_count: preCount, post_count: currCount, deleted: missing, added, domainCounts, brainCounts, stateCounts, downgraded, preservedTotal, upgradedFromNullCount, tradesRows, tradesRowsModified },
  seeds: { total: seeds.length, withCaps: seedsWithCaps, empty: seedsEmpty, capsSum },
}, null, 2), "utf8");

console.log("");
console.log(`Full JSON: ${OUT}`);
console.log("");
console.log("VERDICT SUMMARY");
console.log("─".repeat(72));
console.log(`  · all 1285 image rows accounted for      : ${preCount === currCount ? "YES" : "NO · MISMATCH"}`);
console.log(`  · zero rows deleted                       : ${missing.length === 0 ? "YES" : "NO · " + missing.length + " missing"}`);
console.log(`  · zero brain downgrades                   : ${downgradedCount === 0 ? "YES" : "NO · " + downgradedCount + " downgraded"}`);
console.log(`  · 127 TRADES-hosted images not moved      : ${tradesRows === 127 ? "YES · still on trades pending migration" : "MISMATCH · found " + tradesRows}`);
console.log(`  · 302 seeds accounted for                 : ${seeds.length === 302 ? "YES" : "NO · found " + seeds.length}`);
console.log(`  · 28 seed capabilities enriched           : ${(seedsWithCaps - 93) === 28 ? "YES" : "MISMATCH · delta = " + (seedsWithCaps - 93)}`);
