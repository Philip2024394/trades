// Survey Brain + Base Rail Brain · Philip 2026-08-02.
// Two NEW specialist component brains built per stop-enlarging-universal rule.
// Backfills survey + base-rail component tags on every design so both brains
// fire when nothing more specific matches.
//
// Rule A · every answer Philip verbatim. Idempotent.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const now = new Date().toISOString();
function norm(s) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }

function mergeInto(path, newQAs, meta = {}) {
  let doc;
  if (existsSync(path)) doc = JSON.parse(readFileSync(path, "utf8"));
  else doc = { version: 1, ...meta, qa: [] };
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

// ─── SURVEY BRAIN · 40 authored ────────────────────────────────────────
const SURVEY = [
  { q: "What is a staircase survey?", a: "A staircase survey is a detailed inspection and measurement of the building before manufacture begins. Its purpose is to understand the building, the structure, the available space, access, floor levels and customer requirements. The survey provides the information used to create the manufacturing drawings — every stage that follows (design, manufacturing, installation, finishing) depends on its quality." },
  { q: "Why is the survey the most important stage of a staircase project?", a: "Because a staircase is only as accurate as the survey it is built from. Every later stage — design, manufacturing, installation and finishing — depends on the quality of the survey. The survey is not simply measuring a stair opening; it is collecting all the information needed to design a staircase that fits safely, accurately and efficiently. If the survey is wrong, every later stage is affected." },
  { q: "What is the surveyor's job?", a: "The surveyor is responsible for collecting accurate information — never guessing. If something cannot be confirmed on site, it should be investigated before manufacturing begins. Incorrect assumptions are one of the most common causes of manufacturing errors." },
  { q: "What does a surveyor check before entering the building?", a: "Before taking a single measurement, the surveyor should understand what staircase has been ordered, whether it's new build or renovation, the material (timber · steel · concrete), the shape (straight · quarter-turn · winder · curved), the balustrade (glass · timber · steel), whether the design is already approved, whether drawings are available and whether the customer has requested changes. Understanding the project first determines what information is required." },
  { q: "What is the first thing a surveyor should confirm on site?", a: "Whether the structural works are complete enough to survey accurately. Has the stair opening been formed? Are structural beams installed? Are floor joists complete? Is the landing structure finished? Surveying too early may result in inaccurate information." },
  { q: "What is a survey datum?", a: "A datum is a consistent reference point used throughout the survey — commonly the finished ground floor level, the structural floor level or the finished first floor level. Every important measurement should relate back to the same reference. Without a consistent datum, measurements become inconsistent and errors compound through the design." },
  { q: "Why are finished floor levels critical to a staircase survey?", a: "Because the staircase connects finished floors, not just structural floors. The critical question is 'what WILL the finished floor level be?' — not 'what is the floor level today?' Future finishes (timber flooring, carpet, tiles, engineered flooring, vinyl, underlay) can significantly change the finished floor height. Measure the FINAL surface, or record clearly what future build-ups still need to be added." },
  { q: "What is the most critical dimension in a staircase survey?", a: "The finished floor level to finished floor level height. This measurement determines the total rise, the individual riser heights and the staircase geometry. An incorrect floor-to-floor height affects every step in the staircase." },
  { q: "How does a surveyor check that a stair opening is square?", a: "By measuring the length, width and both diagonals of the opening. If the diagonals differ significantly, the opening is not square. Do not assume the opening is perfectly rectangular — measure it. This helps the designer understand the actual shape rather than the intended one." },
  { q: "What should a surveyor check about the walls beside a staircase?", a: "Plumb, straightness, thickness, projections, columns and any services running in them. The staircase must fit the actual walls, not the assumed walls. A wall that leans can affect the fit and appearance of the finished staircase." },
  { q: "Should surveyors just measure, or also observe?", a: "Observe as carefully as they measure. Experienced surveyors constantly notice fresh plaster, unfinished flooring, exposed services, temporary supports, structural alterations and signs of movement. Observation often identifies problems before measurements do — the tape measure gives numbers, but the eyes give context." },
  { q: "Why are photographs part of a professional survey?", a: "Measurements tell you the size; photographs tell you the story. Good survey photographs cover the overall room, the stair opening, the ceiling, the walls, the floor, the access route, the existing staircase (if applicable) and any unusual details. They help designers and workshop staff understand the site without visiting." },
  { q: "Should a surveyor rely on memory?", a: "No. Professional surveyors record dimensions, notes, sketches and photographs. Even experienced surveyors do not rely on memory alone — a staircase may not be manufactured for several weeks after the survey, and details can blur." },
  { q: "What are common survey mistakes?", a: "Measuring to unfinished floors instead of finished floor levels · forgetting floor coverings · assuming walls are square · missing steel beams · overlooking pipes or cables · measuring from different reference points · incomplete photographs · surveying before the building is ready. Many staircase problems originate from mistakes at this early stage." },
  { q: "Are two houses built from the same plans identical for surveying?", a: "No — never assume they are. Even houses built from the same plans differ because of construction tolerances, settlement, alterations, flooring choices, plaster thickness and customer changes. Every staircase should be surveyed on its own merits unless there is verified information showing otherwise." },
  { q: "What should a surveyor look for that has changed since drawings?", a: "Moved walls · lowered ceilings · additional boxing · thicker plaster · different flooring · relocated doors · structural alterations. Recognising changes since the drawings were produced is one of the most valuable survey skills — these changes may require revisions to the staircase design." },
  { q: "Should a surveyor think about installation while measuring?", a: "Yes. Experienced surveyors imagine bringing the finished staircase into the building. Can the strings fit through the front door? Can the handrail turn the hallway corner? Is there enough space to rotate a landing section? Will glass panels fit through the opening? If access is impossible, the manufacturing strategy may need to change — planning delivery routes during the survey is essential." },
  { q: "Should a surveyor also think like a designer?", a: "Yes. The surveyor should also consider handrail height, headroom, sight lines, customer preferences and building proportions. The survey is about creating a staircase that both fits and looks appropriate — not just one that meets the dimensions." },
  { q: "How does a surveyor record uncertainty in a survey?", a: "Professional surveyors distinguish between CONFIRMED ('I measured this'), ESTIMATED ('this is based on current information') and UNKNOWN ('this cannot be confirmed until later'). Unknown information should never be presented as fact. Recording uncertainty honestly is more professional than pretending certainty." },
  { q: "Why do experienced surveyors measure twice?", a: "Because a common workshop principle is 'measure twice, record once'. If two measurements disagree, stop and find out why before recording anything. Never average two conflicting measurements — investigate the cause." },
  { q: "Should a surveyor chain small measurements together?", a: "Where possible, also take an overall measurement rather than adding four or five small ones. Small errors accumulate — 1200 + 800 + 950 + 1100 might total something different from a single direct measurement of the same distance. A direct overall measurement often reveals accumulated errors." },
  { q: "Why should survey measurements always be cross-checked?", a: "Because professional surveyors rarely rely on a single measurement. Length + width + both diagonals of a stair opening reveal whether it's square. Cross-checks catch mistakes that single measurements miss." },
  { q: "What is the difference between structural and decorative dimensions on a staircase survey?", a: "Structural dimensions (concrete · masonry · timber structure) are the load-bearing elements the staircase must fit against. Decorative finishes (skirting · architraves · trims) can usually be modified more easily. Where appropriate, surveyors distinguish the two so designers know what is fixed and what can be adjusted." },
  { q: "Should survey notes include labels?", a: "Yes. Avoid writing just '2450' — record 'Floor opening length = 2450 mm'. Every dimension should identify what it represents. This reduces the risk of misinterpretation weeks later when the drawing is being produced." },
  { q: "Should customers' guessed measurements be used for manufacturing?", a: "No. Customers sometimes say 'It's about 3 metres' or 'It's roughly 900 wide' — these estimates can be useful during early discussions but manufacturing should rely on verified survey measurements, not approximations." },
  { q: "What does a surveyor check before leaving the site?", a: "Measurements, sketches, photographs and notes. The key question is 'could someone else manufacture this staircase using only the information I've collected?' If the answer is no, additional information may be needed. The survey is complete only when questions are answered — not when the tape measure is packed away." },
  { q: "Should a surveyor design the staircase on site?", a: "No. The surveyor provides the information needed for design; the designer determines rise and going, staircase geometry, string design, handrail layout and component dimensions. In some companies the same person performs both roles, but they are still separate responsibilities." },
  { q: "What should a surveyor do if the customer asks for a design change on site?", a: "Record the request and follow the company's design approval process. The surveyor should not treat significant design changes as survey notes alone, because they may affect pricing, engineering and manufacturing. The customer request is captured; the change goes through the normal approval workflow." },
  { q: "Should a surveyor hide problems they discover?", a: "No. Professional surveyors do not ignore issues in the hope they disappear. If they discover insufficient headroom, restricted access, structural conflicts or uncertain dimensions, they record the issue clearly and communicate it promptly. Early communication gives the team time to develop a solution." },
  { q: "Why should a surveyor consider delivery during the survey?", a: "Because one of the first questions an experienced surveyor asks is 'how will we get this staircase into the building?' They consider front door width, hallway turns, ceiling height, narrow corridors, tight stairwells, scaffolding, external access and crane access if required. Sometimes the delivery route determines how the staircase must be manufactured — in sections rather than as one piece." },
  { q: "Why should a surveyor also look above and below the staircase?", a: "Above: beams, sloping ceilings, roof trusses, dormers, bulkheads, lighting, smoke detectors, sprinkler systems — anything that may influence headroom or installation. Below: what supports the staircase (timber joists · concrete slab · steel framework · existing stair support). Understanding the supporting structure helps determine suitable fixing methods." },
  { q: "Should a surveyor talk to the customer during the survey?", a: "Yes. Surveying is not only measuring. It also involves understanding what the customer likes, how they use the home, future flooring choices, preferred finishes, whether there are children or pets and maintenance expectations. A staircase should suit both the building and the people using it." },
  { q: "Why do good survey notes save the company time?", a: "Because they support estimating, design, manufacturing, finishing, logistics, installation and aftercare. Poor surveys create questions ('What does this measurement refer to?' · 'Which wall is this?' · 'Is the floor finished?' · 'Can you return to site?'). A well-documented survey reduces uncertainty and helps every stage progress smoothly." },
  { q: "What is a surveyor thinking backwards from installation?", a: "They imagine the last day of the project. Will the installer have enough room? Can the staircase be assembled easily? Where will the joints be? Will the glass go in after the timber? Can tools be used comfortably? Is there enough working space? Thinking backwards helps identify issues long before manufacturing begins." },
  { q: "Should every measurement on a staircase survey have a purpose?", a: "Yes. Professional surveyors know why they are taking each measurement. Floor-to-floor height determines total rise. Opening length determines available going. Opening width influences staircase width and clearance. Wall position affects strings, handrails and fixings. Every measurement should answer a design question." },
  { q: "Which staircase dimensions are critical vs supporting?", a: "Critical measurements directly influence geometry and structural fit — finished floor-to-floor height, stair opening dimensions, landing positions. Supporting measurements provide context — skirting thickness, door swing, radiator positions. Both matter, but critical dimensions deserve the highest level of verification." },
  { q: "Why should a surveyor never rush?", a: "One of the biggest causes of survey mistakes is rushing. A professional surveyor works at a steady pace — five extra minutes spent checking can prevent weeks of delay in manufacturing. Time spent surveying carefully is rarely wasted." },
  { q: "What should a surveyor do if something on site looks wrong?", a: "Investigate. Experienced surveyors trust their instincts enough to stop and check. A floor that appears to slope more than expected, a stair opening that seems unusually narrow, a wall that appears out of plumb, drawings that don't match the building — the correct response is not to guess but to understand why. If it doesn't look right, verify before writing the number down." },
  { q: "Should a surveyor be afraid to ask builders questions?", a: "No — asking questions demonstrates thoroughness, not inexperience. Professional surveyors regularly ask 'has the floor finish been decided?' · 'is this wall complete?' · 'will this beam remain exposed?' · 'is this opening final?' Clarifying uncertainty early reduces later problems." },
  { q: "For whom should survey notes be written?", a: "For someone who has never visited the site. Imagine another designer or installer opening the survey file months later. Would they understand what was measured, what was observed and what remains uncertain? Survey notes should be clear enough that another experienced colleague can continue the project without needing the original surveyor to explain them." },
  { q: "Are all survey tools the same across companies?", a: "No. Some surveyors use tape measures, laser distance meters, spirit levels and digital levels; others combine traditional methods with modern equipment. The objective is consistent, reliable information — not any particular tool. The choice depends on the project, the surveyor's experience and the practices of the staircase company. There is no single correct surveying method, only the requirement to gather accurate information suitable for designing and building the staircase." },
];

const survey_result = mergeInto("data/nex-component-qa/survey.json", SURVEY, {
  layer: "component",
  component_id: "survey",
  component_label: "Staircase Survey · Site Measurement · Datum · Verification",
  note: "Layer 2 · COMPONENT · Survey Brain (Philip 2026-08-02). Foundation of every staircase project. Every stage that follows — design, manufacturing, installation, finishing — depends on the quality of the survey. Rule A · every answer verbatim.",
  cross_brain_links: ["installation", "geometry", "concrete-staircase"],
});

// ─── BASE RAIL BRAIN · 20 authored ─────────────────────────────────────
const BASE_RAIL = [
  { q: "What is a base rail on a staircase?", a: "A base rail is the horizontal timber fitted beneath the balusters. It normally sits between newel posts, on a landing, on a balcony, or on top of a string depending on the staircase design. Its main purposes are to support the balusters, keep them aligned, provide a fixing point, improve appearance, and create a continuous lower rail." },
  { q: "Why is it called a base rail?", a: "Because it forms the base of the balustrade. Think of the balustrade as a frame — handrail at the top, balusters in the middle, base rail at the bottom. The base rail is literally the bottom rail of that assembly." },
  { q: "What is a shoe rail?", a: "A shoe rail is another name for the base rail. The name comes from traditional joinery — the base rail acts like a shoe that the balusters sit inside, supporting and locating the bottom of each baluster. Base rail is the more widely used technical term today; shoe rail remains common in some regions and among certain manufacturers, particularly in North America." },
  { q: "Are base rail and shoe rail exactly the same thing?", a: "In many residential staircase companies, yes — the two names are used interchangeably. In some systems, 'base rail' refers to the timber rail itself while 'shoe rail' may describe a rail specifically designed to receive glass or balusters. The exact terminology varies between manufacturers and regions. Nex understands the context rather than assuming a universal definition." },
  { q: "What is an infill slip on a staircase balustrade?", a: "An infill slip is a narrow strip of timber inserted into the groove of the base rail after the balusters have been installed. It fills the remaining gap in the groove, creating a neat finished appearance and helping to secure the balusters." },
  { q: "Why does a balustrade need an infill slip?", a: "Without it, the groove would remain visible, balusters could have more movement within the groove, and the finished appearance would be less refined. The infill slip closes the groove, helps lock the balusters into position, conceals the fixing detail and provides a cleaner finish. It is both functional and decorative." },
  { q: "Is the infill slip the structural fixing that holds the balustrade together?", a: "No. The infill slip is not the primary structural fixing. The balustrade's overall strength comes from the complete system — newel posts provide the main anchorage, the handrail ties the balusters together, and the base rail locates their lower ends. The infill slip mainly retains the balusters within the groove and creates a clean finish." },
  { q: "Why is a continuous groove used instead of drilling individual holes for each baluster?", a: "Because a continuous groove is easier to machine, simpler to install, allows small spacing adjustments during assembly, and produces a cleaner appearance once the infill slip is fitted. Traditional spindle moulders and modern CNC machines can both produce this feature efficiently. This method has been used in staircase joinery for generations." },
  { q: "What size is a staircase base rail?", a: "There is no universal size — dimensions vary depending on baluster size, staircase style, manufacturer, timber species and design requirements. Common residential timber base rails are often designed to suit 32mm, 35mm or 41mm balusters. Overall rail dimensions vary between manufacturers and profile designs — no single fixed size is an industry standard." },
  { q: "How does the base rail system actually work during assembly?", a: "Machine the base rail → machine the continuous groove → leave the groove open → install and align the balusters into the groove → fit the handrail → check spacing and alignment → fit the infill slip. If the infill slip were installed first, the balusters could not be inserted into the groove. The sequence is deliberate." },
  { q: "Is the base rail structural or decorative?", a: "Both. It is a functional joinery component that supports alignment and assembly AND contributes to the balustrade's appearance. Its exact dimensions, profile and construction vary according to the staircase design, materials and the manufacturer's preferred methods. It is not 'only decorative' — it plays a real engineering role in locating the balusters." },
  { q: "Why is the groove in the base rail described as a datum?", a: "In engineering, a datum is a consistent reference point. The groove acts as a datum for the balusters — every baluster begins from the same reference line. This helps achieve consistent spacing, uniform height and straight alignment, contributing to manufacturing accuracy." },
  { q: "How does the base rail reduce cumulative error along a balustrade?", a: "Imagine fitting twenty balusters individually without a continuous groove — a very small positioning error on each baluster could accumulate along the balustrade. The grooved base rail helps control this by providing a continuous reference that keeps the balusters aligned during assembly." },
  { q: "How does the base rail fit into the balustrade load path?", a: "When someone leans on a handrail, the force travels through the balustrade: handrail → balusters → base rail → string or landing → newel posts → structure of the building. The base rail helps transfer and distribute loads within the assembled system, but the primary anchorage is normally provided by the newel posts and their fixings." },
  { q: "Why do some modern staircases have no visible base rail?", a: "Contemporary designs sometimes conceal or eliminate the traditional base rail — for example glass held in a recessed channel, steel balustrades with welded connections, or floating staircases with hidden fixings. Although the appearance changes, the engineering requirement remains the same: the balustrade still needs a secure method of locating and supporting its infill elements." },
  { q: "Do glass balustrades use a base rail?", a: "Glass balustrades may use a grooved base rail. Instead of individual balusters, the groove receives laminated glass, toughened laminated glass, or glazing packers and gaskets depending on the system. The principle is similar — the rail supports and locates the infill panel, whether it is timber or glass." },
  { q: "Why does a base rail have a specific profile shape?", a: "Base rails are produced in many profiles — square, chamfered, ogee, traditional moulded, contemporary minimal. The visible profile usually matches the style of the handrail, newel posts and staircase to create a consistent design language. Historically, mouldings such as ogee, ovolo and chamfer became popular because they reflected the design language of their period." },
  { q: "Is a base rail required on every staircase?", a: "No. Not all staircases use a traditional timber base rail. Structural glass systems, steel balustrades, cable balustrades and some contemporary minimalist designs use different methods of supporting and locating their infill elements. The underlying principle remains the same — every balustrade requires a secure method of supporting and aligning its safety components." },
  { q: "How can you tell the quality of a base rail installation?", a: "By details: straight and even rail lines · consistent baluster spacing · neat infill slip joints · smooth profile transitions · accurate mitres at corners. These details reflect the care taken during manufacture and assembly. The base rail is one of the elements experienced staircase makers judge closely." },
  { q: "Was the grooved base rail invented for CNC machinery?", a: "No — the groove and infill slip system was developed long before CNC machinery existed. Traditional joiners using spindle moulders, routers and hand tools relied on this method because it was accurate, repeatable and practical. Modern CNC machines can produce the same system with greater automation, but they refined an established joinery principle rather than inventing it." },
];

const rail_result = mergeInto("data/nex-component-qa/base-rail.json", BASE_RAIL, {
  layer: "component",
  component_id: "base-rail",
  component_label: "Base Rail · Shoe Rail · Infill Slip",
  note: "Layer 2 · COMPONENT · Base Rail Brain (Philip 2026-08-02). Covers base rail, shoe rail (regional name), infill slip, groove-and-slip system, load path contribution, glass system application. Cross-links to baluster, handrail, newel. Rule A · verbatim.",
  cross_brain_links: ["baluster", "handrail", "newel", "balustrade-glass"],
});

// ─── BACKFILL TAGS ON EVERY DESIGN ──────────────────────────────────────
// Survey applies to every staircase project. Base-rail applies to every
// staircase that has a balustrade. Both are safe to tag on all 29 designs.
const IMG = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(IMG, "utf8"));
let tagsAdded = 0;
for (const rec of d.confirmed) {
  rec.components = Array.isArray(rec.components) ? rec.components : [];
  if (!rec.components.includes("survey"))    { rec.components.push("survey"); tagsAdded++; }
  if (!rec.components.includes("base-rail")) { rec.components.push("base-rail"); tagsAdded++; }
  if (!rec.components.includes("installation")) { rec.components.push("installation"); tagsAdded++; }
}
d.updated_at = now;
writeFileSync(IMG, JSON.stringify(d, null, 2), "utf8");

// ─── REPORT ─────────────────────────────────────────────────────────────
console.log("=== SURVEY BRAIN (NEW) ===");
console.log(`  survey.json    · added ${survey_result.added} · filled ${survey_result.filled} · TOTAL ${survey_result.total} Qs · ${survey_result.authored} authored`);
console.log("\n=== BASE RAIL BRAIN (NEW) ===");
console.log(`  base-rail.json · added ${rail_result.added} · filled ${rail_result.filled} · TOTAL ${rail_result.total} Qs · ${rail_result.authored} authored`);
console.log("\n=== TAG BACKFILL ===");
console.log(`  ${tagsAdded} new component tags added across ${d.confirmed.length} designs (survey · base-rail · installation)`);
console.log(`\nGRAND TOTAL new authored Q&As: ${survey_result.added + rail_result.added}`);
