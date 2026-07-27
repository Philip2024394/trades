#!/usr/bin/env node
// Batch 32 — V1 launch strategy + Designer Collections + interactive components + Compare/Walk/Real House modes + canonical ID rule + Design Pack.
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What's actually shipping in Stairplan V1?",
    a: "The MODERN COLLECTION only — one premium collection at Tier 3+ visual quality, not 60+ components spread thin. Scope: 6 handrails, 6 newel posts, 8 balusters, 3 glass systems, 4 string types, 6 newel caps, 5 tread profiles = ~38 components. That gives thousands of possible combinations while keeping every component at professional-photograph quality. Traditional Collection, Industrial Collection, Coastal Cottage etc. all planned for V2/V3/V4 — but only AFTER Modern ships and customers say 'wow'. Quality beats quantity, always.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How does Nex Stairplan handle timber materials — generic or specific to Stairplan?",
    a: "Every timber species is scanned from an ACTUAL Stairplan physical sample, not a generic Poly Haven texture. When a customer chooses American Walnut they see the American Walnut Stairplan actually sells — with its specific grain, colour, tone. This becomes part of the Stairplan brand — competitors using generic textures look approximate; Stairplan looks precise. Requires physical sample photography + 4K PBR texture creation per species, roughly £300-500 per timber captured properly. One-off investment that pays back on every rendered image forever.",
    audience: 3, classification: "expert_observation" },

  { q: "Can you tap a specific component in the Nex 3D viewer to learn about it?",
    a: "Yes — every component is interactive. Tap a handrail and the camera flies to it in about 800ms, then an info card slides in showing: component name (e.g. HR-003 Oval Handrail), timber species with MAT ID, length in this specific design, weight in kg, cost, compatible components list, gallery link and change-component link. Turns the configurator into a product catalogue at the same time — customers understand what they're buying, not just what it looks like. All data pulled from the Digital Staircase Catalogue by component ID.",
    audience: 2, classification: "expert_observation" },

  { q: "Can I compare two staircase designs side-by-side in Stairplan?",
    a: "Yes — Compare mode splits the screen vertically. Left half shows configuration A (say Modern Oak); right half shows configuration B (say Walnut). Both cameras rotate together — synchronized OrbitControls — so as you drag one, the other follows exactly. The price differential displays live in the middle divider as you adjust either side. Instantly answers 'is walnut worth the £X extra?' by showing both simultaneously rather than describing them in sequence. Also works for balustrade comparison (glass vs turned spindles), layout comparison (straight vs half-turn) and material comparison (Oak vs Ash vs Walnut).",
    audience: 2, classification: "expert_observation" },

  { q: "What is Real House Mode in Stairplan?",
    a: "The staircase renders INSIDE a real 3D room instead of floating in empty grey space. Options: white-walls-oak-floor (modern), grey-carpet-neutral (contemporary), period-hallway (traditional), coastal-white-cottage (light), warehouse-loft (industrial). Furniture props (console table, art, plant) frame the entrance. Real windows imply real light direction. Customer INSTANTLY imagines the staircase in their own home — the emotional-design leap kitchen software made years ago that most staircase configurators still haven't. Room environment auto-switches when the customer selects a Designer Preset — Scandinavian → scandi-white-loft; Traditional English → period-hallway.",
    audience: 2, classification: "professional_recommendation" },

  { q: "When I change the timber in Stairplan, does anything else change?",
    a: "Yes — the WHOLE ROOM changes to match. Choose Walnut and the room lighting warms up, the floor darkens, the wall colour deepens, the furniture reads richer. Choose Ash and the room brightens, the floor lightens, the walls become fresher. Why? Because different timbers suit different interiors. Showing a walnut staircase against Scandi-white walls doesn't help the customer decide. Showing it in the CONTEXT it belongs in — evening light, darker parquet, warm furniture — makes the customer imagine their future house. Emotional design, not just technical accuracy.",
    audience: 2, classification: "expert_observation" },

  { q: "What is Walk Upstairs mode in Stairplan?",
    a: "First-person camera walking naturally up the staircase — start at bottom (~1650mm eye height), slow ~0.3m/s along the pitch line, ~2-3s per tread, subtle head-bob matching gait, look forward + slightly up as you climb, swing round at landings. Reserved for the 'wow' moment after the customer's finished designing — because a staircase experienced walking up sells the design better than any spinning orbit shot. Especially powerful on half-turn and curved staircases where the walk-through reveals the geometry a static view can't capture.",
    audience: 2, classification: "expert_observation" },

  { q: "What are Designer Presets and how do they help someone new to designing a staircase?",
    a: "Curated starting-point configurations instead of a blank canvas with 40 dropdowns. The five current presets: SCANDINAVIAN (oak + white + glass + hidden fixings) · MODERN LUXURY (walnut + glass + LED + floating feel) · TRADITIONAL ENGLISH (turned balusters + oak + stop-chamfered newels) · INDUSTRIAL LOFT (black metal + ash treads + cable balustrade) · COASTAL COTTAGE (painted turned balusters + oak handrail + warm textures). Beginners start from a preset that already looks right for their house style. Advanced users tweak from there. Each preset references components by canonical ID from the catalogue — nothing duplicated. Choose a preset and the timber, room environment and every component load together as one coherent design.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What does Stairplan give me when I've finished designing?",
    a: "Not just a screenshot — a complete DESIGN PACK. Includes: 3D hero render (photorealistic), 3D walk-through video (30s), floor plan drawing (dimensioned), side elevation, Doc K compliance report (all 20 checks with approvals), material list (BOM by component ID + timber), estimated cost breakdown, manufacturing summary (workshop-ready), QR code (opens the 3D viewer on any phone), shareable link (send to partner/architect/builder). All generated automatically from the same geometry model that drove your design — no manual work, no drift between what you saw and what you'll receive. Stops looking like software; starts looking like a professional design studio's deliverable.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why does every Stairplan component have one canonical ID that never changes?",
    a: "So that every system in the platform (3D viewer, plan drawings, elevations, pricing database, bill of materials, CNC toolpaths, install guides, marketing photos, AR previews, future VR walkthroughs) references the SAME component by its ID — never duplicates the component's data. If handrail HR-014 improves in the catalogue tomorrow, every 3D render, every quote, every workshop drawing, every CNC file, every marketing photo automatically references the improved version. No system holds its own copy. No drift possible. This is what lets Stairplan scale from a configurator into a full design-and-manufacturing platform without turning into a maintenance nightmare. The canonical-ID rule is a HARD architectural constraint — never break it.",
    audience: 4, classification: "manufacturer_guidance" }
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
    safety_note: null, source_verified_at: null, fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 32 (V1 launch strategy + all 10 ideas + canonical ID): Added ${added} new entries. Total: ${doc.entries.length}`);
