// Batch 20 — staircase back panel design language.
// Covers the slab / 9mm-veneer-sheet + moulding-rack construction approach
// as a DIY-friendly system that produces designer results at competitive cost.
// 6 reference images from Philip attached across the hero entries.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "knowledge", "staircase.json");

const raw = JSON.parse(readFileSync(FILE, "utf8"));
const arr = Array.isArray(raw) ? raw : raw.entries || raw.faqs || Object.values(raw).find((v) => Array.isArray(v));

const IMG = {
  panel1: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_48_22%20PM.png?updatedAt=1785044919331",
  panel2: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_43_09%20PM.png?updatedAt=1785044605515",
  panel3: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_40_08%20PM.png?updatedAt=1785044423668",
  panel4: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_37_56%20PM.png?updatedAt=1785044297637",
  panel5: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_28_47%20PM.png?updatedAt=1785043743015",
  panel6: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_26_00%20PM.png?updatedAt=1785043577618",
};

const diagram = (url, title, alt, caption) => ({ url, alt, title, caption, labels: null });

const baseTemplate = (id, question, answer, opts = {}) => ({
  id: `staircase-faq-${id}`,
  kind: "faq",
  question,
  answer,
  category_tag: "staircase",
  audience_level: opts.level ?? 2,
  classification: opts.cls ?? "industry_good_practice",
  safety_note: opts.safety ?? null,
  source_verified_at: null,
  fact_check_flag: null,
  diagram: opts.diagram ?? null,
});

let nextId = 1743;
const add = (q, a, opts) => arr.push(baseTemplate(nextId++, q, a, opts));

// ---------- Core system idea (4) ----------
add(
  "What is the slab-plus-moulding staircase back panel system?",
  "A construction approach that builds designer back-of-staircase panels from two off-the-shelf inputs: a smooth substrate sheet (MDF, plywood or 9mm veneer sheet) for the flat 'slab' background, and standard wood mouldings from a joinery merchant's rack for the framed sections on top. Together they produce shaker, raised-panel, beaded and grid-panel designs at a fraction of solid-timber joinery cost.",
  { cls: "professional_recommendation", diagram: diagram(IMG.panel1, "Slab-plus-moulding back panel concept", "Staircase back panel built from sheet substrate with moulded frames added", "Concept render: slab-and-moulding back panel system") },
);
add(
  "Why is the slab-plus-moulding approach a competitive design method?",
  "Bespoke solid-timber panelled joinery is expensive because every stile and rail is a jointed timber component. The slab-plus-moulding method uses one big sheet for the field and standard mouldings applied on top to define the framing — same visual result, a fraction of the joinery labour and material cost. Puts designer panelling within reach of DIY and general carpenters, not just specialist bench joiners.",
  { cls: "expert_observation", level: 3 },
);
add(
  "Who can install a slab-plus-moulding staircase back panel?",
  "Any competent DIYer or carpenter — no advanced bench joinery required. The skills needed are cutting sheet material to size, mitre-cutting mouldings at 45°, glue-and-pin fixing, and filling / painting or finishing. The specialist part of the work happens at the merchant when the veneer sheet is faced and the mouldings are milled — not on site.",
  { cls: "industry_good_practice", diagram: diagram(IMG.panel2, "DIY-friendly panel construction", "Carpenter fitting moulded frames onto a slab back panel", "Concept render: DIY-friendly panel installation") },
);
add(
  "What is a standard 'slab' back panel with paint colour of choice?",
  "The simplest option: a flat MDF or plywood sheet fixed to the staircase back, filled at joints, primed and painted any colour the customer wants. No mouldings, no timber grain — just a smooth painted surface. Best when the surrounding walls are the design feature and the staircase back is meant to disappear.",
  { cls: "professional_recommendation" },
);

// ---------- 9mm veneer sheet economics (5) ----------
add(
  "What is a 9mm veneer sheet in the panelling trade?",
  "A pre-manufactured board — MDF or plywood core — with a thin layer of real timber veneer bonded to one or both faces, supplied at nominal 9mm thickness. Sold in the standard 8'×4' (2440×1220mm) merchant sheet size. Ready to cut and finish; no need to face the substrate yourself.",
  { cls: "industry_good_practice" },
);
add(
  "Why is the 8'×4' sheet size the industry standard?",
  "8'×4' (2440×1220mm) is the dimensional standard across MDF, plywood, veneered board and plasterboard supply. Merchants stock it, cutting racks handle it, and most delivery vans and trailers are set up around it. A staircase back panel design specified in 8'×4' sheet units keeps material sourcing simple and predictable.",
  { cls: "industry_good_practice" },
);
add(
  "Which timber species are available as veneer sheets for staircase panels?",
  "The commonly stocked veneer sheet range: oak (American White and European), walnut (American Black), mahogany, ash, maple, cherry, beech, sapele, and pine. The same species range as solid timber — but at sheet economics rather than solid-board economics.",
  { cls: "industry_good_practice", diagram: diagram(IMG.panel3, "Veneer sheet species range", "Different timber veneer species available as 9mm sheets", "Concept render: veneer species options for staircase panels") },
);
add(
  "How does the cost of a veneer sheet compare to solid timber panelling?",
  "A veneer sheet costs a small fraction of the solid-timber equivalent because the expensive timber is a thin surface layer over a cheap core. Add competitively-priced mouldings on top and the finished panel gives the visual read of solid timber panelling at a small percentage of the cost. This is the economic engine behind the whole slab-plus-moulding approach.",
  { cls: "expert_observation", level: 3 },
);
add(
  "When should a veneer sheet be chosen over solid timber for a staircase back?",
  "Almost always for the back-of-staircase application. The back panel is not a wear surface, not a load surface, and does not need solid-timber joinery. Veneer sheet gives the same appearance for far less money, is dimensionally more stable than solid timber (less seasonal movement), and covers large areas in one piece rather than in jointed boards.",
  { cls: "professional_recommendation" },
);

// ---------- Moulding rack + design styles (7) ----------
add(
  "What is the 'moulding rack' in a joinery merchant?",
  "The wall or bay in a merchant where standard timber mouldings are stocked in long lengths: architraves, skirting profiles, panel mouldings, beading, dado rails, corner mouldings, and panel-frame profiles. Sold by the linear metre. Everything needed to turn a plain slab panel into a designed panel is on this one rack.",
  { cls: "industry_good_practice", diagram: diagram(IMG.panel4, "Moulding rack at merchant", "Long lengths of timber mouldings and panel frames stocked at merchant", "Concept render: joinery merchant moulding rack") },
);
add(
  "Which mouldings from the rack are used to build a shaker panel design?",
  "Simple flat rectangular timber profiles (typically 20-40mm wide × 8-12mm proud) mitred at 45° at the corners and fixed to the slab in rectangular frames. The shaker look is defined by clean lines and unadorned edges — the whole style is achievable with the plainest mouldings the merchant stocks.",
  { cls: "industry_good_practice", diagram: diagram(IMG.panel5, "Shaker-style back panel", "Rectangular flat mouldings applied to slab creating shaker frames", "Concept render: shaker-style staircase back panel") },
);
add(
  "Which mouldings are used for a raised-panel design?",
  "Panel mouldings with a stepped profile — a raised centre and shaped edges — applied around the perimeter of each field, sometimes combined with an inner bevelled insert. Produces the classic Georgian / Victorian raised-panel look without the bench-joinery cost of true solid raised panels.",
  { cls: "industry_good_practice" },
);
add(
  "What is a beaded panel design?",
  "A shaker-style frame with a small semicircular bead moulding run along the inner edge of the frame. Adds a shadow line that softens the frame and gives the panel a more traditional character. Popular in period homes and farmhouse interiors.",
  { cls: "industry_good_practice" },
);
add(
  "Can you build grid, herringbone or geometric panel designs from the same system?",
  "Yes — the slab substrate is the same, only the moulding pattern changes. Grid panels: repeating equal squares or rectangles. Herringbone: mouldings run at 45° in interlocking direction pairs. Geometric: diamonds, chevrons, art-deco stepped forms. The design vocabulary is limited only by the carpenter's willingness to mitre-cut.",
  { cls: "professional_recommendation", diagram: diagram(IMG.panel6, "Geometric back panel patterns", "Grid, herringbone and geometric moulding patterns on staircase back", "Concept render: geometric panel design options") },
);
add(
  "How is the moulding fixed to the slab in a slab-plus-moulding panel?",
  "Wood glue applied to the moulding back plus pin-nailed with a fine nailer (headless pins or 18-gauge brads). The glue does the long-term work; the pins hold the moulding in place while the glue sets. Pin heads are filled and sanded before finishing so no fixings are visible on the finished panel.",
  { cls: "industry_good_practice" },
);
add(
  "What is the sequence for building a slab-plus-moulding staircase back panel?",
  "(1) Measure and cut slab to fit the back of the stair. (2) Fix slab to the staircase framework or wall. (3) Set out the moulding pattern on the slab in pencil. (4) Mitre-cut moulding lengths at 45°. (5) Glue and pin mouldings in position. (6) Fill pin holes and any mitre gaps. (7) Prime and paint, or clear-lacquer if using veneer sheet.",
  { cls: "industry_good_practice" },
);

// ---------- Finishing choices (3) ----------
add(
  "What are the finishing options for a veneer-sheet staircase back panel?",
  "Clear lacquer (protects and shows the natural grain), stained lacquer (adjusts colour while keeping grain), oil finish (softer sheen, easier future repair), or paint (covers the veneer completely — usually chosen only if the veneer is a low-cost pine used purely as substrate). Match the finish to the staircase itself for a cohesive read.",
  { cls: "professional_recommendation" },
);
add(
  "What paint finish suits an MDF slab-plus-moulding back panel?",
  "Water-based satin or eggshell in a mid-sheen level: hides small imperfections better than full gloss, more washable than matt, and reads as premium joinery rather than emulsion wall paint. Two coats over primer minimum. Popular colours: warm off-whites for traditional homes, muted greens and blues for modern character, dark charcoal for dramatic contrast.",
  { cls: "professional_recommendation" },
);
add(
  "Should the panel finish match the staircase itself?",
  "Usually yes — a matching veneer species and matching finish (e.g. oak veneer sheet, matt lacquer, same colour tone as the oak stair treads) makes the back panel read as part of the staircase design. Contrasting is a valid choice too (painted panel behind a timber stair) but should be a deliberate design decision, not an accident of what the merchant had in stock.",
  { cls: "professional_recommendation" },
);

// ---------- Pine + carpenter DIY angle (4) ----------
add(
  "Is pine veneer sheet a viable option for a staircase back panel?",
  "Yes — often chosen when the panel will be painted rather than shown as natural timber. Pine veneer sheet is the cheapest species in the range and takes paint well. Combined with pine panel mouldings from the same merchant it produces a full painted panelled wall at commodity-timber cost.",
  { cls: "professional_recommendation" },
);
add(
  "Why does the moulding rack + veneer sheet combination suit the DIY market?",
  "Every input is stocked at every timber merchant, priced by the sheet or the linear metre, and needs only common site tools: circular saw, mitre saw, glue, pin nailer. No timber machining, no bench joinery, no shop-made panel components. A confident DIYer can build a designer back panel in a weekend with materials picked up in one merchant trip.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "What tools does a carpenter need for slab-plus-moulding back panels?",
  "Circular saw or track saw (cut slab to size), mitre saw for accurate 45° cuts on mouldings, pin nailer (18-gauge or 23-gauge headless pin), wood glue, filler, sanding block, primer and finish. Everything is site-standard carpentry kit — no dedicated joinery shop required.",
  { cls: "industry_good_practice" },
);
add(
  "What is the cost advantage of the slab-plus-moulding system for a customer?",
  "Bespoke solid-timber panelled joinery for a full staircase back can run into thousands of pounds. The slab-plus-moulding equivalent — one 8'×4' veneer sheet plus 15-25 linear metres of moulding plus a day of carpenter time — typically comes in at a small fraction of that. Same visual result, dramatically different invoice.",
  { cls: "expert_observation", level: 3 },
);

// ---------- Application to whole interior spaces (3) ----------
add(
  "Can the slab-plus-moulding system extend beyond the staircase back?",
  "Yes — this is one of its strengths. The same veneer sheet species and same moulding profile can be run along the adjacent hallway walls, up the stairwell, along a dining-room feature wall, or across a whole living room. The staircase back becomes the starting point of a continuous designed panelling scheme rather than a one-off surface.",
  { cls: "professional_recommendation" },
);
add(
  "What is the design advantage of continuous panelling from staircase into surrounding rooms?",
  "It ties the whole interior together into one architectural language rather than a series of disconnected wall treatments. A visitor reads a single premium finish flowing from the hallway up the stair and into the living space — the interior feels designed rather than assembled. Common in high-end period-property renovations.",
  { cls: "expert_observation", level: 3 },
);
add(
  "Should the same slab-plus-moulding pattern be used across every wall?",
  "No — the pattern should be scaled to each surface. Tall stairwell walls suit long vertical panel frames. Wider low walls suit wide horizontal panels. Half-height dado panelling suits shorter squarer frames below the rail. Same system, same species, same moulding profile — but sized to the surface it sits on.",
  { cls: "professional_recommendation" },
);

// ---------- NEX product angle (3) ----------
add(
  "Should NEX offer slab-plus-moulding back panels as a standard configurator option?",
  "Yes. Every staircase configuration should present at least four back-panel choices: plain slab painted, veneer sheet clear-finished, veneer sheet with shaker moulding frames, and veneer sheet with raised-panel mouldings. Customer picks species and finish colour. The three variables (substrate / pattern / finish) generate hundreds of visual options without needing hundreds of separate SKUs.",
  { cls: "professional_recommendation" },
);
add(
  "How would NEX quote a slab-plus-moulding back panel?",
  "By the wall area in square metres for the sheet component, plus linear metres of moulding for the framing pattern chosen, plus a fitting-labour allowance. All three inputs are known merchant prices plus a standard labour rate, so the quote is generated in seconds without a manual takeoff. Predictable pricing turns a bespoke-feeling design into a productised offer.",
  { cls: "professional_recommendation" },
);
add(
  "What is the biggest business opportunity in the slab-plus-moulding back panel system?",
  "It bridges the gap between builder-standard plasterboard-and-paint (cheap but forgettable) and bespoke solid-timber panelling (expensive and slow). Nothing sits in the middle today. A staircase company that productises this middle tier — configurable, quotable, installable by a general carpenter — captures a market that neither the volume house-builders nor the premium bench joiners serve.",
  { cls: "expert_observation", level: 3 },
);

writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added entries up to staircase-faq-${nextId - 1}. Total entries: ${arr.length}`);
