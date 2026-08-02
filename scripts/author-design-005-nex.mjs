// Populate NEX-DESIGN-000005 (Contemporary Feature Spiral · Nex005) with
// Philip's authored design_notes + full customer question skeleton (Rule A ·
// answers stay EMPTY · Philip fills them).
//
// Rerun to update · idempotent overwrite.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));
const rec = d.confirmed.find((r) => r.design_id === "NEX-DESIGN-000005");
if (!rec) { console.error("NEX-DESIGN-000005 not found"); process.exit(1); }

rec.design_notes = `OVERALL TYPE
Contemporary premium spiral staircase with a central steel column · 360° rotation over multiple turns · designed as an architectural centrepiece in an open-plan luxury residence.

STRUCTURE
Central column: large diameter steel tube (approx 250-350mm) · powder-coated matt black · anchored into structural floor · extends continuously through ceiling opening · supports every tread individually · this is the primary structural member.
Outer curved band/string: heavy curved steel ribbon wrapping around the staircase · continuous spiral · smooth fabricated appearance · black powder-coated finish · provides structural stiffness · hides tread brackets · gives floating appearance.
Fixings: exact internal fixings not visible from image · likely welded steel fabrication with each tread individually bolted or welded to the centre column.

TREADS
Solid hardwood · dark stained · walnut appearance (could also be stained oak) · thick contemporary profile approx 50-70mm · wedge-shaped spiral treads · rounded exposed front nosing · open risers · floating appearance.

DIMENSIONS (estimated · CANNOT be confirmed from image alone)
Rise: 170-190mm (comfortable domestic spiral proportions).
Going (walking line): 220-260mm.
Overall diameter: approx 2100-2400mm (larger than compact kit spirals · more luxurious feel).
Approx two-storey height.

BALUSTRADE
Slim steel uprights (approx 20-30mm square) · multiple horizontal steel rods as infill (5-7 rails · likely 8-12mm dia stainless or powder-coated steel) · minimal visual obstruction · complies with modern residential safety spacing.
Note: NO glass panels present in the image.

HANDRAIL
Continuous curved timber handrail · circular/rounded ergonomic profile · smooth uninterrupted sweep following the spiral perfectly · likely manufactured from laminated curved timber (cannot be confirmed from image) · continuous from bottom to top.

LIGHTING
Warm white LED strip lighting beneath every tread · creates floating tread illusion + night lighting + architectural ambience · feature lighting also at base of column · likely hidden in routed channels · cable routing not visible.

FINISHES
Timber: natural oil or matte lacquer. Steel: fine textured matt black powder coat. Lighting: warm white.

CEILING OPENING
Large circular aperture · matches the staircase geometry · flush ceiling finish · finished with clean circular trim.

BASE
Circular matching timber platform (visual termination · floor protection · completes symmetry).

MANUFACTURING METHOD (typical for this class · not off-the-shelf)
CAD modelling → laser-cut steel components → roll curved steel skirt → fabricate centre column → CNC-machine timber treads → machine LED channels → manufacture curved handrail (laminated or steam-bent) → powder-coat steel → finish timber → trial-assemble in workshop → deliver in sections → install centre column → install treads → install balustrade → install handrail → connect lighting → final alignment + inspection.
Estimated build time: 6-10 weeks.
Estimated install time: 2-4 days.

MANUFACTURING COMPLEXITY
Very High. Requires CNC router · beam saw · wide-belt sander · metal bandsaw · tube roller · MIG/TIG welder · powder coating plant · spray booth. Not a single-workshop off-the-shelf item.

ADVANTAGES
Exceptional architectural impact · space-efficient footprint for the visual drama · open airy appearance · premium materials · excellent visual flow · integrated feature lighting · high-end contemporary aesthetic · becomes the centrepiece of the home.

DESIGN CHALLENGES
Precise structural engineering · curved steel fabrication · curved handrail manufacture · accurate site measurements · complex installation sequence · LED wiring through rotating geometry · building code compliance for spiral stairs · transportation of large curved components.

SUITABLE APPLICATIONS
Residential luxury homes · architect-designed houses · boutique commercial spaces · open-plan kitchen/living areas · double-height entrance halls · new-builds and high-end renovations.

WHAT IS VISIBLE VS INFERRED
Visible: overall configuration · black steel column · dark timber treads · curved outer skirt · horizontal-rod balustrade · timber handrail · LED tread lighting · circular ceiling opening.
Inferred (CANNOT confirm from image): exact timber species · exact steel grade/thickness · exact rise/going/diameter · exact fixing method · whether handrail is laminated or steam-bent.
Nex should be explicit about this distinction when answering customer questions.`;

rec.qa = [
  // General / Style
  { q: "What type of staircase is this?",                    a: "" },
  { q: "Is this a spiral staircase?",                        a: "" },
  { q: "Is it a helical staircase?",                         a: "" },
  { q: "What style is this staircase?",                      a: "" },
  { q: "Can this design fit my house?",                      a: "" },
  { q: "Would this work in a small space?",                  a: "" },
  { q: "Is this suitable for a luxury home?",                a: "" },
  { q: "Would this suit an open-plan kitchen/living area?",  a: "" },

  // Structure / Engineering
  { q: "What supports this staircase?",                      a: "" },
  { q: "Is everything supported by the centre column?",      a: "" },
  { q: "Is the outside steel structural or decorative?",     a: "" },
  { q: "Is the staircase self-supporting?",                  a: "" },
  { q: "How strong is the centre column?",                   a: "" },
  { q: "Does it require wall support?",                      a: "" },
  { q: "Does the handrail strengthen the staircase?",        a: "" },
  { q: "Why doesn't it wobble?",                             a: "" },
  { q: "What weight can it carry?",                          a: "" },
  { q: "Can several people stand on it at once?",            a: "" },

  // Materials
  { q: "What timber is used?",                               a: "" },
  { q: "Is this oak or walnut?",                             a: "" },
  { q: "Can I have oak instead?",                            a: "" },
  { q: "Can I have walnut?",                                 a: "" },
  { q: "Can I use ash or maple?",                            a: "" },
  { q: "Can I use engineered timber?",                       a: "" },
  { q: "Can the steel be white, bronze or stainless instead of black?", a: "" },
  { q: "Can I combine oak and black steel?",                 a: "" },
  { q: "What steel thickness is normally used?",             a: "" },

  // Handrail
  { q: "Is the handrail solid timber?",                      a: "" },
  { q: "How is the curved handrail made?",                   a: "" },
  { q: "Is the handrail laminated or steam-bent?",           a: "" },
  { q: "Can I have LED lighting in the handrail?",           a: "" },
  { q: "Can the handrail be metal instead of timber?",       a: "" },
  { q: "Can the handrail profile be changed?",               a: "" },

  // Balustrade
  { q: "Can I replace the metal rails with glass?",          a: "" },
  { q: "Can I use cable balustrades instead?",               a: "" },
  { q: "Can I use vertical balusters instead of horizontal rods?", a: "" },
  { q: "Can I remove the outer guard?",                      a: "" },
  { q: "Are the horizontal rails safe for children?",        a: "" },
  { q: "Can children climb through the balustrade?",         a: "" },

  // Treads
  { q: "Are the treads solid oak?",                          a: "" },
  { q: "How thick are the treads?",                          a: "" },
  { q: "Can the treads be thicker?",                         a: "" },
  { q: "Can the treads float more?",                         a: "" },
  { q: "Can I have closed risers?",                          a: "" },
  { q: "Can I fit carpet on the treads afterwards?",         a: "" },
  { q: "Can damaged treads be replaced individually?",       a: "" },

  // Lighting
  { q: "Are the LEDs built in?",                             a: "" },
  { q: "Can the lighting change colour or use RGB?",         a: "" },
  { q: "Can the lighting be dimmed?",                        a: "" },
  { q: "Are the LEDs replaceable if one fails?",             a: "" },
  { q: "How are the LED cables hidden?",                     a: "" },
  { q: "Can the lights be motion-activated?",                a: "" },

  // Dimensions / Planning
  { q: "What minimum floor opening is required?",            a: "" },
  { q: "How much floor space does this staircase need?",     a: "" },
  { q: "What ceiling height is suitable?",                   a: "" },
  { q: "How many treads will I need?",                       a: "" },
  { q: "Can it fit in a loft conversion?",                   a: "" },
  { q: "Can it fit into an existing ceiling opening?",       a: "" },
  { q: "What headroom is required?",                         a: "" },
  { q: "Does the ceiling opening have to be circular, or can it be square?", a: "" },

  // Installation
  { q: "Can this be installed after the house is built?",    a: "" },
  { q: "Does the floor need strengthening?",                 a: "" },
  { q: "How is the centre column fixed?",                    a: "" },
  { q: "How long does installation take?",                   a: "" },
  { q: "How many installers are needed?",                    a: "" },
  { q: "Does it arrive in one piece or sections?",           a: "" },
  { q: "How is it transported? Will it fit through my front door?", a: "" },
  { q: "Will walls need to be removed to install it?",       a: "" },
  { q: "Can it be dismantled and moved later?",              a: "" },

  // Safety / Regulations
  { q: "Is this safe for children?",                         a: "" },
  { q: "Can elderly people use it?",                         a: "" },
  { q: "Are spiral staircases difficult to climb?",          a: "" },
  { q: "Does the spiral make people dizzy?",                 a: "" },
  { q: "Can anti-slip strips be fitted?",                    a: "" },
  { q: "Does this meet UK building regulations?",            a: "" },
  { q: "Does this comply with California / US regulations?", a: "" },
  { q: "What handrail height is required?",                  a: "" },
  { q: "What balustrade spacing is allowed?",                a: "" },

  // Design options / Customisation
  { q: "Can this be made wider or narrower?",                a: "" },
  { q: "Can I reduce the diameter?",                         a: "" },
  { q: "Can it turn the opposite way?",                      a: "" },
  { q: "Can I remove the centre column?",                    a: "" },
  { q: "Can the outer string be timber instead of steel?",   a: "" },
  { q: "Can I add storage underneath?",                      a: "" },
  { q: "Can I add a landing?",                               a: "" },
  { q: "Can Nex generate similar designs with different materials or layouts?", a: "" },

  // Cost
  { q: "Approximately how much does this staircase cost?",   a: "" },
  { q: "Which part costs the most?",                         a: "" },
  { q: "Is curved steel expensive to manufacture?",          a: "" },
  { q: "Is oak more expensive than ash?",                    a: "" },
  { q: "Would walnut increase the price significantly?",     a: "" },
  { q: "Would glass balustrade increase the price?",         a: "" },
  { q: "How long is the lead time?",                         a: "" },

  // Manufacturing
  { q: "How is this manufactured?",                          a: "" },
  { q: "Is this made in one piece or sections?",             a: "" },
  { q: "How is the curved steel produced?",                  a: "" },
  { q: "Is it CNC manufactured?",                            a: "" },
  { q: "How long does manufacture take?",                    a: "" },
  { q: "Can this be shipped internationally?",               a: "" },

  // Maintenance
  { q: "How do I clean and maintain the timber?",            a: "" },
  { q: "How often should the timber be refinished or re-oiled?", a: "" },
  { q: "Can scratched treads be repaired?",                  a: "" },
  { q: "How do I maintain the powder coating?",              a: "" },
  { q: "Will the timber shrink or move over time?",          a: "" },
  { q: "Can the steel rust?",                                a: "" },
  { q: "What happens if an LED strip fails?",                a: "" },

  // Image trust / provenance
  { q: "Is this a real installation or a concept image?",    a: "" },
  { q: "Can this exact staircase be built?",                 a: "" },
  { q: "What would need to change for my house?",            a: "" },

  // Nex assistance / supplier connection
  { q: "Can Nex find someone who builds this?",              a: "" },
  { q: "Can Nex recommend a manufacturer?",                  a: "" },
  { q: "Can Nex prepare an enquiry brief for me?",           a: "" },
  { q: "Can I compare manufacturers?",                       a: "" },
];

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = rec.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("NEX-DESIGN-000005 (Nex005) updated ·");
console.log("  design_notes:", rec.design_notes.length, "chars");
console.log("  qa entries  :", rec.qa.length, "(authored so far:", authored + "/" + rec.qa.length + ")");
