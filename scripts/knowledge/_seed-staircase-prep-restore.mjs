#!/usr/bin/env node
// Second staircase seed — preparation, inspection, restoration
// workflow, maintenance frequency, long-term care. Appends to
// knowledge/staircase.json in Nex voice. Auto-dedupes against
// existing questions.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

const WEAR_DIAGRAM = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2012_31_19%20PM.png",
  alt:      "Staircase wear-pattern reference diagram",
  title:    "Staircase wear diagram",
  caption:  "This diagram illustrates the areas of a hardwood staircase most affected by daily wear.",
  labels:   [],
  footnote: "The tread nosing, walking-line centre and winder-turn steps are the areas that show wear fastest."
};

const SQUEAK_DIAGRAM = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2012_15_57%20PM.png",
  alt:      "Staircase construction diagram showing riser, wedge, angle block and tread",
  title:    "Staircase construction diagram",
  caption:  "This diagram identifies the main staircase components referred to in the explanation.",
  labels: [
    { n: 1, name: "Riser",        description: "The vertical board between each step." },
    { n: 2, name: "Wedge",        description: "A timber wedge fitted inside the staircase string that locks the tread and riser firmly in position." },
    { n: 3, name: "Angle Block",  description: "The triangular timber block fixed between the tread and riser. Loose in about 90% of squeaking cases." },
    { n: 4, name: "Step (Tread)", description: "The horizontal board you walk on." }
  ],
  footnote: "The diagram also shows the Staircase String — the main structural side member that supports the staircase and houses the treads, risers and wedges."
};

// Entries — set diagram: 'wear' or 'squeak' to attach; omit for no diagram
const E = [
  // ── Home preparation before sanding ────────────────────────
  { q: "How should I prepare my home before sanding a wooden staircase?",
    a: "Clear the work area of furniture, rugs, decorations and toys. Protect the flooring at top and bottom with heavy-duty sheeting. Seal doorways with plastic dust sheets to stop fine dust getting into the rest of the house — even with proper extraction, some always escapes. Good lighting matters too; you need to see remaining varnish and surface defects clearly. Vacuum the staircase thoroughly before you start so grit doesn't score the timber under the sander.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should I remove my staircase spindles before refinishing?",
    a: "Depends on the design. On some staircases removing the balusters (spindles) gives easier sanding and finishing access. But on many traditional staircases they're structural — only remove them if you're confident how they were installed. If you're not sure, ask a joiner before dismantling anything.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should I remove the handrail before sanding?",
    a: "Usually no — most staircases sand fine with the handrail in place. But if you're restoring the handrail too, sand it separately with the right abrasives and finish moulded profiles carefully by hand.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should I remove old carpet gripper rods before sanding?",
    a: "Yes — all grippers, staples, nails and old fixings need to come out before you start sanding. Leaving them in tears abrasive discs, damages sanders, scratches the timber and ruins the finish. Check every tread carefully before firing up the sander.",
    audience: 3, classification: "safety_advice",
    safety: "Old carpet grippers can slice through skin — wear gloves when removing them and dispose safely." },

  { q: "What should I do with old staple holes in staircase timber?",
    a: "Fill them with a timber filler matched to your staircase colour. Let it dry fully before sanding smooth. Skip the filler and you'll see every old staple hole as a dark speckle through the fresh finish.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should I repair damaged timber before sanding?",
    a: "Yes — always. Loose timber, splits, cracks and damaged sections need repairing before any finish goes on. Varnish protects the timber; it doesn't hide defects. Fix problems first, sand second, finish third.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Why should I inspect every staircase step individually?",
    a: "Every tread wears differently. One might be sound; the next has a loose joint, deep scratch, previous repair, water damage, nail movement, crack or even woodworm. Catching those step-by-step before refinishing saves you tearing up new varnish later.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should I label staircase parts if I remove them?",
    a: "Yes. Balusters, caps and mouldings often look identical but have tiny differences in size or fit. Label them (masking tape and a pencil works) as you remove so refitting isn't a puzzle.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can I sand over old paint on a staircase?",
    a: "You can, but remove the paint evenly. Painted areas next to bare timber look patchy under a clear finish. If the property's very old, get advice before disturbing paint — lead-based paints need specialist handling.",
    audience: 3, classification: "safety_advice",
    safety: "Paint in properties built before 1970 may contain lead — test before disturbing and follow HSE guidance for safe removal." },

  { q: "Why should I vacuum between sanding stages?",
    a: "Each grit stage kicks up dust and leaves loose particles behind. Vacuum between grits and you stop those particles scratching the timber during the next stage — and you can see the surface clearly to check your progress before moving finer.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Should I inspect the staircase from underneath before refinishing?",
    a: "If you can get to the underside, always worth it. That's where you'll see loose wedges (2), loose angle blocks (3), split timber, previous repairs and failed glue joints — most structural issues are easier to spot from below than from the top of the tread.",
    audience: 2, classification: "diagnostic_procedure", diagram: "squeak" },

  { q: "Why is patience important when restoring a staircase?",
    a: "Most finishing problems come from rushing prep. Cleaning, repairs, filling, sanding, drying, dust removal, final inspection — each stage needs its time. A carefully prepped staircase almost always produces a better finish than one done in a hurry.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should I replace damaged staircase wedges before refinishing?",
    a: "Yes — loose or damaged wedges (2) need sorting before the final finish. Refinish over a moving staircase and you get a beautiful surface that still squeaks. Fix the wedges first, then finish.",
    audience: 2, classification: "repair_procedure", diagram: "squeak" },

  { q: "Should I photograph my staircase before starting restoration?",
    a: "Yes — before-photos help enormously. Record existing wear, damage, colour, construction details, mouldings and previous repairs. Those photos also help if you need advice from a staircase specialist later, or want to compare before/after.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Can I restore my staircase one section at a time?",
    a: "You can, but refinishing the whole staircase in one go gives the most consistent look. Section-by-section restoration leaves slight differences in colour, sheen and ageing that stay visible until the finishes blend over time.",
    audience: 2, classification: "professional_recommendation" },

  // ── Expert restoration workflow ────────────────────────────
  { q: "How can I tell approximately how old my staircase is?",
    a: "Construction method's your best clue. Older staircases show hand-cut housings, timber wedges (2), traditional glue blocks, hand-finished mouldings and solid hardwood throughout. Modern ones use mechanical fixings, engineered timber and factory-applied finishes. A joiner can usually date one within a few decades from a quick look.",
    audience: 3, classification: "expert_observation", diagram: "squeak" },

  { q: "Why should I repair squeaks before refinishing a staircase?",
    a: "Because refinishing a moving staircase means you'll have to break the new varnish to fix squeaks later. Fix the structural movement first — tightened wedges (2), re-glued angle blocks (3), any loose fixings — then refinish once. Saves time and money.",
    audience: 2, classification: "repair_procedure", diagram: "squeak" },

  { q: "Can I improve my staircase while restoring it?",
    a: "Yes — restoration's a good moment to upgrade. Replacing worn handrails, tired balusters, adding new newel caps, improving stair lighting, fitting anti-slip trim on nosings — plan any changes before the refinishing stage so you're not disturbing fresh varnish afterwards.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should every staircase squeak be repaired?",
    a: "Not always. Some older timber staircases develop small seasonal noises as the wood expands and contracts through the year — that's normal. But increasing movement, loose components or steadily worsening squeaks should always be investigated properly.",
    audience: 2, classification: "diagnostic_procedure", diagram: "squeak" },

  { q: "Why is my staircase creaking during winter?",
    a: "Indoor heating in winter dries the timber slightly. As it shrinks, tiny gaps open between components and small movements produce creaks. Usually settles again when humidity returns in warmer months. If it's persistent or getting worse, worth investigating.",
    audience: 1, classification: "expert_observation" },

  { q: "Why does my staircase sound quieter in summer?",
    a: "In warmer months timber absorbs slightly more moisture from the air. That natural swelling tightens joints between components, reducing the movement that causes squeaks. Same reason winter tends to be squeakier — humidity swings.",
    audience: 1, classification: "expert_observation" },

  { q: "Can loose handrails cause staircase noises?",
    a: "Yes — most people go straight to the treads, but loose handrails, balusters or newel posts create noises too. Grab and gently push each — any movement means fixings have worked loose and need tightening. Check the whole staircase, not just the step.",
    audience: 2, classification: "diagnostic_procedure" },

  { q: "Should I inspect underneath old carpet before replacing it?",
    a: "Absolutely. Lifting old carpet often reveals loose wedges (2), water staining, damaged timber, previous repairs, woodworm and structural movement — everything the carpet was hiding. Fix what you find before fitting new floor covering.",
    audience: 2, classification: "industry_good_practice", diagram: "squeak" },

  { q: "Can old wood glue fail over time?",
    a: "Yes — traditional wood glues age and become brittle over decades, letting joints move slightly. That movement is often behind squeaks and needs addressing before refinishing. Modern PVA-based joinery adhesives last much longer.",
    audience: 3, classification: "expert_observation" },

  { q: "Why do professionals avoid shortcuts on staircase work?",
    a: "A staircase is one of the most heavily used surfaces in a home. Skipping prep, rushing sanding or using unsuitable finishes saves an hour now and costs a day (or a full re-do) later. Doing each stage properly is what makes the difference between a five-year finish and a twenty-year one.",
    audience: 2, classification: "expert_observation" },

  { q: "Should I keep spare varnish after finishing my staircase?",
    a: "Yes — a small amount kept per manufacturer's storage instructions is invaluable for touch-ups later. Label the container with product name, colour, finish and application date so you (or the next person) know exactly what to match.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Why should I keep a record of products used on my staircase?",
    a: "Future maintenance is much easier when you know what's already on there. Note the manufacturer, product name, colour or stain, batch number if available, application date and number of coats. Stick it somewhere findable — inside a cupboard under the stairs is traditional.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Can poor preparation reduce the life of an expensive varnish?",
    a: "Yes — even the best coating fails on a bad surface. Dust, grease, moisture or loose old finishes underneath and it'll peel regardless of what you paid per litre. Professional prep is one of the biggest single factors in how long a finish lasts.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Why should I avoid rushing between coats?",
    a: "Every coat needs its time to dry — and where required, cure — per the manufacturer's spec. Rush it and you get poor adhesion, trapped solvents, soft finishes, reduced durability and surface defects. Recoat times aren't suggestions; they're chemistry.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can a wooden staircase last for generations?",
    a: "Yes — a well-built hardwood staircase can stay structurally sound for decades and last generations with the right maintenance. Regular finish upkeep, timely repairs and prompt attention to problems is what keeps them going. Many properties still have their original 100+ year old staircase serving fine.",
    audience: 1, classification: "expert_observation" },

  // ── Frequency + inspection ────────────────────────────────
  { q: "How often should I inspect my wooden staircase?",
    a: "Visual inspection every 6 to 12 months is good practice. Check for loose handrails, worn varnish, loose balusters, squeaking steps, cracks, water damage, loose newel posts and any movement in the treads or risers. Small issues found early are much cheaper to fix than the same issues found late.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Should I inspect my staircase after moving into a new house?",
    a: "Yes — staircases often get little attention during a property sale. Once you're in, check for loose steps, loose handrails, missing wedges (2), cracked balusters, worn finishes and any signs of previous repairs. Early inspection means small problems get fixed before they become big ones.",
    audience: 1, classification: "industry_good_practice", diagram: "squeak" },

  { q: "Can I over-sand my staircase?",
    a: "Yes — go too far and you permanently change the staircase. Over-sanding rounds sharp edges, wears down decorative mouldings, thins tread thickness and changes the nosing profile. Take off only what you need to prepare the timber; no more.",
    audience: 3, classification: "safety_advice",
    safety: "Excessive sanding of treads can reduce structural thickness — inspect before sanding heavily and stop if unsure." },

  { q: "Why do some staircase repairs fail after only a few months?",
    a: "Because they treat the symptom, not the cause. Tightening a loose tread without finding out why it loosened often only holds for a few months. Loose wedges (2), failed glue joints, timber shrinkage, worn fixings, wider structural movement — find the root cause first, then fix it properly once.",
    audience: 2, classification: "diagnostic_procedure", diagram: "squeak" },

  { q: "What is the biggest mistake homeowners make when restoring staircases?",
    a: "Rushing the preparation. Most people focus on getting the varnish on — but the quality of the finish is really decided at inspection, repairs, sanding, cleaning, moisture control and dust removal. Professionals often spend far longer on prep than on the finish coats themselves.",
    audience: 2, classification: "expert_observation" },

  { q: "Should I use low-quality sanding discs on my staircase?",
    a: "Better not. Low-cost abrasives wear out fast and leave inconsistent scratch patterns that show through the finish. Professional-quality discs cut more consistently, last longer, produce a smoother surface and often save you money overall because you use fewer of them.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why do wooden staircases need regular maintenance?",
    a: "Every staircase wears — you're using it every day. Small maintenance jobs at the right time prevent much bigger ones later: cleaning, tightening loose components, touching up worn finishes, inspecting joints, replacing damaged wedges (2), recoating worn areas. Looking after the finish protects the timber underneath.",
    audience: 1, classification: "industry_good_practice", diagram: "squeak" },

  { q: "Why should I vacuum before every coat of varnish?",
    a: "Dust is one of the biggest causes of poor finishes. Vacuum thoroughly before every coat and wipe the surface using the method the coating manufacturer recommends. Clean surface, clean finish — it's that simple.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Why do professionals inspect the staircase in daylight?",
    a: "Natural daylight reveals defects that artificial light hides — scratches, sanding marks, uneven colour, missed patches, dust contamination, imperfections. Pro finishers inspect from several angles before each coat. Overhead lights alone will lie to you every time.",
    audience: 3, classification: "expert_observation" },

  { q: "Can high heels damage a wooden staircase?",
    a: "Yes — hard or narrow heels put very high pressure on a small area. Repeated impact can dent softer timbers and wear finishes noticeably faster. Not a reason to change footwear, just something to be aware of if you're wondering why one staircase wears fast.",
    audience: 1, classification: "expert_observation", diagram: "wear" },

  { q: "Should I use steam cleaners on my wooden staircase?",
    a: "Generally no — steam pushes heat and moisture into the timber and finish. Repeated use damages some coatings and encourages timber movement. Stick to what the finish manufacturer recommends — usually a well-wrung damp cloth and a suitable timber cleaner.",
    audience: 1, classification: "safety_advice",
    safety: "Steam cleaning wooden staircases can void warranty on some coatings and permanently damage timber joints." },

  { q: "Can I restore a staircase without changing its original character?",
    a: "Yes — that's the goal of a good restoration. Preserve original craftsmanship wherever possible, repair damaged components sensitively, protect the timber, and keep the staircase's original appearance and personality intact. Restoration isn't renovation.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why do experienced staircase makers look at wear patterns first?",
    a: "Wear patterns tell the story. An experienced staircase maker reads them like handwriting — normal household traffic, water damage, sunlight exposure, incorrect finishing, structural movement, previous poor repairs all leave distinct patterns. Understanding the pattern narrows the diagnosis before any work starts.",
    audience: 3, classification: "expert_observation", diagram: "wear" },

  // ── Care + everyday impact ────────────────────────────────
  { q: "Why should I repair scratches quickly on a staircase?",
    a: "Once the protective finish is broken, moisture and dirt reach the raw timber below. A small scratch you fix today is a big refinishing job in six months if you leave it. Touch-ups are quick; full restoration isn't.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Is every crack in staircase timber a structural problem?",
    a: "No — small surface checks are part of timber's natural ageing. But larger cracks, movement or splitting need inspecting to work out whether real repairs are due. If in doubt, get a joiner to look before you start major work.",
    audience: 2, classification: "diagnostic_procedure" },

  { q: "Why does my staircase make different noises at different times of day?",
    a: "Temperature and humidity swing through the day, and timber quietly responds. Small expansion and contraction between components produces noises you'll hear more in the morning or evening as conditions change. Usually completely normal.",
    audience: 1, classification: "expert_observation" },

  { q: "Can poor ventilation affect a staircase restoration?",
    a: "Yes — poor airflow slows drying, delays curing and lets dust or moisture affect the finish. A clean, well-ventilated space produces the most consistent result. Follow the coating manufacturer's ventilation guidance for the specific product.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can decorating work damage my staircase?",
    a: "Yes — during decorating, staircases become the route for furniture, paint tins, building materials, ladders and tools. Cover with heavy-duty protective sheeting before any decorating starts. Scratches and drops on unprotected treads are permanent.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Why should I use products specifically designed for staircases?",
    a: "A staircase is one of the hardest-working timber surfaces in any home — constant foot traffic, twisting on turns, impact, abrasion, every day. Staircase or heavy-traffic timber floor coatings are engineered for exactly that. Furniture varnish isn't. Use the right tool for the job.",
    audience: 2, classification: "professional_recommendation" }
];

// ── Load + append with dedup ──────────────────────────────────
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];
const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of E) {
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
  if (item.diagram === "wear")   entry.diagram = WEAR_DIAGRAM;
  if (item.diagram === "squeak") entry.diagram = SQUEAK_DIAGRAM;
  doc.entries.push(entry);
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Added ${added} new entries (${skipped} skipped as dupes). Total: ${doc.entries.length}`);
