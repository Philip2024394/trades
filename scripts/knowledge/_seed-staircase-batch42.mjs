#!/usr/bin/env node
// Batch 42 — baluster grain direction always up/down never across (Philip 2026-07-25 HARD RULE).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "Which way should the grain run on a staircase baluster?",
    a: "Grain ALWAYS runs UP-DOWN along the length of the baluster — never across it. Two reasons: structural (wood is much stronger ALONG the grain than across, so a baluster with grain running up-down carries load safely; grain across creates a weak point that could snap under a knock), and visual (grain running up-down looks correct at a glance; grain across a baluster reads as amateur work). Every properly-made UK baluster has grain along the length — check when you receive a batch and reject any with cross-grain.",
    audience: 2, classification: "safety_advice", safety: "Balusters with cross-grain are structurally weaker and can snap under lateral impact — always reject and replace." },

  { q: "How can I tell if a baluster is cut correctly?",
    a: "Look at any of the 4 (or 8 if chamfered) long faces of the baluster. The grain lines should run parallel to the baluster length — top to bottom. If you see grain lines running horizontally (perpendicular to the baluster length), the baluster has been cut incorrectly from the parent board. Reject it. Also check the end grain (the top or bottom face): you should see the classic tree-ring rosette pattern, confirming the baluster was cut along the length of the log.",
    audience: 2, classification: "expert_observation" }
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
console.log(`✅ Batch 42 (baluster grain direction): Added ${added} new entries. Total: ${doc.entries.length}`);
