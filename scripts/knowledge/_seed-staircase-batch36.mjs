#!/usr/bin/env node
// Batch 36 — newel cap styles catalogue (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What is a moulded style newel cap?",
    a: "The heavy-profile traditional cap — an ogee cushion body sitting on a wide plinth, topped with a stepped platform. Classic Victorian and Georgian look. Best on chunky 100mm+ newel posts. The extra weight and profile lines make it read as substantial, so it suits period homes and formal staircases. On a thin modern newel it looks over-decorated — pair it with the right newel size for balance.",
    audience: 2, classification: "expert_observation" },

  { q: "What newel cap styles does Nex offer?",
    a: "Five main styles. MOULDED — heavy ogee cushion + wide plinth (traditional/period). SIMPLE PYRAMID — clean tapered top (contemporary). BALL CAP — turned sphere on a plinth (country/farmhouse). FLAT CAP — thin plinth + flat top (modern minimalist). ACORN CAP — turned acorn finial (traditional decorative). Choose based on the overall design language — moulded suits Victorian/Georgian, flat suits modern, ball suits country, pyramid suits contemporary, acorn suits traditional decorative.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Which newel cap should I pick for a modern staircase?",
    a: "Flat cap or simple pyramid. Both have clean lines with no fussy mouldings, matching modern architecture. Flat cap gives the most minimal look — almost invisible, letting the newel post itself be the visual anchor. Pyramid adds a subtle sculptural top without being ornate. Avoid moulded or ball caps on a modern staircase — they'll read as period-mismatched.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Which newel cap suits a Victorian or Georgian property?",
    a: "Moulded style cap. The heavy ogee profile matches the period's architectural details — deep skirtings, moulded architraves, panelled doors. A modern flat cap on a Victorian newel would look wrong. If moulded feels TOO heavy for your specific room, ball cap is the softer traditional alternative — still period-appropriate but slightly less formal.",
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
    safety_note: null, source_verified_at: null, fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 36 (newel cap styles): Added ${added} new entries. Total: ${doc.entries.length}`);
