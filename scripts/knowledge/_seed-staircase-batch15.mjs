#!/usr/bin/env node
// Batch 15 staircase seed — STAIRCASE-TO-HOME-STYLE MATCHING.
// The brain has entries defining individual styles (modern,
// traditional, glass, Crittall, etc.) but nothing that answers
// "if my home LOOKS like X, which staircase suits it?"
//
// This batch fills that decision-guidance gap for the eight most
// common UK home aesthetics + a summary "how to match" entry +
// a "what NOT to combine" honest anti-recommendation.
//
// Attaches Philip's three new reference photos to the three
// style entries they represent most directly.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "What staircase style suits a warm modern family home?",
    a: "Oak treads and closed risers with SLIM BLACK METAL BALUSTERS, square oak or black-metal newels, and a black or oak handrail with clean lines. Style: modern, warm, timeless — reads as considered without going cold. Pairs naturally with black door handles, modern painted-Shaker or slab kitchens, neutral walls, and oak flooring. The black metal picks up on other black details around the house and ties the whole hallway together without shouting.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase style suits a luxury open-plan home with a large hallway?",
    a: "Oak treads (open-riser if you want the light-through look, closed if you want more traditional weight) with a frameless GLASS BALUSTRADE and an oak handrail bonded on top. Optional LED strips under each tread nosing wash the flight with warm light. Style: luxury modern, open, bright. Suits large hallways where a solid balustrade would feel like a wall in the middle of the room, and open-plan homes where light needs to travel between spaces. The glass lets the staircase read as a design feature rather than a barrier.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase style suits a full-painted or period-contemporary home?",
    a: "White or off-white painted strings and risers with contrasting oak (or walnut) treads and handrail, and a small amount of dark metal detail (black or bronze balusters, black newel caps, black handrail brackets). Style: classic modern, versatile, ages well. Works especially well in period properties updated with modern interiors, in Shaker-style kitchens, and where the rest of the interior uses a similar painted-plus-natural-wood palette. Timeless enough to survive redecoration.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase style suits a concrete-look or minimalist modern home?",
    a: "The industrial-luxury balance: dark steel structure (black stringer or central spine) + solid oak treads + either frameless glass balustrade or a low painted parapet wall with a slim black handrail. Style: modern, deliberately warm against the concrete's coldness. The timber and warm LED lighting are what stops a concrete-heavy house feeling clinical — never do a full-concrete or full-steel staircase in a concrete-look home unless you actively WANT the cold industrial feel. Warm oak against grey concrete is one of the strongest contemporary combinations.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase style suits a full industrial or exposed-concrete interior?",
    a: "Steel-frame floating or central-spine design with solid timber treads, minimal balustrade (frameless glass, slim cables or slim black metal), and dark bronze or black metal accents. Style: architectural, restrained, structural. Avoid: turned traditional spindles, decorative Victorian details, ornate newel caps — none of them belong in a warehouse-conversion aesthetic. The staircase should read as another piece of engineered structure, not as period joinery.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What staircase style suits a Georgian, Victorian or Edwardian period home?",
    a: "A traditional design with the joinery vocabulary that already exists elsewhere in the house — turned oak or mahogany spindles, turned or panelled newel posts, a proper moulded handrail, closed risers, and either a natural-timber or classic-painted finish depending on the original scheme. Style: authentically period, respects the bones of the building. Modern minimal designs (glass, floating, industrial steel) can look startlingly wrong in a period home — the staircase fights the cornices and skirtings around it. Match to the era.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase style suits a coastal or Scandinavian-inspired home?",
    a: "Pale timber — ash, whitewashed oak, painted white with hardwood treads — with slim vertical spindles (metal or painted timber), simple square newels, and either an open-plan feel or a soft coastal blue-grey painted string. Style: bright, airy, uncluttered. Suits homes with white or off-white walls, natural jute or wool floor coverings, and the general lightness of a Scandi or coastal interior. Dark walnut and heavy oak feel wrong in this palette — you want light, not warmth.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase style suits a rustic farmhouse or country cottage?",
    a: "Character-grade oak with visible knots and grain, exposed cut-string on the show side, turned or square-section spindles, chunky newel posts, and either an oiled natural finish or a soft-painted string (heritage green, grey, off-white) with natural-timber treads. Style: authentic country, honest materials, ages beautifully with wear. Avoid glossy modern lacquers and glass balustrades — both feel forced in a stone-and-beams setting. Character oak on a rustic staircase is one place where the knots and imperfections ARE the design.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How do I match a staircase style to the rest of my house?",
    a: "Three questions in order. FIRST: what's the dominant material vocabulary of the house — natural timber, painted joinery, concrete/steel, or a period-specific palette? Match the staircase to that vocabulary. SECOND: what accent metal, if any, appears throughout the house — black door handles, brass taps, brushed steel? Repeat that metal in the staircase details. THIRD: what era is the house — modern new-build, updated period, unrestored heritage? Match the design language to the era, not to what's trending. Get those three right and the staircase reads as part of the house rather than as a separate purchase.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Which staircase-to-home combinations tend to look wrong?",
    a: "Full-modern steel-and-glass in an unrestored Victorian terrace (fights the coving and skirtings), heavy turned-oak Victorian-style in a minimalist modern new-build (feels dated the day it's installed), painted white cottage-style staircase in a black-and-concrete industrial loft (design language mismatch), or a highly-industrial floating steel staircase in a cosy rural cottage (kills the warmth). None of these are bad staircases in themselves — they're perfectly good staircases in the wrong houses. Match to the era, the material vocabulary and the metal accent already present — the staircase should feel inevitable, not imported.",
    audience: 2, classification: "expert_observation" }
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

// ─── Diagrams ─────────────────────────────────────────────
const DIAGRAM_A = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_28_10%20PM.png",
  alt:      "Modern straight-flight staircase with warm oak treads and closed risers, slim black metal round-section balusters, black handrail and base rail, LED wall lights recessed at low level, warm oak flooring, black-framed abstract art on the wall, modern kitchen visible at end of hallway",
  title:    "Oak + black metal balusters — warm modern family-home style",
  caption:  "The classic warm-modern combination: oak treads on closed risers, slim black metal round-section balusters between black metal top and bottom rails, and a black handrail. Pairs with the oak flooring, the black-framed art, and the modern kitchen at the end of the hallway to read as one consistent interior.",
  labels:   [],
  footnote: "This is one of the safest long-term design choices for a modern family home. Oak brings the warmth and character; the black metal picks up the other black details in the house (door handles, framed art, kitchen hardware) and ties the whole space together without becoming a design statement in itself."
};

const DIAGRAM_B = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_29_34%20PM.png",
  alt:      "Luxury half-turn staircase with warm oak treads and open risers, frameless glass balustrades with visible stainless-steel point fixings, oak handrail on top of the glass, dramatic warm LED under-tread lighting on every step, in a large hallway with herringbone oak parquet flooring, dark internal doors with glass panels, and large abstract artwork",
  title:    "Oak treads + frameless glass balustrade — luxury open-plan style",
  caption:  "The luxury open-plan combination: chunky oak treads with open risers, frameless glass balustrade panels held by point fixings, oak handrail bonded to the top edge, and warm LED strips under each nosing. Sits perfectly in a large hallway where a solid balustrade would visually cut the space in half.",
  labels:   [],
  footnote: "This style works because the glass keeps sightlines completely open across a large hallway while the oak treads and handrail deliver the warmth and quality feel. The LED under-tread lighting is what turns the staircase from a functional structure into an evening feature — genuinely worth planning early in the build."
};

const DIAGRAM_C = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_30_33%20PM.png",
  alt:      "Modern half-turn staircase with chunky warm-oak treads and open risers, low white-painted parapet wall as the balustrade instead of spindles or glass, slim black metal handrail mounted on the wall above, dramatic warm LED under-tread lighting, concrete-look large-format tile flooring, slatted black feature wall on the left with plant niche, large abstract artwork",
  title:    "Oak treads + painted parapet + slim black handrail — concrete-style modern home",
  caption:  "The industrial-luxury combination for a concrete-look modern home: chunky oak treads warm the space, a low painted parapet wall replaces spindles or glass for a clean architectural line, and a slim black metal handrail runs along the wall above. Warm LED strips under each tread stop the concrete-look flooring from feeling cold.",
  labels:   [],
  footnote: "The move that makes this design work is the oak treads against the cool concrete-look floor and painted parapet — timber warmth is what stops a concrete-style home feeling clinical. The parapet wall alternative to spindles or glass gives the cleanest architectural line but only works when the surrounding walls already have that same minimal design language."
};

const ATTACHMENTS = [
  { q: "What staircase style suits a warm modern family home?", diagram: DIAGRAM_A },
  { q: "What staircase style suits a luxury open-plan home with a large hallway?", diagram: DIAGRAM_B },
  { q: "What staircase style suits a concrete-look or minimalist modern home?", diagram: DIAGRAM_C }
];

let attached = 0;
const notFound = [];
for (const a of ATTACHMENTS) {
  const target = doc.entries.find(e => norm(e.question) === norm(a.q));
  if (!target) { notFound.push(a.q); continue; }
  target.diagram = a.diagram;
  attached += 1;
  console.log(`  ✓ attached to ${target.id}: ${target.question}`);
}
if (notFound.length) {
  console.warn(`⚠ Not found: ${notFound.join(", ")}`);
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`\n✅ Batch 15 (style-matching): Added ${added} new entries (${skipped} skipped).`);
console.log(`   ${attached} diagram attachments across 3 reference photos.`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
