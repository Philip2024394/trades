#!/usr/bin/env node
// Batch 23 staircase seed — HOW A REAL STAIRCASE MAKER MEASURES.
// The professional workflow that most Building Regs guides skip —
// finished-floor accounting, flooring-thickness impact on rise,
// nosing overhang not counting toward going, extra-riser rule,
// architrave and skirting allowances, fitting tolerance for
// uneven trimmers.
//
// Source: Philip's own trade knowledge (2026-07-25). This is the
// canonical workflow, not textbook theory — makes Nex sound like
// she's been on a hundred UK staircase installs.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "How does a professional staircase maker actually measure up for a bespoke staircase?",
    a: "Six steps in order. FIRST, floor-to-floor RISE — finished floor to finished floor. If floors aren't laid yet, ASK the homeowner exactly what will be laid (see next question). SECOND, the RUN measured on the tape straight across from where the flight will start to where it must arrive. THIRD, reduce for any ARCHITRAVE where a doorway sits at the top or bottom of the flight — the flight can't overlap the architrave. FOURTH, note where the SKIRTING will need to continue past the string so the stringer can be cut to leave skirting-height room. FIFTH, work out step size that fits above Doc K minimums (rise 150-220 mm, going ≥220 mm). SIXTH, add ONE MORE RISER than the number of goings (see the extra-riser question). None of this is optional — miss any step and the staircase either won't fit or won't feel right.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Why does the staircase maker ask about my upstairs AND downstairs flooring choices before quoting?",
    a: "Because the staircase's actual rise is finished-floor to finished-floor, and if floors aren't laid yet the makers has to know what will be. Different flooring adds different thickness: solid timber 18-22 mm, engineered floating 14-18 mm, engineered on battens 30-50 mm+, laminate 8-12 mm, LVT 5-8 mm, ceramic tile 10-15 mm with adhesive, porcelain tile similar, carpet + underlay 15-25 mm, self-levelling concrete 3-10 mm. A downstairs 20 mm timber floor with a 15 mm upstairs carpet takes 35 mm off the effective staircase rise — which changes every riser height by 35 mm ÷ number-of-rises. Missing that detail is one of the most common ways a staircase ends up with the top or bottom step at the wrong height.",
    audience: 3, classification: "professional_recommendation" },

  { q: "My builder hasn't laid the floors yet — can I still order the staircase now?",
    a: "Yes, but you have to tell the staircase maker EXACTLY what will be laid — species, thickness, whether it's floating on underlay, whether it's on battens, whether it's tiled with adhesive. Don't guess. Get the actual product spec from your flooring supplier and pass the exact thickness numbers to the staircase maker in writing. If floor spec changes AFTER the staircase is measured up, tell the maker immediately — every millimetre of floor thickness change adjusts the rise. This is the number-one reason bespoke staircases end up with a top or bottom step that's wrong.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What are the typical flooring thicknesses my staircase maker needs to know?",
    a: "Rough guide for the common UK choices: SOLID TIMBER 18-22 mm, ENGINEERED TIMBER FLOATING (on underlay) 14-18 mm total, ENGINEERED TIMBER ON BATTENS 30-50 mm+ (battens vary), LAMINATE with underlay 8-12 mm, LUXURY VINYL TILE (LVT) 5-8 mm, CERAMIC or PORCELAIN TILE 10-15 mm including adhesive bed, CARPET WITH UNDERLAY 15-25 mm depending on grade, SELF-LEVELLING CONCRETE 3-10 mm. Different downstairs vs upstairs finishes are the norm — carpet upstairs on timber joists, tile downstairs on concrete slab is a very common combination that adds meaningfully different amounts to each finished floor level.",
    audience: 3, classification: "expert_observation" },

  { q: "What is the tread nosing overhang, and why isn't it part of the going measurement?",
    a: "The NOSING is the front edge of the tread that projects out past the riser below — usually 22-25 mm on a typical bullnose profile. The GOING (the Doc K measurement) is the horizontal distance from the front of one riser to the front of the next riser — the nosing overhang doesn't count. So a Doc K minimum 220 mm going with a 25 mm nosing gives you a 245 mm total tread depth. This trips people up when they measure tread depth themselves and think the going's larger than it really is. When a staircase maker quotes 'going 220 mm' they mean the riser-to-riser distance, not the visible tread depth.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Why does a staircase always have ONE MORE RISER than the number of steps you walk on?",
    a: "Because you walk UP each going and then that last rise takes you from the top tread onto the landing itself — the landing IS the last tread, effectively. So a flight with 12 GOINGS (12 steps you land your foot on going up) has 13 RISERS (12 rises between the steps plus the final rise from the top step onto the landing). Standard rule: rises = goings + 1. The exception: if the top step is designed to sit at the SAME level as the landing (so you step OVER the top rather than UP the last rise), rises = goings — but this is rare and needs specifying at design stage. Get this wrong and the top step lands 200 mm below the landing floor, which is dangerous and non-compliant.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Is there ever a staircase design where the top step IS level with the landing?",
    a: "Yes — some designs (especially minimal modern floating staircases and some space-saver layouts) intentionally have the top tread at the same level as the finished floor of the upper landing, so you step OVER the top tread onto the landing rather than UP a final rise. In this case the flight has rises = goings (not +1). It's a specific design choice, not a default. Tell your staircase maker EXPLICITLY at drawing stage if you want this — otherwise they'll build to the standard +1 riser rule and the top step won't work the way you expected.",
    audience: 3, classification: "professional_recommendation" },

  { q: "How does the staircase maker allow for architrave when measuring the length of the flight?",
    a: "By reducing the available run by the architrave depth (typically 20-25 mm) wherever a doorway sits at the top or bottom of the flight. The staircase physically can't overlap the architrave without a nasty-looking cut or a bodge, so the working length is 'tape measurement minus architrave allowance'. On a tight staircase this can shorten the useful run by 40-50 mm total (architrave both ends) — enough to change the choice of going or shift a landing. Any experienced fitter notes architrave positions at first survey.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "How is the staircase string cut to let the skirting board continue past?",
    a: "The bottom edge of the string is cut in a stepped or rebated notch to give clearance for the skirting board to run through underneath — usually matching the skirting height + a small margin. On a decent install the skirting continues cleanly past the staircase without a butt joint at the string, which looks much neater than the alternatives. The staircase maker needs to know the skirting height at measure-up so the string can be machined correctly at the workshop rather than being hacked on site.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "How much fitting tolerance does an experienced maker allow for uneven trimmers on an L-shape staircase?",
    a: "I usually allow about 25 mm of fitting tolerance on L-shape staircases — enough to absorb the small out-of-square that most stair openings have without needing to remake components on site. Trimmer beams (the structural framing around the stair opening in the upper floor) are almost never perfectly square with the walls below, especially in renovation work. That 25 mm gets absorbed at install with cover slips, scribing and small adjustments to the landing string. Straight flights are less forgiving — the fitting tolerance is smaller because there's no landing turn to swallow the error.",
    audience: 4, classification: "expert_observation" },

  { q: "A staircase company said they need to see MY specific flooring choices before finalising the design — why?",
    a: "Because every finished-floor-level decision ripples through the staircase. If you specify solid oak floor downstairs (say 22 mm) and pull it out for tile (12 mm) after the maker's cut, the downstairs floor is 10 mm lower than the original design assumed — so every riser is now 10 mm ÷ number-of-rises taller, the top step lands 10 mm below the upper landing, and the overall pitch shifts fractionally. Sounds trivial; it's the kind of change that gets caught by Building Control on inspection and can require remake of components. Give the maker the actual product spec once, in writing, and don't change it after they've cut timber without telling them.",
    audience: 2, classification: "professional_recommendation" }
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

console.log(`✅ Batch 23 (real staircase-maker measurement workflow): Added ${added} new entries (${skipped} skipped).`);
console.log(`   Total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
