// Demo profile seeds for Xrated Trade Off — UK 2026 (Phase-2 Manufacture additions).
//
// 14 bespoke manufacture trades — workshops that MAKE and sell direct to public.
// Focus: workshop work, lead times, material sourcing, delivery, install handling.
// Phone numbers use Ofcom fiction range +44 7700 900XXX.

import type { DemoTradeSeed } from "./demoTradeSeeds";

export const DEMO_TRADE_SEEDS_MANUFACTURE: DemoTradeSeed[] = [
  // 1. KITCHEN MANUFACTURER
  {
    trade_slug: "kitchen-manufacturer",
    profile_slug: "demo-charlotte-pemberton-kitchen-manufacturer-bath",
    display_name: "Charlotte Pemberton",
    trading_name: "Pemberton Kitchens",
    city: "Bath",
    postcode_prefix: "BA2",
    whatsapp: "+44 7700 900301",
    email: "charlotte@pembertonkitchens.co.uk",
    bio: "I run a six-bench workshop on Locksbrook Industrial Estate in Bath making bespoke in-frame and shaker kitchens for clients across the South West and London. Every cabinet is built from scratch in solid tulipwood frames with veneered ply carcasses — no flat-pack, no carcass-supplied-then-painted shortcuts. We hand-spray in our own booth using Mylands and Little Greene palettes and every drawer is dovetailed solid oak with Blum Movento runners. Lead time is 10-12 weeks from sign-off because I won't rush a paint finish that has to last 25 years. I deliver crated to site and sub-let installation to two fitter teams I've worked with for years — I'd rather they install than try to run a fitting crew myself and lose grip on the workshop. ICW member, eighteen years in cabinetry, and I'll show you round the workshop before you commit a deposit.",
    years_in_trade: 18,
    start_year: 2008,
    priced_services: [
      { name: "Bespoke in-frame painted kitchen (medium 6-8m run)", price: 28500, unit: "from", description: "Solid tulipwood in-frame cabinets, hand-painted Mylands finish, dovetailed oak drawers, Blum Movento runners. Excludes worktops, appliances, install." },
      { name: "Bespoke shaker kitchen (medium 6-8m run)", price: 22000, unit: "from", description: "Tulipwood shaker doors on veneered ply carcasses, two-coat hand-painted finish. Dovetailed drawers standard." },
      { name: "Large bespoke in-frame kitchen (10m+ with island)", price: 38000, unit: "from", description: "Full in-frame build with island, larder, dresser unit. 12-week lead time, hand-painted, all solid timber doors." },
      { name: "Bespoke utility room", price: 6800, unit: "from", description: "Matching utility cabinets, butler sink housing, broom cupboard. Painted to match main kitchen." },
      { name: "Single bespoke dresser or larder unit", price: 4200, unit: "from", description: "Standalone freestanding piece — full-height larder, glazed dresser, or pantry cupboard. 6-week lead." },
      { name: "Workshop visit and design consultation", price: 250, unit: "fixed", description: "Two-hour studio visit, sample doors, CAD layout sketch. Refunded against deposit if you proceed." }
    ],
    faq_items: [
      { q: "What's the lead time once I pay deposit?", a: "10-12 weeks for a standard medium kitchen, 14-16 weeks if it's a large in-frame with island and island feature posts. We don't carry stock — every door is cut and painted for you." },
      { q: "Who installs it?", a: "I sub-let install to two fitting teams I've worked with for 12+ years. You pay them direct, typically £3,500-£6,000 for a medium kitchen. They survey, template worktops and snag. I keep my crew in the workshop where they belong." },
      { q: "Why solid frames and not just painted MDF?", a: "MDF doors expand and crack on the paint line within 5-8 years on the appliance side. A solid tulipwood frame with a veneered ply panel doesn't move. It's why ICW members like us use it for in-frame work." },
      { q: "Can I see your workshop?", a: "Yes — please do. I'd be sceptical of any bespoke maker who won't let you visit. Tuesday or Thursday afternoons are best, gives me time to walk you through builds in progress." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["City & Guilds Level 3 Bench Joinery", "BIID accredited supplier", "Mylands trained sprayer"],
    trade_memberships: ["Institute of Carpenters (ICW)", "British Woodworking Federation (BWF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 4200,
    free_site_visits: false,
    quote_availability: "Detailed quote within 5 working days of site survey",
    quote_turnaround_hours: 120,
    current_status_note: "Currently booking workshop slots starting Sep 2026. Two slots left for Q4.",
    availability: "later",
    reviews: [
      { customer_name: "Olivia H.", rating: 5, title: "12 weeks lead time but worth every day", body: "Charlotte talked us out of an island we'd planned and into a proper dresser unit instead — best advice we got. Hand-painted finish is showroom-perfect, dovetails machine-perfect. Three years in, paint lines still tight.", service_name: "Bespoke in-frame painted kitchen (medium 6-8m run)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/52.jpg" },
      { customer_name: "Marcus T.", rating: 5, title: "Delivered fully crated, installed flawlessly", body: "Each cabinet arrived labelled, wrapped, padded. Charlotte's fitter Dave took two weeks on site and the snag list was three items — all sorted in a half-day return.", service_name: "Large bespoke in-frame kitchen (10m+ with island)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/64.jpg" },
      { customer_name: "Rebecca W.", rating: 5, title: "Workshop visit sold it", body: "Visited the workshop before committing. Seeing three other kitchens being built and the spray booth in action made the deposit feel easy. Final kitchen exceeded what the CAD drawings showed.", service_name: "Workshop visit and design consultation", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/77.jpg" }
    ]
  },

  // 2. STAIRCASE MANUFACTURER
  {
    trade_slug: "staircase-manufacturer",
    profile_slug: "demo-richard-hollings-staircase-manufacturer-nottingham",
    display_name: "Richard Hollings",
    trading_name: "Hollings Staircase Co.",
    city: "Nottingham",
    postcode_prefix: "NG7",
    whatsapp: "+44 7700 900302",
    email: "richard@hollingsstairs.co.uk",
    bio: "Twenty-two years cutting staircases out of a workshop on the Lenton Industrial Estate. We do cut-string and closed-string staircases in European oak, American walnut and tulipwood, plus curved and helical staircases for high-end residential. Every tread is hand-fitted with wedged-and-glued housings — no nail-gun rush jobs. Glass balustrades go in via clamped channel or face-fix standoffs to your engineer's spec, and we cut every handrail in-house including curved goosenecks. Lead time is 6-10 weeks for straight flights, 12-16 weeks for curved. I template on site personally — never trust a builder's measurements for a stair. All builds conform to Approved Document K (rise/going, balustrade heights, gap rules) and I'll flag any building reg issues with your drawings before we cut a single component. Delivery is crated, fitting sub-let to two trusted joiners.",
    years_in_trade: 22,
    start_year: 2004,
    priced_services: [
      { name: "Straight oak staircase (cut-string, up to 14 risers)", price: 5800, unit: "from", description: "Solid European oak treads, painted tulipwood cut strings, oak handrail, square spindles. Building regs compliant rise/going." },
      { name: "Straight staircase with glass balustrade", price: 7400, unit: "from", description: "Oak treads, 10mm toughened glass panels in oak channel, oak handrail. Frameless landing balustrade included." },
      { name: "Quarter-turn winder staircase in oak", price: 8200, unit: "from", description: "Cut-string with winder treads, fitted newel posts. Includes site template visit and 4-week build." },
      { name: "Curved staircase (single helical flight)", price: 18500, unit: "from", description: "Steam-bent curved strings, hand-fitted treads, curved oak handrail with goosenecks. 14-week lead time." },
      { name: "Replacement oak handrail with goosenecks", price: 950, unit: "from", description: "Bespoke profile oak handrail, scribed to existing newels, goosenecks at landings. Excludes balustrade." },
      { name: "Site survey and template visit", price: 350, unit: "fixed", description: "Full templating of opening, riser/going calc, building regs review. Deducted from order if you proceed." }
    ],
    faq_items: [
      { q: "Do you handle building regs?", a: "We build to Approved Document K every time — max 220mm rise, min 220mm going, 42mm max gap between spindles, 900mm rail height domestic. I'll review your architect's drawings before cutting and flag issues. Building Control sign-off is the builder's responsibility but our spec sheet covers everything they'll be asked." },
      { q: "Can you do a curved staircase?", a: "Yes — we steam-bend the strings and handrail in-house. Lead time jumps to 14-16 weeks because the laminations need a week between glue-ups. Costs roughly 3x a straight flight." },
      { q: "Do you install or do I find a joiner?", a: "I sub-let install to two joiners I trust. Typical install is 2-3 days, costs £900-£1,800 depending on complexity. You can use your own builder — I'll provide a fitting drawing pack." },
      { q: "What timbers do you stock?", a: "European oak and tulipwood always in stock. American walnut, ash, sapele to order — adds 2-3 weeks. All FSC sourced from Whitmore Sawmills in Derbyshire." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["NVQ Level 3 Bench Joinery", "Approved Document K trained", "FSC Chain of Custody certified"],
    trade_memberships: ["British Woodworking Federation (BWF)", "Institute of Carpenters (ICW)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 950,
    free_site_visits: false,
    quote_availability: "Quote within 7 days of site template",
    quote_turnaround_hours: 168,
    current_status_note: "Booking workshop slots from August 2026. Curved staircases booked into October.",
    availability: "later",
    reviews: [
      { customer_name: "Andrew P.", rating: 5, title: "The joinery was flawless, every housing tight", body: "Hand-fitted treads, wedged and glued — not a single squeak six months on. Glass balustrade channel cut so cleanly the silicone bead is invisible. Richard caught a riser-height issue on our architect's drawings before he cut a thing.", service_name: "Straight staircase with glass balustrade", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/58.jpg" },
      { customer_name: "Caroline B.", rating: 5, title: "Curved staircase is the centrepiece of the house", body: "16 weeks lead time but we'd wait again. The handrail flows perfectly through the goosenecks. Visitors stop and touch it.", service_name: "Curved staircase (single helical flight)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/61.jpg" },
      { customer_name: "Stephen F.", rating: 5, title: "Templated on site, fitted first time", body: "Richard came out himself with the template, took 2 hours, drew everything on the wall. Delivered crated, fitter had it in over a weekend, not a single re-cut.", service_name: "Quarter-turn winder staircase in oak", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/72.jpg" }
    ]
  },

  // 3. DOOR MANUFACTURER
  {
    trade_slug: "door-manufacturer",
    profile_slug: "demo-david-osei-door-manufacturer-birmingham",
    display_name: "David Osei",
    trading_name: "Osei Door Co.",
    city: "Birmingham",
    postcode_prefix: "B11",
    whatsapp: "+44 7700 900303",
    email: "david@oseidoors.co.uk",
    bio: "Sixteen years making solid timber doors out of a 3,500 sq ft workshop on the Tyseley Industrial Estate. We make 44mm internal doors and 54mm external doors in oak, walnut, sapele and tulipwood, plus FD30 and FD60 fire-rated doors with intumescent seals, BWF-Certifire labelled. Every door is solid stile-and-rail construction — no cheap hollow-core, no veneered MDF passed off as solid. Frames, linings and architraves are made to match in the same timber. Lead time is 4-8 weeks depending on complexity and finish. I spray-finish doors in our booth in Osmo or Morrells if you want them ready to hang, or supply raw for your decorator. Delivery is crated to site nationally — install is your joiner or builder. BWF Code of Conduct member, fully FIRAS-compliant on fire doors with proper documentation pack on every fire-rated leaf.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "Bespoke solid oak internal door (44mm)", price: 485, unit: "per door", description: "Solid stile-and-rail European oak, made to your exact opening. Hand-sanded, raw or pre-finished." },
      { name: "Bespoke external hardwood door (54mm)", price: 1450, unit: "from", description: "Iroko or accoya, mortise-and-tenon construction, weather seal rebate, double-glazed unit if specified." },
      { name: "FD30 fire-rated door (BWF-Certifire)", price: 720, unit: "from", description: "44mm fire-rated leaf with intumescent strip, certification pack. Required for habitable rooms in flats and commercial." },
      { name: "FD60 fire-rated door with vision panel", price: 980, unit: "from", description: "60-minute fire rating, ceramic vision panel, full Certifire labelling. Commercial spec." },
      { name: "Matching door frame, lining and architrave set", price: 295, unit: "per set", description: "Solid timber frame/lining to match door, with architrave moulding of your profile. Pre-rebated for door." },
      { name: "Pair of bespoke double doors (internal)", price: 1280, unit: "per pair", description: "Matched pair of oak or walnut doors for through-room. Astragal moulding optional." }
    ],
    faq_items: [
      { q: "Why solid stile-and-rail and not engineered?", a: "Engineered cores work but the stiles still move and the joints open. Proper mortise-and-tenon with floating panels lets the timber breathe seasonally without splitting. It's how doors lasted 200 years in your great-grandparents' house." },
      { q: "Are your fire doors certified?", a: "Yes — every FD30/FD60 leaf carries a BWF-Certifire label and ships with the test certificate, fitting instructions and intumescent placement diagram. Building control will accept the pack without query." },
      { q: "Can you match a heritage door for a listed property?", a: "Yes — bring a photo or one of the original doors. We can replicate panel layouts, mouldings, bead profiles. Common request for Georgian and Victorian restorations. Add 2-3 weeks lead time." },
      { q: "Do you supply pre-finished or raw?", a: "Either. Pre-finished in our spray booth costs +£90 per door for clear Osmo or Morrells, +£140 for painted. Saves your decorator a day per door." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["NVQ Level 3 Bench Joinery", "BWF-Certifire fire door competency", "FSC Chain of Custody"],
    trade_memberships: ["British Woodworking Federation (BWF)", "FIRAS registered"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 295,
    free_site_visits: false,
    quote_availability: "Quote within 48 hours of opening sizes",
    quote_turnaround_hours: 48,
    current_status_note: "Standard doors 4 weeks, fire-rated 6-8 weeks due to certification stock.",
    availability: "this_week",
    reviews: [
      { customer_name: "James M.", rating: 5, title: "Eight oak doors, hung perfectly", body: "Specified 44mm solid oak for the whole upstairs. David delivered them crated and labelled by room, our joiner had them all hung in two days with zero re-machining. Door bottoms cut to the mm.", service_name: "Bespoke solid oak internal door (44mm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/65.jpg" },
      { customer_name: "Patricia O.", rating: 5, title: "FD30 pack made building control easy", body: "Block of three flats, needed FD30 on every flat door. David supplied with Certifire pack, BCO didn't even open the doors — just signed off on the documentation. Saved us a fortnight of back-and-forth.", service_name: "FD30 fire-rated door (BWF-Certifire)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/68.jpg" },
      { customer_name: "Robert K.", rating: 5, title: "Replicated our Victorian originals", body: "Three doors had rotted bottoms beyond saving. David made matching replacements from photos and surviving panels. Cannot tell which are original and which are new.", service_name: "Bespoke solid oak internal door (44mm)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/79.jpg" }
    ]
  },

  // 4. WINDOW MANUFACTURER
  {
    trade_slug: "window-manufacturer",
    profile_slug: "demo-fiona-mcleod-window-manufacturer-edinburgh",
    display_name: "Fiona McLeod",
    trading_name: "McLeod Joinery Windows",
    city: "Edinburgh",
    postcode_prefix: "EH6",
    whatsapp: "+44 7700 900304",
    email: "fiona@mcleodwindows.co.uk",
    bio: "I run a sash-and-casement workshop in Leith with five joiners specialising in Accoya double-glazed timber sashes for the Edinburgh tenement market. Accoya is the only timber I'll use for external joinery — it's chemically modified Radiata pine with a 50-year above-ground warranty, dimensionally stable, won't twist or split. Every window is double-rebated for weatherseals, fitted with slim-line 14mm warm-edge double-glazed units (Ug 1.1, whole-window U-value 1.4), spiral balance or traditional weight-and-pulley to suit the building. We do flush casements, storm-proof casements and box-frame sliding sashes. Lead time is 8-12 weeks. Listed building consent paperwork supported with detailed sectional drawings — we've done over 60 Category B Listed window installs in Edinburgh New Town and across Glasgow's West End. Delivery is crated, install is sub-let to two trusted fitters who specialise in tenement joinery.",
    years_in_trade: 15,
    start_year: 2011,
    priced_services: [
      { name: "Bespoke Accoya sash window (single, double-glazed)", price: 1850, unit: "from", description: "Box-frame sash, Accoya construction, slim-line double-glazed units, spiral balance or weights. Bare timber finish ready for paint." },
      { name: "Bespoke Accoya casement window (single)", price: 1280, unit: "from", description: "Stormproof or flush casement, Accoya frame and sash, double-glazed, factory spray-finished in any RAL." },
      { name: "Tenement bay window restoration (3 sashes)", price: 5400, unit: "from", description: "Full replacement of three matching box-frame sashes in tenement bay, listed consent drawings included." },
      { name: "Alu-clad timber window (casement, single)", price: 1650, unit: "from", description: "Accoya core with extruded aluminium external cladding, powder-coated any RAL. Best for exposed coastal sites." },
      { name: "Bespoke external timber french door pair", price: 3800, unit: "per pair", description: "Accoya doors and frame, double-glazed sealed units, weather seals, multipoint lock. Painted or oiled." },
      { name: "Listed building consent drawing pack", price: 450, unit: "fixed", description: "Sectional and elevation drawings to support LBC application. Refunded if you order from us." }
    ],
    faq_items: [
      { q: "Why Accoya not softwood?", a: "Softwood sash windows rot at the lower meeting rail within 12-15 years even with good paint. Accoya carries a 50-year warranty above ground, doesn't move with humidity, takes paint beautifully. It's twice the timber cost but you only buy it once." },
      { q: "Will it pass listed building consent?", a: "Yes — Edinburgh New Town consents are won every week with our spec because the sightlines, glazing bars and putty-line detail replicate single-glazed originals exactly. We've done 60+ Category B Listed installs. The slim-line spacers are the key." },
      { q: "Do you do install?", a: "I sub-let install to two tenement specialists in Edinburgh. Typical install is one window per day. They handle making-good plaster, paint touch-up, lintel issues. You pay them direct." },
      { q: "How do the U-values compare to PVCu?", a: "Whole-window U-value of 1.4 W/m²K — better than most standard PVCu casements and within Building Regs Approved Document L without any tradeoff. You're not compromising on energy for aesthetics." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["City & Guilds Level 3 Bench Joinery", "Accoya Approved Manufacturer", "FSC Chain of Custody"],
    trade_memberships: ["British Woodworking Federation (BWF)", "Wood Window Alliance"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 1280,
    free_site_visits: false,
    quote_availability: "Quote within 5 days of site survey",
    quote_turnaround_hours: 120,
    current_status_note: "Currently booking Oct 2026. Single-window jobs slotted faster.",
    availability: "later",
    reviews: [
      { customer_name: "Eleanor W.", rating: 5, title: "Listed consent through first time", body: "Council had refused our previous PVCu application. Fiona's drawing pack and the slim-line Accoya spec sailed through LBC on first application. Windows themselves are stunning — you can't tell they're double-glazed.", service_name: "Tenement bay window restoration (3 sashes)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/54.jpg" },
      { customer_name: "Iain D.", rating: 5, title: "12 weeks lead time but worth every day", body: "Replaced eight sash windows across a Glasgow tenement. Fiona spec'd weight-and-pulley to match original mechanism — they slide effortlessly. House is silent now, no rattle in storms.", service_name: "Bespoke Accoya sash window (single, double-glazed)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/63.jpg" },
      { customer_name: "Margaret S.", rating: 5, title: "Alu-clad coped with sea wind", body: "Coastal house on the Fife coast. Fiona recommended alu-clad over straight timber for the exposed elevations. Two winters in and the paint on the timber side looks new.", service_name: "Alu-clad timber window (casement, single)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/71.jpg" }
    ]
  },

  // 5. FLOORING MANUFACTURER
  {
    trade_slug: "flooring-manufacturer",
    profile_slug: "demo-tom-ashworth-flooring-manufacturer-york",
    display_name: "Tom Ashworth",
    trading_name: "Ashworth Floor Mill",
    city: "York",
    postcode_prefix: "YO19",
    whatsapp: "+44 7700 900305",
    email: "tom@ashworthfloors.co.uk",
    bio: "We mill our own engineered wide-plank floors at a 4,000 sq ft workshop on a converted dairy farm outside York. The top wear layer is 4mm or 6mm solid European oak from FSC-certified Hampshire sawmills, bonded to a 9-ply Baltic birch base for stability. Plank widths run 220mm, 260mm and 300mm in lengths up to 2.4m. We finish in-house with hard-wax oils (Osmo, Treatex), UV-cured oils, fumed and brushed textures, and herringbone parquet blocks in the same construction. Engineered means it's stable over underfloor heating — solid wide planks aren't. Lead time is 6-8 weeks for standard finishes, 10 weeks for fumed or custom-stained. We deliver pallet to site and supply to fitters or sand-and-finish trades nationwide. We don't fit ourselves — fitting destroys workshop output — but we publish a recommended fitter list across the UK.",
    years_in_trade: 13,
    start_year: 2013,
    priced_services: [
      { name: "Engineered oak wide-plank floor (220mm, UV-oiled)", price: 78, unit: "per sqm", description: "4mm oak wear layer on 9-ply birch, 15mm total, T&G micro-bevelled, UV-cured natural oil. FSC certified." },
      { name: "Engineered oak wide-plank floor (260mm, hard-wax oil)", price: 92, unit: "per sqm", description: "6mm oak wear layer, 20mm total, Osmo Hard-Wax oil finish in clear or coloured. Can be re-sanded twice." },
      { name: "Engineered oak wide-plank floor (300mm, fumed and oiled)", price: 118, unit: "per sqm", description: "300mm planks, fumed in ammonia chamber for deep brown tone, brushed texture, hard-wax oil finish. 10-week lead." },
      { name: "Herringbone parquet blocks (engineered, 70x350mm)", price: 105, unit: "per sqm", description: "Engineered herringbone blocks, 4mm oak top, hard-wax oiled. Glued installation only." },
      { name: "Chevron parquet blocks (engineered, 90x600mm)", price: 135, unit: "per sqm", description: "Chevron-cut blocks, mitred ends, 6mm oak top. Premium finish for principal rooms." },
      { name: "Sample pack (5 finishes)", price: 35, unit: "fixed", description: "A4-sized samples in five finishes of your choice, posted to UK address. Refunded against order." }
    ],
    faq_items: [
      { q: "Why engineered and not solid?", a: "Solid wide-plank floors above 180mm cup and gap dramatically with seasonal humidity changes, especially over underfloor heating. Engineered with a 9-ply birch base is dimensionally stable — 300mm planks stay flat. The 6mm wear layer means you can re-sand twice over 60-80 years." },
      { q: "Is it suitable for underfloor heating?", a: "Yes — engineered construction is the only sensible choice for UFH. Solid timber will gap badly. Maximum recommended surface temp is 27°C and we supply the install spec sheet showing required acclimatisation and adhesive type." },
      { q: "Do you fit?", a: "No — fitting takes a different skillset and would eat into mill capacity. We publish a recommended fitter list for most UK regions. Typical fitting cost is £25-£45/sqm depending on subfloor prep." },
      { q: "Can you stain to match an existing floor?", a: "Yes — send a sample or photo. We'll mix and test stain on offcuts, send you a sample board to approve before milling. Adds 1-2 weeks." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["FSC Chain of Custody certified", "PEFC certified", "BSI tested for UFH compatibility"],
    trade_memberships: ["British Woodworking Federation (BWF)", "Contract Flooring Association (CFA)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 850,
    free_site_visits: false,
    quote_availability: "Quote within 24 hours of sqm enquiry",
    quote_turnaround_hours: 24,
    current_status_note: "Standard finishes 6-week lead. Fumed and custom finishes booking into August.",
    availability: "this_week",
    reviews: [
      { customer_name: "Hugo P.", rating: 5, title: "Wide planks stayed flat over UFH", body: "Spec'd 260mm engineered fumed for a whole-house refurb with underfloor heating throughout. Six months in, not a single gap or cup. Fitter said it was the best engineered he's ever laid.", service_name: "Engineered oak wide-plank floor (260mm, hard-wax oil)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/56.jpg" },
      { customer_name: "Sophia L.", rating: 5, title: "Herringbone parquet transformed the room", body: "Tom milled the blocks to exact dimensions for our awkward Victorian dining room. Pattern aligned perfectly with the fireplace. The hard-wax oil shows the grain beautifully.", service_name: "Herringbone parquet blocks (engineered, 70x350mm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/59.jpg" },
      { customer_name: "Mark T.", rating: 5, title: "Sample pack made the decision easy", body: "Ordered the sample pack first — five large samples arrived crated, not little squares. Made it possible to actually choose against our walls and furniture rather than guess from photos.", service_name: "Sample pack (5 finishes)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/74.jpg" }
    ]
  },

  // 6. CONSERVATORY MANUFACTURER
  {
    trade_slug: "conservatory-manufacturer",
    profile_slug: "demo-paul-wainwright-conservatory-manufacturer-tunbridge-wells",
    display_name: "Paul Wainwright",
    trading_name: "Wainwright Orangeries",
    city: "Tunbridge Wells",
    postcode_prefix: "TN2",
    whatsapp: "+44 7700 900306",
    email: "paul@wainwrightorangeries.co.uk",
    bio: "Twenty-five years building hardwood orangeries and aluminium garden rooms from a workshop on Longfield Road in Tunbridge Wells. We specialise in true orangeries — masonry piers with hardwood window frames, lantern roof, lead-coated parapets — not glorified conservatories. For the contemporary end we fabricate using Origin aluminium systems with slimline mullions and bifold doors. Every job is templated personally by me after the foundations are in. Lead time is 12-16 weeks from sign-off because we make the frames, paint them in our spray booth and have the lantern fabricated by a partner glazier in Sevenoaks. We sub-let groundworks, foundations and brickwork to a builder we've worked with for 18 years, or we work alongside your own builder. Hardwood is FSC sapele or accoya. Listed building consent and planning drawings are part of our service.",
    years_in_trade: 25,
    start_year: 2001,
    priced_services: [
      { name: "Hardwood orangery (small 3x3m with lantern)", price: 38000, unit: "from", description: "Sapele timber frames, hand-painted, double-glazed, hardwood roof lantern with lead parapet. Frame package, excludes brickwork and base." },
      { name: "Hardwood orangery (medium 4x5m with lantern)", price: 58000, unit: "from", description: "Larger format orangery, full lantern, french doors or bifolds. Frame package only." },
      { name: "Aluminium garden room (Origin spec, 4x4m)", price: 26000, unit: "from", description: "Origin aluminium frames, slim mullions, flat or pitched roof, bifold doors one side. Excludes base." },
      { name: "Replacement orangery lantern (bespoke)", price: 8500, unit: "from", description: "Replacement lantern roof in painted hardwood, double-glazed with leadwork. Templated to existing opening." },
      { name: "Bespoke bifold door set (hardwood, 3-leaf)", price: 6800, unit: "from", description: "Three-leaf hardwood bifold, multi-point lock, double-glazed, painted in any Farrow & Ball. Frame and threshold included." },
      { name: "Planning and LBC drawing pack", price: 850, unit: "fixed", description: "Sectional and elevation drawings, planning application support, conservation officer liaison. Refunded against order." }
    ],
    faq_items: [
      { q: "What's the difference between orangery and conservatory?", a: "A conservatory is mostly glass with a glass roof. An orangery has masonry piers, solid roof corners with a central lantern, and feels like an integral room of the house. Building regs treat them differently too — full thermal building regs for an orangery, exempt for a true conservatory." },
      { q: "Do you do the foundations and brickwork?", a: "We sub-let groundworks and brickwork to a Kent builder we've used for 18 years. They come in first, we follow with the timber frames and lantern. Or we'll work alongside your own builder if you prefer." },
      { q: "How long is the build?", a: "From order: 12-16 weeks for hardwood orangeries, 8-10 weeks for aluminium garden rooms. On-site install is 3-5 weeks total including groundworks." },
      { q: "Will you handle planning?", a: "Yes — we provide drawings, support the application, and have a planning consultant we sub-let to for tricky conservation area cases. Most orangeries fit Permitted Development for rear extensions but always check." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["NVQ Level 3 Bench Joinery", "Origin Approved Fabricator", "FENSA registered"],
    trade_memberships: ["British Woodworking Federation (BWF)", "FENSA"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 6800,
    free_site_visits: false,
    quote_availability: "Quote within 10 days of site survey",
    quote_turnaround_hours: 240,
    current_status_note: "Booking workshop slots from Q1 2027. Aluminium garden rooms 10 weeks.",
    availability: "later",
    reviews: [
      { customer_name: "Penelope H.", rating: 5, title: "16 weeks lead time but a real orangery, not a glass box", body: "Paul talked us out of a standard conservatory and into a proper orangery with the lantern and lead parapet. The room feels like it's always been there. Hand-painted finish is showroom-perfect.", service_name: "Hardwood orangery (medium 4x5m with lantern)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/82.jpg" },
      { customer_name: "Richard A.", rating: 5, title: "Origin garden room delivered fully crated", body: "Frames arrived on three pallets, the install team had it weather-tight in five days. Bifolds glide effortlessly. The slim mullions make the wall feel almost frameless.", service_name: "Aluminium garden room (Origin spec, 4x4m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/67.jpg" },
      { customer_name: "Christine B.", rating: 5, title: "Conservation officer accepted on first review", body: "Listed Grade II in a conservation area. Paul's drawing pack and Sapele spec went through the conservation officer first attempt. We'd been refused PVCu twice before by other companies.", service_name: "Planning and LBC drawing pack", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/85.jpg" }
    ]
  },

  // 7. WARDROBE MAKER
  {
    trade_slug: "wardrobe-maker",
    profile_slug: "demo-rebecca-stratton-wardrobe-maker-london",
    display_name: "Rebecca Stratton",
    trading_name: "Stratton Fitted Wardrobes",
    city: "London",
    postcode_prefix: "SW18",
    whatsapp: "+44 7700 900307",
    email: "rebecca@strattonwardrobes.co.uk",
    bio: "I run a four-bench cabinet workshop in Wandsworth making floor-to-ceiling fitted wardrobes and walk-in dressing rooms for London homes. Everything is built to your room's exact wonky dimensions — old London houses are never square — using veneered MDF or solid tulipwood frames depending on whether you want sprayed or stained finish. Soft-close everything: Blum hinges, Häfele sliding door systems, soft-close drawers as standard. Internal fit-out is what most makers skimp on — we don't. Pull-out shoe rails, jewellery drawers with velvet inserts, automatic LED strips, integrated steam-condenser hanging. Lead time is 6-8 weeks. I template on site myself with a laser. We deliver carcass-flat then assemble in your room over 2-3 days so we can get past tight staircases that prevent finished delivery. Twelve years in the trade, female-led workshop, mostly word-of-mouth referrals across SW and W London.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "Floor-to-ceiling fitted wardrobe (3m run, hinged doors)", price: 6800, unit: "from", description: "Sprayed shaker or flat-panel doors, full internal fit-out, soft-close Blum hinges, LED strip. 6-week lead." },
      { name: "Floor-to-ceiling fitted wardrobe (3m run, sliding doors)", price: 7900, unit: "from", description: "Häfele Aluflex sliding door system, mirrored or panelled doors, full internal fit-out. Soft-close as standard." },
      { name: "Walk-in dressing room (small, single L-shape)", price: 11500, unit: "from", description: "Open hanging, drawer banks, shoe rails, jewellery drawers, full LED. Sprayed or stained timber finish." },
      { name: "Walk-in dressing room (large, full island)", price: 18500, unit: "from", description: "Full perimeter cabinetry with central island, full hand-spray finish, automatic lighting. 8-week lead." },
      { name: "Single bespoke alcove cupboard (under 1.5m)", price: 2400, unit: "from", description: "Single fitted unit for awkward alcove, painted or stained, soft-close. Includes site template." },
      { name: "Internal fit-out upgrade (per linear m)", price: 380, unit: "per linear m", description: "Pull-out shoe shelves, jewellery drawers with velvet, tie/belt racks, automatic LED for existing carcasses." }
    ],
    faq_items: [
      { q: "Can you fit a wardrobe up a tight London staircase?", a: "Yes — we deliver as flat carcass components and assemble in your bedroom. Two of my fitters specialise in this. Means a slightly longer install (2-3 days vs one) but it's how we serve clients in Victorian terraces and mansion blocks with awkward access." },
      { q: "Do I get sprayed or wrap finish?", a: "Always hand-sprayed in our booth — never vinyl wrap. Vinyl peels in steam rooms within 3-4 years. Spray-painted MDF stays good for 15+ years and can be touched up. Costs about 20% more but it's a different product." },
      { q: "How long is the install?", a: "Standard hinged wardrobe is one day on site for fitting after a site template visit two weeks prior. Walk-in dressing rooms take 2-3 days. Workshop lead time before that is 6-8 weeks." },
      { q: "Do you do hotel/serviced apartment volume?", a: "Yes — we've done up to 40 units in one commission. Lead time stretches but unit price drops 15-20%. Send us your spec." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["City & Guilds Level 3 Cabinetmaking", "Häfele Aluflex certified installer", "Mylands trained sprayer"],
    trade_memberships: ["British Woodworking Federation (BWF)", "Furniture Makers' Company member"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 2400,
    free_site_visits: false,
    quote_availability: "Quote within 5 days of site template",
    quote_turnaround_hours: 120,
    current_status_note: "6-8 week workshop lead. Site templates booked 2 weeks out.",
    availability: "next_week",
    reviews: [
      { customer_name: "Amelia C.", rating: 5, title: "Built to fit our wonky Victorian alcoves", body: "Rebecca templated the room with a laser, every angle was off by 5-10mm. The wardrobes fit so snugly you can't slide a coin in the gaps. Spray finish is showroom-perfect.", service_name: "Floor-to-ceiling fitted wardrobe (3m run, hinged doors)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/57.jpg" },
      { customer_name: "Edward P.", rating: 5, title: "Dressing room is my wife's favourite room", body: "Walk-in dressing room with the island. The internal fit-out — jewellery drawers with velvet, automatic LED, pull-out shoe rails — is the difference. Three other quotes had basic interiors at the same price.", service_name: "Walk-in dressing room (large, full island)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/66.jpg" },
      { customer_name: "Lucy M.", rating: 5, title: "Sliding doors flawless 18 months on", body: "Häfele sliding system, mirrored doors. Glide silently. Soft-close still soft-closes. Worth the extra £1k over hinged.", service_name: "Floor-to-ceiling fitted wardrobe (3m run, sliding doors)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/73.jpg" }
    ]
  },

  // 8. FURNITURE MAKER
  {
    trade_slug: "furniture-maker",
    profile_slug: "demo-henry-blackwood-furniture-maker-hereford",
    display_name: "Henry Blackwood",
    trading_name: "Blackwood Bench",
    city: "Hereford",
    postcode_prefix: "HR1",
    whatsapp: "+44 7700 900308",
    email: "henry@blackwoodbench.co.uk",
    bio: "I make bespoke dining tables, sideboards, console tables and dining chairs by hand from a one-man workshop in a converted barn near Hereford. Everything is built with traditional joinery: through-dovetails on drawers, mortise-and-tenon on frames, draw-bored where it matters. No biscuits, no dominoes for primary joinery. Timbers are English walnut, French oak, ripple sycamore, all from a sawmill in Ross-on-Wye that air-dries planks for two years before kiln finishing. I finish in hard-wax oil (Osmo) or hand-polished shellac for higher-end pieces. Lead time is 8-14 weeks depending on piece. I deliver and white-glove install myself — every piece gets levelled, polished and the client gets a care sheet. Eleven years self-employed after seven years working under a Master at a Cotswolds workshop. Furniture Makers' Company freeman. Pieces are signed and dated underneath.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Bespoke dining table (oak or walnut, 8-seater)", price: 6800, unit: "from", description: "Solid timber top up to 2.4m, traditional joinery base, hard-wax oil finish. Choice of trestle, pedestal or four-leg." },
      { name: "Bespoke dining table (extending, 10-12 seater)", price: 9500, unit: "from", description: "Solid extending table with concealed leaf storage and Festool-precision runners. 14-week lead." },
      { name: "Sideboard or console table (1.8m, three drawers)", price: 4200, unit: "from", description: "Solid timber carcass, dovetailed drawers, oil or shellac finish. Choice of solid or veneered panels." },
      { name: "Set of six bespoke dining chairs", price: 4800, unit: "per set of 6", description: "Solid timber frames, drop-in upholstered seats in your fabric, traditional joinery, hard-wax oil. 12-week lead." },
      { name: "Coffee table (low, solid plank top)", price: 1850, unit: "from", description: "Single-plank or bookmatched walnut/oak coffee table with traditional joinery base." },
      { name: "Single bespoke piece consultation", price: 200, unit: "fixed", description: "Workshop visit, sketch design, timber samples. Deducted from order if you proceed." }
    ],
    faq_items: [
      { q: "Why traditional joinery and not domino/biscuit?", a: "Dominoes and biscuits are fine for cabinet carcasses but they fail under repeated movement of furniture frames over decades. A draw-bored mortise-and-tenon stays tight for 200+ years — there's a reason Georgian tables survive and 1970s furniture doesn't." },
      { q: "What timbers do you use?", a: "English walnut, French oak, ripple sycamore, ash, brown oak. All air-dried 2 years before kilning at a small Herefordshire mill. I'll show you the boards before I cut them — bookmatching and grain selection matters." },
      { q: "How long is a dining table?", a: "8-10 weeks for a standard solid table, 12-14 weeks for extending or chair sets. Workshop is one-man so I run one major piece at a time." },
      { q: "Do you deliver and install?", a: "Yes — I deliver personally within 200 miles of Hereford. Level the piece, polish it, talk you through the care sheet. Outside that radius I crate and send via specialist art-and-antiques courier." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["City & Guilds Level 3 Furniture Making", "Edward Barnsley Workshop trained", "FSC Chain of Custody"],
    trade_memberships: ["The Furniture Makers' Company", "British Woodworking Federation (BWF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 1850,
    free_site_visits: false,
    quote_availability: "Quote within 7 days of brief",
    quote_turnaround_hours: 168,
    current_status_note: "One workshop slot left for Q3 2026. Q4 booking now.",
    availability: "later",
    reviews: [
      { customer_name: "Jonathan H.", rating: 5, title: "The joinery was flawless, dovetails machine-perfect", body: "Henry made us a walnut sideboard with three dovetailed drawers. The dovetails are tighter than my Festool machine could cut them and they're hand-cut. Family heirloom material.", service_name: "Sideboard or console table (1.8m, three drawers)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/69.jpg" },
      { customer_name: "Diana W.", rating: 5, title: "14 weeks for the extending table but worth every day", body: "Solid French oak, 2.6m extending to 3.4m. The leaf storage mechanism is engineering-grade — slides out under the top, no leaf to store separately. Six months on, table feels like it's always been here.", service_name: "Bespoke dining table (extending, 10-12 seater)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/76.jpg" },
      { customer_name: "Christopher S.", rating: 5, title: "Delivered and white-gloved himself", body: "Henry drove from Hereford to Surrey with the table, levelled it, polished it, even adjusted a wonky leg cap caused by our uneven floor. That kind of after-care is gone in most trades.", service_name: "Bespoke dining table (oak or walnut, 8-seater)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/83.jpg" }
    ]
  },

  // 9. JOINERY WORKSHOP
  {
    trade_slug: "joinery-workshop",
    profile_slug: "demo-michael-tindall-joinery-workshop-leeds",
    display_name: "Michael Tindall",
    trading_name: "Tindall Joinery Works",
    city: "Leeds",
    postcode_prefix: "LS11",
    whatsapp: "+44 7700 900309",
    email: "michael@tindalljoinery.co.uk",
    bio: "General bench joinery workshop on the Hunslet trading estate in Leeds — four joiners, two machinists, a 4,500 sq ft shop. We do whatever one-off bespoke joinery jobs come through the door: one-off staircases, internal doors, library walls, shop fitouts, museum cases, panelled rooms, bay windows, conservatory frames, garden gates, you name it. We're the workshop architects call when something doesn't fit a standard supplier. Twenty-seven years in business since I started as a one-man band. We mill from rough-sawn boards (Whitmore Sawmills, Derby) and finish in our spray booth. Lead time depends on job — 3-4 weeks for a one-off panelled room, 8-12 weeks for a full house pack of doors, staircases and joinery. We supply to trade (architects, builders, designers) and direct to public. Install is sub-let to two trusted joiners we've worked with for over a decade. BWF Code of Conduct, FSC certified, fully ISO 9001 documented.",
    years_in_trade: 27,
    start_year: 1999,
    priced_services: [
      { name: "Panelled wall or library wall (per linear m)", price: 850, unit: "per linear m", description: "Bespoke solid timber panelled wall, raised panels or shaker, sprayed finish. Includes design CAD." },
      { name: "Bespoke shop fitout (per linear m of cabinetry)", price: 720, unit: "per linear m", description: "Trade-spec shop counters, display cabinets, back-bar joinery. Commercial-grade construction." },
      { name: "One-off bespoke internal door + frame", price: 685, unit: "per door+frame", description: "Single bespoke door, matching frame and architrave, in any timber and configuration. 4-week lead." },
      { name: "Bespoke garden gate (timber, framed and braced)", price: 980, unit: "from", description: "Solid hardwood gate, ironmongery included, painted or oiled. 4-week lead." },
      { name: "Museum or display case (bespoke)", price: 1850, unit: "from", description: "Bespoke timber and glass display case, lockable, lit if required. To architect's drawings." },
      { name: "Workshop hourly rate (design or trade work)", price: 65, unit: "per hour", description: "For unusual one-off jobs we'll quote hourly — design work, modifications, small bespoke runs. Min 4-hour booking." }
    ],
    faq_items: [
      { q: "What do you actually make?", a: "One-off bespoke joinery of any kind. If it's a piece of timber that has to fit a specific opening or function, we'll quote it. We're the workshop architects call when standard suppliers can't do it. Last month: a curved library bookcase, a museum display case, a 14-door pack for a country house, a shop counter, three garden gates." },
      { q: "Will you supply trade?", a: "Yes — about 40% of our work is trade supply to architects, builders and interior designers. Trade pricing available with a credit account application." },
      { q: "Can you work to my drawings?", a: "Yes — we work from architect's CAD drawings or hand-drawn sketches. We'll send shop drawings back for approval before cutting." },
      { q: "Do you fit?", a: "We sub-let to two trusted joiners. For trade clients we usually supply only and the main contractor's joiner fits. For private clients we'll organise fit through our subs." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["NVQ Level 3 Bench Joinery", "ISO 9001 certified workshop", "FSC Chain of Custody"],
    trade_memberships: ["British Woodworking Federation (BWF) Code of Conduct", "Institute of Carpenters (ICW)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 685,
    free_site_visits: false,
    quote_availability: "Quote within 5 days of detailed brief",
    quote_turnaround_hours: 120,
    current_status_note: "Workshop currently 6-week lead. Small bespoke items 3 weeks. Large packs 12 weeks.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Architect Sam B.", rating: 5, title: "First call for unusual bespoke work", body: "Michael's shop has made our practice's bespoke joinery for six years now. Anything our designers draw, his team builds. Shop drawings come back within a week, build is on schedule.", service_name: "Workshop hourly rate (design or trade work)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/62.jpg" },
      { customer_name: "Joanna F.", rating: 5, title: "Library wall fit perfectly first time", body: "Bespoke library wall with curved corner. Templated in my hallway, delivered in eight pieces, fitter had it together in two days. Spray finish flawless.", service_name: "Panelled wall or library wall (per linear m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/78.jpg" },
      { customer_name: "Restaurant owner Paul M.", rating: 5, title: "Whole shop fitout in 6 weeks", body: "Bar counter, back-bar, banquette frames, all from Michael's workshop. Delivered fully crated to our restaurant fit-out and the main contractor's joiner had it in over a long weekend.", service_name: "Bespoke shop fitout (per linear m of cabinetry)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/81.jpg" }
    ]
  },

  // 10. WORKTOP MANUFACTURER
  {
    trade_slug: "worktop-manufacturer",
    profile_slug: "demo-claire-bennett-worktop-manufacturer-derby",
    display_name: "Claire Bennett",
    trading_name: "Bennett Worktops",
    city: "Derby",
    postcode_prefix: "DE21",
    whatsapp: "+44 7700 900310",
    email: "claire@bennettworktops.co.uk",
    bio: "We make solid timber kitchen worktops, end-grain butcher block tops and oversized prep counters from a 2,500 sq ft workshop on the Spondon Industrial Estate in Derby. Full-stave 40mm solid oak, walnut, iroko and sapele is our bread and butter. End-grain butcher block in maple and oak we glue up in our own jigs to 60mm — heavy, beautiful, knife-friendly. Lead time is 4-6 weeks for solid wood, 8 weeks for end-grain or oversized runs. We also sub-let quartz and composite stone tops to a partner fabricator in Nottingham — we template and project-manage the whole worktop package so kitchen makers and homeowners have one supplier for timber and stone. Tops ship pre-oiled and sealed with three coats of Osmo, with cut-outs for sinks and hobs done in-house from your kitchen drawings. Eight years self-employed, female-led workshop, mostly working with bespoke kitchen makers across the Midlands.",
    years_in_trade: 8,
    start_year: 2018,
    priced_services: [
      { name: "Full-stave oak worktop (per linear m, 40mm)", price: 285, unit: "per linear m", description: "Full-stave 40mm solid European oak, pre-oiled with Osmo, cut-outs for sinks and hobs included. Width up to 720mm." },
      { name: "Full-stave walnut worktop (per linear m, 40mm)", price: 425, unit: "per linear m", description: "American walnut, full-stave 40mm, pre-oiled. Premium finish for islands and feature runs." },
      { name: "End-grain butcher block top (per sqm, 60mm)", price: 980, unit: "per sqm", description: "End-grain maple or oak butcher block, 60mm thick, glued in our jig, food-safe oiled. Knife-friendly." },
      { name: "Solid iroko worktop (per linear m, 40mm)", price: 320, unit: "per linear m", description: "Iroko, naturally oily and water-resistant, great around sinks. Pre-oiled. Up to 3m lengths." },
      { name: "Quartz worktop package (templated + sub-let fabrication)", price: 380, unit: "per linear m", description: "Sub-let to partner stone fabricator. We template, project-manage, deliver and install. Excludes worktop slab cost (£250-£500/m depending on quartz)." },
      { name: "Site template visit", price: 180, unit: "fixed", description: "Templating with digital scribe, dimensions, cut-out positions. Deducted from order." }
    ],
    faq_items: [
      { q: "Solid wood or quartz — what's better?", a: "Different jobs. Quartz is bombproof and stain-resistant but cold and uniform. Solid wood needs an oil refresh every 1-2 years but it ages beautifully and you can re-sand it twice over its life. End-grain butcher block is the only worktop you can chop directly on without damaging." },
      { q: "How thick should an island top be?", a: "40mm full-stave is the standard. For an island we often spec 60mm end-grain or build a 40mm top with a 40mm mitred drop edge to look like an 80mm slab. It changes the visual weight massively." },
      { q: "Why end-grain butcher block?", a: "End-grain timber closes back over the knife edge — it's the only worktop a chef can use a 10-inch chef's knife on without dulling the blade or marking the surface. We glue 60mm thick because thinner cups and warps." },
      { q: "Do you do the quartz yourself?", a: "No — quartz needs water-jet and CNC stone fabrication which is a different workshop entirely. We sub-let to a Nottingham fabricator we've worked with for years and project-manage the whole package so you have one supplier." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["City & Guilds Level 3 Bench Joinery", "Food-Safe Finish certified", "FSC Chain of Custody"],
    trade_memberships: ["British Woodworking Federation (BWF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 580,
    free_site_visits: false,
    quote_availability: "Quote within 48 hours of linear m enquiry",
    quote_turnaround_hours: 48,
    current_status_note: "Solid timber 4-6 week lead. End-grain 8 weeks. Quartz package add 2 weeks.",
    availability: "this_week",
    reviews: [
      { customer_name: "Kitchen maker Tom G.", rating: 5, title: "Trade-supply quality is exceptional", body: "Claire's workshop now does the timber tops for every kitchen we fit. Always on time, cut-outs to the mm, oiled perfectly. Trade pricing is fair too.", service_name: "Full-stave oak worktop (per linear m, 40mm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/55.jpg" },
      { customer_name: "Sarah J.", rating: 5, title: "End-grain butcher block is the centrepiece", body: "60mm end-grain maple island top. Heavy as anything, took four of us to lift it on. Two years in, knife-marks just disappear with an oil refresh. Looks better every year.", service_name: "End-grain butcher block top (per sqm, 60mm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/70.jpg" },
      { customer_name: "Daniel R.", rating: 5, title: "Single supplier for timber + quartz package", body: "Claire templated, organised the quartz from her partner fabricator, both delivered same week. One quote, one supplier, one point of contact. Stress-free.", service_name: "Quartz worktop package (templated + sub-let fabrication)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/86.jpg" }
    ]
  },

  // 11. GLASS MANUFACTURER
  {
    trade_slug: "glass-manufacturer",
    profile_slug: "demo-stephen-marsh-glass-manufacturer-stoke",
    display_name: "Stephen Marsh",
    trading_name: "Marsh Architectural Glass",
    city: "Stoke-on-Trent",
    postcode_prefix: "ST4",
    whatsapp: "+44 7700 900311",
    email: "stephen@marshglass.co.uk",
    bio: "Toughened and laminated architectural glass fabricated to your sizes from our 6,000 sq ft works on the Trentham Lakes Industrial Estate. We cut, edge, drill, toughen and laminate in-house — no sub-letting, no waiting for someone else's kiln. Specialism is frameless glass balustrades for staircases, mezzanines and Juliet balconies, splashbacks (toughened with applied colour back-paint), shower screens, structural glass floors and roof panels. Every panel is cut to your survey, polished pencil-edge as standard, drilled or notched for fittings, toughened to BS EN 12150-1. Building Regs Approved Document K balustrade glass is always toughened-laminated for safety. Lead time is 2-3 weeks for standard, 4 weeks for laminated or coloured back-paint. Delivery is on edge-protected stillage with crew. Install we sub-let to two glaziers — or we ship-only to your contractor with fitting instructions. Twenty years in trade glass, IGGA member.",
    years_in_trade: 20,
    start_year: 2006,
    priced_services: [
      { name: "Toughened glass splashback (per sqm)", price: 195, unit: "per sqm", description: "10mm toughened, back-painted in any RAL, polished pencil edges, socket cut-outs. 2-week lead." },
      { name: "Frameless glass balustrade panel (per linear m)", price: 320, unit: "per linear m", description: "15mm toughened-laminated balustrade glass to Building Regs Approved Document K, polished edges, channel-fixing cutouts. Frameless." },
      { name: "Juliet balcony glass (full sheet, fitted to opening)", price: 685, unit: "from", description: "Single full-width toughened-laminated panel for Juliet balcony, drilled for face-fix standoffs. Building Regs compliant." },
      { name: "Shower screen (frameless, walk-in)", price: 480, unit: "from", description: "10mm toughened, polished edges, hinge/clamp cutouts, anti-limescale coating. Up to 2m high." },
      { name: "Structural glass floor panel (per sqm)", price: 1280, unit: "per sqm", description: "Triple-laminated structural floor glass, 33mm total, anti-slip top film. Engineered for residential loading." },
      { name: "Bespoke shaped or curved glass", price: 450, unit: "from", description: "Bespoke-shaped panels, holes, notches, mitres. POA depending on complexity." }
    ],
    faq_items: [
      { q: "Is your balustrade glass legal?", a: "Yes — every balustrade panel is 15mm toughened-laminated (10mm tough + 1.5mm interlayer + 4mm tough or similar lay-up) to satisfy Approved Document K. The interlayer prevents catastrophic failure if a panel breaks. We supply test certificates with every order." },
      { q: "How precise are your cutouts?", a: "Tolerances are ±1mm on edges and ±0.5mm on drilled holes. Hinge cutouts for shower hinges and balustrade clamp slots are within tolerance every time — our CNC waterjet machine doesn't have a bad day." },
      { q: "Can you do back-painted splashbacks in any colour?", a: "Yes — we colour-match any RAL or Farrow & Ball reference. Hand-sprayed back-paint, sealed against moisture. Anti-fingerprint top surface optional for darker colours." },
      { q: "Do you fit?", a: "Install sub-let to two glaziers. Typical balustrade install is one day, splashback a half-day. Or we ship-only with full fitting instructions for your contractor." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["BS EN 12150-1 toughening to standard", "CE-marked structural glass", "CITB Site Manager Safety"],
    trade_memberships: ["Institute of Glazing Glass Association (IGGA)", "Glass and Glazing Federation (GGF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 480,
    free_site_visits: false,
    quote_availability: "Quote within 24 hours of sizes",
    quote_turnaround_hours: 24,
    current_status_note: "Standard work 2-3 week lead. Laminated balustrade 4 weeks.",
    availability: "this_week",
    reviews: [
      { customer_name: "Helen B.", rating: 5, title: "Frameless balustrade is perfection", body: "15mm toughened-laminated across our mezzanine. Stephen's team templated, drilled the standoff holes to the mm, delivered crated. Glazier fitted in a day. View through is unbroken — it's like the rail isn't there.", service_name: "Frameless glass balustrade panel (per linear m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/80.jpg" },
      { customer_name: "Andrew T.", rating: 5, title: "Back-painted splashback matched Farrow & Ball", body: "Hague Blue splashback behind our hob. Stephen colour-matched exactly, hand-sprayed the back, polished edges. Two years in, still looks brand new.", service_name: "Toughened glass splashback (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/84.jpg" },
      { customer_name: "Builder Mark D.", rating: 5, title: "Trade-supply consistency is unbeatable", body: "Use Stephen for every glass element on our high-end residential work. Quotes within 24 hours, lead times honoured, edges polished. The difference between a good fit and a bad one is whether the glass arrives right — his always does.", service_name: "Shower screen (frameless, walk-in)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/87.jpg" }
    ]
  },

  // 12. SHED MANUFACTURER
  {
    trade_slug: "shed-manufacturer",
    profile_slug: "demo-graham-pierce-shed-manufacturer-norwich",
    display_name: "Graham Pierce",
    trading_name: "Pierce Garden Buildings",
    city: "Norwich",
    postcode_prefix: "NR7",
    whatsapp: "+44 7700 900312",
    email: "graham@piercegardens.co.uk",
    bio: "Family-run shed and summerhouse workshop on the outskirts of Norwich — myself and three joiners. We've been making timber garden buildings here since 2007 from FSC-sourced redwood and Eastern White Cedar. Standard sheds are 16mm shiplap T&G cladding on 38x63mm treated framework, EPDM rubber roofs (lasts 30+ years, no felt nonsense), 70mm wall thickness with optional 50mm insulation upgrade. Summerhouses get double-glazed timber windows from a partner joiner in King's Lynn, pitched apex or hipped roofs, and verandas if you want them. Lead time is 3-5 weeks for standard sheds, 6-8 weeks for summerhouses. We deliver flat-pack or assembled on rigid base — your call. Assembled delivery is two-man crew, half-day install on your prepared concrete or paving slab base. We don't do log cabins or steel structures — sticking to what we're good at. About 60% of orders are domestic, 30% allotment associations and 10% small commercial.",
    years_in_trade: 19,
    start_year: 2007,
    priced_services: [
      { name: "Standard pent shed (8x6 ft, shiplap)", price: 1280, unit: "from", description: "16mm shiplap T&G, 38x63mm treated frame, EPDM roof, single door + window. Delivered flat-pack or assembled." },
      { name: "Standard apex shed (10x8 ft, shiplap)", price: 1850, unit: "from", description: "Apex roof, shiplap T&G, EPDM, double doors + two windows. Standard 16mm cladding." },
      { name: "Insulated workshop shed (12x10 ft)", price: 3850, unit: "from", description: "70mm wall with 50mm rigid insulation, double-glazed windows, EPDM roof, double doors. Suitable for year-round workshop use." },
      { name: "Summerhouse with veranda (10x10 ft)", price: 5400, unit: "from", description: "Double-glazed timber windows, french doors, full veranda with deck boards, apex pitched roof. EPDM as standard." },
      { name: "Allotment shed pack (8x6, no windows, basic)", price: 985, unit: "from", description: "Single door, no windows, shiplap, EPDM roof. Designed for allotment associations — volume discount on 10+." },
      { name: "Bespoke garden building (custom design)", price: 4200, unit: "from", description: "Custom design to your dimensions and requirements. Workshop visit recommended. POA above base." }
    ],
    faq_items: [
      { q: "Why EPDM not felt?", a: "Felt roofs last 5-8 years before they need replacing, and the felt nails always start lifting. EPDM rubber is a one-piece sheet glued down, lasts 30+ years, doesn't perish in UV. £150 more on a standard shed and you never deal with the roof again." },
      { q: "Do you do a concrete base?", a: "We don't do the base ourselves but we'll talk you through it. Standard recommendation is a 100mm concrete slab on hardcore, or properly bedded 50mm paving slabs on sand for smaller sheds. We can recommend a Norfolk groundworker." },
      { q: "Can I insulate it for year-round workshop use?", a: "Yes — we upgrade the wall to 70mm with 50mm rigid foam insulation, double-glaze the windows, fit an insulated EPDM roof. Suitable for use as a home office or workshop in winter. Adds about £1,800-£2,400 to a standard shed." },
      { q: "Do you do assembled delivery?", a: "Yes — two-man crew, half-day install on your prepared base. Adds £180-£280 depending on shed size and travel. Flat-pack saves money if you're handy with a drill." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["FSC Chain of Custody certified", "PEFC certified timber sourcing"],
    trade_memberships: ["British Woodworking Federation (BWF) Garden Buildings group"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 985,
    free_site_visits: false,
    quote_availability: "Quote within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "3-5 week lead on sheds. Summerhouses 6-8 weeks. Delivery slots booked weekly.",
    availability: "this_week",
    reviews: [
      { customer_name: "Allotment chair Bill T.", rating: 5, title: "Twelve sheds for the allotment site", body: "Ordered twelve basic sheds for our association. Graham gave us a volume price, delivered all in one Saturday, two-man crew assembled four of them on prepared bases. Membership delighted.", service_name: "Allotment shed pack (8x6, no windows, basic)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/88.jpg" },
      { customer_name: "Margaret K.", rating: 5, title: "Summerhouse with veranda — best of the garden", body: "10x10 summerhouse with veranda became the room I sit in every afternoon. Double-glazed windows mean it's usable even in October. EPDM roof shed leaves in a storm without a single leak.", service_name: "Summerhouse with veranda (10x10 ft)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/89.jpg" },
      { customer_name: "Workshop hobbyist Pete L.", rating: 5, title: "Insulated workshop usable all winter", body: "12x10 insulated workshop with double-glazed windows. Heated comfortably with a 2kW heater in January. Walls thick enough to muffle the dust extractor. Best decision of the project.", service_name: "Insulated workshop shed (12x10 ft)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/90.jpg" }
    ]
  },

  // 13. GARDEN ROOM MANUFACTURER
  {
    trade_slug: "garden-room-manufacturer",
    profile_slug: "demo-emily-radcliffe-garden-room-manufacturer-guildford",
    display_name: "Emily Radcliffe",
    trading_name: "Radcliffe Garden Rooms",
    city: "Guildford",
    postcode_prefix: "GU2",
    whatsapp: "+44 7700 900313",
    email: "emily@radcliffegardenrooms.co.uk",
    bio: "We design and manufacture fully insulated garden rooms — proper outdoor home offices and studios — from a 5,000 sq ft workshop on the Slyfield Industrial Estate in Guildford. Construction is SIPS (Structurally Insulated Panel System) — 142mm panels with U-value 0.15 W/m²K — which means the room is genuinely usable year-round with under-window radiators or a single air-conditioning unit. External finish options are timber shiplap, fibre cement cladding or composite vertical boarding. Internally: ply finish, painted MDF, or oak veneered panels. Standard spec includes double-glazed aluminium bifold doors, two windows, fully pre-wired to a consumer unit (we sub-let final connection to a Part P electrician), insulated cassette floor with vinyl wood-effect flooring, and a 1.4m roof overhang. Lead time is 8-12 weeks. Install is sub-let to two install crews — typical site time is 5-8 days from base ready to handover. Sub 30m² rooms are Permitted Development so usually no planning needed.",
    years_in_trade: 9,
    start_year: 2017,
    priced_services: [
      { name: "Small garden office (3x3m, fully insulated)", price: 19500, unit: "from", description: "SIPS construction, U-value 0.15, bifold doors, two windows, ply or painted interior, vinyl floor, pre-wired. Excludes base + electrical connection." },
      { name: "Medium garden room (4x4m)", price: 26500, unit: "from", description: "Same SIPS spec, larger format. Choice of cladding. Standard internal fit-out included." },
      { name: "Large garden room (5x4m)", price: 32500, unit: "from", description: "5x4m SIPS room, premium cladding options, oak veneer interior available. 12-week lead." },
      { name: "Garden studio with mezzanine (4x5m, 3m high)", price: 42000, unit: "from", description: "Raised eaves, mezzanine sleeping platform, full bathroom plumbing pre-run. Glamping or guest spec." },
      { name: "Base preparation package", price: 3200, unit: "from", description: "Concrete or screw-pile base sub-let to partner groundworker. Templated to room footprint." },
      { name: "Workshop visit and design consultation", price: 200, unit: "fixed", description: "Workshop tour, walk-through completed builds, CAD layout. Refunded against order." }
    ],
    faq_items: [
      { q: "Why SIPS and not stud-and-batt?", a: "SIPS panels are pre-bonded structural insulation. U-value 0.15 W/m²K is twice as thermally efficient as standard timber-frame construction with mineral wool. Zero cold-bridging through studs. Means a single 2kW heater holds the room comfortable in January and you don't need full central heating." },
      { q: "Do I need planning permission?", a: "Most sub-30m² garden rooms fall under Permitted Development if they're under 2.5m high at the eaves and you don't live in a conservation area. We provide a Lawful Development Certificate application if you want council confirmation. Anything over 30m² or close to boundaries — likely planning needed." },
      { q: "Can I sleep in it?", a: "Yes — sub-30m² garden rooms can be used as ancillary accommodation under PD but cannot be a primary dwelling. We pre-plumb our garden studio with bathroom roughs and an oak-veneer mezzanine for sleeping. Popular for boomerang teenagers and grandparent annexes." },
      { q: "How long is the site install?", a: "5-8 days from prepared base to handover. We sub-let install to two crews. Base prep (concrete or screw-piles) is 1-2 days separately, then we drop the SIPS panels and weather-tight in 3-4 days, then internal fit-out, electrical first-fix sub-let to Part P sparky." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["SIPS UK manufacturer approved", "FSC Chain of Custody", "Passive House Designer training"],
    trade_memberships: ["British Woodworking Federation (BWF)", "Structural Timber Association"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 19500,
    free_site_visits: false,
    quote_availability: "Quote within 7 days of brief and site photos",
    quote_turnaround_hours: 168,
    current_status_note: "Booking workshop slots from September 2026.",
    availability: "later",
    reviews: [
      { customer_name: "Lawrence M.", rating: 5, title: "12 weeks lead time, used it through January", body: "SIPS construction is the real deal. 4x4m garden office, single 2kW heater holds it at 21°C in January with frost outside. Bifold doors don't draught. Worth every penny over the cheap stud-built rooms.", service_name: "Medium garden room (4x4m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/91.jpg" },
      { customer_name: "Architect Hannah W.", rating: 5, title: "Spec-grade construction my clients deserve", body: "Spec'd Emily's rooms on four projects now. The U-value claim is real — measured in-use against my standard timber-frame designs and the SIPS rooms hold heat 40% better. Spec sheets and CAD support save me days.", service_name: "Workshop visit and design consultation", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/92.jpg" },
      { customer_name: "Susan P.", rating: 5, title: "Studio with mezzanine — my grandkids' favourite room", body: "4x5m studio with oak mezzanine and pre-plumbed bathroom. Grandkids love sleeping out there. Insulation means they're warm even in October. Install crew were finished in seven days from base ready.", service_name: "Garden studio with mezzanine (4x5m, 3m high)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/93.jpg" }
    ]
  },

  // 14. STEEL FABRICATOR
  {
    trade_slug: "steel-fabricator",
    profile_slug: "demo-david-hughes-steel-fabricator-sheffield",
    display_name: "David Hughes",
    trading_name: "Hughes Structural Steel",
    city: "Sheffield",
    postcode_prefix: "S9",
    whatsapp: "+44 7700 900314",
    email: "david@hughesfab.co.uk",
    bio: "Twenty-three years fabricating structural steel from a 12,000 sq ft works on the Tinsley Industrial Estate in Sheffield. We cut, weld and finish RSJs, UC columns, mezzanine frames, bespoke balustrades, gates and decorative metalwork — all to engineer's calcs and CE-marked under Execution Class EXC2 (Factory Production Control assessed and certified). Steel is sourced from British Steel and Tata UK, all with mill certificates. MIG and TIG welding to BS EN ISO 9606-1, fully traceable on every weld. We do RSJs for domestic loft conversions and side returns (typical job £800-£2,500), full mezzanine frames for commercial fit-outs, frameless and balustraded glass-channel galvanised supports, plus contemporary residential staircases with bespoke spindles and handrails. Lead time is 3-6 weeks for standard structural, 8-10 weeks for decorative architectural metalwork. We galvanise, prime and powder-coat in-house. Delivery on flat-bed to site. Install we sub-let to two structural steel installers we've used for over a decade. IOM3 corporate member.",
    years_in_trade: 23,
    start_year: 2003,
    priced_services: [
      { name: "Domestic RSJ to engineer's spec (per beam)", price: 850, unit: "from", description: "Cut to length, drilled to engineer's calcs, primed and labelled. Typical loft conversion or kitchen-knock-through beam." },
      { name: "Steel mezzanine frame (per sqm of floor)", price: 195, unit: "per sqm", description: "Full mezzanine frame for commercial fit-out, posts/beams/decking supports, CE-marked. Excludes deck and rail." },
      { name: "Bespoke external steel staircase", price: 4800, unit: "from", description: "Hot-rolled steel stringers, treads, handrails, galvanised and powder-coated. Building Regs compliant." },
      { name: "Frameless glass balustrade base channel (per linear m)", price: 285, unit: "per linear m", description: "Galvanised steel channel for frameless glass balustrade, CE-marked, fixings to engineer's spec." },
      { name: "Bespoke metal gate (driveway, hot-dip galvanised)", price: 1850, unit: "from", description: "Hot-dip galvanised gate, traditional or contemporary design, primed and powder-coated. Up to 4m wide." },
      { name: "Bespoke decorative architectural metalwork", price: 95, unit: "per hour", description: "Hand-rate for bespoke decorative — balcony railings, screens, fireplaces. Typical project 20-80 hours." }
    ],
    faq_items: [
      { q: "Are you CE-marked?", a: "Yes — Factory Production Control assessed and certified to Execution Class EXC2 under BS EN 1090-1. Required for structural steel that's CE-marked. Without it, your structural engineer can't sign off the design and Building Control won't pass it." },
      { q: "Can you supply the steel calcs?", a: "No — calcs need to come from your structural engineer who's been on site and surveyed loadings. We fabricate to their spec. I can recommend three structural engineers across Yorkshire if you need one." },
      { q: "What's the lead time on a kitchen RSJ?", a: "3-4 weeks from drawings. Quick turnaround for a single beam — we'll cut, drill, prime and label it for the position. Your builder fits and we send a delivery slip with the size and bolt-hole positions confirmed." },
      { q: "Do you do decorative as well as structural?", a: "Yes — bespoke metalwork is about 30% of our work. Architectural railings, garden gates, bespoke fireplaces, balconies, balustrade screens. Hand-rated because every piece is different." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["BS EN 1090-1 EXC2 CE-marking certified", "BS EN ISO 9606-1 welder certified", "CSCS Site Manager"],
    trade_memberships: ["Institute of Materials, Minerals and Mining (IOM3)", "British Constructional Steelwork Association (BCSA)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 850,
    free_site_visits: false,
    quote_availability: "Quote within 3 days of engineer's drawings",
    quote_turnaround_hours: 72,
    current_status_note: "3-6 week lead on structural. Decorative metalwork booking 8 weeks.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Builder Steve C.", rating: 5, title: "Every RSJ to the mm", body: "Use David for every RSJ on every loft conversion. Beams arrive cut, drilled, primed, labelled with the position. Bolt-holes line up first time, every time. Saves us a day per job versus the cheap fabricators.", service_name: "Domestic RSJ to engineer's spec (per beam)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/94.jpg" },
      { customer_name: "Mezzanine client Karen B.", rating: 5, title: "Full mezzanine in three weeks", body: "180sqm mezzanine for our warehouse fit-out. David's team fabricated the frame in three weeks, delivered flat-bed, his install sub had it up in four days. CE-mark documentation pack signed off by Building Control without a question.", service_name: "Steel mezzanine frame (per sqm of floor)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/95.jpg" },
      { customer_name: "Architect Paul S.", rating: 5, title: "Bespoke staircase is a sculpture", body: "Hot-rolled steel staircase with bespoke spindle pattern for a high-end residential project. David's team welded the spindle work by hand, finish is flawless. Delivered crated to site, install sub had it in over a day.", service_name: "Bespoke external steel staircase", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/96.jpg" }
    ]
  }
];
