// Batch 23 — temporary/upgrade strategy + manufacturing workflow novel
// angles + business intelligence (quoting/deposits/positioning) + customer
// psychology + materials novel angles.
//
// DELIBERATE SKIPS due to existing coverage:
//   - Oak/pine/walnut/ash characteristic entries (35-60 hits each already)
//   - MDF properties (50 hits), laminated timber (40), engineered (41)
//   - Moisture control (104 hits), CAD/CNC basics
//   - Refurbishment overview (already in batch 21)
//   - Handrail profiles (9), bullnose (25), scribing (12)
//   - Marketplace opportunity structure (batch 18 covered in depth)
//   - Digital passport (already added)
// Only novel angles or premium framings added on those topics.

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

let nextId = 1878;
const add = (q, a, opts) => arr.push(baseTemplate(nextId++, q, a, opts));

// ============================================================
// TEMPORARY vs DREAM STAIRCASE STRATEGY (10)
// ============================================================
add(
  "Is it reasonable to fit a cheap temporary staircase while saving for the dream one?",
  "Yes — completely reasonable, and common practice during self-builds, renovations, extensions and new builds before decoration. The single rule: do not install something unsafe, and do not install something that will create a bigger cost later (structural changes, damaged floors, unusable openings). A safe cheap stair is a valid stepping stone; a dangerous one is not.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "What is a temporary plank staircase?",
  "A basic softwood or builder-grade pine staircase installed as functional access between floors during construction. Sometimes just structural planks with minimal balustrade. Cheapest possible option, gets residents safely between floors, and can be removed when the dream stair is ready. Never a long-term finished stair — it will look and feel unfinished.",
  { cls: "industry_good_practice", level: 1 },
);
add(
  "What is the downside of a very cheap temporary staircase?",
  "It looks unfinished (customers who intend 'temporary for a year' often live with it for five), wears quickly under daily use, may need replacing rather than upgrading, and can be difficult to modify later because dimensions were compromise not designed. If the plan is genuinely short-term, all these are acceptable — if the timeline slips, they compound.",
  { cls: "expert_observation", level: 2 },
);
add(
  "Can I buy a second-hand staircase and fit it in my house?",
  "Sometimes — but a staircase is not like buying a second-hand door. It was made for another house and every geometry parameter matters: floor-to-floor height, width, number of steps, pitch, opening size, landing position. A used stair that is perfect in the seller's house is unlikely to fit yours without significant modification, and the modification cost often erases the saving.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "Where can I source a second-hand staircase?",
  "Staircase companies with cancelled or ex-display stock, salvage yards, house-refit demolitions, other renovation projects being completed, and online marketplaces (Facebook Marketplace, eBay, salvage-specialist sites). Reclaimed period stairs from listed-building work can be exceptional value if the geometry matches your opening — measure both stairs before committing.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "What must be checked before buying any second-hand staircase?",
  "Floor-to-floor height it was built for, overall width, number of steps, pitch (rise/going ratio), stairwell opening size and shape, and landing position and orientation. Take the seller's dimensions and compare against your survey before you agree. Reclaimed timber value only holds if the stair can actually be installed — a beautiful oak stair that will not fit is worth firewood.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What is the 'basic staircase that can be upgraded' approach?",
  "Install a functional starter staircase (pine strings, basic treads, simple balustrade) that is designed from the outset to accept upgrades: oak stair caps overlaid on the pine treads, oak handrail replacing the pine one, glass panels replacing spindles, LED lighting added, feature panels applied. Same structure, staged financial commitment.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What is a typical staircase upgrade path?",
  "Stage 1: cheap functional staircase installed during build. Stage 2: replace the visible parts — oak stair caps, new handrail, upgraded spindles or glass. Stage 3: luxury finish — full oak or walnut, glass balustrade, LED lighting, feature under-stair panels. Each stage can be funded separately; the earlier stages are not thrown away.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What kind of temporary staircase should be avoided even short-term?",
  "Anything that cannot be modified without demolition (wrong opening size for any future stair), anything with incorrect dimensions that fail Doc K (a trip hazard is a trip hazard even 'temporarily'), and anything so poorly built it becomes unsafe under normal use. Cheap-but-well-made is fine; cheap-and-badly-made is a false economy.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What is the expert rule on temporary versus dream staircases?",
  "A cheap but well-made staircase is better than an expensive wrong staircase. Do not spend money twice on a stair that cannot be modified, has wrong dimensions, or is poorly built. Better to install a functional starter stair that upgrades in stages than a mid-tier stair you regret and cannot afford to replace.",
  { cls: "expert_observation", level: 2 },
);

// ============================================================
// MANUFACTURING WORKFLOW — NOVEL ANGLES (6)
// (CAD/CNC basics already covered — these are novel specifics)
// ============================================================
add(
  "What are the distinct areas of a professional staircase workshop?",
  "Seven typical zones: timber storage (conditioned to workshop humidity), cutting area (rough dimensioning), machining area (CNC + traditional joinery), assembly area, sanding area (dust-controlled), finishing room (usually a separate spray booth for lacquer / paint), and packing area near the loading bay. Layout matters — timber should flow one direction through the workshop, never backtrack.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "What is CNC nesting in staircase manufacture?",
  "The optimisation process that fits multiple staircase components onto a single sheet of material with minimum waste — usually done in software before the CNC cuts. Efficient nesting can save 15-30% of sheet material across a batch of jobs. Modern staircase workshops with high sheet-material use (MDF risers, plywood substrates) treat nesting as a first-class cost lever.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "Why do professional staircase workshops use a dedicated spray finishing room?",
  "Lacquer, paint and oil finishes need controlled conditions to achieve premium results: filtered air (no dust settling in wet finish), stable temperature (finishes cure predictably), extraction (VOCs removed safely), and separation from cutting/sanding dust. A stair sprayed in the main workshop always shows contamination in the finished surface under raking light.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "What is the correct sanding progression for a premium staircase finish?",
  "Coarse (60-80 grit) to remove machining marks, medium (120-150) to level the surface, then fine (180-240) as the final pre-finish stage. Skipping a grit shows in the final finish as visible scratch marks under lacquer or oil. Between-coats sanding on the finish itself uses 320-400 grit. A poor sanding job cannot be hidden by expensive timber — the light reveals it.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "Why do premium workshops dry-assemble the whole staircase before delivery?",
  "To confirm fit, alignment and quality before it leaves the shop, and to catch any joinery error while the parts are still on the bench where they can be fixed cheaply. Same problem discovered on the customer's landing during installation costs ten times more to fix and damages the client relationship. Premium companies dry-fit every stair as standard.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "How is a completed staircase packed for delivery?",
  "Foam blocks between components to prevent shift damage in transit, cardboard corner protectors on every finished edge, timber battens as sacrificial spacers on heavy sections, weatherproof outer wrap if going in an open trailer, and clear labels identifying each part in the assembly sequence so the installer can unpack in order. Damaged-in-transit is preventable damage.",
  { cls: "industry_good_practice" },
);

// ============================================================
// STAIRCASE BUSINESS INTELLIGENCE (12)
// ============================================================
add(
  "What are the main revenue streams for a staircase company?",
  "Seven core lines: new staircase installations, stair refurbishment (structure kept, visible parts replaced), handrail upgrades, glass balustrade retrofits, under-stair storage and cabinetry, custom joinery adjacent to the stair (feature walls, panelling), and commercial projects (hotels, offices, apartments). Companies that only sell 'new stairs' compete on price; multi-line companies compete on relationship.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What is the difference between a basic staircase package and a premium package?",
  "Basic: stair structure, treads, risers — customer organises painting, decoration and flooring themselves. Premium: design, manufacture, installation, finishing, lighting, storage all delivered as one project. The premium package captures the whole hallway spend rather than only the stair-carpentry portion; ticket size is often 2-4× the basic equivalent.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "Why do premium staircase companies earn more per job?",
  "They sell design confidence, quality assurance, convenience, and a finished result — not just steps. A customer choosing between three stair-only quotes compares on price; a customer choosing a premium package compares on outcome. Different conversation, different margin, same underlying joinery skills.",
  { cls: "expert_observation", level: 3 },
);
add(
  "Why is 'price per step' misleading for staircase quoting?",
  "Two 13-step staircases can vary in cost by 5×. A simple straight pine flight is cheap; a curved oak flight with glass balustrade and integrated lighting is not. Design complexity, material choice, fittings and installation difficulty all matter more than step count. Companies that quote 'price per step' are selling to customers who do not yet understand what they are buying.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What factors most increase the price of a staircase?",
  "Curved geometry (much more machining and jig work), glass balustrade (material cost, structural fixing, delivery risk), premium timber (walnut, smoked oak), floating or cantilevered designs (structural engineering required), difficult site access, and custom detailing (feature panels, integrated lighting, shadow gaps). Any two of these together doubles the price of a basic equivalent.",
  { cls: "industry_good_practice", level: 2 },
);
add(
  "What is a typical staircase payment structure?",
  "Common three-stage: deposit at order (20-40%, funds materials and reserves production), stage payment at manufacture completion or delivery (30-40%), final balance on installation completion (remainder). Structure varies by company and job size — the principle is that the maker never carries the full cash risk of a bespoke product that cannot be resold.",
  { cls: "industry_good_practice" },
);
add(
  "Why do staircase companies require a deposit?",
  "A bespoke staircase is made specifically for one house — it cannot easily be resold if the customer changes mind or cancels. The deposit buys materials, reserves production time, covers design and drawing work, and gives the maker a proportion of the cost committed by the customer. Companies that skip the deposit carry the customer's cancellation risk on every job.",
  { cls: "expert_observation", level: 2 },
);
add(
  "When should a staircase company confirm the final price?",
  "After site survey and final measurements and design approval. Providing a firm price from a phone description is guessing — every real house has out-of-square walls, thickness variations in floor finishes, and access constraints that change the labour cost. Premium companies quote an initial range then firm up after survey. Cheap companies quote a fixed price and increase it later.",
  { cls: "industry_good_practice" },
);
add(
  "Why does poor workshop planning damage staircase company profit?",
  "Timber waste (badly-cut boards that cannot be reused), extra labour (remaking parts after errors), delays that push installers into overtime, and follow-up trips to fix issues found on site. A workshop running at 5% waste is 5% more profitable than one running at 15% waste — the difference is planning discipline, not equipment cost.",
  { cls: "expert_observation", level: 3 },
);
add(
  "Why does a staircase company benefit from working with architects and interior designers?",
  "Architects influence material and layout decisions early — being on their approved-supplier list means being specified before the customer even sees quotes. Interior designers drive premium-package sales because their clients expect a finished result, not a stair-only invoice. Trade referrals from either group typically carry higher margin than direct-to-consumer leads.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What are the three main brand positioning tiers for staircase companies?",
  "Budget — affordable, practical, functional stairs, competing on price and turnaround. Mid-market — quality custom stairs, better materials, competing on service and design. Luxury — architectural statement pieces, premium materials and detailing, competing on brand and result. A company trying to serve all three tiers usually fails at all three — pick a tier and own it.",
  { cls: "expert_observation", level: 3 },
);
add(
  "Why does a warranty document signal professionalism on a premium staircase sale?",
  "It shows the company has thought about post-installation, is prepared to stand behind the work, and has a business capable of honouring a 5- or 10-year commitment. Cheap operators either offer no warranty or offer verbal warranties they will not honour. Written warranty with clear scope is a decision-swinger on premium purchases.",
  { cls: "professional_recommendation", level: 2 },
);

// ============================================================
// CUSTOMER PSYCHOLOGY & SALES (12)
// ============================================================
add(
  "Why do customers actually replace their staircase?",
  "Four common motivations: old appearance (dark wood, carpet, dated spindles they now hate), broader home improvement (modernising a hallway or opening up light), damage or safety (loose parts, squeaking, worn treads), and increasing house value (staircase visibly upgrades a property to buyers). Each motivation responds to different sales conversations — identify which one before quoting.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What emotional decision underlies most staircase purchases?",
  "Customers do not wake up wanting new stair strings — they wake up wanting their home to look amazing. The staircase is the largest single joinery object in the hallway and the first thing guests see. Sales conversations that address the emotional outcome ('a bright modern entrance that transforms your home') outperform those that describe the product ('oak treads with glass balustrade') by a wide margin.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What is the biggest fear customers have when ordering a bespoke staircase?",
  "'Will the final staircase actually look like the picture?' A bespoke stair cannot be seen before it is made — the customer is committing significant money to a promise. 3D visualisation, physical samples, previous-project photos, and dry-fit-before-final-fixing all reduce this fear. Companies that minimise the fear win the job even at higher prices.",
  { cls: "expert_observation", level: 2 },
);
add(
  "Why is 3D visualisation such a powerful sales tool for staircases?",
  "The customer sees their own hallway with the proposed stair in place — not a stock photo, not a workshop shot, their actual house. This closes the imagination gap between spec sheet and reality, reduces the biggest customer fear ('will it look like the picture?'), and lets designers iterate materials and colours before manufacture. Doubles conversion rate on premium quotes in trials.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What is the customer comparison problem with staircase quotes?",
  "Customer receives Quote A ('complete staircase package £12,000') and Quote B ('staircase only £6,500'). The prices look completely different but the scopes are also completely different — Quote B excludes finishing, installation details, preparation and decoration that Quote A includes. Customer picks B on price, then discovers £4,500 of additional work needed. Transparent line-item quoting prevents this.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What should a professional staircase quote itemise?",
  "Materials (timber, glass, fittings) as separate lines, workshop labour and machining time, installation labour and travel, finishing (spray booth, oil, lacquer), preparation and remedial work if applicable, and profit margin. Customer sees where the money goes and can compare like-with-like against competitors. Hidden totals invite disputes.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "Why do premium staircase companies send material sample boxes to customers?",
  "Customers cannot judge timber, finish or glass from a screen image — natural wood varies, lighting changes colour, and touch matters. A sample box (timber offcuts, finish samples on the actual species, glass edge examples, metal hardware pieces) lets the customer make an informed material decision in their own hallway light. Small cost, decision-changing impact.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "Why do customers value progress updates during staircase manufacture?",
  "The wait between order and installation feels long — often 6-12 weeks. Silence during the wait creates anxiety ('is anything happening?'). Photos of timber selection, workshop progress, and installation date confirmation turn the wait into a journey the customer enjoys. Cheap communication upgrade; large impact on satisfaction and referrals.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "How does the language of 'selling the future feeling' differ from selling specifications?",
  "Specification: 'Oak staircase with glass balustrade.' Future feeling: 'A bright modern entrance that transforms your home the moment you walk in.' Same product, different customer response. Specification language attracts price comparison; future-feeling language attracts value comparison. Premium companies write every proposal in future-feeling language.",
  { cls: "expert_observation", level: 3 },
);
add(
  "How should a staircase company identify the customer's style profile?",
  "Ask about the home overall: age of the property, style of the existing furniture and kitchen, the colours the customer is drawn to, the interior magazines or Instagram accounts they follow. Style categories: modern, traditional, farmhouse, luxury contemporary, minimalist. The right staircase for a Victorian family home is the wrong staircase for a converted warehouse loft — customers usually cannot articulate this themselves.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What is the common customer mistake when choosing a staircase from a photo?",
  "Choosing a staircase design that looks stunning in the photographed house — usually a very different property from theirs — without asking whether it will suit their actual home. A dramatic floating glass stair looks wrong in a low-ceilinged cottage. A heavy carved traditional stair looks wrong in a minimalist new-build. Style match is a professional judgment, not a customer preference.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What is the final rule on how customers remember a staircase purchase?",
  "People forget the price they paid — they remember how their home felt after the staircase was finished. A stair purchase is chosen with emotion ('will I love seeing this every day?') and justified with logic ('is it safe? is it well made?'). Companies that only sell on logic compete on price forever; companies that also sell on emotion command premium prices.",
  { cls: "expert_observation", level: 3 },
);

// ============================================================
// MATERIALS — NOVEL ANGLES ONLY (5)
// ============================================================
add(
  "Why is OSB board not suitable for visible staircase parts?",
  "OSB is strong for structural applications (subfloors, walls, sheathing) but reads as rough and unfinished on visible surfaces: coarse chip pattern, difficult to finish smoothly, visible edge chipping when cut, and no realistic path to a premium look. Fine for a hidden platform under a landing; wrong for anything the customer will see.",
  { cls: "industry_good_practice", level: 2 },
);
add(
  "When is marine plywood the right choice on a staircase?",
  "Where higher moisture resistance matters — external staircases exposed to weather, staircases in bathrooms or utility rooms, or in coastal properties. Made with waterproof adhesive and rot-resistant veneers. More expensive than standard plywood — over-specifying for a normal internal dry staircase is wasted money.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What is the principle for choosing staircase materials by house style?",
  "Farmhouse: oak with painted string components, or fully painted timber. Modern: American White Oak treads with painted risers and glass or black metal balustrade. Luxury contemporary: walnut or smoked oak, glass balustrade, integrated lighting. The material palette signals the style before the customer notices any specific detail — get it wrong and every subsequent decision fights the mismatch.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "Why must a staircase visually match adjacent flooring, doors and kitchen finishes?",
  "The staircase does not exist alone — it sits in a hallway that connects to rooms already decorated with a specific timber palette, floor tone and door style. A staircase in an unrelated timber species reads as bolted-on rather than designed-in. Match, complement or deliberately contrast — never just pick 'nice oak' in isolation.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What is the material-quality formula for a premium staircase?",
  "Good timber + good design + good manufacturing + good installation. Weakness in any one link degrades the whole result. Premium oak badly designed = wasted timber. Premium design badly manufactured = uneven finish. Premium manufacture badly installed = squeaks and gaps. All four must be strong; the customer sees the composite result, not the individual inputs.",
  { cls: "expert_observation", level: 3 },
);

writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added entries up to staircase-faq-${nextId - 1}. Total entries: ${arr.length}`);
