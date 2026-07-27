#!/usr/bin/env node
// Batch 41 — baluster cut + tenon depth into rails (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "How deep does a baluster fit into the handrail and baserail?",
    a: "Standard UK spec: about 10mm INTO each rail groove. So the baluster top tenons 10mm up into the handrail underside groove, and the baluster bottom tenons 10mm down into the baserail top groove. This gives a mechanically secure joint (glue + wedged with slips) AND hides the cut ends inside the opaque rail bodies — so no corners are visible from any viewing angle.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Do you see the top and bottom corners of a baluster on a finished staircase?",
    a: "No — because two things hide them: (1) the top and bottom of each baluster are CUT to the staircase pitch angle so they sit flush against the underside of the handrail groove and top of the baserail groove; and (2) the baluster tenons about 10mm INTO each rail groove. Both together mean the cut ends are BURIED inside the opaque rail bodies. What you see is the baluster shaft cleanly meeting each rail with no visible join line — one of the marks of a properly-fitted balustrade.",
    audience: 2, classification: "expert_observation" },

  { q: "What angle are baluster ends cut to?",
    a: "The pitch angle of the staircase (the handrail run angle). For a typical UK domestic staircase at 42° pitch, the top of each baluster is cut at 42° to sit flush against the (angled) underside of the handrail. Bottom same angle, cut the opposite way to sit flush on the (angled) top of the baserail. Every baluster on the same flight has the same top and bottom angle — one cut jig, applied to all of them.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "What is the actual timber length needed for a 900mm baluster spec?",
    a: "The 900mm figure is the RAW stock length before angle-cutting. Once you cut both ends to pitch angle AND allow 10mm tenon INTO each rail groove, the actual installed baluster length between rail grooves depends on your specific handrail height and rail thicknesses. For a typical 900mm-above-nosing handrail with 30mm baserail and 55mm handrail, the visible length is around 680-700mm. Order 900mm stock and cut to fit — makes the maths simple.",
    audience: 3, classification: "manufacturer_guidance" }
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
console.log(`✅ Batch 41 (baluster cut + rail tenon depth): Added ${added} new entries. Total: ${doc.entries.length}`);
