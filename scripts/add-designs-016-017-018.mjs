// Add 3 confirmed staircase designs (Philip 2026-08-01 · vision analyses)
//
// Images:
//   NEX-DESIGN-000016 · 12_52_21 · Walnut + brushed stainless-steel risers +
//                                   brushed steel perforated panels + steel-capped illuminated newel
//   NEX-DESIGN-000017 · 12_35_51 · Oak + black perforated panels + matte-black risers +
//                                   illuminated newel + framed under-stair panelling
//   NEX-DESIGN-000018 · 12_32_48 · Light oak + black perforated panels + illuminated newel +
//                                   under-tread LED + shaker-style under-stair panelling

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");
const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));

const now = new Date().toISOString();
const DESIGN_ID = (n) => `NEX-DESIGN-${String(n).padStart(6, "0")}`;

const newRecords = [
  {
    design_id:            DESIGN_ID(16),
    title:                "Contemporary Luxury · Walnut · Brushed Stainless-Steel Risers · Perforated Steel Panels · Steel-Capped Illuminated Newel",
    design_family:        "Contemporary",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_52_21%20AM.png",
    view_types:           ["hero"],
    staircase_type:       "straight flight · closed-string · feature architectural",
    layout:               "closed-string both sides · rectangular starting step · enclosed triangular under-stair with recessed timber panel",
    materials:            [
      "walnut hardwood treads",
      "walnut structural strings",
      "walnut handrail",
      "walnut under-stair panelling",
      "brushed stainless-steel risers",
      "brushed stainless-steel perforated infill panels",
      "brushed stainless-steel newel cap and base shoe",
      "warm white LED lighting",
      "matching timber flooring",
    ],
    balustrade_style:     "brushed stainless-steel perforated panels · regular circular perforation pattern · three separate balustrade sections · stainless-steel fixing brackets on timber uprights · industrial-modern language",
    handrail_style:       "walnut · continuous · square-edged profile · mounted to top of balustrade posts",
    newel_style:          "large square walnut starting newel · brushed stainless-steel cap · brushed stainless-steel base shoe · full-height vertical recessed LED on the face",
    design_style:         "contemporary luxury · industrial-modern · high-end residential · engineered premium",
    project_suitability:  ["luxury_home", "modern_home", "boutique_office", "high_end_residential", "architectural_feature", "premium_refurbishment"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A luxury contemporary walnut staircase distinguished by brushed stainless-steel risers that reflect warm concealed LED lighting between every tread. Balustrade uses three brushed stainless-steel perforated panels with a regular circular pattern. The square walnut starting newel has a stainless-steel cap and base shoe with a full-height vertical LED strip, and the underside is fully enclosed with a large triangular recessed walnut panel. LED under-skirt lighting creates a floating base effect.",
    designer_notes:       "Defining features: (1) brushed stainless-steel risers (rare · distinctive premium detail) · (2) brushed stainless-steel perforated balustrade panels (not black — matches the risers) · (3) steel-capped illuminated walnut newel · (4) fully enclosed decorative walnut under-stair panel. Under-skirt LED + illuminated newel + reflective risers give multi-layer lighting. Suited to luxury contemporary homes and boutique offices where the staircase is a focal architectural feature.",
    confirmed_by:         "Philip O'Farrell",
    confirmed_at:         now,
  },
  {
    design_id:            DESIGN_ID(17),
    title:                "Modern · Oak · Black Perforated Steel Panels · Matte Black Risers · Illuminated Newel · Framed Under-Stair Panelling",
    design_family:        "Contemporary",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_35_51%20AM.png",
    view_types:           ["hero"],
    staircase_type:       "straight flight · closed-string · feature entrance",
    layout:               "closed wall string + closed outer string · fully enclosed triangular under-stair panel · rectangular starting step",
    materials:            [
      "oak treads · natural satin finish",
      "oak strings",
      "oak handrail",
      "oak under-stair panelling with framed moulding",
      "matte black risers",
      "powder-coated black perforated steel infill panels",
      "matte black steel brackets and hinges",
      "warm white LED lighting",
      "warm timber flooring",
    ],
    balustrade_style:     "three matte black perforated steel panels · evenly-spaced circular perforations · mounted between square oak posts · black steel fixing brackets/hinges as design feature",
    handrail_style:       "oak · continuous · square contemporary profile · mounted directly above balustrade panels",
    newel_style:          "large square oak starting newel · matte black cap · matte black base shoe · full-height recessed warm-white LED on the front face",
    design_style:         "contemporary premium · industrial-influenced · modern craftsman · high-end residential",
    project_suitability:  ["modern_home", "luxury_home", "family_home", "high_end_residential", "architectural_feature"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A premium contemporary straight-flight oak staircase with matte-black perforated steel balustrade panels and matte-black risers that create strong contrast against the warm oak. The square oak starting newel has a full-height vertical LED strip framed by matte-black cap and base shoe. Enclosed triangular under-stair panelling with a large recessed framed-moulding panel gives a furniture-quality finish.",
    designer_notes:       "Defining features: (1) oak strings + handrail (light warmth) contrasted with (2) matte black perforated balustrade panels, (3) matte black risers, and (4) illuminated oak newel with black metalwork. Under-stair enclosure uses a FRAMED MOULDING panel (distinguishes this design from the shaker-panel variant NEX-DESIGN-000018). Modern architectural render · panel brackets are decorative rather than typical of a real-world install.",
    confirmed_by:         "Philip O'Farrell",
    confirmed_at:         now,
  },
  {
    design_id:            DESIGN_ID(18),
    title:                "Modern Scandinavian · Light Oak · Black Perforated Steel Panels · Illuminated Newel · Under-Tread LED · Shaker Under-Stair Panelling",
    design_family:        "Contemporary",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_32_48%20AM.png",
    view_types:           ["hero"],
    staircase_type:       "straight flight · closed-string · feature entrance",
    layout:               "closed timber strings both sides · enclosed triangular under-stair with raised shaker-style panels · rectangular starting step",
    materials:            [
      "light oak treads (European or American white oak)",
      "light oak strings",
      "light oak handrail",
      "light oak shaker-style under-stair panels",
      "powder-coated black perforated steel infill panels",
      "black steel fixing brackets and clamps",
      "warm white LED lighting (under every tread)",
      "medium brown timber flooring",
    ],
    balustrade_style:     "black perforated steel panels · evenly-spaced circular holes · industrial-modern · fixed with visible black brackets/clamps to square timber posts",
    handrail_style:       "solid light oak · continuous · follows the stair pitch · natural satin finish",
    newel_style:          "large square oak starting newel · matte black cap · matte black plinth base · full-height recessed warm-white vertical LED on the front face",
    design_style:         "modern Scandinavian · industrial-modern · warm architectural · premium residential",
    project_suitability:  ["modern_home", "family_home", "scandinavian_style_home", "high_end_residential", "architectural_feature"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A modern Scandinavian straight-flight staircase in light oak with black perforated steel balustrade panels. Warm LED strips fitted beneath every tread wash the risers below and create a floating step effect. The square oak starting newel carries a full-height vertical LED with black cap and plinth. Under-stair is enclosed with raised oak shaker-style panelling that gives the staircase a built-in furniture feel.",
    designer_notes:       "Defining features vs sibling design NEX-DESIGN-000017: (a) SHAKER-style raised under-stair panels (not framed moulding) · (b) under-tread LED emphasised (illuminates the risers below rather than the risers being metallic) · (c) lighter Scandinavian oak tone. Architectural render · noted observation: panel brackets shown are decorative — real-world install would typically use groove/rebate fixings into the top and base rails.",
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
