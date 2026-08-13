// Batch 6 · Staircase reference gallery · 2026-08-14 (Philip supplied · 51 images).
// Same protocol as batches 4 & 5. Dry-run by default. --apply to write.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const DRY = !process.argv.includes("--apply");
const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const MAPPING_PATH  = join(process.cwd(), "data", "incoming-image-ingest", "batch6-2026-08-14", "_mapping.json");

const BATCH = [
  { i: 1, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"frameless_glass_with_light_oak_handrail_LED_newel_inset", materials:["light_oak","frameless_glass","dark_grey_accent_wall","warm_oak_floor"], lighting:["LED_newel_vertical_inset","matt_black_wall_sconce"], style:"modern_british_luxury_light_oak_glass_LED_newel",
    notable:"LED-inset newel post + frameless glass + dark grey accent wall + abstract colourful art" },
  { i: 2, type:"upper_landing_balustrade", direction:"landing-runs-left-right", stringer:"closed_light_oak_newels", balustrade:"sculpted_branch_tree_fretwork_light_oak_backlit", materials:["natural_light_oak","dark_olive_moss_green_wall","warm_wood_look_floor","pendant_cluster"], lighting:["LED_backlight_behind_fretwork"], style:"modern_british_luxury_organic_sculptural_fretwork",
    notable:"UNIQUE ORGANIC BRANCH FRETWORK BALUSTRADE — carved silhouette resembles stylised tree branches · LED backlight" },
  { i: 3, type:"upper_landing_balustrade", direction:"landing-runs-left-right", stringer:"closed_light_oak_matte_black_newel_accents", balustrade:"frameless_glass_LED_newel_inset", materials:["light_oak","frameless_glass","matte_black","dark_olive_wall","warm_floor","glass_rod_pendant_cluster"], lighting:["LED_newel_inset","LED_under_handrail"], style:"modern_british_luxury_light_oak_glass_LED_accents",
    notable:"LED-inset newel strips + LED under handrail + pendant cluster + olive wall (design series with img-02, 04, 06, 07, 08)" },
  { i: 4, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"horizontal_light_oak_slat_panels_full_flight", materials:["all_natural_light_oak","dark_olive_moss_green_wall","warm_oak_floor","black_wall_sconce","geometric_black_yellow_cream_art"], lighting:["ambient"], style:"modern_british_sophisticated_horizontal_slat_flight",
    notable:"HORIZONTAL TIMBER SLAT BALUSTRADE full-flight version (batch-5 img-46 was landing version)" },
  { i: 5, type:"straight_flight_with_symmetrical_upper_split_landings_galleria", direction:"back-centre-with-symmetrical-split-landings-above", stringer:"closed", balustrade:"chunky_light_oak_newel_with_black_metal_accent_plates_LED_inset_black_thin_balusters", materials:["light_oak","black_metal","mustard_yellow_walls","light_oak_floor","red_persian_runner","black_framed_doors","glass_rod_pendant_cluster"], lighting:["LED_newel_inset_4_posts","pendant_chandelier"], style:"grand_modern_georgian_double_height_light_oak_LED_mustard",
    notable:"DOUBLE-HEIGHT GRAND ENTRY with symmetrical upper split landings · Georgian-inspired proportions · LED-inset 4 newels" },
  { i: 6, type:"upper_landing_balustrade", direction:"landing-runs-left-right", stringer:"closed_light_oak_newels", balustrade:"sculpted_geometric_angular_fretwork_light_oak_backlit", materials:["all_natural_light_oak","dark_olive_moss_green_wall_series","warm_wood_look_floor"], lighting:["LED_backlight_behind_fretwork"], style:"modern_british_luxury_geometric_sculptural_fretwork",
    notable:"RANDOM ANGULAR GEOMETRIC FRETWORK BALUSTRADE (variant of img-02 branch)" },
  { i: 7, type:"U_shape_half_turn_with_landing_return", direction:"back-with-U-return", stringer:"closed_light_oak_newels", balustrade:"diamond_cross_lattice_fretwork_light_oak_backlit", materials:["all_natural_light_oak","dark_olive_moss_green_wall_series","warm_wood_look_floor","glass_rod_pendant_cluster"], lighting:["LED_backlight_behind_fretwork"], style:"modern_british_luxury_diamond_lattice_fretwork",
    notable:"DIAMOND CROSS-LATTICE FRETWORK BALUSTRADE (variant #3 in fretwork series)" },
  { i: 8, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"curved_vine_scroll_fretwork_light_oak_backlit", materials:["all_natural_light_oak","dark_olive_moss_green_wall_series","warm_wood_look_floor","black_wall_sconce"], lighting:["LED_backlight_behind_fretwork"], style:"modern_british_luxury_curved_vine_fretwork",
    notable:"CURVED VINE FRETWORK BALUSTRADE (variant #4 in fretwork series: branch/geometric/diamond/vine)" },
  { i: 9, type:"L_shape_with_landing_return", direction:"back-right-with-left-return", stringer:"closed", balustrade:"chunky_light_oak_newel_with_black_metal_accent_plates_LED_inset_black_thin_balusters", materials:["light_oak","black_metal","mustard_yellow_ochre_walls","cream_beige_tile_floor","glass_rod_pendant_chandelier"], lighting:["LED_newel_inset","pendant_chandelier"], style:"grand_modern_hallway_light_oak_LED_mustard",
    notable:"companion to img-05 · LED-inset newels + mustard walls + pendant + dark carpet runner" },
  { i:10, type:"straight_with_landing_return", direction:"back-right-with-left-return", stringer:"closed", balustrade:"thin_black_metal_vertical_spindles_with_black_square_plate_accents_LED_handrail", materials:["light_oak","black_metal","cream_walls","warm_wood_look_floor","glass_rod_pendant_cluster","mustard_black_geometric_art"], lighting:["LED_handrail","LED_newel_inset"], style:"modern_british_luxury_light_oak_black_LED",
    notable:"LED handrail + LED newel inset + black plate spindle accents" },
  { i:11, type:"straight_flight_with_symmetrical_upper_split_landings_galleria", direction:"back-centre-with-split-landings", stringer:"closed", balustrade:"chunky_dark_walnut_newel_with_black_metal_plates_LED_inset_black_thin_balusters", materials:["rich_dark_walnut","black_metal","cream_walls","dark_walnut_floor","classical_pendant_chandelier"], lighting:["LED_newel_inset_4_posts","pendant"], style:"grand_modern_georgian_double_height_dark_walnut_LED",
    notable:"DARK WALNUT variant of img-05 · Georgian double-height entry with symmetrical upper split landings" },
  { i:12, type:"straight_flight_with_symmetrical_upper_split_landings_galleria", direction:"back-centre", stringer:"closed", balustrade:"chunky_dark_walnut_newel_LED_inset_black_thin_balusters", materials:["rich_dark_walnut","black_metal","cream_walls","dark_walnut_floor"], lighting:["LED_newel_inset","pendant_chandelier"], style:"grand_modern_georgian_double_height_dark_walnut_LED",
    notable:"near-companion to img-11 · same dark walnut LED newel design" },
  { i:13, type:"straight_flight_with_winder_at_top", direction:"back-right-with-left-winder-at-top", stringer:"closed_boxed_in_both_sides", balustrade:"none_visible_boxed_in_wall_mounted_handrail", materials:["natural_pine_light_oak","pine_floor","warm_cream_walls","dark_tile_floor","natural_jute_rug","wicker_basket"], lighting:["ambient"], style:"cottage_farmhouse_space_saver_boxed_in",
    notable:"SPACE-SAVER COTTAGE STYLE — closed cladding both sides · purely functional · winder at top" },
  { i:14, type:"straight_flight", direction:"back", stringer:"closed", balustrade:"matt_black_slim_vertical_metal_rods", materials:["natural_light_oak","matt_black_metal","terracotta_pink_patterned_tile_floor"], lighting:["ambient"], style:"modern_cottage_scandinavian_terracotta_tile",
    notable:"distinctive TERRACOTTA / PINK PATTERNED TILE FLOOR as base context" },
  { i:15, type:"straight_with_winder_bottom", direction:"back-with-left-winder-at-bottom", stringer:"closed_with_understair_vertical_slat_panel", balustrade:"slim_square_light_oak_spindles", materials:["natural_light_oak","matching_herringbone_parquet_floor","warm_cream_walls"], lighting:["ambient","gallery_wall_3_framed_monochrome_prints"], style:"modern_british_new_build_winder_gallery",
    notable:"winder at bottom + gallery wall + understair vertical slat panel" },
  { i:16, type:"straight_flight_cantilever_open_riser_zigzag_stringer", direction:"back-left", stringer:"cantilever_with_zigzag_sawtooth_visible_stringer_left", balustrade:"frameless_glass_light_oak_handrail_cap", materials:["thick_light_oak_slabs","zigzag_light_oak_stringer","frameless_glass","light_oak_handrail","dark_timber_slat_wall_cladding","warm_concrete_microcement_floor"], lighting:["LED_handrail_continuous"], style:"ultra_modern_architect_zigzag_stringer_sculptural",
    notable:"VERY DISTINCTIVE ZIGZAG / SAWTOOTH STRINGER PROFILE visible on left · sculptural stringer + frameless glass + LED handrail" },
  { i:17, type:"straight_flight_curved_edge_treads_top_down_view", direction:"top-down-view-descending", stringer:"closed_left", balustrade:"slim_matt_black_metal_spindles_bulb_detail", materials:["light_oak_curved_edge_treads","matt_black_metal","warm_light_oak_floor","light_beige_walls"], lighting:["ambient"], style:"modern_british_curved_treads_black_iron",
    notable:"TOP-DOWN VIEW showing curved outer tread edges (winder-like) · unusual composition angle" },
  { i:18, type:"straight_flight_curved_bullnose_landing_return", direction:"back-with-landing-return-above", stringer:"closed", balustrade:"slim_white_painted_turned_spindles_chunky_dark_walnut_newel", materials:["dark_walnut_treads_handrail_newel","white_risers_spindles","rich_dark_hardwood_floor","pendant_lights"], lighting:["pendant_lights","antique_console_lamp"], style:"federal_colonial_traditional_curved_bullnose",
    notable:"curved bullnose starting step (semi-circle around newel) · Federal/Colonial styling" },
  { i:19, type:"L_shape_half_turn_with_landing_return", direction:"back-right-with-left-return", stringer:"closed_rustic_pine", balustrade:"slim_rustic_pine_spindles_matching_upper_landing", materials:["rustic_knotty_pine_distressed","light_grey_wool_carpet_runner","dark_grey_wall","white_wainscot_lower","light_hardwood_floor"], lighting:["ambient"], style:"farmhouse_rustic_amish_knotty_pine_grey_palette",
    notable:"RUSTIC KNOTTY PINE with heavy character · farmhouse/Amish aesthetic · rounded curved bullnose" },
  { i:20, type:"straight_flight_view_from_below", direction:"back-viewed-from-directly-below", stringer:"closed", balustrade:"matt_black_slim_metal_spindles_bulb_chunky_light_pine_newels", materials:["natural_light_pine","matt_black_slim_spindles","warm_light_oak_floor"], lighting:["ambient"], style:"modern_rustic_pine_slim_black_iron",
    notable:"VIEW FROM DIRECTLY BELOW showing full flight symmetrically" },
  { i:21, type:"straight_flight_curved_multi_step_bullnose", direction:"back-right", stringer:"closed", balustrade:"matt_black_slim_metal_spindles_light_oak_bevelled_newel", materials:["natural_light_oak","matt_black_metal","warm_oak_look_floor"], lighting:["ambient"], style:"modern_british_light_oak_black_iron_curved_start",
    notable:"curved multi-step base creating gentle sweep + rounded bullnose" },
  { i:22, type:"straight_with_landing_return", direction:"back-right", stringer:"closed", balustrade:"slim_matt_black_vertical_metal_spindles_with_black_plate_accents", materials:["light_oak","matt_black","white_walls","full_height_vertical_timber_slat_wall_cladding_right","warm_oak_floor"], lighting:["under_nosing_LED","LED_bottom_step_glow"], style:"modern_british_luxury_vertical_slat_wall_LED",
    notable:"vertical timber slat wall feature (full-height) + LED under-nosing + LED bottom step" },
  { i:23, type:"L_shape_quarter_turn_landing_return", direction:"back-right-with-left-return", stringer:"closed_white_painted_apron", balustrade:"chunky_white_painted_newel_flat_caps_thin_matt_black_metal_bulb_spindles", materials:["dark_walnut_handrail","white_painted_stringer_newel","thin_matt_black_metal_spindles_bulb","dark_walnut_treads","dark_walnut_floor","gallery_wall_monochrome_photos"], lighting:["ambient"], style:"traditional_american_craftsman_white_black_iron_walnut",
    notable:"WHITE + BLACK + DARK WALNUT tri-colour · American Craftsman traditional" },
  { i:24, type:"U_shape_half_turn_with_return_above", direction:"back-with-U-return", stringer:"closed_all_painted_yellow", balustrade:"slim_classical_turned_spindles_all_pale_buttercup_yellow_painted", materials:["pale_buttercup_yellow_painted_joinery_throughout","rustic_orange_gold_boucle_berber_carpet_runner","light_wood_look_floor","natural_circular_rug"], lighting:["ambient","framed_colourful_art"], style:"bohemian_colour_yellow_painted_stairs_orange_runner",
    notable:"UNIQUE PALE YELLOW PAINTED STAIRCASE + ORANGE BOUCLÉ CARPET RUNNER · bohemian colour statement" },
  { i:25, type:"straight_flight_curved_sweeping_bullnose", direction:"back-with-curved-return", stringer:"closed_white_stringer", balustrade:"slim_white_painted_spindles_light_oak_handrail_upper_landing", materials:["light_oak_handrail_landing_balustrade","white_painted_stringer_spindles","grey_cream_striped_wool_carpet_runner_black_edging","warm_wood_look_floor"], lighting:["ambient"], style:"modern_british_striped_runner_white_joinery",
    notable:"STRIPED CARPET RUNNER (grey + cream stripes with black edging) — distinctive detail" },
  { i:26, type:"winder_quarter_turn_short_with_integrated_radiator_cover", direction:"back-right-with-turn-at-bottom", stringer:"closed", balustrade:"matt_black_slim_metal_spindles_bulb_light_oak_newel", materials:["light_oak","matt_black","white_radiator_cover_diamond_cross_hatch_lattice_under_stair","pendant_lantern","framed_botanicals"], lighting:["pendant_lantern"], style:"traditional_english_cottage_integrated_radiator_cover",
    notable:"INTEGRATED WHITE RADIATOR COVER with DIAMOND LATTICE under stair void · practical + decorative" },
  { i:27, type:"straight_with_landing_return", direction:"back-right-with-left-return", stringer:"closed_panelled_wainscot", balustrade:"chunky_pale_painted_newel_slim_matt_black_scroll_detail_balusters", materials:["dark_walnut_handrail","pale_painted_chunky_newels","slim_matt_black_scroll_detail_balusters","beige_oatmeal_wool_carpet_runner","warm_herringbone_parquet","cream_walls_wainscot"], lighting:["wall_step_lights_aligned_per_tread_right_wall"], style:"grand_modern_traditional_pale_black_walnut",
    notable:"WALL STEP LIGHTS aligned per tread on right wall + scroll-detail black balusters + arched entry door with glass" },
  { i:28, type:"central_straight_flight_symmetric_framing", direction:"back-centre", stringer:"closed", balustrade:"slim_matt_black_metal_vertical_spindles_light_oak_handrail", materials:["warm_oak_treads","white_risers_with_LED_strip_inset_each_riser","matt_black_spindles","light_oak_handrail","cream_walls_panelled_wainscot","large_cream_porcelain_tile_floor"], lighting:["LED_riser_inset_every_riser","wall_sconces"], style:"modern_grand_LED_riser_inset_classical_symmetry",
    notable:"LED RISER STRIP INSET (every riser) dramatic backlit effect + symmetric composition · sconces × 2 · classical proportions" },
  { i:29, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"slim_matt_black_vertical_metal_rods_light_oak_handrail_chunky_newel", materials:["light_oak","matt_black","vertical_timber_slat_wall_paneling_right_full_height_feature","warm_oak_floor","glass_pendant_cluster"], lighting:["under_nosing_LED_every_tread"], style:"modern_british_luxury_light_oak_black_slat_wall_LED",
    notable:"vertical timber slat wall feature + LED under-nosing (companion to img-22)" },
  { i:30, type:"straight_with_landing_return", direction:"back-right-with-left-return", stringer:"closed", balustrade:"cane_rattan_webbing_infill_panels_light_oak_framework", materials:["all_natural_light_oak_framework","dark_cane_rattan_webbing_hexagonal","grey_walls","warm_oak_look_floor","potted_olive"], lighting:["black_wall_sconces"], style:"modern_british_sophisticated_cane_webbing_balustrade",
    notable:"CANE / RATTAN WEBBING BALUSTRADE — rare traditional natural material · framed monochrome landscape" },
  { i:31, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"black_matt_metal_slim_vertical_rods_with_small_black_plate_accents", materials:["light_oak","matt_black_metal","pale_grey_wool_carpet_runner_on_treads","warm_oak_floor","gallery_wall_5_monochrome_photographs"], lighting:["ambient_sunlight_from_top"], style:"modern_industrial_loft_gallery_wall",
    notable:"loft-conversion with gallery wall of monochrome landscape photography · black wall bookshelf under stair" },
  { i:32, type:"grand_split_staircase_double_sided_central_bottom_landing", direction:"ascends-from-centre-outward-symmetric", stringer:"closed_with_curved_bullnose_at_centre", balustrade:"slim_matt_black_classical_metal_balusters_bulb_dark_walnut_handrail_classical_turned_newels_gold_ball_finials", materials:["light_oak_treads","oatmeal_carpet_runner_with_black_edge_band","dark_walnut_handrail_newel","gold_ball_finials_newels","matt_black_balusters","full_white_panelled_wainscot","cream_marble_floor","persian_rug"], lighting:["under_nosing_LED_subtle"], style:"grand_georgian_split_staircase_ball_finial_newels",
    notable:"GRAND SPLIT STAIRCASE — 2 flights leaving from central landing · Georgian classical · gold ball finials on newels" },
  { i:33, type:"straight_flight", direction:"back-right", stringer:"closed_black_painted_apron_stringer_contrast", balustrade:"matt_black_slim_vertical_metal_rods_light_oak_handrail_newel_flat_cap", materials:["light_oak","black_painted_apron","matt_black_rods","warm_oak_floor","under_stair_seating_nook_charcoal_linen_upholstered_chair_olive_throw_built_in_bench_vertical_charcoal_slat_wall_framed_art_pendant_candles"], lighting:["pendant","candles"], style:"modern_british_sophisticated_under_stair_seating_nook",
    notable:"UNDER-STAIR NOOK / LOUNGE with built-in bench + vertical slat wall + framed art + pendant + candles · sophisticated modern lifestyle detail" },
  { i:34, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"brushed_stainless_steel_chrome_threaded_rod_spindles_square_metal_end_caps", materials:["rich_dark_walnut","brushed_stainless_threaded_spindles","cream_porcelain_tile_floor"], lighting:["LED_handrail","black_wall_sconces_up_down_beam"], style:"modern_industrial_luxury_walnut_threaded_stainless_steel",
    notable:"THREADED / RIDGED STAINLESS STEEL SPINDLE STYLE — visible thread pattern + square metal end caps + LED handrail" },
  { i:35, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"brushed_stainless_threaded_rod_spindles_square_end_caps", materials:["rich_dark_walnut","brushed_stainless_threaded_spindles","warm_herringbone_parquet_floor","dark_charcoal_panelled_wall_feature_backdrop"], lighting:["black_up_down_wall_sconces"], style:"modern_industrial_luxury_walnut_threaded_stainless_charcoal",
    notable:"same threaded-rod spindle style as img-34 with dark charcoal panelled wall backdrop" },
  { i:36, type:"straight_with_landing_return", direction:"back-right-with-left-return", stringer:"closed", balustrade:"very_slim_piano_wire_horizontal_stainless_steel_rods_light_oak_handrail_chunky_newel", materials:["natural_light_oak","slim_horizontal_stainless_steel_rods","grey_walls","cream_tile_floor","potted_olive"], lighting:["ambient"], style:"modern_british_minimal_slim_horizontal_cable_rods",
    notable:"VERY SLIM (piano-wire-like) horizontal stainless steel rod balustrade — thinner than typical horizontal rods" },
  { i:37, type:"straight_flight_cantilever_open_riser_with_black_mono_string", direction:"back-right", stringer:"cantilever_with_black_mono_string_visible_right", balustrade:"frameless_glass_light_oak_handrail_cap", materials:["light_oak_treads","frameless_glass","light_oak_handrail","black_stringer_mono_string_right","warm_oak_floor"], lighting:["ambient"], style:"modern_architect_luxury_cantilever_black_mono_string_glass",
    notable:"CANTILEVER OPEN-RISER + BLACK MONO-STRING VISIBLE on right + FRAMELESS GLASS" },
  { i:38, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"black_metal_fine_diamond_mesh_infill_panels", materials:["dark_walnut","black_metal_fine_diamond_mesh","warm_oak_look_floor","grey_walls"], lighting:["under_nosing_LED"], style:"modern_industrial_dark_walnut_fine_black_diamond_mesh",
    notable:"BLACK METAL FINE DIAMOND MESH BALUSTRADE (finer weave than batch-5 img-30) + under-nosing LED" },
  { i:39, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"brushed_stainless_steel_chunky_vertical_spindles_square_end_caps", materials:["natural_light_oak","brushed_stainless_chunky_spindles","cream_tile_floor","grey_wall_accent","black_console_geometric_art"], lighting:["LED_handrail","pendant_lantern"], style:"modern_minimalist_light_oak_chunky_stainless_spindles_LED",
    notable:"BRUSHED STAINLESS STEEL CHUNKY VERTICAL SPINDLES with square end caps (larger than typical rod) + LED handrail" },
  { i:40, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"brushed_stainless_chunky_spindles_LED_handrail", materials:["natural_light_oak","brushed_stainless_chunky_spindles"], lighting:["LED_handrail"], style:"modern_minimalist_stainless_LED_hallway",
    notable:"wider view companion to img-39 showing hallway continuation" },
  { i:41, type:"straight_flight_rounded_bullnose", direction:"back-right", stringer:"closed", balustrade:"matt_black_slim_vertical_metal_rods_light_oak_chunky_newel_black_metal_flat_cap", materials:["light_oak","matt_black","warm_light_oak_floor","view_to_garden"], lighting:["ambient"], style:"modern_british_minimalist_light_oak_black_metal",
    notable:"rounded bullnose · black metal newel cap · view to sitting room garden" },
  { i:42, type:"straight_flight_rounded_bullnose", direction:"back-right", stringer:"closed", balustrade:"matt_black_slim_vertical_metal_rods_light_oak_chunky_newel_black_metal_flat_cap", materials:["light_oak","matt_black","warm_light_oak_floor"], lighting:["ambient"], style:"modern_british_minimalist_light_oak_black_metal",
    notable:"companion to img-41 · light oak + matt black rods + rounded bullnose" },
  { i:43, type:"straight_flight_rounded_bullnose", direction:"back-right", stringer:"closed", balustrade:"matt_black_slim_vertical_metal_rods_light_oak_chunky_newel_black_metal_flat_cap", materials:["light_oak","matt_black","warm_light_oak_floor"], lighting:["ambient"], style:"modern_british_minimalist_light_oak_black_metal",
    notable:"third variant in the series (img-41/42/43) · same aesthetic" },
  { i:44, type:"straight_flight", direction:"back-right", stringer:"closed_black_painted_stringer_apron_side_contrast", balustrade:"matt_black_slim_vertical_metal_rods_light_oak_handrail_newel_black_metal_flat_cap", materials:["light_oak","matt_black_stringer_apron_side_contrast","warm_oak_look_floor","black_entry_door"], lighting:["ambient"], style:"modern_british_minimalist_black_stringer_contrast",
    notable:"BLACK STRINGER contrast against light oak (sharp side contrast)" },
  { i:45, type:"straight_flight_centre_view", direction:"back-centre", stringer:"closed", balustrade:"matt_black_slim_metal_spindles_thin_dark_walnut_chunky_newel_flat_cap", materials:["dark_walnut_throughout","charcoal_black_painted_plinth_base_bottom_contrast"], lighting:["ambient"], style:"modern_american_craftsman_all_walnut_black_plinth_base",
    notable:"BLACK PLINTH BASE at bottom of stair (dark base contrast against dark walnut)" },
  { i:46, type:"straight_flight_curved_sweeping_bullnose", direction:"back-centre", stringer:"closed_light_oak_wraparound_curved_bullnose", balustrade:"classical_light_oak_turned_spindles_bulb_urn_large_turned_newel_posts_large_ball_finials_x2", materials:["all_natural_light_oak_throughout","matching_wide_plank_oak_floor","large_cream_tile_floor","arched_entry"], lighting:["ambient"], style:"traditional_english_country_all_oak_classical_ball_finials",
    notable:"CLASSICAL TURNED OAK NEWEL POSTS with LARGE BALL FINIALS + CURVED SWEEPING BULLNOSE · symmetric English country" },
  { i:47, type:"straight_flight_centre_view", direction:"back-centre", stringer:"closed_panelled_wainscot", balustrade:"dark_matt_black_chunky_newel_posts_flat_caps_slim_matt_black_metal_spindles_dark_walnut_handrail", materials:["dark_walnut","black_chunky_newels","slim_black_metal_spindles","brown_oatmeal_patterned_wool_runner_brass_stair_rods","warm_cream_walls"], lighting:["ambient"], style:"traditional_english_walnut_black_brass_rods",
    notable:"black chunky newels + brass rods + patterned wool runner · centre view" },
  { i:48, type:"straight_flight_wraparound_rounded_bullnose_centre_view", direction:"back-centre", stringer:"closed", balustrade:"slim_black_painted_spindles_light_oak_handrail_chunky_newel_black_painted_flat_cap", materials:["natural_light_oak","black_painted_spindles_newel_cap","pale_grey_wool_carpet_runner","dark_stained_plinth_base"], lighting:["ambient_retail_showroom"], style:"modern_british_showroom_display_carpet_store",
    notable:"RETAIL CARPET STORE SHOWROOM setting — visible carpet warehouse sign + Lifestyle Floors display racks · staircase as retail display fixture" },
  { i:49, type:"detail_close_up_carved_classical_column_balustrade", direction:"detail_shot", stringer:"detail_view", balustrade:"carved_columnar_spindles_fluted_shafts_corinthian_acanthus_capitals_scroll_pediment_above", materials:["rich_dark_stained_oak_heavily_carved","patterned_lattice_wall_blue_diamond_backdrop"], lighting:["ambient"], style:"renaissance_revival_carved_classical_column_masterwork",
    notable:"EXTREMELY ORNATE HAND-CARVED CLASSICAL COLUMN BALUSTRADE with fluted columns + acanthus capitals + scroll pediment · Renaissance Revival masterwork" },
  { i:50, type:"curved_sweeping_staircase_carved_scroll_foliate_balustrade", direction:"curves-back-right-with-sweeping-base", stringer:"closed_sweeping_curved_bullnose_carved_decoration", balustrade:"heavily_carved_dark_walnut_scroll_foliate_panels_carved_acanthus_scroll_cartouche_newel_base", materials:["rich_dark_walnut","heavily_carved_scroll_foliate_panels","cream_marble_tile_floor","wainscot_panelled_walls","framed_landscape","potted_palm","lamp"], lighting:["ambient"], style:"grand_victorian_edwardian_revival_carved_scroll_foliate_masterwork",
    notable:"HEAVILY CARVED SCROLL/FOLIATE BALUSTRADE — extremely ornate carved panels resembling curling foliage · Victorian/Edwardian revival masterwork" },
  { i:51, type:"straight_flight_rounded_bullnose", direction:"back-right", stringer:"closed", balustrade:"classical_light_oak_turned_spindles_bulb_urn_classical_turned_newel_large_ball_finial", materials:["all_natural_light_oak_throughout","warm_light_oak_floor","view_to_sitting_room"], lighting:["ambient"], style:"traditional_english_all_oak_classical_ball_finial",
    notable:"classical English traditional all-oak · rounded bullnose · companion to img-46" },
];

const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
const urlByIdx = new Map();
for (const it of mapping.items) urlByIdx.set(it.idx, it.url);

const mani = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

if (!DRY) {
  const backupDir = join(process.cwd(), "data", ".manifest-backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `manifest-pre-batch6-ingest-${ts}.json`);
  copyFileSync(MANIFEST_PATH, backupPath);
  console.log(`Backup: ${backupPath}`);
}

const NOW = new Date().toISOString();
const RUN_STAMP = "batch6-2026-08-14";
let added = 0, skipped = 0;

console.log("");
console.log(`Batch 6 · processing ${BATCH.length} images ${DRY ? "· DRY RUN" : "· LIVE APPLY"}`);
console.log("─".repeat(60));

for (const spec of BATCH) {
  const url = urlByIdx.get(spec.i);
  if (!url) { console.log(`  [${spec.i}] SKIP no url in mapping`); continue; }
  if (mani.images[url]) { console.log(`  [${spec.i}] SKIP already in manifest`); skipped++; continue; }

  const tags = [
    "staircase", "reference", "hero-scene",
    "batch-6-2026-08-14", "philip-supplied", "staircase_brain", "domain:STAIRCASE",
    `type:${spec.type}`, `direction:${spec.direction}`, `stringer:${spec.stringer}`, `balustrade:${spec.balustrade}`,
    ...spec.materials.map((m) => `material:${m}`),
    ...spec.lighting.map((l) => `lighting:${l}`),
    `style:${spec.style}`,
  ];

  const description = [
    `STAIRCASE REFERENCE · Batch 6 · img-${String(spec.i).padStart(2, "0")}`,
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
    `COMPANION DOCUMENT · data/nex-reference-brains/staircase-preparation/layer-2-drafts/staircase-reference-gallery-batch-6-2026-08-14.md`,
  ].join("\n");

  mani.images[url] = {
    source: "philip_supplied",
    original_prompt: null,
    description,
    master_ai_prompt: null,
    created_at: NOW,
    created_by: "batch-6-ingest",
    notes: `Batch 6 · img-${String(spec.i).padStart(2, "0")} · ${spec.notable}`,
    tags,
    a_plus: true,
    subject_domain: "staircase",
    primary_domain: "STAIRCASE",
    primary_brain: "staircase_brain",
    image_type: "reference",
    image_purpose: { primary: "brain_evidence", secondary: "matcher_source", tertiary: "advisor_reference" },
    collection_id: "staircase_reference_batch_6",
    collection_memberships: ["staircase_references", "batch_6_2026_08_14"],
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
    marked_by: "batch-6-ingest",
    not_a_staircase: false,
    _ingest_batch: RUN_STAMP,
    _enrichment: {
      domain_classified_at: NOW,
      domain_classified_reason: "batch6_direct_observation",
      record_state_expected: "routable",
    },
  };

  added++;
  console.log(`  [${String(spec.i).padStart(2, "0")}] ADD · ${spec.type.slice(0, 40)} · ${spec.balustrade.slice(0, 40)}`);
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
