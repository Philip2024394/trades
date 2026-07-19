// Trade Off — shared constants used by the directory pages, signup wizard,
// API routes, and the auto-Hammerex-Standard badge logic.

export const TRADE_OFF_TRADES: Array<{
  slug: string;
  label: string;
  category_slug: string | null;
}> = [
  { slug: "drywaller", label: "Drywaller", category_slug: "drywall" },
  { slug: "plasterer", label: "Plasterer", category_slug: "plastering" },
  { slug: "electrician", label: "Electrician", category_slug: "electrical" },
  { slug: "scaffolder", label: "Scaffolder", category_slug: "scaffolding" },
  { slug: "tiler", label: "Tiler", category_slug: "tiling" },
  { slug: "plumber", label: "Plumber", category_slug: "plumbing" },
  { slug: "carpenter", label: "Carpenter", category_slug: "carpentry" },
  { slug: "joiner", label: "Joiner", category_slug: "carpentry" },
  { slug: "painter", label: "Painter & Decorator", category_slug: "painting" },
  { slug: "roofer", label: "Roofer", category_slug: "roofing" },
  { slug: "bricklayer", label: "Bricklayer", category_slug: "bricklaying" },
  { slug: "stonemason", label: "Stonemason", category_slug: null },
  { slug: "groundworker", label: "Groundworker", category_slug: null },
  { slug: "general-builder", label: "General Builder", category_slug: null },
  { slug: "concrete-specialist", label: "Concrete Specialist", category_slug: "concrete" },
  { slug: "renderer", label: "Renderer", category_slug: "plastering" },
  { slug: "taper-and-finisher", label: "Taper & Finisher", category_slug: "drywall" },
  // Building merchant — supply side of construction, not a trade in the
  // boots-on-site sense, but registers as a slug so Wholesale Mode +
  // Materials Network audiences can sign up with their own profile.
  { slug: "building-merchant", label: "Building Merchant", category_slug: null },
  // Metal engineer — welders, fabricators, structural-steel work.
  { slug: "metal-engineer", label: "Metal Engineer", category_slug: null },
  // Heavy site machinery — plant hire, excavator / crane / digger
  // operators, site equipment rental.
  { slug: "heavy-machinery", label: "Heavy Site Machinery", category_slug: null },
  // Tool hire — hand tools, power tools, access kit rental.
  { slug: "tool-hire", label: "Tool Hire", category_slug: null },
  // Landscaper — garden design, turfing, patios, planting.
  { slug: "landscaper", label: "Landscaper", category_slug: null },
  // Gas engineer — Gas Safe regulated work, boilers, gas installation.
  { slug: "gas-engineer", label: "Gas Engineer", category_slug: null },
  // Concrete finisher — troweling, polishing, sealing (distinct from
  // the existing concrete-specialist which does formwork + placing).
  { slug: "concrete-finisher", label: "Concrete Finisher", category_slug: "concrete" },
  // Stair installation — fitting service for staircases (labour
  // only; manufacture + sales are separate slugs). Slug kept as
  // stair-fitter so existing URLs / listings keep working.
  { slug: "stair-fitter", label: "Stair Installation", category_slug: "carpentry" },
  // Kitchen installation — fitting service. Slug kept as kitchen-fitter
  // for URL stability; label clarifies the work-type.
  { slug: "kitchen-fitter", label: "Kitchen Installation", category_slug: "carpentry" },
  // Window installation — fitting service. Slug kept as window-fitter.
  { slug: "window-fitter", label: "Window Installation", category_slug: null },
  // Crane operator — site crane hire + qualified operator (CPCS / NPORS).
  { slug: "crane-operator", label: "Crane Operator", category_slug: null },
  // Security installer — CCTV, alarms, access control, intercoms.
  { slug: "security-installer", label: "Security Installer", category_slug: null },
  // Builders supplies — small specialist supply shop (distinct from the
  // larger building-merchant slug which targets multi-yard merchants).
  { slug: "builders-supplies", label: "Builders Supplies", category_slug: null },
  // Formworker — builds the timber / steel molds that hold concrete
  // pours. Distinct from concrete-specialist (placing) and
  // concrete-finisher (troweling + sealing).
  { slug: "formworker", label: "Formworker", category_slug: "concrete" },
  // Insulation installer — spray foam, cellulose, mineral wool, batt
  // insulation install for residential + commercial.
  { slug: "insulation-installer", label: "Insulation Installer", category_slug: null },
  // Trim carpenter — finish carpentry specialist: crown molding,
  // baseboards, doors, casing, built-ins. Distinct from general
  // carpenter (structural / framing).
  { slug: "trim-carpenter", label: "Trim Carpenter", category_slug: "carpentry" },
  // Block layer — concrete block / breeze block masonry, distinct from
  // bricklayer (clay/brick masonry). Common on commercial walls,
  // foundations, retaining walls.
  { slug: "block-layer", label: "Block Layer", category_slug: "bricklaying" },
  // Site safety — CDM / SMSTS / safety supervisor — temporary works,
  // toolbox talks, edge protection, scaffolding inspections.
  { slug: "site-safety", label: "Site Safety", category_slug: null },
  // Water drilling — borehole, well, ground-source water extraction +
  // diamond core drilling for service penetrations.
  { slug: "water-drilling", label: "Water Drilling", category_slug: null },
  // Fascia & soffit — uPVC + timber roofline replacement, fascias,
  // soffits, guttering. Usually paired with roofers.
  { slug: "fascia-and-soffit", label: "Fascia & Soffit", category_slug: "roofing" },
  // Demolition — controlled strip-outs, soft-strip, structural
  // demolition with plant. Includes asbestos-aware contractors.
  { slug: "demolition", label: "Demolition", category_slug: null },
  // Site canteen — mobile catering vans + on-site kitchen services
  // for construction crews. Breakfast rolls, bacon butties, hot meals.
  { slug: "site-canteen", label: "Site Canteen", category_slug: null },

  // ─── Phase 2 expansion — Trade Service additions ────────────────
  { slug: "damp-proofer", label: "Damp Proofer", category_slug: null },
  { slug: "drainage-engineer", label: "Drainage Engineer", category_slug: null },
  { slug: "chimney-sweep", label: "Chimney Sweep", category_slug: null },
  { slug: "tree-surgeon", label: "Tree Surgeon", category_slug: null },
  { slug: "pest-control", label: "Pest Control", category_slug: null },
  { slug: "asbestos-removal", label: "Asbestos Removal", category_slug: null },
  { slug: "lead-worker", label: "Lead Worker", category_slug: "roofing" },
  { slug: "sash-window-restorer", label: "Sash Window Restorer", category_slug: null },
  { slug: "post-construction-cleaner", label: "Post-Construction Cleaner", category_slug: null },
  { slug: "garden-designer", label: "Garden Designer", category_slug: null },
  // Mobile mechanic — on-site fleet + plant servicing. Mobile vans
  // visiting construction sites to fix excavators, telehandlers,
  // tippers, etc. Distinct from a workshop-based car mechanic.
  { slug: "mobile-mechanic", label: "Mobile Mechanic", category_slug: null },
  // Water pump service — borehole, basement sump, sewage and
  // booster pump installation + servicing. Common in groundworks
  // and after-flood remediation.
  { slug: "pump-service", label: "Water Pump Service", category_slug: "plumbing" },

  // ─── Trade Installation additions ─────────────────────────────────
  { slug: "door-fitter", label: "Door Fitter", category_slug: "carpentry" },
  { slug: "flooring-installer", label: "Flooring Installer", category_slug: null },
  { slug: "bathroom-fitter", label: "Bathroom Fitter", category_slug: "plumbing" },
  { slug: "conservatory-installer", label: "Conservatory Installer", category_slug: null },
  { slug: "solar-installer", label: "Solar Installer", category_slug: "electrical" },
  { slug: "ev-charger-installer", label: "EV Charger Installer", category_slug: "electrical" },
  { slug: "heat-pump-installer", label: "Heat Pump Installer", category_slug: "plumbing" },
  { slug: "smart-home-installer", label: "Smart Home Installer", category_slug: "electrical" },
  { slug: "garage-door-installer", label: "Garage Door Installer", category_slug: null },
  { slug: "gutter-installer", label: "Gutter Installer", category_slug: "roofing" },
  { slug: "driveway-installer", label: "Driveway & Patio Installer", category_slug: null },
  { slug: "fencing-installer", label: "Fencing Installer", category_slug: null },
  { slug: "shutter-installer", label: "Shutter Installer", category_slug: null },
  { slug: "aerial-satellite-installer", label: "Aerial & Satellite Installer", category_slug: "electrical" },
  { slug: "garden-room-installer", label: "Garden Room Installer", category_slug: null },
  { slug: "awning-installer", label: "Awning & Canopy Installer", category_slug: null },

  // ─── Manufacture additions ────────────────────────────────────────
  // Manufacture-side cards — labels follow the Sales / Manufacture /
  // Installation triplet so a topic (Kitchen, Stairs, Doors…) reads
  // as a coherent 3-card row in the gallery.
  { slug: "kitchen-manufacturer", label: "Kitchen Manufacture", category_slug: "carpentry" },
  { slug: "staircase-manufacturer", label: "Staircase Manufacture", category_slug: "carpentry" },
  { slug: "door-manufacturer", label: "Door Manufacture", category_slug: "carpentry" },
  { slug: "window-manufacturer", label: "Window Manufacture", category_slug: null },
  { slug: "flooring-manufacturer", label: "Flooring Manufacture", category_slug: null },
  { slug: "conservatory-manufacturer", label: "Conservatory Manufacture", category_slug: null },
  { slug: "bathroom-manufacturer", label: "Bathroom Manufacture", category_slug: "plumbing" },
  { slug: "wardrobe-maker", label: "Wardrobe & Fitted Furniture Maker", category_slug: "carpentry" },
  { slug: "furniture-maker", label: "Bespoke Furniture Maker", category_slug: "carpentry" },
  { slug: "joinery-workshop", label: "Joinery Workshop", category_slug: "carpentry" },
  { slug: "worktop-manufacturer", label: "Worktop Manufacturer", category_slug: null },
  { slug: "glass-manufacturer", label: "Glass & Glazing Manufacturer", category_slug: null },
  { slug: "shed-manufacturer", label: "Shed & Summerhouse Manufacturer", category_slug: null },
  { slug: "garden-room-manufacturer", label: "Garden Room Manufacturer", category_slug: null },
  { slug: "steel-fabricator", label: "Steel Fabricator", category_slug: null },

  // ─── Trade Product Sales additions ───────────────────────────────
  { slug: "timber-merchant", label: "Timber Merchant", category_slug: null },
  { slug: "plumbing-merchant", label: "Plumbing Merchant", category_slug: "plumbing" },
  { slug: "electrical-wholesaler", label: "Electrical Wholesaler", category_slug: "electrical" },
  // Sales-side cards — labels normalised to the same Sales pattern so
  // each topic shows up as a coherent 3-card row in the gallery.
  // Slugs kept as *-showroom / *-shop for URL stability.
  { slug: "tile-shop", label: "Tile Sales", category_slug: "tiling" },
  { slug: "flooring-shop", label: "Flooring Sales", category_slug: null },
  { slug: "door-showroom", label: "Door Sales", category_slug: null },
  { slug: "kitchen-showroom", label: "Kitchen Sales", category_slug: null },
  { slug: "window-showroom", label: "Window Sales", category_slug: null },
  { slug: "bathroom-showroom", label: "Bathroom Sales", category_slug: null },
  { slug: "paint-merchant", label: "Paint & Decorators Merchant", category_slug: "painting" },
  { slug: "ironmongery", label: "Ironmongery", category_slug: null },
  { slug: "ppe-supplier", label: "PPE & Safety Equipment Supplier", category_slug: null },
  { slug: "tool-shop", label: "Tool Shop / Hardware Store", category_slug: null },
  { slug: "landscape-supplies", label: "Landscape Supplies", category_slug: null },
  { slug: "aggregate-supplier", label: "Aggregate Supplier", category_slug: null },
  { slug: "roofing-supplies", label: "Roofing Supplies", category_slug: "roofing" },
  { slug: "insulation-supplies", label: "Insulation Supplies", category_slug: null },
  // Wholesale suppliers — completes the fitter/manufacturer/supplier/
  // showroom quartet for the four "big fitted-item" topics. Trade-side
  // wholesale, separate from consumer-facing *-showroom slugs.
  { slug: "kitchen-supplier",  label: "Kitchen Supplier",  category_slug: "carpentry" },
  { slug: "bathroom-supplier", label: "Bathroom Supplier", category_slug: "plumbing"  },
  { slug: "door-supplier",     label: "Door Supplier",     category_slug: "carpentry" },
  { slug: "window-supplier",   label: "Window Supplier",   category_slug: null        },

  // ─── Hire / Rental additions ─────────────────────────────────────
  { slug: "plant-hire", label: "Plant Hire", category_slug: null },
  { slug: "skip-hire", label: "Skip Hire", category_slug: null },
  { slug: "portaloo-hire", label: "Portaloo & Welfare Hire", category_slug: null },
  { slug: "scaffolding-hire", label: "Scaffolding Hire", category_slug: "scaffolding" },
  { slug: "generator-hire", label: "Generator Hire", category_slug: null },
  { slug: "van-hire", label: "Van & Truck Hire", category_slug: null },
  { slug: "crane-hire", label: "Crane Hire", category_slug: null },
  { slug: "waste-removal", label: "Waste Removal & Grab Hire", category_slug: null },
  { slug: "minidigger-hire", label: "Mini-digger Hire", category_slug: null },
  { slug: "storage-container-hire", label: "Storage & Container Hire", category_slug: null },

  // ─── Phase 3 expansion — closing the 90% coverage gap ─────────────
  //
  // Systematic scan added the following buckets so any construction-
  // adjacent business has a home on Thenetworkers. Rule: if the business
  // touches buildings, materials, sites, or the interior of a home, it
  // gets a slug. Anything past this list falls to CUSTOM_TRADE_SLUG.

  // Core trade — additions
  { slug: "glazier", label: "Glazier", category_slug: null },
  { slug: "welder", label: "Welder", category_slug: null },
  { slug: "carpet-fitter", label: "Carpet Fitter", category_slug: null },
  { slug: "upholsterer", label: "Upholsterer", category_slug: null },
  { slug: "wallpaper-hanger", label: "Wallpaper Hanger", category_slug: "painting" },

  // Specialist installers — security & AV
  { slug: "cctv-installer", label: "CCTV Installer", category_slug: "electrical" },
  { slug: "alarm-installer", label: "Burglar Alarm Installer", category_slug: "electrical" },
  { slug: "fire-alarm-installer", label: "Fire Alarm Installer", category_slug: "electrical" },
  { slug: "access-control-installer", label: "Access Control Installer", category_slug: "electrical" },
  { slug: "home-cinema-installer", label: "Home Cinema Installer", category_slug: "electrical" },
  { slug: "audio-visual-installer", label: "Audio-Visual Installer", category_slug: "electrical" },
  { slug: "intercom-installer", label: "Intercom & Door Entry Installer", category_slug: "electrical" },

  // Specialist installers — heating, cooling, water
  { slug: "underfloor-heating-installer", label: "Underfloor Heating Installer", category_slug: "plumbing" },
  { slug: "air-conditioning-installer", label: "Air Conditioning Installer", category_slug: null },
  { slug: "ventilation-installer", label: "Ventilation Installer (MVHR)", category_slug: null },
  { slug: "fireplace-installer", label: "Fireplace & Stove Installer", category_slug: null },
  { slug: "water-softener-installer", label: "Water Softener Installer", category_slug: "plumbing" },
  { slug: "shower-installer", label: "Shower Installer", category_slug: "plumbing" },

  // Specialist installers — home leisure & wellness
  { slug: "swimming-pool-installer", label: "Swimming Pool Installer", category_slug: null },
  { slug: "hot-tub-installer", label: "Hot Tub Installer", category_slug: null },
  { slug: "sauna-installer", label: "Sauna & Steam Room Installer", category_slug: null },

  // Specialist installers — building envelope
  { slug: "cladding-installer", label: "Cladding Installer", category_slug: null },
  { slug: "rooflight-installer", label: "Rooflight & Skylight Installer", category_slug: "roofing" },
  { slug: "balcony-installer", label: "Balcony & Juliet Installer", category_slug: null },
  { slug: "sound-insulation-installer", label: "Sound Insulation Installer", category_slug: null },
  { slug: "ewi-installer", label: "External Wall Insulation (EWI) Installer", category_slug: null },
  { slug: "iwi-installer", label: "Internal Wall Insulation (IWI) Installer", category_slug: null },

  // Specialist installers — soft furnishings
  { slug: "blinds-and-curtains-installer", label: "Blinds & Curtains Installer", category_slug: null },

  // Specialist services — groundworks & structural
  { slug: "piling-contractor", label: "Piling Contractor", category_slug: null },
  { slug: "underpinning-specialist", label: "Underpinning Specialist", category_slug: null },
  { slug: "structural-steel-erector", label: "Structural Steel Erector", category_slug: null },
  { slug: "waterproofing-specialist", label: "Waterproofing Specialist", category_slug: null },
  { slug: "tanking-specialist", label: "Basement Tanking Specialist", category_slug: null },
  { slug: "damp-and-mould-specialist", label: "Damp & Mould Specialist", category_slug: null },
  { slug: "radon-specialist", label: "Radon Mitigation Specialist", category_slug: null },
  { slug: "sandblasting-specialist", label: "Sandblasting & Media Blasting", category_slug: null },
  { slug: "stone-restoration", label: "Stone Restoration Specialist", category_slug: null },
  { slug: "heritage-restoration", label: "Heritage Restoration Specialist", category_slug: null },
  { slug: "chimney-lining", label: "Chimney Lining Specialist", category_slug: null },
  { slug: "fireproofing-specialist", label: "Fireproofing Specialist", category_slug: null },
  { slug: "graffiti-removal", label: "Graffiti Removal Specialist", category_slug: null },
  { slug: "bird-proofing", label: "Bird Proofing Specialist", category_slug: null },

  // Consult / Design / Professional
  { slug: "architect", label: "Architect", category_slug: null },
  { slug: "architectural-technologist", label: "Architectural Technologist", category_slug: null },
  { slug: "structural-engineer", label: "Structural Engineer", category_slug: null },
  { slug: "building-surveyor", label: "Building Surveyor", category_slug: null },
  { slug: "quantity-surveyor", label: "Quantity Surveyor", category_slug: null },
  { slug: "building-inspector", label: "Building Inspector", category_slug: null },
  { slug: "party-wall-surveyor", label: "Party Wall Surveyor", category_slug: null },
  { slug: "planning-consultant", label: "Planning Consultant", category_slug: null },
  { slug: "project-manager", label: "Project Manager", category_slug: null },
  { slug: "health-safety-consultant", label: "Health & Safety Consultant", category_slug: null },
  { slug: "cdm-consultant", label: "CDM Consultant", category_slug: null },
  { slug: "epc-assessor", label: "EPC Assessor", category_slug: null },
  { slug: "retrofit-coordinator", label: "Retrofit Coordinator (PAS 2035)", category_slug: null },
  { slug: "retrofit-assessor", label: "Retrofit Assessor", category_slug: null },
  { slug: "thermal-imaging-survey", label: "Thermal Imaging Surveyor", category_slug: null },
  { slug: "drone-surveyor", label: "Drone Surveyor", category_slug: null },
  { slug: "land-surveyor", label: "Land Surveyor", category_slug: null },
  { slug: "cad-designer", label: "CAD Designer", category_slug: null },
  { slug: "bim-specialist", label: "BIM Specialist", category_slug: null },
  { slug: "interior-designer", label: "Interior Designer", category_slug: null },
  { slug: "landscape-architect", label: "Landscape Architect", category_slug: null },
  { slug: "lighting-designer", label: "Lighting Designer", category_slug: null },
  { slug: "acoustic-consultant", label: "Acoustic Consultant", category_slug: null },
  { slug: "ecology-consultant", label: "Ecology Consultant", category_slug: null },
  { slug: "arboricultural-consultant", label: "Arboricultural Consultant", category_slug: null },
  { slug: "fire-risk-assessor", label: "Fire Risk Assessor", category_slug: null },

  // Manufacture — additions
  { slug: "blinds-manufacturer", label: "Blinds Manufacture", category_slug: null },
  { slug: "curtain-manufacturer", label: "Curtain Manufacture", category_slug: null },
  { slug: "sofa-manufacturer", label: "Sofa & Upholstery Manufacture", category_slug: null },
  { slug: "mattress-manufacturer", label: "Mattress Manufacture", category_slug: null },
  { slug: "radiator-manufacturer", label: "Radiator Manufacture", category_slug: "plumbing" },
  { slug: "lighting-manufacturer", label: "Lighting Manufacture", category_slug: "electrical" },
  { slug: "tile-manufacturer", label: "Tile Manufacture", category_slug: "tiling" },
  { slug: "stone-manufacturer", label: "Stone Yard & Fabrication", category_slug: null },

  // Merchants & Sales — consumer-facing showrooms
  { slug: "cctv-supplier", label: "CCTV & Alarm Supplier", category_slug: "electrical" },
  { slug: "lighting-showroom", label: "Lighting Showroom", category_slug: "electrical" },
  { slug: "furniture-showroom", label: "Furniture Showroom", category_slug: null },
  { slug: "sofa-shop", label: "Sofa Shop", category_slug: null },
  { slug: "bed-and-mattress-shop", label: "Bed & Mattress Shop", category_slug: null },
  { slug: "curtain-and-blind-shop", label: "Curtain & Blind Shop", category_slug: null },
  { slug: "fireplace-showroom", label: "Fireplace & Stove Showroom", category_slug: null },
  { slug: "sanitaryware-shop", label: "Sanitaryware & Bathware Shop", category_slug: "plumbing" },
  { slug: "radiator-shop", label: "Radiator Showroom", category_slug: "plumbing" },
  { slug: "garden-centre", label: "Garden Centre", category_slug: null },
  { slug: "stone-yard", label: "Stone Yard", category_slug: null },
  { slug: "reclamation-yard", label: "Reclamation Yard", category_slug: null },
  { slug: "salvage-yard", label: "Salvage Yard", category_slug: null },
  { slug: "carpet-shop", label: "Carpet Shop", category_slug: null },
  { slug: "art-and-print-supplier", label: "Art & Print Supplier", category_slug: null },
  { slug: "kitchenware-shop", label: "Kitchenware & Homeware Shop", category_slug: null },

  // Hire / Rental — additions
  { slug: "welfare-hire", label: "Welfare Unit Hire", category_slug: null },
  { slug: "site-accommodation-hire", label: "Site Accommodation Hire", category_slug: null },
  { slug: "site-signage-hire", label: "Site Signage & Hoarding", category_slug: null },
  { slug: "traffic-management-hire", label: "Traffic Management", category_slug: null },

  // Property Services & Adjacent
  { slug: "locksmith", label: "Locksmith", category_slug: null },
  { slug: "sign-maker", label: "Sign Maker", category_slug: null },
  { slug: "removals-company", label: "Removals Company", category_slug: null },
  { slug: "commercial-cleaning", label: "Commercial Cleaning", category_slug: null },
  { slug: "window-cleaner", label: "Window Cleaner", category_slug: null },
  { slug: "gutter-cleaner", label: "Gutter Cleaner", category_slug: "roofing" },
  { slug: "pressure-washing", label: "Pressure Washing Specialist", category_slug: null },
  { slug: "home-stager", label: "Home Stager", category_slug: null },
  { slug: "estate-agent", label: "Estate Agent", category_slug: null },
  { slug: "letting-agent", label: "Letting Agent", category_slug: null },
  { slug: "property-developer", label: "Property Developer", category_slug: null },
  { slug: "property-manager", label: "Property Manager", category_slug: null },

  // Green / Retrofit — additions
  { slug: "solar-thermal-installer", label: "Solar Thermal Installer", category_slug: "plumbing" },
  { slug: "battery-storage-installer", label: "Battery Storage Installer", category_slug: "electrical" },
  { slug: "wind-turbine-installer", label: "Wind Turbine Installer", category_slug: "electrical" },
  { slug: "ground-source-installer", label: "Ground Source Heat Pump Installer", category_slug: "plumbing" },
  { slug: "air-source-installer", label: "Air Source Heat Pump Installer", category_slug: "plumbing" },
  { slug: "rainwater-harvesting-installer", label: "Rainwater Harvesting Installer", category_slug: "plumbing" },
  { slug: "greywater-installer", label: "Greywater System Installer", category_slug: "plumbing" },
  { slug: "septic-tank-service", label: "Septic Tank Service", category_slug: "plumbing" },

  // Site catering & welfare
  { slug: "site-mobile-food-van", label: "Mobile Food Van", category_slug: null }
];

// Custom-entry slug — reserved so a tradesperson whose exact niche
// isn't in the taxonomy can register with their own label. The
// signup flow captures the free-text label alongside; consumers of
// TRADE_OFF_TRADES fall back to the free-text field when they see
// this slug.
export const CUSTOM_TRADE_SLUG = "custom";

// ─── Competitor sets ─────────────────────────────────────────
//
// Trades in the same set exclude each other from the "Find Trades"
// page. A kitchen fitter must never see other kitchen fitters, kitchen
// manufacturers, or kitchen showrooms surfaced on their canteen — that
// would send THEIR paying customer to a competitor. Instead they see
// COMPLEMENTARY trades (plumbers, sparks, tilers, etc.).
//
// Rule: never build a lead-gen funnel from a paying trade to their
// own direct competitor. Adding a new taxonomy entry? Slot it into
// the right set here as part of the same commit.

export const COMPETITOR_SETS: Record<string, string[]> = {
  kitchen: [
    "kitchen-fitter", "kitchen-manufacturer", "kitchen-showroom",
    "kitchen-supplier", "kitchenware-shop", "worktop-manufacturer"
  ],
  bathroom: [
    "bathroom-fitter", "bathroom-manufacturer", "bathroom-showroom",
    "bathroom-supplier", "sanitaryware-shop", "shower-installer"
  ],
  doors: [
    "door-fitter", "door-manufacturer", "door-showroom",
    "door-supplier", "garage-door-installer"
  ],
  windows: [
    "window-fitter", "window-manufacturer", "window-showroom",
    "window-supplier", "sash-window-restorer", "conservatory-installer",
    "conservatory-manufacturer", "glazier", "glass-manufacturer",
    "rooflight-installer"
  ],
  plumbing: [
    "plumber", "plumbing-merchant", "gas-engineer",
    "heat-pump-installer", "ground-source-installer", "air-source-installer",
    "underfloor-heating-installer", "boiler-installer", "septic-tank-service",
    "water-softener-installer", "damp-proofer"
  ],
  electrical: [
    "electrician", "electrical-wholesaler", "ev-charger-installer",
    "solar-installer", "solar-thermal-installer", "battery-storage-installer",
    "smart-home-installer", "aerial-satellite-installer", "cctv-installer",
    "alarm-installer", "fire-alarm-installer", "access-control-installer",
    "home-cinema-installer", "audio-visual-installer", "intercom-installer",
    "lighting-showroom", "lighting-manufacturer"
  ],
  roofing: [
    "roofer", "roofing-supplies", "fascia-and-soffit", "gutter-installer",
    "gutter-cleaner", "lead-worker", "chimney-lining", "chimney-sweep"
  ],
  plastering: [
    "plasterer", "renderer", "taper-and-finisher", "drywaller"
  ],
  bricklaying: [
    "bricklayer", "block-layer", "stonemason", "stone-restoration"
  ],
  tiling: [
    "tiler", "tile-shop", "tile-manufacturer"
  ],
  carpentry: [
    "carpenter", "joiner", "trim-carpenter", "furniture-maker",
    "wardrobe-maker", "joinery-workshop", "stair-fitter", "staircase-manufacturer"
  ],
  painting: [
    "painter", "wallpaper-hanger", "paint-merchant"
  ],
  flooring: [
    "flooring-installer", "carpet-fitter", "flooring-shop",
    "flooring-manufacturer", "carpet-shop"
  ],
  landscaping: [
    "landscaper", "garden-designer", "landscape-architect",
    "driveway-installer", "fencing-installer", "landscape-supplies",
    "garden-centre", "garden-room-installer", "garden-room-manufacturer",
    "shed-manufacturer", "tree-surgeon", "arboricultural-consultant"
  ],
  scaffolding: [
    "scaffolder", "scaffolding-hire"
  ],
  hire: [
    "plant-hire", "tool-hire", "skip-hire", "generator-hire",
    "van-hire", "crane-hire", "minidigger-hire", "welfare-hire"
  ],
  merchants: [
    // A building merchant shouldn't refer to another building merchant.
    "building-merchant", "builders-supplies", "timber-merchant",
    "aggregate-supplier", "ppe-supplier", "tool-shop", "ironmongery"
  ],
  structural: [
    "structural-engineer", "structural-steel-erector", "steel-fabricator",
    "welder", "metal-engineer", "piling-contractor", "underpinning-specialist"
  ],
  design: [
    "architect", "architectural-technologist", "interior-designer",
    "cad-designer", "bim-specialist", "landscape-architect", "lighting-designer"
  ]
};

/** Returns every slug that a given trade should NEVER see surfaced on
 *  their canteen — the union of every competitor set that includes
 *  their own slug. Always includes their own slug. */
export function competitorSlugsFor(tradeSlug: string): Set<string> {
  const banned = new Set<string>([tradeSlug]);
  for (const set of Object.values(COMPETITOR_SETS)) {
    if (set.includes(tradeSlug)) {
      for (const s of set) banned.add(s);
    }
  }
  return banned;
}

/** The inverse — return the slugs a given trade CAN see. */
export function complementaryTradesFor(tradeSlug: string): string[] {
  const banned = competitorSlugsFor(tradeSlug);
  return TRADE_OFF_TRADES.map((t) => t.slug).filter((s) => !banned.has(s));
}

export function tradeLabel(slug: string): string {
  return TRADE_OFF_TRADES.find((t) => t.slug === slug)?.label ?? slug;
}

// ─── Grouped taxonomy ─────────────────────────────────────
//
// Ordered display groups for the signup trade picker. Groups are
// listed in display order — Core Trades first (Philip's rule: strong
// trades on top), then specialists, then supply-side, then adjacent
// services. Each group has a short header shown above its chip strip
// so a tradesperson scans quickly to their category.
//
// The `tradeSlugs` array is order-preserving — first entry appears
// first in that group's list. Slugs listed here MUST exist in
// TRADE_OFF_TRADES; the runtime assertion in tradesByGroup catches
// typos at first use.

export type TradeGroup = {
  slug: string;
  label: string;
  /** Short description shown under the group header. */
  helper: string;
  /** Ordered list of trade slugs in this group. First = most common. */
  tradeSlugs: string[];
};

export const TRADE_GROUPS: TradeGroup[] = [
  {
    slug: "core-trades",
    label: "Core Trades",
    helper: "Boots-on-site labour. The trades that build the building.",
    tradeSlugs: [
      "carpenter",
      "plasterer",
      "plumber",
      "electrician",
      "bricklayer",
      "roofer",
      "painter",
      "tiler",
      "joiner",
      "drywaller",
      "groundworker",
      "general-builder",
      "scaffolder",
      "gas-engineer",
      "stonemason",
      "landscaper",
      "concrete-specialist",
      "concrete-finisher",
      "block-layer",
      "renderer",
      "taper-and-finisher",
      "glazier",
      "welder",
      "metal-engineer",
      "trim-carpenter",
      "formworker",
      "insulation-installer",
      "demolition",
      "carpet-fitter",
      "upholsterer",
      "wallpaper-hanger",
      "lead-worker",
      "fascia-and-soffit"
    ]
  },
  {
    slug: "specialist-installers",
    label: "Specialist Installers",
    helper: "Fit-out specialists — the people who install the finished product.",
    tradeSlugs: [
      "kitchen-fitter",
      "bathroom-fitter",
      "window-fitter",
      "door-fitter",
      "flooring-installer",
      "stair-fitter",
      "conservatory-installer",
      "garden-room-installer",
      "solar-installer",
      "solar-thermal-installer",
      "battery-storage-installer",
      "ev-charger-installer",
      "heat-pump-installer",
      "air-source-installer",
      "ground-source-installer",
      "smart-home-installer",
      "cctv-installer",
      "alarm-installer",
      "fire-alarm-installer",
      "access-control-installer",
      "intercom-installer",
      "home-cinema-installer",
      "audio-visual-installer",
      "underfloor-heating-installer",
      "air-conditioning-installer",
      "ventilation-installer",
      "fireplace-installer",
      "water-softener-installer",
      "shower-installer",
      "swimming-pool-installer",
      "hot-tub-installer",
      "sauna-installer",
      "cladding-installer",
      "rooflight-installer",
      "balcony-installer",
      "sound-insulation-installer",
      "ewi-installer",
      "iwi-installer",
      "blinds-and-curtains-installer",
      "garage-door-installer",
      "gutter-installer",
      "driveway-installer",
      "fencing-installer",
      "shutter-installer",
      "aerial-satellite-installer",
      "awning-installer",
      "wind-turbine-installer",
      "rainwater-harvesting-installer",
      "greywater-installer",
      "security-installer"
    ]
  },
  {
    slug: "consult-design",
    label: "Consult, Design & Professional",
    helper: "Design, engineering, and compliance — the people who make it possible.",
    tradeSlugs: [
      "architect",
      "architectural-technologist",
      "structural-engineer",
      "interior-designer",
      "landscape-architect",
      "lighting-designer",
      "building-surveyor",
      "quantity-surveyor",
      "building-inspector",
      "party-wall-surveyor",
      "land-surveyor",
      "drone-surveyor",
      "thermal-imaging-survey",
      "planning-consultant",
      "project-manager",
      "health-safety-consultant",
      "cdm-consultant",
      "site-safety",
      "fire-risk-assessor",
      "acoustic-consultant",
      "ecology-consultant",
      "arboricultural-consultant",
      "epc-assessor",
      "retrofit-coordinator",
      "retrofit-assessor",
      "cad-designer",
      "bim-specialist"
    ]
  },
  {
    slug: "specialist-services",
    label: "Specialist Services",
    helper: "Focused-scope trades and remedial work.",
    tradeSlugs: [
      "piling-contractor",
      "underpinning-specialist",
      "structural-steel-erector",
      "waterproofing-specialist",
      "tanking-specialist",
      "damp-and-mould-specialist",
      "damp-proofer",
      "radon-specialist",
      "asbestos-removal",
      "drainage-engineer",
      "sandblasting-specialist",
      "stone-restoration",
      "heritage-restoration",
      "sash-window-restorer",
      "chimney-sweep",
      "chimney-lining",
      "fireproofing-specialist",
      "graffiti-removal",
      "bird-proofing",
      "tree-surgeon",
      "pest-control",
      "garden-designer",
      "post-construction-cleaner",
      "mobile-mechanic",
      "pump-service",
      "water-drilling",
      "septic-tank-service"
    ]
  },
  {
    slug: "manufacture",
    label: "Manufacture",
    helper: "Workshops and factories making the products trades install.",
    tradeSlugs: [
      "kitchen-manufacturer",
      "staircase-manufacturer",
      "door-manufacturer",
      "window-manufacturer",
      "bathroom-manufacturer",
      "flooring-manufacturer",
      "conservatory-manufacturer",
      "wardrobe-maker",
      "furniture-maker",
      "joinery-workshop",
      "worktop-manufacturer",
      "glass-manufacturer",
      "shed-manufacturer",
      "garden-room-manufacturer",
      "steel-fabricator",
      "blinds-manufacturer",
      "curtain-manufacturer",
      "sofa-manufacturer",
      "mattress-manufacturer",
      "radiator-manufacturer",
      "lighting-manufacturer",
      "tile-manufacturer",
      "stone-manufacturer"
    ]
  },
  {
    slug: "merchants-showrooms",
    label: "Merchants & Showrooms",
    helper: "Product-first — merchants, showrooms, and consumer-facing shops.",
    tradeSlugs: [
      "building-merchant",
      "builders-supplies",
      "timber-merchant",
      "plumbing-merchant",
      "electrical-wholesaler",
      "paint-merchant",
      "ironmongery",
      "ppe-supplier",
      "tool-shop",
      "landscape-supplies",
      "aggregate-supplier",
      "roofing-supplies",
      "insulation-supplies",
      "kitchen-supplier",
      "bathroom-supplier",
      "door-supplier",
      "window-supplier",
      "tile-shop",
      "flooring-shop",
      "carpet-shop",
      "door-showroom",
      "kitchen-showroom",
      "window-showroom",
      "bathroom-showroom",
      "sanitaryware-shop",
      "radiator-shop",
      "lighting-showroom",
      "cctv-supplier",
      "furniture-showroom",
      "sofa-shop",
      "bed-and-mattress-shop",
      "curtain-and-blind-shop",
      "fireplace-showroom",
      "kitchenware-shop",
      "garden-centre",
      "stone-yard",
      "reclamation-yard",
      "salvage-yard",
      "art-and-print-supplier"
    ]
  },
  {
    slug: "hire-rental",
    label: "Hire & Rental",
    helper: "Anything you rent by the day, week, or job.",
    tradeSlugs: [
      "plant-hire",
      "tool-hire",
      "heavy-machinery",
      "crane-hire",
      "crane-operator",
      "scaffolding-hire",
      "generator-hire",
      "van-hire",
      "minidigger-hire",
      "skip-hire",
      "waste-removal",
      "portaloo-hire",
      "welfare-hire",
      "site-accommodation-hire",
      "site-signage-hire",
      "traffic-management-hire",
      "storage-container-hire"
    ]
  },
  {
    slug: "property-services",
    label: "Property Services",
    helper: "Adjacent trades — the last mile before a building becomes a home.",
    tradeSlugs: [
      "locksmith",
      "sign-maker",
      "removals-company",
      "commercial-cleaning",
      "window-cleaner",
      "gutter-cleaner",
      "pressure-washing",
      "home-stager",
      "estate-agent",
      "letting-agent",
      "property-developer",
      "property-manager"
    ]
  },
  {
    slug: "site-catering",
    label: "Site Catering",
    helper: "Feeding the site — the trades who keep everyone else running.",
    tradeSlugs: [
      "site-canteen",
      "site-mobile-food-van"
    ]
  }
];

/** Returns the trades in a given group, resolved to full label+slug
 *  rows. Filters out any slug that's not in TRADE_OFF_TRADES — this
 *  catches typos in the group definitions above without exploding at
 *  render time. */
export function tradesByGroup(groupSlug: string): Array<{ slug: string; label: string }> {
  const group = TRADE_GROUPS.find((g) => g.slug === groupSlug);
  if (!group) return [];
  const bySlug = new Map(TRADE_OFF_TRADES.map((t) => [t.slug, t]));
  const out: Array<{ slug: string; label: string }> = [];
  for (const slug of group.tradeSlugs) {
    const t = bySlug.get(slug);
    if (t) out.push({ slug: t.slug, label: t.label });
  }
  return out;
}

/** Set of every slug referenced by the groups, for coverage checks. */
export function groupedTradeSlugs(): Set<string> {
  const s = new Set<string>();
  for (const g of TRADE_GROUPS) {
    for (const slug of g.tradeSlugs) s.add(slug);
  }
  return s;
}

/** Slugs present in TRADE_OFF_TRADES but not yet placed in a group —
 *  useful during migration + as a lint check to keep coverage complete. */
export function ungroupedTradeSlugs(): string[] {
  const grouped = groupedTradeSlugs();
  return TRADE_OFF_TRADES.filter((t) => !grouped.has(t.slug)).map((t) => t.slug);
}

/** Sibling trades — other trades in the same TRADE_GROUP as the given
 *  slug. Powers the "In {city}, homeowners also hire" cross-links on
 *  /trade-off/{trade}/{city} pages. Falls back to a curated common-trade
 *  set if the input isn't in any group. */
export function siblingTrades(
  tradeSlug: string,
  limit = 8
): Array<{ slug: string; label: string }> {
  const group = TRADE_GROUPS.find((g) => g.tradeSlugs.includes(tradeSlug));
  const source = group
    ? group.tradeSlugs.filter((s) => s !== tradeSlug)
    : ["carpenter", "electrician", "plumber", "roofer", "plasterer", "painter", "tiler", "bricklayer"].filter((s) => s !== tradeSlug);
  const bySlug = new Map(TRADE_OFF_TRADES.map((t) => [t.slug, t]));
  const out: Array<{ slug: string; label: string }> = [];
  for (const slug of source) {
    const t = bySlug.get(slug);
    if (t) out.push({ slug: t.slug, label: t.label });
    if (out.length >= limit) break;
  }
  return out;
}

// Trades whose customers BUY from a catalogue rather than book labour by
// the hour — merchants, hire firms, and product-configurable installers.
// These auto-get Shop Mode so the profile is "complete" rather than
// nickel-and-diming a category whose whole job is to sell tangible items.
//
// Rule of thumb: "trades whose customers buy products, not book hours."
// Adding to this list dilutes the merchant framing — be selective.
export const MERCHANT_GRADE_TRADES: ReadonlySet<string> = new Set([
  "building-merchant",
  "builders-supplies",
  "kitchen-fitter",
  "stair-fitter",
  "window-fitter",
  "security-installer",
  "tool-hire",
  "heavy-machinery"
]);

export function isMerchantGradeTrade(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return MERCHANT_GRADE_TRADES.has(slug);
}

// Merchant Pro — the canonical "one model template" for building merchants
// and builders supplies. On the £14.99/mo paid tier, these trades get
// EVERY paid add-on bundled (Wholesale Mode, Trade Center Picks, Custom
// Domain, Lead Alerts, Materials Network, Downloads, FAQ Page — the lot)
// rather than à-la-carte pricing. Product catalogue caps at 200 active
// products on £14.99; over 200 requires an overage upgrade (or Verified
// £19.99 once that tier ships).
//
// Strict subset of MERCHANT_GRADE_TRADES — the other merchant-grade trades
// (kitchen-fitter, tool-hire, etc.) stay on the per-add-on pricing model.
export const MERCHANT_PRO_TRADES: ReadonlySet<string> = new Set([
  "building-merchant",
  "builders-supplies"
]);

export function isMerchantProTrade(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return MERCHANT_PRO_TRADES.has(slug);
}

/** Product catalogue cap for the paid £14.99 tier on Merchant Pro trades.
 *  Returns null = unlimited (Verified tier, or non-merchant-pro trades
 *  where no cap applies). Returns a positive integer for hard cap. */
export const MERCHANT_PRO_PRODUCT_CAP = 200;

// Hammerex Standard product blurbs.
// Keyed by product slug. When a tradesperson's listing email/phone matches a
// past quote-request that included one of these products, the badge appears
// on their profile with the matching blurb.
export const HAMMEREX_STANDARD_BLURBS: Record<string, string> = {
  "k9-plastering-tool-station":
    "Owns the Hammerex K9 Plastering Tool Station — trowels, hawk, and finishing kit stored properly, not piled in a bucket. A sign of pride in the tools and a working standard most trades drop after their second site.",
  "k11-drywall-tool-station":
    "Owns the Hammerex K11 Drywall Tool Station — five knife rows, mud-pan well, reinforced solid-core frame. Drywall pros who carry the K11 protect every blade and take pride in their craft.",
  "scaffolders-setup-kit":
    "Owns the Hammerex Scaffolders Setup Kit — full belt + bag + lanyard system. Scaffolders who carry the Hammerex setup are kitted out properly for the trade.",
  "electrician-pro-pouch":
    "Owns the Hammerex Electrician Pro Pouch — a professional-grade pouch for the on-site spark. Sparks who carry it take their kit seriously.",
  "plastering-pro-bag":
    "Owns the Hammerex Plastering Pro Bag — a full plastering site bag, not a flimsy carry-box. The choice of plasterers who protect their trowels.",
  "drywall-pro-kit":
    "Owns the Hammerex Drywall Pro Kit — a purpose-built drywall site bag. Pride in tools, pride in finish."
};

export const STANDARD_TIER_LABELS = {
  base: "Hammerex Standard Verified",
  master: "Hammerex Standard — Master",
  masterPlus: "Hammerex Standard — Master Plus"
} as const;

export function standardTierFor(productCount: number): keyof typeof STANDARD_TIER_LABELS | null {
  if (productCount >= 3) return "masterPlus";
  if (productCount >= 2) return "master";
  if (productCount >= 1) return "base";
  return null;
}

// Slugify input for listing slug or city slug. Lower-case, hyphenated, ASCII.
export function tradeOffSlugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

// Build a slug for a listing from name + city, falling back to a short uuid
// stub if both are empty (shouldn't happen — required fields).
export function buildListingSlug(displayName: string, city: string, suffix?: string): string {
  const base = [displayName, city].filter(Boolean).join("-");
  const slug = tradeOffSlugify(base);
  if (!slug) return `tradie-${suffix ?? Math.random().toString(36).slice(2, 8)}`;
  return suffix ? `${slug}-${suffix}` : slug;
}

// Format a WhatsApp number digits-only for wa.me URLs.
export function whatsappDigits(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export function whatsappQuoteUrl(whatsapp: string, displayName: string, tradeLabelText: string): string {
  const digits = whatsappDigits(whatsapp);
  const message = `Hi ${displayName}, I found your profile on thenetworkers.app. I'd like a quote for some ${tradeLabelText.toLowerCase()} work.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Trade Center Picks — dedicated pick-detail WhatsApp deeplink. Pre-fills
// a short, friendly enquiry that references the EXACT promo banner the
// customer landed on (status + product), so the merchant doesn't have to
// guess which pick is being discussed. Used by the "Enquire on WhatsApp"
// CTA on /<slug>/picks/<pickId>.
export function whatsappPickEnquiryUrl(
  whatsapp: string,
  displayName: string,
  productName: string,
  statusLabel: string
): string {
  const digits = whatsappDigits(whatsapp);
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const message = `Hi ${firstName}, I'm interested in your "${statusLabel}" offer on ${productName}. Can you confirm availability + delivery to my postcode? — [Xrated]`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const TRADE_OFF_REQUIRED_FIELDS = [
  "display_name",
  "primary_trade",
  "city",
  "whatsapp",
  "email",
  "bio"
] as const;

export type TradeOffStatus = "draft" | "live" | "hidden";

// Reserved slugs that tradies cannot claim as their vanity URL.
// Anything matching these — or shorter than 5 / longer than 60 chars — is
// rejected by /api/trade-off/slug-available and by the create/update APIs.
// The 5-char floor matches xratedSlug.SLUG_MIN_LENGTH; bumped from 3
// because 3-char vanity URLs tend to be route-collision-prone and rank
// poorly on Google.
export const TRADE_OFF_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "signup",
  "edit",
  "admin",
  "done",
  "api",
  "t",
  "trade",
  "trade-off",
  "tradeoff",
  // Reserved because /trade/<these> are existing B2B portal sub-paths
  "auth",
  "cart",
  "catalogue",
  "checkout",
  "order",
  "settings",
  "login",
  "logout",
  "register",
  "new",
  "search",
  "explore",
  "about",
  "help",
  "support",
  "terms",
  "privacy",
  "report",
  "hammerex",
  "standard",
  "verified"
]);

export function isReservedSlug(slug: string): boolean {
  const s = slug.toLowerCase().trim();
  if (s.length < 5 || s.length > 60) return true;
  if (TRADE_OFF_RESERVED_SLUGS.has(s)) return true;
  if (!/^[a-z0-9-]+$/.test(s)) return true;
  if (s.startsWith("-") || s.endsWith("-")) return true;
  if (s.includes("--")) return true;
  // Seed profiles use a `demo-` prefix (e.g. demo-stuart-kingsley-...).
  // Block real signups from squatting that namespace so the seed set
  // stays the canonical preview-only surface.
  if (s.startsWith("demo-")) return true;
  return false;
}
