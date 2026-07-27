#!/usr/bin/env node
// Batch 5 staircase seed — silicone-as-gap-filler vs cover slips.
// Distinct from the existing "silicone as polish" entries (faq-208,
// faq-304, faq-307) which cover surface-finish silicone.
//
// Also does two in-place amendments to existing wall-slip entries
// (faq-167 + faq-168) to cross-reference the silicone gap topic, so a
// homeowner reading either finds the connection.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

const NEW = [
  { q: "Should I use silicone to fill the gap between my staircase and the wall?",
    a: "No — silicone is the wrong material for this joint even though it's the reflex DIY solution. The wall doesn't move but the staircase does (foot traffic, seasonal timber movement, small vibrations every time someone walks the flight), and a rigid caulk bead between two things moving relative to each other fatigues, pulls away and looks worse within a couple of years. The proper joinery fix is a wall slip — a thin matching timber moulding down the wall side of the string that sits flat, hides the gap and moves with the staircase.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why does silicone eventually fail on a staircase-to-wall gap?",
    a: "Because a staircase never stops moving. Every footstep flexes the flight slightly; humidity changes swell and shrink the timber through the year; the newel loads the top of the string sideways every time someone leans on the handrail. Silicone that looked perfect at year one has been fatigued in one direction or the other every day since. Bond to painted plaster is the first thing to let go — you see a hairline gap along the wall side, then the whole bead starts pulling free.",
    audience: 3, classification: "expert_observation" },

  { q: "Why is peeling silicone around a staircase a problem with young children in the house?",
    a: "Because kids pick at anything that's loose. A silicone bead that's started to lift becomes a nine-year-old's project and within a week you've got a metre of it hanging off the string. Worse, silicone strips can be a swallowing hazard for very small children. Cover slips don't have this problem — they're pinned or glued into place and there's nothing to pick at.",
    audience: 1, classification: "safety_advice" },

  { q: "I've already got failing silicone around my staircase — what should I do?",
    a: "Don't just add more on top — you'll trap the failure and make the eventual proper fix harder. Carefully pull or cut out the loose material, clean any residue off the string and wall (a plastic scraper and mineral spirits usually does it), let it dry, and fit a proper cover slip along the joint. Any joiner can do it in half a day. If the wall has a lot of silicone residue left behind, warn your future decorator — some paints won't take over silicone contamination.",
    audience: 2, classification: "repair_procedure" },

  { q: "Where do I buy a wall slip or cover slip for a staircase?",
    a: "Best route: back to the original staircase maker if they still exist — they'll machine one from the same species and grade as your staircase so it matches properly. Failing that: a good timber merchant with a machining shop, or a specialist joinery supplier. Building merchants stock generic pine, oak and MDF finishing profiles (scotia, quadrant, ogee) that work for common installations. Take an offcut of the existing string with you for species and colour matching.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should my cover slip match my staircase timber?",
    a: "Ideally yes — a matching timber and grain makes the cover slip read as part of the staircase rather than as a repair strip. For a natural-finished oak staircase, an oak cover slip in the same grade and finish disappears; a random pine or MDF slip painted white sticks out. If a matching species isn't practical, the alternative that works is a PAINTED slip finished in the same colour as the surrounding wall, so it visually merges into the wall rather than trying to blend into the staircase.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Can a cover slip be painted instead of left as natural timber?",
    a: "Yes — painting is a completely valid finish for a cover slip and often the neater choice. A cover slip painted the same colour as the adjoining wall visually merges into the wall and the eye reads a clean staircase-to-plaster line. Prime the timber first (any bare pine or MDF needs it), then two coats of a good eggshell or satin in the wall colour. This is the usual approach where the staircase timber species can't be matched.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Can decorators just fill the gap between my staircase and wall with decorators' caulk?",
    a: "For a hairline finishing gap on a static joint, caulk's fine — it's what it's designed for. But a staircase-to-wall joint isn't static: it moves with foot traffic and timber movement, and even flexible decorators' caulk cracks along movement joints within a year or two. Small gaps under 2 mm can survive with caulk; anything visible calls for a proper cover slip. Ask your decorator to leave the joint alone and have the joiner fit a cover slip before the final paint coat.",
    audience: 2, classification: "professional_recommendation" }
];

// ── In-place amendments — extend two existing wall-slip entries
// with a brief cross-reference to silicone so a homeowner searching
// either finds the connection.
const MERGES = [
  {
    id: "staircase-faq-168",
    replace_answer: "A thin timber moulding — usually machined from the same species as your staircase — that sits down the wall side of the string, overlapping the plaster slightly. Its job is to hide small gaps and wall irregularities and give a clean, professional line where the staircase meets the wall. On almost every install with a plastered wall, a wall slip does more for the finished look than any amount of scribing. Much better long-term than silicone caulk in the same gap — silicone can't cope with the small movement between a moving staircase and a static wall and eventually pulls away.",
    reason: "Extend with cross-reference to silicone (from batch 5 paste)."
  },
  {
    id: "staircase-faq-167",
    replace_answer: "Because plastered walls are never perfectly straight over their whole length, and no experienced fitter will force a staircase to follow a bowed wall — that's how you crack a string. Small gaps at the plaster line are normal. They're covered with a wall slip (a matching moulding along the wall edge of the string) which sits flat, hides any variation, and looks like part of the staircase. Don't be tempted to fill the gap with silicone — it looks OK for a year and fails within two or three as the staircase moves and the silicone doesn't.",
    reason: "Extend with silicone warning (from batch 5 paste)."
  }
];

// ─── Load + apply ─────────────────────────────────────────────
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];

// Apply merges first
let merged = 0;
for (const m of MERGES) {
  const e = doc.entries.find((x) => x.id === m.id);
  if (!e) { console.warn(`⚠ merge target ${m.id} not found — skipped`); continue; }
  e.answer = m.replace_answer;
  merged += 1;
}

// Add new entries
const nextN = doc.entries.reduce((a, e) => {
  const mm = String(e.id ?? "").match(/-(\d+)$/);
  return mm ? Math.max(a, parseInt(mm[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const entry = {
    id: `staircase-faq-${String(nextN + added).padStart(3, "0")}`,
    kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  };
  doc.entries.push(entry);
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 5: Merged ${merged} entries with silicone cross-refs.`);
console.log(`✅ Added ${added} new silicone/cover-slip entries (${skipped} skipped). Total: ${doc.entries.length}`);
