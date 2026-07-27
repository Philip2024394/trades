#!/usr/bin/env node
// One-off seed: appends 72 staircase wear + refinishing + moisture +
// varnish Q&As to knowledge/staircase.json in Nex voice, attaching
// the wear diagram where the topic is visibly wear-related.
//
// Usage: node scripts/knowledge/_seed-staircase-wear-varnish.mjs

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

// Nex-voice Q&As. Set `wear: true` where the wear diagram genuinely
// helps understanding; leave falsy on procedural entries (sanding
// technique, moisture chemistry, varnish problem-diagnosis).
const E = [
  // ── Wear patterns ───────────────────────────────────────────
  { q: "My wooden staircase is worn in the same area on one or more steps — why?",
    a: "Almost always the walking line — people place their feet in nearly the same spot every trip, and after years the varnish wears through. Winders often wear faster because you naturally step out from the newel post, and your feet twist slightly on the turn. Sunlight, grit in shoes, harsh cleaners and old finishes that never bonded properly all add to it. Check whether it's dirt or actual worn timber first — a proper timber cleaner will tell you.",
    audience: 2, classification: "diagnostic_procedure", wear: true },

  { q: "Why do my staircase steps wear more on one side than the other?",
    a: "That's the walking line — people don't step down the middle, they follow the same path every time. Straight staircases usually wear towards the centre; winders wear towards the outside edge because you step out from the newel post for balance. Perfectly normal after years of use.",
    audience: 2, classification: "expert_observation", wear: true },

  { q: "Why is my staircase darker where people walk?",
    a: "Dark patches are usually dirt worked into worn varnish — as the finish thins, grit settles into the exposed grain. Before assuming the timber's stained, clean the area with a proper timber cleaner recommended for the finish. If the mark lifts, you just need refinishing, not replacement.",
    audience: 2, classification: "diagnostic_procedure", wear: true },

  { q: "Why is only one staircase step worn while the others look fine?",
    a: "One step gets more traffic than the rest — usually the bottom step where everyone starts, the top step where you change direction, or a winder step where feet naturally land in the same spot. Often only the finish has worn, not the timber underneath.",
    audience: 2, classification: "expert_observation", wear: true },

  { q: "Why are my staircase edges wearing faster than the rest of the tread?",
    a: "The front edge — the nosing — takes the most pressure every time you climb or descend. Weight lands hard on that leading edge, so it wears faster than the flat behind it. Totally normal in busy households.",
    audience: 2, classification: "expert_observation", wear: true },

  { q: "Why do winder staircases wear faster than straight ones?",
    a: "Winders funnel foot traffic into a narrower area, and your feet rotate as you take the turn. That twisting motion, thousands of times over, wears through the finish quicker than a straight run. You'll usually see the wear concentrated on the outside edge of the turn.",
    audience: 2, classification: "expert_observation", wear: true },

  { q: "Why does the finish near my handrail wear differently?",
    a: "People adjust where they walk depending on the staircase design — hugging the handrail on some, stepping wider on others (especially winders for safety). Where you walk decides where the wear goes. That's why two identical staircases in different homes wear in different patterns.",
    audience: 2, classification: "expert_observation" },

  { q: "Is it normal for old staircases to develop wear patterns?",
    a: "Yes — every staircase develops its own pattern based on how the household uses it. That's part of a well-lived home. Wear on the finish isn't a structural problem, but it's a signal the protective coat's due some maintenance.",
    audience: 1, classification: "expert_observation", wear: true },

  { q: "Can I prevent future staircase wear?",
    a: "You can slow it down: keep steps clean, remove grit and small stones regularly, avoid harsh cleaning chemicals, wipe up spills immediately, use a quality staircase-grade varnish, and re-coat before the timber gets exposed. Maintaining the finish is much easier than repairing bare worn timber.",
    audience: 2, classification: "industry_good_practice" },

  // ── Environmental & footwear causes ────────────────────────
  { q: "Does sunlight damage wooden staircases?",
    a: "Yes — direct sunlight fades timber and weakens some finishes over time. Areas that get both sun and daily traffic wear noticeably faster. Blinds, curtains or UV-protective glazing help slow it down.",
    audience: 2, classification: "expert_observation" },

  { q: "Can UV light affect staircase finishes?",
    a: "Yes — the UV in daylight gradually alters both the timber colour and the finish itself. Some modern staircase coatings include UV inhibitors to slow this, but no finish stops it completely.",
    audience: 3, classification: "expert_observation" },

  { q: "Can shoes damage staircase varnish?",
    a: "Yes — small stones and grit stuck in shoe soles act like sandpaper on every step. Thousands of journeys later, the finish is worn through in the walking line. Regular cleaning and taking outdoor shoes off downstairs makes a real difference to how long the varnish lasts.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Can pets cause staircase wear?",
    a: "Yes — dogs (and other pets that use the stairs daily) scratch through the finish with their claws over time. It's especially noticeable on polished hardwood where the same route gets used every day. Keeping claws trimmed and cleaning regularly slows it down.",
    audience: 1, classification: "expert_observation" },

  { q: "Can children damage staircase finishes?",
    a: "Daily family life adds wear — running, toys, bicycles, pushchairs, dropped objects all mark the finish. It's expected over the lifetime of a staircase and isn't damage in the failure sense, just accelerated use.",
    audience: 1, classification: "expert_observation" },

  { q: "Does dragging furniture damage staircase varnish?",
    a: "Yes — heavy furniture or building materials dragged across treads will scratch through the finish and leave permanent marks in the timber. Lift where you can, or lay down a protective cover before moving anything bulky over the staircase.",
    audience: 1, classification: "safety_advice",
    safety: "Dragging heavy items on stairs is also a slip and trap-injury hazard — get help and use proper protection." },

  { q: "Can water damage my staircase finish?",
    a: "Yes — standing water or repeated wet cleaning breaks down many finishes over time. Wipe spills up straight away, and never leave water sitting on timber steps. Use products specifically recommended for finished timber, not general household cleaners.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Can household cleaning products damage staircase varnish?",
    a: "Yes — some contain bleach, ammonia or strong solvents that gradually attack the finish. Stick to products recommended for finished timber floors or staircases. If you're unsure, check with the varnish manufacturer before using anything aggressive.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Can poor cleaning damage staircase varnish?",
    a: "Yes — strong or unsuitable cleaners break down protective finishes faster than daily traffic ever will. Follow the finish manufacturer's cleaning guidance and steer clear of harsh solvents unless you're deliberately stripping the varnish.",
    audience: 2, classification: "industry_good_practice" },

  // ── Diagnosis + repair scope ───────────────────────────────
  { q: "Can I repair just one worn staircase step?",
    a: "You can, but matching colour and sheen to the rest of the staircase is tricky. New varnish always looks lighter than aged surrounding finish. For a clean look most staircase makers refinish all treads and risers together — you get one consistent tone instead of a patchy repair.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should I replace worn staircase steps?",
    a: "Rarely necessary. If the timber's structurally sound, sanding and refinishing usually restores it perfectly. Full replacement only comes into play when there's real damage — deep splits, rot, or timber that's worn dangerously thin.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How do I know if my staircase needs refinishing?",
    a: "Look for worn patches, dull areas that don't clean up, scratches, exposed timber, dark walking lines, water marks, or thin spots in the coating. Any of those means the finish is failing and it's time to refinish before the timber itself gets damaged.",
    audience: 2, classification: "diagnostic_procedure", wear: true },

  { q: "Why does my staircase look dull even after cleaning?",
    a: "Cleaning removes dirt but can't restore worn varnish. If the finish is scratched or worn thin, the timber loses its shine and no amount of polishing brings it back. Light sanding and a fresh coat is the fix.",
    audience: 2, classification: "diagnostic_procedure" },

  { q: "Should I repair worn patches or refinish the whole staircase?",
    a: "Depends on the extent. A small isolated area can sometimes be spot-repaired. But if several steps are worn or the finish has failed across multiple areas, refinishing the whole staircase gives you consistent colour and sheen — patches always end up looking like patches.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How long should a hardwood staircase finish last?",
    a: "Depends on daily use, footwear, pets, sunlight and how it's cleaned. A well-finished hardwood staircase can go many years before it needs refinishing. Busy family homes shorten that; carefully-used ones can go decades.",
    audience: 1, classification: "expert_observation" },

  { q: "Should I repaint or re-varnish my wooden staircase?",
    a: "Depends what look you're after. Clear varnish shows the timber's natural grain and colour — the standard choice for a hardwood staircase. Paint gives a solid colour and hides imperfections, but you lose the timber character. Whichever you pick, use a product designed for staircases or heavy-traffic timber floors.",
    audience: 1, classification: "professional_recommendation" },

  // ── Sanding ────────────────────────────────────────────────
  { q: "Which sandpaper should I use for a staircase?",
    a: "Typical sequence for a full refinish: 80-grit to strip old varnish, 100-grit to smooth, 120-grit to prep for finishing, and 180–240 grit for final sanding between coats. Always follow the varnish manufacturer's recommendations too — they know their product best.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Should I sand across the wood grain?",
    a: "No — always sand with the grain. Cross-grain sanding leaves scratches that become more visible once varnish goes on, not less. Work through progressively finer grits to remove marks from the previous grade.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can I use a belt sander on my staircase?",
    a: "Generally no — belt sanders remove timber fast and cut dips and grooves in seconds if you're not experienced. Most staircase pros use a pneumatic orbital sander for flat areas and finish detail work by hand around mouldings, nosings and corners.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why does my staircase look patchy after sanding?",
    a: "You've got old finish still sitting in some areas while others are back to bare timber. Keep sanding evenly until every trace of the previous coating is gone before you start applying anything new — otherwise the new coat sits on two different surfaces and looks patchy for good.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Why does my staircase feel rough after varnishing?",
    a: "Usually dust settling on wet varnish, or raised grain from cleaning. Light sanding with a fine abrasive between coats — following the manufacturer's guidance — smooths it out before you apply the next coat.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Why does my staircase still look scratched after varnishing?",
    a: "Varnish doesn't hide scratches — it seals what's there. If scratches show through the finish, they weren't fully sanded out during prep. That's why the sanding stage matters more than the finishing stage; the varnish only reveals what you leave underneath.",
    audience: 3, classification: "diagnostic_procedure" },

  // ── Finishing choices + colour ────────────────────────────
  { q: "Can I stain my staircase a darker colour?",
    a: "Yes — most hardwood staircases can be stained before the final protective coat. Different species take colour differently though, so always test on a hidden area first. Follow the stain manufacturer's instructions or check with a staircase finisher if you want a specific colour match.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Does the colour of the timber affect the final finish?",
    a: "Yes — oak, ash, walnut, maple and pine all take the same product differently. Test the finish on a hidden area or an offcut before committing to the whole staircase, especially if you're going for a specific look.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Is every staircase suitable for a clear finish?",
    a: "Most hardwood staircases look lovely with a clear finish because it shows off the natural grain. But if there's extensive repair, mismatched timber or heavy staining, a coloured finish evens everything out and gives you a more uniform look.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should hardwood and softwood staircases use the same finish?",
    a: "Not always — different species behave differently under a coating. Some drink up finish more readily than others; some need a specific primer or sealer. Follow the coating manufacturer's guidance for the species you're actually working with.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Why are my staircase edges lighter than the centre?",
    a: "Different households wear staircases differently — some walk centre, others hug one side. Cleaning patterns and old repair work also leave slight colour differences. Not usually a problem, just a signature of how the staircase has been used.",
    audience: 2, classification: "expert_observation" },

  // ── Moisture before sealing ────────────────────────────────
  { q: "Why must my staircase be completely dry before applying varnish or lacquer?",
    a: "A finish only performs as well as the surface underneath it. Trapped moisture in the timber leads to poor adhesion, cloudy patches, blistering, peeling and cracking later — often months after the job looks fine. Wait until it's genuinely dry, always.",
    audience: 3, classification: "safety_advice",
    safety: "Sealing damp timber traps moisture that can accelerate rot inside the staircase structure." },

  { q: "What problems can occur if the timber is still damp when I varnish?",
    a: "Poor adhesion, cloudy or milky patches, blistering, bubbling, peeling, cracking as the timber continues to dry, uneven colour absorption and finish failure months later. Fixing any of those usually means sanding back and starting again.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "How long should I leave my staircase to dry after cleaning?",
    a: "Depends on what you cleaned with. Damp cloth or solvent cleaner — give it time for every trace of moisture or solvent to evaporate. Always follow the drying times on the product. The timber should feel completely dry, with no residue, before varnishing.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Why should I let the timber rest after sanding?",
    a: "Sanding exposes fresh timber and stirs up dust. A short rest lets any remaining moisture or solvent evaporate and gives dust time to settle before your final wipe-down. Cleanest possible surface for the finish.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can I apply varnish immediately after using thinners?",
    a: "No — let the thinners evaporate fully first. Applying varnish over wet solvent affects adhesion and interferes with curing. Follow the solvent manufacturer's safety guidance and make sure the room's well ventilated while it dries off.",
    audience: 3, classification: "safety_advice",
    safety: "Thinner vapours are flammable — ventilate the space and avoid ignition sources until fully evaporated." },

  { q: "Does moisture affect hardwood and softwood differently?",
    a: "Yes — different species absorb and release moisture at different rates. Oak, ash and walnut behave differently to pine. Whatever the species, the rule's the same: the surface has to be dry before any protective coating goes on.",
    audience: 3, classification: "expert_observation" },

  { q: "Why is ventilation important during finishing?",
    a: "Ventilation lets moisture and solvent vapours evaporate while the finish cures properly. It also reduces the risk of trapped vapours in the room. Just don't blast air directly across the wet finish — that pulls dust onto the surface.",
    audience: 3, classification: "safety_advice",
    safety: "Solvent-based finishes need adequate ventilation for both curing and safe air quality." },

  { q: "How can I tell if my staircase is ready for sealing?",
    a: "Timber's completely dry, all sanding dust removed, no oily marks or contaminants, cleaning solvents fully evaporated, room conditions match what the finish requires, and you've read the coating manufacturer's prep instructions. Get those right and the finish will last.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can sealing damp timber shorten the life of the finish?",
    a: "Yes — significantly. Trapped moisture causes peeling, cracking and loss of adhesion months down the line, even if the finish looked perfect on day one. Full drying before sealing is one of the biggest single things you can do to make the coating last.",
    audience: 3, classification: "expert_observation" },

  // ── Varnish problems + diagnostics ────────────────────────
  { q: "Why has my staircase varnish started lifting in small patches?",
    a: "Lifting means the finish has lost its bond with the timber. Usually: poor sanding, dust or grease left on the surface, incompatible finishes layered together, moisture trapped underneath, or a varnish that isn't designed for staircase traffic. Fresh coats over failing patches rarely stick — sand back and refinish those areas properly.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Why is my staircase finish wearing away much sooner than expected?",
    a: "Quality staircase finishes should last years. Premature wear usually means: wrong varnish for staircases, heavy household traffic, grit in footwear, pets, unsuitable cleaning products, too few coats originally, or poor prep before finishing. A pro can usually spot the cause from the wear pattern alone.",
    audience: 2, classification: "diagnostic_procedure" },

  { q: "Does every varnish provide the same level of protection?",
    a: "No — different varnishes are built for different jobs. Furniture varnish, interior wood varnish, decorative lacquer, floor finishes and commercial traffic coatings all perform differently. A staircase needs one designed for high foot traffic; anything else wears out fast.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why does my staircase finish feel soft?",
    a: "A soft finish hasn't cured properly. Could be incorrect two-pack mixing, coats applied too heavily, cold temperatures, high humidity, wrong hardener, or the staircase used before full cure. Walking on it early can permanently damage the finish before it hardens.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "What is a two-pack (2K) lacquer?",
    a: "Two-pack lacquer is the finish itself plus a hardener, mixed together just before you apply it. The hardener triggers a chemical reaction that produces a much tougher finish than most single-pack varnishes. That's why it's popular on staircases that see regular daily use.",
    audience: 3, classification: "expert_observation" },

  { q: "Why do many staircase manufacturers recommend two-pack finishes?",
    a: "Two-pack systems handle foot traffic better, resist scratches, last longer, cope with household chemicals and stay clear on hardwood. Applied properly, they keep a staircase looking sharp for years. It's why professional staircase makers usually reach for them.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can applying too many coats cause problems?",
    a: "Yes — building up too much finish can cause long drying times, poor curing, surface cracking, reduced flexibility and coats that don't bond properly to each other. Always follow the data sheet on maximum coat thickness and recoat times.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Why is my varnish cracking around the front edge of the step?",
    a: "The nosing takes the biggest hit every time you use the stairs. If the finish is too brittle or wasn't built for foot traffic, repeated impact cracks it. Once cracks appear, moisture and dirt work in behind and the failure spreads.",
    audience: 2, classification: "diagnostic_procedure", wear: true },

  { q: "Can moisture affect staircase finishes?",
    a: "Yes — wet shoes, cleaning, pets or household humidity can gradually break down a finish. Over time you may see reduced adhesion, peeling or clouding. Keeping the staircase clean and dry extends the finish's life considerably.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Why is preparation so important before varnishing?",
    a: "Preparation determines everything. Correct sanding, all dust removed, oils and contaminants cleaned off, damage repaired, manufacturer's prep instructions followed — the best varnish in the world won't perform if it's going on a bad surface.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can I apply a new varnish over the old one?",
    a: "Sometimes. If the existing finish is sound and compatible with the new coating, light sanding and a recoat can work. If the existing finish is peeling, cracking or failing anywhere, it needs to come off first. Check compatibility with the coating manufacturer if you're not sure.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why is my staircase varnish bubbling?",
    a: "Bubbles come from applying too heavily, air trapped during brushing, direct sunlight on wet varnish, high temperatures drying it too fast, moisture in the timber, or shaking the varnish instead of stirring. Once cured, sand smooth and re-coat.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Why can I see brush marks in my staircase varnish?",
    a: "Wrong brush, coat applied too thick, working after the varnish has already started to skin, or poor quality tools. Pros usually match brush and technique to the specific product to get a smooth finish — check the manufacturer's application notes.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Why has my staircase finish turned white?",
    a: "That's called blooming — moisture trapped under the finish, high humidity during application, water penetrating damaged varnish, or the wrong drying conditions. Surface-only blooming can sometimes be refinished; deeper blooming means stripping and starting again.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Why does my staircase look shiny in some places and dull in others?",
    a: "Uneven sheen almost always signals uneven wear. The busiest walking areas lose the protective coat first, going dull against the untouched glossy sections. It's usually the earliest visible sign the finish needs attention.",
    audience: 2, classification: "diagnostic_procedure", wear: true },

  { q: "Why has my staircase become sticky?",
    a: "A sticky finish hasn't fully cured or has been contaminated. Common causes: incorrect two-pack mixing, coats too thick, walked on before curing, or exposure to unsuitable cleaning chemicals. Once sticky, it usually needs stripping and redoing rather than trying to save it.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Why is my staircase becoming slippery after varnishing?",
    a: "Some varnishes cure to a very smooth surface — great to look at, potentially slippery in socks. If grip's a concern, ask your supplier or coating manufacturer about staircase-grade finishes with anti-slip properties. Most also do satin or matte options that reduce slip while keeping the timber visible.",
    audience: 2, classification: "safety_advice",
    safety: "Slippery stairs are a genuine fall hazard — specify an anti-slip finish where sock-wearing occupants use the stairs regularly." },

  // ── Application conditions ─────────────────────────────────
  { q: "Can I apply varnish during cold weather?",
    a: "Most coatings have a minimum application temperature. Below it, curing slows right down, adhesion drops and the finish looks off. Always check the product data sheet before starting work in a cold garage or unheated hallway.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can high humidity affect staircase varnishing?",
    a: "Yes — high humidity extends drying times and can cause blooming (that milky cloud in the finish). Pro finishers monitor temperature and humidity to get the best results. Rough guide: keep it moderate, ventilated and consistent while curing.",
    audience: 3, classification: "industry_good_practice" },

  // ── Care + maintenance ────────────────────────────────────
  { q: "Should I wax my varnished staircase?",
    a: "Usually no. Wax over modern varnish makes future repairs and recoating much harder — the new coat won't stick over the wax layer. Always check the varnish manufacturer's guidance before adding anything on top.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Can poor-quality varnish reduce the value of a staircase?",
    a: "It affects appearance, which affects impression. A well-finished staircase lifts a home; peeling, cracked or worn finishes make even a beautifully made staircase look neglected. Using a proper staircase-grade finish protects both the timber and the visual impact.",
    audience: 2, classification: "expert_observation" },

  // ── NEX capability ────────────────────────────────────────
  { q: "Can NEX help identify the cause of staircase wear?",
    a: "Yes — describe the wear pattern and where it's showing up, and I'll help work out the likely cause and repair options. Where a technical diagram helps understanding, it'll appear with the answer so you can match the description to your own staircase.",
    audience: 1, classification: "industry_good_practice" },

  { q: "How can NEX help with staircase restoration?",
    a: "I can walk you through diagnosing common problems, explain staircase terminology, show technical diagrams for the parts being discussed, and suggest repair or refinishing approaches based on the condition. Where the job needs a hands-on eye, I'll flag when to bring in an experienced staircase specialist.",
    audience: 1, classification: "industry_good_practice" },

  { q: "Can NEX help diagnose staircase finish problems?",
    a: "Yes — describe the defect (wear, peeling, cracking, bubbling, uneven sheen, sticky patches) and I'll explain likely causes and repair options rooted in recognised staircase construction and finishing practice. I'll also flag when a professional inspection is the right call.",
    audience: 1, classification: "industry_good_practice" }
];

// Load current file
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];

// Compute next id number
const nextN = doc.entries.reduce((acc, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
}, 0) + 1;

// De-dupe against existing questions (normalised)
const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:]/g, "").replace(/\s+/g, " ").trim();
const existingQs = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0;
let skipped = 0;
for (const item of E) {
  if (existingQs.has(norm(item.q))) { skipped += 1; continue; }
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  const entry = {
    id,
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
  if (item.wear) entry.diagram = WEAR_DIAGRAM;
  doc.entries.push(entry);
  existingQs.add(norm(item.q));
  added += 1;
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Added ${added} new entries (${skipped} skipped as dupes). Total: ${doc.entries.length}`);
