#!/usr/bin/env node
// Batch 35 — handrail + baserail + baluster sizing construction knowledge (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What is the traditional UK handrail profile?",
    a: "A rounded/domed graspable top surface with straight sides and a GROOVE cut into the underside. The bottom groove accepts the tops of the balusters — they slot straight in. Same profile has been made in the UK for generations because it grasps well, cleans easily, and joins cleanly to newel posts.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a baserail on a staircase and why is it a newer design?",
    a: "The baserail sits ON TOP of the string and runs the full length of the flight, with a GROOVE cut into its top face — the bottoms of the balusters slot into it. It's a newer design than housed strings (where balusters slot directly into holes in the string). The baserail gives a cleaner finish, easier baluster fitting, and lets you swap balusters later without touching the string. Not present on every UK staircase — older builds go straight into the string housing.",
    audience: 2, classification: "expert_observation" },

  { q: "How are balusters held in place on a handrail with baserail?",
    a: "Two ways at once. First, the balusters SLOT into the groove on top of the baserail and the matching groove on the underside of the handrail — this stops them moving left-right. Second, small wooden strips called SLIPS are cut to the exact baluster spacing and fitted into the grooves ABOVE and BELOW between each baluster — this stops the balusters sliding along the length of the rails. Result: every baluster locked in both directions.",
    audience: 3, classification: "expert_observation" },

  { q: "What is the standard UK baluster and handrail thickness?",
    a: "41mm is the current UK and Ireland standard for both balusters and handrails/baserails. Before mass-produced spindles, 44mm was the traditional size. Slimmer modern balustrades use 32mm. Larger heavy balusters range 50-60mm. The handrail and baserail grooves are cut to match — so a 41mm baluster needs 41mm-groove rails, a 50mm baluster needs 50mm-groove rails.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "If I choose heavy balusters, what else needs to change?",
    a: "Everything on the balustrade side scales up together. Heavy balusters (50mm+) mean bigger handrail (deeper groove), bigger baserail (deeper groove), AND bigger newel post (to take the increased tenon and load). The rule: baluster + handrail + baserail + newel post ALL increase at the same level. Mismatched sizing looks visually off (a slim newel next to chunky balusters reads wrong) AND creates a structural weak point at the newel joint. Nex should refuse to configure a chunky 60mm baluster on a slim 90mm newel — or at least warn strongly.",
    audience: 3, classification: "safety_advice" },

  { q: "What handrail size do I use for 32mm slim balusters?",
    a: "Match the groove — 32mm handrail with a 32mm groove on the underside, 32mm baserail with a 32mm groove on the top. Standard 90mm newel post is fine. This gives a slim, modern balustrade look — often paired with glass or minimalist Scandinavian designs. Note: skinny balusters can look under-scale on a wide staircase, so the design still needs to read balanced against the tread width.",
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
console.log(`✅ Batch 35 (handrail + baserail + baluster sizing): Added ${added} new entries. Total: ${doc.entries.length}`);
