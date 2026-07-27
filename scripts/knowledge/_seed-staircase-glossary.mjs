#!/usr/bin/env node
// Batch 3 staircase seed — GLOSSARY / DEFINITIONS.
// Fills the gap where the brain talks *about* staircase parts, joints
// and design types in context but has no clean "what is X?" entry a
// homeowner would land on from a direct search.
//
// Focus: terminology, joints, design types, measurement terms.
// Skips the ~140 later-block Qs (buying process, timber choice, costs,
// site visits, install issues) — already covered by Batch 1+2.
//
// Voice: Nex workshop-warm but shorter and more definition-shaped than
// procedural entries. Every entry = clean one-line definition + why it
// matters/practical context, direct-you, contractions.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

const NEW = [
  // ─── Basic parts ─────────────────────────────────────────
  { q: "What are the main parts of a staircase called?",
    a: "A staircase is one structure made of a handful of named parts: the TREAD (the flat bit you stand on), the RISER (the vertical board between treads), the STRING (the long side member the treads and risers slot into), the NEWEL POST (the big post at the bottom, top and any turns), the BALUSTERS or SPINDLES (the vertical rods below the handrail), the HANDRAIL (what you hold), and — in traditional construction — WEDGES that lock the joints tight. Knowing those seven words means you can describe almost any staircase question to a joiner without hand-waving.",
    audience: 1, classification: "industry_good_practice" },

  { q: "What is a staircase tread?",
    a: "The tread's the horizontal board you actually stand on — the flat step surface. It takes more wear than any other part of the staircase because every footstep lands on it, which is why the tread's the first place you'll see finish wear, dents or the walking line darkening over the years. On a hardwood staircase the tread is usually the thickest, densest piece of timber in the whole flight.",
    audience: 1, classification: "expert_observation" },

  { q: "What is a staircase riser?",
    a: "The riser's the vertical board between one tread and the next — it closes the gap between steps and sets the step height. A staircase with risers is a 'closed-riser' staircase (the classic look); one without them (open gaps between treads) is 'open-riser', a more modern style. Building Regs still apply to open risers — the gap can't be big enough for a 100 mm sphere to pass through, for the same reason baluster gaps are limited.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a staircase string?",
    a: "The string's the long timber member down each side of the flight that carries the treads and risers — think of it as the staircase's spine. It takes almost all the structural load, transferring it from the treads down to the floor and up to the landing trimmer. When people say a staircase feels 'solid' or 'wobbly', they're usually feeling the string.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a staircase stringer?",
    a: "Same thing as a string — 'stringer' is the North American term, 'string' is British. Both mean the long side member that carries the treads. If you're reading American staircase advice online, mentally swap 'stringer' for 'string' and everything else translates the same way.",
    audience: 3, classification: "industry_good_practice" },

  { q: "What is a housed-string staircase?",
    a: "A traditional staircase construction where the treads and risers slot into grooves (housings) cut into the string, and are locked in place with timber wedges tapped in from underneath. It's the strongest, quietest and most repairable way to build a timber staircase — and if you ever hear a well-built old staircase described as 'as good as new after 100 years', it's almost always a housed-string one.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a cut-string staircase?",
    a: "A staircase where the string is cut in a zig-zag along its top edge to follow the step profile, so the edges of the treads and risers are visible from the side rather than hidden inside a groove. It's more decorative and shows off the shape of the flight, often paired with a mitred riser and a return nosing. Traditionally used on the 'open' show-side of a hallway staircase where the string's on display.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a closed-string staircase?",
    a: "A staircase where the string runs as a straight, solid board along the side and the treads sit hidden inside grooves cut into it — so from the side, you don't see the step edges at all. It's the more common, more traditional look for the wall-side of a staircase and produces a clean, enclosed appearance. Most standard timber staircases have closed strings against walls.",
    audience: 3, classification: "expert_observation" },

  { q: "What is an open-string staircase?",
    a: "A staircase where the string is cut to follow the step profile and you can see the edges of the treads and risers from the side (see: cut string). Usually used on the show-side of a flight — the side facing into the room, where the shape is a design feature. The wall-side of the same staircase is often a closed string.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a central-spine staircase?",
    a: "A modern design where the treads are supported by a single structural member running under the middle of the flight — usually a steel spine or a chunky glue-laminated timber beam — rather than the traditional two side strings. It gives that clean, floating look without visible side supports, but the engineering behind it (particularly the tread-to-spine fixings) is meaningfully more complex than a traditional flight.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a newel post on a staircase?",
    a: "The newel's the big vertical post at the bottom of the staircase, at the top landing, and at every turn or change of handrail direction. Everything in the balustrade system — handrail, base rail, spindles — ties back to it. The newel is what transfers the sideways loads from someone leaning on the handrail down into the floor, so if a newel feels loose the whole balustrade feels loose. It's also often the biggest design statement on a traditional staircase.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a newel cap on a staircase?",
    a: "The decorative top that sits on the newel post — a turned ball, a flat cap, a pyramid, an acorn, whatever the design calls for. It's a finishing detail, not structural, but it's what most people notice first about the newel. Traditional homes often have turned oak or mahogany caps; modern designs favour a flat square cap or no cap at all.",
    audience: 2, classification: "industry_good_practice" },

  { q: "What is a staircase finial?",
    a: "A decorative ornament that sits on top of a newel post — carved acorns, turned balls, spikes, urns, whatever the design demands. It's basically an elaborate newel cap on Victorian and Georgian staircases and pretty much a lost art on most modern ones. If you're restoring a period staircase, a matching finial is often the detail that sells the whole thing.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a staircase baluster?",
    a: "The vertical rods (or 'spindles' if you prefer the everyday word) between the handrail and either the base rail or the top of the string. They close the balustrade so a person — especially a child — can't fall through, and they transfer the sideways load from anyone leaning on the handrail down into the string. Approved Doc K limits the maximum gap to 100 mm so a 100 mm sphere can't pass through.",
    audience: 2, classification: "safety_advice" },

  { q: "What's the difference between a baluster and a spindle on a staircase?",
    a: "They're the same thing — spindle is the everyday word, baluster is the architectural one. Some joiners will use 'spindle' for a plain, turned or square vertical member and reserve 'baluster' for shaped or carved ones on more traditional staircases, but nine times out of ten they mean the same component.",
    audience: 2, classification: "industry_good_practice" },

  { q: "What's the difference between a newel post and a baluster on a staircase?",
    a: "Size and structural job. The NEWEL is the big post — usually 90 mm × 90 mm or bigger — that sits at the bottom of the flight, at every turn, and at the top landing, and takes the structural load of the balustrade. The BALUSTER (or spindle) is the smaller vertical rod between newels — usually 32 mm-41 mm square — that fills the gap and stops falls. Every balustrade has two newels at the ends and typically dozens of balusters in between.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a staircase handrail?",
    a: "The rail that runs alongside the flight for you to hold. It sounds obvious, but a good handrail has to be at a comfortable grip diameter (usually about 45-50 mm), securely fixed so it doesn't move when you lean on it, at the right height (Approved Doc K sets the numbers), and continuous over the whole flight and any landing. Handrails are as much a safety component as a design one.",
    audience: 1, classification: "safety_advice" },

  { q: "What is a staircase balustrade?",
    a: "The whole protective barrier system down the side of a flight and around any open landing: handrail on top, balusters (spindles) filling the gap, base rail at the bottom (sometimes), and newel posts anchoring both ends. It's the entire assembly, not just one part — 'the balustrade' is what you're looking at when you look at the side of the staircase from an open room.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a staircase landing?",
    a: "A flat platform between two flights of stairs, or at the top of the staircase where it meets the upper floor. Landings do three jobs: break up a long flight so it's more comfortable to climb, let the staircase change direction (a quarter- or half-turn), and provide safe access to first-floor rooms. Approved Doc K sets minimum landing dimensions — usually at least the width of the flight.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a staircase flight?",
    a: "A continuous run of steps between one floor (or landing) and the next, with no landings breaking it up. A simple straight staircase from ground to first floor is one flight. A half-turn staircase with a landing halfway is two flights. Building Regs limit the maximum number of steps in one flight (in a domestic staircase, usually 16 max) so you don't end up with a lung-buster.",
    audience: 3, classification: "expert_observation" },

  // ─── Measurements & dimensions ──────────────────────────
  { q: "What is the rise of a staircase step?",
    a: "The rise is the vertical height from the top of one tread to the top of the next — the height you lift your foot for each step. Under Approved Doc K, a private (domestic) staircase can have a rise of up to 220 mm and no less than 150 mm, and every rise in the flight must be the same to within a few millimetres. Uneven rises are the number-one cause of stair trips.",
    audience: 2, classification: "safety_advice" },

  { q: "What is the going of a staircase step?",
    a: "The going is the horizontal depth of each tread from the front of one riser to the front of the next — the flat distance your foot has to land on. Approved Doc K sets a minimum of 220 mm on a domestic staircase. Combined with the rise, the going determines how comfortable and how steep the staircase feels — a shallow going with a tall rise feels much steeper than the numbers suggest.",
    audience: 2, classification: "expert_observation" },

  { q: "Why must every rise on a staircase be the same height?",
    a: "Because your body memorises the first step and expects every one after it to be identical. If one riser's 190 mm and the rest are 200 mm, your foot lands where it isn't expecting the tread and you trip — usually on the down-flight, which is when trips do the most damage. Approved Doc K allows a maximum variation of only a few millimetres across a flight, and Building Control will actually measure it on inspection.",
    audience: 2, classification: "safety_advice" },

  { q: "What is the pitch of a staircase?",
    a: "The pitch is the angle the flight makes with the floor — measured as the angle of the string. Under Approved Doc K, a private staircase can go up to 42 degrees; steeper than that and it's classed as a 'space-saver' or ladder-type stair with additional rules. Steeper feels more like a ladder and takes less floor space; shallower feels more like a walking staircase and needs more room.",
    audience: 3, classification: "expert_observation" },

  { q: "What is staircase headroom?",
    a: "The clear vertical space above the flight — from the pitch line (the imaginary line running along the nosings) up to the underside of whatever's above (ceiling, soffit, upper floor). Approved Doc K requires a minimum of 2 metres of headroom above a domestic staircase. Headroom is often what forces a redesign on a loft-conversion staircase, because the sloping roof cuts into the space.",
    audience: 3, classification: "expert_observation" },

  { q: "What is the walking line of a staircase?",
    a: "An imaginary line about 270 mm out from the inside handrail — roughly where a person's centre of gravity travels as they use the flight. It matters most on WINDER stairs and CURVED stairs, where the tread going has to be measured along the walking line, not at the widest part of the step, so the tread's the right depth where your foot actually lands. Get the walking line wrong and a curved staircase feels awful to use.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "What is the staircase opening (stairwell) in a building?",
    a: "The hole in the upper floor's structure that the staircase passes through — bounded by the joists and the trimmer beam at the top of the flight. It has to be the right size and in the right place, because it determines where the staircase can physically go and how much headroom the top steps get. Getting the opening wrong is one of the most expensive things to fix on a build.",
    audience: 3, classification: "expert_observation" },

  { q: "What is the floor-to-floor height on a staircase project?",
    a: "The vertical distance from the finished-floor level of the lower floor to the finished-floor level of the upper floor. It's the single most important measurement in the whole staircase order — it dictates the number of steps, each individual rise, and everything derived from that. Miss it by 10 mm and every step in the flight is out by 10 mm ÷ number-of-steps. Always measure to FINISHED floor levels (including any planned carpet, LVT or tile), not the bare subfloor.",
    audience: 3, classification: "manufacturer_guidance" },

  // ─── Nosings, edges & decorative details ────────────────
  { q: "What is a staircase nosing?",
    a: "The front edge of the tread that projects slightly beyond the riser below — usually rounded or bevelled. It gives your foot more landing area than the tread depth alone, helps you feel where the step edge is, and reduces the risk of catching a toe on the riser. On most staircases the nosing projects 15-25 mm; on cut-string staircases the nosing usually 'returns' round the exposed side of the tread as a decorative detail.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a nosing return on a staircase?",
    a: "The decorative continuation of the tread's front nosing round the side of the tread on the open (show) side of a staircase. It's a joinery detail on cut-string staircases where the tread's side is on view — the nosing profile carries round in a mitre so the shape looks continuous rather than sawn off. It's a small detail but a hallmark of quality joinery on traditional flights.",
    audience: 4, classification: "expert_observation" },

  { q: "What is a bullnose step on a staircase?",
    a: "The bottom step of a flight, made wider than the ones above and rounded at one or both ends — often paired with a curved section of handrail (a volute) landing on top of it. It's a decorative flourish that makes the entrance to the staircase feel more generous, and it's the traditional way to soften the base of a flight in a hallway. Not structural — pure design.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a curtail step on a staircase?",
    a: "A more elaborate bottom step that extends and curves outwards beyond the normal staircase width, often with a scrolled shape that follows the volute of the handrail above it. It's the grand-entrance version of a bullnose — traditional Georgian and Victorian staircases used curtail steps to visually announce the base of the flight. Rare on new modern builds; common on restoration work.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a staircase volute?",
    a: "A curved, spiral-shaped section of handrail at the bottom of a flight — the handrail sweeps out and curls into a decorative scroll over the bottom newel or curtail step. Traditional Georgian and Victorian staircases love a volute; modern minimalist designs almost never use one. Beautifully machined volutes are one of the most skilled bits of joinery on a period staircase.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a handrail turnout on a staircase?",
    a: "A gentler cousin of a volute — the handrail curves outwards at the bottom of the flight rather than spiralling. It softens the entrance to the staircase without going full Victorian. Common on Edwardian and Arts-and-Crafts style staircases and a nice middle-ground detail when a full volute would feel too fussy.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a staircase apron lining?",
    a: "A finishing board fitted where a staircase meets the surrounding upper floor — round the edge of the stairwell opening on the underside. It hides the raw ends of the floor joists and gives a clean visual line between the opening and the ceiling below. Pure finish carpentry, not structural.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a staircase string return?",
    a: "The neat finishing detail at the end of an exposed cut-string, where the string ends with a proper returned mould rather than an ugly sawn-off face. On any open-sided flight where the string end's on view, a proper string return is one of the details that separates a factory-made staircase from a joinery-made one.",
    audience: 4, classification: "expert_observation" },

  // ─── Joints and construction ────────────────────────────
  { q: "What is a staircase wedge?",
    a: "A shaped piece of timber (a thin triangular wedge) tapped into the housing slot in the string to lock a tread or riser tight in place. The tread sits in the string's groove, the wedge goes in behind it, and the taper of the wedge forces the joint tight. It's the traditional way of building a wedged staircase and centuries of proven use say it works. When wedges shrink or work loose with age, they're the usual cause of squeaks.",
    audience: 3, classification: "expert_observation" },

  { q: "What is an angle block on a staircase?",
    a: "A small triangular timber block glued and pinned into the corner where the underside of a tread meets the back of the riser below. Its job is to lock that joint square and stop it flexing when weight lands on the tread. Angle blocks are what most joiners check first when a mystery squeak appears — they age, glue lets go, and the block starts moving.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a housed joint on a staircase?",
    a: "A joint where one component (usually a tread or riser) fits into a groove cut into another (usually the string). Housed joints are stronger than surface-mounted ones because the load's carried by the timber of both parts rather than just the fixings. Traditional wedged staircases are all housed-joint construction.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a glue block on a staircase?",
    a: "A small timber block glued (and sometimes pinned) into a corner or joint to add stiffness and strength — most commonly used under treads, behind risers and in the corners where the string meets the newel post. Traditional staircase construction uses lots of them; a well-made staircase has more hidden glue blocks than most homeowners would ever guess.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a staircase soffit?",
    a: "The underside of the staircase — the sloping surface you see when you stand under the flight and look up. It can be left open on a traditional staircase (so you can see the strings, wedges and angle blocks), covered with plasterboard to create a smooth diagonal ceiling under the flight, or turned into a decorative feature. Understair cupboards are built INTO the soffit space.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a staircase void?",
    a: "The open vertical space beside or around the staircase — the hole through which the flight passes, and any open landing area with a drop. Any open side of a void that a person could fall through needs balustrading to Approved Doc K, at least 900 mm high on a domestic staircase and 1100 mm on a landing overlooking a drop of more than 600 mm.",
    audience: 3, classification: "safety_advice" },

  // ─── Design types & configurations ──────────────────────
  { q: "What are the main types of staircase design?",
    a: "The common domestic ones: STRAIGHT (one continuous flight), QUARTER-TURN (turns 90° with either a landing or winders), HALF-TURN (turns 180° with a landing — also called dog-leg), WINDER (turns using wedge-shaped steps instead of a landing), SPIRAL (curves around a central column), OPEN-PLAN or FLOATING (minimal structure, glass or steel balustrading), and SPLIT (one flight up, then divides into two). The right one depends on your floor plan, your budget and how much space you're prepared to give up to the staircase.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a straight staircase?",
    a: "The simplest design — one continuous flight running in one direction from lower floor to upper floor, with no turns and no landing. Easy to fit, easy to use, easy to move furniture up, cheapest to make. Downside: it takes up a long, narrow rectangle of floor space, which many houses can't spare. If you have the run, a straight flight is often the best answer.",
    audience: 1, classification: "expert_observation" },

  { q: "What is a quarter-turn staircase?",
    a: "A staircase that changes direction by 90° — either using a small quarter-landing or a set of winder steps. Common in UK houses because it fits into an L-shaped hallway and takes up less linear floor space than a straight flight. Winder version saves the most space but eats into tread going on the turn; landing version's more comfortable but needs a bit more room.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a half-turn staircase?",
    a: "A staircase that reverses direction — 180° — usually with a half-landing between the two flights (a proper landing) or a set of winders at the turn. Also called a 'dog-leg' when it doubles back on itself. It's a very compact way of getting between floors because the flight sits over itself, which is why terraced houses use them so often.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a dog-leg staircase?",
    a: "A traditional half-turn staircase where two flights run in opposite directions with a half-landing between them. Named because from above it looks like a dog's back leg. It's the most common configuration in UK terraced houses because it fits neatly over a downstairs corridor, and it feels natural to use because the landing gives you a rest halfway.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a winder staircase?",
    a: "A staircase that turns direction using wedge-shaped triangular steps instead of a landing — the inner edge of each step is narrower, the outer edge wider, so the flight rotates as you climb. Saves floor space compared to a landing-turn but the geometry has to be designed carefully so the going along the walking line stays consistent — get it wrong and the turn feels awkward or unsafe.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a spiral staircase?",
    a: "A staircase that curves round a central post (the newel) so the whole flight forms a helix. Takes the smallest footprint of any staircase design and can look stunning, but they're harder to use daily (no consistent handrail angle, tighter tread going near the centre), can't move large furniture up them, and Approved Doc K restricts them as the ONLY staircase to an occupied floor unless certain conditions are met. Great as a secondary staircase; risky as the main one.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What is an open-plan or open-riser staircase?",
    a: "A staircase built without riser boards — just treads sitting on stringers or a central spine, with visible gaps between each step. Modern, light, lets you see through the staircase. Approved Doc K applies: the gap between treads can't allow a 100 mm sphere through, which either means very shallow open gaps or a fitted spacer/plate on the back of each tread. Great in bright open-plan spaces; feels wrong in a cottage.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a floating staircase?",
    a: "A staircase where the treads appear to be suspended in mid-air — no visible strings, no risers, sometimes no handrail on the open side. Usually achieved with a hidden steel structural spine bolted into a load-bearing wall, or by cantilevering the treads out of the wall itself. The 'floating' look is a design choice; the engineering behind it is anything but simple, and structural sign-off from an engineer is essential.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is a split staircase?",
    a: "A staircase that starts as one flight from the ground floor, arrives at a large landing partway up, then splits into two separate flights heading in opposite directions to the upper floor. Grand-entrance stuff — you see them in period country houses, hotel lobbies and larger new-builds. Beautiful, but needs a lot of floor area to work.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a traditional staircase style?",
    a: "A staircase with the classic joinery vocabulary: timber handrail, turned or square balusters, decorative newel posts (often with turned caps or finials), closed risers, mouldings on the string, and usually a hardwood or painted-softwood finish. The look sits happily in Victorian, Georgian, Edwardian and cottage-style homes and it's the default 'staircase-shaped staircase' most people picture.",
    audience: 1, classification: "expert_observation" },

  { q: "What is a modern staircase style?",
    a: "A staircase built to clean, minimal lines — often with glass balustrades, steel or hidden fixings, open risers, simple square-section handrails and either painted timber or natural oak treads. 'Modern' doesn't mean less safe or less structural — Approved Doc K still applies. It means fewer decorative details, more emphasis on the geometry.",
    audience: 1, classification: "expert_observation" },

  { q: "What is a standard staircase — as opposed to bespoke?",
    a: "A staircase built to a standard set of dimensions (usually a common floor-to-floor height, standard tread going and rise) that a supplier holds stock of, or produces in batches. Fits where the property matches those standard dimensions — usually new-build houses designed around a standard stair size. Faster and less expensive than bespoke, but any variation in your floor height and it won't fit.",
    audience: 2, classification: "expert_observation" },

  { q: "What is an attic or loft staircase?",
    a: "A staircase (or ladder-type stair) specifically for reaching a loft or attic conversion. Depending on how the loft's being used, options range from a proper compliant flight (needed if the loft's a habitable room) down to a fold-away loft ladder (fine for storage-only access). If Building Control's involved because it's a habitable conversion, Approved Doc K applies just like any other staircase.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What is a space-saver or paddle staircase?",
    a: "A staircase with alternating cut-away treads — one narrow half for the left foot, the next narrow half for the right — that lets you fit a steep 60°-ish flight into a footprint smaller than a normal staircase. Approved Doc K allows them only in very specific situations (usually a loft conversion accessing one habitable room, with restrictions) — not permitted as a main staircase to a full floor. Practical for tight lofts, awkward for everyone forever.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is a staircase bracket?",
    a: "A small decorative or supporting piece fitted underneath a tread nosing where the tread projects over a cut string — traditionally a scroll-carved timber bracket that fills the triangular space and adds a classic detail. On modern staircases the bracket is often either omitted or replaced with a plain moulded return; on Victorian and Georgian originals, brackets are a hallmark of the period.",
    audience: 3, classification: "expert_observation" },

  // ─── Why terminology matters ────────────────────────────
  { q: "Why does knowing basic staircase terminology matter for a homeowner?",
    a: "Because 'the wobbly bit at the bottom' can mean five different components depending on who's listening. If you can say 'the newel post at the bottom of the flight is loose in its base fixing', a joiner knows exactly what to look at before they've even walked through the door. Ten minutes learning tread/riser/string/newel/baluster/handrail/wedge saves hours of email ping-pong on any staircase question.",
    audience: 1, classification: "expert_observation" }
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
console.log(`✅ Batch 3 (glossary): Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
