// Add 2 confirmed staircase designs (Philip 2026-08-01 · vision analyses)
//
//   NEX-DESIGN-000019 · 12_14_13 · Grand curved sweeping walnut staircase ·
//                                    frameless glass · cylindrical timber newel ·
//                                    Japanese-inspired indoor garden beneath
//   NEX-DESIGN-000020 · 12_05_37 · Ultra-luxury sculptural double-curved staircase ·
//                                    black steel stringers · walnut treads · frameless
//                                    curved glass · cylindrical living-garden atrium

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");
const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));

const now = new Date().toISOString();
const DESIGN_ID = (n) => `NEX-DESIGN-${String(n).padStart(6, "0")}`;

const newRecords = [
  {
    design_id:            DESIGN_ID(19),
    title:                "Ultra-Luxury · Grand Sweeping Curved Staircase · Walnut · Frameless Glass · Cylindrical Timber Newel · Indoor Japanese Garden",
    design_family:        "Contemporary",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_14_13%20AM.png",
    view_types:           ["hero"],
    staircase_type:       "grand curved · sweeping S-shape · single-flight to upper gallery",
    layout:               "single curved flight transitioning into a curved landing and upper walkway · double-height entrance hall · open mezzanine · curved bullnose starting step",
    materials:            [
      "walnut or dark-stained oak treads",
      "curved laminated timber stringers",
      "matching curved timber handrails",
      "frameless clear tempered glass balustrade",
      "stainless-steel / concealed glass fixings",
      "warm white LED lighting",
      "wide-plank engineered oak flooring",
      "decorative glass pendant lights",
      "natural rocks and low planting (indoor garden)",
    ],
    balustrade_style:     "frameless clear tempered glass panels · continuous curved timber cap rail · minimal concealed fixings · glass continues seamlessly onto the upper gallery",
    handrail_style:       "curved solid timber cap · matches walnut treads · continuous sweeping profile from starting post to upper walkway · no intermediate newels",
    newel_style:          "large cylindrical timber starting post · fully curved bullnose first step wraps around the newel · no traditional square newels",
    design_style:         "contemporary luxury · organic architecture · flowing sculptural curves · bespoke handcrafted joinery · boutique residence aesthetic",
    project_suitability:  ["luxury_home", "grand_residence", "double_height_hall", "architectural_feature", "high_end_residential", "hotel_residence", "boutique_residence"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A grand sweeping curved staircase forming the architectural centrepiece of a double-height contemporary entrance hall. Solid walnut treads on curved laminated timber stringers, a fully frameless glass balustrade with a continuous curved timber cap rail, and a cylindrical timber starting post that wraps into a curved bullnose first step. Warm LED lighting beneath every tread and along the curved underside gives the flight a semi-floating quality. Beneath the flight sits an indoor Japanese-inspired garden with a sculptural bonsai-style tree, natural rocks and concealed landscape lighting.",
    designer_notes:       "Defining features: (1) grand SWEEPING S-shaped single curved flight · (2) cylindrical timber starting newel + bullnose step (no traditional square newels) · (3) frameless glass with continuous curved timber cap rail (no intermediate posts) · (4) INDOOR JAPANESE GARDEN beneath the flight — rare high-luxury signature detail · (5) multi-layer lighting (under-tread + under-stair curve + pendant + cove + downlights + landscape uplighting). Premium custom staircase requiring CNC-machined curved timber, laminated curved strings, bent glass and specialist installation. Architectural render (uniform grain / perfectly even LED / idealised reflections) — treat as a design concept.",
    confirmed_by:         "Philip O'Farrell",
    confirmed_at:         now,
  },
  {
    design_id:            DESIGN_ID(20),
    title:                "Ultra-Luxury · Sculptural Double-Curved Staircase · Black Steel Stringers · Walnut Treads · Frameless Curved Glass · Cylindrical Living-Garden Atrium",
    design_family:        "Biophilic",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_05_37%20AM.png",
    view_types:           ["hero"],
    staircase_type:       "sculptural double-curved · opposing curved flights merging into central upper landing · S-shape · multi-storey atrium",
    layout:               "two opposing curved flights merging into a central landing · open-riser · hidden steel support within curved stringers · floating appearance · raised sculptural base platform with rounded corners and layered edges",
    materials:            [
      "black architectural steel curved stringers",
      "walnut or dark oak thick timber treads",
      "curved laminated timber",
      "frameless low-iron curved tempered glass",
      "slim black metal handrails",
      "warm white LED lighting",
      "polished stone flooring",
      "living plants (green wall + tropical foliage)",
      "natural rocks and landscape planting",
    ],
    balustrade_style:     "frameless curved tempered glass · follows complex curves seamlessly · slim black metal handrails mounted on top of glass · minimal visible fixings",
    handrail_style:       "slim black metal rail · continuous · mounted on top edge of the curved glass balustrade",
    newel_style:          "no traditional newels · continuous curved black steel stringer forms the structural edge · handrail runs uninterrupted between flights",
    design_style:         "ultra-modern luxury · organic architecture · biophilic · minimalist detailing · sculptural centrepiece · high-end hospitality or premium residential",
    project_suitability:  ["luxury_home", "grand_residence", "hotel_lobby", "multi_storey_atrium", "biophilic_interior", "architectural_feature", "high_end_hospitality"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A sculptural double-curved staircase forming the centrepiece of a multi-storey atrium. Two opposing curved flights sweep upward and merge into a central landing, wrapping around a full-height cylindrical living garden with a planted green wall, tropical foliage and a circular suspended feature ring. Black architectural steel stringers, thick walnut open-riser treads with under-tread LED, and frameless curved low-iron glass balustrades with slim black metal handrails. The staircase sits on a raised sculptural base with recessed LED and integrated planting.",
    designer_notes:       "Defining features: (1) OPPOSING double-curved flights merging into a central landing (distinct from the single-flight sweep of NEX-DESIGN-000019) · (2) black steel stringers (not timber) · (3) cylindrical living-garden atrium with green wall as the structural centrepiece the staircase wraps around · (4) frameless CURVED low-iron glass · (5) raised sculptural base platform with integrated planting. Classified as design_family=Biophilic because the integrated planting is a defining design element, not an accent. Extreme construction complexity: custom-engineered steel framework, CNC-machined curved timber, bent glass, structural engineering for long unsupported curves. Architectural render (perfectly symmetric curves, idealised LED, flawless glass reflections) — treat as a design concept.",
    confirmed_by:         "Philip O'Farrell",
    confirmed_at:         now,
  },
];

for (const rec of newRecords) {
  const dupById  = lib.confirmed.find((r) => r.design_id === rec.design_id);
  const dupByUrl = lib.confirmed.find((r) => r.url === rec.url);
  if (dupById || dupByUrl) {
    console.log(`skip existing · ${rec.design_id} · ${rec.title}`);
    continue;
  }
  lib.confirmed.push(rec);
  console.log(`added · ${rec.design_id} · ${rec.design_family} · ${rec.title.slice(0, 80)}...`);
}

lib.updated_at = now;
writeFileSync(LIBRARY_PATH, JSON.stringify(lib, null, 2), "utf8");
console.log(`\nVisual Brain · ${lib.confirmed.length} designs · ${lib.confirmed.reduce((s, r) => s + 1 + (r.additional_views?.length ?? 0), 0)} image URLs`);
