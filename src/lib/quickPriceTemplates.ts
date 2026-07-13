// Quick-price templates — per-trade starter lists that surface on
// /trade-off/edit/[slug]/quick-prices right after a trade publishes.
//
// Every row includes a service_category slug so the moment the trade
// saves, the row lands on any matching product PDP's "Independent
// local trades" strip. Trades keep the ones that fit, edit prices,
// bin the rest.
//
// PRICING RESEARCH (July 2026):
// Suggested prices are anchored to UK cost-guide averages published
// by Checkatrade, MyBuilder, HomeRewire and BestBuilders. Trades
// edit before save — these are conversation-starters not commitments.
// Sources documented in the shipping ticket; refresh annually.
//
// Categorised by primary_trade slug. Trades that don't match any
// template group fall back to an empty list (the UI renders a
// generic "build your own from the taxonomy" flow).

import type { ServiceCategory } from "./serviceCategories";

export type QuickPriceTemplate = {
  label: string;
  /** Suggested starter price in pence — trade edits before save.
   *  Anchored to Checkatrade / MyBuilder mid-range for the job. */
  suggestedPricePence: number;
  /** Pricing unit shown after the price ("per door", "per m²", etc). */
  unit: string;
  /** Which service_category slug this ties to. Must be a valid slug
   *  in src/lib/serviceCategories.ts. */
  serviceCategory: ServiceCategory["slug"];
  /** Short body text stored on the product row so the PDP strip has
   *  something to render beyond just the name. */
  description: string;
};

// Carpenter — top 5 by UK homeowner request frequency
// (Checkatrade + Bestbuilders 2026). Door work + skirting + loft
// hatches dominate; fitted wardrobes are too variable for a fixed
// starter price so we skip them.
const CARPENTER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade: hanging an internal door £50–£80 per door
    label: "Hang 1 internal door (existing frame)",
    suggestedPricePence: 6000,
    unit: "door",
    serviceCategory: "door_install",
    description:
      "Fit an internal door into an existing frame. Hinges + latch fitted, trim planed to size."
  },
  {
    // Common add-on with door work — pairs with door_install
    label: "Fit door lock (standard tubular latch)",
    suggestedPricePence: 3500,
    unit: "lock",
    serviceCategory: "door_lock_install",
    description:
      "Standard tubular latch install on a pre-hung internal door. Bring your own lock or add one to the order."
  },
  {
    // Bestbuilders 2026: MDF £6–£10/m, softwood £8–£14/m installed —
    // mid-range £12 keeps room for both.
    label: "Fit skirting board",
    suggestedPricePence: 1200,
    unit: "m",
    serviceCategory: "skirting_install",
    description:
      "Cut, mitre and fix skirting to existing wall. Priced per metre; painter's caulk finish included."
  },
  {
    // Not directly researched — kept at £95 based on trade forum norms
    label: "Install loft hatch (single-storey)",
    suggestedPricePence: 9500,
    unit: "hatch",
    serviceCategory: "loft_hatch_install",
    description:
      "Cut opening in a standard plasterboard ceiling, fit hatch + trim. Ladder install is separate."
  },
  {
    // Popular per-shelf micro-job — matches common flatpack + shelf request
    label: "Fit floating shelf",
    suggestedPricePence: 3500,
    unit: "shelf",
    serviceCategory: "shelving_install",
    description:
      "Level, drill, plug and fix a supplied floating shelf up to 1.2m. Concrete or timber walls."
  }
];

// Plumber — top 5 emergency + everyday jobs
// (Checkatrade + MyBuilder call-out data 2026). Blocked toilets +
// boiler service + tap repair dominate the everyday call queue.
const PLUMBER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade: fixing a dripping tap £60–£120 — mid £90
    label: "Fix dripping tap (washer / seal)",
    suggestedPricePence: 9000,
    unit: "tap",
    serviceCategory: "tap_fitting",
    description:
      "Diagnose + fix a dripping mixer, monobloc or bib tap. Washers / cartridges included."
  },
  {
    // MyBuilder: blocked toilet £100 typical
    label: "Fit new mixer tap (kitchen or bath)",
    suggestedPricePence: 10000,
    unit: "tap",
    serviceCategory: "tap_fitting",
    description:
      "Swap or install a new mixer tap on existing supply. Isolate, remove old, fit + test."
  },
  {
    // Checkatrade: fitting a toilet with existing waste £120
    label: "Fit toilet (existing waste + supply)",
    suggestedPricePence: 12000,
    unit: "toilet",
    serviceCategory: "toilet_install",
    description:
      "Install a new toilet where an old one previously sat. Old toilet removal + disposal not included."
  },
  {
    // Trade forum consensus: like-for-like radiator swap £150–£200
    label: "Swap radiator (same size, same location)",
    suggestedPricePence: 18000,
    unit: "radiator",
    serviceCategory: "radiator_swap",
    description:
      "Drain, remove and replace an existing radiator with a like-for-like unit. System balance after."
  },
  {
    // Checkatrade: annual gas boiler service £95
    label: "Boiler annual service",
    suggestedPricePence: 9500,
    unit: "boiler",
    serviceCategory: "boiler_service",
    description:
      "Gas Safe boiler service — clean, check pressures, flue safety test, service log stamped."
  }
];

// Electrician — top 5 domestic jobs
// (Checkatrade + Homerewire 2026). EICR / socket install / light
// fitting are the most-searched. Consumer unit swap is added
// because it's the biggest ticket a domestic electrician regularly
// sees; PAT test is retained for shops + small offices.
const ELECTRICIAN_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Homerewire 2026: EICR for a standard 3-bed £150–£250
    label: "EICR electrical safety certificate (3-bed)",
    suggestedPricePence: 18000,
    unit: "property",
    serviceCategory: "pat_testing",
    description:
      "Full Electrical Installation Condition Report for a standard 3-bed home. Certificate provided."
  },
  {
    // Checkatrade 2026: new socket £55–£75
    label: "Fit socket (existing wiring nearby)",
    suggestedPricePence: 6500,
    unit: "socket",
    serviceCategory: "socket_install",
    description:
      "Add or replace a socket where wiring is already in place. Testing + certificate on completion."
  },
  {
    // Checkatrade 2026: replace light fitting £55–£75
    label: "Fit light fitting (existing wiring)",
    suggestedPricePence: 6500,
    unit: "fitting",
    serviceCategory: "light_fitting_install",
    description:
      "Install a pendant, batten or ceiling light on an existing wired point. Bulbs not included."
  },
  {
    // Standard PAT batch pricing — kept for office / short-let / shop segment
    label: "PAT test (up to 20 items)",
    suggestedPricePence: 7500,
    unit: "batch",
    serviceCategory: "pat_testing",
    description:
      "On-site PAT testing for portable electrical items. Certificate + item log provided."
  },
  {
    // Homerewire 2026: consumer unit £450–£800 — mid £550
    label: "Consumer unit swap (18th Edition, 10-way)",
    suggestedPricePence: 55000,
    unit: "unit",
    serviceCategory: "consumer_unit_swap",
    description:
      "Full swap of an old fuse board for a new 18th Edition consumer unit. EICR + certificate included."
  }
];

// Flooring — retained; pricing checked against Bestbuilders + hamuch.
const FLOORING_TEMPLATE: QuickPriceTemplate[] = [
  {
    label: "Fit laminate flooring",
    suggestedPricePence: 900,
    unit: "m²",
    serviceCategory: "laminate_fit",
    description:
      "Click-laminate install over prepared subfloor. Underlay + beading extra."
  },
  {
    label: "Fit carpet",
    suggestedPricePence: 700,
    unit: "m²",
    serviceCategory: "carpet_fit",
    description:
      "Grip rod + underlay + carpet fit. Carpet + underlay supplied by customer."
  },
  {
    label: "Fit ceramic / porcelain floor tile",
    suggestedPricePence: 3500,
    unit: "m²",
    serviceCategory: "tile_fit",
    description:
      "Adhesive + grout floor tiling on prepared substrate. Cutting + edge trim included."
  }
];

// Roofer — trade-forum consensus; no dedicated cost-guide research
// pass yet, refresh with data when we add a roofing hero image.
const ROOFER_TEMPLATE: QuickPriceTemplate[] = [
  {
    label: "Small roof repair (2-hour call-out)",
    suggestedPricePence: 18000,
    unit: "job",
    serviceCategory: "small_roof_repair",
    description:
      "Slipped tile, cracked flashing or small leak fix — 2-hour call-out. Materials extra."
  },
  {
    label: "Gutter clean (semi-detached)",
    suggestedPricePence: 8500,
    unit: "house",
    serviceCategory: "gutter_clean",
    description:
      "Full gutter + downpipe clean by hand or vac, semi-detached property. Photo before + after."
  },
  {
    label: "Fit replacement window (existing opening)",
    suggestedPricePence: 15000,
    unit: "window",
    serviceCategory: "window_install",
    description:
      "Replacement UPVC or timber window fit into an existing opening. Disposal of old unit included."
  }
];

// Handyman — top 5 completed-task bookings (MyBuilder + Checkatrade
// + Taskrabbit 2026). Flatpack, TV mounting, curtain rails, painting
// and shed assembly are the modal categories.
const HANDYMAN_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Taskrabbit 2026: double-wardrobe + drawers ~£90
    label: "Flatpack furniture (double wardrobe or equivalent)",
    suggestedPricePence: 9000,
    unit: "unit",
    serviceCategory: "shelving_install",
    description:
      "Assemble one large flatpack unit (double wardrobe, chest of drawers, TV cabinet). Includes cardboard removal."
  },
  {
    // Common add — pairs with laminate flooring / shelving customers
    label: "TV wall-mount install (bracket supplied)",
    suggestedPricePence: 8500,
    unit: "TV",
    serviceCategory: "shelving_install",
    description:
      "Level, drill, plug and fix a customer-supplied TV bracket to solid or plasterboard wall. Cable-hide add-on separate."
  },
  {
    // Popular one-off — priced per room
    label: "Fit curtain pole or blinds (per room)",
    suggestedPricePence: 6500,
    unit: "room",
    serviceCategory: "shelving_install",
    description:
      "Measure, level and fix a supplied curtain pole or roller blind up to 2 windows in one room."
  },
  {
    // Checkatrade 2026: shed assembly 3-4h at £27/h ≈ £100
    label: "Shed assembly (up to 8×6)",
    suggestedPricePence: 12000,
    unit: "shed",
    serviceCategory: "shelving_install",
    description:
      "Assemble a standard timber shed on a prepared base. Base construction is separate."
  },
  {
    // Checkatrade 2026: painting per day ~£188 (single room fits)
    label: "Paint 1 standard room (walls, one coat colour)",
    suggestedPricePence: 22000,
    unit: "room",
    serviceCategory: "shelving_install",
    description:
      "Paint 4 walls of a standard bedroom in a chosen colour, one coat over existing primer. Ceiling + trim extra."
  }
];

// Painter — top 5 by UK homeowner request frequency (Checkatrade
// + MyBuilder + MyJobQuote 2026). Single-room repaints, feature
// walls, doors and fences dominate small-job searches.
const PAINTER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 painter-decorator guide — single room £300–£450 mid £350
    label: "Paint 1 standard room (walls, two coats)",
    suggestedPricePence: 35000,
    unit: "room",
    serviceCategory: "interior_paint",
    description:
      "Prep, fill minor cracks and paint 4 walls of a standard bedroom (up to ~12 m²) in one colour, two coats. Ceiling and trim priced separately."
  },
  {
    // Checkatrade 2026 wallpapering guide — feature wall £150–£380 mid £250
    label: "Hang wallpaper — single feature wall",
    suggestedPricePence: 25000,
    unit: "wall",
    serviceCategory: "wallpapering",
    description:
      "Strip old paper, prep and hang customer-supplied wallpaper on one feature wall up to ~6 m². Adhesive included; wallpaper supplied by customer."
  },
  {
    // MyJobQuote 2026 exterior door — plain £150, glass £250, mid £180
    label: "Paint front door (exterior, prep + 2 coats)",
    suggestedPricePence: 18000,
    unit: "door",
    serviceCategory: "exterior_paint",
    description:
      "Sand, prime and repaint an external front door in a chosen colour, two coats. Removing door furniture and reinstating included."
  },
  {
    // Checkatrade 2026 fence painting — small fence £140–£200 mid £180
    label: "Paint or stain garden fence (up to 6 panels)",
    suggestedPricePence: 18000,
    unit: "fence",
    serviceCategory: "exterior_paint",
    description:
      "Wash down and apply two coats of paint or stain to a standard garden fence run of up to 6 panels. Customer supplies the paint or stain."
  },
  {
    // Checkatrade 2026 — ceiling + trim add-on £150–£200 mid £160
    label: "Paint ceiling + skirting + door frame (per room)",
    suggestedPricePence: 16000,
    unit: "room",
    serviceCategory: "interior_paint",
    description:
      "Mask and paint the ceiling in white matt plus skirting and door frame in white satin, one room. Pairs with the walls repaint."
  }
];

// Tiler — top 5 by search volume (Checkatrade + MyBuilder + Raystone
// 2026). Bathroom regrout, kitchen splashback and small floor tiling
// jobs are the modal single-visit tiler bookings.
const TILER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 regrouting — bathroom £215–£285 mid £250
    label: "Regrout bathroom (walls + floor, standard family bath)",
    suggestedPricePence: 25000,
    unit: "bathroom",
    serviceCategory: "tile_grout_refresh",
    description:
      "Rake out and replace tile grout across a standard family bathroom (walls + floor up to ~15 m²). Sealant beads around bath and basin renewed."
  },
  {
    // Checkatrade 2026 — shower regrout ~£160
    label: "Regrout single shower enclosure",
    suggestedPricePence: 16000,
    unit: "shower",
    serviceCategory: "tile_grout_refresh",
    description:
      "Rake out and replace tile grout inside one shower enclosure or over-bath tiled area. Silicone sealant around tray or bath renewed."
  },
  {
    // Raystone 2026 splashback — small £159–£368 mid £275
    label: "Tile kitchen splashback (up to 3 m²)",
    suggestedPricePence: 28000,
    unit: "splashback",
    serviceCategory: "wall_tile_fit",
    description:
      "Fit customer-supplied ceramic or porcelain tiles to a kitchen splashback area up to 3 m². Adhesive, grout and edge trim included."
  },
  {
    // Pricing Penguin 2026 — wall tiling labour £30–£45/m² mid £40
    label: "Wall tile install (per m², labour only)",
    suggestedPricePence: 4000,
    unit: "m²",
    serviceCategory: "wall_tile_fit",
    description:
      "Fit customer-supplied wall tiles to a prepared substrate. Adhesive and grout included; tanking and tile supply priced separately."
  },
  {
    // Pricing Penguin 2026 — floor tiling labour £25–£40/m² mid £35
    label: "Floor tile install (per m², labour only)",
    suggestedPricePence: 3500,
    unit: "m²",
    serviceCategory: "tile_fit",
    description:
      "Ceramic or porcelain floor tiling over a prepared substrate. Adhesive, grout and cuts included; levelling compound and tile supply extra."
  }
];

// Plasterer — top 5 patch-and-skim single-visit jobs (Checkatrade
// + MyJobQuote 2026). Small patch, wall skim, room skim and ceilings
// dominate the household call list.
const PLASTERER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // MyJobQuote 2026 — small patch < 1 m² £80–£150 mid £120
    label: "Patch repair (single hole or damaged area up to 1 m²)",
    suggestedPricePence: 12000,
    unit: "patch",
    serviceCategory: "wall_plaster_patch",
    description:
      "Cut back, fill and skim a single damaged plaster area up to 1 m² — old fixings, small holes or blown plaster. Paint finish separate."
  },
  {
    // Checkatrade 2026 plaster room — single wall £310 mid
    label: "Skim single wall (up to 12 m²)",
    suggestedPricePence: 31000,
    unit: "wall",
    serviceCategory: "wall_plaster_skim",
    description:
      "Prep and 2-coat skim finish over one existing wall up to ~12 m². Ready for decoration after 5–7 days drying."
  },
  {
    // Checkatrade 2026 — skim a room £430–£550 mid £480
    label: "Skim small room (walls only, up to 30 m²)",
    suggestedPricePence: 48000,
    unit: "room",
    serviceCategory: "wall_plaster_skim",
    description:
      "Full 2-coat skim of all four walls in a small bedroom or box room (up to ~30 m² of wall). Ceilings and making good priced separately."
  },
  {
    // Checkatrade 2026 plaster ceiling — £275–£575 mid £360
    label: "Skim ceiling (medium room, up to 15 m²)",
    suggestedPricePence: 36000,
    unit: "ceiling",
    serviceCategory: "ceiling_plaster",
    description:
      "Prep and 2-coat skim to a sound existing ceiling up to ~15 m². Artex removal or overboarding priced separately."
  },
  {
    // UNVERIFIED — trade-forum consensus: bond + skim single chimney breast ~£180–£220
    label: "Bond coat + skim single chimney breast",
    suggestedPricePence: 20000,
    unit: "chimney breast",
    serviceCategory: "wall_plaster_skim",
    description:
      "Bond coat and 2-coat skim finish to one chimney breast face and returns after tiles or fireplace removal. Debris disposal included."
  }
];

// Drywaller — top 5 hang/board single-visit jobs (Checkatrade
// + MyBuilder 2026). Boarding a wall, boarding a ceiling, small
// stud partition and patch replacement dominate.
const DRYWALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // UNVERIFIED — trade-forum consensus: walls-only board ~£380/room
    label: "Board single wall (supply + hang, up to 12 m²)",
    suggestedPricePence: 30000,
    unit: "wall",
    serviceCategory: "drywall_hang",
    description:
      "Supply and hang standard 12.5 mm plasterboard on one wall up to ~12 m². Screwed to existing studs or battens; taping and skim separate."
  },
  {
    // Checkatrade 2026 plasterboard install — ceiling £340 supply+fit
    label: "Board single ceiling (supply + hang, up to 15 m²)",
    suggestedPricePence: 34000,
    unit: "ceiling",
    serviceCategory: "drywall_hang",
    description:
      "Supply and hang 12.5 mm plasterboard to a ceiling up to ~15 m². Fixed to existing joists; taping and skim finish priced separately."
  },
  {
    // MyBuilder 2026 partition wall — £800–£1,000 mid £900 (3m × 2.4m)
    label: "Build small stud partition wall (up to 7 m²)",
    suggestedPricePence: 90000,
    unit: "wall",
    serviceCategory: "stud_wall_build",
    description:
      "Frame, board and prep a timber stud partition up to ~3m × 2.4m — timber, plasterboard and fixings included. Skim, door lining and electrics separate."
  },
  {
    // UNVERIFIED — trade-forum consensus: cut-and-replace ~£90–£140
    label: "Cut out + patch damaged plasterboard (single hole)",
    suggestedPricePence: 12000,
    unit: "patch",
    serviceCategory: "drywall_hang",
    description:
      "Cut back damaged plasterboard, install noggins and a patch piece flush to the surrounding surface up to 0.5 m². Taping and skim included."
  },
  {
    // UNVERIFIED — trade-forum consensus: small MR board-out £280–£340
    label: "Overboard existing wall with moisture-resistant board",
    suggestedPricePence: 30000,
    unit: "wall",
    serviceCategory: "drywall_hang",
    description:
      "Fix moisture-resistant plasterboard directly over an existing sound wall up to ~10 m² — typical prep for a tanked bathroom. Tanking and tiling separate."
  }
];

// Taper & Finisher — tape-and-joint single-visit jobs (MyJobQuote
// + BuildHub 2026). Per-m² walls + ceilings + patch, plus Level 5
// upgrade for critical lighting or dark paint.
const TAPER_AND_FINISHER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // MyJobQuote 2026 drywall — tape+joint labour walls £8–£14/m² mid £12
    label: "Tape & joint plasterboard (per m², labour only)",
    suggestedPricePence: 1200,
    unit: "m²",
    serviceCategory: "drywall_tape_finish",
    description:
      "Standard 3-coat tape and joint finish to hung plasterboard walls. Level 4 finish ready for paint; compound, tape and sanding included."
  },
  {
    // MyJobQuote 2026 — ceilings & detail work £15–£19/m² mid £17
    label: "Tape & joint ceiling (per m², labour only)",
    suggestedPricePence: 1700,
    unit: "m²",
    serviceCategory: "drywall_tape_finish",
    description:
      "3-coat tape and joint finish to a hung plasterboard ceiling. Slower and dustier than walls; sanding and cleanup included."
  },
  {
    // UNVERIFIED — trade-forum consensus: single-room walls-only ~£280–£360
    label: "Tape & joint full room (walls, up to 30 m²)",
    suggestedPricePence: 32000,
    unit: "room",
    serviceCategory: "drywall_tape_finish",
    description:
      "Full Level 4 tape and joint finish to all four walls of a small bedroom or office (up to ~30 m² of plasterboard). Ready for paint."
  },
  {
    // UNVERIFIED — trade-forum consensus: Level 5 upgrade ~£150/room
    label: "Level 5 finish upgrade (per room)",
    suggestedPricePence: 15000,
    unit: "room",
    serviceCategory: "drywall_tape_finish",
    description:
      "Upgrade a taped room to a Level 5 skim-coat finish for critical lighting or dark paint. Priced on top of a standard Level 4 tape-and-joint job."
  },
  {
    // UNVERIFIED — trade-forum consensus: small patch tape-in £90–£140
    label: "Tape & finish patch or repair (single area up to 1 m²)",
    suggestedPricePence: 12000,
    unit: "patch",
    serviceCategory: "drywall_tape_finish",
    description:
      "Tape, coat and sand a single plasterboard patch or joint up to 1 m² — pairs with a drywaller's patch install. Ready for paint."
  }
];

// Bricklayer — top 5 by UK homeowner request frequency (Checkatrade
// + MyBuilder 2026). Repointing, small garden walls, chimney work
// and pier/pillar builds are the bread-and-butter small jobs.
const BRICKLAYER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 repointing £50–£60/m² mid £55
    label: "Repoint brickwork (per m²)",
    suggestedPricePence: 5500,
    unit: "m²",
    serviceCategory: "brick_repoint",
    description:
      "Rake out failed joints to depth, brush clean and repoint with matching mortar. Priced per m² for small walls, bay windows or patch sections. Scaffold not included."
  },
  {
    // Checkatrade 2026 chimney repoint — small £300–£1,000 mid £450
    label: "Repoint small chimney stack (low roof access)",
    suggestedPricePence: 45000,
    unit: "chimney",
    serviceCategory: "chimney_repoint",
    description:
      "Repoint a single chimney stack accessible from a low roof (bungalow / dormer). Includes rake out, brush and cement or lime pointing. Roof access equipment and scaffold quoted separately."
  },
  {
    // Checkatrade 2026 — 1m × 4m single-skin £825, ~£150/m² fitted
    label: "Build small single-skin garden wall (per m²)",
    suggestedPricePence: 15000,
    unit: "m²",
    serviceCategory: "garden_wall_build",
    description:
      "Single-skin garden wall in standard facing brick on an existing footing. Priced per m² face. Coping, footings and bricks charged as extras if required."
  },
  {
    // BookaBuilderUK 2026 pier £150–£400 mid £275
    label: "Build brick pier / gate pillar",
    suggestedPricePence: 27500,
    unit: "pier",
    serviceCategory: "brick_pier_build",
    description:
      "One free-standing brick pier or gate pillar up to 1.2 m tall on existing base. Cement fill and cap included. Ironmongery, gates and lighting are separate."
  },
  {
    // MyBuilder 2026 — patch repair labour ~£200/day + materials
    label: "Patch repair small brickwork area (½ day)",
    suggestedPricePence: 22000,
    unit: "visit",
    serviceCategory: "brick_wall_repair",
    description:
      "Half-day visit to rebuild or patch a small brickwork area — up to about 1 m². Includes cutting out damaged bricks, mortar and matching brick where stock allows."
  }
];

// Block Layer — top 5 by UK homeowner request frequency
// (Checkatrade + Refurbb 2026). Small garden and outbuilding blockwork
// dominates for domestic customers; partitions cover small-business fit-outs.
const BLOCK_LAYER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 breeze block wall £50–£65/m² mid £57.50
    label: "Build breeze block garden wall (per m²)",
    suggestedPricePence: 5800,
    unit: "m²",
    serviceCategory: "breeze_block_wall",
    description:
      "Lay a 100 mm breeze block garden or boundary wall on existing footing. Includes blocks, mortar and pointing. Render, coping and footings quoted separately."
  },
  {
    // Refurbb 2026 concrete block wall £40–£55/m² mid £50
    label: "Build 100 mm concrete block wall (per m²)",
    suggestedPricePence: 5000,
    unit: "m²",
    serviceCategory: "block_wall_build",
    description:
      "Standard 100 mm dense concrete blockwork for garden, outbuilding or garage walls. Priced per m² of face. Foundations and finishes are separate."
  },
  {
    // constructionrates.co.uk 2026 cavity walling ~£100/m² insulated
    label: "Build cavity block wall (per m², both leaves)",
    suggestedPricePence: 10000,
    unit: "m²",
    serviceCategory: "cavity_block_build",
    description:
      "Twin-leaf cavity blockwork with wall ties and cavity insulation for small extensions or garden rooms. Includes both skins of block and DPC lift. Groundworks, roof and openings are separate."
  },
  {
    // MyBuilder 2026 partition blockwork ~£45–£55/m² mid £50
    label: "Build internal block partition wall (per m²)",
    suggestedPricePence: 5000,
    unit: "m²",
    serviceCategory: "block_partition_build",
    description:
      "100 mm block partition for garage, cellar or small-business fit-out. Includes blocks, mortar and rough finish ready to plaster. Doors, sockets and plastering are separate."
  },
  {
    // Checkatrade 2026 breeze block ~£57.50/m² × ~4 m² typical shed
    label: "Build small outbuilding / shed footprint in block",
    suggestedPricePence: 45000,
    unit: "job",
    serviceCategory: "block_wall_build",
    description:
      "Blockwork skin for a small outbuilding or shed footprint up to ~10 m² of face. Excludes concrete base, roof and openings — priced as a small package for garden studios and stores."
  }
];

// Groundworker — top 5 by UK homeowner request frequency (Checkatrade
// + MyBuilder + BestBuilders 2026). Focus on repeatable small-scope
// digs / sub-base / drainage.
const GROUNDWORKER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // whattocharge.co.uk 2026 groundworker £180–£320/day mid £250
    label: "Groundworker day rate (with hand tools)",
    suggestedPricePence: 25000,
    unit: "day",
    serviceCategory: "foundation_dig",
    description:
      "One groundworker for a single day with hand tools. Suits small digs, muck-away shovel work and site clearance. Plant hire, materials and waste disposal are separate."
  },
  {
    // MyBuilder 2026 foundation dig ~£70/m³
    label: "Dig trench for strip footing (per m)",
    suggestedPricePence: 4500,
    unit: "m",
    serviceCategory: "foundation_dig",
    description:
      "Excavate a strip footing trench to Building Control depth (typically 900 mm × 450 mm) for garden walls or small extensions. Includes spoil stacked on site. Concrete pour, muck-away and Building Control are separate."
  },
  {
    // BestBuilders 2026 sub-base excavation £25–£45/m² mid £35
    label: "Prep driveway sub-base (MOT Type 1, per m²)",
    suggestedPricePence: 3500,
    unit: "m²",
    serviceCategory: "driveway_prep",
    description:
      "Dig out, lay geotextile and compact 150 mm of MOT Type 1 sub-base ready for block paving, resin or tarmac. Priced per m². Edge restraints and the wearing surface are separate."
  },
  {
    // Checkatrade 2026 patio base £15–£35/m² mid £25
    label: "Prep patio base (excavate + hardcore, per m²)",
    suggestedPricePence: 2500,
    unit: "m²",
    serviceCategory: "patio_base",
    description:
      "Excavate to depth, lay membrane and compact 100 mm of MOT Type 1 hardcore ready for the paver / paving-slab layer. Priced per m². Slabs, jointing and pointing are separate."
  },
  {
    // MyBuilder 2026 soakaway small easy-access £660–£1,200 mid £950
    label: "Install small domestic soakaway (rainwater)",
    suggestedPricePence: 95000,
    unit: "soakaway",
    serviceCategory: "soakaway_install",
    description:
      "Dig, install crate / rubble soakaway with membrane and connect a single downpipe. Suits standard clay-free ground with easy access. Permeability tests, driveway breakouts and long pipe runs are separate."
  }
];

// Concrete Specialist — top 5 by UK homeowner / small-business request
// frequency (Checkatrade + MyBuilder 2026). Formwork, pouring and setting
// is their focus — finishing is on the concrete finisher template.
const CONCRETE_SPECIALIST_TEMPLATE: QuickPriceTemplate[] = [
  {
    // MyBuilder 2026 shed / slab base £65–£95/m² mid £80
    label: "Lay small concrete slab / shed base (per m²)",
    suggestedPricePence: 8000,
    unit: "m²",
    serviceCategory: "concrete_slab_lay",
    description:
      "Shutter, pour and tamp a domestic slab up to 15 m² — typical shed, garden room or garage base. Includes ready-mix concrete, mesh and a basic tamped finish. Excavation and sub-base priced separately if required."
  },
  {
    // Fenceinstallers 2026 concrete post supply + labour £25–£40/post
    label: "Set concrete fence post in postcrete",
    suggestedPricePence: 4500,
    unit: "post",
    serviceCategory: "concrete_post",
    description:
      "Dig hole, set one concrete fence post plumb in postcrete or wet mix. Priced per post for repair / replacement work. Panels, gravel boards and full-run installs are separate."
  },
  {
    // constructionrates.co.uk 2026 strip footing pour ~£90–£120/m mid £100
    label: "Pour concrete strip footing (per m)",
    suggestedPricePence: 10000,
    unit: "m",
    serviceCategory: "concrete_footing_pour",
    description:
      "Pour ready-mix concrete into an open trench for garden wall or small-extension footings, screeded to level. Priced per linear metre at 600 × 225 mm section. Digging, rebar and Building Control are separate."
  },
  {
    // BestBuilders 2026 concrete driveway £60–£140/m² mid £90
    label: "Pour plain concrete driveway or hardstanding (per m²)",
    suggestedPricePence: 9000,
    unit: "m²",
    serviceCategory: "concrete_driveway_pour",
    description:
      "Pour and screed a plain concrete driveway or hardstanding with mesh reinforcement, expansion joints and a light broom finish. Sub-base and edging are separate."
  },
  {
    // Checkatrade 2026 screed with labour ~£33/m²
    label: "Lay sand-cement floor screed (per m²)",
    suggestedPricePence: 3300,
    unit: "m²",
    serviceCategory: "screed_lay",
    description:
      "Traditional sand and cement floor screed to 50–75 mm depth, hand-trowelled level ready for final flooring. Priced per m². Insulation, DPM and underfloor heating are separate."
  }
];

// Concrete Finisher — top 5 by UK homeowner / small-business request
// frequency (Checkatrade 2026). Focus on trowel / polish / seal / patch
// on an existing slab.
const CONCRETE_FINISHER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 polishing existing slab ~£50/m²
    label: "Polish existing concrete floor (per m²)",
    suggestedPricePence: 5000,
    unit: "m²",
    serviceCategory: "concrete_polish",
    description:
      "Mechanical grind and polish an existing sound concrete slab to a satin sheen. Priced per m². Crack repair, densifier and coloured finishes are separate."
  },
  {
    // mixdesigncalc 2026 power float £35–£50/m² add-on mid £40
    label: "Power float freshly poured slab (per m²)",
    suggestedPricePence: 4000,
    unit: "m²",
    serviceCategory: "power_float_finish",
    description:
      "Power-float finish on a freshly poured concrete slab to create a hard, smooth industrial surface for garages and workshops. Priced per m² on top of the pour. Slab preparation and pour are separate."
  },
  {
    // Checkatrade 2026 seal coat driveway £2–£3.50/m² mid £3
    label: "Seal concrete driveway or slab (per m²)",
    suggestedPricePence: 300,
    unit: "m²",
    serviceCategory: "concrete_seal",
    description:
      "Clean and apply one coat of clear acrylic or polyurethane sealer to a domestic concrete driveway or slab. Priced per m² with a small minimum visit charge. Deep cleaning and colour tints are separate."
  },
  {
    // London Polished Concrete 2026 architectural £180–£220/m² mid £200
    label: "Architectural / decorative polish finish (per m²)",
    suggestedPricePence: 20000,
    unit: "m²",
    serviceCategory: "concrete_polish",
    description:
      "Full architectural polished concrete finish on a new slab — three-stage grind, densifier, colour or aggregate exposure and high-gloss polish. Priced per m². Slab pour and prep are separate."
  },
  {
    // UNVERIFIED — trade-forum consensus half-day patch ~£150–£250
    label: "Repair concrete crack or spall (half-day visit)",
    suggestedPricePence: 18000,
    unit: "visit",
    serviceCategory: "concrete_repair_patch",
    description:
      "Half-day visit to grind out cracks, apply epoxy or polymer patch repair and blend finish on a small concrete slab or step. Structural repairs and full resurfacing are separate."
  }
];

// Fascia & Soffit — top 5 by UK homeowner enquiry frequency on
// Checkatrade / BookaBuilderUK 2026 cost guides. Front elevation
// replacements + gutter combo dominate; full house is the big-ticket
// job most quote-hunters actually want anchored.
const FASCIA_AND_SOFFIT_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 fascia+soffit — fascia labour+material ~£40–£60/m mid £45
    label: "Replace fascia board (uPVC, front elevation)",
    suggestedPricePence: 4500,
    unit: "m",
    serviceCategory: "fascia_replace",
    description:
      "Strip old timber fascia + fit new uPVC to front elevation. Guttering re-fix included; scaffolding quoted separately."
  },
  {
    // Checkatrade 2026 install-soffit-fascia — soffit strip+replace £40–£55/m mid £45
    label: "Replace soffit board (uPVC, front elevation)",
    suggestedPricePence: 4500,
    unit: "m",
    serviceCategory: "soffit_replace",
    description:
      "Cut out perished soffit boards + fit vented white uPVC. Bird stops included, painting not required."
  },
  {
    // Checkatrade 2026 fascia-soffit-guttering — full roofline £150/linear m
    label: "Full roofline replace (fascia + soffit + gutter)",
    suggestedPricePence: 15000,
    unit: "m",
    serviceCategory: "roofline_full_replace",
    description:
      "Full roofline strip and replace: fascia, soffit and gutter in uPVC. Priced per linear metre across the run; scaffolding costed separately."
  },
  {
    // Checkatrade 2026 — cloak / capping over existing timber £25–£35/m mid £30
    label: "Cloak fascia over existing timber (uPVC capping)",
    suggestedPricePence: 3000,
    unit: "m",
    serviceCategory: "fascia_replace",
    description:
      "Overlay sound timber fascia with uPVC cap board. Cheaper than full strip; only suitable where existing timber is dry and firm."
  },
  {
    // BookaBuilderUK / Checkatrade 2026 — small rot repair £120–£180 mid £150
    label: "Rotten fascia section repair (up to 2m)",
    suggestedPricePence: 15000,
    unit: "visit",
    serviceCategory: "fascia_replace",
    description:
      "Cut out a rotten fascia section up to 2m, splice in treated timber and repaint. Same-day visit where access allows off a ladder."
  }
];

// Lead Worker — top 5 UK small-scope leadwork jobs (Checkatrade 2026
// chimney-flashing + roof-repair guides + ukroofingleads figures).
// Chimney flashings and bay roofs anchor almost every enquiry.
const LEAD_WORKER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 chimney flashing repair — £350–£920 mid £450 no-scaffold
    label: "Replace chimney lead flashing (single stack)",
    suggestedPricePence: 45000,
    unit: "chimney",
    serviceCategory: "lead_chimney_flashing",
    description:
      "Strip perished lead around a single chimney stack, dress and fit new Code 4 lead with pointing. Scaffolding quoted separately."
  },
  {
    // Lead Lads 2026 lead roof — small bay ~£180/m²
    label: "Re-lead bay window roof (Code 5, up to 3m²)",
    suggestedPricePence: 18000,
    unit: "m2",
    serviceCategory: "lead_bay_roof",
    description:
      "Strip existing bay roof covering + replace with Code 5 lead sheet, welted drips and roll joints. Rotten timber substrate quoted separately."
  },
  {
    // Checkatrade 2026 roof repair — valley £300–£800 mid £500
    label: "Repair lead valley (single run, up to 3m)",
    suggestedPricePence: 50000,
    unit: "valley",
    serviceCategory: "lead_valley_repair",
    description:
      "Lift adjacent tiles, replace failed lead valley with new Code 4 sheet on treated boarding. Tiles re-bedded on completion."
  },
  {
    // ukroofingleads 2026 lead-flashing UK — step flashing £200–£700 mid £350
    label: "Fit step flashing to abutment (up to 4m)",
    suggestedPricePence: 35000,
    unit: "run",
    serviceCategory: "lead_step_flashing",
    description:
      "Chase out and fit new Code 4 stepped lead flashing where a roof meets a wall or extension. Includes pointing and clip fixings."
  },
  {
    // Checkatrade 2026 chimney flashing — localised patch £150–£300 mid £200
    label: "Small lead flashing patch repair",
    suggestedPricePence: 20000,
    unit: "visit",
    serviceCategory: "lead_flashing_repair",
    description:
      "Localised repair to lifted or split lead flashing — dress back, patch and re-point. Single-visit fix where scaffolding is not required."
  }
];

// Gutter Installer — Checkatrade 2026 gutter replacement (£40–£50/m
// uPVC), gutter repair (£60–£90 joints), gutter cleaning (£75–£125
// semi) and downpipe (£40/m uPVC) guides.
const GUTTER_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 gutter replacement — uPVC supply+fit £40–£50/m mid £45
    label: "Replace uPVC guttering (front elevation)",
    suggestedPricePence: 4500,
    unit: "m",
    serviceCategory: "gutter_install",
    description:
      "Strip old gutter run + fit new uPVC half-round with fascia brackets and stop-ends. Priced per linear metre; scaffolding extra above 1st storey."
  },
  {
    // Checkatrade 2026 gutter repair — joint reseal £60–£90 mid £75
    label: "Repair leaking gutter joint",
    suggestedPricePence: 7500,
    unit: "joint",
    serviceCategory: "gutter_repair",
    description:
      "Reseal or replace a single leaking gutter joint with new union bracket. Same-visit fix from a ladder where access allows."
  },
  {
    // Checkatrade 2026 gutter cleaning — semi-detached 20–25m £75–£125 mid £100
    label: "Clean guttering + downpipes (semi-detached)",
    suggestedPricePence: 10000,
    unit: "house",
    serviceCategory: "gutter_clean",
    description:
      "Vacuum out gutter run around a standard semi (~20–25m) and flush downpipes. Includes camera-check photos of the finished run."
  },
  {
    // Checkatrade 2026 — uPVC downpipe supply+fit ~£40/m
    label: "Install uPVC downpipe (single run)",
    suggestedPricePence: 4000,
    unit: "m",
    serviceCategory: "downpipe_install",
    description:
      "Fit new uPVC downpipe from gutter outlet to ground shoe including brackets and swan-neck offsets. Existing pipe removal included."
  },
  {
    // Checkatrade 2026 — 15–20m + 3 downpipes ~£1,000 all-in ≈ £50/m
    label: "Full house gutter + downpipe replace (uPVC)",
    suggestedPricePence: 5000,
    unit: "m",
    serviceCategory: "gutter_install",
    description:
      "Complete uPVC replacement around a standard semi/terrace including 2–3 downpipes and shoes. Priced per linear metre of gutter run."
  }
];

// Chimney Sweep — Checkatrade + HETAS 2026 guides. Single sweep is
// the volume driver (£65–£98); cowls, stove sweeps and CCTV are the
// upsells homeowners search for.
const CHIMNEY_SWEEP_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 chimney sweep — single flue £65–£98 mid £80
    label: "Sweep single open fire chimney",
    suggestedPricePence: 8000,
    unit: "chimney",
    serviceCategory: "chimney_sweep",
    description:
      "Full sweep of a single flue with dust-sheets and vacuum. HETAS-style sweep certificate provided for insurance."
  },
  {
    // MyBuilder / Checkatrade 2026 — stove sweep £55–£75 mid £65
    label: "Sweep woodburner / multi-fuel stove",
    suggestedPricePence: 6500,
    unit: "stove",
    serviceCategory: "stove_service",
    description:
      "Sweep the stove flue liner, clean the baffle and door glass, check rope seals. Sweep certificate issued on completion."
  },
  {
    // Checkatrade 2026 chimney cowl — anti-downdraught cowl ~£80 + install ~£120 mid £200
    label: "Fit chimney cowl + bird guard",
    suggestedPricePence: 20000,
    unit: "chimney",
    serviceCategory: "chimney_cowl_fit",
    description:
      "Supply and fit a standard rain / bird-guard cowl to a single pot. Single-storey ladder access; scaffolding quoted separately."
  },
  {
    // MyBuilder + Checkatrade 2026 — standalone CCTV £75–£150 mid £100
    label: "CCTV chimney camera inspection",
    suggestedPricePence: 10000,
    unit: "chimney",
    serviceCategory: "chimney_cctv",
    description:
      "Full-length CCTV survey of the flue with recorded footage. Ideal before use of an unused chimney or after a chimney fire."
  },
  {
    // howmuchshoulditcost / MyBuilder 2026 — smoke test £50–£100 mid £70
    label: "Chimney smoke draw test",
    suggestedPricePence: 7000,
    unit: "chimney",
    serviceCategory: "chimney_smoke_test",
    description:
      "Standard smoke pellet test to confirm the flue draws properly and is not cross-connected. Written pass/fail report included."
  }
];

// Landscaper — Checkatrade 2026 turfing / patio / hedge / border
// guides. Small turf, single patio square, hedge cut and border
// planting anchor the £50–£500 bracket.
const LANDSCAPER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 turfing — supply+lay £15–£30/m² mid £22
    label: "Lay new turf (small lawn)",
    suggestedPricePence: 2200,
    unit: "m2",
    serviceCategory: "turf_lay",
    description:
      "Rotovate, level, feed and roll-lay fresh turf on prepared ground. Priced per m² supplied and laid; heavy ground prep quoted separately."
  },
  {
    // Checkatrade 2026 patio laying — supply+lay £55–£150/m² mid £100
    label: "Lay small patio (Indian sandstone)",
    suggestedPricePence: 10000,
    unit: "m2",
    serviceCategory: "patio_lay",
    description:
      "Excavate, sub-base, bed and joint a small patio in riven sandstone. Priced per m² supplied and laid; excavation muck-away quoted separately."
  },
  {
    // Checkatrade 2026 hedge trimming — single visit £182–£378 mid £150 short run
    label: "Trim garden hedge (single visit)",
    suggestedPricePence: 15000,
    unit: "visit",
    serviceCategory: "hedge_trim",
    description:
      "Single-visit trim of a domestic hedge up to 20m long / 2m tall including green-waste removal. Height work quoted separately."
  },
  {
    // Checkatrade 2026 garden landscaping — small border £50–£150/m² mid £100
    label: "Plant new garden border (design + supply)",
    suggestedPricePence: 10000,
    unit: "m2",
    serviceCategory: "planting_design",
    description:
      "Clear existing border, improve soil, and plant a mix of shrubs and perennials to a simple planting plan. Priced per m² of border."
  },
  {
    // Checkatrade 2026 gardener — one-off tidy £150–£250 mid £180
    label: "Lawn care + garden tidy (half day)",
    suggestedPricePence: 18000,
    unit: "visit",
    serviceCategory: "lawn_care",
    description:
      "Half-day visit: mow, edge, weed borders and blow paths. Green waste bagged and taken away."
  }
];

// Solar Installer — 1 full PV install, 1 battery retrofit, 1 survey,
// 1 inverter swap, 1 service call. Prices anchored to Checkatrade
// solar cost guide + MCS 2026 average (£1,565 per kW installed).
const SOLAR_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 solar PV — 4kW £6,500–£8,500 mid £7,500
    label: "Install 4kW solar PV system (roof-mounted, MCS-certified)",
    suggestedPricePence: 750000,
    unit: "system",
    serviceCategory: "solar_pv_install",
    description:
      "MCS-certified 4kW rooftop PV on a standard 3-bed. Panels, string inverter, scaffold, isolators and DNO notification included. Battery, EV integration and roof repairs are extra."
  },
  {
    // Checkatrade 2026 battery storage + Sunsave — 5kWh retrofit £3,500–£5,000 mid £4,500
    label: "Retrofit 5kWh solar battery to existing PV system",
    suggestedPricePence: 450000,
    unit: "battery",
    serviceCategory: "battery_install",
    description:
      "AC-coupled 5kWh battery bolt-on for an existing PV system. Includes hybrid inverter or AC coupler, wall bracket, DNO G99 notification. 0% VAT applied to residential installs."
  },
  {
    // EcoExperts / Sunsave 2026 — MCS site survey £300–£800 mid £400
    label: "Solar feasibility survey & MCS design report",
    suggestedPricePence: 40000,
    unit: "survey",
    serviceCategory: "solar_survey",
    description:
      "On-site roof, orientation, shading and consumer-unit survey with a written MCS design pack and Smart Export Guarantee guidance. Fee usually credited against install if you proceed."
  },
  {
    // SolarPanelsNetwork / SolarService.uk 2026 — inverter swap £700–£1,100 mid £900
    label: "Replace faulty string inverter (3–4kWp system, like-for-like)",
    suggestedPricePence: 90000,
    unit: "inverter",
    serviceCategory: "solar_service",
    description:
      "Diagnose, decommission and swap a failed string inverter on a 3–4kWp system. Replacement inverter, warranty registration and system recommissioning included. Battery-ready hybrid upgrade priced separately."
  },
  {
    // SolarService.uk 2026 — call-out from £150, diagnostic repair from £245 mid £250
    label: "Solar system fault call-out & diagnostic",
    suggestedPricePence: 25000,
    unit: "visit",
    serviceCategory: "solar_service",
    description:
      "Same-week engineer visit for underperforming panels, tripping inverter or app fault codes. Includes DC and AC side tests and a written report; parts and second-visit repairs quoted separately."
  }
];

// EV Charger Installer — 1 standard install, 1 tethered upgrade,
// 1 CU upgrade, 1 survey, 1 long-run cable extra. Anchored to
// BestBuilders / Checkatrade / MyBuilder 2026.
const EV_CHARGER_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // TotalSkills + BookaBuilderUK 2026 — 7kW untethered £800–£1,200 mid £1,000
    label: "Install 7kW home EV charger (untethered, standard fit)",
    suggestedPricePence: 100000,
    unit: "charger",
    serviceCategory: "ev_charger_install",
    description:
      "OZEV-approved 7kW wall-mounted charger with Type 2 socket. Includes up to 10m cable run, RCBO, earth rod, app pairing and DNO notification. OZEV grant applied where eligible."
  },
  {
    // BestBuilders 2026 — tethered £100–£150 above untethered, mid £1,150
    label: "Install 7kW tethered smart charger (Pod Point / Ohme / Zappi)",
    suggestedPricePence: 115000,
    unit: "charger",
    serviceCategory: "ev_charger_install",
    description:
      "Tethered 7kW smart charger with load-balancing and solar-divert ready. Cable holster, weatherproof enclosure and commissioning included. OZEV grant applied where eligible."
  },
  {
    // MyBuilder 2026 EV — CU upgrade with EV install £400–£800 mid £550
    label: "Consumer unit upgrade for EV charger (dual-RCD, EV ready)",
    suggestedPricePence: 55000,
    unit: "job",
    serviceCategory: "ev_charger_upgrade",
    description:
      "Replace an old fuse-box with an 18th-edition dual-RCD consumer unit and add a dedicated EV circuit. Notification to Building Control and EIC certificate included."
  },
  {
    // UNVERIFIED — trade-forum consensus paid remote survey £75–£150 mid £95
    label: "EV charger site survey & mounting plan",
    suggestedPricePence: 9500,
    unit: "survey",
    serviceCategory: "ev_charger_survey",
    description:
      "In-person or video survey of driveway, consumer unit and preferred mounting location. Written quote with cable route, DNO impact and OZEV-grant eligibility. Fee credited if you book install."
  },
  {
    // MyBuilder + LoveElectric 2026 — extra cable £10–£20/m or underground £200–£1,000, mid £300 for 15–20m external trunking
    label: "Long cable run extension (15–20m, external trunking)",
    suggestedPricePence: 30000,
    unit: "job",
    serviceCategory: "ev_charger_upgrade",
    description:
      "Add 5–10m of SWA or T&E in external steel trunking beyond the standard 10m. Small builder's-work chase and cable-gland included. Groundworks for underground runs quoted separately."
  }
];

// Heat Pump Installer — 1 full ASHP install, 1 hybrid, 1 survey,
// 1 annual service, 1 refrigerant/repair call-out. Anchored to
// Checkatrade heat-pump guides + Ofgem BUS avg (Jan 2026 £12,500).
const HEAT_PUMP_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade + UKHomeEnergy 2026 — 7kW ASHP £10,000–£12,000 pre-grant mid £11,000 (BUS £7,500 off)
    label: "Install 7kW air source heat pump (3-bed semi, MCS-certified)",
    suggestedPricePence: 1100000,
    unit: "system",
    serviceCategory: "heat_pump_install",
    description:
      "MCS-certified 7kW ASHP swap for a typical 3-bed. Outdoor unit, cylinder, controls, up to 2 radiator upsizes and BUS £7,500 grant admin included. Wet system flush and pipework upsizing quoted separately."
  },
  {
    // Checkatrade hybrid heat pump 2026 — £8,000–£12,000 mid £10,000
    label: "Install hybrid heat pump + gas boiler system",
    suggestedPricePence: 1000000,
    unit: "system",
    serviceCategory: "hybrid_heat_pump_install",
    description:
      "5kW ASHP alongside a retained or new combi boiler, weather-compensating controls and hybrid manager. Handles 70–80% of demand via the pump. BUS grant applied to the heat-pump portion only."
  },
  {
    // UKHomeEnergy + PropertyPassport 2026 — MCS heat-loss survey £300–£500 mid £350
    label: "Heat pump feasibility survey & MCS heat-loss report",
    suggestedPricePence: 35000,
    unit: "survey",
    serviceCategory: "heat_pump_survey",
    description:
      "Room-by-room heat-loss calculation to MCS MIS 3005, radiator sizing table and BUS eligibility check. Written report; fee credited against install if you proceed within 90 days."
  },
  {
    // Checkatrade heat pump servicing 2026 — £150–£300 mid £180
    label: "Annual heat pump service (air source, single unit)",
    suggestedPricePence: 18000,
    unit: "service",
    serviceCategory: "heat_pump_service",
    description:
      "Manufacturer-schedule annual service: refrigerant pressure check, coil clean, filter and strainer service, controls firmware and BUS/warranty logbook update. Parts extra if required."
  },
  {
    // Checkatrade 2026 heat-pump repair — non-service call-out £150–£250 mid £180
    label: "Heat pump fault call-out & diagnostic (F.Gas registered)",
    suggestedPricePence: 18000,
    unit: "visit",
    serviceCategory: "heat_pump_service",
    description:
      "F.Gas-certified engineer visit for no-heat, error codes or noisy fan. Includes electrical checks and refrigerant pressure test. Parts and any refrigerant top-up billed on top."
  }
];

// Door Fitter — 1 internal hang, 1 external, 1 composite front,
// 1 bi-fold set, 1 frame replacement. Anchored to Checkatrade
// door + frame guides + Emerald Doors 2026.
const DOOR_FITTER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 hang-a-door £50–£80 mid £70
    label: "Hang 1 internal door (existing frame)",
    suggestedPricePence: 7000,
    unit: "door",
    serviceCategory: "door_install",
    description:
      "Fit a supplied internal door into an existing frame. Hinges rebated, latch/handles fitted, edges planed and trimmed to fit. Ironmongery supplied by customer."
  },
  {
    // Checkatrade external door install 2026 — labour £300–£700 mid £500
    label: "Fit external door (uPVC or timber, existing opening)",
    suggestedPricePence: 50000,
    unit: "door",
    serviceCategory: "external_door_install",
    description:
      "Remove old external door, prep opening and fit a customer-supplied uPVC or timber external door with new hinges, cylinder lock and weather seals. Frame replacement priced separately."
  },
  {
    // BookaBuilderUK + Checkatrade 2026 — composite door supply+fit £1,200–£1,800 mid £1,400
    label: "Supply & fit composite front door (standard size)",
    suggestedPricePence: 140000,
    unit: "door",
    serviceCategory: "composite_door_install",
    description:
      "Supply a standard-size composite front door in customer's chosen colour + hardware, remove existing door and frame, and fit with new cill, multi-point lock and weatherstrip. GRP or Solidor-equivalent."
  },
  {
    // Checkatrade bifold 2026 — labour £600–£1,200 mid £900 (3-panel, existing opening)
    label: "Install 3-panel bi-fold door set (labour only, existing opening)",
    suggestedPricePence: 90000,
    unit: "set",
    serviceCategory: "bifold_door_install",
    description:
      "Two-fitter install of a customer-supplied 3-panel aluminium bi-fold into a prepared opening. Threshold set, track levelled, panels aligned and locking snecks tested. Structural work priced separately."
  },
  {
    // Checkatrade door-frame 2026 — external frame labour £180 + rehang £135 mid £270
    label: "Replace external door frame & rehang existing door",
    suggestedPricePence: 27000,
    unit: "frame",
    serviceCategory: "door_frame_replace",
    description:
      "Remove damaged external frame, fit new hardwood or engineered frame, re-hang the existing door with new hinges and weather-seal. Making-good of surrounding plaster and painting are extra."
  }
];

// Security Installer — 1 CCTV system, 1 single-camera add, 1 alarm,
// 1 alarm service, 1 access-control / video intercom. Anchored to
// Checkatrade CCTV + burglar-alarm 2026 guides.
const SECURITY_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade CCTV 2026 — wired 4-camera £800–£1,400 mid £1,100
    label: "Install 4-camera HD CCTV system (wired, 8-ch NVR)",
    suggestedPricePence: 110000,
    unit: "system",
    serviceCategory: "cctv_install",
    description:
      "Four HD dome/bullet cameras with 8-channel NVR, 2TB drive, app setup, GDPR signage and cable-routed to the loft/utility. Includes 1–2 days on site. Higher-count or 4K systems quoted separately."
  },
  {
    // MyBuilder + Checkatrade 2026 — extra camera to existing NVR £100–£300 mid £180
    label: "Add 1 camera to existing CCTV system",
    suggestedPricePence: 18000,
    unit: "camera",
    serviceCategory: "cctv_camera_add",
    description:
      "Supply and fit one additional HD dome/bullet camera onto your existing NVR: cable run, PoE port assignment, app channel setup and angle-alignment. Ladder access up to first-floor eaves included."
  },
  {
    // Checkatrade burglar alarm 2026 — wireless £600–£900 mid £700 bell-only 4–6 sensors
    label: "Install wireless burglar alarm (bell-only, 4–6 sensors)",
    suggestedPricePence: 70000,
    unit: "system",
    serviceCategory: "alarm_install",
    description:
      "Grade 2 wireless alarm with control panel, external sounder, 4–6 door/PIR sensors and smart-app control. Bell-only (no ARC monitoring). ARC monitoring subscription quoted separately."
  },
  {
    // Checkatrade burglar alarm service 2026 — one-off visit £150–£200 mid £150
    label: "Annual burglar alarm service & battery check",
    suggestedPricePence: 15000,
    unit: "service",
    serviceCategory: "alarm_service",
    description:
      "Insurance-friendly annual service: panel firmware, backup battery, PIR walk-tests, external sounder tamper and log update. Replacement batteries billed at cost if needed."
  },
  {
    // Checkatrade intercom 2026 — one-door video intercom £300–£600 mid £400
    label: "Install video intercom / keypad on 1 door",
    suggestedPricePence: 40000,
    unit: "door",
    serviceCategory: "access_control_install",
    description:
      "Single-door video intercom or PIN keypad with internal monitor or app view. Electric strike, PSU and cable-through-wall included. Access-control networks and multi-tenant panels quoted separately."
  }
];

// Damp Proofer — Checkatrade + BookaBuilderUK 2026. Survey-first
// diagnostic work + single-wall chemical DPC dominate; whole-house
// tanking sits above the small-job band.
const DAMP_PROOFER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade damp-survey 2026 £150–£500 mid £250
    label: "Independent damp survey (single property)",
    suggestedPricePence: 25000,
    unit: "survey",
    serviceCategory: "damp_survey",
    description:
      "Visual moisture-meter survey of a single property with written report. Covers cause diagnosis (rising, penetrating or condensation) and next-step recommendations."
  },
  {
    // Checkatrade damp-proofing 2026 £70–£120/lm mid £95
    label: "Chemical DPC injection (per linear metre)",
    suggestedPricePence: 9500,
    unit: "linear metre",
    serviceCategory: "chemical_dpc",
    description:
      "Silicone-cream damp-proof course injected into the mortar bed. Priced per linear metre of wall treated; excludes re-plastering."
  },
  {
    // BookaBuilderUK 2026 single-wall all-in £600–£1,200 mid £900
    label: "Single-wall rising damp treatment + salt-resistant re-plaster",
    suggestedPricePence: 90000,
    unit: "wall",
    serviceCategory: "chemical_dpc",
    description:
      "Injection DPC to one wall, hack-off contaminated plaster to 1m and re-plaster in salt-resistant render/skim. Typical for one-room outbreak."
  },
  {
    // MyJobQuote / Checkatrade mould-removal 2026 £150–£300 mid £220
    label: "Condensation & mould report (single dwelling)",
    suggestedPricePence: 22000,
    unit: "report",
    serviceCategory: "condensation_report",
    description:
      "Hygrometer + surface-moisture inspection of every room, identifying condensation hot-spots and recommending ventilation upgrades (PIV, extractor, trickle vents)."
  },
  {
    // MyJobQuote mould-removal 2026 avg £300/job, Checkatrade room £250–£400 mid £320
    label: "Mould treatment (single room)",
    suggestedPricePence: 32000,
    unit: "room",
    serviceCategory: "mould_treatment",
    description:
      "Fungicidal wash, spore-kill treatment and anti-mould paint applied to affected walls in one room. Includes containment sheeting and PPE."
  }
];

// Drainage Engineer — Checkatrade 2026. Reactive unblocks + CCTV
// surveys dominate demand; patch repair captures the small no-dig
// fix without straying into full relining above the small-job band.
const DRAINAGE_ENGINEER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade drain-unblocking 2026 £100–£220 mid £150
    label: "Single blocked drain clearance (rods + jet)",
    suggestedPricePence: 15000,
    unit: "drain",
    serviceCategory: "drain_unblock",
    description:
      "One-hour reactive unblock of a domestic drain using rods or a small jetting machine. Covers sinks, toilets, gullies and single-run soil stacks."
  },
  {
    // Checkatrade cctv-drain-survey 2026 £200–£350 with report mid £275
    label: "CCTV drain survey with written report",
    suggestedPricePence: 27500,
    unit: "survey",
    serviceCategory: "drain_cctv_survey",
    description:
      "Push-rod camera inspection of the private drain run with photo/video report. Standard pre-purchase or insurance-claim evidence pack."
  },
  {
    // Checkatrade drain-repair 2026 patch-lining from £350 mid £400
    label: "No-dig patch repair (localised fracture)",
    suggestedPricePence: 40000,
    unit: "patch",
    serviceCategory: "drain_patch_repair",
    description:
      "Single resin-impregnated patch cured in place to seal a localised crack or displaced joint. Avoids excavation for defects under 1m long."
  },
  {
    // ASL / Checkatrade 2026 £80–£150/m 100mm mid £115/m
    label: "Drain relining (per metre, 100mm pipe)",
    suggestedPricePence: 11500,
    unit: "linear metre",
    serviceCategory: "drain_reline",
    description:
      "No-dig CIPP liner installed through existing pipe to seal cracks and root ingress. Priced per metre of 100mm domestic drain."
  },
  {
    // Checkatrade build-over 2026 £200–£450 mid £325
    label: "Build-over / build-near survey (single extension)",
    suggestedPricePence: 32500,
    unit: "survey",
    serviceCategory: "build_over_survey",
    description:
      "CCTV inspection plus signed report to support a water-company build-over/near application when an extension crosses a public sewer."
  }
];

// Pest Control — Checkatrade + QuickPestControl 2026. Wasp nests +
// rodents dominate call volume; bed bugs + bird proofing round out
// the top asks.
const PEST_CONTROL_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade pest-control 2026 £80–£200/nest mid £95
    label: "Wasp or hornet nest treatment (single nest)",
    suggestedPricePence: 9500,
    unit: "nest",
    serviceCategory: "wasp_nest_treat",
    description:
      "Single-visit insecticidal-dust treatment of one accessible nest. Includes safety PPE, cordon and follow-up guidance for 48 hours."
  },
  {
    // Checkatrade rat-exterminator 2026 £150–£240 3-visit mid £180
    label: "Rat treatment (3-visit course)",
    suggestedPricePence: 18000,
    unit: "course",
    serviceCategory: "rat_treatment",
    description:
      "Three-visit rodenticide baiting plan with proofing advice. Covers a single domestic property including loft, kitchen and external burrow points."
  },
  {
    // Checkatrade pest-control 2026 mice from £135/course mid £140
    label: "Mouse treatment (2–3 visit course)",
    suggestedPricePence: 14000,
    unit: "course",
    serviceCategory: "mouse_treatment",
    description:
      "Two-to-three-visit baiting programme with entry-point identification. Standard domestic response to a fresh mouse infestation."
  },
  {
    // Checkatrade / QuickPestControl 2026 £200–£600 mid £320
    label: "Bed bug treatment (single flat, 2 visits)",
    suggestedPricePence: 32000,
    unit: "property",
    serviceCategory: "bed_bug_treatment",
    description:
      "Two-visit insecticide treatment of bedroom(s) and living areas in one flat. Prep sheet issued in advance; residual spray + monitor between visits."
  },
  {
    // Countrywide / Integrum 2026 small install £150–£300 mid £220
    label: "Bird proofing — spikes or netting (small elevation)",
    suggestedPricePence: 22000,
    unit: "install",
    serviceCategory: "bird_proofing",
    description:
      "Install stainless spikes or fine mesh netting to one small elevation (parapet, sill run or dormer) up to first-floor access from ladder."
  }
];

// Asbestos Removal — Checkatrade 2026. Domestic work dominated by
// surveys, Artex removal and small cement-sheet strip-outs; full AIB
// removal sits above the small-job band.
const ASBESTOS_REMOVAL_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade asbestos-survey 2026 2–3 bed £250
    label: "Asbestos management survey (2–3 bed home)",
    suggestedPricePence: 25000,
    unit: "survey",
    serviceCategory: "asbestos_management_survey",
    description:
      "Non-intrusive walk-round survey with sampling and UKAS-lab analysis. Meets HSG264 for landlord/property-manager duty-to-manage requirements."
  },
  {
    // Checkatrade asbestos-survey 2026 refurb mid £450
    label: "Asbestos refurbishment / demolition survey (per property)",
    suggestedPricePence: 45000,
    unit: "survey",
    serviceCategory: "asbestos_refurb_demo_survey",
    description:
      "Intrusive HSG264 refurbishment survey required before notifiable works. Includes lifting, drilling and sampling with lab-analysed report."
  },
  {
    // Checkatrade artex-removal 2026 non-asbestos £8–£15/m² mid £12
    label: "Textured coating removal — non-asbestos (per m²)",
    suggestedPricePence: 1200,
    unit: "m²",
    serviceCategory: "artex_removal",
    description:
      "Steam-off or gel-strip removal of confirmed non-asbestos textured coating. Priced per square metre of ceiling or wall, ready for skim."
  },
  {
    // Checkatrade artex-removal 2026 asbestos £20–£50/m² mid £35
    label: "Asbestos-containing Artex removal (per m²)",
    suggestedPricePence: 3500,
    unit: "m²",
    serviceCategory: "artex_removal",
    description:
      "Licensed wet-strip removal of asbestos textured coating with enclosure, air monitoring and consigned waste disposal. Priced per m²."
  },
  {
    // Checkatrade asbestos-removal 2026 cement sheet £50–£80/m² min £400 mid £450
    label: "Asbestos cement garage roof or panel removal (small job)",
    suggestedPricePence: 45000,
    unit: "job",
    serviceCategory: "asbestos_cement_removal",
    description:
      "Careful removal of asbestos-cement roof sheets, downpipes or panels from one small outbuilding. Includes wrap, consigned transfer note and tip fees."
  }
];

// Sash Window Restorer — Checkatrade sash-window-refurbishment 2026.
// Overhauls + draught-strip dominate; cord replacement is the classic
// single-visit call.
const SASH_WINDOW_RESTORER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade sash-window-refurbishment 2026 £620–£920 mid £770
    label: "Full sash window overhaul (per window)",
    suggestedPricePence: 77000,
    unit: "window",
    serviceCategory: "sash_window_overhaul",
    description:
      "Strip, service and rebalance one box-sash: renew cords, ease sashes, fill splits, service pulleys and re-paint beads. Excludes glass replacement."
  },
  {
    // Checkatrade sash-window-cord-repair 2026 all four cords ~£150
    label: "Sash cord replacement (all 4 cords, per window)",
    suggestedPricePence: 15000,
    unit: "window",
    serviceCategory: "sash_cord_replace",
    description:
      "Replace all four sash cords in a box-sash window. Includes removing staff beads, re-weighting sashes and re-fitting parting beads."
  },
  {
    // Checkatrade sash-window-refurbishment 2026 draught-proof £260–£360 mid £318
    label: "Sash draught-proofing (per window)",
    suggestedPricePence: 31800,
    unit: "window",
    serviceCategory: "sash_draught_strip",
    description:
      "Rout-in brush-pile draught strips to meeting rails, staff beads and parting beads. Cuts rattle and air leakage while keeping the sashes operable."
  },
  {
    // UNVERIFIED — trade-forum consensus £180 per sill splice
    label: "Sash timber splice repair (single defect)",
    suggestedPricePence: 18000,
    unit: "repair",
    serviceCategory: "sash_timber_repair",
    description:
      "Cut out one rotten section of sill, stile or bottom rail and splice in a matching hardwood insert. Sanded and primed ready for paint."
  },
  {
    // Checkatrade sash-window-refurbishment 2026 reglaze £120–£220 mid £170
    label: "Sash pane replacement (single glass, up to 0.5m²)",
    suggestedPricePence: 17000,
    unit: "pane",
    serviceCategory: "sash_glass_replace",
    description:
      "Remove broken pane, clean and re-putty rebate, refit new 4mm float or heritage-style glass. Priced per pane up to half a square metre."
  }
];

// Tree Surgeon — Checkatrade + Stump Doctor 2026. Small-tree /
// single-visit anchors so trades edit up for larger jobs.
const TREE_SURGEON_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade crown reduction 2026 — small tree £200–£450 mid £325
    label: "Crown reduction — small tree (up to 8m)",
    suggestedPricePence: 32500,
    unit: "tree",
    serviceCategory: "tree_crown_reduce",
    description:
      "Reduce the crown of a small garden tree by 20–30%. Half-day visit including waste chipping and site tidy."
  },
  {
    // Checkatrade 2026 — small section-fell £400–£700 mid £550
    label: "Section-fell a small tree (garden access)",
    suggestedPricePence: 55000,
    unit: "tree",
    serviceCategory: "tree_dismantle",
    description:
      "Dismantle a small tree in sections where a straight fell isn't safe. Includes rope-down, chipping and green-waste removal; stump left flush."
  },
  {
    // Stump Doctor / MyBuilder 2026 — single medium stump £120–£200 mid £160
    label: "Stump grind — single medium stump",
    suggestedPricePence: 16000,
    unit: "stump",
    serviceCategory: "stump_grind",
    description:
      "Grind a single stump up to ~30cm diameter to 15cm below ground level. Grindings raked back into the hole; additional stumps on the same visit are cheaper."
  },
  {
    // Checkatrade hedge trimming 2026 — 2-hr small hedge visit ~£180
    label: "Hedge trim — up to 2m tall, 10m run",
    suggestedPricePence: 18000,
    unit: "visit",
    serviceCategory: "hedge_trim",
    description:
      "Trim a domestic hedge up to 2m tall and roughly 10m long. Waste bagged and taken away; two-person crew, single visit."
  },
  {
    // Checkatrade / TreeMend 2026 — arb report £150–£350 mid £225
    label: "Tree survey / arb report (single tree)",
    suggestedPricePence: 22500,
    unit: "report",
    serviceCategory: "tree_survey",
    description:
      "Written condition report on a single mature tree for planning, insurance or neighbour dispute. Photographs, defect notes and management recommendation included."
  }
];

// Garden Designer — Checkatrade + MyBuilder 2026. Small-scope /
// single-deliverable anchors.
const GARDEN_DESIGNER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade garden design consultation 2026 — £150–£350 mid £225
    label: "On-site design consultation (2 hours)",
    suggestedPricePence: 22500,
    unit: "visit",
    serviceCategory: "garden_design_consult",
    description:
      "Two-hour on-site walk-round with sketch notes and a written brief. Ideal starting point before commissioning a full design."
  },
  {
    // MyBuilder / housedesigner.com 2026 — small garden concept £500–£800 mid £595
    label: "Concept design — small garden (up to 50m²)",
    suggestedPricePence: 59500,
    unit: "design",
    serviceCategory: "garden_concept_design",
    description:
      "Hand-drawn concept plan with mood board, layout options and rough costings. One revision included; suitable for gardens up to about 50m²."
  },
  {
    // UNVERIFIED — trade-forum consensus £950–£1,600
    label: "Detailed design pack — small garden",
    suggestedPricePence: 59900,
    unit: "pack",
    serviceCategory: "garden_detailed_design",
    description:
      "Scaled construction drawings, materials schedule and setting-out plan for a small garden. Priced as a deposit — balance quoted against final scope."
  },
  {
    // MyBuilder garden design 2026 — planting plan only £500–£900 mid £495
    label: "Planting plan (borders & beds)",
    suggestedPricePence: 49500,
    unit: "plan",
    serviceCategory: "garden_planting_plan",
    description:
      "Scaled planting plan with plant list, quantities and seasonal-interest notes for existing beds. Sourcing list optional at extra cost."
  },
  {
    // KG Electrical garden lighting 2026 — design-only £300–£600 mid £395
    label: "Garden lighting design (concept)",
    suggestedPricePence: 39500,
    unit: "design",
    serviceCategory: "lighting_design",
    description:
      "Lighting concept for a small-to-medium garden: fitting schedule, positions, circuits and control notes. Handed to your electrician for install."
  }
];

// Post-Construction Cleaner — Callver + Intercounty + MyBuilder 2026.
// Per-m² and single-room anchors.
const POST_CONSTRUCTION_CLEANER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // MyBuilder after-builders 2026 — £2–£4/m² mid £3
    label: "Post-build rough clean",
    suggestedPricePence: 300,
    unit: "m²",
    serviceCategory: "post_build_clean",
    description:
      "First-pass clean after trades finish: dust, debris, plaster splashes and rubble bagged. Priced per m² of internal floor area."
  },
  {
    // Callver + Intercounty 2026 — sparkle clean £3–£8/m² mid £5
    label: "Sparkle / handover clean",
    suggestedPricePence: 500,
    unit: "m²",
    serviceCategory: "sparkle_clean",
    description:
      "Final presentation clean before handover: streak-free glass, polished chrome, snag-touch-ups and every surface client-ready. Priced per m²."
  },
  {
    // MyBuilder after-builders 2026 — single room £130–£220 mid £175
    label: "Single-room deep clean (post-refurb)",
    suggestedPricePence: 17500,
    unit: "room",
    serviceCategory: "single_room_deep_clean",
    description:
      "Deep clean of one refurbished room (up to ~20m²): dust down, hoover, mop, glass, sockets, skirtings and vent grilles. Fixed price, single visit."
  },
  {
    // UNVERIFIED — trade-forum consensus £150–£300 mid £225
    label: "Sticker & protective film removal",
    suggestedPricePence: 22500,
    unit: "property",
    serviceCategory: "sticker_removal",
    description:
      "Remove stickers, protective film and adhesive residue from windows, doors, appliances and sanitaryware across a typical 2–3 bed property."
  },
  {
    // MyBuilder / Callver 2026 — small property sparkle+stage £275–£450 mid £350
    label: "Show-home staging clean",
    suggestedPricePence: 35000,
    unit: "property",
    serviceCategory: "showhome_staging",
    description:
      "Final show-home clean: fingerprint pass, glass, brassware polish, mirror finish on floors, cushions and dressings straightened. Priced per visit for a small unit."
  }
];

// Mobile Mechanic (plant / fleet — NOT car workshop). Sources: Sutro
// Services + JG Plant + Excavatorrepairs.co.uk 2026.
const MOBILE_MECHANIC_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Sutro / JG Plant 2026 — on-site visit £120–£250 mid £180
    label: "On-site plant service visit (per hour, min 2 hr)",
    suggestedPricePence: 9000,
    unit: "hour",
    serviceCategory: "plant_service_visit",
    description:
      "Mobile fitter attends your site with a fully-stocked service van. Two-hour minimum charge covers travel + first hour on tools."
  },
  {
    // Excavatorrepairs / Reed plant fitter 2026 — mobile day £420–£600 mid £495
    label: "Plant fitter day rate (on-site)",
    suggestedPricePence: 49500,
    unit: "day",
    serviceCategory: "plant_service_day_rate",
    description:
      "One qualified plant fitter on your site for a full 8-hour day. Van, consumables and standard hand tools included; parts billed separately."
  },
  {
    // JG Plant / Sutro 2026 — emergency call-out £150–£280 mid £195
    label: "Plant breakdown call-out (same-day)",
    suggestedPricePence: 19500,
    unit: "call-out",
    serviceCategory: "plant_repair_call_out",
    description:
      "Same-day mobile response to a broken-down excavator, telehandler or dumper. Fixed call-out fee covers travel and first hour on-site; parts and further hours quoted on arrival."
  },
  {
    // JG Plant / Excavatorrepairs 2026 — 500-hour service 3-8T excavator £220–£380 mid £295
    label: "Oil & filter service — mini/midi excavator",
    suggestedPricePence: 29500,
    unit: "machine",
    serviceCategory: "oil_service_plant",
    description:
      "500-hour scheduled service on a 3–8t excavator: engine oil, filters (oil, fuel, air, hydraulic return), grease points, level check. Oils and filters included."
  },
  {
    // TraderStreet / mobile-mechanics.uk 2026 — LGV mobile visit £180–£320 mid £245
    label: "Tipper / LGV mobile service visit",
    suggestedPricePence: 24500,
    unit: "vehicle",
    serviceCategory: "tipper_service",
    description:
      "Mobile service visit for a 3.5–7.5t tipper or LGV: oil, filters, brake check, tipping-gear inspection, pre-MOT snag list. Priced per vehicle at your yard."
  }
];

// Flooring Installer (LVT / hardwood / subfloor — distinct from the
// existing FLOORING template which is laminate/carpet/tile). Sources:
// Checkatrade LVT 2026 + FlooringWholesale + MyJobQuote 2026.
const FLOORING_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade LVT 2026 — click LVT fit £15–£25/m² mid £20
    label: "LVT click-fit installation",
    suggestedPricePence: 2000,
    unit: "m²",
    serviceCategory: "lvt_click_fit",
    description:
      "Supply-and-fit-labour for click LVT over a prepared subfloor. Cuts, scribes to skirting and threshold bars included; minimum charge on small rooms."
  },
  {
    // Checkatrade / FlooringWholesale 2026 — glue-down LVT £22–£32/m² mid £27
    label: "LVT glue-down installation",
    suggestedPricePence: 2700,
    unit: "m²",
    serviceCategory: "lvt_glue_fit",
    description:
      "Glue-down LVT install with pressure-sensitive adhesive on a fully prepared subfloor. Priced per m² of finished floor; adhesive included."
  },
  {
    // MyJobQuote LVT 2026 — herringbone £35–£50/m² mid £42
    label: "Herringbone floor fit (LVT or engineered)",
    suggestedPricePence: 4200,
    unit: "m²",
    serviceCategory: "herringbone_fit",
    description:
      "Precision herringbone lay-out for LVT or engineered wood planks. Includes setting-out, borders and mitre cuts; roughly double the labour time of a straight lay."
  },
  {
    // MyJobQuote screed 2026 — latex level £25–£40/m² mid £30
    label: "Subfloor levelling (latex screed)",
    suggestedPricePence: 3000,
    unit: "m²",
    serviceCategory: "subfloor_level",
    description:
      "Prime and pour self-levelling latex compound to correct dips and slopes before the finished floor goes down. Compound, primer and labour included."
  },
  {
    // UNVERIFIED — trade-forum consensus £4–£7/m² mid £5
    label: "Underlay fit (per m²)",
    suggestedPricePence: 500,
    unit: "m²",
    serviceCategory: "underlay_fit",
    description:
      "Cut and tape-fit acoustic or thermal underlay before floor installation. Priced per m²; add-on to any LVT, engineered or laminate lay."
  }
];

// Smart Home Installer — Checkatrade smart lighting / Nest / Hive
// + MyBuilder smart home 2026 + SmartHomeSounds UK.
const SMART_HOME_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade smart lighting 2026 — £200–£500 per room mid £350
    label: "Smart lighting — 1 room (fit switches + commission)",
    suggestedPricePence: 35000,
    unit: "room",
    serviceCategory: "smart_lighting_install",
    description:
      "Fit smart switches or dimmers on one room's existing circuit and commission to the customer's app. Bulbs and hardware supplied by you."
  },
  {
    // Checkatrade Nest / Hive 2026 — labour+basic ~£220 mid
    label: "Smart thermostat install (Nest / Hive / Tado)",
    suggestedPricePence: 22000,
    unit: "thermostat",
    serviceCategory: "smart_heating_install",
    description:
      "Swap an existing programmer/thermostat for a Nest, Hive or Tado unit. Wired in, paired to boiler, app set up on 1 phone."
  },
  {
    // MyBuilder smart home 2026 — hub + pairing £120–£200 mid £150
    label: "Smart hub install & device pairing (up to 10 devices)",
    suggestedPricePence: 15000,
    unit: "hub",
    serviceCategory: "smart_hub_install",
    description:
      "Mount and configure a smart hub (Hue Bridge, SmartThings, Home Assistant Green) and pair up to 10 existing devices to it."
  },
  {
    // SmartHomeSounds UK 2026 — 1-room wireless pair install mid £220
    label: "Sonos pair install — 1 room (customer-supplied speakers)",
    suggestedPricePence: 22000,
    unit: "room",
    serviceCategory: "sonos_av_install",
    description:
      "Mount and commission a Sonos stereo pair or soundbar/sub combo in one room. Network onboarding, room-tune and app handover included."
  },
  {
    // MyBuilder smart home 2026 — initial-visit fee £75–£150 mid £120
    label: "Smart home survey & written design plan",
    suggestedPricePence: 12000,
    unit: "visit",
    serviceCategory: "smart_home_survey",
    description:
      "Up to 1-hour on-site survey covering wiring, wifi coverage and device wishlist, followed by a written plan and itemised quote."
  }
];

// Garage Door Installer — Checkatrade + Associated Garage Doors +
// TWF Roller + DoorFixPro 2026.
const GARAGE_DOOR_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade + Associated Garage Doors 2026 — single manual £900–£1,650 mid £1,200
    label: "Up-and-over garage door — 1 single, supply & fit",
    suggestedPricePence: 120000,
    unit: "door",
    serviceCategory: "up_and_over_garage_door",
    description:
      "Remove existing single door and fit a new manual up-and-over including frame, springs and locks. Waste taken away."
  },
  {
    // Checkatrade sectional 2026 — single manual mid £1,600
    label: "Sectional garage door — 1 single, manual, supply & fit",
    suggestedPricePence: 160000,
    unit: "door",
    serviceCategory: "sectional_garage_door",
    description:
      "Fit an insulated sectional door on an existing single opening. New tracks, torsion springs and internal handle set."
  },
  {
    // TWF Roller / MyBuilder 2026 — single electric roller mid £1,700
    label: "Insulated roller garage door — 1 single, electric",
    suggestedPricePence: 170000,
    unit: "door",
    serviceCategory: "roller_garage_door",
    description:
      "Insulated aluminium roller shutter with integrated motor, 2 remotes and safety edge fitted to a single opening."
  },
  {
    // MyBuilder / DoorFixPro 2026 — motor retrofit mid £600
    label: "Electric motor retrofit (existing manual door)",
    suggestedPricePence: 60000,
    unit: "door",
    serviceCategory: "garage_door_motor_add",
    description:
      "Fit a motor kit (Somfy / Hormann / Chamberlain) to a suitable up-and-over or sectional door. Includes wiring, 2 remotes and app pairing."
  },
  {
    // Checkatrade garage door repair 2026 — call-out + basic service mid £150
    label: "Garage door repair / service call-out",
    suggestedPricePence: 15000,
    unit: "visit",
    serviceCategory: "garage_door_repair",
    description:
      "Diagnostic call-out with basic service — lube, balance, safety check and minor adjustment. Parts quoted before fitting."
  }
];

// Shutter Installer — Shutter-Envy + Checkatrade 2026.
const SHUTTER_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Shutter-Envy + Checkatrade 2026 — full-height faux wood mid £350
    label: "Full-height plantation shutter — 1 standard window",
    suggestedPricePence: 35000,
    unit: "window",
    serviceCategory: "plantation_shutter_install",
    description:
      "Supply and fit a full-height faux-wood plantation shutter to one standard casement window (up to 1.2m wide). Colour choice and 5-year warranty."
  },
  {
    // Shutter-Envy 2026 — café-style faux mid £230
    label: "Café-style shutter — 1 standard window",
    suggestedPricePence: 23000,
    unit: "window",
    serviceCategory: "cafe_shutter_install",
    description:
      "Half-height café shutter fitted to the lower portion of a standard window. Keeps light and view at the top, privacy at the bottom."
  },
  {
    // Shutter-Envy + Checkatrade 2026 — tier-on-tier faux mid £420
    label: "Tier-on-tier shutter — 1 standard window",
    suggestedPricePence: 42000,
    unit: "window",
    serviceCategory: "tier_on_tier_shutter",
    description:
      "Independent top and bottom panels on one window. Faux wood, custom sized, hinges and frames included."
  },
  {
    // Shutter-Envy 2026 — MDF entry pricing mid £190
    label: "MDF budget shutter — 1 standard window",
    suggestedPricePence: 19000,
    unit: "window",
    serviceCategory: "plantation_shutter_install",
    description:
      "Paint-finish MDF shutter, full-height, fitted to a single dry indoor casement window. Budget-friendly entry option."
  },
  {
    // UK shutter installer norms — refundable measure visit mid £70
    label: "Survey & measure visit (credited to order)",
    suggestedPricePence: 7000,
    unit: "visit",
    serviceCategory: "shutter_measure_visit",
    description:
      "On-site measure and product recommendation. Fee credited in full against any shutter order placed within 30 days."
  }
];

// Aerial & Satellite Installer — Checkatrade + tv-aerials.co.uk +
// MyBuilder + MyJobQuote 2026.
const AERIAL_SATELLITE_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade + tv-aerials.co.uk 2026 — rooftop install mid £190
    label: "Freeview aerial install — rooftop, single point",
    suggestedPricePence: 19000,
    unit: "aerial",
    serviceCategory: "freeview_aerial_install",
    description:
      "New high-gain Yagi aerial installed on chimney or gable, one TV point cabled in, aligned and signal-tested. 12-month workmanship guarantee."
  },
  {
    // MyJobQuote satellite 2026 + Checkatrade — Sky minidish fresh install mid £200
    label: "Sky-style satellite dish install — 1 point",
    suggestedPricePence: 20000,
    unit: "dish",
    serviceCategory: "sky_dish_install",
    description:
      "Zone 1 or Zone 2 Sky minidish mounted, aligned to 28.2°E and cabled to one receiver point. Existing Sky subscription assumed."
  },
  {
    // MyJobQuote + priceyourjob.co.uk 2026 — Freesat dish + install mid £220
    label: "Freesat dish install (no subscription)",
    suggestedPricePence: 22000,
    unit: "dish",
    serviceCategory: "freesat_install",
    description:
      "Freesat dish and quad-LNB installed and aligned, cabled to one Freesat receiver point for free-to-air satellite TV."
  },
  {
    // Checkatrade + MyBuilder 2026 — realign / call-out mid £90
    label: "Aerial re-align or fault call-out",
    suggestedPricePence: 9000,
    unit: "visit",
    serviceCategory: "aerial_realign",
    description:
      "Diagnostic visit for weak or lost signal. Includes re-aim, cable & connector check, and one signal report per TV point."
  },
  {
    // digital-aerial-installations.co.uk + Bark 2026 — 4-flat MATV mid £600
    label: "Communal MATV upgrade — up to 4 flats",
    suggestedPricePence: 60000,
    unit: "system",
    serviceCategory: "communal_matv_install",
    description:
      "Amplifier, splitter and cabling upgrade for a small block of up to 4 flats. One rooftop aerial feeding all points, signal-tested per unit."
  }
];

// Awning Installer — MyBuilder + MyJobQuote + Samson Awnings +
// Winchester Awnings + Intelroll 2026.
const AWNING_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // MyBuilder awning 2026 + Intelroll — 3-4m manual mid £650
    label: "Manual retractable awning — up to 4m, supply & fit",
    suggestedPricePence: 65000,
    unit: "awning",
    serviceCategory: "retractable_awning_install",
    description:
      "Semi-cassette manual retractable awning up to 4m wide, fitted to a solid brick or block wall. Winder handle and standard fabric choice."
  },
  {
    // MyJobQuote awning 2026 + Winchester — motorised 3-4m mid £1,500
    label: "Motorised retractable awning — up to 4m, supply & fit",
    suggestedPricePence: 150000,
    unit: "awning",
    serviceCategory: "motorised_awning_install",
    description:
      "Somfy-motor retractable awning up to 4m with wall switch and 1 remote. Wired to a nearby fused spur (electrician co-ordination optional)."
  },
  {
    // Samson Awnings 2026 — full cassette 3.5-4m motorised mid £2,200
    label: "Full-cassette motorised awning — up to 4m",
    suggestedPricePence: 220000,
    unit: "awning",
    serviceCategory: "cassette_awning_install",
    description:
      "Fully-enclosed cassette awning with motor and wind sensor. Fabric fully protected when retracted; premium finish for exposed patios."
  },
  {
    // MyBuilder + Checkatrade 2026 — 3x3m aluminium gazebo mid £1,200
    label: "Freestanding aluminium gazebo — 3m x 3m",
    suggestedPricePence: 120000,
    unit: "gazebo",
    serviceCategory: "freestanding_gazebo_install",
    description:
      "3m x 3m aluminium freestanding gazebo with adjustable louvres, base-fixed to slabs or a prepared concrete pad. Assembly and level-set included."
  },
  {
    // UNVERIFIED — trade-forum consensus + Samson service 2026 mid £150
    label: "Awning service / re-tension / winter check",
    suggestedPricePence: 15000,
    unit: "visit",
    serviceCategory: "awning_service",
    description:
      "Annual service visit — check arms, brackets, motor limits and fabric tension. Small adjustments included, parts quoted before fitting."
  }
];

// Driveway & Patio Installer — Checkatrade + MyBuilder + MyJobQuote 2026.
const DRIVEWAY_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 block paving £90–£130/m² mid £100
    label: "Block paving driveway (supply & lay)",
    suggestedPricePence: 10000,
    unit: "m²",
    serviceCategory: "block_paving_drive",
    description:
      "Standard concrete block paving on prepared sub-base, cut edging and kiln-dried sand joint fill. Priced per m² — most single drives 30–50 m²."
  },
  {
    // Checkatrade / MyBuilder 2026 resin bound £60–£100/m² mid £80
    label: "Resin bound driveway overlay",
    suggestedPricePence: 8000,
    unit: "m²",
    serviceCategory: "resin_bound_drive",
    description:
      "UV-stable resin bound aggregate laid on sound existing base. Permeable finish, no loose stones. Priced per m²."
  },
  {
    // Checkatrade 2026 tarmac driveway ~£90/m²
    label: "Tarmac driveway (single layer)",
    suggestedPricePence: 9000,
    unit: "m²",
    serviceCategory: "tarmac_drive",
    description:
      "Hot-rolled tarmac laid on Type 1 sub-base with steel edging. Priced per m² — typical single drive 40–60 m²."
  },
  {
    // Checkatrade 2026 driveway seal £5–£17/m² mid £8
    label: "Driveway clean & seal (block paving)",
    suggestedPricePence: 800,
    unit: "m²",
    serviceCategory: "drive_reseal",
    description:
      "Pressure wash, re-sand and apply a polymer sealer to block paving. Refreshes colour and locks joints for ~3 years."
  },
  {
    // MyBuilder / Checkatrade — small drive patch/pothole repair £150–£400 mid £250
    label: "Small driveway repair / pothole patch",
    suggestedPricePence: 25000,
    unit: "visit",
    serviceCategory: "drive_repair",
    description:
      "Cut out and replace a failed section of block, tarmac or concrete drive up to ~2 m². One visit including materials."
  }
];

// Fencing Installer — Checkatrade + MyBuilder 2026.
const FENCING_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 closeboard/feather edge £110–£150/m mid £130
    label: "Feather-edge fence (1.8m) supply & install",
    suggestedPricePence: 13000,
    unit: "m",
    serviceCategory: "feather_edge_fence",
    description:
      "1.8m feather-edge fence with concrete posts, gravel boards and pressure-treated pales. Priced per linear metre installed."
  },
  {
    // MyBuilder 2026 closeboard £50–£75/m mid £70/m ≈ £110/panel
    label: "Closeboard fence panel (6ft) supply & fit",
    suggestedPricePence: 11000,
    unit: "panel",
    serviceCategory: "closeboard_fence",
    description:
      "6ft closeboard panel on new concrete posts with gravel board. Includes clearing existing panel and disposal."
  },
  {
    // MyBuilder 2026 panel install ~£71/m; panel+post fit £90–£120 mid £95
    label: "Overlap / lap fence panel + concrete post",
    suggestedPricePence: 9500,
    unit: "panel",
    serviceCategory: "panel_fence_install",
    description:
      "Standard 6ft x 6ft overlap panel fitted onto new concrete post and gravel board. Priced per bay."
  },
  {
    // Checkatrade 2026 softwood side gate mid £450
    label: "Softwood garden gate supply & fit",
    suggestedPricePence: 45000,
    unit: "gate",
    serviceCategory: "garden_gate_fit",
    description:
      "Standard softwood side gate up to 1.8m tall, hung on existing posts with new hinges, latch and drop bolt."
  },
  {
    // MyBuilder 2026 single panel replace £150–£300 mid £180
    label: "Replace single fence panel (existing posts)",
    suggestedPricePence: 18000,
    unit: "panel",
    serviceCategory: "fence_panel_replace",
    description:
      "Remove damaged panel and fit like-for-like replacement onto existing sound concrete posts. Panel included."
  }
];

// Garden Room Installer — Checkatrade + MyJobQuote + Backyard Cabins 2026.
const GARDEN_ROOM_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade / MyJobQuote 2026 12–15m² £20k–£38k mid £28k
    label: "Small garden room install (up to 15m²)",
    suggestedPricePence: 2800000,
    unit: "room",
    serviceCategory: "garden_room_install",
    description:
      "Timber-frame garden room up to 15m² — insulated walls, EPDM roof, double glazing, one door. Excludes groundwork and electrics."
  },
  {
    // Backyard Cabins 2026 SIPs studio installed from ~£15,450 mid £18,500
    label: "SIPs garden studio install (small)",
    suggestedPricePence: 1850000,
    unit: "studio",
    serviceCategory: "garden_studio_install",
    description:
      "Structural insulated panel studio up to ~12m², factory-precut kit erected on prepared base. High U-value envelope for year-round use."
  },
  {
    // MyBuilder / MyJobQuote 2026 concrete base £1,000–£2,500 mid £1,800
    label: "Concrete base for garden room (up to 15m²)",
    suggestedPricePence: 180000,
    unit: "base",
    serviceCategory: "garden_room_base",
    description:
      "Excavate, hardcore, DPM and reinforced concrete slab sized for a garden room up to 15m². Level within 10mm ready for build."
  },
  {
    // Checkatrade 2026 garden room electrics £2,500–£3,500 mid £2,500
    label: "Garden room electrics (SWA + circuits)",
    suggestedPricePence: 250000,
    unit: "room",
    serviceCategory: "garden_room_electrics",
    description:
      "SWA cable run from house consumer unit, new sub-CU in garden room, sockets, lighting and heater circuit. NICEIC certified."
  },
  {
    // Checkatrade 2026 — 15m² insulation upgrade £1,500–£2,500 mid £2,000
    label: "Garden room insulation upgrade",
    suggestedPricePence: 200000,
    unit: "room",
    serviceCategory: "garden_room_insulate",
    description:
      "Strip existing lining, upgrade to 100mm PIR in walls and roof, VCL and re-line. Turns a summerhouse into year-round office."
  }
];

// Conservatory Installer — Checkatrade + MyJobQuote / BestBuilders 2026.
const CONSERVATORY_INSTALLER_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Checkatrade 2026 Victorian/Edwardian uPVC 12m² £12k–£18k mid £15k
    label: "Victorian / Edwardian conservatory (uPVC, ~12m²)",
    suggestedPricePence: 1500000,
    unit: "install",
    serviceCategory: "conservatory_install",
    description:
      "Mid-spec uPVC Victorian or Edwardian conservatory up to ~12m² with dwarf wall, glass roof and French doors. Turnkey install."
  },
  {
    // Checkatrade / MyBuilder 2026 lean-to small uPVC £8k–£13k mid £10.5k
    label: "Lean-to conservatory (uPVC, small)",
    suggestedPricePence: 1050000,
    unit: "install",
    serviceCategory: "lean_to_install",
    description:
      "Compact uPVC lean-to up to ~10m² with polycarbonate or glass roof, dwarf wall and single door. Ideal side-return."
  },
  {
    // Checkatrade 2026 orangery small 10–16m² £25k–£45k mid £30k
    label: "Small orangery install (10–16m²)",
    suggestedPricePence: 3000000,
    unit: "install",
    serviceCategory: "orangery_install",
    description:
      "Small orangery 10–16m² with masonry piers, lantern roof, plastered internal pelmet and bi-fold or French doors. Excludes electrics."
  },
  {
    // Checkatrade 2026 conservatory roof replacement ~£10,000
    label: "Conservatory roof replacement (solid/tiled)",
    suggestedPricePence: 1000000,
    unit: "roof",
    serviceCategory: "conservatory_reroof",
    description:
      "Swap polycarbonate for insulated solid/tiled roof on an existing 3.5m x 3.5m conservatory. Includes internal plastered finish."
  },
  {
    // Checkatrade 2026 conservatory clean £150–£350 mid £180
    label: "Conservatory deep clean (inside + out)",
    suggestedPricePence: 18000,
    unit: "visit",
    serviceCategory: "conservatory_clean",
    description:
      "Full valet of glass, frames and roof inside and out. Removes algae, moss and green streaks. Single visit for standard 12m²."
  }
];

// Water Pump Service — Checkatrade + MyBuilder + Sumps and Pumps UK 2026.
const PUMP_SERVICE_TEMPLATE: QuickPriceTemplate[] = [
  {
    // Pumping Solutions / Checkatrade 2026 borehole pump pack £1,600–£3,000 mid £2,400
    label: "Borehole pump install (domestic)",
    suggestedPricePence: 240000,
    unit: "pump",
    serviceCategory: "borehole_pump_install",
    description:
      "Supply and fit a 4-inch domestic submersible borehole pump with rising main, controls and wellhead. Existing borehole assumed."
  },
  {
    // Sumps and Pumps UK / Hamuch 2026 basement sump £1,500–£3,500 mid £2,000
    label: "Sump pump install (basement / cellar)",
    suggestedPricePence: 200000,
    unit: "pump",
    serviceCategory: "sump_pump_install",
    description:
      "Chase out sump chamber, fit twin-pump station with float switches, discharge to gully. Excludes battery backup."
  },
  {
    // Checkatrade 2026 sewage treatment plant £9,000–£11,000 mid £9,500
    label: "Foul / sewage pump station install",
    suggestedPricePence: 950000,
    unit: "station",
    serviceCategory: "sewage_pump_install",
    description:
      "Below-ground packaged sewage pump station up to 6-person, connected to existing foul run. Includes control panel and alarm."
  },
  {
    // Checkatrade / MyBuilder 2026 booster £250–£450 mid £400
    label: "Water booster pump install (mains or shower)",
    suggestedPricePence: 40000,
    unit: "pump",
    serviceCategory: "booster_pump_install",
    description:
      "Supply and fit a WRAS-approved 12 l/min mains booster or twin shower pump to lift low pressure. Includes isolation valves and test."
  },
  {
    // Durapump / TT Pumps 2026 annual service £120–£250 mid £150
    label: "Pump annual service visit",
    suggestedPricePence: 15000,
    unit: "visit",
    serviceCategory: "pump_service_visit",
    description:
      "Annual service of a domestic sump, borehole or booster pump — inspect impeller, clean chamber, test floats and alarm, minor adjustments."
  }
];

// Maps primary_trade slug → the template. Extend as new trades ship.
// Slugs match src/lib/tradeOff.ts TRADE_OFF_TRADES.
const TEMPLATE_BY_TRADE: Record<string, QuickPriceTemplate[]> = {
  carpenter: CARPENTER_TEMPLATE,
  joiner: CARPENTER_TEMPLATE,
  "kitchen-fitter": CARPENTER_TEMPLATE,
  "trim-carpenter": CARPENTER_TEMPLATE,
  plumber: PLUMBER_TEMPLATE,
  "bathroom-fitter": PLUMBER_TEMPLATE,
  "gas-engineer": PLUMBER_TEMPLATE,
  "heating-engineer": PLUMBER_TEMPLATE,
  electrician: ELECTRICIAN_TEMPLATE,
  "flooring-fitter": FLOORING_TEMPLATE,
  "tile-fitter": FLOORING_TEMPLATE,
  "carpet-fitter": FLOORING_TEMPLATE,
  roofer: ROOFER_TEMPLATE,
  "window-fitter": ROOFER_TEMPLATE,
  handyman: HANDYMAN_TEMPLATE,
  // Interior finish
  painter: PAINTER_TEMPLATE,
  tiler: TILER_TEMPLATE,
  plasterer: PLASTERER_TEMPLATE,
  drywaller: DRYWALLER_TEMPLATE,
  "taper-and-finisher": TAPER_AND_FINISHER_TEMPLATE,
  // Masonry & groundworks
  bricklayer: BRICKLAYER_TEMPLATE,
  "block-layer": BLOCK_LAYER_TEMPLATE,
  groundworker: GROUNDWORKER_TEMPLATE,
  "concrete-specialist": CONCRETE_SPECIALIST_TEMPLATE,
  "concrete-finisher": CONCRETE_FINISHER_TEMPLATE,
  // External / roofing extras / landscape
  "fascia-and-soffit": FASCIA_AND_SOFFIT_TEMPLATE,
  "lead-worker": LEAD_WORKER_TEMPLATE,
  "gutter-installer": GUTTER_INSTALLER_TEMPLATE,
  "chimney-sweep": CHIMNEY_SWEEP_TEMPLATE,
  landscaper: LANDSCAPER_TEMPLATE,
  // Modern install
  "solar-installer": SOLAR_INSTALLER_TEMPLATE,
  "ev-charger-installer": EV_CHARGER_INSTALLER_TEMPLATE,
  "heat-pump-installer": HEAT_PUMP_INSTALLER_TEMPLATE,
  "door-fitter": DOOR_FITTER_TEMPLATE,
  "security-installer": SECURITY_INSTALLER_TEMPLATE,
  // Specialist repair
  "damp-proofer": DAMP_PROOFER_TEMPLATE,
  "drainage-engineer": DRAINAGE_ENGINEER_TEMPLATE,
  "pest-control": PEST_CONTROL_TEMPLATE,
  "asbestos-removal": ASBESTOS_REMOVAL_TEMPLATE,
  "sash-window-restorer": SASH_WINDOW_RESTORER_TEMPLATE,
  // Trees / garden design / cleaning / mobile mechanic / flooring installer
  "tree-surgeon": TREE_SURGEON_TEMPLATE,
  "garden-designer": GARDEN_DESIGNER_TEMPLATE,
  "post-construction-cleaner": POST_CONSTRUCTION_CLEANER_TEMPLATE,
  "mobile-mechanic": MOBILE_MECHANIC_TEMPLATE,
  "flooring-installer": FLOORING_INSTALLER_TEMPLATE,
  // Modern add-on installers
  "smart-home-installer": SMART_HOME_INSTALLER_TEMPLATE,
  "garage-door-installer": GARAGE_DOOR_INSTALLER_TEMPLATE,
  "shutter-installer": SHUTTER_INSTALLER_TEMPLATE,
  "aerial-satellite-installer": AERIAL_SATELLITE_INSTALLER_TEMPLATE,
  "awning-installer": AWNING_INSTALLER_TEMPLATE,
  // External build & garden install
  "driveway-installer": DRIVEWAY_INSTALLER_TEMPLATE,
  "fencing-installer": FENCING_INSTALLER_TEMPLATE,
  "garden-room-installer": GARDEN_ROOM_INSTALLER_TEMPLATE,
  "conservatory-installer": CONSERVATORY_INSTALLER_TEMPLATE,
  "pump-service": PUMP_SERVICE_TEMPLATE
};

/** Returns the starter template for a given primary_trade slug, or
 *  an empty array if we don't have one for that trade. The UI renders
 *  a generic "build your own from the taxonomy" flow in the empty case. */
export function quickPricesFor(primaryTrade: string | null | undefined): QuickPriceTemplate[] {
  if (!primaryTrade) return [];
  return TEMPLATE_BY_TRADE[primaryTrade] ?? [];
}
