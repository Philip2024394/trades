// Batch 18 — timber grades, career placement, marketplace/inventory,
// under-stair panelling comparison. Deduplicated against existing brain
// (timber species content is already heavily covered in prior batches, so
// this focuses on genuinely new angles).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "knowledge", "staircase.json");

const raw = JSON.parse(readFileSync(FILE, "utf8"));
const arr = Array.isArray(raw) ? raw : raw.entries || raw.faqs || Object.values(raw).find((v) => Array.isArray(v));

const baseTemplate = (id, question, answer, classification = "industry_good_practice", level = 2) => ({
  id: `staircase-faq-${id}`,
  kind: "faq",
  question,
  answer,
  category_tag: "staircase",
  audience_level: level,
  classification,
  safety_note: null,
  source_verified_at: null,
  fact_check_flag: null,
  diagram: null,
});

let nextId = 1635;
const add = (q, a, cls, lvl) => arr.push(baseTemplate(nextId++, q, a, cls, lvl));

// -------- Oak grade selection (3) --------
add(
  "What is Prime grade oak in staircase manufacture?",
  "Prime grade is the cleanest oak selection available: very few knots, straight grain, uniform colour. Chosen for luxury and high-end staircases where the timber must look calm and consistent. Most expensive grade because more of every log is rejected to hit it.",
  "expert_observation",
  3,
);
add(
  "What is Select grade oak?",
  "Select grade sits between Prime and Rustic. Some minor knots and colour variation are allowed, but the board still reads as clean. Balance between appearance and cost — the workhorse grade for mid-to-high-end staircases where a little natural character is welcome.",
  "expert_observation",
  3,
);
add(
  "What is Rustic grade oak?",
  "Rustic grade includes knots, colour variation, sap wood and character marks. Chosen deliberately for country homes, farmhouses and cottage interiors where the natural personality of the wood is part of the design. Cheaper because less of the log is rejected.",
  "expert_observation",
  3,
);

// -------- Walnut cost + engineered vs solid rationale (2) --------
add(
  "Why does walnut cost more than oak for a staircase?",
  "Walnut is grown in fewer regions, most stock is imported (often American Black Walnut), the tree is slower-growing and yields fewer clean boards per log. Combined with strong demand from the premium furniture and stair market, walnut typically runs 60-120% more expensive per cubic metre than oak.",
  "expert_observation",
  3,
);
add(
  "Why do some staircase makers use laminated timber?",
  "Large stair components — curved handrails, wide strings, deep treads — need dimensional stability that solid stock cannot always give. Lamination glues thin layers of timber with alternating grain, producing parts that hold their shape without cupping, bowing or twisting over the life of the staircase.",
  "expert_observation",
  3,
);

// -------- Selecting timber for specific components (3) --------
add(
  "How does a staircase maker select boards for handrails?",
  "Handrails are seen and touched more than any other part of the staircase. The maker looks for smooth straight grain (no wild figure that becomes a splinter hazard), no shakes or checks, and no soft areas that will dent under years of hand contact. Any board that would fail on the handrail is downgraded to a less visible use.",
  "expert_observation",
  3,
);
add(
  "How does a staircase maker select boards for treads?",
  "Treads take the most punishment on the whole staircase. Selection favours dense hard sections, correct thickness (usually 40-44mm solid, or engineered with a hardwood wear layer), and consistent colour so all treads read as one flight rather than a patchwork.",
  "expert_observation",
  3,
);
add(
  "How does a staircase maker select boards for newel posts?",
  "Newel posts are structural. A newel must resist horizontal handrail loading without splitting, so the maker rejects boards with large knots, splits along the length, or unstable grain runout. Straight vertical grain is preferred because it carries load evenly and machines cleanly for tenons and cap fixings.",
  "expert_observation",
  3,
);

// -------- Career / placement (10) --------
add(
  "Can NEX help someone find a job or placement in a staircase company?",
  "Yes — this is a core future capability of the NEX platform. The staircase industry needs bench joiners, CNC operators, designers, installers, finishers and estimators. Career Mode is designed to match people to trades, apprenticeships and workshop placements based on the skill they want to learn, their existing experience and their location.",
  "professional_recommendation",
  1,
);
add(
  "What staircase-industry roles will NEX Career Mode cover?",
  "Six starter tracks: staircase maker (bench joinery), CNC operator, staircase designer (CAD), installer, finishing technician (sanding + spraying + lacquer), and estimator/sales. Each track carries a progression ladder from beginner to workshop manager or business owner.",
  "professional_recommendation",
  1,
);
add(
  "How would NEX Career Mode ask about experience level?",
  "It asks a plain-language question rather than requesting a CV. Options run from complete beginner, some woodworking experience, qualified joiner, up to experienced staircase maker. That single answer changes which placements are shown and how the introduction to the company is written.",
  "professional_recommendation",
  1,
);
add(
  "What is a NEX Trade Profile?",
  "The staircase-industry alternative to a generic CV. It lists the trade the person wants to specialise in, current skills, what they are actively learning, availability and a short portfolio of projects. A workshop reading it sees a future staircase specialist rather than a generic job applicant.",
  "professional_recommendation",
  1,
);
add(
  "Why is a staircase-specific career platform useful?",
  "General job sites lose staircase-relevant candidates in the noise. A company hiring a staircase apprentice may advertise under 'joiner', 'bench joiner', 'architectural joinery apprentice' or 'CNC woodworking trainee'. NEX understands these terms all point to the same role and matches accordingly.",
  "expert_observation",
  2,
);
add(
  "What does a typical staircase career ladder look like?",
  "Year 1 workshop assistant (timber handling, tools, sanding, assembly). Year 2 staircase apprentice (strings, treads, risers, newels). Year 3 advanced (CNC, CAD, installation). Year 5+ senior staircase maker, designer, workshop manager or business owner. NEX Career Mode uses this ladder as its progression backbone.",
  "professional_recommendation",
  2,
);
add(
  "How could a staircase company recruit through NEX?",
  "The company creates a workshop profile listing the skills it needs, the apprenticeships it runs, placement openings and permanent jobs. NEX then matches those slots against the NEX Trade Profiles of people looking to enter the industry — filtered by location, experience and career ambition.",
  "professional_recommendation",
  2,
);
add(
  "Why is workshop placement a strategic capability for NEX?",
  "The staircase trade has an ageing workforce and a training gap. A platform that helps the next generation of makers find placements strengthens the whole industry NEX serves — more skilled workers means more workshops, more capacity, more customers served and a healthier ecosystem for the platform itself.",
  "professional_recommendation",
  3,
);
add(
  "Would NEX Career Mode work for career changers into staircases?",
  "Yes. Someone leaving another trade with hand-tool experience is a strong recruit for a staircase workshop. Career Mode's experience filter is designed to surface these people to workshops that value transferable skills, rather than filtering them out with a rigid qualification requirement.",
  "professional_recommendation",
  2,
);
add(
  "What is the NEX mission for the staircase career track?",
  "Not just 'answer questions about stairs' — build the next generation of staircase makers. NEX is designed to be a training platform, career map and connection layer for anyone who wants to work in the industry, from first placement to workshop owner.",
  "expert_observation",
  1,
);

// -------- Staircase to stock / manufacturing model (5) --------
add(
  "Do staircase companies build finished staircases to stock?",
  "Rarely. A staircase is made-to-measure because every house varies in floor-to-floor height, opening size, wall position, pitch and landing arrangement. Building complete staircases to stock ties up cash in units that may never fit any actual customer. Companies stock components (timber, newels, spindles, handrail lengths, mouldings) instead.",
  "expert_observation",
  2,
);
add(
  "What do staircase companies actually keep in stock?",
  "Components rather than complete stairs: oak/walnut/ash/pine boards, MDF sheets, standard newel posts, spindles, handrail lengths, baserails, treads, risers, mouldings, and sometimes a small number of standard pine loft or builder-grade staircases.",
  "industry_good_practice",
  2,
);
add(
  "Can a customer walk into a workshop, pay and load a staircase into a van?",
  "Sometimes, depending on the company. Three situations where it can happen: (1) a standard pine straight staircase in stock for builders, (2) an ex-display or cancelled-order staircase being cleared, (3) rare stock overruns. Bespoke stairs cannot be walked away with — they need a survey, drawings, approval and manufacture first.",
  "expert_observation",
  1,
);
add(
  "Why don't staircase companies build 20 oak staircases and store them?",
  "Cash risk. Ten oak staircases at £8,000 each is £80,000 tied up in stock that might never fit a real house — wrong dimensions, wrong style, timber movement in storage, no matching order. Made-to-measure protects the business from that risk.",
  "expert_observation",
  2,
);
add(
  "What is a smarter alternative to physical staircase stock?",
  "A digital stock system that tracks components in real time: how many oak treads, how many newel posts, how many glass panels, and how many staircases those components could produce. NEX is designed to give workshops that live view so they can quote lead times honestly and take on the jobs their stock actually supports.",
  "professional_recommendation",
  2,
);

// -------- Marketplace: cancelled orders + hidden stock (10) --------
add(
  "Why do staircase companies have hidden stock?",
  "Every workshop accumulates leftover material and unused components: extra timber, spare stair parts, cancelled orders, wrong-size components made in error, old display stairs, showroom removals. Traditionally this is stored, discounted quietly or scrapped. Nobody outside the workshop knows it exists.",
  "expert_observation",
  2,
);
add(
  "Why do staircase orders get cancelled?",
  "Common reasons: house sale falls through, customer budget changes, the design is revised late, the project is delayed indefinitely, or the customer changes supplier. By the time the cancellation lands, the staircase may already be 50-95% manufactured.",
  "expert_observation",
  2,
);
add(
  "What happens to a partially manufactured cancelled staircase?",
  "Without a marketplace, it sits in the workshop until the maker either scraps it, adapts it for a similar future job, or sells it locally at a heavy discount. Value that was fully paid for in labour and material walks out of the business.",
  "expert_observation",
  2,
);
add(
  "How could NEX help sell cancelled staircase orders?",
  "The workshop uploads photos of the completed staircase and its components with material, dimensions, style, location and asking price. NEX matches it against builders, developers, renovators and self-build customers actively searching for a staircase in that spec. A £12,000 cancelled staircase becomes a £7,500 sale rather than scrap.",
  "professional_recommendation",
  2,
);
add(
  "Who would buy a ready-made staircase from a marketplace?",
  "Builders needing quick supply, property developers doing multiple units, renovators on tight schedules, and self-build customers looking to save on a bespoke price. All four segments prioritise availability and price over a fully custom design.",
  "expert_observation",
  2,
);
add(
  "Why is a staircase marketplace different from a general marketplace?",
  "A general marketplace treats a staircase like any other product. NEX understands stair geometry — a customer buying replacement oak treads needs the right thickness, string width and Doc K compliance. NEX checks compatibility before purchase so buyers do not end up with parts that will not fit their staircase.",
  "expert_observation",
  2,
);
add(
  "What would a NEX staircase component listing look like?",
  "Structured record: product ID (e.g. OAK-TR-452), material (American White Oak), size (900 × 300 × 40mm), grade (Prime), quantity available (12), workshop location. Standardised fields mean a buyer can filter accurately across hundreds of listings from different sellers.",
  "industry_good_practice",
  2,
);
add(
  "Could staircase workshop offcuts be sold through NEX?",
  "Yes. Premium timber offcuts still have value — small oak or walnut pieces suit shelves, samples, decorative panels, repair pieces and craft resale. A NEX workshop-clearance listing turns waste into revenue and reduces the amount of quality timber sent to skip.",
  "professional_recommendation",
  2,
);
add(
  "What is a NEX Workshop Clearance listing?",
  "A dedicated marketplace category for old stock, slow-moving items and excess materials that a workshop wants to move quickly at a trade-clearance price. Distinct from cancelled-order listings, which are near-complete staircases with a specific target buyer.",
  "professional_recommendation",
  2,
);
add(
  "How would a builder use NEX marketplace saved searches?",
  "The builder saves alerts like 'oak staircase under £8,000', 'ready within 14 days', 'within 50 miles'. NEX notifies them the moment a listing matches. No more phoning around workshops on the off-chance something is available.",
  "professional_recommendation",
  2,
);

// -------- Marketplace: developers + logistics + trust + revenue (10) --------
add(
  "How would a large developer use NEX for staircase supply?",
  "Developers running multiple units need reliable staircase supply at predictable pricing. A NEX developer account matches them with manufacturers who have the capacity, the material stock and the delivery reach to fulfil the schedule — rather than negotiating each site separately with local workshops.",
  "professional_recommendation",
  2,
);
add(
  "Can a staircase be collected from the workshop by the buyer?",
  "Yes if the size is suitable, the packaging is protective enough for finished surfaces, and the transport is right. A short straight staircase can fit a Luton van. Longer or wider flights (winders, curved sections, glass balustrades) usually need a flatbed or trailer, not a van.",
  "safety_advice",
  1,
);
add(
  "Why is staircase transport more difficult than most joinery?",
  "A staircase is long, heavy and often has fragile finishes — lacquered treads scratch easily and glass panels crack under point loads. Straps must not press directly on finished faces. Transport needs corner protection, blankets and a route plan that avoids sharp turns and long tail-lift lifts.",
  "safety_advice",
  2,
);
add(
  "How could NEX match sellers and buyers with transport?",
  "When a listing sells, NEX suggests transport companies that cover both the workshop and delivery postcodes, quotes an approximate cost, and offers optional installation partners at the destination. The buyer sees a total delivered price rather than a bare workshop price plus unknown logistics.",
  "professional_recommendation",
  2,
);
add(
  "Why does installation belong in the NEX marketplace flow?",
  "Selling the staircase is only half the journey. A homeowner buying a cancelled-order staircase still needs a survey to check fit, delivery, installation and aftercare. NEX brings vetted installers into the same transaction so the buyer is never abandoned after clicking Buy.",
  "professional_recommendation",
  2,
);
add(
  "What skills would a NEX-registered staircase installer list?",
  "Specialist skills matter: oak staircases, glass staircases, floating stairs, traditional housed-string stairs, curved flights, spiral kits, external stairs. Filtering by skill means the buyer gets an installer who has fitted their type of staircase before, not a general joiner learning on their job.",
  "professional_recommendation",
  2,
);
add(
  "What is a staircase digital passport?",
  "A permanent record attached to every NEX-registered staircase: who built it, timber species, date manufactured, finish applied, installer name, warranty terms. Survives changes of homeowner, insurance claims and future renovation — the staircase's own history document.",
  "professional_recommendation",
  2,
);
add(
  "How would NEX build trust in a staircase marketplace?",
  "Every seller carries a verified business badge, published reviews from past buyers, photos of previous projects, and any relevant certifications (trade association membership, insurance cover, apprenticeship registration). Trust is designed in at listing level rather than left to buyer risk.",
  "professional_recommendation",
  2,
);
add(
  "What are the possible revenue streams from a NEX staircase marketplace?",
  "Supplier subscriptions, per-transaction marketplace fees, premium company profiles with better placement, paid training courses for aspiring makers, and software subscriptions for workshops using NEX as a stock and job management system. Multiple lines rather than a single commission model.",
  "expert_observation",
  3,
);
add(
  "Could NEX marketplace connect spare workshop capacity?",
  "Yes. A workshop with idle CNC time can list capacity; another workshop needing parts machined can hire it. This turns underused equipment into revenue and helps smaller workshops offer services (CNC-machined strings, laser-cut brackets) they could not justify buying the kit for.",
  "professional_recommendation",
  2,
);

// -------- Northern Ireland / international / long-term vision (5) --------
add(
  "Why does staircase terminology change between UK and USA?",
  "Different naming conventions evolved separately. UK: string, spindle, newel. USA: stringer, baluster, newel post. A knowledge platform serving both markets — like NEX — needs country packs so a US customer searching 'stringer' finds the right UK content, and vice versa.",
  "expert_observation",
  2,
);
add(
  "How does NEX handle cross-country staircase terminology?",
  "The knowledge layer stores the concept once and maps regional terms to it. 'Baluster' (US) and 'spindle' (UK) resolve to the same entry. This lets NEX serve international users without duplicating content for every regional vocabulary.",
  "expert_observation",
  2,
);
add(
  "What is the hidden economy inside the staircase industry?",
  "Value that exists but is invisible today: unused component stock, cancelled staircases, spare timber, workshop capacity, skills, offcuts, ex-display models. A connected platform surfaces this hidden value and turns it into revenue for the industry.",
  "expert_observation",
  3,
);
add(
  "What does the network effect look like in a staircase platform?",
  "More workshops joining creates more stock available, more knowledge shared, more buyers attracted, more installers registered — which in turn attracts more workshops. Once the flywheel spins, joining becomes the default and staying outside becomes the exception.",
  "expert_observation",
  3,
);
add(
  "What is the long-term NEX vision for the staircase industry?",
  "One connected system covering design, quotation, manufacturing, marketplace, installation, warranty and career development. Not a single tool — the operating system for the industry, letting a customer go from 'I want a new staircase' to a finished install with the right design, maker, price, installer and warranty all in one flow.",
  "expert_observation",
  3,
);

// -------- Under-stair panelling options — structured comparison (12) --------
add(
  "What are the six main ways to finish the underside or back of a staircase?",
  "Tongue-and-groove boarding, MDF panelling, plasterboard (drywall), timber veneer panels, solid timber panelling, and glass side panels. Plywood and metal panels are two additional less common options. Choice is driven by house style, budget and whether the staircase itself is a design feature.",
  "industry_good_practice",
  2,
);
add(
  "What are MDF panels used for on a staircase?",
  "MDF (typically 6mm, 9mm or 12mm) is installed over a timber frame to close in staircase sides and backs. It takes a very smooth paint finish, is dimensionally stable, cheap and easy to cut — but must be properly sealed at edges because moisture damage is severe if raw MDF gets wet.",
  "industry_good_practice",
  2,
);
add(
  "Why is plasterboard the most common modern staircase finish?",
  "Cheapest option, matches surrounding house walls exactly once painted, gives a clean modern look and every builder already knows how to install it. The trade-off is a less premium feel than timber, cracks if the staircase moves, and it is harder to repair invisibly than a timber panel.",
  "industry_good_practice",
  2,
);
add(
  "What are timber veneer panels?",
  "MDF or plywood core with a real timber veneer face — oak, walnut, ash. Gives the luxury appearance of solid timber panelling with better stability and larger available panel sizes. The mid-premium choice: cheaper than solid timber, much more upmarket than painted MDF.",
  "industry_good_practice",
  2,
);
add(
  "What are the trade-offs of solid timber staircase panelling?",
  "Highest luxury feel, matches the timber of the staircase itself, and lasts decades. Expensive per square metre, and the maker must design in movement joints — a wide solid oak panel will expand and contract with seasonal humidity and will crack any rigid frame that ignores it.",
  "expert_observation",
  3,
);
add(
  "When are glass side panels used on a staircase?",
  "Modern luxury designs where the goal is light and openness. Glass balustrades or full glass staircase enclosures make a small hallway feel bigger and let daylight travel deeper into the house. Cost is higher than timber panelling, and toughened or laminated glass is mandatory for safety.",
  "safety_advice",
  2,
);
add(
  "When are metal panels used on staircase finishes?",
  "Less common but growing in industrial-style modern homes: black steel sheets, perforated metal, laser-cut decorative patterns. Best paired with concrete floors, exposed brick or matte black joinery. Not a good choice in traditional or period interiors.",
  "expert_observation",
  2,
);
add(
  "What is the best under-stair finish for a traditional farmhouse?",
  "Oak tongue-and-groove boarding, or painted MDF panels with traditional timber mouldings. Both give the layered, hand-built look that suits farmhouse and cottage interiors. Plasterboard alone reads too new for the style.",
  "professional_recommendation",
  2,
);
add(
  "What is the best under-stair finish for a modern concrete-style house?",
  "Smooth plasterboard for the main panels, oak slat panels where warmth is wanted, and black metal details on handrails or stringers. Clean lines and hard-edged materials match the architectural language.",
  "professional_recommendation",
  2,
);
add(
  "What is the best under-stair finish for a luxury oak-and-glass staircase?",
  "Oak veneer panels or solid oak feature walls that continue the timber species onto the surrounding surfaces, with glass balustrade continuing the visual openness. The whole staircase area reads as one designed volume rather than a staircase bolted into a plasterboard wall.",
  "professional_recommendation",
  2,
);
add(
  "What is the best under-stair finish for a budget builder staircase?",
  "Plasterboard for the closed sides and MDF panels for any decorative front. Both are cheap, easy for a builder to install and finish, and give a clean paintable surface that meets the standard developer specification.",
  "industry_good_practice",
  2,
);
add(
  "Who typically finishes the underside and back of a staircase?",
  "Depends on the supply model. A staircase manufacturer usually supplies the stairs only, and the site builder finishes the surrounding plasterboard, skirting and decoration. A premium staircase company may supply a complete package: stairs, panels, lighting, storage and finishing all installed together.",
  "industry_good_practice",
  2,
);

writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added entries up to staircase-faq-${nextId - 1}. Total entries: ${arr.length}`);
