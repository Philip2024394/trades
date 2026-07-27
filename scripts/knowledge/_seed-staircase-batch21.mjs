#!/usr/bin/env node
// Batch 21 staircase seed — UK PROPERTY-TYPE AWARENESS + paired-
// neighbour mirror rule + image flip capability disclosure.
//
// Gives Nex the vocabulary to:
//   - Recognise common UK house types and their typical staircase
//     dimensions / layouts
//   - Apply the paired-neighbour mirror rule (adjacent terraces/semis
//     flip layouts to avoid shared bedroom/staircase walls) as a
//     PROBABILISTIC guess, never a certainty
//   - Explain to users when she needs to ASK the property type before
//     answering, and how to identify their house type
//   - Offer to serve horizontally-mirrored reference images when the
//     user's actual staircase goes the opposite direction from the
//     one in the image

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  // ─── UK property-type descriptors ────────────────────────
  { q: "What does a typical UK Victorian terrace staircase look like?",
    a: "Narrow — Victorian terrace hallways are usually 900-1100 mm wide, which limits the staircase width to about 800-900 mm. Almost always a STRAIGHT flight along the party wall or a HALF-TURN with a small quarter-landing at the top. Softwood carcass, softwood spindles (originally turned, often replaced with square), oak or painted handrail, painted newel posts. Floor-to-floor typically 2600-2800 mm — taller than modern homes — so around 14-15 rises rather than the modern 13. Underneath the staircase is almost always a cupboard or the door to a cellar.",
    audience: 2, classification: "expert_observation" },

  { q: "What does a typical UK 1930s semi-detached staircase look like?",
    a: "Wider than a Victorian terrace — hallways typically 1100-1400 mm, so staircases 850-950 mm wide. Common design is a straight flight or a QUARTER-TURN with a small landing, often with the bay window at the front and the staircase against the party wall side. Painted-softwood construction with turned spindles, oak-topped painted handrail. Floor-to-floor around 2500-2600 mm, usually 13-14 rises. Understair storage often opened up as part of modern kitchen renovations.",
    audience: 2, classification: "expert_observation" },

  { q: "What does a modern UK new-build (2000s+) staircase typically look like?",
    a: "Standardised — most volume house-builders spec a straight flight or simple half-turn with painted softwood strings and risers, oak or oak-veneer treads (or full carpet), plain-square or lightly-turned painted spindles at 100 mm centres, painted newels, oak-topped painted handrail. Hallways more open than Victorian, floor-to-floor around 2400-2500 mm, typically 13 rises. Premium spec on higher-end new-builds sometimes adds LED under-tread lighting and glass balustrade — but the standard spec is deliberately understated so the developer's cost stays predictable.",
    audience: 2, classification: "expert_observation" },

  { q: "What does a Georgian townhouse staircase typically look like?",
    a: "Grand — Georgian floor-to-floor heights are 2900-3300 mm (much taller than modern homes), so a Georgian staircase has 16-20 rises per flight and reads as significantly more substantial than a modern one. Common designs: sweeping HALF-TURN with generous half-landing, or SPLIT (double-return) staircase in the largest houses. Turned mahogany or oak spindles, moulded handrail, turned newels with proper caps or finials, panelled soffit fully enclosing the underside, sometimes a curtail bottom step with a scrolled volute handrail. The staircase is almost always the design centrepiece of the entrance hall.",
    audience: 2, classification: "expert_observation" },

  { q: "What does a typical UK cottage or farmhouse staircase look like?",
    a: "Compact and characterful — original cottage staircases are often TIGHT WINDER designs squeezed into a small footprint, sometimes with LOW HEADROOM (a cottage staircase from 1750 doesn't meet modern Approved Doc K, and Building Control usually accepts the historic original for like-for-like repair). Timber is often oak or elm, chunky treads, sometimes with the walking edge worn smooth over 200+ years of use. Modern-farmhouse conversions frequently keep the layout but rebuild in oak with character grain, chunky newels and either turned oak or black wrought-iron spindles.",
    audience: 3, classification: "expert_observation" },

  { q: "What does a UK apartment or flat staircase typically look like?",
    a: "Depends on whether it's a communal staircase serving multiple flats (Building Regs different — Approved Doc K Part 3 for common stairs, wider tread, taller handrail) or an internal staircase within a duplex/maisonette flat (private Doc K rules). Internal-to-flat staircases are usually straight or simple half-turn, floor-to-floor 2400-2500 mm, 13 rises, painted or oak spec similar to a modern new-build house. Space is usually the constraint, so open-riser or glass balustrade designs are popular to keep the space visually open.",
    audience: 3, classification: "expert_observation" },

  // ─── Paired-neighbour mirror rule ────────────────────────
  { q: "Why do adjacent UK terraces or semi-detached houses often mirror their internal layouts?",
    a: "It's a design convention that meaningfully reduces sound transfer between homes. If two houses in a pair both had their staircases against the shared party wall, every footstep on one side would be audible on the other. So UK terraces and semis are typically built with MIRRORED layouts — bedrooms, staircases and hallways face AWAY from the party wall, with the party wall shared between quieter rooms (living rooms usually). Especially true of Victorian and Edwardian terraces; less consistently applied on 20th-century estate builds.",
    audience: 2, classification: "expert_observation" },

  { q: "Can I tell which side of the pair my terraced house is on, and what that tells me about my staircase?",
    a: "Usually yes. If your house is on the RIGHT of the pair (party wall on your left as you look at the front from the street), your hallway is typically on the LEFT side of your ground floor and your staircase runs UP on that left side — the party wall separates you from your neighbour on that side. Right-hand side of pair = staircase on left. Left-hand side of pair = staircase on right. It's not universal (20th-century estates increasingly ignore it) but Victorian and Edwardian terraces almost always follow it. Check yours to be certain.",
    audience: 2, classification: "expert_observation" },

  // ─── Property-detection guidance ─────────────────────────
  { q: "What does Nex need to know about my house to give me really useful staircase advice?",
    a: "The most useful things to tell me: PROPERTY TYPE (Victorian terrace / Edwardian semi / 1930s bay / modern new-build / cottage / Georgian townhouse / modern flat), rough AGE of the house, HALLWAY WIDTH (rough — narrow / average / wide), FLOOR-TO-FLOOR height if you know it, current STAIRCASE type (straight / half-turn / winder), and whether we're talking about REPLACING existing or building new. Even rough answers to those questions let me shift from generic advice to answers that fit YOUR property specifically.",
    audience: 1, classification: "professional_recommendation" },

  { q: "How do I identify what type of UK house I have?",
    a: "Quick guide: AGE first — Victorian (1837-1901) usually terraced or semi with sash windows and high ceilings; Edwardian (1901-1910) similar but slightly wider and lighter; 1920s-30s bay-fronted semi is instantly recognisable from the front-room bay; 1950s-60s estate house is boxy with lower ceilings; 1980s-2000s new-build has standardised proportions; 2010s+ new-build often has more open-plan hallway. Georgian townhouses (pre-1830) have very tall ceilings and sash windows in strict grids. If you're unsure, Google Maps street view + the house's year of build (find via Land Registry or estate agent particulars) will tell you within a decade.",
    audience: 1, classification: "professional_recommendation" },

  { q: "What are typical UK floor-to-floor heights by property type?",
    a: "Rough guide, ground to first floor: modern volume new-build 2400-2500 mm; 1930s semi 2500-2600 mm; Victorian/Edwardian terrace 2600-2800 mm; Georgian townhouse 2900-3300 mm; converted flat / modern apartment 2400-2500 mm. These directly determine the number of rises in your staircase (floor-to-floor ÷ rise = number of rises, capped at 220 mm max rise under Doc K). A Georgian at 3200 mm floor-to-floor needs 15 rises at 213 mm each; a modern 2500 mm floor-to-floor typically works out at 13 rises around 192 mm.",
    audience: 3, classification: "expert_observation" },

  { q: "How much floor area does a typical UK staircase take up?",
    a: "A straight-flight domestic staircase typically needs 900 mm wide × 3.2-3.6 m long (13-14 treads at ~220-250 mm going each, plus a small landing at top) — so roughly 3 sq m of ground-floor footprint plus the stairwell opening above. Half-turn or L-shape trades the length for a bit of width: 1.7-2 m long × 1.8-2 m wide including landing, so around 3.5 sq m. Winder half-turns can compress to 1.7 m × 1.7 m. Compact space-saver stairs down to 1.4 × 1.4 m but usually only compliant as loft access. Small-hallway design starts here — know the space before choosing the layout.",
    audience: 3, classification: "expert_observation" },

  // ─── Image flip capability ───────────────────────────────
  { q: "Can Nex flip a reference image if my staircase goes the opposite direction from the one in the picture?",
    a: "Yes — most staircase reference images are horizontally symmetrical enough that a mirror flip works fine (the flight going up-left instead of up-right, same design otherwise). If you tell me your staircase goes in a specific direction, I can offer the flipped version so the image matches your actual layout. A few images have orientation-dependent context (a visible kitchen on one side, a door in a specific position) where flipping would look wrong — I'll flag those and describe instead. Otherwise, flip is the default so the reference matches what you see when you walk into your own hallway.",
    audience: 1, classification: "expert_observation" }
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

// ── Add `flippable` metadata to all existing diagrams. Default true.
// Mark the small number where surrounding context would look wrong
// flipped (visible kitchen, door on a specific side, framed art
// arrangements that read as directional) as flippable=false.
const FLIPPABLE_FALSE_IDS = [
  // Diagram A (warm modern family home) — kitchen visible on right,
  // framed art with directional composition, oak flooring lays specific way
  "staircase-faq-437"
];

let diagramFlipUpdates = 0;
for (const e of doc.entries) {
  if (!e.diagram) continue;
  if (e.diagram.flippable === undefined) {
    e.diagram.flippable = !FLIPPABLE_FALSE_IDS.includes(e.id);
    diagramFlipUpdates += 1;
  }
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 21:`);
console.log(`   ${added} new entries added (${skipped} skipped)`);
console.log(`   ${diagramFlipUpdates} existing diagrams updated with flippable metadata`);
console.log(`   Total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
