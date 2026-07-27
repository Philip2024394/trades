#!/usr/bin/env node
// Batch 29 — the Visual Builder prototype is live.
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "Can I actually SEE a live 3D staircase update as I change the design?",
    a: "Yes — open `trades/public/staircase-configurator/index.html` in a browser. Left panel: sliders and dropdowns for floor-to-floor height, width, going, timber species, layout, closed/open risers, glass balustrade. Centre panel: interactive 3D viewer (rotate with mouse, zoom with wheel, pan with right-click). Right panel: live Doc K compliance status, 4 health scores, physical stats (parts count, weight, timber volume, estimated cost) plus a Nex commentary that adapts to what you're designing. Every parameter change re-runs the geometry engine, rebuilds the 3D model and updates the whole status panel in under a second.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What can the Nex Visual Builder prototype actually do?",
    a: "Live parametric staircase design in a browser. You can change floor-to-floor height (2000-3500mm), width (760-1400mm), going (220-320mm), timber species (oak, American white oak, walnut, ash, painted pine), layout (straight or half-turn), toggle closed risers and glass balustrade — every change rebuilds the 3D model instantly. Compliance status (🟢 PASS / 🔴 FAIL) updates against Doc K rules. Health scores (comfort, safety, manufacture, cost) recalculate. Physical stats (parts count, weight in kg, timber volume in m³, estimated cost) refresh. Nex's commentary at the bottom adapts to what you're building — flagging compliance failures, praising well-proportioned designs, explaining premium timber choices.",
    audience: 2, classification: "expert_observation" },

  { q: "How does Nex use the Visual Builder to advise a customer?",
    a: "She READS the geometry engine's output and explains it in plain English. Example: customer changes width to 750mm — Nex sees the compliance engine returning a warning + reads the health score dropping — and comments 'Very narrow width; meets Doc K minimum but tight for daily use. Consider 900mm if the hallway allows.' She never invents numbers. Every number she quotes comes from the geometry engine, the compliance engine or the health check. This is the architectural principle in action: engine does maths, Nex does interpretation.",
    audience: 3, classification: "expert_observation" },

  { q: "What's missing from the Visual Builder prototype vs a production version?",
    a: "The prototype is a self-contained demonstration — one HTML file, no build system, no backend. Production version needs: proper frontend framework (React/Vue/Svelte with state management), backend API serving the V2 geometry engine (Node.js + Express), user accounts + saved designs + shareable links, payment integration for quotes, textured PBR materials in the 3D view (currently flat colours), all layouts (prototype = straight only + half-turn stub; needs winder, spiral, curved etc.), mobile-responsive UI, accessibility, real Stairplan pricing plugged in for the cost estimate (currently a placeholder based on weight × timber-multiplier). But the prototype proves the pattern — every future feature layers on top.",
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
console.log(`✅ Batch 29 (Visual Builder disclosure): Added ${added} new entries. Total: ${doc.entries.length}`);
