// Demo profile seeds for Xrated Trade Off — UK 2026.
//
// Each entry below is realistic demo data for one of the 27 trades registered
// in `tradeOff.ts`. The seed agent uses this file to populate Supabase demo
// profiles so visitors clicking "View profile" from /trade-off/trades land on
// a page that looks like a real tradesperson's listing.
//
// Phone numbers all use the Ofcom-reserved fiction range +44 7700 900XXX.
// Names are realistic but not famous-person.
// Prices are anchored to UK 2026 industry benchmarks.

export type DemoTradeSeed = {
  trade_slug: string;
  profile_slug: string;
  display_name: string;
  trading_name: string;
  city: string;
  postcode_prefix: string;
  whatsapp: string;
  email: string;
  bio: string;
  years_in_trade: number;
  start_year: number;
  priced_services: Array<{
    name: string;
    price: number;
    unit: string;
    description: string;
  }>;
  faq_items: Array<{
    q: string;
    a: string;
  }>;
  is_insured: boolean;
  insurance_cover_gbp: number;
  qualifications: string[];
  trade_memberships: string[];
  dbs_checked: boolean;
  has_own_transport: boolean;
  has_own_tools: boolean;
  minimum_job_gbp: number;
  free_site_visits: boolean;
  quote_availability: string;
  quote_turnaround_hours: number;
  current_status_note: string;
  availability: "now" | "tomorrow" | "this_week" | "next_week" | "two_weeks" | "later";
  reviews: Array<{
    customer_name: string;
    rating: number;
    title: string;
    body: string;
    service_name: string;
    project_type: "new_build" | "renovation" | "repair";
  }>;
};

export const DEMO_TRADE_SEEDS: DemoTradeSeed[] = [
  // 1. DRYWALLER
  {
    trade_slug: "drywaller",
    profile_slug: "demo-marcus-okafor-drywaller-manchester",
    display_name: "Marcus Okafor",
    trading_name: "Okafor Drywall & Partitions",
    city: "Manchester",
    postcode_prefix: "M14",
    whatsapp: "+44 7700 900142",
    email: "marcus@okafordrywall.co.uk",
    bio: "I started out hanging board for a commercial fit-out crew back in 2012, mostly office refurbs around Salford and Trafford Park. These days I run my own two-man outfit doing stud partitions, metal frame systems, soundproofing walls and acoustic ceilings across Greater Manchester. About 70% of my work is small commercial — dentist surgeries, accountants, small offices — and the rest is loft conversions and basement builds for homeowners who want it done properly. I take pride in a clean board joint and a wall that's actually plumb. If your existing builder has cut corners on the metalwork I'll be straight with you about what needs ripping out before we skim. I keep my van stocked so I can get on a job same week most weeks. Quotes are always written down with the metalwork spec, board type and acoustic rating spelled out — no vague verbal numbers.",
    years_in_trade: 14,
    start_year: 2012,
    priced_services: [
      { name: "Single stud partition wall (per linear m)", price: 95, unit: "per linear m", description: "70mm metal C-stud frame, 12.5mm plasterboard both sides, ready for skim. Includes door opening if needed." },
      { name: "Acoustic separating wall (per linear m)", price: 165, unit: "per linear m", description: "Twin stud frame, 100mm mineral wool, double-board with acoustic plasterboard. Tested to 50dB+ reduction." },
      { name: "Loft conversion drylining package", price: 2400, unit: "fixed", description: "Full dryline-out of a standard loft (up to 25sqm) including dwarf walls, ceilings, eaves cupboards. Boarded only — skim by your plasterer." },
      { name: "Suspended ceiling install (per sqm)", price: 48, unit: "per sqm", description: "MF ceiling on grid, recess for downlights, taped and ready for finish. Commercial or domestic." },
      { name: "Soundproof room conversion", price: 3800, unit: "from", description: "Convert a standard room into a music or home-studio space. Isolated stud, resilient bars, acoustic board, sealed perimeter." },
      { name: "Bathroom moisture board lining", price: 850, unit: "from", description: "Strip back to brick, foil-backed moisture-resistant board on battens, ready for tiler. Standard bathroom size." }
    ],
    faq_items: [
      { q: "Do you do the skim coat or just the boarding?", a: "I board only — I work alongside two plasterers I trust who skim behind me. If you want the full package I'll quote you for both as separate line items so you can see what each side costs." },
      { q: "How quiet can you actually make a wall?", a: "An acoustic stud with proper mineral wool, double-board and sealed perimeter will get you 50-55dB reduction — meaning you'll hear a TV faintly but not conversation. If you want true silence you need a fully isolated room-within-a-room build, which I also do." },
      { q: "Do I need a structural engineer for a stud wall?", a: "Not for a non-loadbearing partition — those just need to be plumb and well-fixed. If you're removing a loadbearing wall and infilling, that needs an engineer's calc first and I won't start without seeing it." },
      { q: "Can you work around our furniture?", a: "Yes but it slows me down — better if the room is empty or fully sheeted. I bring dust sheets and a vacuum but board-cutting throws fine dust everywhere." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["CSCS Skilled Worker Card", "NVQ Level 2 Drylining", "Asbestos Awareness (UKATA)"],
    trade_memberships: ["The Finishes & Interiors Sector (FIS)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 250,
    free_site_visits: true,
    quote_availability: "Usually quotes within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Currently booking 2-3 weeks out. Same-week slots possible for repair work.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Sarah K.", rating: 5, title: "Loft came out perfect", body: "Marcus boarded out our whole loft conversion in three days and the walls are dead plumb. Plasterer who came after said it was the easiest skim he'd done all year. Tidy worker, swept up every night.", service_name: "Loft conversion drylining package", project_type: "renovation" },
      { customer_name: "Daniel R.", rating: 5, title: "Soundproofed our home office", body: "We work from home with a baby in the next room. Marcus built us an isolated wall and you genuinely cannot hear conference calls through it now. Worth every penny.", service_name: "Acoustic separating wall (per linear m)", project_type: "renovation" },
      { customer_name: "Priya M.", rating: 4, title: "Good job, ran a day over", body: "Quality of the partition is excellent and he was upfront about a delay due to a board delivery being short. Finished a day later than quoted but no extra cost. Would use again.", service_name: "Single stud partition wall (per linear m)", project_type: "renovation" },
      { customer_name: "James O.", rating: 5, title: "Office fit-out on time", body: "Did our reception area suspended ceiling and partition walls over a weekend so we didn't lose trading days. Spot on.", service_name: "Suspended ceiling install (per sqm)", project_type: "renovation" }
    ]
  },

  // 2. PLASTERER
  {
    trade_slug: "plasterer",
    profile_slug: "demo-emma-whitfield-plasterer-leeds",
    display_name: "Emma Whitfield",
    trading_name: "Whitfield Plastering",
    city: "Leeds",
    postcode_prefix: "LS6",
    whatsapp: "+44 7700 900218",
    email: "emma@whitfieldplastering.co.uk",
    bio: "I served my time with a small family firm in Headingley straight out of college, then went solo eight years ago. Most of my week is two-coat skim on plasterboard, patch repairs and ceiling re-skims for landlords and homeowners across LS1 to LS28. I also do quite a bit of lime plaster on older terraces — there's a lot of Victorian stock around here that doesn't want a hard sand-and-cement finish on it. I quote per room not per day, so you know what you're paying before I start. Dust sheets, edge protection and a proper hoover at the end are included — I shouldn't have to say that but apparently it's a selling point now. I'll always tell you if the existing surface needs to come off rather than overskim — saves you a callback in 18 months.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "Skim coat to existing walls (per sqm)", price: 15, unit: "per sqm", description: "Two-coat finish plaster over sound existing surface, PVA prep, ready for paint after 7 days." },
      { name: "Ceiling re-skim (standard room up to 16sqm)", price: 320, unit: "fixed", description: "Strip artex if needed, board-and-skim or overskim depending on condition. Includes scaffolds, sheeting and clean-up." },
      { name: "Full room re-plaster (3x4m bedroom)", price: 680, unit: "from", description: "Strip blown plaster back to brick, scratch coat, float and skim. Includes 5-day return for snags." },
      { name: "Lime plaster repair (per sqm)", price: 75, unit: "per sqm", description: "Hot lime mortar, three-coat traditional finish on Victorian/Edwardian brick. Breathable, period-correct." },
      { name: "Patch repair (single area up to 1sqm)", price: 95, unit: "from", description: "Small patches around new sockets, removed radiators, cracked corners. Same-day turnaround where possible." },
      { name: "Artex removal + skim (per sqm)", price: 28, unit: "per sqm", description: "Steam-off or board-over artex ceiling, fresh skim, ready for paint. Asbestos test on quote if pre-2000 property." }
    ],
    faq_items: [
      { q: "Can you skim over artex or does it need to come off?", a: "Depends on the condition. If it's flat and well-stuck I'll bond on, mesh and skim. If it's peeling or heavy pattern I'll usually overboard. Either way I'll test for asbestos first on anything pre-2000 — non-negotiable." },
      { q: "How long until I can paint?", a: "Full mist coat after 7 days, finish coat from 10 days. Skim looks dry sooner but it's still gassing off moisture, and painting too early causes the paint to flake within 6 months." },
      { q: "Do I need lime plaster on my old house?", a: "If your walls are solid brick (no cavity) and built before about 1920, yes — cement or hard gypsum traps moisture and pushes damp inward. Lime breathes. It's slower and a bit more expensive but it's the right call." },
      { q: "Do you cover furniture and clean up?", a: "Yes. Dust sheets on floors, polythene on anything I can't move, hoover at the end. You shouldn't be wiping plaster off skirtings after I've gone." },
      { q: "Do you do float work or just skim?", a: "Both. Skim is the bread and butter but I do scratch-and-float for backing coats, sand-and-cement render and lime. I can do the full system." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["City & Guilds NVQ Level 2 Plastering", "City & Guilds Heritage Skills (Lime)", "CSCS Card"],
    trade_memberships: ["Federation of Plastering and Drywall Contractors"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 150,
    free_site_visits: true,
    quote_availability: "Usually quotes same day",
    quote_turnaround_hours: 12,
    current_status_note: "Booking 1-2 weeks ahead. Patch repairs often slotted in mid-week.",
    availability: "next_week",
    reviews: [
      { customer_name: "Tom B.", rating: 5, title: "Best skim I've ever had", body: "Had three rooms done top to bottom. Emma got the walls dead flat — you can see down a wall and it's like glass. Painter loved it.", service_name: "Skim coat to existing walls (per sqm)", project_type: "renovation" },
      { customer_name: "Helen C.", rating: 5, title: "Saved our old terrace", body: "Two other plasterers had used gypsum on our 1890s walls and it kept blowing. Emma took it all off, did proper lime, no damp issues 18 months on.", service_name: "Lime plaster repair (per sqm)", project_type: "renovation" },
      { customer_name: "Raj P.", rating: 5, title: "Patch was invisible", body: "Had a new radiator and the patches around the pipes were perfect. You can't see the join.", service_name: "Patch repair (single area up to 1sqm)", project_type: "repair" },
      { customer_name: "Megan T.", rating: 4, title: "Good work, a bit slow to quote", body: "Quality is excellent and the price was fair. Took five days to get the quote back though which slowed our planning. Worth waiting for in the end.", service_name: "Full room re-plaster (3x4m bedroom)", project_type: "renovation" }
    ]
  },

  // 3. ELECTRICIAN
  {
    trade_slug: "electrician",
    profile_slug: "demo-jamie-mclean-electrician-edinburgh",
    display_name: "Jamie MacLean",
    trading_name: "MacLean Electrical Services",
    city: "Edinburgh",
    postcode_prefix: "EH9",
    whatsapp: "+44 7700 900307",
    email: "jamie@macleanelectrical.co.uk",
    bio: "I served a four-year apprenticeship with a Lothian housebuilder, qualified JIB Gold Card in 2013, and went out on my own in 2018. I cover all of Edinburgh and the Lothians doing domestic and small commercial — full rewires, consumer unit upgrades, EV chargers, EICR inspections and CCTV. I'm NICEIC Approved Contractor which means I can self-certify Part P work and you get a Building Control completion certificate without a separate sign-off. Most of my work comes from estate agents and homebuyers needing EICRs before completion, and a steady flow of EV charger installs (OZEV approved). I'm honest about pricing — if your fuseboard doesn't actually need swapping I'll tell you what it does need. No work without a written quote and no surprise day rates on top.",
    years_in_trade: 13,
    start_year: 2013,
    priced_services: [
      { name: "Full house rewire (3-bed semi)", price: 4200, unit: "from", description: "Strip out old wiring, install new circuits, sockets, lighting, consumer unit and earthing. NICEIC certified, Building Control notified. 5-10 day job." },
      { name: "Consumer unit upgrade (RCBO board)", price: 750, unit: "fixed", description: "Replace old fuseboard with 18th Edition compliant RCBO board, surge protection. Certificate provided." },
      { name: "EICR inspection (3-bed property)", price: 195, unit: "fixed", description: "Full Electrical Installation Condition Report including written remedials list. Required for landlords every 5 years." },
      { name: "EV charger install (7kW, OZEV)", price: 950, unit: "fixed", description: "Wallbox or Ohme charger, dedicated circuit, type 2 socket, OZEV grant paperwork submitted. Half-day install." },
      { name: "Additional socket / outlet", price: 95, unit: "per item", description: "Single double socket added to existing ring main, chased in or surface, made good. Per outlet." },
      { name: "Downlighter install (per fitting)", price: 55, unit: "per item", description: "Fire-rated LED downlight, wired into existing circuit. Bulk discount over 6 units." },
      { name: "Hot tub / outdoor supply install", price: 480, unit: "from", description: "Dedicated armoured cable run from board to outdoor isolator, RCD protected. Includes trenching up to 10m." }
    ],
    faq_items: [
      { q: "How do I know if I need a full rewire?", a: "Rubber-insulated cabling, a wooden fusebox, two-pin sockets, or no earth on lighting circuits — those are the obvious signs. An EICR will tell you for certain. If you've had a fuseboard upgrade in the last 10 years and the wiring is PVC you're usually fine to leave it." },
      { q: "Can I install my own EV charger?", a: "Legally no — it's notifiable Part P work and your insurance and grant claim both depend on it being installed by a qualified electrician. The OZEV grant only pays if the installer is an approved one." },
      { q: "What's the difference between an EICR and a PAT test?", a: "EICR is the fixed wiring of the house — sockets, lights, fuseboard. PAT is the plugged-in appliances. Landlords need both annually depending on local council requirements." },
      { q: "Do you do emergency callouts?", a: "Yes, evenings and weekends within Edinburgh and East Lothian. Hourly rate applies and there's a £95 call-out fee. Full power loss, exposed live wires and burning smells get top priority." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: [
      "JIB Gold Card",
      "City & Guilds 18th Edition (2382-22)",
      "City & Guilds 2391 Inspection & Testing",
      "OZEV EV Charger Installer"
    ],
    trade_memberships: ["NICEIC Approved Contractor", "JIB (Joint Industry Board)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 125,
    free_site_visits: true,
    quote_availability: "Usually quotes within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Booking 3-4 weeks for rewires. EICRs and EV installs within 1 week.",
    availability: "this_week",
    reviews: [
      { customer_name: "Lorna F.", rating: 5, title: "Rewire was painless", body: "Jamie rewired our whole semi in 9 days, dust sheets every day, and finished a day early. Walked us through the certificate and registered it with Building Control. Couldn't ask for more.", service_name: "Full house rewire (3-bed semi)", project_type: "renovation" },
      { customer_name: "Andrew S.", rating: 5, title: "EV charger sorted in half a day", body: "Booked, OZEV paperwork done, charger up and running in 4 hours. Tidy cable run too — no surface trunking on show.", service_name: "EV charger install (7kW, OZEV)", project_type: "new_build" },
      { customer_name: "Chloe W.", rating: 4, title: "EICR was thorough", body: "Spotted a few things our previous spark missed. Detailed report with clear photos. Slightly more expensive than the cheapest quote but I'd rather have it done right.", service_name: "EICR inspection (3-bed property)", project_type: "repair" },
      { customer_name: "Mark D.", rating: 5, title: "Consumer unit swap on time", body: "Old fuseboard was tripping constantly. Swapped for an RCBO board, no trips since, certificate emailed within 2 days.", service_name: "Consumer unit upgrade (RCBO board)", project_type: "repair" },
      { customer_name: "Isla R.", rating: 5, title: "Added 4 sockets and 8 downlights", body: "Booked him for a small list of jobs and he knocked them all out in one day. Reasonable prices, no upsell, made good every chase neatly.", service_name: "Downlighter install (per fitting)", project_type: "renovation" }
    ]
  },

  // 4. SCAFFOLDER
  {
    trade_slug: "scaffolder",
    profile_slug: "demo-billy-ahmed-scaffolder-birmingham",
    display_name: "Billy Ahmed",
    trading_name: "Ahmed Scaffolding Solutions",
    city: "Birmingham",
    postcode_prefix: "B11",
    whatsapp: "+44 7700 900459",
    email: "billy@ahmedscaffolding.co.uk",
    bio: "I came up through a big national scaffold firm doing tower blocks and refurbs across the Midlands. Eight years ago I took the leap and bought my first transit-load of tube and fitting and have built the yard up since. We're a four-man crew running mostly domestic and small commercial work — roofs, chimneys, render jobs, two-storey extensions and the odd church spire. Everything we put up is CISRS-tagged and inspected weekly by me personally, with a written scaff tag on the structure that the working trade can see. If your roofer or renderer asks for changes to the platform we'll come back and adapt it the same day where I can. Plenty of yards will leave a scaff up for weeks past the agreed hire — we don't. Three weeks standard, then £25/week. Honest pricing, on time, no drama.",
    years_in_trade: 17,
    start_year: 2009,
    priced_services: [
      { name: "Two-storey rear elevation (standard semi)", price: 850, unit: "from", description: "Erect, 3-week hire, dismantle. Toe-boards, brick guards, lift-and-a-half access. For roof, render or chimney work." },
      { name: "Chimney scaffold (single stack)", price: 420, unit: "from", description: "Chimney access tower with working platform around stack. 2-week hire. Suitable for repointing or pot replacement." },
      { name: "Full perimeter scaffold (3-bed semi)", price: 1850, unit: "from", description: "Wrap around three or four sides of a standard property. Three-week hire, multiple lifts. For full re-roof or render job." },
      { name: "Tower hire (mobile aluminium)", price: 75, unit: "per day", description: "Single-width mobile tower for solo trades. Delivered + collected. Working platform up to 5m." },
      { name: "Loading bay platform", price: 320, unit: "from", description: "Cantilevered loading bay attached to existing scaff for materials. 2-week hire." },
      { name: "Pavement gantry / temporary roof", price: 1200, unit: "from", description: "Pedestrian protection for shopfront works, signed and lit. From 2 weeks. Local authority licence support included." },
      { name: "Extra week hire (any structure)", price: 25, unit: "per visit", description: "Per week beyond standard 3-week hire. Weekly inspections included." }
    ],
    faq_items: [
      { q: "Do I need a licence for scaffolding on the pavement?", a: "Yes — if any part of the scaff crosses a public footpath or road you need a council street works licence. I'll apply on your behalf for £85 admin plus the council fee (usually £65-£130 depending on the borough)." },
      { q: "How long does a typical install take?", a: "A two-storey rear elevation is up in a morning, dismantled in an afternoon. Full perimeter on a 3-bed is a day to put up, half a day to take down." },
      { q: "Is my scaffold safe in high winds?", a: "Anything I put up is tied to the property at fixed intervals and rated to Beaufort 8. If forecasts go above that I'll come back to add ties or wind-load mitigation — included in the hire." },
      { q: "Can I leave tools on the scaff overnight?", a: "Honestly no. Even in good areas tools walk. We hand back a clean structure each evening — easier all round." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["CISRS Advanced Scaffolder Card", "SMSTS Site Management Safety", "CITB Working at Height"],
    trade_memberships: ["NASC (National Access & Scaffolding Confederation)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 400,
    free_site_visits: true,
    quote_availability: "Usually quotes same day",
    quote_turnaround_hours: 24,
    current_status_note: "Erecting same week for standard 2-storey jobs. Larger structures 1-2 weeks out.",
    availability: "this_week",
    reviews: [
      { customer_name: "Geoff H.", rating: 5, title: "Up in 4 hours", body: "Booked for the roofer to do a re-tile, scaff was up by lunch. Solid platform, the roofer commented it was the tidiest he'd worked on this year.", service_name: "Two-storey rear elevation (standard semi)", project_type: "renovation" },
      { customer_name: "Yasmin K.", rating: 5, title: "Honest with the council licence", body: "Other quotes hid the council fees. Billy laid it all out — his admin, the borough fee, the lot. No surprises.", service_name: "Pavement gantry / temporary roof", project_type: "renovation" },
      { customer_name: "Paul M.", rating: 4, title: "Came back to extend it", body: "Render job ran a week over and Billy came back to extend the hire without fuss. £25 a week is fair.", service_name: "Extra week hire (any structure)", project_type: "renovation" },
      { customer_name: "Sandra L.", rating: 5, title: "Chimney repointed safely", body: "Tower around the chimney was rock solid. Stonemason was up there for 3 days and not a wobble. Took it down quietly on a Saturday.", service_name: "Chimney scaffold (single stack)", project_type: "repair" }
    ]
  },

  // 5. TILER
  {
    trade_slug: "tiler",
    profile_slug: "demo-anya-petrova-tiler-bristol",
    display_name: "Anya Petrova",
    trading_name: "Petrova Tiling Co",
    city: "Bristol",
    postcode_prefix: "BS6",
    whatsapp: "+44 7700 900521",
    email: "anya@petrovatiling.co.uk",
    bio: "I trained on big commercial jobs in Eastern Europe before settling in Bristol, then re-certified through City & Guilds here. Eleven years in I run a solo operation focused on bathrooms, kitchen splashbacks, hallway floors and patios. About half my work is large-format porcelain (60x120 and bigger) which a lot of tilers shy away from because of how unforgiving they are — but the finish is worth it. I prep properly: backer board on plywood floors, tanking on wet rooms, levelling compound where needed. No shortcuts. Quotes are itemised: tiles per sqm, prep, adhesive, grout, edge trims, silicone. So if you change tile choice the only number that moves is the materials line. I'll always tell you straight if a layout you've chosen will need an awkward cut down the middle of the room — there's usually a better arrangement.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Bathroom retile (full room, walls + floor)", price: 1850, unit: "from", description: "Strip existing, prep substrate, tank wet areas, tile walls and floor. Standard bathroom up to 8sqm. Excludes tiles." },
      { name: "Kitchen splashback (single wall)", price: 380, unit: "from", description: "Up to 3sqm splashback, includes substrate check, adhesive, grout, edge trim. Same-day install for most jobs." },
      { name: "Wall tiling (per sqm)", price: 55, unit: "per sqm", description: "Standard ceramic or porcelain on plasterboard or backer board. Includes adhesive and grout. Up to 30x60 tile." },
      { name: "Large-format porcelain (60x120 and over)", price: 95, unit: "per sqm", description: "Big-format tiles requiring suction cups, levelling clips and gel adhesive. Substrate must be flat to 1mm/m." },
      { name: "Wet room install (tray + tiling)", price: 2400, unit: "from", description: "Linear drain, tanking membrane, falls in screed, full tiling. Excludes tiles + plumbing alterations." },
      { name: "Floor tiling (porcelain, per sqm)", price: 65, unit: "per sqm", description: "Standard porcelain floor, up to 60x60. Includes self-levelling prep on uneven floors." },
      { name: "Regrout existing tiles (per sqm)", price: 22, unit: "per sqm", description: "Rake out, deep clean, fresh grout, fresh silicone around edges. Refreshes a tired bathroom without a full retile." }
    ],
    faq_items: [
      { q: "Do you supply the tiles?", a: "I can but I'd rather you buy them direct — Topps Tiles, Tile Mountain or Mandarin Stone usually beat anything I can mark up. I'll give you a written list of what to order including extras for cuts." },
      { q: "How much waste should I order on top?", a: "10% on small format, 15% on large format, 20% if it's a herringbone or hex pattern. Don't skimp — running out mid-job and waiting on a re-order is the worst part of any tiling job." },
      { q: "Can you tile straight onto plasterboard in a bathroom?", a: "Around a shower or bath, no — I'll fit moisture-resistant backer board or tank it first. Elsewhere on the wall, yes, with a primer. The shower zone is non-negotiable." },
      { q: "Do you offer a guarantee?", a: "Two years on workmanship — if a tile pops, a grout line cracks or silicone fails, I come back and fix it free." },
      { q: "How long will my bathroom be out of action?", a: "Standard retile is 4-5 days of work but you should plan a full week without the shower while sealants and grouts cure properly. Wet rooms add another 2 days for the tanking." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["City & Guilds NVQ Level 2 Wall and Floor Tiling", "CSCS Card", "Schluter Systems Certified Installer"],
    trade_memberships: ["The Tile Association (TTA)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 200,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 4-5 weeks ahead. Small splashbacks slotted in faster.",
    availability: "later",
    reviews: [
      { customer_name: "Rachel W.", rating: 5, title: "Wet room is beautiful", body: "Massive porcelain on the walls and a perfect linear drain. Anya did the falls so precisely the water drains in seconds. Two years on still no leaks.", service_name: "Wet room install (tray + tiling)", project_type: "renovation" },
      { customer_name: "Dom T.", rating: 5, title: "Splashback in a day", body: "Came in the morning, gone by 4. Cut around two sockets perfectly and the grout lines are dead straight.", service_name: "Kitchen splashback (single wall)", project_type: "renovation" },
      { customer_name: "Vicky J.", rating: 5, title: "Big tiles, no cracks", body: "We chose massive 120x60 porcelain and Anya was the only tiler I called who wasn't put off. Floor is dead flat, no lippage, looks incredible.", service_name: "Large-format porcelain (60x120 and over)", project_type: "renovation" },
      { customer_name: "Pete A.", rating: 4, title: "Bathroom looks great, ran 2 days over", body: "Quality work and the bathroom looks great. Job ran two days over schedule because the floor needed more levelling than first quoted — fair enough but worth flagging.", service_name: "Bathroom retile (full room, walls + floor)", project_type: "renovation" }
    ]
  },

  // 6. PLUMBER
  {
    trade_slug: "plumber",
    profile_slug: "demo-dave-thornton-plumber-sheffield",
    display_name: "Dave Thornton",
    trading_name: "Thornton Plumbing & Heating",
    city: "Sheffield",
    postcode_prefix: "S10",
    whatsapp: "+44 7700 900634",
    email: "dave@thorntonplumbing.co.uk",
    bio: "Sheffield born and bred, plumbing since I left school 22 years ago. Started out with British Gas on the apprenticeship, went private in 2010 and have built a small business covering Sheffield, Rotherham and Chesterfield. I'm a one-man band most of the time but I bring in my brother for bigger bathroom jobs. Day to day it's leaking taps, blocked stacks, new bathrooms, boiler swaps and heating upgrades. CIPHE registered and WaterSafe approved — that means I can work on the rising main without the water board getting involved. I'm not the cheapest in the area but I'm honest about what's wrong and I'll always tell you if a repair will fix it rather than pushing a full replacement. No call-out fee in working hours within the S postcode area.",
    years_in_trade: 22,
    start_year: 2004,
    priced_services: [
      { name: "Combi boiler install (Worcester or Vaillant)", price: 2450, unit: "from", description: "Like-for-like swap, system flush, magnetic filter, new flue. Includes 10-year manufacturer warranty registration. Gas Safe certified." },
      { name: "Bathroom suite install (labour only)", price: 1850, unit: "from", description: "Strip old, fit new bath, basin, WC and shower. 3-4 day job. Tiling and electrics separate." },
      { name: "Hourly rate (small jobs)", price: 75, unit: "per hour", description: "Leaks, blockages, tap swaps, single radiator install. Minimum half-hour charge. No call-out fee in working hours." },
      { name: "Powerflush full system", price: 480, unit: "fixed", description: "Full chemical and mechanical flush of central heating system. Includes inhibitor top-up. Up to 12 radiators." },
      { name: "Radiator install (per radiator)", price: 220, unit: "per item", description: "New rad fitted to existing system, balanced and tested. Larger or designer rads quoted separately." },
      { name: "Outside tap install", price: 145, unit: "fixed", description: "Frost-protected double-check valve outside tap teed off rising main. Includes core drill through wall." },
      { name: "Unvented cylinder install", price: 1850, unit: "from", description: "Replace gravity tank system with mains-pressure unvented cylinder. Includes Building Control notification." }
    ],
    faq_items: [
      { q: "Should I get a new boiler or repair the old one?", a: "If your boiler is under 12 years old and the part is under £400, repair is almost always the right call. If it's pre-2014, the heat exchanger has gone, or you're getting recurring faults — replacement is the honest answer." },
      { q: "Do you do emergency callouts?", a: "Yes — burst pipes, no heating in winter, gas smells get priority. Out of hours is £125 call-out plus £95/hr. Working hours emergencies are normal hourly rate." },
      { q: "Is a powerflush worth it?", a: "If your radiators are cold at the bottom or your boiler is short-cycling, yes. If your system is under 10 years old and working fine, save your money." },
      { q: "What's the warranty on a new boiler?", a: "10 years on Worcester Greenstar with annual servicing. Vaillant ecoTec Plus is 10 years too. I register the warranty on the day so you don't have to chase it." },
      { q: "Can you work on my system if it's gas?", a: "Yes — I'm Gas Safe registered (557291). Anyone touching gas appliances legally has to be." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "NVQ Level 3 Plumbing & Heating",
      "Gas Safe Registered (557291)",
      "Unvented Hot Water G3",
      "Energy Efficiency for Domestic Heating (CIPHE)"
    ],
    trade_memberships: ["CIPHE (Chartered Institute of Plumbing & Heating Engineering)", "WaterSafe", "Gas Safe Register"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 95,
    free_site_visits: true,
    quote_availability: "Usually quotes same day",
    quote_turnaround_hours: 12,
    current_status_note: "Boiler swaps 1-2 weeks. Emergency callouts same day.",
    availability: "this_week",
    reviews: [
      { customer_name: "Karen B.", rating: 5, title: "Boiler swap in a day", body: "Old combi finally died. Dave quoted Tuesday, fitted Thursday, hot water that evening. Tidy job, no mess. Registered the warranty before he left.", service_name: "Combi boiler install (Worcester or Vaillant)", project_type: "repair" },
      { customer_name: "Steve M.", rating: 5, title: "Honest about the leak", body: "Two other plumbers said I needed a new tap. Dave fixed it for £45 with a new washer. Saved me £200.", service_name: "Hourly rate (small jobs)", project_type: "repair" },
      { customer_name: "Lucy R.", rating: 5, title: "Bathroom turnaround", body: "Stripped the old bathroom Monday, new one in by Friday. Worked around the tiler perfectly. Would have him back in a heartbeat.", service_name: "Bathroom suite install (labour only)", project_type: "renovation" },
      { customer_name: "Mohammed S.", rating: 4, title: "Powerflush helped a lot", body: "Heating was struggling all winter. Powerflush sorted most of it though one rad still needed bleeding regularly after. Came back to balance for free.", service_name: "Powerflush full system", project_type: "repair" }
    ]
  },

  // 7. CARPENTER
  {
    trade_slug: "carpenter",
    profile_slug: "demo-tom-bridges-carpenter-newcastle",
    display_name: "Tom Bridges",
    trading_name: "Bridges Bespoke Carpentry",
    city: "Newcastle",
    postcode_prefix: "NE3",
    whatsapp: "+44 7700 900712",
    email: "tom@bridgesbespoke.co.uk",
    bio: "I left college with a City & Guilds Level 3 in 2009 and went straight into a small joinery firm in Gosforth. After 6 years I went out on my own. I work as a site carpenter and second-fix specialist — kitchens, alcove shelving, internal doors, skirtings, architraves, the lot. I also build a fair bit of bespoke furniture in my home workshop: media units, bookcases, window seats. About 60% of my work is renovation projects across the NE postcodes, the rest is one-off bespoke pieces commissioned by interior designers and homeowners. I don't do roofing carpentry or first fix — there are better people for that. What I take pride in is a perfectly mitred skirting return, a kitchen with cabinet doors that line up to within 1mm, and shelving that you can put real weight on. I'll always tell you if a paint-grade finish will save you 30% vs hardwood — and where it won't.",
    years_in_trade: 17,
    start_year: 2009,
    priced_services: [
      { name: "Bespoke kitchen install (10 units)", price: 8500, unit: "from", description: "Labour to install a 10-unit handleless kitchen, including worktop fit, end panels, plinths and trim. Excludes appliances + plumbing." },
      { name: "Alcove shelving + cupboards (per linear m)", price: 480, unit: "per linear m", description: "Painted MDF alcove unit with adjustable shelves above and cupboard below. Built in-situ to fit. Excludes painting." },
      { name: "Internal door hang (per door)", price: 95, unit: "per item", description: "Hang a new door in existing frame, fit handles and latch. Per door. Frame work extra if needed." },
      { name: "Skirting + architrave (per room)", price: 280, unit: "from", description: "Fit MDF or softwood skirting and architrave to a standard 12sqm room. Includes mitres and pin nailing. Painting separate." },
      { name: "Bespoke media unit / TV cabinet", price: 1650, unit: "from", description: "Designed and built to your alcove, MDF or hardwood. Allow 2-3 weeks lead time including paint-ready or oiled finish." },
      { name: "Window seat with storage", price: 850, unit: "from", description: "Built-in window seat with lift-up lid storage, paint-grade. Standard bay or alcove width." },
      { name: "Day rate (general second fix)", price: 320, unit: "per day", description: "On-site day rate for second fix and snagging. Lined skirting, architrave, door adjustments, etc." }
    ],
    faq_items: [
      { q: "What's the difference between a carpenter and a joiner?", a: "Joiners traditionally work in a workshop making the joinery (doors, windows, stairs); carpenters fit it on site. I do both. If you're after a hand-cut staircase from rough timber that's joinery; if you're hanging the doors that's carpentry." },
      { q: "Can you supply the kitchen units or do I buy them?", a: "Either. I'll fit Howdens, Wickes, DIY Kitchens, Magnet — whatever you've chosen. If you want a fully bespoke kitchen I work with a joinery shop in Wallsend who'll build the units to my drawings." },
      { q: "Do you paint your alcove units?", a: "I'll caulk, fill, sand and prime ready for paint. Topcoats are best done by a painter — they get a better finish than I do, and I don't carry spray kit." },
      { q: "How long does a bespoke piece take?", a: "Alcove shelving 5-10 days lead time depending on design. Media units and window seats 2-3 weeks. Bespoke kitchens 4-6 weeks from sign-off." },
      { q: "Will my hardwood floor get damaged?", a: "I sheet up before I bring tools in and I cut outside or in the garage. The floor is the same condition when I leave as when I arrived." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["City & Guilds NVQ Level 3 Site Carpentry", "CSCS Skilled Worker Card", "PASMA Mobile Tower Card"],
    trade_memberships: ["Institute of Carpenters (IOC)", "Guild of Master Craftsmen"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 200,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 4-6 weeks ahead for bespoke. Small jobs slotted in earlier.",
    availability: "later",
    reviews: [
      { customer_name: "Helen P.", rating: 5, title: "Best kitchen install I've seen", body: "Cabinet doors line up perfectly, worktop joint is invisible, skirtings scribed around the plinths. Tom worked solidly for two weeks and the finish is incredible.", service_name: "Bespoke kitchen install (10 units)", project_type: "renovation" },
      { customer_name: "Ben T.", rating: 5, title: "Alcoves are a feature now", body: "Two matching alcove units either side of the chimney breast. Adjustable shelves, soft-close doors, all perfectly square. Cost more than IKEA but it's a different league.", service_name: "Alcove shelving + cupboards (per linear m)", project_type: "renovation" },
      { customer_name: "Marie K.", rating: 5, title: "Window seat is gorgeous", body: "Tom designed and built a window seat with hidden storage. Lid is on hidden hinges, the whole thing is paint-ready. Joiner in a million.", service_name: "Window seat with storage", project_type: "renovation" },
      { customer_name: "Dan O.", rating: 4, title: "Doors hung well, a bit pricey", body: "Six internal doors hung over a day and a half. Quality is great but a bit more expensive than the other quotes. Worth it for the precision.", service_name: "Internal door hang (per door)", project_type: "renovation" }
    ]
  },

  // 8. JOINER
  {
    trade_slug: "joiner",
    profile_slug: "demo-rachel-osullivan-joiner-glasgow",
    display_name: "Rachel O'Sullivan",
    trading_name: "O'Sullivan Joinery Workshop",
    city: "Glasgow",
    postcode_prefix: "G42",
    whatsapp: "+44 7700 900801",
    email: "rachel@osullivanjoinery.co.uk",
    bio: "I run a small joinery workshop in Govanhill specialising in heritage sash windows, hardwood front doors, and bespoke fitted furniture. Trained at City of Glasgow College and finished my apprenticeship under an old-school sash specialist who taught me to draw and chisel mortise-and-tenons by hand. I've been on my own since 2017. About half my work is repair and restoration of original Glasgow tenement sash windows — there's still thousands of them and people are finally realising they're worth saving rather than swapping for uPVC. The other half is bespoke pieces: built-in wardrobes, kitchen pantries, library shelving. I use accoya, oak, tulipwood and Douglas fir mostly — softwood gets the same care, just costs less. I quote per piece, not per day, and I draw everything before I cut.",
    years_in_trade: 9,
    start_year: 2017,
    priced_services: [
      { name: "Sash window restoration (per window)", price: 750, unit: "from", description: "Restore single sash window — strip old paint, replace rotten timber, re-cord, draught-proof, prime ready for paint. Excludes finish painting." },
      { name: "New sash window (hardwood, like-for-like)", price: 2200, unit: "from", description: "Hand-made replacement in accoya or sapele to match original profiles. Slimline double glazing. Excludes install." },
      { name: "Hardwood front door (bespoke)", price: 2800, unit: "from", description: "Solid hardwood front door designed to your spec — oak, sapele or accoya. Standard size. Excludes ironmongery + glazing." },
      { name: "Fitted wardrobe (per linear m)", price: 850, unit: "per linear m", description: "Floor-to-ceiling fitted wardrobe with hanging rails, shelves, drawers. Paint-grade MDF. Bespoke design." },
      { name: "Window draught-proofing only (per window)", price: 195, unit: "per item", description: "Strip out, fit brush-pile draught seals to sash and frame, re-cord. Cuts heat loss by 60-70% on a leaky sash." },
      { name: "Kitchen pantry (bespoke)", price: 2200, unit: "from", description: "Tall bespoke pantry cupboard with internal drawers, spice racks, fitted out to your needs. Paint-grade." },
      { name: "Shop drawings + design fee", price: 350, unit: "from", description: "Detailed shop drawings for any bespoke piece. Deducted from the build price if you commission the work." }
    ],
    faq_items: [
      { q: "Can you save my original sash windows?", a: "In almost every case yes. I've never found a sash beyond saving — even with rotten cills and broken sash cords, the joinery itself is usually sound. New cills, splice repairs, re-cording and draught-proofing brings them back. Cheaper than uPVC and the right thing for a listed building." },
      { q: "How long does a bespoke piece take?", a: "Sash restoration 2-3 weeks per window once started. New hardwood door 6-8 weeks. Built-in wardrobes 4 weeks from sign-off." },
      { q: "Do you fit on site as well?", a: "Yes. Workshop pieces I deliver and install myself. Sash restoration is done in situ — sash brought back to the workshop, frame stays in the wall." },
      { q: "What wood do you recommend for external work?", a: "Accoya is my first choice — modified pine, 50-year guarantee outside, takes paint beautifully. Sapele and oak are the traditional choices and look stunning. Avoid soft pine externally — it'll rot in 10 years." },
      { q: "Do you work to a listed-building spec?", a: "Yes. I work with Glasgow City Council conservation officers regularly. I match original mouldings to a 1mm profile, use traditional joints and finishes." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["SVQ Level 3 Bench Joinery", "City & Guilds Heritage Skills", "CSCS Card"],
    trade_memberships: ["Institute of Carpenters", "British Woodworking Federation (BWF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 300,
    free_site_visits: true,
    quote_availability: "Quotes within 72 hours",
    quote_turnaround_hours: 72,
    current_status_note: "Workshop is booked 8 weeks ahead. Repairs slotted in faster.",
    availability: "later",
    reviews: [
      { customer_name: "Andrew M.", rating: 5, title: "Saved our sash windows", body: "Quoted £18k by a window company to replace with uPVC. Rachel restored all six original sashes for £4.2k. Look stunning, draught-free, period-correct.", service_name: "Sash window restoration (per window)", project_type: "renovation" },
      { customer_name: "Fiona B.", rating: 5, title: "Front door is a work of art", body: "Hand-made oak door with a stained glass panel. Joinery is unbelievable — you can't see a single joint. Worth every penny.", service_name: "Hardwood front door (bespoke)", project_type: "renovation" },
      { customer_name: "Greg D.", rating: 5, title: "Wardrobe wall transformed the bedroom", body: "Full-length fitted wardrobes across one wall. Drawer fronts soft-close, dovetail drawer construction. Painter said it was the easiest topcoat job he's done — perfect prep.", service_name: "Fitted wardrobe (per linear m)", project_type: "renovation" },
      { customer_name: "Lesley T.", rating: 4, title: "Lead time was long", body: "10 weeks from order to install for our pantry. Long wait but the piece is extraordinary. Worth the patience.", service_name: "Kitchen pantry (bespoke)", project_type: "renovation" }
    ]
  },

  // 9. PAINTER
  {
    trade_slug: "painter",
    profile_slug: "demo-mike-fitzpatrick-painter-liverpool",
    display_name: "Mike Fitzpatrick",
    trading_name: "Fitzpatrick Painting & Decorating",
    city: "Liverpool",
    postcode_prefix: "L18",
    whatsapp: "+44 7700 900911",
    email: "mike@fitzpatrickpainting.co.uk",
    bio: "I've been brushing since 1996 — started at 16 with my dad's business, took it over when he retired in 2014. We're a two-man outfit covering Liverpool, the Wirral and west Cheshire. Bread and butter is interior repaints — full houses, hallways, single rooms — but we also do a lot of external work: fascias, gutters, sash windows, render painting. I'm not one for the spray gun on small jobs; brush and roller gives a better finish on most domestic work and you avoid the masking nightmare. I take time on prep — sanding, filling, caulking, two coats of primer where needed. A repaint that lasts 8 years instead of 3 is paying for itself. I quote in writing per room with brand of paint specified — Farrow & Ball, Little Greene, Dulux Trade, whichever you choose. No spec-trade tricks like watering the topcoat down.",
    years_in_trade: 30,
    start_year: 1996,
    priced_services: [
      { name: "Full 3-bed house interior repaint", price: 2800, unit: "from", description: "Walls, ceilings, woodwork throughout — typical 3-bed semi. Includes prep, fill, caulk, two coats. Excludes paint." },
      { name: "Single room repaint (walls + ceiling)", price: 350, unit: "from", description: "Standard bedroom or lounge up to 16sqm. Walls and ceiling, two coats. Excludes woodwork and paint." },
      { name: "Hallway, stairs + landing", price: 850, unit: "from", description: "Often the trickiest room — high walls, stairwell, spindles, banisters. Two coats throughout. Excludes paint." },
      { name: "Exterior fascia + soffit (terraced house)", price: 480, unit: "from", description: "Strip, prime, two coats gloss or satin on timber or uPVC fascia + soffit. Includes scaffolding tower." },
      { name: "Render / pebbledash repaint (per sqm)", price: 12, unit: "per sqm", description: "Masonry paint on external render with two coats. Includes pressure wash + sealer prep. Excludes scaffolding." },
      { name: "Kitchen unit respray (per door)", price: 35, unit: "per item", description: "Doors removed, sanded, primed and sprayed in workshop. Returned and rehung. Per door front." },
      { name: "Day rate (small jobs / snagging)", price: 240, unit: "per day", description: "Day rate for small jobs, touch-ups, snagging lists." }
    ],
    faq_items: [
      { q: "Do I have to buy the paint?", a: "Either way works. If you buy I'll give you exact quantities. If I buy I add 10% on top of trade price for the running around. I always recommend Dulux Trade Diamond Matt for walls — best value-for-money durable matt." },
      { q: "Can you cover dark walls in one coat?", a: "Honest answer no. Going from a dark colour to lighter you need a stain-block primer plus two topcoats. Anyone telling you one coat is selling you a fail." },
      { q: "How long does a full house take?", a: "Standard 3-bed semi is 6-8 working days for the two of us. We work room by room so you can keep using parts of the house." },
      { q: "Do you paint kitchen units?", a: "Yes — handles off, doors off, sprayed in the workshop in 2K paint. Much better finish than brush-painting in place. Reuses your existing units which saves a lot of money vs a new kitchen." },
      { q: "Will dust sheets be enough?", a: "We use heavy-duty cotton sheets and tape down edges. We move what we can and sheet what we can't. Nothing comes back with paint on it." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["City & Guilds NVQ Level 2 Painting & Decorating", "CSCS Card", "Asbestos Awareness"],
    trade_memberships: ["Painting & Decorating Association (PDA)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 200,
    free_site_visits: true,
    quote_availability: "Usually quotes within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Booking 2-3 weeks ahead. External work weather-dependent.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Linda H.", rating: 5, title: "Whole house, fantastic finish", body: "Mike and his lad did our 4-bed top to bottom in 8 days. Walls dead flat, no roller marks. They caulked and filled to a really high standard before painting.", service_name: "Full 3-bed house interior repaint", project_type: "renovation" },
      { customer_name: "Ade O.", rating: 5, title: "Kitchen reborn", body: "Saved us £8k on a new kitchen. Sprayed our existing doors in a beautiful satin grey. Looks brand new. Did the splashback tiles too.", service_name: "Kitchen unit respray (per door)", project_type: "renovation" },
      { customer_name: "Sarah W.", rating: 5, title: "Hallway + stairs done perfectly", body: "I was dreading this room — high ceilings, awkward stairwell. Mike rigged a safe platform and finished in 3 days. Spotless.", service_name: "Hallway, stairs + landing", project_type: "renovation" },
      { customer_name: "Phil N.", rating: 4, title: "Good job, weather delayed start", body: "External fascia repaint. Pushed twice for rain which was unavoidable. Once they started the quality was top-notch.", service_name: "Exterior fascia + soffit (terraced house)", project_type: "repair" }
    ]
  },

  // 10. ROOFER
  {
    trade_slug: "roofer",
    profile_slug: "demo-gary-singh-roofer-leicester",
    display_name: "Gary Singh",
    trading_name: "Singh Roofing & Leadwork",
    city: "Leicester",
    postcode_prefix: "LE2",
    whatsapp: "+44 7700 901034",
    email: "gary@singhroofing.co.uk",
    bio: "I've been on roofs for 19 years — started as a labourer for a flat-roof firm in Leicester at 18 and worked my way to running my own crew of three. We cover Leicester, Loughborough, Hinckley and Market Harborough doing slate and tile re-roofs, flat-roof EPDM and GRP, leadwork on chimneys and valleys, and emergency repairs. NFRC member which means inspections are independent and any work over £500 is covered by a 10-year insurance-backed guarantee. I don't sub-contract — my three lads have all been with me five years plus and we run a clean tidy site. If you've had a leak after a storm I'll be honest about whether it's a £200 fix or a sign your roof has had its day. I'll show you photos from the roof too — most homeowners never see what's actually up there.",
    years_in_trade: 19,
    start_year: 2007,
    priced_services: [
      { name: "Full re-roof (3-bed semi, concrete tiles)", price: 8500, unit: "from", description: "Strip existing, new felt and battens, new concrete interlocking tiles, ridge tiles in mortar or dry-fix, fascia and soffit upgrade." },
      { name: "Slipped tile / slate repair", price: 290, unit: "from", description: "Replace 1-3 slipped tiles, includes scaffolding tower if needed. Same-day for storm damage where possible." },
      { name: "Flat roof EPDM rubber install (per sqm)", price: 95, unit: "per sqm", description: "Strip old felt, OSB deck, EPDM single-sheet, trims and flashings. 20-year manufacturer guarantee. Minimum 8sqm." },
      { name: "GRP fibreglass flat roof (per sqm)", price: 105, unit: "per sqm", description: "Strip old, ply deck, two-layer GRP fibreglass topcoat. 25-year guarantee. Minimum 6sqm." },
      { name: "Chimney repoint + flashing renewal", price: 850, unit: "from", description: "Repoint stack in lime or sand-cement, renew lead apron and step flashings. Scaffolding included on standard 2-storey." },
      { name: "Gutter clean + minor repair (per house)", price: 145, unit: "from", description: "Clear all gutters and downpipes, refix any loose brackets, seal joint leaks. Typical semi." },
      { name: "Velux window install (existing roof)", price: 1450, unit: "from", description: "Cut in and install standard Velux window in existing pitched roof, flashing kit, finished outside. Internal trim by carpenter." }
    ],
    faq_items: [
      { q: "Do I really need a new roof?", a: "If you've got missing or slipped tiles in multiple areas, mortar pointing on the ridge crumbling, sagging between trusses, or sarking felt that's perished — yes. If it's one area I can localise the repair. I'll show you photos and you decide." },
      { q: "What's the difference between EPDM and GRP?", a: "EPDM is a rubber sheet — flexible, deals well with movement, easier to repair. GRP is fibreglass laid in resin — harder wearing, looks more like a finished surface, slightly more expensive. Both 20+ year materials." },
      { q: "Will I need scaffolding?", a: "For anything more than a quick tile slip yes — Working at Height regs are not optional. A roof-edge protection scaff for a re-roof is typically £600-£900 extra and quoted separately so you can see it." },
      { q: "How long does a re-roof take?", a: "Standard 3-bed semi is 5-7 working days weather-dependent. We always tarp at the end of each day so you're never exposed if rain comes." },
      { q: "Do you give a guarantee?", a: "Yes — 10 years on workmanship plus manufacturer warranties on materials. NFRC insurance-backed guarantee on jobs over £500 means even if I retire it's covered." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: [
      "NVQ Level 3 Roofing Occupations",
      "CSCS Skilled Worker Card",
      "Working at Height Certification",
      "CITB Site Safety Plus"
    ],
    trade_memberships: ["NFRC (National Federation of Roofing Contractors)", "CompetentRoofer"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 200,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Repairs same week. Re-roofs 4-6 weeks weather-dependent.",
    availability: "this_week",
    reviews: [
      { customer_name: "Anne T.", rating: 5, title: "Re-roof done in 6 days", body: "Gary's crew stripped and re-tiled the whole house. Tarped every night, swept the garden clean. New ridge tiles look beautiful.", service_name: "Full re-roof (3-bed semi, concrete tiles)", project_type: "renovation" },
      { customer_name: "Dev K.", rating: 5, title: "Leak fixed same day", body: "Phoned at 8am after a storm. Gary was on the roof by 11, slipped tiles back, leak gone. £290 well spent.", service_name: "Slipped tile / slate repair", project_type: "repair" },
      { customer_name: "Joe B.", rating: 5, title: "Flat roof on the extension", body: "EPDM single sheet, no joins, the trims look really sharp. 20 year warranty registered with the supplier the next day.", service_name: "Flat roof EPDM rubber install (per sqm)", project_type: "new_build" },
      { customer_name: "Carol R.", rating: 4, title: "Chimney sorted, ran a day over", body: "Chimney was leaking badly. Gary repointed and renewed all the lead flashings. Job ran a day over for weather but no extra cost.", service_name: "Chimney repoint + flashing renewal", project_type: "repair" }
    ]
  },

  // 11. BRICKLAYER
  {
    trade_slug: "bricklayer",
    profile_slug: "demo-craig-walters-bricklayer-nottingham",
    display_name: "Craig Walters",
    trading_name: "Walters Brickwork",
    city: "Nottingham",
    postcode_prefix: "NG7",
    whatsapp: "+44 7700 901156",
    email: "craig@waltersbrickwork.co.uk",
    bio: "Started laying brick at 17 on a Persimmon site near Mansfield. Twenty-three years on I run my own crew of two and we do mostly extensions, garden walls, chimney rebuilds and feature brickwork around Notts and Derbyshire. I've laid every brick from London Stock to Staffordshire blue and I take pride in a tight perp and a flush joint. We work to set-out drawings from your architect — if you don't have any I can do basic measured drawings for small jobs. I'm fussy about mortar — wrong mix on a heritage building can ruin it, and most price-driven builders use whatever's cheap. I'll spec the mortar to suit the brick. I'm also a CSCS Gold supervisor card holder so I can run my own subbie team on bigger jobs. Quotes are itemised with brick count, mortar, lintels, DPC and lead times for any specials.",
    years_in_trade: 23,
    start_year: 2003,
    priced_services: [
      { name: "Single-storey extension shell (4x5m)", price: 7500, unit: "from", description: "Foundations included, cavity wall to wall-plate height, lintels, weep vents, cavity tray, DPC. Excludes roof, render, internal trades." },
      { name: "Garden wall (per linear m, 1.2m high)", price: 285, unit: "per linear m", description: "Single skin or cavity per spec, concrete foundation, brick-on-edge coping or saddleback. Standard brick choice." },
      { name: "Chimney stack rebuild (above roofline)", price: 1850, unit: "from", description: "Take down to roof level, rebuild in matching brick, new flaunching and pots. Scaffolding extra." },
      { name: "Feature brick pier (per pier, 600x600)", price: 480, unit: "per item", description: "Garden gate pier or driveway entrance pier, concrete foundation, brick + pier cap." },
      { name: "Knock-through with structural opening", price: 1650, unit: "from", description: "Form structural opening for door or wide opening in load-bearing wall. Includes RSJ, padstones, propping. Engineer's calc needed." },
      { name: "Repointing (per sqm, lime mortar)", price: 95, unit: "per sqm", description: "Rake out old mortar to 25mm, repoint in lime putty mortar matching original. Heritage spec." },
      { name: "Repointing (per sqm, sand-cement)", price: 55, unit: "per sqm", description: "Standard sand-cement repoint for modern brickwork. Rake out, repoint, weather-strike finish." }
    ],
    faq_items: [
      { q: "Do you do the foundations or just the bricks?", a: "I do the whole shell including footings — easier to have one trade handle ground to wall plate. If your job needs deep piles or raft I bring in a groundworker." },
      { q: "Why is lime mortar more expensive than sand-cement?", a: "It's slower work — needs protecting from sun and rain, two-coat application, longer cure. But on any brick built before about 1920 it's the correct material. Cement on soft Victorian brick will crack the brick face inside 10 years." },
      { q: "Can you match my existing bricks?", a: "Mostly yes. Reclaimed yards in the Midlands have good stocks of Victorian stocks, blues and reds. Modern bricks are easier — I match to nearest current product." },
      { q: "Do you do block work too?", a: "Yes — cavity walls are brick outer leaf, block inner. I lay both. Pure block work like a garage wall I'll quote happily." },
      { q: "Do I need Building Control for a garden wall?", a: "Under 1m no. Over 1m adjacent to a highway needs sign-off. Boundary walls over 2m need planning. I'll flag it on the quote." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "NVQ Level 3 Trowel Occupations (Bricklaying)",
      "CSCS Gold Supervisor Card",
      "CITB SSSTS Supervisor",
      "Heritage Skills (Lime Mortar)"
    ],
    trade_memberships: ["Guild of Bricklayers"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 350,
    free_site_visits: true,
    quote_availability: "Quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 4-6 weeks for extensions. Smaller walls 2-3 weeks.",
    availability: "later",
    reviews: [
      { customer_name: "Robert F.", rating: 5, title: "Extension brickwork is immaculate", body: "Craig's brickwork on our extension is the talk of the street. Perp joints dead vertical, flush pointing, beautiful colour match to the original 1930s house.", service_name: "Single-storey extension shell (4x5m)", project_type: "new_build" },
      { customer_name: "Hannah G.", rating: 5, title: "Garden wall built to last", body: "30m of brick wall with saddleback coping. Properly footed, beautiful look. Two years on not a crack.", service_name: "Garden wall (per linear m, 1.2m high)", project_type: "new_build" },
      { customer_name: "Wesley A.", rating: 5, title: "Lime repointing on Victorian house", body: "Other quotes were going to use cement. Craig was the only one who said it had to be lime. Job took longer but it looks period-correct and the brick faces are protected.", service_name: "Repointing (per sqm, lime mortar)", project_type: "repair" },
      { customer_name: "Olivia M.", rating: 4, title: "Chimney rebuild, ran 2 days over", body: "Chimney came down in a storm. Craig rebuilt it spot on but weather delayed 2 days. Solid work though.", service_name: "Chimney stack rebuild (above roofline)", project_type: "repair" }
    ]
  },

  // 12. STONEMASON
  {
    trade_slug: "stonemason",
    profile_slug: "demo-george-pemberton-stonemason-york",
    display_name: "George Pemberton",
    trading_name: "Pemberton Stonemasonry",
    city: "York",
    postcode_prefix: "YO1",
    whatsapp: "+44 7700 901247",
    email: "george@pembertonstone.co.uk",
    bio: "I trained at York College on the heritage stone programme then served four years with one of the firms working on the Minster. Set up on my own in 2018 doing dressed limestone repair, ashlar walling, fireplace surrounds and traditional repointing on Yorkshire stone properties. Most of my work is around York, Harrogate, Ripon and the Dales — there's an endless supply of Georgian, Victorian and even older buildings that need careful hand-work rather than a rushed cement job. I cut by hand for small repair pieces and use a machined block for new ashlar where the design allows. Quotes are itemised per stone and I always show drawn details for new work — no point spending £4k on a fireplace surround if it doesn't sit right with the house. I work with conservation officers on listed buildings and have done five Heritage Lottery-funded projects.",
    years_in_trade: 14,
    start_year: 2012,
    priced_services: [
      { name: "Heritage repointing (lime mortar, per sqm)", price: 95, unit: "per sqm", description: "Rake out cement or failing lime to 25mm, repoint in NHL lime mortar matching original colour and finish. Sympathetic to listed buildings." },
      { name: "Indent stone repair (per piece, up to 0.3m)", price: 480, unit: "per item", description: "Cut out damaged stone, hand-shape new limestone or sandstone indent to match. Set in lime mortar." },
      { name: "Bespoke fireplace surround", price: 3800, unit: "from", description: "Designed and hand-carved limestone or sandstone surround. Includes drawing, fabrication, and install. 8-12 week lead time." },
      { name: "Ashlar walling (per sqm)", price: 285, unit: "per sqm", description: "Coursed ashlar in machined stone, lime mortar bedding. For garden walls or new-build feature walls." },
      { name: "Dry stone walling (per sqm)", price: 175, unit: "per sqm", description: "Traditional dry stone wall in local stone. Foundations and through-stones included. Yorkshire Dales spec." },
      { name: "Stone window cill replacement", price: 650, unit: "from", description: "Cut out failed cill, fabricate replacement in matching stone, bed and point in lime. Per standard cill." },
      { name: "Heritage survey + report", price: 380, unit: "fixed", description: "Written report on condition of stonework with photos, repair recommendations and cost outline. Useful for grant applications." }
    ],
    faq_items: [
      { q: "Why is lime mortar essential on old stone?", a: "Old stone is soft and absorbs and releases water with the seasons. Cement is hard and traps moisture, forcing it to push out through the stone face and erode it. Lime is sacrificial — it crumbles slowly so the stone doesn't have to." },
      { q: "Can you match my existing stone?", a: "York stone is local and I have a network of yards. Cotswold limestone, Bath stone, Portland — all standard. Reclaimed stone is preferred where possible for colour match." },
      { q: "Do I need listed-building consent for repointing?", a: "If you're listed yes — even like-for-like usually needs consent. I can write the application or work alongside your conservation officer." },
      { q: "How long does a fireplace surround take?", a: "8-12 weeks from sign-off. Drawing 1 week, stone delivery 3-4 weeks, fabrication 2-3 weeks, install 1 week." },
      { q: "Is dry stone walling really cheaper than mortar work?", a: "Per metre it's actually similar — the labour is intense even without mortar. But it lasts centuries with no maintenance, so over the long run, yes." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "City & Guilds Heritage Skills (Stonemasonry)",
      "NVQ Level 3 Stonemasonry",
      "CSCS Card",
      "CITB Working at Height"
    ],
    trade_memberships: ["Stone Federation Great Britain", "Society for the Protection of Ancient Buildings (SPAB)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 350,
    free_site_visits: true,
    quote_availability: "Quotes within 72 hours",
    quote_turnaround_hours: 72,
    current_status_note: "Booking 6-8 weeks. Listed building work prioritised in date order.",
    availability: "later",
    reviews: [
      { customer_name: "Charles W.", rating: 5, title: "Repointing on our Georgian townhouse", body: "Two previous masons used cement which was eating into the soft stone. George took it all back to lime, matched the original colour perfectly. House looks 100 years younger.", service_name: "Heritage repointing (lime mortar, per sqm)", project_type: "renovation" },
      { customer_name: "Margaret L.", rating: 5, title: "Fireplace is a centrepiece", body: "Hand-carved limestone surround with traditional moulding details. Took 10 weeks but it's a work of art. Visitors think it's original to the house.", service_name: "Bespoke fireplace surround", project_type: "renovation" },
      { customer_name: "Tim H.", rating: 5, title: "Cill replacement", body: "Crumbling sandstone cill on our 1850s house. George cut and fitted a matching replacement — invisible repair.", service_name: "Stone window cill replacement", project_type: "repair" },
      { customer_name: "Lara P.", rating: 4, title: "Wall took longer than quoted", body: "Beautiful dry stone wall in the garden. Job ran a week over because of stone supply delays. Final result is stunning though.", service_name: "Dry stone walling (per sqm)", project_type: "new_build" }
    ]
  },

  // 13. GROUNDWORKER
  {
    trade_slug: "groundworker",
    profile_slug: "demo-darren-mccormack-groundworker-belfast",
    display_name: "Darren McCormack",
    trading_name: "McCormack Groundworks",
    city: "Belfast",
    postcode_prefix: "BT9",
    whatsapp: "+44 7700 901338",
    email: "darren@mccormackgroundworks.co.uk",
    bio: "I started out as a digger driver at 19, learned the trade properly over a decade on housing sites, then went out as a subbie groundworker in 2015. We're a four-man crew with two 3-tonne excavators, a dumper, a whacker and a roller — equipment to handle any small-to-medium domestic or light commercial site. Day to day we do foundations and footings for extensions, drainage runs, driveways, retaining walls and site clearance. I'm SMSTS qualified so I can manage the groundworks package on my own without you needing a separate site manager. Site safety is non-negotiable — RAMS for every job, daily briefings, full PPE. I'll always do a measured site visit before quoting because ground conditions vary wildly — I've had jobs where what looked like soil 30cm down was actually old building rubble and shifted the foundation spec entirely.",
    years_in_trade: 15,
    start_year: 2011,
    priced_services: [
      { name: "Extension foundations (4x5m strip footings)", price: 3800, unit: "from", description: "Excavate, install reinforcement, pour and finish strip foundations. Includes spoil removal. Excludes Building Control fees." },
      { name: "Concrete raft foundation (per sqm)", price: 165, unit: "per sqm", description: "Reinforced concrete raft for poor ground or extensions. Includes DPM, reinforcement and finish." },
      { name: "Drainage run (per linear m)", price: 95, unit: "per linear m", description: "Foul or surface water drain, excavate, lay pipe, gravel bed, backfill. Includes inspection chamber if needed." },
      { name: "Driveway (block paving, per sqm)", price: 145, unit: "per sqm", description: "Excavate, lay sub-base, sand bed, block pavers, edge restraint. Includes drainage gully where needed." },
      { name: "Driveway (resin-bonded, per sqm)", price: 85, unit: "per sqm", description: "Over existing sound base, resin-bonded aggregate finish. Permeable, no planning needed up to 50sqm." },
      { name: "Retaining wall (concrete, per linear m at 1m high)", price: 480, unit: "per linear m", description: "Reinforced concrete retaining wall with engineered base. Engineer's calc included." },
      { name: "Site clearance / muck-away", price: 380, unit: "per day", description: "Day rate including 3-tonne excavator + dumper + operator. Grab lorry hire extra at cost." }
    ],
    faq_items: [
      { q: "Do you need an engineer for foundations?", a: "For standard depths in known ground, no. For trees within influence distance, sloping sites, made ground or anything over 1.5m deep — yes, you'll need a structural engineer's design. I can recommend three I work with regularly." },
      { q: "How deep do foundations need to be?", a: "Building Control standard is usually 1m for shrinkable clay sites. Less for chalk or sand. Trees nearby push depths to 2m+. We never guess — we use the NHBC chart or get an engineer's calc." },
      { q: "Can you do drainage to the main sewer?", a: "Yes — we connect to NI Water adoption sewers all the time. Connection fee paid to NI Water separately, currently around £550 for a domestic connection." },
      { q: "What's the difference between block paving and resin?", a: "Block paving is more traditional, more expensive, longer lifespan (25+ years). Resin is faster to install, looks contemporary, lasts 15-20 years. Both permeable so no planning issue." },
      { q: "Do you remove the spoil?", a: "Yes — included in quoted prices unless we specifically say otherwise. Grab lorry or skip depending on volume. You should never have to sort that out yourself." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: [
      "CPCS Excavator (360 above 5T)",
      "CPCS Dumper",
      "CITB SMSTS Site Manager",
      "NPORS Roller"
    ],
    trade_memberships: ["Federation of Master Builders (FMB)", "CHAS Accredited"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 500,
    free_site_visits: true,
    quote_availability: "Quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 3-5 weeks ahead. Emergency drainage same week.",
    availability: "later",
    reviews: [
      { customer_name: "Patrick K.", rating: 5, title: "Foundations bang on", body: "Darren's crew dug, laid steel and poured our extension footings in two days. Building Control inspector said the rebar layout was textbook. Spoil all removed.", service_name: "Extension foundations (4x5m strip footings)", project_type: "new_build" },
      { customer_name: "Niamh O.", rating: 5, title: "Drive looks brilliant", body: "60sqm of block paving down in 4 days. Edges neat, drainage gully positioned perfectly, no puddles. Two winters on still perfect.", service_name: "Driveway (block paving, per sqm)", project_type: "renovation" },
      { customer_name: "Stuart M.", rating: 5, title: "Drainage fixed the flooding", body: "Garden flooded every winter. Darren put in a French drain and surface water run to the main sewer. Dry as a bone since.", service_name: "Drainage run (per linear m)", project_type: "repair" },
      { customer_name: "Aisling B.", rating: 4, title: "Retaining wall took longer", body: "Big retaining wall in the garden. Engineering calc and concrete pour all spot on but project ran a week over due to wet weather. Solid build.", service_name: "Retaining wall (concrete, per linear m at 1m high)", project_type: "new_build" }
    ]
  },

  // 14. GENERAL BUILDER
  {
    trade_slug: "general-builder",
    profile_slug: "demo-paul-richardson-general-builder-cardiff",
    display_name: "Paul Richardson",
    trading_name: "Richardson Building Services",
    city: "Cardiff",
    postcode_prefix: "CF14",
    whatsapp: "+44 7700 901429",
    email: "paul@richardsonbuilding.co.uk",
    bio: "I've been in the trade since I left school 25 years ago — started as a bricklayer's labourer, did my NVQ Level 3 in trowel occupations, then broadened out to a full general builder. We're a six-man firm covering Cardiff, Newport and the Vale of Glamorgan doing extensions, loft conversions, full renovations and the odd new build. I project-manage everything end to end — architects, structural engineers, Building Control, all the subbies. You get one point of contact (me) and one written quote covering the whole job. I'm FMB registered which means I'm independently vetted, financially checked and you get an FMB warranty on jobs over £5k. I run two builds at a time max — anything more and quality slips. I'll never give you the cheapest quote but I'll always show you exactly what's included down to the brick.",
    years_in_trade: 25,
    start_year: 2001,
    priced_services: [
      { name: "Single-storey rear extension (4x5m)", price: 48000, unit: "from", description: "Full turnkey extension — foundations to plaster-ready. Includes all trades, materials, Building Control fees. Excludes kitchen + decor." },
      { name: "Loft conversion (standard 3-bed semi)", price: 42000, unit: "from", description: "Full loft conversion with dormer, ensuite, staircase. Includes structural, electrical, plumbing, plaster-ready. Excludes carpets + decor." },
      { name: "Full house renovation (3-bed)", price: 95000, unit: "from", description: "Strip back, rewire, replumb, replaster, new kitchen and bathroom, decoration. Plan 12-16 weeks." },
      { name: "Garage conversion to living space", price: 18500, unit: "from", description: "Insulate, dryline, level floor, infill door, new window, heating, electrics, plaster-ready. Excludes Building Control fees." },
      { name: "Knock-through (load-bearing wall)", price: 4200, unit: "from", description: "Structural opening including engineer, RSJ, padstones, propping, making good. Standard domestic opening." },
      { name: "Project management only (% of build cost)", price: 8, unit: "per item", description: "8% project management fee if you're managing the trades yourself but want me to oversee. Min £4000." },
      { name: "Detached double garage (single storey)", price: 32000, unit: "from", description: "Foundations to roof, brick, block, tiled roof, single up-and-over door. Excludes drive + electrics." }
    ],
    faq_items: [
      { q: "Do I need planning permission for an extension?", a: "Most single-storey rear extensions up to 4m on a detached house, 3m on a semi/terrace, fall under permitted development. Beyond that or in a conservation area you'll need planning. I'll advise on the visit." },
      { q: "How long does a typical extension take?", a: "From breaking ground to plaster-dry: 12-16 weeks for a standard single-storey. Two-storey adds 4 weeks. Loft conversions 10-14 weeks." },
      { q: "What's the FMB warranty?", a: "Insurance-backed warranty covering up to £100k of building defects for 2 years on jobs over £5k. If I went bust mid-job, FMB find another member to finish it." },
      { q: "Do you handle Building Control?", a: "Yes — I appoint Building Control (LABC or approved inspector), arrange inspections at each stage, and you get the completion certificate at the end. Fees are quoted separately." },
      { q: "Can I live in the house during the build?", a: "Extensions yes — we seal off the build area. Full renovations no, usually 6-8 weeks where the house isn't habitable. Plan to move out or budget for a rental." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: [
      "NVQ Level 3 Trowel Occupations",
      "CITB SMSTS Site Manager",
      "CSCS Gold Card",
      "Asbestos Awareness"
    ],
    trade_memberships: ["Federation of Master Builders (FMB)", "TrustMark", "CHAS Accredited"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 2000,
    free_site_visits: true,
    quote_availability: "Quotes within 5 working days",
    quote_turnaround_hours: 72,
    current_status_note: "Booking 3-4 months for major projects. Smaller works 6-8 weeks.",
    availability: "later",
    reviews: [
      { customer_name: "Geraint M.", rating: 5, title: "Extension finished on schedule", body: "Paul ran a tight site for 14 weeks. Communicated weekly with photos and a running cost sheet. Came in £600 under quote at the end which I've never had before.", service_name: "Single-storey rear extension (4x5m)", project_type: "new_build" },
      { customer_name: "Bethan H.", rating: 5, title: "Loft conversion transformed our house", body: "Master bedroom and ensuite up in the loft. Stairs landing tricky — Paul's joiner did a beautiful job. Whole job 12 weeks.", service_name: "Loft conversion (standard 3-bed semi)", project_type: "renovation" },
      { customer_name: "Owen L.", rating: 5, title: "Full house renovation", body: "Bought a wreck. Paul stripped, rewired, replumbed, replastered and we moved in 15 weeks later. Honest with costs throughout, no nasty surprises.", service_name: "Full house renovation (3-bed)", project_type: "renovation" },
      { customer_name: "Ffion D.", rating: 4, title: "Garage conversion ran 1 week over", body: "Lovely room. Weather pushed start by a week which meant a week-long delay at the end. Quality of finish is excellent.", service_name: "Garage conversion to living space", project_type: "renovation" }
    ]
  },

  // 15. CONCRETE SPECIALIST
  {
    trade_slug: "concrete-specialist",
    profile_slug: "demo-paolo-rossi-concrete-specialist-coventry",
    display_name: "Paolo Rossi",
    trading_name: "Rossi Concrete & Formwork",
    city: "Coventry",
    postcode_prefix: "CV5",
    whatsapp: "+44 7700 901517",
    email: "paolo@rossiconcrete.co.uk",
    bio: "Concrete has been my world for 16 years — started on commercial slab pours for a national contractor in the Midlands, learned formwork, reinforcement and shutter design, then went solo in 2018. I cover the West Midlands doing structural concrete work: house foundations, basements, retaining walls, slab pours, garage bases. We design our own shutters, set our own rebar, and pour pump-truck deliveries from Hanson and Tarmac. Formwork is what separates a clean job from a messy one — if your shutters are right the concrete looks right. I'll always quote with a proper rebar schedule and a concrete spec (C30, C32/40 etc) so you know what you're getting. If a job needs a structural engineer's design I'll work to it; for simple bases I can spec myself within standard NHBC guidance.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "House foundations / strip footings (per linear m)", price: 165, unit: "per linear m", description: "Excavate, rebar, formwork, pour C30 concrete to 1m depth. Includes spoil removal." },
      { name: "Basement structural pour (per sqm)", price: 480, unit: "per sqm", description: "Reinforced concrete basement walls and slab to engineer's spec. Tanking membrane separately." },
      { name: "Concrete slab base (per sqm)", price: 75, unit: "per sqm", description: "Hardcore base, DPM, mesh, 100mm power-floated slab. For garages, sheds, outbuildings." },
      { name: "Retaining wall (cast in-situ, per sqm face)", price: 380, unit: "per sqm", description: "Engineered reinforced retaining wall, formwork both sides, pour and strip. Per sqm of face area." },
      { name: "Concrete driveway (per sqm)", price: 95, unit: "per sqm", description: "Hardcore base, mesh reinforcement, 150mm slab, broom or pattern finish, expansion joints." },
      { name: "Bespoke formwork only (day rate)", price: 380, unit: "per day", description: "Day rate for setting formwork for a sub-contractor pour. Includes two carpenters and shutter materials at cost." },
      { name: "Reinforcement bending + tying (per tonne)", price: 950, unit: "per item", description: "Per tonne of rebar — cut, bent, delivered and tied on site to schedule. Minimum 500kg." }
    ],
    faq_items: [
      { q: "What's the difference between C30 and C40 concrete?", a: "Numbers refer to strength in newtons/sqmm. C30 is standard domestic — foundations, drives. C32/40 is for structural loads — basement walls, retaining walls, RC frames. Wrong mix is unsafe and Building Control will reject it." },
      { q: "Do I need an engineer for a basement?", a: "Always. Soil pressure on a basement wall is non-trivial, waterproofing strategy needs a specialist designer. I don't pour basements without an engineer's drawings." },
      { q: "How long does concrete take to cure?", a: "70% strength at 7 days, 90% at 28 days. You can take formwork off a slab the next day. Walls need 5-7 days before you can backfill against them. Final design strength assumed at 28 days." },
      { q: "Can I have an exposed concrete finish?", a: "Yes — polished concrete or board-marked finish are both options. Polished needs a finisher specialist (I work alongside one). Board-marked you get with rough-sawn shutter timber." },
      { q: "What about cracks?", a: "All concrete cracks microscopically — that's why we use rebar and mesh. Visible structural cracks shouldn't appear if the mix and curing were right. If you see one I come back to assess at no charge." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: [
      "NVQ Level 3 Construction (Concrete)",
      "CSCS Gold Card",
      "CITB SMSTS",
      "CPCS Slinger/Signaller"
    ],
    trade_memberships: ["Concrete Society"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 800,
    free_site_visits: true,
    quote_availability: "Quotes within 72 hours",
    quote_turnaround_hours: 72,
    current_status_note: "Booking 4-6 weeks. Small slab pours sometimes slotted in faster.",
    availability: "later",
    reviews: [
      { customer_name: "Andy F.", rating: 5, title: "Basement pour was textbook", body: "5m x 6m basement under our extension. Paolo designed the shutters, set the rebar to the engineer's spec and poured in two stages. Inspection passed first time. Waterproofing has been bone dry for 2 winters.", service_name: "Basement structural pour (per sqm)", project_type: "new_build" },
      { customer_name: "Suresh P.", rating: 5, title: "Garage slab solid as anything", body: "60sqm slab for a triple garage. Power-floated finish is dead level. Could lay tiles straight on it.", service_name: "Concrete slab base (per sqm)", project_type: "new_build" },
      { customer_name: "Megan R.", rating: 5, title: "Foundations on time", body: "House foundations across 32m of perimeter. Two days of digging and steel, one day to pour. Inspector signed off no issues.", service_name: "House foundations / strip footings (per linear m)", project_type: "new_build" },
      { customer_name: "Gareth W.", rating: 4, title: "Retaining wall ran a day over", body: "Big retaining wall (2.5m high). Concrete delivery from the plant was delayed by half a day which pushed strip-out into the following morning. Final result is rock solid." , service_name: "Retaining wall (cast in-situ, per sqm face)", project_type: "new_build" }
    ]
  },

  // 16. RENDERER
  {
    trade_slug: "renderer",
    profile_slug: "demo-sophie-blackwell-renderer-brighton",
    display_name: "Sophie Blackwell",
    trading_name: "Blackwell Render Co",
    city: "Brighton",
    postcode_prefix: "BN2",
    whatsapp: "+44 7700 901625",
    email: "sophie@blackwellrender.co.uk",
    bio: "I came into rendering through plastering — did my Level 2 plastering NVQ, then a specialist Level 3 external render course at South Downs College, then four years on commercial new-builds before going solo in 2019. I cover Brighton, Hove, Worthing and inland Sussex doing silicone, monocouche, K-rend and traditional sand-cement render. The South Coast climate is salty and wet, which kills cheap render fast — I only spec systems with proper breathable basecoats and modern finishes that flex with the building. Anything less is throwing money away. I scaffold-up properly (subbed to a NASC firm), mesh-reinforce every basecoat, and detail beads at every corner and reveal. I won't render directly onto bare brick without prep — that's the most common reason render falls off three years later.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Silicone render (full house, per sqm)", price: 85, unit: "per sqm", description: "Two-coat polymer basecoat with mesh, silicone topcoat. Through-coloured, hydrophobic, 25-year life. Excludes scaffold." },
      { name: "Monocouche render (per sqm)", price: 65, unit: "per sqm", description: "Single-coat through-coloured render — sprayed and floated. White, off-white or coloured. Faster than two-coat systems." },
      { name: "K-rend silicone (per sqm)", price: 75, unit: "per sqm", description: "K-rend Silicone TC — popular brand, range of colours, self-cleaning finish." },
      { name: "Sand-cement render + paint (per sqm)", price: 55, unit: "per sqm", description: "Traditional two-coat sand-cement render with masonry paint topcoat. Cheaper but needs repainting every 8-10 years." },
      { name: "Insulated render system (EWI, per sqm)", price: 195, unit: "per sqm", description: "100mm EPS or mineral wool insulation, mesh basecoat, silicone topcoat. External wall insulation system, transforms thermal performance." },
      { name: "Repair patch + repaint", price: 480, unit: "from", description: "Cut out failed area, render and feather in, repaint full elevation. Typical small repair." },
      { name: "Brick painting / masonry paint (per sqm)", price: 18, unit: "per sqm", description: "Pressure wash, stabilising solution, two coats breathable masonry paint. Cheaper than render for a refresh." }
    ],
    faq_items: [
      { q: "Why do some renders fall off after a few years?", a: "Usually because the brick wasn't prepped properly, no mesh in the basecoat, or a cement render was applied to a building that needed something breathable. South Coast salt-air punishes weak systems." },
      { q: "Silicone or monocouche — which should I choose?", a: "Silicone is more expensive but more flexible, better for cracks and movement, hydrophobic so it self-cleans. Monocouche is faster and cheaper but more rigid — fine on stable substrates. I'll spec what's right for your building." },
      { q: "Can render fix damp?", a: "It can stop water ingress through cracked brick or pointing, yes. But internal damp from rising or condensation it won't fix — that needs different treatment. I'll do a damp survey on the visit." },
      { q: "How long does a house render take?", a: "Typical 3-bed semi (about 100sqm of wall): 7-10 days including drying between coats. Weather matters — silicone won't go on below 5C or above 30C." },
      { q: "Will it crack?", a: "Modern polymer-modified renders flex with the building. Hairline crazing isn't structural and is normal. Big cracks mean substrate movement (settlement, frost) — I'll diagnose before quoting if you've had cracks before." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "City & Guilds NVQ Level 2 Plastering",
      "NVQ Level 3 External Wall Insulation",
      "CSCS Card",
      "K-rend Approved Installer"
    ],
    trade_memberships: ["The Federation of Plastering and Drywall Contractors", "INCA (Insulated Render & Cladding Association)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 350,
    free_site_visits: true,
    quote_availability: "Quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 4-6 weeks, weather permitting. Best season Apr-Oct.",
    availability: "later",
    reviews: [
      { customer_name: "Daniel V.", rating: 5, title: "House looks brand new", body: "Full silicone render in a beautiful warm white. Crisp lines, perfect beads at the reveals. Two winters on no cracks or staining.", service_name: "Silicone render (full house, per sqm)", project_type: "renovation" },
      { customer_name: "Annabel S.", rating: 5, title: "EWI dropped our heating bill", body: "Solid-wall Victorian house, no insulation. EWI system transformed how warm it feels and the silicone topcoat looks beautiful. Bills are about £600/year lower.", service_name: "Insulated render system (EWI, per sqm)", project_type: "renovation" },
      { customer_name: "Marcus E.", rating: 4, title: "Monocouche, weather delay", body: "Job started 5 days late due to rain. Sophie kept us informed. Once it started, the work was excellent. Wall looks great." , service_name: "Monocouche render (per sqm)", project_type: "renovation" },
      { customer_name: "Lou W.", rating: 5, title: "Patch repair invisible", body: "Big chunk of render fallen off after a frost. Sophie patched and repainted the whole elevation so you can't see the join.", service_name: "Repair patch + repaint", project_type: "repair" }
    ]
  },

  // 17. TAPER & FINISHER
  {
    trade_slug: "taper-and-finisher",
    profile_slug: "demo-kevin-doyle-taper-and-finisher-southampton",
    display_name: "Kevin Doyle",
    trading_name: "Doyle Tape & Finish",
    city: "Southampton",
    postcode_prefix: "SO15",
    whatsapp: "+44 7700 901714",
    email: "kevin@doyletapefinish.co.uk",
    bio: "I'm a specialist taper and finisher — that is, I tape and fill plasterboard joints to a paint-ready Level 4 or Level 5 finish, US-style, instead of skim. It's a finish you see more in offices, hotels and high-end residential where you want a perfectly flat wall with no skim texture. I trained in the Republic of Ireland where it's the standard residential finish, moved to the UK in 2014, and have run my own crew of two since 2018. Most of my work is commercial fit-out and new-build apartments around Southampton, Portsmouth and the M3 corridor. I run a proper finishing kit — banjos, automatic taping tools, sanders with HEPA filtration. The dust on a tape-and-fill job is no joke and the wrong sander turns a house into a chalk pit. I quote per sqm of board face with a clear spec of which Level finish.",
    years_in_trade: 14,
    start_year: 2012,
    priced_services: [
      { name: "Tape + 3 coat finish to Level 4 (per sqm)", price: 18, unit: "per sqm", description: "Standard finish for matt paint walls. Tape joints, three coats of compound, sanded smooth. Ready to prime." },
      { name: "Tape + 4 coat skim to Level 5 (per sqm)", price: 28, unit: "per sqm", description: "Premium finish for gloss paint, sheen finishes or critical light. Skim coat over entire surface, ultra-flat result." },
      { name: "Ceiling tape + finish (per sqm)", price: 22, unit: "per sqm", description: "Same Level 4 finish but on ceilings — harder and slower work. Per sqm ceiling area." },
      { name: "Patch repair (per patch up to 1sqm)", price: 75, unit: "from", description: "Repair holes, cracks or damaged joints. Tape and three-coat finish blended in. Per patch." },
      { name: "Corner bead install + finish (per linear m)", price: 9, unit: "per linear m", description: "Metal or paper-faced corner bead, three-coat finish. Per linear m of external corner." },
      { name: "Day rate (large commercial)", price: 320, unit: "per day", description: "Day rate per finisher for ongoing fit-out work. Min 5 days booking." },
      { name: "Sand + prep existing finish (per sqm)", price: 8, unit: "per sqm", description: "Existing tape-and-fill walls that need sanding flat ready for paint. Per sqm wall area." }
    ],
    faq_items: [
      { q: "What's the difference between tape-and-fill and a skim plaster finish?", a: "Skim is wet plaster applied to the whole wall — slight texture, traditional UK finish. Tape and fill leaves the board face exposed with only the joints filled and feathered, so you see the paper-faced board. Both are paint-ready when done well." },
      { q: "Which is better, tape-and-fill or skim?", a: "Neither — they're different. Skim hides minor board damage better. Tape and fill is faster on big areas, cheaper, and gives a flatter finish for critical light. Most US construction uses tape-and-fill. Most UK residential is skim." },
      { q: "What's a Level 5 finish?", a: "Industry standard scale from 0-5. Level 4 is the standard for matt paint. Level 5 is a thin skim over the entire wall so even joint shadows under raking light disappear. Specified for gloss paint, glossy sheen and critical light areas." },
      { q: "Do you do skim plaster too?", a: "No — I'd recommend a plasterer for that. I'm pure tape-and-fill. Half the cost of doing both badly is paying for two separate specialists." },
      { q: "How much dust will there be?", a: "I use HEPA-vacuumed dustless sanders so it's very controlled. Some fine dust always escapes but you won't be cleaning bookshelves for weeks. I sheet what I can't move." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "NVQ Level 2 Drylining (Tape and Finish)",
      "CSCS Card",
      "Asbestos Awareness (UKATA)"
    ],
    trade_memberships: ["The Finishes & Interiors Sector (FIS)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 200,
    free_site_visits: true,
    quote_availability: "Quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 2-3 weeks ahead. Commercial fit-outs prioritised in date order.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Emily H.", rating: 5, title: "Walls are like glass", body: "We wanted a US-style finish for our extension and Kevin nailed it. Level 5 finish under critical light — you cannot see a joint anywhere. Painter loved it.", service_name: "Tape + 4 coat skim to Level 5 (per sqm)", project_type: "new_build" },
      { customer_name: "Ryan T.", rating: 5, title: "Office fit-out finished in 4 days", body: "200sqm of board taped and finished in 4 days. Quick, clean, ready for paint Monday morning. Top job.", service_name: "Tape + 3 coat finish to Level 4 (per sqm)", project_type: "renovation" },
      { customer_name: "Hannah B.", rating: 5, title: "Ceiling looks unbelievable", body: "Big open-plan ceiling with skylights — every joint would have been visible under daylight. Kevin's Level 5 finish hides everything. Worth every penny.", service_name: "Ceiling tape + finish (per sqm)", project_type: "new_build" },
      { customer_name: "Phil D.", rating: 4, title: "Good work, dust was heavy", body: "Quality of finish is excellent. He sheeted up but the dust was still pretty heavy for a few days. Cleared up well at the end.", service_name: "Patch repair (per patch up to 1sqm)", project_type: "renovation" }
    ]
  },

  // 18. BUILDING MERCHANT
  {
    trade_slug: "building-merchant",
    profile_slug: "demo-stuart-kingsley-building-merchant-hull",
    display_name: "Stuart Kingsley",
    trading_name: "Kingsley Building Supplies",
    city: "Hull",
    postcode_prefix: "HU2",
    whatsapp: "+44 7700 901803",
    email: "trade@kingsleybuilding.co.uk",
    bio: "Kingsley Building Supplies has been on the same site in Hull since 2003 — my dad opened it and I took over in 2017. We're an independent merchant, not part of a chain, which means we can take a phone call at 6.30am from a builder who needs 50 lengths of 4x2 by 7am and actually do something about it. Stock includes cement, aggregates, bricks, blocks, timber, sheet materials, plumbing fittings and a fair bit of tooling. We deliver across East Yorkshire with our own three-truck fleet — same day for stock orders before 11am. Trade accounts welcome with 30-day terms after credit check. Prices are listed online and trade pricing is a clear percentage off — no opaque tier games. We're cheaper than Travis Perkins on probably 60% of our lines and we know every regular by name.",
    years_in_trade: 22,
    start_year: 2004,
    priced_services: [
      { name: "Cement (per bag, 25kg, Hanson)", price: 6, unit: "per item", description: "OPC Portland cement, trade price ex VAT. Bulk discount over 50 bags." },
      { name: "Class B engineering brick (per 1000)", price: 540, unit: "per item", description: "Standard B-class engineering bricks for foundations and DPC course. Per 1000, ex VAT. Pallet quantity." },
      { name: "Aircrete block 100mm (per item)", price: 1, unit: "per item", description: "Standard Thermalite block, 440x215x100mm. Pallet of 110 at trade pricing." },
      { name: "Timber 4x2 C24 (per linear m)", price: 2, unit: "per linear m", description: "Structural softwood, kiln dried, C24 grade. Per linear m, trade price ex VAT." },
      { name: "OSB3 sheet 18mm (per item)", price: 38, unit: "per item", description: "8x4 OSB3 board, 18mm. Per sheet, trade price ex VAT." },
      { name: "Delivery (East Yorkshire, per drop)", price: 35, unit: "per visit", description: "Standard local delivery within 15 miles of HU2 yard. Same-day if ordered before 11am." },
      { name: "Trade account setup", price: 0, unit: "fixed", description: "Free trade account application — 30-day terms after credit check. Online portal access for ordering + invoices." }
    ],
    faq_items: [
      { q: "Are your trade prices really cheaper than Travis Perkins?", a: "On most stock lines yes. We've cut overheads by being a single site with no fancy yard buildings. National chains have central buying power on some things — we beat them on timber, cement and bricks routinely, sometimes lose on niche fittings." },
      { q: "Do you deliver same day?", a: "Yes if your order is in before 11am and it's stock. Special order items 24-48 hours. We run three trucks across East Yorks." },
      { q: "Can I open a trade account?", a: "Yes — quick application form, credit check via Experian. 30-day terms once approved. Online portal for ordering and invoices." },
      { q: "Do you take returns?", a: "On unopened stock items within 14 days yes, full credit. Special-order items are 25% restocking fee unless still in original packaging." },
      { q: "Do you price-match the big chains?", a: "Show me a like-for-like quote with prices and stock numbers and I'll usually match it. Doesn't mean we'll race-to-the-bottom — but I want to keep regular builders coming back." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Builders Merchant Federation Course"],
    trade_memberships: ["Builders Merchants Federation (BMF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 50,
    free_site_visits: false,
    quote_availability: "Same-day quotes for stock items",
    quote_turnaround_hours: 12,
    current_status_note: "Stock available daily. Trade accounts open. Same-day delivery before 11am.",
    availability: "now",
    reviews: [
      { customer_name: "Tom K.", rating: 5, title: "Saved my project", body: "Phoned at 7am needing 30 sheets of OSB3 same day. Stuart had them on a truck and at site by 10. Wouldn't get that from a chain.", service_name: "OSB3 sheet 18mm (per item)", project_type: "renovation" },
      { customer_name: "Jay P.", rating: 5, title: "Best timber prices in Hull", body: "C24 4x2 is consistently the cheapest in East Yorks. Quality is good, no twisted lengths.", service_name: "Timber 4x2 C24 (per linear m)", project_type: "new_build" },
      { customer_name: "Mia L.", rating: 5, title: "Trade account set up in 2 days", body: "Easy form, credit check came back next day, 30-day terms. Online ordering portal is straightforward.", service_name: "Trade account setup", project_type: "renovation" },
      { customer_name: "Dan W.", rating: 4, title: "Engineering brick stock was low", body: "Wanted 4000 engineering bricks and only had 2500 in stock — special-order topped up in 3 days. Bit of a delay but Stuart was honest about it." , service_name: "Class B engineering brick (per 1000)", project_type: "new_build" }
    ]
  },

  // 19. METAL ENGINEER
  {
    trade_slug: "metal-engineer",
    profile_slug: "demo-jakub-novak-metal-engineer-stoke",
    display_name: "Jakub Novak",
    trading_name: "Novak Steel Fabrication",
    city: "Stoke-on-Trent",
    postcode_prefix: "ST4",
    whatsapp: "+44 7700 901892",
    email: "jakub@novaksteel.co.uk",
    bio: "I trained as a structural fabricator and welder in the Czech Republic — four-year apprenticeship covering MIG, TIG, MMA and structural — moved to the UK in 2011 and worked for two of the bigger steel fab firms in the Midlands before going on my own in 2019. I run a small workshop near Stoke doing structural steel for extensions and basements, bespoke staircases, balustrades, gates, railings and the odd architectural piece for interior designers. CE-marked and EXC2 certified which means my steel is signed off for structural use by Building Control. I do my own design from architect's drawings, weld everything myself, and I deliver and install. I keep prices honest by running a tight workshop — if you want a polished bit of architectural metalwork I won't beat a London studio, but for solid functional structural steel and good-looking domestic pieces I'm fast and fair-priced.",
    years_in_trade: 15,
    start_year: 2011,
    priced_services: [
      { name: "Structural steel beam (RSJ, supply + install)", price: 850, unit: "from", description: "Standard 152x152 UC or 203 UB up to 4m, painted, delivered, craned into position. Per beam. Engineer's calc supplied separately." },
      { name: "Bespoke steel staircase (straight flight)", price: 4800, unit: "from", description: "Mild steel string-and-tread staircase to your design, primed and topcoated. Standard 13-tread straight flight." },
      { name: "Glass balustrade (per linear m)", price: 480, unit: "per linear m", description: "Stainless steel posts, toughened glass infill panels, satin or polished finish. For stairs, balconies or terraces." },
      { name: "Steel gates / railings (per linear m)", price: 285, unit: "per linear m", description: "Welded steel railings or gates, decorative or plain. Galvanised and powder-coated for outdoor life." },
      { name: "Bespoke fabrication day rate", price: 380, unit: "per day", description: "Workshop day rate for bespoke pieces. Architectural metalwork, balconies, planters, structural one-offs." },
      { name: "Site welding (mobile, per day)", price: 480, unit: "per day", description: "Mobile welding day rate including all gases and consumables. For on-site structural alterations." },
      { name: "Design + drawing (per project)", price: 350, unit: "from", description: "CAD drawings and shop drawings for fabrication. Deducted from build cost if you commission the work." }
    ],
    faq_items: [
      { q: "Do you supply the engineer's calculations?", a: "I work to your structural engineer's calcs — I don't sign off design loads myself. If you don't have an engineer I work with two in the Midlands who'll calc beams for £180-£280." },
      { q: "Can you weld at my house or only in the workshop?", a: "Both. Workshop is faster, cleaner and the finish is better. Site welding for situations where the steel can't be brought in — basement RSJs, alterations to existing frames." },
      { q: "Galvanised or painted steel for outdoors?", a: "Galvanised every time for outdoor use — zinc coating, lasts 50+ years. Powder-coat on top for a colour finish. Painted steel outdoors rusts within 5 years if not maintained." },
      { q: "How long does a bespoke staircase take?", a: "From sign-off: 2-3 weeks design + drawings, 3-4 weeks fabrication, 1 day install. Total 6-8 weeks. Glass balustrades add 2 weeks for glass." },
      { q: "Are you CE certified?", a: "Yes — EXC2 certified for structural steelwork up to standard residential/light commercial. Anything bigger and more complex (bridges, high-rise) needs EXC3 which I don't hold." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: [
      "EWF European Welding Specialist",
      "CSWIP 3.1 Welding Inspector",
      "CE Mark EXC2 (BS EN 1090)",
      "City & Guilds Welding (MIG, TIG, MMA)"
    ],
    trade_memberships: ["British Constructional Steelwork Association (BCSA)", "The Welding Institute (TWI)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 350,
    free_site_visits: true,
    quote_availability: "Quotes within 72 hours",
    quote_turnaround_hours: 72,
    current_status_note: "Workshop booked 4-6 weeks. Site welding emergencies same week.",
    availability: "later",
    reviews: [
      { customer_name: "Mike B.", rating: 5, title: "Steel staircase is the feature of the house", body: "Jakub designed and built our open-tread steel staircase. Welds are invisible, paint finish is flawless. Drew it in CAD with us until we were happy.", service_name: "Bespoke steel staircase (straight flight)", project_type: "new_build" },
      { customer_name: "Olivia T.", rating: 5, title: "RSJ delivered and installed", body: "5m structural beam for a knock-through. Lifted into place with a beam-trolley. Engineer was happy with the install. No fuss.", service_name: "Structural steel beam (RSJ, supply + install)", project_type: "renovation" },
      { customer_name: "Greg N.", rating: 5, title: "Glass balustrade looks high-end", body: "Stainless posts with low-iron toughened glass on our balcony. Looks like it should cost twice what we paid.", service_name: "Glass balustrade (per linear m)", project_type: "renovation" },
      { customer_name: "Kate W.", rating: 4, title: "Gates great but took longer than quoted", body: "Garden gates beautifully made. Job ran 2 weeks over due to powder-coater delay. Final piece is lovely." , service_name: "Steel gates / railings (per linear m)", project_type: "renovation" }
    ]
  },

  // 20. HEAVY MACHINERY
  {
    trade_slug: "heavy-machinery",
    profile_slug: "demo-charlie-armstrong-heavy-machinery-aberdeen",
    display_name: "Charlie Armstrong",
    trading_name: "Armstrong Plant Hire",
    city: "Aberdeen",
    postcode_prefix: "AB10",
    whatsapp: "+44 7700 901967",
    email: "charlie@armstrongplant.co.uk",
    bio: "Plant hire and operator service across Aberdeenshire and the North-East. I started as a CPCS-trained excavator operator on the oil and gas yards, then bought my first 3-tonne JCB in 2014 and built the fleet from there. We now run two 3-tonne and two 8-tonne excavators, two 1-tonne and one 6-tonne dumpers, a single-drum roller and a backhoe. All machines under 5 years old and serviced on Caterpillar / JCB schedules. Operators are all CPCS Blue card minimum — most have done 10 years on construction sites. We do plant + operator hire by the day or week for groundworks, demolition prep, drainage, landscaping and small civils. Quotes include fuel, operator wages, transport on and off site, and full insurance. No surprise charges. We cover Aberdeen, the shire, and as far down as Dundee.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "3-tonne excavator + operator (per day)", price: 380, unit: "per day", description: "8-hour day rate including operator, fuel and transport within 30 miles of AB10. 9am-5pm typical." },
      { name: "8-tonne excavator + operator (per day)", price: 580, unit: "per day", description: "Larger machine for deep dig, mass earth movement, demolition prep. Inc operator, fuel, transport." },
      { name: "Excavator + operator (per hour, on-site)", price: 65, unit: "per hour", description: "Hourly rate once machine is on site — min 4 hours. For smaller jobs or top-up work." },
      { name: "6-tonne dumper + operator (per day)", price: 380, unit: "per day", description: "Heavy material movement around site, swivel-tip dumper, 6 tonne capacity. Inc operator + fuel." },
      { name: "Mini dumper (1-tonne) + operator (per day)", price: 280, unit: "per day", description: "Compact dumper for tight access, garden landscaping, small civils. Inc operator." },
      { name: "Single-drum roller + operator (per day)", price: 380, unit: "per day", description: "Vibrating roller for driveways, paths, sub-bases. 1.5-tonne self-propelled. Inc operator." },
      { name: "Weekly plant hire (no operator)", price: 1200, unit: "from", description: "3-tonne excavator dry-hire for the week. Customer must have CPCS-carded operator. Transport extra." }
    ],
    faq_items: [
      { q: "Do you supply the operator?", a: "Always — standard rate includes a CPCS-carded operator. If you want dry hire we'll quote separately and you'll need to show me CPCS cards before the machine goes." },
      { q: "What size machine do I need?", a: "3-tonne for most domestic work — garden landscaping, single house foundations, drainage. 8-tonne for bigger civils, deep dig, demolition prep. I'll spec on the site visit." },
      { q: "Are you insured?", a: "Yes — £5m public liability plus contractors' all-risks on every machine. Certificate sent before any job starts." },
      { q: "Can you do night or weekend work?", a: "Yes — premium rate of 1.5x weekday for evenings/weekends. Sundays double time. Planning ahead helps." },
      { q: "Will the operator do the work themselves?", a: "Yes — operators are experienced groundworkers. We can dig footings, lay drainage runs, level a site. If you need it just dug and you'll do the work yourself, that's fine too — but the rate's the same." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: [
      "CPCS Blue Excavator 360 above 5T",
      "CPCS Dumper",
      "CPCS Roller",
      "CITB SSSTS Supervisor"
    ],
    trade_memberships: ["Construction Plant-hire Association (CPA)", "CHAS Accredited"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 380,
    free_site_visits: true,
    quote_availability: "Same-day quotes for standard hire",
    quote_turnaround_hours: 24,
    current_status_note: "Plant available most weeks. Book 1-2 weeks ahead for guaranteed slot.",
    availability: "next_week",
    reviews: [
      { customer_name: "Ian K.", rating: 5, title: "Operator was a class above", body: "Booked 3-tonne for foundations. Charlie's lad dug perfectly to the engineer's spec, no over-dig, and the spoil pile was tidy. Worth every penny.", service_name: "3-tonne excavator + operator (per day)", project_type: "new_build" },
      { customer_name: "Fraser M.", rating: 5, title: "8-tonner for demo", body: "Big demolition site clearance. 3 days with the 8-tonner and a dumper. Cleared 200 tonnes of rubble. Machines never stopped.", service_name: "8-tonne excavator + operator (per day)", project_type: "renovation" },
      { customer_name: "Hannah S.", rating: 5, title: "Garden access — needed the mini", body: "Backyard with 90cm wide gate. Mini dumper and a 3-tonne shuffled in like it was nothing. Garden saved.", service_name: "Mini dumper (1-tonne) + operator (per day)", project_type: "renovation" },
      { customer_name: "Doug R.", rating: 4, title: "Roller fine, transport delay", body: "Roller was great but the lorry got stuck in traffic and started 2 hours late. Charlie took 2 hours off the day rate which was fair.", service_name: "Single-drum roller + operator (per day)", project_type: "new_build" }
    ]
  },

  // 21. TOOL HIRE
  {
    trade_slug: "tool-hire",
    profile_slug: "demo-rebecca-fawcett-tool-hire-derby",
    display_name: "Rebecca Fawcett",
    trading_name: "Fawcett Tool Hire",
    city: "Derby",
    postcode_prefix: "DE23",
    whatsapp: "+44 7700 902058",
    email: "hire@fawcetttoolhire.co.uk",
    bio: "I took over a small family-owned tool hire shop in Normanton from my dad in 2016 and have grown the stock list to about 400 items. We hire power tools, access kit (towers and ladders), site equipment (cement mixers, generators, breakers), surveying gear and the occasional bit of plant. Hire is by the day, weekend (Fri-Mon), or week. All tools serviced after every hire and PAT tested. We deliver locally for £25 — saves trades the time off a busy site. Trade discount of 15% for FMB / CSCS-carded customers and 30-day account terms after credit check. Two-shop business (Derby city and Long Eaton). What sets us apart from the chains: we know what we hire — if you need a specific bit of kit and aren't sure which brand or size, we'll talk you through it instead of just reading off a stock list.",
    years_in_trade: 10,
    start_year: 2016,
    priced_services: [
      { name: "SDS rotary hammer drill (per day)", price: 25, unit: "per day", description: "Bosch or Makita 5kg class SDS, chisel + drill modes. Includes 2x bits or chisels of your choice." },
      { name: "Cement mixer (electric, per day)", price: 35, unit: "per day", description: "Half-bag electric cement mixer, 110V or 240V. Stand included." },
      { name: "Floor sander (drum + edge, per day)", price: 65, unit: "per day", description: "Drum sander + edging sander combo for wood floor refinishing. Includes grade selection of sandpaper." },
      { name: "Aluminium mobile tower (per week)", price: 95, unit: "per item", description: "Single-width PASMA-compliant tower, 4m max platform height. Per week hire." },
      { name: "Disc cutter (petrol, per day)", price: 55, unit: "per day", description: "Stihl TS400 or Husqvarna petrol cut-off saw. Includes one blade — extras at cost." },
      { name: "Breaker (handheld, per day)", price: 45, unit: "per day", description: "Electric or hydraulic 240V breaker for concrete and brick. 15kg class. Includes chisel selection." },
      { name: "Delivery / collection (each way)", price: 25, unit: "per visit", description: "Local delivery within 10 miles of DE23 yard. Saves you a trip in for the gear." }
    ],
    faq_items: [
      { q: "Do you do weekend hire?", a: "Yes — Fri-Mon counts as a single 'weekend hire' at 1.5x day rate. Picked up Friday afternoon, returned Monday morning. Most popular hire for one-off DIY jobs." },
      { q: "Are your tools tested?", a: "Yes — PAT tested on a 6-month schedule and full mechanical check after every hire. Anything failing test is replaced before going back out." },
      { q: "Do you deliver?", a: "Yes — £25 each way within 10 miles. Free over £200 hire. Saves you the time off site." },
      { q: "What if I break it?", a: "Standard wear is on us. Negligent damage (drops, wrong fuel etc) you pay repair cost or replacement. Insurance available at 10% of hire cost to cover incidental damage." },
      { q: "Can I open a trade account?", a: "Yes — quick credit check and you get 30-day terms plus 15% off list. Online portal for ordering." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["PAT Testing Certified", "PASMA Tower Certified"],
    trade_memberships: ["Hire Association Europe (HAE)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 25,
    free_site_visits: false,
    quote_availability: "Same-day quotes for stock items",
    quote_turnaround_hours: 12,
    current_status_note: "Most items available daily. Towers and floor sanders book 2-3 days ahead in summer.",
    availability: "now",
    reviews: [
      { customer_name: "Joe L.", rating: 5, title: "Saved me a trip", body: "Booked an SDS and breaker for a weekend. Rebecca's lad delivered them Friday afternoon and collected Monday. Saved me hours. Tools were spot on.", service_name: "Delivery / collection (each way)", project_type: "renovation" },
      { customer_name: "Diane R.", rating: 5, title: "Floor sander made it easy", body: "Refinished our hall and dining room floors over a weekend. Sander was in great condition, decent sandpaper supplied. Rebecca walked me through how to use it.", service_name: "Floor sander (drum + edge, per day)", project_type: "renovation" },
      { customer_name: "Sam T.", rating: 5, title: "Better than HSS", body: "Tower was clean, all bits there, no missing braces. Better service than I get from the big chains.", service_name: "Aluminium mobile tower (per week)", project_type: "renovation" },
      { customer_name: "Ahmed B.", rating: 4, title: "Mixer fine, delivery was late", body: "Hired a mixer for a weekend. Delivery turned up an hour late which threw the schedule. Mixer worked great though." , service_name: "Cement mixer (electric, per day)", project_type: "renovation" }
    ]
  },

  // 22. LANDSCAPER
  {
    trade_slug: "landscaper",
    profile_slug: "demo-grace-okonkwo-landscaper-norwich",
    display_name: "Grace Okonkwo",
    trading_name: "Okonkwo Garden Design",
    city: "Norwich",
    postcode_prefix: "NR2",
    whatsapp: "+44 7700 902149",
    email: "grace@okonkwogardens.co.uk",
    bio: "I studied garden design at Capel Manor, did three years at a Norfolk garden design studio, then set up on my own in 2020. I cover Norwich and the broader Norfolk countryside doing garden design, hard landscaping, planting schemes and ongoing maintenance for a select group of clients. I'm RHS qualified and a member of the Society of Garden Designers, which means I work to professional design fees and a proper drawing-based design process — not just 'a man with a digger' landscaping. About 60% of my work is full design + build, 30% planting-only schemes for clients with existing structure, and 10% large maintenance projects (annual care for big gardens). I work with two trusted hard-landscapers for paving, pergolas and structural work; planting and design I do myself. I won't take on a job unless I've done a proper site survey — soil, aspect, drainage, existing trees all matter.",
    years_in_trade: 8,
    start_year: 2018,
    priced_services: [
      { name: "Garden design fee (full plan)", price: 1850, unit: "from", description: "Full design including site survey, concept, planting plan, hard-landscaping drawings. 1:50 scale. Standard medium garden up to 200sqm." },
      { name: "Planting plan only (existing structure)", price: 850, unit: "from", description: "Detailed planting plan with plant lists, quantities and supply schedule. For clients managing their own install." },
      { name: "Patio install (Indian sandstone, per sqm)", price: 145, unit: "per sqm", description: "Excavate, sub-base, mortar bed, lay sandstone, point. Excludes patio drainage if required." },
      { name: "Lawn turfing (per sqm)", price: 18, unit: "per sqm", description: "Strip existing, prep topsoil, lay rolawn or local supplied turf. Includes 4 weeks aftercare advice." },
      { name: "Planting day (supply + plant)", price: 480, unit: "per day", description: "Day rate including planting team. Plants supplied at cost + 15% — typically £400-£900 of plants per day pace." },
      { name: "Garden maintenance (per visit)", price: 145, unit: "per visit", description: "Quarterly tidy + planting refresh for medium garden. Pruning, mulching, deadheading, edge trim. 3-4 hours." },
      { name: "Bespoke pergola / structure", price: 2200, unit: "from", description: "Designed and built pergola in oak or sapele, structural fixings, optional climbing plant scheme. Standard 3x3m." }
    ],
    faq_items: [
      { q: "Why do I need a design fee?", a: "A proper design takes 30-50 hours from survey to drawings. It saves you money down the line — plants in the right place don't need replacing, paving laid to the right fall doesn't pond. Bad gardens cost more than good ones over 10 years." },
      { q: "What's the best month to start a garden?", a: "Spring (Mar-May) and autumn (Sep-Nov) for planting. Hard landscaping can run year-round though winter mortar work needs frost protection." },
      { q: "Will plants survive the first winter?", a: "If I've chosen for your soil, aspect and exposure — yes. Standard 1-year supply guarantee on supplied plants if they fail through no fault of your watering." },
      { q: "Do you do small jobs?", a: "Yes but minimum is £200 worth of work. Below that it's not worth the time for me or the client." },
      { q: "Can you work with my existing trees?", a: "Yes — we always start from what's already there. A mature tree is worth thousands; we design around it. If something has to go I'll be honest about it before quoting." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "RHS Level 3 Practical Horticulture",
      "Pre-Registered Member Society of Garden Designers",
      "PA1 PA6 Pesticide Application",
      "Chainsaw CS30 + CS31"
    ],
    trade_memberships: ["Society of Garden Designers (SGD)", "Royal Horticultural Society"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 200,
    free_site_visits: false,
    quote_availability: "Quotes within 5 working days",
    quote_turnaround_hours: 72,
    current_status_note: "Design booked 2-3 months ahead. Maintenance slots available.",
    availability: "later",
    reviews: [
      { customer_name: "Helena S.", rating: 5, title: "Garden is a sanctuary now", body: "Grace designed a calming garden with year-round structure. Every plant is where it should be. The hard-landscaping crew were excellent too.", service_name: "Garden design fee (full plan)", project_type: "renovation" },
      { customer_name: "Roger B.", rating: 5, title: "Patio is gorgeous", body: "Indian sandstone laid with such care — every slab dead flat, falls perfect, joints crisp. Two winters in not a single tile moved.", service_name: "Patio install (Indian sandstone, per sqm)", project_type: "renovation" },
      { customer_name: "Imogen W.", rating: 5, title: "Planting plan was perfect", body: "We had the hard landscaping done by someone else but needed a planting scheme. Grace's plan was detailed, plants were sourced beautifully. Garden has come alive.", service_name: "Planting plan only (existing structure)", project_type: "renovation" },
      { customer_name: "Patrick H.", rating: 4, title: "Lawn took a few months", body: "New turf laid in autumn. Took until spring to fully knit. Some patches needed top-up which Grace did at no extra cost." , service_name: "Lawn turfing (per sqm)", project_type: "renovation" }
    ]
  },

  // 23. GAS ENGINEER
  {
    trade_slug: "gas-engineer",
    profile_slug: "demo-stephen-baker-gas-engineer-reading",
    display_name: "Stephen Baker",
    trading_name: "Baker Gas Services",
    city: "Reading",
    postcode_prefix: "RG1",
    whatsapp: "+44 7700 902231",
    email: "steve@bakergasservices.co.uk",
    bio: "Gas Safe registered since 2007, on my own as a sole trader since 2014. I cover Reading, Wokingham, Bracknell and the Thames Valley doing boiler installs, servicing, landlord gas safety inspections (CP12s), gas cooker installs and full system upgrades. About 70% of my work is boiler installs — 5-year average — and the rest is servicing and remedial work. Worcester Bosch accredited installer (which means a 12-year warranty on a Worcester combi when I fit it) and Vaillant Advance accredited too. I'm a sole trader by design — no juniors learning on your boiler. The downside is I'm busy. The upside is the work is mine and the warranty is mine. No call-out fee in working hours within RG postcode area. Gas Safe number 287642.",
    years_in_trade: 19,
    start_year: 2007,
    priced_services: [
      { name: "Combi boiler install (Worcester Greenstar)", price: 2650, unit: "from", description: "Like-for-like Worcester combi swap. System flush, magnetic filter, smart thermostat. 12-year warranty registered. 1-day install." },
      { name: "Combi boiler install (Vaillant ecoTec)", price: 2450, unit: "from", description: "Vaillant ecoTec Plus combi swap. System flush, filter, Vaillant warranty. 10-year warranty." },
      { name: "System boiler install (Worcester, with cylinder)", price: 3850, unit: "from", description: "System boiler + unvented cylinder for higher hot water demand. 2-day install." },
      { name: "Annual boiler service", price: 110, unit: "fixed", description: "Full service to manufacturer spec. Clean, gas pressure test, flue analysis, certificate. Required to maintain warranty." },
      { name: "Landlord Gas Safety Cert (CP12)", price: 95, unit: "fixed", description: "Annual gas safety inspection for landlord — boiler, cooker, fire — with certificate. Legal requirement for rentals." },
      { name: "Gas cooker / hob install", price: 165, unit: "fixed", description: "Connect new gas hob or cooker with appropriate flexible or hard pipe. Includes gas safety test." },
      { name: "Powerflush (full system)", price: 480, unit: "fixed", description: "Full chemical and mechanical flush of central heating system. Inhibitor top-up. Up to 12 radiators." }
    ],
    faq_items: [
      { q: "What's the warranty on a new boiler?", a: "Worcester Greenstar 8000 combi gets a 12-year warranty when fitted by a Worcester Accredited Installer (me). Vaillant ecoTec gets 10 years through their Advance scheme. Both require annual servicing to stay valid." },
      { q: "Combi or system boiler — which should I have?", a: "Combi for households up to 2 bathrooms with reasonable mains pressure. System + cylinder for 3+ bathrooms or low mains pressure. I do a full survey on the quote visit." },
      { q: "Is my boiler still safe?", a: "If it's serviced annually and you're getting no warnings, yes. Carbon monoxide alarms are essential. Pre-2005 boilers are increasingly hard to get parts for — worth planning a swap." },
      { q: "Do you do emergency callouts?", a: "Yes — no heating in winter, gas smell, hot water failure. Working hours emergency same day if I can. Out-of-hours £150 call-out plus standard rate." },
      { q: "Can a non-Gas-Safe engineer touch my boiler?", a: "No. It's illegal. Any work on gas appliances — install, service, repair — must be done by Gas Safe registered engineer. Always check the registration before work starts." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "Gas Safe Registered (287642)",
      "NVQ Level 3 Plumbing & Heating",
      "Worcester Bosch Accredited Installer",
      "Vaillant Advance Accredited",
      "Unvented Hot Water G3"
    ],
    trade_memberships: ["Gas Safe Register", "CIPHE (Chartered Institute of Plumbing & Heating Engineering)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 95,
    free_site_visits: true,
    quote_availability: "Usually quotes within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Boiler installs 1-2 weeks. Emergencies same day where possible.",
    availability: "this_week",
    reviews: [
      { customer_name: "Margaret C.", rating: 5, title: "Worcester install was textbook", body: "Old boiler died on a Friday. Steve quoted Saturday, fitted Tuesday. Hot water and heating back, 12-year warranty registered before he left.", service_name: "Combi boiler install (Worcester Greenstar)", project_type: "repair" },
      { customer_name: "Rohan D.", rating: 5, title: "Annual service was thorough", body: "Steve services my boiler every November. Always on time, takes photos of the flue analysis and emails the cert. Reliable as anything.", service_name: "Annual boiler service", project_type: "repair" },
      { customer_name: "Alistair F.", rating: 5, title: "CP12 done in 20 mins", body: "Landlord cert for my flat. In and out, certificate by email same day. Easy.", service_name: "Landlord Gas Safety Cert (CP12)", project_type: "repair" },
      { customer_name: "Catherine M.", rating: 4, title: "System boiler great, scaffolding delay", body: "System boiler swap took 3 days instead of 2 due to scaffolding for the flue. Steve sorted it though no extra charge.", service_name: "System boiler install (Worcester, with cylinder)", project_type: "renovation" }
    ]
  },

  // 24. CONCRETE FINISHER
  {
    trade_slug: "concrete-finisher",
    profile_slug: "demo-marco-bianchi-concrete-finisher-bournemouth",
    display_name: "Marco Bianchi",
    trading_name: "Bianchi Concrete Finishing",
    city: "Bournemouth",
    postcode_prefix: "BH8",
    whatsapp: "+44 7700 902317",
    email: "marco@bianchifinish.co.uk",
    bio: "I came to concrete finishing through stone restoration — trained in Italy on polished cement and microcement floors, moved to the UK in 2016 and have specialised in concrete and resin finishes since. I cover the South Coast doing polished concrete floors, microcement walls and floors, decorative seals and concrete countertops. Not formwork or pouring — that's the concrete specialist's job — I come in after the pour or over the existing slab for the finish. A polished concrete floor properly done lasts 30+ years with almost no maintenance and looks like nothing else. Microcement opens up bathrooms and feature walls where tiles would be heavy and grouty. I bring my own grinders, polishers, slurry containment and sealants. Quotes are per sqm with the gloss level (matt / satin / gloss) and aggregate exposure level specified.",
    years_in_trade: 10,
    start_year: 2016,
    priced_services: [
      { name: "Polished concrete floor (per sqm)", price: 145, unit: "per sqm", description: "Grind, densify, polish to your chosen gloss + aggregate exposure. Sealed with penetrating seal. Min 30sqm." },
      { name: "Microcement floor (per sqm)", price: 195, unit: "per sqm", description: "Three-coat microcement system over existing tile / screed / wood. Tinted to your colour, sealed for wet rooms. Min 10sqm." },
      { name: "Microcement walls (per sqm)", price: 165, unit: "per sqm", description: "Microcement on walls — bathrooms, feature walls, kitchen splashbacks. Seamless tileless finish. Min 5sqm." },
      { name: "Concrete countertop (bespoke, per linear m)", price: 850, unit: "per linear m", description: "Hand-cast concrete worktop, sealed and polished. 60mm thick standard. Includes sink cutout." },
      { name: "Polished overlay (existing slab, per sqm)", price: 165, unit: "per sqm", description: "Cementitious overlay 8-12mm over existing concrete slab, ground and polished. For floors not poured to finish spec." },
      { name: "Concrete seal + reseal (per sqm)", price: 22, unit: "per sqm", description: "Refresh seal on existing polished concrete. Lithium silicate or topical depending on existing finish." },
      { name: "Repair / patch existing finish (per sqm)", price: 75, unit: "from", description: "Patch chips, scratches, or stains in existing polished or micro finish. Per small area." }
    ],
    faq_items: [
      { q: "What's the difference between polished concrete and microcement?", a: "Polished concrete is a true concrete slab ground and polished into a single surface — 75mm+ thick, structural. Microcement is a 3mm coating over an existing surface — non-structural, lighter, can go over wood or tile. Different products, different jobs." },
      { q: "Can you do microcement in a bathroom?", a: "Yes — properly sealed microcement is fully waterproof and works on walls, floors and shower trays. I tank below the surface as well so any micro-crack doesn't cause leaks." },
      { q: "Will it crack?", a: "Polished concrete will show some natural micro-cracking — that's normal and part of the look. Structural cracks shouldn't appear if the substrate was right. Microcement is more flexible and rarely cracks unless the substrate moves." },
      { q: "How long does the install take?", a: "Polished concrete floor: 4-7 days for a typical room. Microcement: 4-5 days per zone with curing time between coats. Both need 2-3 days off-foot after sealing." },
      { q: "Is it slippery when wet?", a: "Matt polish + the right seal gives a R10 slip rating, fine for kitchens and bathrooms. High-gloss polish is more slippery — I'll spec to your use." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "NVQ Level 3 Concrete Repair & Finishing",
      "Microcement Application Course (Topciment)",
      "CSCS Card"
    ],
    trade_memberships: ["Concrete Society"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 750,
    free_site_visits: true,
    quote_availability: "Quotes within 72 hours",
    quote_turnaround_hours: 72,
    current_status_note: "Booking 4-6 weeks ahead. Smaller microcement jobs sometimes fit in earlier.",
    availability: "later",
    reviews: [
      { customer_name: "Andrea D.", rating: 5, title: "Polished floor is unbelievable", body: "Open-plan kitchen-diner, 60sqm polished concrete. Looks like the floor of a high-end gallery. Three years in not a mark.", service_name: "Polished concrete floor (per sqm)", project_type: "new_build" },
      { customer_name: "Pete S.", rating: 5, title: "Microcement bathroom transformed", body: "Tiled bathroom was tired but we didn't want the upheaval of a full retile. Marco microcemented over the lot. Looks brand new, seamless.", service_name: "Microcement floor (per sqm)", project_type: "renovation" },
      { customer_name: "Sara W.", rating: 5, title: "Concrete countertops are amazing", body: "Hand-cast concrete worktops in our kitchen island. Marco made templates, cast off-site and installed in a day. They're a feature.", service_name: "Concrete countertop (bespoke, per linear m)", project_type: "renovation" },
      { customer_name: "Tom G.", rating: 4, title: "Floor great, dust was heavy", body: "Polished overlay on our existing slab. Result is stunning but the grinding stage threw a lot of dust despite his vacuum. Cleaned up well in the end.", service_name: "Polished overlay (existing slab, per sqm)", project_type: "renovation" }
    ]
  },

  // 25. STAIR FITTER
  {
    trade_slug: "stair-fitter",
    profile_slug: "demo-ben-lawrence-stair-fitter-cambridge",
    display_name: "Ben Lawrence",
    trading_name: "Lawrence Staircases",
    city: "Cambridge",
    postcode_prefix: "CB1",
    whatsapp: "+44 7700 902408",
    email: "ben@lawrencestaircases.co.uk",
    bio: "Twelve years specialising in staircases — started as a bench joiner at a stair-maker in Suffolk, moved to running my own workshop in Cambridge in 2017. I make and fit traditional cut-string staircases, contemporary open-tread designs, and bespoke balustrades. Most of my work is replacement stairs in renovations and new staircases for loft conversions, with the occasional dramatic feature staircase for new builds. I draw everything in CAD before I cut — every tread, every spindle, every newel detail. I work in oak, ash, walnut, sapele and paint-grade poplar. Site visits to measure are always free and always done by me, not a junior. Quotes specify the timber species, the joints (housed and wedged is standard), the handrail and the finish — no vague 'standard staircase' wording.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "Standard cut-string staircase (paint-grade, 13 treads)", price: 4200, unit: "from", description: "Bespoke staircase in paint-grade poplar, housed and wedged construction. Standard rise/run. Includes handrail + spindles." },
      { name: "Oak staircase (cut-string, 13 treads)", price: 6500, unit: "from", description: "Solid oak treads, risers and strings. Bespoke design. Includes oak newels, handrail and turned spindles." },
      { name: "Loft conversion staircase (custom rise)", price: 4800, unit: "from", description: "Bespoke staircase to fit available headroom and floor opening. Often steeper or alternating-tread. Paint-grade." },
      { name: "Open-tread / cantilever staircase", price: 8500, unit: "from", description: "Modern open-tread design with hidden stringer or cantilever. Glass or steel balustrade extra." },
      { name: "Replace handrail + spindles only", price: 1450, unit: "from", description: "Strip existing balustrade, fit new handrail, newels and spindles to existing staircase. Standard flight." },
      { name: "Stair refurbishment (sand + restain)", price: 850, unit: "from", description: "Sand back existing wood staircase, restain or repaint, fresh finish. Standard flight, 13 treads." },
      { name: "Site survey + CAD drawing", price: 280, unit: "fixed", description: "Site survey and detailed CAD drawing. Deducted from build price if you commission the work." }
    ],
    faq_items: [
      { q: "Do you make to order or have standard sizes?", a: "Always made to order. Standard staircases don't really exist — every floor opening and rise is different. I draw everything to your house before I cut a single piece." },
      { q: "How long does a bespoke stair take?", a: "From sign-off: 1 week design, 4-6 weeks workshop fabrication, 1-2 days install. Total around 6-8 weeks. Open-tread or feature stairs add 2-4 weeks." },
      { q: "Can you match existing newels and handrails?", a: "Yes — I'll match profile on a CNC or hand-carved depending on detail. Photo a sample of the existing and I'll turn the new pieces to match." },
      { q: "Loft conversion stair — what rise/run is allowed?", a: "Building Regulations allow 220mm max rise, 220mm min going. Alternating tread (paddle) stairs allowed where space is really tight. I'll design within the allowable and the Building Control inspector will sign off." },
      { q: "Will it squeak?", a: "Not from me. Housed and wedged construction, glue blocks, screwed risers all stop the squeak. Stairs that creak are almost always nailed-only construction." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["City & Guilds NVQ Level 3 Bench Joinery", "City & Guilds Site Carpentry", "CSCS Card"],
    trade_memberships: ["Institute of Carpenters", "British Woodworking Federation (BWF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 280,
    free_site_visits: true,
    quote_availability: "Quotes within 5 working days",
    quote_turnaround_hours: 72,
    current_status_note: "Workshop booked 6-8 weeks ahead. Refurb / handrail jobs slot in faster.",
    availability: "later",
    reviews: [
      { customer_name: "Eleanor H.", rating: 5, title: "Oak staircase is a centrepiece", body: "Beautiful solid oak stairs with turned spindles to match our 1920s house. Ben drew it in CAD, made every joint by hand, no squeaks. Worth every penny.", service_name: "Oak staircase (cut-string, 13 treads)", project_type: "renovation" },
      { customer_name: "James L.", rating: 5, title: "Loft stair fits perfectly", body: "Tight loft opening, Building Control happy with the design. Bespoke build, paint-ready, fits like a glove.", service_name: "Loft conversion staircase (custom rise)", project_type: "renovation" },
      { customer_name: "Rachel V.", rating: 5, title: "Open-tread is stunning", body: "Cantilevered open-tread oak treads with glass balustrade. Walked into the house for the first time and gasped. Detail is incredible.", service_name: "Open-tread / cantilever staircase", project_type: "new_build" },
      { customer_name: "Patrick W.", rating: 4, title: "Handrail replacement, slight delay", body: "New handrail and spindles. Workshop ran a week over due to timber supply but the install was perfect. Lovely piece." , service_name: "Replace handrail + spindles only", project_type: "renovation" }
    ]
  },

  // 26. KITCHEN FITTER
  {
    trade_slug: "kitchen-fitter",
    profile_slug: "demo-laura-bennett-kitchen-fitter-oxford",
    display_name: "Laura Bennett",
    trading_name: "Bennett Kitchen Installations",
    city: "Oxford",
    postcode_prefix: "OX2",
    whatsapp: "+44 7700 902519",
    email: "laura@bennettkitchens.co.uk",
    bio: "I'm a specialist kitchen fitter — I install full kitchens from any supplier (Howdens, Magnet, Wickes, DIY Kitchens, Wren, IKEA and bespoke) and work alongside the client's chosen plumber and electrician. I trained as a site carpenter, did 6 years on housebuilder fit-outs, then focused purely on kitchen installs in 2019. Most of my work is one kitchen a week, end to end: strip out, second-fix carpentry, install units, fit worktops, doors, plinths, end panels, trims. I bring in a Worktop Express fitter for solid surface or stone tops. I work tidy — dust sheets, daily clean down, a hoover that doesn't choke on dust. I'll spot a design issue at quote stage and tell you straight: doors that won't open into a fridge, sockets in the wrong place, cooker hood too small for the hob. Catching it at quote saves weeks down the line.",
    years_in_trade: 13,
    start_year: 2013,
    priced_services: [
      { name: "Full kitchen install (10-15 units, labour only)", price: 2400, unit: "from", description: "Standard 10-15 unit install, base + wall + tall. Includes worktop fit, end panels, plinths, trims. 4-5 day job. Excludes appliances + plumbing + electrics." },
      { name: "Full kitchen install (16-25 units)", price: 3400, unit: "from", description: "Larger kitchen with island or extended runs. 6-8 day job. Labour only." },
      { name: "Kitchen rip-out", price: 480, unit: "fixed", description: "Strip out existing kitchen, dispose of units (skip extra), make safe pipework and electrics for new install." },
      { name: "Worktop fit only (laminate, per metre)", price: 95, unit: "per linear m", description: "Cut and fit laminate worktop on existing units, edge banding, mitred joints, sealed. Per linear m." },
      { name: "Solid wood / butcher block worktop fit (per linear m)", price: 165, unit: "per linear m", description: "Cut, sand, oil and fit solid wood worktop. Slower than laminate due to finishing. Per linear m." },
      { name: "Stone / quartz worktop fit (subcontract)", price: 1200, unit: "from", description: "Subcontracted to a stone specialist — template, cut to spec, fit. Indicative price for standard small kitchen run." },
      { name: "Kitchen design + planning (CAD)", price: 450, unit: "from", description: "Design and CAD plan for a bespoke kitchen layout if your supplier doesn't include one. Deducted from install fee." }
    ],
    faq_items: [
      { q: "Do you supply the kitchen?", a: "No — you buy from your chosen supplier and I fit. This usually saves you money vs the kitchen company's install service, and you control which trades you use." },
      { q: "How long does a kitchen install take?", a: "Standard 10-15 unit install: 4-5 working days. Larger kitchens with islands: 6-8 days. Plus 1-2 days for stone worktop template + return fit." },
      { q: "Can I cook in the house during the install?", a: "Most of mine work around a temporary microwave + kettle setup. The hob and sink are usually disconnected for 5-7 days. Plan for takeaways." },
      { q: "Do you do the plumbing and electrics?", a: "No — I'm a fitter not a plumber or electrician. You'll need both. I work alongside trades you choose, or recommend three of each I work with regularly." },
      { q: "What if a unit is damaged?", a: "I check every unit on delivery. Damage gets reported to the supplier same day. Most suppliers replace within 5 working days. I'll work around it to keep the install moving." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["NVQ Level 2 Site Carpentry", "CSCS Card", "PASMA Tower Card", "First Aid at Work"],
    trade_memberships: ["Institute of Carpenters", "Guild of Master Craftsmen"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 350,
    free_site_visits: true,
    quote_availability: "Usually quotes within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking 6-8 weeks. One kitchen per week, no exceptions.",
    availability: "later",
    reviews: [
      { customer_name: "Charlotte M.", rating: 5, title: "Howdens kitchen fit perfectly", body: "Laura installed our Howdens kitchen in 5 days. Doors line up, plinths perfect, worktop joints invisible. Worked beautifully with our electrician + plumber.", service_name: "Full kitchen install (10-15 units, labour only)", project_type: "renovation" },
      { customer_name: "Adam S.", rating: 5, title: "Big island kitchen", body: "20-unit DIY Kitchens install with a 3m island. Took 7 days. Laura caught two cabinet design issues at the start that saved us a week of grief later.", service_name: "Full kitchen install (16-25 units)", project_type: "renovation" },
      { customer_name: "Priya R.", rating: 5, title: "Solid wood worktop perfect", body: "Beautiful oak worktop fitted, sanded and oiled. Cuts around the hob and sink are crisp. Looks amazing two years on.", service_name: "Solid wood / butcher block worktop fit (per linear m)", project_type: "renovation" },
      { customer_name: "Mark J.", rating: 4, title: "Good fit, ran a day over", body: "Quality of install is excellent. Ran 1 day over because we'd ordered the wrong size end panel. Laura sorted it without fuss." , service_name: "Full kitchen install (10-15 units, labour only)", project_type: "renovation" }
    ]
  },

  // 27. WINDOW FITTER
  {
    trade_slug: "window-fitter",
    profile_slug: "demo-noah-patel-window-fitter-plymouth",
    display_name: "Noah Patel",
    trading_name: "Patel Window Installations",
    city: "Plymouth",
    postcode_prefix: "PL4",
    whatsapp: "+44 7700 902604",
    email: "noah@patelwindows.co.uk",
    bio: "I install windows and doors — uPVC, aluminium and timber. Started 14 years ago with a national window company, did the FENSA course early and went out as a sub-contractor in 2018. Now I run a two-man fitting team across Plymouth, Saltash and into Cornwall. FENSA registered installer which means my Building Control sign-off is automatic for windows. I work with three local suppliers for uPVC frames and with two aluminium suppliers for the higher-spec stuff. I'm picky about the install: hidden fixings, perfect drip caps, sealed reveals, foam injection where there are gaps. A cheap install on a £400 window ruins the £400 — too many fitters rush it. Quotes itemise the frame spec (glazing type, U-value, hardware, colour) so you can compare like-for-like across companies. I won't sell you a window — you've already chosen one. I fit it right.",
    years_in_trade: 14,
    start_year: 2012,
    priced_services: [
      { name: "uPVC window install (per window)", price: 325, unit: "per item", description: "Remove old, fit new uPVC window, foam, silicone, internal/external make-good. Per standard casement window." },
      { name: "uPVC bay window install", price: 1450, unit: "from", description: "Standard 3-light bay window, including bay pole if structural. Per bay." },
      { name: "uPVC French / patio doors install", price: 850, unit: "from", description: "Per door set. Includes threshold, frame fitting, silicone seal, ironmongery." },
      { name: "Aluminium window install (per window)", price: 480, unit: "per item", description: "Aluminium frames require more care on level and plumb. Standard casement, slim sightline frame." },
      { name: "Bifold door install (3-pane)", price: 1850, unit: "from", description: "3-pane aluminium bifold install, threshold prep, water sealing, hardware set-up. Frame quality critical." },
      { name: "Composite front door install", price: 580, unit: "from", description: "Strip out, fit composite door + frame, ironmongery, threshold seal. Half-day install." },
      { name: "FENSA certificate registration", price: 0, unit: "fixed", description: "Included in any install — your Building Control compliance certificate registered with FENSA within 30 days. Free." }
    ],
    faq_items: [
      { q: "Do I need FENSA registration?", a: "Yes — any new window install since 2002 must be FENSA (or equivalent) registered for Building Regs compliance. If you sell your house without it, the buyer's solicitor will ask. I register every install automatically." },
      { q: "uPVC, aluminium or timber — which should I choose?", a: "uPVC is cheapest and lowest maintenance. Aluminium is slimmer sightlines, more contemporary look, costs 30-50% more. Timber is the most traditional and most maintenance — needs repainting every 8-10 years." },
      { q: "What U-value should I look for?", a: "Building Regs require 1.4 W/m²K for replacement windows. Better products are 1.0-1.2. Lower is better for heat loss." },
      { q: "How long does an install take?", a: "Single window: 1.5-2 hours. Full house (8-10 windows): 2-3 days. Bifolds: half a day per door set." },
      { q: "Will my plaster be damaged?", a: "Some internal make-good is needed on most installs — old reveal plaster cracks when frames come out. I include reveal repair and silicone-finish on the quote. Larger replastering, you'd want a plasterer." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: [
      "FENSA Approved Installer",
      "NVQ Level 2 Fenestration",
      "CSCS Card",
      "Working at Height"
    ],
    trade_memberships: ["FENSA", "Glass and Glazing Federation (GGF)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 250,
    free_site_visits: true,
    quote_availability: "Usually quotes within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Booking 3-4 weeks ahead. Emergency board-ups same week.",
    availability: "two_weeks",
    reviews: [
      { customer_name: "Wendy R.", rating: 5, title: "Whole house of windows in 2 days", body: "9 uPVC windows replaced in two days. Reveal make-good neat, silicone lines crisp, FENSA cert in the post within a week. Nothing to complain about.", service_name: "uPVC window install (per window)", project_type: "renovation" },
      { customer_name: "Liam H.", rating: 5, title: "Bifold install was textbook", body: "3-pane aluminium bifolds for our kitchen extension. Threshold sealed properly, doors run like silk. Two years in still perfect.", service_name: "Bifold door install (3-pane)", project_type: "new_build" },
      { customer_name: "Sarah O.", rating: 5, title: "Bay window perfect", body: "Old timber bay was rotten. Noah replaced with uPVC bay including the structural pole. Better insulated and looks great.", service_name: "uPVC bay window install", project_type: "renovation" },
      { customer_name: "Trevor B.", rating: 4, title: "Front door fine, ran 2 hours over", body: "Composite front door install. Threshold adjustment took longer than quoted — 2 hours of extra fettling. No extra charge but worth flagging.", service_name: "Composite front door install", project_type: "renovation" }
    ]
  }
];
