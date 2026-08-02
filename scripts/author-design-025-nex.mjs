// Populate NEX-DESIGN-000025 (Contemporary Curved Mono-Stringer Feature · Nex025)
// with Philip's authored design_notes + comprehensive customer question skeleton
// (Rule A · answers stay EMPTY · Philip fills them).
//
// Rerun to update · idempotent overwrite.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));
const rec = d.confirmed.find((r) => r.design_id === "NEX-DESIGN-000025");
if (!rec) { console.error("NEX-DESIGN-000025 not found"); process.exit(1); }

rec.design_notes = `OVERALL TYPE
Contemporary curved mono-stringer feature staircase · combines modern structural steel engineering with natural timber finishes · designed as an architectural focal point rather than a way of moving between floors. Begins with a generous curved entrance before sweeping through a smooth continuous radius to the upper floor · elegant flowing shape creates a welcoming entrance and lets the staircase become part of the interior architecture. Unlike a traditional staircase with strings on both sides, this design uses a single curved steel mono-stringer that supports the timber treads.

STAIRCASE TYPE TAGS
Curved staircase · mono-stringer staircase · feature staircase · architectural staircase · open-riser staircase · bespoke manufactured staircase · steel and timber staircase.

STYLE TAGS
Contemporary · modern · luxury residential · architect-designed · minimalist · premium interior feature.

PRIMARY STRUCTURE
Fabricated curved steel mono-stringer · welded steel plate sections rolled and fabricated to follow the exact staircase geometry · carries the entire load of the staircase and transfers it into the floor structure at both levels · normally manufactured in a factory before being transported for installation.

TREADS
Thick hardwood timber treads · possible species: European oak · American white oak · walnut · ash · maple · Accoya · engineered oak. Finishes: natural oil · clear lacquer · satin finish · matt finish · dark stain · smoked oak · black stained timber.

RISERS
Open risers in this example. Advantages: lighter appearance · more daylight · increased visual space · modern design. Closed risers can normally be manufactured if required.

BALUSTRADE
Vertical steel balusters in this example. Possible alternatives: frameless glass · stainless steel · cable balustrade · timber spindles · decorative metalwork · bronze · brass · mixed materials.

HANDRAIL
Follows the curved geometry of the staircase · manufactured to match the exact curve. Possible materials: solid oak · walnut · ash · stainless steel · bronze · leather-wrapped · painted timber.

FINISH
Steel: black architectural finish in this example. Options: powder-coated · wet painted · textured finish · satin black · white · bronze · custom RAL colours.

LIGHTING
Can be incorporated. Examples: tread lighting · LED under each tread · concealed handrail lighting · stringer lighting · floor lighting · wall lighting · feature pendant lighting.

MANUFACTURING METHOD (typical)
3D CAD modelling → CNC laser cutting → steel fabrication → curved steel rolling → welding → timber CNC machining → finishing → factory trial assembly → quality inspection.

INSTALLATION
Normally supplied in large fabricated sections. Depending on access: complete assembly · two sections · three sections · multiple bolt-together modules. Large staircases often require cranes or lifting equipment · smaller versions can usually be assembled inside the property.

STRUCTURAL SUPPORT
Requires suitable structural support at both levels. Depends on: concrete floor · steel frame · timber floor joists · engineered floor system · building design. A structural engineer normally confirms the fixing method.

CAN THIS STAIRCASE BE MANUFACTURED?
Yes. Not simply an AI fantasy design. A skilled staircase manufacturer with curved steel fabrication capability can manufacture a staircase very similar to this. The final design would be engineered specifically for the building, measurements and local building regulations.

CUSTOMISATION
Almost every part can normally be customised: width · rise · going · overall height · radius · timber species · colour · steel finish · handrail · balustrade · lighting · open or closed risers · landing configuration · left or right turn.

TYPICAL APPLICATIONS
Luxury homes · entrance halls · contemporary houses · architect-designed homes · villas · duplex apartments · penthouses · boutique hotels · commercial reception areas.

WHAT IS VISIBLE VS INFERRED
Visible: single curved mono-stringer geometry · black architectural steel finish · thick timber treads · open-riser construction · vertical steel balusters · continuous curved handrail following the stringer sweep.
Inferred (CANNOT confirm from image): exact steel grade/thickness · exact timber species · exact fixing method into floor/upper level · whether stringer is plate steel or box section · exact welded vs bolted connections at treads · engineering calculations for a specific building.
Nex should be explicit about this distinction when answering customer questions.`;

rec.qa = [
  // ─── Design ───
  { q: "Can this staircase fit my home?",                     a: "" },
  { q: "Can it be made smaller?",                             a: "" },
  { q: "Can it be made wider?",                               a: "" },
  { q: "Can it be mirrored?",                                 a: "" },
  { q: "Can it turn the opposite direction?",                 a: "" },
  { q: "Can it have a landing?",                              a: "" },
  { q: "Can it continue to another floor?",                   a: "" },
  { q: "Can I add glass later?",                              a: "" },
  { q: "Can I remove the balusters?",                         a: "" },
  { q: "Can I change the timber?",                            a: "" },
  { q: "Can the curve be tighter or more open?",              a: "" },
  { q: "Can it become an oval shape instead of circular?",    a: "" },
  { q: "Can I reduce the number of steps?",                   a: "" },
  { q: "Can I increase the width?",                           a: "" },
  { q: "Can the first step be made larger?",                  a: "" },
  { q: "Can I have a feature starting step?",                 a: "" },
  { q: "Can the landing be changed?",                         a: "" },
  { q: "Can the staircase continue to a third floor?",        a: "" },
  { q: "Can the staircase become the centrepiece of my home?",a: "" },
  { q: "Will this suit a modern home?",                       a: "" },
  { q: "Will this suit a traditional home?",                  a: "" },
  { q: "Will this staircase make my entrance look bigger?",   a: "" },
  { q: "Can I combine two different staircase designs?",      a: "" },
  { q: "Can I copy this staircase exactly?",                  a: "" },

  // ─── Construction ───
  { q: "How is the steel stringer made?",                     a: "" },
  { q: "How are the treads fixed?",                           a: "" },
  { q: "Can it be assembled on site?",                        a: "" },
  { q: "Does it arrive fully welded?",                        a: "" },
  { q: "Will it fit through my front door?",                  a: "" },
  { q: "Can it be installed before the roof is finished?",    a: "" },
  { q: "What if access is restricted?",                       a: "" },
  { q: "Can it be manufactured in sections?",                 a: "" },
  { q: "Is this staircase fixed to the wall?",                a: "" },
  { q: "Is this staircase free standing?",                    a: "" },
  { q: "What actually holds this staircase up?",              a: "" },
  { q: "Is it made from metal or wood?",                      a: "" },
  { q: "Is the steel hidden?",                                a: "" },

  // ─── Structure ───
  { q: "What supports the staircase?",                        a: "" },
  { q: "Does it need a concrete floor?",                      a: "" },
  { q: "Can it be installed onto timber joists?",             a: "" },
  { q: "Will extra steelwork be required?",                   a: "" },
  { q: "How much does the staircase weigh?",                  a: "" },
  { q: "Is the staircase engineered?",                        a: "" },
  { q: "Can it carry heavy loads?",                           a: "" },
  { q: "Does it wobble?",                                     a: "" },
  { q: "Will it vibrate?",                                    a: "" },
  { q: "Does it squeak?",                                     a: "" },
  { q: "Is the staircase rigid?",                             a: "" },
  { q: "Will the treads bounce?",                             a: "" },
  { q: "How much weight can one tread carry?",                a: "" },
  { q: "Can several people stand on it together?",            a: "" },
  { q: "Is it suitable for commercial use?",                  a: "" },

  // ─── Safety ───
  { q: "Is it safe for children?",                            a: "" },
  { q: "Are open risers allowed?",                            a: "" },
  { q: "Will the staircase move?",                            a: "" },
  { q: "Will the handrail flex?",                             a: "" },
  { q: "Is the steel slippery?",                              a: "" },
  { q: "Can anti-slip inserts be fitted?",                    a: "" },
  { q: "Can the staircase meet local building regulations?",  a: "" },
  { q: "Is it safe for pets?",                                a: "" },
  { q: "Can dogs use open risers?",                           a: "" },
  { q: "Can elderly people use this safely?",                 a: "" },
  { q: "Can extra handrails be fitted?",                      a: "" },
  { q: "Can child gates be fitted?",                          a: "" },
  { q: "Can glass make it safer?",                            a: "" },

  // ─── Installation ───
  { q: "How long does installation take?",                    a: "" },
  { q: "Does installation create much mess?",                 a: "" },
  { q: "Does the ceiling opening need enlarging?",            a: "" },
  { q: "Can the installer create the floor opening?",         a: "" },
  { q: "Who measures the staircase?",                         a: "" },
  { q: "Who checks the structure?",                           a: "" },
  { q: "Who signs off the installation?",                     a: "" },
  { q: "How many installers are required?",                   a: "" },
  { q: "Is a crane required?",                                a: "" },
  { q: "Can it be carried upstairs?",                         a: "" },
  { q: "Does it fit through standard doors?",                 a: "" },
  { q: "Does the staircase arrive painted?",                  a: "" },
  { q: "Will welding happen inside my house?",                a: "" },
  { q: "Is everything bolted together?",                      a: "" },
  { q: "How much noise will installation create?",            a: "" },
  { q: "Can I stay in the house during installation?",        a: "" },

  // ─── Maintenance ───
  { q: "Does the steel require maintenance?",                 a: "" },
  { q: "Can the timber be refinished?",                       a: "" },
  { q: "Can damaged treads be replaced?",                     a: "" },
  { q: "Can lighting be upgraded?",                           a: "" },
  { q: "Can the staircase be repainted?",                     a: "" },
  { q: "How do I clean the steel?",                           a: "" },
  { q: "How do I clean the timber?",                          a: "" },
  { q: "Does the staircase need servicing?",                  a: "" },
  { q: "Should bolts be checked?",                            a: "" },
  { q: "How often should finishes be maintained?",            a: "" },

  // ─── Engineering / Materials ───
  { q: "How thick is the steel?",                             a: "" },
  { q: "What grade of steel is normally used?",               a: "" },
  { q: "Is the steel fabricated from plate or box section?",  a: "" },
  { q: "Are the welds visible?",                              a: "" },
  { q: "Are the welds polished?",                             a: "" },
  { q: "How is the curved steel manufactured?",               a: "" },
  { q: "Can aluminium be used instead?",                      a: "" },
  { q: "Can stainless steel be used?",                        a: "" },
  { q: "Can the steel be galvanised?",                        a: "" },
  { q: "Is powder coating better than paint?",                a: "" },
  { q: "Can the steel rust?",                                 a: "" },
  { q: "How long should the steel last?",                     a: "" },
  { q: "Is solid timber better than engineered timber?",      a: "" },
  { q: "Will oak crack?",                                     a: "" },
  { q: "Will walnut fade?",                                   a: "" },
  { q: "Can the timber colour match my flooring?",            a: "" },
  { q: "Can reclaimed timber be used?",                       a: "" },
  { q: "Are thicker treads stronger?",                        a: "" },

  // ─── Glass ───
  { q: "Is the glass toughened?",                             a: "" },
  { q: "Is it laminated?",                                    a: "" },
  { q: "How thick is the glass?",                             a: "" },
  { q: "Can the glass be tinted?",                            a: "" },
  { q: "Can it be smoked or bronze?",                         a: "" },
  { q: "Can the glass be curved?",                            a: "" },
  { q: "Can glass be replaced if broken?",                    a: "" },

  // ─── Handrail ───
  { q: "Is the handrail comfortable?",                        a: "" },
  { q: "Can I remove the handrail?",                          a: "" },
  { q: "Is one handrail enough?",                             a: "" },
  { q: "Can I have two handrails?",                           a: "" },
  { q: "Can the handrail be thinner?",                        a: "" },
  { q: "Can the handrail be square?",                         a: "" },
  { q: "Can the handrail be stainless steel?",                a: "" },
  { q: "Can LED lighting be built into the handrail?",        a: "" },

  // ─── Balustrade ───
  { q: "Are vertical bars safer?",                            a: "" },
  { q: "Can I use horizontal rails?",                         a: "" },
  { q: "Can I replace the bars with glass?",                  a: "" },
  { q: "Can children climb this balustrade?",                 a: "" },
  { q: "Can the balustrade be removed later?",                a: "" },
  { q: "Can decorative metal panels be fitted?",              a: "" },
  { q: "Can timber balusters be fitted?",                     a: "" },

  // ─── Building Work / Sequencing ───
  { q: "Does the builder need to prepare anything?",          a: "" },
  { q: "Does the opening need trimming?",                     a: "" },
  { q: "Can the staircase be installed before plastering?",   a: "" },
  { q: "Should it be installed after flooring?",              a: "" },
  { q: "Who installs it first — electrician, plasterer, decorator or flooring?", a: "" },

  // ─── Weight / Foundations ───
  { q: "How heavy is the staircase?",                         a: "" },
  { q: "Can my floor support it?",                            a: "" },
  { q: "Does it require extra foundations?",                  a: "" },
  { q: "Does the base need strengthening?",                   a: "" },
  { q: "Will it damage suspended timber floors?",             a: "" },
  { q: "Can it sit directly on floor tiles?",                 a: "" },
  { q: "Does the base need concrete?",                        a: "" },
  { q: "Can it sit on engineered timber flooring?",           a: "" },

  // ─── Home Suitability ───
  { q: "Will this staircase fit in my house?",                a: "" },
  { q: "How much floor space will it need?",                  a: "" },
  { q: "How much headroom is required?",                      a: "" },
  { q: "Can it fit into an existing stairwell?",              a: "" },
  { q: "Can it replace my current staircase?",                a: "" },
  { q: "Can it be installed without changing the layout?",    a: "" },
  { q: "Will I lose much living space?",                      a: "" },
  { q: "Can I move walls to fit it?",                         a: "" },
  { q: "Can the staircase become smaller without looking cramped?", a: "" },
  { q: "Can it be designed around my windows?",               a: "" },
  { q: "Will it block natural light?",                        a: "" },
  { q: "Can it be installed in a loft conversion?",           a: "" },
  { q: "Can it work in a narrow hallway?",                    a: "" },
  { q: "Can it fit into a townhouse?",                        a: "" },
  { q: "Can it fit inside an apartment?",                     a: "" },

  // ─── Architect & Builder ───
  { q: "Does my architect need to redesign the opening?",     a: "" },
  { q: "Can you work from my architect's plans?",             a: "" },
  { q: "Can you work from hand sketches?",                    a: "" },
  { q: "Can you work from BIM models?",                       a: "" },
  { q: "Do I need structural calculations?",                  a: "" },
  { q: "Who provides the engineering drawings?",              a: "" },
  { q: "Can the builder build around the staircase?",         a: "" },
  { q: "Should the staircase be measured before plastering?", a: "" },
  { q: "Should it be measured after flooring?",               a: "" },
  { q: "Who coordinates the installation?",                   a: "" },

  // ─── Manufacturing ───
  { q: "How long does manufacturing normally take?",          a: "" },
  { q: "Is every staircase made from scratch?",               a: "" },
  { q: "Is anything kept in stock?",                          a: "" },
  { q: "Can you make an exact copy?",                         a: "" },
  { q: "Can you improve this design?",                        a: "" },
  { q: "Can I combine ideas from several staircases?",        a: "" },
  { q: "Can I send inspiration photos?",                      a: "" },
  { q: "Can I approve drawings before manufacture?",          a: "" },
  { q: "Will I receive 3D drawings?",                         a: "" },
  { q: "Will I receive shop drawings?",                       a: "" },

  // ─── Engineering (deeper) ───
  { q: "Has this staircase been engineered?",                 a: "" },
  { q: "Will it meet local building regulations?",            a: "" },
  { q: "Is it structurally certified?",                       a: "" },
  { q: "Can calculations be supplied?",                       a: "" },
  { q: "Can my engineer review the design?",                  a: "" },
  { q: "Can changes be made after engineering?",              a: "" },
  { q: "What safety factors are used?",                       a: "" },
  { q: "Can the staircase be earthquake engineered?",         a: "" },
  { q: "Can it be designed for hurricane zones?",             a: "" },
  { q: "Can it be designed for coastal environments?",        a: "" },

  // ─── Finishes ───
  { q: "Can I change the colour later?",                      a: "" },
  { q: "Can powder coating be repaired?",                     a: "" },
  { q: "Can scratches be touched up?",                        a: "" },
  { q: "Will sunlight change the timber colour?",             a: "" },
  { q: "Does oak darken with age?",                           a: "" },
  { q: "Can I choose any paint colour?",                      a: "" },
  { q: "Can I match my kitchen, flooring or doors?",          a: "" },

  // ─── Noise ───
  { q: "Will it squeak?",                                     a: "" },
  { q: "Does steel creak?",                                   a: "" },
  { q: "Are open risers noisy?",                              a: "" },
  { q: "Can rubber isolation pads be fitted?",                a: "" },
  { q: "Will footsteps echo?",                                a: "" },
  { q: "Can the staircase be made quieter?",                  a: "" },
  { q: "Will children running upstairs make lots of noise?",  a: "" },

  // ─── Family ───
  { q: "Is it suitable for young children?",                  a: "" },
  { q: "Can dogs use open risers safely?",                    a: "" },
  { q: "Can elderly people use this safely?",                 a: "" },
  { q: "Can anti-slip strips be added?",                      a: "" },

  // ─── Future Changes ───
  { q: "Can I change the balustrade later?",                  a: "" },
  { q: "Can I upgrade to glass later?",                       a: "" },
  { q: "Can I replace timber with stone?",                    a: "" },
  { q: "Can I replace the handrail?",                         a: "" },
  { q: "Can lighting be added later?",                        a: "" },
  { q: "Can I remove the lighting?",                          a: "" },
  { q: "Can I repaint the steel?",                            a: "" },
  { q: "Can I relocate the staircase if I renovate?",         a: "" },

  // ─── Warranty ───
  { q: "Is there a structural warranty?",                     a: "" },
  { q: "Is the paint guaranteed?",                            a: "" },
  { q: "Is the timber guaranteed?",                           a: "" },
  { q: "What happens if something moves?",                    a: "" },
  { q: "What happens if timber shrinks?",                     a: "" },
  { q: "Who do I contact if I have a problem?",               a: "" },

  // ─── Transport ───
  { q: "How is the staircase delivered?",                     a: "" },
  { q: "Does it arrive fully assembled?",                     a: "" },
  { q: "Is it wrapped?",                                      a: "" },
  { q: "Is it insured during transport?",                     a: "" },
  { q: "Can it be delivered internationally?",                a: "" },
  { q: "Can it be transported to an island?",                 a: "" },
  { q: "What if access is difficult?",                        a: "" },

  // ─── Installation Logistics ───
  { q: "Do I need scaffolding?",                              a: "" },
  { q: "Will roads need closing?",                            a: "" },
  { q: "Does a crane need planning permission?",              a: "" },
  { q: "Can installation happen over a weekend?",             a: "" },
  { q: "Will electricity be required?",                       a: "" },
  { q: "Will flooring need protecting?",                      a: "" },

  // ─── Project Management ───
  { q: "Who manages the project?",                            a: "" },
  { q: "Who orders materials?",                               a: "" },
  { q: "Who arranges installation?",                          a: "" },
  { q: "Who checks quality?",                                 a: "" },
  { q: "Who is responsible if dimensions are wrong?",         a: "" },

  // ─── Investment / Value ───
  { q: "Will this increase my property's value?",             a: "" },
  { q: "Does a feature staircase make a house easier to sell?", a: "" },
  { q: "Is it worth spending more on the staircase?",         a: "" },
  { q: "Which timber holds its value best?",                  a: "" },
  { q: "Is black steel going out of fashion?",                a: "" },

  // ─── Sustainability ───
  { q: "Is the timber sustainably sourced?",                  a: "" },
  { q: "Is FSC timber available?",                            a: "" },
  { q: "Can recycled steel be used?",                         a: "" },
  { q: "Is powder coating environmentally friendly?",         a: "" },
  { q: "Can reclaimed timber be incorporated?",               a: "" },
  { q: "What is the expected lifespan?",                      a: "" },
  { q: "Can the staircase be recycled?",                      a: "" },

  // ─── Insurance ───
  { q: "Will my home insurance change?",                      a: "" },
  { q: "Do I need to tell my insurer?",                       a: "" },
  { q: "Is the staircase covered during installation?",       a: "" },
  { q: "Is public liability included?",                       a: "" },

  // ─── Showrooms & Examples ───
  { q: "Can I see one before ordering?",                      a: "" },
  { q: "Do you have completed projects nearby?",              a: "" },
  { q: "Can I visit a previous installation?",                a: "" },
  { q: "Can I visit a showroom?",                             a: "" },
  { q: "Can I tour the factory?",                             a: "" },
  { q: "Can I meet the people making it?",                    a: "" },
  { q: "Do you have customer testimonials?",                  a: "" },
  { q: "Can I see different timber samples?",                 a: "" },

  // ─── Suppliers ───
  { q: "Who specialises in this type of staircase?",          a: "" },
  { q: "Which manufacturers build curved staircases?",        a: "" },
  { q: "Which companies work with architects?",               a: "" },
  { q: "Which suppliers work nationwide?",                    a: "" },
  { q: "Can you recommend someone near me?",                  a: "" },
  { q: "Are there manufacturers in my country?",              a: "" },
  { q: "Are there installers in my city?",                    a: "" },
  { q: "Who can survey my property?",                         a: "" },
  { q: "Who can provide a quotation?",                        a: "" },
  { q: "Can you introduce me to multiple companies?",         a: "" },
  { q: "Can I compare different manufacturers?",              a: "" },

  // ─── Cost / Budget (Nex Pricing Principle applies · Philip authors carefully) ───
  { q: "Is this an expensive staircase?",                     a: "" },
  { q: "Why is this staircase expensive?",                    a: "" },
  { q: "Why does a curved staircase cost more?",              a: "" },
  { q: "Is there a cheaper version?",                         a: "" },
  { q: "Can I make it more affordable?",                      a: "" },
  { q: "Can I build it in stages?",                           a: "" },
  { q: "What affects the price?",                             a: "" },

  // ─── Delivery ───
  { q: "How long before manufacture starts?",                 a: "" },
  { q: "What is the manufacturing lead time?",                a: "" },
  { q: "Can it be exported overseas?",                        a: "" },
  { q: "Can it be shipped in containers?",                    a: "" },

  // ─── Aftercare ───
  { q: "Is there a warranty?",                                a: "" },
  { q: "What maintenance is recommended?",                    a: "" },
  { q: "How often should timber be treated?",                 a: "" },
  { q: "Can scratches be repaired?",                          a: "" },
  { q: "Can the finish be changed later?",                    a: "" },
  { q: "What if I move house?",                               a: "" },
];

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = rec.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("NEX-DESIGN-000025 (Nex025) updated ·");
console.log("  design_notes:", rec.design_notes.length, "chars");
console.log("  qa entries  :", rec.qa.length, "(authored so far:", authored + "/" + rec.qa.length + ")");
