// scripts/nex-brain/ingest-batch4-manifest.mjs
//
// Batch 4 · Staircase reference gallery · 2026-08-14 (Philip supplied).
// Adds 37 images to data/nex-image-manifest.json with:
//   · primary_domain: STAIRCASE  (per Domain Rule 2026-08-14)
//   · primary_brain:  staircase_brain
//   · a_plus: true (reference-grade)
//   · rich per-image tags derived from direct multimodal observation
//     (see data/nex-reference-brains/staircase-preparation/layer-2-drafts/
//      staircase-reference-gallery-batch-4-2026-08-14.md)
//
// Uses withManifestWrite equivalent semantics · backs up manifest first ·
// atomic write · never overwrites an existing row.
//
// Dry-run by default. --apply to actually write.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const DRY = !process.argv.includes("--apply");
const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const MAPPING_PATH  = join(process.cwd(), "data", "incoming-image-ingest", "batch4-2026-08-14", "_mapping.json");

// ─── Batch metadata per image (from observed multimodal reads) ──────
// Each entry: [idx, tagsExtras, descriptionCore, notable]
const BATCH = [
  { i: 1, type:"straight_flight", direction:"back-right", stringer:"cantilever_mono", balustrade:"frameless_glass", materials:["walnut","glass","blackened_steel"], lighting:["wall_step_light"], style:"modern_minimalist",
    notable:"floating cantilever treads · wall-aligned LED step lights create warm scallops · single black mono-stringer on right · frameless glass on left" },
  { i: 2, type:"straight_flight_bullnose", direction:"back-right", stringer:"closed", balustrade:"slim_vertical_rod_matt_black", materials:["oak","matt_black_metal","timber_slat"], lighting:["under_nosing_LED","LED_baserail"], style:"contemporary_japandi",
    notable:"bullnose start · matt black slim square rods · vertical timber slat wall panel · LED nosing + baserail plinth glow" },
  { i: 3, type:"quarter_turn_L", direction:"back-with-left-return", stringer:"closed", balustrade:"turned_spindle_black", materials:["oak_mid","white_riser","black_metal"], lighting:["classical_wall_sconce"], style:"traditional_english_high_contrast",
    notable:"black turned spindles + white risers + white wainscot · classical high-contrast" },
  { i: 4, type:"half_turn_U", direction:"back-with-return", stringer:"closed_bullnose_volute", balustrade:"turned_spindle_white", materials:["walnut_stained","white_riser","black_newel"], lighting:["downlights_only"], style:"grand_traditional_victorian_revival",
    notable:"curved bullnose starting step with baluster volute · white turned spindles + black square newels + dark walnut treads" },
  { i: 5, type:"straight_flight", direction:"back-left", stringer:"closed", balustrade:"horizontal_stainless_rod", materials:["dark_walnut","stainless_steel"], lighting:["wall_sconce"], style:"modern_industrial_warm_walnut",
    notable:"stainless steel horizontal rod infill · warm dark walnut handrail baserail newels · masculine industrial" },
  { i: 6, type:"straight_with_landing_return", direction:"back-left-plus-right-return", stringer:"open_riser_cantilever", balustrade:"slim_vertical_rod_matt_black_tall", materials:["light_oak","matt_black_metal"], lighting:["skylight"], style:"modern_scandinavian_openplan",
    notable:"open-plan · tall closely-spaced matt black slim vertical rods as full-height screen · skylight above · light oak treads floating" },
  { i: 7, type:"straight_flight_short", direction:"back", stringer:"cantilever_open_riser", balustrade:"vertical_timber_slat", materials:["walnut_mid","timber_slat"], lighting:["wall_step_light","LED_undercabinet","art_LED_backlight"], style:"modern_luxury_warm",
    notable:"short flight · vertical timber slat wall AND slats beside stairs · motorcycle art LED backlight · warm luxury" },
  { i: 8, type:"straight_flight_short", direction:"back", stringer:"cantilever_open_riser", balustrade:"vertical_timber_slat_plus_glass", materials:["light_oak","timber_slat"], lighting:["wall_step_light","LED_undercabinet"], style:"modern_luxury_warm",
    notable:"companion to img-7 · lighter finish · glass panel barely visible left of stairs" },
  { i: 9, type:"straight_to_landing_return", direction:"back-left-with-half-landing", stringer:"cantilever_open_riser_both_flights", balustrade:"vertical_timber_slat_full_height", materials:["warm_oak","timber_slat","herringbone_parquet"], lighting:["LED_handrail"], style:"luxury_modern_warm_walnut",
    notable:"full-height vertical timber slats screen · LED handrail integrated on wall rail · grand modern hallway with garden view" },
  { i:10, type:"quarter_turn_L", direction:"back-with-left-return", stringer:"closed", balustrade:"turned_spindle_natural_oak", materials:["natural_light_oak","seagrass_runner"], lighting:["downlights_only"], style:"traditional_english_cottage_natural_oak",
    notable:"all-natural honey oak · turned spindles + ball-cap newel · bullnose start · classical cottage" },
  { i:11, type:"straight_with_bottom_winder", direction:"back-right", stringer:"closed", balustrade:"turned_spindle_natural_oak_slim", materials:["natural_oak_treads","white_risers","cream_carpet"], lighting:["window_light"], style:"traditional_uk_two_tone",
    notable:"natural oak treads + painted white risers (classic UK combo) · turned oak spindles" },
  { i:12, type:"straight_flight_bullnose", direction:"back-right", stringer:"closed", balustrade:"turned_spindle_pine", materials:["natural_pine_throughout","pine_floor"], lighting:["window_only"], style:"traditional_cottage_all_pine",
    notable:"all-timber (no paint) · natural pine throughout · country cottage" },
  { i:13, type:"straight_with_winder_bottom", direction:"back-with-left-turn", stringer:"closed_panelled_apron", balustrade:"slim_square_oak", materials:["monochromatic_mid_stained_oak","herringbone_parquet"], lighting:["brass_wall_sconce"], style:"modern_traditional_english_hybrid",
    notable:"monochromatic oak · walls stringer floor all matching mid-tone stained oak · brass sconce" },
  { i:14, type:"straight_flight", direction:"back-left", stringer:"closed", balustrade:"slim_square_pine", materials:["light_pine","matching_pine_floor"], lighting:["basic_downlights"], style:"modern_uk_new_build_simple",
    notable:"very simple builder-grade contemporary · light pine throughout" },
  { i:15, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"slim_square_light_oak", materials:["light_oak","matching_floor"], lighting:["basic_downlights"], style:"modern_uk_new_build_simple",
    notable:"builder-grade companion to img-14 · light oak vs pine" },
  { i:16, type:"straight_flight_understair_storage", direction:"back-right", stringer:"closed", balustrade:"slim_square_pine", materials:["natural_pine","dark_oak_floor","chrome_hardware"], lighting:["window_only"], style:"cottage_modern_practical_joinery",
    notable:"integrated understair storage · pine cabinet doors + 3 drawers + brushed chrome cup handles" },
  { i:17, type:"straight_with_upper_landing", direction:"back-right", stringer:"closed", balustrade:"slim_square_flat_block", materials:["light_pine_oak_natural","sage_feature_wall"], lighting:["downlights"], style:"modern_minimalist_new_build",
    notable:"flat-block spindle detail (non-turned contemporary UK) · matching return balustrade above" },
  { i:18, type:"winder_quarter_turn_bullnose", direction:"back-with-right-turn", stringer:"black_closed_baserail_newel", balustrade:"ornate_metal_elongated_ellipse_matt_black", materials:["light_oak_treads","matt_black_metal","black_stringer"], lighting:["under_nosing_LED","LED_baserail","LED_newel"], style:"contemporary_luxury_LED_heavy_statement",
    notable:"TRIPLE LED (nosing + baserail + newel-inset vertical strip) · ornate matt black powder-coated elongated-ellipse balusters" },
  { i:19, type:"straight_with_landing_return", direction:"back-right", stringer:"closed", balustrade:"panelled_wainscot_no_spindles", materials:["greige_painted_panels","mid_stained_oak_treads"], lighting:["LED_handrail"], style:"classical_panel_clad_modern_LED_hybrid",
    notable:"RARE full-panel balustrade — no spindles at all · recessed field panels + continuous LED handrail on top" },
  { i:20, type:"traditional_winder_start_curved_bullnose", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"turned_spindle_natural_oak", materials:["natural_oak","cream_wool_carpet","brass_stair_rods","white_wainscot"], lighting:["ambient"], style:"georgian_english_traditional_light_palette",
    notable:"wide curved bullnose start · cream carpet runner + brass rods holding it · classical English done well" },
  { i:21, type:"traditional_winder_start_curved_bullnose", direction:"back-right", stringer:"closed_panelled_apron", balustrade:"turned_spindle_natural_oak", materials:["natural_oak","dark_charcoal_carpet","brass_stair_rods","black_wainscot"], lighting:["ambient"], style:"moody_traditional_english_dark_palette",
    notable:"SAME construction as img-20 but dark carpet + black wainscot creates completely different mood · lesson in material impact" },
  { i:22, type:"straight_with_top_landing_winder", direction:"back-with-left-turn-top", stringer:"closed", balustrade:"slim_square_white", materials:["natural_oak_treads","sage_green_painted_risers","sage_green_wall_panelling","oak_floor"], lighting:["brass_wall_sconce"], style:"modern_country_cottage_bespoke_colour_block",
    notable:"sage-green painted risers matches sage-green vertical timber wall panelling · colour-block traditional-modern" },
  { i:23, type:"straight_flight_medium", direction:"back", stringer:"closed", balustrade:"white_spindles_walnut_handrail", materials:["dark_walnut_treads","white_risers","white_vertical_shiplap","dark_walnut_floor"], lighting:["window_top"], style:"modern_coastal_farmhouse",
    notable:"WHITE VERTICAL SHIPLAP throat cladding both walls full height · dark walnut treads · high-contrast farmhouse" },
  { i:24, type:"straight_open_riser_cantilever_mono", direction:"back-right", stringer:"cantilever_from_wall_right_only", balustrade:"backlit_vertical_timber_slat_plus_LED_handrail", materials:["natural_light_oak_thick_slabs","timber_slat","polished_concrete_floor"], lighting:["LED_backlight_behind_slats","LED_handrail_continuous"], style:"ultra_modern_zen_minimalist_architect",
    notable:"BACKLIT vertical timber slat screen (LED behind slats casting through) + LED handrail · Japanese-influenced zen · one of most sophisticated in batch" },
  { i:25, type:"straight_flight", direction:"back-left", stringer:"closed_panelled_apron_matching_wall_wainscot", balustrade:"slim_square_white", materials:["warm_oak_handrail","white_painted_spindles_newel_risers","greige_wainscot","oak_parquet","cream_carpet_runner"], lighting:["pendant_lantern"], style:"modern_british_country_integrated_joinery",
    notable:"full-height greige wainscot on wall AND matching panelled apron on stair — stair-integrated joinery · white ball-finial newel" },
  { i:26, type:"quarter_turn_L_landing_top_left", direction:"back-left-with-left-turn", stringer:"open_riser_floating", balustrade:"slim_square_oak", materials:["light_oak_throughout"], lighting:["under_nosing_LED","LED_kitchen_kickboard_matching"], style:"modern_british_open_plan_light_oak_grey",
    notable:"under-nosing LED parallel to LED under kitchen kickboard (cohesive design language) · grey shaker kitchen adjacent" },
  { i:27, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"horizontal_stainless_rod", materials:["dark_walnut_throughout","stainless_steel"], lighting:["up_down_wall_sconce_beam_pattern"], style:"modern_industrial_warm_walnut_darker",
    notable:"near-identical construction to img-5 but darker sage/grey walls · up-down wall sconces create beam pattern" },
  { i:28, type:"straight_with_landing_turn", direction:"back-with-landing-turn", stringer:"closed_panelled_apron_burgundy", balustrade:"white_spindles_natural_oak_handrail", materials:["deep_burgundy_painted_wainscot","natural_oak_handrail_newel","white_spindles","cream_wool_carpet","brass_stair_rods","herringbone_parquet"], lighting:["brass_wall_sconce"], style:"statement_traditional_english_bold_colour",
    notable:"STATEMENT deep burgundy (oxblood) painted panelled wainscot on wall + matching burgundy apron on stringer · traditional stair + bold colour" },
  { i:29, type:"curved_sweep_symmetric_flared_base", direction:"back-with-symmetric-outward-sweep", stringer:"closed_with_curved_outward_sweep", balustrade:"turned_spindle_oak_bulb_urn", materials:["mid_stained_oak_throughout","carved_horse_head_newel_sculptures","wide_plank_oak_floor"], lighting:["classical_chandelier","arched_window_daylight"], style:"country_estate_grand_traditional_statement_carving",
    notable:"HORSE HEAD carved wooden newels (2 symmetric) at flared sweep base · double-height ceiling · country estate scale · one-of-a-kind statement" },
  { i:30, type:"straight_with_left_return_landing", direction:"back-right-with-left-return", stringer:"open_riser_floating", balustrade:"slim_vertical_rod_matt_black_full_height", materials:["light_oak_treads","matt_black_slim_metal_rods","warm_oak_floor","grey_concrete_tile"], lighting:["LED_handrail_integrated"], style:"modern_industrial_black_oak_european",
    notable:"black slim vertical rod balustrade both sides + integrated LED handrail · compact footprint · green shaker kitchen adjacent" },
  { i:31, type:"straight_with_top_landing", direction:"back-left", stringer:"closed", balustrade:"frameless_glass_wall_mounted_handrail", materials:["light_oak_treads","frameless_glass","stainless_standoffs","white_painted_risers","cream_microcement_floor"], lighting:["wall_step_light"], style:"modern_british_minimal_glass_light_oak",
    notable:"frameless glass balustrade + wall-mounted single handrail on right (no top-of-glass cap on this side) · small kitchen setting" },
  { i:32, type:"straight_flight", direction:"back-right", stringer:"closed", balustrade:"frameless_glass_with_timber_handrail_cap", materials:["light_oak_treads","frameless_glass","stainless_standoffs","warm_timber_handrail","cream_tile_floor"], lighting:["wall_step_light"], style:"modern_british_minimal_glass_light_oak",
    notable:"wider companion view of img-31 layout · shows kitchen (timber units + black granite worktop + chrome barstools) and staircase together" },
  { i:33, type:"curved_sweep_flared_base_single_side", direction:"back-right-with-outward-curve-at-base", stringer:"closed_with_curved_sweep", balustrade:"slim_vertical_rod_matt_black_curved_handrail", materials:["rich_dark_walnut_treads_risers_handrail_newel","black_slim_metal_spindles","matching_walnut_floor"], lighting:["wall_step_light_right_wall"], style:"modern_traditional_hybrid_dark_walnut_black_accent",
    notable:"elegant flared/curved starting sweep + modern black slim rods (traditional × modern hybrid) · sketched-illustration wall art" },
  { i:34, type:"straight_with_bottom_landing_winder", direction:"back-right-with-left-turn-bottom", stringer:"closed_charcoal_grey_painted", balustrade:"horizontal_stainless_rod_charcoal_handrail_thick", materials:["dark_charcoal_grey_painted_stringer_risers_newels_handrail","stainless_steel_rods","warm_oak_parquet"], lighting:["LED_wall_wash_indirect_uplight_behind"], style:"modern_industrial_grey_stainless_LED_wash",
    notable:"unusual GREY (not black/white) painted throughout · LED wall-wash behind stair casting indirect amber uplight · thick chunky handrail" },
  { i:35, type:"central_spine_cantilever_mono_stringer", direction:"back-right", stringer:"single_matt_black_steel_central_spine_mono", balustrade:"frameless_glass_with_timber_handrail_cap", materials:["thick_warm_light_oak_treads_cantilevered_both_sides","matt_black_central_steel_spine","frameless_glass_stainless_standoffs","warm_timber_handrail","timber_parquet_floor"], lighting:["LED_handrail_integrated"], style:"ultra_modern_architect_engineering_statement",
    notable:"CENTRAL-SPINE mono-stringer — single black steel spine + oak treads cantilevering symmetrically both sides · rare structural design · high-ceiling entrance hall" },
  { i:36, type:"straight_cantilever_open_riser_wall_attached", direction:"back-right", stringer:"cantilever_from_wall_right", balustrade:"frameless_glass_full_height_with_timber_handrail_cap", materials:["light_oak_treads","frameless_glass","stainless_standoffs","light_oak_handrail","large_cream_stone_tile","concrete_plaster_walls"], lighting:["LED_handrail_continuous","up_down_black_wall_sconce_beam"], style:"modern_architect_luxury_light_oak_glass_LED",
    notable:"clean minimal architect design · LED handrail + up-down beam wall sconces · high-ceiling hallway with plant visible" },
  { i:37, type:"straight_with_upper_landing_wall_wrapped_bullnose", direction:"back-right", stringer:"closed_wall_wrapped_rounded_bullnose", balustrade:"frameless_glass_stainless_standoffs_stainless_handrail", materials:["light_oak_treads_wide_riser_panels","frameless_glass","stainless_top_handrail","large_cream_stone_tile","vertical_timber_slat_backdrop_below_landing"], lighting:["under_nosing_LED"], style:"modern_architect_luxury_warm_minimalist",
    notable:"RARE wall-wrapped rounded bullnose starting step (curves around newel base + returns to wall) · vertical timber slat backdrop · full-height glass to second floor" },
];

// ─── Load inputs ─────────────────────────────────────────────────────
const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
const urlByIdx = new Map();
for (const it of mapping.items) urlByIdx.set(it.idx, it.url);

const mani = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

// ─── Backup FIRST (per Migration Verification Protocol) ─────────────
if (!DRY) {
  const backupDir = join(process.cwd(), "data", ".manifest-backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `manifest-pre-batch4-ingest-${ts}.json`);
  copyFileSync(MANIFEST_PATH, backupPath);
  console.log(`Backup: ${backupPath}`);
}

// ─── Build entries · never overwrite existing ────────────────────────
const NOW = new Date().toISOString();
const RUN_STAMP = "batch4-2026-08-14";
let added = 0, skipped = 0;

console.log("");
console.log(`Batch 4 · processing ${BATCH.length} images ${DRY ? "· DRY RUN" : "· LIVE APPLY"}`);
console.log("─".repeat(60));

for (const spec of BATCH) {
  const url = urlByIdx.get(spec.i);
  if (!url) { console.log(`  [${spec.i}] SKIP no url in mapping`); continue; }
  if (mani.images[url]) { console.log(`  [${spec.i}] SKIP already in manifest`); skipped++; continue; }

  const tags = [
    "staircase",
    "reference",
    "hero-scene",
    "batch-4-2026-08-14",
    "philip-supplied",
    "staircase_brain",
    "domain:STAIRCASE",
    `type:${spec.type}`,
    `direction:${spec.direction}`,
    `stringer:${spec.stringer}`,
    `balustrade:${spec.balustrade}`,
    ...spec.materials.map((m) => `material:${m}`),
    ...spec.lighting.map((l) => `lighting:${l}`),
    `style:${spec.style}`,
  ];

  const description = [
    `STAIRCASE REFERENCE · Batch 4 · img-${String(spec.i).padStart(2, "0")}`,
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
    `COMPANION DOCUMENT · data/nex-reference-brains/staircase-preparation/layer-2-drafts/staircase-reference-gallery-batch-4-2026-08-14.md`,
  ].join("\n");

  mani.images[url] = {
    source: "philip_supplied",
    original_prompt: null,
    description,
    master_ai_prompt: null,
    created_at: NOW,
    created_by: "batch-4-ingest",
    notes: `Batch 4 · img-${String(spec.i).padStart(2, "0")} · ${spec.notable}`,
    tags,
    a_plus: true,
    subject_domain: "staircase",
    primary_domain: "STAIRCASE",
    primary_brain: "staircase_brain",
    image_type: "reference",
    image_purpose: { primary: "brain_evidence", secondary: "matcher_source", tertiary: "advisor_reference" },
    collection_id: "staircase_reference_batch_4",
    collection_memberships: ["staircase_references", "batch_4_2026_08_14"],
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
    marked_by: "batch-4-ingest",
    not_a_staircase: false,
    _ingest_batch: RUN_STAMP,
    _enrichment: {
      domain_classified_at: NOW,
      domain_classified_reason: "batch4_direct_observation",
      record_state_expected: "routable",
    },
  };

  added++;
  console.log(`  [${String(spec.i).padStart(2, "0")}] ADD · ${spec.type} · ${spec.balustrade} · ${spec.style.slice(0, 30)}`);
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
