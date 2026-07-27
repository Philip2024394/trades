#!/usr/bin/env node
// Batch 30 — component library + rendering engine architecture disclosure.
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "How does Nex Stairplan render staircases — does it AI-generate the 3D model?",
    a: "No — that would give inconsistent, approximate results. Instead Stairplan uses a COMPONENT LIBRARY architecture: every physical staircase part is a professionally-modelled GLB file with a stable ID (HR-001 Modern Square handrail, NP-002 Stop Chamfered newel, B-004 Glass Panel baluster etc.). The Geometry Engine outputs dimensions + which component IDs to use. The Rendering Engine loads exactly those GLB files, scales and positions them per the geometry, applies the chosen timber's PBR material, and renders under HDR lighting. What customers see is the actual staircase they designed — not an AI's approximation of it. Same architectural pattern as kitchen configurators, Tesla, IKEA Place.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the difference between the Geometry Engine and the Rendering Engine?",
    a: "Two separate concerns, deliberately split. The GEOMETRY ENGINE computes dimensions, positions and component IDs — it says 'you need 12 treads of TR-002 type, 4 NP-004 newels at these XYZ positions, 24 B-004 glass panels at these bays'. It cares about maths and Doc K compliance; it doesn't care about how anything looks. The RENDERING ENGINE loads the actual GLB 3D models for those component IDs, scales them to the geometry's dimensions, applies materials, lights the scene, and produces the visual. Same model used for the 3D preview, the plan drawing, the elevation, the material list and future CNC output. Every downstream engine consumes the same geometry — no drift possible.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "What component categories does the Stairplan library cover?",
    a: "16 categories with stable ID prefixes: HR- handrails · NP- newel posts · NC- newel caps · B- balusters · ST- strings · TR- treads · RS- risers · GP- glass panels · GF- glass fixings · CS- cover slips · VL- volutes · TN- turnouts · CT- curtail steps · LED- LED lighting · WW- winder wedges · LG- landings. Each component has: 3D model URL, 2D symbol URL, manufacturing drawing URL, dimensions, weight, timber usage, price, list of compatible components (HR-003 pairs with these newels, these balusters), available timbers, installation instructions and CNC profile. One component modelled once, used across thousands of staircases in any timber.",
    audience: 3, classification: "expert_observation" },

  { q: "What visual quality is Stairplan targeting for the 3D configurator?",
    a: "The tier of Apple's Vision Pro product viewer, IKEA Place, Tesla vehicle configurator, high-end kitchen configurators (Bulthaup, Kitchen Craft) and luxury furniture configurators. Not CAD look — premium-product look. Achieved through: professionally-modelled GLB components (not AI-generated primitives), PBR materials per timber species with real wood grain textures, HDR image-based lighting, physically-correct shadows, ambient occlusion, ACES filmic tone mapping. Camera presets: hero, plan, elevation, section, walkthrough. Target: 60fps mobile orbit, <200ms parameter change response, <1.5s first paint on 4G.",
    audience: 2, classification: "expert_observation" },

  { q: "What's Nex's role if she doesn't generate the 3D staircase?",
    a: "Nex RECOMMENDS component combinations, doesn't generate geometry. Example: customer says 'modern staircase for a new build'. Nex reads their inputs + property type + style preferences and suggests: 'For a modern new-build I'd suggest NP-004 Modern Box newels + HR-001 Modern Square handrail + B-004 Glass Panel balusters with GF-001 Point Fixings — in MAT-001 European Oak for warmth or MAT-004 Walnut for luxury.' The Geometry Engine then builds exactly that combination. Every pixel the customer sees corresponds to a real, quotable, manufacturable component. AI as INTERPRETER + ADVISER — engineering stays deterministic.",
    audience: 3, classification: "expert_observation" },

  { q: "What Nex Stairplan features still need 3D artist work vs code work?",
    a: "The FRAMEWORK is code (built): component library schema, rendering engine architecture spec, geometry engine V2 that emits component IDs. The ASSETS need a 3D artist (not built in-session): actual GLB 3D models for each component in the library (~60+ files), PBR texture sets for each timber species (~18 species × 4 texture maps = 72 textures), HDR environment maps for lighting (3-5 studio environments). Once the assets exist, the rendering engine's a one-session integration job. Until then the current prototype uses primitive boxes as placeholders — deliberately, so the architecture's proven correct before art investment.",
    audience: 3, classification: "professional_recommendation" }
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
console.log(`✅ Batch 30 (component library + rendering engine): Added ${added} new entries. Total: ${doc.entries.length}`);
