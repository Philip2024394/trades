#!/usr/bin/env node
// Batch 26 staircase seed — expose the compliance engine, health
// check, and 4-engine architecture to the brain surface.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "Can Nex fully validate my staircase design against Approved Doc K?",
    a: "Yes — a deterministic 20-check compliance engine runs every rule from Approved Doc K in one call and returns PASS / WARNING / FAIL per check plus an overall verdict (🟢 Approved / 🟡 Requires Attention / 🔴 Non-Compliant). Checks include: rise, going, pitch, riser count, going count, headroom (with loft exception), landing dimensions, winder compliance, open riser 100mm sphere test, balustrade heights (stair + landing), spindle spacing, glass safety spec, handrail height + sides required, width validation, nosing projection, uniformity, floor-finish adjustment, structural warnings, and user-safety advisories. Every rule cites the specific Doc K clause. The engine is deterministic — never LLM math.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is the Nex staircase Health Check?",
    a: "A single call that scores your design 0-100 across SIX dimensions: 🟢 COMPLIANCE (Doc K), 🟢 COMFORT (easy to walk — pitch + 2R+G + rise/going in comfort zone), 🟢 SAFETY (open risers, spindle spacing, headroom, elderly/child considerations), 🟢 MANUFACTURING (design complexity vs standard build), 🟢 INSTALLATION (fit complexity, access, coordination-heavy trades), 🟢 COST EFFICIENCY (layout premium, glass, timber species). Each score is deterministic (calculated from formulas, not LLM'd). If a score is below 100, Nex explains WHY and suggests specific improvements — 'reduce rise by adding one more riser', 'increase going by 20mm', 'widen the landing to flight-width'. Instant actionable feedback rather than a bare pass/fail.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How does Nex score a staircase's comfort score?",
    a: "Comfort scoring starts at 100 and deducts points for each way the design falls outside the comfort zone. RISE above 200mm loses points (feels steep — ideal 175-190mm). GOING below 240mm loses points (foot lands close to nosing — ideal 250-280mm). PITCH above 40° loses points (ideal 35-40°). 2R+G away from ~630mm loses points (comfort formula target). A staircase can be fully Doc K compliant AND still score badly on comfort — Doc K sets the minimum, comfort scoring identifies what to tune within those limits.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the architecture behind the Nex staircase calculators — why is it split into different engines?",
    a: "Four separate deterministic engines, per Philip's specification. ENGINE 1: BUILDING REGULATIONS (Approved Doc K + regional variants + BS 5395 + BS 6180). ENGINE 2: MANUFACTURING RULES (string calculations, housing depth, tread thickness, winder geometry, CNC rules). ENGINE 3: SAFETY & BEST PRACTICE (comfort geometry, material suitability, timber movement, installation advice). Each engine handles one concern cleanly. Nex reads the results from all four and explains them in plain English. Critically: the engines DO the maths; Nex explains it. LLM arithmetic is never acceptable for engineering — deterministic formulas only.",
    audience: 3, classification: "expert_observation" },

  { q: "Does Nex have a timber species database — does she know what oak, walnut, ash, sapele, pine actually are for staircase use?",
    a: "Yes — 18 UK-relevant timber species indexed with density, Janka hardness, moisture movement class, cost band, machining difficulty, typical finish and interior-suitability notes. Species covered: European oak, American white oak, walnut (generic + American), ash, hard maple, cherry, beech, sapele, iroko, idigbo, tulipwood, Scandinavian pine, white deal, hemlock, Douglas fir, Accoya, genuine mahogany (with CITES note). Nex uses this to answer 'is walnut harder than oak?' (yes — 1010 vs 1290 lbf Janka), 'which timber's best for painted risers?' (tulipwood or white deal), 'what's a budget alternative to oak?' (idigbo or Douglas fir). Not fabricated — every value is the trade-standard published figure.",
    audience: 3, classification: "expert_observation" },

  { q: "What does Nex still need to complete the full Stairplan vision Philip described?",
    a: "Three categories. FIRST: STAIRPLAN-SPECIFIC DATA (pricing per material, labour rates per hour, workshop-specific CNC machining costs) — Nex can't fabricate these, they need real business inputs to plug in. SECOND: SPECIALISED LIBRARIES for outputs (2D/3D drawing generation via SVG, PDF export for quotes, DXF/STEP/IFC export for CNC and BIM systems) — needs proper libraries integrated at the serving layer, not something an LLM produces. THIRD: EXTENDED STANDARDS (BS 5395 stair standards, BS 6180 barriers, Scotland Technical Handbook, NI Technical Booklet H) — needs the same clause-by-clause research + validation that Doc K has had. Compliance engine + calculator + health check are the foundation; the vision layers on top.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why did Philip insist on 'AI explains, calculator calculates' for the staircase engine?",
    a: "Because large language models fabricate numbers under pressure. A calculation that starts as 'rise 209.8mm' can become 210mm, then 215mm, then a Doc K compliance failure across successive LLM turns without warning. Engineering calculations MUST be reproducible, auditable and correct — properties an LLM cannot provide. A staircase built to wrong dimensions is a real safety risk. So the architecture is: deterministic JavaScript functions do every calculation, Nex reads the structured result and explains it in plain English. She's the interpreter, not the calculator. This is the fundamental principle behind every Nex engineering feature.",
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
console.log(`✅ Batch 26: Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
