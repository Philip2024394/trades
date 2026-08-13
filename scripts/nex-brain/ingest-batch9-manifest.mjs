// Batch 9 · 52 images · timbers + newel caps + handrail components + starting steps + doors (off-domain).
// Every image classified per direct multimodal read; doors 30-36 marked DOORS_WINDOWS + not_a_staircase per Image Domain Rule.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const DRY = !process.argv.includes("--apply");
const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const MAPPING_PATH  = join(process.cwd(), "data", "incoming-image-ingest", "batch9-2026-08-14", "_mapping.json");

const BATCH = [
  // Section A · Timber species (5)
  { i: 1, section:"timber_species", subject:"staircase_joinery_timber_sample", variant:"cherry_mahogany", detail:"cherry / mahogany · rich red-brown timber · newel + handrail + string + tread stock", tags:["material:cherry_mahogany","cost_tier:high","style:formal_traditional"], primary_domain:"STAIRCASE" },
  { i: 2, section:"timber_species", subject:"staircase_joinery_timber_sample", variant:"maple", detail:"maple · very pale creamy uniform fine grain · newel + handrail + string + tread stock", tags:["material:maple","cost_tier:medium_high","style:scandinavian_modern"], primary_domain:"STAIRCASE" },
  { i: 3, section:"timber_species", subject:"staircase_joinery_timber_sample", variant:"beech_ash", detail:"beech / ash · warm cream with tighter visible grain · newel + handrail + string + tread stock", tags:["material:beech_ash","cost_tier:medium","style:modern_classical_crossover"], primary_domain:"STAIRCASE" },
  { i: 4, section:"timber_species", subject:"staircase_joinery_timber_sample", variant:"pine_redwood", detail:"pine / redwood · pale yellow-cream with grain and small knots · newel + handrail + string + tread stock", tags:["material:pine","cost_tier:low","style:cottage_farmhouse_paint_grade"], primary_domain:"STAIRCASE" },
  { i: 5, section:"timber_species", subject:"staircase_joinery_timber_sample", variant:"oak", detail:"oak · light golden brown with medullary rays and figure · newel + handrail + string + tread stock", tags:["material:oak","cost_tier:medium_high","style:english_traditional_modern_british"], primary_domain:"STAIRCASE" },

  // Section B · Newel caps (5 in this cluster, 1 at img-17)
  { i: 6, section:"newel_cap", subject:"newel_cap_isolated", variant:"oak_flat_cap_moulded_domed_pyramidal", detail:"oak flat cap · moulded base collar + gently domed pyramidal timber top · versatile classical-modern crossover", tags:["material:oak","cap_family:flat_moulded","style:classical_modern_crossover"], primary_domain:"STAIRCASE" },
  { i: 7, section:"newel_cap", subject:"newel_cap_isolated", variant:"polished_chrome_ball_finial", detail:"polished chrome ball finial cap · turned metal base + polished spherical ball · classical-contemporary hybrid", tags:["material:polished_chrome","cap_family:ball_finial","style:classical_contemporary_hybrid"], primary_domain:"STAIRCASE" },
  { i: 8, section:"newel_cap", subject:"newel_cap_isolated", variant:"polished_chrome_mirror_flat_cap", detail:"polished chrome mirror-finish flat cap · gently domed square · modern luxury", tags:["material:polished_chrome_mirror","cap_family:flat_domed","style:modern_luxury"], primary_domain:"STAIRCASE" },
  { i: 9, section:"newel_cap", subject:"newel_cap_isolated", variant:"brushed_stainless_flat_cap", detail:"brushed stainless flat cap · matt gently domed square · contemporary architectural", tags:["material:brushed_stainless","cap_family:flat_domed","style:contemporary_architectural"], primary_domain:"STAIRCASE" },
  { i:10, section:"newel_cap", subject:"newel_cap_isolated", variant:"matt_black_flat_cap", detail:"matt black powder-coated flat cap · gently domed square · industrial bi-colour", tags:["material:matt_black_powder_coated","cap_family:flat_domed","style:industrial_bicolour"], primary_domain:"STAIRCASE" },

  // Section C · Handrail components (5)
  { i:11, section:"handrail_component", subject:"volute_handrail_termination_scene", variant:"dark_mahogany_volute_over_white_turned_newel", detail:"full scene · dark mahogany volute handrail curving down onto white turned newel · white spindles · cream carpet runner · cut-string scroll bracket profile visible on string", tags:["material:dark_mahogany_handrail_white_newel","component:volute","component:turned_newel","scene:hero","cut_string_brackets:visible"], primary_domain:"STAIRCASE" },
  { i:12, section:"handrail_component", subject:"volute_isolated", variant:"pine_volute_scroll", detail:"isolated pine volute · the curled scroll fitting that terminates a handrail at the bottom newel of a bullnose starting step", tags:["material:pine","component:volute","style:classical_traditional_termination"], primary_domain:"STAIRCASE" },
  { i:13, section:"handrail_component", subject:"handrail_moulded_profile_cross_section", variant:"pine_traditional_moulded_profile", detail:"pine handrail cross-section showing rounded top handhold + side finger grooves + underside spindle groove · standard traditional profile for square-top balusters", tags:["material:pine","component:handrail","profile:traditional_moulded_with_spindle_groove"], primary_domain:"STAIRCASE" },
  { i:14, section:"handrail_component", subject:"turned_newel_post_isolated", variant:"pine_turned_newel_chunky_base_column_finial", detail:"turned pine newel post · chunky square base + turned column + turned finial cap · classical newel design", tags:["material:pine","component:turned_newel_post","style:classical"], primary_domain:"STAIRCASE" },
  { i:15, section:"handrail_component", subject:"swan_neck_gooseneck_fitting_isolated", variant:"pine_s_curve_transition", detail:"pine swan-neck / gooseneck handrail fitting · S-curved transition piece used at half-landings and elevation changes to preserve continuous handrail line", tags:["material:pine","component:swan_neck_gooseneck","use:elevation_transition"], primary_domain:"STAIRCASE" },

  // Section D · Bullnose starting-step components (img-16, 19-26 = 9 images)
  { i:16, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"white_painted", detail:"white painted bullnose starting-step tread · rounded front + open-side end + white painted riser support behind · wall-fixed variant (rounded on free side only)", tags:["material:white_painted","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },

  // Section C-continued · white painted pyramidal newel cap (img-17)
  { i:17, section:"newel_cap", subject:"newel_cap_isolated", variant:"white_painted_pyramidal_moulded_cap", detail:"white painted pyramidal cap · moulded profile with pyramidal apex + moulded base collar · classical formal painted joinery", tags:["material:white_painted","cap_family:pyramidal_moulded","style:classical_formal_painted"], primary_domain:"STAIRCASE" },

  // Wall-mounted handrail kit (img-18)
  { i:18, section:"handrail_component", subject:"wall_mounted_handrail_kit", variant:"oak_dowel_polished_stainless_brackets", detail:"wall-mounted handrail kit · 3 oak dowel handrail sections + polished stainless brackets + end caps + fixings · for wall-side of wall-fixed staircases and compliance handrails", tags:["material:oak_dowel_polished_stainless","kit:wall_mounted_handrail","brackets:polished_stainless"], primary_domain:"STAIRCASE" },

  // More bullnose starting-step treads (img-19 to 26)
  { i:19, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"natural_light_oak", detail:"natural light oak bullnose starting-step tread · rounded front + open-side end + white painted riser support behind", tags:["material:natural_light_oak","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },
  { i:20, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"pale_maple_beech", detail:"pale maple / beech bullnose starting-step tread · very light cream + rounded front + open-side end", tags:["material:pale_maple_beech","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },
  { i:21, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"warm_cherry", detail:"warm cherry bullnose starting-step tread · mid red-brown natural · rounded front + open-side end", tags:["material:warm_cherry","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },
  { i:22, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"red_mahogany", detail:"red mahogany bullnose starting-step tread · rich reddish-brown · rounded front + open-side end", tags:["material:red_mahogany","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },
  { i:23, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"rustic_dark_oak", detail:"rustic dark oak bullnose starting-step tread · variegated grain · knot-visible", tags:["material:rustic_dark_oak","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },
  { i:24, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"pale_unfinished_beech_like", detail:"pale unfinished beech-like bullnose starting-step tread · very pale golden", tags:["material:pale_unfinished_beech","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },
  { i:25, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"natural_light_oak_variant", detail:"natural light oak bullnose starting-step tread (variant) · rounded front + open-side end", tags:["material:natural_light_oak","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },
  { i:26, section:"starting_step_component", subject:"bullnose_starting_step_tread_isolated", variant:"dark_stained_walnut", detail:"dark stained walnut bullnose starting-step tread · dark chocolate brown · rounded front + open-side end", tags:["material:dark_stained_walnut","profile:bullnose_open_side_end","construction_context:wall_fixed"], primary_domain:"STAIRCASE" },

  // Section E · Assembly components (27, 28, 29)
  { i:27, section:"assembly_component", subject:"pyramidal_timber_wedges_glue_blocks", variant:"pine_triangular_wedges_pair", detail:"pyramidal pine timber wedges · glue blocks for reinforcing tread-riser corners internally · not visible on finished staircase · distinguishes wedged bespoke construction from nail-only assembly", tags:["material:pine","component:glue_block_wedges","construction:traditional_wedged"], primary_domain:"STAIRCASE" },
  { i:28, section:"assembly_component", subject:"base_rail_with_baluster_groove", variant:"oak_moulded_base_rail_and_fillet_strip", detail:"oak base rail with baluster groove profile + fillet strip · matched pair for the balustrade base", tags:["material:oak","component:base_rail_moulded","component:fillet_strip"], primary_domain:"STAIRCASE" },
  { i:29, section:"assembly_component", subject:"base_rail_with_baluster_groove", variant:"oak_flat_base_rail_and_fillet_strip", detail:"oak base rail flat profile with baluster groove + fillet strip · matched pair (variant with simpler profile)", tags:["material:oak","component:base_rail_flat","component:fillet_strip"], primary_domain:"STAIRCASE" },

  // Section F · Cottage V-groove ledged doors — OFF-DOMAIN (DOORS_WINDOWS)
  { i:30, section:"door_off_domain", subject:"cottage_v_groove_ledged_door", variant:"light_oak_v1", detail:"cottage / farmhouse V-groove ledged door · 5 vertical V-groove panels within frame border · light oak variant 1", tags:["material:light_oak","door_style:cottage_v_groove_ledged","panels:5_vertical_v_groove","primary_domain:DOORS_WINDOWS","not_a_staircase:true","for_future_brain:DOORS"], primary_domain:"DOORS_WINDOWS", not_a_staircase: true },
  { i:31, section:"door_off_domain", subject:"cottage_v_groove_ledged_door", variant:"light_oak_v2", detail:"cottage V-groove ledged door · light oak variant 2 (different tone)", tags:["material:light_oak","door_style:cottage_v_groove_ledged","primary_domain:DOORS_WINDOWS","not_a_staircase:true","for_future_brain:DOORS"], primary_domain:"DOORS_WINDOWS", not_a_staircase: true },
  { i:32, section:"door_off_domain", subject:"cottage_v_groove_ledged_door", variant:"knotty_pine", detail:"cottage V-groove ledged door · knotty pine natural (visible knots)", tags:["material:knotty_pine","door_style:cottage_v_groove_ledged","primary_domain:DOORS_WINDOWS","not_a_staircase:true","for_future_brain:DOORS"], primary_domain:"DOORS_WINDOWS", not_a_staircase: true },
  { i:33, section:"door_off_domain", subject:"cottage_v_groove_ledged_door", variant:"dark_red_mahogany_stained", detail:"cottage V-groove ledged door · dark red mahogany stained", tags:["material:dark_red_mahogany_stained","door_style:cottage_v_groove_ledged","primary_domain:DOORS_WINDOWS","not_a_staircase:true","for_future_brain:DOORS"], primary_domain:"DOORS_WINDOWS", not_a_staircase: true },
  { i:34, section:"door_off_domain", subject:"cottage_v_groove_ledged_door", variant:"dark_walnut_stained", detail:"cottage V-groove ledged door · dark walnut / brown stained", tags:["material:dark_walnut_stained","door_style:cottage_v_groove_ledged","primary_domain:DOORS_WINDOWS","not_a_staircase:true","for_future_brain:DOORS"], primary_domain:"DOORS_WINDOWS", not_a_staircase: true },
  { i:35, section:"door_off_domain", subject:"cottage_v_groove_ledged_door", variant:"medium_warm_oak_stained", detail:"cottage V-groove ledged door · medium warm oak stained (mid red-brown)", tags:["material:medium_warm_oak_stained","door_style:cottage_v_groove_ledged","primary_domain:DOORS_WINDOWS","not_a_staircase:true","for_future_brain:DOORS"], primary_domain:"DOORS_WINDOWS", not_a_staircase: true },
  { i:36, section:"door_off_domain", subject:"cottage_v_groove_ledged_door", variant:"natural_light_oak_pale", detail:"cottage V-groove ledged door · natural light oak (paler variant)", tags:["material:natural_light_oak_pale","door_style:cottage_v_groove_ledged","primary_domain:DOORS_WINDOWS","not_a_staircase:true","for_future_brain:DOORS"], primary_domain:"DOORS_WINDOWS", not_a_staircase: true },

  // Section G · Full-staircase starting-step teaching series (img-37 to img-52 · 16 images)
  { i:37, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wide_oval_d_shape_bullnose_with_LED_two_sided", detail:"wide oval / D-shape bullnose starting step + LED-inset step lights in riser + LED cove wash beneath bullnose · two-sided cut-string · cut-string scroll bracket detail both sides · natural oak throughout", tags:["profile:wide_oval_d_shape_bullnose","lighting:LED_step_lights_and_cove_wash","construction_context:two_sided_cut_string","cut_string_brackets:both_sides","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:38, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"two_square_platform_starting_steps_stacked", detail:"two square platform starting steps stacked · no bullnose · flat rectangular platforms · two-sided cut-string · contemporary minimalist grand entry", tags:["profile:square_platform_stacked_double","construction_context:two_sided_cut_string","style:contemporary_minimalist","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:39, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"single_square_platform_starting_step", detail:"single square platform starting step · one flat rectangular platform · no bullnose · two-sided cut-string · minimalist", tags:["profile:square_platform_single","construction_context:two_sided_cut_string","style:contemporary_minimalist","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:40, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"two_square_platform_starting_steps_variant", detail:"two square platform starting steps stacked (variant of img-38 · different proportions)", tags:["profile:square_platform_stacked_double","construction_context:two_sided_cut_string","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:41, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"two_d_shape_oval_bullnose_stacked", detail:"two D-shape / oval bullnose starting steps stacked · traditional grand entrance · both bullnoses share profile · second set back one tread", tags:["profile:d_shape_oval_bullnose_stacked_double","construction_context:two_sided_cut_string","style:traditional_grand_entrance","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:42, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"two_d_shape_oval_bullnose_stacked_variant", detail:"two D-shape / oval bullnose starting steps stacked (variant of img-41 · different lighting)", tags:["profile:d_shape_oval_bullnose_stacked_double","construction_context:two_sided_cut_string","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:43, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"single_d_shape_oval_bullnose", detail:"single D-shape / oval bullnose starting step · one D-shape · two-sided cut-string", tags:["profile:d_shape_oval_bullnose_single","construction_context:two_sided_cut_string","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:44, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"single_half_round_bullnose", detail:"single half-round bullnose starting step · distinct semi-circular bump at the base · two-sided cut-string", tags:["profile:half_round_bullnose_single","construction_context:two_sided_cut_string","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:45, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"combined_square_platform_plus_d_shape_bullnose_above", detail:"combined starting step · square platform at bottom + D-shape bullnose above · combines platform width with bullnose softness", tags:["profile:combined_square_platform_plus_bullnose","construction_context:two_sided_cut_string","style:grand_hybrid","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:46, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wall_fixed_rounded_bullnose_free_side_only_full_scene_a", detail:"WALL-FIXED staircase · rounded bullnose starting step on free side only · wall on left · black metal spindles on right · turned oak newel with layered flat cap · LOCKED-rule evidence for wall-fixed = rounded on one side only", tags:["profile:bullnose_rounded_free_side_only","construction_context:wall_fixed","balustrade:matt_black_metal_spindles","locked_rule_evidence:wall_fixed_one_side","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:47, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wall_fixed_single_square_starting_step", detail:"WALL-FIXED staircase · single square starting step (no bullnose, square platform variant)", tags:["profile:square_platform_single","construction_context:wall_fixed","balustrade:matt_black_metal_spindles","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:48, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wall_fixed_square_starting_step_variant", detail:"WALL-FIXED staircase · single square starting step (variant of img-47 with slightly different proportions)", tags:["profile:square_platform_single","construction_context:wall_fixed","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:49, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wall_fixed_no_projecting_starting_step_flush", detail:"WALL-FIXED staircase · NO projecting starting step · first tread flush at floor · valid design choice · LOCKED-rule evidence: no projecting starting step is valid", tags:["profile:none_flush_first_tread","construction_context:wall_fixed","locked_rule_evidence:no_projection_valid","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:50, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wall_fixed_rounded_bullnose_wraps_free_newel", detail:"WALL-FIXED staircase · rounded bullnose starting step wraps around free-side newel only (strong wrap) · LOCKED-rule evidence", tags:["profile:bullnose_rounded_free_side_only_strong_wrap","construction_context:wall_fixed","locked_rule_evidence:wall_fixed_one_side","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:51, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wall_fixed_small_rounded_bullnose", detail:"WALL-FIXED staircase · small rounded bullnose starting step (subtle variant of img-50)", tags:["profile:bullnose_rounded_free_side_only_subtle","construction_context:wall_fixed","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
  { i:52, section:"starting_step_scene", subject:"starting_step_teaching_scene", variant:"wall_fixed_wide_oval_d_shape_wraps_free_newel", detail:"WALL-FIXED staircase · wide oval / D-shape bullnose wrapping generously around free-side newel · widest bullnose in the wall-fixed variants of this batch", tags:["profile:wide_oval_d_shape_bullnose_free_side_only","construction_context:wall_fixed","locked_rule_evidence:wall_fixed_one_side","teaching_series:starting_steps"], primary_domain:"STAIRCASE" },
];

const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
const urlByIdx = new Map();
for (const it of mapping.items) urlByIdx.set(it.idx, it.url);

const mani = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

if (!DRY) {
  const backupDir = join(process.cwd(), "data", ".manifest-backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `manifest-pre-batch9-ingest-${ts}.json`);
  copyFileSync(MANIFEST_PATH, backupPath);
  console.log(`Backup: ${backupPath}`);
}

const NOW = new Date().toISOString();
const RUN_STAMP = "batch9-2026-08-14";
let added = 0, skipped = 0, stairs = 0, doors = 0;

console.log("");
console.log(`Batch 9 · processing ${BATCH.length} images ${DRY ? "· DRY RUN" : "· LIVE APPLY"}`);
console.log("─".repeat(60));

for (const spec of BATCH) {
  const url = urlByIdx.get(spec.i);
  if (!url) { console.log(`  [${spec.i}] SKIP no url in mapping`); continue; }
  if (mani.images[url]) { console.log(`  [${spec.i}] SKIP already in manifest`); skipped++; continue; }

  const isDoor = spec.primary_domain === "DOORS_WINDOWS";
  const brain = isDoor ? null : "staircase_brain";

  const tags = [
    isDoor ? "door" : "staircase",
    "reference", "batch-9-2026-08-14", "philip-supplied",
    `domain:${spec.primary_domain}`,
    `section:${spec.section}`,
    `subject:${spec.subject}`,
    `variant:${spec.variant}`,
    ...(spec.tags || []),
  ];
  if (brain) tags.push(brain);

  const description = [
    `${isDoor ? "DOOR" : "STAIRCASE"} REFERENCE · Batch 9 · img-${String(spec.i).padStart(2, "0")}`,
    "",
    `SECTION · ${spec.section.replace(/_/g, " ")}`,
    `SUBJECT · ${spec.subject.replace(/_/g, " ")}`,
    `VARIANT · ${spec.variant.replace(/_/g, " ")}`,
    "",
    `DETAIL · ${spec.detail}`,
    "",
    isDoor
      ? `DOMAIN NOTE · This image is DOORS_WINDOWS domain. Not surfaced by the Staircase Brain filter (not_a_staircase: true). Preserved in the shared NEX Image Brain for a future Doors Brain per the NEX Image Domain Rule (2026-08-14). NEVER deleted or downgraded.`
      : `DOMAIN NOTE · STAIRCASE domain. Surfaced by the Staircase Brain filter.`,
    "",
    `PROVENANCE · Supplied by Philip 2026-08-14 (ImageKit). Every observation from direct multimodal read of the pixels · never inferred beyond what is visible.`,
    `COMPANION DOCUMENTS · staircase-reference-gallery-batch-9-2026-08-14.md` + (isDoor ? " (this image listed under Section F · DOORS_WINDOWS)" : ""),
    !isDoor && spec.section === "starting_step_scene" ? `LOCKED RULE (Philip 2026-08-14) · Two-sided cut-string staircases normally have a rounded starting step on both sides · Wall-fixed staircases normally have a rounded starting step on the free side only. See starting-steps-knowledge-2026-08-14.md §1.` : null,
  ].filter(Boolean).join("\n");

  mani.images[url] = {
    source: "philip_supplied", original_prompt: null, description, master_ai_prompt: null,
    created_at: NOW, created_by: "batch-9-ingest",
    notes: `Batch 9 · img-${String(spec.i).padStart(2, "0")} · ${spec.section} · ${spec.variant}`,
    tags, a_plus: true,
    subject_domain: isDoor ? "door" : "staircase",
    primary_domain: spec.primary_domain,
    primary_brain: brain,
    image_type: "reference",
    image_purpose: { primary: "brain_evidence", secondary: "matcher_source", tertiary: "advisor_reference" },
    subject: spec.subject,
    collection_id: `batch_9_${spec.section}`,
    collection_memberships: [
      isDoor ? "door_references" : "staircase_references",
      `batch_9_${spec.section}`,
      "batch_9_2026_08_14",
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
    human_tagged_by: "philip-supplied", human_tagged_at: NOW, marked_by: "batch-9-ingest",
    not_a_staircase: !!spec.not_a_staircase,
    _ingest_batch: RUN_STAMP,
    _enrichment: { domain_classified_at: NOW, domain_classified_reason: "batch9_direct_observation", record_state_expected: "routable" },
  };

  added++;
  if (isDoor) doors++; else stairs++;
  console.log(`  [${String(spec.i).padStart(2, "0")}] ADD · ${spec.section}/${spec.variant.slice(0, 40)}`);
}

console.log("─".repeat(60));
console.log(`Added: ${added} · Skipped: ${skipped} · Staircase: ${stairs} · Doors (off-domain preserved): ${doors}`);

if (!DRY && added > 0) {
  mani.generated_at = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(mani, null, 2), "utf8");
  console.log(`Manifest written`);
} else if (DRY) {
  console.log("DRY RUN · re-run with --apply");
}
