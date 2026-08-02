// Add NEX-DESIGN-000027 · Classic Quarter-Turn Oak Staircase with Feature Landing.
// Philip 2026-08-02 · authored image + design_notes + qa (all Rule A · Philip words).
//
// Primary image: 03_12_10 AM.png (853×1844 · aspect 0.46 · passes library filter)
// Additional view: 03_08_27 AM.png (1122×1402 · aspect 0.80 · added as auxiliary view)

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

// Check if already exists · idempotent overwrite
const existing = d.confirmed.find((r) => r.design_id === "NEX-DESIGN-000027");
const now = new Date().toISOString();

const record = {
  design_id:            "NEX-DESIGN-000027",
  title:                "Classic Quarter-Turn Oak Staircase · Feature Landing",
  design_family:        "Traditional",
  primary_brain:        "staircase",
  url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2003_12_10%20AM.png?updatedAt=1785615152201",
  additional_views: [
    "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2003_08_27%20AM.png?updatedAt=1785614928027",
  ],
  view_types:           ["hero", "alt"],
  staircase_type:       "traditional quarter-turn (L-shape) with intermediate landing · closed-string · oak treads · painted risers and strings",
  layout:               "wide bottom step · straight flight from hallway · generous quarter landing · 90° turn left · continues to first floor",
  materials: [
    "solid oak stair treads",
    "white painted risers",
    "white painted strings",
    "large painted square hardwood newel posts",
    "painted timber square balusters",
    "hardwood handrails stained to match treads",
    "MDF or timber wall panelling",
  ],
  balustrade_style:     "painted square balusters · equal spacing · timber handrail · matching landing balustrade",
  handrail_style:       "stained hardwood matching treads",
  newel_style:          "large square painted hardwood feature newel posts",
  design_style:         "traditional · transitional · family home · feature entrance",
  project_suitability:  ["family_home","traditional_home","transitional_home","new_build","renovation","period_property","entrance_hall"],
  priority:             "standard",
  related_articles:     [],
  customer_description: "A traditional closed-string staircase combining classic joinery with modern interior styling. Wide entrance, generous intermediate landing, 90-degree quarter turn before continuing to the upper floor. Solid oak treads, white painted risers and strings, painted square newels and balusters, hardwood handrails stained to match the treads. Creates a grand entrance while remaining practical for everyday family living.",
  designer_notes:       "Timeless traditional style suitable for both traditional and modern homes because colours and finishes can easily be changed. Closed string with concealed tread ends. Landing acts as structural rest point + turn point. Under-stair area readily convertible to cupboards / cloakroom / wine storage / display.",
  confirmed_by:         "Philip O'Farrell",
  confirmed_at:         now,
  image_state:          "concept",
  families:             ["straight-flight", "steel-balustrade" /* placeholder · closed-riser + timber-balustrade + landing families should be added */, "timber-balustrade"],
  components:           ["stringer","tread","riser","newel","handrail","baluster","landing"],

  design_notes: `OVERALL TYPE
Traditional / transitional quarter-turn (L-shaped) staircase with intermediate landing. Fully supported closed-string construction — NOT floating, NOT cantilevered. Once installed, becomes part of the building structure.

DIRECTION OF TRAVEL
Wide bottom step → straight flight from the hallway → generous quarter landing → 90° turn left → continues to first floor. Landing provides comfortable pause during the climb and makes the staircase easier to use than a continuous straight flight.

STRUCTURAL DESIGN
Fully supported timber staircase using traditional construction methods. Support provided by: closed timber strings · floor structure · landing platform · upper floor connections · newel posts · handrail system.

MATERIALS (as shown)
Oak stair treads · white painted risers · white painted strings · large painted hardwood newel posts (square feature) · painted timber square balusters · hardwood handrails stained to match the treads · MDF or timber wall panelling · painted finish throughout.

NEWEL POSTS
Large square feature newel posts define the staircase. Structural support · handrail fixing points · balustrade strength · decorative appearance. Substantial size gives timeless appearance.

BALUSTRADES
Square painted balusters · equal spacing · timber handrail · matching landing balustrade. Alternatives available in bespoke work: glass · metal · oak · wrought iron · contemporary square profiles · traditional turned spindles.

TREADS
Thick hardwood treads · comfortable walking depth · hardwood wear surface · square front nosings · traditional appearance · long service life. Oak is one of the most popular choices because it is durable and can be refinished.

RISERS
Closed painted risers · traditional appearance · no gaps between steps · reduced visibility underneath · cleaner architectural lines · more suitable for many family homes.

STRINGS
Closed strings (NOT cut string) · tread ends concealed inside the side strings · greater traditional appearance · cleaner finish · easy to decorate · strong construction.

LANDING
Important structural component. Changes direction · connects both staircase flights · provides a resting point · makes furniture movement easier · reduces the visual length of the staircase.

UNDER-STAIR AREA
Because this is a closed-string staircase, the area underneath can often be converted into: storage · cupboards · cloakroom · wine storage · utility cupboard · display area.

WALL PANELLING
Decorative wall mouldings complement the staircase. Not part of the staircase itself but help create a premium entrance hall.

LIGHTING (as shown)
Wall lights illuminate the staircase evenly. Additional options: LED tread lighting · handrail lighting · motion sensors · pendant lighting · feature chandeliers.

CUSTOMISATION (typical bespoke options)
Timber species · paint colours · tread colour · handrail colour · newel style · baluster style · starting step · landing size · stair width · rise and pitch (within building regulations) · wall panelling · lighting · storage beneath.

SUITABILITY
Commonly chosen by families because it offers: full-width treads · closed risers · strong handrails · wide landing · traditional construction · comfortable walking angle. Final suitability depends on compliance with local building regulations and the requirements of the property.

CAN THIS STAIRCASE BE MANUFACTURED TODAY?
Yes. Uses well-established staircase construction techniques. An experienced staircase manufacturer should be able to build a staircase of this style, adapting the dimensions, materials and details to suit your home and local building regulations.

WHAT IS VISIBLE VS INFERRED
Visible: closed-string construction · quarter landing · oak treads · white painted risers/strings/newels/balusters · matching landing balustrade · square feature newel posts · wall panelling · wall lighting.
Inferred (cannot confirm from image alone): exact rise / going / overall width · timber species used specifically for newels vs handrail vs treads · specific paint colour codes · installation method into the wall / floor structure · engineering calculations for specific building.
Nex should be explicit about this distinction when answering customer questions.`,

  qa: [
    // Genuinely design-specific · everything universal / family / component
    // is now covered by the higher layers.
    { q: "Is this a bespoke staircase?",                             a: "It can be built as a completely bespoke staircase or adapted from a manufacturer's standard range." },
    { q: "Can I replace the black balusters with glass?",            a: "Yes. In many cases the balustrade design can be changed while keeping the main staircase structure." },
    { q: "Can I have oak newel posts instead?",                      a: "Usually yes. Many manufacturers offer painted, oak, walnut, ash and other timber options." },
    { q: "Can I remove the landing?",                                a: "Not usually without redesigning the entire staircase. The landing is an integral part of this layout." },
    { q: "Is this style likely to go out of fashion?",               a: "Traditional oak and painted staircases have remained popular for generations. Because the colours and balustrades can be updated over time, this style has excellent long-term appeal." },
    { q: "Is this staircase suitable for families?",                 a: "Yes. This style is commonly chosen by families because it offers full-width treads, closed risers, strong handrails, a wide landing, traditional construction and a comfortable walking angle. Final suitability depends on compliance with local building regulations and the requirements of the property." },
    { q: "Can this staircase be manufactured today?",                a: "Yes. This design uses well-established staircase construction techniques. An experienced staircase manufacturer should be able to build a staircase of this style, adapting the dimensions, materials and details to suit your home and local building regulations." },
    { q: "Can Nex guarantee this exact staircase can be built?",     a: "Nex will never guess or make promises it cannot verify. This style uses recognised staircase construction methods and is achievable by experienced manufacturers. If your project includes unique structural requirements or custom engineering, Nex can, with your permission, prepare your project and connect you with an experienced staircase manufacturer to confirm the best solution." },
    // Genuinely image-specific observations
    { q: "What colour are the risers in this image?",                a: "" },
    { q: "What colour are the newel posts?",                         a: "" },
    { q: "What direction does this staircase turn?",                 a: "" },
    { q: "Is the landing wide?",                                     a: "" },
    { q: "Are the treads stained darker than the handrail?",         a: "" },
    { q: "What wall panelling is visible?",                          a: "" },
    { q: "Is this a closed-string staircase?",                       a: "" },
  ],
};

if (existing) {
  Object.assign(existing, record);
  console.log("NEX-DESIGN-000027 (Nex027) · UPDATED in place");
} else {
  d.confirmed.push(record);
  console.log("NEX-DESIGN-000027 (Nex027) · CREATED");
}
d.updated_at = now;
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = record.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("  Title:        ", record.title);
console.log("  design_notes: ", record.design_notes.length, "chars");
console.log("  qa entries:   ", record.qa.length, "· authored:", authored);
console.log("  families:     ", record.families.join(", "));
console.log("  components:   ", record.components.join(", "));
