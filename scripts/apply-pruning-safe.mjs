// SAFE PRUNING · Philip 2026-08-02.
//
// Rule: prune by moving · NEVER delete. Every removed image-layer Q must
// land in exactly one destination (universal · family:{id} · component:{id}).
// image-keep entries are LEFT WHERE THEY ARE — this script never touches
// them. Aggressive classifier v2 comes later, only after evidence.
//
// This script:
//   1. Backs up every file it will mutate under data/nex-author-backups/{ts}/
//   2. Walks the pruning report (data/nex-pruning-report.json)
//   3. For each move with dest=universal / component:* / family:*:
//        · adds the Q text to the destination layer file (empty `a` slot,
//          idempotent · skip if Q already present)
//        · removes the Q from the source design's image-layer qa array
//   4. Writes an append-only audit log JSONL under
//      data/nex-audit-log/{ts}-prune-safe.jsonl
//   5. Marks the report `applied=true`, `applied_at`, `applied_summary`.
//
// Idempotent: rerunning after a successful apply is a no-op. Safe to run
// twice.
//
// Not touched: any move with dest="image-keep".

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";

const CWD = process.cwd();
const REPORT_PATH = join(CWD, "data/nex-pruning-report.json");
const IMAGES_PATH = join(CWD, "data/nex-confirmed-images.json");
const UNIVERSAL_PATH = join(CWD, "data/nex-universal-qa.json");
const COMPONENT_DIR = join(CWD, "data/nex-component-qa");
const FAMILY_DIR = join(CWD, "data/nex-family-qa");

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_DIR = join(CWD, "data/nex-author-backups", `${ts}-prune-safe`);
const AUDIT_PATH = join(CWD, "data/nex-audit-log", `${ts}-prune-safe.jsonl`);

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

function backup(srcPath) {
  if (!existsSync(srcPath)) return;
  ensureDir(BACKUP_DIR);
  const rel = srcPath.replace(CWD, "").replace(/^[\\/]/, "");
  const dst = join(BACKUP_DIR, rel);
  ensureDir(dirname(dst));
  copyFileSync(srcPath, dst);
}

function loadJson(p) { return JSON.parse(readFileSync(p, "utf8")); }
function saveJson(p, obj) { writeFileSync(p, JSON.stringify(obj, null, 2), "utf8"); }

// Load report + images
const report = loadJson(REPORT_PATH);
if (report.applied) {
  console.log("Report already marked applied=true · nothing to do.");
  console.log("Applied at:", report.applied_at);
  process.exit(0);
}

// Backup everything that could be mutated
backup(IMAGES_PATH);
backup(UNIVERSAL_PATH);
for (const design of report.designs) {
  for (const m of design.moves) {
    if (m.dest.startsWith("component:")) {
      const id = m.dest.split(":")[1];
      backup(join(COMPONENT_DIR, `${id}.json`));
    } else if (m.dest.startsWith("family:")) {
      const id = m.dest.split(":")[1];
      backup(join(FAMILY_DIR, `${id}.json`));
    }
  }
}
backup(REPORT_PATH);
console.log("Backups → " + BACKUP_DIR);

// Load mutable state
const imagesDb = loadJson(IMAGES_PATH);
const universalDb = loadJson(UNIVERSAL_PATH);

// Layer file loader/saver (component + family use the same shape)
function loadLayer(dir, id) {
  const p = join(dir, `${id}.json`);
  if (!existsSync(p)) {
    return { path: p, data: { version: 1, layer_ref: id, qa: [] } };
  }
  return { path: p, data: loadJson(p) };
}

const layerCache = new Map();
function getLayer(dir, id) {
  const key = dir + ":" + id;
  if (!layerCache.has(key)) layerCache.set(key, loadLayer(dir, id));
  return layerCache.get(key);
}

// Idempotent Q insert — case/whitespace-insensitive dedupe
function normQ(q) { return q.toLowerCase().replace(/\s+/g, " ").trim(); }
function insertQ(qaArr, q) {
  const key = normQ(q);
  const existing = qaArr.find((x) => normQ(x.q) === key);
  if (existing) return "already-present";
  qaArr.push({ q, a: "" });
  return "added";
}

// Remove a Q from a design's image-layer qa array (dedupe-safe)
function removeQFromImage(design, q) {
  const key = normQ(q);
  const idx = design.qa.findIndex((x) => normQ(x.q) === key);
  if (idx === -1) return "not-found";
  const wasAuthored = design.qa[idx].a && design.qa[idx].a.trim().length > 0;
  design.qa.splice(idx, 1);
  return wasAuthored ? "removed-authored" : "removed-empty";
}

// Audit log accumulator
ensureDir(dirname(AUDIT_PATH));
const auditLines = [];
function audit(entry) {
  auditLines.push(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

// Track summary
const summary = { universal: 0, component: 0, family: 0, image_keep_skipped: 0, already_present: 0, image_not_found: 0, authored_moved: 0 };

// Walk moves
for (const design of report.designs) {
  const imgRec = imagesDb.confirmed.find((r) => r.design_id === design.design_id);
  if (!imgRec) {
    console.log(`WARN · design not in library: ${design.design_id} · skipping`);
    continue;
  }

  for (const move of design.moves) {
    if (move.dest === "image-keep") { summary.image_keep_skipped++; continue; }

    let dest_kind, dest_id, dest_arr;
    if (move.dest === "universal") {
      dest_kind = "universal"; dest_id = null; dest_arr = universalDb.qa;
    } else if (move.dest.startsWith("component:")) {
      dest_kind = "component"; dest_id = move.dest.split(":")[1];
      dest_arr = getLayer(COMPONENT_DIR, dest_id).data.qa ??= [];
    } else if (move.dest.startsWith("family:")) {
      dest_kind = "family"; dest_id = move.dest.split(":")[1];
      dest_arr = getLayer(FAMILY_DIR, dest_id).data.qa ??= [];
    } else {
      console.log(`WARN · unknown dest: ${move.dest} · skipping`);
      continue;
    }

    const insertResult = insertQ(dest_arr, move.q);
    const removeResult = removeQFromImage(imgRec, move.q);
    if (insertResult === "already-present") summary.already_present++;
    if (removeResult === "not-found") summary.image_not_found++;
    if (removeResult === "removed-authored") summary.authored_moved++;
    summary[dest_kind]++;

    audit({
      design_id:   design.design_id,
      q:           move.q,
      from:        "image",
      to:          move.dest,
      reason:      move.reason,
      dest_insert: insertResult,
      image_remove: removeResult,
    });
  }
}

// Persist layer files
for (const { path, data } of layerCache.values()) {
  data.updated_at = new Date().toISOString();
  saveJson(path, data);
}

// Persist universal + images
universalDb.updated_at = new Date().toISOString();
saveJson(UNIVERSAL_PATH, universalDb);

imagesDb.updated_at = new Date().toISOString();
saveJson(IMAGES_PATH, imagesDb);

// Write audit log
writeFileSync(AUDIT_PATH, auditLines.join("\n") + "\n", "utf8");

// Mark report applied
report.applied = true;
report.applied_at = new Date().toISOString();
report.applied_summary = summary;
report.applied_note = "Safe pruning · universal + component + family only · image-keep untouched per Philip 2026-08-02 conservative directive.";
saveJson(REPORT_PATH, report);

console.log("\n═══ APPLIED ═══");
console.log(JSON.stringify(summary, null, 2));
console.log("\nAudit log:", AUDIT_PATH);
console.log("Report marked applied=true.");
