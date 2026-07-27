#!/usr/bin/env node
// Batch 22 staircase seed — plan-size / footprint reference exposed
// to the brain surface. Backed by docs/staircase-plan-sizes-uk.md
// and data/staircase-plan-sizes.json.
//
// Every footprint answer in this batch is derived from Approved Doc K
// (England, 2013 revision) minimums. All numbers should be verified
// against the current Doc K PDF before designing to them.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "Where do I find the official UK Building Regulations for staircases?",
    a: "The primary source in England is Approved Document K — 'Protection from falling, collision and impact' — free to download from gov.uk. Wales has its own Approved Doc K, Scotland uses the Technical Handbook Section 4, Northern Ireland uses Technical Booklet H. All are free from the respective government websites. Always check the CURRENT PUBLISHED VERSION — the 2013 revision was the last major England update, but small amendments happen and Building Control will apply the current version at inspection.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What are the key Approved Doc K numbers I need to know for a private domestic staircase?",
    a: "RISE 150-220 mm (every step the same, within a few mm). GOING minimum 220 mm. PITCH maximum 42°. Comfort rule: 2×rise + going = 550-700 mm. HEADROOM minimum 2000 mm above pitch line. HANDRAIL 900-1000 mm high, one side up to 1000 mm width, both sides over 1000 mm. BALUSTRADE 900 mm high on stair / 1100 mm on landing over 600 mm drop, max 100 mm gap. WIDTH no legal minimum since 2010, practical minimum 800 mm, recommended 900 mm. These are ENGLAND minimums — check regional variants before designing.",
    audience: 3, classification: "safety_advice" },

  { q: "How do I calculate the minimum floor area my staircase will need?",
    a: "Two variables set the length: floor-to-floor HEIGHT (fixed by your building) and CHOSEN RISE (150-220 mm). Number of rises = height ÷ chosen rise, rounded up. Length of flight = (rises − 1) × going. Add a top and bottom landing (each at least the flight width square). For a 2500 mm floor-to-floor at 192 mm rise, 250 mm going, 900 mm wide: 13 rises, 12 × 250 = 3000 mm flight length, plus 900 mm landing = 3900 mm total length × 900 mm wide = about 3.5 m². That's the whole floor footprint the straight staircase eats.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the minimum footprint for a straight staircase?",
    a: "At absolute Doc K minimums (800 mm wide, 220 mm rise, 220 mm going, 12 rises): about 800 × 3440 mm = 2.75 m². More realistic modern spec (900 mm wide, 192 mm rise, 250 mm going, 13 rises): about 900 × 3900 mm = 3.5 m². Generous / luxury (1100 mm wide, wider going): about 4.9 m². Add landing area to the top. Values assume a 2500 mm floor-to-floor — taller ceilings need more rises and slightly more length.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the minimum footprint for a quarter-turn staircase with a landing?",
    a: "About 2.9 m² at Doc K minimums, 3.6 m² at modern-typical spec — depends on how the L-shape sits in the room, but roughly a 1.7-2.0 m square footprint plus the length of the primary flight. Compared to a straight staircase of the same height, the L-shape trades length for a bit of extra width. The landing itself needs to be at least the flight width in both directions (usually 800-900 mm square minimum).",
    audience: 3, classification: "expert_observation" },

  { q: "What's the minimum footprint for a quarter-turn staircase with winders instead of a landing?",
    a: "About 2.3 m² at Doc K minimums, 2.7 m² at modern-typical spec — the winders save roughly 0.6 m² compared to the equivalent landing version. Trade-off: the winder turn feels tighter than a landing turn, walking-line going must be checked carefully (must stay ≥220 mm along the walking line, measured about 270 mm from the inside handrail). Popular in Victorian and Edwardian terraces where floor space is tight.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the minimum footprint for a half-turn (U-shape / dogleg) staircase with a half-landing?",
    a: "About 2.56 m² at Doc K minimums (1.6 m square), 3.6 m² at modern-typical spec (1.8 × 2.0 m), 5.3 m² at generous. The two flights sit parallel to each other with the half-landing turning them through 180°. Great compact solution when the staircase needs to double back on itself — common in UK terraces where the staircase runs over the ground-floor corridor.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the minimum footprint for a half-turn staircase with winders instead of a half-landing?",
    a: "About 2.72 m² at Doc K minimums, 3.24 m² at modern-typical — saves roughly 0.4 m² compared to a half-landing version. Same walking-line rule applies to the winder set. The compact-dogleg-with-winders is one of the tightest compliant configurations available, popular where every square metre matters.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the minimum footprint for a spiral staircase?",
    a: "About 1.54 m² at the smallest Doc K-compliant diameter of 1400 mm, up to 3.14 m² at a comfortable 2000 mm diameter. Spirals are the most space-efficient staircase by footprint, but Doc K restricts them: they're permitted as the ONLY staircase to a habitable floor only under specific conditions. Best specified as secondary access (loft, mezzanine) rather than the main flight.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What's the minimum footprint for a curved (helical) staircase?",
    a: "About 4.9 m² at a tight 2500 mm diameter, 9.6 m² at a generous 3500 mm diameter, 15.9 m² at a grand 4500 mm diameter. Unlike a spiral, a helical staircase has no central column — the flight itself carries the load, so the walking-line going stays generous even on smaller designs. Top-of-the-market bespoke joinery; needs both budget and space.",
    audience: 3, classification: "expert_observation" },

  { q: "How much space do I save by using winders instead of a landing on a turning staircase?",
    a: "Roughly 0.4-0.9 m² depending on the layout. Quarter-turn saves about 0.6 m² (2.3 m² winder vs 2.9 m² landing at Doc K minimums). Half-turn saves about 0.4 m² (2.72 m² winder vs 2.56 m² landing at Doc K minimums — landing sometimes actually more compact due to flight overlap). If floor area is truly tight, the winder pays back; if you regularly carry large furniture up and down, a landing is meaningfully more comfortable.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Does having the handrail on the left vs right change how much floor space a staircase needs?",
    a: "No — handrail side is purely a design and practical choice, not a footprint one. Doc K requires a handrail on at least one side up to 1000 mm width (or both sides above that width), but which side the single handrail sits on doesn't change the flight dimensions or the space it takes. In UK terraces the handrail typically sits against the party wall side (see the paired-neighbour mirror rule — if you're on the right of the pair, your staircase and handrail are usually on your left).",
    audience: 2, classification: "expert_observation" },

  { q: "How do I work out exactly how much floor area I have for a staircase in my house?",
    a: "Measure four things: (1) FLOOR-TO-FLOOR HEIGHT — top of finished ground floor to top of finished first floor, exact millimetres; (2) available WIDTH at the base of where the staircase will go; (3) available LENGTH at the base; (4) any FIXED CONSTRAINTS in the plan (doorways, columns, windows the staircase can't overlap). Give those four numbers to a staircase maker or ask me and we can work out which layouts fit, which are borderline, and which are ruled out. Never guess at floor-to-floor height — a 20 mm error changes every rise in the flight by 20 mm ÷ number-of-rises.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Can Nex work out the specific staircase footprint for my exact floor-to-floor height?",
    a: "Yes — give me your floor-to-floor height in millimetres, your preferred layout type (straight, half-turn landing, half-turn winder, spiral, etc.) and your available width, and I can calculate: number of rises, exact rise per step, going per step, flight length, landing size, and total floor footprint. All calculations are drawn from Approved Doc K (England) minimums — for a specific project you'll still want to run the final numbers past your staircase maker and Building Control, but the calculation will get you to the right ballpark instantly.",
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

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 22 (plan-size / footprint reference): Added ${added} new entries (${skipped} skipped).`);
console.log(`   Total: ${doc.entries.length} entries`);
console.log(`   Backing files: docs/staircase-plan-sizes-uk.md + data/staircase-plan-sizes.json`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
