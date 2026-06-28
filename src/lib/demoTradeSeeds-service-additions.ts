// Demo profile seeds for Xrated Trade Off — Phase 2 "Service additions" trades.
//
// Adds 10 specialist UK trades beyond the original 27: damp-proofer,
// drainage-engineer, chimney-sweep, tree-surgeon, pest-control,
// asbestos-removal, lead-worker, sash-window-restorer,
// post-construction-cleaner, garden-designer.
//
// Phone numbers all use the Ofcom-reserved fiction range +44 7700 900XXX.
// Names are realistic but not famous-person.
// Prices are anchored to UK 2026 industry benchmarks.

import type { DemoTradeSeed } from "./demoTradeSeeds";

export const DEMO_TRADE_SEEDS_SERVICE_ADDITIONS: DemoTradeSeed[] = [
  // 1. DAMP PROOFER
  {
    trade_slug: "damp-proofer",
    profile_slug: "demo-naomi-patel-damp-proofer-bristol",
    display_name: "Naomi Patel",
    trading_name: "Patel Damp & Timber",
    city: "Bristol",
    postcode_prefix: "BS6",
    whatsapp: "+44 7700 900173",
    email: "naomi@pateldampandtimber.co.uk",
    bio: "I came into damp work via building surveying — I spent six years writing damp reports for a chartered firm in Clifton before I got fed up watching cowboy contractors butcher the recommendations. I retrained on the practical side, sat my CSRT and PCA exams, and have been running my own remedial outfit since 2017. Most of my work is rising damp diagnosis on Victorian terraces, penetrating damp in solid-wall properties, and basement tanking for the Georgian stock around Clifton and Cotham. I'm the one who'll tell you when you don't actually need a chemical DPC — most so-called rising damp is condensation or a failed gutter. When you do need injection, I use cream not fluid because it's far more controllable. Every survey comes with moisture readings, salt analysis and photos so you can challenge any quote — including mine.",
    years_in_trade: 9,
    start_year: 2017,
    priced_services: [
      { name: "Full damp survey with written report", price: 285, unit: "fixed", description: "Moisture meter, salt test, drilled samples where needed. Written PCA-format report with photos within 5 working days." },
      { name: "Chemical DPC injection (per linear m)", price: 78, unit: "per linear m", description: "Cream-injected silicone DPC into mortar bed. Includes hacking off contaminated plaster up to 1m and replastering with salt-retardant render." },
      { name: "Penetrating damp treatment (single elevation)", price: 1450, unit: "from", description: "Identify and remedy external defect (pointing, render crack, flashing), then internal re-plaster of affected area. Includes 10-yr guarantee on the treated wall." },
      { name: "Basement tanking (cementitious system, per sqm)", price: 165, unit: "per sqm", description: "Two-coat cementitious tanking slurry to vertical wall, fillet to floor, ready for plaster finish. Type A waterproofing only — for full BS 8102 design contact me." },
      { name: "Condensation & ventilation survey", price: 195, unit: "fixed", description: "Relative humidity log over 7 days, dewpoint analysis, written report with recommendations. Often saves you a £4k chemical DPC you didn't need." },
      { name: "Cavity wall tie replacement (per tie)", price: 22, unit: "per tie", description: "Stainless replacement ties into existing cavity, mortar made good. Min 50 ties per visit." }
    ],
    faq_items: [
      { q: "Is rising damp even a real thing?", a: "Yes but it's massively over-diagnosed. Probably 1 in 5 properties I survey actually has true rising damp — the rest is condensation, leaking gutters, raised external ground levels or salt contamination from old chemical DPCs. My survey tells you which it is before anyone drills your wall." },
      { q: "How long is your guarantee?", a: "10 years on chemical DPC and penetrating damp work, 20 years on tanking. The guarantee is insurance-backed via the PCA's GPI scheme, so it survives me retiring." },
      { q: "Do I need to move out during treatment?", a: "For a chemical DPC on one wall, no — it's noisy for a day or two and dusty but liveable. For full tanking of a basement you'd want to be out for a week minimum. I'll be straight about it at survey stage." },
      { q: "Will you tell me if I don't need the work?", a: "Yes, and I do regularly. If your damp is condensation I'll write that in the report and recommend a PIV unit or extractor — those are £400 jobs, not £4k jobs." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["CSRT (Certificated Surveyor in Remedial Treatment)", "CSSW (Certificated Surveyor in Structural Waterproofing)", "PCA Qualified Damp Technician", "CSCS Card"],
    trade_memberships: ["Property Care Association (PCA)", "Royal Institution of Chartered Surveyors (RICS) — affiliate"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 285,
    free_site_visits: false,
    quote_availability: "Survey first (paid), quote within 5 working days",
    quote_turnaround_hours: 120,
    current_status_note: "Surveys within 7-10 days. Treatment work booking 3 weeks out.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Hannah W.", rating: 5, title: "Saved us £3k", body: "Two damp companies told us we needed a full chemical DPC. Naomi spent an hour with a moisture meter and showed us it was a failed gutter behind the rendered wall. Fixed the gutter, problem gone. Honest survey for £285.", service_name: "Full damp survey with written report", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/72.jpg" },
      { customer_name: "Marcus D.", rating: 5, title: "Basement actually dry now", body: "1840s house, basement was always damp despite a previous tanking job. Naomi did proper cementitious tanking with the right detailing at the floor junction. Dry as a bone six months in.", service_name: "Basement tanking (cementitious system, per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/73.jpg" },
      { customer_name: "Priya S.", rating: 5, title: "Clear report I could understand", body: "Got a survey for our flat purchase. Report was thorough, photos labelled, recommendations broken down by urgency. Vendor knocked £4k off the price.", service_name: "Full damp survey with written report", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/74.jpg" }
    ]
  },

  // 2. DRAINAGE ENGINEER
  {
    trade_slug: "drainage-engineer",
    profile_slug: "demo-kieran-walsh-drainage-engineer-liverpool",
    display_name: "Kieran Walsh",
    trading_name: "Walsh Drainage Solutions",
    city: "Liverpool",
    postcode_prefix: "L18",
    whatsapp: "+44 7700 900284",
    email: "kieran@walshdrainage.co.uk",
    bio: "I came up through a big national drainage outfit doing emergency unblocks in the rain at three in the morning for ten years — you learn fast that way. I went out on my own in 2020 with one jet van, and now run two vans covering Merseyside, Wirral and West Lancs. About half my work is blocked drains and CCTV surveys for homeowners and lettings agents, and the other half is no-dig sewer lining for older Victorian clay runs that don't justify a full dig-up. I'm WaterSafe registered and Water Industry-approved for connections to the public sewer. If you've had a quote for a full excavation, ring me before you sign anything — nine times out of ten we can line it for half the price with no disturbance to the garden. Every CCTV survey comes with a USB and a written summary with chainage references.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "Emergency drain unblock (single visit)", price: 145, unit: "fixed", description: "High-pressure jetting up to 3000psi, clears most domestic blockages. Includes CCTV check of cleared line. 1-hour response within Liverpool." },
      { name: "CCTV drain survey with written report", price: 265, unit: "fixed", description: "Full colour CCTV survey, chainage measurements, USB footage and PDF report. Suitable for pre-purchase, insurance claim or build-over consent." },
      { name: "Sewer lining (no-dig, per linear m)", price: 280, unit: "per linear m", description: "Resin-impregnated liner cured in place. Restores a collapsed or fractured clay pipe without excavation. 50-year design life." },
      { name: "Patch repair (localised, no-dig)", price: 685, unit: "from", description: "Short liner installed at a specific defect — root intrusion, displaced joint, fracture. Cures in 2 hours, no garden disturbance." },
      { name: "Excavation & replacement (per linear m)", price: 425, unit: "per linear m", description: "Dig-up and replace failed drain with new 110mm PVCu, including reinstatement of soft landscaping. Hard surface reinstatement quoted separately." },
      { name: "Drainage build-over survey & report", price: 385, unit: "fixed", description: "Pre-extension CCTV survey, condition report and build-over consent application support for your water authority." }
    ],
    faq_items: [
      { q: "Do I really need a CCTV survey before buying a house?", a: "If the property is pre-1960 or has had any extension built over the drains, yes. A £265 survey can save you a £15k surprise after completion. Solicitors increasingly recommend it." },
      { q: "What's the difference between lining and excavation?", a: "Lining inserts a resin sleeve inside the existing pipe — no digging, no disturbance, done in a day. Excavation replaces the pipe. Lining costs about 60-70% of dig-and-replace and works for 90% of defects." },
      { q: "Is the blockage my responsibility or the water company's?", a: "If it's within your boundary and serves only your property, it's yours. If it's a shared drain (serving more than one property) or beyond your boundary, it's usually United Utilities' problem. I'll tell you which on the day." },
      { q: "How long does sewer lining take?", a: "Most domestic runs are done in a single day. We isolate the line in the morning, line and cure by afternoon, you're back in service the same evening." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NVQ Level 2 Drainage Operations", "City & Guilds Confined Spaces (Medium Risk)", "WJA (Water Jetting Association) Certified", "CSCS Card"],
    trade_memberships: ["WaterSafe", "National Association of Drainage Contractors (NADC)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 145,
    free_site_visits: false,
    quote_availability: "Same-day quote after CCTV survey",
    quote_turnaround_hours: 8,
    current_status_note: "Emergency unblocks within 1-2 hours. Lining work booking 1 week out.",
    availability: "this_week",
    reviews: [
      { customer_name: "Lauren M.", rating: 5, title: "Saved our garden", body: "Another company quoted £8k to dig up our drive to replace 12m of collapsed clay. Kieran lined it for £3,400 in one day. Drive untouched. Brilliant.", service_name: "Sewer lining (no-dig, per linear m)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/75.jpg" },
      { customer_name: "Steve R.", rating: 5, title: "Out at 11pm in the rain", body: "Toilets backing up on a Sunday night. Kieran answered the phone, was on site in 40 minutes, jetted the line and CCTV'd it to find the root cause. Proper professional.", service_name: "Emergency drain unblock (single visit)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/76.jpg" },
      { customer_name: "Imran K.", rating: 4, title: "Solid CCTV survey for purchase", body: "Got the survey for a house we were buying. Found a section of clay with root intrusion that needed patch lining — vendor paid for it. USB footage was clear and the report was easy to follow.", service_name: "CCTV drain survey with written report", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/77.jpg" }
    ]
  },

  // 3. CHIMNEY SWEEP
  {
    trade_slug: "chimney-sweep",
    profile_slug: "demo-george-ashworth-chimney-sweep-york",
    display_name: "George Ashworth",
    trading_name: "Ashworth Sweep & Stove",
    city: "York",
    postcode_prefix: "YO1",
    whatsapp: "+44 7700 900356",
    email: "george@ashworthsweep.co.uk",
    bio: "I've been sweeping for fifteen years, started as a part-time second job while I was firefighting and went full-time when I retired from the service in 2019. I cover York, Harrogate, Selby and the villages out towards the Wolds. About 70% of my work is solid-fuel and woodburner sweeps in the autumn and winter, with smoke testing, cowl fits and bird-guard installs through the spring. I'm HETAS-registered for stove servicing and I issue NACS sweep certificates that your insurer will actually accept. If your chimney hasn't been swept in three years it needs more than a brush — I'll rotary-power-sweep it and CCTV-inspect the flue so you know what's behind that smoke stain. I'm fussy about dust sheets and shoe covers because nobody wants soot on their cream carpet. Bring me a cup of tea and I'll tell you everything you didn't want to know about your draw.",
    years_in_trade: 15,
    start_year: 2011,
    priced_services: [
      { name: "Standard chimney sweep with certificate", price: 85, unit: "fixed", description: "Rotary power sweep, smoke draw test, written NACS-format sweep certificate accepted by all major insurers. Dust sheets included." },
      { name: "Sweep + CCTV flue inspection", price: 145, unit: "fixed", description: "Standard sweep plus colour CCTV up the flue with USB recording. Recommended every 3 years or after a chimney fire." },
      { name: "Birds nest removal", price: 165, unit: "from", description: "Removal of nest material (out of nesting season only — April-August removals limited by law). Includes anti-bird cowl fit." },
      { name: "Stove service (annual)", price: 125, unit: "fixed", description: "HETAS-registered service: strip down, replace rope seals, check baffle and firebricks, sweep and test. Includes service log entry." },
      { name: "Pot, cowl or bird guard fit", price: 195, unit: "from", description: "Supply and fit standard pot, anti-downdraught cowl or stainless bird guard. Includes scaffold tower for chimneys up to 2-storey." },
      { name: "Smoke draw test & report", price: 95, unit: "fixed", description: "Smoke pellet test to BS 6461 standards, identifies cross-leakage, blockages or insufficient draw. Written report for landlords or homebuyers." }
    ],
    faq_items: [
      { q: "How often should my chimney be swept?", a: "Solid fuel (coal, smokeless): twice a year. Wood: once a year minimum, more if you burn unseasoned wood. Gas: once a year. Most insurance policies require an annual sweep certificate to remain valid." },
      { q: "My stove isn't drawing well — is the chimney blocked?", a: "Could be a partial blockage, could be a leaking flue, could be inadequate ventilation in the room. A smoke draw test costs £95 and tells you definitively. Don't keep using a stove that's not drawing — that's how carbon monoxide creeps in." },
      { q: "Do you fit cowls and bird guards?", a: "Yes, and I'd recommend a bird guard on any unused or rarely-used chimney. Jackdaws can build a 2-foot nest in a season and they're a fire risk. Most cowls fitted with my own scaffold tower, no separate access cost." },
      { q: "Will you make a mess?", a: "Genuinely no. I use HEPA-filter industrial vac sealed to the fireplace opening — there's no soot in the room. Dust sheets and shoe covers as standard. If I leave a mark, I clean it." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NACS (National Association of Chimney Sweeps) Qualified Sweep", "HETAS Approved Servicing Technician", "CCTV Flue Inspection Certified", "Working at Height (PASMA Tower)"],
    trade_memberships: ["National Association of Chimney Sweeps (NACS)", "HETAS Approved Network"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 85,
    free_site_visits: false,
    quote_availability: "Fixed prices on website — no quote needed for sweeps",
    quote_turnaround_hours: 24,
    current_status_note: "Booking 1-2 weeks out Sep-Feb. Spring/summer slots usually within the week.",
    availability: "next_week",
    reviews: [
      { customer_name: "Margaret H.", rating: 5, title: "Spotless and friendly", body: "George swept the open fire and the woodburner in one visit. You'd never have known he'd been here — not a speck of soot. Stayed for tea and explained how to season wood properly.", service_name: "Standard chimney sweep with certificate", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/78.jpg" },
      { customer_name: "Patrick O.", rating: 5, title: "Spotted a flue crack", body: "Booked a CCTV inspection after our stove started smelling. George found a hairline crack in the clay liner that nobody else had noticed. Saved us a potential chimney fire.", service_name: "Sweep + CCTV flue inspection", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/79.jpg" },
      { customer_name: "Sophie L.", rating: 5, title: "Sorted our nesting jackdaws", body: "Massive jackdaw nest blocking the disused chimney. George removed it (in October, legally), fitted a bird guard and cowl. No more scratching noises at dawn.", service_name: "Birds nest removal", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/80.jpg" }
    ]
  },

  // 4. TREE SURGEON
  {
    trade_slug: "tree-surgeon",
    profile_slug: "demo-lucy-mahon-tree-surgeon-glasgow",
    display_name: "Lucy Mahon",
    trading_name: "Mahon Arboriculture",
    city: "Glasgow",
    postcode_prefix: "G12",
    whatsapp: "+44 7700 900418",
    email: "lucy@mahonarb.co.uk",
    bio: "I'm a fully qualified arborist with a degree in Arboriculture from Myerscough College and twelve years on the saw. I started climbing for a council contract crew in West Dunbartonshire before going freelance in 2019 with my husband Conor, who handles the groundwork. Most of my week is crown reductions on mature beech and oak across the West End, sectional dismantles of dangerous urban trees, and tree planting reports for new developments. I've got my NPTC tickets up to CS41 (aerial dismantling using rigging), and I'm an Arboricultural Association Approved Contractor — which means we get audited every three years on safety, paperwork and tree work standards. If you've got a TPO or a Conservation Area tree we'll handle the council application for you. Big jobs come with a method statement and a copy of our insurance schedule before we lift a saw.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "Crown reduction (medium tree, up to 15m)", price: 685, unit: "from", description: "20-30% crown reduction maintaining natural shape, all arisings chipped and removed. Suitable for beech, oak, lime, sycamore in domestic settings." },
      { name: "Sectional dismantle & fell (large tree)", price: 1450, unit: "from", description: "Aerial dismantling using rigging for trees that can't be felled in one piece. Includes stump cut flush. Stump grinding quoted separately." },
      { name: "Stump grinding (per stump up to 50cm dia)", price: 145, unit: "per stump", description: "Grind to 200mm below ground level, suitable for re-planting or hard landscaping. Larger stumps quoted on site." },
      { name: "Hedge cutting (per linear m up to 3m high)", price: 12, unit: "per linear m", description: "Annual maintenance cut to existing hedge, arisings removed. Includes laurel, leylandii, beech, hornbeam, hawthorn." },
      { name: "Tree survey & report (BS 5837 for planning)", price: 485, unit: "fixed", description: "Pre-development tree survey to BS 5837:2012, root protection area plans, arboricultural impact assessment. Accepted by all Scottish planning authorities." },
      { name: "Emergency call-out (storm damage)", price: 185, unit: "per hour", description: "24-hour response for fallen branches blocking access, partial failures, hung-up trees. Minimum 2 hours plus chipper haul-away." }
    ],
    faq_items: [
      { q: "Do I need permission to work on my tree?", a: "If it's covered by a TPO (Tree Preservation Order) or in a Conservation Area, yes — even pruning needs council consent. I check this for every quote and submit the application for you if needed. Penalty for unauthorised work can be up to £20,000 per tree." },
      { q: "Is now the right time of year to prune?", a: "Most broadleaf trees prefer winter dormancy (Nov-Feb). Fruit trees often want summer pruning. Cherry and plum get silver leaf disease if cut in winter. I'll tell you the right window for your species before booking." },
      { q: "What happens to all the wood and chip?", a: "Chip goes back to our yard for biomass or landscape mulch. Larger logs we usually leave with the homeowner if you want firewood, or take away. Either way no extra cost for removal — it's in the quote." },
      { q: "Are you insured to climb my tree?", a: "Yes — £5M public liability with arboricultural-specific cover, employers liability, and Arb Association audited. Insurance schedule sent before work starts." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["NPTC CS30, CS31, CS38, CS39, CS41 (full aerial dismantling)", "BSc (Hons) Arboriculture — Myerscough College", "Lantra First Aid +F (forestry)", "BS 5837 Tree Survey Qualified"],
    trade_memberships: ["Arboricultural Association Approved Contractor", "Royal Forestry Society"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 285,
    free_site_visits: true,
    quote_availability: "Free site quotes within 3 working days",
    quote_turnaround_hours: 72,
    current_status_note: "Booking 3-4 weeks ahead. Emergency storm work prioritised same-day.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Andrew M.", rating: 5, title: "Massive beech in our garden", body: "30m beech overhanging our neighbours roof. Lucy rigged it down section by section over two days, no damage, no drama. Council TPO application sorted by them. Top job.", service_name: "Sectional dismantle & fell (large tree)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/81.jpg" },
      { customer_name: "Caitlin O.", rating: 5, title: "Knew what they were doing", body: "Had two quotes from blokes with chainsaws who wanted to top our oak. Lucy did a proper crown reduction maintaining the natural shape. Tree looks healthier than it has in years.", service_name: "Crown reduction (medium tree, up to 15m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/82.jpg" },
      { customer_name: "David S.", rating: 5, title: "Planning report nailed it", body: "Needed a BS 5837 survey for our extension. Lucy produced a thorough report with root protection plans that the council accepted first time. Saved us months.", service_name: "Tree survey & report (BS 5837 for planning)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/83.jpg" }
    ]
  },

  // 5. PEST CONTROL
  {
    trade_slug: "pest-control",
    profile_slug: "demo-caroline-webb-pest-control-nottingham",
    display_name: "Caroline Webb",
    trading_name: "Webb Pest Solutions",
    city: "Nottingham",
    postcode_prefix: "NG7",
    whatsapp: "+44 7700 900467",
    email: "caroline@webbpest.co.uk",
    bio: "I've been in pest control for eleven years, the first seven with a national contractor doing food-factory and warehouse contracts, then on my own from 2022. About 60% of my work is commercial — restaurants, hotels, schools and a couple of distilleries — under fixed-fee monitoring contracts. The other 40% is domestic: rats in lofts, wasps in soffits, bed bugs in HMOs, fleas after a new pet. I'm a BPCA registered technician and a member of CEPA (the European body), which matters because the legislation around rodenticide use is tightening every year and most one-man-bands aren't keeping up. I use integrated pest management — physical proofing first, traps second, chemicals last. If it's a one-off wasp nest I'll be there same day. If it's recurring rats, we'll find the entry point and seal it so they don't come back next winter.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Wasp or hornet nest treatment", price: 75, unit: "fixed", description: "Single nest treated with insecticide dust, follow-up visit if activity persists within 14 days. Same-day service most weekdays." },
      { name: "Rat or mouse treatment (3-visit programme)", price: 245, unit: "fixed", description: "Initial survey, bait stations placed, two follow-up visits over 3 weeks. Includes entry-point report and proofing recommendations." },
      { name: "Bed bug treatment (single bedroom)", price: 295, unit: "from", description: "Heat-treatment or insecticide spray with steam, two visits 14 days apart. Includes preparation guide for occupant." },
      { name: "Commercial pest monitoring contract (small premises)", price: 685, unit: "per year", description: "Monthly preventative visits, full documentation pack for EHO inspections, 24-hr emergency response, all bait and traps included. For premises up to 200sqm." },
      { name: "Flea treatment (whole house, up to 3-bed)", price: 165, unit: "fixed", description: "Insecticide spray throughout, repeat 10-14 days later. Includes advice on treating pets concurrently." },
      { name: "Bird proofing (per linear m, ledge or pipe)", price: 38, unit: "per linear m", description: "Anti-bird spike fitting to ledges, pipes, signage. Includes initial guano clean and disinfect. Pigeons, gulls, sparrows." }
    ],
    faq_items: [
      { q: "Do I need to leave the house for treatment?", a: "For most insect work, yes — usually 2-4 hours while the spray dries. For rodent treatment no, you can be in throughout. Bed bug heat treatment requires 6-8 hours out. I'll tell you what to expect when booking." },
      { q: "Will the rats come back?", a: "Only if you don't proof the entry points. About a third of my callbacks happen because the homeowner skipped the proofing. I'll show you exactly where they're getting in (usually under eaves or behind soffits) and quote for sealing if you want me to do it." },
      { q: "Is the bait safe for my dog/cat/children?", a: "I use tamper-resistant bait stations that animals can't access. The active ingredients are also chosen to require multiple feeds for toxicity, so accidental single contact is very low risk. I'll always brief you on the specific products used." },
      { q: "Can you guarantee bed bugs are gone?", a: "After a proper two-visit treatment, in 90% of cases yes. Heat treatment is closer to 99% but more expensive. I offer a 60-day return if signs reappear after treatment is complete." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["BPCA/RSPH Level 2 Award in Pest Management", "BPCA Advanced Technician", "Lantra COSHH Trained", "CRRU Certified (Rodenticide Stewardship)"],
    trade_memberships: ["British Pest Control Association (BPCA)", "CEPA Certified (EN 16636)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 75,
    free_site_visits: false,
    quote_availability: "Phone quote for fixed-price jobs, site visit for commercial",
    quote_turnaround_hours: 4,
    current_status_note: "Wasp nests same day. Rodent and bed bug bookings within 3-5 days.",
    availability: "this_week",
    reviews: [
      { customer_name: "Tim H.", rating: 5, title: "Wasps gone in 20 minutes", body: "Massive wasp nest in the soffit. Caroline turned up at 4pm same day, treated it and was gone by half past. £75. Brilliant.", service_name: "Wasp or hornet nest treatment", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/84.jpg" },
      { customer_name: "Aisha B.", rating: 5, title: "Sorted the loft rats for good", body: "We'd had three other pest controllers out over two years and the rats kept coming back. Caroline did the proofing properly — sealed every gap under the soffit — and we've had a clean loft for 14 months now.", service_name: "Rat or mouse treatment (3-visit programme)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/85.jpg" },
      { customer_name: "Greg P.", rating: 5, title: "Restaurant contract", body: "Took over our pub kitchen monitoring contract last year and the EHO documentation is night and day vs the previous lot. Passed our last inspection with no actions.", service_name: "Commercial pest monitoring contract (small premises)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/86.jpg" }
    ]
  },

  // 6. ASBESTOS REMOVAL
  {
    trade_slug: "asbestos-removal",
    profile_slug: "demo-stefan-muller-asbestos-removal-birmingham",
    display_name: "Stefan Muller",
    trading_name: "Muller Asbestos Services",
    city: "Birmingham",
    postcode_prefix: "B16",
    whatsapp: "+44 7700 900529",
    email: "stefan@mullerasbestos.co.uk",
    bio: "I've worked in licensed asbestos removal for eighteen years, the first decade with a tier-1 contractor doing power stations and hospitals before I set up Muller Asbestos Services in 2018 to focus on small commercial and domestic work that the big firms won't touch. We're HSE-licensed for the high-risk stuff (sprayed coating, pipe lagging, AIB ceiling tiles) but most of our domestic work is non-licensed — Artex ceilings, cement roof sheets, vinyl floor tiles. Every job starts with a UKAS-accredited survey because you cannot legally remove anything without one. We're ARCA members, so our paperwork, decontamination units and air testing all stand up to HSE inspection. I'd rather walk away from a quote than cut a corner on personal protective equipment — twenty years from now somebody's lung depends on me getting today right.",
    years_in_trade: 18,
    start_year: 2008,
    priced_services: [
      { name: "Asbestos refurbishment/demolition survey", price: 485, unit: "from", description: "UKAS-accredited intrusive survey with bulk sampling and lab analysis. Required before any refurb or demolition involving pre-2000 buildings. PDF report within 7 days." },
      { name: "Asbestos cement removal (garage roof or shed)", price: 685, unit: "from", description: "Non-licensed removal of bonded cement sheets, double-bagged, disposed via licensed waste carrier with consignment note. Includes site survey." },
      { name: "Artex/textured coating removal (per sqm)", price: 42, unit: "per sqm", description: "Steam strip or overboard pre-2000 textured coating after sampling confirms chrysotile content. Includes air clearance test." },
      { name: "AIB (Asbestos Insulating Board) removal — licensed", price: 1850, unit: "from", description: "Full HSE notification, enclosure build, negative pressure unit, 3-stage decontamination unit, 4-stage clearance. Single ceiling or partition wall." },
      { name: "Asbestos vinyl floor tile removal (per sqm)", price: 38, unit: "per sqm", description: "Lift and bag pre-2000 thermoplastic tiles and bitumen residue. Non-licensed work, includes air clearance certificate." },
      { name: "Asbestos management plan (commercial premises)", price: 685, unit: "from", description: "Required under CAR 2012. Register of all ACMs, condition assessment, risk priority scoring, review schedule. For premises up to 500sqm." }
    ],
    faq_items: [
      { q: "Can I just remove the Artex myself?", a: "Legally yes for a homeowner under 'non-licensed non-notifiable' work, but I strongly advise against it without training and proper PPE. The fibres released by sanding or dry scraping are the dangerous bit. Sampling first is £45 — at least know what you're dealing with." },
      { q: "How do I know if my house has asbestos?", a: "Anything built or refurbished between 1930 and 1999 is suspect. Common locations: Artex ceilings, garage/shed roofs, soffits, vinyl floor tiles, boiler flues, water tanks. A management survey costs £285 and tells you definitively." },
      { q: "Will my insurance pay for removal?", a: "Buildings insurance usually doesn't cover removal unless it's directly damaged by an insured event (e.g. fire). However if you're selling, an undisclosed asbestos issue can void the buyer's mortgage offer — worth resolving up front." },
      { q: "Where does the waste actually go?", a: "Double-wrapped, consignment-noted, taken to a licensed asbestos cell at one of three regional landfills. You get a copy of the consignment note as part of your paperwork pack — keep it forever, it's your audit trail." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["HSE-Licensed Asbestos Removal (Site Supervisor)", "P402 Surveying and Sampling of Asbestos", "P404 Air Sampling of Asbestos", "BOHS Proficiency in Asbestos Removal"],
    trade_memberships: ["Asbestos Removal Contractors Association (ARCA)", "British Occupational Hygiene Society (BOHS)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 485,
    free_site_visits: false,
    quote_availability: "Site visit required, written quote within 5 working days",
    quote_turnaround_hours: 120,
    current_status_note: "Surveys within 1 week. Licensed removal work booking 3-4 weeks out.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Jacob R.", rating: 5, title: "Garage roof gone properly", body: "Old asbestos cement garage roof. Stefan's team turned up in full kit, sheeted the area, removed and bagged everything in half a day. All paperwork emailed the same evening. Spotless.", service_name: "Asbestos cement removal (garage roof or shed)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/87.jpg" },
      { customer_name: "Megan T.", rating: 5, title: "Saved our sale", body: "Buyer's survey flagged AIB in our airing cupboard. Stefan did a proper licensed removal with enclosure and clearance test. Sale completed two weeks later.", service_name: "AIB (Asbestos Insulating Board) removal — licensed", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/88.jpg" },
      { customer_name: "Idris A.", rating: 5, title: "Honest survey", body: "Worried our 1960s house was riddled with the stuff. Stefan surveyed it thoroughly, found two minor items, gave us a management plan and reassurance for the rest. No upselling.", service_name: "Asbestos refurbishment/demolition survey", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/89.jpg" }
    ]
  },

  // 7. LEAD WORKER
  {
    trade_slug: "lead-worker",
    profile_slug: "demo-richard-obrien-lead-worker-bath",
    display_name: "Richard O'Brien",
    trading_name: "O'Brien Leadwork & Heritage Roofing",
    city: "Bath",
    postcode_prefix: "BA1",
    whatsapp: "+44 7700 900614",
    email: "richard@obrienleadwork.co.uk",
    bio: "I'm a fourth-generation lead worker — my grandfather worked on the cathedrals in the West Country and I served my apprenticeship with my father in Wells before he retired. Twenty-two years on the lead. I specialise in traditional sand-cast and milled lead sheet roofing on heritage properties, mainly Georgian townhouses in Bath, Bristol and Wells. Most of my year is bay window roofs, parapet gutters, chimney flashings and bay-roof renewals on listed buildings. I use Code 4, 5 and 6 lead depending on the application, hand-bossed not just folded, with proper underlay and rolled joints. I'm Lead Sheet Training Academy certified and accredited with the Lead Sheet Association. If your church, listed manor or Georgian house needs lead work that'll outlast you, ring me. If you just want a cheap flashing patch, I'll point you at someone else honestly.",
    years_in_trade: 22,
    start_year: 2004,
    priced_services: [
      { name: "Chimney flashing renewal (Code 4 lead)", price: 685, unit: "from", description: "Strip existing failed flashings, refit with new Code 4 lead step and cover flashings, hand-bossed and pointed in lime mortar. Standard 2-flue chimney." },
      { name: "Bay window roof renewal (Code 5/6 lead)", price: 2850, unit: "from", description: "Strip existing covering, repair timber substrate, lay new Code 5 or 6 milled lead with wood-cored rolls, hand-dressed apron. Includes underlay and ventilation detail." },
      { name: "Parapet gutter renewal (per linear m)", price: 285, unit: "per linear m", description: "Strip existing failed gutter, repair substrate, lay new Code 5 lead with proper falls, drips and welted joints. Suitable for Georgian/Victorian flat-roof parapets." },
      { name: "Lead repair patch (small, hand-leaded)", price: 245, unit: "from", description: "Hand-leaded patch repair to existing flashing or covering using lead burning. Same-day repair where possible. Min 2hr visit." },
      { name: "Lead welding & bossing repair (per visit)", price: 425, unit: "per day", description: "Day rate for complex repairs requiring lead welding (lead burning) and hand-bossing on heritage roofs. Includes scaffolding for single elevation up to 3-storey." },
      { name: "Heritage roofing condition report", price: 385, unit: "fixed", description: "Detailed inspection of lead, slate and substrate condition on listed/period property. Written report with photographs and budget recommendations for ongoing maintenance." }
    ],
    faq_items: [
      { q: "Why is lead so much more expensive than felt?", a: "Lead lasts 80-150 years and looks right on a period building. Felt lasts 15-20 and looks plastic. On a Georgian bay roof you'd recoup the cost twice over before felt needs renewal — and your listing officer won't sign off on anything else." },
      { q: "Do you do new-build lead?", a: "Occasionally — mostly when an architect specifies traditional lead on a sympathetic new build in a conservation area. But heritage repair is the bread and butter." },
      { q: "Will you work on a listed building?", a: "Yes — most of my work is Grade II or Grade II*. I'm comfortable with listed building consent paperwork and routinely liaise with conservation officers. I always specify code/thickness that matches the original where evidence exists." },
      { q: "How long is your guarantee?", a: "25 years on new lead sheet roofing and parapet gutters installed to LSA detail. 10 years on chimney flashings and patch repairs. The lead itself will far outlast the guarantee — the limit is the underlay and substrate." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Lead Sheet Training Academy — Advanced Leadworker", "City & Guilds Heritage Skills (Lead, Slate)", "CSCS Heritage Skills Card", "IPAF Powered Access"],
    trade_memberships: ["Lead Sheet Association (LSA)", "National Federation of Roofing Contractors (NFRC) Heritage Division"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 245,
    free_site_visits: true,
    quote_availability: "Free site quote within 1 week (heritage surveys chargeable)",
    quote_turnaround_hours: 96,
    current_status_note: "Booking 4-6 weeks out. Storm-damage repairs prioritised.",
    availability: "later",
    reviews: [
      { customer_name: "Eleanor F.", rating: 5, title: "Beautiful work on our Georgian bay", body: "Our bay roof was leaking after 90 years. Richard renewed it in Code 5 with proper rolls and bossed aprons — exactly as the original. Listing officer was delighted. Skilled craftsman.", service_name: "Bay window roof renewal (Code 5/6 lead)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/90.jpg" },
      { customer_name: "Hugh W.", rating: 5, title: "Saved our church porch", body: "Parapet gutter on our Grade II church was failing. Richard renewed it in two days, no leaks for two winters now. Knowledgeable about every detail.", service_name: "Parapet gutter renewal (per linear m)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/91.jpg" },
      { customer_name: "Beatrice K.", rating: 5, title: "Chimney flashings sorted", body: "Two stacks on our 1820s townhouse — leaking around both. Richard re-flashed them with hand-bossed lead, pointed in lime. Looks like it's been there a century. Worth waiting for.", service_name: "Chimney flashing renewal (Code 4 lead)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/92.jpg" }
    ]
  },

  // 8. SASH WINDOW RESTORER
  {
    trade_slug: "sash-window-restorer",
    profile_slug: "demo-eleanor-singh-sash-window-restorer-london",
    display_name: "Eleanor Singh",
    trading_name: "Singh Sash & Joinery",
    city: "London",
    postcode_prefix: "N16",
    whatsapp: "+44 7700 900743",
    email: "eleanor@singhsash.co.uk",
    bio: "I trained as a heritage joiner at the Building Crafts College in Stratford and spent five years with a conservation joinery firm restoring sashes on listed terraces across Islington and Hackney before going independent in 2020. My whole business is Victorian and Edwardian timber sash windows — the box frames, the cords, the parting beads, the meeting rails. I don't sell replacements. About 80% of my work is full overhauls (strip, repair, draught-strip, re-cord, re-paint) and the rest is single-window repairs and broken-cord callouts. I source original-pattern brass pulleys and Italian heritage glass when I can. The cheapest quote you'll get from me is still cheaper than ripping out and going UPVC — and your conservation officer won't have a heart attack. If your windows rattle, drip condensation or stick in summer, I can fix all three in one visit.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Full sash window overhaul (per window)", price: 685, unit: "per window", description: "Remove sashes, strip paint, repair timber, replace cords, fit Reddiseals draught-strip system, repaint with linseed paint. Standard 2-over-2 Victorian sash." },
      { name: "Broken cord replacement (per cord)", price: 145, unit: "per window", description: "Same-day callout to replace snapped sash cord, including new brass-pinned weights if needed. Usually done in 2 hours per window." },
      { name: "Draught-stripping only (per window)", price: 295, unit: "per window", description: "Routed brush-pile system into sash and frame, reduces draughts by 80%+ without changing appearance. Suitable for sound existing windows." },
      { name: "Sash splice/timber repair (per window)", price: 385, unit: "from", description: "Cut out rotten cill, meeting rail or stile and splice in new matching timber. Sympathetic to existing window. Includes primer." },
      { name: "Heritage glass replacement (per pane)", price: 165, unit: "per pane", description: "Replace cracked or modern glass with restoration cylinder or crown glass to match the period. Putty bedded and linseed-painted." },
      { name: "Conservation Area window report", price: 285, unit: "fixed", description: "Written condition report for use with listed-building or conservation consent applications. Photographs of each window with conservation officer-friendly recommendations." }
    ],
    faq_items: [
      { q: "Can sash windows really be as warm as double glazing?", a: "Close — but not identical. A properly overhauled sash with Reddiseals draught-strip and shutters or thick curtains reaches U-value around 2.0 W/m²K. Modern double-glazed is 1.4. The difference on your heating bill is much smaller than people think, and you keep the look." },
      { q: "Will my conservation officer approve secondary glazing?", a: "Usually yes — internal secondary glazing is reversible and doesn't change the external appearance. I can recommend two firms I work alongside. Vacuum slim-glazing inside the existing sashes is also approvable in most areas now." },
      { q: "How long does a full overhaul take?", a: "About 2-3 days per window for a full overhaul, including paint drying. Most clients have me do a whole house over 2-3 weeks. I can stagger so you've never got more than 2 windows out at once." },
      { q: "Do you do new sashes?", a: "Only when an existing window is genuinely beyond repair — usually fire damage or 50+ years of neglect. New sashes made in matched timber and period detail. But repair is almost always cheaper and more characterful." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["Heritage Joinery Diploma — Building Crafts College", "City & Guilds Wood Occupations (Bench Joinery)", "SPAB Working with Lime", "CSCS Card"],
    trade_memberships: ["The Sash Window Workshop Network", "Society for the Protection of Ancient Buildings (SPAB) — Trade Member"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 145,
    free_site_visits: true,
    quote_availability: "Free site quote within 1 week",
    quote_turnaround_hours: 96,
    current_status_note: "Booking 4-6 weeks ahead. Broken cord callouts within 48 hours.",
    availability: "later",
    reviews: [
      { customer_name: "Olivia D.", rating: 5, title: "Windows feel brand new", body: "Whole-house overhaul of 11 sashes over three weeks. They open like butter, no draughts, no rattles. Eleanor matched the historic paint colour exactly. Couldn't be happier.", service_name: "Full sash window overhaul (per window)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/93.jpg" },
      { customer_name: "Tariq A.", rating: 5, title: "Broken cord fixed same week", body: "Top sash crashed down at 7am Monday. Eleanor was here Wednesday morning, two windows re-corded and weights checked on a third. Brilliant service.", service_name: "Broken cord replacement (per cord)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/94.jpg" },
      { customer_name: "Charlotte B.", rating: 5, title: "Conservation officer impressed", body: "Listed Victorian terrace, needed a heritage report for our consent application. Eleanor's report was so thorough the council approved everything first time. Saved months.", service_name: "Conservation Area window report", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/95.jpg" }
    ]
  },

  // 9. POST-CONSTRUCTION CLEANER
  {
    trade_slug: "post-construction-cleaner",
    profile_slug: "demo-folake-adeyemi-post-construction-cleaner-cardiff",
    display_name: "Folake Adeyemi",
    trading_name: "Adeyemi Sparkle Cleans",
    city: "Cardiff",
    postcode_prefix: "CF24",
    whatsapp: "+44 7700 900851",
    email: "folake@adeyemisparkle.co.uk",
    bio: "I started out doing end-of-tenancy cleans for letting agents in 2017 and quickly specialised in post-build hand-over cleans after a developer asked if I could 'sort his show home'. Five years on, I run a team of four and we do nothing but post-construction sparkle cleans for housebuilders, extension contractors and self-builders across South Wales. We're the team that comes in after the sparks have done their second fix and before the keys get handed over — paint splatter, sticker residue, plaster dust in every track and crevice, polishing the chrome and the granite. We use HEPA-filter vacs and pH-neutral surface chemistry so we don't strip new floor finishes or etch worktops. Builders bring us in because the difference between a job that looks 'finished' and a job that looks 'show-home' is twelve hours of methodical detail cleaning. Insurance-backed quality guarantee on every job.",
    years_in_trade: 9,
    start_year: 2017,
    priced_services: [
      { name: "Post-build sparkle clean (per sqm)", price: 6, unit: "per sqm", description: "Full HEPA vacuum, surface dust-off, glass and frames, sticker removal, polish chrome and fittings, floor finish-appropriate clean. Typical 3-bed = £450-550." },
      { name: "Single-room renovation clean (kitchen or bathroom)", price: 245, unit: "from", description: "Post-trade detail clean of one renovated room including grout polish, fittings, paint splatter removal. Usually 4-5 hours for a kitchen." },
      { name: "Window sparkle clean (per pane, including frames)", price: 12, unit: "per pane", description: "Pre-handover window clean inside and out, including frames, sills, and silicone bead. Removes plaster dust, paint flecks and sticker residue." },
      { name: "Sticker & label removal (per visit)", price: 145, unit: "from", description: "Removal of manufacturer stickers from windows, appliances, sanitaryware, ironmongery without damaging finishes. Minimum 3hr visit." },
      { name: "Show-home staging clean", price: 685, unit: "fixed", description: "Pre-photoshoot deep clean to magazine-ready standard. Includes light staging (towel placement, plant care, surface polish). Up to 4-bed house." },
      { name: "Builders' weekly site clean (commercial)", price: 285, unit: "per visit", description: "Weekly progress clean for active construction site — keeps welfare, walkways and protected finishes presentable. Up to 8hrs onsite." }
    ],
    faq_items: [
      { q: "Why pay for specialist post-build clean instead of regular cleaner?", a: "Plaster dust gets into every track, every hinge, every socket. Paint splatter on new chrome needs the right solvent or it scratches the plating. Regular cleaners aren't trained or equipped for it — they spread it around. We HEPA-extract and detail-clean section by section." },
      { q: "Will you damage new floors or worktops?", a: "We test every surface before applying anything. pH-neutral chemistry as default, surface-specific products for engineered stone, oiled timber, polished concrete. Insurance-backed if anything goes wrong, but in 9 years it hasn't." },
      { q: "How long before completion should I book you?", a: "For a typical 3-bed, two days before handover. For a show-home staging clean, the day before photography. Book us 2 weeks ahead in spring/summer — that's our peak with new-build developments." },
      { q: "Can you work alongside other trades?", a: "Generally we want everyone else off site before we start — sparks back in after we've cleaned a track means we re-clean it. But for big jobs we'll phase clean room-by-room behind the trades and re-detail final." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["BICSc (British Institute of Cleaning Science) — Cleaning Operators Proficiency Certificate", "IOSH Working Safely", "COSHH Trained", "Working at Height Certified"],
    trade_memberships: ["British Institute of Cleaning Science (BICSc)", "National Federation of Builders — Associate Member"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 245,
    free_site_visits: true,
    quote_availability: "Same-day quote on photographs, free site visit within 48hrs",
    quote_turnaround_hours: 24,
    current_status_note: "Booking 1-2 weeks ahead. Short-notice handover cleans often possible.",
    availability: "next_week",
    reviews: [
      { customer_name: "Rhys M.", rating: 5, title: "Made our handover look perfect", body: "Folake's team did our 4-bed self-build sparkle clean over two days. Came back to a house I genuinely didn't recognise — every chrome handle gleaming, every track immaculate. Worth every penny.", service_name: "Post-build sparkle clean (per sqm)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/96.jpg" },
      { customer_name: "Bethan W.", rating: 5, title: "Kitchen extension immaculate", body: "Builders left, plaster dust everywhere. Folake's team turned up at 8am, finished by 3pm — kitchen sparkled. Even the splashback grout looked new.", service_name: "Single-room renovation clean (kitchen or bathroom)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/97.jpg" },
      { customer_name: "Jonny T.", rating: 4, title: "Solid weekly site clean", body: "We've used Folake on three developments now. Reliable, professional, paperwork in order. Lost a star only because their availability tightens up in May-July when new-builds peak.", service_name: "Builders' weekly site clean (commercial)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/98.jpg" }
    ]
  },

  // 10. GARDEN DESIGNER
  {
    trade_slug: "garden-designer",
    profile_slug: "demo-isabella-fitzgerald-garden-designer-oxford",
    display_name: "Isabella Fitzgerald",
    trading_name: "Fitzgerald Garden Studio",
    city: "Oxford",
    postcode_prefix: "OX2",
    whatsapp: "+44 7700 900937",
    email: "isabella@fitzgeraldgardens.co.uk",
    bio: "I studied garden design at the London College of Garden Design after a first career in landscape architecture at a Cambridge practice. I set up Fitzgerald Garden Studio in 2019 and have completed around forty private garden projects since, ranging from £15k Oxford college courtyards to £180k country gardens in the Cotswolds. I'm a Pre-Registered Member of the Society of Garden Designers and a BALI Registered Designer — which means my drawings, specs and planting plans meet industry standards and your contractor can build from them without ambiguity. My approach is plant-led — I'm fussy about soil, aspect and seasonal interest, and I'll never specify a plant I haven't grown myself. Hard landscaping is detailed in CAD with proper drainage, edging and falls. I work with three contractors I trust to deliver my designs, or I'll happily oversee tender with your chosen builder.",
    years_in_trade: 7,
    start_year: 2019,
    priced_services: [
      { name: "Initial design consultation (2hr on site)", price: 245, unit: "fixed", description: "Site visit, brief-gathering, sketch ideas on the day. Includes follow-up email with 3-4 directional concepts. Fee credited against full design fee if you proceed." },
      { name: "Concept design package (typical urban garden)", price: 1850, unit: "from", description: "Survey, mood board, scaled concept plan with planting palette and 3D sketch views. Allows you to gather build quotes. For gardens up to 200sqm." },
      { name: "Full detailed design package (200-500sqm)", price: 4850, unit: "from", description: "Concept + detailed construction drawings, hard-landscape specs, planting plan with named cultivars and quantities, lighting layout, contractor tender pack. Build-ready." },
      { name: "Planting plan only (existing garden)", price: 985, unit: "from", description: "For clients who have the layout but want a designer planting scheme. Site visit, soil assessment, named cultivar plan with quantities, seasonal calendar. Up to 50sqm of bed." },
      { name: "Project management & contractor oversight (per visit)", price: 385, unit: "per visit", description: "Site visits during build to ensure contractor follows drawings, snag identification, planting setting-out. Min 4 visits over a typical 8-week build." },
      { name: "Lighting design package", price: 685, unit: "fixed", description: "Detailed garden lighting scheme: fixture spec, layout drawing, beam-angle calcs, transformer load schedule. For electricians to install from." }
    ],
    faq_items: [
      { q: "What does a full garden design actually get me?", a: "A drawing pack your contractor can build from with no ambiguity — survey, levels, hard-landscape drawings, drainage strategy, named planting plan with quantities and pot sizes, lighting scheme. Saves you 10-15% on build cost because contractors price tightly when the spec is clear." },
      { q: "Do I have to use your contractor?", a: "No. I'm independent — I don't take kickbacks from contractors. I have three I trust if you want a recommendation, but you can use anyone. Most clients prefer one of my three because they're already familiar with my detailing." },
      { q: "How long does a design take?", a: "Concept design typically 4-6 weeks from survey to presentation. Full detailed pack a further 4-6 weeks. So plan around 10-12 weeks of design before contractor selection. Build adds 8-16 weeks depending on scope." },
      { q: "What's the right time of year to start?", a: "Design works any time. For build, autumn through spring is ideal for planting establishment. Avoid mid-summer for big planting jobs — too much water stress. But hard landscaping happens year-round." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["Diploma in Garden Design — London College of Garden Design", "BSc Landscape Architecture", "RHS Level 2 Practical Horticulture", "AutoCAD & Vectorworks Landscape Certified"],
    trade_memberships: ["Society of Garden Designers (Pre-Registered Member)", "British Association of Landscape Industries (BALI) — Registered Designer"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 245,
    free_site_visits: false,
    quote_availability: "Fixed-fee design packages, written proposal within 1 week of consultation",
    quote_turnaround_hours: 168,
    current_status_note: "Booking design work 6-8 weeks ahead. Build season usually full by February.",
    availability: "later",
    reviews: [
      { customer_name: "Henrietta C.", rating: 5, title: "Transformed our Cotswold garden", body: "Isabella spent eight months designing our 2-acre garden. Every detail is right — soils tested, planting palette stunning year-round, contractor built from her drawings without a hitch. A proper professional.", service_name: "Full detailed design package (200-500sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/99.jpg" },
      { customer_name: "Saoirse K.", rating: 5, title: "Worth every penny", body: "Small Oxford courtyard, but Isabella designed it like a country garden in miniature. Year-round interest, contractor friend built it in three weeks following her drawings. Best money I've spent on the house.", service_name: "Concept design package (typical urban garden)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/70.jpg" },
      { customer_name: "Edmund P.", rating: 5, title: "Planting plan brought it to life", body: "We had the layout but the planting was tired. Isabella's planting plan is gorgeous — third spring in and it just keeps getting better. Clear plant list with quantities made nursery shopping easy.", service_name: "Planting plan only (existing garden)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/71.jpg" }
    ]
  }
];
