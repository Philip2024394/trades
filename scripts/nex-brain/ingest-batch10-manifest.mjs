// Batch 10 · 59 images · step mats + carpet + refacing before/after + trade content library.
// Per Philip: images 1-4 = step mats (new · pre-existing 2 also); images 5-59 = broader "trade card content library" (10 subcategories per multimodal read).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const DRY = !process.argv.includes("--apply");
const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const MAPPING_PATH  = join(process.cwd(), "data", "incoming-image-ingest", "batch10-2026-08-14", "_mapping.json");

const BATCH = [
  // STEP MATS (img-01 to img-04)
  { i: 1, section:"step_mat", variant:"charcoal_dark_per_tread_curved_bullnose_LED_hall", detail:"full scene · curved bullnose starting step + oak treads + charcoal dark rectangular step mats per tread + LED wall step lights + entrance hall with black door + oval mirror + console + jute rug", tags:["mat:charcoal_rectangular","staircase:curved_bullnose_start","balustrade:matt_black_metal_spindles","lighting:LED_wall_step_lights","setting:entrance_hall"], purpose:"advisor_reference" },
  { i: 2, section:"step_mat", variant:"charcoal_narrower_smaller_mats", detail:"same entrance hall setting · smaller narrower charcoal step mats leaving more oak visible around each mat · straight flight variant", tags:["mat:charcoal_narrow","staircase:straight_flight","balustrade:matt_black_metal_spindles","lighting:LED_wall_step_lights"], purpose:"advisor_reference" },
  { i: 3, section:"step_mat", variant:"charcoal_rectangular_including_bullnose_starting_step", detail:"same setting · charcoal rectangular step mats fitted per tread INCLUDING on the bullnose starting step · demonstrates per-tread mats shaped for curved starting step", tags:["mat:charcoal_rectangular_including_bullnose","staircase:curved_bullnose_start","balustrade:matt_black_metal_spindles","lighting:LED_wall_step_lights","note:mat_on_bullnose_start"], purpose:"advisor_reference" },
  { i: 4, section:"step_mat", variant:"brown_beige_leaf_motif_coordinated_floor_rug", detail:"same setting · brown/beige step mats with cream leaf motif per tread + coordinated brown/beige leaf-motif floor rug at base · decorative rather than utilitarian scheme", tags:["mat:brown_beige_leaf_motif","mat:coordinated_floor_rug","balustrade:matt_black_metal_spindles"], purpose:"advisor_reference" },

  // REFACING TRADE CONTENT LIBRARY (img-05 to img-59)

  // 1.1 · TRUE BEFORE/AFTER cards
  { i: 5, section:"refacing_before_after_card", variant:"pine_framing_basement_to_finished_oak_matt_black_LED", detail:"split-panel · BEFORE raw pine framing basement construction + AFTER finished oak treads + matt black metal spindles + light oak newel + LED step lights + framed art + living room styling · black-pill BEFORE/AFTER labels", tags:["card:before_after_split_panel","before:raw_pine_framing_basement","after:oak_matt_black_LED_finished_living_room","label:before_after_pill_black"], purpose:"trade_card_hero" },
  { i: 6, section:"refacing_before_after_card", variant:"basement_raw_to_oak_matt_black_understair_winebar", detail:"split-panel · BEFORE basement raw pine framing + concrete floor · AFTER oak treads + matt black metal spindles + oak newel + under-stair wine bar with dark walnut cabinet + LED downlights · black-pill BEFORE/AFTER labels", tags:["card:before_after_split_panel","before:raw_basement_framing","after:oak_matt_black_understair_winebar","label:before_after_pill_black"], purpose:"trade_card_hero" },

  // 1.2 · TRADE CRAFTSMANSHIP / IN-PROGRESS
  { i: 7, section:"trade_craftsmanship", variant:"altendorf_panel_saw_oak_joinery_co_manufacturer", detail:"joiner in headphones operating ALTENDORF panel saw with light oak stock · OAK JOINERY CO. branding on box · fully built oak staircases visible in manufacturer workshop background", tags:["activity:machining_altendorf_panel_saw","brand:oak_joinery_co","setting:manufacturer_workshop","tool:altendorf_saw"], purpose:"trade_card_process" },
  { i: 8, section:"trade_craftsmanship", variant:"spray_refinishing_dark_stain_traditional_staircase", detail:"trade spray-painter in respirator applying dark stain to installed traditional turned newel + spindle staircase · plastic sheeting protecting walls · in-house refinishing service", tags:["activity:spray_refinishing_dark_stain","tool:HVLP_spray_gun","staircase:traditional_turned_newel_spindle","service:in_house_refinishing"], purpose:"trade_card_process" },
  { i: 9, section:"trade_craftsmanship", variant:"timber_yard_live_edge_oak_selection", detail:"craftsman selecting oak boards from stacked live-edge oak stock in timber yard · sourcing / material selection scene", tags:["activity:material_selection","location:timber_yard","material:live_edge_oak"], purpose:"trade_card_process" },
  { i:23, section:"trade_craftsmanship", variant:"outdoor_deck_staircase_install_garden_setting", detail:"trade in high-vis vest kneeling installing outdoor deck staircase · timber balustrade + garden retaining wall + planting + garden lighting · outdoor build in progress", tags:["activity:outdoor_deck_staircase_install","location:garden","staircase:outdoor_timber_deck"], purpose:"trade_card_process" },
  { i:24, section:"trade_craftsmanship", variant:"pest_survey_underfloor_joist_inspection", detail:"property surveyor with flashlight + screwdriver probing under-floor timber joists · spider webs + exposed cellular blockwork · sub-floor condition inspection", tags:["activity:underfloor_timber_inspection","service:condition_survey","location:sub_floor"], purpose:"trade_card_process" },
  { i:25, section:"trade_craftsmanship", variant:"pest_inspector_bullnose_starting_step_traditional_staircase", detail:"pest inspector kneeling inspecting curved bullnose starting step under traditional turned-newel + spindle mahogany staircase · torch + probe · post-installation service", tags:["activity:pest_survey_staircase","service:condition_survey","staircase:traditional_turned_mahogany"], purpose:"trade_card_process" },
  { i:27, section:"trade_craftsmanship", variant:"stairplan_floating_cantilever_oak_install_two_joiners", detail:"two joiners in STAIRPLAN branded workwear installing oak floating cantilever treads on black steel side-stringer · in-situ build · tools + drill visible", tags:["activity:cantilever_oak_install","brand:stairplan","staircase:floating_cantilever_oak_black_steel"], purpose:"trade_card_process" },
  { i:28, section:"trade_craftsmanship", variant:"floating_cantilever_oak_install_two_joiners_variant", detail:"two joiners fitting oak floating cantilever treads on black steel stringer · in-situ house build · tape measure + tools", tags:["activity:cantilever_oak_install","staircase:floating_cantilever_oak_black_steel"], purpose:"trade_card_process" },
  { i:33, section:"trade_craftsmanship", variant:"floating_cantilever_oak_install_central_spine_stringer", detail:"joiner in cap + tool belt fitting light oak floating cantilever treads to BLACK CENTRAL SPINE stringer with steel base plate · light hardwood floor · drill in hand", tags:["activity:cantilever_install_central_spine","staircase:floating_cantilever_central_spine_oak"], purpose:"trade_card_process" },
  { i:37, section:"trade_craftsmanship", variant:"site_survey_boots_L_square_stairwell_corner_measurement", detail:"trade's boots viewed from above standing in stripped corner of room · L-shaped steel ruler in corner measuring floor opening · site survey / measurement scene", tags:["activity:site_survey_floor_opening_measurement","tool:L_square_ruler","perspective:overhead_boots"], purpose:"trade_card_process" },
  { i:38, section:"trade_craftsmanship", variant:"manufacturer_workshop_overview_multiple_staircases_production", detail:"large manufacturer workshop overview · multiple full staircases in various construction stages · joiners at benches + machines · blue dust extraction coiled hoses · organised production floor", tags:["setting:manufacturer_workshop","activity:multi_staircase_production","scale:full_workshop_overview"], purpose:"trade_card_capability" },
  { i:50, section:"trade_craftsmanship", variant:"bandsaw_milling_large_pine_block_growth_rings", detail:"bandsaw milling large pine timber block · visible growth rings + yellow bandsaw wheels · timber processing scene", tags:["activity:bandsaw_milling","tool:bandsaw","material:pine_block"], purpose:"trade_card_process" },
  { i:54, section:"trade_craftsmanship", variant:"timber_inspector_kiln_stack_hi_vis_hard_hat_extendable_probe", detail:"timber inspector in high-vis vest + hard hat using extendable probe on stacked pine boards in kiln / outdoor timber yard", tags:["activity:timber_yard_inspection","service:quality_control","location:kiln_yard","tool:extendable_probe"], purpose:"trade_card_process" },
  { i:56, section:"trade_craftsmanship", variant:"three_joiners_onsite_oak_staircase_build_bright_daylight", detail:"three joiners on-site building oak U-turn staircase · drills + tools · staircase mid-construction visible with treads/risers being fitted · bright daylight through tall windows", tags:["activity:onsite_staircase_build","staircase:u_turn_oak","team:three_joiners"], purpose:"trade_card_process" },
  { i:57, section:"trade_craftsmanship", variant:"two_joiners_fitting_treads_stripped_stairwell", detail:"two joiners fitting oak treads to stripped ash/beech-framed staircase in stairwell · in-progress install · fitted tool belts", tags:["activity:tread_install","staircase:stripped_stairwell_oak_treads","team:two_joiners"], purpose:"trade_card_process" },
  { i:59, section:"trade_craftsmanship", variant:"onsite_refacing_brushing_finish_light_oak_glass_slat_cladding", detail:"trade on-site refacing installation · one joiner kneeling brushing/applying finish to light oak treads · glass balustrade + light oak newel + slat cladding accent wall + potted plants + herringbone parquet + navy tote bag on floor", tags:["activity:onsite_refacing_finish_application","staircase:light_oak_glass_balustrade","accent:slat_cladding_wall"], purpose:"trade_card_process" },

  // 1.3 · PRODUCT RENDERS
  { i:20, section:"product_render", variant:"5_tread_light_oak_stainless_curved_feature_panels", detail:"isolated 5-tread staircase product render · light oak treads + BRUSHED STAINLESS STEEL curved feature panels between each tread (mid-riser stainless inserts) · transparent background", tags:["render:5_tread_staircase","material:light_oak_treads_stainless_feature_panels","transparent_bg:true"], purpose:"trade_card_product_hero" },
  { i:21, section:"product_render", variant:"5_tread_dark_walnut_stainless_curved_feature_panels", detail:"same product render as img-20 but DARK WALNUT variant · brushed stainless steel curved feature panels between treads · transparent background", tags:["render:5_tread_staircase","material:dark_walnut_treads_stainless_feature_panels","transparent_bg:true"], purpose:"trade_card_product_hero" },
  { i:29, section:"product_render", variant:"floating_cantilever_cutaway_embedded_steel_channel_masonry", detail:"floating cantilever staircase architectural cutaway · educational · shows embedded steel-channel wall bracket inside masonry / concrete wall structure with fasteners visible", tags:["render:architectural_cutaway","staircase:floating_cantilever","educational:embedded_steel_channel_bracket"], purpose:"advisor_illustration" },
  { i:30, section:"product_render", variant:"floating_cantilever_oak_treads_black_steel_stringer_illustration", detail:"floating cantilever product illustration · oak treads on black steel spine stringer · transparent background", tags:["render:cantilever_product","material:oak_treads_black_steel_stringer","transparent_bg:true"], purpose:"trade_card_product_hero" },

  // 1.4 · DESIGN-SKETCH COMPOSITION
  { i:52, section:"design_sketch_composition", variant:"grand_curved_cantilever_watercolour_concept_photo_hybrid", detail:"design-sketch composition · watercolour/pencil-illustrated grand curved cantilever staircase concept + integrated photo-realistic finished elements · aspirational / creative reference", tags:["style:watercolour_pencil_sketch_hybrid","staircase:grand_curved_cantilever","purpose:aspirational_concept"], purpose:"advisor_conversation_opener" },
  { i:58, section:"design_sketch_composition", variant:"top_down_plan_sketch_and_finished_U_shape_oak_split", detail:"design-sketch composition · left half hand-drawn architectural top-down plan sketch with dimension arrows + right half finished top-down U-shape oak staircase photograph · design-through-to-build", tags:["style:half_plan_sketch_half_photo","staircase:u_shape_oak_top_down","purpose:design_process"], purpose:"advisor_conversation_opener" },

  // 1.5 · ISOLATED COMPONENT PRODUCT SHOTS
  { i:10, section:"component_product_shot", variant:"brushed_stainless_steel_square_tube", detail:"isolated brushed stainless steel square hollow tube (spindle / handrail stock) · product shot on white background", tags:["component:square_hollow_tube","material:brushed_stainless_steel","use:spindle_or_handrail"], purpose:"materials_tile" },
  { i:11, section:"component_product_shot", variant:"pine_stair_tread_pencil_round_nosing", detail:"isolated pine stair tread with pencil-round nosing · visible small knots in the grain · transparent background", tags:["component:stair_tread","material:pine","nosing:pencil_round"], purpose:"materials_tile" },
  { i:12, section:"component_product_shot", variant:"warm_walnut_tread_brushed_stainless_inlay_strip", detail:"isolated warm walnut/mahogany-toned stair tread with BRUSHED STAINLESS STEEL inlay strip running down the middle · feature tread with metal detail", tags:["component:stair_tread","material:walnut_mahogany","feature:stainless_steel_inlay_strip"], purpose:"materials_tile" },
  { i:13, section:"component_product_shot", variant:"warm_walnut_tread_pencil_round_nosing", detail:"isolated warm walnut/oak stair tread with pencil-round nosing · product shot", tags:["component:stair_tread","material:walnut_oak","nosing:pencil_round"], purpose:"materials_tile" },
  { i:39, section:"component_product_shot", variant:"oak_handrail_moulded_profile_end_view", detail:"isolated oak handrail moulded profile end view · shows rounded top handhold + finger grooves + underside spindle groove", tags:["component:handrail","material:oak","profile:moulded_traditional_with_spindle_groove","view:end_cross_section"], purpose:"materials_tile" },
  { i:40, section:"component_product_shot", variant:"chunky_square_light_oak_newel_post_blank_end_grain", detail:"isolated chunky square light oak newel post blank · end grain figure visible showing glue-laminated construction", tags:["component:newel_post_blank","material:glue_laminated_light_oak","view:end_grain_showing_lamination"], purpose:"materials_tile" },
  { i:42, section:"component_product_shot", variant:"stacked_pale_oak_tread_blanks_manufacturer_pallet", detail:"stack of pale oak tread blanks / panels on manufacturer pallet · in workshop setting · rough-sawn stock", tags:["component:tread_blank_stock","material:pale_oak","setting:manufacturer_pallet"], purpose:"materials_tile" },
  { i:43, section:"component_product_shot", variant:"rough_cut_zigzag_string_blanks_stringers_workshop_floor", detail:"rough-cut zigzag string blanks (stringers) laid on workshop floor · light oak · notched profile visible", tags:["component:stringer_blank","profile:zigzag_notched","material:light_oak","setting:workshop_floor"], purpose:"materials_tile" },
  { i:44, section:"component_product_shot", variant:"glue_laminated_chunky_oak_newel_post_beam_block_workbench", detail:"glue-laminated chunky oak newel post / beam block stock on workbench in workshop · end grain shows lamination", tags:["component:glulam_newel_block","material:glue_laminated_oak","setting:workbench"], purpose:"materials_tile" },
  { i:53, section:"component_product_shot", variant:"light_oak_newel_post_pyramidal_moulded_flat_cap_detail", detail:"light oak square panelled newel post with pyramidal moulded flat cap · close-up detail showing cap profile + adjacent turned spindles + oak base rail", tags:["component:newel_post_with_cap","material:light_oak","cap:pyramidal_moulded_flat","view:installed_close_up"], purpose:"materials_tile" },

  // 1.6 · TOOLING / SITE MEASUREMENT
  { i:32, section:"tooling", variant:"trend_router_jig_template_guide_power_pro_routes", detail:"Trend router being used on a jig / template guide (POWER PRO ROUTES branded)  · trade tool product shot", tags:["tool:router","brand:trend","brand:power_pro_routes","jig:template_guide"], purpose:"tools_tile" },
  { i:34, section:"tooling", variant:"stair_pitch_rise_run_measurement_gauge", detail:"isolated stair pitch / rise-run measurement square / protractor gauge tool · transparent background", tags:["tool:stair_pitch_gauge","tool:rise_run_measurement","transparent_bg:true"], purpose:"tools_tile" },

  // 1.7 · UNDER-STAIR FEATURE SCENES
  { i:14, section:"understair_feature", variant:"home_office_oak_desk_iMac_eames_chair_glass_balustrade", detail:"under-stair home office · built-in oak desk with floating shelves + iMac + potted plants + brown Eames lounge chair + glass balustrade above with oak treads", tags:["understair:home_office","feature:built_in_oak_desk","balustrade:glass","furniture:eames_lounge_chair"], purpose:"case_study" },
  { i:15, section:"understair_feature", variant:"multishelf_library_LED_underlit_classical_balustrade_herringbone", detail:"under-stair multi-shelf library · deep built-in bookcase with LED lighting under each shelf + white classical balustrade above + herringbone parquet floor", tags:["understair:library","feature:LED_underlit_shelves","balustrade:white_classical","floor:herringbone_parquet"], purpose:"case_study" },
  { i:16, section:"understair_feature", variant:"minimalist_seating_bench_cushions_open_riser_cantilever_oak", detail:"under-stair minimalist seating bench · white cabinet with cushions + throw pillows + open-riser cantilever oak staircase above · scandi-modern", tags:["understair:seating_bench","feature:white_cabinet_cushions","staircase:open_riser_cantilever_oak","style:scandi_modern"], purpose:"case_study" },
  { i:17, section:"understair_feature", variant:"pull_out_drawer_storage_light_oak_matt_black_spindles", detail:"under-stair pull-out drawer storage · light oak fronted drawers pulled out showing shoes and textiles inside + matt black metal spindles + light oak treads above · adjacent walk-in wardrobe visible", tags:["understair:pull_out_drawers","feature:multi_drawer_storage","balustrade:matt_black_metal_spindles"], purpose:"case_study" },
  { i:18, section:"understair_feature", variant:"seating_nook_white_cabinet_cushions_classical_balustrade_openshelf", detail:"under-stair seating nook · white cabinet base with cushioned bench + throw pillows + white classical spindles + light oak treads · adjacent open shelving in cabinet form + wall art string lights", tags:["understair:seating_nook","feature:white_cabinet_bench_cushions","balustrade:white_classical","feature:adjacent_open_shelving"], purpose:"case_study" },
  { i:19, section:"understair_feature", variant:"wine_cellar_angled_niche_wine_racks_matt_black_spindles", detail:"under-stair wine cellar · angled niche with wine bottles displayed on metal racks + potted plant on top + matt black metal spindles + light oak treads above", tags:["understair:wine_cellar","feature:angled_wine_racks","balustrade:matt_black_metal_spindles"], purpose:"case_study" },
  { i:31, section:"understair_feature", variant:"cantilever_floating_oak_dark_grey_plaster_wall_desk_lamp", detail:"cantilever floating oak staircase mounted to dark grey plaster wall + full-height clear glass balustrade + steel bolts visible on treads + desk with anglepoise lamp on left + swivel chair · architect-modern feature scene", tags:["staircase:cantilever_floating_oak","balustrade:full_height_glass","wall:dark_grey_plaster","furniture:anglepoise_lamp_desk_chair","style:architect_modern"], purpose:"case_study" },

  // 1.8 · CONDITION SURVEY / PEST IMAGERY
  { i:22, section:"condition_survey", variant:"microscopy_lab_wood_worm_larva_split_composition", detail:"split composition · left half MICROSCOPY LABORATORY setup (microscope + monitor with cell imagery + Observation/Analysis/Research/Diagnostics text) + right half circular WOOD WORM inset showing larva in bored timber tunnel · condition-survey card", tags:["survey:woodworm_identification","card:split_composition_lab_pest","label:wood_worm"], purpose:"survey_card" },
  { i:26, section:"condition_survey", variant:"extreme_macro_woodworm_larva_bored_tunnel", detail:"extreme close-up macro photo of woodworm larva in bored timber tunnel · pest identification reference · high detail on larva body segments", tags:["survey:woodworm_macro_reference","photography:extreme_macro","subject:woodworm_larva"], purpose:"survey_reference" },

  // 1.9 · MATERIALS / QC
  { i:48, section:"materials_qc", variant:"bosch_moisture_meter_11_3_percent_stacked_pine_timber", detail:"BOSCH moisture meter reading 11.3% on stacked pine timber in outdoor storage · hand holding meter to timber edge", tags:["qc:moisture_reading","tool:bosch_moisture_meter","reading:11_3_percent","material:pine_stack"], purpose:"qc_evidence" },
  { i:49, section:"materials_qc", variant:"handheld_moisture_meter_12_8_percent_rough_oak_block_workbench", detail:"handheld moisture meter reading 12.8% probed into rough oak block on workbench · two probe pins piercing timber · workshop tools visible in background", tags:["qc:moisture_reading","tool:pin_moisture_meter","reading:12_8_percent","material:rough_oak_block"], purpose:"qc_evidence" },
  { i:51, section:"materials_qc", variant:"extreme_close_up_oak_end_grain_growth_rings", detail:"extreme close-up of oak end-grain / growth-ring cross section · natural tree-ring texture · reference for timber quality and species identification", tags:["photography:extreme_close_up","subject:oak_end_grain_growth_rings","purpose:species_identification_reference"], purpose:"qc_reference" },

  // 1.10 · TRADE CENTRE / RETAIL / SUPPLY-CHAIN
  { i:35, section:"trade_centre_retail", variant:"pallet_loft_ladder_boxed_builders_merchant_aisle_signs", detail:"trade centre pallet · stacked boxed LOFT LADDER product (SIZE 25mm x 1200mm · Easy to Fit · Space Saving · Safe & Strong · Maximum load 150kg) · large industrial builders' merchant setting with aisle signs (Timber · Sheet Materials · Insulation · Plasterboard · Cement · Bricks & Blocks · Landscaping · Fixings & Tools)", tags:["product:loft_ladder_boxed","location:builders_merchant","display:pallet_stack","aisle_signage:visible"], purpose:"supply_chain_evidence" },
  { i:55, section:"trade_centre_retail", variant:"retail_showroom_7_loft_ladders_display_room", detail:"retail showroom · 7 loft ladders demonstrated in a mock display room · track lighting + dark shelving accent walls · full-extended installation examples", tags:["product:loft_ladder_display","location:retail_showroom","count:7_units_displayed"], purpose:"supply_chain_evidence" },
  { i:36, section:"trade_centre_retail", variant:"trade_van_interior_staircase_installation_branded_organized", detail:"trade van interior · fitted racks organised with tools + spirit level + tape measures + STANLEY compressor + Champion 5.0HP generator + toolbox · doors branded STAIRCASE INSTALLATION with QUALITY · PRECISION · SAFETY tagline + EVERY DETAIL MATTERS", tags:["branding:trade_van_staircase_installation","branding:quality_precision_safety","branding:every_detail_matters","equipment:organized_tool_racks"], purpose:"trade_branding_hero" },
  { i:45, section:"trade_centre_retail", variant:"kallesoe_fagus_suisse_glulam_production_line", detail:"KALLESOE and FAGUS SUISSE branded industrial glulam / laminated timber production line · Swiss manufacturing brand · rows of glulam boards on conveyor with clamps", tags:["brand:kallesoe","brand:fagus_suisse","industry:glulam_production","country:switzerland"], purpose:"supply_chain_evidence" },
  { i:46, section:"trade_centre_retail", variant:"large_industrial_glulam_laminated_production_factory_conveyor", detail:"large industrial glulam / laminated production factory · pale timber panels on conveyor line under wood-ceilinged industrial hall", tags:["industry:glulam_production","scale:industrial_factory","view:conveyor_line"], purpose:"supply_chain_evidence" },
  { i:47, section:"trade_centre_retail", variant:"glulam_production_oak_batten_stacks_conveyor_clamps", detail:"glulam production line · oak batten stacks moving through processing on conveyor with clamps · operator visible in background", tags:["industry:glulam_production","material:oak_battens","view:conveyor_clamps_processing"], purpose:"supply_chain_evidence" },
  { i:41, section:"trade_centre_retail", variant:"site_prep_grey_blockwork_wall_stairwell_floor_opening_stripped", detail:"grey concrete blockwork wall + stairwell floor opening (stripped-out pre-installation state) · bare site condition where staircase will be installed", tags:["site:pre_install_stripped_state","material:grey_concrete_blockwork","feature:stairwell_floor_opening"], purpose:"site_prep_reference" },
];

const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
const urlByIdx = new Map();
for (const it of mapping.items) urlByIdx.set(it.idx, it.url);

const mani = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

if (!DRY) {
  const backupDir = join(process.cwd(), "data", ".manifest-backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `manifest-pre-batch10-ingest-${ts}.json`);
  copyFileSync(MANIFEST_PATH, backupPath);
  console.log(`Backup: ${backupPath}`);
}

const NOW = new Date().toISOString();
const RUN_STAMP = "batch10-2026-08-14";
let added = 0, skipped = 0;
const sectionCounts = {};

console.log("");
console.log(`Batch 10 · processing ${BATCH.length} images ${DRY ? "· DRY RUN" : "· LIVE APPLY"}`);
console.log("─".repeat(60));

for (const spec of BATCH) {
  const url = urlByIdx.get(spec.i);
  if (!url) { console.log(`  [${spec.i}] SKIP no url in mapping`); continue; }
  if (mani.images[url]) { console.log(`  [${spec.i}] SKIP already in manifest`); skipped++; continue; }

  const tags = [
    "staircase", "reference", "batch-10-2026-08-14", "philip-supplied",
    "staircase_brain", "domain:STAIRCASE",
    `section:${spec.section}`,
    `variant:${spec.variant}`,
    `purpose:${spec.purpose}`,
    ...(spec.tags || []),
  ];

  const description = [
    `STAIRCASE REFERENCE · Batch 10 · img-${String(spec.i).padStart(2, "0")}`,
    "",
    `SECTION · ${spec.section.replace(/_/g, " ")}`,
    `VARIANT · ${spec.variant.replace(/_/g, " ")}`,
    `PURPOSE · ${spec.purpose.replace(/_/g, " ")}`,
    "",
    `DETAIL · ${spec.detail}`,
    "",
    `PROVENANCE · Supplied by Philip 2026-08-14 (ImageKit). Every observation from direct multimodal read of the pixels · never inferred beyond what is visible.`,
    spec.section === "step_mat"
      ? `COMPANION DOC · step-mats-knowledge-2026-08-14.md`
      : `COMPANION DOC · refacing-before-after-cards-and-trade-content-taxonomy-2026-08-14.md`,
    `COMPANION GALLERY · staircase-reference-gallery-batch-10-2026-08-14.md`,
  ].join("\n");

  mani.images[url] = {
    source: "philip_supplied", original_prompt: null, description, master_ai_prompt: null,
    created_at: NOW, created_by: "batch-10-ingest",
    notes: `Batch 10 · img-${String(spec.i).padStart(2, "0")} · ${spec.section} · ${spec.variant}`,
    tags, a_plus: true,
    subject_domain: "staircase", primary_domain: "STAIRCASE", primary_brain: "staircase_brain",
    image_type: spec.section === "refacing_before_after_card" ? "refacing_card_before_after"
                : spec.section === "product_render" ? "product_render"
                : spec.section === "component_product_shot" ? "product_component"
                : spec.section === "understair_feature" ? "case_study_scene"
                : spec.section === "trade_craftsmanship" ? "trade_activity"
                : spec.section === "trade_centre_retail" ? "trade_capability"
                : spec.section === "condition_survey" ? "survey_reference"
                : spec.section === "materials_qc" ? "qc_reference"
                : spec.section === "tooling" ? "trade_tool"
                : spec.section === "design_sketch_composition" ? "design_concept"
                : "reference",
    image_purpose: { primary: spec.purpose, secondary: "brain_evidence", tertiary: "advisor_reference" },
    subject: spec.section,
    collection_id: `batch_10_${spec.section}`,
    collection_memberships: [
      "staircase_references",
      `batch_10_${spec.section}`,
      "batch_10_2026_08_14",
      spec.section === "step_mat" ? "step_mats" : "trade_card_content_library",
    ],
    material_composition: spec.tags?.filter((t) => t.startsWith("material:")).map((t) => t.slice(9)) || [],
    can_become: ["directory_card_hero", "brain_chat_evidence", "advisor_illustration"],
    family_tree: { children: [] },
    geometry_preservation: {
      preserve_by_default: true,
      allowed_modifications: ["material", "colour", "lighting"],
      never_change_without_explicit_request: ["geometry", "proportions", "composition", "perspective", "architectural-details"],
    },
    learning_signals: [],
    knowledge_band: "reference", knowledge_band_label: "Reference Knowledge",
    human_tagged_by: "philip-supplied", human_tagged_at: NOW, marked_by: "batch-10-ingest",
    not_a_staircase: false,
    _ingest_batch: RUN_STAMP,
    _enrichment: { domain_classified_at: NOW, domain_classified_reason: "batch10_direct_observation", record_state_expected: "routable" },
  };

  added++;
  sectionCounts[spec.section] = (sectionCounts[spec.section] || 0) + 1;
  console.log(`  [${String(spec.i).padStart(2, "0")}] ADD · ${spec.section}/${spec.variant.slice(0, 40)}`);
}

console.log("─".repeat(60));
console.log(`Added: ${added} · Skipped: ${skipped}`);
console.log("By section:");
for (const [k,v] of Object.entries(sectionCounts).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(30)} ${v}`);

if (!DRY && added > 0) {
  mani.generated_at = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(mani, null, 2), "utf8");
  console.log(`Manifest written`);
} else if (DRY) {
  console.log("DRY RUN · re-run with --apply");
}
