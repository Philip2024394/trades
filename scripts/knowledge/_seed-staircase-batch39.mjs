#!/usr/bin/env node
// Batch 39 — baluster count rule + full-chamfer 41mm spec + attic-spare rule (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "How many balusters do I need per step on a staircase?",
    a: "Standard rule: 2 balusters per step. Where a newel post sits AT a step (typically the bottom step and the top step of the flight), you only need 1 baluster on that step — the newel replaces the second one. Quick calculation for a 12-step flight with newels at the first and last positions: 12 × 2 − 2 = 22 balusters minimum. Order 24 (2 spare) — see the attic rule below.",
    audience: 2, classification: "expert_observation" },

  { q: "Should I order extra balusters as spares?",
    a: "Yes — always. Baluster designs change with interior design trends. What's stocked today might be discontinued tomorrow. If your calculation leaves you with 1 or 2 extras, buy them and store them in the attic. Years from now if one gets damaged, you'll have an exact-match replacement instead of trying to source a discontinued profile. Same rule applies to handrail sections, base rails, and any decorative moulding on your staircase.",
    audience: 1, classification: "professional_recommendation" },

  { q: "What is a full-chamfer baluster?",
    a: "Square-section timber (typically 41mm × 41mm × 900mm long in the UK) with the four long corners chamfered — a small angled cut running the length of each corner. This softens the edge and gives a classic modern-clean-line look. The top and bottom are cut to the pitch angle of the staircase so they fit flush against the underside of the handrail groove and the top of the baserail groove. Very common current UK spec; works with almost every design language from modern to traditional.",
    audience: 2, classification: "expert_observation" },

  { q: "What is the maximum gap allowed between balusters in the UK?",
    a: "Approved Document K requires that no gap between balusters allows a 100mm sphere to pass through — this stops small children getting their heads stuck. For 41mm balusters spaced at 110mm centres (typical for a 220mm going), the gap is 69mm — well within Doc K. For wider baluster spacing or narrower balusters, verify the maths: gap = spacing minus baluster width, and gap must be under 100mm.",
    audience: 2, classification: "safety_advice", safety: "The 100mm sphere rule is a child-safety regulation under Approved Doc K. A qualified staircase professional should verify baluster spacing on any design where spacing exceeds 100mm minus baluster width." },

  { q: "How are balusters fitted between the handrail and baserail?",
    a: "Each baluster slots into a groove cut into the top of the baserail (bottom end) and a matching groove on the underside of the handrail (top end). The top and bottom of each baluster are cut to the staircase pitch angle so they sit flush in the grooves. Between each baluster, small wooden strips called SLIPS (cut to the exact spacing) fill the groove — this stops the balusters sliding along the length of the rails. Result: every baluster locked in both directions with no visible fixings.",
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
console.log(`✅ Batch 39 (baluster count + full-chamfer + attic-spare): Added ${added} new entries. Total: ${doc.entries.length}`);
