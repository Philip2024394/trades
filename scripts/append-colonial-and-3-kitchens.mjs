#!/usr/bin/env node
// Append 1 Colonial staircase + 3 luxury kitchens (Japandi × 2 + Transitional
// Shaker) to data/nex-image-manifest.json (Philip 2026-08-04).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const AT = "2026-08-04T03:15:00.000Z";

const entries = {
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%204,%202026,%2002_45_57%20AM.png": {
    source: "ai_generated",
    description: "STAIRCASE OBJECT REFERENCE · colonial_turned_oak_wainscot · Traditional English/American Colonial staircase with turned vase-shaped newels and matching turned balusters. Solid oak (European or American White Oak) with clear satin lacquer · natural golden colour. Straight flight · closed-string construction · rounded bullnose starter step with extended tread and softened front corner. Treads solid oak with rounded bullnose nosing · risers painted white timber creating bright oak-and-white contrast. Newels: large TURNED vase-shaped posts with decorative stacked rings and rounded ball finial · lathe-turned solid oak · satin finish · colour-matched to handrail and treads. Handrail: solid oak · traditional moulded profile · continuous flowing line · comfortable rounded grip · seamlessly joins the newels. Balusters: lathe-turned solid oak with narrow neck · decorative centre section · square base · even spacing (Georgian/Colonial/Hamptons vocabulary). Stringers: painted white · closed-string · decorative curved transition at the bottom step · clean mitred joints. Wall panelling: traditional picture-frame wainscoting · painted white rectangular panel mouldings running alongside the staircase. Ceiling: decorative crown moulding · smooth plaster · recessed warm-white LED downlights. Wall sconce: antique brass with white fabric shade · warm ambient light. Flooring: wide-plank engineered oak with natural satin finish · warm honey colour · continuous throughout the hallway.",
    created_at: AT,
    created_by: "philip",
    notes: "staircase_object_reference · Traditional English/American Colonial · turned vase newels + turned balusters + oak treads + white risers + wainscoting + crown moulding + antique brass sconce · straight closed-string with bullnose starter",
    tags: [
      "staircase", "luxury_staircase", "traditional_staircase", "colonial_staircase",
      "georgian_staircase", "hamptons_staircase", "turned_newel_staircase",
      "turned_baluster_staircase", "oak_treads_white_risers", "closed_string",
      "bullnose_starter", "wainscoting", "crown_moulding", "antique_brass_sconce",
      "engineered_oak_flooring", "training_specimen", "joinery_dna_seed",
      "material_genome_seed", "construction_rules_seed", "philip_authored",
    ],
    a_plus: true,
    subject_domain: "staircase",
    style_class: "colonial_turned_oak_wainscot",
    primary_material: "oak_solid_satin_lacquer_with_painted_risers",
    confidence: 0.98,
    verified_by_human: true,
    human_tagged_at: AT,
    human_tagged_by: "philip",
    primary_brain: "staircase_brain",
    cross_domain_reference: ["staircase", "joinery", "panelling", "flooring", "interior", "_shared/design-coordination"],
  },

  "https://ik.imagekit.io/5vv5pw26q/Untitledasdsdsss.png": {
    source: "ai_generated",
    description: "KITCHEN OBJECT REFERENCE · scandinavian_japandi_walnut_waterfall_island · L-shaped luxury Scandinavian/Japandi kitchen with large central island · open-plan dining+living · tall appliance wall · full-height cabinetry. Upper cabinets: handleless slab · soft matte warm-white lacquer / anti-fingerprint laminate · ceiling-height · integrated finger-pull channel · symmetrical layout. Base + tall wall cabinets: natural walnut oak veneer · horizontal grain running continuously across drawers · handleless with soft-close · deep drawer storage · vertical black pull handles on the tall cabinet wall for accent. Island centrepiece: waterfall QUARTZ end panel + walnut veneer feature panel + undermount prep sink + matte black gooseneck mixer + seating overhang for 3. Worktops: engineered quartz / porcelain slab · warm white · very subtle veining · square 20-40mm profile. Splashback: matching quartz slab full-height · seamless · no tiles. Main sink undermount black composite + matte black gooseneck tap · second smaller prep sink on island with matching tap (dual-sink workflow). Open display niches: walnut veneer lining · floating shelves · concealed warm LED · plants + ceramics + bowls. Lighting: continuous under-cabinet warm LED strip + display shelf LEDs + oversized matte-black dome pendant with brass accent + recessed warm downlights. Integrated appliances (oven · microwave · pantry · likely hidden fridge) aligned in the walnut tall wall. Bar stools: white upholstered seats + slim black steel legs. Flooring: large-format light-beige porcelain tiles.",
    created_at: AT,
    created_by: "philip",
    notes: "kitchen_object_reference · Scandinavian/Japandi Luxury · L-shaped with island · walnut oak veneer base+tall cabinets + matte white slab uppers + waterfall quartz + walnut display niches + matte black + brass pendant accent",
    tags: [
      "kitchen", "luxury_kitchen", "scandinavian_kitchen", "japandi_kitchen",
      "contemporary_kitchen", "handleless_kitchen", "l_shaped_kitchen",
      "walnut_oak_veneer_base_cabinets", "matte_white_upper_cabinets",
      "waterfall_quartz_island", "walnut_display_niche", "dual_sink_kitchen",
      "matte_black_fittings", "brass_pendant_accent", "warm_led_lighting",
      "training_specimen", "joinery_dna_seed", "material_genome_seed", "philip_authored",
    ],
    a_plus: true,
    subject_domain: "kitchen",
    kitchen_context: "training_specimen",
    style_class: "scandinavian_japandi_walnut_waterfall_island",
    primary_material: "walnut_veneer_and_matte_white_slab",
    confidence: 0.98,
    verified_by_human: true,
    human_tagged_at: AT,
    human_tagged_by: "philip",
    primary_brain: "kitchen_brain",
    cross_domain_reference: ["kitchen", "joinery", "cabinetry", "stone", "lighting", "_shared/design-coordination"],
  },

  "https://ik.imagekit.io/5vv5pw26q/Untitledsasssdxcdxdasdfddxcxcfdsfxcvdf.png": {
    source: "ai_generated",
    description: "KITCHEN OBJECT REFERENCE · scandinavian_japandi_symmetrical_walnut · Symmetrical single-wall luxury Scandinavian/Japandi kitchen with an extra-large central island · tall appliance bank · open-plan family kitchen · dining area adjacent to island. Perfect vertical + horizontal symmetry throughout cabinetry, lighting, and shelving. Upper cabinets: super-matte lacquered MDF · flat slab · handleless · ceiling-height with aligned vertical shadow gaps · symmetrical. Base cabinets: light walnut oak veneer with horizontal grain · deep drawers · handleless finger-pull · soft-close. Tall cabinet wall: floor-to-ceiling walnut veneer · pantry + built-in oven + integrated microwave + hidden fridge · vertical black pull handles · uninterrupted furniture-quality finish. Island: extra-large · WATERFALL white quartz ends + walnut feature panel + seating for 3 + undermount prep sink + matte black gooseneck mixer + large uninterrupted preparation surface. Worktops: engineered quartz / sintered stone / porcelain slab · warm white with soft cream undertone · very subtle marble veining · square 20-40mm profile. Splashback: full-height matching quartz slab continuous from worktop to underside of wall cabinets. Two sinks (main + island prep) both with matte black gooseneck mixer. Two illuminated walnut display niches with floating shelves + concealed warm LED. Lighting: continuous under-cabinet warm LED (2700-3000K) + niche LEDs + oversized matte-black dome pendant with brass accent + recessed warm downlights evenly spaced. Cream upholstered ergonomic bar stools on slim black steel frames. Flooring: large-format warm beige stone-effect porcelain tiles · matte · minimal grout.",
    created_at: AT,
    created_by: "philip",
    notes: "kitchen_object_reference · Scandinavian/Japandi Luxury · single-wall symmetrical variant · walnut oak veneer + matte white slab + waterfall quartz + dual sinks + illuminated niches + matte black pendant with brass accent",
    tags: [
      "kitchen", "luxury_kitchen", "scandinavian_kitchen", "japandi_kitchen",
      "contemporary_kitchen", "handleless_kitchen", "single_wall_kitchen",
      "symmetrical_kitchen", "walnut_oak_veneer_base_cabinets",
      "matte_white_upper_cabinets", "waterfall_quartz_island",
      "walnut_display_niche", "dual_sink_kitchen", "matte_black_fittings",
      "brass_pendant_accent", "training_specimen", "joinery_dna_seed",
      "material_genome_seed", "philip_authored",
    ],
    a_plus: true,
    subject_domain: "kitchen",
    kitchen_context: "training_specimen",
    style_class: "scandinavian_japandi_symmetrical_walnut",
    primary_material: "walnut_veneer_and_matte_white_slab",
    confidence: 0.98,
    verified_by_human: true,
    human_tagged_at: AT,
    human_tagged_by: "philip",
    primary_brain: "kitchen_brain",
    cross_domain_reference: ["kitchen", "joinery", "cabinetry", "stone", "lighting", "_shared/design-coordination"],
  },

  "https://ik.imagekit.io/5vv5pw26q/Untitledasdsdsssdfdf.png": {
    source: "ai_generated",
    description: "KITCHEN OBJECT REFERENCE · transitional_shaker_brass_oak_shelf · U-shaped Luxury Transitional Shaker kitchen · large central island + floor-to-ceiling pantry wall + dedicated cooking zone + separate sink+prep area + open-plan family layout · efficient work triangle with generous circulation. Door style: slim-frame Shaker with recessed centre panel · full-overlay · consistent proportions. Finish: painted warm white / soft cream undertone · satin or ultra-matte. Upper cabinets ceiling-height with decorative crown moulding · full-height pantry · integrated extractor hood with custom mantle. Tall pantry cabinets: double doors · slim brass pull handles · symmetrical · hidden internal shelving. Kitchen island: painted shaker panels · large quartz worktop · seating for 2-3 · decorative end panels · wide overhang (traditional furniture-style rather than waterfall). Worktops: premium white quartz / engineered stone · warm white with subtle grey veining · matte or polished · straight square 30-40mm edge. Splashback: full-height matching quartz slab · minimal veining · seamless · no tiles. Main sink: large undermount stainless steel / composite · deep single bowl · brushed BRASS gooseneck mixer matching cabinet hardware and pendant fittings. Cooking zone: professional-style range cooker · decorative plaster or timber range hood · symmetrical base cabinets · integrated under-cabinet LED. Open floating shelves: solid oak · floating concealed brackets · integrated warm LED strip under shelf · display bowls/plants/ceramics · warmth against the painted cabinetry. Lighting: two large clear glass globe pendants with brushed brass fittings + warm exposed filament bulbs · continuous under-cabinet warm LED · concealed shelf LEDs · recessed warm downlights. Hardware: brushed brass knobs + brass cup pulls on drawers + long brass pantry handles + matching brass tap (consistent throughout). Flooring: large-format stone-look porcelain in soft beige · matte · minimal grout.",
    created_at: AT,
    created_by: "philip",
    notes: "kitchen_object_reference · Luxury Transitional Shaker · painted warm white shaker cabinets + ceiling-height + crown moulding + white quartz worktop and splashback + BRUSHED BRASS hardware and taps + floating solid-oak shelves with LED + clear-glass globe pendants with brass",
    tags: [
      "kitchen", "luxury_kitchen", "transitional_kitchen", "modern_shaker_kitchen",
      "hamptons_kitchen", "english_classic_kitchen", "u_shaped_kitchen",
      "painted_shaker_cabinets", "ceiling_height_cabinets", "crown_moulding_kitchen",
      "white_quartz_worktop", "matching_quartz_splashback", "brushed_brass_hardware",
      "brushed_brass_tap", "floating_oak_shelves", "led_shelf_lighting",
      "glass_globe_pendant", "training_specimen", "joinery_dna_seed",
      "material_genome_seed", "philip_authored",
    ],
    a_plus: true,
    subject_domain: "kitchen",
    kitchen_context: "training_specimen",
    style_class: "transitional_shaker_brass_oak_shelf",
    primary_material: "painted_shaker_with_oak_shelves_and_brass",
    confidence: 0.98,
    verified_by_human: true,
    human_tagged_at: AT,
    human_tagged_by: "philip",
    primary_brain: "kitchen_brain",
    cross_domain_reference: ["kitchen", "joinery", "cabinetry", "stone", "lighting", "_shared/design-coordination"],
  },
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
let added = 0;
for (const [url, meta] of Object.entries(entries)) {
  if (manifest.images[url]) {
    console.log("skip · exists:", url.slice(-50));
    continue;
  }
  manifest.images[url] = meta;
  added++;
  console.log("added:", meta.style_class);
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`\nAdded ${added} specimens · manifest now has ${Object.keys(manifest.images).length} images`);
