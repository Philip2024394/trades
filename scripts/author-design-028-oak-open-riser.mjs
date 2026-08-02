// Add NEX-DESIGN-000028 · Modern Oak Open-Riser Staircase · Steel Stringer · Vertical Timber Slat Balustrades.
// Philip 2026-08-02 · image + verbatim Nex Premium Analysis.
// Primary image: ChatGPT Image Aug 2, 2026, 02_29_45 AM.png

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

const existing = d.confirmed.find((r) => r.design_id === "NEX-DESIGN-000028");
const now = new Date().toISOString();

const record = {
  design_id:            "NEX-DESIGN-000028",
  title:                "Modern Oak Open-Riser Staircase · Steel Stringer · Vertical Timber Slat Balustrade",
  design_family:        "Modern Architectural",
  primary_brain:        "staircase",
  url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2002_29_45%20AM.png?updatedAt=1785612608208",
  additional_views:     [],
  view_types:           ["hero"],
  staircase_type:       "straight flight · open riser · steel side string · vertical oak slat balustrade · upper landing return",
  layout:               "straight flight rising from lower floor to first-floor landing · open risers throughout · vertical timber slats form both stair balustrade and landing guard as one continuous feature",
  materials: [
    "solid oak or engineered oak treads (35–45mm)",
    "powder-coated black steel side string (plate or box section)",
    "solid oak square balusters (40×40mm to 50×50mm typical)",
    "oak slatted landing guardrail matching stair balustrade",
    "hardwax oil or clear matt lacquer finish on oak",
  ],
  balustrade_style:     "vertical oak slat screen · equal spacing (~80–100mm centres) · same rhythm continues around landing edge and balcony · floor-to-ceiling sections",
  handrail_style:       "minimal / integrated · possible oak top rail · black steel handrail · or timber cap integrated into balustrade",
  newel_style:          "not a traditional newel-post design · slim black steel string acts as structural anchor",
  design_style:         "modern · warm minimalism · Scandinavian · open plan · floating · architectural feature",
  project_suitability:  ["luxury_residential","new_build","open_plan_home","modern_home","double_height_hallway","architectural_project"],
  priority:             "recommended",
  related_articles:     [],
  customer_description: "A luxury modern open-riser staircase that combines warm oak with slim black steel. Straight flight rising from the lower floor to an upper landing. Open risers let light through and give the staircase a floating appearance. The balustrade is a series of vertical oak slats that continue around the upper landing to create one continuous architectural feature. The steel side string is deliberately slim to keep the visual focus on the oak.",
  designer_notes:       "Premium look achieved not by using expensive materials everywhere but by combining slim structure (steel) with high-quality visible material (oak). The repeated vertical timber rhythm turns the staircase into an architectural feature rather than only a way of moving between floors. Baluster spacing typically 80–100mm centres to comply with regulations.",
  confirmed_by:         "Philip O'Farrell",
  confirmed_at:         now,
  image_state:          "concept",
  families:             ["straight-flight","open-riser","timber-balustrade"],
  components:           ["tread","stringer","baluster","handrail","landing"],

  design_notes: `NEX PREMIUM STAIRCASE VISION ANALYSIS · Modern Open-Riser Oak Staircase with Feature Balustrade

OVERALL DESIGN
High-end contemporary open-plan staircase inside a modern home. The staircase combines natural oak timber, black steel structural elements, vertical timber slat balustrades, open riser construction, large double-height hallway and minimal architectural styling. The design language is warm minimalism / Scandinavian modern architecture.

STAIRCASE CONFIGURATION
Straight flight staircase with intermediate landing / upper gallery connection. The staircase rises from the lower floor to a first-floor landing area. Features: open risers · floating appearance · no traditional closed stringer boxing · slim side support design.

TREADS
Appear to be oak timber treads with a natural light oak finish. Thick solid appearance, visible timber grain, warm natural colour. Likely construction: solid oak, or engineered oak tread with hardwood top layer. Approximate 35–45mm tread thickness.

RISERS
This is an open riser staircase — there are no solid vertical riser boards between steps. The gap allows light flow through the staircase, larger visual space and a floating appearance.

STAIR STRING / STRUCTURE
The staircase appears to use a black steel side string. Visible black metal structure runs along the stair edge. Purpose: carries tread loads, creates a slim modern profile, contrasts against oak. Possible construction: powder-coated steel plate string, or steel box section frame.

BALUSTRADE DESIGN — VERTICAL TIMBER SLATS
The dominant feature. Construction: multiple vertical oak battens, equal spacing, floor-to-ceiling height sections. Creates safety barrier, architectural screen, privacy without blocking light.

BALUSTER SPECIFICATION
Approximate material: oak timber. Shape: square section. Size estimate: 40mm × 40mm to 50mm × 50mm. Spacing: around 80–100mm centres. Finish: clear lacquer or hardwax oil.

LANDING BALUSTRADE
The upper floor uses the same vertical timber rhythm. The balustrade continues around the landing edge, stair opening and balcony area. This creates one continuous architectural feature.

HANDRAIL
Minimal or integrated handrail design. Possible: oak top rail · black steel handrail · timber cap integrated into the balustrade.

MATERIALS BREAKDOWN
Structure: steel string/frame · engineered timber support.
Visible components: oak treads · oak square timber balusters · oak slat landing guard · powder-coated black steel.

MANUFACTURING METHOD (CNC / Factory Process)
Engineer staircase dimensions → cut oak treads → machine timber balusters → fabricate steel string → powder coat steel → assemble sections → install on site.

JOINERY DETAILS
Timber balusters fixed using hidden metal rods, dowels, screws from concealed side, or structural adhesive. Oak treads fixed using adhesive bonding, mechanical fixing, or hidden brackets.

DESIGN STYLE CLASSIFICATION
NEX Design Category: Modern Architectural Oak Open Riser Staircase.
Tags: luxury residential · minimalist · Scandinavian · open plan · floating staircase · timber slat balustrade · steel and oak combination.

RECOMMENDED NEX MATERIAL SPECIFICATION
Treads: engineered oak / solid oak.
Strings: powder-coated steel.
Balusters: solid oak square posts.
Landing guard: oak slats.
Fixings: hidden mechanical + adhesive.
Finish: hardwax oil / clear lacquer.

NEX DESIGN NOTES
This staircase achieves its premium look by combining heavy natural material (oak treads and balusters) with a light structural appearance (slim black steel support). The key design feature is the repeated vertical timber rhythm, which turns the staircase into an architectural feature rather than only a method of moving between floors.

DETAILED CONSTRUCTION, MATERIALS, ENGINEERING & MANUFACTURING BREAKDOWN

PROJECT TYPE
Luxury Residential Open-Riser Staircase + Mezzanine Balustrade System. Not designed as a simple stair — an architectural feature element that connects the lower living space with the upper floor while creating a visual divider between spaces. The staircase becomes part of the interior architecture.

1. STAIRCASE GEOMETRY — Flight Type
Straight flight · open risers · side-mounted string structure · upper landing return · balcony continuation.

2. OPEN RISER CONSTRUCTION
Advantages: allows light through · makes the room feel larger · creates floating appearance · modern architectural look.

3. OAK TREAD CONSTRUCTION
Option 1: solid oak, 35–45mm thick.
Option 2: engineered oak tread — 4–6mm oak wear layer on multi-layer timber core with stable backing. Engineered oak is often better than solid oak because it is more stable, has less cupping, less cracking, and is better for underfloor heating environments.

4. TREAD EDGE DETAIL
Square edge (modern appearance) or slight 2–5mm radius (less sharp, better paint/oil durability, more comfortable).

5. STEEL STRINGER SYSTEM
Steel plate string 8–12mm thick powder-coated black, OR steel box section (e.g. 100×50mm or 120×60mm). Allows slim appearance · longer spans · open visual design · less timber bulk.

6. OAK BALUSTRADE SYSTEM
The vertical slats perform two functions: safety barrier and architectural screen.
Baluster manufacturing: solid oak (best option, sections 40×40mm / 45×45mm / 50×50mm) or oak veneer over engineered core (more stable, lower cost, less timber movement).

7. BALUSTER SPACING
Modern staircase requirements normally control spacing. Typical 80–100mm gaps for safety, visual rhythm and child protection. This design uses a tight vertical rhythm.

8. LANDING GUARDRAIL DESIGN
The upper balcony uses the same timber size, spacing and finish as the stair balustrade — creating a continuous architectural feature rather than mismatched stair/landing styles.

9. CONNECTION DETAILS
Oak tread to steel string: hidden brackets (steel plate welded under tread), threaded rods (inserted into oak), or adhesive bonding (structural adhesive + mechanical fixing).
Oak baluster fixing: bottom fixing via steel pins, threaded rods or concealed screws. Top fixing via routed handrail groove or hidden fixing channel.

10. FINISH SPECIFICATION
Hardwax oil: natural appearance, easy repair, shows grain. Examples: natural oak, clear matt finish.
Lacquer: more resistant, easier maintenance, but harder to repair locally.

11. MANUFACTURING PROCESS
Step 1: site measurement (laser survey of floor levels, opening size, ceiling height).
Step 2: CAD design (3D staircase model, steel drawings, cutting lists).
Step 3: steel fabrication (cut · weld · grind · powder coat).
Step 4: timber manufacturing (cut · plane · sand · machine profiles · finish).
Step 5: assembly (components checked before delivery).
Step 6: installation (steel first · treads · balusters · handrail · final finish).

12. NEX PREMIUM MATERIAL SPECIFICATION
Style: Modern Oak Open Riser Steel Stair.
Structural layer: powder-coated steel string · structural fixings · engineered support brackets.
Walking layer: 40mm engineered oak treads.
Vertical layer: 45mm oak square balusters.
Landing protection: oak slatted guardrail.
Finish: clear matt hardwax oil.

13. COST LEVEL CLASSIFICATION
Standard ££: oak treads + simple balustrade.
Premium £££: oak + custom steel + factory finish.
Luxury ££££: bespoke steel fabrication, engineered oak, CNC timber components, architectural detailing.

NEX INTELLIGENCE NOTE
This staircase demonstrates an important design principle: the structure is hidden and slim, the materials people touch are premium, the repeated timber elements create the architectural identity. The expensive appearance comes from consistent spacing, high-quality oak, precise fabrication and clean junctions — not from using expensive materials everywhere.`,

  qa: [
    // Genuinely image-specific — everything universal / family / component
    // is covered by higher layers (materials, treads, balustrade etc.).
    { q: "What type of staircase is this?",                                 a: "This is a modern open-riser staircase with a black steel side string, oak treads and a vertical oak slat balustrade continuing around the upper landing." },
    { q: "Is this staircase floating?",                                     a: "It has a floating APPEARANCE. It is not truly cantilevered — the treads are carried by a slim black steel side string. The open risers and slim structure create the floating look." },
    { q: "What is the balustrade made from?",                               a: "Solid oak square balusters, typically 40×40mm to 50×50mm, spaced at around 80–100mm centres, running floor-to-ceiling. The same rhythm continues around the upper landing." },
    { q: "Can this staircase be built with a different timber?",            a: "Yes. The oak in this design could be replaced with walnut, ash, or other hardwoods depending on the manufacturer's material options. The steel colour can also be changed." },
    { q: "Can this staircase be built today?",                              a: "Yes. This design uses well-established modern staircase construction techniques (steel side stringer + engineered oak treads + timber slat balustrade). An experienced staircase manufacturer should be able to build a staircase of this style, adapting the dimensions, materials and details to suit your home and local building regulations." },
    // Deliberately empty · image-visible detail slots for later authoring
    { q: "What colour is the steel in this image?",                         a: "" },
    { q: "How many balusters are shown between the stair and the landing?", a: "" },
    { q: "Is there a visible handrail on this staircase?",                  a: "" },
    { q: "Is the ceiling above this staircase double height?",              a: "" },
    { q: "What direction does this staircase travel?",                      a: "" },
  ],
};

if (existing) {
  Object.assign(existing, record);
  console.log("NEX-DESIGN-000028 (Nex028) · UPDATED in place");
} else {
  d.confirmed.push(record);
  console.log("NEX-DESIGN-000028 (Nex028) · CREATED");
}
d.updated_at = now;
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = record.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("  Title:        ", record.title);
console.log("  design_notes: ", record.design_notes.length, "chars");
console.log("  qa entries:   ", record.qa.length, "· authored:", authored);
console.log("  families:     ", record.families.join(", "));
console.log("  components:   ", record.components.join(", "));
