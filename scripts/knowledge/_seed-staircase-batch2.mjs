#!/usr/bin/env node
// Batch 2 staircase seed — Nex-voice rewrites drawn from:
//   (a) the "OVERLAP" tail of the 2026-07-25 paste triage (topics
//       that share a keyword with existing entries but genuinely
//       ask different questions), and
//   (b) the second 2026-07-25 paste (tmp/staircase-paste-2026-07-25-b.md)
//       covering plaster/wet-trade sequencing, child safety, timber
//       choice, manufacturing, buying overseas, Building Regs across
//       the UK, and installer relationships.
//
// All entries rewritten from spec-manual voice into Nex workshop voice:
// direct-you, contractions, em dashes, UK-specific (Approved Doc K,
// Building Control, Northern Ireland, HSE). Duplicates against
// existing question text are skipped by the dedup guard.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

const NEW = [
  // ─── Sequencing: staircase in the construction programme ───────
  { q: "Should the staircase go in before or after the walls are plastered?",
    a: "Ask your carpenter AND your staircase maker before you decide — both have good reasons and the right answer depends on your site. Carpenters often prefer to fit first so the plaster finishes neatly down to the string. Manufacturers usually prefer AFTER plastering, because fresh plaster releases a lot of moisture as it dries and timber will happily soak it up. Whichever way you go, a properly fitted wall slip (a small matching moulding down the wall side of the string) hides any small gaps at the plaster line and gives a clean finish either way.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why do staircase manufacturers usually want plastering finished BEFORE the staircase goes in?",
    a: "Moisture. Fresh plaster releases a huge amount of water as it dries — humidity in the house can spike for weeks. Your staircase is designed for normal household humidity, not for a wet-trade drying-out phase, and unnecessary moisture exposure means more timber movement, more shrinkage-related noise later, and more risk of surface staining. Once the wet trades are done, the environment's much closer to how the staircase will live for the next 50 years.",
    audience: 3, classification: "expert_observation" },

  { q: "Is the staircase one of the first or last things fitted on a build?",
    a: "It goes in once the building's weather-tight and the heaviest wet trades are done — so somewhere in the middle, not first, not last. Many homeowners have the structural staircase fitted at that point but delay the finished handrail, spindles and any painted final trims until the plasterers, decorators and floor fitters are off site. Boots, ladders, dust sheets and moving furniture cause more damage to a new staircase than anything else on a build.",
    audience: 2, classification: "industry_good_practice" },

  { q: "How do I protect my staircase from other trades during a build?",
    a: "Cover it the day it's fitted and don't uncover it until the last trade is off site. Heavy-duty floor protection over the treads (not thin cardboard — it slides and traps grit), timber sheets or plywood on the nosings, and a soft wrap on any exposed handrail. Never stick tape directly onto a finished surface — the adhesive can lift the varnish when you pull it off weeks later. Check the manufacturer's guidance on what tape's safe if you must use any.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Can I really use my new staircase as a work platform during construction?",
    a: "No — and this happens more often than it should. Trades cutting materials on treads, resting toolboxes on nosings, dragging heavy kit up and down: every one of those puts marks into the finish that'll be visible forever. Protect the staircase like the finished feature it is, not like scaffolding. A £5 role of proper stair protector saves £500 of refinishing later.",
    audience: 3, classification: "industry_good_practice" },

  { q: "What if another trade damages my new staircase — what should I do?",
    a: "Photograph it straightaway, note who was on site, and hold off on any repair until you've spoken to the staircase maker. The right fix depends on the timber, the finish and whether the damage went through to bare wood — the wrong repair now can make the eventual proper fix twice as hard. Get it logged in writing with whoever's project-managing.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why is there a small gap between the finished wall and the staircase string?",
    a: "Because plastered walls are never perfectly straight over their whole length, and no experienced fitter will force a staircase to follow a bowed wall — that's how you crack a string. Small gaps at the plaster line are normal. They're covered with a wall slip (a matching moulding along the wall edge of the string) which sits flat, hides any variation, and looks like part of the staircase.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a wall slip or cover slip?",
    a: "A thin timber moulding — usually machined from the same species as your staircase — that sits down the wall side of the string, overlapping the plaster slightly. Its job is to hide small gaps and wall irregularities and give a clean, professional line where the staircase meets the wall. On almost every install with a plastered wall, a wall slip does more for the finished look than any amount of scribing.",
    audience: 3, classification: "industry_good_practice" },

  // ─── Building Regulations, Building Control, UK regions ─────
  { q: "Does my new staircase have to comply with Building Regulations?",
    a: "Yes — any new or replacement domestic staircase in the UK has to meet Approved Doc K (or the equivalent in Wales, Scotland or Northern Ireland). That covers rise and going, pitch, headroom, handrail height, guarding height and baluster spacing (max 100 mm gap, so a 100 mm sphere can't pass through). Your builder or Building Control officer confirms it's compliant on inspection. A good staircase maker knows the numbers by heart — ask them to talk you through the design against the regs before you approve the drawing.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Are Building Regulations the same across England, Wales, Scotland and Northern Ireland?",
    a: "Similar but not identical. England and Wales use Approved Document K; Scotland has its own Technical Handbook; Northern Ireland has Technical Booklet H. The core safety numbers are close, but wording and specific limits can differ — for example, some regional differences on domestic vs common-stair standards. Always tell your staircase maker WHERE the staircase will be installed, not just where it's shipping to, so they can design to the right document.",
    audience: 3, classification: "professional_recommendation" },

  { q: "I'm in Northern Ireland — can I order a staircase from a manufacturer in the Republic of Ireland?",
    a: "Yes, plenty of homeowners do — there are good makers on both sides of the border. Ask one specific question before you order: 'Can you manufacture this to comply with Northern Ireland Building Regulations (Technical Booklet H)?' A professional maker will know instantly whether they can and will explain any design changes needed. Rise limits, going, guarding and handrail height can all differ slightly from the RoI regs, and Building Control will check.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Does a CE mark or UKCA mark mean the staircase meets Building Regulations for my house?",
    a: "No — those marks confirm certain product-level requirements are met, but they don't confirm the staircase has been designed for the specific Building Regulations that apply to your project. Compliance depends on your building, the design, the dimensions and how it'll be installed. Get the maker to confirm in writing that the design meets Approved Doc K (or your regional equivalent) BEFORE they cut timber.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can Building Control actually refuse to sign off a staircase?",
    a: "Yes — if the design doesn't meet the applicable regs, Building Control can require alterations before the work is signed off. That means new components, delays, remedial work and often significant cost. It's why confirming compliance BEFORE manufacture is so important — a five-minute check on the drawing beats a five-week rebuild.",
    audience: 3, classification: "safety_advice" },

  { q: "Can a staircase built for another country's regulations be modified to suit UK Building Regs?",
    a: "Sometimes, but rarely cheaply. Changing tread going, riser height, handrail height, guarding height or baluster spacing usually means remachining or replacement components — occasionally a full remake. It's almost always cheaper and faster to have the staircase designed to your regs from the start than to try to modify a compliant-elsewhere design later.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should I tell my staircase maker if I change my flooring after ordering?",
    a: "Yes — immediately. Swapping carpet for engineered flooring, LVT for tile, or any change in finished floor depth alters the top and bottom step heights. If the top or bottom rise ends up more than about 5 mm different from the rest, Building Control can pick it up as a trip hazard, and the maker may need to remake a component. Tell them the moment the flooring spec changes.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Child safety and family use ────────────────────────
  { q: "Is it safe for my children to sit and play on the staircase?",
    a: "Provided the staircase meets current Approved Doc K — yes, kids sitting on the steps to read, chat or watch TV is normal family life and something staircases are built for. The regs exist to make that safe: baluster gaps under 100 mm so a child's head can't get stuck, handrail heights that work for small and adult hands, guarding that resists the loads of a leaning kid. Supervision is still important, especially for toddlers.",
    audience: 1, classification: "safety_advice" },

  { q: "Why is baluster spacing on a staircase so tightly regulated?",
    a: "Because a small child's body can pass through a gap that looks tiny. Approved Doc K limits the gap so a 100 mm sphere can't fit through the balustrade or between the base rail and floor. That single rule stops the majority of serious child-fall incidents through balustrades. Removing balusters for a 'more open' look defeats it and — depending on the build — can push the staircase out of compliance.",
    audience: 3, classification: "safety_advice" },

  { q: "Can I remove some balusters to make my staircase look more open?",
    a: "Not without a full redesign. Balusters aren't just decorative — they close the gap so a small child can't pass through, and they transfer horizontal load into the handrail and string. Take them out and you may fail Building Control, void insurance in a fall incident, and reduce the strength of the balustrade. If you want a more open look, ask a staircase professional about a compliant redesign (glass panels, wider spindles at compliant centres, etc.).",
    audience: 3, classification: "safety_advice" },

  { q: "My child keeps jumping down the last few steps — is that damaging the staircase?",
    a: "One jump won't do anything. Ten years of jumping will eventually loosen wedges, wear the finish on the landing tread and can make squeaks appear where nothing was previously moving. But the bigger concern is the slip risk — teach 'hold the handrail down the last few' as the habit. The stairs will handle it either way; feet don't always.",
    audience: 1, classification: "expert_observation" },

  { q: "Can toys damage a timber staircase?",
    a: "Yes — hard plastic and metal toys are the usual culprits. Toy cars, scooters, ride-ons and dropped metal toy boxes dent hardwood nosings and scratch softwood risers. On a hardwood staircase you'll usually only see finish damage; on softer species the dent goes into the timber. A rug at the top and bottom often catches the worst of it.",
    audience: 1, classification: "expert_observation" },

  { q: "Should the family wear shoes on a polished timber staircase?",
    a: "Personal preference — but if shoes stay on, keep them clean and grit-free. Grit is the number-one destroyer of staircase finish. Slippers with a proper non-slip sole are ideal; socks alone on a polished hardwood tread are a genuine slip hazard, especially going down. Bare feet are fine.",
    audience: 1, classification: "safety_advice" },

  { q: "One of my balusters has come loose — do I need to fix it straight away?",
    a: "Yes — don't wait. The balustrade is a safety structure, and a loose baluster reduces the load a person can lean against without something giving. Don't force it back in; that can crack the handrail groove or the base rail. Check what's actually loose (baluster to handrail, baluster to base rail, base rail to string), and if you can't see the cause, get a joiner in before someone leans on it.",
    audience: 2, classification: "safety_advice" },

  { q: "Can I fit a stair gate to my new bespoke staircase without damaging it?",
    a: "Yes — but choose a pressure-fit gate for hardwood balustrades, or a screw-fit design intended for stair use if you need it more secure. Never drill through structural components (strings, newel posts) without asking your staircase maker where's safe to fix. Pressure-fit gates leave no marks; screw-fit gates need proper packers to spread load.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How do I teach my kids to respect a new staircase?",
    a: "Kids copy adults — hold the handrail yourself every trip, walk (don't run), don't sit on the outside of the handrail even if it feels sturdy, don't throw things up or down, and keep toys off the treads. Make it part of family routine before it becomes a rule to enforce, and the staircase stays in showroom condition for years longer.",
    audience: 1, classification: "industry_good_practice" },

  // ─── Timber species and grades ──────────────────────────
  { q: "Does the type of timber I choose for a staircase really make a difference?",
    a: "A big one — appearance, hardness, how it takes stain and finish, how it moves with humidity, and how it wears over 30 years. Oak stays oak-like for a lifetime; pine dents easily if it's not painted; walnut goes darker with age; ash is close to oak's hardness but a paler cream tone. There's no 'best' — only what fits your house, your family and your budget. Any decent staircase maker will show you samples before you commit.",
    audience: 2, classification: "expert_observation" },

  { q: "Is hardwood always better than softwood for a staircase?",
    a: "Not automatically — it depends on how you're finishing it. For a clear-finished natural-timber staircase, hardwood (oak, ash, walnut) wins on wear resistance and looks. For a painted staircase, quality Scandinavian pine or whitewood is often the better call — it's more stable under paint, easier to finish smoothly, and the paint takes the wear rather than the timber. Don't dismiss softwood just because it's a softwood.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why do so many people pick oak for their staircase?",
    a: "It's earned it — genuinely hard-wearing, beautiful grain that suits both traditional and modern rooms, widely available so replacement parts are easy to source years later, and it takes almost any finish (clear, stained, oiled, painted, limed). Downside is it's not the least expensive option, and the darker medullary rays don't suit every scheme. But 'you can't go wrong with oak' is true more often than not.",
    audience: 1, classification: "expert_observation" },

  { q: "Should I expect knots in my staircase timber?",
    a: "Depends on the species and the grade you paid for. Prime-grade oak is nearly knot-free; character-grade oak has visible knots and figuring on purpose because that's what people love about it. Painted-grade softwood will have knots that get stabilised with knot-block before painting. Ask your maker which grade they're quoting on — 'oak' alone doesn't tell you.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I mix different timbers in one staircase?",
    a: "Yes — some of the best-looking staircases do. Common combinations: oak treads with painted softwood risers and strings, walnut handrails on an oak balustrade, painted newels with hardwood caps. It's a great way to hit a budget while keeping the parts you touch (treads, handrails) in the premium timber. Sketch it out with your maker before you commit — some combinations age together well, others develop a mismatched look over time.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why is a hardwood staircase more expensive than a softwood one?",
    a: "Three reasons: the raw timber costs more per m³, hardwood is harder on machine cutters (they wear faster, jobs take longer), and finishing hardwood to a furniture-standard surface takes more time. That's why a well-made oak staircase costs meaningfully more than an equivalent painted-pine one — you're paying for both the material and the extra hours in the workshop.",
    audience: 2, classification: "expert_observation" },

  // ─── Manufacturing process ──────────────────────────────
  { q: "How is a timber staircase actually manufactured?",
    a: "It starts with the drawing, not the timber. The workshop reviews the architect's drawing, confirms all the site dimensions, produces a full production drawing (which you approve), selects and conditions the timber, machines each component (strings, treads, risers, handrails, spindles, newels), sands everything, sometimes dry-assembles the flight to check the fit, quality-checks and then packages for transport. Every part is machined to work with every other part — nothing's off-the-shelf.",
    audience: 2, classification: "expert_observation" },

  { q: "Why can't the whole staircase just be cut on site by the carpenter?",
    a: "Small adjustments on site are normal, but precision-machining every tread housing, riser groove and wedge slot needs proper workshop machinery — spindle moulders, tenoners, radial saws — that don't travel to site. Workshop conditions also give you a clean, dust-free environment for the sanding and finishing that no site can match. Site-cut staircases exist but they're firmly a different product to a workshop-built one.",
    audience: 3, classification: "expert_observation" },

  { q: "Why are the staircase strings so important?",
    a: "They're the spine — every tread, every riser, every wedge is anchored into them, and they carry all the load down to the floor and up to the landing trimmer. A well-machined string in good, stable timber keeps the flight rigid and square for decades. It's also where most of the workshop's precision goes — the tread housings are cut to a fine tolerance so wedges lock everything solid.",
    audience: 3, classification: "expert_observation" },

  { q: "What is timber moisture content and why does it matter for my staircase?",
    a: "It's how much water's in the wood as a percentage of the dry weight. UK indoor timber wants to sit around 8-12% for stability. If timber's machined too wet, it'll shrink after fitting — you get gaps and squeaks. Too dry, and it swells in a normal home — you get bowing and joints tightening up. A workshop that dries and conditions its timber properly before machining is producing a staircase that'll behave itself for the next 50 years.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "What does 'bespoke staircase' really mean?",
    a: "Made for your specific property — every dimension driven by your floor-to-floor height, your opening in the joists, your landing arrangement and your design brief. Nothing off a shelf. Two houses next door with identical plans will still get two subtly different bespoke staircases because construction tolerances vary. That's why the drawing-approval stage matters so much — that's the moment your specific staircase gets locked in.",
    audience: 2, classification: "expert_observation" },

  { q: "Why do staircase companies want me to formally approve the drawing before manufacture?",
    a: "Because that drawing IS the manufacture instruction. Once you sign it, the workshop cuts timber to those exact dimensions, in that exact layout, with that specific balustrade and handrail arrangement. It's your last chance — and only chance — to say 'actually can we swap the left-hand turn for a right-hand', or 'move the newel'. After sign-off, changes cost time and money. Read the drawing slowly, imagine walking the flight, and only sign when you're certain.",
    audience: 2, classification: "professional_recommendation" },

  // ─── Communication with staircase companies ─────────────
  { q: "How useful are photos when I'm asking the staircase maker for help with a problem?",
    a: "Extremely — good photos save days. Wide shot of the whole flight, close-up of the specific issue, one from underneath if you can access it, and a short video of any movement. That combination tells an experienced maker almost as much as a site visit and lets them give you accurate advice without having to travel.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why does the staircase company ask me to number things on the photos I send?",
    a: "Because a staircase has a lot of similar-looking components. If you circle the loose wedge as ①, the tread as ②, the angle block as ③, the maker knows exactly where you're pointing. Without numbering, you can end up in an email chain trying to describe 'the second one from the left, no not that one' for two days. Number the photos.",
    audience: 3, classification: "industry_good_practice" },

  { q: "I don't know the proper name for the part of the staircase I want to ask about — what do I say?",
    a: "Just describe what you see — 'the front-facing board of the step', 'the big post at the bottom', 'the rail I hold onto'. A good staircase professional will translate that into riser, newel post, handrail and tell you the proper name so you know it next time. Don't let terminology stop you asking.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Is there really no such thing as a silly question when buying a staircase?",
    a: "There genuinely isn't. Most people buy one bespoke staircase in a lifetime — you're not supposed to know all the language, the trades, the regs and the finishes. A professional staircase maker has these conversations every day and will happily explain anything. A five-minute question saves a five-week problem.",
    audience: 1, classification: "expert_observation" },

  { q: "Should I trust staircase advice I read on social media?",
    a: "Treat it as a starting point, not the answer. There's good information out there and there's also confidently-worded rubbish. Before you act on any online advice — especially anything structural, or that affects Building Regs compliance — cross-check it with your staircase maker, a qualified joiner and Approved Doc K. Where advice conflicts, that's the moment to ask why.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Does the same staircase repair method work on every staircase?",
    a: "No — and it's one of the reasons DIY repairs sometimes make things worse. Two staircases that look almost identical can be built completely differently underneath. The right repair depends on the species, the manufacturing method (wedged, glued, mechanical), the age, previous repairs and how it's fixed to the building. What fixed your neighbour's squeak may crack your string.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why do experienced staircase makers say 'fix the cause, not the symptom'?",
    a: "Because symptoms come back. Screw a squeaky tread down and yes, that one tread goes quiet — but if the actual movement's in the wedge two steps down, the noise reappears somewhere else next month. Take the time to work out WHY something's moving before you decide how to fix it, and the repair lasts. Cause-fixing takes longer up front and pays back for years.",
    audience: 3, classification: "expert_observation" },

  { q: "What info should I have ready before I call the staircase company for help?",
    a: "Order number or invoice date, install date, a couple of clear photos, any measurements they might ask for, the original drawing if you have it, when the issue first appeared and whether it's getting worse or staying the same. Ten minutes putting that together before the call gets you a much better answer than starting the conversation cold.",
    audience: 2, classification: "professional_recommendation" },

  // ─── Living with the staircase long-term ────────────────
  { q: "Does a well-made staircase actually add value to my home?",
    a: "It won't put £20k on the valuation on its own, but it's often the first feature a buyer notices walking through the front door — and first impressions matter. A tired, wobbly staircase makes the whole hallway feel neglected; a well-maintained hardwood one signals a well-cared-for house. Estate agents talk about 'kerb appeal' — a good staircase is hallway appeal.",
    audience: 1, classification: "expert_observation" },

  { q: "Should I still do preventative maintenance on my staircase if nothing feels wrong?",
    a: "Yes — every few months take five minutes. Grab each handrail and give a firm push. Push a couple of balusters near the top. Feel each newel post. Vacuum the corners for grit. Look for scratches in the finish. Nothing you find early stays a big problem; everything you ignore for two years becomes one.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Is every mark on my staircase a defect I should report?",
    a: "No — timber is a natural, living material and a used staircase picks up character. Small dents, light scratches, the walking line darkening slightly over years — that's normal ownership, not damage. The distinction is 'wear that came from being lived on' (fine) versus 'damage from a specific event' (repair). If you're not sure which category it's in, photograph it and ask.",
    audience: 1, classification: "expert_observation" },

  { q: "Can I polish my varnished staircase to make it shine more?",
    a: "Only if the polish is compatible with the existing finish. Silicone-based furniture polishes and standard waxes over a modern lacquer or polyurethane can leave residues that make a future recoat fail — the new coat won't bond. If you want more shine, the right route is usually a light sand and an additional gloss coat of the SAME finish, not a topical polish. Ask your finish manufacturer before applying anything.",
    audience: 3, classification: "professional_recommendation" },

  { q: "I'm selling the house — should I hand over the staircase paperwork to the new owner?",
    a: "Yes, and they'll appreciate it. The original drawing, the timber species, the finish product, the maker's contact details, any maintenance advice — all of it lets them look after the staircase properly and source matching components years later. It also tells them the house has been cared for, which quietly reassures a buyer.",
    audience: 2, classification: "industry_good_practice" },

  // ─── Overseas / import considerations ───────────────────
  { q: "Will I save money buying my staircase from another country?",
    a: "The headline price often looks less, but add up delivery from abroad, import duties (post-Brexit rules apply on non-UK imports), VAT, transport insurance, currency exchange, longer lead times, cost of shipping replacement parts if anything's damaged, and how you'll handle after-sales — and the number frequently ends up higher than a UK maker's quote. Sometimes it's genuinely cheaper; often it isn't. Do the full cost comparison, not the sticker one.",
    audience: 3, classification: "expert_observation" },

  { q: "What happens if my overseas-manufactured staircase arrives damaged?",
    a: "Ask this BEFORE you order — the answer changes the whole calculation. Who pays for damage in transit? How fast can they ship a replacement component to the UK? Will the replacement timber match the original (species and grade)? A UK maker can usually put a replacement newel on a van same-week; an overseas maker might mean a four-week wait and a customs form. Get the answers in writing before you commit.",
    audience: 3, classification: "professional_recommendation" }
];

// ─── Load + append with dedup ─────────────────────────────────
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];

const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const entry = {
    id: `staircase-faq-${String(nextN + added).padStart(3, "0")}`,
    kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  };
  doc.entries.push(entry);
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 2: Added ${added} new entries (${skipped} skipped as dupes). Total: ${doc.entries.length}`);
