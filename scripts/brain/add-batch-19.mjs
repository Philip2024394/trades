// Batch 19 — under-stair space design intelligence.
// 24 reference images from Philip attached across hero entries so future
// NEX image-suggestion features can surface them by concept.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "knowledge", "staircase.json");

const raw = JSON.parse(readFileSync(FILE, "utf8"));
const arr = Array.isArray(raw) ? raw : raw.entries || raw.faqs || Object.values(raw).find((v) => Array.isArray(v));

const IMG = {
  wineCellar1:  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsdsdsdasdsds.png",
  wineCellar2:  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsdsdsdasd.png",
  wineRack:     "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsdsdsda.png",
  bar:          "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsdsd.png",
  seating:      "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsd.png",
  reading:      "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvv.png",
  bookshelf:    "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_39_43%20PM.png?updatedAt=1785051602833",
  hiddenDoor:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_36_23%20PM.png?updatedAt=1785051404858",
  office:       "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_29_26%20PM.png?updatedAt=1785050984174",
  microOffice:  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_24_32%20PM.png?updatedAt=1785050692929",
  playhouse:    "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_18_51%20PM.png?updatedAt=1785050347978",
  petArea:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_15_03%20PM.png?updatedAt=1785050120694",
  cloakroom:    "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_11_51%20PM.png?updatedAt=1785049930771",
  pantry:       "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_04_59%20PM.png?updatedAt=1785049517175",
  cleaningCbd:  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_01_58%20PM.png?updatedAt=1785049338244",
  pullDrawer:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_58_46%20PM.png?updatedAt=1785049147624",
  slatWall:     "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_54_31%20PM.png?updatedAt=1785048891364",
  featureWall:  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_49_17%20PM.png?updatedAt=1785048575711",
  plantWall:    "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_46_17%20PM.png?updatedAt=1785048406553",
  tvWall:       "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_37_39%20PM.png?updatedAt=1785047877302",
  openArch:     "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_34_36%20PM.png?updatedAt=1785047695789",
  floatingOpen: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_28_25%20PM.png?updatedAt=1785047324985",
  glassEnc:     "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_06_01%20PM.png?updatedAt=1785045986870",
};

const diagram = (url, title, alt, caption) => ({
  url,
  alt,
  title,
  caption,
  labels: null,
});

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

let nextId = 1695;
const add = (q, a, opts) => arr.push(baseTemplate(nextId++, q, a, opts));

// ---------- Three philosophies (3) ----------
add(
  "What are the three main philosophies for using the space under a staircase?",
  "Hidden storage (keep the house tidy — cupboards, drawers, cloakroom). Living space (create another usable area — seating, office, reading nook, playhouse). Open architectural space (leave it empty so the room feels bigger, lighter and more expensive). The correct choice depends on house size, staircase style and how the customer actually lives.",
  { cls: "professional_recommendation" },
);
add(
  "When is 'leave the space empty' the right under-stair choice?",
  "In luxury homes and modern architecture where less-but-better is the design language. An open floating staircase over empty floor gives light flow, visual calm and reads more expensively than the same staircase closed in with cupboards. Cramming storage into a design that was meant to breathe destroys the effect the customer paid for.",
  { cls: "expert_observation", level: 3, diagram: diagram(IMG.openArch, "Open architectural under-stair space", "Empty under-stair space beneath a floating staircase", "Concept render: open architectural volume with no under-stair storage") },
);
add(
  "Why do luxury homes often leave the under-stair space open?",
  "Luxury design follows the principle of 'less but better'. Air, light and negative space signal quality more than every cubic metre being filled. A cluttered under-stair area on an otherwise premium staircase downgrades the whole hallway to functional builder-standard.",
  { cls: "expert_observation", level: 3, diagram: diagram(IMG.floatingOpen, "Floating staircase over open space", "Floating stair treads with completely empty under-stair area", "Concept render: floating stair with intentionally empty under-stair volume") },
);

// ---------- Wine (5) ----------
add(
  "Why is an under-stair wine cellar so popular in modern homes?",
  "The space is compact, cool, out of direct sunlight and adjacent to open-plan kitchen and dining — the exact conditions a wine cellar needs. It turns dead volume into a design feature that guests notice the moment they walk in. Common in luxury homes, open-plan kitchens and entertaining spaces.",
  { cls: "professional_recommendation", diagram: diagram(IMG.wineCellar1, "Under-stair wine cellar concept", "Glass-fronted under-stair wine cellar with backlit bottle display", "Concept render: full wine cellar built into the under-stair volume") },
);
add(
  "What features make a serious under-stair wine cellar work?",
  "Glass doors so the cellar becomes visual, LED display lighting on the bottle faces, timber shelving matched to the staircase species (oak for oak stairs, walnut for walnut stairs), and climate control if bottles will be stored long-term. The four together turn storage into a room feature.",
  { cls: "professional_recommendation", diagram: diagram(IMG.wineCellar2, "Detailed wine cellar features", "Wine cellar with glass door, LED bottle lighting, timber shelving", "Concept render: full-feature under-stair wine cellar") },
);
add(
  "What are the material choices for an under-stair wine rack?",
  "Oak or walnut for a timber-matched luxury look, black powder-coated steel for a modern industrial edge, or a glass-enclosed combination of both. Matching the rack material to the staircase species creates a designer read rather than a bolted-on afterthought.",
  { cls: "professional_recommendation", diagram: diagram(IMG.wineRack, "Under-stair wine rack", "Timber and metal under-stair wine rack", "Concept render: staircase-matched wine rack") },
);
add(
  "Can the under-stair area become a bar rather than a wine cellar?",
  "Yes — very popular in modern entertaining homes. Includes a wine fridge, glass storage, mixer shelving and a small countertop. Requires the same power and plumbing planning as a small kitchen appliance run, so it needs to be designed in before the staircase is installed, not retrofitted.",
  { cls: "professional_recommendation", diagram: diagram(IMG.bar, "Under-stair bar concept", "Under-stair bar with wine fridge, glassware and counter", "Concept render: bar built into the under-stair volume") },
);
add(
  "What should a customer choose between a wine display and a practical cupboard?",
  "It depends on their honest lifestyle. Wine display is luxury and marketing-friendly but only makes sense if the household actually drinks and shows wine. A vacuum-and-coat cupboard is unglamorous but genuinely used every day. NEX asks the priority question before recommending, rather than defaulting to the photogenic answer.",
  { cls: "professional_recommendation" },
);

// ---------- Seating cluster (5) ----------
add(
  "What are the seating options that work under a staircase?",
  "Hallway bench (shoe changing + coat storage below), reading corner (bookshelves + warm lighting + charge points), window seat if a window is present, cushioned lounge in wide staircases, and built-in sofa for open-plan spaces. The staircase itself becomes furniture rather than a barrier.",
  { cls: "professional_recommendation", diagram: diagram(IMG.seating, "Under-stair seating concept", "Built-in bench under staircase with cushions and storage", "Concept render: staircase becomes furniture with integrated seating") },
);
add(
  "What does a well-designed under-stair hallway bench include?",
  "Timber seat matched to the staircase, cushions for comfort, shoe drawers built into the base, hooks or a small shelf mounted above, and often a mirror on the side wall. It replaces the pile of shoes at the front door with a proper entry ritual.",
  { cls: "professional_recommendation" },
);
add(
  "What makes an under-stair reading nook work?",
  "Comfortable enclosed seat (the sloped ceiling actually helps — enclosure feels safe), bookshelves within reach, warm 2700-3000K lighting rather than cold overheads, and USB or mains charging so tablets and readers can sit there for hours. Popular family space in homes with older children.",
  { cls: "professional_recommendation", diagram: diagram(IMG.reading, "Under-stair reading nook", "Cosy reading corner under stairs with books and warm lamp", "Concept render: family reading nook") },
);
add(
  "Why is a low-ceiling under-stair space actually good for a children's reading area?",
  "The low ceiling and enclosed shape create a den feeling that children love — a small personal space they feel ownership of, not a corner of a bigger adult room. Add bookshelves, soft seating and gentle lighting and it becomes a favourite family spot.",
  { cls: "expert_observation" },
);
add(
  "What are the design considerations for a built-in staircase sofa?",
  "Seat height around 430-450mm from finished floor, cushion depth 550-600mm for actual comfort (not a token perch), integrated lighting so people can read without a floor lamp, and storage in the base — nothing wastes deep dead space faster than a solid-block sofa. Bespoke joinery, not off-the-shelf furniture.",
  { cls: "professional_recommendation", level: 3 },
);

// ---------- Bookshelves + display (3) ----------
add(
  "Why do bookshelves work particularly well alongside a staircase?",
  "The staircase naturally creates stepped heights, so shelving that follows the underside line produces interesting display shapes that a flat wall never generates. The different shelf heights suit different-height books and objects, and the stair becomes a room-defining feature rather than a partition.",
  { cls: "expert_observation", diagram: diagram(IMG.bookshelf, "Under-stair bookshelf concept", "Full bookshelf wall integrated into staircase side and underside", "Concept render: bookshelf wall following the stair line") },
);
add(
  "What are the display options for the side wall of a staircase?",
  "Floating shelves, built-in cabinets, full-height bookcases, or a mixed cabinet-plus-shelf system. Used for books, art, collectibles, family photos and small plants. The side wall of a staircase is one of the most seen walls in the house — treating it as blank paint is a wasted opportunity.",
  { cls: "professional_recommendation" },
);
add(
  "What is a hidden-door under-stair storage design?",
  "Storage doors that match the wall panelling, timber slats or paint finish so precisely that the storage itself disappears into the surface. Press-open catches remove the need for visible handles. The minimalist choice for modern homes where clutter is enemy number one.",
  { cls: "professional_recommendation", diagram: diagram(IMG.hiddenDoor, "Hidden-door under-stair storage", "Flush wall panelling with hidden storage doors", "Concept render: press-open storage disguised as wall panelling") },
);

// ---------- Office (3) ----------
add(
  "Can an under-stair area become a genuine home office?",
  "Yes — one of the fastest-growing under-stair uses since 2020. Needs a desk sized to the depth of the space, mains power sockets planned into the build, task lighting (overheads under a staircase throw shadows), internet access (hardwired if possible) and ventilation because the enclosed space can get warm with a laptop running.",
  { cls: "professional_recommendation", diagram: diagram(IMG.office, "Under-stair home office", "Full home office built into under-stair volume", "Concept render: proper home office under stairs") },
);
add(
  "What is an under-stair micro office?",
  "A compact version for smaller spaces: laptop station, one drawer, task light and power. Not designed for eight-hour days but perfect for household admin, homework or a second workstation. Popular in flats and terraced houses where there is no spare room to turn into a study.",
  { cls: "professional_recommendation", diagram: diagram(IMG.microOffice, "Under-stair micro office", "Compact laptop station built into a small under-stair area", "Concept render: micro office for household admin") },
);
add(
  "What are the mistakes people make with under-stair offices?",
  "Forgetting sockets so extension leads snake across the floor, choosing a cold overhead light that puts the user in shadow, sitting sideways because the desk was undersized for the depth, and no ventilation so the laptop overheats. All fixable at the design stage — very expensive to fix after the staircase is closed in.",
  { cls: "expert_observation", level: 3 },
);

// ---------- Kids + pets (3) ----------
add(
  "Why does an under-stair playhouse work so emotionally for children?",
  "The low sloping ceiling and enclosed shape create a den — a small private room that belongs to the child, not a corner of a room shared with adults. Add a small door, painted walls, a window shape and gentle lighting and it becomes 'a secret room', which is one of the most emotionally powerful upgrades a family can commission.",
  { cls: "expert_observation", diagram: diagram(IMG.playhouse, "Under-stair children's playhouse", "Small door and windows creating a children's playhouse under stairs", "Concept render: children's playhouse under the staircase") },
);
add(
  "What safety points matter in a children's under-stair playhouse?",
  "Rounded edges on all timber (no sharp corners at head height for a crouching child), non-toxic paint and finish, adequate ventilation because the space is enclosed, no exposed wiring or accessible mains sockets inside the play area, and a door that a child cannot lock themselves inside. Design safety in at the joinery stage — retrofit fixes are ugly.",
  { cls: "safety_advice" },
);
add(
  "What are the pet-friendly options for the under-stair area?",
  "Dog bed built into the space (walls of the enclosure double as a den for the pet), cat area with elevated perches, or a dedicated feeding station with wipe-down flooring and storage for food and accessories. Popular in family homes and hides the pet-clutter from the main hallway.",
  { cls: "professional_recommendation", diagram: diagram(IMG.petArea, "Under-stair pet area", "Built-in dog bed under staircase with pet storage", "Concept render: pet-friendly under-stair space") },
);

// ---------- Practical storage cluster (7) ----------
add(
  "What is a UK under-stair cloakroom?",
  "The classic UK entrance solution: coat hooks or a hanging rail, shoe storage, a bench seat for putting shoes on, sometimes a mirror. Solves the daily coat-and-shoe chaos that every family hallway suffers from. Almost every UK family home benefits from one, regardless of budget.",
  { cls: "industry_good_practice", diagram: diagram(IMG.cloakroom, "Under-stair cloakroom", "Coat rail, shoe storage and bench in under-stair volume", "Concept render: classic UK under-stair cloakroom") },
);
add(
  "Can the under-stair space become a kitchen pantry?",
  "Yes — especially valuable in open-plan homes where the kitchen has run out of dedicated storage. Full-height shelving, small-appliance storage, dry-goods pantry. Sits adjacent to the kitchen in most open-plan layouts, so cook flow is not broken by walking across the house for ingredients.",
  { cls: "professional_recommendation", diagram: diagram(IMG.pantry, "Under-stair pantry", "Pantry shelving and dry-goods storage under staircase", "Concept render: kitchen pantry under stairs") },
);
add(
  "Why is a dedicated cleaning cupboard under stairs so useful?",
  "Every UK home has a vacuum, mop, bucket, cleaning products and ironing board that live nowhere in particular. A proper full-height cupboard with internal shelving, hooks and a charging point ends the constant vacuum-in-the-hallway problem. One of the most practically valuable under-stair uses, even if not photogenic.",
  { cls: "professional_recommendation", diagram: diagram(IMG.cleaningCbd, "Under-stair cleaning cupboard", "Full-height cleaning cupboard with vacuum, mop and shelving", "Concept render: practical cleaning cupboard") },
);
add(
  "What should an under-stair cleaning cupboard include?",
  "Full-height door (not two half-height doors), internal shelves at different heights for products and cloths, a charging point at low level for cordless vacuums or robot chargers, hooks for a mop and dustpan, and pull-out storage for the ironing board so it never falls out onto the user.",
  { cls: "professional_recommendation" },
);
add(
  "Why do modern homes need a robot vacuum station?",
  "Robot vacuums need a permanent dock, mains power and accessible clearance. The under-stair area is ideal — hidden, mains-adjacent, and out of the main floor. NEX-era home design should factor a robot dock alcove into every under-stair spec by default, not treat it as a special request.",
  { cls: "professional_recommendation" },
);
add(
  "What are pull-out drawers as an under-stair storage system?",
  "Instead of hinged doors, the full width of the under-stair volume is fitted with large drawers on heavy-duty runners. Everything inside slides forward for full access — no more crouching into a dark cupboard fishing for what is at the back. Used for shoes, blankets, toys, kitchen overflow.",
  { cls: "professional_recommendation", diagram: diagram(IMG.pullDrawer, "Under-stair pull-out drawers", "Full-width pull-out drawers under staircase", "Concept render: pull-out drawer under-stair storage") },
);
add(
  "Why are pull-out drawers usually the smartest under-stair storage choice?",
  "Under-stair cupboards suffer from deep corners the user cannot reach, so half the storage volume ends up wasted. Drawers pull the whole contents forward into the room — every cubic centimetre is genuinely usable. Costs more than doors but gives back the full space the customer paid for.",
  { cls: "expert_observation", level: 3 },
);

// ---------- Feature-wall side treatments (5) ----------
add(
  "What is a slatted-timber staircase wall?",
  "Vertical timber battens (oak or walnut, typically 40-60mm wide) mounted on the staircase side wall as a decorative screen. Adds warmth, texture and rhythm to the wall without needing to fill it with objects. One of the strongest modern staircase aesthetic moves.",
  { cls: "professional_recommendation", diagram: diagram(IMG.slatWall, "Slatted timber staircase wall", "Vertical oak battens as staircase side wall", "Concept render: slatted timber wall alongside staircase") },
);
add(
  "What acoustic benefit do slatted timber walls give a staircase?",
  "Open-plan houses with hard floors bounce sound and echo along the hallway. Slatted timber panels — especially with acoustic wool backing — absorb high frequencies and take the sharp edge off the room's reverb. Design feature and functional acoustic treatment in one panel system.",
  { cls: "professional_recommendation", level: 3 },
);
add(
  "Can the staircase side become a room feature wall?",
  "Yes — instead of hiding the staircase, make its side wall the room centrepiece. Materials that work: timber slats, natural stone, exposed or veneer brick, panel mouldings, or a large-scale artwork wall. Turns the staircase from circulation into architecture.",
  { cls: "professional_recommendation", diagram: diagram(IMG.featureWall, "Staircase feature wall", "Statement material wall alongside staircase becoming the room centrepiece", "Concept render: staircase side as feature wall") },
);
add(
  "What is a staircase plant wall?",
  "A living wall or high-quality artificial-plant panel mounted on the staircase side. Adds greenery and softness to what is often the largest continuous vertical surface in an open-plan home. Real plants need irrigation and a suitable environment; premium artificial is a valid maintenance-free alternative.",
  { cls: "professional_recommendation", diagram: diagram(IMG.plantWall, "Staircase plant wall", "Living or artificial plant wall alongside staircase", "Concept render: plant wall as staircase feature") },
);
add(
  "Can a staircase side wall become a media / TV wall?",
  "Yes, particularly in open-plan homes where the staircase divides the living area. The side becomes a TV or media wall with recessed lighting, integrated cabinets and hidden cable management. The two functions — circulation and entertainment — share the same wall rather than fighting for it.",
  { cls: "professional_recommendation", diagram: diagram(IMG.tvWall, "Staircase TV / media wall", "Media wall integrated into staircase side", "Concept render: TV wall on staircase side") },
);

// ---------- Recommendation logic by house / stair style (6) ----------
add(
  "What under-stair use should NEX recommend for a small home?",
  "Prioritise density: full pull-out drawers, cloakroom or cleaning cupboard, shoe storage, or a compact micro office. Small homes rarely have the luxury of leaving space open — every under-stair cubic metre is needed.",
  { cls: "professional_recommendation" },
);
add(
  "What under-stair use should NEX recommend for a large home?",
  "Prioritise atmosphere: open architectural space, feature lighting, wine display, artwork or a plant wall. Large homes already have enough storage elsewhere — the under-stair area should elevate the room, not add more cupboards.",
  { cls: "professional_recommendation" },
);
add(
  "What under-stair options suit a traditional staircase?",
  "Painted panelled cupboards with beading, timber panelling (T&G or raised panels), and a bench seat with coat storage. Traditional interiors reward layered joinery — the staircase and its under-stair joinery read as one continuous piece of house architecture.",
  { cls: "professional_recommendation" },
);
add(
  "What under-stair options suit a modern staircase?",
  "Floating designs over open space, glass balustrades that continue the openness, or hidden-door storage with flush wall finishes. Anything that reads as a bolted-on cupboard fights the clean architectural language a modern staircase is trying to establish.",
  { cls: "professional_recommendation", diagram: diagram(IMG.glassEnc, "Modern glass staircase enclosure", "Glass-enclosed floating staircase with open under-stair", "Concept render: modern glass staircase") },
);
add(
  "What under-stair options suit a farmhouse staircase?",
  "Oak panelled cupboards or slatted oak walls, a hallway bench with coat storage above, and optionally a boot cupboard for country life. Materials should be honest and characterful — painted MDF reads too suburban for the style.",
  { cls: "professional_recommendation" },
);
add(
  "How should NEX decide what to recommend under a staircase?",
  "Ask the customer's priority first: maximum storage, luxury appearance, family space, work area, or open feeling. That single answer routes them to different design families. Never default to a single answer — the same staircase serves a young family and a retired couple very differently.",
  { cls: "professional_recommendation" },
);

// ---------- Commercial + business angles (5) ----------
add(
  "Why is under-stair design an upsell opportunity for staircase companies?",
  "Basic offer = staircase only. Premium offer = staircase plus integrated storage. Luxury offer = staircase plus complete hallway design (panels, lighting, storage, decoration). The same customer conversation moves from one product line to three. The maker already has the joinery skills — they just need the sales language.",
  { cls: "professional_recommendation", level: 3 },
);
add(
  "Why do customers pay more for a full under-stair design?",
  "They are not buying a cupboard — they are buying better daily organisation, a better-looking home and a lifestyle feature. The purchase decision moves from functional-price sensitivity to emotional-value pricing, which shifts the whole margin on the job upward.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What is the before-and-after marketing value of under-stair transformations?",
  "Photos of empty under-stair space next to the finished wine cellar, office or playhouse are some of the highest-engagement marketing content a staircase company can produce. The transformation is dramatic, easy to photograph, and shows a capability that competitors selling stairs-only cannot demonstrate.",
  { cls: "expert_observation" },
);
add(
  "How could NEX generate under-stair design ideas from a customer photo?",
  "Customer uploads a photo of their empty under-stair area. NEX identifies the stair position, available height/width/depth, house style and interior colour palette. It then generates concept renders across the three philosophies — hidden storage, living space, open architecture — plus a shortlist of specific options (wine, office, playhouse, seating, cloakroom).",
  { cls: "professional_recommendation" },
);
add(
  "What is the long-term future for staircase companies in under-stair design?",
  "Moving from 'stair manufacturer' to 'interior space designer'. The staircase becomes the anchor of a whole hallway or living-area design that includes storage, seating, lighting and decoration. The company doubles its ticket size and captures work that would otherwise go to a separate joiner or interior designer.",
  { cls: "expert_observation", level: 3 },
);

// ---------- Constraints + measurements (3) ----------
add(
  "What measurements must be captured for an under-stair design?",
  "Height at the highest and lowest points (the ceiling slopes with the stair line), maximum width, depth from the outer face to the back wall, position of any doors or access points, and any restrictions like meter cupboards, boilers or structural walls. A single set of dimensions is not enough — the sloped ceiling changes what is possible at each depth.",
  { cls: "industry_good_practice" },
);
add(
  "Why can't every staircase have under-stair storage?",
  "Structural supports may cross the space, building services (electricity meter, gas meter, boiler, waste stack) may already live there and cannot be moved cheaply, and building regulations may require the area to remain accessible or fire-separated. Design must survey the constraints before promising the customer a specific use.",
  { cls: "safety_advice", level: 3 },
);
add(
  "What is the expert design rule for under-stair space?",
  "A staircase is not the empty space around it — a staircase is the beginning of the room design. Whether that means filling the space, living in it, or celebrating it as open architecture is a design choice, not a default. The best staircase designers make that decision consciously with the customer, not by accident.",
  { cls: "expert_observation", level: 3 },
);

writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added entries up to staircase-faq-${nextId - 1}. Total entries: ${arr.length}`);
