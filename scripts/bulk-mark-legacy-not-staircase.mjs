#!/usr/bin/env node
// scripts/bulk-mark-legacy-not-staircase.mjs
//
// Philip 2026-07-27 audit finding: ~85% of the manifest is legacy
// non-staircase content (builders · garden sheds · contact-hero ·
// news-hero · marketing images from the earlier trades-platform era).
// The NEX Tag queue is serving those first because they're
// "unclassified", making the tagging session mostly noise.
//
// This script scans every untagged row and marks the OBVIOUSLY
// non-staircase ones as { not_a_staircase: true, primary_brain: null,
// verified_by_human: false, marked_by: "bulk_legacy_scan" }. The row
// stays in the manifest but is excluded from the tag queue.
//
// Detection is CONSERVATIVE — only marks rows that are CLEARLY not
// staircases. Anything ambiguous stays in the queue for human review.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MP = path.join(ROOT, "data", "nex-image-manifest.json");
const BD = path.join(ROOT, "data", ".manifest-backups");

const nowIso = () => new Date().toISOString();

async function backup(manifest) {
  await fs.mkdir(BD, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 23);
  const p = path.join(BD, `manifest-${ts}.json`);
  await fs.writeFile(p, JSON.stringify(manifest, null, 2), "utf8");
  return p;
}

async function atomicWrite(m) {
  const t = MP + ".tmp." + process.pid + "." + Date.now();
  await fs.writeFile(t, JSON.stringify(m, null, 2), "utf8");
  await fs.rename(t, MP);
}

// ---- Signals ----

const STAIRCASE_POSITIVE_TOKENS = [
  "staircase", "stairs", "stair-", " stair ", "tread", "riser", "handrail",
  "baluster", "banister", "newel", "stringer", "spindle", "balustrade",
  "under-stair", "cantilever", "floating stair", "helical", "spiral stair",
  "loft ladder", "cut string", "closed string", "half-turn", "quarter-turn",
  "dog leg", "winder", "half landing", "quarter landing",
];

const NON_STAIRCASE_POSITIVE_TOKENS = [
  // Clearly non-staircase files
  "contact-hero", "news-hero", "hero-swap-demo", "cookie", "measure-your-house-guide",
  "logo-", "-logo.", "avatar", "team-", "map-preview", "vehicle", "van-", "truck-",
  "garden-shed", "garden shed", "shed-", "-shed.", "planter", "fence panel",
  "beacon-", "voucher", "banner-only",
  // Legacy trades platform pages / marketing
  "canteen", "yard-", "-yard.", "trade-off", "trade-center", "notebook",
];

function hasAnyToken(haystack, tokens) {
  const t = haystack.toLowerCase();
  return tokens.some((tk) => t.includes(tk));
}

function isLegacyNetworkersUrl(url) {
  // The old networkers.co.uk ImageKit account
  return url.includes("9mrgsv2rp");
}

function shouldMarkNotAStaircase(url, row) {
  const desc = String(row.description ?? row.master_description ?? "").toLowerCase();
  const fname = decodeURIComponent(url.split("/").pop() || "").toLowerCase();
  const notes = String(row.notes ?? "").toLowerCase();
  const combined = fname + " · " + desc + " · " + notes;

  // Already human-verified? Never touch.
  if (row.verified_by_human) return false;
  if (row.human_description) return false;
  if (row.not_a_staircase === true) return false;

  // If it has ANY strong staircase positive token → keep in queue
  if (hasAnyToken(combined, STAIRCASE_POSITIVE_TOKENS)) return false;

  // If it has any non-staircase positive token → mark
  if (hasAnyToken(combined, NON_STAIRCASE_POSITIVE_TOKENS)) return true;

  // Otherwise: if it's a legacy networkers asset AND description is
  // empty or thin AND no staircase tokens → mark (bulk clear the noise)
  if (isLegacyNetworkersUrl(url) && desc.length < 200) return true;

  // Legacy networkers with rich description but no staircase tokens:
  // probably not staircase, mark
  if (isLegacyNetworkersUrl(url)) return true;

  // Everything else: leave for human review
  return false;
}

async function main() {
  console.log("═════ NEX Tag · bulk-mark legacy non-staircase rows ═════\n");

  const raw = await fs.readFile(MP, "utf8");
  const manifest = JSON.parse(raw);
  const bp = await backup(manifest);
  console.log("  Backup:", bp, "\n");

  const rows = Object.entries(manifest.images);
  console.log("  Manifest total:", rows.length);

  let marked = 0;
  let kept = 0;
  let alreadyClean = 0;
  const markedSample = [];

  for (const [url, row] of rows) {
    if (row.not_a_staircase === true) { alreadyClean++; continue; }
    if (row.verified_by_human || row.human_description) { alreadyClean++; continue; }
    if (shouldMarkNotAStaircase(url, row)) {
      row.not_a_staircase = true;
      row.primary_brain = null;
      row.human_tagged_at = nowIso();
      row.human_tagged_by = "bulk_legacy_scan";
      row.marked_by = "bulk_legacy_scan";
      marked++;
      if (markedSample.length < 10) {
        markedSample.push(decodeURIComponent(url.split("/").pop()).slice(0, 60));
      }
    } else {
      kept++;
    }
  }

  manifest.generated_at = nowIso();
  await atomicWrite(manifest);

  console.log("");
  console.log("═════════════════════════════════════");
  console.log(`  Marked NOT a staircase:  ${marked}`);
  console.log(`  Kept in queue for human: ${kept}`);
  console.log(`  Already tagged/marked:   ${alreadyClean}`);
  console.log("═════════════════════════════════════");
  console.log("");
  console.log("Sample of what was auto-marked (first 10):");
  markedSample.forEach((n) => console.log("  ·", n));
  console.log("");
  console.log("Queue now serves only rows that are LIKELY staircase content.");
  console.log("If any of the auto-marked rows were actually staircases, they");
  console.log("can be recovered from the timestamped backup above.");
}

main().catch((e) => { console.error(e); process.exit(1); });
