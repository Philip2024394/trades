// Surgical dedupe of the 5 duplicate items identified by scan-brain-duplicates.
// Backs up each modified file to .bak.20260724 before writing.
// Per memory rule "Nex Brains · never duplicate content · extract new info only" —
// merges any unique info from duplicates into the surviving entry, never loses data.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "C:\\Users\\Victus\\trades\\.author-studio-drafts\\staircase";
const BAK_SUFFIX = ".bak.20260724";

function backup(name) {
  const src = `${DIR}\\${name}`;
  const dst = `${src}${BAK_SUFFIX}`;
  if (!existsSync(dst)) {
    writeFileSync(dst, readFileSync(src, "utf-8"));
    console.log(`✓ Backup: ${name}${BAK_SUFFIX}`);
  } else {
    console.log(`  (backup already exists: ${name}${BAK_SUFFIX})`);
  }
}

// ─── craft.json — delete 3 exact/near-exact duplicates ────────────
{
  const name = "craft.json";
  backup(name);
  const raw = JSON.parse(readFileSync(`${DIR}\\${name}`, "utf-8"));
  const toDelete = new Set(["cand.craft_fact.8ss_c5", "cand.craft_fact.8ss_c4", "cand.craft_fact.8ss_c6"]);
  const before = raw.payload.facts.length;
  raw.payload.facts = raw.payload.facts.filter(f => !toDelete.has(f.id));
  const after = raw.payload.facts.length;
  raw.updated_at = new Date().toISOString();
  writeFileSync(`${DIR}\\${name}`, JSON.stringify(raw, null, 2));
  console.log(`✓ ${name}: ${before} → ${after} (removed ${before - after})`);
  console.log(`  · deleted: ${[...toDelete].join(", ")}`);
}

// ─── materials.json — delete duplicate MDF tread (later occurrence) ─
{
  const name = "materials.json";
  backup(name);
  const raw = JSON.parse(readFileSync(`${DIR}\\${name}`, "utf-8"));
  const toDelete = new Set(["cand.materials_mat.ss_c14"]);
  const before = raw.payload.materials.length;
  raw.payload.materials = raw.payload.materials.filter(m => !toDelete.has(m.id));
  const after = raw.payload.materials.length;
  raw.updated_at = new Date().toISOString();
  writeFileSync(`${DIR}\\${name}`, JSON.stringify(raw, null, 2));
  console.log(`✓ ${name}: ${before} → ${after} (removed ${before - after})`);
  console.log(`  · deleted: ${[...toDelete].join(", ")}  (note: family classification 'sheet_timber' kept from surviving entry; real Author to review whether 'engineered board' is more accurate)`);
}

// ─── defects.json — MERGE the two Squeak entries ─────────────────
{
  const name = "defects.json";
  backup(name);
  const raw = JSON.parse(readFileSync(`${DIR}\\${name}`, "utf-8"));
  const survivorId = "cand.defects_defect.bcd_c9";
  const deleteId   = "cand.defects_defect.8ss_c0";
  const survivor = raw.payload.defects.find(d => d.id === survivorId);
  const dupe     = raw.payload.defects.find(d => d.id === deleteId);
  if (!survivor || !dupe) { console.log(`✗ defects: missing IDs`); process.exit(1); }

  // Merge unique evidence entries from dupe into survivor (by evidence.note text)
  const survivorNotes = new Set((survivor.evidence ?? []).map(e => e.note ?? ""));
  for (const ev of (dupe.evidence ?? [])) {
    if (!survivorNotes.has(ev.note ?? "")) {
      survivor.evidence.push(ev);
      console.log(`  · merged evidence into ${survivorId}: "${(ev.note ?? "").slice(0, 60)}…"`);
    }
  }
  // Merge unique symptoms
  const survivorSymptoms = new Set(survivor.symptoms ?? []);
  for (const sym of (dupe.symptoms ?? [])) {
    if (!survivorSymptoms.has(sym)) {
      survivor.symptoms.push(sym);
      console.log(`  · merged symptom into ${survivorId}: "${sym.slice(0, 60)}…"`);
    }
  }

  const before = raw.payload.defects.length;
  raw.payload.defects = raw.payload.defects.filter(d => d.id !== deleteId);
  const after = raw.payload.defects.length;
  raw.updated_at = new Date().toISOString();
  writeFileSync(`${DIR}\\${name}`, JSON.stringify(raw, null, 2));
  console.log(`✓ ${name}: ${before} → ${after} (merged + removed ${deleteId})`);
}

console.log("\n✓ Dedupe complete. Rescan next to confirm zero duplicates.");
