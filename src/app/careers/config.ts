// /careers/[trade] — UK Trade Career Guides config.
//
// Fifth Phase 2 SEO surface. Owns career-intent queries currently
// unserved:
//   • "how to become a plumber UK"
//   • "electrician apprenticeship 2026"
//   • "carpenter qualifications UK"
//   • "plasterer NVQ level 2"
//   • "roofer training UK"
//
// Also serves as a recruitment funnel — once a would-be trade is
// qualified, the platform is where they set up shop. The final CTA
// on every guide points to trade-off signup.
//
// Every page cross-links to:
//   • /price-index (earning potential — real data)
//   • /trades/[trade] (find qualified work as one)
//   • /trade-off/pricing (join the platform)
//
// Source citations: gov.uk apprenticeship service, IfATE, City &
// Guilds, JTL, ECS/JIB, CITB. Every stat published + reviewed
// quarterly.

export type TrainingRoute = {
  name:        string;
  duration:    string;
  cost:        string;
  suits:       string;
  outcome:     string;
};

export type CareerGuide = {
  slug:            string;
  displayName:     string;
  plural:          string;
  overview:        string;
  qualifications:  string[];
  routes:          TrainingRoute[];
  earningsSummary: string;
  earningsRange: {
    apprentice: string;
    qualified:  string;
    experienced: string;
    selfEmployed: string;
  };
  jobOutlook:      string;
  dayInLife:       string[];
  requiredTraits:  string[];
  faqs:            Array<{ q: string; a: string }>;
  regulatoryBody:  string;
  citation:        string;
  lastReviewed:    string;
};

export const CAREER_GUIDES: CareerGuide[] = [
  {
    slug: "plumber",
    displayName: "Plumber",
    plural: "plumbers",
    overview:
      "Plumbers install and maintain water, drainage, and heating systems in domestic and commercial properties. In the UK, most plumbing work is not legally restricted — but gas work is (see Gas Safe registration). Qualified plumbers earn from £25,000 as an employee to £60,000+ self-employed, with London and specialist heat-pump installers at the top of the range.",
    qualifications: [
      "Level 2 Diploma in Plumbing Foundation (or equivalent)",
      "Level 3 Diploma in Plumbing and Domestic Heating (or Level 3 Advanced Apprenticeship)",
      "Gas Safe registration (for any gas work) — requires ACS assessment after Level 3",
      "Water Regulations certificate (WRAS)",
      "Unvented Hot Water certificate (G3) — required for cylinders",
      "18th Edition IET Wiring Regs (for boiler + control electrical work)"
    ],
    routes: [
      {
        name: "Plumbing & Heating Apprenticeship",
        duration: "3-4 years",
        cost: "Free (employer + government funded) · earn while you learn",
        suits: "16-24 year olds, or career changers with employer sponsorship",
        outcome: "Level 3 NVQ + ACS Gas + WRAS + real site experience"
      },
      {
        name: "Full-time College Diploma",
        duration: "2 years",
        cost: "£1,500-£6,000 (or free if under 19)",
        suits: "School leavers who want classroom-first learning",
        outcome: "Level 3 Diploma — still needs on-site experience to work independently"
      },
      {
        name: "Fast-track Adult Course",
        duration: "6-12 months",
        cost: "£4,000-£8,000",
        suits: "Adult career changers with 2+ years to invest",
        outcome: "Level 2 + basic experience — most graduates need mate work to build hours"
      }
    ],
    earningsSummary:
      "Newly-qualified employed plumbers start at £25,000-£28,000. After 3-5 years, £32,000-£40,000. Self-employed plumbers with steady work earn £45,000-£70,000. Gas-Safe registered engineers command a 20-30% premium.",
    earningsRange: {
      apprentice:   "£6,600-£19,000/yr (grade dependent)",
      qualified:    "£25,000-£32,000/yr employed",
      experienced:  "£35,000-£50,000/yr employed / £50,000-£70,000 self-employed",
      selfEmployed: "£45-£90/hr · £180-£350/day (£260-£460 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Strong. UK skills shortage in plumbing + heating is projected to widen through 2030 as ~30,000 plumbers retire and heat-pump installation demand accelerates (Boiler Upgrade Scheme + net-zero targets). Federation of Master Builders' 2026 State of Trade report ranks plumbing as the second-most-in-demand trade in the UK.",
    dayInLife: [
      "7:30 — Van loaded night before. Route planned around 3-4 calls.",
      "8:00 — First call: boiler service. Benchmark check + gas rate + fluepipe integrity. 45 mins.",
      "9:00 — Second call: leaking radiator valve. Isolate, drain, swap TRV, refill, re-pressurise. 1 hr.",
      "11:00 — Merchant run. Grab parts for afternoon jobs.",
      "12:30 — Lunch on site of the big job of the day: bathroom refit day 2 of 5.",
      "13:00-17:00 — Bathroom rough-in. Waste + supply pipework, back-fill test.",
      "17:30 — Update customer WhatsApp on day 3 plans. Invoice yesterday's work."
    ],
    requiredTraits: [
      "Comfortable with problem diagnosis (a 'blocked toilet' is rarely just a blocked toilet)",
      "Physically capable of loft/crawl-space access + 20kg cylinder lifts",
      "Customer-facing — you're in someone's home for hours at a time",
      "Numerate — you're calculating pipe sizes, boiler kW, and quote margins on the fly"
    ],
    faqs: [
      {
        q: "How long does it take to become a fully qualified plumber in the UK?",
        a: "3-4 years via the standard apprenticeship route, ending in Level 3 NVQ + Gas Safe registration. Fast-track college routes can shorten this to 2 years for the qualification, but employers + insurers expect real on-site hours before quoting solo jobs."
      },
      {
        q: "Do I need to be Gas Safe registered to work as a plumber?",
        a: "Not for water-only work (bathrooms, waste, cold water systems, drainage). But any gas work — boiler installs, gas hobs, gas heaters — is legally restricted to Gas Safe registered engineers. Adding Gas Safe unlocks 60-70% of the residential plumbing market."
      },
      {
        q: "How much does a self-employed plumber earn in the UK?",
        a: "£45-£90/hr, £180-£350/day — see the UK Trade Price Index for regional breakdowns. London self-employed plumbers with a strong client base regularly clear £70,000-£100,000. Emergency + Gas Safe callouts command a further 25-40% premium."
      }
    ],
    regulatoryBody: "Gas Safe Register (gas) · WRAS (water regulations) · CIPHE (Chartered Institute of Plumbing and Heating Engineering)",
    citation: "IfATE Plumbing and Domestic Heating Technician standard · Gas Safe Register 2026 · FMB State of Trade 2026",
    lastReviewed: "2026-07-15"
  },
  {
    slug: "electrician",
    displayName: "Electrician",
    plural: "electricians",
    overview:
      "Electricians design, install, and maintain electrical systems in domestic, commercial, and industrial settings. In England and Wales, most notifiable electrical work (new circuits, bathroom work, EV chargers) requires a registered Competent Person under Part P of the Building Regulations. Newly-qualified electricians earn £26,000+ employed; experienced self-employed regularly clear £55,000-£80,000.",
    qualifications: [
      "Level 2 + Level 3 Electrotechnical qualifications (City & Guilds 5357, 8202, or EAL equivalents)",
      "18th Edition IET Wiring Regs (BS 7671)",
      "NVQ Level 3 in Electrotechnical Services (proof of on-site competence)",
      "AM2 assessment (industry endpoint — required for JIB gold card)",
      "Part P notifier registration (via NICEIC, NAPIT, ELECSA, Stroma) — required to self-certify"
    ],
    routes: [
      {
        name: "Electrical Installation Apprenticeship",
        duration: "3-4 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds via JTL, JIB, or direct employer",
        outcome: "Level 3 NVQ + AM2 + gold card eligibility"
      },
      {
        name: "College + Site Experience",
        duration: "2 years college + 2-3 years mate work",
        cost: "£1,500-£6,000 college",
        suits: "School leavers without an apprenticeship offer",
        outcome: "Same endpoint but longer route — NVQ + AM2 still required"
      },
      {
        name: "Adult Fast-Track (Domestic Installer)",
        duration: "6-12 months",
        cost: "£5,000-£9,000",
        suits: "Career changers targeting residential-only work",
        outcome: "Part P scheme entry — legally allowed to certify domestic work"
      }
    ],
    earningsSummary:
      "Newly-qualified employed electricians start at £26,000-£30,000. After 3-5 years, £34,000-£45,000. Self-employed residential electricians earn £45,000-£65,000; commercial + industrial specialists £55,000-£90,000+. EV charger installers are the fastest-growing niche.",
    earningsRange: {
      apprentice:   "£6,600-£20,000/yr (grade dependent)",
      qualified:    "£26,000-£34,000/yr employed",
      experienced:  "£38,000-£55,000/yr employed / £55,000-£80,000 self-employed",
      selfEmployed: "£45-£75/hr · £220-£380/day (£300-£480 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Very strong. EV charger install demand, heat-pump control wiring, and battery-storage retrofits are creating new specialist niches. IET forecasts a UK electrician shortfall of 20,000+ by 2030. NAPIT + NICEIC report 5-8 week install lead-times in most UK regions.",
    dayInLife: [
      "7:00 — Van check + first-fix parts loaded.",
      "8:00 — Site 1: kitchen rewire day 3 of 4. Second-fix sockets + switches + hob isolator.",
      "12:30 — Onsite lunch. Test + certify morning's work.",
      "13:00 — Site 2: EV charger install. Load calc, tail into consumer unit, run 6mm to garage, commission.",
      "16:00 — Site 3: fault-find on tripping RCD. Insulation resistance + line-earth loop. Trace to loft junction box.",
      "17:30 — Invoicing + issuing EIC certificates via NICEIC portal."
    ],
    requiredTraits: [
      "Comfortable with maths — voltage drop, cable sizing, load balancing",
      "Attention to detail — one loose connection is a fire risk",
      "Continuous learning — Wiring Regs update every 2-3 years",
      "Diagnostic mindset — half the job is finding the fault, not fixing it"
    ],
    faqs: [
      {
        q: "How long does it take to become a qualified electrician in the UK?",
        a: "3-4 years via the standard Electrical Installation apprenticeship, ending in NVQ Level 3 + AM2 + JIB gold card. Adult fast-track routes to Part P residential work can be done in 6-12 months but limit you to domestic scope."
      },
      {
        q: "Do I need Part P to work as an electrician?",
        a: "Part P is only required to self-certify notifiable domestic work in England + Wales. If you're employed by a bigger contractor with an in-house notifier, you don't personally need it. If you're going self-employed on residential jobs, Part P registration (NICEIC, NAPIT, ELECSA, Stroma) is essential — otherwise every job needs a Building Control notification + fee."
      },
      {
        q: "What's the highest-earning electrical specialism in the UK 2026?",
        a: "EV chargepoint installation, battery storage retrofits, and industrial control systems (PLCs). All three have thin practitioner supply against rapidly growing demand. Industrial control engineers regularly clear £80,000-£110,000."
      }
    ],
    regulatoryBody: "IET (Wiring Regs) · JIB / ECS (industry cards) · NICEIC / NAPIT / ELECSA / Stroma (Part P schemes)",
    citation: "IfATE Installation Electrician standard · JIB 2026 rates · IET Wiring Regs 18th Edition",
    lastReviewed: "2026-07-15"
  },
  {
    slug: "carpenter",
    displayName: "Carpenter / Joiner",
    plural: "carpenters",
    overview:
      "Carpenters cut, fit, and finish timber in construction — from first-fix structural work (joists, roof timbers, studwork) to second-fix finishing (doors, skirting, kitchens, staircases). Joinery is the workshop-based branch — bespoke doors, windows, furniture. Carpentry is one of the UK's most portable trades — qualified carpenters travel to Australia, Canada, and the US on skilled-migrant routes.",
    qualifications: [
      "Level 2 Diploma in Site Carpentry (or Bench Joinery for workshop route)",
      "Level 3 NVQ in Site Carpentry or Architectural Joinery",
      "CSCS card (blue skilled worker or gold advanced craft)",
      "Asbestos awareness (UKATA) — required for pre-2000 property work",
      "Working at Height — for roofing timber + staircase work"
    ],
    routes: [
      {
        name: "Site Carpentry Apprenticeship",
        duration: "2-3 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds, or adult apprentices via CITB",
        outcome: "Level 2 or 3 NVQ + on-site hours + gold CSCS card"
      },
      {
        name: "Bench Joinery Apprenticeship",
        duration: "3-4 years",
        cost: "Free · earn while you learn",
        suits: "Those wanting bespoke workshop work (windows, doors, staircases, furniture)",
        outcome: "Level 3 Bench Joinery + fine hand-skills"
      },
      {
        name: "Full-time College",
        duration: "2 years",
        cost: "£1,500-£4,500 (free if under 19)",
        suits: "School leavers without an apprenticeship offer",
        outcome: "Level 2 or Level 3 Diploma — needs on-site experience to price + quote"
      }
    ],
    earningsSummary:
      "Newly-qualified employed carpenters start at £24,000-£28,000. Experienced site carpenters earn £32,000-£42,000. Self-employed carpenters + bench joiners earn £40,000-£65,000; specialist staircase + heritage joiners £60,000-£90,000.",
    earningsRange: {
      apprentice:   "£6,600-£18,000/yr",
      qualified:    "£24,000-£30,000/yr employed",
      experienced:  "£32,000-£45,000/yr employed / £40,000-£65,000 self-employed",
      selfEmployed: "£30-£55/hr · £180-£320/day (£250-£400 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Strong. Timber-frame housebuilding, loft conversions, and heritage restoration all rely heavily on skilled carpenters + joiners. CITB projects UK-wide site carpenter demand to grow 8% year-on-year through 2028.",
    dayInLife: [
      "7:00 — Van check. Tools + fixings for today's job.",
      "8:00 — Site: loft conversion week 2, first-fix. Cutting + fitting new rafters + purlins.",
      "12:30 — Onsite lunch. Confirm second-fix schedule with client.",
      "13:00 — Continue first-fix. Studwork for new en-suite partition.",
      "16:30 — Snag chase from yesterday's job — client wanted skirting mitre tightened.",
      "17:30 — Merchant run for tomorrow. Invoicing evening."
    ],
    requiredTraits: [
      "Confident with measurement + geometry — a 1° error compounds over 3 metres",
      "Physically capable of overhead + kneeling work + material lifts",
      "Patient — good finish carpentry is 20% cutting, 80% fitting",
      "Detail-oriented — the finished skirting mitre is your calling card"
    ],
    faqs: [
      {
        q: "What's the difference between a carpenter and a joiner in the UK?",
        a: "Carpenters work on-site with dimensioned timber — first-fix (structural) and second-fix (finish). Joiners work in a workshop making bespoke items (staircases, windows, doors, furniture) that are then installed by carpenters. Many trades do both."
      },
      {
        q: "How much does a self-employed carpenter earn in the UK?",
        a: "£30-£55/hr, £180-£320/day nationally — see the UK Trade Price Index. Specialist joiners (bespoke staircase, hand-cut roofs, high-end kitchen fitting) tend to charge day-rate only at £280-£450."
      },
      {
        q: "Do UK carpenters need Working at Heights certification?",
        a: "Not strictly, but any commercial site + most reputable builders will insist on it for roof timber, dormer, and staircase work. It's a one-day course, £150-£250, and is a standard employer requirement."
      }
    ],
    regulatoryBody: "CITB (Construction Industry Training Board) · IOC (Institute of Carpenters)",
    citation: "IfATE Carpentry and Joinery standard · CITB UK Skills Demand 2026",
    lastReviewed: "2026-07-15"
  },
  {
    slug: "plasterer",
    displayName: "Plasterer",
    plural: "plasterers",
    overview:
      "Plasterers apply skim finishes to walls + ceilings, install plasterboard (drylining), and — at the specialist end — restore ornate lime and lath-and-plaster surfaces in period properties. Plastering is one of the trades where speed + finish quality compound directly into hourly earnings.",
    qualifications: [
      "Level 2 Diploma in Plastering (Solid or Fibrous route)",
      "Level 3 NVQ in Plastering",
      "CSCS card (blue skilled worker)",
      "Asbestos awareness (UKATA)",
      "PASMA (mobile scaffold tower) — for ceiling + high-wall work"
    ],
    routes: [
      {
        name: "Plastering Apprenticeship",
        duration: "2 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds via CITB or direct employer",
        outcome: "Level 2 NVQ + CSCS blue card + on-site hours"
      },
      {
        name: "Full-time College",
        duration: "1-2 years",
        cost: "£1,500-£4,000 (free if under 19)",
        suits: "School leavers wanting classroom-first learning",
        outcome: "Level 2 Diploma — needs 500+ hours mate work to build finishing speed"
      },
      {
        name: "Adult Short Course",
        duration: "4-12 weeks",
        cost: "£1,500-£3,500",
        suits: "Career changers or DIYers upgrading to paid work",
        outcome: "Basic skim + patch competence — not enough for solo pricing on bigger jobs"
      }
    ],
    earningsSummary:
      "Newly-qualified employed plasterers earn £22,000-£28,000. Experienced self-employed plasterers earn £35,000-£55,000. Speed matters — a fast plasterer can double the day-rate income of a slow one on the same tickets.",
    earningsRange: {
      apprentice:   "£6,600-£17,000/yr",
      qualified:    "£22,000-£28,000/yr employed",
      experienced:  "£30,000-£40,000/yr employed / £40,000-£60,000 self-employed",
      selfEmployed: "£30-£50/hr · £180-£280/day (£240-£360 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Steady + growing. UK housebuilding volumes + retrofit insulation programmes (ECO4, GBIS) both drive plastering demand. Fibrous + heritage plaster restoration is a specialist niche with limited practitioner supply.",
    dayInLife: [
      "6:30 — Van loaded with bags of multi-finish + browning.",
      "7:30 — On site. Mix + go straight into skim on prepped walls from yesterday.",
      "11:00 — Second coat. Trowel down to a polished finish.",
      "13:00 — Onsite lunch while first walls set.",
      "13:30 — Move to second room. Prep + PVA + first coat.",
      "16:30 — Final trowel-down + clean site. Job complete for this room.",
      "17:00 — Load van for tomorrow. Follow up on next 2 quotes."
    ],
    requiredTraits: [
      "Speed matters — day-rate work rewards fast, consistent finishers",
      "Physical stamina — trowel work is 8 hours of shoulder + wrist load",
      "Detail-oriented — a bad finish shows the moment paint hits it",
      "Comfortable in dust + wet-work conditions"
    ],
    faqs: [
      {
        q: "How much does it cost to train as a plasterer in the UK?",
        a: "Apprenticeship = free (you earn while you learn). College Level 2 Diploma = £1,500-£4,000, or free if under 19. Adult short courses = £1,500-£3,500 for a basic entry — but expect to work as a labourer/mate for 6-12 months before pricing solo."
      },
      {
        q: "Can I make a good living as a self-employed plasterer?",
        a: "Yes. £40-£60k/year is realistic for a competent self-employed plasterer with steady residential + landlord work. Specialist heritage or Venetian polished-plaster work commands £300-£500/day."
      }
    ],
    regulatoryBody: "CITB (Construction Industry Training Board) · GPC (Guild of Master Plasterers)",
    citation: "IfATE Plasterer standard · CITB UK Skills Demand 2026",
    lastReviewed: "2026-07-15"
  },
  {
    slug: "roofer",
    displayName: "Roofer",
    plural: "roofers",
    overview:
      "Roofers install and repair pitched + flat roofs across residential, commercial, and heritage buildings. UK roofing splits into slate + tile (pitched), flat-roofing (EPDM, GRP, felt, single-ply), and lead + heritage work. All roofing work requires Working at Heights competence + CSCS card.",
    qualifications: [
      "Level 2 Diploma in Roofing Occupations (Slating & Tiling / Roof Slating & Tiling / Roof Sheeting & Cladding)",
      "Level 3 NVQ Diploma in Roofing (Applicable Route)",
      "CSCS card (blue skilled worker)",
      "PASMA + Working at Heights certification",
      "Asbestos awareness (UKATA)"
    ],
    routes: [
      {
        name: "Roofing Apprenticeship",
        duration: "2-3 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds via NFRC + CITB",
        outcome: "Level 2 NVQ + Working at Heights + CSCS"
      },
      {
        name: "Onsite Assessment & Training (OSAT)",
        duration: "6-18 months",
        cost: "Employer-funded, or £1,200-£3,000 self-funded",
        suits: "Experienced roofers wanting to convert experience into formal NVQ",
        outcome: "Level 2 or 3 NVQ recognised for CSCS"
      },
      {
        name: "College + Site Experience",
        duration: "1-2 years college + 1-2 years mate work",
        cost: "£1,500-£4,000",
        suits: "School leavers without an apprenticeship offer",
        outcome: "Level 2 Diploma — needs site experience for solo work"
      }
    ],
    earningsSummary:
      "Employed roofers earn £26,000-£36,000. Self-employed pitched-roof teams earn £45,000-£70,000 per person. Specialist heritage lead-workers + slate + tile roofers on listed buildings command £280-£450/day.",
    earningsRange: {
      apprentice:   "£6,600-£18,000/yr",
      qualified:    "£26,000-£32,000/yr employed",
      experienced:  "£34,000-£45,000/yr employed / £45,000-£70,000 self-employed",
      selfEmployed: "£35-£60/hr · £220-£380/day (£300-£480 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Strong seasonal demand. Roof-repair work + insurance-driven storm damage keeps December-April busy; new-build + planned re-roofs peak May-October. The UK Roofing Federation reports acute skills shortage for slate + tile specialists in Scotland, Wales, and the North.",
    dayInLife: [
      "6:30 — Van + van's ladder rack loaded with battens + felt + skips of tiles.",
      "7:30 — Erect scaffolding drop or check scaffolder's setup. Toolbox talk.",
      "8:00 — Strip old tiles + felt. Load into skip on ground.",
      "12:30 — Onsite lunch. Half-way check on ridge line + hip cuts.",
      "13:00 — Batten out. Fit new felt + battens.",
      "15:00 — Start re-tile from eaves up.",
      "17:00 — Clean guttering + downpipes. Bagged nails + broken tiles cleared."
    ],
    requiredTraits: [
      "Confident + safe at height (the trade doesn't suit everyone)",
      "Physically fit — 25-30kg tile bundles carried up ladders all day",
      "Weather-tolerant — you work in rain, wind, and heat",
      "Detail-focused — a badly bedded ridge tile lets in water for 20 years"
    ],
    faqs: [
      {
        q: "How much does a UK roofer earn?",
        a: "£26,000-£36,000 employed. Self-employed pitched-roof teams earn £45,000-£70,000/head. Heritage slate + lead work commands £280-£450/day. Emergency callouts for storm damage add another £250-£600 per callout."
      },
      {
        q: "Do I need Working at Height certification to be a UK roofer?",
        a: "Yes for any commercial site + most reputable builders. Working at Heights + PASMA are one-day courses, £150-£250 each. HSE inspections routinely check these on commercial sites."
      },
      {
        q: "What roofing specialism pays the most in the UK?",
        a: "Heritage lead-work on listed buildings + churches — very few qualified practitioners, high demand from Historic England contracts. Specialist single-ply roofers on large flat-roof commercial buildings also command day-rates well above the general roofing average."
      }
    ],
    regulatoryBody: "NFRC (National Federation of Roofing Contractors) · CITB · IWSc (heritage)",
    citation: "IfATE Roofer standard · NFRC 2026 UK Roofing Skills Report",
    lastReviewed: "2026-07-15"
  },
  {
    slug: "bricklayer",
    displayName: "Bricklayer",
    plural: "bricklayers",
    overview:
      "Bricklayers build and repair walls in brick, block, and stone across every UK construction sector — new-build housing, extensions, garden walls, chimney stacks, repointing, and heritage masonry. Bricklaying is one of the trades on the UK's Shortage Occupation List, driving strong wages and reliable work.",
    qualifications: [
      "Level 2 Diploma in Bricklaying",
      "Level 3 NVQ Diploma in Trowel Occupations (Bricklaying)",
      "CSCS card (blue skilled worker or gold advanced craft)",
      "Working at Heights (for stack + boundary wall work above 2m)",
      "Asbestos awareness (UKATA)"
    ],
    routes: [
      {
        name: "Bricklaying Apprenticeship",
        duration: "2-3 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds via CITB or direct employer",
        outcome: "Level 2 or 3 NVQ + on-site hours + CSCS card"
      },
      {
        name: "Full-time College Diploma",
        duration: "1-2 years",
        cost: "£1,500-£4,000 (free if under 19)",
        suits: "School leavers without an apprenticeship offer",
        outcome: "Level 2 Diploma — needs 12+ months mate work to build speed + accuracy"
      },
      {
        name: "Adult Fast-Track / OSAT",
        duration: "6-18 months",
        cost: "£1,500-£4,500 (fast-track) or employer-funded (OSAT)",
        suits: "Career changers with construction experience",
        outcome: "Level 2 NVQ recognised for CSCS card"
      }
    ],
    earningsSummary:
      "Employed bricklayers earn £26,000-£36,000. Self-employed bricklayers on new-build sites regularly clear £50,000-£75,000 working piece-rate. London + South East bricklaying is currently one of the UK's highest-paid trades — steady residential + commercial demand.",
    earningsRange: {
      apprentice:   "£6,600-£18,000/yr",
      qualified:    "£26,000-£32,000/yr employed",
      experienced:  "£34,000-£48,000/yr employed / £50,000-£75,000 self-employed",
      selfEmployed: "£30-£55/hr · £200-£340/day (£280-£420 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Very strong. UK bricklaying appears on the Home Office's Shortage Occupation List — CITB projects a shortfall of 20,000+ trained bricklayers by 2028 as retirements outpace apprenticeship completions. Housebuilder demand alone drives 5-8% wage growth annually in most UK regions.",
    dayInLife: [
      "6:30 — Site arrival, unload materials, check line + level from yesterday's setout.",
      "7:00 — Toolbox talk + tea. Confirm gang plan for the day (3-course lifts + gauging).",
      "7:30 — Lay first course. Aim for 400-600 bricks per person before lunch.",
      "12:30 — Onsite lunch. Cover work + check for weather.",
      "13:00 — Continue laying. Second lift + block inner leaf.",
      "16:00 — Point up joints. Stack tomorrow's bricks + clear scaffold.",
      "17:00 — Site secure. Debrief with foreman on next-day priority."
    ],
    requiredTraits: [
      "Speed matters — new-build piece rates reward fast, accurate bricklayers",
      "Physically strong — repeated lifting of 3-4kg bricks all day",
      "Accurate to millimetre — a wall out of plumb is out forever",
      "Weather-tolerant — bricklaying stops in heavy frost + rain but continues in most conditions"
    ],
    faqs: [
      {
        q: "How much does a self-employed UK bricklayer earn?",
        a: "£50,000-£75,000/year is realistic for a competent self-employed bricklayer with steady new-build or extension work. Piece-rate on new-build (£450-£900 per 1000 bricks laid) rewards speed — the fastest gangs regularly clear £1,000/day/person."
      },
      {
        q: "Is bricklaying on the UK Shortage Occupation List?",
        a: "Yes — bricklaying has been on the Shortage Occupation List since 2019 and remains there. That drives wages up + creates a strong hiring market for qualified bricklayers, plus opens skilled-worker visa routes for overseas practitioners."
      },
      {
        q: "How long does it take to become a bricklayer in the UK?",
        a: "2-3 years via the standard apprenticeship route ending in Level 2 or 3 NVQ. Fast-track adult routes reach Level 2 in 6-12 months but graduates typically need 6-12 months mate work to build the speed + accuracy expected on paid sites."
      }
    ],
    regulatoryBody: "CITB (Construction Industry Training Board) · Guild of Bricklayers",
    citation: "IfATE Bricklayer standard · CITB UK Skills Demand 2026 · Home Office Shortage Occupation List",
    lastReviewed: "2026-07-20"
  },
  {
    slug: "gas-safe-engineer",
    displayName: "Gas Safe engineer",
    plural: "Gas Safe engineers",
    overview:
      "Gas Safe engineers are the only UK tradespeople legally allowed to install, service, or repair gas appliances + gas pipework. Registration is statutory (Gas Safety Regulations 1998). Around 70% also hold Level 3 plumbing NVQ — those who do end-to-end boiler + bathroom + heating installs are the highest-earning residential trade group in the UK.",
    qualifications: [
      "Level 2 + Level 3 Plumbing NVQ (typical entry route)",
      "ACS (Accredited Certification Scheme) — the gas endpoint assessment",
      "Gas Safe Register annual renewal + audit",
      "Water Regulations (WRAS)",
      "Unvented Hot Water certificate (G3)"
    ],
    routes: [
      {
        name: "Plumbing + Gas Apprenticeship",
        duration: "3-4 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds; adult apprentices via CITB",
        outcome: "Level 3 Plumbing NVQ + ACS + Gas Safe registration"
      },
      {
        name: "Adult Managed Learning Programme",
        duration: "12-18 months",
        cost: "£4,500-£8,500 self-funded",
        suits: "Career changers with plumbing background or a strong practical foundation",
        outcome: "Level 3 + ACS + registration; still needs 6-12 months mate work"
      }
    ],
    earningsSummary:
      "Employed Gas Safe engineers earn £30,000-£45,000. Self-employed Gas Safe engineers regularly clear £55,000-£90,000; specialist commercial + heat-pump crossover engineers £70,000-£110,000+.",
    earningsRange: {
      apprentice:   "£6,600-£20,000/yr",
      qualified:    "£30,000-£38,000/yr employed",
      experienced:  "£40,000-£55,000/yr employed / £55,000-£90,000 self-employed",
      selfEmployed: "£55-£110/hr · £260-£480/day (£340-£580 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Very strong. UK boiler installations run 1.5m per year, plus a growing heat-pump conversion market under the Boiler Upgrade Scheme. Gas Safe Register reports engineer numbers falling 3-5% annually — demand steadily exceeds supply.",
    dayInLife: [
      "7:30 — Van check + parts run. Route around 3-4 calls.",
      "8:00 — First call: annual boiler service + CP12 for a landlord.",
      "10:30 — Second call: intermittent lockout fault — flue draught check + PCB replacement.",
      "12:30 — Onsite lunch at the big job of the day: combi boiler swap + power flush.",
      "13:00-17:00 — Boiler off + drained, new unit hung + connected, commissioned, Benchmark logged.",
      "17:30 — Invoicing + CP12 uploads to Gas Safe portal."
    ],
    requiredTraits: [
      "Diagnostic mindset — half of gas work is fault-finding, not fitting",
      "Rigorous about safety — one missed tightness test is a headline",
      "Confident with maths + gas rate calculations",
      "Customer-facing — you're in homes all day"
    ],
    faqs: [
      {
        q: "How do I become Gas Safe registered in the UK?",
        a: "Complete a Level 3 Plumbing NVQ (via apprenticeship or Managed Learning Programme), pass the ACS gas endpoint assessment (typically CCN1 core + specific appliance modules like CENWAT for boilers), and register with Gas Safe. Total time 3-4 years apprenticeship route, 12-18 months adult fast-track."
      },
      {
        q: "How much do UK Gas Safe engineers earn?",
        a: "£55-£110/hr, £260-£480/day nationally (2026 — see UK Trade Price Index). Self-employed £55k-£90k+ in most regions; £90k-£110k+ in London and for heat-pump crossover specialists."
      }
    ],
    regulatoryBody: "Gas Safe Register (statutory)",
    citation: "Gas Safe Register 2026 · IfATE Plumbing and Domestic Heating standard · Gas Safety (Installation and Use) Regulations 1998",
    lastReviewed: "2026-07-20"
  },
  {
    slug: "tiler",
    displayName: "Tiler",
    plural: "tilers",
    overview:
      "UK tilers install ceramic, porcelain, natural stone, and glass tiles to walls + floors. Specialism splits between residential (bathrooms, kitchens, wet-rooms) and commercial (shopfits, hotels, public buildings). Rewards speed + finish accuracy — day-rate income doubles for fast, clean tilers on same-price tickets.",
    qualifications: [
      "Level 2 Diploma in Wall and Floor Tiling",
      "Level 3 NVQ in Tiling",
      "CSCS card (blue skilled worker)",
      "Asbestos awareness (UKATA)",
      "Working at Heights (feature walls + high ceilings)"
    ],
    routes: [
      {
        name: "Tiling Apprenticeship",
        duration: "2 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds via CITB or direct employer",
        outcome: "Level 2 NVQ + CSCS + on-site hours"
      },
      {
        name: "Full-time College",
        duration: "1-2 years",
        cost: "£1,500-£4,000 (free if under 19)",
        suits: "School leavers wanting classroom-first learning",
        outcome: "Level 2 Diploma; needs 6+ months mate work to build speed"
      },
      {
        name: "Adult Short Course",
        duration: "6-12 weeks",
        cost: "£1,500-£3,000",
        suits: "Career changers targeting residential-only work",
        outcome: "Basic competence; realistic to price small jobs solo after 6-12 months experience"
      }
    ],
    earningsSummary:
      "Employed tilers earn £22,000-£32,000. Self-employed residential tilers earn £30,000-£55,000. Specialist commercial + heritage tilers command day rates of £280-£450 on premium jobs.",
    earningsRange: {
      apprentice:   "£6,600-£17,000/yr",
      qualified:    "£22,000-£28,000/yr employed",
      experienced:  "£30,000-£40,000/yr employed / £35,000-£55,000 self-employed",
      selfEmployed: "£30-£55/hr · £180-£300/day (£240-£380 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Steady + growing. UK bathroom + kitchen refurbishment demand runs above 1m units per year. Wet-room + open-plan tiling specialisms have particularly strong demand-supply imbalance.",
    dayInLife: [
      "7:00 — Van check + tile + adhesive load.",
      "7:45 — On site. Cover-and-mask + prep substrate.",
      "8:30 — Set out the room. Cut whole tiles to establish the pattern.",
      "10:00 — First walls up. Wet-cutting external edges.",
      "13:00 — Lunch. Grout the room done yesterday.",
      "13:30 — Continue laying + finish walls.",
      "16:30 — Grout + silicone; clean site."
    ],
    requiredTraits: [
      "Speed matters — day-rate income doubles between slow + fast tilers on same tickets",
      "Detail-oriented — a bad cut shows the moment paint hits the wall next to it",
      "Physical stamina — kneeling + trowel work for hours",
      "Comfortable with maths — set-out calculations for every job"
    ],
    faqs: [
      {
        q: "How much do UK tilers earn?",
        a: "£30-£55/hr, £180-£300/day nationally in 2026. Fast + experienced residential tilers on steady bathroom + kitchen work regularly clear £45k-£55k/year self-employed. Specialist commercial + heritage tilers earn £60k+."
      },
      {
        q: "How long does a tiling apprenticeship take?",
        a: "2 years for the Level 2 NVQ via CITB or a direct employer apprenticeship. Adult short courses can compress the qualification to 6-12 weeks but graduates typically need 6-12 months mate work to build enough speed + accuracy for solo pricing."
      }
    ],
    regulatoryBody: "CITB (Construction Industry Training Board) · The Tile Association (TTA)",
    citation: "IfATE Wall and Floor Tiler standard · CITB UK Skills Demand 2026",
    lastReviewed: "2026-07-20"
  },
  {
    slug: "landscaper",
    displayName: "Landscaper",
    plural: "landscapers",
    overview:
      "UK landscapers design and build outdoor spaces — patios, driveways, walls, decking, water features, and planting schemes. The trade splits into hard-landscape (structural build) and soft-landscape (planting + turf). Post-2008 SuDS regulations require every new UK driveway to be either permeable-paved or drained to a soakaway — landscapers who understand + certify SuDS have a growing pricing premium.",
    qualifications: [
      "Level 2 Diploma in Landscape Construction OR Horticulture",
      "Level 3 NVQ in Landscape Construction",
      "CSCS card (blue skilled worker)",
      "PA1 + PA6 pesticides certificates (for chemical treatment)",
      "Chainsaw certificate (NPTC CS30/CS31 for tree work)"
    ],
    routes: [
      {
        name: "Landscaping Apprenticeship",
        duration: "2-3 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds via Lantra or CITB routes",
        outcome: "Level 2 or 3 NVQ + CSCS + on-site experience"
      },
      {
        name: "College Diploma",
        duration: "1-2 years",
        cost: "£1,500-£4,000 (free if under 19)",
        suits: "School leavers with hands-on interest",
        outcome: "Level 2 Diploma; needs 12+ months labour work to build build-speed"
      }
    ],
    earningsSummary:
      "Employed landscapers earn £22,000-£32,000. Self-employed landscapers running a small crew earn £45,000-£70,000. Established landscape-design specialists with high-end residential clients earn £70,000-£120,000+.",
    earningsRange: {
      apprentice:   "£6,600-£17,000/yr",
      qualified:    "£22,000-£28,000/yr employed",
      experienced:  "£30,000-£42,000/yr employed / £45,000-£70,000 self-employed",
      selfEmployed: "£25-£50/hr · £180-£320/day (£250-£400 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Growing. UK garden + outdoor-space spend surged post-2020 + hasn't dropped back. SuDS-compliant driveway installers + heat-resilient planting specialists particularly in demand as climate patterns shift.",
    dayInLife: [
      "7:00 — Van + trailer loaded, materials to site.",
      "8:00 — Groundwork: dig out patio area, load spoil into skip.",
      "10:30 — Lay MOT Type 1 sub-base, whacker-plate compact.",
      "13:00 — Onsite lunch.",
      "13:30 — Mortar bed + slab lay to fall.",
      "17:00 — Point up, tidy site, cover finished work."
    ],
    requiredTraits: [
      "Physical stamina — landscaping is heavy manual work",
      "Weather-tolerant — work continues in most conditions",
      "Design eye — the visible finish is the sale",
      "Numerate — set-out + gradient + drainage calculations"
    ],
    faqs: [
      {
        q: "How much do UK landscapers earn?",
        a: "£25-£50/hr, £180-£320/day nationally in 2026. Established self-employed landscapers running crews earn £45k-£70k; landscape-design specialists working with high-end residential clients earn £70k-£120k+."
      },
      {
        q: "Do UK landscapers need to know SuDS regulations?",
        a: "Yes — since 2008, new + replaced driveways over 5m² in England must be either permeable paving OR drained to a soakaway. Landscapers who design, quote, and sign this off as part of the driveway install command a pricing premium."
      }
    ],
    regulatoryBody: "Lantra (Sector Skills Council) · CITB · British Association of Landscape Industries (BALI)",
    citation: "IfATE Landscape Construction Operative standard · Lantra UK Landscape Industries Market Report 2026",
    lastReviewed: "2026-07-20"
  },
  {
    slug: "painter",
    displayName: "Painter & decorator",
    plural: "painters & decorators",
    overview:
      "UK painters & decorators prepare and paint walls, ceilings, woodwork, and exteriors. The visible finish quality tracks prep quality almost linearly — good decorators spend 60-70% of the time on prep (filling, sanding, caulking, priming, mist-coating). Specialists in heritage restoration, spray-lacquer, and effect finishes command significant premiums.",
    qualifications: [
      "Level 2 Diploma in Painting and Decorating",
      "Level 3 NVQ in Decorative Occupations",
      "CSCS card (blue skilled worker)",
      "PASMA (mobile scaffold tower — ceiling + external work)",
      "Working at Heights"
    ],
    routes: [
      {
        name: "Painting + Decorating Apprenticeship",
        duration: "2 years",
        cost: "Free · earn while you learn",
        suits: "16-24 year olds via CITB or direct employer",
        outcome: "Level 2 NVQ + CSCS + on-site hours"
      },
      {
        name: "College Diploma",
        duration: "1-2 years",
        cost: "£1,500-£4,000 (free if under 19)",
        suits: "School leavers wanting classroom-first learning",
        outcome: "Level 2 Diploma; needs 6-12 months labour to build finishing speed"
      },
      {
        name: "Adult Short Course",
        duration: "4-12 weeks",
        cost: "£1,000-£3,000",
        suits: "Career changers targeting residential-only work",
        outcome: "Basic competence; realistic solo pricing after 6-12 months mate work"
      }
    ],
    earningsSummary:
      "Employed painters earn £22,000-£30,000. Self-employed residential painters earn £30,000-£48,000. Specialist heritage + spray-finish painters command £60,000-£90,000+.",
    earningsRange: {
      apprentice:   "£6,600-£17,000/yr",
      qualified:    "£22,000-£28,000/yr employed",
      experienced:  "£28,000-£38,000/yr employed / £30,000-£48,000 self-employed",
      selfEmployed: "£25-£45/hr · £160-£260/day (£220-£340 in London — see UK Trade Price Index)"
    },
    jobOutlook:
      "Steady. Residential redecoration cycles run every 5-8 years on interior + 8-12 years on exterior — reliable repeat demand. Heritage + high-end residential + specialist commercial work grows above general market rate.",
    dayInLife: [
      "7:30 — Van check + paint load for the day.",
      "8:00 — Site. Cover-and-mask, fill last night's caulk.",
      "9:00 — Sand + prime new work.",
      "12:00 — Lunch, tools soaked.",
      "13:00 — First colour coat on the largest wall.",
      "16:00 — Cut in edges + tidy.",
      "17:00 — Clean tools, load van for tomorrow."
    ],
    requiredTraits: [
      "Detail-oriented — prep quality determines the final finish quality",
      "Patient — most of the work is prep, not the visible paint",
      "Comfortable at height (ceilings, external upper storeys)",
      "Customer-facing — you're in occupied homes for days"
    ],
    faqs: [
      {
        q: "How much do UK painter & decorators earn?",
        a: "£25-£45/hr, £160-£260/day nationally in 2026. Self-employed residential painters earn £30k-£48k; heritage + spray-finish specialists £60k-£90k+."
      },
      {
        q: "How long does painting + decorating training take?",
        a: "2 years for the Level 2 apprenticeship route, ending in NVQ + CSCS card. Adult short courses (4-12 weeks) get you working as a labourer/mate; realistic solo pricing after 6-12 months of on-site experience."
      }
    ],
    regulatoryBody: "CITB (Construction Industry Training Board) · Painting and Decorating Association (PDA)",
    citation: "IfATE Painter and Decorator standard · CITB UK Skills Demand 2026",
    lastReviewed: "2026-07-20"
  }
];

export const HUB_FAQS = [
  {
    q: "How are these UK trade career guides sourced?",
    a: "Every guide is written from primary sources: the Institute for Apprenticeships and Technical Education (IfATE) standards, gov.uk apprenticeship service, CITB skills demand reports, Federation of Master Builders State of Trade, and the regulatory body for each trade (Gas Safe Register, IET, NFRC, GPC). Earnings figures reference The Networkers' own UK Trade Price Index."
  },
  {
    q: "How often are the career guides updated?",
    a: "Quarterly. Any standard change, regulatory update, or earnings shift triggers a review + re-publish. Every guide shows its last-reviewed date."
  },
  {
    q: "I'm already qualified — how does The Networkers help me find work?",
    a: "Set up your free trade profile at /trade-off/pricing. Homeowners find you directly via /trades/[trade]/[city] pages. No lead broker in the middle. No commission on completed jobs."
  }
];
