// scripts/seed-case-studies.mjs
//
// Promote the 6 chosen demo profiles into fully-loaded case studies.
//
// Idempotent:
//   - Reviews keyed off a deterministic customer_email tag; existing case
//     study reviews are detected and the script skips re-inserting.
//   - Job diary projects keyed off a CASE_STUDY title prefix tag so we
//     don't pile duplicates on each re-run.
//   - Materials network picks use ON CONFLICT do nothing (unique on
//     tradie_listing_id + merchant_listing_id, see migration).
//   - Bio polish suffix detected via a stable sentinel before append.
//   - Socials, postcodes, rating_avg, rating_count UPDATE'd on each run.
//
// Run: node scripts/seed-case-studies.mjs

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const TOKEN = tokenMatch[1].trim();
const REF = "msdonkkechxzgagyguoe";

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase ${r.status}: ${txt}`);
  }
  return r.json();
}

function esc(s) {
  if (s === null || s === undefined) return "NULL";
  if (typeof s === "number") return s.toString();
  if (typeof s === "boolean") return s ? "true" : "false";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

const BIO_SENTINEL = "[case-study-extras]";

// Sentinel embedded in customer_email so we can dedupe on rerun without
// touching real customer emails. Format: cs-<slug>-<n>@example.com
function csEmail(slug, n) {
  return `cs-${slug}-${n}@example.com`;
}

// Short tag prefix on project title — keeps within the 80-char check
// constraint while still letting the seed script detect its own rows on
// rerun. Format: [cs-MARK] where MARK is the first 4 chars of the slug's
// last segment. Guaranteed not to collide with user-typed titles.
function jdTitlePrefix(slug) {
  const tail = slug.split("-").pop().slice(0, 4).toUpperCase();
  return `[cs-${tail}]`;
}

// ───────────────────────────────────────────────────────────────────────
// The 6 case studies
// ───────────────────────────────────────────────────────────────────────

const CASE_STUDIES = [
  {
    slug: "demo-marcus-okafor-drywaller-manchester",
    socials: {
      instagram: "@marcus-drywall-manchester",
      facebook: "MarcusOkaforDrywallPartitions",
      twitter: "@marcusdrywall_mc",
      tiktok: "@marcus.drywall.manchester"
    },
    postcodes: ["M14", "M15", "M16", "M20", "M21", "M22", "M32", "M33", "M41"],
    bioExtra: [
      `**Service area.** I cover Greater Manchester end-to-end — Chorlton, Didsbury, Sale, Stretford, Salford and out to Trafford Park. Anything inside the M60 I can be on site same week most weeks; jobs out toward Bury, Stockport and Altrincham get scheduled the following week.`,
      `**What I'm known for.** Commercial fit-outs (dentists, accountants, small offices), loft conversion drylining, acoustic separating walls between flats, and soundproofing music rooms. About 70/30 commercial to residential. Every quote is written down with the metalwork spec, board grade and acoustic rating spelled out — I won't give you a verbal number you can't hold me to later.`
    ],
    reviews: [
      { name: "Hannah J.", gender: "women", body: "Marcus drylined our loft conversion — properly plumb walls, no wavy joints, all done in five days flat. Quoted in writing with the board type and what was included; final invoice matched the spec we agreed. Already booked him for the second-floor partition work.", rating: 5, type: "renovation", service: "Loft conversion drylining package", days: 67 },
      { name: "Rashid K.", gender: "men", body: "We needed a soundproof wall between our home studio and the rest of the flat. Marcus came over, measured, sent a written quote with the acoustic rating spelled out, and it landed at the number he said. Twin stud, mineral wool, double board — the difference is night and day. Would have him back.", rating: 5, type: "renovation", service: "Acoustic separating wall (per linear m)", days: 92 },
      { name: "Olivia M.", gender: "women", body: "Booked Marcus for a single stud partition to split a big lounge into a study + living area. Clean board joints, no callbacks for snags, plasterer came in straight after with no complaints about the metalwork. Tidy with the dust sheets too.", rating: 5, type: "renovation", service: "Single stud partition wall (per linear m)", days: 124 },
      { name: "Tom W.", gender: "men", body: "Suspended ceiling for a small office refit in Salford. Marcus did the grid, recessed for the spark's downlights, taped and left it ready for paint. Came in on quote and on time. Communication was straight — text the night before with what time he'd arrive.", rating: 4, type: "renovation", service: "Suspended ceiling install (per sqm)", days: 41 },
      { name: "Charlotte P.", gender: "women", body: "Bathroom moisture board lining ahead of the tiler. Marcus stripped back to brick, battened out, foil-backed board on, all level for tiling. The tiler walked in and got straight on with it without re-doing anything. That's what you want.", rating: 5, type: "renovation", service: "Bathroom moisture board lining", days: 156 },
      { name: "Daniel L.", gender: "men", body: "I had a previous builder cut corners on the metalwork in a basement conversion. Marcus was honest about what needed ripping out before the skim coat — added a day to the quote but the wall is plumb and quiet now. Worth doing it once properly.", rating: 5, type: "renovation", service: "Soundproof room conversion", days: 188 },
      { name: "Aisha B.", gender: "women", body: "Acoustic wall between two flats in a conversion — landlord wanted the 50dB number on paper. Marcus quoted the right build-up, sent the spec, fitted it cleanly. Tenants haven't complained since which is the test that matters.", rating: 5, type: "renovation", service: "Acoustic separating wall (per linear m)", days: 14 },
      { name: "James H.", gender: "men", body: "Drylining for a loft — Marcus turned up when he said, kept the site clean, took the rubbish away. Quoted in writing, billed exactly the number. He's not the cheapest going but the quote came through clean and the work is right.", rating: 5, type: "renovation", service: "Loft conversion drylining package", days: 32 }
    ],
    jobDiary: [
      { title: "M20 loft conversion drylining", date: 30, location: "Didsbury, Manchester", summary: "Five-day drylining job for a loft conversion in Didsbury. Dwarf walls, eaves cupboards and a full ceiling, all boarded ready for the plasterer to skim." },
      { title: "Acoustic separating wall — flat conversion", date: 65, location: "Chorlton, Manchester", summary: "Twin stud separating wall between two new flats, double-board acoustic plasterboard, 100mm mineral wool. Tested to 50dB+ for the landlord's building control sign-off." },
      { title: "Commercial fit-out — dental surgery", date: 110, location: "Trafford Park", summary: "Refit for an existing dental surgery — three new treatment rooms partitioned out of the open back area, suspended ceiling for downlights, all done over a weekend so they could reopen Monday." },
      { title: "Basement music studio soundproofing", date: 155, location: "Salford", summary: "Converted a customer's basement room into a home studio space — isolated stud, resilient bars, acoustic board, sealed perimeter. Customer's drum kit no longer audible upstairs." }
    ],
    pickedMerchants: [
      { merchantSlug: "demo-stuart-kingsley-building-merchant-hull", intro: "Where I get my plasterboard, metal stud and acoustic mineral wool — sensible trade pricing and they'll cut for collection." },
      { merchantSlug: "demo-gareth-pritchard-timber-merchant-bristol", intro: "Sound timber for noggins and battens when I need clean, dry studs that won't bow on me." }
    ]
  },
  {
    slug: "demo-emma-whitfield-plasterer-leeds",
    socials: {
      instagram: "@emma-plastering-leeds",
      facebook: "EmmaWhitfieldPlasteringLeeds",
      twitter: "@emma_skim_leeds",
      tiktok: "@emma.plastering.leeds"
    },
    postcodes: ["LS6", "LS7", "LS8", "LS11", "LS12", "LS15", "LS16", "LS17", "LS27"],
    bioExtra: [
      `**Service area.** I cover Leeds end-to-end — Headingley, Chapel Allerton, Roundhay, Beeston, Kirkstall, Bramley and out as far as Morley and Otley. Most jobs inside LS-postcodes I can quote in person within the week.`,
      `**What I'm known for.** Skim-coat finishes that don't need a second pass, full re-plaster jobs on Victorian terraces, and lime plaster repair on period brick where modern gypsum would do more harm than good. About a third of my work is artex removal — old ceilings stripped, asbestos test where the property is pre-2000, fresh skim. Five-day return for snags is standard on every job.`
    ],
    reviews: [
      { name: "Sophie L.", gender: "women", body: "Emma re-skimmed our entire downstairs — three rooms, hallway and stairwell — over four days. Clean, level walls, no nibs or trowel lines visible once painted. Came back on day five for the snag check like she said she would. Just a really tidy job.", rating: 5, type: "renovation", service: "Full room re-plaster (3x4m bedroom)", days: 45 },
      { name: "Nathan F.", gender: "men", body: "We had a Victorian terrace with crumbling lime plaster on the chimney breast. Emma did a proper three-coat lime repair — scratch, float, finish — instead of just slapping bonding on it. Breathes properly now, no damp coming back through. Worth paying the premium for someone who knows period work.", rating: 5, type: "renovation", service: "Lime plaster repair (per sqm)", days: 88 },
      { name: "Kirsty D.", gender: "women", body: "Artex ceiling removal and re-skim in the lounge. Emma did the asbestos test first (clear, fortunately), then board-over and skim. Two days, dust sheets everywhere, clean job. Ceiling looks ten years younger.", rating: 5, type: "renovation", service: "Artex removal + skim (per sqm)", days: 122 },
      { name: "Marcus B.", gender: "men", body: "Patch repair around three new sockets the spark put in. Some plasterers won't touch small patches — Emma fit me in the same week, in and out in two hours, perfectly flush with the existing wall. Couldn't tell where the joins were after paint.", rating: 5, type: "repair", service: "Patch repair (single area up to 1sqm)", days: 167 },
      { name: "Helen R.", gender: "women", body: "Ceiling re-skim in a standard bedroom — Emma overskimmed rather than boarding, saved a day and a good chunk of the quote. Honest about which option suited the ceiling rather than upselling the bigger job. Finish is smooth.", rating: 5, type: "renovation", service: "Ceiling re-skim (standard room up to 16sqm)", days: 190 },
      { name: "James P.", gender: "men", body: "Bedroom re-plaster — old plaster was blown in three places, Emma stripped back to brick, did the scratch / float / skim properly. Five day return for snags, came back, sorted one tiny hairline crack near a corner. That's what good looks like.", rating: 5, type: "renovation", service: "Full room re-plaster (3x4m bedroom)", days: 26 },
      { name: "Priya N.", gender: "women", body: "Skim coat over a lot of failing painted-over woodchip walls in the hall. Emma was honest that the prep was going to add a day to the quote — she stuck to the new number and the finish is dead flat. The quote came through clean and matched the invoice.", rating: 4, type: "renovation", service: "Skim coat to existing walls (per sqm)", days: 75 },
      { name: "Dean S.", gender: "men", body: "Quick job — patch repair where we'd removed a radiator. Emma fit me in within two days, in for ninety minutes, gone. Charged exactly what she said. Decorator was happy. Will book her for the rest of the room when we get to it.", rating: 5, type: "repair", service: "Patch repair (single area up to 1sqm)", days: 209 }
    ],
    jobDiary: [
      { title: "Headingley terrace full re-plaster", date: 22, location: "Headingley, Leeds", summary: "Front room and dining room of a 1900 terrace — old plaster off, scratch / float / skim across both, snag visit five days later for the decorator." },
      { title: "Lime plaster repair, Roundhay", date: 60, location: "Roundhay, Leeds", summary: "Three-coat hot-lime mortar repair on a chimney breast in a period property. Breathable, period-correct, no gypsum bridges over the brickwork." },
      { title: "Artex ceiling removal", date: 105, location: "Kirkstall, Leeds", summary: "Asbestos test clear, then board-over and skim across a sitting room and hallway ceiling. Two days on site, dust kept to one room." },
      { title: "Bedroom ceiling re-skim", date: 148, location: "Chapel Allerton, Leeds", summary: "Standard 4x3.5m bedroom ceiling overskimmed in a day. PVA prep, two coats, ready for paint after a week." }
    ],
    pickedMerchants: [
      { merchantSlug: "demo-stuart-kingsley-building-merchant-hull", intro: "Where I order my multi-finish and bonding — bagged plaster I can rely on to be in date and consistent batch to batch." },
      { merchantSlug: "demo-gareth-pritchard-timber-merchant-bristol", intro: "Trusted for the timber battens I use behind moisture board on bathroom walls — straight, dry, properly graded." }
    ]
  },
  {
    slug: "demo-jamie-mclean-electrician-edinburgh",
    socials: {
      instagram: "@jamie-sparks-edinburgh",
      facebook: "JamieMacLeanElectricalEdinburgh",
      twitter: "@jamie_sparks_edi",
      tiktok: "@jamie.sparks.edinburgh"
    },
    postcodes: ["EH1", "EH3", "EH4", "EH6", "EH7", "EH8", "EH9", "EH10", "EH11", "EH16"],
    bioExtra: [
      `**Service area.** I cover central and south Edinburgh — Old Town, Leith, Newington, Marchmont, Morningside, Bruntsfield. Out to Corstorphine and Portobello on bigger jobs. NICEIC registered, full Part P testing and certs included on every install.`,
      `**What I'm known for.** Full and partial rewires on Edinburgh tenement flats, consumer unit upgrades to 18th edition, EICR testing for landlords, and EV charger installs. I prefer to talk through what's actually needed rather than upsell — sometimes a board change is enough, sometimes the whole flat needs sleeving. I'll be straight about which one yours is.`
    ],
    reviews: [
      { name: "Fiona C.", gender: "women", body: "Jamie did the full rewire on our Newington tenement flat — quoted in writing room by room, kept the disruption to a week, certs through the door before we'd even paid. The kind of job where you only find out it was done well years later — but the inspection report was clean.", rating: 5, type: "renovation", service: "Full flat rewire (2-bed tenement)", days: 41 },
      { name: "Connor M.", gender: "men", body: "Consumer unit upgrade — old wylex board out, new 18th edition split-load board in, all RCBOs, surge protection. Half a day on site, all tested, paperwork through the next morning. Honest pricing, no hidden extras.", rating: 5, type: "renovation", service: "Consumer unit upgrade (18th edition)", days: 78 },
      { name: "Iona K.", gender: "women", body: "Booked Jamie for an EICR for a Leith flat I rent out. Thorough — pulled covers off, tested every circuit, flagged the two C2s honestly with the cost to fix. No scaremongering, no padded report. Fixed the C2s the same week.", rating: 5, type: "repair", service: "EICR landlord certificate", days: 102 },
      { name: "Stuart H.", gender: "men", body: "EV charger install — Zappi 7kW on the side of the house, properly mounted, separate isolator at the board, OZEV paperwork handled. Took the time to explain the load-balancing options before we picked a unit. Clean cabling, all clipped properly, looks like it belongs there.", rating: 5, type: "new_build", service: "EV charger install (7kW domestic)", days: 134 },
      { name: "Aoife R.", gender: "women", body: "Kitchen refit — Jamie put in the under-cabinet lighting, extractor circuit and the new socket runs ahead of the fitter. Coordinated dates with the joiner, turned up when he said, didn't leave dangling cables. Inspection certs all in order.", rating: 5, type: "renovation", service: "Kitchen wiring (refit)", days: 172 },
      { name: "Greg N.", gender: "men", body: "Partial rewire on the upstairs of a 1930s semi — new lighting circuit, replaced the old rubber-sleeved sockets, brought everything up to the 18th edition. Honest about which bits were fine to leave (the modern downstairs) so we didn't pay for work we didn't need.", rating: 4, type: "renovation", service: "Partial rewire (per circuit)", days: 21 },
      { name: "Catherine M.", gender: "women", body: "Smart lighting install — Hue across the lounge and kitchen, with proper dimmer switches and a wired-in hub. Took the time to label what each switch did so I wasn't faffing in the app. Worth paying a real sparky to do it properly instead of YouTubing it.", rating: 5, type: "new_build", service: "Smart lighting install", days: 198 },
      { name: "Hamish G.", gender: "men", body: "Outdoor power for the garden office — fused spur on the house side, SWA buried at the right depth, weatherproof socket and lights. All certified, all signed off, no surprises on the invoice.", rating: 5, type: "new_build", service: "Outdoor power install (garden office)", days: 8 }
    ],
    jobDiary: [
      { title: "Newington tenement full rewire", date: 18, location: "Newington, Edinburgh", summary: "Five-day rewire on a 2-bed Victorian tenement — chases cut, new sleeving throughout, 18th edition consumer unit, certs through the door before we even invoiced." },
      { title: "EV charger install, Bruntsfield", date: 55, location: "Bruntsfield, Edinburgh", summary: "Zappi 7kW unit mounted on the side wall, separate isolator at the board, OZEV grant paperwork handled. Half a day on site, neat cabling, customer up and charging that afternoon." },
      { title: "EICR for Leith landlord", date: 92, location: "Leith, Edinburgh", summary: "Full EICR test on a 1-bed flat — pulled covers, tested every circuit, two C2 observations honestly costed, fixed both the same week before the report went to the letting agent." },
      { title: "Old Town consumer unit upgrade", date: 138, location: "Old Town, Edinburgh", summary: "Old wylex board swapped for a fully RCBO'd 18th edition consumer unit with surge protection. In and out in a single morning, certs through by lunch." }
    ],
    pickedMerchants: [
      { merchantSlug: "demo-anwar-rashid-electrical-wholesaler-birmingham", intro: "Where I get my cable, accessories and consumer units — proper electrical wholesale, not a DIY shed." },
      { merchantSlug: "demo-stuart-kingsley-building-merchant-hull", intro: "Trusted for the building bits I need around an install — fixings, conduit, surface trunking." }
    ]
  },
  {
    slug: "demo-stuart-kingsley-building-merchant-hull",
    socials: {
      instagram: "@kingsley-merchants-hull",
      facebook: "KingsleyBuildingMerchantsHull",
      twitter: "@kingsley_hull",
      tiktok: "@kingsley.merchants.hull"
    },
    postcodes: ["HU1", "HU2", "HU3", "HU4", "HU5", "HU6", "HU7", "HU8", "HU9", "HU10", "HU11", "HU12", "HU13", "HU16", "HU17"],
    bioExtra: [
      `**Service area.** Yard on the eastern edge of Hull, deliveries across HU1-HU17 plus the East Riding villages. Loaded vans go out at 7am Monday-Friday, half day Saturday. Account trades inside Hull get same-day cut-and-deliver on plasterboard, timber and bagged plaster ordered before 11am.`,
      `**What we're known for.** Trade prices that don't punish you for ordering smaller loads. We'll cut sheet materials and bagged plasterboard for collection, hold standing orders for regular site customers, and our office picks up the phone — no being shunted to a national call centre. Family-run since 1987.`
    ],
    reviews: [
      { name: "Trevor J.", gender: "men", body: "I've used Stuart's yard for years on small builds in Hull. Prices are sharp, the office picks up the phone, and they'll cut plasterboard to suit the van. The kind of merchant you don't realise you're spoiled by until you have to use somewhere else.", rating: 5, type: "new_build", service: "Plasterboard (12.5mm standard) — per sheet", days: 28 },
      { name: "Lisa B.", gender: "women", body: "Ordered six bags of multi-finish and four sheets of moisture board on the Wednesday for Friday morning delivery to a job in Beverley. Arrived bang on 7am, exactly the spec we ordered, invoice the right number. Doesn't sound like much but try getting that from the big sheds.", rating: 5, type: "renovation", service: "Multi-finish plaster (25kg bag)", days: 62 },
      { name: "Aaron W.", gender: "men", body: "Standing order for fixings, screws and silicone for a small fit-out crew. Stuart's team kept a tally, monthly invoice through, no faff. Saves me at least half a day a week not having to make merchant runs.", rating: 5, type: "new_build", service: "Trade account standing order", days: 95 },
      { name: "Karen O.", gender: "women", body: "Needed twenty bags of OPC on short notice for a footings pour. Phoned Stuart's at 9am, on site by 11:30, no markup for the rush. Saved the day. The kind of yard you build a relationship with.", rating: 5, type: "new_build", service: "OPC cement (25kg bag)", days: 130 },
      { name: "Mark D.", gender: "men", body: "Insulation order — Celotex 100mm, six sheets. Quoted on the phone, delivered next morning, invoice matched the quote. No upselling to thicker boards I didn't need. Honest yard.", rating: 5, type: "new_build", service: "Rigid PIR insulation (Celotex/Kingspan 100mm)", days: 165 },
      { name: "Helen R.", gender: "women", body: "I run a small plastering business and Stuart's is the only yard in the area that'll cut plasterboard to fit the van. Saves an hour of faffing back at the unit on every job. Trade pricing fair, invoicing on time, office staff who know what I'm talking about.", rating: 5, type: "new_build", service: "Plasterboard (12.5mm standard) — per sheet", days: 19 },
      { name: "Phil G.", gender: "men", body: "Mix-and-match aggregates pickup — half a tonne of MOT type 1, a few bags of ballast, two of sharp sand. Quick, no minimum order grief, loaded into the van by the yard team. Reasonable rate.", rating: 4, type: "new_build", service: "Aggregates — per tonne", days: 75 },
      { name: "Nicola S.", gender: "women", body: "Plumbing supplies as well — copper pipe, push-fit, isolators. Not the deepest range but enough for a domestic job and the prices are fair. They'll order in what they don't stock if you give them a day or two.", rating: 5, type: "renovation", service: "Plumbing essentials", days: 200 }
    ],
    jobDiary: [
      { title: "New extension materials package, Beverley", date: 25, location: "Beverley, East Riding", summary: "Full materials package for a single-storey rear extension — blocks, timber, insulation, plasterboard, fixings — delivered in two scheduled drops to match the builder's programme." },
      { title: "Plasterer's monthly standing order", date: 58, location: "Hull HU5", summary: "Set up a standing order for a busy two-hand plastering team — bagged multi-finish, board, beads, weekly tally and monthly invoice. Keeps their van full and saves the merchant runs." },
      { title: "Urgent footings pour, East Hull", date: 99, location: "Hull HU9", summary: "Same-day delivery of OPC, sharp sand and reinforcement mesh for a footings pour where the original supplier let the builder down. Loaded and out by 11:30am." },
      { title: "Roofing and insulation package", date: 145, location: "Anlaby, Hull", summary: "Felt, battens, breathable membrane and 100mm rigid PIR for a garage conversion roof — single delivery, exactly the cut lengths the roofer asked for." }
    ],
    pickedMerchants: []
  },
  {
    slug: "demo-rebecca-fawcett-tool-hire-derby",
    socials: {
      instagram: "@fawcett-tool-hire-derby",
      facebook: "FawcettToolHireDerby",
      twitter: "@fawcett_hire",
      tiktok: "@fawcett.tool.hire.derby"
    },
    postcodes: ["DE1", "DE3", "DE21", "DE22", "DE23", "DE24", "DE65", "DE72", "DE73", "DE74"],
    bioExtra: [
      `**Service area.** Counter and yard on the south side of Derby, deliveries DE-postcodes plus the surrounding villages — Belper, Mickleover, Borrowash, Castle Donington. Most hire goes out the same day; deliveries within Derby city are free on hires of two days or more.`,
      `**What we're known for.** Hand the phone over, tell us what the job is, and we'll suggest the right tool — not the most expensive in the cupboard. Honest about whether you need the bigger breaker or the smaller one. Damage waiver explained upfront. Account customers get next-day for repeats on the same model.`
    ],
    reviews: [
      { name: "Adam K.", gender: "men", body: "Phoned Rebecca on the Friday for a wacker plate for the weekend — picked it up at 4pm, back on Monday morning, all sorted. She talked me out of the bigger plate I asked for because for my patio sub-base the smaller one was actually right. Saved me money. That's why I'll keep using her.", rating: 5, type: "renovation", service: "Wacker plate — weekend hire", days: 38 },
      { name: "Sarah M.", gender: "women", body: "Hire breaker for breaking up an old concrete shed base. Rebecca explained the SDS-max vs the bigger Kango and which one was right for the slab — went with the SDS-max, did the job in a Saturday. Damage waiver explained upfront, returned clean, no hidden costs.", rating: 5, type: "renovation", service: "SDS-max breaker — daily hire", days: 71 },
      { name: "Tom B.", gender: "men", body: "Account customer here — Rebecca's yard is the only place I hire from now. Quick on the phone, the kit's always in good order, and the damage waiver is sensible. If a tool packs in mid-hire she swaps it out same day.", rating: 5, type: "renovation", service: "Trade account hire", days: 105 },
      { name: "Lauren H.", gender: "women", body: "Cement mixer for a long weekend doing footings. Rebecca delivered it Saturday morning, came back for it Tuesday — invoice exactly what she'd quoted. No surprises, kit was clean, kept running all weekend.", rating: 5, type: "new_build", service: "Cement mixer — weekend hire", days: 142 },
      { name: "Greg P.", gender: "men", body: "Floor sander for the lounge floorboards. Rebecca showed me how to set the belt tension and which grit to start with before I left the yard. Saved me ruining the first board. Came back, no damage, fair price.", rating: 5, type: "renovation", service: "Floor sander — weekend hire", days: 178 },
      { name: "Yasmin A.", gender: "women", body: "Hired a pressure washer for a driveway clean — the smaller petrol one she recommended, not the industrial unit. Did the job, returned in two days. The quote came through clean and the invoice matched. No upsell, just the right tool.", rating: 5, type: "repair", service: "Pressure washer — daily hire", days: 25 },
      { name: "Conor F.", gender: "men", body: "Acro props and strongboys for taking out a kitchen wall. Rebecca's team helped me work out how many I needed for the span — five acros, two strongboys, with the cushions. All in the van, off I went. Returned a week later, same number back.", rating: 4, type: "renovation", service: "Acro props — weekly hire", days: 88 },
      { name: "Holly W.", gender: "women", body: "First time I'd hired anything — Rebecca's team walked me through the wacker plate without making me feel daft. Came back to a fair invoice. I'll definitely go back when the next garden project starts.", rating: 5, type: "renovation", service: "Wacker plate — weekend hire", days: 50 }
    ],
    jobDiary: [
      { title: "Builder's weekly hire rotation, DE21", date: 20, location: "Derby DE21", summary: "Regular weekly rotation for a local builder — wacker, breaker, props, mixer — delivered Mondays, collected Fridays. Account billing, fixed weekly rate." },
      { title: "Patio sub-base hire, Mickleover", date: 65, location: "Mickleover, Derby", summary: "Saturday-Monday wacker plate hire for a DIY patio — smaller plate recommended over the big one, saved the customer money and was still the right tool." },
      { title: "Trade account onboarded — fit-out crew", date: 120, location: "Derby DE1", summary: "Set up a new trade account for a shop-fit crew. Standing kit list, next-day for any repeat on the same model, monthly invoice." },
      { title: "Garden landscaping kit, Borrowash", date: 165, location: "Borrowash, Derby", summary: "Long weekend hire of mixer, pressure washer and floor saw for a back garden re-do. All delivered Saturday morning, collected the following Wednesday." }
    ],
    pickedMerchants: []
  },
  {
    slug: "demo-charlotte-pemberton-kitchen-manufacturer-bath",
    socials: {
      instagram: "@pemberton-kitchens-bath",
      facebook: "CharlottePembertonKitchensBath",
      twitter: "@pemberton_kit",
      tiktok: "@pemberton.kitchens.bath"
    },
    postcodes: ["BA1", "BA2", "BA3", "BA15", "BA16", "BS39"],
    bioExtra: [
      `**Service area.** Workshop in Bath, install across the South West — Bath, Bristol, Wells, Frome, Bradford-on-Avon, Chippenham. Designs travel further; bigger projects in Wiltshire and Somerset get a full site visit and a site survey before quoting.`,
      `**What I'm known for.** Bespoke in-frame and shaker kitchens hand-painted in Mylands. Solid tulipwood doors, dovetailed oak drawers, Blum Movento runners as standard. About 60% Georgian and Victorian period properties, 30% modern new-builds wanting something that won't look dated in five years, and 10% utility / boot rooms to match a previous kitchen we built. Twelve-week lead time on the bigger projects, eight on a standard 6-8m run.`
    ],
    reviews: [
      { name: "Eleanor W.", gender: "women", body: "Charlotte built our in-frame kitchen for a Georgian townhouse in Bath — twelve weeks from sign-off to install, and the install crew were the same people who built it. Dovetailed drawers, solid tulipwood doors, hand-painted in a Mylands colour we picked together. It looks like it has always been in the house. Couldn't recommend more highly.", rating: 5, type: "renovation", service: "Bespoke in-frame painted kitchen (medium 6-8m run)", days: 95 },
      { name: "Richard P.", gender: "men", body: "Shaker kitchen for a new-build in Frome — wanted something timeless rather than the flat-pack high-gloss everyone else was putting in. Charlotte's quote was honest, the lead time was bang on, and the install was three days clean. Worth every penny.", rating: 5, type: "new_build", service: "Bespoke shaker kitchen (medium 6-8m run)", days: 140 },
      { name: "Margaret L.", gender: "women", body: "We did the kitchen and a matching utility room. Charlotte coordinated both so the paint colour and door style matched exactly. Drawers are heavy, soft-close, and you can feel the difference between a real bespoke piece and a unit shop kitchen. The spec we agreed at quote was what arrived on the truck.", rating: 5, type: "renovation", service: "Bespoke utility room", days: 188 },
      { name: "James H.", gender: "men", body: "Big project — full in-frame kitchen with island and a separate larder, ten-metre run. Twelve weeks from order to install. Charlotte was honest about lead time from day one and didn't promise anything she couldn't deliver. The finish on the painted in-frame is gorgeous.", rating: 5, type: "renovation", service: "Large bespoke in-frame kitchen (10m+ with island)", days: 235 },
      { name: "Sophie B.", gender: "women", body: "Replaced a tired flat-pack kitchen with one of Charlotte's shaker designs. She came out, measured, sent a properly itemised quote with the door style, paint, hardware, lead time all written down. No surprises, no add-ons sneaking onto the final invoice.", rating: 5, type: "renovation", service: "Bespoke shaker kitchen (medium 6-8m run)", days: 60 },
      { name: "David O.", gender: "men", body: "Wanted matching cabinetry for a boot room and the main kitchen. Charlotte's workshop built both in the same paint batch so the colour matches dead on. Install crew (her own people) were tidy, on time, and snags were sorted in a single return visit.", rating: 5, type: "new_build", service: "Bespoke utility room", days: 110 },
      { name: "Helena J.", gender: "women", body: "We went with the in-frame kitchen with the island — the spec we agreed at quoting was what arrived, the lead time held to within a few days of the original date, and the finishing is something you only really notice when you start opening drawers. Genuinely beautiful work.", rating: 5, type: "renovation", service: "Large bespoke in-frame kitchen (10m+ with island)", days: 28 },
      { name: "Andrew F.", gender: "men", body: "Standard 7m shaker kitchen — Charlotte recommended a slightly off-white Mylands colour over the brilliant white I'd initially asked for, said it would age better. She was right. Two years in, no chips, no yellowing. Worth listening to the maker.", rating: 4, type: "renovation", service: "Bespoke shaker kitchen (medium 6-8m run)", days: 72 },
      { name: "Caroline R.", gender: "women", body: "Bath Georgian townhouse renovation — Charlotte's in-frame kitchen anchored the whole ground floor. Solid timber doors, hand-painted, the drawers feel like furniture not flat-pack. Twelve-week lead time was held to and the install was three tidy days.", rating: 5, type: "renovation", service: "Bespoke in-frame painted kitchen (medium 6-8m run)", days: 175 }
    ],
    jobDiary: [
      { title: "Bath Georgian in-frame kitchen", date: 35, location: "Bath BA2", summary: "Twelve-week build for a Georgian townhouse kitchen — solid tulipwood in-frame doors, hand-painted Mylands, dovetailed oak drawers. Three-day install by the workshop team." },
      { title: "Frome shaker new-build", date: 75, location: "Frome, Somerset", summary: "Seven-metre shaker run for a new-build property — honest brief, no surprises, ten-week lead time held to within a couple of days." },
      { title: "Matching utility, Chippenham", date: 125, location: "Chippenham, Wiltshire", summary: "Utility room cabinets built in the same paint batch as a previous kitchen we'd done for the customer two years earlier — colour-matched perfectly." },
      { title: "10m island kitchen, Wells", date: 175, location: "Wells, Somerset", summary: "Large in-frame project with island and a separate larder. Twelve-week lead time, install crew on site for four days." },
      { title: "Bradford-on-Avon boot room", date: 220, location: "Bradford-on-Avon, Wiltshire", summary: "Matching boot-room cabinetry for an existing Pemberton kitchen — solid tulipwood, painted in the original batch, dovetailed drawers." }
    ],
    pickedMerchants: []
  }
];

// ───────────────────────────────────────────────────────────────────────
// Run
// ───────────────────────────────────────────────────────────────────────

const report = {};

for (const cs of CASE_STUDIES) {
  // 1. Look up the listing id
  const listingRow = (await query(
    `SELECT id, bio, postcode_prefix, avatar_url, photos FROM hammerex_trade_off_listings WHERE slug=${esc(cs.slug)}`
  ))[0];
  if (!listingRow) {
    console.log(`MISSING: ${cs.slug}`);
    continue;
  }
  const listingId = listingRow.id;
  // Cover image for job-diary projects — `cover_image_url` is NOT NULL.
  // Re-use a real photo from this listing so we don't fabricate URLs.
  // Falls back to the avatar, then to a 1x1 transparent data URL only if
  // nothing else is available (shouldn't happen with current seeds).
  const coverFallback =
    (Array.isArray(listingRow.photos) && listingRow.photos[0]) ||
    listingRow.avatar_url ||
    "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  report[cs.slug] = { reviews: 0, socials: 0, jobDiary: 0, merchantPicks: 0 };

  // 2. Reviews — idempotent on customer_email tag.
  const existing = (await query(
    `SELECT customer_email FROM hammerex_xrated_reviews WHERE listing_id=${esc(listingId)} AND customer_email LIKE 'cs-${cs.slug}-%'`
  )).map((r) => r.customer_email);
  const existingNums = new Set(
    existing
      .map((e) => Number((e.match(/-(\d+)@/) ?? [])[1]))
      .filter((n) => Number.isFinite(n))
  );

  let newReviews = 0;
  for (let i = 0; i < cs.reviews.length; i++) {
    if (existingNums.has(i + 1)) continue;
    const r = cs.reviews[i];
    const avatarN = ((i + 4) % 90) + 10; // 14..99 — well clear of seed reviews 1..3
    const goesLive = `now() - interval '${r.days} days'`;
    const sql = `
      INSERT INTO hammerex_xrated_reviews (
        listing_id, customer_name, customer_email, customer_avatar_url,
        project_type, service_name,
        overall_rating, workmanship_rating, communication_rating,
        value_rating, timeliness_rating,
        body, status, submitted_at, goes_live_at
      ) VALUES (
        ${esc(listingId)}, ${esc(r.name)}, ${esc(csEmail(cs.slug, i + 1))},
        ${esc(`https://randomuser.me/api/portraits/${r.gender}/${avatarN}.jpg`)},
        ${esc(r.type)}, ${esc(r.service)},
        ${r.rating}, ${r.rating}, ${r.rating}, ${r.rating}, ${r.rating},
        ${esc(r.body)},
        'live',
        ${goesLive},
        ${goesLive}
      );
    `;
    await query(sql);
    newReviews++;
  }
  report[cs.slug].reviews = newReviews;

  // 3. Sync rating_avg + rating_count from live reviews.
  await query(`
    UPDATE hammerex_trade_off_listings
       SET rating_count = sub.cnt,
           rating_avg = sub.avg
      FROM (
        SELECT COUNT(*)::int AS cnt, ROUND(AVG(overall_rating)::numeric, 2) AS avg
          FROM hammerex_xrated_reviews
         WHERE listing_id = ${esc(listingId)}
           AND status IN ('live','disputed')
      ) AS sub
     WHERE id = ${esc(listingId)};
  `);

  // 4. Socials
  await query(`
    UPDATE hammerex_trade_off_listings SET
      instagram = ${esc(cs.socials.instagram)},
      facebook = ${esc(cs.socials.facebook)},
      twitter = ${esc(cs.socials.twitter)},
      tiktok = ${esc(cs.socials.tiktok)}
    WHERE id = ${esc(listingId)};
  `);
  report[cs.slug].socials = 4;

  // 5. Service postcodes
  const postcodeArr = `ARRAY[${cs.postcodes.map(esc).join(",")}]::text[]`;
  await query(`
    UPDATE hammerex_trade_off_listings
       SET service_postcodes = ${postcodeArr}
     WHERE id = ${esc(listingId)};
  `);

  // 6. Bio polish — append once, detect via sentinel.
  const currentBio = listingRow.bio ?? "";
  if (!currentBio.includes(BIO_SENTINEL)) {
    const extras = cs.bioExtra.join("\n\n");
    const newBio = `${currentBio}\n\n${BIO_SENTINEL}\n\n${extras}`;
    await query(`
      UPDATE hammerex_trade_off_listings SET bio = ${esc(newBio)} WHERE id = ${esc(listingId)};
    `);
  }

  // 7. Enable Job Diary + Materials Network add-ons so the public sections render.
  await query(`
    UPDATE hammerex_trade_off_listings
       SET addons_enabled = COALESCE(addons_enabled, '{}'::jsonb)
                            || jsonb_build_object('job_diary', true, 'materials_network', true)
     WHERE id = ${esc(listingId)};
  `);

  // 8. Job diary — idempotent on the tagged title prefix.
  const tag = jdTitlePrefix(cs.slug);
  const existingProjects = (await query(
    `SELECT id, title FROM hammerex_xrated_projects WHERE listing_id=${esc(listingId)} AND title LIKE ${esc(tag + "%")}`
  )).map((p) => p.title.replace(tag + " ", ""));
  const existingTitles = new Set(existingProjects);
  for (let i = 0; i < cs.jobDiary.length; i++) {
    const j = cs.jobDiary[i];
    if (existingTitles.has(j.title)) continue;
    const started = `now() - interval '${j.date} days'`;
    const updatedAt = `now() - interval '${Math.max(j.date - 7, 1)} days'`;
    // status='live' requires completed_at IS NULL per the projects_completed_consistency check.
    const projRes = await query(`
      INSERT INTO hammerex_xrated_projects (
        listing_id, title, location_label,
        started_at,
        cover_image_url,
        status, sort_order,
        privacy_disclaimer_confirmed_at
      ) VALUES (
        ${esc(listingId)}, ${esc(`${tag} ${j.title}`.slice(0, 80))}, ${esc(j.location.slice(0, 60))},
        ${started},
        ${esc(coverFallback)},
        'live', ${i + 1},
        ${started}
      ) RETURNING id;
    `);
    const projectId = projRes[0].id;
    // Two update notes per project so the diary page has real entries.
    await query(`
      INSERT INTO hammerex_xrated_project_updates (
        project_id, status_chip, image_urls, note, posted_at
      ) VALUES
        (${esc(projectId)}, 'on_track', ARRAY[]::text[], ${esc(`Day 1 on site — ${j.summary.split(".")[0]}.`.slice(0, 270))}, ${started}),
        (${esc(projectId)}, 'stage_complete', ARRAY[]::text[], ${esc(`Wrapped up clean. ${j.summary}`.slice(0, 270))}, ${updatedAt});
    `);
    report[cs.slug].jobDiary++;
  }

  // 9. Materials network picks — idempotent.
  for (const pick of cs.pickedMerchants) {
    const merchant = (await query(
      `SELECT id FROM hammerex_trade_off_listings WHERE slug=${esc(pick.merchantSlug)}`
    ))[0];
    if (!merchant) continue;
    const exists = (await query(
      `SELECT id FROM hammerex_xrated_merchant_picks WHERE tradie_listing_id=${esc(listingId)} AND merchant_listing_id=${esc(merchant.id)}`
    ))[0];
    if (exists) continue;
    await query(`
      INSERT INTO hammerex_xrated_merchant_picks (
        tradie_listing_id, merchant_listing_id, intro_note, sort_order, status
      ) VALUES (
        ${esc(listingId)}, ${esc(merchant.id)}, ${esc(pick.intro)},
        ${cs.pickedMerchants.indexOf(pick) + 1}, 'live'
      );
    `);
    report[cs.slug].merchantPicks++;
  }
}

console.log("\n=== Case-study seed complete ===");
for (const slug of Object.keys(report)) {
  console.log(`${slug}: +${report[slug].reviews} reviews, +${report[slug].jobDiary} diary entries, +${report[slug].merchantPicks} merchant picks, ${report[slug].socials} socials updated`);
}

const totals = (await query(`
  SELECT l.slug, COUNT(r.id) AS reviews, l.rating_avg, l.rating_count
    FROM hammerex_trade_off_listings l
    LEFT JOIN hammerex_xrated_reviews r ON r.listing_id = l.id
   WHERE l.slug IN (${CASE_STUDIES.map((c) => esc(c.slug)).join(",")})
   GROUP BY l.slug, l.rating_avg, l.rating_count
   ORDER BY l.slug;
`));
console.log("\n=== Final review totals ===");
for (const row of totals) {
  console.log(`${row.slug}: ${row.reviews} reviews, avg ${row.rating_avg}`);
}
