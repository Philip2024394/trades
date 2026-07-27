#!/usr/bin/env node
// Batch 40 — baluster gap measured HORIZONTALLY not along pitch (Philip 2026-07-25 critical clarification).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "How do I measure the gap between balusters for Building Regulations?",
    a: "Measure HORIZONTALLY — at eye level, level with the floor — NOT along the diagonal pitch of the staircase. The 100mm sphere test in Approved Document K is a horizontal measurement (the sphere is pushed through at a horizontal angle at any height of the balustrade). Common mistake: measuring the gap along the pitch line, which gives a bigger number than the actual horizontal gap and can wrongly fail (or wrongly pass) a compliance check. Always horizontal.",
    audience: 2, classification: "safety_advice", safety: "The 100mm sphere test under Approved Document K is a HORIZONTAL measurement. Confirm any balustrade design with a qualified building control officer if uncertain — mis-measuring can result in a non-compliant install." },

  { q: "Why is the baluster gap measured horizontally instead of along the staircase pitch?",
    a: "Because that's how a child's head (or a 100mm sphere in Doc K) approaches the balustrade — horizontally. A child sticking their head through the balustrade does it at eye level, horizontally. If you measured along the diagonal pitch, you'd overstate the effective gap for the safety scenario the regulation is designed to prevent (child head entrapment). The horizontal measurement is what actually predicts whether a child can push through — so that's the measurement the regulation uses.",
    audience: 2, classification: "safety_advice" },

  { q: "For a staircase at 42° pitch with 41mm balusters at 110mm horizontal centres, what is the compliant gap?",
    a: "Horizontal gap = 110 − 41 = 69mm — well within the 100mm Doc K limit. If you accidentally measured ALONG the diagonal pitch instead of horizontally, you'd get: 110/cos(42°) = 148mm centre-to-centre along pitch, minus 41mm baluster = 107mm gap along pitch — which would appear to FAIL Doc K. That's the wrong measurement. The correct horizontal 69mm passes.",
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
    safety_note: item.safety ?? null, source_verified_at: null, fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 40 (baluster gap horizontal measurement): Added ${added} new entries. Total: ${doc.entries.length}`);
