// Stringer expansion + Plan Types families + Terminology Universal batch.
// Philip 2026-08-02.
//
// - Extends stringer.json with cut/closed/mono/thickness/failure Q&As
// - Adds 5 new family_ids to nex-families.json (quarter-turn, half-turn, dog-leg, bifurcated, winder)
// - Creates 5 new family-qa files + extends existing spiral, helical, straight-flight, open-riser
// - Adds ~40 terminology origin Q&As to Universal
//
// Rule A · every answer verbatim from Philip's raw dump. Idempotent.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

// ─── STRINGER EXPANSION ────────────────────────────────────────────────
const STRINGER_EXTRA = [
  { q: "Is the stringer just decoration?", a: "No. A stringer can be structural, decorative, or both. Its role depends on the staircase construction method. A cut string on an oak staircase is both structural and decorative. A concealed steel spine is structural but hidden. A decorative cover added over an existing structure is purely decorative. The visible material is not always the structural material." },
  { q: "What is a saw-tooth stringer profile?", a: "A saw-tooth or cut-profile stringer has the top edge cut in a stepped pattern to receive the treads and risers. The staircase step profile becomes visible from the side. It is the manufacturing method behind a cut-string staircase — the cutting exposes the stair rhythm as part of the design." },
  { q: "How does staircase geometry control the stringer?", a: "The stringer follows the calculated staircase angle — it is created from rise, going and pitch. The geometry comes first; the material comes second. If the stair calculation gives a 190mm riser and 260mm going, the stringer must be manufactured to that exact rhythm. String dimensions follow staircase geometry, not the other way around." },
  { q: "What is a common closed-string width on a traditional staircase?", a: "Common closed-string widths are approximately 8.5 inches or 9 inches. These sizes are widely used because they provide a balance between structural support, appearance, material efficiency and traditional proportions. This is a common quality standard used by staircase manufacturers, not a universal building rule — final dimensions can vary from project to project." },
  { q: "Why is a cut string wider than a closed string?", a: "Because the cut string follows the step profile — the top edge is cut away to reveal the tread ends. To maintain strength, visual proportion, fixing area and structural integrity after that cutting, the original board must start wider. Cut string widths commonly increase to approximately 14 to 17 inches depending on riser height, tread going, staircase design and material choice." },
  { q: "How does rise and going affect stringer width?", a: "A staircase with higher risers creates deeper step cuts, and longer goings create longer step projections. Both make the cut-string design deeper below the step profile, so the string design may need to be adjusted. String dimensions follow staircase geometry — not the other way around." },
  { q: "Why do open-riser staircases often need thicker stringers?", a: "An open-riser staircase removes the closed riser board — one visible component is gone, so the remaining components must provide more of the stiffness, stability and visual balance. A wide open-riser staircase may require approximately a 60% increase in string thickness, or in some designs up to double the thickness, depending on material, span, design and engineering. Removing components does not always mean less material." },
  { q: "Do double-side cut strings need extra thickness?", a: "A double-side cut string staircase can require increased thickness because both sides carry visual and structural responsibility. The strings become visible features and structural components together, so proportions need to be larger to remain balanced and strong." },
  { q: "Do the same string dimensions behave the same in every material?", a: "No. Solid oak is strong with premium appearance but has natural movement. Engineered timber is more dimensionally stable and consistent. MDF and decorative boards behave differently again and are usually not equivalent to structural timber. Steel has high strength with a completely different design approach. String size must be chosen for the material — the same dimensions can perform very differently." },
  { q: "Are stringer dimensions a building rule?", a: "No. Common stringer dimensions represent quality standards used by staircase manufacturers, not universal building rules. Final sizing depends on the individual staircase design, span, material behaviour and structural requirements. A manufacturer may increase thickness where the staircase is wider, the string is more exposed, the design has fewer supports, or the staircase carries more visible load." },
  { q: "What causes a stringer to bow?", a: "A bowed string means the string is no longer perfectly straight. Possible causes include timber movement, insufficient thickness, incorrect storage, moisture imbalance and excessive loading. The effect is steps that may appear uneven, balusters that no longer line up and a handrail that appears curved even where it should be straight." },
  { q: "What is a twisted stringer?", a: "A twist means the string rotates along its length — one side of the staircase may appear higher or lower. It is different from a bow (which is a curve along the length). Possible causes include timber stress, incorrect fixing and uneven support. Effect: uneven step contact and a handrail that never feels level along the run." },
  { q: "Can a staircase have the correct angle but still be out of level?", a: "Yes. A staircase can have the correct pitch (rise/going ratio) but still have alignment problems if the string is not level across its width. Possible results include uneven tread contact, handrail irregularity and uncomfortable walking." },
  { q: "How does the tread connect to the stringer?", a: "The tread must connect correctly to the string — it should transfer load INTO the string, not simply sit on top of it. Problems arise from loose fitting, poor glue joints, incorrect fixing or insufficient support. Traditional joinery uses housed treads (fitted into a groove cut in the string) with wedges and glue blocks for a movement-free connection." },
  { q: "How does the riser connect to the stringer?", a: "The riser helps lock the staircase geometry. In traditional stairs, tread + riser + string work together as a unit. Removing or changing one element affects the whole system. Housed strings receive both the tread and the riser in matched grooves, with wedges tightening the joint from behind." },
  { q: "Does an open-riser stair still need the stringer to support the treads?", a: "Yes. Removing the vertical riser board does not remove the load path — the string, frame or steel structure must still carry each tread. Open does not mean unsupported. The remaining components (stringer, brackets, welds) become more critical because the closed riser no longer contributes to stiffness." },
  { q: "Why do mono-stringer staircases look simple but require careful engineering?", a: "Mono-string stairs concentrate all the load into a single central steel spine. The engineering is concentrated into steel thickness, connection plates, anchors, weld quality and support points. The appearance is minimal; the structural work behind it is not." },
  { q: "Does 'floating staircase' mean no stringer?", a: "No. The structure may be concealed, transferred into walls or carried by hidden steel components — but it exists. Nex must not assume floating means unsupported. Floating appearance never means no structure; it means the structure is visually reduced or concealed." },
  { q: "Why should a newel not be adjusted before checking the stringer?", a: "Because if the string is wrong and the newel is forced straight, other parts of the balustrade become misaligned. If a newel appears leaning, Nex checks the newel itself first, then the fixing, then whether the string is aligned, then the landing and floor. Never adjust the newel before finding the cause." },
  { q: "Can baluster spacing become inconsistent because of stringer alignment?", a: "Yes. Balusters follow the staircase geometry — the stringer sets the reference line. If the string line is incorrect, the baluster spacing above it can appear inconsistent even when each baluster is correctly located on its own." },
  { q: "What is the correct installation sequence for a stringer-based staircase?", a: "Confirm building dimensions → check floor levels → position stringers → secure structural connections → install treads and risers → install balustrade → check alignment. Structure first, appearance second — installing the balustrade before confirming staircase accuracy produces leaning newels, uneven rails and poor transitions." },
  { q: "Why can a staircase move and squeak?", a: "Squeaking is usually caused by movement between components. Possible sources include a loose tread connection, stringer movement, incorrect fixing and timber shrinkage. A staircase should not only look correct — it must feel solid. Diagnosis is about finding WHERE the movement is occurring, not simply blaming the tread." },
  { q: "Can an old staircase move naturally without being a structural problem?", a: "Yes. Older staircases can move because of seasonal timber movement, aged fixings, wear and settlement. Nex distinguishes normal ageing from structural concern — some movement is expected, but growing gaps or increasing noise justify investigation. Nex will not recommend a cosmetic repair for a structural problem." },
  { q: "What are the connection points a stringer transfers load through?", a: "Top (connection to upper floor), bottom (connection to lower floor), intermediate supports or fixings, and step (tread connection). A weak connection at any of these points can reduce the performance of an otherwise strong stringer." },
  { q: "Why is the top stringer connection critical?", a: "Because it connects to the landing, floor structure and trimmer area — it must resist downward loads, movement and sideways forces. The stringer is the first structural element carrying the staircase journey into the upper floor." },
  { q: "Why is the bottom stringer connection important?", a: "It affects stability, movement and squeaking. A staircase should feel solid when the user steps onto the first tread. Poor bottom fixing manifests as flex, a hollow sound, or gradual squeaking over time." },
  { q: "Do balustrade forces travel through the stringer?", a: "Often yes. Newel posts fixed to the stringer transfer handrail forces into it, so the stringer is not only carrying the treads — it also anchors part of the balustrade system. This is why premium staircases pay close attention to the string-to-newel connection." },
  { q: "What is a false stringer?", a: "A false stringer appears like a structural string but may be decorative — a side board added over the true structure rather than carrying load itself. Not every visible board on a staircase side carries the staircase load. Nex checks whether the string is structural or a covering before assuming its role." },
  { q: "What is a housed string?", a: "A housed string has the treads and risers housed into grooves cut into the string. It is a traditional joinery method. The tread and riser fit into matched grooves, held tight with wedges and glue blocks — this creates a strong, quiet, movement-free joint that carries the tread ends invisibly." },
  { q: "What are glue blocks on a staircase?", a: "Small timber blocks added underneath joints to reduce movement, strengthen connections and prevent squeaks. Common locations include tread-to-riser joints, corners and returns. A quiet staircase usually indicates accurate fitting, good preparation and correct fixing — glue blocks help achieve all three." },
  { q: "Why do stringers need edge finishing?", a: "A visible stringer requires high finishing quality — straightness, smooth edges, consistent thickness and matching timber grain. Common edge treatments include square edge, rounded edge, chamfer or decorative profile. The edge affects shadow lines, touch quality and the premium appearance of the staircase." },
  { q: "Why can a small stringer manufacturing error become highly visible?", a: "Because a staircase repeats the same step rhythm many times. A small manufacturing error at one riser or tread position, repeated over 13 or 14 steps, becomes a wave in the handrail line or a shift in baluster spacing that the eye catches immediately. Cut-string accuracy is especially critical because every step follows the same visible pattern." },
];

const stringer_result = mergeInto("data/nex-component-qa/stringer.json", STRINGER_EXTRA);

// ─── FAMILY TAXONOMY · 5 NEW ────────────────────────────────────────────
const FAMILIES_PATH = "data/nex-families.json";
const familiesDb = JSON.parse(readFileSync(FAMILIES_PATH, "utf8"));
const NEW_FAMILIES = [
  { family_id: "quarter-turn",  label: "Quarter-turn staircase (L-shape)",           description: "Two straight flights with a 90° change of direction, usually joined by an intermediate landing." },
  { family_id: "half-turn",     label: "Half-turn staircase (U-shape)",              description: "Two straight flights with a 180° change of direction, joined by a half landing. Also called a switchback." },
  { family_id: "dog-leg",       label: "Dog-leg staircase",                          description: "Two straight parallel flights in opposite directions with a half landing between them. The side profile resembles a dog's rear leg, which is where the name comes from." },
  { family_id: "bifurcated",    label: "Bifurcated staircase",                       description: "A grand staircase where one lower flight divides into two upper flights (or vice versa). From Latin bi + furca = 'two forks'. Common in hotels and grand entrances." },
  { family_id: "winder",        label: "Winder staircase (tapered-tread turn)",      description: "Direction change achieved with tapered/kite-shaped steps instead of a landing. Saves space and creates a continuous turn." },
];
let familyAdditions = 0;
for (const f of NEW_FAMILIES) {
  if (!familiesDb.families.some((x) => x.family_id === f.family_id)) {
    familiesDb.families.push(f);
    familyAdditions++;
  }
}
familiesDb.updated_at = now;
writeFileSync(FAMILIES_PATH, JSON.stringify(familiesDb, null, 2), "utf8");

// ─── FAMILY-QA FILES (NEW + EXTENDED) ───────────────────────────────────
const QUARTER_TURN = [
  { q: "What is a quarter-turn staircase?", a: "A quarter-turn staircase changes direction by 90 degrees, usually with an intermediate landing or a set of winder treads. Also called an L-shaped staircase. The lower flight rises, then the direction changes 90 degrees, and the upper flight continues to the arrival point." },
  { q: "Why are quarter-turn staircases popular in homes?", a: "Because they use less linear floor space than a straight flight, the intermediate landing provides a natural rest and pause point, and the 90° turn allows the staircase to fit neatly against walls in typical rooms." },
  { q: "Where can the turn happen on a quarter-turn staircase?", a: "Any of three positions: bottom turn L (turn happens immediately after starting), middle turn L (turn happens halfway), or top turn L (turn happens near arrival). The position affects how the staircase reads in the room." },
  { q: "What is the difference between a quarter-turn landing stair and a winder?", a: "A quarter-turn with a landing uses a flat rectangular landing to achieve the 90° change of direction. A quarter-turn with winders uses tapered (kite-shaped) treads that turn the direction one step at a time. Winders save space; landings feel more comfortable to walk." },
];
const HALF_TURN = [
  { q: "What is a half-turn staircase?", a: "A half-turn staircase changes direction by 180 degrees — the two flights run parallel but in opposite directions. Also called a U-shaped staircase or a switchback. The two flights are joined by a half landing where the direction reverses." },
  { q: "What is the difference between a half-turn and a dog-leg staircase?", a: "A dog-leg staircase is a specific type of half-turn — two straight flights in opposite directions with a half landing between them. The name 'dog-leg' comes from the side profile resembling a dog's rear leg. Most dog-leg staircases are half-turn staircases; not all half-turn stairs are traditionally called dog-legs." },
  { q: "Why are half-turn staircases common in houses and offices?", a: "Because they fit efficiently into a compact rectangular footprint — the two parallel flights double back on each other, so the staircase climbs the full floor height in about half the linear floor length of a straight flight." },
  { q: "What is an open-well half-turn staircase?", a: "A half-turn staircase where the space between the two flights (the 'well') is left open rather than boxed in. The open well may contain a glass balustrade, timber balustrade or decorative feature, and it lets light and sightlines travel through the staircase." },
];
const DOG_LEG = [
  { q: "What is a dog-leg staircase?", a: "A dog-leg staircase is a two-flight staircase with opposite directions and a half landing between them, creating approximately a 180-degree turn. The name comes from the side profile of the staircase — the shape resembles a dog's rear leg when viewed from the side. Common in houses, offices, apartments and commercial buildings." },
  { q: "Where does the term dog-leg come from?", a: "From the side profile of the staircase. When viewed from the side, the shape of the two flights and the connecting landing resembles the bent shape of a dog's rear leg. Traditional craftsmen used everyday visual comparisons to name staircase shapes." },
  { q: "Is every U-shaped staircase a dog-leg?", a: "Most dog-leg staircases are U-shaped, but not every U-shaped stair is traditionally called a dog-leg. The term specifically describes the two-flight + half-landing arrangement that produces the leg-shaped side profile. Curved U-turns and open-well U-shapes are usually named differently." },
];
const BIFURCATED = [
  { q: "What is a bifurcated staircase?", a: "A bifurcated staircase is a grand staircase where one flight divides into two — either a lower flight that splits at a landing into two upper flights, or two lower flights that meet at a landing and continue as one upper flight. Common in hotels, mansions, museums and public buildings where a ceremonial entrance is required." },
  { q: "Where does the word 'bifurcated' come from?", a: "From Latin: bi = two, furca = fork. Together they mean 'to divide into two branches'. A bifurcated staircase divides the flow of movement into two directions, so the name literally describes what the staircase does." },
  { q: "What is a grand double staircase?", a: "A grand double staircase is a symmetrical bifurcated staircase where two flights rise or descend as mirror images. Common in ceremonial entrances — hotels, museums, luxury homes — because the symmetry creates a strong architectural presence at the point of arrival." },
];
const WINDER = [
  { q: "What is a winder staircase?", a: "A winder staircase changes direction using tapered (kite-shaped) steps instead of a landing. The step 'winds' around the corner — the tread is wider at one side and narrower at the other. Common on quarter-turn and half-turn stairs where space is tight and a full landing would be too large." },
  { q: "Why do designers use winders?", a: "Advantages: they save space compared to a landing, create a smoother continuous direction change and reduce the total staircase footprint. Considerations: they require careful calculation — the narrow side of each winder tread must remain safely usable for the foot." },
  { q: "What is a kite winder?", a: "A kite winder is a tapered tread whose shape resembles a kite when viewed from above. It is the specific step shape used at a corner turn on a winder staircase. Depending on how the turn is set out, the corner may be formed by one, two or three kite winders." },
  { q: "What is the difference between a winder and a landing?", a: "A landing is a flat rectangular walking area that turns the staircase in one step. A winder is a tapered turning step that spreads the direction change across multiple steps. Landings feel more spacious and provide a rest; winders save space and create a continuous climb." },
];

// Extend existing family-qa files
const SPIRAL_EXTRA = [
  { q: "What is a spiral staircase?", a: "A spiral staircase is a staircase whose treads rotate around a central column. The movement is a continuous rotation around a fixed centre point. The name comes from the resemblance to spiral shells, coils and natural growth patterns — the staircase follows a spiral curve." },
  { q: "Where does the word 'spiral' come from?", a: "The word describes the shape — a coil or rotating curve, similar to spiral shells and natural growth patterns. Traditional craftsmen used shapes in nature to describe how the staircase moved." },
  { q: "What is the difference between a spiral and a helical staircase?", a: "A spiral staircase rotates around a central column — the column carries the treads and provides the rotation axis. A helical staircase is a continuous three-dimensional curve without necessarily using a central column — the treads sweep upward in a curve. Spirals are usually more compact; helicals are usually grander and require more complex manufacturing." },
];
const HELICAL_EXTRA = [
  { q: "What is a helical staircase?", a: "A helical staircase is a continuous curved flight without a central column. The word 'helix' describes a three-dimensional curve — the same shape as DNA, spiral shells and certain plant growth patterns. Each tread is individually engineered because the curve is not carried by a fixed central axis." },
  { q: "Where does the word 'helical' come from?", a: "From 'helix' — a three-dimensional curve found in nature (DNA · spiral shells · plant growth). A helical staircase rises while continuously curving, giving it the name." },
  { q: "What is a double helix or grand curved staircase?", a: "A double helix or grand curved staircase uses multiple sweeping curves — often two staircases that mirror each other. Common in hotels, luxury homes and public buildings as a statement staircase. Requires complex structure and high craftsmanship." },
  { q: "What is an oval staircase?", a: "An oval staircase is a curved layout where the plan is a stretched circle. It gives a softer flow than straight stairs and a wider visual field of view, with a premium architectural appearance." },
];
const STRAIGHT_FLIGHT_EXTRA = [
  { q: "What is a straight-flight staircase?", a: "A straight-flight staircase moves in one continuous direction with no turns — the simplest possible staircase layout. Also called a single-flight or straight-run staircase. Common in loft conversions, modern homes and commercial access stairs where floor space allows an uninterrupted run." },
  { q: "Can a straight-flight staircase have a landing?", a: "Yes. A straight staircase can have a top landing (arrival point), a bottom landing (entry platform) or an intermediate landing (long commercial stairs may add a rest landing without changing direction). A landing does not automatically make a staircase a turning staircase — it is still a straight flight if the direction does not change." },
  { q: "What is a double-flight straight staircase?", a: "Two straight flights continuing in the same direction with an intermediate landing between them. Used where the floor height is large or the total travel distance is long. The intermediate landing provides a rest point without changing direction." },
];
const OPEN_RISER_EXTRA = [
  { q: "What is an open-riser staircase?", a: "An open-riser staircase has no closed vertical board between the treads. The space between each tread is open, allowing light through and giving the staircase a lighter visual appearance. It is a deliberate design choice, not a missing part." },
  { q: "Are open-riser staircases safe?", a: "Yes when correctly designed. They follow the same fundamental staircase principles as closed-riser stairs, with additional consideration for opening dimensions (a person must not be able to pass through the gap between treads). Local building regulations control the allowable openings." },
  { q: "Do open-riser staircases need more structure than closed-riser stairs?", a: "Often yes. Removing the closed riser removes a stiffening component, so the remaining stringer or steel structure often needs to be thicker or stronger. A wide open-riser staircase may require approximately a 60% increase in stringer thickness, or up to double the thickness in some designs, depending on span, material and engineering." },
];

// Write all family files
const family_results = {};
family_results["quarter-turn"] = mergeInto("data/nex-family-qa/quarter-turn.json", QUARTER_TURN, { layer: "family", family_id: "quarter-turn", family_label: "Quarter-turn staircase (L-shape)" });
family_results["half-turn"]    = mergeInto("data/nex-family-qa/half-turn.json",    HALF_TURN,     { layer: "family", family_id: "half-turn", family_label: "Half-turn staircase (U-shape)" });
family_results["dog-leg"]      = mergeInto("data/nex-family-qa/dog-leg.json",      DOG_LEG,       { layer: "family", family_id: "dog-leg", family_label: "Dog-leg staircase" });
family_results["bifurcated"]   = mergeInto("data/nex-family-qa/bifurcated.json",   BIFURCATED,    { layer: "family", family_id: "bifurcated", family_label: "Bifurcated staircase" });
family_results["winder"]       = mergeInto("data/nex-family-qa/winder.json",       WINDER,        { layer: "family", family_id: "winder", family_label: "Winder staircase" });
family_results["spiral"]       = mergeInto("data/nex-family-qa/spiral.json",       SPIRAL_EXTRA);
family_results["helical"]      = mergeInto("data/nex-family-qa/helical.json",      HELICAL_EXTRA);
family_results["straight-flight"] = mergeInto("data/nex-family-qa/straight-flight.json", STRAIGHT_FLIGHT_EXTRA);
family_results["open-riser"]   = mergeInto("data/nex-family-qa/open-riser.json",   OPEN_RISER_EXTRA);

// ─── UNIVERSAL TERMINOLOGY BATCH ────────────────────────────────────────
const UNIVERSAL_EXTRA = [
  { q: "Where does the term 'dog-leg staircase' come from?", a: "The name comes from the side profile of the staircase. A traditional two-flight staircase with a half landing between them resembles the shape of a dog's rear leg when viewed from the side. Traditional craftsmen used everyday visual comparisons to name staircase shapes." },
  { q: "What is a monkey volute?", a: "A monkey volute is a decorative spiral at the bottom end of a handrail. The name comes from the curled shape resembling a monkey's curled tail. Traditional craftsmen used animal references to describe decorative shapes. The monkey volute finishes the handrail, creates a smooth starting point, and transitions into the first newel." },
  { q: "What is a volute on a staircase?", a: "A volute is a decorative spiral handrail ending — the word comes from Latin voluta meaning 'to turn' or 'to roll'. Used on grand staircases, traditional timber stairs and curved handrail designs." },
  { q: "What is a swan neck handrail?", a: "A swan neck handrail is a curved rising transition where the handrail resembles the elegant shape of a swan's neck. Used when two different handrail heights need to meet — for example where a landing rail joins a stair rail — the swan neck creates a smooth height transition." },
  { q: "What is a gooseneck handrail?", a: "A gooseneck is a rising curved handrail section named because the shape resembles the neck of a goose. Used to connect a lower stair handrail to a higher landing handrail with a smooth height transition. Gooseneck and swan neck are similar terms — different manufacturers may use them slightly differently." },
  { q: "What is a bullnose step?", a: "A bullnose step has a rounded front edge, similar in shape to the nose of a bull. Commonly used for first step features, curved tread edges and decorative entrances. Where a square-edge step reads as modern, a bullnose reads as traditional or period." },
  { q: "What is a winder in staircase terminology?", a: "A winder is a tapered turning step used to change staircase direction without a full landing. The step 'winds' around the corner — the name describes the movement. The tread is wider at the outside of the turn and narrower at the inside." },
  { q: "What is a kite winder?", a: "A kite winder is a tapered turning step whose shape resembles a kite when viewed from above. It is one of the common tread shapes used at a corner turn on a winder staircase." },
  { q: "Where does the word 'baluster' come from?", a: "From the Italian word 'balaustra', meaning wild pomegranate flower. Early balusters were shaped to resemble the flower, and the name stayed. A baluster is the vertical member that supports the handrail and prevents falls through the open side of the staircase." },
  { q: "What is a balustrade?", a: "A balustrade is the complete railing system — the assembly of balusters, handrail and newel posts working together. Nex never describes a balustrade as only 'the spindles' — the balustrade is the complete safety system." },
  { q: "What does 'stringer' mean?", a: "The word 'stringer' comes from the idea that it 'strings' or carries the staircase together — it connects the steps into one continuous structure. The stringer is the supporting side member of a staircase that carries the treads, risers and loads." },
  { q: "What is a monkey tail handrail?", a: "A monkey tail is a decorative handrail ending whose curled shape resembles a monkey's curled tail. Similar to a monkey volute. Common on traditional timber staircases, period restoration projects and feature staircases where a crafted decorative termination is required." },
  { q: "What is a snake rail?", a: "A snake rail is a flowing curved handrail whose path resembles the movement of a snake. The name describes the movement, not the material — a snake rail can be timber, metal or laminated. Used for curved staircases and sweeping balustrades." },
  { q: "What is a lamb's tongue handrail ending?", a: "A lamb's tongue is a decorative handrail ending shaped like the split curve of a lamb's tongue. Traditional craftsmen used animal references to describe decorative shapes. Used for decorative finishing and smooth hand transitions on classical staircases." },
  { q: "What is an ogee handrail profile?", a: "'Ogee' comes from architectural moulding terminology and describes an S-shaped curve. An ogee handrail combines two opposite curves in one continuous profile. Used in decorative handrails, mouldings and traditional interiors." },
  { q: "What is a torus moulding?", a: "From the Latin word meaning 'a swelling or rounded moulding'. A torus is a rounded convex profile used on newels and decorative timber details on traditional staircases." },
  { q: "What is an astragal moulding?", a: "An astragal is a small rounded bead-like architectural moulding. Used historically on doors, furniture and staircase details as a decorative bead line." },
  { q: "What is a dado rail on a staircase?", a: "A dado is the lower section of a wall. A dado rail is a horizontal rail that traditionally protected and decorated the lower wall. On a staircase, it may follow the stair angle up the wall to provide a decorative transition and protect the wall from wear." },
  { q: "What is a housed string?", a: "A housed string has the treads and risers housed into grooves cut into the string. It is a traditional joinery method. The tread and riser fit into matched grooves and are held tight with wedges and glue blocks — a strong, quiet, movement-free connection." },
  { q: "What is a wreathed handrail?", a: "A wreathed handrail is a handrail built around a curve or turn — 'wreath' meaning a curved form. Used on curved stairs, spiral transitions and complex staircases. Manufacture often requires laminated timber, specialist bending or CNC machining." },
  { q: "What are glue blocks on a staircase?", a: "Small timber blocks added underneath joints to reduce movement, strengthen connections and prevent squeaks. Common locations: tread-to-riser joints, corners and returns. A quiet staircase usually indicates accurate fitting, good preparation and correct fixing — glue blocks contribute to all three." },
  { q: "Where does the word 'tread' come from?", a: "From the action 'to tread' — meaning to step or walk on. The tread is the horizontal walking surface of a staircase." },
  { q: "Where does the word 'riser' come from?", a: "From 'to rise'. The riser is the vertical height between two treads. Together with the going (horizontal distance), the riser creates the staircase angle." },
  { q: "Where does the term 'going' come from in staircase terminology?", a: "From 'going forward' — it describes the horizontal movement of the foot. The going controls comfort, walking rhythm and staircase pitch." },
  { q: "What is the pitch line of a staircase?", a: "An imaginary line connecting the front edges of the stair treads — the line showing the angle of ascent. It represents the walking path and is used for staircase calculations, headroom checks and design drawings." },
  { q: "What is a stairwell?", a: "A stairwell originally meant the vertical opening containing the staircase — the well hole through the floor that allows the staircase to pass between levels. Today people also use it to mean the staircase area or stair enclosure. The stairwell affects headroom, landing design and balcony railing." },
  { q: "What is a well hole on a staircase?", a: "The well hole is the opening through the upper floor that allows the staircase to pass through. It sets the boundary for the staircase geometry — the size of the well controls how much horizontal run and headroom are available." },
  { q: "Where does the word 'spiral staircase' come from?", a: "Named because the staircase follows a spiral curve — similar to spiral shells, coils and natural growth patterns. The movement rotates around a centre point." },
  { q: "Where does the word 'helical staircase' come from?", a: "From 'helix' — a three-dimensional curve found in nature (DNA · spiral shells · plant growth). A helical staircase rises while continuously curving." },
  { q: "Where does the word 'bifurcated' come from?", a: "From Latin: bi = two, furca = fork. Together they mean 'to divide into two branches'. A bifurcated staircase splits into two directions." },
  { q: "What is a newel post?", a: "The word 'newel' comes from old architectural terminology. A newel is the main vertical post supporting the handrail, balustrade and staircase transitions. Common positions are starting newel, landing newel, intermediate newel and finishing newel." },
  { q: "What is a turned newel post?", a: "'Turned' means shaped on a lathe — the timber rotates while being carved. A turned newel has decorative round profiles. Used on traditional and Victorian staircases." },
  { q: "What is a square newel post?", a: "A square newel remains square in cross-section rather than being turned on a lathe. Common on modern stairs and contemporary oak designs where clean architectural lines are preferred." },
  { q: "What is an acorn newel post?", a: "An acorn newel has a top decoration shaped like an acorn. Common on traditional Victorian staircases and classic timber stairs." },
  { q: "What is a ball newel?", a: "A ball newel has a spherical decorative top — a decorative feature rather than a structural requirement." },
  { q: "What is a pilaster newel?", a: "A pilaster is a decorative flat column attached to a wall. A pilaster newel is a newel that appears integrated into a wall or side structure, styled like a pilaster." },
  { q: "What is a finial on a staircase?", a: "A finial is an ornamental finishing piece — historically used on furniture, architecture and staircases. Examples include carved newel tops and decorative rail endings." },
  { q: "What is a dropped finial?", a: "A dropped finial is a decorative ending that curves downward at the end of a handrail. The name comes from the visible drop at the end of the rail." },
  { q: "What is an easing on a staircase handrail?", a: "An easing is a curved handrail section that allows the hand to move naturally between directions. The word means 'to make a transition smoother'. Used for level turns, stair turns and changing handrail angles." },
  { q: "What is a cut string staircase?", a: "A cut string staircase has the string cut to follow the shape of the steps — the step profile is visible from the side. The name describes the manufacturing method: the string is cut so the tread ends become part of the visible design." },
  { q: "What is a closed string staircase?", a: "A closed string staircase has the steps enclosed between two solid side boards — the string closes the side of the staircase and hides the tread ends. Common in traditional houses, carpet stairs and painted staircases." },
];

const universal_path = "data/nex-universal-qa.json";
const universalDoc = JSON.parse(readFileSync(universal_path, "utf8"));
const universalByQ = new Map(universalDoc.qa.map((x, i) => [norm(x.q), i]));
let uniAdded = 0, uniUpdated = 0;
for (const item of UNIVERSAL_EXTRA) {
  const key = norm(item.q);
  if (universalByQ.has(key)) { universalDoc.qa[universalByQ.get(key)] = item; uniUpdated++; }
  else                       { universalDoc.qa.push(item); uniAdded++; }
}
universalDoc.updated_at = now;
writeFileSync(universal_path, JSON.stringify(universalDoc, null, 2), "utf8");

// ─── REPORT ─────────────────────────────────────────────────────────────
console.log("=== STRINGER expansion ===");
console.log(`  stringer.json          · added ${stringer_result.added} · filled ${stringer_result.filled} · TOTAL ${stringer_result.total} Qs · ${stringer_result.authored} authored`);

console.log("\n=== FAMILY TAXONOMY ===");
console.log(`  ${familyAdditions} new family_ids added to nex-families.json`);
for (const [id, r] of Object.entries(family_results)) {
  console.log(`  ${(id + ".json").padEnd(24)} · added ${String(r.added).padStart(2)} · filled ${String(r.filled).padStart(2)} · TOTAL ${r.total} Qs · ${r.authored} authored`);
}

console.log("\n=== UNIVERSAL TERMINOLOGY ===");
console.log(`  added ${uniAdded} · updated ${uniUpdated} · total ${universalDoc.qa.length} Qs · ${universalDoc.qa.filter(x => x.a && x.a.trim().length > 0).length} authored`);

const totalNew = stringer_result.added + Object.values(family_results).reduce((s, r) => s + r.added, 0) + uniAdded;
console.log(`\nGRAND TOTAL new authored Q&As: ${totalNew}`);
