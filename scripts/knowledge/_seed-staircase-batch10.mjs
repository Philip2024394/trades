#!/usr/bin/env node
// Batch 10 staircase seed — three technical/regulatory gaps opened by
// Philip's fourth reference photo (a straight-flight central-spine
// staircase with cantilevered oak treads and frameless glass
// balustrading held by visible disc-shaped point fixings, in a
// double-height luxury open-plan setting):
//
//   1. What point fixings / spider clamps actually are
//   2. How treads are structurally attached to a central steel spine
//      via welded plate brackets
//   3. Whether frameless glass balustrading needs a timber handrail on
//      top (Approved Doc K guidance)
//
// Attaches the image to those 3 new entries + the existing straight-
// flight definition (faq-247). Deliberately does NOT re-attach to
// central-spine or glass-balustrade entries that already carry Batch 8's
// image — the schema is one-diagram-per-entry and Batch 8's is a good
// representative of that concept.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "What are the round metal disc fixings I can see on some frameless glass staircase balustrades?",
    a: "Those are POINT FIXINGS (also called spider clamps or bolt fixings). Stainless-steel discs bolted through pre-drilled holes in the corners of each glass panel, clamping the glass onto a supporting structure (the central spine, a base rail or a wall mount). They're the mechanism that lets frameless glass balustrades exist without a top or bottom frame — the load path goes glass → point fixing → structural support. Very clean look, but requires accurate hole-drilling in toughened glass BEFORE toughening (you can't drill toughened glass afterwards without shattering it), so panels are made to exact dimensions and can't be trimmed on site.",
    audience: 3, classification: "expert_observation" },

  { q: "How are the timber treads actually attached to a central-spine staircase?",
    a: "Usually with welded steel plate brackets that cantilever out sideways from the top of the spine — one pair of plates per tread, positioned to sit inside the tread's underside so they're hidden from most viewing angles. The tread's drilled to accept counterbored bolts that pass through the plates and clamp the timber down solidly. On a properly engineered central-spine staircase, each plate is welded and load-tested to carry the full design load — that's why steelwork tolerances have to be perfect (you can't shim a tread that's fractionally out of level). The engineering is why central-spine staircases cost meaningfully more than a traditional twin-string flight.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Does a frameless glass staircase balustrade need a separate timber handrail on top?",
    a: "Yes — for a domestic staircase in the UK, Approved Doc K requires a graspable handrail continuous over the flight, and the polished top edge of a glass panel isn't classed as graspable. A proper handrail either sits on top of the glass (a slim timber or metal rail bonded or bracketed to the glass edge) or runs alongside on the wall or newel. The 'no handrail at all, just naked glass' look you sometimes see in photos is either non-compliant, an unoccupied show home, or has a handrail hidden at an angle the photographer didn't capture. Ask your maker to spec the handrail explicitly against Doc K before you sign off the design.",
    audience: 3, classification: "safety_advice" }
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

// Diagram — attach to 3 new entries + straight-flight definition
const DIAGRAM = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_07_25%20PM.png",
  alt:      "Modern straight-flight staircase with a single central steel spine, chunky pale-oak cantilevered treads, frameless toughened-glass balustrades on both sides held by visible stainless-steel disc-shaped point fixings, and LED under-tread lighting, in a double-height open-plan luxury home with floor-to-ceiling windows and a modern fireplace",
  title:    "Straight-flight central-spine staircase with frameless glass and visible point fixings",
  caption:  "A single-flight modern staircase: dark central steel spine running under the tread centres, chunky pale-oak treads cantilevered out both sides, and frameless toughened glass balustrades held by the visible round stainless-steel disc-shaped point fixings (also called spider clamps). The plate brackets that actually hold the treads to the spine are tucked out of sight under the treads for clean lines.",
  labels:   [],
  footnote: "This is a fully-engineered structural system — the central spine is a welded steel beam sized for the full flight load, each tread bolts to hidden plate brackets welded to the spine, and the glass point fixings drill through pre-toughened glass panels that can't be trimmed on site. Requires an engineered design and precise steelwork tolerances. In the UK a graspable handrail is still required per Approved Doc K even where the glass alone appears sufficient visually."
};

const ATTACH_QUESTIONS = [
  "What is a straight staircase?",
  "What are the round metal disc fixings I can see on some frameless glass staircase balustrades?",
  "How are the timber treads actually attached to a central-spine staircase?",
  "Does a frameless glass staircase balustrade need a separate timber handrail on top?"
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

console.log(`\n✅ Batch 10:`);
console.log(`   ${added} new entries added (${skipped} skipped)`);
console.log(`   ${attached} entries received the straight-flight central-spine + point-fixings diagram`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
