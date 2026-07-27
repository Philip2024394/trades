#!/usr/bin/env node
// Batch 28 — expose the V2 parametric model to the brain surface.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What's the difference between the V1 and V2 Nex Staircase Geometry Engine?",
    a: "V1 was a calculator — pass inputs, get static geometry back. V2 is a parametric CAD-style model — parameters are FIRST-CLASS OBJECTS, changing one triggers automatic rebuild of every dependent value and every component, with revision history preserved and events emitted for downstream subscribers. Same architectural pattern as SolidWorks, Fusion 360 and Inventor. Change width from 900mm to 1000mm and the whole model updates automatically: every tread widens, every string repositions, every derived value recomputes, revision bumps by 1, previous revision stays in history, event fires so downstream engines (compliance, drawings, CNC, 3D preview) re-render.",
    audience: 3, classification: "expert_observation" },

  { q: "Does every part in the Nex Geometry V2 have a stable unique ID?",
    a: "Yes — every component gets a permanent CAD-style ID. Treads are TREAD-001, TREAD-002 etc. Strings are STRING-L-001 and STRING-R-001. Risers are RISER-001. Newels are NEWEL-001 through NEWEL-004 (4 corners). Handrails are HANDRAIL-L-001 and HANDRAIL-R-001. Spindles are SPINDLE-L001 upwards. Materials are MAT-001 (European oak), MAT-002 (American white oak) etc. Every downstream engine references these IDs instead of array positions. If a spindle moves in a revision, TREAD-005's child SPINDLE-L015 is still SPINDLE-L015 — the position may change but the ID persists across revisions.",
    audience: 3, classification: "expert_observation" },

  { q: "Do components in the Nex Geometry V2 know their parent and children?",
    a: "Yes. Every component has a `parent` field (single ID or null for top-level) and a `children` array of IDs. TREAD-007 has parent STRING-L-001 and children like SPINDLE-L015, SPINDLE-L016. HANDRAIL-L-001 has parent NEWEL-001. This lets downstream engines walk the tree — 'find every child of STRING-L-001' returns all treads, risers and their spindles in one traversal. It also means editing one component (change a spindle spacing) auto-locates every child that needs updating.",
    audience: 3, classification: "expert_observation" },

  { q: "Do components in Nex Geometry V2 have local coordinates as well as world coordinates?",
    a: "Yes — every component stores world_position (absolute X,Y,Z from staircase origin), local_position (relative to its parent), rotation (pitch/yaw/roll degrees), scale (usually 1,1,1 unless mirrored), and normal vector (direction the top face points). This dual-coordinate system is exactly how professional CAD systems work — future DXF/STEP/IFC exporters can consume either coord set directly without recalculation. Local coords also mean moving a parent auto-relocates all its children — move NEWEL-001 by 20mm, HANDRAIL-L-001 follows automatically because its local origin is unchanged.",
    audience: 4, classification: "expert_observation" },

  { q: "Does the Nex Geometry Engine V2 handle dimensional tolerances?",
    a: "Yes — every dimension is stored as {nominal, tolerance, min, max, unit}, not just a scalar value. TREAD-001 length is not '272mm' but {nominal: 272, tolerance: 0.5, min: 271.5, max: 272.5, unit: mm}. Newels sit at ±0.5mm tolerance; strings at ±1mm on the diagonal; landings at ±2mm on depth. Manufacturing engines downstream (housing depth, mortice size, glass groove) can query the tolerance envelope, not just the nominal number. Critical for CNC output because a workshop needs to know how tight to hold a dimension.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Does the Nex Geometry Engine V2 emit change events?",
    a: "Yes — there's an event bus. Set any parameter via model.setParameter(name, value) and TWO events fire: 'parameter_changed' (which param, old value, new value) and then 'geometry_rebuilt' (revision number, reason, list of affected component IDs). Downstream engines subscribe with model.on('geometry_rebuilt', handler) and re-render automatically. No polling, no dirty-flag checking, no drift. Exactly the pattern professional CAD systems use to keep drawings, BOM, 3D view and manufacturing output in sync.",
    audience: 4, classification: "expert_observation" },

  { q: "Does Nex Geometry V2 keep revision history?",
    a: "Yes — every rebuild creates a snapshot in the model's history array: revision number, timestamp, reason (what parameter changed and how), full parameter snapshot, full derived-values snapshot, component count. Nothing is ever overwritten — you can retrieve revision 5 to see exactly what the design was at that point. Basis for future collaboration features (see who changed what), rollback ('go back to the design we had before we increased the width'), and audit trails for Building Control sign-off.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Does Nex Geometry V2 include manufacturing metadata per component?",
    a: "Yes — every component carries a manufacturing block: status (READY/HOLD/CHANGED), machine (CNC/lathe/hand), tool (12mm router, moulding cutter, spindle turning etc.), operation (housing_cut, riser_cut, newel_mortising, spindle_turn etc.), and estimated_minutes. Workshop-consumption ready — a downstream module can filter for 'all components status=READY, machine=CNC' and emit a batch for the router; another can total estimated_minutes for scheduling. Real per-workshop time estimates would need Stairplan's actual rates plugged in, but the framework is live.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Are staircase timbers stored as material objects in Nex V2?",
    a: "Yes — the timber species database is loaded as a MATERIAL REGISTRY with stable IDs (MAT-001 through MAT-018 for the 18 UK-relevant species). Components reference material_id, not species name strings. Each material object carries density, Janka hardness, moisture movement class, cost band, machining difficulty, typical finish, and trade notes. Change a component's material_id from MAT-001 (European oak) to MAT-004 (American walnut) and weight auto-recomputes from the new density; future pricing engine will read cost_band from the same object; CNC engine will read machining_difficulty. Single source of truth for material data.",
    audience: 3, classification: "expert_observation" },

  { q: "Does Nex V2 have a full constraint solver like SolidWorks?",
    a: "Honest answer: no, not the equivalent of SolidWorks. V2 has the parametric FRAMEWORK for it — parameters, derived values with declared dependencies, automatic recomputation on parameter change, event-driven propagation. This is the ARCHITECTURAL foundation for a full constraint solver (kinematic constraints, geometric constraints like coincidence/parallel/perpendicular, dimensional constraints, over/under-constrained detection). A production-grade solver like SolidWorks took decades to build; V2 is where a proper solver would live once someone builds one. Every design DOES stay consistent within the current parametric definitions — change a parameter, whole model updates, no drift.",
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
console.log(`✅ Batch 28 (Geometry V2 parametric model): Added ${added} new entries. Total: ${doc.entries.length}`);
