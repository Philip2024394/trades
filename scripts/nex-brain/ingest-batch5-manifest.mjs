// Batch 5 · Staircase reference gallery · 2026-08-14 (Philip supplied · 49 images).
// Same pattern as batch4 · adds primary_domain=STAIRCASE + a_plus + rich tags.
// Dry-run by default. --apply to write.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const DRY = !process.argv.includes("--apply");
const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const MAPPING_PATH  = join(process.cwd(), "data", "incoming-image-ingest", "batch5-2026-08-14", "_mapping.json");

const BATCH = [
  { i: 1, type:"quarter_turn_L_landing_return", direction:"back-right-with-left-return", stringer:"closed_panelled_apron_wrapped_bullnose", balustrade:"wrought_iron_classical_twisted_black", materials:["light_oak","wrought_iron_black","rustic_stone_wall","exposed_timber_beams","travertine_tile"], lighting:["wall_sconce_classical"], style:"rustic_luxury_country_manor",
    notable:"rustic-luxury manor with stone wall cladding + exposed beams + classical wrought iron balusters · matching upper landing balustrade" },
  { i: 2, type:"half_turn_landing_return", direction:"back-right-with-left-return", stringer:"closed", balustrade:"turned_spindle_rich_dark_stained_bulb_urn", materials:["dark_stained_mahogany_oak","dark_wood_wall_panelling","patterned_cream_rose_runner","brass_rods","herringbone_parquet"], lighting:["classical_chandelier","arched_leaded_window_daylight"], style:"victorian_edwardian_grand_hall",
    notable:"VICTORIAN GRAND HALL · full-height dark wood panelled walls · ornate plaster crown moulding · framed oil painting · massive turned newel with elaborate acorn/vase finial" },
  { i: 3, type:"straight_flight_cantilever_open_riser", direction:"back", stringer:"cantilever_from_wall_right", balustrade:"none_open", materials:["natural_light_oak_thick_slabs","white_microcement_wall","polished_marble_floor"], lighting:["under_nosing_LED_wraps_under_lowest_tread_onto_floor","downlights"], style:"ultra_modern_penthouse_LED_drama",
    notable:"LED-DRAMA masterclass · under-nosing LED every tread + wraps under lowest tread onto floor · night city view · beige sofa · minimalist penthouse" },
  { i: 4, type:"straight_flight_bullnose", direction:"back", stringer:"closed_panelled_apron_matching_wainscot", balustrade:"ornate_dark_carved_wood_wrought_iron_twisted_spiral", materials:["dark_walnut","white_riser","white_wainscot","victorian_mosaic_tile_edge"], lighting:["under_nosing_LED","black_up_down_wall_sconce"], style:"georgian_townhouse_modernised_LED",
    notable:"Georgian townhouse with under-nosing LED · framed cathedral photographs · black door with stained glass · victorian mosaic tile edging" },
  { i: 5, type:"straight_flight_cantilever_open_riser", direction:"back-right", stringer:"cantilever_from_wall_right", balustrade:"frameless_glass_with_stainless_standoffs_walnut_cap", materials:["dark_walnut_treads","frameless_glass","dark_slate_stone_wall_cladding","polished_marble_floor","black_framed_glazing"], lighting:["under_nosing_LED_on_stone_wall","ceiling_edge_LED_strip"], style:"ultra_modern_architect_luxury_dark",
    notable:"night atmosphere · abstract dark art · balcony above · LED glow on stone wall" },
  { i: 6, type:"straight_flight_curved_bullnose_top_sweep", direction:"back-with-right-curve-at-top", stringer:"closed", balustrade:"turned_spindle_white_slim_classical", materials:["dark_walnut","white_risers","white_spindles","white_wainscot_chair_rail","brass_pendant_lantern"], lighting:["brass_pendant_lantern"], style:"federal_colonial_traditional",
    notable:"sweeping curved handrail at top · Federal/Colonial style · framed skyline photograph · black door" },
  { i: 7, type:"straight_flight_wide_flared_bullnose", direction:"back", stringer:"closed_full_wood_panelled_apron", balustrade:"turned_spindle_dark_stained_classical", materials:["dark_stained_oak_walnut","full_dark_wood_panelling_tudor_raised","cream_oatmeal_patterned_wool_runner","brass_rods","herringbone_parquet","persian_rug"], lighting:["classical_chandelier","arched_window_heavy_curtain","fireplace"], style:"jacobean_tudor_manor_traditional",
    notable:"JACOBEAN/TUDOR MANOR HALL · fireplace · framed portrait · massive dark walnut newel with elaborate acorn finial · very grand" },
  { i: 8, type:"straight_flight", direction:"back-right", stringer:"closed_wood_panelled", balustrade:"turned_spindle_classical_dark", materials:["rich_dark_stained_oak","full_dark_wood_panelling","cream_patterned_runner","brass_rods","victorian_mosaic_tile_edge","leaded_stained_glass_window"], lighting:["ambient","wall_sconces"], style:"traditional_english_manor_craftsmanship_documentation",
    notable:"CRAFTSMAN AT WORK · joiner kneeling actively finishing the newel · tools visible (chisel · mallet · jar of stain) · MASSIVE ornately carved dark oak newel · rare in-progress documentation" },
  { i: 9, type:"curved_sweep_flared_base", direction:"back-left-with-outward-curving-flare", stringer:"closed_dramatic_outward_sweep", balustrade:"turned_spindle_dark_oak_mahogany_bulb_urn", materials:["natural_mid_oak_treads","rich_dark_stained_spindles","warm_oak_handrail_darker","full_stone_clad_wall","exposed_timber_beams","flagstone_floor","persian_rug","patterned_wool_runner_brass_rods"], lighting:["massive_black_wrought_iron_chandelier","live_fire_fireplace"], style:"country_manor_grand_sweep_cotswold",
    notable:"COUNTRY MANOR GRAND SWEEP · dramatic outward-curling starting sweep · massive turned newel · fireplace with live fire · country estate scale" },
  { i:10, type:"straight_flight_landing_return_closeup", direction:"back-right", stringer:"closed", balustrade:"turned_spindle_white_slim_classical", materials:["dark_walnut_treads","dark_walnut_serpentine_handrail","white_spindles","massive_white_turned_newel_federal","dark_oak_floor"], lighting:["ambient"], style:"federal_colonial_serpentine_handrail_detail",
    notable:"UNUSUAL SERPENTINE (S-curve) HANDRAIL PROFILE · massive Federal-style white turned newels · close-up detail composition" },
  { i:11, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"slim_spindle_white_painted", materials:["dark_walnut_treads_handrail","bi_colour_newel_walnut_with_white_inset_panels","white_spindles","warm_herringbone_parquet"], lighting:["wall_step_light_aligned_per_tread"], style:"modern_traditional_hybrid_US_bi_colour_joinery",
    notable:"BI-COLOUR NEWEL (dark walnut with WHITE INSET FIELD PANELS) · framed b&w tree road print" },
  { i:12, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"framed_glass_in_walnut_top_and_base_channel", materials:["dark_walnut_framework","clear_glass","dark_walnut_floor","white_walls"], lighting:["ambient"], style:"modern_traditional_hybrid_walnut_framed_glass",
    notable:"framed glass balustrade (glass in oak channel not standoffs) · lamp on side table · framed landscape art" },
  { i:13, type:"straight_flight", direction:"back-right", stringer:"closed_navy_black_painted_stringer_baserail_apron", balustrade:"turned_spindle_white_slim_classical", materials:["natural_oak_treads_hidden_by_runner","navy_black_painted_stringer","white_joinery","oatmeal_patterned_wool_runner","brass_rods","cream_tile_floor"], lighting:["pendant_lantern"], style:"classic_uk_traditional_painted_navy_stringer",
    notable:"classic UK NAVY STRINGER + WHITE SPINDLES + OATMEAL RUNNER combination · very traditional" },
  { i:14, type:"straight_flight", direction:"back-right", stringer:"closed_sage_green_painted_stringer_baserail", balustrade:"turned_spindle_white_slim_classical", materials:["natural_oak_treads","sage_green_painted_stringer","white_joinery","oatmeal_wool_runner","brass_rods","cream_tile_floor"], lighting:["ambient"], style:"classic_uk_traditional_painted_sage_green_stringer",
    notable:"SAME construction as img-13 but SAGE GREEN stringer · teaches identity vs colour" },
  { i:15, type:"straight_flight", direction:"back-right", stringer:"closed_white_painted_stringer_apron", balustrade:"turned_spindle_white_slim_classical", materials:["dark_chocolate_brown_wool_runner","white_joinery_throughout","brass_stair_rods","dark_walnut_herringbone_floor","classical_black_wrought_pendant_lantern"], lighting:["classical_pendant_lantern"], style:"georgian_colonial_all_white_joinery_dark_brown_carpet",
    notable:"ALL-WHITE joinery with dark brown carpet contrast · classic Georgian/Colonial · classical lantern" },
  { i:16, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"turned_spindle_dark_walnut", materials:["dark_walnut_throughout_staircase","rich_burgundy_oxblood_wool_carpet_stairs_and_floor","white_walls","black_wrought_pendant_lantern"], lighting:["classical_pendant_lantern"], style:"grand_british_manor_all_walnut_burgundy_carpet",
    notable:"ALL-WALNUT stair joinery with WALL-TO-WALL BURGUNDY CARPET including floor · rare unified monochromatic richness" },
  { i:17, type:"straight_flight", direction:"back-right", stringer:"closed_dark_walnut_painted_stringer", balustrade:"slim_matt_black_metal_twisted_wrought_iron", materials:["dark_walnut_dark_stained","slim_matt_black_twisted_metal_balusters","light_neutral_beige_wool_carpet"], lighting:["modern_up_down_wall_sconce_beam"], style:"modern_traditional_english_walnut_black_iron",
    notable:"dark walnut framework + black iron twist balusters + beige carpet · framed abstract art" },
  { i:18, type:"straight_flight_medium", direction:"back-left", stringer:"closed", balustrade:"slim_white_classical_turned_spindle", materials:["dark_walnut_treads_handrail_newel_cap","white_spindles_newel_stringer_risers","dark_walnut_floor"], lighting:["ambient","framed_landscape","black_console_lamp"], style:"traditional_uk_white_and_walnut_two_tone",
    notable:"classic UK white-and-walnut two-tone · framed art · pot plant" },
  { i:19, type:"straight_flight", direction:"back-left", stringer:"closed", balustrade:"slim_white_classical_turned_spindle", materials:["dark_walnut_treads_handrail","white_joinery","dark_hardwood_floor"], lighting:["ambient"], style:"traditional_uk_white_and_walnut_two_tone",
    notable:"near-companion to img-18 · consistent white-and-walnut two-tone approach" },
  { i:20, type:"straight_flight", direction:"back-left", stringer:"closed", balustrade:"slim_white_classical_turned_spindle", materials:["natural_light_oak_treads_handrail","white_painted_joinery","natural_light_oak_wood_look_floor","black_framed_door_square_glazing"], lighting:["ambient","framed_botanical_prints"], style:"modern_uk_builder_light_oak_white_fresh",
    notable:"light oak + white painted joinery (fresh contemporary UK) · black glazed door as entry accent" },
  { i:21, type:"straight_flight", direction:"back", stringer:"closed", balustrade:"slim_white_classical_turned_spindle", materials:["dark_walnut_mid_oak_treads_risers_handrail","white_spindles_newel","warm_walnut_floor"], lighting:["pendant_lantern"], style:"traditional_english_white_walnut",
    notable:"two-tone traditional English · console with lamp + vase + basket + oval mirror" },
  { i:22, type:"straight_flight_understair_LED_shelves", direction:"back-right", stringer:"closed", balustrade:"matt_black_slim_vertical_rod", materials:["light_oak_treads_handrail_newel","built_in_understair_open_shelving_pull_out_drawers_LED_lit_compartments","matt_black_rods","white_risers","warm_oak_floor"], lighting:["under_nosing_LED","wall_step_light","internal_LED_in_shelving","LED_strip_on_floor_bottom_stringer"], style:"modern_british_sophisticated_LED_integrated_storage",
    notable:"INTEGRATED UNDERSTAIR OPEN SHELVING WITH LED INSIDE + pull-out drawers · books plants ornaments on shelves · very sophisticated" },
  { i:23, type:"straight_flight", direction:"back-right", stringer:"closed_white_painted_stringer", balustrade:"matt_black_slim_vertical_rod", materials:["light_oak_treads_handrail_newel","matt_black_rods","white_stringer","warm_oak_floor","dark_charcoal_accent_wall"], lighting:["under_nosing_LED","LED_newel_vertical_inset","pendant_lantern_cluster_3","framed_dark_art"], style:"modern_industrial_light_oak_black_dark_wall",
    notable:"LED strip inset into newel post face + dark charcoal accent wall · pendant cluster · framed dark art" },
  { i:24, type:"straight_flight", direction:"back-left", stringer:"closed_white_stringer", balustrade:"slim_square_white_painted_very_slim", materials:["light_oak_blonde_pine_treads_handrail_newel","white_spindles_stringer","light_oak_floor","natural_jute_doormat"], lighting:["under_nosing_LED","stainless_button_lights_inset_each_riser","up_down_black_wall_sconce"], style:"modern_british_new_build_button_LED",
    notable:"STAINLESS BUTTON LEDs inset in EACH RISER · framed monochrome art · kitchen with black window frames" },
  { i:25, type:"straight_flight", direction:"back", stringer:"closed_white_painted_stringer", balustrade:"slim_white_partial", materials:["dark_walnut_treads_newel_handrail","brushed_stainless_steel_metal_faced_risers","white_stringer","dark_oak_floor"], lighting:["stainless_button_LEDs_inset_each_riser","LED_strip_glow_under_lowest_riser","modern_up_down_wall_sconce"], style:"modern_luxury_metal_faced_risers_industrial",
    notable:"METAL-FACED RISERS with LED BUTTONS INSET · brushed stainless steel facing on each riser · industrial-luxury statement" },
  { i:26, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"horizontal_black_metal_rod", materials:["dark_walnut_throughout","black_horizontal_metal_rods","warm_oak_look_floor","potted_palm"], lighting:["under_nosing_LED","wall_step_light_left_wall"], style:"modern_industrial_dark_walnut_black_rods",
    notable:"dark walnut + horizontal black rods · cohesive · potted palm" },
  { i:27, type:"straight_with_top_landing", direction:"back-right", stringer:"closed", balustrade:"black_painted_thin_vertical_light_oak_handrail", materials:["light_oak_treads_handrail_newel","black_stained_understair_open_shelves_LED_lit_compartments_cabinet_doors","white_shiplap_wall_panelling_right","light_oak_floor"], lighting:["internal_LED_in_understair_shelves","pendant_lamp_adjacent"], style:"modern_british_luxury_black_understair_display",
    notable:"BLACK UNDERSTAIR DISPLAY UNIT with LED-LIT SHELVES · framed portrait photography on shiplap wall · museum-like display" },
  { i:28, type:"straight_with_top_landing", direction:"back", stringer:"closed_white_stringer", balustrade:"matt_black_slim_vertical_rod", materials:["light_oak_treads_handrail_newel","matt_black_rods","white_painted_stringer_baserail_risers","vertical_shiplap_upper_wall","built_in_white_understair_open_shelves_cabinet","light_oak_floor"], lighting:["under_nosing_LED","black_wall_step_light","lamp_on_shelf"], style:"modern_british_new_build_white_understair_shiplap",
    notable:"built-in WHITE understair display + cabinet · plants + art displayed · vertical shiplap upper wall" },
  { i:29, type:"straight_flight", direction:"back-right", stringer:"closed_black_painted_stringer_baserail_newel", balustrade:"slim_black_metal_or_dark_oak_vertical_rod", materials:["light_oak_treads_handrail","black_stringer_baserail_newel","white_painted_risers","light_oak_wood_look_floor","woven_basket_planter_olive_tree"], lighting:["under_nosing_LED","wall_step_light_left","LED_strip_under_bottom_step","modern_up_down_wall_sconce"], style:"modern_uk_contemporary_black_light_oak_minimal",
    notable:"framed photography · potted olive tree · sisal doormat · very minimal" },
  { i:30, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"woven_diamond_metallic_mesh_bronze_copper", materials:["dark_rustic_distressed_timber","metal_woven_diamond_mesh_bronze_copper","dark_oak_floor","rustic_wood_bench","vintage_brass_glass_lantern","dark_charcoal_walls"], lighting:["vintage_lantern","industrial_pendant_lights_orange_bulbs"], style:"industrial_rustic_vintage_metal_mesh_weathered_timber",
    notable:"UNIQUE WOVEN METAL DIAMOND MESH BALUSTRADE · industrial-rustic statement · framed b&w bridge photograph" },
  { i:31, type:"straight_flight_bullnose", direction:"back-left", stringer:"closed", balustrade:"twisted_barley_sugar_turned_spindle_dark_walnut", materials:["dark_walnut_mahogany_throughout","twisted_barley_sugar_turned_spindles_newel","dark_walnut_floor","white_panelled_wainscot"], lighting:["ambient","classical_lamp"], style:"classical_georgian_regency_twisted_turned_joinery",
    notable:"TWISTED/BARLEY-SUGAR turned spindles + twisted newel · very rare classical Georgian/Regency detail" },
  { i:32, type:"straight_flight_bullnose_wall_wrap", direction:"back-right", stringer:"closed", balustrade:"stainless_chrome_rod_with_white_acrylic_LED_glow_sections", materials:["dark_walnut_treads_handrail_newels","stainless_rod_balusters_with_white_cream_inset_sections","warm_wood_look_floor"], lighting:["LED_strip_under_bullnose_starting_step","acrylic_sections_between_metal_LED_lit"], style:"modern_hybrid_dark_walnut_chrome_rod_LED_accent",
    notable:"CHROME ROD BALUSTERS with LED-GLOW ACRYLIC SECTIONS between metal · unique baluster design · 3-piece framed abstract gallery wall" },
  { i:33, type:"quarter_turn_L_landing_bottom", direction:"back-left-with-turn-at-bottom", stringer:"closed_panelled_apron", balustrade:"turned_spindle_slim_classical_natural_light_oak", materials:["all_natural_light_oak","light_oak_herringbone_parquet","white_painted_wainscot"], lighting:["ambient"], style:"english_traditional_all_natural_light_oak",
    notable:"all-natural light oak traditional with matching herringbone floor · dark walnut console with lamp + plant · black entry door" },
  { i:34, type:"straight_flight_narrow_industrial", direction:"back-right", stringer:"closed_reclaimed_weathered_barn_timber_apron", balustrade:"black_iron_plumbing_pipe_handrail_flange_brackets", materials:["reclaimed_weathered_pine_oak_barn_timber_distressed","black_iron_plumbing_pipe","dark_wood_look_floor","exposed_brick_accent"], lighting:["under_nosing_LED"], style:"industrial_rustic_loft_pipe_handrail_reclaimed",
    notable:"INDUSTRIAL PIPE HANDRAIL · actual black plumbing pipe with elbows/flanges · framed 'BUILT NOT BOUGHT' text art · exposed brick pillar" },
  { i:35, type:"straight_with_landing_return", direction:"back-right", stringer:"closed", balustrade:"matt_black_metal_twisted_classical_bulb", materials:["mid_stained_oak_treads_handrail_newels","matt_black_metal_twisted_classical_balusters","warm_wood_look_floor","neutral_rug","framed_art"], lighting:["under_nosing_LED"], style:"modern_traditional_english_black_iron_oak",
    notable:"TWISTED WROUGHT-IRON STYLE BLACK BALUSTERS with centre-bulb detail · candle on tray" },
  { i:36, type:"straight_flight_bullnose", direction:"back-right", stringer:"closed_white_painted_stringer_apron", balustrade:"slim_square_dark_walnut", materials:["dark_walnut_throughout_balustrade_treads_risers","white_painted_stringer_apron","warm_wood_look_floor"], lighting:["ambient","console_lamp"], style:"traditional_american_craftsman_all_dark_walnut",
    notable:"all-dark-walnut styling with slim modern square spindles · black door with wreath · console with vase" },
  { i:37, type:"straight_flight", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"barley_sugar_twisted_alternating_plain_turned_natural_light_oak", materials:["all_natural_light_oak","black_console_vase","warm_ambient","herringbone_parquet","framed_abstract_mustard_beige_art"], lighting:["classical_wall_sconce"], style:"modern_traditional_georgian_light_natural_oak",
    notable:"BARLEY-SUGAR TWISTED spindles ALTERNATING with plain turned · Georgian/Regency detail in LIGHT NATURAL finish (unusual)" },
  { i:38, type:"straight_flight", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"barley_sugar_twisted_alternating_plain_turned_natural_light_oak", materials:["all_natural_light_oak","matching_wood_floor","framed_landscape","console_lamp"], lighting:["ambient"], style:"modern_traditional_georgian_light_natural_oak",
    notable:"near-companion to img-37 · same barley-sugar twisted spindle detail" },
  { i:39, type:"straight_flight", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"turned_spindle_slim_classical_natural_light_oak", materials:["all_natural_light_oak","warm_wood_look_floor","natural_jute_mat","framed_landscape_art"], lighting:["classical_wall_sconce"], style:"traditional_light_oak_classical",
    notable:"STANDARD classical turned spindles in natural light oak (non-twisted)" },
  { i:40, type:"straight_flight", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"turned_spindle_slim_classical_natural_light_oak", materials:["all_natural_light_oak","warm_wood_look_floor"], lighting:["ambient"], style:"traditional_light_oak_classical",
    notable:"near-companion to img-39 · same standard classical natural light oak style" },
  { i:41, type:"straight_flight_industrial", direction:"back-right", stringer:"closed_reclaimed_weathered_timber_apron", balustrade:"black_iron_plumbing_pipe_handrail_flange_brackets", materials:["reclaimed_weathered_timber_treads_apron","black_iron_plumbing_pipe","dark_wood_look_floor","exposed_brick","rustic_wall_art"], lighting:["under_nosing_LED","gold_pendant_light","framed_work_hard_dream_big_text_art"], style:"industrial_rustic_loft_bar_scene",
    notable:"industrial pipe handrail companion to img-34 · bar-scene interior · framed NYC photo" },
  { i:42, type:"straight_flight_bullnose", direction:"back-right", stringer:"closed_panelled_apron_rounded_bullnose", balustrade:"ornate_matt_black_metal_scroll_ribbon_multiple_loop_elements", materials:["all_natural_light_oak_framework","ornate_matt_black_metal_scroll_balusters","warm_herringbone_parquet","framed_landscape","console_lamp_plant"], lighting:["classical_wall_sconce"], style:"modern_traditional_ornate_black_iron_light_oak",
    notable:"ORNATE BLACK METAL SCROLL BALUSTERS with multiple loop/scroll elements per baluster · heavy classical wrought-iron × light oak" },
  { i:43, type:"straight_flight", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"ornate_matt_black_metal_scroll_ribbon_multiple_loop_elements", materials:["all_natural_light_oak_framework","ornate_matt_black_metal_scroll_balusters"], lighting:["ambient"], style:"modern_traditional_ornate_black_iron_light_oak",
    notable:"near-companion to img-42 · same ornate black metal scroll balusters + light oak" },
  { i:44, type:"straight_flight_bullnose", direction:"back-right", stringer:"closed_panelled_apron_rounded_bullnose", balustrade:"barley_sugar_twisted_alternating_plain_turned_natural_light_oak", materials:["all_natural_light_oak","sage_green_wall_paint_feature","warm_herringbone_parquet"], lighting:["classical_wall_sconce","lamp"], style:"modern_traditional_georgian_sage_green_wall",
    notable:"same barley-sugar detail as img-37/38 with SAGE GREEN wall backdrop · colour variation companion" },
  { i:45, type:"straight_flight", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"turned_spindle_slim_classical_natural_light_oak", materials:["all_natural_light_oak","warm_cream_walls","warm_herringbone_parquet"], lighting:["ambient"], style:"traditional_light_oak_classical",
    notable:"standard classical turned spindles in natural light oak · similar to img-39" },
  { i:46, type:"landing_balustrade_horizontal_slat", direction:"landing_runs_left_right", stringer:"closed_light_oak_newels", balustrade:"horizontal_light_oak_slatted_balustrade", materials:["all_natural_light_oak_balustrade","dark_olive_moss_green_wall_backdrop","warm_oak_floor","black_framed_window","black_door"], lighting:["modern_wall_sconces_up_down"], style:"modern_british_sophisticated_horizontal_slat",
    notable:"HORIZONTAL TIMBER SLAT BALUSTRADE (parallel horizontal light oak slats not vertical) · dark olive wall backdrop · circular abstract art" },
  { i:47, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"framed_glass_in_light_oak_top_and_base_channel_stainless_clamps", materials:["light_oak_treads_risers_handrail_newel","frameless_glass","dark_charcoal_accent_wall","warm_wood_look_floor","abstract_colourful_framed_art"], lighting:["wall_sconce"], style:"modern_british_light_oak_framed_glass_charcoal",
    notable:"framed glass balustrade (top+bottom oak channel not standoffs) · dark charcoal accent wall backdrop · abstract colourful art" },
  { i:48, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"ornate_matt_black_metal_scroll_S_curve", materials:["all_natural_light_oak_framework","matt_black_scroll_profile_ornate_balusters","deep_ink_blue_navy_accent_wall","warm_wood_look_floor","framed_landscape_art"], lighting:["ambient"], style:"modern_traditional_ornate_black_iron_navy_wall",
    notable:"SCROLL-PROFILE ORNATE BLACK IRON BALUSTERS (S-curve variant) · DEEP NAVY WALL backdrop" },
  { i:49, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"heavy_ornate_matt_black_metal_multiple_loop_scroll", materials:["all_natural_light_oak","heavy_ornate_black_metal_balusters","pale_yellow_mustard_accent_wall","warm_wood_look_floor","framed_landscape_art"], lighting:["ambient"], style:"modern_traditional_ornate_black_iron_yellow_wall",
    notable:"same style as img-42 with YELLOW/MUSTARD wall backdrop · companion showing wall-colour range" },
];

const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
const urlByIdx = new Map();
for (const it of mapping.items) urlByIdx.set(it.idx, it.url);

const mani = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

if (!DRY) {
  const backupDir = join(process.cwd(), "data", ".manifest-backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `manifest-pre-batch5-ingest-${ts}.json`);
  copyFileSync(MANIFEST_PATH, backupPath);
  console.log(`Backup: ${backupPath}`);
}

const NOW = new Date().toISOString();
const RUN_STAMP = "batch5-2026-08-14";
let added = 0, skipped = 0;

console.log("");
console.log(`Batch 5 · processing ${BATCH.length} images ${DRY ? "· DRY RUN" : "· LIVE APPLY"}`);
console.log("─".repeat(60));

for (const spec of BATCH) {
  const url = urlByIdx.get(spec.i);
  if (!url) { console.log(`  [${spec.i}] SKIP no url in mapping`); continue; }
  if (mani.images[url]) { console.log(`  [${spec.i}] SKIP already in manifest`); skipped++; continue; }

  const tags = [
    "staircase", "reference", "hero-scene",
    "batch-5-2026-08-14", "philip-supplied", "staircase_brain", "domain:STAIRCASE",
    `type:${spec.type}`, `direction:${spec.direction}`, `stringer:${spec.stringer}`, `balustrade:${spec.balustrade}`,
    ...spec.materials.map((m) => `material:${m}`),
    ...spec.lighting.map((l) => `lighting:${l}`),
    `style:${spec.style}`,
  ];

  const description = [
    `STAIRCASE REFERENCE · Batch 5 · img-${String(spec.i).padStart(2, "0")}`,
    "",
    `TYPE · ${spec.type.replace(/_/g, " ")}`,
    `DIRECTION · ${spec.direction}`,
    `STRINGER · ${spec.stringer.replace(/_/g, " ")}`,
    `BALUSTRADE · ${spec.balustrade.replace(/_/g, " ")}`,
    `MATERIALS · ${spec.materials.map((m) => m.replace(/_/g, " ")).join(", ")}`,
    `LIGHTING · ${spec.lighting.map((l) => l.replace(/_/g, " ")).join(", ")}`,
    `STYLE · ${spec.style.replace(/_/g, " ")}`,
    "",
    `NOTABLE · ${spec.notable}`,
    "",
    `PROVENANCE · Supplied by Philip 2026-08-14 (ImageKit).`,
    `EVIDENCE · Every observation derived from direct multimodal read of the pixels · never inferred beyond what is visible.`,
    `COMPANION DOCUMENT · data/nex-reference-brains/staircase-preparation/layer-2-drafts/staircase-reference-gallery-batch-5-2026-08-14.md`,
  ].join("\n");

  mani.images[url] = {
    source: "philip_supplied",
    original_prompt: null,
    description,
    master_ai_prompt: null,
    created_at: NOW,
    created_by: "batch-5-ingest",
    notes: `Batch 5 · img-${String(spec.i).padStart(2, "0")} · ${spec.notable}`,
    tags,
    a_plus: true,
    subject_domain: "staircase",
    primary_domain: "STAIRCASE",
    primary_brain: "staircase_brain",
    image_type: "reference",
    image_purpose: { primary: "brain_evidence", secondary: "matcher_source", tertiary: "advisor_reference" },
    collection_id: "staircase_reference_batch_5",
    collection_memberships: ["staircase_references", "batch_5_2026_08_14"],
    material_composition: spec.materials,
    can_become: ["directory_card_hero", "brain_chat_evidence", "advisor_illustration"],
    family_tree: { children: [] },
    geometry_preservation: {
      preserve_by_default: true,
      allowed_modifications: ["material", "colour", "lighting"],
      never_change_without_explicit_request: ["geometry", "proportions", "composition", "perspective", "architectural-details"],
    },
    learning_signals: [],
    knowledge_band: "reference",
    knowledge_band_label: "Reference Knowledge",
    human_tagged_by: "philip-supplied",
    human_tagged_at: NOW,
    marked_by: "batch-5-ingest",
    not_a_staircase: false,
    _ingest_batch: RUN_STAMP,
    _enrichment: {
      domain_classified_at: NOW,
      domain_classified_reason: "batch5_direct_observation",
      record_state_expected: "routable",
    },
  };

  added++;
  console.log(`  [${String(spec.i).padStart(2, "0")}] ADD · ${spec.type} · ${spec.balustrade.slice(0, 40)} · ${spec.style.slice(0, 30)}`);
}

console.log("─".repeat(60));
console.log(`Added   : ${added}`);
console.log(`Skipped : ${skipped}`);

if (!DRY && added > 0) {
  mani.generated_at = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(mani, null, 2), "utf8");
  console.log(`Manifest written: ${MANIFEST_PATH}`);
} else if (DRY) {
  console.log("");
  console.log("DRY RUN · no manifest write. Re-run with --apply to persist.");
}
