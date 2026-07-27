#!/usr/bin/env node
// Batch 13 staircase seed — deep dive on STAIRCASE GLASS:
//   - Safety glass basics (toughened vs laminated, sourcing)
//   - DIY warnings (never drill/cut toughened glass yourself)
//   - How glass holes actually get made (pre-toughening)
//   - Bespoke sizing, standard sizing, shaped panels
//   - Brackets and side-mounted vs bottom-fixed fixings
//   - Movement diagnosis, edge finishes
//   - Glass treads (from Philip's ultra-luxury reference photo)
//   - Stone/marble treads as a timber alternative (from the third photo)
//   - When glass is NOT the right choice
//
// Also attaches Philip's three glass-focused reference photos to the
// entries where each is most representative.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  // ─── Safety glass basics ─────────────────────────────────
  { q: "Is staircase glass the same as ordinary window glass?",
    a: "No — never use standard window glass on a staircase. Staircase balustrade glass has to be SAFETY GLASS: either toughened (heat-treated so it shatters into small blunt cubes rather than dangerous shards if it breaks), or laminated (two sheets bonded with a clear interlayer so the fragments stay stuck together), or both combined as toughened-laminated. Ordinary annealed glass breaks into large sharp shards under impact and is genuinely dangerous on a staircase.",
    audience: 2, classification: "safety_advice" },

  { q: "Where should I buy staircase safety glass from?",
    a: "Not from a high-street glass shop that mostly does windows and mirrors — go to a specialist staircase glass supplier, a glass balustrade company, or the manufacturer of your staircase (many will supply the glass as part of the full package). They understand the loading requirements, the correct toughened vs laminated spec for balustrades, the fixing systems, and pre-manufacture drilling and cutting. A standard glass merchant can supply the material but often can't advise on staircase-specific spec.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I get staircase glass panels made to bespoke measurements?",
    a: "Yes — that's how most staircase glass is supplied. You give the maker exact panel dimensions, any shape (angled top for the raked section, curves for a spiral, cut-outs for newel posts), hole positions and diameters for any point fixings, and edge-finish preference (polished, bevelled, ground). They manufacture, drill and toughen the panel to those exact specs. Critical rule: everything has to be right BEFORE toughening — you can't trim, drill or modify toughened glass afterwards without it exploding.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Are staircase glass panels available in standard sizes?",
    a: "Some framed systems use stock panel sizes to keep cost down, but most staircase glass is bespoke — because the flight, the landing, the balustrade angle and the fixing arrangement are all specific to your property. Winders, half-turns, curved staircases and landing balustrades almost always need made-to-measure panels. Standard-size panels are more common on simple straight flights against a straight wall.",
    audience: 3, classification: "expert_observation" },

  // ─── DIY warnings ────────────────────────────────────────
  { q: "Can I drill holes in staircase safety glass with a normal drill?",
    a: "No — do not attempt this. Toughened safety glass under a normal drill bit doesn't just crack, it explodes into thousands of small cubes across the room. Ordinary annealed glass isn't much safer — the drill wanders and cracks the panel across its full width. Glass drilling needs specialist diamond bits, water cooling, controlled pressure, and it has to happen BEFORE the toughening process. Post-toughening drilling is a workshop procedure that the glass supplier does, not a DIY task.",
    audience: 2, classification: "safety_advice" },

  { q: "How are holes actually made in staircase safety glass?",
    a: "In the correct order: the glass is measured, marked, then diamond-drilled to size (with water cooling to stop it cracking) while it's still in its untoughened state. THEN the whole panel — holes and all — goes through the toughening furnace, where it's heated to about 620°C and rapidly cooled. That process locks the glass into its toughened state and no further cutting or drilling is possible without it shattering. This is why 'we need three more holes drilled after all' is a full remake, not a small fix.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Can toughened glass be cut or trimmed after it's been made?",
    a: "No — that's the trade-off you accept when you specify toughened glass. Once toughened, the whole panel is under managed internal stress; any cut, drill or edge-grind releases that stress and the panel explodes into small cubes. If a fitted panel turns out to be wrong dimension, wrong hole position or wrong angle, it's a full replacement not a modification. This is why measurement discipline before toughening is so important on a glass staircase.",
    audience: 3, classification: "manufacturer_guidance" },

  // ─── Decorative & shaped ─────────────────────────────────
  { q: "Can I get a cracked-ice or shattered-glass look for my staircase?",
    a: "Yes — but as a decorative EFFECT built into properly-made safety glass, not by actually breaking a panel. Options include: laminated glass with a pre-cracked layer sandwiched between two intact sheets (the 'crazed' effect is safely trapped inside), decorative films applied to the glass surface, or printed / etched patterns. All of them keep the underlying panel meeting Approved Doc K safety requirements. Never try to create the effect by damaging real glass — the panel will fail.",
    audience: 3, classification: "expert_observation" },

  { q: "Can I have shaped or curved glass panels on my staircase?",
    a: "Yes — angled tops for the raked balustrade over the flight, curves for a spiral or bowed landing, cut-outs to fit round newel posts and handrail returns, are all standard bespoke work for a specialist glass supplier. All shape and hole detail has to be finalised before toughening. Curved (bent) glass is a genuinely specialist product — needs a slump-forming furnace and adds noticeably to cost, so ask for a quote before assuming it fits budget.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Brackets & fixings ──────────────────────────────────
  { q: "Where can I buy brackets and fittings for staircase glass balustrades?",
    a: "From specialist balustrade suppliers, architectural hardware companies, or bundled with the glass from your staircase maker. Common types: stainless-steel disc point fixings (the round discs you see through the glass), spider clamps (multi-arm brackets holding several panels), full base channels (a metal channel the panel drops into), spigot fixings (single small stud brackets), and side-mounted clamps (grip the edge of the panel from the side rather than through drilled holes). Which one you need depends on the glass thickness, panel size and design.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I choose any bracket I like for a glass balustrade — even if it just looks nice?",
    a: "No — the bracket is the structural connection between the glass and the rest of the staircase. It has to be rated for the glass thickness, the panel size, the expected loading, and the fixing substrate (timber, concrete, steel). A decorative-looking bracket that isn't load-rated can fail under someone leaning on the balustrade. Ask the bracket supplier or your staircase maker to confirm the fixing is engineered for your specific spec — 'looks the same as the one in the photo' isn't good enough.",
    audience: 3, classification: "safety_advice" },

  { q: "What's the difference between side-mounted and bottom-fixed glass balustrade fixings?",
    a: "BOTTOM-FIXED means the glass drops into a channel or spigots along the top of the string or the landing edge — cleaner look because you don't see anything through the panel. SIDE-MOUNTED means the glass is held by disc clamps or brackets that grip the panel from its side (usually from the newel post or wall), leaving the top of the glass edge free of any fixings. Side-mounted is often specified when there's no continuous channel to drop the panel into, or when the aesthetic wants visible metal detail. Both are compliant when engineered correctly.",
    audience: 3, classification: "expert_observation" },

  // ─── Diagnosis & finish ──────────────────────────────────
  { q: "My glass balustrade panel wobbles when I lean on it — is that normal?",
    a: "No — a correctly installed glass panel should feel absolutely solid. Movement usually means one of: the point fixings weren't torqued to spec, the bracket-to-substrate fixing has worked loose, the panel's the wrong thickness for the size (too thin for the span), or the glass was drilled slightly oversize and there's play in the fixing. None of them are safe to ignore. Stop leaning on the panel and get the glass supplier or a competent glazier back to diagnose and re-fix — a moving glass balustrade can eventually fail under load.",
    audience: 2, classification: "safety_advice" },

  { q: "Should the edges of a glass staircase panel be sharp or finished?",
    a: "Always finished — never left as a raw cut edge. Common edge finishes: polished (mirror-smooth, most premium look), flat-ground (matte, smooth to touch), bevelled (angled edge like a picture-frame mirror), or arrissed (just softening the sharp corner). Any exposed glass edge on a staircase — especially anywhere hands might contact it — should be at minimum arrissed. A raw sharp edge on a staircase is both a cut risk and a stress-concentration point where the panel could crack.",
    audience: 3, classification: "safety_advice" },

  // ─── When NOT to use glass ───────────────────────────────
  { q: "When is glass NOT the right balustrade choice for a staircase?",
    a: "When your priority is very low maintenance (glass shows every fingerprint and needs regular cleaning), when the house is a traditional period property whose bones want turned timber, when you want a warmer more textured aesthetic than glass gives, when budget is tight (glass balustrades cost meaningfully more than painted timber spindles), or when you want privacy on the flight. Glass is brilliant when it fits the design intent; it's the wrong answer when forced into a scheme that wanted something else.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Does staircase glass scratch easily?",
    a: "Not under normal use — quality toughened glass is genuinely hard-wearing and resists day-to-day scuffs from clothes, hands and shoes. What DOES scratch glass: abrasive cleaning powders, wire wool, metal scrapers used to remove a stubborn mark, and (surprisingly common) rings or watches dragged across the panel accidentally. Stick to a microfibre cloth and a proper glass cleaner and the panel stays scratch-free indefinitely.",
    audience: 2, classification: "expert_observation" },

  // ─── Advanced: glass treads + stone treads (from photos) ──
  { q: "Can I have glass treads on my staircase, or is that only for commercial showrooms?",
    a: "Yes — glass treads are a real domestic option, but they're a genuinely specialist and expensive build. The treads are usually laminated (three or more layers of toughened glass bonded together for redundancy — if one layer cracks, the others still carry the load), often frosted for grip and to hide the layers, and always supported by an engineered steel structure with plate brackets rated for the full design load. The effect — especially with LED lighting underneath so the treads glow — is spectacular. The cost is at the top of the staircase market.",
    audience: 3, classification: "expert_observation" },

  { q: "Can staircase treads be made from stone or marble instead of timber?",
    a: "Yes — natural stone (marble, limestone, granite) or engineered stone (large-format porcelain, sintered stone) treads are used on high-end staircases where the whole floor is stone and the staircase should read as continuous. Two important considerations: stone treads are HEAVY (5-8x the weight of the equivalent timber tread), so the underlying steel structure needs to be engineered for the load — you can't drop stone treads onto a timber-designed staircase. And stone is brittle: nosing detail has to be right or the front edge chips over time. Beautiful when done properly; specialist to design and install.",
    audience: 3, classification: "professional_recommendation" }
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

// ── Diagram A: side-mounted glass on straight-flight timber-tread ──
const DIAGRAM_A = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_19_20%20PM.png",
  alt:      "Straight-flight timber-tread staircase with frameless glass balustrade held by visible side-mounted stainless-steel disc point fixings, stainless-steel handrail above the glass, LED under-tread lighting, in a modern compact hallway with dark green accent wall and round mirror",
  title:    "Side-mounted point fixings on a frameless glass staircase balustrade",
  caption:  "Modern straight-flight staircase where the glass balustrade panels are held by stainless-steel disc-shaped point fixings on the SIDE of each panel (rather than dropped into a base channel). A stainless-steel handrail sits above the glass. Warm LED under-tread lighting picks out the flight.",
  labels:   [],
  footnote: "Side-mounted disc fixings are the common alternative to bottom-fixed channels — they leave the top edge of the glass clean and let the balustrade appear to float alongside the flight. The visible discs are engineered point fixings drilled through the glass BEFORE toughening; the panel can't be modified afterwards."
};

// ── Diagram B: glass treads + glass balustrade (ultra-luxury) ──
const DIAGRAM_B = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_19_55%20PM.png",
  alt:      "Ultra-luxury half-turn staircase with FROSTED LAMINATED GLASS TREADS glowing with LED backlighting, frameless glass balustrades held by point fixings, stainless-steel handrail, in a double-height open-plan luxury home",
  title:    "Glass treads on a modern luxury staircase",
  caption:  "A half-turn staircase built entirely in glass — laminated frosted-glass treads (multiple layers bonded for redundancy) with LED strips underneath making each tread glow, frameless glass balustrades with point fixings, and a slim stainless-steel handrail. Sits at the top of the staircase market for cost and specialist build.",
  labels:   [],
  footnote: "Glass treads are laminated (typically three or more toughened layers bonded together) so a crack in one layer doesn't compromise the tread. The whole staircase requires engineered steel structure rated for full design load, and the glass is drilled/shaped before toughening. Spectacular, and priced accordingly."
};

// ── Diagram C: stone/marble treads + frameless glass ──
const DIAGRAM_C = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_21_10%20PM.png",
  alt:      "Straight-flight luxury staircase with polished stone or marble treads, open risers, frameless glass balustrade panels held by visible point fixings, stainless-steel handrail, LED under-nosing lighting, in a high-end open entrance with matching stone flooring",
  title:    "Stone-tread staircase with frameless glass balustrade",
  caption:  "A straight-flight staircase using polished natural stone (marble or similar) for the treads, with a frameless glass balustrade held by stainless-steel point fixings. Open risers and LED under-nosing strips let light through the flight; the stone tread continues the same material as the surrounding floor for a seamless luxury look.",
  labels:   [],
  footnote: "Stone treads are heavy — usually 5-8 times the weight of an equivalent timber tread — so the underlying structure has to be engineered specifically for stone loading. Stone is also brittle at the nosing edge and needs correct detailing to avoid chipping. Beautiful when the whole floor is stone and the staircase continues the material; specialist to design and install."
};

const ATTACHMENTS = [
  { q: "What's the difference between side-mounted and bottom-fixed glass balustrade fixings?", diagram: DIAGRAM_A },
  { q: "What are the round metal disc fixings I can see on some frameless glass staircase balustrades?", diagram: DIAGRAM_A },
  { q: "Can I have glass treads on my staircase, or is that only for commercial showrooms?", diagram: DIAGRAM_B },
  { q: "Can staircase treads be made from stone or marble instead of timber?", diagram: DIAGRAM_C }
];

let attached = 0;
const notFound = [];
for (const a of ATTACHMENTS) {
  const target = doc.entries.find(e => norm(e.question) === norm(a.q));
  if (!target) { notFound.push(a.q); continue; }
  target.diagram = a.diagram;
  attached += 1;
  console.log(`  ✓ attached ${a.diagram.title.slice(0,50)}... to ${target.id}`);
}
if (notFound.length) {
  console.warn(`⚠ Not found: ${notFound.join(", ")}`);
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`\n✅ Batch 13 (glass deep-dive): Added ${added} new entries (${skipped} skipped).`);
console.log(`   ${attached} diagram attachments across 3 reference photos.`);
console.log(`   total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
