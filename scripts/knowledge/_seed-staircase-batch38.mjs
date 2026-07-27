#!/usr/bin/env node
// Batch 38 — riser-step tongue-groove joint + housing depths + wedge specs (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "Why does the back of my staircase show a yellow light line where the riser meets the step?",
    a: "The riser isn't grooved into the step above. In proper UK housed-string construction, the riser has a TONGUE on its top edge that fits UP INTO a matching groove cut in the underside of the tread — about 12mm deep. This tongue-and-groove seal blocks any light path through the joint. Without it, even the tiniest manufacturing gap between riser top and tread body lets background light show through as a visible line at the back. Fix: reject and re-order (or ask the maker to strip and re-fit with the correct joint).",
    audience: 2, classification: "safety_advice", safety: "A visible light line at the riser-step joint indicates the tongue-and-groove joint is missing — a qualified staircase professional should assess the joint quality." },

  { q: "How is the riser joined to the step above in a housed-string staircase?",
    a: "The tread has a GROOVE cut into its underside at the back edge, about 12mm deep, matching the riser thickness (typically 18mm). The riser has a matching TONGUE on its top edge that fits up into the groove. Glued together at assembly. This creates a light-tight, mechanically-locked joint that prevents both light leak AND joint squeaking as the staircase flexes under foot traffic.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "How deep do steps and risers slot into the string?",
    a: "12mm to 15mm into the interior face of the string on BOTH sides. The housings are rectangular dado cuts. The tread or riser end slots in, and a pine wedge is driven behind it to lock it firmly. This gives a mechanical joint that doesn't rely on screws or nails — the geometry itself holds the assembly together.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "How many wedges are needed per step in a housed-string staircase?",
    a: "Per tread + riser pair: ONE wedge UNDER the step (driven upward from below, locking the tread) + ONE wedge UPWARD at the riser (driven upward behind the riser, locking the riser) — at EACH string end. So a 900mm staircase = 4 wedges per step total (2 wedges × 2 string ends). Total for a 12-step flight: about 48 wedges. All in pine (softwood absorbs the driving shock and grips well when glued).",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "How long should staircase wedges be?",
    a: "9 to 12 inches (230-305mm). Each wedge is CUT TO SUIT the specific rise and going of that staircase — not one-size-fits-all. Thick end is around 12mm tapering to about 3mm at the thin end. Width must stay INSIDE the string thickness (so a 32mm string takes a 28mm-wide wedge; the wedge shouldn't poke out either side of the string housing). Pine is the standard material.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Do wedges stick out past the string on a housed staircase?",
    a: "No — a wedge that protrudes past the string thickness is a sign of undersized housing or oversized wedge, and would look wrong from either side of the staircase. Correctly sized wedges sit entirely INSIDE the string housing rebate, invisible from the flight side and visible only from the UNDERSIDE view where you can see them sitting tucked behind each tread and riser end.",
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
console.log(`✅ Batch 38 (riser-step joint + wedge specs): Added ${added} new entries. Total: ${doc.entries.length}`);
