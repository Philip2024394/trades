// Populate NEX-DESIGN-000026 (Contemporary Straight-Flight Floating Cantilever
// Glass · Nex026) with Philip's authored design_notes + comprehensive customer
// question skeleton (Rule A · answers stay EMPTY · Philip fills them).
//
// Rerun to update · idempotent overwrite.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));
const rec = d.confirmed.find((r) => r.design_id === "NEX-DESIGN-000026");
if (!rec) { console.error("NEX-DESIGN-000026 not found"); process.exit(1); }

rec.design_notes = `OVERALL TYPE
Contemporary straight-flight floating staircase with exposed cantilever-style timber treads and a full-height frameless structural glass balustrade. Minimalist and architectural · allows natural light to pass through the staircase while creating a clean, open appearance.

CONSTRUCTION FEATURES
Solid hardwood treads · hidden structural steel supports · frameless toughened laminated glass · stainless steel glass fixing bolts · concealed steel landing connection · open-riser construction · flush wall finish · integrated architectural lighting. The glass balustrade runs continuously from the lower floor to the upper landing, producing an uninterrupted transparent safety barrier. LED feature lighting has been incorporated into both the surrounding architecture and the staircase itself, highlighting each tread during evening use.

GLASS BALUSTRADE
Typically toughened laminated safety glass · if struck hard enough to break, normally cracks rather than exploding into sharp shards · the laminated interlayer helps hold the broken pieces together · the panel often remains in place long enough to allow safe replacement. Individual panels can usually be replaced without rebuilding the entire staircase · replacement method depends on the fixing system.

FLOATING TREADS
Appear to float because the structural support is HIDDEN · in reality every tread is supported by concealed steel engineering. Likely solid oak, engineered oak, walnut, ash or another hardwood · exact species cannot be confirmed from image alone. Tread thickness can normally be changed on a bespoke build (may alter appearance and engineering).

LIGHTING
Image suggests integrated architectural lighting AROUND the staircase rather than lighting built into each tread. Many manufacturers can also incorporate: LED strips beneath treads · concealed handrail lighting · wall lighting · motion sensors · smart-home control.

STRUCTURE
From the image, the staircase may use concealed structural steel fixed into the adjacent wall or a hidden steel spine. The exact engineering CANNOT be confirmed from an image alone. Some floating staircases rely heavily on wall fixings, while others use concealed steel structures that transfer the load elsewhere. Often requires reinforced masonry · reinforced concrete · structural steel framing · or specially engineered timber walls. The supporting structure depends on the staircase design.

CAN THIS STAIRCASE BE BUILT?
Yes. This style of staircase is manufactured by specialist staircase companies around the world · not simply an AI concept. Every staircase is individually engineered to suit the building, measurements and local regulations.

CUSTOMISATION
Almost every part can usually be customised: timber species · tread thickness · glass type · glass tint · steel colour · tread width · staircase width · number of steps · landing design · lighting · handrail style · fixing methods · finish.

INSTALLATION
Many bespoke staircases arrive in sections and are assembled on site. Practicality depends on: access through doors · ceiling height · structural support · delivery route · available lifting equipment. Site survey normally carried out before manufacture.

GLASS OPTIONS
Clear · low-iron ultra-clear (much clearer than standard toughened, especially edge-on) · grey tint · bronze tint · smoked · frosted · acid-etched · decorative printed. Fixing systems: base shoe channel · concealed channel · embedded channel · side-mounted fixings · stainless steel stand-offs · hidden structural fixings.

TIMBER OPTIONS
European oak · American white oak · walnut · ash · maple · beech · engineered timber · live-edge timber (possible with some manufacturers). Timber naturally expands and contracts slightly with seasonal humidity · proper manufacturing and installation minimise movement.

STEEL FINISHES
Powder-coated (durable · many colours) · painted · stainless steel (greater corrosion resistance · different appearance and cost). Indoor staircases should not rust when correctly prepared and finished · coastal environments may require specialist coatings.

FLOATING FAMILY CHARACTERISTICS
Many floating staircases hide almost all of the steel structure · others intentionally expose it as part of the design. Each tread is designed as part of the complete staircase structure · loads transferred through concealed structural elements into the building. Individual tread replacement often possible depending on manufacturing method.

SAFETY
Open-riser staircases are legal in many countries provided they comply with local building regulations · maximum opening between treads varies by country. Anti-slip options include: coatings · textured finishes · grooved treads · rubber inserts · metal inserts. Structural glass balustrades are extremely safe when correctly designed and installed.

WHAT IS VISIBLE VS INFERRED
Visible: straight-flight geometry · floating tread appearance · full-height frameless glass balustrade · continuous glass to upper landing · integrated architectural LED lighting · flush wall finish · open risers.
Inferred (CANNOT confirm from image): exact structural method (wall-fixed vs. hidden steel spine vs. concealed cantilever) · exact timber species · exact glass thickness or fixing method · exact steel grade · engineering calculations for a specific building · whether tread lighting is present or just architectural surround lighting.
Nex should be explicit about this distinction when answering customer questions.`;

rec.qa = [
  // ─── Glass ───
  { q: "Is the glass shatterproof?",                          a: "" },
  { q: "Is the glass safe?",                                  a: "" },
  { q: "Will the glass wobble?",                              a: "" },
  { q: "Can the glass break?",                                a: "" },
  { q: "Can the glass scratch?",                              a: "" },
  { q: "Can the glass be replaced?",                          a: "" },
  { q: "Is the glass clear or low-iron?",                     a: "" },
  { q: "Can I have tinted glass?",                            a: "" },
  { q: "Can the glass have no visible bolts?",                a: "" },
  { q: "Will fingerprints show?",                             a: "" },
  { q: "Does the glass need polishing?",                      a: "" },
  { q: "Can children damage the glass?",                      a: "" },
  { q: "How do I clean the glass?",                           a: "" },

  // ─── Floating Treads ───
  { q: "Are the steps really floating?",                      a: "" },
  { q: "Are the treads solid wood?",                          a: "" },
  { q: "Can I change the timber?",                            a: "" },
  { q: "Can I make the treads thicker?",                      a: "" },
  { q: "How thick are the treads?",                           a: "" },
  { q: "Can one step be replaced?",                           a: "" },
  { q: "Does every tread support weight on its own?",         a: "" },
  { q: "Can I have live-edge timber?",                        a: "" },

  // ─── Lighting ───
  { q: "Is the lighting built into the staircase?",           a: "" },
  { q: "Does lighting make a big difference?",                a: "" },
  { q: "Can lighting be added later?",                        a: "" },
  { q: "Can I have LED strips under each tread?",             a: "" },
  { q: "Can lighting be motion-activated?",                   a: "" },
  { q: "Can lighting be controlled by smart home systems?",   a: "" },

  // ─── Structure ───
  { q: "What holds this staircase up?",                       a: "" },
  { q: "Is it fixed to the wall?",                            a: "" },
  { q: "Does it need a structural wall?",                     a: "" },
  { q: "Can I suspend the staircase from the ceiling?",       a: "" },
  { q: "Can it be built without a wall?",                     a: "" },
  { q: "Can the staircase carry furniture upstairs?",         a: "" },

  // ─── Timber ───
  { q: "What timber is best?",                                a: "" },
  { q: "Will the timber shrink?",                             a: "" },
  { q: "Will the timber crack?",                              a: "" },
  { q: "Can I have thicker treads?",                          a: "" },
  { q: "Does timber require maintenance?",                    a: "" },
  { q: "Can damaged treads be refinished?",                   a: "" },

  // ─── Steel ───
  { q: "Is the steel painted?",                               a: "" },
  { q: "Can the steel rust?",                                 a: "" },
  { q: "Can I choose stainless steel instead?",               a: "" },
  { q: "Can the steel be hidden completely?",                 a: "" },
  { q: "Will the steel require maintenance?",                 a: "" },

  // ─── Structural / Engineering ───
  { q: "Does this staircase need engineering drawings?",      a: "" },
  { q: "Will I receive drawings before it's built?",          a: "" },
  { q: "Can I approve the design first?",                     a: "" },
  { q: "Can changes be made after drawings are approved?",    a: "" },
  { q: "Does my floor need strengthening?",                   a: "" },
  { q: "Does the upstairs floor need strengthening?",         a: "" },

  // ─── Safety ───
  { q: "Is an open-riser staircase legal?",                   a: "" },
  { q: "Can someone slip through the open risers?",           a: "" },
  { q: "Is this staircase suitable for children?",            a: "" },
  { q: "Can pets use it?",                                    a: "" },
  { q: "Can anti-slip finishes be added?",                    a: "" },

  // ─── Installation ───
  { q: "Can it be installed in an existing house?",           a: "" },
  { q: "Will my walls be damaged?",                           a: "" },
  { q: "Will builders need to remove windows?",               a: "" },
  { q: "Can it be installed before the house is finished?",   a: "" },
  { q: "How long does installation take?",                    a: "" },
  { q: "Will there be a lot of dust?",                        a: "" },
  { q: "Will the installer measure my house?",                a: "" },
  { q: "What if my measurements are wrong?",                  a: "" },
  { q: "Will the staircase arrive fully assembled?",          a: "" },
  { q: "Can it be dismantled in the future?",                 a: "" },

  // ─── Manufacturing ───
  { q: "Can this staircase be built?",                        a: "" },
  { q: "Can it be customised?",                               a: "" },
  { q: "Is every staircase made to order?",                   a: "" },
  { q: "Are there standard sizes?",                           a: "" },
  { q: "Is it handmade?",                                     a: "" },
  { q: "Where is it manufactured?",                           a: "" },

  // ─── Appearance ───
  { q: "Will this style go out of fashion?",                  a: "" },
  { q: "Can I match my interior?",                            a: "" },
  { q: "Will this staircase suit a modern home?",             a: "" },
  { q: "Will this staircase suit a traditional home?",        a: "" },

  // ─── Property / Value ───
  { q: "Will this staircase add value to my home?",           a: "" },
  { q: "Is this considered a luxury staircase?",              a: "" },
  { q: "Will it become the focal point of my house?",         a: "" },

  // ─── Building Work ───
  { q: "Can this replace my existing staircase?",             a: "" },
  { q: "Will I lose floor space?",                            a: "" },

  // ─── Design ───
  { q: "Can I remove the glass later?",                       a: "" },
  { q: "Can I add a handrail later?",                         a: "" },
  { q: "Can I change from open risers to closed risers?",     a: "" },
  { q: "Can the staircase be painted later?",                 a: "" },

  // ─── Manufacturers ───
  { q: "Who builds staircases like this?",                    a: "" },
  { q: "Is there a manufacturer near me?",                    a: "" },
  { q: "Can you introduce me to a manufacturer?",             a: "" },
  { q: "Can I send this image to a manufacturer?",            a: "" },

  // ─── Honest AI / Image Trust ───
  { q: "Is this an actual staircase or an AI image?",         a: "" },
  { q: "Can this exact staircase actually be built?",         a: "" },
  { q: "Can someone really make this?",                       a: "" },
  { q: "How do I know if this design is realistic?",          a: "" },
];

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = rec.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("NEX-DESIGN-000026 (Nex026) updated ·");
console.log("  design_notes:", rec.design_notes.length, "chars");
console.log("  qa entries  :", rec.qa.length, "(authored so far:", authored + "/" + rec.qa.length + ")");
