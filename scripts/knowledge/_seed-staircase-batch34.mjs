#!/usr/bin/env node
// Batch 34 — materials-first + master library + reference image requirements per component category.
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "Why does Nex Stairplan build the master material library BEFORE the 3D components?",
    a: "Because every component references materials by ID — so if the materials are perfect, every downstream component using them looks perfect automatically. Change MAT-002 European White Oak's texture once and every handrail, newel, baluster and tread rendered in white oak instantly updates across the whole platform. If we built 40 components first and THEN refined materials, every component would need re-rendering. The right build order: 21 master materials FIRST (14 timbers + 2 metals + 4 glass + MDF paint-grade), then the ~38 Modern Collection components on top.",
    audience: 3, classification: "expert_observation" },

  { q: "What reference images does Stairplan need per component to model it accurately in 3D?",
    a: "Depends on the component TYPE, not one-size-fits-all. PROFILE-DRIVEN components (handrails, cover slips, mouldings) need 3-4 shots: end cross-section (dimensioned) + side elevation + 3-quarter hero + optional joint detail. TURNED / SYMMETRIC components (turned balusters, ball caps, finials, volutes) need 3-4 shots: side silhouette (the lathe profile) + top view + 3-quarter + optional turning detail. FULL 3D-FORM components (newel posts, glass fixings, cantilever brackets) need 4-6 shots: front + side + top elevations dimensioned + 3-quarter hero + joinery/mounting details. BOARD-LIKE components (treads, risers, landings, strings) need ZERO per-item images — they're rectangular geometry painted with the material texture; the material does 100% of the visual work.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Do I need reference images of every timber tread, riser, and string?",
    a: "No. Board-like components (treads, risers, landings, string boards) use rectangular geometry painted with the MATERIAL texture. Same tread shape works in oak, walnut, ash, pine — the material carries all the visual variation. The ONLY exception: tread NOSING profile variants (bullnose vs standard vs pencil-round) each need one cross-section image showing the front-edge profile, because that geometry actually differs. This is why the master material library is worth investing in first: it does the visual heavy-lifting on every board-like component automatically.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "How many reference images total does Stairplan need for the Modern Collection launch?",
    a: "Approximately 400 total. Breakdown: ~145 component reference images (6 handrails × 3-4 shots + 6 newel posts × 4-6 shots + 6 caps × 3-4 + 8 balusters × 3-4 + glass fixings + string profiles + nosing variants) + ~250 material PBR texture references (21 materials × 12 asset checklist images). Every component reference must be shot on neutral background with perpendicular camera angle (no perspective distortion), a visible scale reference, and dimensions annotated. Total is achievable — it's the launch investment that produces every combination of every timber for every design forever after.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is the reference image shot-format rule for Stairplan components?",
    a: "Neutral studio-softbox lighting (moody atmospheric hides geometry). White or 18% grey background (high contrast against the component). Perpendicular camera angle on all elevations — no perspective distortion (so the artist can measure real proportions from the image). Visible scale reference in shot (ruler, 100mm cube, or dimensioned annotation) — otherwise 'looks about right' becomes 'wrong dimensions on the CNC'. Elevations MUST show real millimetre dimensions annotated. Minimum 2K resolution; 4K for material texture reference shots. Every shot at this standard means the artist can model to spec on the first pass, not iterate through rough approximations.",
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
console.log(`✅ Batch 34 (materials-first + reference image requirements): Added ${added} new entries. Total: ${doc.entries.length}`);
