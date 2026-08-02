// Installation Brain + Concrete Staircase Brain · Philip 2026-08-02.
//
// - Creates data/nex-component-qa/installation.json (new Component brain)
// - Adds concrete-staircase family + creates data/nex-family-qa/concrete-staircase.json
// - Extends nex-universal-qa.json with concrete construction principles
// - Idempotent · verbatim answers (Rule A)

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const now = new Date().toISOString();
function norm(s) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }

function mergeInto(path, newQAs, meta = {}) {
  let doc;
  if (existsSync(path)) {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } else {
    doc = { version: 1, ...meta, qa: [] };
  }
  doc.qa = Array.isArray(doc.qa) ? doc.qa : [];
  const byQ = new Map(doc.qa.map((x, i) => [norm(x.q), i]));
  let added = 0, filled = 0;
  for (const item of newQAs) {
    const key = norm(item.q);
    if (byQ.has(key)) {
      const ex = doc.qa[byQ.get(key)];
      if (!ex.a || ex.a.trim().length === 0) { ex.a = item.a; filled++; }
    } else {
      doc.qa.push(item);
      added++;
    }
  }
  doc.updated_at = now;
  writeFileSync(path, JSON.stringify(doc, null, 2), "utf8");
  const authored = doc.qa.filter((x) => x.a && x.a.trim().length > 0).length;
  return { added, filled, total: doc.qa.length, authored };
}

// ─── INSTALLATION BRAIN ─────────────────────────────────────────────────
const INSTALLATION = [
  { q: "What is the correct staircase installation sequence?", a: "Verify site measurements → check floor levels → confirm the stair opening → position the main structure → fix the strings or supports → install treads and risers → install newels → install balusters → install handrails → final adjustment and finish. Skipping stages or reversing the order causes leaning newels, uneven rails and poor transitions." },
  { q: "Why is site measurement critical before installation?", a: "Because a staircase is manufactured from measurements taken before installation. If floor-to-floor height, opening length, opening width, finished floor thickness, wall position, landing position or headroom is wrong, the staircase cannot be correctly installed." },
  { q: "What is the finished floor level rule?", a: "The staircase connects finished floors, not just structural floors. Before flooring is added the structural level is one number; after timber, tile or carpet is added the level changes. Stair calculations must be based on the FINAL finished floor surfaces — otherwise the first riser, last riser and overall rise will be wrong." },
  { q: "Where should a newel post be fixed for maximum strength?", a: "The strongest fixing is normally into the structural part of the staircase opening — the trimmer, structural framing or engineered steel connection — rather than only into decorative flooring. Weak newel fixing includes surface-only screwing, attachment to finished flooring alone, and decorative covers hiding poor support." },
  { q: "What is a stair trimmer and why does it matter?", a: "A trimmer is part of the floor opening structure. A strong newel connection is often made by cutting the newel down over the landing edge and fixing into the trimmer. The strongest staircase connections usually connect to the building structure, not only the finished surfaces." },
  { q: "Why do staircases squeak?", a: "A squeak is usually caused by movement between components under load. Possible causes include a loose fixing, timber rubbing against timber, insufficient glue, movement between tread and riser, or timber drying. The sound comes from friction — eliminate the movement and you usually eliminate the squeak." },
  { q: "How is a squeaking staircase properly diagnosed?", a: "Diagnostic order: identify the location · check tread movement · check riser connection · check string connection · check fixing method · then repair the cause. Never just 'add more screws' — find the moving component first." },
  { q: "What is the role of glue in staircase installation?", a: "Glue reduces movement, strengthens joints and makes the staircase quieter. It is used between tread and riser, in wedges, in glue blocks, and at joints. Glue does not replace correct structural fixing — it complements it." },
  { q: "What is a wedged stair construction?", a: "Traditional stairs may use wedges that expand inside a housing joint. The tread and riser fit into grooves cut in the string, and the wedge tightens the connection from behind. This creates a strong, quiet, movement-free traditional joint that carries the tread ends invisibly." },
  { q: "Do professional installers expect a perfect building?", a: "No. Perfect buildings do not always exist. Installers manage uneven walls, floor variations, plaster thickness and timber movement. A skilled installer knows where adjustment is acceptable and adapts to the site without compromising safety." },
  { q: "What is the final installation inspection?", a: "Structure (movement · fixing) · steps (equal rises · secure treads) · balustrade (rigidity · spacing) · handrail (smooth flow · secure fixing) · finish (surface quality · joints). Every one of these must be checked before handover." },
  { q: "What is the professional diagnostic order when a customer reports a stair problem?", a: "Identify the problem → locate the area → understand the movement → inspect the connection → find the root cause → recommend a solution. The symptom is not always the fault — a loose handrail may come from a loose newel, and a loose newel may come from a weak fixing or a moved landing structure." },
  { q: "How is a loose newel post diagnosed?", a: "Possible causes include fixing failure (post not securely connected), structural movement (floor or landing has moved), timber shrinkage (post has reduced slightly since installation), or a connection method not suited to the load. Never assume the post itself is the problem — check the fixing method and the structure it's connected to first." },
  { q: "What causes handrail movement?", a: "A moving handrail can come from loose brackets, a weak newel connection, loose baluster joints or incorrect fixing. The handrail is only as strong as the complete balustrade system — the visible movement often originates elsewhere." },
  { q: "What causes a baluster to become loose?", a: "Possible causes are a loose dowel connection, incorrect glue joint, insufficient fixing depth, or movement between the tread and the baluster. The weakest point is often the connection, not the timber itself." },
  { q: "What is timber acclimatisation and why does it matter?", a: "Before installation, timber should adjust to its environment because it absorbs and releases moisture. If installed too quickly, gaps, movement, shrinkage and cracking can develop. Timber must understand the building environment before becoming part of the building." },
  { q: "How should staircase components be stored before installation?", a: "Avoid direct sunlight, damp areas, uneven support and rapid temperature changes. Correct storage means flat support, a protected environment and controlled moisture. Poor storage can create movement, twist or moisture problems that appear after installation." },
  { q: "Why does the first step often cause problems after installation?", a: "The first step is affected by the existing floor level, the flooring thickness and threshold details. A common issue is that the staircase was correct when measured, but the finished floor changed later (carpet added · underlay added · new tile). The first riser height then no longer matches the others." },
  { q: "What is expected staircase movement over time?", a: "A staircase may change slightly after installation because of building settling, timber adjustment, seasonal humidity and repeated loading. Premium installation allows for natural behaviour. Small seasonal movement is normal; growing gaps, increasing noise or unsafe railing indicate a problem to investigate." },
  { q: "What causes a gap beside a staircase string?", a: "A gap beside a string usually happens because of uneven walls, plaster thickness variation or building tolerance. The solution depends on cause — a finishing detail, an adjustment, or in serious cases a redesign of the wall interface." },
  { q: "Is 'add more screws' the correct response to a moving staircase?", a: "No. The correct response is to find WHAT is moving and WHY, then choose the repair that fixes the cause. Adding screws to hide movement leaves the root problem in place and often makes it worse." },
  { q: "What is the difference between a staircase installer and an assembler?", a: "An assembler joins parts together. An installer connects staircase engineering with the building. A craftsman understands material, structure and appearance together. Installation is the final stage of staircase engineering, not just assembly." },
  { q: "What is a load path on a staircase?", a: "A load path is how force travels through the staircase. When someone walks: person → tread → support system → strings or brackets → fixing points → building structure. A staircase can look strong but have a weak load path — a large newel fixed only into flooring may look impressive without transferring load into the structure." },
  { q: "How are newels typically fixed?", a: "Common methods are (1) through the landing structure — traditional strong method fixing into the trimmer or joist below the finished floor; (2) metal centre-bar with internal steel rods for cleaner appearance (must be engineered correctly — hidden is not automatically stronger); and (3) surface-fixed with a floor plate, easier to install but heavily dependent on the underlying floor structure." },
  { q: "What is a chemical anchor?", a: "A chemical anchor is a resin fixing used when fixing into masonry or concrete. It bonds a steel fixing into the structure. Used for steel supports, brackets and heavy connections. Correct hole preparation, material compatibility and curing time are essential." },
  { q: "What is CNC staircase manufacturing?", a: "CNC (computer-controlled cutting) allows accurate, repeatable machining of stringers, treads, risers, newel details and handrail components. It is especially valuable for curved parts and complex shapes. CNC accuracy does not remove the need for site installation skill — the building is not manufactured to CNC tolerances." },
  { q: "Why can a factory-perfect staircase still be difficult to install on site?", a: "Because walls are not always straight, floors are not always level, openings may have shifted, plaster thickness may vary and buildings have tolerances. The staircase is measured from the building, but the building is not always manufactured like the staircase." },
  { q: "What is a shop drawing?", a: "A shop drawing is the technical drawing produced before manufacturing. It shows plan view, elevation, dimensions, materials, balustrade design and fixing details. The drawing becomes the communication between customer, designer, manufacturer and installer." },
  { q: "What is dry-fitting a staircase?", a: "Dry-fitting means temporarily assembling the staircase components in the factory before final delivery. The staircase is built together without completing all final fixing and finishing, so that alignment, joints, mitres, grain, handrail transitions and geometry can be checked and adjusted before the staircase leaves the factory." },
  { q: "Why do premium manufacturers dry-fit staircases before delivery?", a: "Because the factory environment is the best place to identify problems — controlled conditions, correct tools, skilled craftsmen present, easier adjustments and less disruption. It is cheaper and easier to solve a problem in the factory than on a customer's site. Dry-fit also confirms the complete system works together (curved stairs, handrails, mitres and glass interfaces) before it reaches site." },
  { q: "What is snagging on a staircase?", a: "Snagging is the process of identifying and correcting small issues before final completion — adjustments, finishing details, alignment corrections or minor cosmetic issues. A snag is not necessarily a failure; it is part of quality control, and professional companies expect snagging as a normal step." },
  { q: "What is normal timber movement versus a defect?", a: "Natural: small movement, colour change, grain variation. Possible defect: structural movement, failed joint, unsafe connection, excessive gap. Timber is a natural material — not every change is a defect. Growing gaps, increasing noise or unsafe railing justify investigation." },
  { q: "What is a customer handover on a staircase installation?", a: "A professional handover explains how the staircase works, how to care for the materials, what to expect from natural materials, and warranty information. The customer should understand their staircase — good communication prevents future complaints and helps them recognise natural behaviour vs actual defects." },
  { q: "What does a staircase warranty normally cover?", a: "Warranty typically covers manufacturing defects, installation defects and component failure, according to the specific company terms. It normally does NOT cover misuse, accidental damage, incorrect maintenance or natural material behaviour (seasonal timber movement, colour change over time)." },
  { q: "Can carpeted stairs hide problems?", a: "Yes. Removing carpet can reveal quality timber underneath, damaged timber, old paint or previous repairs. Never assume 'under carpet is always perfect' — the carpet may be hiding structural or cosmetic issues that need addressing before new overlays or finishes are fitted." },
  { q: "Can old newels be replaced?", a: "Yes, but replacing a newel is not only removing a post. The installer must consider the handrail connection, baluster alignment, structural fixing and landing support. A newel replacement may affect the entire balustrade, so the whole system needs to be planned together." },
  { q: "Can timber balusters be changed to glass?", a: "Yes — this is a common modern upgrade. The installer checks glass system compatibility with the existing staircase, the required fixing points, and the load requirements. The concrete or timber structure may be reusable, but the balustrade system as a whole must be re-engineered for glass." },
  { q: "What is the difference between a cosmetic and structural staircase problem?", a: "Cosmetic: scratches, worn finish, colour change, minor surface damage. Structural: loose newel, moving tread, damaged string, broken fixing, unsafe balustrade. A staircase can look old but be structurally excellent — or look beautiful but have poor hidden connections. Diagnose which category the problem falls into before repairing." },
  { q: "How does building movement affect a staircase?", a: "The staircase may not be at fault — movement can originate from settling foundations, floor deflection, wall movement, roof loading or seasonal expansion. Always consider the surrounding structure before assuming the staircase itself has failed." },
  { q: "What is the 'follow the movement' principle?", a: "If a handrail moves, ask what supports it. If a baluster moves, ask what it is fixed into. If a newel moves, ask what is supporting the newel. If a tread moves, ask what is supporting the tread. By following the load path and the movement path together, the true cause is usually found without unnecessary repairs. This is one of the key differences between replacing parts and solving staircase problems permanently." },
  { q: "Why do older staircases become noisier over time?", a: "Older staircases may develop noise because timber dries over time, joints loosen, repeated loading wears connections and building settlement changes load paths. Age alone does not mean the staircase is unsafe — but growing movement or noise justifies inspection." },
  { q: "What is a stair overlay?", a: "A stair overlay is when new finished materials (oak · engineered timber · stone · porcelain · laminate) are fixed over an existing structural staircase. The existing structure remains; the overlay becomes the visible staircase. Common on concrete stairs that started as the structural core and are then finished later. Adds tread thickness, so the first and last risers must be checked against the new finished floors." },
  { q: "What is stair cladding?", a: "Stair cladding is another name for a stair overlay — fixing new finished materials (oak, stone, porcelain, engineered timber) over an existing structural staircase such as concrete. The cladding provides the visible finish; the underlying structure carries the load." },
  { q: "Should timber overlay thickness change the staircase geometry?", a: "The overlay adds to tread thickness. The manufacturer calculates overlay thicknesses so the finished rise and going remain consistent — the finished staircase should not create inconsistent rises, inconsistent goings or trip hazards after the timber is added." },
  { q: "Why should staircase components be numbered?", a: "A large staircase may contain many parts (Tread 01, Tread 02, Left String, Right String, Newel A, Glass Panel 04). Professional manufacturers label everything because parts are not interchangeable — installing Tread 07 where Tread 03 belongs can create gaps or alignment problems. Numbering reduces installation mistakes." },
  { q: "Why are premium staircase parts delivered in sections?", a: "Large bespoke staircases are often sectioned for safer transport, easier access through building openings, reduced damage risk, and easier positioning during installation. A staircase delivered in pieces is not lower quality — it may be the professional approach." },
  { q: "How is a hollow-sounding tread investigated?", a: "A hollow sound under a tread on an overlay staircase may be caused by a local void beneath the overlay, the installation system's design, incomplete adhesive coverage or movement between components. It is not automatically evidence of a structural defect, but it should be investigated if unexpected." },
];

const inst_result = mergeInto("data/nex-component-qa/installation.json", INSTALLATION, {
  layer: "component",
  component_id: "installation",
  component_label: "Staircase Installation · Fixings · Diagnosis · Repair",
  note: "Layer 2 · COMPONENT · Installation Brain (Philip 2026-08-02). Covers site fitting, fixings, load path, diagnosis, dry-fitting, handover, warranty and repair. Rule A · every answer verbatim. Empty `a` = slot awaiting authoring · skipped at match time.",
  cross_brain_links: ["newel", "handrail", "baluster", "stringer", "tread", "riser", "landing", "balustrade-glass", "balcony"],
});

// ─── CONCRETE STAIRCASE FAMILY ──────────────────────────────────────────
const FAMILIES_PATH = "data/nex-families.json";
const familiesDb = JSON.parse(readFileSync(FAMILIES_PATH, "utf8"));
let familyAdditions = 0;
if (!familiesDb.families.some((x) => x.family_id === "concrete-staircase")) {
  familiesDb.families.push({
    family_id: "concrete-staircase",
    label: "Concrete staircase (structural core)",
    description: "Staircase whose primary structural support is reinforced concrete — cast in-situ or precast. The concrete forms the structural shell; finishes (timber overlays · stone · tile · glass balustrade) provide the visible architecture. Same universal geometry rules apply as any other staircase — only the structural method changes.",
  });
  familyAdditions++;
}
familiesDb.updated_at = now;
writeFileSync(FAMILIES_PATH, JSON.stringify(familiesDb, null, 2), "utf8");

const CONCRETE = [
  { q: "What is a concrete staircase?", a: "A concrete staircase is a staircase where the primary structural support is made from reinforced concrete. It may be cast in-situ (poured on site), precast (manufactured in a factory) or built from modular concrete sections. Concrete forms the structure that carries the loads." },
  { q: "Do concrete staircases follow different geometry rules?", a: "No. The rise, going, pitch, headroom and safety principles apply to every staircase — timber, steel, concrete, stone, glass or composite. Only the structural material and construction method change. The mathematics remains the same." },
  { q: "What is a cast in-situ concrete staircase?", a: "Cast in-situ means the staircase is built on site. The process is: set out the staircase → build formwork → install reinforcement → pour concrete → compact concrete → cure concrete → remove formwork → apply finishes. Advantages: custom shapes, continuous structure, ideal for large buildings." },
  { q: "What is a precast concrete staircase?", a: "A precast staircase is manufactured in a factory and delivered to site for installation. Advantages: consistent quality, faster installation, factory-controlled production, reduced site labour. Similar in philosophy to factory-manufactured timber staircases — the controlled environment improves quality control." },
  { q: "What is reinforced concrete on a staircase?", a: "Concrete is excellent in compression but much weaker in tension or bending. Steel reinforcement bars are cast into the concrete to carry tensile forces. Together they form reinforced concrete — concrete for compression, steel for tension. Reinforcement position and quantity are engineered to suit the staircase design." },
  { q: "Why do concrete staircases feel so solid?", a: "Because of high mass, continuous structure, minimal vibration and strong structural support. They typically feel rigid, heavy, stable and quiet — but this only holds when the reinforcement, formwork and pouring are correctly executed. A poorly engineered concrete stair is not automatically strong." },
  { q: "Do concrete staircases squeak?", a: "Concrete itself does not normally squeak. If noise occurs on a concrete staircase, it usually comes from timber overlays, loose finishes, handrails or balustrades — movement at fixings rather than in the concrete structure itself." },
  { q: "What is a concrete waist slab?", a: "The waist slab is the structural concrete beneath the steps — the 'backbone' of the staircase. It supports the treads, risers, live loads and its own self-weight. Individual concrete steps are not usually independent blocks; the entire staircase acts as one reinforced structural unit with each step transferring load into the continuous waist slab." },
  { q: "What is monolithic concrete construction?", a: "Monolithic means the staircase is poured as one continuous piece. Advantages: fewer joints, excellent rigidity, reduced movement, long lifespan. Many cast-in-situ stairs use monolithic construction." },
  { q: "Are landings part of the concrete staircase structure?", a: "Yes. A landing is not simply a flat platform — it connects flights, distributes loads, braces the staircase and transfers loads into surrounding walls or beams. Landings are integral to the structural system, not additions." },
  { q: "What is formwork on a concrete staircase?", a: "Formwork (also called shuttering) is the temporary mould that shapes the wet concrete. It includes side forms, soffit support, riser boards, landing forms and temporary bracing. It must be rigid enough to support the weight of fresh concrete without moving. The quality of the formwork directly determines the quality of the finished concrete — poor formwork produces poor concrete." },
  { q: "Why is concrete curing important?", a: "Concrete does not become fully strong immediately after pouring. It gains strength over time through curing. Good curing helps durability, strength and crack resistance. The curing method and duration depend on the concrete mix, weather conditions and project requirements." },
  { q: "Can a concrete staircase be modified after casting?", a: "It is much harder than modifying a timber staircase. Changing the rise, going, landing position or width usually requires structural work. Unlike timber, concrete cannot easily be trimmed or reshaped after curing — decisions made at the setting-out stage are effectively permanent." },
  { q: "What are the advantages of a concrete staircase?", a: "Excellent structural strength, durability, fire resistance, reduced vibration, long lifespan, suitable for heavy loads, and low structural movement compared with timber. These qualities make concrete staircases common in high-traffic environments like apartment buildings, hotels, offices, hospitals and schools." },
  { q: "What are the limitations of a concrete staircase?", a: "Heavy weight, requires structural support, difficult to modify after construction, more complex repairs, and changes usually require significant work. The strength and permanence that make concrete valuable also make it less flexible than timber." },
  { q: "What is the fire performance of concrete staircases?", a: "Concrete is non-combustible and generally performs well in fire compared with many other materials. This is one reason concrete staircases are common in apartment buildings, hospitals, schools, commercial buildings and public infrastructure. Overall fire performance depends on the complete structural design, reinforcement cover and applicable building regulations." },
  { q: "Can a concrete staircase be renovated?", a: "Yes. Common upgrades include timber overlays, new stone finishes, glass balustrades, stainless steel balustrades, modern handrails and LED lighting. Many old concrete staircases are transformed into premium feature staircases without replacing the underlying structure." },
  { q: "What is a concrete stair overlay?", a: "An overlay (also called cladding or lining) is when new finished materials — European Oak, American White Oak, walnut, ash, engineered timber, stone, porcelain or quartz — are fixed over an existing structural concrete staircase. The concrete remains the structure; the overlay becomes the visible staircase. Nex remembers this: many 'oak staircases' are actually oak-clad concrete staircases." },
  { q: "Why do premium homes clad concrete stairs with oak?", a: "To transform plain structural concrete into a luxury staircase, protect the concrete edges from wear, match the interior finish language (flooring · doors · wall panelling), and enable easier future refurbishment (the structural stair is unaffected). The concrete does the work; the oak does the appearance." },
  { q: "Does a concrete overlay change the load path?", a: "No. The overlay is not normally structural — it provides appearance, walking surface, finish and comfort. The concrete continues to carry the structural loads. This is one reason overlays can be replaced or refreshed without touching the structure." },
  { q: "Should the concrete shell be surveyed before manufacturing overlays?", a: "Yes. Professional staircase companies never manufacture from architectural drawings alone. Before machining timber, they normally verify total rise, stair width, tread depth, landing dimensions, wall positions and finished floor levels of the actual concrete. Concrete can vary from drawings — always measure the actual staircase." },
  { q: "Are two concrete staircases in identical houses actually identical?", a: "Not usually. Even when built from the same architectural drawings, small differences in casting, plaster thickness, floor finishes and site tolerances mean every staircase is slightly different. Bespoke overlays should be measured for the individual staircase, not copied from a neighbour." },
  { q: "Can timber overlays hide small concrete imperfections?", a: "Yes — for small variations. Timber can square up slightly uneven edges, create clean nosings, provide consistent visual lines and conceal minor casting marks. But timber should NEVER be used to disguise major structural defects — incorrect rise, incorrect landing height, major twist or significant out-of-level construction require structural correction before the overlay is installed." },
  { q: "Why are the first and last risers so important on a concrete overlay?", a: "The finished first and last risers must account for timber tread thickness, flooring finishes, adhesive thickness, carpet, stone or other transitions. Concrete contractors and staircase manufacturers must coordinate carefully — failure to coordinate creates inconsistent riser heights that the customer will notice." },
  { q: "Does moisture affect a concrete overlay?", a: "Yes. Concrete can retain moisture long after it appears dry. Fixing timber onto excessively damp concrete can cause adhesive failure, timber movement, staining, swelling or finish problems. Drying time varies with slab thickness, environment, mix and ventilation — always follow the project specification and verify conditions before installing timber onto concrete." },
  { q: "What is a shadow gap on a stair overlay?", a: "A shadow gap is a designed gap between overlay elements (e.g. tread and wall, or tread and riser) that creates clean visual lines, hides small construction tolerances and produces a floating appearance. It is an intentional design feature, not a gap left by poor workmanship." },
  { q: "How is a concrete staircase built in 13 steps?", a: "Design → set out → build formwork → check formwork → install reinforcement → final inspection → place concrete → compact concrete → finish surface → cure concrete → remove formwork → inspect staircase → apply finishes. Each step depends on the previous one — errors at the setting-out stage repeat through every riser above." },
  { q: "Can 'oak staircase' actually mean a concrete staircase?", a: "Often yes. Many customers describe their staircase by its visible finish — 'oak staircase' or 'glass staircase' — when the actual structural system is reinforced concrete with an oak overlay and a glass balustrade. Both descriptions are correct customer language; Nex understands the layered reality behind it. The reinforced concrete carries the loads; the oak cladding provides the finish; the glass provides fall protection; the handrail provides user support — together they form one complete staircase system." },
];

const conc_result = mergeInto("data/nex-family-qa/concrete-staircase.json", CONCRETE, {
  layer: "family",
  family_id: "concrete-staircase",
  family_label: "Concrete staircase (structural core)",
  note: "Layer 3 · FAMILY · Concrete Staircase Brain (Philip 2026-08-02). Applies to any design tagged with families: [concrete-staircase]. Covers structural concrete, cast-in-situ vs precast, waist slab, reinforcement, overlays, cladding, moisture and the 13-step build process. Rule A · verbatim.",
});

// ─── UNIVERSAL EXTENSIONS ───────────────────────────────────────────────
const UNIVERSAL_EXTRA = [
  { q: "Is my 'oak staircase' actually made of solid oak all the way through?", a: "Not always. Many premium staircases described as 'oak' are actually structural concrete or engineered timber staircases with an oak overlay — the customer sees oak treads, oak handrails and oak newels, but the load-carrying structure underneath may be reinforced concrete, steel or engineered timber. This is normal high-quality practice — the reinforced structure carries the loads while the oak provides the visible architecture. Nex separates the STRUCTURE from the FINISH: both are correct ways to describe the same staircase." },
  { q: "What are the three layers of every staircase?", a: "Layer 1 · Geometry — rise, going, pitch, headroom, walking line (universal). Layer 2 · Construction — stringers, steel supports, brackets, walls, frames, reinforced concrete (structural build). Layer 3 · Appearance — timber, glass, balusters, handrails, finishes (visible design). Layer 1 is the same for every staircase type; Layers 2 and 3 are where straight-flight, spiral, helical, floating, timber, steel, glass and concrete staircases differ." },
  { q: "What is the difference between the structural staircase and the architectural finish?", a: "The structural staircase is what carries the loads — reinforced concrete, timber stringers, steel spine, or a combination. The architectural finish is what the customer sees — oak cladding, glass balustrade, painted MDF risers, stone treads, LED lighting. The two are engineered together but serve different purposes. A well-designed staircase respects both — the structure remains sound while the finish delivers the intended appearance." },
  { q: "How can a customer tell if a staircase is well built?", a: "Nex will not claim from a photo alone. Signs of quality include consistent step rhythm, aligned vertical lines, smooth handrail transitions, correctly proportioned newels, consistent materials, realistic construction and a solid feel when walking. But visual signs are not the whole picture — fixing depth, structural support and hidden connections determine whether the staircase performs well long-term. For a specific staircase, Nex can, with your permission, prepare your questions and connect you with an experienced staircase professional to inspect it." },
  { q: "Is 'follow the movement' a real diagnostic principle?", a: "Yes — it is used by experienced staircase manufacturers. If a handrail moves, ask what supports it. If a baluster moves, ask what it is fixed into. If a newel moves, ask what is supporting the newel. If a tread moves, ask what is supporting the tread. By following the load path and the movement path together, the true cause is often found without unnecessary repairs. This is one of the key differences between replacing parts and solving staircase problems permanently." },
];

const universal_path = "data/nex-universal-qa.json";
const universalDoc = JSON.parse(readFileSync(universal_path, "utf8"));
const uniByQ = new Map(universalDoc.qa.map((x, i) => [norm(x.q), i]));
let uniAdded = 0;
for (const item of UNIVERSAL_EXTRA) {
  const key = norm(item.q);
  if (uniByQ.has(key)) universalDoc.qa[uniByQ.get(key)] = item;
  else { universalDoc.qa.push(item); uniAdded++; }
}
universalDoc.updated_at = now;
writeFileSync(universal_path, JSON.stringify(universalDoc, null, 2), "utf8");

// ─── REPORT ─────────────────────────────────────────────────────────────
console.log("=== INSTALLATION BRAIN ===");
console.log(`  installation.json      · added ${inst_result.added} · filled ${inst_result.filled} · TOTAL ${inst_result.total} Qs · ${inst_result.authored} authored`);

console.log("\n=== CONCRETE STAIRCASE FAMILY ===");
console.log(`  family_ids added: ${familyAdditions}`);
console.log(`  concrete-staircase.json · added ${conc_result.added} · filled ${conc_result.filled} · TOTAL ${conc_result.total} Qs · ${conc_result.authored} authored`);

console.log("\n=== UNIVERSAL EXTENSIONS ===");
console.log(`  added ${uniAdded} · total ${universalDoc.qa.length} Qs · ${universalDoc.qa.filter(x => x.a && x.a.trim().length > 0).length} authored`);

const total = inst_result.added + conc_result.added + uniAdded;
console.log(`\nGRAND TOTAL new authored Q&As: ${total}`);
