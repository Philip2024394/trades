#!/usr/bin/env node
// Batch 8 staircase seed — glass balustrade definition + adoption
// context (why homeowners increasingly choose it despite the
// commercial-showroom association) + practical family-home
// considerations. Also attaches Philip's second reference photo (the
// central-spine + frameless-glass + open-riser luxury apartment shot)
// to relevant existing + new entries.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");

// Backup
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);
if (!Array.isArray(doc.entries)) doc.entries = [];

// ─── NEW ENTRIES ───────────────────────────────────────────
const NEW = [
  { q: "What is a glass balustrade on a staircase?",
    a: "A balustrade where the safety barrier alongside the flight is a series of toughened or laminated glass panels instead of traditional timber or metal balusters. The panels can be FRAMED (held top and bottom by a metal channel or timber base rail), CLAMPED (held by stainless-steel point fixings at the corners), or FRAMELESS (structurally bonded into a slot cut into the string or floor with no visible fixings at the top). Frameless is the most minimal look; framed is the most affordable and easiest to service if a panel ever needs replacing.",
    audience: 2, classification: "expert_observation" },

  { q: "Why are homeowners increasingly choosing frameless glass balustrades over traditional spindles?",
    a: "Three practical reasons plus the visual one. Practically: glass doesn't collect dust in turned profiles (so much easier to clean), doesn't chip and scratch under a foot-brush the way painted timber does, and doesn't need repainting every few years. Visually: glass lets natural light travel through the staircase into hallways that would otherwise sit in shadow, which matters in narrow terraces and open-plan homes. Yes, the style started in commercial showrooms and offices — but the reasons it works in those high-traffic environments (durability, cleaning, light) are exactly the reasons it now works in family homes.",
    audience: 2, classification: "expert_observation" },

  { q: "Are glass balustrades practical in a family home with young children?",
    a: "Yes, provided the glass and fixings are specified correctly. Use TOUGHENED glass (minimum 8 mm on a staircase, 10-12 mm is common for frameless designs) — it either doesn't break or shatters into small blunt cubes rather than dangerous shards. Frameless designs need the glass anchored properly at the base to Approved Doc K loading. Downside: fingerprints. Kids leave hand and face prints on every panel, and you'll wipe them down often. Some families choose framed glass at half-height with a timber handrail above so the top edge takes the wear.",
    audience: 2, classification: "safety_advice" }
];

// Add new entries
const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
const newIds = [];
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
  newIds.push(id);
  added += 1;
}

// ─── DIAGRAM ATTACHMENT ────────────────────────────────────
const DIAGRAM = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2002_47_34%20PM.png",
  alt:      "Modern half-turn staircase with a single dark central steel spine, thick oak treads, open risers, frameless toughened glass balustrade panels and a matching oak handrail, in a luxury open-plan apartment with double-height ceiling",
  title:    "Central-spine + frameless-glass balustrade staircase — modern luxury style",
  caption:  "A half-turn staircase built with a single central steel spine carrying cantilevered oak treads, frameless toughened-glass balustrade panels with an oak handrail, and open risers. Lets light through the flight and the balustrade both, giving the whole space an open, luxury feel.",
  labels:   [],
  footnote: "This style originated in commercial showrooms because glass is durable under heavy traffic and easy to clean. Homeowners have adopted it for the same reasons — plus the light-passing openness suits modern open-plan interiors. Requires toughened glass (typically 10-12 mm on frameless panels), correct Approved Doc K anchoring and 100 mm sphere-test compliance around the balustrade edges."
};

const ATTACH_TO_QUESTIONS = [
  // Central-spine definition (from Batch 3 glossary) — perfect match
  "What is a central-spine staircase?",
  // Modern staircase style (from Batch 3) — perfect match
  "What is a modern staircase style?",
  // Open-plan / open-riser (from Batch 3)
  "What is an open-plan or open-riser staircase?",
  // The new glass-balustrade definition entry
  "What is a glass balustrade on a staircase?"
];

let attached = 0;
const notFound = [];
for (const q of ATTACH_TO_QUESTIONS) {
  const target = doc.entries.find(e => norm(e.question) === norm(q));
  if (!target) { notFound.push(q); continue; }
  target.diagram = DIAGRAM;
  attached += 1;
  console.log(`  ✓ attached to ${target.id}: ${target.question}`);
}
if (notFound.length) {
  console.warn(`⚠ Not found:`);
  for (const q of notFound) console.warn(`  - ${q}`);
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`\n✅ Batch 8:`);
console.log(`   ${added} new entries added (${skipped} skipped as dupes)`);
console.log(`   ${attached} entries received the central-spine/glass diagram`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
