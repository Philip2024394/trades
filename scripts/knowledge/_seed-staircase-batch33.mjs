#!/usr/bin/env node
// Batch 33 — product pages · quality levels · similar projects · compatibility engine · Inspire Me · "catalogue is the moat" positioning.
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "Does every staircase component in Stairplan get its own product page?",
    a: "Yes — every component in the Digital Staircase Catalogue has a dedicated product page at `/components/{ID}`. The page includes: interactive 3D viewer of that one component, studio product photos, real installed photos in customer homes, dimensions + weight + cost, stock/lead-time status, compatible handrails/newels/balusters/fixings (cross-linked), manufacturing drawing, installation video, and real customer projects that used this component. Discoverable via Google — customers land on a specific handrail page from search, then discover the wider configurator. Positions Stairplan as the UK's biggest staircase component library, not just a configurator.",
    audience: 2, classification: "expert_observation" },

  { q: "What are Component Quality Levels in Stairplan?",
    a: "Same geometry — different execution grade. Every component is available in four tiers: STANDARD (production-grade timber, machine lacquer, 1-2 week lead time, base price), PROFESSIONAL (prime timber, hand-finished, 3-4 weeks, ×1.35 price), LUXURY (prime-select timber, hand-polished with matched grain across all pieces, 6-8 weeks, ×1.85 price), and ARCHITECT SERIES (bespoke to specification, 8-16 weeks, price on application). The component's canonical ID stays the same across tiers — quality is a MODIFIER, not a separate SKU. Geometry Engine references HR-001; Rendering Engine subtly adjusts material properties per quality; pricing applies the multiplier; manufacturing pack reflects the tier.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I see real photos of other people's staircases built with the design I've configured?",
    a: "Yes — the 'See Similar Projects' feature. Once you've configured your staircase, one button searches the Stairplan customer project database for real completed builds using the same component combination + timber + layout + quality tier. Returns matches with location (city/region — GDPR-clean, no addresses), completion date, real photographs, and a link to view that design. Powers confidence: 'I'm not the first to build this — 38 other people did too, and here's what it looks like in their homes'. Populated over time as customers submit their built staircases (permission-gated); empty at launch is fine because the algorithm and gallery frame is designed to grow with the catalogue of real builds.",
    audience: 2, classification: "expert_observation" },

  { q: "How does the Nex Component Compatibility Engine work?",
    a: "It reads your WHOLE current configuration (not just isolated pairs) and reports every problematic combination in plain English + suggests specific alternatives ranked by closest style match. Three severity levels: BLOCK (not compatible — prevents selection, e.g. closed string + open-riser floating tread is a structural contradiction), WARN (unusual but not wrong — e.g. Traditional Mopstick handrail + frameless glass balustrade, the round profile doesn't sit cleanly on the glass edge — try HR-001, HR-003 or HR-004 instead), and ADVISE (would look better if — e.g. turned balusters + modern box newels is a design-language mismatch). More than validation. Design guidance driven by real catalogue relationships.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What does the Inspire Me button do in Stairplan?",
    a: "Reads your inputs so far (property type, style hints, any partial choices) → filters the Digital Staircase Catalogue by matching style tags → generates 3 modern options + 3 traditional options + 3 luxury options, all from REAL catalogue components. Every suggestion is instantly buildable, priced against the real pricing DB, geometry-correct, and Doc K compliant. Zero AI hallucination — no invented handrails, no fabricated prices, no non-existent components. Each result comes with hero render, cost estimate, and 'try this design' button that loads it into the configurator so you can tweak from there. Algorithm, not chatbot.",
    audience: 2, classification: "expert_observation" },

  { q: "Why does the Stairplan catalogue matter more than the software architecture around it?",
    a: "Because the architecture is now solved — the Geometry Engine, Compliance Engine, Health Check, Rendering Engine spec, canonical ID rule, Digital Staircase Catalogue schema are all built or fully specified. Every new capability the platform gains — better 3D quality, better drawings, better quotations, better Nex recommendations, better manufacturing output — improves automatically as the catalogue improves. The catalogue itself is the moat. Competitors would need to build a comparable library of professionally-modelled components + real timber scans + install photos + customer project database to reach the same quality — that's a genuine multi-year investment they can't shortcut with clever code. Future work should focus on catalogue quality, not more engines around it.",
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
console.log(`✅ Batch 33 (product pages + quality levels + similar projects + compatibility + Inspire Me): Added ${added} new entries. Total: ${doc.entries.length}`);
