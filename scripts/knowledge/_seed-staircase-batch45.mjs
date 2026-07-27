#!/usr/bin/env node
// Batch 45 — Lamwood strings as the modern UK standard for oak staircase stringers (Philip 2026-07-26).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What is lamwood and why is it used for staircase strings?",
    a: "Lamwood is laminated timber — multiple smaller pieces of oak (or other species) glued together with the grain direction matched across the laminations. In the UK today, lamwood is the standard choice for oak staircase strings because the assured quality after installation is superior to solid stock. The face grain reads as full oak (a proper oak veneer covers the visible face), but underneath it's a dimensionally-stable laminated construction that doesn't develop cracks or shakes as the house heats up.",
    audience: 2, classification: "expert_observation" },

  { q: "Why not use solid oak for staircase strings anymore?",
    a: "Sourcing solid oak in the long lengths + thickness needed for a stringer is difficult — suppliers rarely stock certified defect-free stock at scale. Thick solid timber needs very long kiln-drying cycles, and rushed drying leaves hidden internal stresses. Solid stock often has HIDDEN SHAKES (splits along the grain) invisible from surface inspection. Once the staircase is installed and the house warms it up, NEW shakes can appear as moisture equilibrates and stresses release — cracks that weren't there at install show up months later. Time-consuming to check supplier stock, and no guarantee the timber won't fail after heating.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Will lamwood string look different to solid oak?",
    a: "Not to the customer eye. The visible face of a lamwood string is a full oak veneer with proper grain, indistinguishable from solid oak at normal viewing distance. Only if you cut the end and look at the end grain will you see the lamination lines — and end grain is normally hidden inside the newel post or covered by trim. From the flight side and the underside view, lamwood looks like solid oak.",
    audience: 2, classification: "expert_observation" },

  { q: "Should I insist on solid oak strings instead of lamwood?",
    a: "For a modern build or refurb — no, lamwood is the better choice. Solid oak strings are appropriate for HERITAGE restoration where period authenticity matters (Victorian, Georgian) or where a full-solid staircase is a specific design requirement. In those cases, expect longer lead times, higher cost, and a real risk of shakes developing months after installation. For any new-build or modern retrofit, lamwood gives you the oak look with none of the post-install failure risk.",
    audience: 2, classification: "professional_recommendation" }
];

const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;
const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) continue;
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  doc.entries.push({
    id, kind: "faq", question: item.q, answer: item.a, category_tag: "staircase",
    audience_level: item.audience ?? null, classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null, source_verified_at: null, fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 45 (lamwood strings): Added ${added} new entries. Total: ${doc.entries.length}`);
