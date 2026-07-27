#!/usr/bin/env node
// Batch 27 staircase seed — the Geometry Engine is now real.
// Every other engine (drawings, materials, pricing, CNC, 3D) will
// derive from this single source of truth.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "What is the Nex Staircase Geometry Engine?",
    a: "A deterministic module that computes exact X, Y, Z coordinates for every physical component of a staircase — every tread, every riser, every string, every newel, every spindle, every handrail. Origin (0,0,0) at the bottom-left corner of the staircase base. X = direction of travel up the flight. Y = across the width. Z = vertical. It's the SINGLE SOURCE OF TRUTH for the whole staircase — compliance checks, drawings, materials, pricing, CNC and 3D previews all derive from this geometric model, so every output stays consistent. Given a floor-to-floor height and layout, the engine outputs 97+ discrete parts with dimensions, weights and positions in about a millisecond.",
    audience: 3, classification: "expert_observation" },

  { q: "Why does the geometry engine matter more than the other engines?",
    a: "Because it's the SOURCE that everything else derives from. If pricing calculated total timber volume separately from CNC calculating cutting list separately from drawings calculating dimensions, the three would drift out of sync — same design would give different numbers depending on which engine you asked. With one geometry engine as the source of truth, the exact same tread position feeds the CNC toolpath, the drawing, the material quantity and the 3D render. No drift, no reconciliation bugs, no 'which number is right?' Any change (raise the rise by 5mm) ripples through every derivative automatically.",
    audience: 3, classification: "expert_observation" },

  { q: "What can Nex's geometry engine actually produce right now?",
    a: "For a straight flight or half-turn landing staircase: exact 3D coordinates for every tread (with nosing projection), riser, string (both sides), newel post (all four corners), spindle (evenly spaced to keep 100mm sphere compliance), and handrail (following pitch). Plus per-part timber species, volume in mm³, weight in kg (from timber density), and 'ready for CNC' status flag. Plus overall bounding box, pitch angle, string diagonal length, and total weight for the whole staircase. Example: a 2500mm FTF straight oak flight generates 97 parts weighing 335kg total.",
    audience: 3, classification: "expert_observation" },

  { q: "Which staircase layouts does the geometry engine support right now?",
    a: "V1 supports STRAIGHT flights and HALF-TURN LANDING (dogleg). V2 will add quarter-turn landing, winder layouts (quarter-turn winder + half-turn winder + kite winder), spiral, curved (helical), floating cantilever, and split (double-return). Each needs its own dedicated geometry builder because the maths of the turn — walking-line goings on winders, radial layout on spiral, cantilever moment on floating — is genuinely different per layout. Adding a new layout to the engine is a self-contained job; existing straight/half-turn geometry doesn't need to change.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is Nex's Part Generator?",
    a: "A module that consumes the geometry engine's output and emits a workshop-ready PART LIST. Each part has: unique part number (PART-001, PART-002...), component type (tread/riser/string/newel/spindle/handrail), timber species, exact dimensions in mm, volume in mm³, weight in kg, ready-for-CNC status flag, and notes for the workshop. Plus a summary block showing total parts, total volume in m³, total weight, and part-count-by-component. Runs directly off the geometry engine so every part exactly matches every 3D coordinate, every drawing, every CNC toolpath.",
    audience: 3, classification: "expert_observation" },

  { q: "Show me an example of what the Nex Part Generator produces.",
    a: "For a 2500mm FTF straight oak staircase, the generator returns 97 discrete parts. Example entries: PART-001 = Tread T01 (oak, 272 × 900 × 40mm, 5.5kg). PART-012 = Riser R01 (oak, 208 × 900 × 18mm, 2.4kg). PART-024 = String S-LEFT (oak, 2843mm diagonal × 300mm deep × 32mm thick, 19.1kg, 22 housings). PART-026 = Newel N-BL (oak, 90 × 90 × 3308mm, 18.7kg). PART-030 = Spindle SP-L001 (oak, 40 × 40 × 900mm, 1.0kg). Total: 11 treads, 12 risers, 2 strings, 4 newels, 66 spindles, 2 handrails, 335kg all-in. Every part has its exact 3D coordinates in the geometry engine output.",
    audience: 3, classification: "expert_observation" },

  { q: "What still needs to be built for the full Stairplan platform vision?",
    a: "15 engines total in Philip's vision; foundation is in place. BUILT: geometry engine (V1: straight + half-turn landing), part generator, compliance engine (20 Doc K checks), health check (6-dimension 0-100 scoring), timber species database (18 species), plan-size reference. STILL NEEDED: full manufacturing engine (housing depths, mortice positions, CNC toolpaths), glass engine (dedicated), newel/handrail/string engines with more detail, material optimiser (nested cutting), installation planner, smart cost engine (needs Stairplan pricing DB), 3D preview engine (needs Three.js), drawing generator (needs SVG library), workshop pack producer, export engine (DXF/STEP/IFC/PDF). Each is a self-contained future build — the geometry engine is the shared foundation they'll all consume.",
    audience: 3, classification: "professional_recommendation" }
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
console.log(`✅ Batch 27 (Geometry Engine disclosure): Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
