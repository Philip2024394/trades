#!/usr/bin/env node
// Batch 12 staircase seed — fills four remaining gaps from Philip's
// 100-Q "new build design/materials/costs/trends" paste:
//   A. Pricing/budget detail (biggest gap after Batch 6)
//   B. Practical comparisons (landing vs winder, floating safety,
//      maintenance ranking, metal noise, carpet vs exposed)
//   C. Trends/longevity (will black date, what's timeless, what
//      dates fast, staircase-kitchen design connection)
//   D. Design/style practical (powder-coating, toughened vs
//      laminated glass, metal types)
//
// Deliberately skips the ~70 Qs that duplicate Batches 1-11.
// No fabricated £ figures — all pricing content is relative.
// Voice: Nex workshop-warm, direct-you, contractions, UK English.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  // ─── A. Pricing / budget detail (10) ─────────────────────
  { q: "What actually drives the price of a staircase — beyond the number of steps?",
    a: "The number of steps is one small factor; the real drivers are timber species and grade (prime oak costs meaningfully more than character oak or painted softwood), design complexity (a straight flight is much less work than a half-turn with winders and a bespoke curved handrail), balustrade choice (a plain painted-spindle balustrade is a fraction of the cost of frameless glass with point fixings), finishing quality (a proper 2-pack lacquer applied by a specialist beats a builder-standard varnish), and whether installation is included. Two staircases with identical step counts can be four or five times different in price for exactly these reasons.",
    audience: 2, classification: "expert_observation" },

  { q: "What's the single biggest factor affecting a staircase's final cost?",
    a: "Usually the balustrade. On many bespoke quotes, the balustrade (handrail, spindles or glass panels, newel posts, base rails, all the fixings) comes out at 30-50% of the total staircase cost — sometimes more than the treads, risers and strings combined. Which is why swapping a specified frameless-glass system for slim metal spindles, or vice versa, changes the total more than most people expect. Ask your maker to break out the balustrade separately in the quote so you can see the impact clearly.",
    audience: 3, classification: "expert_observation" },

  { q: "Why does a bespoke staircase cost meaningfully more than a standard one?",
    a: "You're paying for design time, drawing production, made-to-your-dimensions machining, hand-finishing details, and often a much better timber grade than a stock staircase would use. A standard staircase comes off a production line to fit a limited set of common dimensions; a bespoke one is measured, drawn, machined and finished specifically for one property. Both can be excellent — one's a Volkswagen Golf, the other's a coach-built car. Match the choice to the house and the budget.",
    audience: 2, classification: "expert_observation" },

  { q: "Are standard off-the-shelf staircases lower quality than bespoke ones?",
    a: "Not automatically — a well-built standard staircase from a reputable manufacturer is a perfectly good product that fits its intended use. Where standard falls down is when the property doesn't quite match the standard dimensions: awkward top or bottom steps, gaps against the wall, headroom that's borderline. On a straightforward new-build with textbook dimensions, standard makes sense. On anything unusual — older houses, extensions, converted spaces, non-standard floor-to-floor heights — bespoke almost always ends up looking and fitting better.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why does the balustrade choice make such a big difference to a staircase's total price?",
    a: "Because the balustrade multiplies out across every step. A traditional turned oak spindle is a few pounds; a full glass panel with point fixings can be hundreds. On a 14-step flight you might have 25+ spindles or 6-8 glass panels, and every change scales. The handrail, base rail, newel posts and fixings all add on top. Two identical staircases with only the balustrade changed can vary by thousands.",
    audience: 3, classification: "expert_observation" },

  { q: "Why is a glass-balustrade staircase usually more expensive than a timber-spindle one?",
    a: "Toughened or laminated safety glass costs significantly more per square metre than timber, needs precise pre-manufacture measurement (you can't trim toughened glass on site), requires specialist stainless-steel point fixings or channels, and takes a specialist installer to fit safely. Compared to standard turned timber spindles that a joiner can install with basic tools, everything about a glass balustrade costs more. The visual pay-off is real, but so is the price gap.",
    audience: 3, classification: "expert_observation" },

  { q: "Does a mixed metal-and-timber staircase cost more than a full timber one?",
    a: "Usually yes — meaningfully so on bespoke designs. You're paying two trades: the steel fabricator (design, welding, powder-coating, structural sign-off) AND the joiner (timber selection, machining, finishing, install). The steelwork also needs engineered drawings and precise workshop tolerances. That said, if you compare a modest mixed staircase to a high-end full-hardwood one with elaborate joinery, the two can end up similar. The 'cheaper option' isn't automatically full timber — depends heavily on the spec of each.",
    audience: 3, classification: "expert_observation" },

  { q: "Where should I spend the money on a staircase project — and where can I safely save?",
    a: "Spend on the things you can't easily change later: accurate measurement and design, solid structural quality, professional installation, and a finish rated for foot traffic. These are what the staircase depends on for 30+ years. Save (if you need to) on decorative details you could upgrade later — spindle style, newel caps, balustrade material, even the handrail can be swapped in future. Never save on structure, safety-critical components or the finish spec — those failures are expensive to unpick.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why is staircase installation cost usually quoted separately from the staircase itself?",
    a: "Because they're two different jobs by two different skill sets, and because installation difficulty varies wildly with the property. Manufacturing your staircase is a controlled workshop process — same time and cost regardless of your house. Fitting it depends on access to the property (can it get through the front door in one piece?), site conditions, floor levels, wall squareness, existing structure and how much prep the opening needs. A quote that lumps them together often hides which one's going to be the surprise cost.",
    audience: 2, classification: "expert_observation" },

  { q: "Why does fitting a new staircase in an older UK property often cost more than in a new build?",
    a: "Because old houses are rarely square and level. The installer might spend a day just scribing the strings to bowed walls, packing under the base to correct sloping floors, cutting cover slips to hide plaster variation, and adjusting for a stairwell opening that's been altered by three sets of previous work. New builds usually have plumb walls, level floors and a stair opening built to the actual staircase drawing. The staircase itself is the same cost either way — the extra sits in the fitting time.",
    audience: 3, classification: "expert_observation" },

  // ─── B. Practical comparisons (8) ────────────────────────
  { q: "Is a wooden staircase becoming outdated compared to metal-and-glass designs?",
    a: "No — timber's been the dominant UK staircase material for 400 years and isn't going anywhere. What's changing is the DESIGN language around it: modern oak staircases now have square newels instead of turned ones, slim square spindles instead of ornate turned ones, glass panels alongside the timber, and clean straight lines instead of Victorian curves. The material's timeless; the styling evolves. A well-designed contemporary oak staircase looks as current in 2026 as a Victorian one did in 1890.",
    audience: 2, classification: "expert_observation" },

  { q: "What's the practical difference between an L-shape staircase with a landing vs one with winders?",
    a: "A LANDING is a flat rectangular platform where the flight turns — comfortable to stand on, safer for a stop-and-turn, and easier when you're carrying anything (baby, laundry basket, piece of furniture). A WINDER uses wedge-shaped triangular steps to turn without a landing — saves the floor space a landing eats but the narrower inner ends of the winders can feel awkward and are trickier for kids and older users. Landing if you have the space; winder if you don't.",
    audience: 2, classification: "expert_observation" },

  { q: "Are winder staircases actually comfortable to use day-to-day?",
    a: "A well-designed one is fine; a badly-proportioned one is genuinely uncomfortable. The trick is the walking-line going — the tread depth measured about 270 mm out from the inside handrail (roughly where your foot lands). If that's a proper 220 mm+ all the way through the turn, the winder walks naturally. If the winder was drawn to fit an awkward opening rather than proper walking-line geometry, the turn feels tight and rushed. Ask your maker to show you the walking-line dimension across the winder steps before you approve the drawing.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Are floating staircases safe?",
    a: "Yes — when properly engineered, installed, and signed off. The 'floating' look is a visual illusion; there's always structural support, usually a hidden steel spine, a cantilever from a load-bearing wall, or steel plate brackets tying each tread into concealed structure. What matters is that a structural engineer's calculated the design, the treads are correctly bolted to the hidden supports, and the balustrade meets Approved Doc K. Where floating designs go wrong is DIY-scale attempts to skip the engineering — that's when treads flex or fixings pull out.",
    audience: 3, classification: "safety_advice" },

  { q: "Which staircase material combination gives the least ongoing maintenance?",
    a: "Roughly ranked from lowest to highest ongoing care: powder-coated metal (wipe down, no refinishing), painted timber with hard-wearing floor paint (occasional touch-up), 2-pack-lacquered hardwood (recoat every 10-15 years), oiled hardwood (recoat every few years to keep it looking fresh). Glass balustrades sit outside that ranking — very low maintenance structurally but frequent visual cleaning for fingerprints. There's no zero-maintenance option; there's just where you'd rather spend the time.",
    audience: 2, classification: "expert_observation" },

  { q: "Is carpet on a new-build staircase still a good option?",
    a: "Yes, and often underrated in the rush towards exposed timber. Carpet gives you comfort underfoot, meaningful noise reduction (a huge deal in a family home where someone's always going up while someone else is sleeping), better slip resistance, and it protects the timber underneath so you can go back to exposed treads decades later if you want. Downside: it's harder to keep clean than a wipeable timber tread, and it hides the staircase's architectural detail. Neither choice is 'right' — depends on the household.",
    audience: 1, classification: "expert_observation" },

  { q: "Why do painted staircases sometimes use hardwood treads with softwood everywhere else?",
    a: "Because the tread's the only part of a painted staircase that sees actual wear. Paint on softwood risers, strings and spindles is fine — those surfaces barely get touched. But paint on a softwood tread wears through within a few years of family traffic. Swapping just the treads to solid oak (either painted on top OR left natural as a warm-timber-plus-white-string contrast) gives you the durability where it matters without paying hardwood cost across the whole staircase. It's the sensible middle option many joiners suggest.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Are metal staircases noisier to use than timber ones?",
    a: "Yes — meaningfully so. Every step on a steel-only staircase transmits through the frame; every family member hears every trip. Timber absorbs and damps footfall much better. That's why almost every 'modern industrial' design pairs steel structure with SOLID TIMBER TREADS — you get the steel look without the noise. Full-metal designs with metal-grate or plate treads work in warehouses and commercial spaces but are hard to live with in a family home unless you specify acoustic treatment underfoot.",
    audience: 3, classification: "expert_observation" },

  // ─── C. Trends / longevity (5) ────────────────────────────
  { q: "Will black metal staircase details become outdated?",
    a: "Some of them will, some won't. Simple black-painted or powder-coated steel structural elements (stringers, slim balusters, Crittall-style window frames) are based on architectural fundamentals that have been in and out of fashion for a century and keep coming back — they're likely to age well. Very specific 'trendy' black-metal decorative details (chunky black filigree panels, dramatic curved black scrollwork) are more likely to feel dated in 15 years. Stick to the clean geometric versions and you're on safer long-term ground.",
    audience: 2, classification: "expert_observation" },

  { q: "What staircase designs are considered genuinely timeless?",
    a: "Simple hardwood staircases with restrained proportions age best — quality oak or walnut, plain square or lightly-turned spindles, a comfortable handrail, well-proportioned newel posts, and finishing that doesn't shout. Painted classic staircases with hardwood treads have the same lasting quality. Modern minimalist steel-and-timber designs with clean lines look likely to age well too. What dates fastest: heavily decorative, of-the-moment stylings — very specific colours, elaborate carved details, unusual shapes chosen because they were on trend that year.",
    audience: 2, classification: "expert_observation" },

  { q: "What staircase trends are most likely to date quickly?",
    a: "Anything that reads as 'chosen this year' rather than 'chosen for this house'. Very specific coloured stains, elaborate decorative carvings, bold statement colours on structural components, hyper-specific styling that only works with today's furniture. A staircase lives in your home for 30+ years; a trend often lasts 5-8. If you'd struggle to imagine the design still working when the sofa's been replaced three times, that's a signal. Restraint ages better than boldness on something you can't easily change.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Are traditional-style staircases becoming less popular in the UK?",
    a: "Less popular in modern open-plan new-builds, still very popular in period properties, cottages, farmhouses and larger traditional homes where they look correct. Traditional isn't 'old-fashioned' — a well-detailed turned-oak staircase in a Georgian townhouse or a rural cottage IS the right answer, and always will be. The mistake is putting a traditional staircase in a modern minimal interior it fights, or putting a stripped-back modern staircase in a period home whose bones want turned detail. Match to the house, not the calendar.",
    audience: 2, classification: "expert_observation" },

  { q: "Should my staircase design connect visually with my kitchen and other main rooms?",
    a: "Yes — especially in open-plan layouts where the staircase and kitchen are in sight of each other. Pick a shared design language: matching timber tone, matching metal accent (black, brass, brushed steel), similar handle/detail vocabulary. A black-metal staircase with black-handle kitchen cabinets in an oak-tone floor + oak treads reads as one considered interior; the same three items in three unrelated colours reads as three separate decisions. This is one of the highest-impact free upgrades on a whole-house design.",
    audience: 2, classification: "professional_recommendation" },

  // ─── D. Design / style practical (5) ─────────────────────
  { q: "Why are metal staircase frames usually powder-coated rather than just painted?",
    a: "Powder-coating gives a much tougher, more even, more durable finish than wet-applied paint. The metal component is cleaned, electrostatically sprayed with dry powder, then baked in a curing oven — the powder melts and bonds to the surface as a hard, uniform film. Result: no brush marks, no runs, better colour consistency, better resistance to chips and scuffs, and a finish that lasts for decades without touching up. On a staircase — where the frame gets bumped by shoes, prams and moving furniture — powder-coating pays for itself.",
    audience: 3, classification: "expert_observation" },

  { q: "Which metals are commonly used in modern UK staircase construction?",
    a: "Mild steel is the most common for structural frames — strong, straightforward to weld, takes powder-coating well, less expensive than the alternatives. Stainless steel gets used for handrails, cable-balustrade cables, point-fixings for glass, and any exposed fitting that mustn't rust. Aluminium is occasionally used for lightweight components (some frameless glass channels) — lighter than steel but softer and more expensive to specify. On most bespoke staircases you'll see mild steel doing the structural work with stainless-steel details on show.",
    audience: 3, classification: "expert_observation" },

  { q: "What's the difference between toughened glass and laminated glass on a staircase?",
    a: "TOUGHENED glass is heat-treated so if it breaks it shatters into small blunt cubes rather than dangerous shards. LAMINATED glass is two sheets bonded with a clear interlayer, so if broken the fragments stay stuck to the film rather than falling. Modern staircase balustrades often specify TOUGHENED LAMINATED — you get both properties. Straight toughened is the minimum for a staircase balustrade panel; laminated is preferred where a broken panel needs to stay in place until it's replaced (e.g. on an upper landing). Your maker should specify the exact grade.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Are slim metal spindles genuinely replacing traditional wooden ones in modern homes?",
    a: "In modern-styled homes, yes — slim square-section powder-coated steel spindles are now more commonly specified than traditional turned oak on new-build and renovation projects. They give a cleaner, lighter, more contemporary line and let more light through the balustrade. Turned wooden spindles remain the right answer for period properties, cottages, and any home where the whole design language is traditional. It's not one replacing the other so much as each finding its own territory.",
    audience: 2, classification: "expert_observation" },

  { q: "Why does natural light matter around a staircase design?",
    a: "Because a staircase is a big vertical structure that sits right in the middle of the circulation route through the house — it either helps light travel or it blocks it. Open-riser designs let light pass through the flight; glass balustrades let it pass through the sides; a stairwell window or rooflight above the staircase floods the whole space with natural light. A closed staircase against a blank wall in a narrow hallway steals light from everything around it. Plan the staircase and the natural-light source together, especially in narrow terraces where daylight is precious.",
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

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 12 (pricing + comparisons + trends + design-practical): Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
