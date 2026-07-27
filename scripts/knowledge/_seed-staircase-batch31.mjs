#!/usr/bin/env node
// Batch 31 — Digital Staircase Catalogue + attachment points + three render modes.
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What is the Digital Staircase Catalogue?",
    a: "The Digital Staircase Catalogue is Stairplan's intellectual property — a curated library of professionally-modelled staircase components built over months by 3D artists. It holds every handrail profile, newel post, baluster style, glass system, string design, tread profile, cap and fixing that Stairplan can build. Every staircase in the platform is assembled from this catalogue — never AI-generated or approximated. Classic Collection scale example: 18 handrails, 35 newel posts, 60 balusters, 12 glass systems, 20 string styles, 15 tread profiles, 10 nosing profiles, 30 caps, 40 iron balusters, 25 metal systems. Competitors would have to build a comparable catalogue to reach the same visual quality — the catalogue itself is the moat.",
    audience: 3, classification: "expert_observation" },

  { q: "What is an attachment point on a Stairplan component?",
    a: "Attachment points are the connection metadata every catalogue component carries so the Geometry Engine can plug parts together correctly. A baluster's model doesn't just describe its shape — it also declares its bottom-connection (a 12mm dowel pin at X=20, Y=20, Z=0) and top-connection (matching dowel pin at Z=top). A handrail declares its baluster attachment line, its start/end tenons, its scarf-joint rules. Connection types match by NAME — 'dowel_pin' matches 'dowel_socket', 'mortice' matches 'tenon', 'housed_wedge' matches 'string_housing'. Auto-assembly by type-matching is far more reliable than bounding-box guesswork.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Why do Stairplan components have stretch rules?",
    a: "Because some parts can be scaled and some can't. A handrail's `stretch_allowed: { x: true }` means it CAN be scaled along its length (up to a section_max of 3200mm, then it's scarfed). A newel post's `stretch_allowed: { all: false }` means you never squeeze it to a random height — pick the correct height_option from the catalogue (1800 / 2100 / 2400 / 2700 / 3000 / 3300 / 3800). A turned baluster stretches ONLY in its plain middle section — the turned decorative ends stay their fixed factory length. Stretch rules prevent the renderer from producing components that couldn't actually be manufactured.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "What three render modes does Stairplan produce from the same geometry?",
    a: "PHOTOREALISTIC — HDR environment, ray-traced shadows, PBR wood and glass. Living-room context, 'is this a photograph?' quality. For customer marketing and confidence. WORKSHOP VIEW — exploded axonometric with every part labelled, dimensions overlaid, fixing positions symbolised, bill of materials in sidebar. For the joiner building it. CNC VIEW — every component reduced to machining paths, tool numbers, operation sequence, cycle time. For the router cutting it. All three modes read the SAME underlying geometry model. Change one parameter and all three re-emit consistently. No drift possible between what the customer saw, what the workshop built, and what the CNC cut.",
    audience: 3, classification: "expert_observation" },

  { q: "How does Nex recommend catalogue components to a customer?",
    a: "By reading the customer's inputs (property type, style preference, budget, family situation) and suggesting specific component IDs from the catalogue: 'For your modern new-build I'd suggest NP-004 Modern Box newels + HR-001 Modern Square handrail + B-004 Glass Panel balusters with GF-001 Point Fixings — in MAT-001 European Oak for warmth, or MAT-004 American Walnut if you want luxury feel. Want me to switch you to that combination?' Nex isn't drawing anything or inventing anything. She's reading the catalogue, matching the customer's brief to combinations that fit, and letting the Geometry Engine build the exact combination. AI as adviser; deterministic engine as builder.",
    audience: 3, classification: "expert_observation" },

  { q: "What does the geometry engine unlock by staying independent of graphics?",
    a: "Everything. From one geometry model you get: customer photorealistic renders (Photoreal mode), plan/elevation/section drawings (2D orthographic renderer), workshop pack with cutting lists (Workshop mode), CNC toolpaths in G-code or DXF (CNC mode), pricing (reads component prices from catalogue), delivery weights (sums component weights), installation guide (reads install docs per component + assembles per attachment points), AR preview (loads same GLBs into AR viewer), VR walkthrough (same GLBs into WebXR renderer). One model. Many outputs. No reconciliation. The rule that makes it work: no downstream engine ever recalculates geometry — always consume the geometry engine's output directly.",
    audience: 3, classification: "expert_observation" }
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
console.log(`✅ Batch 31 (Digital Catalogue + attachment points + render modes): Added ${added} new entries. Total: ${doc.entries.length}`);
