// Batch 8 · 43 landing-railing images · same protocol as batches 4-7.
// Every image in this batch shares the same landing well setting; only the railing design changes.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const DRY = !process.argv.includes("--apply");
const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const MAPPING_PATH  = join(process.cwd(), "data", "incoming-image-ingest", "batch8-2026-08-14", "_mapping.json");

const BATCH = [
  { i: 1, subject_variant:"barley_sugar_twist_pine_spindles", railing_family:"timber_turned", infill:"barley_sugar_twisted_pine_spindles", handrail:"pine", newel:"pine_square_flat_cap", accents:["rope_twist_profile"], style:"traditional_english_cottage", notable:"BARLEY-SUGAR / ROPE-TWIST pine spindles full spindle height" },
  { i: 2, subject_variant:"classical_bulb_urn_turned_pine", railing_family:"timber_turned", infill:"classical_turned_pine_spindles_bulb_urn", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["bulb_urn_profile"], style:"georgian_victorian_revival", notable:"CLASSICAL bulb-and-urn turned pine spindles (Georgian/Victorian revival profile)" },
  { i: 3, subject_variant:"slim_bulb_turned_pine", railing_family:"timber_turned", infill:"slim_bulb_turned_pine_spindles", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["slimmer_bulb_variant"], style:"traditional_restrained", notable:"THINNER-BULB classical turned pine spindles · restrained variant" },
  { i: 4, subject_variant:"very_slim_classical_turned_pine", railing_family:"timber_turned", infill:"very_slim_classical_turned_pine_spindles", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["slim_elegant"], style:"traditional_refined", notable:"SLIM classical turned pine spindles · elegant/refined profile" },
  { i: 5, subject_variant:"chunky_bold_turned_pine", railing_family:"timber_turned", infill:"chunky_bold_turned_pine_spindles", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["heavy_bulb_wide_urn"], style:"traditional_cottage_heavy", notable:"CHUNKIER bold turned pine spindles · traditional cottage heaviness" },
  { i: 6, subject_variant:"flat_blade_arrow_wooden_spindles", railing_family:"timber_flat_blade", infill:"flat_blade_arrow_shaped_wooden_spindles", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["arrow_spade_silhouette"], style:"contemporary_folk_flat_blade", notable:"FLAT-BLADE ARROW-shaped sawn-timber spindles (not round turning)" },
  { i: 7, subject_variant:"horizontal_stainless_rod_infill", railing_family:"stainless_horizontal", infill:"horizontal_stainless_steel_rods", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["horizontal_orientation"], style:"modern_industrial_horizontal", notable:"HORIZONTAL stainless steel rod infill (multiple slim horizontal rods)" },
  { i: 8, subject_variant:"matt_black_rods_plate_accents", railing_family:"matt_black_metal_rod", infill:"vertical_black_matt_metal_rods_with_plate_accents", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["small_flat_plate_details"], style:"modern_industrial", notable:"vertical matt-black metal rods + small flat plate accents at intervals" },
  { i: 9, subject_variant:"matt_black_rods_single_ring", railing_family:"matt_black_metal_rod", infill:"black_metal_rods_with_single_circular_ring_centre", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["single_ring_centre"], style:"modern_industrial_ring_accent", notable:"black metal rods with single CIRCULAR RING at mid-height on each rod" },
  { i:10, subject_variant:"matt_black_rods_elongated_oval", railing_family:"matt_black_metal_rod", infill:"black_metal_rods_with_elongated_oval_lens_shape", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["elongated_oval_lens"], style:"modern_industrial_lens_accent", notable:"black metal rods with ELONGATED OVAL / LENS shape centre element" },
  { i:11, subject_variant:"plain_slim_matt_black_rods", railing_family:"matt_black_metal_rod", infill:"plain_slim_matt_black_vertical_rods", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["no_accents_baseline"], style:"modern_industrial_minimal", notable:"PLAIN SLIM matt-black vertical rods (baseline no-accent profile)" },
  { i:12, subject_variant:"matt_black_rods_pill_stadium", railing_family:"matt_black_metal_rod", infill:"black_rods_with_pill_stadium_shape_centre", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["pill_stadium_shape"], style:"modern_industrial_pill_accent", notable:"black rods with PILL / STADIUM shape (rounded rectangle) centre accent" },
  { i:13, subject_variant:"matt_black_rods_twist_plus_diamonds", railing_family:"matt_black_metal_rod", infill:"twisted_centre_black_rods_with_small_diamond_accents", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["twisted_mid_section","small_diamond_punctuation"], style:"modern_industrial_twist_diamond", notable:"twisted-centre matt-black rods + small diamond accents" },
  { i:14, subject_variant:"plain_slim_square_pine_spindles", railing_family:"timber_square", infill:"plain_slim_square_pine_spindles", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["all_timber_minimal"], style:"modern_minimal_all_timber", notable:"PLAIN SLIM SQUARE pine spindles (reference all-timber minimal baseline)" },
  { i:15, subject_variant:"matt_black_rods_larger_oval_centre", railing_family:"matt_black_metal_rod", infill:"black_rods_with_elongated_oval_larger_centre_element", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["larger_centre_element"], style:"modern_industrial_heavy_oval", notable:"elongated oval with LARGER centre element · heavier companion to img-10" },
  { i:16, subject_variant:"matt_black_rods_multiple_diamonds", railing_family:"matt_black_metal_rod", infill:"black_rods_multiple_small_diamond_basket_details", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["multiple_diamond_punctuation"], style:"modern_industrial_diamond_series", notable:"multiple small DIAMOND / BASKET details along each rod at intervals" },
  { i:17, subject_variant:"classical_turned_pine_bulb_urn_alt", railing_family:"timber_turned", infill:"classical_turned_pine_spindles_bulb_urn", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["bulb_urn_profile"], style:"georgian_victorian_revival", notable:"classical turned pine spindles bulb+urn (companion to img-02)" },
  { i:18, subject_variant:"flat_blade_arrow_diamond_wooden", railing_family:"timber_flat_blade", infill:"flat_blade_arrow_diamond_wooden_spindles", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["arrow_diamond_central_profile"], style:"contemporary_folk_flat_blade_diamond", notable:"ARROW / DIAMOND flat-blade wooden spindles" },
  { i:19, subject_variant:"reeded_fluted_pine_spindles", railing_family:"timber_turned", infill:"reeded_fluted_pine_spindles", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["vertical_reeding_fluting"], style:"neoclassical_doric_reeded", notable:"REEDED / FLUTED pine spindles (Doric column analogue · vertical parallel grooves)" },
  { i:20, subject_variant:"diamond_cross_lattice_fretwork", railing_family:"timber_fretwork_panel", infill:"diamond_cross_lattice_fretwork_panels", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["continuous_diamond_lattice"], style:"traditional_lattice_panel", notable:"continuous DIAMOND CROSS-LATTICE fretwork panel (instead of spindles)" },
  { i:21, subject_variant:"angular_random_geometric_fretwork", railing_family:"timber_fretwork_panel", infill:"angular_random_geometric_wooden_fretwork_panels", handrail:"pine", newel:"pine_chunky_flat_cap", accents:["contemporary_irregular_geometric"], style:"contemporary_geometric_fretwork", notable:"contemporary IRREGULAR ANGULAR geometric wooden fretwork (not classical repeat)" },
  { i:22, subject_variant:"frameless_glass_matt_black_clamps", railing_family:"glass_panel", infill:"frameless_glass_panels", handrail:"pine", newel:"pine_chunky", accents:["matt_black_stainless_clamps"], style:"modern_british_glass_pine", notable:"frameless glass panels with matt-black stainless clamp mounts" },
  { i:23, subject_variant:"horizontal_light_oak_slats", railing_family:"timber_horizontal_slat", infill:"horizontal_light_oak_slats", handrail:"light_oak", newel:"light_oak_chunky", accents:["parallel_horizontal_slats"], style:"modern_warm_timber_horizontal", notable:"HORIZONTAL LIGHT OAK SLAT balustrade (warm-timber analogue of cable/horizontal rod)" },
  { i:24, subject_variant:"diamond_woven_bronze_mesh", railing_family:"metal_mesh_panel", infill:"diamond_woven_bronze_copper_metal_mesh_panels", handrail:"dark_stained_timber", newel:"dark_stained_timber_chunky", accents:["diamond_woven_mesh_bronze_copper_tone"], style:"industrial_luxury_bronze_mesh", notable:"DIAMOND WOVEN metal mesh panels (bronze/copper tone) with dark-stained timber frames" },
  { i:25, subject_variant:"black_wrought_iron_cage_fretwork_bolts", railing_family:"wrought_iron_panel", infill:"black_wrought_iron_cage_lattice_fretwork_panel_with_visible_diamond_bolts", handrail:"dark_wood", newel:"dark_wood_chunky", accents:["visible_diamond_bolts_at_intersections"], style:"industrial_traditional_wrought_iron_cage", notable:"BLACK WROUGHT-IRON CAGE / LATTICE FRETWORK PANEL with visible diamond bolts as design detail" },
  { i:26, subject_variant:"dark_cane_rattan_hexagonal_webbing", railing_family:"cane_rattan_panel", infill:"fine_dark_cane_rattan_hexagonal_webbing_panels", handrail:"dark_stained_timber", newel:"dark_stained_timber_chunky", accents:["hexagonal_cane_webbing"], style:"scandi_mid_century_cane_infill", notable:"FINE DARK CANE / RATTAN HEXAGONAL WEBBING infill (Danish chair-back analogue)" },
  { i:27, subject_variant:"perforated_stainless_dot_led_newel_baserail", railing_family:"perforated_metal_panel", infill:"brushed_stainless_steel_perforated_dot_pattern_panels", handrail:"dark_walnut", newel:"dark_walnut_led_inset_vertical_strip", accents:["led_inset_newel_vertical_strip","led_baserail_strip"], style:"architect_modern_led_perforated", notable:"BRUSHED STAINLESS PERFORATED DOT-PATTERN panels + LED-inset newel vertical strip + LED baserail strip" },
  { i:28, subject_variant:"chunky_stainless_rods_led_newel", railing_family:"stainless_vertical_rod", infill:"chunky_brushed_stainless_steel_vertical_spindles", handrail:"light_oak", newel:"light_oak_led_inset_vertical_strip", accents:["led_inset_newel_vertical_strip"], style:"architect_modern_led_stainless", notable:"CHUNKY brushed stainless steel vertical spindles + light oak framework + LED-inset newel" },
  { i:29, subject_variant:"slim_stainless_rods_black_cap_newel", railing_family:"stainless_vertical_rod", infill:"slim_brushed_stainless_steel_vertical_rods", handrail:"light_oak", newel:"light_oak_black_metal_flat_cap", accents:["black_flat_metal_cap"], style:"modern_stainless_slim_bicolour_cap", notable:"SLIM brushed stainless steel vertical rods + light oak newel with BLACK METAL flat cap" },
  { i:30, subject_variant:"wrought_iron_tree_vine_sculptural", railing_family:"wrought_iron_panel", infill:"black_wrought_iron_tree_vine_sculptural_fretwork_panels", handrail:"pine", newel:"pine_chunky", accents:["sculpted_iron_branch_leaves_buds","subtle_led_wash_behind"], style:"artisan_botanical_wrought_iron", notable:"BLACK WROUGHT-IRON TREE / VINE SCULPTURAL fretwork (sculpted branch with leaves + buds) + subtle LED behind" },
  { i:31, subject_variant:"frameless_glass_chunky_pine_black_caps", railing_family:"glass_panel", infill:"frameless_glass_panels", handrail:"pine", newel:"chunky_pine_black_metal_flat_cap", accents:["black_metal_flat_cap","matt_black_stainless_clamps"], style:"modern_british_glass_bicolour", notable:"frameless glass + chunky pine newels with BLACK METAL FLAT CAPS + matt-black stainless clamps" },
  { i:32, subject_variant:"horizontal_stainless_cables_charcoal_stringer", railing_family:"cable_horizontal", infill:"horizontal_stainless_steel_multi_cable_railing", handrail:"pine", newel:"chunky_black_painted", accents:["dark_charcoal_painted_stringer_panel"], style:"modern_architect_cable_charcoal", notable:"HORIZONTAL stainless steel MULTI-CABLE railing + dark charcoal painted stringer panel behind" },
  { i:33, subject_variant:"chunky_stainless_rods_rounded_caps_stainless_newel", railing_family:"stainless_vertical_rod", infill:"chunky_brushed_stainless_steel_vertical_rods_with_rounded_caps", handrail:"light_oak", newel:"stainless_steel_clad_chunky_newel", accents:["rounded_rod_end_caps","stainless_clad_newel"], style:"industrial_luxury_stainless_clad_newel", notable:"chunky brushed stainless rods with rounded caps + brushed stainless-CLAD chunky newel" },
  { i:34, subject_variant:"mixed_timber_stainless_alternating", railing_family:"hybrid_timber_metal", infill:"light_oak_plain_square_spindles_alternating_with_chunky_brushed_stainless_rod_inserts", handrail:"light_oak", newel:"painted_white_with_light_oak_cap", accents:["alternating_timber_metal_rhythm"], style:"contemporary_hybrid_mixed", notable:"HYBRID mixed timber + stainless: light oak square spindles ALTERNATING with chunky brushed stainless rod inserts" },
  { i:35, subject_variant:"slim_stainless_rods_black_stained_handrail", railing_family:"stainless_vertical_rod", infill:"slim_stainless_steel_vertical_rods_with_black_rubber_base_caps", handrail:"black_stained_oak", newel:"light_oak_with_black_flat_metal_cap", accents:["black_rubber_base_caps","black_flat_metal_cap","black_stained_handrail"], style:"modern_architect_bicolour_black_hierarchy", notable:"slim stainless rods + BLACK RUBBER base caps + BLACK-STAINED oak handrail + light oak newel with black flat cap" },
  { i:36, subject_variant:"painted_white_square_spindles_chrome_ring", railing_family:"timber_square_painted", infill:"painted_white_plain_square_spindles_with_chrome_ring_accents_centre", handrail:"light_oak", newel:"painted_white_square_light_oak_cap", accents:["chrome_ring_centre_accent","white_oak_two_tone"], style:"modern_traditional_bicolour_chrome_ring", notable:"painted white square spindles with CHROME RING accents at centre + light oak handrail + white newel with oak cap" },
  { i:37, subject_variant:"painted_white_square_polished_oval_rosette", railing_family:"timber_square_painted", infill:"painted_white_plain_square_spindles_with_polished_chrome_stainless_oval_bosses_rosettes_centre", handrail:"light_oak", newel:"painted_white_square_light_oak_flat_cap", accents:["polished_oval_rosette_boss"], style:"modern_traditional_polished_rosette", notable:"painted white square spindles with polished chrome/stainless OVAL BOSSES / ROSETTES at centre" },
  { i:38, subject_variant:"walnut_square_alternating_stainless_rods", railing_family:"hybrid_timber_metal", infill:"dark_walnut_plain_square_spindles_alternating_with_brushed_stainless_slim_vertical_rods", handrail:"walnut", newel:"white_base_walnut_cap", accents:["alternating_walnut_stainless_rhythm"], style:"modern_traditional_walnut_stainless_hybrid", notable:"HYBRID dark walnut square spindles ALTERNATING with brushed stainless slim vertical rods + walnut handrail + white base + walnut cap newel" },
  { i:39, subject_variant:"dense_turned_pine_bulb_urn_white_cap", railing_family:"timber_turned", infill:"dense_classical_turned_pine_spindles_bulb_urn", handrail:"pine", newel:"pine_chunky_white_flat_cap", accents:["dense_spindle_spacing","white_flat_cap"], style:"traditional_cottage_dense_two_tone", notable:"DENSE close-set turned pine spindles bulb+urn + pine handrail + pine newel with WHITE flat cap" },
  { i:40, subject_variant:"chunky_stainless_rods_white_caps_pine_frame", railing_family:"stainless_vertical_rod", infill:"chunky_brushed_stainless_steel_vertical_rods_with_white_end_caps", handrail:"pine", newel:"pine_square_white_flat_cap", accents:["white_end_caps_on_rods","white_flat_cap_on_newel"], style:"contemporary_industrial_white_accent", notable:"CHUNKY brushed stainless rods with WHITE END CAPS + pine handrail + pine newel with white flat cap" },
  { i:41, subject_variant:"dense_turned_oak_white_cap", railing_family:"timber_turned", infill:"dense_classical_turned_oak_spindles", handrail:"oak", newel:"chunky_oak_white_flat_top_cap", accents:["dense_spindle_spacing","white_flat_top_cap"], style:"traditional_english_oak_dense_two_tone", notable:"DENSE close-set classical turned OAK spindles + oak handrail + chunky oak newel with WHITE flat top cap" },
  { i:42, subject_variant:"dense_turned_oak_heavy_traditional", railing_family:"timber_turned", infill:"dense_classical_turned_oak_spindles", handrail:"oak", newel:"chunky_oak_heavy_proportion", accents:["heavy_traditional_proportions"], style:"traditional_english_oak_heavy", notable:"DENSE classical turned oak spindles + CHUNKY OAK newels (very traditional heavy proportions)" },
  { i:43, subject_variant:"dense_turned_pine_ball_finial_newel", railing_family:"timber_turned", infill:"dense_classical_turned_pine_spindles", handrail:"pine", newel:"pine_ball_finial_spherical_top", accents:["ball_finial_spherical_top"], style:"traditional_classical_ball_finial", notable:"DENSE classical turned pine spindles + BALL-TOP NEWEL (spherical ball finial · signature classical detail)" },
];

const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
const urlByIdx = new Map();
for (const it of mapping.items) urlByIdx.set(it.idx, it.url);

const mani = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

if (!DRY) {
  const backupDir = join(process.cwd(), "data", ".manifest-backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `manifest-pre-batch8-ingest-${ts}.json`);
  copyFileSync(MANIFEST_PATH, backupPath);
  console.log(`Backup: ${backupPath}`);
}

const NOW = new Date().toISOString();
const RUN_STAMP = "batch8-2026-08-14";
let added = 0, skipped = 0;

console.log("");
console.log(`Batch 8 · processing ${BATCH.length} landing-railing images ${DRY ? "· DRY RUN" : "· LIVE APPLY"}`);
console.log("─".repeat(60));

for (const spec of BATCH) {
  const url = urlByIdx.get(spec.i);
  if (!url) { console.log(`  [${spec.i}] SKIP no url in mapping`); continue; }
  if (mani.images[url]) { console.log(`  [${spec.i}] SKIP already in manifest`); skipped++; continue; }

  const tags = [
    "staircase", "reference", "landing-railing", "hero-scene",
    "batch-8-2026-08-14", "philip-supplied", "staircase_brain", "domain:STAIRCASE",
    "subject:landing_railing", "teaching-series:same-setting-different-railings",
    `variant:${spec.subject_variant}`,
    `railing-family:${spec.railing_family}`,
    `infill:${spec.infill}`,
    `handrail:${spec.handrail}`,
    `newel:${spec.newel}`,
    ...spec.accents.map((a) => `accent:${a}`),
    `style:${spec.style}`,
  ];

  const description = [
    `STAIRCASE REFERENCE · Batch 8 · LANDING RAILING · img-${String(spec.i).padStart(2, "0")}`,
    "",
    `VARIANT · ${spec.subject_variant.replace(/_/g, " ")}`,
    `RAILING FAMILY · ${spec.railing_family.replace(/_/g, " ")}`,
    `INFILL · ${spec.infill.replace(/_/g, " ")}`,
    `HANDRAIL · ${spec.handrail.replace(/_/g, " ")}`,
    `NEWEL · ${spec.newel.replace(/_/g, " ")}`,
    `ACCENTS · ${spec.accents.map((a) => a.replace(/_/g, " ")).join(", ") || "(none)"}`,
    `STYLE · ${spec.style.replace(/_/g, " ")}`,
    "",
    `NOTABLE · ${spec.notable}`,
    "",
    `CONTINUITY PRINCIPLE · The landing railing normally uses the SAME railing system as the staircase — handrail profile, spindle profile, newel design, material and finish. The top staircase newel post is the anchor that carries the handrail onto the landing. Half newels against the wall; full newels at corners/direction changes/free-standing ends.`,
    "",
    `PROVENANCE · Supplied by Philip 2026-08-14 (ImageKit). Every observation from direct multimodal read of the pixels · never inferred beyond what is visible.`,
    `TEACHING CONTEXT · This batch is a controlled series — every image shares an identical landing well setting, so all differences are attributable to the railing itself.`,
    `COMPANION DOCUMENTS · staircase-reference-gallery-batch-8-landing-railings-2026-08-14.md · landing-railings-knowledge-2026-08-14.md`,
  ].join("\n");

  const material_composition = [
    spec.handrail,
    spec.newel,
    spec.infill,
    ...spec.accents,
  ];

  mani.images[url] = {
    source: "philip_supplied", original_prompt: null, description, master_ai_prompt: null,
    created_at: NOW, created_by: "batch-8-ingest",
    notes: `Batch 8 · img-${String(spec.i).padStart(2, "0")} · landing railing · ${spec.notable}`,
    tags, a_plus: true,
    subject_domain: "staircase", primary_domain: "STAIRCASE", primary_brain: "staircase_brain",
    image_type: "reference",
    image_purpose: { primary: "brain_evidence", secondary: "matcher_source", tertiary: "advisor_reference" },
    subject: "landing_railing",
    collection_id: "staircase_landing_railings_batch_8",
    collection_memberships: ["staircase_references", "landing_railings", "batch_8_2026_08_14"],
    material_composition,
    can_become: ["directory_card_hero", "brain_chat_evidence", "advisor_illustration"],
    family_tree: { children: [] },
    geometry_preservation: {
      preserve_by_default: true,
      allowed_modifications: ["material", "colour", "lighting"],
      never_change_without_explicit_request: ["geometry", "proportions", "composition", "perspective", "architectural-details"],
    },
    learning_signals: [],
    knowledge_band: "reference", knowledge_band_label: "Reference Knowledge",
    human_tagged_by: "philip-supplied", human_tagged_at: NOW, marked_by: "batch-8-ingest",
    not_a_staircase: false,
    _ingest_batch: RUN_STAMP,
    _enrichment: { domain_classified_at: NOW, domain_classified_reason: "batch8_direct_observation", record_state_expected: "routable" },
  };

  added++;
  console.log(`  [${String(spec.i).padStart(2, "0")}] ADD · ${spec.subject_variant.slice(0, 45)}`);
}

console.log("─".repeat(60));
console.log(`Added: ${added} · Skipped: ${skipped}`);

if (!DRY && added > 0) {
  mani.generated_at = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(mani, null, 2), "utf8");
  console.log(`Manifest written`);
} else if (DRY) {
  console.log("DRY RUN · re-run with --apply");
}
