#!/usr/bin/env node
// Batch 11 staircase seed — Crittall-style framed-glass balustrading,
// compact-footprint high-end design, layered ambient lighting, and
// design-language consistency between staircase and doors/windows.
// Prompted by Philip's fifth reference photo (compact winder
// staircase with black-framed glass panels, chunky oak open-riser
// treads, multi-source warm lighting in a small modern hallway).

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "What is a Crittall-style or framed-glass-in-black-grid staircase balustrade?",
    a: "A balustrade design where the glass panels sit inside a slim black-painted or powder-coated metal grid — echoing the Crittall (steel-framed) window and door style that's become popular again in modern UK homes. Instead of frameless panels held by point fixings, the glass is captured in a rectangular black frame, usually divided into two or three horizontal sections per panel. The look is more architectural and 'industrial townhouse' than the pure minimalism of frameless glass, and it pairs beautifully with matching Crittall-style front doors, internal doors and windows for a consistent design language across the whole entrance.",
    audience: 2, classification: "expert_observation" },

  { q: "How can I make a small compact staircase in a terrace or townhouse feel high-end?",
    a: "Focus on materials and lighting, not size. A compact winder in a narrow hallway can look premium if you use chunky solid-oak treads instead of thin ones, replace traditional turned spindles with a slim glass panel or slim black-painted spindles, add LED strips under each tread nosing plus a low skirting-level strip so the flight glows after dark, and tie the staircase into the wider design (front door, window frames) with a shared black-metal accent. A small staircase done with these details reads as 'considered' and feels bigger than its actual footprint; the same footprint with builder-standard treads and turned pine spindles reads as 'basic'.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How does layered staircase lighting change how my home feels when I walk in after dark?",
    a: "A properly-lit staircase does a lot of the emotional heavy lifting when you get home in the evening. Under-tread LED strips draw a warm horizontal ladder of light up the flight. A low skirting-level strip along the adjacent wall picks up the floor tiles and grounds the whole scene. A table lamp on a console or shelf adds a pool of warmth at head height. Pendant lights above the flight — especially in a double-height stairwell — anchor the vertical space. Together they replace the harsh overhead ceiling light most halls default to, and the whole entrance feels like it's welcoming you rather than announcing itself.",
    audience: 1, classification: "expert_observation" },

  { q: "Should my staircase design match my front door and window frames?",
    a: "It's one of the strongest visual moves you can make in a hallway. A black-framed Crittall-style front door + black-framed internal glass panels + black-metal staircase stringers + black-framed balustrade grid ALL reading as one design family makes the whole entrance feel curated and expensive, even on a modest footprint. The same applies with brass details or with warm timber — pick a consistent accent material and repeat it. The mistake is treating the staircase, the front door and the windows as three separate decisions by three separate trades. Plan them together and the effect is much greater than the sum.",
    audience: 2, classification: "professional_recommendation" }
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

// Diagram
const DIAGRAM = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_09_34%20PM.png",
  alt:      "Compact modern winder staircase in a small hallway with slim black metal stringers, chunky oak treads with open risers, framed-glass balustrade panels in a black metal Crittall-style grid that matches the black-framed front door and windows, LED strips under each tread and along the skirting, and a small table lamp on the console",
  title:    "Compact winder staircase with Crittall-style framed-glass balustrade and layered ambient lighting",
  caption:  "A small-footprint modern staircase making its space feel much larger through material and lighting choices: chunky oak treads on slim black metal stringers, open risers letting light through, glass balustrade panels captured in a black metal grid that echoes the Crittall-style front door and windows, and multiple warm light sources (under-tread LED strips, skirting-level strip, table lamp, pendants) that transform the entrance after dark.",
  labels:   [],
  footnote: "Two design moves make a compact staircase like this feel high-end. First, chunky solid-timber treads on slim black stringers instead of thin builder-standard treads on painted MDF strings. Second, tying the staircase into the wider architectural language — the black-frame grid on the balustrade repeats the front door and windows so the whole entrance reads as one considered composition rather than three separate decisions."
};

const ATTACH_QUESTIONS = [
  "What is a winder staircase?",
  "What is a Crittall-style or framed-glass-in-black-grid staircase balustrade?",
  "How can I make a small compact staircase in a terrace or townhouse feel high-end?",
  "How does layered staircase lighting change how my home feels when I walk in after dark?",
  "Should my staircase design match my front door and window frames?"
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

console.log(`\n✅ Batch 11:`);
console.log(`   ${added} new entries added (${skipped} skipped)`);
console.log(`   ${attached} entries received the compact-Crittall-lighting diagram`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
