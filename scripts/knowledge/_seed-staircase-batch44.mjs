#!/usr/bin/env node
// Batch 44 — T&G sheeting thickness options + grain-along-length rule (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What thickness should T&G sheeting be for the back of a staircase?",
    a: "For staircase backing, 12mm is the standard default — light, quick to install, plenty rigid for the span. 9mm works if the area is kept dry and there's no risk of impact. 15mm and 18mm are used for larger area applications where extra stiffness or sound-deadening is worth the extra cost. All 9-18mm are practical — heavier isn't always better, just heavier.",
    audience: 2, classification: "manufacturer_guidance" },

  { q: "Which way should the grain run on T&G sheeting?",
    a: "Grain always runs along the FULL LENGTH of the plank. That's why T&G is sold as long planks — they're cut from the log with grain along the length, which gives the plank its strength and rigidity. If you see a plank with grain running ACROSS (perpendicular to length), that's a manufacturing defect — the plank will be weak and prone to cupping or splitting. Reject and replace.",
    audience: 3, classification: "safety_advice", safety: "Cross-grain T&G planks are structurally defective — a qualified installer should reject them at delivery." },

  { q: "Can I use 9mm T&G on a staircase back or is it too thin?",
    a: "9mm is fine for staircase backing IF the area stays dry (no unheated garage, no adjacency to bathroom without vapour barrier). The span between battens is short enough for 9mm to feel solid. If any moisture risk, or if the sheeted area is a larger wall, step up to 12mm minimum. For serious sound-deadening or heavy-traffic sight areas, 15mm or 18mm.",
    audience: 2, classification: "professional_recommendation" }
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
console.log(`✅ Batch 44 (T&G sheeting thickness + grain rule): Added ${added} new entries. Total: ${doc.entries.length}`);
