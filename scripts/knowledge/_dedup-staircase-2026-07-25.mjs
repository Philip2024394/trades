#!/usr/bin/env node
// One-shot dedup / tighten pass on knowledge/staircase.json.
// Actions:
//   1. Delete 5 near-duplicate entries where Batch 4 additions
//      superseded thinner pre-existing entries. In each case the
//      surviving entry is objectively more useful.
//   2. Merge a cultural touch ("cupboard under the stairs is
//      traditional") from a deleted entry into its survivor.
//   3. Strip a specific commercial product-brand mention from one
//      answer, replacing it with a generic reference, per the
//      never-cite-companies rule.
//
// Backs up the file to knowledge/staircase.json.bak.<timestamp>
// before writing.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

// ── Deletions: earlier thin entries superseded by richer Batch 4 rewrites
const DELETE_IDS = [
  "staircase-faq-061",  // 2-pack lacquer — superseded by faq-294
  "staircase-faq-066",  // surface prep — superseded by faq-298
  "staircase-faq-048",  // dry before finish — superseded by faq-300
  "staircase-faq-021",  // sunlight damage — superseded by faq-302
  "staircase-faq-121",  // steam cleaning — superseded by faq-305
  "staircase-faq-107"   // keep-record-of-finish — merged into faq-312
];

// ── Edits: absorb cultural touch from 107 into 312, and strip brand name
const EDITS = [
  {
    id: "staircase-faq-312",
    newAnswer: "Yes — write down the brand, product name, colour or shade, application date and number of coats, and store it somewhere findable (inside a cupboard under the stairs is traditional, or an envelope in the drawer with the warranty paperwork). In five or ten years when you need a touch-up or a full recoat, knowing exactly what's on there means the new finish will match and bond properly. Refinishing 'unknown' is significantly harder than refinishing a finish you can name and re-order."
  }
];

// Apply edits
let edited = 0;
for (const e of EDITS) {
  const target = doc.entries.find(x => x.id === e.id);
  if (target) { target.answer = e.newAnswer; edited += 1; }
}

// Delete
const before = doc.entries.length;
doc.entries = doc.entries.filter(e => !DELETE_IDS.includes(e.id));
const deleted = before - doc.entries.length;

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Dedup pass:`);
console.log(`   deleted ${deleted} duplicate entries`);
console.log(`   edited  ${edited} entries (merge + brand-strip)`);
console.log(`   total   ${doc.entries.length} entries (was ${before})`);
console.log(`   backup  knowledge/staircase.json.bak.${stamp}`);
