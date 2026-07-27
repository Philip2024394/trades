#!/usr/bin/env node
// Batch 25 staircase seed — the calculator is now real. These entries
// tell users what Nex can compute and what she needs from them to
// do it accurately.
//
// Backing script: scripts/staircase-calculator.mjs
// Reads canonical data from data/staircase-plan-sizes.json.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "Can Nex actually calculate my exact staircase measurements — not just look up minimums?",
    a: "Yes. Give me your STRUCTURAL floor-to-floor height (measured joist-top to joist-top before flooring is laid), your intended DOWNSTAIRS flooring type and UPSTAIRS flooring type, your preferred LAYOUT (straight, half-turn landing, half-turn winder, quarter-turn, spiral, etc.), your preferred WIDTH (usually 800-1000mm for a domestic staircase), and optionally your preferred GOING (typically 220-280mm). I compute: exact number of rises, exact rise per step (adjusted for flooring), exact going, flight length, pitch, 2R+G comfort formula, total footprint in m², and full Doc K compliance check. If any number falls outside Doc K limits, I flag it before you order.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What information does Nex need to compute my exact staircase numbers?",
    a: "Six inputs. REQUIRED: (1) floor-to-floor height in mm (measure joist-top to joist-top on new build, or finished-floor to finished-floor if floors already laid). (2) preferred layout — straight, half-turn landing, half-turn winder, quarter-turn landing, quarter-turn winder, spiral, curved. (3) flight width in mm — typically 800-1000 for domestic. OPTIONAL: (4) intended DOWNSTAIRS flooring type + (5) UPSTAIRS flooring type — these matter if floors aren't laid yet. (6) preferred going — I'll pick 250mm as a comfortable default if you don't specify. Give me those and I return exact numbers within seconds.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How does Nex handle flooring in the staircase calculation?",
    a: "The staircase's TRUE rise is finished-floor to finished-floor — so if your floors aren't laid yet, the calculation has to account for what will be laid. I add the upstairs flooring thickness and subtract the downstairs flooring thickness from the structural (joist-to-joist) floor-to-floor height. Example: 2500mm structural, 20mm solid oak downstairs, 20mm carpet upstairs → effective rise = 2500 + 20 - 20 = 2500mm (same). But 2500mm structural, 15mm tile downstairs, 25mm carpet upstairs → effective rise = 2500 + 25 - 15 = 2510mm. Small changes but they matter — 10mm ÷ 13 rises = under 1mm per step, but on tighter numbers the difference between compliant and non-compliant pitch is exactly this precise.",
    audience: 3, classification: "expert_observation" },

  { q: "What does Nex actually check when calculating my staircase?",
    a: "Six Doc K compliance checks in one calculation: (1) rise between 150-220mm private / 150-190mm utility (Doc K clause 1.3 + Table 1.1). (2) going ≥220mm private / ≥250mm utility (Doc K clause 1.3). (3) pitch ≤42° private / ≤38° utility (Doc K clause 1.3). (4) 2R+G formula between 550-700mm (Doc K clause 1.4). (5) uniformity — every rise the same (Doc K clause 1.1, checked by construction). (6) If you supply available floor run, whether the flight fits including 25mm fitting tolerance on L-shapes / 10mm on straight flights. Any failure gets flagged as an error; edge cases get flagged as warnings.",
    audience: 3, classification: "expert_observation" },

  { q: "Give me a worked example — Nex computing a real staircase for a specific property.",
    a: "Example inputs: 2510mm floor-to-floor, downstairs solid timber (20mm), upstairs carpet with underlay (20mm), half-turn landing layout, 900mm wide, 250mm going, private stair. Nex returns: EFFECTIVE RISE 2510mm (no change from structural), 12 RISES at 209mm each (comfortably within Doc K 150-220mm), 11 goings at 250mm, flight length 2750mm, pitch 39.9° (within Doc K 42° max), 2R+G = 668mm (within Doc K comfort band 550-700), footprint ~3.6m² for the half-turn, 25mm fitting tolerance for the landing turn. All Doc K compliance checks pass — safe to order.",
    audience: 3, classification: "expert_observation" }
];

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

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 25 (calculator disclosure entries): Added ${added} new entries (${skipped} skipped).`);
console.log(`   Total: ${doc.entries.length} entries`);
console.log(`   Calculator: scripts/staircase-calculator.mjs`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
