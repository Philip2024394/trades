// Demo profile seeds for Xrated Trade Off — phase-2 "Hire additions".
//
// 10 hire businesses to extend /trade-off/trades coverage. Same shape as
// `demoTradeSeeds.ts`. Day rates anchored to UK 2026 hire-industry benchmarks.
// Phone numbers in the Ofcom-reserved fiction range +44 7700 900XXX.

import type { DemoTradeSeed } from "./demoTradeSeeds";

export const DEMO_TRADE_SEEDS_HIRE: DemoTradeSeed[] = [
  // 1. PLANT HIRE
  {
    trade_slug: "plant-hire",
    profile_slug: "demo-russell-haines-plant-hire-leeds",
    display_name: "Russell Haines",
    trading_name: "Haines Plant Hire",
    city: "Leeds",
    postcode_prefix: "LS11",
    whatsapp: "+44 7700 900211",
    email: "hire@hainesplant.co.uk",
    bio: "Family plant hire firm running across West Yorkshire since my dad started the yard in 1989. I took over the running of the business in 2010 and have grown the fleet from 12 machines to just under 90. We run JCB 3CX backhoes, Cat and Volvo wheeled excavators, Bomag rollers, JCB telehandlers up to 17m reach, and a mix of Thwaites and Terex dumpers from 1-tonne to 10-tonne. All hires are on CPA Model Conditions with proper LOLER and PUWER paperwork sent before delivery. We run our own low-loader fleet so on-hire and off-hire transport is in-house — no relying on a third-party haulier when your project slips a day. Most machines under 4 years old, full service schedule logged on TelematicsPlus, and a 24/7 breakdown line with a sub-4-hour response promise inside the M62 corridor. CHAS Premium and FORS Silver. We do daily, weekly and monthly hire — discounted block rates beyond 4 weeks.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "JCB 3CX backhoe loader (per day)", price: 245, unit: "per day", description: "Classic backhoe for groundworks and muck-shifting. Day rate dry hire — operator £180/day extra if needed. Inc transport within 25 miles of LS11." },
      { name: "JCB 3CX backhoe loader (per week)", price: 850, unit: "per week", description: "Weekly dry-hire rate. Includes delivery + collection within West Yorks. Block rate beyond 4 weeks." },
      { name: "13-tonne wheeled excavator (per week)", price: 1450, unit: "per week", description: "Volvo or Cat 13T wheeled 360, road-runnable, ideal for highway and utility work. Dry hire weekly." },
      { name: "17m telehandler (per day)", price: 285, unit: "per day", description: "JCB 540-170 telehandler, 4-tonne lift to 17m reach. LOLER cert supplied. Forks + bucket included." },
      { name: "9-tonne tracked dumper (per week)", price: 950, unit: "per week", description: "Thwaites swivel-tip 9T tracked dumper for muddy / soft-ground muckshift. Dry hire." },
      { name: "Single-drum vibrating roller (per week)", price: 380, unit: "per week", description: "Bomag BW213 single drum 13-tonne roller for sub-base compaction. Dry hire weekly rate." },
      { name: "Monthly block hire (3CX backhoe)", price: 2800, unit: "per month", description: "28-day block rate — saves roughly 18% versus rolling weekly. Includes 1 free service mid-hire if over 100 engine hours." }
    ],
    faq_items: [
      { q: "What contract terms do you hire under?", a: "CPA Model Conditions for Hiring of Plant — the industry standard. Hire schedule, terms and LOLER / PUWER paperwork go out with the order acknowledgement before the kit arrives. No surprise small print." },
      { q: "Do you do operator hire?", a: "Yes — CPCS Blue-card operators from a rota of 14 lads we've worked with for years. Operator rate is on top of the machine rate, typically £180-£240 per day depending on machine class." },
      { q: "How fast is breakdown response?", a: "Inside the M62 corridor we promise a fitter on site within 4 hours during working hours, with a swap-out machine following if it can't be fixed roadside. Outside that radius it's same-day. The 24/7 line is on the cab sticker." },
      { q: "Do you charge if I extend the hire?", a: "No rebooking fee — give us 24 hours' notice and we'll roll the hire on at the same rate or step you into a block-week rate if it makes sense. Off-hire is a phone call." }
    ],
    is_insured: true,
    insurance_cover_gbp: 10000000,
    qualifications: ["CPCS A58 360 Excavator above 10T", "CPCS A09 Forward Tipping Dumper", "CPCS A77 Telescopic Handler", "IOSH Managing Safely"],
    trade_memberships: ["Construction Plant-hire Association (CPA)", "CHAS Premium", "FORS Silver"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 245,
    free_site_visits: true,
    quote_availability: "Same-day quotes for fleet items",
    quote_turnaround_hours: 6,
    current_status_note: "Most fleet available on next-day delivery. Telehandlers and 13T excavators book 5-7 days ahead.",
    availability: "tomorrow",
    reviews: [
      { customer_name: "Daniel P.", rating: 5, title: "Delivered before 8am as promised", body: "Booked a 3CX for a Monday groundworks start. Low-loader was on site at 7:45am with the LOLER paperwork and a full tank. Couldn't fault them.", service_name: "JCB 3CX backhoe loader (per day)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/11.jpg" },
      { customer_name: "Marcus R.", rating: 5, title: "Breakdown sorted in 90 mins", body: "Hydraulic hose let go on the 13T mid-week. Phoned the breakdown line at 10am, fitter on site by 11:30 with the right hose. Swap machine offered if it wasn't a quick fix. Real plant hire service.", service_name: "13-tonne wheeled excavator (per week)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/14.jpg" },
      { customer_name: "Andrew T.", rating: 5, title: "Off-hire collection same day", body: "Finished a day early on the telehandler. Off-hired at 9am, low-loader picked up at 3pm — saved me a full day's hire charge. Most companies would have charged the day.", service_name: "17m telehandler (per day)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/17.jpg" }
    ]
  },

  // 2. SKIP HIRE
  {
    trade_slug: "skip-hire",
    profile_slug: "demo-lauren-pemberton-skip-hire-birmingham",
    display_name: "Lauren Pemberton",
    trading_name: "Pemberton Skip & Waste",
    city: "Birmingham",
    postcode_prefix: "B16",
    whatsapp: "+44 7700 900284",
    email: "office@pembertonskip.co.uk",
    bio: "Second-generation waste carrier. I came into the business from a logistics background in 2017 and now run it day-to-day for my dad, who started the yard in Smethwick in 1994. We hire skips from 4-yard mini up to 40-yard RoRo across Birmingham, Solihull and the Black Country. WCL Upper Tier waste carrier (Tier 1 for hazardous), Environment Agency registered transfer station, and we segregate everything that comes back to the yard — currently averaging 87% diversion from landfill, with full waste-transfer notes emailed within 48 hours. We don't do the 'cash, no questions' end of the trade — every load is weighed, ticketed and traced. Skip wagons run a tail-lift drop with steel rollers so we can place skips in tighter driveways than most. Permits for road placement we apply for on your behalf — Birmingham City Council 3 working days, surrounding councils typically 5. Asbestos-only skips available as a separate sealed service.",
    years_in_trade: 9,
    start_year: 2017,
    priced_services: [
      { name: "4-yard mini skip (per week)", price: 195, unit: "per week", description: "Builder's-bag-plus capacity. Ideal for kitchen / bathroom strip-outs. Inc delivery, collection, disposal. Driveway only — no road permit." },
      { name: "6-yard midi skip (per week)", price: 245, unit: "per week", description: "Most popular domestic size. Garden clearance, two-room refurb, garage clear-out. Inc delivery + tip fees." },
      { name: "8-yard builder's skip (per week)", price: 295, unit: "per week", description: "Standard builder's skip for medium renovations. Inc all disposal — no surprise tip charges on collection." },
      { name: "12-yard large skip (per week)", price: 395, unit: "per week", description: "Soft strip-out, light commercial, larger renovations. Lockable lid available on request. Inc disposal." },
      { name: "Road permit application", price: 65, unit: "per application", description: "We file the council permit on your behalf. Council fee passed at cost. 3-5 working days lead time. Required for any skip on the public highway." },
      { name: "Asbestos-only skip (sealed)", price: 485, unit: "per visit", description: "4-yard sealed skip for bonded asbestos waste (e.g. cement sheet, Artex). Hazardous WCL, double-bagged at source, sealed transit, licensed disposal." },
      { name: "Wait-and-load service (1 hour)", price: 185, unit: "per visit", description: "We drop the skip, wait 1 hour while you fill it, and take it away. No permit, no driveway needed. Great for kerbside strip-outs." }
    ],
    faq_items: [
      { q: "Do I need a road permit?", a: "Only if the skip is going on the public highway — pavement, road, verge. If it's on your driveway or private land, no. We apply on your behalf if needed and the council fee is at cost." },
      { q: "What can't I put in a skip?", a: "Asbestos, plasterboard mixed with general waste, paint, oil, batteries, electricals (WEEE), tyres, and fridges. Plasterboard only needs to be a separate skip. Asbestos has its own sealed-skip product. We'll talk you through it before delivery." },
      { q: "Will it damage my driveway?", a: "We carry timber bearers and lay them under the skip feet on block paving and tarmac. Concrete is fine without. We've placed thousands of skips and don't have a record of damage — but the bearers are your guarantee." },
      { q: "What happens to the waste?", a: "Every load comes back to our Smethwick transfer station, gets weighed, picked over and segregated into wood, metal, hardcore, plasterboard, mixed and general. Currently 87% of incoming waste is diverted from landfill. We email the waste transfer note within 48 hours." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Upper Tier Waste Carrier Licence", "Tier 1 Hazardous Waste Carrier", "Environment Agency Permit-Holder (Transfer Station)", "WAMITAB Operator Competence"],
    trade_memberships: ["Chartered Institution of Wastes Management (CIWM)", "Environmental Services Association (ESA)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 195,
    free_site_visits: false,
    quote_availability: "Same-day quotes",
    quote_turnaround_hours: 4,
    current_status_note: "Most skip sizes next-day delivery. Asbestos skips 48-hour lead time.",
    availability: "tomorrow",
    reviews: [
      { customer_name: "Priya S.", rating: 5, title: "Permit sorted, no headache", body: "Lauren's team filed our road permit and dropped the 8-yarder the morning it came through. Easiest skip hire I've done — they did all the council paperwork.", service_name: "Road permit application", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/20.jpg" },
      { customer_name: "Christopher W.", rating: 5, title: "Off-hire collection same day", body: "Filled the skip Friday morning, phoned for collection at 10am, gone by 2pm. Saved me a weekend of looking at a full skip on the drive.", service_name: "12-yard large skip (per week)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/23.jpg" },
      { customer_name: "Sophie N.", rating: 5, title: "Wait-and-load saved my back", body: "No driveway space, no permit, no time. Wait-and-load was perfect — they dropped, we filled, they took. Whole job done in 50 minutes.", service_name: "Wait-and-load service (1 hour)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/26.jpg" }
    ]
  },

  // 3. PORTALOO HIRE
  {
    trade_slug: "portaloo-hire",
    profile_slug: "demo-natalie-harrop-portaloo-hire-bristol",
    display_name: "Natalie Harrop",
    trading_name: "Harrop Site Welfare",
    city: "Bristol",
    postcode_prefix: "BS5",
    whatsapp: "+44 7700 900356",
    email: "hire@harropwelfare.co.uk",
    bio: "I ran event logistics for a Bristol-based festival production company for nine years before setting up Harrop Site Welfare in 2019. We split roughly 60/40 between construction site welfare and events — weddings, festivals, country shows, sporting events. Fleet covers single chemical portaloos, recirc eco-loos with hand-wash basins, accessible Mobiloo-style units, ladies' VIP trailers, and full welfare cabins with canteen, drying room and WC for site setups. Every chemical unit on construction hire is recharged weekly — fresh water in, waste out, blue chemical and consumables topped up — included in the weekly rate, not bolted on. Event hire is bespoke quoted: we'll visit site, walk attendance numbers with you, advise on units-per-head ratios, and write a service rota with you. Driver CPC compliant, all vacuum tankers run by us not subbed, and we hold Tier 2 waste carrier for the sewage uplift. We don't dump — every load goes to a licensed Wessex Water reception point with ticket evidence.",
    years_in_trade: 7,
    start_year: 2019,
    priced_services: [
      { name: "Single chemical portaloo (per week, construction)", price: 22, unit: "per week", description: "Standard blue chemical portaloo. Weekly hire on construction sites includes one service per week (waste out, fresh chemical, consumables). Min 4 weeks." },
      { name: "Eco recirc portaloo with handwash (per week)", price: 38, unit: "per week", description: "Step-up unit with recirculating flush + integrated sink. CDM-friendly. Weekly service inc." },
      { name: "Accessible / mobility portaloo (per week)", price: 65, unit: "per week", description: "Wheelchair-accessible Mobiloo-spec unit with rails and turning circle. Inclusive welfare. Weekly service inc." },
      { name: "Welfare cabin (canteen + WC + drying)", price: 145, unit: "per week", description: "Full site welfare cabin: 8-seat canteen, kettle / microwave point, dry room with lockers, separate WC compartment. Generator-ready or mains. Weekly service inc." },
      { name: "Event hire — single chemical portaloo (per day)", price: 75, unit: "per visit", description: "Weekend / single-day event hire including delivery, full service overnight if 2-day event, and removal. Min 4 units on event bookings." },
      { name: "VIP ladies trailer (event, per day)", price: 485, unit: "per visit", description: "Trailer-mounted ladies' loo block with mirrors, lit vanity, premium fit. Wedding / corporate spec. Day rate including delivery + jacking + dejacking." },
      { name: "Additional service visit (between weekly)", price: 45, unit: "per visit", description: "Extra mid-week recharge for high-use units. Tanker visit, full waste out, consumables. Usually arranged with 24h notice." }
    ],
    faq_items: [
      { q: "How many portaloos do I need on site?", a: "CDM 2015 guidance is 1 per 7 workers minimum, plus handwash. We always recommend going one over that — Friday afternoon queues kill morale. For events the maths is different — 1:75 for under-4-hour events, 1:50 for full day. We'll work it with you on a site visit." },
      { q: "What's included in the weekly service?", a: "Every chemical unit gets a weekly vacuum out, fresh blue chemical, fresh water, loo roll, hand sanitiser, and a deep wipe-down. Tanker turn-up is logged on a service ticket. No 'pay extra to service it' games." },
      { q: "Do you do same-day delivery?", a: "Within Greater Bristol yes, usually. Outside that — Bath, Newport, Gloucester — we like 24 hours' notice. Events we always plan ahead with you." },
      { q: "Where does the waste actually go?", a: "Wessex Water sewage reception at Saltford or Avonmouth, depending on which tanker is closest. Tier 2 carrier ticket evidence on every load. We don't field-dump and we don't sub the tankering." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Tier 2 Waste Carrier Licence", "Driver CPC (HGV vacuum tanker)", "ADR Tanker Endorsement", "CDM 2015 Awareness"],
    trade_memberships: ["Portable Sanitation Europe (PSE)", "British Toilet Association"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 88,
    free_site_visits: true,
    quote_availability: "Same-day for stock units, 48 hours for events",
    quote_turnaround_hours: 24,
    current_status_note: "Construction hire next-day. Events for summer 2026 — book 6-8 weeks ahead.",
    availability: "tomorrow",
    reviews: [
      { customer_name: "Stephen B.", rating: 5, title: "Welfare cabin saved our site", body: "Set up a site office build in February — without Natalie's welfare cabin the lads would have walked. Heated, dry, kettle worked first time. Serviced every Wednesday like clockwork.", service_name: "Welfare cabin (canteen + WC + drying)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/29.jpg" },
      { customer_name: "Emma L.", rating: 5, title: "VIP trailer was beautiful", body: "Hired the ladies' trailer for our wedding marquee. Genuinely felt high-end — proper mirrors, lit vanity, spotless. Guests took photos in there. Natalie even did a pre-event walkthrough.", service_name: "VIP ladies trailer (event, per day)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/32.jpg" },
      { customer_name: "Mark T.", rating: 5, title: "Mid-week service no problem", body: "Friday lunch I realised the loo was at capacity. Natalie's tanker came out Saturday morning. No fuss, just sorted it. That's hire-firm service.", service_name: "Additional service visit (between weekly)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/35.jpg" }
    ]
  },

  // 4. SCAFFOLDING HIRE
  {
    trade_slug: "scaffolding-hire",
    profile_slug: "demo-rachel-faulkner-scaffolding-hire-manchester",
    display_name: "Rachel Faulkner",
    trading_name: "Faulkner Scaffold Services",
    city: "Manchester",
    postcode_prefix: "M19",
    whatsapp: "+44 7700 900421",
    email: "office@faulknerscaffold.co.uk",
    bio: "My dad ran Faulkner Scaffold from a Levenshulme yard for 30 years; I took over the office side in 2015 after a decade in commercial property management, and we promoted our long-standing yard manager to operations. We're a hire-and-erect business — every job includes design, erect, dismantle, off-hire collection back to the yard. We don't do dry-hire of scaff to people unfamiliar with the kit; it's a NASC standard we hold to. System scaff is Layher Allround across the fleet, BS EN 12810 compliant, with full handovers, scaff tags, and weekly inspections on long hires. Crews are all CISRS-carded — Part 2 for advanced and supervisors. Most weeks we'll have 6-8 jobs running across Greater Manchester from chimney access on a terrace through to full elevation wraps on a small commercial. NASC member since the yard started; full Audit Plus accreditation re-issued every year. Public liability £10m, employer's £10m, and full design + calc available for unusual loadings.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Chimney access scaff (per week)", price: 285, unit: "per week", description: "Single chimney working platform, erect + dismantle inc. Min 1 week hire — typical chimney repair runs 1-2 weeks. Inc design + handover + scaff tag." },
      { name: "Standard rear elevation (semi, per week)", price: 425, unit: "per week", description: "Two-lift rear scaffold to gutter height on a typical 3-bed semi. Erect + dismantle inc. For roof, render, soffit work. Inc weekly inspection." },
      { name: "Full elevation wrap (detached house)", price: 1450, unit: "per week", description: "Three-elevation wrap with stair tower and edge protection for full re-roof or full external render. Inc design, calcs, weekly inspection." },
      { name: "Birdcage internal scaffold (per week)", price: 685, unit: "per week", description: "Independent birdcage for ceiling work — large halls, churches, commercial spaces. Inc design, erect, dismantle. From 5x5m up to 10x10m." },
      { name: "Pavement gantry / hoarding (per week)", price: 485, unit: "per week", description: "Public footpath gantry with overhead protection for occupied frontages. NASC TG20:21 compliant. Council notification handled." },
      { name: "Emergency / dangerous structure scaff (callout)", price: 1850, unit: "from", description: "Same-day or overnight erect for storm damage, leaning walls, fire damage. Out-of-hours rate. Hire weekly after first 48h at standard rate." },
      { name: "Block hire discount (4+ weeks)", price: 350, unit: "per week", description: "Standard rear elevation block rate beyond 4 weeks. Roughly 18% off standard weekly. For long renovations or render-cure dwell." }
    ],
    faq_items: [
      { q: "Do you do dry-hire of scaffold kit?", a: "No. NASC member firms don't dry-hire to non-cardholders and we wouldn't anyway — it's how people get hurt. Every hire includes erect + dismantle by our CISRS-carded crews." },
      { q: "How quickly can you get it up?", a: "Standard rear elevation we'll usually have up within 5 working days of order. Chimney scaff often 2-3 days. Emergency work — storm damage, dangerous walls — we'll mobilise same day with the on-call crew." },
      { q: "What standard do you build to?", a: "BS EN 12810 / 12811 for system scaffolds (Layher Allround), and NASC TG20:21 / SG4:22 for tube-and-fitting. Every scaffold gets a handover certificate and a scaff tag. Long hires get a documented weekly inspection." },
      { q: "Will you take responsibility for design?", a: "Yes — every scaffold over standard config gets a design and load calculation from our in-house engineer, signed off before erect. No 'we'll figure it out on the job' — that's where collapses come from." }
    ],
    is_insured: true,
    insurance_cover_gbp: 10000000,
    qualifications: ["CISRS Contracts Manager Card", "NASC Audit Plus Accredited", "CITB SMSTS Site Manager", "TG20:21 Trained"],
    trade_memberships: ["National Access & Scaffolding Confederation (NASC)", "CHAS Accredited", "Construction Industry Scaffolders Record Scheme (CISRS)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 285,
    free_site_visits: true,
    quote_availability: "Survey within 48 hours, written quote within 5 working days",
    quote_turnaround_hours: 48,
    current_status_note: "Erect lead time 5-7 working days. Emergency same-day available with on-call crew.",
    availability: "this_week",
    reviews: [
      { customer_name: "Helen W.", rating: 5, title: "Up the day they said", body: "Booked Monday, on site Friday morning by 8am as promised. Roofer started Saturday. Rachel's office team kept us posted every step.", service_name: "Standard rear elevation (semi, per week)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/38.jpg" },
      { customer_name: "Jonathan F.", rating: 5, title: "Emergency wall after storm", body: "Storm tore a chunk of brickwork off the gable. Phoned Rachel at 7pm Tuesday — crew on site 10am Wednesday, scaff up by 4pm. Saved the whole wall.", service_name: "Emergency / dangerous structure scaff (callout)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/41.jpg" },
      { customer_name: "Patricia M.", rating: 5, title: "Extended the hire no rebooking", body: "Render job ran 3 weeks over expected. Phoned to extend — Rachel rolled us straight into block-hire rate and saved us money. No rebooking fee or fuss.", service_name: "Block hire discount (4+ weeks)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/44.jpg" }
    ]
  },

  // 5. GENERATOR HIRE
  {
    trade_slug: "generator-hire",
    profile_slug: "demo-andrew-northcott-generator-hire-london",
    display_name: "Andrew Northcott",
    trading_name: "Northcott Power Hire",
    city: "London",
    postcode_prefix: "E15",
    whatsapp: "+44 7700 900487",
    email: "hire@northcottpower.co.uk",
    bio: "Specialist power hire across Greater London and the South-East. I came out of a 12-year career at a major plant hire group in 2018 and set up Northcott Power Hire with two engineers I'd worked alongside for years. Fleet runs from 6kVA towable silent-pack gensets for small site or film-location work, up through 60kVA, 100kVA, 200kVA, and 500kVA cabinet units for full site mains backup or temporary power on commercial projects. Every unit is Stage V emissions compliant — non-negotiable for Central London ULEZ / NRMM Low Emission Zone work — and the larger units are bunded for fuel-spill containment. We also run a small fleet of inverter-and-battery EV-spec hybrid units for film and event work where noise rules are tight. Fuel is included in the day rate up to a documented consumption baseline; thereafter we re-fuel at cost + £15 visit fee. Engineers are 17th Edition + G99 grid-tie trained, so we can offer parallel-with-mains where it's appropriate. CHAS Premium and FORS Gold.",
    years_in_trade: 8,
    start_year: 2018,
    priced_services: [
      { name: "6kVA towable silent genset (per day)", price: 75, unit: "per day", description: "Small silent-pack diesel genset, ideal for film locations, small construction, market traders. Inc fuel for 8-hour run. Stage V compliant." },
      { name: "20kVA towable genset (per week)", price: 385, unit: "per week", description: "Mid-size site genset for small-medium construction. Inc 200L fuel base allocation. Re-fuelling at cost." },
      { name: "60kVA silent diesel (per week)", price: 685, unit: "per week", description: "Cabinet unit for medium commercial sites or larger residential builds. Inc 400L fuel base. Bunded. Stage V." },
      { name: "100kVA silent diesel (per week)", price: 1185, unit: "per week", description: "Commercial site backup or temp power. Bunded fuel tank. Inc 600L base allocation." },
      { name: "200kVA cabinet (per week)", price: 1850, unit: "per week", description: "Larger commercial / temp mains. Stage V emissions, ULEZ / NRMM LEZ compliant. Inc 800L base fuel." },
      { name: "500kVA mains backup (per week)", price: 3450, unit: "per week", description: "Large cabinet genset for full site temp power or commercial mains backup. Engineer commissioning inc. Bunded." },
      { name: "Inverter + battery hybrid (film / event)", price: 285, unit: "per day", description: "Silent battery/inverter unit for noise-sensitive locations. 10kW continuous, 20kW peak. Diesel top-up only at night." },
      { name: "Re-fuel visit", price: 145, unit: "per visit", description: "Engineer to site with bowser to re-fuel beyond base allocation. Fuel charged at pump cost. Visit fee inc 20 miles travel." }
    ],
    faq_items: [
      { q: "Are the gensets Stage V emissions compliant?", a: "Yes — every unit in the fleet, including the small 6kVA towables. NRMM Low Emission Zone work in Central London requires it and we don't run anything that doesn't meet the standard. Compliance certs sent with the on-hire paperwork." },
      { q: "Is fuel included?", a: "Yes — every hire has a documented base allocation that covers typical site usage. Re-fuels beyond that are at pump cost plus a £145 visit fee. We meter consumption with a flow sensor on bigger sets so there are no arguments." },
      { q: "Can you parallel with mains?", a: "Yes on units 60kVA and up — we hold G99 grid-tie clearance and our engineers are 17th Edition + G99 trained. Useful for temporary backup or augmentation without mains interruption." },
      { q: "What about night-noise restrictions?", a: "All diesel units are silent-pack (typically 65-70dB at 7m). For tighter noise rules — film, residential events — our inverter-battery hybrids are near-silent. We'll spec on site visit." }
    ],
    is_insured: true,
    insurance_cover_gbp: 10000000,
    qualifications: ["City & Guilds 18th Edition", "G99 Grid-Tie Installer", "ADR Fuel Tanker Endorsement", "IPAF MEWP"],
    trade_memberships: ["Construction Plant-hire Association (CPA)", "CHAS Premium", "FORS Gold"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 75,
    free_site_visits: true,
    quote_availability: "Same-day quotes for stock units",
    quote_turnaround_hours: 6,
    current_status_note: "Stock units next-day. 200kVA+ book 3-5 days ahead. Stage V certs sent with quote.",
    availability: "tomorrow",
    reviews: [
      { customer_name: "Oliver D.", rating: 5, title: "Delivered before 8am as promised", body: "Film shoot in Hackney, needed silent inverter on set by 7am. Andrew's lad was unloading at 6:45. No drama, ran clean all day.", service_name: "Inverter + battery hybrid (film / event)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/47.jpg" },
      { customer_name: "Benjamin K.", rating: 5, title: "Stage V cert sorted ULEZ", body: "Central London job needed NRMM LEZ compliance for council. Andrew sent the Stage V paperwork with the quote — saved me a week of chasing. Genset was bunded and spotless.", service_name: "100kVA silent diesel (per week)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/50.jpg" },
      { customer_name: "Nicholas P.", rating: 5, title: "Engineer was sharp", body: "60kVA went into parallel with our mains for a temporary upgrade. Andrew's engineer knew the G99 paperwork inside out, commissioned in an hour, ran for 3 weeks without a hiccup.", service_name: "60kVA silent diesel (per week)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/53.jpg" }
    ]
  },

  // 6. VAN HIRE
  {
    trade_slug: "van-hire",
    profile_slug: "demo-kevin-mcallister-van-hire-glasgow",
    display_name: "Kevin McAllister",
    trading_name: "McAllister Van Hire",
    city: "Glasgow",
    postcode_prefix: "G41",
    whatsapp: "+44 7700 900542",
    email: "bookings@mcallistervanhire.co.uk",
    bio: "Independent van hire firm covering Glasgow, Paisley and the central belt since 2013. Fleet of 38 vehicles — every van under 12 months old, replaced on a 12-month cycle so customers never get a tired motor. We run Transit Customs (SWB / LWB), Transit Jumbos, Sprinters, Lutons with tail-lift, plus a handful of double-cab tippers for the trades. Every vehicle on full telematics for our peace of mind (and yours — proves you weren't speeding if there's a dispute). Fuel deposit included in the day rate (return same fuel level, no top-up charge). Trade accounts available — 30-day terms after credit check, dedicated account manager, repeat-customer discount. We accept credit and debit cards plus open account; no 'cash discount' nonsense. Insurance is fully comp included up to £2k excess, with excess waiver bolt-on at £15/day. UK and Northern Ireland use included as standard — Europe needs 5 working days notice for the green-card paperwork.",
    years_in_trade: 13,
    start_year: 2013,
    priced_services: [
      { name: "Transit Custom SWB (per day)", price: 65, unit: "per day", description: "Short-wheelbase Transit, ideal for house moves and trade runs. 100 miles inc, 0.18p/mile thereafter. Fuel deposit inc." },
      { name: "Transit Custom LWB (per day)", price: 75, unit: "per day", description: "Long-wheelbase Transit for bigger loads. 100 miles inc. Fuel deposit inc. Telematics fitted." },
      { name: "Transit Jumbo (per day)", price: 95, unit: "per day", description: "Largest panel van — small house move, big trade delivery. 100 miles inc. Full fuel deposit inc." },
      { name: "Sprinter LWB (per day)", price: 105, unit: "per day", description: "Mercedes Sprinter LWB for longer items. 100 miles inc. Tracker fitted." },
      { name: "Luton box van with tail-lift (per day)", price: 135, unit: "per day", description: "Box body with tail-lift — proper house move spec. 100 miles inc. Tail-lift load test before every hire." },
      { name: "Weekly hire — Transit Custom LWB", price: 385, unit: "per week", description: "7-day rate. 700 miles inc. Trade-customer block-discount available on 4+ weeks." },
      { name: "Excess waiver (per day)", price: 15, unit: "per day", description: "Reduces insurance excess from £2k to £150. Optional. Available on every vehicle." },
      { name: "Double-cab tipper (per day)", price: 145, unit: "per day", description: "Trade-spec 5-seat double-cab tipper for landscapers and builders. 100 miles inc. Telematics fitted." }
    ],
    faq_items: [
      { q: "What insurance comes included?", a: "Fully comp with £2k excess on every van, included in the rate. Excess waiver available at £15/day brings excess to £150. UK and Northern Ireland use included; Europe needs the green card paperwork — 5 working days notice." },
      { q: "Do I need to refuel before returning?", a: "Yes — same fuel level as collection. Fuel deposit is included in the rate but if you bring it back light we charge the diff at pump cost plus a £15 admin fee. No surprise fuel surcharges otherwise." },
      { q: "Can I open a trade account?", a: "Yes — quick credit check, 30-day terms, repeat-hire discount and a dedicated account manager. Useful if you're hiring 4+ times a year." },
      { q: "What if I damage the van?", a: "Photograph everything on collection — we do too with a walk-around video on every off-hire. Standard wear-and-tear no charge. Negligent damage you pay excess (or waiver excess if you took the bolt-on)." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Operator's Licence (Standard National)", "Driver CPC", "Transport Manager CPC"],
    trade_memberships: ["British Vehicle Rental & Leasing Association (BVRLA)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 65,
    free_site_visits: false,
    quote_availability: "Instant quotes on stock vehicles",
    quote_turnaround_hours: 2,
    current_status_note: "Most vehicles available same-day. Lutons book 2-3 days ahead on weekends.",
    availability: "now",
    reviews: [
      { customer_name: "Stuart F.", rating: 5, title: "Van under 6 months old", body: "Booked a Transit LWB for a house move. Was 5,800 miles on the clock, immaculate inside, infotainment up to date. Felt like driving my own car not a hire heap.", service_name: "Transit Custom LWB (per day)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/56.jpg" },
      { customer_name: "Gordon R.", rating: 5, title: "Tail-lift saved the move", body: "Sofa, wardrobe, fridge — would not have been possible without the tail-lift. Kevin's team showed me how to use it, did the load test in front of me. Smooth move.", service_name: "Luton box van with tail-lift (per day)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/59.jpg" },
      { customer_name: "Iain M.", rating: 5, title: "Trade account is brilliant", body: "Hire 8-10 times a year. The account terms and the priority booking make a real difference. Account manager actually picks the phone up.", service_name: "Weekly hire — Transit Custom LWB", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/62.jpg" }
    ]
  },

  // 7. CRANE HIRE
  {
    trade_slug: "crane-hire",
    profile_slug: "demo-paul-saltburn-crane-hire-liverpool",
    display_name: "Paul Saltburn",
    trading_name: "Saltburn Crane Hire",
    city: "Liverpool",
    postcode_prefix: "L20",
    whatsapp: "+44 7700 900618",
    email: "lifts@saltburncrane.co.uk",
    bio: "Mobile crane hire across Merseyside, Cheshire, North Wales and the Wirral. We've been on the same yard in Bootle for 22 years — I bought the business from the original founder in 2014 after a decade as his lift planner. Fleet: 30T Liebherr LTM 1030, 50T Liebherr LTM 1050, 80T Liebherr LTM 1080, two 100T Tadanos, and a 150T LTM 1150. Every operator CPCS Blue card minimum, every appointed person and slinger-signaller carded, and every lift over routine spec gets a written lift plan signed off by our in-house Appointed Person before the crane leaves the yard. We offer both contract lift (we take responsibility for the lift, our insurance covers the load) and standard hire (you provide the AP and slingers). For one-off or unfamiliar customers we strongly steer to contract lift — it's where you want the responsibility to sit. CPA Best Practice Guide adherence on every job. Public liability £15m, plus indemnity insurance £10m on contract lifts. We run our own low-loaders for road moves.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "30T mobile crane (contract lift, half day)", price: 1450, unit: "per visit", description: "30T Liebherr with operator, AP, slinger-signaller, lift plan and insurance. Up to 4 hours on site. Inc transport within 25 miles." },
      { name: "30T mobile crane (full day contract lift)", price: 2250, unit: "per visit", description: "Full-day contract lift, 30T LTM 1030. Inc operator, AP, slinger, lift plan, insurance, transport." },
      { name: "50T mobile crane (full day contract lift)", price: 2950, unit: "per visit", description: "50T LTM 1050 contract lift. Inc full crew, plan, insurance. Suitable for steel beams, AC condensers, modular pods." },
      { name: "80T mobile crane (full day contract lift)", price: 3850, unit: "per visit", description: "80T LTM 1080 contract lift. Inc full crew, lift plan, insurance. For larger steel and high-reach lifts." },
      { name: "100T mobile crane (full day contract lift)", price: 4850, unit: "per visit", description: "100T Tadano contract lift. Inc crew + plan + insurance. Industrial / large-frame work." },
      { name: "150T mobile crane (full day, contract)", price: 7250, unit: "per visit", description: "150T LTM 1150 — large-frame, wind nacelle, deep reach lifts. Full contract lift package." },
      { name: "Standard hire (crane + operator only, per day)", price: 1850, unit: "per day", description: "30T crane with operator — customer provides Appointed Person, slinger and lift plan. For experienced contractors only." }
    ],
    faq_items: [
      { q: "What's the difference between contract lift and standard hire?", a: "Contract lift — we take responsibility for the entire lift, our Appointed Person writes and signs the lift plan, our slinger-signaller is on site, our insurance covers the load while it's airborne. Standard hire — we provide the crane and operator only; you bring the AP, slingers and the lift-plan responsibility. CPA Best Practice strongly recommends contract lift unless you're a regular construction client." },
      { q: "How much site space do you need?", a: "30T crane outrigger footprint is about 6x6m on full outriggers; 100T is 9x9m. We always do a site survey first — access route, overhead lines, ground bearing, swing radius — and put it all in the lift plan. We don't quote properly without a visit." },
      { q: "Do you need planning to bring a crane in?", a: "Normally no for an in-and-out lift, but if road closure is needed we apply through the local highways authority — 3-6 weeks lead time depending on council. We handle it all on your behalf." },
      { q: "What insurance do you carry?", a: "£15m public liability, £10m indemnity on contract lifts (covers the load while airborne under our AP's plan). Cert sent with quote acknowledgement, always before the crane leaves the yard." }
    ],
    is_insured: true,
    insurance_cover_gbp: 15000000,
    qualifications: [
      "CPCS A62 Mobile Crane up to 100T",
      "CPCS A40 Appointed Person",
      "CPCS A39 Slinger / Signaller",
      "CITB SMSTS Site Manager"
    ],
    trade_memberships: ["Construction Plant-hire Association (CPA)", "CPA Crane Interest Group", "CHAS Premium"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 1450,
    free_site_visits: true,
    quote_availability: "Site survey within 5 working days, written quote with lift plan",
    quote_turnaround_hours: 72,
    current_status_note: "30T and 50T usually 1-2 weeks out. 100T+ booking 3-4 weeks for site survey and lift plan.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Liam G.", rating: 5, title: "Lift plan was meticulous", body: "Steel frame lift on a tight city centre site. Paul's AP did a proper survey, the lift plan covered every overhead and exclusion zone, the day itself went like clockwork. Worth contract-lift premium 10x over.", service_name: "50T mobile crane (full day contract lift)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/65.jpg" },
      { customer_name: "Geoffrey W.", rating: 5, title: "Operator was sharp, knew the kit", body: "30T half-day for AC condensers onto a roof. The operator placed every unit within an inch of the marked position — the M&E guys could just bolt down. No drama, no broken cladding.", service_name: "30T mobile crane (contract lift, half day)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/68.jpg" },
      { customer_name: "Michael H.", rating: 5, title: "Saved a day by going contract lift", body: "Originally booked standard hire. Paul talked me into contract lift — said the responsibility wasn't somewhere I wanted it. He was right. AP caught a ground-bearing issue I'd missed, fixed before lift day.", service_name: "30T mobile crane (full day contract lift)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/71.jpg" }
    ]
  },

  // 8. WASTE REMOVAL
  {
    trade_slug: "waste-removal",
    profile_slug: "demo-darren-okonkwo-waste-removal-nottingham",
    display_name: "Darren Okonkwo",
    trading_name: "Okonkwo Waste & Grab",
    city: "Nottingham",
    postcode_prefix: "NG7",
    whatsapp: "+44 7700 900673",
    email: "office@okonkwowaste.co.uk",
    bio: "Grab hire, muck-away and tipper hire across Nottinghamshire and Derbyshire. Started with one second-hand 8-wheel tipper in 2011, now run a fleet of 7 grab lorries (18T and 30T 8-wheel grabs), 4 muck-away 8-wheel tippers, and a small fleet of double-cab tippers for smaller domestic clearances. Tier 1 Upper Tier waste carrier including hazardous, registered Environment Agency transfer station at the Eastwood yard. Big focus on segregation — we sort hardcore for recycle into MOT type 1, soil for soil-improver supply, mixed for energy-from-waste, and bonded asbestos handled via a sealed-skip service. All loads weighed on the weighbridge and ticketed, waste transfer notes emailed within 24 hours. NRMM Stage V on the tipper fleet for any London or Birmingham work where it's needed. We hold dust suppression spec — water bowsers and tarp covers on every load — for sites with air-quality conditions. Driver CPC and FORS Silver across the fleet.",
    years_in_trade: 15,
    start_year: 2011,
    priced_services: [
      { name: "18T grab hire (per load)", price: 320, unit: "per visit", description: "18-tonne 8-wheel grab lorry for muckshift, demolition spoil, hardcore. Inc disposal, weighbridge ticket, transfer note. Within 20 miles of NG7." },
      { name: "30T grab hire (per load)", price: 485, unit: "per visit", description: "30-tonne 8-wheel grab for larger sites. Inc transport, tip fees, paperwork. Within 25 miles." },
      { name: "8-wheel tipper muck-away (per load)", price: 285, unit: "per visit", description: "Spoil away by tipper — for sites without grab access. Inc tip fees, weighbridge ticket, WTN." },
      { name: "Segregated hardcore disposal (per load)", price: 235, unit: "per visit", description: "Clean hardcore-only load — recycled into MOT type 1. Reduced rate for clean material, no contamination tolerance." },
      { name: "Mixed muck-away (per load)", price: 345, unit: "per visit", description: "Mixed soil and hardcore. Sorted at the Eastwood transfer station. Standard tipper load." },
      { name: "Hazardous-bonded asbestos (sealed)", price: 685, unit: "per visit", description: "Tier 1 hazardous WCL bonded asbestos disposal. Sealed sealed-skip transit, licensed deep-bury disposal." },
      { name: "Dust suppression / tarp cover load", price: 45, unit: "per visit", description: "Additional charge for dust-controlled sites — bowser water suppression on loading, double tarp cover for transit. Required on most central-city sites." }
    ],
    faq_items: [
      { q: "What's the difference between grab and tipper?", a: "Grab is a tipper with a hydraulic clamshell on a knuckle-boom — it loads itself. Useful if you don't have an excavator on site or access is too tight for one. Tipper is dumber and cheaper but needs you to load it. Both 8-wheel, both 18-20 cubic yard." },
      { q: "Can I just put anything in?", a: "Hardcore-only load gets a recycle rate — and we mean clean: no soil, no wood, no plasterboard. Mixed muck gets the mixed rate. Asbestos is sealed-skip only, separate booking. We always send a what-you-can-tip card with the order ack." },
      { q: "How do I know it gets disposed properly?", a: "Every load comes back to our Eastwood transfer station, gets weighed and ticketed. Waste transfer note emailed within 24 hours. We hold Tier 1 hazardous WCL and EA permit — you can verify both on the public registers using our reg numbers on the WTN." },
      { q: "Do you do Stage V emission compliance?", a: "Our newer tippers and grabs are Stage V — essential for any Central London or Birmingham CAZ work. We confirm Stage V availability on the quote acknowledgement; older fleet still road-runs but is allocated for non-restricted work." }
    ],
    is_insured: true,
    insurance_cover_gbp: 10000000,
    qualifications: ["Upper Tier Waste Carrier (Tier 1 Hazardous)", "Environment Agency Permit (Transfer Station)", "Driver CPC", "WAMITAB Operator Competence"],
    trade_memberships: ["Chartered Institution of Wastes Management (CIWM)", "FORS Silver", "CHAS Accredited"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 235,
    free_site_visits: false,
    quote_availability: "Same-day quotes",
    quote_turnaround_hours: 6,
    current_status_note: "Most loads next-day. Asbestos sealed-skip 48-72 hour lead time.",
    availability: "tomorrow",
    reviews: [
      { customer_name: "Wayne C.", rating: 5, title: "Grab turned up on time", body: "30T grab for a foundations dig-out. Booked 24 hours ahead, on site at 9am as promised. Cleared 25 tonnes in 40 minutes. Tipper ticket and WTN landed in my inbox before he was back at the yard.", service_name: "30T grab hire (per load)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/74.jpg" },
      { customer_name: "Brendan O.", rating: 5, title: "Sealed-skip asbestos sorted", body: "Old garage roof — cement asbestos sheets. Darren's team supplied the sealed skip, double-bagged, hazmat ticket. Whole process documented. Couldn't have done it any other way legally.", service_name: "Hazardous-bonded asbestos (sealed)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/77.jpg" },
      { customer_name: "Tony H.", rating: 5, title: "Clean rate saved a fortune", body: "Driveway dig out — clean hardcore only. Darren coached me on what counted as 'clean' before delivery. Saved nearly £100 on tip fees because the load qualified for recycle.", service_name: "Segregated hardcore disposal (per load)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/80.jpg" }
    ]
  },

  // 9. MINI DIGGER HIRE
  {
    trade_slug: "minidigger-hire",
    profile_slug: "demo-craig-fletcher-minidigger-hire-newcastle",
    display_name: "Craig Fletcher",
    trading_name: "Fletcher Mini Digger Hire",
    city: "Newcastle upon Tyne",
    postcode_prefix: "NE6",
    whatsapp: "+44 7700 900729",
    email: "hire@fletchermini.co.uk",
    bio: "Mini-digger hire specialist covering Tyneside, Northumberland and Durham. I spent 11 years as a groundworker before swapping the spade for the office in 2017 and buying my first three Kubotas. Fleet now runs to 30+ Kubota mini-excavators — K008-3 (0.8T zero-tail), KX015-4 (1.5T), KX019-4 (1.9T), KX030-4 (3T) — plus a fleet of micro-tipper dumpers (1T and 1.5T) to pair with them. Every machine on a 250-hour service schedule logged in TelematicsPlus. Dry hire by the day, weekend or week, with delivery on our own 7.5T plant lorry across NE / DH / SR postcodes. CPCS-carded operator hire available — I keep a rota of 6 trusted lads (most ex-groundworkers like me). Breaker attachments and auger attachments available with every machine at £15-25/day. The 0.8T zero-tail is our most-hired unit — it fits through a 900mm side gate and turns in its own length, perfect for back gardens. Domestic and trade welcome.",
    years_in_trade: 9,
    start_year: 2017,
    priced_services: [
      { name: "Kubota K008 0.8T mini digger (per day)", price: 85, unit: "per day", description: "0.8-tonne zero-tail-swing micro digger. Fits through 900mm gate. Inc transport within 15 miles of NE6. Standard buckets inc." },
      { name: "Kubota K008 0.8T mini digger (per week)", price: 320, unit: "per week", description: "Weekly dry hire — saves 25% vs daily. Inc delivery and collection within 15 miles. 0.8T zero-tail." },
      { name: "Kubota KX015 1.5T mini digger (per day)", price: 95, unit: "per day", description: "1.5-tonne canopy mini digger — most popular workhorse. Inc transport within 15 miles. Buckets inc." },
      { name: "Kubota KX015 1.5T mini digger (per week)", price: 360, unit: "per week", description: "Weekly dry hire rate. Includes delivery and collection. Discount on multi-week block hires." },
      { name: "Kubota KX030 3T mini digger (per day)", price: 145, unit: "per day", description: "3-tonne midi excavator for deeper dig and bigger spoil moves. Inc transport. Buckets inc." },
      { name: "Breaker attachment (per day)", price: 25, unit: "per day", description: "Hydraulic breaker for concrete and brick. Quick-hitch fit. Available on KX015 upwards. Per day add-on." },
      { name: "1.5T micro-dumper (per day)", price: 75, unit: "per day", description: "Swivel-tip 1.5T mini dumper to pair with the digger — saves you barrowing. Inc delivery." },
      { name: "CPCS operator hire (per day)", price: 215, unit: "per day", description: "Add a CPCS-carded operator to dry-hire — useful for one-off jobs without a digger driver. 8-hour day." }
    ],
    faq_items: [
      { q: "What size do I need for a garden dig?", a: "0.8T if access is tight — 900mm gate or narrower paths. 1.5T if you've got an open garden and want to shift spoil faster. 3T for deep footings or pond work. I'll talk it through with you on the phone — usually obvious once we've covered access and depth." },
      { q: "Do I need a licence to drive it?", a: "No — driving a mini digger isn't licensed unless it's for paid work on a CDM site. Domestic owner-occupiers can dry-hire and operate. For trade or site work CPCS card is required and we can supply an operator." },
      { q: "Do you deliver?", a: "Yes — own 7.5T plant lorry across NE / DH / SR / NE63+ postcodes. Standard delivery is free within 15 miles of the yard; further afield charged at cost. Out-and-back lift is included in the day rate." },
      { q: "What if it breaks down?", a: "Phone us — we keep a swap-machine ready and the fitter can be on site within 4 hours during working hours, usually faster. Standard wear no charge; if you've put petrol in the diesel tank, that's on you." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["CPCS A58 360 Excavator below 5T", "CPCS A09 Forward Tipping Dumper", "Driver CPC (7.5T plant lorry)", "Manual Handling"],
    trade_memberships: ["Construction Plant-hire Association (CPA)", "Hire Association Europe (HAE)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 85,
    free_site_visits: true,
    quote_availability: "Same-day quotes",
    quote_turnaround_hours: 4,
    current_status_note: "0.8T and 1.5T usually next-day. 3T machines 2-3 days ahead in summer.",
    availability: "tomorrow",
    reviews: [
      { customer_name: "Robert J.", rating: 5, title: "Zero-tail saved the back garden", body: "Side access was 950mm. K008 walked through it like it was nothing. Cleared the patio base in a Saturday morning. Craig walked me through the controls on delivery.", service_name: "Kubota K008 0.8T mini digger (per day)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/83.jpg" },
      { customer_name: "Aaron W.", rating: 5, title: "Swapped a faulty breaker within 90 minutes", body: "Breaker started losing pressure mid-morning. Phoned Craig at 10:15, fitter on site with a swap unit by 11:40. Lost maybe an hour — that's hire-firm service done right.", service_name: "Breaker attachment (per day)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/86.jpg" },
      { customer_name: "Neil B.", rating: 5, title: "Operator was sharp, knew the kit", body: "Hired the 1.5T with an operator for foundations on my self-build. The lad dug perfectly to the engineer's drawing first time, no over-dig. Worth the operator rate twice over.", service_name: "CPCS operator hire (per day)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/89.jpg" }
    ]
  },

  // 10. STORAGE CONTAINER HIRE
  {
    trade_slug: "storage-container-hire",
    profile_slug: "demo-martin-bewley-storage-container-hire-southampton",
    display_name: "Martin Bewley",
    trading_name: "Bewley Container Hire & Sales",
    city: "Southampton",
    postcode_prefix: "SO15",
    whatsapp: "+44 7700 900781",
    email: "office@bewleycontainers.co.uk",
    bio: "Container hire and sales across the South Coast and home counties since 2012. Stock yard at Millbrook holds around 200 containers — 10ft, 20ft and 40ft, all once-shipped (CSC plate current), plus a smaller stock of high-cubes and dehumidified spec for archive / wine / textile storage. We hire and we sell. Hire is typically £75-£165 per month depending on size with free delivery in the SO postcodes and £2-2.50 per loaded mile beyond. Sales currently from £1,895 for a clean used 20ft. Every container comes with a 4-bolt lockbox + heavy-duty padlock as standard — proper security, not a cheap hasp. Delivery is on our own Hiab-equipped wagons (Tier 1 driver-CPC), so we can spot a 20ft into a tight driveway or yard where a tilt-bed can't go. We also do site offices, drying rooms, and converted welfare containers — anti-vandal options for unsecured sites. Honest yard, honest paperwork — every CSC plate verified before sale or hire.",
    years_in_trade: 14,
    start_year: 2012,
    priced_services: [
      { name: "10ft container (per month, hire)", price: 75, unit: "per month", description: "Compact container for garden / small business storage. Inc lockbox + padlock. Free delivery within 20 miles of SO15." },
      { name: "20ft container (per month, hire)", price: 110, unit: "per month", description: "Standard 20ft once-shipped container. Inc lockbox + padlock. Free delivery within 20 miles." },
      { name: "40ft container (per month, hire)", price: 165, unit: "per month", description: "Large 40ft container — plant, machinery, archive storage. Inc lockbox + padlock. Free delivery within 20 miles." },
      { name: "Dehumidified 20ft (per month)", price: 165, unit: "per month", description: "Insulated and dehumidifier-fitted 20ft container — archive, wine, textiles, electronics. Inc humidity log access." },
      { name: "20ft container — used, sale", price: 1895, unit: "fixed", description: "Once-shipped 20ft for sale. CSC plate verified, surface-rust treated, lockbox + padlock fitted, delivered up to 50 miles." },
      { name: "40ft container — used, sale", price: 3250, unit: "fixed", description: "Once-shipped 40ft for sale. CSC plate verified, painted, lockbox + padlock fitted." },
      { name: "Hiab delivery beyond 20 miles", price: 2, unit: "per mile", description: "£2/loaded mile beyond the free 20-mile radius. Hiab placement included regardless of distance. Most jobs done in one visit." },
      { name: "Anti-vandal site office container (per month)", price: 195, unit: "per month", description: "Converted 20ft with anti-vandal shutters, secure door, internal partition for office + storage. Site setup spec." }
    ],
    faq_items: [
      { q: "Hire or buy — which makes sense?", a: "Roughly: under 18 months you're cheaper hiring; over 18 months buying wins. A used 20ft is around £1,895 to buy and £110/month to hire — so 18 months hire = £1,980 and you've got nothing. For long-term storage, buy. For project storage, hire." },
      { q: "Will it fit on my driveway?", a: "Probably yes if you can get a 7.5m wagon to it — Hiab places sideways so you don't need a long run-up. Even 10ft / 20ft slots into surprisingly tight driveways. We'll do a phone-survey from your driveway photos and confirm before delivery." },
      { q: "How secure are they?", a: "Standard 4-bolt lockbox + closed-shackle padlock — properly secure, would take an angle grinder and serious noise. Anti-vandal spec adds shutters over the doors for sites in problem areas." },
      { q: "Do they leak?", a: "Not if the CSC plate is current — that's what the plate verifies. Every container we hire or sell has been pressure / leak tested in the yard. Once-shipped means single shipping cycle then off-hire — they're in great condition. We won't sell a leaker." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Driver CPC (Hiab lorry)", "ALLMI Hiab Operator", "CSC Inspector Training", "Manual Handling"],
    trade_memberships: ["Container Owners Association (COA)", "Hire Association Europe (HAE)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 75,
    free_site_visits: true,
    quote_availability: "Same-day quotes",
    quote_turnaround_hours: 6,
    current_status_note: "Stock available for next-day delivery in most cases. Dehumidified spec 3-5 days lead time.",
    availability: "tomorrow",
    reviews: [
      { customer_name: "Edward L.", rating: 5, title: "Hiab spot was inch-perfect", body: "Driveway barely had a metre to spare each side. Martin's driver dropped the 20ft straight into the gap on the first attempt. Lockbox + padlock fitted before he left. Spot on.", service_name: "20ft container (per month, hire)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/92.jpg" },
      { customer_name: "Frederick P.", rating: 5, title: "Dehumidified saved my archive", body: "Hired a dehumidified 20ft for a year of paper-archive storage during an office move. Humidity log shows consistent 45-55% the whole time. Not a single damp document. Worth the premium.", service_name: "Dehumidified 20ft (per month)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/95.jpg" },
      { customer_name: "Howard M.", rating: 5, title: "Bought after 12 months hire", body: "Started on hire while we worked out long-term use. Converted to a sale at month 12 — Martin discounted the buy price against the hire we'd paid. Fair deal, no haggling.", service_name: "20ft container — used, sale", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/98.jpg" }
    ]
  }
];
