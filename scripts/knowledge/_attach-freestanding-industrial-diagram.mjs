#!/usr/bin/env node
// One-shot script: attach the free-standing industrial staircase
// reference photo (Philip 2026-07-25) to the 4 Batch 7 entries where
// it adds most value. Follows the existing WEAR_DIAGRAM /
// SQUEAK_DIAGRAM pattern established in the earlier seed scripts.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");

// Backup first
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const DIAGRAM = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2002_42_10%20PM.png",
  alt:      "Modern half-turn staircase with dark powder-coated steel stringers, thick solid-oak treads, open risers and horizontal stainless-steel cable balustrading in a light hallway",
  title:    "Steel-frame + solid-timber-tread staircase — modern industrial style",
  caption:  "A half-turn staircase built with twin dark steel side stringers, thick solid oak treads, open risers (light passes through the flight to the wall behind), stainless-steel cable balustrading with a matching oak handrail, and a cantilevered lower flight.",
  labels:   [],
  footnote: "This is the material combination many joiners currently rate as the strongest modern new-build pick — steel strength + timber warmth + light-passing openness. Cable balustrading is UK-compliant to Approved Doc K provided the cable spacing keeps a 100 mm sphere from passing through (Building Control will check on site)."
};

const TARGET_IDS = [
  "staircase-faq-338",  // For a new build, should I choose full wood, mixed steel-and-timber, or full metal?
  "staircase-faq-342",  // What is a steel-frame-plus-timber-tread staircase?  (need to verify — batch 7 offsets)
  "staircase-faq-343",  // Advantages of steel-frame + timber-tread
  "staircase-faq-347"   // Best all-round new-build combination
];

const doc = JSON.parse(raw);

// Verify Batch 7 IDs by matching questions rather than trusting offset math
const BATCH_7_QUESTIONS = [
  "For a new build, should I choose a full wood staircase, a mixed steel-and-timber staircase, or a full metal one?",
  "What is a steel-frame-plus-timber-tread staircase?",
  "What are the advantages of a steel-frame staircase with timber treads?",
  "What material combination gives the best all-round new-build staircase?"
];

const norm = (s) => String(s ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();

let attached = 0;
const notFound = [];
for (const q of BATCH_7_QUESTIONS) {
  const target = doc.entries.find(e => norm(e.question) === norm(q));
  if (!target) { notFound.push(q); continue; }
  target.diagram = DIAGRAM;
  attached += 1;
  console.log(`  ✓ ${target.id}: ${target.question}`);
}

if (notFound.length) {
  console.warn(`\n⚠ Not found (question text mismatch — check spelling):`);
  for (const q of notFound) console.warn(`  - ${q}`);
}

doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`\n✅ Attached diagram to ${attached} entries.`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
