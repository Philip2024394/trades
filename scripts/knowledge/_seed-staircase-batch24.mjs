#!/usr/bin/env node
// Batch 24 staircase seed — DOC K CLAUSE-SPECIFIC citation authority.
// Every entry now cites the specific Approved Doc K clause number so
// Nex can defend her answer if a homeowner, maker or Building Control
// officer asks "where does that come from?"
//
// Source: Philip's canonical clause list (2026-07-25) + confirmation
// of numbers from tradecalculator.co.uk. Doc K PDF at:
// https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf
//
// Also adds NEW coverage of utility stairs and common stairs (flats)
// which the previous batches only mentioned in passing.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "Which edition of Approved Document K should I be looking at?",
    a: "The current England version is Approved Document K (2013 edition incorporating 2015 amendments). Free to download from gov.uk — the canonical PDF sits at assets.publishing.service.gov.uk (search 'Approved Document K' on gov.uk to find the current link). Wales has its own Approved Doc K, Scotland uses the Technical Handbook Section 4, Northern Ireland uses Technical Booklet H. Always check that you're looking at the version that applies to your project's country before designing to it.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What does Approved Doc K Clause 1.1 say about staircase step uniformity?",
    a: "Clause 1.1 requires that in a flight of stairs, all steps must have the same RISE and the same GOING. It's the uniformity rule that stops any single step being taller or deeper than its neighbours — the biggest single cause of stair trips is inconsistent rises across a flight. Building Control will measure this at inspection, and a variance of more than a few millimetres between rises can fail the sign-off. Every staircase maker builds to this rule from day one; the risk is renovation work where a floor level changes after the flight was made.",
    audience: 3, classification: "safety_advice" },

  { q: "How does Approved Doc K Clause 1.2 define a 'private' staircase?",
    a: "Clause 1.2 defines a PRIVATE stair as one 'intended to be used for only one dwelling'. This matters because Doc K applies different (more generous) limits to private stairs than to common stairs (serving multiple flats) or utility/institutional stairs (commercial and public buildings). A staircase inside your own house is a private stair; the staircase in the common hallway of a converted flat block is a common stair. Different rise/going/pitch limits, different guarding requirements.",
    audience: 3, classification: "expert_observation" },

  { q: "What does Approved Doc K Clause 1.3 and Table 1.1 say about private staircase dimensions?",
    a: "Clause 1.3 + Table 1.1 set the strict dimensions for a private stair: MAXIMUM RISE 220 mm, MINIMUM GOING 220 mm, MAXIMUM PITCH 42°. Those are the hard limits — going tighter than 220 mm on either dimension fails Doc K, and steeper than 42° fails too. Practical spec sits comfortably inside those limits: modern UK new-builds typically use rise 190-200 mm, going 240-260 mm, pitch around 38-40°. The Table 1.1 limits are the boundary you can't cross, not the target.",
    audience: 3, classification: "safety_advice" },

  { q: "What is the 2R+G formula rule in Approved Doc K Clause 1.4?",
    a: "Clause 1.4 requires that 2 × rise + going must fall between 550 mm and 700 mm — the mathematical comfort rule that stops step geometry becoming awkward to walk on. Example: rise 190 mm + going 240 mm gives 2(190) + 240 = 620 mm, well inside the band. Rise 220 mm + going 220 mm gives 660 mm, still inside. But rise 220 mm + going 300 mm = 740 mm (fails, top of band); rise 150 mm + going 220 mm = 520 mm (fails, bottom of band). The formula catches step proportions that would technically pass individual limits but feel uncomfortable to use.",
    audience: 3, classification: "expert_observation" },

  { q: "What headroom does Approved Doc K Clause 1.6 require above a domestic staircase?",
    a: "Clause 1.6 requires a continuous, unobstructed headroom of at least 2000 mm measured vertically above the pitch line (the imaginary line running along the nosings of every tread). Applies over the full length of the flight, not just at a single point. This is one of the most common ways loft conversions fall foul of Doc K — the sloping roof cuts into the headroom above the top of the flight, and the staircase needs relocating or redesigning to compensate.",
    audience: 3, classification: "safety_advice" },

  { q: "Is there any headroom exception in Approved Doc K for loft conversions where space is tight?",
    a: "Yes — Clause 1.7 provides a specific allowance for loft conversions where the 2000 mm continuous headroom can't be achieved. In that specific case, minimum headroom drops to 1900 mm at the CENTRAL AXIS of the stair, provided it scales back up to 2000 mm at ONE SIDE of the flight. This exception applies only to loft conversions — you can't use it on a main staircase. It's designed to allow safe access to a converted loft where the sloping roof would otherwise rule out the conversion entirely.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Where in Approved Doc K are the rules for tapered treads and winders?",
    a: "Clauses 1.9-1.12 cover tapered treads (winder steps). The key rules: the going must be measured along the WALKING LINE (about 270 mm out from the inside handrail on domestic stairs), and that walking-line going must still meet the 220 mm private-stair minimum. The narrow inner ends of the winder can go below 220 mm, but the walking-line dimension is what compliance is checked against. Winders that were drawn to fit an awkward opening rather than to proper walking-line geometry are the usual reason they feel uncomfortable to use — Doc K's walking-line rule is exactly what stops that.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Where in Approved Doc K are the rules for alternating-tread (space-saver) staircases?",
    a: "Clauses 1.27-1.28 cover alternating-tread stairs (sometimes called paddle stairs or space-saver stairs). Key point: they're permitted only in very restricted situations — typically loft-conversion access to a single habitable room, and NOT as the main staircase to a habitable floor. If a maker is proposing an alternating-tread stair as your only route to a floor, that likely fails Doc K. The exact restrictions and geometry rules are in those clauses — check with Building Control before ordering.",
    audience: 3, classification: "safety_advice" },

  { q: "What does Approved Doc K Clause 1.36 say about staircase handrails?",
    a: "Clause 1.36 requires a handrail on at least ONE side of the flight if the stair is less than 1 metre wide, and on BOTH sides if the stair is 1 metre wide or wider. The handrail must be continuous along the length of the flight. Height (not specified in this clause, in the section on handrail specification) is 900-1000 mm above the pitch line. Which side the single handrail sits on is a design choice — usually against the wall side on narrow stairs, or on the show side for open designs.",
    audience: 3, classification: "safety_advice" },

  { q: "What is the 100mm sphere rule in Approved Doc K Clause 1.39?",
    a: "Clause 1.39 dictates that in a dwelling, no opening in the balustrading or guarding can allow the passage of a 100 mm sphere. It's the child-safety rule that determines maximum baluster spacing (usually 99 mm centres at most, allowing for the baluster's own thickness). Applied by Building Control at inspection with an actual 100 mm sphere or gauge. Also applies to gaps at the base of glass balustrades, gaps around newel posts, and any opening in a landing balustrade over 600 mm drop. Never designed around; always tested against.",
    audience: 3, classification: "safety_advice" },

  // ─── NEW coverage: utility and common stairs ─────────────
  { q: "What are the Doc K limits for a UTILITY staircase (not a home staircase)?",
    a: "Different from private-stair limits. Utility stairs (used in institutional and commercial settings) have TIGHTER limits: MAXIMUM RISE 190 mm, MINIMUM GOING 250 mm, MAXIMUM PITCH 38°. They're designed for higher-traffic and more-varied-user settings than a home staircase. If you're building or renovating a commercial property, workshop or public building, utility-stair limits apply — not the more generous private-stair ones. Get the classification of your building confirmed with Building Control before designing.",
    audience: 4, classification: "safety_advice" },

  { q: "What are the Doc K limits for a COMMON staircase serving multiple flats?",
    a: "Common stairs (serving multiple dwellings, e.g. the communal hallway staircase in a converted flat block or purpose-built flats) sit closer to utility spec than to private: MAXIMUM RISE 190 mm, MINIMUM GOING 250 mm, MAXIMUM PITCH 38°. Also generally require handrails on both sides regardless of width because of the mixed user base. If you're building or renovating a communal staircase in a flat conversion, don't design to the more-generous private-stair limits — Building Control will apply common-stair rules.",
    audience: 4, classification: "safety_advice" }
];

// Add new entries
const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  doc.entries.push({
    id, kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 24 (Doc K clause-specific citations): Added ${added} new entries (${skipped} skipped).`);
console.log(`   Total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
