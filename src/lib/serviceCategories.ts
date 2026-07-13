// Service category taxonomy for the "Independent local trades" strip
// on product PDPs. Kept in code (not the DB) so the list can grow
// without a migration and merchant + shopper UIs can share a single
// source of truth.
//
// Slugs are stable identifiers stored on rows:
//   • `service_category` on service-kind product rows (the trade
//     tags what install they offer)
//   • `install_service_category` on physical product rows (the
//     merchant tags which install the item pairs with)
//
// The PDP joins the two: product's `install_service_category` →
// find nearest live services whose `service_category` matches.

export type ServiceCategory = {
  slug: string;
  label: string;
  // Rough "who does this" tag so we can filter the picker per-trade
  // later (a plumber only sees plumbing categories, etc.). Not
  // enforced anywhere today.
  hint: "carpentry" | "plumbing" | "electrical" | "flooring" | "roofing" | "misc";
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  // Carpentry / interior fit
  { slug: "door_install", label: "Door hanging & install", hint: "carpentry" },
  { slug: "door_lock_install", label: "Door lock install", hint: "carpentry" },
  { slug: "skirting_install", label: "Skirting fit", hint: "carpentry" },
  { slug: "loft_hatch_install", label: "Loft hatch install", hint: "carpentry" },
  { slug: "shelving_install", label: "Shelving fit", hint: "carpentry" },
  { slug: "kitchen_worktop_fit", label: "Kitchen worktop fit", hint: "carpentry" },

  // Plumbing
  { slug: "tap_fitting", label: "Tap & mixer fitting", hint: "plumbing" },
  { slug: "shower_install", label: "Shower install", hint: "plumbing" },
  { slug: "toilet_install", label: "Toilet install", hint: "plumbing" },
  { slug: "boiler_service", label: "Boiler service", hint: "plumbing" },
  { slug: "radiator_swap", label: "Radiator swap", hint: "plumbing" },

  // Electrical
  { slug: "pat_testing", label: "PAT testing", hint: "electrical" },
  { slug: "socket_install", label: "Socket install", hint: "electrical" },
  { slug: "light_fitting_install", label: "Light fitting install", hint: "electrical" },
  { slug: "consumer_unit_swap", label: "Consumer unit swap", hint: "electrical" },

  // Flooring
  { slug: "laminate_fit", label: "Laminate flooring fit", hint: "flooring" },
  { slug: "carpet_fit", label: "Carpet fit", hint: "flooring" },
  { slug: "tile_fit", label: "Tile fit", hint: "flooring" },

  // Roofing / exterior
  { slug: "gutter_clean", label: "Gutter clean", hint: "roofing" },
  { slug: "small_roof_repair", label: "Small roof repair", hint: "roofing" },
  { slug: "window_install", label: "Window fit", hint: "roofing" },

  // Misc
  { slug: "key_cutting", label: "Key cutting", hint: "misc" },
  { slug: "skip_delivery", label: "Skip delivery", hint: "misc" },
  { slug: "waste_removal", label: "Waste removal", hint: "misc" },

  // Painting & Decorating
  { slug: "interior_paint", label: "Interior painting", hint: "misc" },
  { slug: "exterior_paint", label: "Exterior painting", hint: "misc" },
  { slug: "wallpapering", label: "Wallpaper hanging", hint: "misc" },

  // Tiling (walls) & regrout
  { slug: "tile_grout_refresh", label: "Tile regrout & refresh", hint: "flooring" },
  { slug: "wall_tile_fit", label: "Wall tiling", hint: "flooring" },

  // Plastering & drywall
  { slug: "wall_plaster_patch", label: "Plaster patch repair", hint: "misc" },
  { slug: "wall_plaster_skim", label: "Wall skim plastering", hint: "misc" },
  { slug: "ceiling_plaster", label: "Ceiling plastering", hint: "misc" },
  { slug: "drywall_hang", label: "Drywall / plasterboard hanging", hint: "misc" },
  { slug: "stud_wall_build", label: "Stud partition wall build", hint: "misc" },
  { slug: "drywall_tape_finish", label: "Drywall tape & joint finish", hint: "misc" },

  // Masonry / brick & block
  { slug: "brick_repoint", label: "Brick repointing", hint: "misc" },
  { slug: "chimney_repoint", label: "Chimney repointing", hint: "misc" },
  { slug: "garden_wall_build", label: "Garden wall build", hint: "misc" },
  { slug: "brick_pier_build", label: "Brick pier / gate pillar build", hint: "misc" },
  { slug: "brick_wall_repair", label: "Brick wall repair (patch / rebuild)", hint: "misc" },
  { slug: "block_wall_build", label: "Concrete block wall build", hint: "misc" },
  { slug: "breeze_block_wall", label: "Breeze block wall build", hint: "misc" },
  { slug: "cavity_block_build", label: "Cavity block work", hint: "misc" },
  { slug: "block_partition_build", label: "Internal block partition build", hint: "misc" },

  // Groundworks & drainage
  { slug: "foundation_dig", label: "Foundation / strip footing dig", hint: "misc" },
  { slug: "driveway_prep", label: "Driveway sub-base preparation", hint: "misc" },
  { slug: "patio_base", label: "Patio base / hardcore preparation", hint: "misc" },
  { slug: "drainage_gully_install", label: "Drainage gully / channel drain install", hint: "misc" },
  { slug: "soakaway_install", label: "Soakaway install (small domestic)", hint: "misc" },

  // Concrete
  { slug: "concrete_slab_lay", label: "Concrete slab / shed base lay", hint: "misc" },
  { slug: "concrete_post", label: "Concrete fence post set", hint: "misc" },
  { slug: "concrete_footing_pour", label: "Concrete footing / strip pour", hint: "misc" },
  { slug: "concrete_driveway_pour", label: "Concrete driveway pour", hint: "misc" },
  { slug: "screed_lay", label: "Floor screed lay", hint: "misc" },
  { slug: "power_float_finish", label: "Power float slab finish", hint: "misc" },
  { slug: "concrete_polish", label: "Concrete floor polish (existing slab)", hint: "misc" },
  { slug: "concrete_seal", label: "Concrete driveway / slab seal", hint: "misc" },
  { slug: "concrete_repair_patch", label: "Concrete crack / patch repair", hint: "misc" },

  // Roofline (fascia / soffit / gutter / downpipe)
  { slug: "fascia_replace", label: "Fascia replacement", hint: "roofing" },
  { slug: "soffit_replace", label: "Soffit replacement", hint: "roofing" },
  { slug: "roofline_full_replace", label: "Full roofline replacement", hint: "roofing" },
  { slug: "gutter_install", label: "Gutter install / replace", hint: "roofing" },
  { slug: "gutter_repair", label: "Gutter joint repair", hint: "roofing" },
  { slug: "downpipe_install", label: "Downpipe install / replace", hint: "roofing" },

  // Leadwork
  { slug: "lead_flashing_repair", label: "Lead flashing repair", hint: "roofing" },
  { slug: "lead_chimney_flashing", label: "Chimney lead flashing", hint: "roofing" },
  { slug: "lead_bay_roof", label: "Lead bay window roof", hint: "roofing" },
  { slug: "lead_valley_repair", label: "Lead valley repair", hint: "roofing" },
  { slug: "lead_step_flashing", label: "Lead step flashing", hint: "roofing" },

  // Chimney (sweep / stove)
  { slug: "chimney_sweep", label: "Chimney sweep", hint: "misc" },
  { slug: "chimney_cctv", label: "Chimney CCTV inspection", hint: "misc" },
  { slug: "chimney_cowl_fit", label: "Chimney cowl / bird guard fit", hint: "misc" },
  { slug: "stove_service", label: "Woodburner / stove sweep", hint: "misc" },
  { slug: "chimney_smoke_test", label: "Chimney smoke test", hint: "misc" },

  // Landscape / garden
  { slug: "turf_lay", label: "Turf laying", hint: "misc" },
  { slug: "patio_lay", label: "Patio laying", hint: "misc" },
  { slug: "lawn_care", label: "Lawn care / maintenance", hint: "misc" },
  { slug: "planting_design", label: "Border planting", hint: "misc" },
  { slug: "hedge_trim", label: "Hedge trimming", hint: "misc" },

  // Solar PV & battery
  { slug: "solar_pv_install", label: "Solar PV install", hint: "electrical" },
  { slug: "battery_install", label: "Solar battery install", hint: "electrical" },
  { slug: "solar_survey", label: "Solar survey", hint: "electrical" },
  { slug: "solar_service", label: "Solar service & repair", hint: "electrical" },

  // EV charging
  { slug: "ev_charger_install", label: "EV charger install", hint: "electrical" },
  { slug: "ev_charger_survey", label: "EV charger survey", hint: "electrical" },
  { slug: "ev_charger_upgrade", label: "EV charger cable / CU upgrade", hint: "electrical" },

  // Heat pumps
  { slug: "heat_pump_install", label: "Air source heat pump install", hint: "plumbing" },
  { slug: "heat_pump_service", label: "Heat pump service", hint: "plumbing" },
  { slug: "heat_pump_survey", label: "Heat pump feasibility survey", hint: "plumbing" },
  { slug: "hybrid_heat_pump_install", label: "Hybrid heat pump install", hint: "plumbing" },

  // Doors (external / bi-fold / composite / frame)
  { slug: "external_door_install", label: "External door install", hint: "carpentry" },
  { slug: "bifold_door_install", label: "Bi-fold door install", hint: "carpentry" },
  { slug: "composite_door_install", label: "Composite door install", hint: "carpentry" },
  { slug: "door_frame_replace", label: "Door frame replacement", hint: "carpentry" },

  // Security / access
  { slug: "cctv_install", label: "CCTV install", hint: "electrical" },
  { slug: "cctv_camera_add", label: "Add CCTV camera", hint: "electrical" },
  { slug: "alarm_install", label: "Burglar alarm install", hint: "electrical" },
  { slug: "alarm_service", label: "Alarm service", hint: "electrical" },
  { slug: "access_control_install", label: "Access control / video intercom", hint: "electrical" },

  // Damp proofing
  { slug: "damp_survey", label: "Damp survey", hint: "misc" },
  { slug: "chemical_dpc", label: "Chemical DPC injection", hint: "misc" },
  { slug: "condensation_report", label: "Condensation & mould report", hint: "misc" },
  { slug: "mould_treatment", label: "Mould treatment", hint: "misc" },
  { slug: "basement_tanking", label: "Basement tanking", hint: "misc" },

  // Drainage
  { slug: "drain_unblock", label: "Drain unblock", hint: "misc" },
  { slug: "drain_cctv_survey", label: "CCTV drain survey", hint: "misc" },
  { slug: "drain_patch_repair", label: "Drain patch repair (no-dig)", hint: "misc" },
  { slug: "drain_reline", label: "Drain relining", hint: "misc" },
  { slug: "build_over_survey", label: "Build-over survey", hint: "misc" },

  // Pest control
  { slug: "wasp_nest_treat", label: "Wasp/hornet nest treatment", hint: "misc" },
  { slug: "rat_treatment", label: "Rat treatment", hint: "misc" },
  { slug: "mouse_treatment", label: "Mouse treatment", hint: "misc" },
  { slug: "bed_bug_treatment", label: "Bed bug treatment", hint: "misc" },
  { slug: "bird_proofing", label: "Bird proofing (spikes/netting)", hint: "misc" },

  // Asbestos
  { slug: "asbestos_management_survey", label: "Asbestos management survey", hint: "misc" },
  { slug: "asbestos_refurb_demo_survey", label: "Asbestos refurb/demo survey", hint: "misc" },
  { slug: "artex_removal", label: "Textured coating (Artex) removal", hint: "misc" },
  { slug: "asbestos_cement_removal", label: "Asbestos cement removal", hint: "misc" },
  { slug: "asbestos_aib_removal", label: "Asbestos insulating board removal", hint: "misc" },

  // Sash windows
  { slug: "sash_window_overhaul", label: "Sash window overhaul", hint: "carpentry" },
  { slug: "sash_cord_replace", label: "Sash cord replacement", hint: "carpentry" },
  { slug: "sash_draught_strip", label: "Sash draught-proofing", hint: "carpentry" },
  { slug: "sash_glass_replace", label: "Sash pane replacement", hint: "carpentry" },
  { slug: "sash_timber_repair", label: "Sash timber splice repair", hint: "carpentry" },

  // Trees
  { slug: "tree_crown_reduce", label: "Tree crown reduction", hint: "misc" },
  { slug: "tree_dismantle", label: "Tree dismantle / fell (section)", hint: "misc" },
  { slug: "stump_grind", label: "Stump grinding", hint: "misc" },
  { slug: "hedge_reduce", label: "Large hedge reduction", hint: "misc" },
  { slug: "tree_survey", label: "Tree survey / arb report", hint: "misc" },

  // Garden design
  { slug: "garden_design_consult", label: "Garden design consultation", hint: "misc" },
  { slug: "garden_concept_design", label: "Garden concept design", hint: "misc" },
  { slug: "garden_detailed_design", label: "Garden detailed design pack", hint: "misc" },
  { slug: "garden_planting_plan", label: "Planting plan", hint: "misc" },

  // Post-build cleaning
  { slug: "post_build_clean", label: "Post-build clean", hint: "misc" },
  { slug: "sparkle_clean", label: "Sparkle / handover clean", hint: "misc" },
  { slug: "single_room_deep_clean", label: "Single-room deep clean", hint: "misc" },
  { slug: "sticker_removal", label: "Sticker & protective film removal", hint: "misc" },
  { slug: "showhome_staging", label: "Show-home staging clean", hint: "misc" },

  // Mobile plant mechanic
  { slug: "plant_service_visit", label: "Mobile plant service visit", hint: "misc" },
  { slug: "plant_service_day_rate", label: "Mobile plant fitter day rate", hint: "misc" },
  { slug: "plant_repair_call_out", label: "Plant breakdown call-out", hint: "misc" },
  { slug: "oil_service_plant", label: "Plant oil & filter service", hint: "misc" },
  { slug: "tipper_service", label: "Tipper / LGV mobile service", hint: "misc" },

  // Flooring installer (LVT / hardwood / subfloor)
  { slug: "lvt_click_fit", label: "LVT click-fit installation", hint: "flooring" },
  { slug: "lvt_glue_fit", label: "LVT glue-down installation", hint: "flooring" },
  { slug: "herringbone_fit", label: "Herringbone floor fit", hint: "flooring" },
  { slug: "subfloor_level", label: "Subfloor levelling / latex screed", hint: "flooring" },
  { slug: "underlay_fit", label: "Underlay fit", hint: "flooring" },

  // Smart home
  { slug: "smart_lighting_install", label: "Smart lighting install", hint: "electrical" },
  { slug: "smart_heating_install", label: "Smart heating / thermostat install", hint: "electrical" },
  { slug: "smart_hub_install", label: "Smart home hub install", hint: "electrical" },
  { slug: "sonos_av_install", label: "Sonos / multi-room AV install", hint: "electrical" },
  { slug: "smart_home_survey", label: "Smart home survey & design", hint: "electrical" },

  // Garage doors
  { slug: "up_and_over_garage_door", label: "Up-and-over garage door install", hint: "carpentry" },
  { slug: "sectional_garage_door", label: "Sectional garage door install", hint: "carpentry" },
  { slug: "roller_garage_door", label: "Roller garage door install", hint: "carpentry" },
  { slug: "garage_door_motor_add", label: "Garage door electric motor retrofit", hint: "electrical" },
  { slug: "garage_door_repair", label: "Garage door repair & service", hint: "carpentry" },

  // Shutters (interior)
  { slug: "plantation_shutter_install", label: "Full-height plantation shutter install", hint: "carpentry" },
  { slug: "cafe_shutter_install", label: "Café-style shutter install", hint: "carpentry" },
  { slug: "tier_on_tier_shutter", label: "Tier-on-tier shutter install", hint: "carpentry" },
  { slug: "shutter_measure_visit", label: "Shutter survey & measure visit", hint: "carpentry" },

  // Aerial / satellite
  { slug: "freeview_aerial_install", label: "Freeview TV aerial install", hint: "electrical" },
  { slug: "sky_dish_install", label: "Sky / satellite dish install", hint: "electrical" },
  { slug: "communal_matv_install", label: "Communal MATV / IRS install", hint: "electrical" },
  { slug: "aerial_realign", label: "Aerial re-align / call-out", hint: "electrical" },
  { slug: "freesat_install", label: "Freesat dish install", hint: "electrical" },

  // Awnings & gazebos
  { slug: "retractable_awning_install", label: "Retractable awning install", hint: "misc" },
  { slug: "motorised_awning_install", label: "Motorised awning install", hint: "misc" },
  { slug: "cassette_awning_install", label: "Full-cassette awning install", hint: "misc" },
  { slug: "freestanding_gazebo_install", label: "Freestanding gazebo / pergola install", hint: "misc" },
  { slug: "awning_service", label: "Awning service & re-fabric", hint: "misc" },

  // Driveways
  { slug: "block_paving_drive", label: "Block paving driveway install", hint: "misc" },
  { slug: "resin_bound_drive", label: "Resin bound driveway install", hint: "misc" },
  { slug: "tarmac_drive", label: "Tarmac driveway install", hint: "misc" },
  { slug: "drive_reseal", label: "Driveway clean & seal", hint: "misc" },
  { slug: "drive_repair", label: "Driveway repair / patch", hint: "misc" },

  // Fencing
  { slug: "feather_edge_fence", label: "Feather-edge fence install", hint: "misc" },
  { slug: "closeboard_fence", label: "Closeboard fence install", hint: "misc" },
  { slug: "panel_fence_install", label: "Panel fence install", hint: "misc" },
  { slug: "garden_gate_fit", label: "Garden gate fit", hint: "misc" },
  { slug: "fence_panel_replace", label: "Fence panel replacement", hint: "misc" },

  // Garden rooms
  { slug: "garden_room_install", label: "Garden room install", hint: "misc" },
  { slug: "garden_studio_install", label: "Garden studio (SIPs) install", hint: "misc" },
  { slug: "garden_room_base", label: "Garden room concrete base", hint: "misc" },
  { slug: "garden_room_electrics", label: "Garden room electrics install", hint: "electrical" },
  { slug: "garden_room_insulate", label: "Garden room insulation upgrade", hint: "misc" },

  // Conservatories
  { slug: "conservatory_install", label: "Conservatory install (Victorian/Edwardian)", hint: "misc" },
  { slug: "lean_to_install", label: "Lean-to conservatory install", hint: "misc" },
  { slug: "orangery_install", label: "Orangery install", hint: "misc" },
  { slug: "conservatory_reroof", label: "Conservatory roof replacement", hint: "roofing" },
  { slug: "conservatory_clean", label: "Conservatory deep clean", hint: "misc" },

  // Pumps
  { slug: "borehole_pump_install", label: "Borehole pump install", hint: "plumbing" },
  { slug: "sump_pump_install", label: "Sump pump install", hint: "plumbing" },
  { slug: "sewage_pump_install", label: "Sewage pump install", hint: "plumbing" },
  { slug: "booster_pump_install", label: "Water booster pump install", hint: "plumbing" },
  { slug: "pump_service_visit", label: "Pump service / annual visit", hint: "plumbing" }
];

const SERVICE_CATEGORY_MAP = new Map(
  SERVICE_CATEGORIES.map((c) => [c.slug, c])
);

export function getServiceCategory(slug: string | null | undefined): ServiceCategory | null {
  if (!slug) return null;
  return SERVICE_CATEGORY_MAP.get(slug) ?? null;
}

export function serviceCategoryLabel(slug: string | null | undefined): string | null {
  return getServiceCategory(slug)?.label ?? null;
}
