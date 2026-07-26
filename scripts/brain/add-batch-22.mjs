// Batch 22 — the final 5%: detail intelligence that separates premium
// staircases from average ones. Skirting/string coordination · lighting
// planning · shadow gaps · newel joints · material mixing · walkthrough +
// marketing. Deduplicated: bullnose (25 hits), handrail height (13),
// handrail profile (9), scribing (12), under-tread lighting (11) are all
// well covered — this batch adds only novel angles on those topics.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "knowledge", "staircase.json");

const raw = JSON.parse(readFileSync(FILE, "utf8"));
const arr = Array.isArray(raw) ? raw : raw.entries || raw.faqs || Object.values(raw).find((v) => Array.isArray(v));

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
  diagram: null,
});

let nextId = 1838;
const add = (q, a, opts) => arr.push(baseTemplate(nextId++, q, a, opts));

// ============================================================
// SKIRTING COORDINATION (10)
// ============================================================
add(
  "Should the staircase maker be told the skirting board height and profile before manufacture?",
  "Yes — always. Skirting spec is not a decorator's afterthought, it is an input into the staircase design. The wall string on a closed staircase often needs to be prepared so the skirting finishes cleanly into it. Missing this conversation is the number-one reason a well-made staircase looks 'fitted afterwards' rather than 'designed together'.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What skirting information does a staircase maker need before cutting timber?",
  "Skirting board height (e.g. 100mm, 120mm, 150mm), skirting thickness (usually 15-22mm), skirting profile (torus, ogee, chamfered, square modern), material (MDF, softwood, hardwood), and finish (paint colour and sheen, or timber and lacquer). Plus whether the skirting continues up the staircase or stops at the string.",
  { cls: "industry_good_practice" },
);
add(
  "Why do skirting-to-staircase junctions go wrong?",
  "Because the staircase is installed first, the decorator arrives weeks later, and no one planned the connection. The builder ends up cutting skirting around a string that was never designed to receive it. The result is small gaps, awkward mitres and poor-looking corners — the whole staircase downgrades because of one badly-planned detail.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What are the three main skirting-to-staircase solutions?",
  "(1) Skirting dies neatly into the string — most professional appearance, requires pre-manufacture coordination. (2) Skirting follows the staircase pitch angle up the flight — traditional style, adds a raking skirt component. (3) Separate staircase trim detail sits between skirt and string — modern minimalist style, no continuous line. All three work — the wrong choice is picking one accidentally on site.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "How does the string get prepared to receive the skirting?",
  "The wall string is shaped or notched during manufacture so the skirting board slides into a purpose-cut recess and reads as one continuous line. The exact detail depends on the skirting profile — a torus skirt needs a curved receiver, a square skirt needs a clean rebate. The joinery shop cuts this once, dead accurately — the site carpenter cannot replicate it after installation.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "What questions should a staircase company ask about the wall + skirting setup?",
  "(1) What floor finish is being used and at what final thickness? (2) What is the skirting board height and profile? (3) Is the staircase wall side plastered before or after the stair goes in? (4) Is the skirting running continuously up the stairs or stopping at the string? (5) Who is responsible for final decoration — the stair company, the builder, or a separate decorator? All five before manufacture.",
  { cls: "industry_good_practice" },
);
add(
  "Why does skirting coordination matter more on a premium staircase?",
  "On a luxury staircase — oak treads, glass balustrade, painted strings — the eye searches for imperfection because the customer paid for perfection. A £15,000 staircase with a skirting that suddenly stops, or a bad string-to-skirt join, is a £15,000 staircase that looks like a £5,000 one. The detail cost of doing skirting properly is trivial; the value cost of getting it wrong is large.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What is a torus skirting profile?",
  "A traditional skirting profile with a rounded semi-circular top edge above a straight face. Common in UK homes at 120-150mm heights. When it meets a staircase string it needs the string profile cut to accept the curve — a straight cut leaves an ugly gap at the top of the skirting.",
  { cls: "industry_good_practice" },
);
add(
  "Does a modern square-edge skirting simplify the staircase junction?",
  "Sometimes — square profiles are easier to detail cleanly against a plain string. But 'easier' does not mean 'automatic'. The junction still needs to be planned so the skirting height picks up the string edge cleanly, and any shadow gap between the two is deliberate rather than accidental.",
  { cls: "industry_good_practice" },
);
add(
  "What is the expert principle for staircase-plus-skirting design?",
  "The staircase should not be designed alone. A premium staircase is designed around the whole system: staircase + skirting + flooring + walls + finishing details. The best makers think about the last 5% of detail before they cut the first piece of timber — the customer sees the details, not the machining time behind them.",
  { cls: "expert_observation", level: 3 },
);

// ============================================================
// TREAD / RISER / SHADOW-GAP DETAIL (6)
// ============================================================
add(
  "How does the tread overhang detail change the look of a staircase?",
  "The front edge treatment of the tread is one of the strongest visual signals of the staircase's style. Bullnose reads traditional. Square edge reads modern. Shadow-gap reads architectural. Square modern with a small chamfer reads contemporary premium. The same underlying stair carcass changes character completely based on this one detail.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What is a shadow-gap staircase detail?",
  "A deliberate small dark reveal (typically 6-12mm) between two components — tread and riser, string and wall, tread and stringer — that reads as an architectural line rather than a joint. Requires accurate machining and careful installation because the gap is meant to be seen; any wobble in the line ruins the effect.",
  { cls: "expert_observation", level: 3 },
);
add(
  "When should a staircase use a shadow-gap detail?",
  "Modern and architectural interiors where the design language values thin lines and precise geometry. Not appropriate for traditional or country-style homes where the same detail reads as unfinished. The shadow gap works with matt finishes and dark contrasts; it disappears against high-gloss or busy grain.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What are the main riser finish options and what do they signal?",
  "Painted white — traditional, contrast against timber treads, brightens the flight. Timber-matched to treads — luxury and cohesive. Glass — modern high-end, lets light through. Open (no riser at all) — contemporary architectural, requires floating stair engineering and 100mm-max opening for regs. Each finish sets a different room mood, not just a different look.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What premium finishes suit an oak staircase?",
  "Clear matt lacquer preserves the natural oak tone and gives the least plastic-looking sheen. Hardwax oil produces a soft warm finish that ages beautifully and is easier to repair locally than lacquer. Full matt (2-5% sheen) is the current premium default; high-gloss finishes now read as dated except in a very specific art-deco context.",
  { cls: "professional_recommendation", level: 3 },
);
add(
  "What are the current premium painted staircase colours?",
  "Warm off-whites for traditional and farmhouse interiors, mid-tone greys for modern homes, deep charcoal or navy on the string and risers with contrasting timber treads for dramatic contemporary, and full-tone dark greens (heritage colours) for period-property renovations. Pure brilliant white is now the builder-default and increasingly reads as cheap.",
  { cls: "professional_recommendation", level: 2 },
);

// ============================================================
// STAIRCASE LIGHTING PLANNING (5)
// ============================================================
add(
  "Why must staircase lighting be planned before the staircase is installed?",
  "Every lighting option — LED strip under handrail, step lights, wall lights, under-tread strip — needs a cable route hidden inside the structure. Retrofit lighting means either visible surface-mount cable trunking (ugly) or partial disassembly of a finished staircase (expensive and destructive). Design the lighting in with the staircase, wire during first-fix, install during final-fit.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What are the common under-handrail LED strip mistakes?",
  "(1) No cable route planned into the handrail groove so the strip is stuck on afterwards with visible wiring. (2) LED chosen with wrong colour temperature — cold 5000K white ruins a warm oak staircase (choose 2700-3000K for timber). (3) Poor driver location so the transformer buzzes audibly in a quiet hallway. (4) No dimmer — evening use at full brightness is uncomfortable.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What are the common LED step lighting mistakes on a staircase?",
  "No cable route planned so lights are surface-mounted with visible wires running along the string; lights added as an afterthought producing uneven spacing between steps; wrong beam angle producing hot spots and dark gaps; and lights on all-night at full brightness disturbing sleep. All four are avoided by planning the lighting at design stage, not after installation.",
  { cls: "expert_observation", level: 2 },
);
add(
  "How does a properly lit staircase differ from a badly lit one?",
  "Properly lit: consistent even illumination across all treads (safety at night), warm colour temperature matching the interior, hidden cables and drivers, dimmer control for evening levels, and often motion or ambient light sensors for automatic operation. Badly lit: harsh single overhead casting shadows, visible cable trunking, one flickering or dead LED, and no low-level option after dark.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What lighting layers work well together on a premium staircase?",
  "Three-layer approach: (1) ambient — soft under-handrail LED strip provides the warm base wash. (2) Task — low-level step lights for safety on individual treads at night. (3) Feature — wall-mounted lights, cabinet lights on any adjacent shelving, or a statement pendant in a stairwell void. Each layer switchable and dimmable independently.",
  { cls: "professional_recommendation", level: 3 },
);

// ============================================================
// NEWEL / HANDRAIL / MATERIAL MIXING (6)
// ============================================================
add(
  "How does newel post connection quality show on a finished staircase?",
  "Premium quality reads as tight joints between newel and string with no visible fixings, clean transitions between newel body and cap, no glue squeeze-out on the finished timber, and cap tops that sit flat and true. Average quality shows visible screw heads, small gaps at joints, and cap misalignment — all fixable at bench-joinery stage but impossible to hide once installed and finished.",
  { cls: "expert_observation", level: 2 },
);
add(
  "How does the handrail profile choice signal the staircase style?",
  "Round handrail — traditional and soft, universal fit for classic homes. Oval — the current UK residential standard, ergonomic to grip while less busy than round. Square — modern contemporary, works well with square balusters and shadow-gap details. Flat rectangular — architectural minimalist, unusual and confident, requires precise support because the wide profile shows any wobble.",
  { cls: "expert_observation", level: 2 },
);
add(
  "Why is timber matching important on a premium staircase?",
  "Luxury reads as coherent. Treads, handrail, newels and adjacent flooring in a coordinated timber palette give the eye one story to read. When each component is a different tone, the staircase reads as assembled parts rather than a designed whole. Coordinated does not mean identical — it means intentionally chosen relationships.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What are the strongest material combinations for a staircase?",
  "Oak + glass — warm timber grounding a light modern balustrade. Walnut + black metal — deep timber paired with dramatic industrial hardware, current premium residential look. Painted string + oak treads — the affordable classic that never dates. Concrete + timber tread caps — modern architectural, strong in loft conversions and industrial-style homes. Each combination signals a different style and price bracket.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What details matter on a glass balustrade to make it look premium?",
  "Glass thickness (usually 12mm toughened, 15mm for structural), edge finish (polished all round, not just top), fixing system (standoff bosses vs channel — the choice sets the whole aesthetic), and alignment. Poor glass installs betray themselves at the joints between panels — misaligned tops, uneven gaps between panels, or one panel out of vertical.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What causes glass balustrade panels to look wrong once installed?",
  "Measurements taken to the wrong tolerance so panels do not sit tight in the channel; fixing holes drilled off-centre so bosses cluster to one side; wrong-diameter bosses for the panel weight (undersized will not hold long-term, oversized look clumsy); and channel not perfectly level so every panel sits at a slight angle. Glass magnifies every setting-out error.",
  { cls: "expert_observation", level: 3 },
);

// ============================================================
// SITE PREP / SCRIBING (2 novel — scribing already covered) ============================================================
add(
  "What state should the walls be in before the staircase installer arrives?",
  "Walls should be straight where straight matters, finished (plastered and skimmed, not left as bare plasterboard), and ready for fixing (structural fixing points known and accessible). A staircase installer fitting to unfinished walls is a job that goes wrong twice — once during install, once again when the plasterer arrives afterwards.",
  { cls: "industry_good_practice" },
);
add(
  "Why does handmade skill still matter in a CNC era of staircase making?",
  "Computers cut accurately, but installers still work against houses that are out of square, floors that slope, and dimensions that vary at every reading. Site skill covers the gap between the machined perfect part and the imperfect building it must fit. CNC gives you a perfect stair — hand skill gives you a stair that fits this actual house.",
  { cls: "expert_observation", level: 2 },
);

// ============================================================
// HANDOVER + CUSTOMER EDUCATION (5) — walkthrough is 0 hits ============================================================
add(
  "What should a good staircase-company customer walkthrough cover?",
  "How to clean the finish (correct products, avoid harsh chemicals or abrasives), how to maintain over time (when to re-oil or spot-repair scratches), what to expect from timber movement (small seasonal changes are normal, not defects), what the warranty covers and what it does not, and who to contact for any issue. Spoken walkthrough plus a printed handover pack.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "Why is educating the customer about natural timber movement important?",
  "Otherwise, every small seasonal change (a hairline crack in a riser during the first heating winter, a slight movement gap opening in summer) becomes a complaint that the installer has to defend. Explaining upfront that wood is a natural material that responds to humidity changes turns a 'defect' into an expected characteristic — the customer feels informed, not misled.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What maintenance advice should be given for different staircase finishes?",
  "Oil finish — may need light re-application every 2-5 years on high-wear areas; easy to spot-repair. Lacquer — usually lower maintenance, but full re-lacquer is a bench-joinery job not a DIY refresh. Paint — expect touch-ups every 2-3 years on high-contact points (nosings, handrails). Wax — highest maintenance, needs regular refresh, chosen for authenticity not convenience.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What should a staircase warranty document actually say?",
  "Scope (which components and issues are covered — structural, finish, hardware), duration (typically 12 months on workmanship, longer on structural), the customer responsibilities that keep the warranty valid (approved cleaning products, no DIY modifications), and the process to report an issue with expected response time. Vague warranties are worthless in a dispute.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What does a professional quality inspection cover before customer handover?",
  "No movement in any component under normal push/pull force, clean joints throughout (no glue squeeze-out or filler visible), smooth finish across every touched surface, secure handrail along its full length, correct alignment of treads and balustrade, all lights and switches working if installed, and every fixing accounted for. Any defect fixed before the customer walks the stair, not after.",
  { cls: "industry_good_practice" },
);

// ============================================================
// MARKETING + CUSTOMER PSYCHOLOGY (6) ============================================================
add(
  "Why are photos of completed staircases a business-critical asset?",
  "A staircase is a visual product — customers buy the feeling of what their house will look like, not the technical spec. High-quality photos of finished work are the marketing input for every future sale, the portfolio evidence for premium pricing, and the trust signal when a first-time customer is choosing between three companies. Free to take, expensive to lack.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What makes staircase photography good enough to use in marketing?",
  "Even natural light or single-source studio light (mixed lighting flattens the depth), a wide-ish lens shot from where a person would stand entering the room, the whole staircase in frame including the hallway context, and the shot taken after decoration and lighting are complete — not straight after install with dust and cables visible. Do the shoot properly once, use for years.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "Why does before-and-after marketing work so well for staircases?",
  "The transformation is visible in a single side-by-side image. An old carpeted pine stair beside its replacement oak-and-glass version tells the whole value story with no words. The customer immediately sees what they could have — imagination is doing the selling, not the marketing copy.",
  { cls: "expert_observation", level: 2 },
);
add(
  "Why does the staircase create such a strong first impression on visitors?",
  "It is the largest single vertical object in the hallway, the object the eye is drawn to on entry, and often the only piece of bespoke joinery in the whole house. A beautiful staircase upgrades the entire perception of the property — the hallway feels bigger, the home feels more valuable, and the whole interior feels intentionally designed rather than developer-standard.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What is the NEX design principle beyond just the staircase itself?",
  "Never design only the stairs — design the staircase environment. The stair plus the hallway walls, the surrounding flooring, the lighting scheme, the under-stair use, and the transition into adjoining rooms all belong to one design conversation. Companies that only sell 'the stair' compete on price; companies that sell 'the environment' compete on value.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What is the final rule on what makes a staircase feel premium?",
  "The customer does not see the hours of machining or the CNC precision. They see the fit against the walls, the finish under the light, and the feeling when they use it every day for years. Premium is not about how much timber is in the staircase — it is about how the last 5% of details were handled.",
  { cls: "expert_observation", level: 3 },
);

writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added entries up to staircase-faq-${nextId - 1}. Total entries: ${arr.length}`);
