// Demo profile seeds for Xrated Trade Off — Installation Additions (Phase 2).
//
// 16 new INSTALLATION trades that go to a customer's site to survey and fit.
// Bios focus on the FITTING service (visit, measure, install) not selling product.
//
// Phone numbers all use the Ofcom-reserved fiction range +44 7700 900XXX.
// Avatar URLs use randomuser.me with N in 30-99 to minimise collision with the
// service-additions seed file.

import type { DemoTradeSeed } from "./demoTradeSeeds";

export const DEMO_TRADE_SEEDS_INSTALLATION: DemoTradeSeed[] = [
  // 1. DOOR FITTER
  {
    trade_slug: "door-fitter",
    profile_slug: "demo-callum-bryce-door-fitter-bristol",
    display_name: "Callum Bryce",
    trading_name: "Bryce Door & Joinery",
    city: "Bristol",
    postcode_prefix: "BS6",
    whatsapp: "+44 7700 900301",
    email: "callum@brycedoor.co.uk",
    bio: "Time-served chippy out of Bristol — I did my apprenticeship on new-build sites in Bradley Stoke and went solo in 2017. These days I'm 100% door work: hanging internal doors (6-panel, oak, painted shaker), bi-folds onto patios, sliding pocket doors and external front doors. I'm FENSA registered for external installs so the building regs side is handled — you get the certificate posted to you within 14 days. Most customers don't realise that hanging a door properly is 80% prep — checking the frame is plumb, packing the hinges, easing the latch by 2mm so it shuts with one finger. I won't fit a door onto a frame that's twisted; I'll tell you straight and either re-line it or refer you back to your builder. I carry a router, planer, and a stack of letterplate templates so I can finish a front door in one visit, not three.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Internal door hang (supply not included)", price: 110, unit: "per door", description: "Hang one customer-supplied internal door onto existing frame. Hinges, latch, handles fitted and adjusted. Standard size up to 762x1981mm." },
      { name: "Internal door supply + fit (oak/painted)", price: 285, unit: "per door", description: "Quality 6-panel oak or primed shaker door supplied and hung with brass or chrome ironmongery of your choice." },
      { name: "External front door fit (FENSA certified)", price: 480, unit: "per door", description: "Composite or hardwood front door fitted to existing opening, weathersealed, multi-point lock adjusted. FENSA certificate included." },
      { name: "Bi-fold door install (3-pane up to 2.4m)", price: 950, unit: "from", description: "Hang and align a customer-supplied 3-panel aluminium or hardwood bi-fold onto a prepared opening. Threshold sealed, rollers tuned." },
      { name: "Sliding pocket door (single)", price: 720, unit: "from", description: "Stud out a pocket cassette into an existing partition, hang the door, soft-close mechanism. Plasterer required separately." },
      { name: "Frame re-line (twisted/damaged casing)", price: 195, unit: "per opening", description: "Strip out old casing, re-line plumb and square ready for a new door. Architrave refit included." }
    ],
    faq_items: [
      { q: "Why does my new door catch on the floor?", a: "Almost always because the frame has dropped or the floor has been re-laid since the original door was hung. I'll plane the bottom rail if there's enough timber, or re-hang the door 10mm higher if not." },
      { q: "Do I need FENSA for an internal door?", a: "No — FENSA only covers external doors and windows. Internal doors don't notify building control." },
      { q: "Can you fit a door I bought from B&Q?", a: "Yes, but be aware the cheaper hollow-core doors don't always come dead square. I'll trim and brace them where I can but I won't promise miracles on a £40 door." },
      { q: "How long does a bi-fold install take?", a: "One full day for a 3-pane set if the opening is already cill-ready. Two days if I need to fit a structural cill or trim brickwork. The rollers need a follow-up tune 2 weeks in — included." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NVQ Level 3 Site Carpentry", "FENSA Registered Installer", "CSCS Gold Card"],
    trade_memberships: ["FENSA", "Guild of Master Craftsmen"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 110,
    free_site_visits: true,
    quote_availability: "Usually quotes within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Booking 1-2 weeks out. Single doors often slotted same week.",
    availability: "next_week",
    reviews: [
      { customer_name: "Olivia P.", rating: 5, title: "All five doors look perfect", body: "Callum hung five oak internal doors in two days. Every one closes silently with one finger and the gaps are spot on. Tidy worker.", service_name: "Internal door supply + fit (oak/painted)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/31.jpg" },
      { customer_name: "Mark T.", rating: 5, title: "FENSA cert came through in a week", body: "Front door looks amazing and the certificate landed in my inbox 7 days later. No fuss with building control.", service_name: "External front door fit (FENSA certified)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/32.jpg" },
      { customer_name: "Priya R.", rating: 5, title: "Bi-fold runs like silk", body: "Our bi-fold was a nightmare with another fitter. Callum re-shimmed the cill, swapped the rollers and now my 8-year-old can slide it open.", service_name: "Bi-fold door install (3-pane up to 2.4m)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/33.jpg" }
    ]
  },

  // 2. FLOORING INSTALLER
  {
    trade_slug: "flooring-installer",
    profile_slug: "demo-tomasz-nowak-flooring-installer-coventry",
    display_name: "Tomasz Nowak",
    trading_name: "Nowak Floors",
    city: "Coventry",
    postcode_prefix: "CV5",
    whatsapp: "+44 7700 900302",
    email: "tomasz@nowakfloors.co.uk",
    bio: "I came to the UK from Krakow in 2009 and spent six years installing engineered wood and parquet for a contractor in Birmingham before going on my own. I'm a Karndean Premier Installer and an Amtico-accredited fitter — those are the two big LVT systems and the manufacturer accreditation matters for the warranty. Most of my week is now LVT click-fit and glue-down in kitchens, herringbone engineered in lounges, and carpet on landings. I do a moisture test on every concrete subfloor before I quote — if your screed is wet I'll tell you to wait or apply a damp-proof membrane, otherwise the floor cups within 12 months. I bring my own latex levelling compound and prep the subfloor properly. The fit is only as good as what's under it.",
    years_in_trade: 17,
    start_year: 2009,
    priced_services: [
      { name: "LVT click-fit (per sqm, fit only)", price: 22, unit: "per sqm", description: "Customer-supplied click LVT (Karndean LooseLay, Quick-Step) installed over prepared subfloor. Underlay, beading included." },
      { name: "LVT glue-down (per sqm, fit only)", price: 32, unit: "per sqm", description: "Karndean/Amtico glue-down planks or tiles installed with manufacturer-spec adhesive. Premier Installer warranty applies." },
      { name: "Engineered herringbone (per sqm)", price: 45, unit: "per sqm", description: "Glue-down 90mm or 120mm herringbone block. Full alignment from centre, expansion gaps, beading or scotia to finish." },
      { name: "Carpet supply + fit (per sqm, standard)", price: 26, unit: "per sqm", description: "Mid-range twist or loop pile carpet supplied and fitted with grippers and 10mm PU underlay. Stair runs charged per tread." },
      { name: "Subfloor latex levelling (per sqm)", price: 18, unit: "per sqm", description: "Self-levelling latex compound poured over uneven screed or boards. Required for premium LVT. Drying time 24-48hrs." },
      { name: "Moisture test + survey (free with quote)", price: 0, unit: "free", description: "Calcium-carbide or hygrometer test on concrete subfloors before any glue-down product. Free as part of quote visit." }
    ],
    faq_items: [
      { q: "Why do you need to test moisture in my floor?", a: "Concrete screeds can sit at 75-90% relative humidity for months after they're poured. If I glue LVT or wood down onto a wet floor the adhesive fails and the planks cup — sometimes within a year. The test takes 20 minutes and saves a £4k callback." },
      { q: "Do I need underlay under click LVT?", a: "Only acoustic underlay rated for LVT (max 1.5mm IXPE). Anything thicker compresses, the joints work loose, planks pop. Cheap foam underlay from B&Q will void the warranty." },
      { q: "Can I fit LVT in my bathroom?", a: "Yes if it's the right product — Karndean Korlok or Amtico Spacia are both rated wet. Click-fit isn't ideal because water gets under the joints; glue-down or LooseLay is the move." },
      { q: "Are you accredited by the brands?", a: "Karndean Premier Installer since 2016 and Amtico-trained since 2018. Means manufacturer warranty applies and they back up my installs if anything fails." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NVQ Level 2 Floorcovering Occupations", "Karndean Premier Installer", "Amtico Accredited Fitter", "CSCS Card"],
    trade_memberships: ["Contract Flooring Association (CFA)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 280,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 2-3 weeks. Smaller carpet jobs sometimes same week.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Eleanor W.", rating: 5, title: "Herringbone floor is stunning", body: "Tomasz laid 40sqm of engineered herringbone in our open-plan. Pattern lines up perfectly across two rooms. Worth the wait.", service_name: "Engineered herringbone (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/34.jpg" },
      { customer_name: "Hassan A.", rating: 5, title: "Karndean Premier was worth it", body: "Wanted Karndean for the warranty. Tomasz is on their installer list so we got proper coverage. Floor is flawless.", service_name: "LVT glue-down (per sqm, fit only)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/35.jpg" },
      { customer_name: "Rachel D.", rating: 5, title: "Saved us from a disaster", body: "He moisture-tested the screed and told us not to fit yet — saved us thousands. Came back 6 weeks later, did the job, perfect.", service_name: "Moisture test + survey (free with quote)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/36.jpg" }
    ]
  },

  // 3. BATHROOM FITTER
  {
    trade_slug: "bathroom-fitter",
    profile_slug: "demo-luca-romano-bathroom-fitter-watford",
    display_name: "Luca Romano",
    trading_name: "Romano Bathrooms",
    city: "Watford",
    postcode_prefix: "WD17",
    whatsapp: "+44 7700 900303",
    email: "luca@romanobathrooms.co.uk",
    bio: "I started as a plumber 19 years ago and slowly drifted into doing full bathrooms when customers kept asking me to manage the tiler and electrician too. Now I run a small bathroom-only outfit covering Watford, St Albans and north-west London. I project-manage the whole strip-out and refit: plumbing, tiling, electrics (through my NICEIC sparky) and second-fix joinery. I'm Gas Safe so I can swap a combi or move the boiler if it's blocking the new layout. A standard family bathroom takes me 10-14 working days from skip arrival to final clean. I never start a job without a written spec sheet — tiles, taps, lighting, layout drawing — signed off by you. The only surprises on my jobs are the ones behind the wall, and I'll show you photos before I cover anything back up.",
    years_in_trade: 19,
    start_year: 2007,
    priced_services: [
      { name: "Full bathroom refit (standard 2.5x2m)", price: 7800, unit: "from", description: "Strip out, plumbing rework, electrics, full tiling, suite install, decoration. Customer supplies suite and tiles; labour and materials only." },
      { name: "Full bathroom refit (premium 3x2.5m)", price: 12500, unit: "from", description: "Larger bathroom or ensuite with separate bath + walk-in shower, underfloor heating, recessed niches, full porcelain large-format tiles." },
      { name: "Wet room conversion", price: 9500, unit: "from", description: "Sunken tray or tiled gradient, full tank, glass screen, drainage rework. Includes building reg compliance for the tanking." },
      { name: "Bath-to-shower conversion only", price: 2400, unit: "from", description: "Remove old bath, install shower tray + enclosure, retile that wall, reroute plumbing. No other works." },
      { name: "Shower enclosure swap (like-for-like)", price: 750, unit: "fixed", description: "Remove old enclosure, fit new customer-supplied 900x900 or 1200x800 enclosure, silicone and pressure-test." },
      { name: "Bathroom design + spec service", price: 350, unit: "fixed", description: "Site survey, 2D layout drawing, tile + suite + tap shortlist, full materials schedule. Deducted from final quote if you book." }
    ],
    faq_items: [
      { q: "How long does a full bathroom take?", a: "10-14 working days for a standard family bathroom. Day 1-2 strip out, day 3-5 first fix plumbing and electrics, day 6-9 tiling, day 10-12 suite and second fix, day 13-14 silicone, decoration and snag." },
      { q: "Can you move the toilet to the other wall?", a: "Almost always yes — but if it's a soil stack run on an external wall it might need new boxing or a macerator. I'll show you on the survey what's possible and the cost difference between 'leave where it is' and 'put it where you actually want it'." },
      { q: "Do you supply the tiles and suite or do I?", a: "Either works. Most customers prefer to pick their own suite — I can give you supplier accounts at Porcelanosa, CTD, Topps Tiles. I get trade prices so you save 10-20% versus retail." },
      { q: "Will I have a working bathroom during the job?", a: "No — we strip the whole room on day 1. If you only have one bathroom we can put a temporary toilet in for the duration. Showering at a neighbour or gym for 2 weeks is the usual plan." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["NVQ Level 3 Plumbing & Heating", "Gas Safe Registered (#492817)", "Water Regs WRAS", "BS5385 Tiling"],
    trade_memberships: ["Gas Safe Register", "CIPHE (Chartered Institute of Plumbing & Heating Engineering)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 750,
    free_site_visits: true,
    quote_availability: "Usually quotes within 5 days",
    quote_turnaround_hours: 120,
    current_status_note: "Booking 6-8 weeks ahead. Detailed quotes take a few days to spec properly.",
    availability: "later",
    reviews: [
      { customer_name: "Charlotte M.", rating: 5, title: "Project managed beautifully", body: "Luca handled tiler, electrician, plasterer — we just turned up to a finished room. Communicated every day with photos. Worth every penny.", service_name: "Full bathroom refit (premium 3x2.5m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/37.jpg" },
      { customer_name: "Daniel H.", rating: 5, title: "Wet room is amazing", body: "Old bath was a death trap for my dad. Luca converted it to a wet room with proper falls and a fold-down seat. Tanking is invisible.", service_name: "Wet room conversion", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/38.jpg" },
      { customer_name: "Aisha B.", rating: 5, title: "On time, on budget", body: "Quoted 12 working days, finished on day 11. No surprise extras. Honest from day one.", service_name: "Full bathroom refit (standard 2.5x2m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/39.jpg" }
    ]
  },

  // 4. CONSERVATORY INSTALLER (female owner)
  {
    trade_slug: "conservatory-installer",
    profile_slug: "demo-rachel-thornton-conservatory-installer-chelmsford",
    display_name: "Rachel Thornton",
    trading_name: "Thornton Conservatories",
    city: "Chelmsford",
    postcode_prefix: "CM2",
    whatsapp: "+44 7700 900304",
    email: "rachel@thorntonconservatories.co.uk",
    bio: "I took over the family installation business from my dad in 2019 — he started it in 1998 doing UPVC conservatories across Essex. I've kept the four-man fitting crew and the relationships with frame suppliers (Synseal, Liniar) but moved the office side fully digital. We do everything from base laying to final glazing on UPVC and aluminium conservatories, orangeries and lean-to extensions. FENSA registered so all the building regs paperwork is handled — you get a certificate within 21 days. I survey every job personally, draw the plan, and stay involved through install. Most customers don't realise the base is 60% of the job — get the dwarf wall wrong and the frames will never sit square. We dig, pour and DPC the base ourselves rather than subbing it out, which is why our conservatories are still standing 25 years on.",
    years_in_trade: 9,
    start_year: 2017,
    priced_services: [
      { name: "UPVC Victorian conservatory (3x3m)", price: 14500, unit: "from", description: "Base, dwarf wall, white UPVC frames, polycarbonate or glass roof, French doors. FENSA certificate included." },
      { name: "Edwardian conservatory (3.5x3.5m)", price: 17800, unit: "from", description: "Square-plan conservatory with apex glass roof, anthracite grey UPVC frames, bi-fold doors. Building regs handled." },
      { name: "Aluminium orangery (4x3.5m)", price: 28500, unit: "from", description: "Aluminium frames, lantern roof, brick pillars, full building regs structure. Insulated to current standards." },
      { name: "Lean-to conservatory (3x2.5m)", price: 11800, unit: "from", description: "Budget-friendly lean-to with UPVC frames, glass roof, side door. Smaller footprint suits terraces and semis." },
      { name: "Conservatory base only (no frames)", price: 4200, unit: "from", description: "Dig out, footings, DPC, brick dwarf wall built to your existing design. For self-build conservatories." },
      { name: "Conservatory survey + planning advice", price: 0, unit: "free", description: "Site visit, measurement, planning permission check, FENSA scope confirmed. Free as part of quote." }
    ],
    faq_items: [
      { q: "Do I need planning permission?", a: "Usually no — most conservatories fall under Permitted Development as long as they're under 30sqm, single storey, lower than the eaves of the house, and not in a conservation area. I'll check your council's portal as part of the survey." },
      { q: "What's the difference between conservatory and orangery?", a: "An orangery has more solid brick and a flat lantern roof instead of a fully glazed apex. They feel more like a proper room extension and they're warmer in winter. Cost difference is usually 40-50%." },
      { q: "Glass roof or polycarbonate?", a: "Always glass if budget allows — solar-control self-cleaning glass keeps it usable year-round. Polycarbonate is cheaper but it's loud in rain and yellow within 8 years." },
      { q: "Will it be too hot in summer?", a: "Not if you spec it right — solar-control glass, opening roof vents, and either tinted glazing or internal blinds. A poorly-spec'd conservatory is unusable in July; ours are usable 12 months a year." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["FENSA Registered Installer", "CSCS Manager Card", "GQA Level 3 Conservatory Installation"],
    trade_memberships: ["FENSA", "Glass and Glazing Federation (GGF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 1500,
    free_site_visits: true,
    quote_availability: "Usually quotes within 7 days",
    quote_turnaround_hours: 168,
    current_status_note: "Surveying 1-2 weeks, install slots 8-10 weeks out for full builds.",
    availability: "later",
    reviews: [
      { customer_name: "Geoffrey P.", rating: 5, title: "Rock solid build", body: "Rachel's team dug the base, built dwarf wall and fitted frames over three weeks. 18 months on, not a single creak or leak. Brilliant.", service_name: "Edwardian conservatory (3.5x3.5m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/40.jpg" },
      { customer_name: "Yasmin K.", rating: 5, title: "Use it all year round", body: "Our orangery is warmer than the house in winter and the solar glass keeps it usable in heatwaves. Spec'd brilliantly.", service_name: "Aluminium orangery (4x3.5m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/41.jpg" },
      { customer_name: "Andrew L.", rating: 5, title: "FENSA cert no fuss", body: "Got the building regs cert in two weeks. Sale of the house went through with no questions. Rachel knows her paperwork.", service_name: "UPVC Victorian conservatory (3x3m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/42.jpg" }
    ]
  },

  // 5. SOLAR INSTALLER
  {
    trade_slug: "solar-installer",
    profile_slug: "demo-marcus-jennings-solar-installer-exeter",
    display_name: "Marcus Jennings",
    trading_name: "Jennings Solar & Battery",
    city: "Exeter",
    postcode_prefix: "EX4",
    whatsapp: "+44 7700 900305",
    email: "marcus@jenningssolar.co.uk",
    bio: "I trained as an electrician in 2006 and pivoted into solar in 2014 when MCS started getting serious. We do PV installs across Devon and east Cornwall — mostly 4-8kW domestic systems with a battery, plus the occasional 20kW commercial roof. Everything is MCS certified, which is non-negotiable if you want the Smart Export Guarantee (SEG) payments from your energy supplier. I handle the DNO notification (the half-hour form to your network operator that 90% of cowboys skip) and I commission every system with optimisers on shaded panels. I don't push battery if your usage profile doesn't need one — I'd rather sell you a smaller system that pays back than oversell. Survey is genuine and free; I'll bring drone footage of your roof so we can spec the panel layout before I quote.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "4kW PV system (10 panels, no battery)", price: 6800, unit: "from", description: "10x 410W mono panels, GivEnergy or Solis hybrid inverter, full DNO notification, MCS certificate, SEG paperwork." },
      { name: "6kW PV system with 5kWh battery", price: 11800, unit: "from", description: "15 panels, hybrid inverter, GivEnergy or Tesla Powerwall 3 battery, full smart export integration." },
      { name: "8kW PV system with 10kWh battery", price: 16500, unit: "from", description: "Larger 20-panel system with optimisers for shaded areas, 10kWh battery, EV charger ready." },
      { name: "Battery retrofit to existing PV", price: 5200, unit: "from", description: "Add a 5kWh battery to an existing solar system. DC or AC coupled depending on existing inverter compatibility." },
      { name: "Panel optimisers (per panel)", price: 110, unit: "per panel", description: "SolarEdge or Tigo optimisers added to shaded panels to recover up to 25% lost yield. Recommended for roofs with chimney shading." },
      { name: "MCS commissioning + DNO notification", price: 380, unit: "fixed", description: "For self-installed systems needing proper certification. Includes G98/G99 paperwork and MCS handover pack." }
    ],
    faq_items: [
      { q: "Do I really need MCS?", a: "Yes if you want SEG payments from your energy company (export tariff). Non-MCS installs are barred from the scheme. Also: most home insurers want to see MCS paperwork to keep your buildings policy valid." },
      { q: "What's a DNO notification?", a: "Your local network operator (UKPN, WPD, etc.) needs to be told you're putting solar onto their grid. Under 3.68kW per phase is a G98 simple notification; bigger systems need G99 approval which takes 4-12 weeks. We submit the paperwork." },
      { q: "Should I get a battery?", a: "Only if your daytime household load is low — if everyone's out 9-5 a battery shifts your solar to evening use and pays back in 7-9 years. If you're at home all day, you're already using the solar live and a battery is harder to justify." },
      { q: "Will my roof take it?", a: "Almost all UK tiled and slate roofs can take a domestic array — total weight is about 12kg/sqm which is well within design loading. I'll inspect rafters during survey." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["MCS Certified Installer (Solar PV)", "NICEIC Approved Contractor", "OZEV Approved Installer", "18th Edition C&G 2382"],
    trade_memberships: ["MCS", "RECC (Renewable Energy Consumer Code)", "NICEIC"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 380,
    free_site_visits: true,
    quote_availability: "Usually quotes within 3 days",
    quote_turnaround_hours: 72,
    current_status_note: "Booking 4-6 weeks. DNO approval for larger systems can add another 4-8 weeks.",
    availability: "later",
    reviews: [
      { customer_name: "Beth N.", rating: 5, title: "Generating from day one", body: "6kW + battery on our new build. Marcus handled MCS, DNO, SEG sign-up. We're getting paid 15p per kWh exported. Brilliant install.", service_name: "6kW PV system with 5kWh battery", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/43.jpg" },
      { customer_name: "Ravi S.", rating: 5, title: "Honest spec, no oversell", body: "Other installer wanted to sell me 10kW + 13kWh battery. Marcus surveyed my usage and said 6kW was enough. Saved me £4k.", service_name: "4kW PV system (10 panels, no battery)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/44.jpg" },
      { customer_name: "James W.", rating: 5, title: "Battery added easily", body: "Had panels for 5 years, finally added a battery. Marcus AC-coupled it cleanly, app integration works perfectly.", service_name: "Battery retrofit to existing PV", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/45.jpg" }
    ]
  },

  // 6. EV CHARGER INSTALLER (female owner)
  {
    trade_slug: "ev-charger-installer",
    profile_slug: "demo-zara-mitchell-ev-charger-installer-reading",
    display_name: "Zara Mitchell",
    trading_name: "Mitchell EV Solutions",
    city: "Reading",
    postcode_prefix: "RG1",
    whatsapp: "+44 7700 900306",
    email: "zara@mitchellev.co.uk",
    bio: "I'm a qualified domestic electrician (18th edition, NICEIC) who specialised in EV chargers in 2020 when the home-charge market took off. I'm OZEV approved, so customers buying through the EV chargepoint grant for flats and landlords get the £350 grant applied directly. I install 7kW Zappi, Ohme and Hypervolt chargers across Reading, Slough and west London — mostly straight runs from consumer unit to driveway, occasionally with a load-balancing CT clamp where the supply is tight. I always check your main fuse rating before quoting — a 60A house can't run a 7kW charger plus an oven and shower at peak without tripping, and the answer is either a fuse upgrade (free from your DNO if you ask nicely) or a load-balancer. I commission every charger on the manufacturer app before I leave so you can use it tonight.",
    years_in_trade: 8,
    start_year: 2018,
    priced_services: [
      { name: "7kW charger install (standard, up to 15m run)", price: 895, unit: "fixed", description: "Zappi, Ohme, Hypervolt or similar 7kW unit installed on driveway/garage wall, up to 15m cable run from consumer unit. Tethered or untethered." },
      { name: "7kW charger install (long run 15-25m)", price: 1185, unit: "fixed", description: "Same install but for longer cable runs across yards or around extensions. Includes external IP66 ducting and trenching where required." },
      { name: "22kW charger install (3-phase property)", price: 1650, unit: "fixed", description: "3-phase 22kW unit for properties with 3-phase supply. Requires confirmation of supply type during survey." },
      { name: "OZEV grant install (flat/rental)", price: 595, unit: "after grant", description: "After £350 OZEV chargepoint grant for landlords and flat residents. Includes landlord consent paperwork support." },
      { name: "Load balancer / CT clamp upgrade", price: 285, unit: "fixed", description: "Add load-balancing to existing or new install to protect 60A or 80A main fuse from tripping under peak load." },
      { name: "Survey + supply check", price: 0, unit: "free", description: "Free pre-install survey to confirm cable route, fuse rating, earthing arrangement (TN-C-S, TT). Avoids surprises." }
    ],
    faq_items: [
      { q: "Will my house supply take a 7kW charger?", a: "Yes 95% of the time. A 60A main fuse plus a 7kW charger is fine if you load-balance. If you regularly run oven + shower + charger together I'll fit a CT clamp that throttles the car briefly when load is high — you'll never notice." },
      { q: "Do I need to upgrade my fuse?", a: "Most installs don't. If you're on a 60A fuse and want a 22kW 3-phase charger, you'll need to ask your DNO (free upgrade in most cases). I handle the application." },
      { q: "Can I claim the OZEV grant?", a: "Only flats and rental properties qualify now — the homeowner grant ended in 2022. If you're a landlord I'll process the grant against your install so you only pay the discounted price." },
      { q: "Tethered or untethered cable?", a: "Untethered (socket only) is more flexible — you take the car's own cable with you when you travel. Tethered is more convenient at home. I'd default to untethered unless you specifically want tethered." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["18th Edition C&G 2382", "NICEIC Approved Contractor", "OZEV Approved Installer", "EV Charger Installation (City & Guilds 2919)"],
    trade_memberships: ["NICEIC", "OZEV Approved Installer Register"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 595,
    free_site_visits: true,
    quote_availability: "Usually quotes same day",
    quote_turnaround_hours: 12,
    current_status_note: "Booking 1-2 weeks ahead. Single installs often slotted within the week.",
    availability: "next_week",
    reviews: [
      { customer_name: "Patrick D.", rating: 5, title: "Tidy cable run", body: "Zara routed the cable through the garage and out under the soffit so it's barely visible. Charger commissioned in app before she left.", service_name: "7kW charger install (standard, up to 15m run)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/46.jpg" },
      { customer_name: "Lucy F.", rating: 5, title: "Saved me a fuse upgrade", body: "Other installer said I needed a fuse upgrade. Zara fitted a load balancer instead — works perfectly with our 60A supply. Cheaper too.", service_name: "Load balancer / CT clamp upgrade", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/47.jpg" },
      { customer_name: "Oliver B.", rating: 5, title: "OZEV grant processed cleanly", body: "Landlord install with grant. Zara did all the paperwork, my tenant got a charger on the wall for £595 total. Brilliant.", service_name: "OZEV grant install (flat/rental)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/48.jpg" }
    ]
  },

  // 7. HEAT PUMP INSTALLER
  {
    trade_slug: "heat-pump-installer",
    profile_slug: "demo-grant-ferguson-heat-pump-installer-perth",
    display_name: "Grant Ferguson",
    trading_name: "Ferguson Renewables",
    city: "Perth",
    postcode_prefix: "PH1",
    whatsapp: "+44 7700 900307",
    email: "grant@fergusonrenewables.co.uk",
    bio: "I came up through oil heating in rural Perthshire — 22 years on AGA, Worcester and Grant boilers across farms and steadings. In 2018 I retrained on air source heat pumps and now that's 80% of my work. I'm MCS certified, F-gas qualified for refrigerant handling and my install paperwork meets the BUS grant requirements (£7,500 off the cost for eligible homes). I survey heat loss properly with a EN12831 calc — not the quick checklist some installers use — because oversizing or undersizing a heat pump is the single biggest reason they end up costing more to run than gas. I also do the cylinder, the buffer if needed, and the radiator upsizing in-house so there's one number on the quote and one phone number if anything goes wrong.",
    years_in_trade: 24,
    start_year: 2002,
    priced_services: [
      { name: "8kW air source heat pump install (with BUS grant)", price: 6800, unit: "after grant", description: "Mitsubishi Ecodan or Daikin Altherma 8kW unit installed with new cylinder, controls, commissioning. £7,500 BUS grant applied. MCS certified." },
      { name: "12kW air source heat pump (larger home)", price: 9200, unit: "after grant", description: "Larger home or low insulation. 12kW unit, 250L cylinder, buffer tank if needed. BUS grant applied." },
      { name: "Heat loss survey (EN12831)", price: 480, unit: "fixed", description: "Full room-by-room heat loss calculation with thermography, fabric U-value assumptions, radiator sizing schedule. Refunded against install if you book." },
      { name: "Radiator upsize package (per radiator)", price: 195, unit: "per rad", description: "Swap existing rads for larger K2 or K3 panels sized correctly for heat pump flow temperatures (45-50C). Includes drain/refill." },
      { name: "Hot water cylinder swap (250L unvented)", price: 2400, unit: "fixed", description: "Replace existing cylinder with a heat-pump-rated 250L unvented unit with adequate coil surface area." },
      { name: "MCS commissioning only (self-built systems)", price: 1450, unit: "fixed", description: "For systems where the customer has sourced the kit. Includes MCS sign-off, BUS grant paperwork, F-gas commissioning." }
    ],
    faq_items: [
      { q: "Will a heat pump actually heat my house?", a: "Yes — as long as it's sized properly and your radiators are big enough to deliver at 45-50C flow temperature. The horror stories are 9 times out of 10 a sizing or radiator issue, not the pump itself." },
      { q: "Will my bills go up or down vs gas?", a: "If you're on standard gas tariff, bills are roughly flat (cheaper if you go on a heat-pump-friendly tariff like Octopus Cosy). If you're on oil or LPG, bills typically drop 40-60%." },
      { q: "Can I get the £7,500 grant?", a: "Almost certainly yes if you own the home and have a valid EPC with no outstanding loft or cavity insulation recommendations. I'll check eligibility during survey." },
      { q: "Do you do the radiator changes too?", a: "Yes — that's the bit other installers often skip. Heat pumps need bigger rads to deliver enough heat at lower flow temps. I quote a single number for pump + cylinder + radiators." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["MCS Certified Installer (Heat Pump)", "F-Gas Category 1 (Refrigerant Handling)", "Gas Safe Registered", "BPEC Heat Pump Installation", "City & Guilds Low Temperature Heating"],
    trade_memberships: ["MCS", "HIES Consumer Code", "Heat Pump Federation"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 480,
    free_site_visits: true,
    quote_availability: "Usually quotes within 7 days",
    quote_turnaround_hours: 168,
    current_status_note: "Survey wait 2 weeks; install slots 8-12 weeks. BUS grant approval adds 4 weeks.",
    availability: "later",
    reviews: [
      { customer_name: "Margaret D.", rating: 5, title: "Bills halved", body: "We were on oil — 2200/year. Now on heat pump with the BUS grant. Last winter cost us £900 in electricity for heat and hot water. Grant knows his stuff.", service_name: "8kW air source heat pump install (with BUS grant)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/49.jpg" },
      { customer_name: "Iain M.", rating: 5, title: "House is warmer than ever", body: "Grant insisted on upsizing 8 of our radiators. Other quote skipped that step. End result: house is 21C all winter at lower running cost than gas.", service_name: "Radiator upsize package (per radiator)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/50.jpg" },
      { customer_name: "Fiona R.", rating: 5, title: "Proper survey, no nasty surprises", body: "Paid £480 for the heat loss calc upfront. Worth every penny — system is sized perfectly. Refunded against the install too.", service_name: "Heat loss survey (EN12831)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/51.jpg" }
    ]
  },

  // 8. SMART HOME INSTALLER (female owner)
  {
    trade_slug: "smart-home-installer",
    profile_slug: "demo-anya-petrova-smart-home-installer-london",
    display_name: "Anya Petrova",
    trading_name: "Petrova Smart Home",
    city: "London",
    postcode_prefix: "SW6",
    whatsapp: "+44 7700 900308",
    email: "anya@petrovasmarthome.co.uk",
    bio: "I came out of AV integration on superyachts and moved into residential smart home in 2019 when my second child was born. I'm a CEDIA Certified Professional and I run a small two-person crew covering prime central and west London. We do full Lutron HomeWorks lighting, KNX whole-house systems, Crestron home cinema and Loxone whole-house automation — typically £40k-£250k projects. The unsexy bit that matters most is structured cabling — Cat6A everywhere, dual data points at every TV, smurf tubing for future runs, a proper rack in the cupboard. We design lighting scenes by spending an hour with you per room walking through how you actually live (morning, working, dinner, late), not just dropping a 'dimmed' preset. Every install gets a 12-month tune-up visit included.",
    years_in_trade: 14,
    start_year: 2012,
    priced_services: [
      { name: "Lutron RA2 Select (per room, retrofit)", price: 1850, unit: "per room", description: "Wireless Lutron retrofit per room — 3-4 dimmer modules, Pico remotes, app integration. No re-wiring needed." },
      { name: "Lutron HomeWorks QSX (whole house)", price: 38000, unit: "from", description: "Full wired Lutron system across a 4-bed property. Lighting, blinds, scenes, app + keypads. Includes design, install and 12-month support." },
      { name: "KNX whole-house automation", price: 52000, unit: "from", description: "KNX backbone covering lighting, HVAC, blinds, AV. Open protocol, multi-vendor compatible. Includes ETS programming and visualisation." },
      { name: "Loxone Tree system (4-bed home)", price: 28500, unit: "from", description: "Loxone Miniserver + Tree extensions for lighting, audio, climate, security. Cost-effective whole-house automation." },
      { name: "Home cinema design + install", price: 18500, unit: "from", description: "Acoustic treatment, 7.1.4 Atmos, 4K projection, motorised screen, full Crestron control. Custom seating optional." },
      { name: "Structured cabling first-fix (per outlet)", price: 95, unit: "per outlet", description: "Cat6A point-to-point cabling during first fix. Includes back box, smurf tube, patch panel termination." }
    ],
    faq_items: [
      { q: "Do I need to re-wire for smart home?", a: "Depends on the system. Lutron RA2 Select is fully wireless retrofit — no re-wiring needed. KNX and HomeWorks need wired control runs which means walls open during first fix. Loxone is a hybrid that fits most renovations." },
      { q: "Lutron vs KNX vs Loxone — which is best?", a: "Lutron HomeWorks is the gold standard for lighting and the most reliable. KNX is open-protocol so you're not locked to one vendor. Loxone is the value pick — great features at half the Lutron price. I'll spec the right one for your budget and house." },
      { q: "Can I add it to an existing house without ripping walls?", a: "Yes — Lutron RA2 Select wireless works in any existing house. We swap your dimmers for smart modules and add wireless keypads. Whole-house automation is harder to retrofit without some first-fix work." },
      { q: "Do you do the AV and TV install too?", a: "Yes — TVs, projectors, multi-room music (Sonos/Sonance), home cinema, network. AV without smart control is half a job." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["CEDIA Certified Professional", "Lutron RA2 + HomeWorks Certified", "KNX Partner", "Loxone Gold Partner", "Crestron DMC-T"],
    trade_memberships: ["CEDIA (Custom Electronic Design and Installation Association)", "KNX UK"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 1850,
    free_site_visits: true,
    quote_availability: "Usually quotes within 10 days",
    quote_turnaround_hours: 240,
    current_status_note: "Design lead-time 2-3 weeks. Install windows usually 8-16 weeks out aligned to main contractor.",
    availability: "later",
    reviews: [
      { customer_name: "Edward W.", rating: 5, title: "Worth every penny", body: "Full Lutron HomeWorks across our Chelsea house. Scenes for morning, dinner, cinema — works flawlessly. Anya's eye for design is brilliant.", service_name: "Lutron HomeWorks QSX (whole house)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/52.jpg" },
      { customer_name: "Camilla R.", rating: 5, title: "Cinema is jaw-dropping", body: "Custom 7.1.4 Atmos cinema in the basement. Calibrated audio is incredible. Crestron control is one button: 'movie'.", service_name: "Home cinema design + install", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/53.jpg" },
      { customer_name: "Harvey N.", rating: 5, title: "Cabling done right", body: "Anya first-fixed 64 Cat6A points during our renovation. Two years later we've added cameras, AV, WiFi APs — all into existing tubes. No re-wiring.", service_name: "Structured cabling first-fix (per outlet)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/54.jpg" }
    ]
  },

  // 9. GARAGE DOOR INSTALLER
  {
    trade_slug: "garage-door-installer",
    profile_slug: "demo-darren-walsh-garage-door-installer-warrington",
    display_name: "Darren Walsh",
    trading_name: "Walsh Garage Doors",
    city: "Warrington",
    postcode_prefix: "WA4",
    whatsapp: "+44 7700 900309",
    email: "darren@walshgaragedoors.co.uk",
    bio: "I started fitting garage doors for a national chain in 2008, went on my own in 2015 and now cover Cheshire, Merseyside and south Manchester. I'm an approved fitter for Hörmann (sectional), Garador (up-and-over) and SeceuroGlide (roller). 80% of my installs now are insulated sectional doors with automation — the up-and-over is dying out and roller doors suit terraces with no headroom. Safety first on every install: I drain the torsion springs before touching them (an unsecured spring will take your hand off), and I test the safety reverse on every automated door before I leave. I'll always quote two options — manual and automated — so you can see the cost difference. Survey is free and I'll measure the opening properly rather than ask you to do it.",
    years_in_trade: 18,
    start_year: 2008,
    priced_services: [
      { name: "Sectional door supply + fit (Hörmann LPU, manual)", price: 1850, unit: "from", description: "Hörmann LPU 42 insulated sectional door fitted to standard single garage opening. White or anthracite finish." },
      { name: "Sectional door + automation (Hörmann)", price: 2480, unit: "from", description: "Hörmann sectional + SupraMatic motor, 2 hand-transmitters, photocell safety. App control included." },
      { name: "Roller door supply + fit (SeceuroGlide Excel)", price: 2280, unit: "from", description: "SeceuroGlide Excel insulated aluminium roller door with motor, remotes. Suits openings with no headroom." },
      { name: "Up-and-over door + automation kit", price: 1480, unit: "from", description: "Garador or Hormann steel up-and-over canopy, motorised with Liftmaster or Hörmann ECOstar opener." },
      { name: "Motor retrofit to existing door", price: 580, unit: "from", description: "Add automation to an existing manual sectional or up-and-over. Includes motor, 2 remotes, photocell safety beam." },
      { name: "Spring + cable safety service", price: 165, unit: "fixed", description: "Replace tired torsion springs and lift cables on an existing sectional door. Both springs always replaced together." }
    ],
    faq_items: [
      { q: "Sectional or roller — which is best?", a: "Sectional is more insulated, more secure, smoother — go sectional if you have at least 200mm headroom. Roller wins if headroom is tight or you want to park right up to the door inside. Up-and-over is cheap but rattly and outdated." },
      { q: "Why do springs need replacing in pairs?", a: "If one spring has fatigued, the other is close behind. Replacing one means the new spring carries unequal load — you'll be back in 18 months replacing the second one anyway. Pair replacement is non-negotiable on my installs." },
      { q: "Is the safety reverse really necessary?", a: "Yes — required by EN 13241 since 2002. The photocell beam stops the door if anything (a cat, a child) breaks the beam during closing. I test it on every install and write it in the handover." },
      { q: "Can you fit Hörmann if I bought it online?", a: "Yes but I won't warranty the door itself if you supplied it — only my fitting. I'll also need to inspect it on arrival because online deliveries arrive damaged more often than people realise." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["DHF Diploma (Door & Hardware Federation)", "CSCS Card", "Hörmann Approved Installer", "SeceuroGlide Approved Installer"],
    trade_memberships: ["Door & Hardware Federation (DHF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 165,
    free_site_visits: true,
    quote_availability: "Usually quotes within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Booking 2-3 weeks. Spring replacements often slotted same week.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Stuart R.", rating: 5, title: "Quiet and smooth", body: "Hörmann sectional with SupraMatic motor — opens silently from the app. Insulation made the garage warm enough to use as a workshop in winter.", service_name: "Sectional door + automation (Hörmann)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/55.jpg" },
      { customer_name: "Nicola B.", rating: 5, title: "Roller was the right call", body: "Tight headroom in our terrace garage. Darren recommended a SeceuroGlide roller instead of sectional. Perfect — gained 600mm of usable interior height.", service_name: "Roller door supply + fit (SeceuroGlide Excel)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/56.jpg" },
      { customer_name: "Kevin J.", rating: 5, title: "Saved an old door", body: "10-year-old sectional with knackered springs. Darren swapped both, lubed the rollers, runs like new. Saved me £1800 on a replacement.", service_name: "Spring + cable safety service", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/57.jpg" }
    ]
  },

  // 10. GUTTER INSTALLER
  {
    trade_slug: "gutter-installer",
    profile_slug: "demo-craig-pritchard-gutter-installer-cardiff",
    display_name: "Craig Pritchard",
    trading_name: "Pritchard Gutters & Fascia",
    city: "Cardiff",
    postcode_prefix: "CF14",
    whatsapp: "+44 7700 900310",
    email: "craig@pritchardgutters.co.uk",
    bio: "I've been working at height for 16 years — started on scaffolding crews then moved into roofline (fascias, soffits, gutters) which is its own specialty. I'm IPAF and PASMA ticketed so we use scissor lifts and proper towers, not ladders leaning against your render. Most weeks I'm tearing off blocked or sagging UPVC gutter and replacing with seamless aluminium for jobs over 20m, or full cast-iron-effect UPVC for period houses that need to look right. I fit leaf guards as standard on anything near trees — they pay back in two years of not having to call me back to unblock. Free survey with drone photos so you can see the state of your existing roofline before I quote.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "UPVC gutter replacement (per linear m)", price: 38, unit: "per linear m", description: "Strip old half-round or square line gutter, fit new UPVC including brackets, stop ends, downpipe connections." },
      { name: "Seamless aluminium gutter (per linear m)", price: 62, unit: "per linear m", description: "Continuous aluminium gutter formed on-site from a coil — zero joints in long runs, 25-year+ life. Various colours." },
      { name: "Cast-iron-effect UPVC (per linear m)", price: 52, unit: "per linear m", description: "Heavy-section UPVC mimicking original cast iron profile — for period properties wanting the look without the maintenance." },
      { name: "Fascia + soffit + gutter (per linear m)", price: 95, unit: "per linear m", description: "Full roofline package: replace fascia, soffit, gutter and downpipes. White or anthracite. Includes ventilation strips." },
      { name: "Leaf guard install (per linear m)", price: 14, unit: "per linear m", description: "Aluminium mesh leaf guard clipped over existing gutter. Recommended for anything near trees." },
      { name: "Gutter clean + repair (per visit)", price: 145, unit: "fixed", description: "Full clear of debris from gutters and downpipes on a standard semi, including check of brackets and minor sealant repairs." }
    ],
    faq_items: [
      { q: "How do you reach high gutters safely?", a: "Scissor lift or PASMA tower for anything above single storey — both my crew are ticketed. Ladder leaned against fascia is banned on my jobs, it damages your roofline and breaks regs." },
      { q: "UPVC or aluminium?", a: "UPVC is cheaper and fine for runs under 15m. Seamless aluminium wins on longer fronts, period houses and anywhere you don't want joints leaking. Aluminium will outlast UPVC by 15+ years." },
      { q: "Do leaf guards actually work?", a: "Yes if they're the right ones — fine mesh aluminium not the cheap plastic foam strips. They don't stop everything but they catch the heavy load. You'll go from a yearly unblock to once every 5-7 years." },
      { q: "Can you clear gutters as a one-off?", a: "Yes, £145 for a standard semi. I'll send drone photos before-and-after so you can see what came out and the state of the gutter underneath." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["IPAF 3a + 3b (Mobile Elevated Work Platforms)", "PASMA Tower Erection", "Working at Height (CSCS)"],
    trade_memberships: ["NFRC (National Federation of Roofing Contractors)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 145,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 2-3 weeks. Emergency gutter repairs slotted within 5 working days.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Bethan L.", rating: 5, title: "Looks like cast iron", body: "Our Victorian terrace needed proper roofline. Craig fitted heavy UPVC that genuinely looks like the original cast. Neighbours have asked who did it.", service_name: "Cast-iron-effect UPVC (per linear m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/58.jpg" },
      { customer_name: "Mike H.", rating: 5, title: "Seamless run is brilliant", body: "32m run across the back of our house in seamless aluminium. Zero joints, zero leaks. Beautiful work and Craig was up and down on the scissor lift all day.", service_name: "Seamless aluminium gutter (per linear m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/59.jpg" },
      { customer_name: "Stephanie A.", rating: 5, title: "Leaf guards changed my life", body: "Three big trees on the boundary. Used to clear gutters every September. Craig fitted leaf guards two years ago — clean as a whistle still.", service_name: "Leaf guard install (per linear m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/60.jpg" }
    ]
  },

  // 11. DRIVEWAY INSTALLER
  {
    trade_slug: "driveway-installer",
    profile_slug: "demo-paul-mcfadden-driveway-installer-glasgow",
    display_name: "Paul McFadden",
    trading_name: "McFadden Driveways",
    city: "Glasgow",
    postcode_prefix: "G44",
    whatsapp: "+44 7700 900311",
    email: "paul@mcfaddendriveways.co.uk",
    bio: "I've been on driveways for 21 years — block paving, resin bound, tarmac and a fair bit of natural stone setts. The biggest mistake people make is undersized excavation. A driveway needs 200mm of MOT Type 1 minimum, properly compacted, with SuDS-compliant drainage. Cheap installers skim 100mm off the dig and you get sinking, cracking and weed growth within 3 years. Since 2008 driveways over 5sqm need to be permeable or drain to a soakaway — I do SuDS-compliant resin bound and permeable block paving so you don't need planning permission. Family-run, three-man crew, we do start-to-finish: skip, dig, edge, base, surface, channels. No subcontracting.",
    years_in_trade: 21,
    start_year: 2005,
    priced_services: [
      { name: "Block paving driveway (per sqm)", price: 105, unit: "per sqm", description: "Excavation, MOT Type 1 base, sand, Marshalls or Brett block paving in standard colours. SuDS-compliant permeable option available." },
      { name: "Resin bound driveway (per sqm)", price: 85, unit: "per sqm", description: "Permeable resin-bound surface over compacted base. SuDS compliant, no planning permission needed. Decorative aggregates." },
      { name: "Tarmac driveway (per sqm)", price: 68, unit: "per sqm", description: "Hot-laid macadam over MOT base, 50mm wearing course. Includes drainage channel and edging. Not SuDS-compliant — needs soakaway." },
      { name: "Resin bound overlay (per sqm)", price: 58, unit: "per sqm", description: "Resin-bound surface over existing sound concrete or tarmac base. Faster, cheaper option if the base is solid. Survey required." },
      { name: "Driveway dig + base prep (per sqm)", price: 38, unit: "per sqm", description: "Excavate 250mm, install Type 1 sub-base compacted in layers. For customers wanting to lay their own surface or hire a different installer." },
      { name: "Drainage upgrade (channel + soakaway)", price: 1200, unit: "from", description: "Linear ACO channel across driveway entrance routed to soakaway in front garden. For impermeable surfaces (tarmac, sealed block)." }
    ],
    faq_items: [
      { q: "Do I need planning permission for a new driveway?", a: "Only if it's over 5sqm and impermeable AND drains to the highway. SuDS-compliant surfaces (permeable block, resin bound) are exempt. Tarmac with a soakaway is also exempt. I'll always quote SuDS-friendly by default." },
      { q: "How deep should the base be?", a: "150mm minimum for a domestic driveway, 200mm if you have a heavy vehicle. Anyone quoting 75-100mm is undercutting and your driveway will sink. I excavate properly and I'll show you the dig before I fill it." },
      { q: "Block paving or resin?", a: "Block is more durable and you can replace individual blocks if oil drops onto them. Resin is smoother (good for prams/wheelchairs), modern looking, weed-resistant. Both should last 15-20 years if laid correctly." },
      { q: "Can you do it over a weekend?", a: "Small driveways (one car) yes — 3 days. Standard double driveway is usually 5-7 working days including base settle time. I won't rush a base layer because the surface will fail later." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NVQ Level 2 Construction Operations", "CSCS Gold Card", "BALI Approved Driveway Installer", "Resin Bound Installer Accreditation (RBP)"],
    trade_memberships: ["BALI (British Association of Landscape Industries)", "Marshalls Register"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 1200,
    free_site_visits: true,
    quote_availability: "Usually quotes within 5 days",
    quote_turnaround_hours: 120,
    current_status_note: "Booking 4-6 weeks ahead (weather dependent in winter).",
    availability: "later",
    reviews: [
      { customer_name: "Calum R.", rating: 5, title: "Driveway is bombproof", body: "Paul dug down 250mm, proper Type 1 base. 4 years on, not a single sunken block. Other neighbours' driveways are already failing.", service_name: "Block paving driveway (per sqm)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/61.jpg" },
      { customer_name: "Marie L.", rating: 5, title: "Resin looks amazing", body: "Permeable resin bound in golden grain. Cars look stunning on it. SuDS-compliant so no planning hassle.", service_name: "Resin bound driveway (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/62.jpg" },
      { customer_name: "Tony G.", rating: 5, title: "Drainage problem solved", body: "Rainwater used to flood our garage. Paul cut in an ACO channel and routed it to a soakaway. Garage dry as a bone all winter.", service_name: "Drainage upgrade (channel + soakaway)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/63.jpg" }
    ]
  },

  // 12. FENCING INSTALLER
  {
    trade_slug: "fencing-installer",
    profile_slug: "demo-ben-fairhurst-fencing-installer-norwich",
    display_name: "Ben Fairhurst",
    trading_name: "Fairhurst Fencing",
    city: "Norwich",
    postcode_prefix: "NR4",
    whatsapp: "+44 7700 900312",
    email: "ben@fairhurstfencing.co.uk",
    bio: "I've been putting fences in across Norfolk and north Suffolk for 13 years. Bread and butter is feather edge on concrete posts, but lately I've been doing more horizontal slatted softwood, composite (Composite Prime, Eco-Fencing) and animal-proof runs for smallholders. I use Postsavers instead of straight concrete-in-the-ground for hardwood posts — the trade-off is a £15 sleeve per post that adds 8-10 years to the post's life. I always walk the boundary with you first and check the title plan if there's any dispute about where the line actually is. The neighbour-line conversation is awkward but I've never had a comeback because I sort it before I start. Survey, dig samples and quote within 48 hours.",
    years_in_trade: 13,
    start_year: 2013,
    priced_services: [
      { name: "Feather edge fence (per linear m, 1.8m high)", price: 68, unit: "per linear m", description: "Concrete posts, gravel boards, feather edge boards, capping rail. Standard 1.8m high garden boundary." },
      { name: "Horizontal slatted softwood (per linear m)", price: 110, unit: "per linear m", description: "Pressure-treated softwood slats with 15mm gaps, hardwood posts with Postsaver sleeves. Modern look." },
      { name: "Composite fencing (per linear m)", price: 165, unit: "per linear m", description: "Composite Prime or Eco-Fencing system — 25-year warranty, zero maintenance. Anthracite, beige or oak finish." },
      { name: "Animal-proof fence (per linear m)", price: 85, unit: "per linear m", description: "Stock or chicken-wire fence with buried apron 300mm under to stop fox digging. For smallholdings and gardens with chickens or rabbits." },
      { name: "Post replacement (concrete-in)", price: 95, unit: "per post", description: "Replace single broken or rotted post. Includes new concrete, re-fix panels or boards each side. Same-day on small jobs." },
      { name: "Gate (5ft wide, softwood)", price: 380, unit: "fixed", description: "Built and hung 5ft pedestrian gate, including hinges, latch, post adjustment. Hardwood or composite available at extra cost." }
    ],
    faq_items: [
      { q: "Who's responsible for the fence — me or my neighbour?", a: "Check your deeds — the T-mark shows ownership. If you can't tell, no one owns it by default and you both have to agree. I'll never start a job on a disputed boundary until both sides have agreed in writing." },
      { q: "Concrete posts or hardwood with Postsavers?", a: "Concrete is bulletproof but ugly. Hardwood with Postsaver sleeves looks better and lasts 20+ years if installed properly. Plain hardwood in the ground rots in 6-8 years — always avoid." },
      { q: "Composite vs softwood — worth the price?", a: "If you hate painting/staining and want zero maintenance, composite is great. Cost is roughly 2x softwood but you save the cost of staining every 3 years and replacement at year 12. Lifecycle cost is similar." },
      { q: "Can you do an animal-proof fence?", a: "Yes — feather edge above with stock netting buried 300mm below ground line to stop fox/badger dig-unders. For chicken runs I'll also do a wire skirt out 600mm horizontal." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NVQ Level 2 Fencing", "Lantra Fencing Apprenticeship", "Chainsaw CS30/31"],
    trade_memberships: ["Association of Fencing Industries (AFI)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 280,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 2-3 weeks. Single post repairs often slotted same week.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Karen W.", rating: 5, title: "Solid build", body: "60m of slatted softwood across the back garden. Ben used Postsavers on every post and the finish is gorgeous. Worth the wait.", service_name: "Horizontal slatted softwood (per linear m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/64.jpg" },
      { customer_name: "David P.", rating: 5, title: "Boundary sorted properly", body: "Neighbour disputed the line. Ben pulled the deeds, marked the boundary on the ground, both of us signed off before he started. Zero drama.", service_name: "Feather edge fence (per linear m, 1.8m high)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/65.jpg" },
      { customer_name: "Megan B.", rating: 5, title: "Foxes can't get in", body: "Wanted free-range chickens. Ben buried the wire apron 300mm down. Lost zero chickens in 18 months. Foxes give up.", service_name: "Animal-proof fence (per linear m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/66.jpg" }
    ]
  },

  // 13. SHUTTER INSTALLER (female owner)
  {
    trade_slug: "shutter-installer",
    profile_slug: "demo-isabella-clarke-shutter-installer-brighton",
    display_name: "Isabella Clarke",
    trading_name: "Clarke Shutters & Blinds",
    city: "Brighton",
    postcode_prefix: "BN1",
    whatsapp: "+44 7700 900313",
    email: "isabella@clarkeshutters.co.uk",
    bio: "I left a corporate marketing job in 2018 to set up a window-dressing fit company because there's a shocking shortage of installers in this region. I source from S-Craft, California Shutters and Just Shutters — hardwood plantation, faux wood (PVC) and ABS waterproof for bathrooms. I measure every window personally with a laser and a written check sheet — shape, recess depth, sill profile, obstruction by handles or restrictors. Bay windows, shaped windows (arched, raked) and tier-on-tier are my speciality. Every install comes with child-safe cordless or motorised options as standard — the Blind Cord Safety Regulations 2014 made looped cords illegal on new installs and I won't fit them. Survey + design takes around an hour, manufactured in 4-8 weeks, fitted in a half day.",
    years_in_trade: 8,
    start_year: 2018,
    priced_services: [
      { name: "Hardwood plantation shutters (per sqm)", price: 380, unit: "per sqm", description: "Painted basswood plantation shutters, 76mm or 89mm louvre, hidden tilt or rear tilt rod. White or custom colour." },
      { name: "Faux wood (PVC) shutters (per sqm)", price: 245, unit: "per sqm", description: "PVC plantation-style shutters — great for bathrooms and kitchens. Same look as hardwood at lower cost, waterproof." },
      { name: "Bay window shutter set", price: 1850, unit: "from", description: "3 or 5-section bay window shutters with mitred frames. Includes survey, manufacturing, install. Hardwood." },
      { name: "Shaped window shutters (arched/raked)", price: 720, unit: "per panel", description: "Custom-shaped panels for arched, gable or raked windows. CAD template made on site. Hardwood only." },
      { name: "Motorised blind install (per blind)", price: 285, unit: "per blind", description: "Battery-powered roller or roman blinds with smart-home integration (Lutron, SOMFY). Up to 1.8m wide." },
      { name: "Survey + quote", price: 0, unit: "free", description: "Site survey, designs, samples, fixed-price quote. No obligation. Free across BN, RH and parts of TN postcodes." }
    ],
    faq_items: [
      { q: "Hardwood or faux wood — what's the real difference?", a: "Hardwood is genuine basswood — lighter, more durable, takes paint better. Faux wood is PVC — heavier, waterproof, cheaper. In a bedroom or living room go hardwood. In a bathroom or kitchen always faux." },
      { q: "Can you fit on a shaped window?", a: "Yes — arched, raked, gable end, even circular. I make a CAD template on-site with paper and laser distance, send to the manufacturer who fabricates a one-off. Lead-time goes up to 8-10 weeks for shaped." },
      { q: "Are blinds with cords safe?", a: "Looped cords have been illegal on new installs since 2014 because of child strangulation incidents. I only fit cordless, chain-with-tensioner, or motorised. Non-negotiable." },
      { q: "Will the shutters block my bay window view?", a: "Not if spec'd right — full-height with wide louvres opens to about 80% of the glass. Café-style (lower half only) lets you see out fully on the top half." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["British Blind & Shutter Association Member", "BBSA Child Safety Certified"],
    trade_memberships: ["British Blind & Shutter Association (BBSA)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 380,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Survey within 1-2 weeks. Manufacturing lead-time 4-8 weeks then half-day install.",
    availability: "later",
    reviews: [
      { customer_name: "Henrietta M.", rating: 5, title: "Bay shutters are gorgeous", body: "5-section hardwood plantation set across our Victorian bay. Mitres are flawless. Isabella's eye for the right louvre size made the room.", service_name: "Bay window shutter set", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/67.jpg" },
      { customer_name: "Simon C.", rating: 5, title: "Arched window, no problem", body: "Two arched windows that no one else would touch. Isabella did CAD templates and 6 weeks later the shutters slotted in perfectly.", service_name: "Shaped window shutters (arched/raked)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/68.jpg" },
      { customer_name: "Tara L.", rating: 5, title: "Bathroom faux is perfect", body: "Used faux wood in our wet bathroom. Two years on no warping, easy clean. Looks identical to the hardwood we did in the bedroom.", service_name: "Faux wood (PVC) shutters (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/69.jpg" }
    ]
  },

  // 14. AERIAL SATELLITE INSTALLER
  {
    trade_slug: "aerial-satellite-installer",
    profile_slug: "demo-gareth-evans-aerial-satellite-installer-swansea",
    display_name: "Gareth Evans",
    trading_name: "Evans Aerial & Satellite",
    city: "Swansea",
    postcode_prefix: "SA2",
    whatsapp: "+44 7700 900314",
    email: "gareth@evansaerial.co.uk",
    bio: "26 years on aerial and dish installs across south Wales. Started with analogue UHF back in 2000, did the digital switchover from 2009-2012, and now most of my work is split between TV aerials in fringe-signal valleys (where you need a proper high-gain Yagi and a masthead amp), Sky Q/Stream dishes, and increasingly Starlink Gen 3 for rural customers who can't get fibre. I carry a signal meter and a spectrum analyser to every install so I'm not guessing what direction or polarisation to point things. I'll also cable into multiple rooms with proper RG6 sat-grade coax — no cheap brown stuff. Free survey, fixed-price quote, and I won't fit a 30 quid contract aerial if the area genuinely needs a 50-element high-gain.",
    years_in_trade: 26,
    start_year: 2000,
    priced_services: [
      { name: "TV aerial install (UHF Yagi, single point)", price: 145, unit: "fixed", description: "High-gain UHF Yagi aerial, lashed to chimney or fixed to gable. RG6 coax to single TV point indoors. Tested with signal meter." },
      { name: "Aerial + 4-room distribution", price: 285, unit: "fixed", description: "Aerial + masthead amp + 4-way splitter + RG6 cable runs to 4 separate TV points. Each point tested." },
      { name: "Masthead amplifier install (existing aerial)", price: 95, unit: "fixed", description: "Add a powered masthead amp to a weak-signal aerial install. Powers via the indoor TV unit. Boosts marginal reception." },
      { name: "Sky Q / Stream dish install", price: 165, unit: "fixed", description: "Sky-spec dish (Quattro LNB) aligned and tested, cabled to Sky box. Includes wall fixings and weatherseal." },
      { name: "Starlink Gen 3 install (incl. mast)", price: 295, unit: "fixed", description: "Starlink dish wall or pole mount, cable run into property, powered up and registered. Customer supplies Starlink kit." },
      { name: "Signal survey + fault diagnosis", price: 75, unit: "fixed", description: "Spectrum analyser survey to diagnose poor reception, pixelation, picture loss. Includes fix plan and quote. Refunded if you book the work." }
    ],
    faq_items: [
      { q: "Why does my picture pixelate sometimes?", a: "Either signal too low (need a bigger aerial or amp), signal too high (yes, also a problem — needs an attenuator), or cable fault. The diagnosis takes 20 minutes with a meter. I won't guess." },
      { q: "Can you fit Starlink for me?", a: "Yes — you buy the kit from Starlink (about £350 for Gen 3), I do the install for £295. Most installs are a wall mount or short pole, cable in via a brick or window seal. Up and running same day." },
      { q: "Should I get a magic eye for distribution?", a: "If you want your Sky/Freeview remote to work from a second TV, yes. Costs about £20 and saves you walking downstairs. I'll wire it in as part of multi-room." },
      { q: "Loft aerial — does it work?", a: "Only in strong signal areas. Most of Swansea valleys need an external aerial — loft aerials lose 6-10dB through tiles which is enough to drop reception below threshold." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["CAI Registered Installer (Confederation of Aerial Industries)", "Working at Height", "Starlink Authorised Installer"],
    trade_memberships: ["CAI (Confederation of Aerial Industries)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 75,
    free_site_visits: true,
    quote_availability: "Usually quotes same day",
    quote_turnaround_hours: 12,
    current_status_note: "Booking within the week. Most aerial faults sorted in 1-2 days.",
    availability: "this_week",
    reviews: [
      { customer_name: "Rhys D.", rating: 5, title: "Fixed reception in a fringe area", body: "Lived with pixelated BBC1 for 3 years. Gareth surveyed, fitted a bigger Yagi and a masthead amp. Picture perfect, all channels.", service_name: "TV aerial install (UHF Yagi, single point)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/70.jpg" },
      { customer_name: "Eira J.", rating: 5, title: "Starlink up and running same day", body: "Rural cottage, no fibre. Gareth wall-mounted the Starlink dish, cabled in, registered the kit. Working in under 2 hours.", service_name: "Starlink Gen 3 install (incl. mast)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/71.jpg" },
      { customer_name: "Owen P.", rating: 5, title: "4 TVs all working", body: "Aerial + distribution to 4 rooms. Every point tested. Kids stopped fighting over the lounge TV.", service_name: "Aerial + 4-room distribution", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/72.jpg" }
    ]
  },

  // 15. GARDEN ROOM INSTALLER
  {
    trade_slug: "garden-room-installer",
    profile_slug: "demo-stephen-holloway-garden-room-installer-tunbridge-wells",
    display_name: "Stephen Holloway",
    trading_name: "Holloway Garden Rooms",
    city: "Tunbridge Wells",
    postcode_prefix: "TN4",
    whatsapp: "+44 7700 900315",
    email: "stephen@hollowaygardenrooms.co.uk",
    bio: "I came out of timber-frame house-building in 2019 to focus on garden rooms — the demand exploded during lockdown and never went down. We design and install fully insulated outdoor offices, gyms and studios across Kent, East Sussex and south London. Every build is timber-frame, SIPs-style insulation (U-value 0.18 W/m2K — better than building regs for new houses), triple-glazed and EPDM rubber roof. Most builds stay under 2.5m ridge height so they fall under permitted development (no planning permission needed) and under 30sqm so they don't need building regs as outbuildings. I do the base too — usually screw-pile foundations or ground beam, never raft slab if the site is sloped. Three-week install for a standard 5x3m office, including electrics by my NICEIC sparky.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "Garden office (3x4m, fully insulated)", price: 22500, unit: "from", description: "Timber-frame, SIPs-spec walls/roof, triple-glazed bi-fold, EPDM roof, plywood internal walls, LED lighting, 4x sockets, network point. Painted exterior cladding." },
      { name: "Garden office (4x5m, premium spec)", price: 32500, unit: "from", description: "Larger office with separate WC partition, kitchenette space, larger bi-folds, anthracite aluminium frames, oak interior." },
      { name: "Garden gym/studio (4x5m)", price: 28500, unit: "from", description: "Higher ceiling for kit, rubber sports floor, mirrored wall option, gym-ready sockets, ventilation." },
      { name: "Foundations only (screw piles or beam)", price: 4500, unit: "from", description: "Screw-pile foundations or concrete ground beam for customer-supplied garden room kit. Suits self-build or other supplier's pods." },
      { name: "Planning permission application", price: 850, unit: "fixed", description: "For builds over 2.5m ridge or in conservation areas. Drawings, application, council liaison. Approval typically 8 weeks." },
      { name: "Garden room electrics package", price: 2200, unit: "fixed", description: "NICEIC sparky lays SWA armoured cable from your consumer unit, installs sub-board, sockets, lighting, network. Includes building reg notification." }
    ],
    faq_items: [
      { q: "Do I need planning permission?", a: "Almost never if it's under 2.5m total height (flat or pent roof) and under 30sqm. Conservation areas and listed properties need approval — I'll check during survey. I quote with the planning-free build as default." },
      { q: "Will it be warm enough in winter?", a: "Yes — SIPs walls and triple glazing give a U-value of 0.18, which is better than building regs for new houses. A 500W panel heater will hold 21C in a 12sqm office through December." },
      { q: "Concrete base or screw piles?", a: "Screw piles for sloped or wet sites, ground beam for flat firm sites. I almost never pour a full raft slab — it's wasteful and creates drainage issues. Screw piles install in a day." },
      { q: "How long does install take?", a: "3 weeks for a standard 12sqm office: 1 week foundations + first fix, 1 week structure + roof, 1 week electrics, glazing and decoration." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["NVQ Level 3 Site Carpentry", "CSCS Manager Card", "Structural Timber Association (STA) Member"],
    trade_memberships: ["Structural Timber Association (STA)", "Federation of Master Builders (FMB)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 4500,
    free_site_visits: true,
    quote_availability: "Usually quotes within 5 days",
    quote_turnaround_hours: 120,
    current_status_note: "Booking 6-10 weeks ahead. Survey within 2 weeks.",
    availability: "later",
    reviews: [
      { customer_name: "Hannah V.", rating: 5, title: "Stunning garden office", body: "5x4m office at the bottom of our garden. Triple-glazed bi-fold opens onto a deck. Warm in winter, cool in summer. Stephen's build quality is exceptional.", service_name: "Garden office (4x5m, premium spec)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/73.jpg" },
      { customer_name: "Matthew K.", rating: 5, title: "Gym is brilliant", body: "Squat rack, dumbbells, mirror wall. Rubber floor takes the weight. Sound stays in the building — neighbours don't hear my deadlifts.", service_name: "Garden gym/studio (4x5m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/74.jpg" },
      { customer_name: "Sophie A.", rating: 5, title: "Sloped site, no drama", body: "Steep garden — other builders said we needed a raft. Stephen used screw piles, levelled in a day. Office sits perfectly.", service_name: "Foundations only (screw piles or beam)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/75.jpg" }
    ]
  },

  // 16. AWNING INSTALLER
  {
    trade_slug: "awning-installer",
    profile_slug: "demo-jordan-bellini-awning-installer-southampton",
    display_name: "Jordan Bellini",
    trading_name: "Bellini Awnings & Pergolas",
    city: "Southampton",
    postcode_prefix: "SO15",
    whatsapp: "+44 7700 900316",
    email: "jordan@belliniawnings.co.uk",
    bio: "I came out of marquee hire 10 years ago and moved into permanent outdoor shading — patio awnings, freestanding canopies and bioclimatic pergolas. We're approved installers for Weinor, Markilux and Renson (the three serious German/Belgian brands) plus we sub-fab Italian Pratic pergolas. Most of my work is motorised cassette awnings with wind and sun sensors that auto-retract when the wind hits 30mph — without sensors, a £4k awning gets ripped off the wall the first time you forget to roll it in. I survey wall fixings carefully — render over insulation needs through-fixings to brick, not just plugs. Free survey with 3D visualisation so you see exactly what it'll look like before you commit.",
    years_in_trade: 10,
    start_year: 2016,
    priced_services: [
      { name: "Motorised cassette awning (4m wide)", price: 2480, unit: "from", description: "Weinor or Markilux cassette awning, 4m wide, 3m projection. Sun + wind sensor, remote control, LED option. Through-bolt fix." },
      { name: "Motorised cassette awning (6m wide)", price: 3680, unit: "from", description: "Larger 6m cassette for wider patios, full motor + sensors, double-arm construction for added projection." },
      { name: "Bioclimatic pergola (3x4m, motorised louvres)", price: 8200, unit: "from", description: "Aluminium pergola with motorised tilting louvre roof — close for rain, tilt for sun. Renson or Pratic. Side blinds optional." },
      { name: "Freestanding canopy (3x3m, fixed roof)", price: 4800, unit: "from", description: "Aluminium freestanding canopy with glass or polycarbonate fixed roof. Suits anywhere there's no suitable wall to fix to." },
      { name: "Wind + sun sensor retrofit", price: 285, unit: "fixed", description: "Add automatic retract sensors to an existing motorised awning. Pays for itself the first windy day you forget." },
      { name: "Awning service + re-fabric", price: 380, unit: "from", description: "Service mechanism, replace tired fabric on existing cassette awning, re-tension arms. Most brands serviceable." }
    ],
    faq_items: [
      { q: "Why do I need wind sensors?", a: "An awning is a sail. At 30mph wind a 4m awning generates enough lift to rip through plugs and pull a chunk of render off your wall. Sensors auto-retract before that happens. £285 well spent on any motorised install." },
      { q: "Awning or pergola — which is better?", a: "Awning is cheaper, fits to your wall, retracts fully when not in use. Pergola is freestanding, has a louvred roof so it works in light rain, and feels more like a permanent outdoor room. Pergola is roughly 3x the awning cost." },
      { q: "Will it survive winter?", a: "Cassette awnings yes — they fully retract into a sealed housing. Pergolas with louvre roof yes — close the louvres in winter. Open frame pergolas with fabric tops need to come down for winter." },
      { q: "Can you fix to render?", a: "Only with through-bolts straight into brickwork behind the render. Plug-and-screw into render alone will pull out at the first gust. I'll always specify the fixing in writing during quote." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NVQ Level 2 Specialist Installation", "Working at Height (PASMA)", "Weinor Approved Installer", "Renson Outdoor Certified"],
    trade_memberships: ["Specialist Glazing Federation"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 380,
    free_site_visits: true,
    quote_availability: "Usually quotes within 5 days",
    quote_turnaround_hours: 120,
    current_status_note: "Survey within 2 weeks. Bespoke awning lead-time 4-6 weeks, pergolas 8-10 weeks.",
    availability: "later",
    reviews: [
      { customer_name: "Lara H.", rating: 5, title: "Pergola is a game-changer", body: "Renson bioclimatic 3x4m on the back terrace. Sit out in any weather — close the louvres for rain, tilt for sun. Best garden purchase we've made.", service_name: "Bioclimatic pergola (3x4m, motorised louvres)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/76.jpg" },
      { customer_name: "Andrew F.", rating: 5, title: "6m awning across the whole patio", body: "Markilux 6m cassette. Wind sensor saved it the first week — gust came through and it retracted automatically. Spec'd brilliantly.", service_name: "Motorised cassette awning (6m wide)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/77.jpg" },
      { customer_name: "Priscilla N.", rating: 5, title: "Saved our old awning", body: "Fabric was tired and arms had stretched. Jordan re-fabbed and re-tensioned for £450. Like new — saved us £2.5k on replacement.", service_name: "Awning service + re-fabric", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/78.jpg" }
    ]
  }
];
