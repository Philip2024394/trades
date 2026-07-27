#!/usr/bin/env node
// Batch 17 staircase seed — 11 focused gap-fills from Philip's paste
// (Q275-Q336). Skips ~50 duplicate Qs and focuses on genuinely new
// territory: home-style matches not covered (barn, brick, dark, wood-
// heavy), buying process gaps (showroom visits, self-install kits),
// LED lighting detail (per-step vs alternate, colour temperature,
// pairing with oak), plus dark stone treads and wall-mounted step
// lights from the new reference photos.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  // ─── Home-style matching gaps ────────────────────────────
  { q: "What staircase suits a barn conversion?",
    a: "Barn conversions live at the intersection of old-agricultural and modern-domestic, and the staircase should honour both. The strongest combination is chunky solid oak treads on a black powder-coated steel structure (either central spine or twin stringers), with frameless glass or slim black cable balustrading. The timber picks up the original barn beams and roof structure; the steel and glass acknowledge the modern conversion. Avoid full-traditional turned-oak staircases — they read as period-townhouse joinery dropped into a barn, which never quite fits.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase suits a home with exposed brick walls?",
    a: "An industrial-style timber-and-steel staircase — black or dark-bronze steel structure (spine or stringers), solid oak or walnut treads, and either a slim metal balustrade, cable balustrading or frameless glass. The warmth of the timber balances the hardness of the exposed brick; the steel echoes the industrial roots of brick-and-iron warehouse aesthetic. Traditional painted or turned-timber staircases fight exposed brick — they belong to different design languages.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase suits a home decorated in dark interior colours?",
    a: "Contrast usually beats matching. If your walls and floors are already dark (navy, forest green, charcoal, oxblood), a LIGHT-oak staircase brings warmth and stops the whole space feeling heavy. If you want the staircase to blend into the dark scheme instead, add generous integrated lighting (LED under-tread + wall lights + a pendant drop above the flight) so the staircase reads as an architectural feature rather than disappearing into the wall behind it. Full-dark staircase in a full-dark room without lighting = staircase you can't actually see, which is a safety issue as well as a design one.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What staircase suits a home that already has a lot of natural wood?",
    a: "Contrast, not more matching timber. If your floors, kitchen and doors are all natural oak, adding a natural-oak staircase can flatten the whole scheme visually — everything reads as one continuous wood tone with no rhythm. Better options: a full-painted staircase with hardwood treads (contrast of colour), an oak staircase in a noticeably different tone (walnut against oak, smoked oak against natural), or a mixed-material staircase where the balustrade is glass or black metal to break up the timber. The staircase should punctuate a wood-heavy home, not dissolve into it.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Buying process gaps ─────────────────────────────────
  { q: "Should I visit a staircase showroom before ordering?",
    a: "Yes, if you possibly can. Photographs online (including on the maker's own website) never quite show the real colour, grain, weight and feel of the timber, the actual thickness of the treads, how the finish looks under normal daylight, or how a specific handrail actually feels in the hand. Twenty minutes in a showroom looking at real samples and standing next to a real fitted flight teaches you more than an hour of scrolling through website galleries. If the maker doesn't have a showroom, ask if they can arrange a visit to a recently-installed staircase in a client's home.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Can I buy a staircase kit online and install it myself?",
    a: "Some standardised staircase kits are designed for competent DIY install — usually straight-flight softwood or budget-oak kits for straightforward openings. What they're NOT: a substitute for a bespoke staircase in an unusual space, or a job for someone who's never fitted one before. Real risks with DIY installation: getting the geometry wrong so it fails Building Control, unsafe balustrade fixings, uneven steps that trip people for the life of the staircase. If you're doing it yourself, at minimum have a competent carpenter do the survey and check-off before you start, and confirm Approved Doc K compliance at every stage.",
    audience: 3, classification: "safety_advice" },

  // ─── Lighting detail ─────────────────────────────────────
  { q: "Should every step on a staircase have an LED under-tread strip, or is every-other-step enough?",
    a: "Depends on the effect you want and the design. EVERY step LED creates the dramatic 'floating ladder of light' look — best on modern architectural staircases where the lighting IS the feature. EVERY-OTHER-STEP still gives you low-level safety lighting and reads as a design feature but is less intense — sometimes a better fit for traditional or transitional interiors where continuous LED would feel over-designed. On a 14-step flight, alternate lighting also halves the cable run and the LED cost. If in doubt, ask your maker to mock up the two options at drawing stage before you commit.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What LED colour temperature suits a staircase — warm white or cool white?",
    a: "Warm white (roughly 2700-3000K) is the safest choice for almost every home staircase — it flatters natural timber, feels welcoming when you walk in after dark, and matches the tone of most household lamps and pendant lights. Cool white (4000K+) gives a more modern architectural feel and pairs well with concrete-look interiors, black metal staircases and heavily minimalist schemes — but can feel cold on a traditional oak staircase where warm light brings the grain to life. Colour-changing RGB LED is available but usually reads as entertainment lighting rather than considered home design — use sparingly.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What kind of lighting best shows off an oak staircase?",
    a: "Warm white (2700-3000K) LED — the warm tone brings out oak's honey and gold notes, deepens the grain shadow, and makes the timber look like premium furniture rather than pale flooring. Positioning matters as much as colour: LED strips under each tread nosing wash the wall behind and the tread below with warm light; wall lights at mid-flight height cross-light the treads; a warm pendant drop above the flight adds vertical warmth. Cool white LED on oak makes it look bleached and clinical — save cool white for concrete-look floors and black-metal designs.",
    audience: 2, classification: "expert_observation" },

  // ─── New from images ─────────────────────────────────────
  { q: "Can staircase treads be made from DARK stone or dark concrete, not just light marble?",
    a: "Yes — dark stone (dark grey basalt, black granite, dark quartzite) and dark polished-concrete treads are increasingly popular on high-end modern staircases where the whole floor is stone in the same tone. Combined with dramatic warm LED under each tread, the dark tread appears to float above a pool of light rather than sit on the structure below — one of the strongest luxury-modern effects. Same structural considerations as light stone (heavy, brittle at the nosing, needs engineered steel spine) but the visual effect is significantly darker and more architectural.",
    audience: 3, classification: "expert_observation" },

  { q: "What are wall-mounted step lights, and how are they different from LED strips?",
    a: "Wall-mounted step lights are small individual light fixtures — usually square or round, recessed into the wall about ankle-to-knee height, one per step or per couple of steps — that cast a soft pool of light directly onto the tread. Different from continuous LED strips: they're discrete points of light rather than a continuous glow, they highlight each step individually (great on floating cantilevered timber treads where a continuous strip has nowhere to hide), and they add architectural rhythm to the wall as a design feature in their own right. Popular on floating and open-riser designs where the wall is on show as much as the staircase.",
    audience: 3, classification: "expert_observation" }
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
const DIAGRAM_J = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_45_54%20PM.png",
  alt:      "Modern straight-flight staircase with laminated glass treads (visible green-tinted edges), frameless glass balustrades with point fixings, continuous warm LED under each tread, additional wall LED strip washing the ceiling and floor, in a luxury home hallway with view of pool and landscaped garden through floor-to-ceiling glass wall",
  title:    "Glass-tread staircase with layered warm LED lighting",
  caption:  "A luxury straight-flight staircase built entirely in glass — laminated glass treads (the visible green edge shows the layered lamination), frameless glass balustrades with point fixings, and layered warm-white LED lighting: continuous LED under each tread PLUS a wall LED strip washing the surrounding surfaces. Warm colour temperature keeps the glass staircase from feeling clinical.",
  labels:   [],
  footnote: "The visible green edge on the treads is how you tell laminated safety glass at a glance — the interlayer that bonds the multiple sheets picks up a slight green tone at the exposed edge. Warm-white LED (around 2700-3000K) is what stops an all-glass staircase feeling like a laboratory."
};

const DIAGRAM_K = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_46_46%20PM.png",
  alt:      "Modern half-turn staircase with dark polished stone or dark concrete-look treads cantilevered off a black steel spine, open risers, frameless glass balustrades with point fixings, dramatic warm LED strip under each tread glowing onto the polished marble floor below, in a moody dark-luxury open-plan home with full-height windows to a landscaped courtyard",
  title:    "Dark-stone tread staircase with dramatic under-tread LED lighting",
  caption:  "A high-end modern staircase built with dark stone (or dark polished concrete) treads cantilevered off a black central steel spine, frameless glass balustrades held by point fixings, and continuous warm LED strips under every tread. The dark treads appear to float above pools of warm light on the polished floor below — one of the strongest luxury-modern effects.",
  labels:   [],
  footnote: "This is a specialist build: stone treads weigh 5-8 times as much as timber and demand an engineered steel structure sized for the load. The dramatic effect comes from the contrast — dark treads against warm light against polished dark floor. In a lighter interior, the same design would feel visually heavier."
};

const DIAGRAM_L = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_47_46%20PM.png",
  alt:      "Modern half-turn dark-stone tread staircase (alternate angle) with continuous warm LED under each tread washing the floor and walls beneath, frameless glass balustrade with visible black point fixings, black steel structure, in a modern minimalist home with full-height glass to landscaped garden and stone feature wall lit from below",
  title:    "Dark stone-tread cantilever staircase — every step continuously LED-lit",
  caption:  "An alternate view of the dark-stone luxury staircase — showing how continuous LED strips under every single tread transform the flight after dark. Each tread appears to hover independently above its own pool of warm light, and the LED cross-lights the surrounding polished floor to make the whole hall glow. This is what continuous per-step LED lighting looks like in practice.",
  labels:   [],
  footnote: "The 'every-step LED' approach shown here creates maximum drama but uses more cable, driver capacity and cost than alternate-step lighting. Best on ARCHITECTURAL staircases where the lighting itself is meant to be the feature; on more traditional designs, alternate-step or wall-mounted lights are usually a better fit."
};

const DIAGRAM_M = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_48_09%20PM.png",
  alt:      "Modern floating cantilever staircase with dark walnut or dark-stained timber treads mounted directly to the wall with no visible support, no balustrade on the open side, individual small square wall-mounted step lights recessed into the wall beside each tread casting a warm pool of light onto each step, in a warm modern hallway with living space beyond",
  title:    "Wall-mounted individual step lights on a floating cantilever staircase",
  caption:  "A floating cantilever staircase where dark walnut treads project directly from the wall with hidden structural steel plate brackets, and lighting comes from SMALL WALL-MOUNTED STEP LIGHTS recessed into the wall beside each tread — one small square light per step — rather than continuous LED strips under the treads. Each light casts a discrete warm pool onto its step.",
  labels:   [],
  footnote: "Wall-mounted step lights are the alternative to under-tread LED strips — better on floating cantilever designs where a continuous strip has nowhere to hide. They also add architectural rhythm to the wall as a design feature in their own right. Note the missing balustrade in the photo — beautiful in the image but almost certainly non-compliant with Approved Doc K for domestic use, which requires a graspable handrail."
};

const ATTACHMENTS = [
  { q: "What LED colour temperature suits a staircase — warm white or cool white?", diagram: DIAGRAM_J },
  { q: "Can staircase treads be made from DARK stone or dark concrete, not just light marble?", diagram: DIAGRAM_K },
  { q: "Should every step on a staircase have an LED under-tread strip, or is every-other-step enough?", diagram: DIAGRAM_L },
  { q: "What are wall-mounted step lights, and how are they different from LED strips?", diagram: DIAGRAM_M }
];

let attached = 0;
const notFound = [];
for (const a of ATTACHMENTS) {
  const target = doc.entries.find(e => norm(e.question) === norm(a.q));
  if (!target) { notFound.push(a.q); continue; }
  target.diagram = a.diagram;
  attached += 1;
  console.log(`  ✓ attached to ${target.id}: ${target.question.slice(0, 80)}`);
}
if (notFound.length) {
  console.warn(`⚠ Not found: ${notFound.join(", ")}`);
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`\n✅ Batch 17: Added ${added} new entries (${skipped} skipped).`);
console.log(`   ${attached} diagram attachments across 4 new reference photos.`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
