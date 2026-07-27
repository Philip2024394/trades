#!/usr/bin/env node
// Batch 16 staircase seed — fills 7 gaps opened by Philip's newest paste:
//   1. Panelled soffit (finished underside of staircase)
//   2. Trimmer beam (the structural framing member around the stair opening)
//   3. Internal-door matching (different from Batch 11's front-door/Crittall entry)
//   4. Whether staircase wood must match internal door timber exactly
//   5. Curved (helical) staircase — distinct from spiral
//   6. Grand split / double-return staircase — the country-manor design
//   7. Carpet stair runners on bespoke timber staircases
//
// Attaches Philip's three new reference photos to three of the new
// entries + one existing entry (bullnose + volute traditional detail).

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "What is a panelled soffit on a staircase?",
    a: "A finished underside of the staircase — the sloping surface you see when you stand under the flight and look up — clad with proper joinery panels (raised-and-fielded panels, flat-panel-and-stile, or beaded panels) instead of being left open, plastered smooth, or hidden behind an understair cupboard door. It's a joinery treatment more than a structural one, and it turns the underside of the flight into a design feature in its own right. Common on traditional and high-end country-house staircases where the flight faces into a hallway and the underside is on view.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a trimmer beam on a staircase?",
    a: "The structural beam that frames the opening in the upper floor where the staircase passes through — it takes the load from the floor joists that had to be cut short to make room for the stair opening. Every stairwell has one (or more) and it's what transfers the interrupted floor load back into the surrounding structure. On new-build drawings it's specified by the structural engineer and shown clearly. On any renovation that alters an existing stair opening, the trimmer beam is one of the first things to reconsider — you can't just enlarge a stair opening without checking what carries the load.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Should my staircase design match the style of my internal doors?",
    a: "Yes — they're both major timber features in the same sightlines and they need to belong to the same design language. Modern minimal internal doors (flush slabs, simple square profiles, no mouldings) pair with a modern staircase — square newels, slim spindles or glass, simple handrail. Traditional panelled internal doors (four-panel, six-panel, with moulded frames) pair with a traditional staircase — turned newels, turned spindles, moulded handrail. Mixing them (modern flat doors with a Victorian turned staircase, or panelled doors with frameless glass) tends to look like two separate design decisions rather than one considered scheme.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Does my staircase timber have to match my internal door timber exactly?",
    a: "No — exact matching often looks more manufactured than considered. Complementary works better than identical: oak staircase with painted internal doors, walnut handrail with darker natural doors, dark-oak stairs with cream-painted doors and warm brass handles. What matters more is that the STYLE VOCABULARY is consistent (modern with modern, traditional with traditional) and the accent metal repeats across both. Some of the strongest hallway schemes deliberately CONTRAST the staircase timber with the door finish — the contrast reads as considered, the exact match reads as flat.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What is a curved (or helical) staircase, and how does it differ from a spiral?",
    a: "A CURVED (helical) staircase sweeps continuously around a wide gentle arc with no central support post — the flight itself forms the structural spiral, usually cantilevered off a hidden inner wall or a curved steel string. A SPIRAL staircase is tighter, wraps around a central column that carries the load, and takes a smaller floor footprint. Curved staircases feel graceful and walk beautifully because the tread going stays generous along the walking line; spirals feel more compact and functional but are trickier to use daily. Curved staircases are meaningfully more expensive to engineer and build — they're the top-of-the-market bespoke joinery job.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a grand split or double-return staircase?",
    a: "A staircase that starts as ONE flight from the ground floor, arrives at a wide half-landing (usually with a decorative feature — chandelier drop, artwork, statue), then SPLITS into TWO flights heading in opposite directions to reach the upper floor. Also called a 'double-return' because the two upper flights return to the same upper level. It's the archetypal grand-entrance staircase of country manors, larger period townhouses, hotels and larger luxury new-builds. Needs a wide, tall entrance hall to work — cramming one into a smaller footprint kills the effect. When it fits, it's one of the most impressive designs there is.",
    audience: 3, classification: "expert_observation" },

  { q: "Can I put a carpet stair runner on a bespoke timber staircase?",
    a: "Yes — and it's one of the most elegant treatments for a traditional oak staircase, especially in country homes and larger period properties. A carpet runner (usually 55-80 cm wide, leaving the timber tread edges showing on both sides) gives you noise reduction and comfort underfoot while still displaying the joinery you paid for. Options run from classic sisal or jute for a coastal/cottage look, to plain wool in cream or grey, to bold patterned wool for statement homes. Traditional stair rods (brass or blackened iron) fit at the back of each tread to hold the runner in place — a beautiful detail on turned-spindle staircases.",
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

// ─── Diagrams ─────────────────────────────────────────────
const DIAGRAM_G = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_40_54%20PM.png",
  alt:      "Classic honey-oak staircase in a luxury double-height entrance hall with fully panelled soffit on the underside (raised-and-fielded joinery panels enclosing the back of the staircase), traditional turned oak spindles, chunky turned oak newel posts, bullnose starting step, volute (scrolled) handrail return at the base, skylights above, marble tile flooring, gallery wall of framed photographs",
  title:    "Classic oak staircase with fully panelled soffit, bullnose start and volute handrail",
  caption:  "A traditional oak staircase where the underside of the flight is fully clad with raised-and-fielded timber panels (the 'panelled soffit') so the back of the staircase becomes a design feature. The flight includes classic period joinery details: a bullnose curved starting step, a scrolled volute at the base of the handrail, turned oak spindles, and matching turned newel posts.",
  labels:   [],
  footnote: "The panelled soffit is a joinery-heavy detail — significantly more work than the usual plasterboard underside — and appears mainly on high-end country homes and larger period townhouses where the staircase faces into the entrance hall. The trimmer beam framing the stair opening at the top of the flight is hidden inside the panelled ceiling above."
};

const DIAGRAM_H = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_39_01%20PM.png",
  alt:      "Grand split or double-return staircase in a large country-manor style entrance hall — a wide central flight rises from the ground floor to a large half-landing with a decorative table and chandelier feature, then splits into two flights returning in opposite directions to the upper gallery. Traditional turned oak spindles and newel posts, bullnose starting step, cream carpet runner on the treads, crystal chandelier hanging from double-height ceiling, marble floor",
  title:    "Grand split (double-return) staircase in a country-manor entrance hall",
  caption:  "The archetypal grand-entrance staircase: one wide central flight rises to a half-landing, then splits into two flights heading in opposite directions to the upper floor. Traditional turned oak balustrade throughout, cream carpet runner with the timber tread edges showing at each side, and a chandelier drop at the centre of the landing space. Needs a wide, tall entrance hall to breathe — a smaller footprint kills the effect.",
  labels:   [],
  footnote: "Split staircases work at the top end of the residential market — country manors, larger period townhouses, hotels and larger luxury new-builds. Also called 'double-return' because both upper flights return to the same upper level. The engineering and joinery are more substantial than a straightforward single-flight staircase, and the price reflects that."
};

const DIAGRAM_I = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_38_25%20PM.png",
  alt:      "Curved helical staircase sweeping in a wide continuous arc without a central support column — the flight forms the structural spiral itself. Traditional turned oak spindles following the curve, curved oak handrail, panelled base wrapping the curved outer side of the flight, warm oak flooring, crystal chandelier hanging above the void, luxury living room visible off to one side",
  title:    "Curved (helical) staircase — traditional oak with sweeping continuous arc",
  caption:  "A curved (helical) staircase — the flight sweeps in one wide continuous arc rather than turning around a central column like a spiral would. The tread going stays generous along the walking line so the flight walks beautifully; the panelled base wraps the outer curve as a finishing detail. Traditional turned oak balustrade follows the curve exactly.",
  labels:   [],
  footnote: "Curved staircases are the top of the bespoke-joinery market — the curved string, curved handrail, and precise geometry along the walking line all demand specialist workmanship. They walk more comfortably than spirals (because the tread going stays generous) but need considerably more floor space. When budget and space allow, few staircases make more of a design statement."
};

const ATTACHMENTS = [
  { q: "What is a panelled soffit on a staircase?",                                      diagram: DIAGRAM_G },
  { q: "What is a grand split or double-return staircase?",                              diagram: DIAGRAM_H },
  { q: "What is a curved (or helical) staircase, and how does it differ from a spiral?", diagram: DIAGRAM_I }
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

console.log(`\n✅ Batch 16 (panelled soffit + trimmer + doors + curved + split + runner): Added ${added} new entries (${skipped} skipped).`);
console.log(`   ${attached} diagram attachments across 3 reference photos.`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
