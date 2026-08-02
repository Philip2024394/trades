// Component Brain Expansion · Philip 2026-08-02.
//
// Merges Philip's verbatim authored Q&A pairs into 8 component-brain files
// (newel · handrail · baluster · balustrade-glass · stringer · tread · riser · landing).
// Idempotent · preserves any existing empty slots · dedupes on normalized Q text.
//
// Rule A · every answer is Philip's verbatim words. No LLM synthesis.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "data/nex-component-qa";
const now = new Date().toISOString();

function norm(s) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }

function mergeInto(filename, newQAs) {
  const path = join(DIR, filename);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  doc.qa = Array.isArray(doc.qa) ? doc.qa : [];

  const byQ = new Map(doc.qa.map((x, i) => [norm(x.q), i]));
  let added = 0, filled = 0, alreadyAuthored = 0;

  for (const item of newQAs) {
    const key = norm(item.q);
    if (byQ.has(key)) {
      const existing = doc.qa[byQ.get(key)];
      if (!existing.a || existing.a.trim().length === 0) {
        existing.a = item.a;
        filled++;
      } else if (existing.a !== item.a) {
        existing.a = item.a; // overwrite with newest verbatim
        alreadyAuthored++;
      }
    } else {
      doc.qa.push(item);
      added++;
    }
  }

  doc.updated_at = now;
  writeFileSync(path, JSON.stringify(doc, null, 2), "utf8");
  const total = doc.qa.length;
  const authored = doc.qa.filter((x) => x.a && x.a.trim().length > 0).length;
  console.log(`  ${filename.padEnd(24)} · added ${String(added).padStart(2)} · filled ${String(filled).padStart(2)} · updated ${String(alreadyAuthored).padStart(2)} · TOTAL ${total} Qs · ${authored} authored`);
  return { added, filled, alreadyAuthored, total, authored };
}

// ─── NEWEL BRAIN ───────────────────────────────────────────────────────
const NEWEL = [
  { q: "What is a newel post?", a: "A newel post is the main structural upright of a staircase balustrade. It anchors the handrail, controls direction changes, terminates the balustrade at each end, and transfers loads into the building structure. It is not simply a decorative upright — it is the anchor of the balustrade system." },
  { q: "What is the purpose of a newel post?", a: "A newel provides handrail support, direction change, termination point, visual balance, and structural stability. Newels are commonly used at the top, bottom, and turning points of stair balustrades because they provide the structural fixing points for the handrail system." },
  { q: "What are the main newel post locations on a staircase?", a: "The main newel positions are the starting newel (bottom of the staircase, controls entry appearance and handrail beginning), the top or landing newel (transition from slope to level and connection to the balcony), the corner newel (where the direction changes on L-shaped, U-shaped or balcony corners), and intermediate newels (used on long runs, commercial applications, or where extra support is needed)." },
  { q: "Why is the top newel one of the most important parts of a staircase?", a: "Because it is responsible for supporting the handrail change of direction, stabilising the balustrade, connecting the staircase to the balcony, transferring loads into the structure, and creating the visual finish of the staircase. The top newel is often the point where the staircase becomes part of the upper-floor architecture." },
  { q: "Why are newels more important than balusters?", a: "Newels are larger structural posts designed to carry and transfer forces. Balusters mainly fill the space between supports and prevent falls. The main strength of the balcony and balustrade system comes from the newels and their fixings." },
  { q: "Where is the strongest place to fix a newel post?", a: "The strongest fixing is into the structural part of the staircase opening — the trimmer, stair opening edge, or structural floor member — rather than only into decorative flooring. The strength comes from the building structure, not the visible floor covering." },
  { q: "Why should a newel post be cut down over the landing edge?", a: "Extending the newel down over the landing edge and fixing it into the trimmer provides a stronger structural connection. The strength comes from the building structure, not from the finished floor surface alone." },
  { q: "Is fixing a newel only into the finished floor strong enough?", a: "Usually this is not considered best practice because finished flooring may not provide enough structural support. A newel should transfer loads into the underlying structure — the visible floor is often only a finish (carpet, engineered flooring, laminate, tiles) which is not structural." },
  { q: "Why can hidden metal centre-bar newel fixing be risky?", a: "A concealed metal bar system can work when properly engineered, but it may hide weaknesses. Without correct depth, fixing and structural support, the post may appear stronger than it actually is. Hidden does not automatically mean stronger, safer or better." },
  { q: "Why should the top newel be larger than a normal baluster?", a: "A newel is not a decorative spindle — it is a structural post. Balusters fill the opening and support spacing. The newel anchors the system, receives handrail forces, resists movement, and transfers loads into the structure. A balcony without properly fixed newels is only appearance." },
  { q: "Can a balcony be built without newel posts?", a: "Some modern systems can use engineered glass clamps, metal frames, or hidden structural systems. However, traditional timber staircase balconies normally rely on newel posts because they provide visible support and strong fixing points." },
  { q: "Should every corner of a balcony have a newel post?", a: "Normally a change of direction requires a strong support point. Corners create additional forces because the handrail changes direction. A corner newel provides stability and a secure joint." },
  { q: "What happens when a newel is fixed incorrectly?", a: "Movement at the base, a loose handrail, cracking around flooring, squeaking, and a customer who feels unsafe. The correct principle is that the finished floor covers a structural trimmer, and the newel fixes into the trimmer — not into the finished floor alone." },
  { q: "What does 'plumb' mean for a newel post?", a: "A component is plumb when it is perfectly vertical. A newel post should normally stand vertically unless the design specifically requires another angle. A leaning newel indicates a problem — either in the newel itself, its fixing, or the staircase structure." },
  { q: "Why might a newel post look out of plumb?", a: "Several causes: the newel itself may be twisted (natural timber movement · poor storage · moisture change · internal stress) or bowed (curved along its length); the stringer may be out of plumb (the string controls the staircase line — a leaning string makes the newel appear leaning); the floor may not be level; the fixing may be loose or not fully seated; the staircase structure may have moved (timber movement · settlement · weak connection); or there may be manufacturing tolerance issues (inaccurate cutting · incorrect machining · poor joint preparation)." },
  { q: "How does a professional check a newel post for alignment?", a: "The inspection sequence is: (1) check the newel itself — is it straight, twisted, bowed? (2) check the fixing — is the base secure, seated correctly, well connected? (3) check the staircase structure — is the string straight, the tread line correct, the staircase level? (4) check the handrail — does it flow correctly with smooth transitions?" },
  { q: "Why can a twisted newel post make the handrail look wrong?", a: "A twisted timber newel may have one face aligned correctly while another face appears rotated. When viewed from the top, a correct newel is square; a twisted one appears as a diamond. Even if the base is fixed correctly, the twist can make the handrail joint or balustrade appear uneven." },
  { q: "What is a bowed newel post?", a: "A bowed newel curves along its length. Even with a correct base fixing, a bowed newel can make the handrail appear uneven because the mid-section deviates from a straight vertical line." },
  { q: "Should I immediately adjust a newel that leans?", a: "No. Do not immediately adjust the newel without checking the cause. If the stringer is wrong and the newel is forced straight, other parts of the balustrade may become misaligned. The cause must be diagnosed first, then corrected at its source." },
  { q: "Why is a starting newel important?", a: "The starting newel is the first visual feature of the staircase and the anchoring point for the handrail. It controls staircase entry appearance, the handrail beginning, the first baluster arrangement, and provides the structural fixing for the entire balustrade run." },
  { q: "Why is a corner newel important on a balcony?", a: "A corner creates a change of direction. The handrail is now resisting forces from two directions — pushing, pulling and twisting. A corner newel provides the strong joint required for that change and keeps the balcony rigid." },
  { q: "Why do luxury staircases use larger newels?", a: "Not only for strength. A larger newel provides visual importance, architectural balance, craftsmanship appearance, and stronger transition points. A generously proportioned newel signals that the staircase was designed as one complete piece." },
  { q: "What is the newel post priority order?", a: "Structure first, handrail connection second, appearance third. A newel that looks beautiful but is poorly fixed is a failed newel. A newel that is correctly anchored, well connected to the handrail, and visually balanced is a successful newel." },
];

// ─── HANDRAIL BRAIN ────────────────────────────────────────────────────
const HANDRAIL = [
  { q: "What is a handrail?", a: "The handrail is the component designed for the human hand to follow and support movement. It provides guidance, comfort, safety, and visual connection. It is the part of the staircase where the user physically interacts with the design." },
  { q: "What are the common handrail profiles?", a: "Common profiles include the mopstick (round, comfortable, traditional grip), oval (soft-handed, transitional), pyramid (traditional joinery detail), square (modern, matches square balusters), and contemporary rectangular (architectural, minimal, modern staircases). Materials range from oak, walnut and ash to painted timber and modern metal." },
  { q: "What is a mopstick handrail?", a: "A mopstick is a rounded handrail profile that provides a comfortable grip and a traditional appearance. It is commonly used on classic oak staircases and painted staircases." },
  { q: "What is a square handrail?", a: "A square handrail has a rectangular profile with flat faces, giving a modern architectural appearance. It matches naturally with square balusters and is common on contemporary staircases." },
  { q: "Why does handrail size matter?", a: "Because it affects grip comfort, appearance, strength and proportion. A very thin handrail may look elegant but feel weak. A very thick handrail may overpower the staircase. Premium design balances comfort with visual proportion." },
  { q: "Should the handrail flow continuously from staircase to balcony?", a: "Where possible, yes. A premium staircase design allows the handrail to flow continuously from the staircase, through the top newel post, and around the balcony. This creates a connected architectural line and improves user comfort. The user's hand follows one uninterrupted path from bottom step to landing return." },
  { q: "Why should a handrail flow continuously?", a: "Because the user follows one uninterrupted path. The eye also follows the line. When the handrail is interrupted with a random ending, the staircase feels unfinished. When it transitions smoothly through the top newel into the balcony, the staircase feels like one designed feature." },
  { q: "What is a wall-mounted handrail?", a: "A wall-mounted handrail is used where the staircase is between walls or where one side has no balustrade. It is fixed with brackets into the wall structure rather than terminating into a newel." },
  { q: "How does the handrail transition at the top of a staircase?", a: "The angled stair handrail transitions into a horizontal landing handrail. The top newel post acts as the structural and visual bridge between the two directions." },
  { q: "What makes a poor handrail transition?", a: "A random or interrupted ending, misaligned joints, gaps, uneven junctions, or a handrail that stops abruptly at the top newel without continuing into the balcony." },
  { q: "What makes a good handrail transition?", a: "A smooth transition, correct alignment, continuous flow, and a clear anchor at the top newel that carries the rail into the horizontal balcony run." },
  { q: "Should the balcony handrail match the staircase handrail?", a: "Usually yes. An oak staircase pairs with an oak handrail and oak newels. A stainless staircase pairs with a stainless handrail and stainless supports. A black steel staircase pairs with a black steel handrail. Material continuity keeps the staircase feeling designed as one piece." },
  { q: "Should the handrail return to a newel or wall?", a: "In traditional timber staircases, usually yes. The handrail normally terminates into a newel post, corner post or wall return. Modern systems may use glass channels, metal posts or concealed endings — the termination must still be secure." },
  { q: "Why does the handrail feel important on a glass balcony?", a: "Because the glass is visually light. The handrail provides the touch point, direction, comfort and finishing line. Even if the glass is engineered strong, people naturally look for something to hold — the handrail creates the human connection." },
  { q: "What does the handrail profile control on a staircase?", a: "It controls grip comfort, staircase character (traditional / modern / architectural), material continuity, and the way the eye reads the staircase. Different profiles create different staircase personalities — a mopstick reads as traditional, a square rail reads as modern." },
  { q: "Can a curved handrail be manufactured?", a: "Yes. Curved handrails are specialist joinery work. They may require laminating, bending, steam bending, or segmented construction. Straight handrails are easier to manufacture; curved handrails need experienced staircase makers." },
];

// ─── BALUSTER BRAIN ────────────────────────────────────────────────────
const BALUSTER = [
  { q: "What is a baluster?", a: "A baluster is the vertical member between the base rail or tread and the handrail. Its purpose is to prevent falls, support the handrail, maintain spacing, and contribute to the stiffness of the balustrade system." },
  { q: "What is the main job of a baluster?", a: "A baluster provides safety by preventing falls, supports the handrail, maintains spacing, and contributes to the stiffness of the balustrade system." },
  { q: "Are all balusters structural?", a: "Not always. Some decorative balusters mainly fill the opening, while others are designed as structural supports. The design determines whether the strength comes primarily from the balusters or from the newels and rails alone." },
  { q: "Are thin turned balusters as strong as square balusters?", a: "Not automatically. A correctly designed turned baluster can be strong, but square balusters usually have more consistent material thickness and better resistance to twisting and bending. Strength depends on material, cross-section, length, fixing method, dowel diameter, dowel depth, glue connection, spacing and handrail connection — the shape alone does not determine strength." },
  { q: "What is the advantage of square balusters?", a: "Square balusters provide consistent strength, easier fixing, better alignment, modern appearance, and greater resistance to twisting. They give clean architectural lines and stronger visual weight — common in contemporary oak stairs, painted staircases and commercial designs." },
  { q: "What is the advantage of turned balusters?", a: "Turned balusters provide traditional character, decorative appearance, softer visual style and visible craftsmanship. They suit Victorian styles, Georgian designs, classic oak staircases and heritage restoration." },
  { q: "Where is the weakest point of a baluster?", a: "The weakest points are usually the connections — the top handrail joint, the bottom fixing point, and any narrow turned sections where material has been reduced. The weakest area of a turned baluster is often the smallest diameter section, which controls the overall strength." },
  { q: "Why can a decorative turned baluster become weak?", a: "Excessive turning removes material. Thin necks, sharp transitions, or small-diameter sections concentrate stress. When sideways force is applied, the weakest thin area receives the highest stress and can fail first." },
  { q: "Where should a turned baluster keep extra thickness?", a: "In the bottom fixing area, the top fixing area, any narrow turning sections, and the transitions between decorative and structural zones. Decoration belongs between structural zones — it should never remove material from a load-carrying section." },
  { q: "Should turned balusters maintain a minimum thickness?", a: "Yes. The turning design should maintain enough timber thickness through structural areas. Decorative shaping should not reduce the strength of the baluster." },
  { q: "Are gradual curves better than sharp reductions on a turned baluster?", a: "Yes. A gradual transition spreads forces more evenly through the timber. Sudden thin sections create stress concentration points and become weak areas under sideways force." },
  { q: "What is a dowel-ended baluster?", a: "A dowel-ended baluster has a reduced round projection that fits into a drilled hole in the tread, landing, base rail or handrail. The strength comes from the dowel diameter, insertion depth, glue surface area and tightness of fit." },
  { q: "What determines the strength of a dowel connection?", a: "Strength depends on the dowel diameter, insertion depth, timber quality, glue surface area, accuracy of drilling, and the tightness of the fit." },
  { q: "Why can a small dowel create a weak connection?", a: "Because the dowel transfers all sideways forces through a small area. If the dowel is too small, too shallow, or poorly fixed, movement can develop over time." },
  { q: "Is glue alone enough to fix a baluster?", a: "Glue helps create the connection, but a professional staircase relies on correct mechanical fit, adequate depth, and structural design. Glue should not compensate for poor fixing." },
  { q: "Why do balcony balusters loosen over time?", a: "Common causes include timber movement, seasonal expansion and contraction, insufficient glue area, poor fitting, and repeated sideways loading." },
  { q: "What affects baluster spacing?", a: "Spacing affects safety, appearance and proportion. Too much spacing gives weak visual protection and an unsafe appearance. Too little spacing gives a heavy appearance and reduced elegance. Standard practice controls openings so a person — especially a child — cannot pass through, and many regions reference a maximum opening around 100mm as a guiding principle. Actual requirements depend on country, building type and regulation." },
  { q: "Why do commercial staircases prefer square or robust balusters?", a: "Because public users create unpredictable loads and repeated impact. Commercial designers avoid wide gaps, flexible balusters and decorative-only systems. A commercial balustrade should feel solid — square steel balusters, stainless rods, engineered glass and robust timber sections are common choices." },
  { q: "Why can too many thin balusters still feel weak?", a: "A designer may think more balusters equals stronger — not always. If every spindle has a weak fixing, the system can still move. Strength comes from correct fixing, correct material, and correct connections, not only from quantity." },
  { q: "Can a thin turned spindle be stronger than a thicker square one?", a: "It depends on material, design and fixing. A well-made turned spindle with good timber and strong joints may perform well, but removing too much material during turning reduces its strength. The fixing and material grade matter more than the raw thickness." },
];

// ─── BALUSTRADE-GLASS BRAIN ────────────────────────────────────────────
const BALUSTRADE_GLASS = [
  { q: "What is a glass balustrade?", a: "A glass balustrade is a balustrade system where glass panels are used instead of traditional timber or metal balusters. The glass is not the structure by itself — the complete system is the balustrade, including handrail, glass panel, clamps or channel or posts, base fixing, and the building structure beneath. Nex describes this as a 'glass balustrade system', never as 'glass attached to the floor'." },
  { q: "What are the main types of glass balustrade systems?", a: "The three main types are (1) post-and-glass systems with visible vertical posts, glass panels, clamps and a handrail; (2) frameless glass systems with a base channel, structural glass and an optional handrail; and (3) glass with timber newels — oak or hardwood newels flanking glass panels, common in premium homes because it combines traditional and modern language." },
  { q: "Is a glass balustrade weaker because it looks thinner?", a: "No. Engineered glass systems can be extremely strong. Strength comes from the glass specification, clamps, channels and structural fixing, not from the visible weight of the material." },
  { q: "Why is glass usually laminated on a staircase?", a: "Because safety glass systems are designed to remain safer after damage. Laminated glass contains layers that help hold the panel together. Glass in a staircase is an engineered safety component — not ordinary window glass." },
  { q: "Why is glass thickness important?", a: "Glass thickness depends on panel size, support method, loading requirements, building type and fixing system. A large unsupported glass panel requires different consideration than a small framed panel." },
  { q: "Does a glass balcony mean no newel posts?", a: "Not always. Framed glass systems use posts, clamps and handrail supports. Frameless glass systems use concealed channels, base shoes and engineered fixings. The structure is often hidden, but it still exists." },
  { q: "How does a glass balustrade transfer force?", a: "The force travels from the person pushing the handrail, down through the glass panels or supports, into the clamps or base channel, and finally into the floor structure. Every connection matters — a weakness at any point makes the whole system feel loose." },
  { q: "Why are base channels important on a frameless glass balustrade?", a: "The base channel holds the glass and transfers forces into the structure. Poor installation causes movement, glass vibration and an unsafe feeling. Correct installation feels rigid, stable and secure." },
  { q: "Why should glass balustrades be installed by specialists?", a: "Because errors can involve incorrect glass specification, wrong fixing depth, poor anchoring, incorrect alignment or unsafe connections — and the finished appearance can hide installation problems." },
  { q: "Can a glass balustrade hide weak fixing?", a: "Yes. A clean frameless appearance can hide the structural details. Nex always considers base fixing, glass support, connection points and load transfer — not just the visible glass." },
  { q: "Why do many glass balustrades still have a handrail?", a: "Because the handrail provides user confidence, a comfortable grip, a finishing detail and additional protection. Even if the glass is engineered strong, people naturally look for something to hold." },
  { q: "Why are glass balustrades popular in modern staircases?", a: "Because glass allows uninterrupted views, natural light, a floating appearance and minimalist design. It creates a more open feeling and makes spaces look larger — especially in double-height halls, luxury homes and modern renovations. A minimal appearance never means minimal engineering." },
  { q: "Why can a glass balustrade look weaker than timber?", a: "Because glass is visually transparent — the eye sees open space, thin edges and minimal supports. Strength actually comes from the glass specification, the fixing system and the structural connection, not from the visible weight of the material." },
  { q: "Can curved glass be used on a balustrade?", a: "Yes, but glass does not naturally bend unless specially manufactured. Solutions include segmented flat glass panels, curved laminated glass, a curved handrail, or multiple fixing points. The design must follow the staircase geometry precisely." },
];

// ─── STRINGER BRAIN ────────────────────────────────────────────────────
const STRINGER = [
  { q: "What is a stringer?", a: "The stringer is the supporting side member of a staircase. It carries the treads, risers and loads. It is the backbone of the staircase and defines how the staircase transfers force into the building structure." },
  { q: "What is a closed string staircase?", a: "A closed string staircase has a solid side board that conceals the tread ends. The side appears solid and traditional. Common in houses, renovations and carpet stairs. Often used with painted stairs where a clean enclosed appearance is preferred." },
  { q: "What is a cut string staircase?", a: "A cut string staircase has a shaped side board that follows the step profile — the tread ends are visible from the side. This is a decorative construction with a premium appearance, commonly used on oak stairs and luxury homes. It shows craftsmanship because the tread ends become part of the visible design." },
  { q: "What is a mono stringer staircase?", a: "A mono stringer staircase uses a single central steel support that carries the treads from below. It creates a floating modern appearance and is common in contemporary designs, often paired with open risers and glass balustrades." },
  { q: "What is a twin stringer staircase?", a: "A twin stringer staircase uses two parallel structural supports carrying the treads between them. It has an industrial style, handles stronger spans, and is common in steel staircase applications and commercial designs." },
  { q: "Can a staircase have no visible stringer?", a: "Yes. Floating stairs, concealed steel structures and cantilever stairs may hide the stringer entirely — but the support still exists. Floating appearance never means no structure; it means the structure is visually reduced or concealed." },
  { q: "Why does stringer design affect appearance?", a: "Because it changes visual weight, openness, and whether the staircase reads as modern or traditional. A closed string feels enclosed and classic; a cut string feels crafted; a mono string feels floating and modern; a twin string feels industrial." },
  { q: "Can a staircase between walls still have a stringer?", a: "Yes. A staircase between two walls may appear simple, but the strings can still be structural or decorative. Plasterboard or wall finish does not automatically mean there is no stringer — the timber support may run behind the finish." },
  { q: "Can a stringer be structural, decorative, or both?", a: "Yes to all three. An exposed timber string on a cut-string staircase is both structural and decorative. A concealed steel spine is structural but hidden. A decorative cover added over an existing structure is purely decorative. The visible material is not always the structural material." },
  { q: "What materials can a stringer be made from?", a: "Common structural stringers include C24 softwood, laminated timber (glulam), engineered timber, powder-coated steel plate, steel box section, and structural plywood for engineered systems. MDF is not recommended as a structural string but can be used as a decorative cover over a real string." },
  { q: "Why is the stringer called the backbone of the staircase?", a: "Because it carries the treads, transfers load to the structure, defines the staircase pitch and controls the line of the balustrade. A leaning or twisted stringer misaligns everything mounted on it — newels, balusters, handrail — so it is the first alignment reference in a staircase system." },
  { q: "Can the stringer make a newel post look out of plumb?", a: "Yes. The stringer controls the staircase line — if the string is leaning or incorrectly positioned, the newel mounted on it will also appear incorrect. Before adjusting a leaning newel, the stringer must be checked first." },
  { q: "How does a floating staircase get its support?", a: "Floating stairs use hidden structure: a concealed steel spine, wall brackets fixed into a reinforced wall, a hidden frame within the wall assembly, or a cantilever structure with steel embedded in the wall. The appearance is minimal, but the engineering is significant." },
];

// ─── TREAD BRAIN ───────────────────────────────────────────────────────
const TREAD = [
  { q: "What is a tread?", a: "The tread is the horizontal surface where the foot lands on a staircase. It receives the greatest wear from foot traffic and is one of the most important components in terms of appearance, comfort and durability." },
  { q: "What are the common tread materials?", a: "Common tread materials include solid hardwood (oak, walnut, ash, beech — premium, durable, refinishable), engineered timber (hardwood top layer on a stable engineered core — less movement, more economical), laminated timber (strips glued together — strong and stable), and glass (specialist engineered laminated construction with correct structural support). MDF is normally not recommended for the walking surface." },
  { q: "What is solid oak used for on a staircase tread?", a: "Solid oak treads are the premium choice — natural grain, high durability, can be refinished. Thickness matters (typically 32–45mm). Solid oak can move slightly with humidity, so acclimatisation before fitting is important." },
  { q: "What is engineered oak?", a: "Engineered oak has a 4–6mm oak wear layer on a multi-layer timber core with a stable backing. It is more dimensionally stable than solid oak, has less cupping and cracking, and performs better in environments with underfloor heating or humidity changes. The visible surface still appears as solid oak." },
  { q: "Should treads be made from MDF?", a: "Solid timber or engineered timber treads are generally preferred because they receive the greatest wear from foot traffic. While MDF may be suitable for some decorative parts of a staircase, walking surfaces are commonly manufactured from stronger timber-based materials designed for repeated use." },
  { q: "Why does tread thickness matter?", a: "Because it affects strength, deflection under load, screw and dowel holding, edge durability, and the visual weight of the staircase. A thin tread can flex or squeak under load; an overly thick tread can look heavy. Common structural thicknesses range from 32–45mm for solid oak treads." },
  { q: "Why do staircases squeak?", a: "A squeak usually means movement — two surfaces moving against each other. Common causes include a loose tread, timber shrinkage, insufficient glue, loose fixings, insufficient tolerances between tread and stringer, or movement between tread and riser. It is normally a fixing or timber-movement issue, not simply age." },
  { q: "Why do treads crack?", a: "Possible causes include moisture changes, weak or unsuitable timber, unsupported areas, and insufficient thickness for the span. Solid timber moves naturally with humidity — good acclimatisation and correct thickness reduce the risk." },
  { q: "What causes tread movement?", a: "Movement can come from timber expanding and contracting with humidity, loose fixings between tread and stringer, insufficient adhesive at joints, or inadequate wedges. Prevention involves correct material acclimatisation, tight machining, quality adhesive and correct fixing." },
  { q: "What is stair nosing?", a: "The nosing is the front edge of the tread. It affects foot placement, appearance and durability. Common styles include square (modern), bullnose (rounded traditional edge) and waterfall (timber flows continuously over the front, common in luxury stairs)." },
  { q: "Why is stair nosing important?", a: "Because it receives repeated foot impact, cleaning wear and edge damage. A well-formed nosing protects the tread edge and provides visual definition to each step. Sharp or thin nosings are vulnerable to chipping, impact damage and moisture entry." },
  { q: "Why can a sharp nosing fail?", a: "Because thin edges are vulnerable to chipping, impact damage and moisture entry. A slight radius (2–5mm round-over) is often used on modern stairs to improve durability without changing the appearance dramatically." },
  { q: "What is a waterfall nosing?", a: "A waterfall nosing is where the timber flows continuously over the front edge of the tread, creating a smooth uninterrupted line. It is common in luxury staircases and gives the tread a solid one-piece appearance." },
  { q: "Can oak on a staircase be refinished?", a: "Yes. Solid oak treads can be sanded and refinished multiple times over their lifetime. Engineered oak can be refinished depending on the thickness of the wear layer — a 4–6mm layer allows a limited number of refinishes." },
];

// ─── RISER BRAIN ───────────────────────────────────────────────────────
const RISER = [
  { q: "What is a riser?", a: "The riser is the vertical face between two treads. It affects the staircase appearance, the walking comfort, and the overall stair proportion." },
  { q: "What is a closed riser?", a: "A closed riser is a solid vertical board between steps. It creates a traditional, enclosed appearance, reduces visibility underneath, and gives cleaner architectural lines. Common in family homes and traditional staircases." },
  { q: "What is an open riser?", a: "An open riser stair has no vertical board between the treads — the gap allows light to pass through the staircase, creates a larger visual space, and gives a floating appearance. It is a deliberate design choice, not simply a missing part. Common in modern designs." },
  { q: "Should the riser match the tread?", a: "Not always. Many premium staircases use a solid hardwood tread (like oak) with a painted MDF riser — the oak provides durability where feet contact, and the painted riser provides a smooth, easy-to-refresh contrasting face. The riser can match the tread or contrast with it depending on the design intent." },
  { q: "What materials are used for stair risers?", a: "Common materials include MDF (very popular for painted risers — smooth finish, no knots, stable), solid timber matching the tread, plywood (used where extra strength is needed), painted timber, glass (for modern designs), and metal (feature stairs). MDF is the most common riser material on painted staircases because it delivers a factory-quality painted finish." },
  { q: "Are MDF risers acceptable on a staircase?", a: "Yes. Painted MDF risers are very common. Because risers are not walked on, they experience much less wear than treads, making MDF a practical choice in many staircase designs." },
  { q: "Are open riser staircases safe?", a: "Open riser staircases are used in many modern homes and follow the same design and safety principles as closed-riser stairs — with additional consideration for gap dimensions to prevent children passing through. Local building regulations control the allowable openings, so the design must be checked against your regulations." },
];

// ─── LANDING BRAIN ─────────────────────────────────────────────────────
const LANDING = [
  { q: "What is a staircase landing?", a: "A landing is the floor area where a staircase arrives or changes direction. It provides a rest point, allows direction changes, makes furniture movement easier, and connects the staircase to the upper floor. A landing is not wasted space — it is where staircase movement changes." },
  { q: "What are the main types of staircase landings?", a: "Half landing (changes direction halfway between floors), top landing (arrival point at the upper floor), and balcony landing (open edge protected by a balustrade). Each has a different structural and design role." },
  { q: "What is a half landing?", a: "A half landing changes the direction of the staircase halfway up. It is common on U-shaped and L-shaped stairs and provides both a comfortable rest point and a natural point to turn the staircase." },
  { q: "What is the difference between a landing and a balcony?", a: "The landing is the floor area where the staircase arrives. The balcony is the protected open edge of that landing. A landing may exist without a balcony — but a balcony exists because the landing has an exposed edge that needs protection." },
  { q: "What materials are used for a staircase landing structure?", a: "Structural plywood (18–22mm), solid timber floor boards, glulam beams, and engineered timber panels are common. MDF is NOT recommended as the structural landing board because it does not carry loads like structural timber or plywood. MDF may be used as a decorative finished surface over a structural landing, but not as the load-carrying board." },
  { q: "Is the landing part of the staircase?", a: "Yes. The landing is part of the staircase — not separate from it. It may include a balcony, glass guarding, and a handrail continuation. The staircase does not finish at the top step; it continues through the landing." },
  { q: "Why is the landing edge important on a balcony?", a: "Because the landing edge is where the balcony transfers forces into the building structure. It may contain a trimmer, joist, steel support or concrete slab — the balustrade fixing must connect into this structure, not just the finished floor." },
  { q: "What is a gallery landing?", a: "A gallery landing is a larger open landing overlooking another space — commonly a hallway or double-height entrance. Common in luxury homes, entrance halls and hotels — the balcony around a gallery landing becomes an architectural feature framing the space below." },
];

// ─── APPLY ALL MERGES ──────────────────────────────────────────────────
console.log("Component Brain Expansion · merging Philip verbatim answers...\n");
const results = {};
results.newel = mergeInto("newel.json", NEWEL);
results.handrail = mergeInto("handrail.json", HANDRAIL);
results.baluster = mergeInto("baluster.json", BALUSTER);
results["balustrade-glass"] = mergeInto("balustrade-glass.json", BALUSTRADE_GLASS);
results.stringer = mergeInto("stringer.json", STRINGER);
results.tread = mergeInto("tread.json", TREAD);
results.riser = mergeInto("riser.json", RISER);
results.landing = mergeInto("landing.json", LANDING);

const totalAuthored = Object.values(results).reduce((sum, r) => sum + r.authored, 0);
const totalQs = Object.values(results).reduce((sum, r) => sum + r.total, 0);
console.log(`\nTotal across 8 component brains · ${totalAuthored}/${totalQs} authored (Philip verbatim).`);
