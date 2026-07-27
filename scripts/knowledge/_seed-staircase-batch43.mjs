#!/usr/bin/env node
// Batch 43 — T&G sheeting + panelling + plasterboard options for back of staircase (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What are my options for cladding the back of a staircase?",
    a: "Three main options: TONGUE-AND-GROOVE SHEETING (timber planks that slot into each other, warm timber finish), PANELLING (sheet panels like plywood/MDF/veneered fixed to battens, quicker install), or PLASTERBOARD (drywall taped and jointed then painted, cleanest modern look). All three can look beautiful when done right and terrible when done wrong. Pick based on the finish you want (timber vs painted), your budget, and how confident you are with the installer.",
    audience: 2, classification: "expert_observation" },

  { q: "How do I install T&G sheeting on the back of a staircase?",
    a: "Rules that stop trouble: (1) always leave 7-10mm expansion gap at BOTH ends of the run — timber expands when it warms up to room temperature and no-gap installs bow or split. (2) HIDE the nails — pin through the LIP/TONGUE side of each board so the next board's groove covers the pin hole. Air compressor + brad nailer makes this quick; hammer + nail punch works fine too. (3) Fix 2\"×2\" rough drywood battens to the inner back of the staircase first — this is what the sheeting nails onto. (4) Cover the raw edges with 2-3 angle slips (moulding strips) — buy from hardware store or order with your sheeting from a joinery shop.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Where do I buy T&G sheeting in a species that's not standard?",
    a: "Your local joinery shop. They can machine T&G in almost any timber species you can supply — walnut, ash, cherry, sapele, whatever. Standard joinery job, usually done same-week. Big-box merchants (Wickes, Travis Perkins, etc.) stock the common species (pine, oak). Anything else, go local.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why must I leave an expansion gap when installing T&G sheeting?",
    a: "Because timber expands when it warms up to room temperature (and shrinks when it cools). If you nail T&G tight against a wall on both sides, the boards have nowhere to go when they expand — they bow outward, push adjacent walls, or split at the tongue-and-groove joints. Leave 7-10mm at each end (both sides) and the movement is absorbed harmlessly. The angle slips cover the gap so it's invisible from outside.",
    audience: 2, classification: "safety_advice", safety: "Timber expansion is not optional — every wood installation must include an expansion gap. Ignoring it damages both the sheeting AND surrounding walls." },

  { q: "How should I nail T&G sheeting so the fixings aren't visible?",
    a: "Angle the pin at 45° through the TONGUE side of the board (the raised lip). The next board's GROOVE slides over the tongue and covers the pin hole completely. Result: no visible nails on the finished surface — clean continuous timber. This technique is called SECRET NAILING or BLIND NAILING. Air compressor + brad nailer makes it quick because the tool positions the pin at the correct angle automatically; with a hammer you use a nail punch to sink the head just below the tongue surface.",
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
console.log(`✅ Batch 43 (T&G sheeting + backside options): Added ${added} new entries. Total: ${doc.entries.length}`);
