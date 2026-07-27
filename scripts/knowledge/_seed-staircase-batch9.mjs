#!/usr/bin/env node
// Batch 9 staircase seed — chunky-tread + open-riser + string-mixing
// coverage prompted by Philip's third reference photo (a warm oak
// open-plan half-turn staircase showing cut-string on the lower
// flight and closed-string on the wall side of the upper flight,
// with LED under-tread lighting and no plasterboard soffit).
//
// Adds 4 new entries covering topics genuinely absent from the brain:
// chunky treads, mixing string types in one staircase, under-tread
// LED lighting, and the finishing-cost savings from an exposed
// open-riser design.
//
// Attaches the image as a visual reference to the two existing
// string-family entries + open-riser entry + one of the new entries.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "Why do modern staircases often use very thick chunky treads?",
    a: "Two reasons — structure and looks. On an open-riser staircase there's no riser board tying each tread to the next, so the tread has to carry its own load solo. A 20 mm-ish tread that'd be fine in a housed-string traditional staircase would flex noticeably on an open-riser design; a 50-70 mm chunky solid-oak slab doesn't. Visually the chunky slab reads as 'expensive furniture' rather than 'floorboard on top of a stringer' — which is exactly the modern architectural look homeowners are after. It's a case of the engineering demand and the aesthetic pointing the same way.",
    audience: 3, classification: "expert_observation" },

  { q: "Can one staircase mix cut string on one side and closed string on the other?",
    a: "Yes — very common on modern homes, and often the smart choice. Closed string against the wall (you can't see it anyway, so the extra timber and machining of a cut string would be wasted), cut string on the OPEN 'show' side facing into the room (where the step profile becomes a design feature). You save cost on the wall side and put the joinery detail where it earns its keep. Many high-end staircases you'll see in photos do exactly this without you noticing.",
    audience: 3, classification: "expert_observation" },

  { q: "Can I add LED under-tread lighting to my staircase?",
    a: "Yes, and it's one of the highest-impact modern staircase details for the money spent. LED strip lit under the front edge of each tread (recessed into a small channel) gives you a warm glow that washes the wall and step behind, doubles as low-level night lighting so nobody trips getting a glass of water, and dramatically enhances an open-riser design's floating look. Plan it EARLY though — the cabling routes need to be built into the stringer during manufacture, retrofitting is much harder. A qualified electrician wires it back to a switched or PIR-triggered driver in the under-stair void.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Does an open-riser staircase actually save money on the rest of the build?",
    a: "Yes, in ways that aren't obvious at quote stage. A closed staircase usually needs a plasterboard soffit on the underside (labour + plastering + painting), often an under-stair cupboard or storage build (joinery + doors + finish), and sometimes riser paint or veneer on the closed risers themselves. An open-riser design with chunky exposed treads and a visible cut string skips ALL of that — the underside of the staircase IS the finished look. You'll pay more for the chunky solid-timber treads, but usually save more than that on the finishing trades that never happen.",
    audience: 3, classification: "expert_observation" }
];

// Add new entries
const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  doc.entries.push({
    id, kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}

// Diagram — attach to 4 relevant entries
const DIAGRAM = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2002_51_01%20PM.png",
  alt:      "Modern half-turn warm-oak staircase showing cut-string profile on the lower flight (step edges visible from the side) and closed-string on the wall side of the upper flight, both flights with chunky solid oak treads and open risers, LED under-tread lighting illuminating the wall and floor beneath",
  title:    "Cut-string vs closed-string staircase with chunky open-riser treads and LED under-tread lighting",
  caption:  "One staircase, both string types: cut string on the show side of the lower flight (step profile visible), closed string on the wall side of the upper flight (hidden). Chunky solid-oak treads with open risers let light through, and warm LED strips hidden under each nosing wash the walls and floor beneath.",
  labels:   [],
  footnote: "The mixed-string trick — closed against the wall, cut on the show side — saves cost on the hidden side while putting the joinery detail where it's actually seen. Chunky open-riser design also skips the usual under-stair plasterboard soffit and cupboard build, saving on finishing trades that never have to happen."
};

const ATTACH_QUESTIONS = [
  "What is a cut-string staircase?",
  "What is a closed-string staircase?",
  "What is an open-plan or open-riser staircase?",
  "Can one staircase mix cut string on one side and closed string on the other?"
];

let attached = 0;
const notFound = [];
for (const q of ATTACH_QUESTIONS) {
  const target = doc.entries.find(e => norm(e.question) === norm(q));
  if (!target) { notFound.push(q); continue; }
  target.diagram = DIAGRAM;
  attached += 1;
  console.log(`  ✓ attached to ${target.id}: ${target.question}`);
}
if (notFound.length) {
  console.warn(`⚠ Not found: ${notFound.join(", ")}`);
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`\n✅ Batch 9:`);
console.log(`   ${added} new entries added (${skipped} skipped as dupes)`);
console.log(`   ${attached} entries received the cut-vs-closed-string diagram`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
