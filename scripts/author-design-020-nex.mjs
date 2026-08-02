// Populate NEX-DESIGN-000020 (Luxury Sculptural Double-Curved Feature · Nex020)
// with Philip's authored design_notes + comprehensive customer question skeleton
// (Rule A · answers stay EMPTY · Philip fills them).
//
// Rerun to update · idempotent overwrite.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));
const rec = d.confirmed.find((r) => r.design_id === "NEX-DESIGN-000020");
if (!rec) { console.error("NEX-DESIGN-000020 not found"); process.exit(1); }

rec.design_notes = `OVERALL TYPE
Bespoke sculptural double-curved feature staircase · classifiable as a helical staircase, luxury architectural staircase, premium commercial feature stair, or grand entrance staircase. Unlike a spiral, every tread is individually engineered. Designed as a piece of architecture and interior sculpture · the centrepiece of a luxury home, hotel, corporate headquarters or prestige commercial building.

DESIGN STYLE
Modern Luxury · Contemporary Architecture · Minimalist Structural Design · High-End Residential · Luxury Hotel Style · Corporate Reception Style · Architect Designed · Statement Staircase.

DESIGN INTENT
Not simply moving people between floors · sculptural feature that immediately attracts attention on entry · sweeping curves, open central space, glass balustrades and concealed lighting create openness and luxury while allowing natural light to travel throughout the building.

STRUCTURAL FEATURES
Twin sweeping curved structural steel stringers · continuous flowing handrail geometry · frameless structural glass balustrades · open-riser construction · hidden structural supports · integrated LED tread lighting · feature landscaping beneath the staircase · sculptural landing transition · large architectural opening through the floor. Every curve appears to be designed as one continuous flowing movement.

MATERIALS (typical options)
Structure: fabricated structural steel, laser-cut plate steel, rolled steel sections, hidden welded framework, powder-coated finish.
Treads: European oak · American white oak · walnut · ash · engineered hardwood · stone treads · porcelain · glass treads (optional).
Balustrades: toughened laminated structural glass · low-iron ultra-clear glass · curved glass (where required) · polished stainless fittings · hidden glass channels.
Handrails: timber · steel · bronze · brass · stainless steel · leather-wrapped · custom hardwood.

LIGHTING
LED strip beneath every tread · handrail lighting · landing lighting · feature floor lighting · landscape lighting · architectural ceiling lighting · hidden driver systems · smart home integration · motion sensors · dimmable scenes.

ENGINEERING COMPLEXITY (Very High)
Not standard. Requires structural calculations · architectural drawings · 3D CAD modelling · finite element analysis · steel fabrication drawings · glass engineering · load calculations · building regulation compliance · manufacturing tolerances · professional installation. Every component usually manufactured specifically for one building.

MANUFACTURING METHOD (typical)
3D scanning · laser measurement · CAD modelling · CNC machining · steel rolling · curved plate fabrication · robotic welding · hand finishing · timber CNC machining · glass templating · factory trial assembly · protective packaging · professional installation.

SUITABLE BUILDINGS
Luxury homes · modern villas · architectural self-build projects · hotels · corporate headquarters · executive offices · prestige showrooms · luxury apartment developments · waterfront properties · high-end restaurants · museums · boutique retail spaces.

APPROXIMATE DIMENSIONS (illustrative · not manufacturing specs)
Floor to floor: 2500-4500 mm · overall width: 1200-2500 mm · overall diameter (if circular): 3000-8000 mm · minimum ceiling opening: designed specifically for each project · landing width: usually matches or exceeds stair width.

STRUCTURAL ENGINEERING CONSIDERATIONS
Dead load · live load · dynamic movement · torsional forces · glass loading · handrail loading · steel deflection · connection forces · anchor bolt loading · floor loading · ceiling loading. Every country has different structural requirements.

BUILDING REGULATION AREAS
Maximum rise · minimum going · headroom · handrail height · guarding · baluster spacing · glass requirements · slip resistance · fire escape requirements · accessibility rules. Vary between countries and local authorities.

INSTALLATION SEQUENCE (typical)
1. Site survey → 2. Laser measurement → 3. Structural engineering approval → 4. Manufacturing → 5. Factory trial assembly → 6. Delivery → 7. Crane or specialist lifting → 8. Main steel installation → 9. Structural fixing → 10. Glass installation → 11. Timber tread installation → 12. Lighting installation → 13. Final alignment → 14. Quality inspection → 15. Building control inspection (where required).

MANUFACTURING TOLERANCES
Extremely tight. Even a few mm affects glass alignment · handrail joints · lighting lines · curved steel · landing transitions · overall appearance. Manufacturers normally use laser measurements rather than tape measures.

MAINTENANCE
Cleaning glass · cleaning timber · inspecting fixings · checking handrail rigidity · checking lighting · refinishing timber when required · inspecting silicone joints · lubricating concealed fixings where specified.

LIFESPAN
With proper design, engineering and maintenance can last many decades. Individual components (timber finishes, lighting drivers, glass panels) may be replaced over time without replacing the complete staircase.

TRANSPORT + ACCESS
Rarely delivered as a single unit · normally transported as steel sections, timber tread packs, glass panels, handrail sections, lighting components, fixings · assembled on site. Access restriction options: smaller fabricated sections, bolted site connections, temporary glazing removal, crane lifting, roof access, large opening before final glazing. Every property assessed individually.

WHAT IS VISIBLE VS INFERRED
Visible: overall sculptural curved geometry · frameless glass balustrades · integrated LED tread lighting · sculptural landing transition · large architectural floor opening · landscaped feature underneath.
Inferred (CANNOT confirm from image): exact steel grade/thickness · exact fixing method · exact timber species · exact glass specification · engineering calculations · installation access solutions for a specific property.

IMPORTANT TRANSPARENCY STATEMENT (Philip verbatim)
This image should be treated as a design concept or architectural reference, not as a construction drawing. Many specialist manufacturers are capable of producing staircases with a very similar appearance, but every project must be redesigned and engineered specifically for the property where it will be installed. No reputable manufacturer will build directly from an inspiration image alone.`;

rec.qa = [
  // ─── General Design ───
  { q: "What style of staircase is this?",                    a: "" },
  { q: "What is this type of staircase called?",              a: "" },
  { q: "Is this a real staircase or an AI concept?",          a: "" },
  { q: "Can this exact staircase be built?",                  a: "" },
  { q: "Can it be customised?",                               a: "" },
  { q: "Can I make it larger?",                               a: "" },
  { q: "Can I make it smaller?",                              a: "" },
  { q: "Can I change the shape?",                             a: "" },
  { q: "Can it turn the opposite direction?",                 a: "" },
  { q: "Can I remove one of the curves?",                     a: "" },
  { q: "Can I make it more modern?",                          a: "" },
  { q: "Can I make it more traditional?",                     a: "" },
  { q: "Can I add lighting?",                                 a: "" },
  { q: "Can I remove the lighting?",                          a: "" },
  { q: "Can it have open risers?",                            a: "" },
  { q: "Can it have closed risers?",                          a: "" },
  { q: "Does it have to look exactly like this?",             a: "" },

  // ─── Manufacturing ───
  { q: "Who can build this staircase?",                       a: "" },
  { q: "Is this handmade?",                                   a: "" },
  { q: "Is it machine made?",                                 a: "" },
  { q: "Is it manufactured in sections?",                     a: "" },
  { q: "Can it be assembled on site?",                        a: "" },
  { q: "Can it be delivered fully built?",                    a: "" },
  { q: "Can it be built inside an existing house?",           a: "" },
  { q: "Can it be built while I am living in the house?",     a: "" },
  { q: "How long does it take to manufacture?",               a: "" },
  { q: "How long does installation take?",                    a: "" },
  { q: "Is every staircase made to order?",                   a: "" },
  { q: "Can this be prefabricated?",                          a: "" },
  { q: "Can it be flat packed?",                              a: "" },
  { q: "What parts are manufactured in the factory?",         a: "" },
  { q: "What work is completed on site?",                     a: "" },

  // ─── Structure ───
  { q: "What holds this staircase up?",                       a: "" },
  { q: "Is it self-supporting?",                              a: "" },
  { q: "Does it need a central support?",                     a: "" },
  { q: "Does it need steel inside?",                          a: "" },
  { q: "Is the steel hidden?",                                a: "" },
  { q: "How strong is it?",                                   a: "" },
  { q: "How much weight can it carry?",                       a: "" },
  { q: "Can several people stand on it?",                     a: "" },
  { q: "Does it move when you walk?",                         a: "" },
  { q: "Will it wobble?",                                     a: "" },
  { q: "Will the handrails move?",                            a: "" },
  { q: "Does it squeak?",                                     a: "" },
  { q: "How is it fixed to the floor?",                       a: "" },
  { q: "How is it fixed upstairs?",                           a: "" },
  { q: "Does it need extra structural supports?",             a: "" },
  { q: "Does the house need strengthening?",                  a: "" },

  // ─── Installation ───
  { q: "Can it be installed in my home?",                     a: "" },
  { q: "My doors are too narrow. Can it still be installed?", a: "" },
  { q: "Does it come in pieces?",                             a: "" },
  { q: "Can it fit through a window?",                        a: "" },
  { q: "Can it be craned in?",                                a: "" },
  { q: "Does the ceiling opening need enlarging?",            a: "" },
  { q: "Will installers cut the floor opening?",              a: "" },
  { q: "Will builders need to modify my house?",              a: "" },
  { q: "Can it replace my existing staircase?",               a: "" },
  { q: "Can it be installed after decorating?",               a: "" },
  { q: "How disruptive is installation?",                     a: "" },
  { q: "How many installers are needed?",                     a: "" },

  // ─── Foundations ───
  { q: "Do I need a concrete floor?",                         a: "" },
  { q: "Can it sit on timber flooring?",                      a: "" },
  { q: "Is a timber joist floor suitable?",                   a: "" },
  { q: "Does it need special foundations?",                   a: "" },
  { q: "Can it sit on suspended timber floors?",              a: "" },
  { q: "Can it be fixed to steel beams?",                     a: "" },
  { q: "Does the upstairs floor need reinforcing?",           a: "" },

  // ─── Materials ───
  { q: "What materials are used?",                            a: "" },
  { q: "Can I have oak instead?",                             a: "" },
  { q: "Can I use walnut?",                                   a: "" },
  { q: "Can I use ash?",                                      a: "" },
  { q: "Can I use glass treads?",                             a: "" },
  { q: "Can I use stone treads?",                             a: "" },
  { q: "Can I change the steel colour?",                      a: "" },
  { q: "Can the steel be powder coated?",                     a: "" },
  { q: "Can it be stainless steel?",                          a: "" },
  { q: "Can the sides be covered with timber?",               a: "" },
  { q: "Can they be wrapped in stone?",                       a: "" },
  { q: "Can they be clad in brass?",                          a: "" },
  { q: "Can they be upholstered?",                            a: "" },
  { q: "Can they be painted?",                                a: "" },

  // ─── Glass ───
  { q: "Is the glass safe?",                                  a: "" },
  { q: "Is it toughened?",                                    a: "" },
  { q: "Is it laminated?",                                    a: "" },
  { q: "How thick is the glass?",                             a: "" },
  { q: "Can the glass be tinted?",                            a: "" },
  { q: "Can it be frosted?",                                  a: "" },
  { q: "Can I have bronze glass?",                            a: "" },
  { q: "Can I have smoked glass?",                            a: "" },
  { q: "Does the glass scratch?",                             a: "" },
  { q: "Can broken glass be replaced?",                       a: "" },
  { q: "Can glass shatter?",                                  a: "" },
  { q: "What happens if glass breaks?",                       a: "" },
  { q: "Is low-iron glass worth the extra cost?",             a: "" },

  // ─── Handrails ───
  { q: "Can I change the handrail?",                          a: "" },
  { q: "Can it be timber?",                                   a: "" },
  { q: "Can it be metal?",                                    a: "" },
  { q: "Can it be leather wrapped?",                          a: "" },
  { q: "Do I need a handrail?",                               a: "" },
  { q: "Can the handrail have lighting?",                     a: "" },
  { q: "Will the handrail feel solid?",                       a: "" },
  { q: "How is the handrail fixed?",                          a: "" },
  { q: "Which handrail feels most comfortable?",              a: "" },
  { q: "Can handrails wrap around corners seamlessly?",       a: "" },

  // ─── Treads ───
  { q: "Can I change the steps?",                             a: "" },
  { q: "Can I replace the treads later?",                     a: "" },
  { q: "Can I use thicker treads?",                           a: "" },
  { q: "Can I add anti-slip inserts?",                        a: "" },
  { q: "Can I change the timber species?",                    a: "" },
  { q: "Can I stain them darker?",                            a: "" },
  { q: "Can I refinish them later?",                          a: "" },
  { q: "Can treads overhang or float?",                       a: "" },
  { q: "Can the underside be finished?",                      a: "" },
  { q: "Can tread lighting be recessed?",                     a: "" },

  // ─── Risers ───
  { q: "Can I add risers?",                                   a: "" },
  { q: "Can I remove the risers?",                            a: "" },
  { q: "Can risers be glass?",                                a: "" },
  { q: "Can they be timber?",                                 a: "" },
  { q: "Can risers have lighting?",                           a: "" },
  { q: "Which is safer, open or closed risers?",              a: "" },

  // ─── Lighting ───
  { q: "Can LED lighting be built in?",                       a: "" },
  { q: "Can lighting be changed later?",                      a: "" },
  { q: "Is the wiring hidden?",                               a: "" },
  { q: "What happens if the LEDs fail?",                      a: "" },
  { q: "Can the lights be dimmed?",                           a: "" },
  { q: "Can lighting be motion activated?",                   a: "" },
  { q: "Can I choose different colours?",                     a: "" },
  { q: "Can smart home systems control the lights?",          a: "" },
  { q: "Can the staircase be made without lighting?",         a: "" },

  // ─── Safety ───
  { q: "Is this staircase safe?",                             a: "" },
  { q: "Is it safe for children?",                            a: "" },
  { q: "Is it safe for elderly people?",                      a: "" },
  { q: "Is it safe for pets?",                                a: "" },
  { q: "Is it slippery?",                                     a: "" },
  { q: "Can anti-slip strips be fitted?",                     a: "" },
  { q: "Does it comply with regulations?",                    a: "" },
  { q: "Can balusters be added?",                             a: "" },
  { q: "Is glass safer than balusters?",                      a: "" },
  { q: "Is it noisy? Does it echo?",                          a: "" },
  { q: "Are open risers intimidating to some users?",         a: "" },

  // ─── Maintenance ───
  { q: "Is it difficult to clean?",                           a: "" },
  { q: "How do I clean the glass?",                           a: "" },
  { q: "Does the steel rust?",                                a: "" },
  { q: "Does timber require oiling?",                         a: "" },
  { q: "Can damaged treads be replaced?",                     a: "" },
  { q: "Can scratches be repaired?",                          a: "" },
  { q: "How long does it last?",                              a: "" },
  { q: "What warranty is offered?",                           a: "" },

  // ─── Value ───
  { q: "Does this increase house value?",                     a: "" },
  { q: "Is it worth the investment?",                         a: "" },
  { q: "Do buyers like feature staircases?",                  a: "" },
  { q: "Does it make a home easier to sell?",                 a: "" },
  { q: "Is it considered luxury?",                            a: "" },

  // ─── Regulations ───
  { q: "Will this comply with building regulations?",         a: "" },
  { q: "Does it comply where I live?",                        a: "" },
  { q: "Will I need approval?",                               a: "" },
  { q: "Will an engineer be required?",                       a: "" },
  { q: "Can the manufacturer advise on regulations?",         a: "" },

  // ─── Cost ─── (all fall under Nex Pricing Principle · Philip authors carefully)
  { q: "How much would something like this cost?",            a: "" },
  { q: "Can you give me a rough estimate?",                   a: "" },
  { q: "Why can't you tell me the price?",                    a: "" },
  { q: "What affects the price?",                             a: "" },
  { q: "Is glass more expensive?",                            a: "" },
  { q: "Is curved steel expensive?",                          a: "" },
  { q: "Can I reduce the cost?",                              a: "" },
  { q: "Is installation included?",                           a: "" },
  { q: "Can you work within my budget?",                      a: "" },
  { q: "Is my budget realistic?",                             a: "" },
  { q: "What budget should I allow?",                         a: "" },
  { q: "Can I build it in stages?",                           a: "" },
  { q: "Why is one staircase more expensive than another?",   a: "" },
  { q: "Why are curved staircases more expensive?",           a: "" },
  { q: "Why does glass increase the price?",                  a: "" },
  { q: "Why do bespoke staircases cost more?",                a: "" },
  { q: "How can I reduce the cost?",                          a: "" },
  { q: "What changes would make it cheaper?",                 a: "" },
  { q: "Can I install it myself to save money?",              a: "" },
  { q: "Can I buy the staircase without installation?",       a: "" },
  { q: "How many quotations should I get?",                   a: "" },
  { q: "Can you help me compare quotations?",                 a: "" },
  { q: "What should be included in a quotation?",             a: "" },
  { q: "Should engineering be included?",                     a: "" },
  { q: "Should installation be included?",                    a: "" },
  { q: "Should delivery be included?",                        a: "" },
  { q: "Should VAT or sales tax be included?",                a: "" },
  { q: "Do manufacturers require a deposit?",                 a: "" },
  { q: "When do I normally pay?",                             a: "" },
  { q: "Is staged payment common?",                           a: "" },
  { q: "Can I finance a staircase?",                          a: "" },
  { q: "Are there hidden costs?",                             a: "" },
  { q: "Are structural alterations extra?",                   a: "" },
  { q: "Is crane hire included?",                             a: "" },
  { q: "Are surveys included?",                               a: "" },
  { q: "Are engineer's fees included?",                       a: "" },
  { q: "Does a faster lead time cost more?",                  a: "" },
  { q: "Will ordering early save money?",                     a: "" },
  { q: "Do commercial staircases cost more?",                 a: "" },
  { q: "Why won't you give me a price?",                      a: "" },
  { q: "Are you hiding the cost?",                            a: "" },
  { q: "Can you at least give me a ballpark figure?",         a: "" },
  { q: "Why do you ask so many questions before discussing price?", a: "" },

  // ─── Suppliers ───
  { q: "Who makes staircases like this?",                     a: "" },
  { q: "Is there a manufacturer near me?",                    a: "" },
  { q: "Can Nex recommend someone?",                          a: "" },
  { q: "Can Nex introduce me to a supplier?",                 a: "" },
  { q: "Can I get multiple quotations?",                      a: "" },
  { q: "Can I visit a showroom?",                             a: "" },
  { q: "Can I see one before buying?",                        a: "" },
  { q: "Can I visit a factory?",                              a: "" },
  { q: "Can I speak to a manufacturer directly?",             a: "" },
  { q: "How do I choose the right manufacturer?",             a: "" },
  { q: "Can I see previous projects?",                        a: "" },
  { q: "Can I speak to previous customers?",                  a: "" },
  { q: "Do they manufacture in-house or outsource?",          a: "" },
  { q: "Are they insured?",                                   a: "" },
  { q: "Who is responsible if something goes wrong?",         a: "" },

  // ─── Image / Provenance ───
  { q: "Is this an AI image?",                                a: "" },
  { q: "Has this staircase actually been built?",             a: "" },
  { q: "Is this based on a real project?",                    a: "" },
  { q: "Can someone manufacture this exact design?",          a: "" },
  { q: "What would need changing before it could be built?",  a: "" },
  { q: "Can you show me similar staircases?",                 a: "" },
  { q: "Can you show me a cheaper version?",                  a: "" },
  { q: "Can you show me one in oak?",                         a: "" },
  { q: "Can you show me one with glass?",                     a: "" },
  { q: "Can you show me a straight version?",                 a: "" },
  { q: "Can you show me one for a smaller house?",            a: "" },

  // ─── Delivery ───
  { q: "How is it packaged?",                                 a: "" },
  { q: "Is insurance included?",                              a: "" },
  { q: "What if something arrives damaged?",                  a: "" },
  { q: "Can it be shipped internationally?",                  a: "" },
  { q: "Who pays shipping?",                                  a: "" },

  // ─── Site Survey ───
  { q: "Do I need a site survey?",                            a: "" },
  { q: "Who carries out the survey?",                         a: "" },
  { q: "How accurate do measurements need to be?",            a: "" },
  { q: "Can I measure it myself?",                            a: "" },
  { q: "What happens if measurements are wrong?",             a: "" },
  { q: "Can plans be used instead?",                          a: "" },
  { q: "Do I need architectural drawings?",                   a: "" },
  { q: "Do I need structural drawings?",                      a: "" },
  { q: "What photographs should I provide?",                  a: "" },
  { q: "Is the survey free?",                                 a: "" },

  // ─── Existing Staircase Removal ───
  { q: "Can my old staircase be removed?",                    a: "" },
  { q: "Who removes it?",                                     a: "" },
  { q: "How long does removal take?",                         a: "" },
  { q: "Is it messy?",                                        a: "" },
  { q: "Will walls or floors be damaged?",                    a: "" },
  { q: "Can I use my old staircase until installation day?",  a: "" },
  { q: "Do I need temporary access upstairs?",                a: "" },

  // ─── Structural (deeper) ───
  { q: "Will my walls support this staircase?",               a: "" },
  { q: "Does it need load-bearing walls?",                    a: "" },
  { q: "Can hidden steel be added?",                          a: "" },
  { q: "Does the engineer design the supports?",              a: "" },
  { q: "What if my floor is not level?",                      a: "" },
  { q: "Will the staircase settle over time?",                a: "" },

  // ─── Ceiling Opening ───
  { q: "Does my ceiling opening need changing?",              a: "" },
  { q: "Who cuts the opening?",                               a: "" },
  { q: "Will dust be created?",                               a: "" },
  { q: "Can the opening be enlarged or made smaller?",        a: "" },
  { q: "What shape should the opening be?",                   a: "" },
  { q: "Can lighting be built into the opening?",             a: "" },

  // ─── Timber (deeper) ───
  { q: "Is solid timber better?",                             a: "" },
  { q: "Is engineered timber better?",                        a: "" },
  { q: "Will oak change colour?",                             a: "" },
  { q: "Does walnut fade?",                                   a: "" },
  { q: "Can timber crack?",                                   a: "" },
  { q: "Will knots appear?",                                  a: "" },
  { q: "Is every tread unique?",                              a: "" },
  { q: "Can I choose the grain?",                             a: "" },
  { q: "Can I match my flooring, doors or kitchen?",          a: "" },
  { q: "What humidity is recommended?",                       a: "" },

  // ─── Steel (deeper) ───
  { q: "What thickness is the steel?",                        a: "" },
  { q: "Is it welded or bolted?",                             a: "" },
  { q: "Can welds be hidden?",                                a: "" },
  { q: "Does powder coating scratch?",                        a: "" },
  { q: "Can damaged powder coating be repaired?",             a: "" },
  { q: "Will the steel rust near the sea?",                   a: "" },
  { q: "Is marine-grade stainless available?",                a: "" },

  // ─── Comfort ───
  { q: "Is it comfortable barefoot?",                         a: "" },
  { q: "Does timber feel warm?",                              a: "" },
  { q: "Is steel cold underfoot?",                            a: "" },
  { q: "Will high heels damage timber?",                      a: "" },
  { q: "Can dogs and pets climb it comfortably?",             a: "" },
  { q: "Is it suitable for everyday family use?",             a: "" },

  // ─── Fire / Acoustics / Environment ───
  { q: "Is timber treated for fire?",                         a: "" },
  { q: "Does steel require fire protection?",                 a: "" },
  { q: "Does glass resist fire?",                             a: "" },
  { q: "Can acoustic insulation be added?",                   a: "" },
  { q: "Is this suitable in earthquake zones?",               a: "" },
  { q: "Can it be installed outdoors?",                       a: "" },
  { q: "Is UV protection needed?",                            a: "" },
  { q: "Can it cope with coastal environments?",              a: "" },

  // ─── Commercial ───
  { q: "Can this be installed in hotels?",                    a: "" },
  { q: "Can offices use this design?",                        a: "" },
  { q: "Are commercial regulations different?",               a: "" },
  { q: "Can heavier-duty versions be built?",                 a: "" },
  { q: "Can manufacturers quote for large developments?",     a: "" },

  // ─── Architects + Drawings ───
  { q: "Can my architect modify the design?",                 a: "" },
  { q: "Can CAD or BIM files be supplied?",                   a: "" },
  { q: "Will I receive drawings before production?",          a: "" },
  { q: "When is the design final?",                           a: "" },

  // ─── Warranty + Sustainability ───
  { q: "Is there a warranty?",                                a: "" },
  { q: "What does the warranty cover?",                       a: "" },
  { q: "What voids the warranty?",                            a: "" },
  { q: "Is the timber FSC certified?",                        a: "" },
  { q: "Is the steel recyclable?",                            a: "" },
  { q: "What is the carbon footprint?",                       a: "" },

  // ─── Nex assistance ───
  { q: "Can Nex estimate the likely cost?",                   a: "" },
  { q: "Can Nex compare staircase styles?",                   a: "" },
  { q: "Can Nex explain the pros and cons?",                  a: "" },
  { q: "Can Nex tell me what questions I should ask a manufacturer?", a: "" },
  { q: "Can Nex prepare my enquiry?",                         a: "" },
  { q: "Can Nex recommend a staircase style for my home?",    a: "" },
  { q: "Can Nex explain the installation process?",           a: "" },
  { q: "Can Nex find similar staircases?",                    a: "" },
  { q: "Can Nex save my favourite designs?",                  a: "" },
  { q: "Can Nex compare two staircase images?",               a: "" },
  { q: "Can Nex generate a specification from an image?",     a: "" },
  { q: "Can Nex prepare questions for my architect?",         a: "" },
  { q: "Can Nex connect me with a manufacturer?",             a: "" },
  { q: "Can Nex remember my project?",                        a: "" },
  { q: "Can Nex help me through the whole staircase journey?", a: "" },
];

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = rec.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("NEX-DESIGN-000020 (Nex020) updated ·");
console.log("  design_notes:", rec.design_notes.length, "chars");
console.log("  qa entries  :", rec.qa.length, "(authored so far:", authored + "/" + rec.qa.length + ")");
