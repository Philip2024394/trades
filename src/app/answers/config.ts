// UK Trade Q&A hub — programmatic answer pages.
//
// Third Phase 2 SEO pillar after /price-index + /grants. Same
// discipline: evidence-first answers, every fact linked to source or
// to another canonical page (Price Index, Cost Calculator, Grants).
//
// Target search intent:
//   • "how much to fit a boiler UK"
//   • "how long does a rewire take"
//   • "do I need a gas safe engineer to fit a hob"
//   • "can I DIY loft insulation"
//   • "what does a plumber charge per hour UK"
//
// Ranking mechanism: QAPage schema — Google (and AI-search extractors)
// treat this page as an authoritative Q&A source. Answer surfaced
// directly in SERP.
//
// Growth loop: once network has traffic + trades, add a "Real trades
// answered this" section that pulls verified trade responses per
// question — turns each page into a compounding local-expertise moat.

export type AnswerCategory = "plumbing" | "electrical" | "carpentry" | "plastering" | "roofing" | "general";

export type Answer = {
  slug:           string;
  question:       string;
  /** One-sentence AI-style answer surfaced directly + used for meta description. */
  shortAnswer:    string;
  /** Full detailed answer, 2-4 short paragraphs. */
  longAnswer:     string[];
  category:       AnswerCategory;
  /** Trades that would take this job. Used to cross-link /trades/[trade]. */
  relatedTrades:  string[];
  /** Cost calculators to cross-sell. Used to link /cost/[project]. */
  relatedCosts:   string[];
  /** Related grants (from /grants config slugs). */
  relatedGrants:  string[];
  /** Follow-up questions people also ask. Links to sibling answer slugs. */
  peopleAlsoAsk:  string[];
  /** Last time the answer was reviewed. */
  lastReviewed:   string;
  /** Optional cover image — documented in the hero library under
   *  sibling_group_id "answers-editorial-covers". Add sparingly:
   *  only for evergreen high-volume queries where the visual
   *  materially helps SERP CTR. */
  heroImage?:     string;
  heroAlt?:       string;
};

export const ANSWERS: Answer[] = [
  // ─── PLUMBING ───────────────────────────────────────────────
  {
    slug: "how-much-does-a-boiler-cost-to-fit-uk",
    question: "How much does a boiler cost to fit in the UK?",
    heroImage: "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_53_07%20AM.png",
    heroAlt:   "UK Gas Safe engineer fitting a wall-mounted combi boiler in a domestic utility room",
    shortAnswer: "A combi boiler fitted like-for-like costs £1,650-£2,500 in the UK for 2026, including boiler + labour + basic parts. System boilers run £1,900-£2,900. A full heating conversion (combi ↔ system) adds £800-£2,500 in extra labour.",
    longAnswer: [
      "The UK 2026 range for a like-for-like combi boiler replacement is £1,650 to £2,500. That price includes a mid-tier boiler (Worcester Bosch, Vaillant, Ideal, Baxi), Gas Safe engineer labour, standard flue, magnetic filter, and Benchmark commissioning — but assumes the new boiler goes on the same wall as the old one with no pipework re-route.",
      "System boilers cost more (£1,900-£2,900) because they're paired with a hot-water cylinder and typically go in larger homes. A regular (heat-only) boiler is similar. Swapping between boiler types — combi to system, or vice versa — adds significant labour (£800-£2,500) because pipework, controls, and often the hot-water storage need reworking.",
      "You can offset the cost with the Boiler Upgrade Scheme (£7,500 off a heat pump replacement) or ECO4 (fully-funded boiler swap for eligible low-income households). 0% VAT applies automatically on qualifying installs — a 20% saving on your invoice."
    ],
    category: "plumbing",
    relatedTrades: ["gas-safe-engineer", "plumber"],
    relatedCosts:  ["new-boiler"],
    relatedGrants: ["boiler-upgrade-scheme", "eco4", "vat-zero-rating-esm"],
    peopleAlsoAsk: ["how-long-does-a-boiler-install-take", "what-does-a-plumber-charge-per-hour-uk"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "how-long-does-a-boiler-install-take",
    question: "How long does a boiler installation take in the UK?",
    shortAnswer: "A like-for-like combi swap takes one day (6-8 hours). A boiler type change (combi ↔ system) or a move to a new location takes 2-3 days. First-time-fit installations run 3-5 days.",
    longAnswer: [
      "The industry standard for a like-for-like combi boiler swap is one working day. A Gas Safe engineer typically arrives at 8am, isolates the old boiler and drains the system, fits the new boiler on the existing wall, flushes the system, commissions and pressure-tests, and hands over the Benchmark log by 4-5pm.",
      "If you're changing boiler type — swapping a combi for a system boiler + cylinder, or vice versa — expect 2-3 days. Extra labour comes from re-routing pipework, moving the boiler to a new wall, installing (or removing) a hot-water cylinder, and updating heating controls.",
      "A first-time-fit installation (no existing gas supply, or converting from electric-only to gas central heating) is a 3-5 day job. New gas run from the meter, radiator install, cylinder install (if system), and full commissioning. Book two Gas Safe engineers if possible — parallel work halves the total time."
    ],
    category: "plumbing",
    relatedTrades: ["gas-safe-engineer", "plumber"],
    relatedCosts:  ["new-boiler"],
    relatedGrants: ["boiler-upgrade-scheme"],
    peopleAlsoAsk: ["how-much-does-a-boiler-cost-to-fit-uk"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "what-does-a-plumber-charge-per-hour-uk",
    question: "What does a plumber charge per hour in the UK?",
    shortAnswer: "UK plumbers charge £45-£90 per hour nationally in 2026. London plumbers are £60-£110/hr. Emergency callouts run £75-£150 for the first hour, then hourly rate. Gas Safe engineers command £55-£110/hr because of the qualification premium.",
    longAnswer: [
      "The national UK plumber hourly rate for 2026 is £45-£90, according to The Networkers' UK Trade Price Index. Day rates work out at £180-£350 depending on region + specialism.",
      "London plumbers charge 30-40% above the national average — £60-£110/hr — because of higher operating costs (van insurance, congestion charge, parking, higher living costs).",
      "For emergency callouts (out-of-hours, weekends, bank holidays), expect £75-£150 for the first hour, then the standard hourly rate. Gas Safe registered engineers charge a premium (£55-£110/hr) because gas work is legally restricted to them."
    ],
    category: "plumbing",
    relatedTrades: ["plumber", "gas-safe-engineer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-boiler-cost-to-fit-uk", "do-i-need-a-gas-safe-engineer-to-fit-a-hob"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "do-i-need-a-gas-safe-engineer-to-fit-a-hob",
    question: "Do I need a Gas Safe engineer to fit a gas hob in the UK?",
    shortAnswer: "Yes — connecting any gas appliance in the UK, including a gas hob, is legally restricted to Gas Safe registered engineers under the Gas Safety (Installation and Use) Regulations 1998. DIY gas work is a criminal offence.",
    longAnswer: [
      "The Gas Safety (Installation and Use) Regulations 1998 make it a criminal offence for anyone not on the Gas Safe Register to install, service, or maintain a gas appliance in the UK. That includes gas hobs, gas ovens, boilers, gas fires, and gas water heaters.",
      "Non-Gas-Safe installation invalidates your home insurance, can void the appliance manufacturer's warranty, and — critically — creates carbon monoxide and explosion risk. Every Gas Safe engineer carries a photo ID card with a licence number you can verify at GasSafeRegister.co.uk.",
      "For a straight hob swap (like-for-like connection to an existing gas supply), expect a Gas Safe engineer to charge £100-£180 for a 1-2 hour job. If you need a new gas point run to the hob location, add £250-£500."
    ],
    category: "plumbing",
    relatedTrades: ["gas-safe-engineer", "plumber"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-a-plumber-charge-per-hour-uk", "how-much-does-a-boiler-cost-to-fit-uk"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "how-much-does-a-bathroom-refit-cost-uk",
    question: "How much does a bathroom refit cost in the UK?",
    shortAnswer: "A UK mid-range bathroom refit costs £5,500-£8,500 in 2026, including new suite, tiling, plumbing, electrics, and 5-7 days of labour. Budget refits start at £3,500. High-end + wetroom conversions run £12,000-£25,000.",
    longAnswer: [
      "The UK 2026 average for a mid-range family bathroom refit is £5,500-£8,500. That covers a new suite (bath, WC, basin, taps, shower), full tiling of walls + floor, plumbing rework, extractor fan replacement, lighting rework, and 5-7 days of labour split between a plumber, tiler, and electrician.",
      "Budget refits (£3,500-£5,000) reuse the existing layout, use trade-brand fittings, and use half-height tiling. High-end refits (£12,000-£25,000) include wetroom conversion, underfloor heating, feature tiling, walk-in showers, and moved services (bath to new wall, etc).",
      "Regional pricing matters — London bathrooms are typically 35% above the national mid-range figure. Northern cities (Newcastle, Sheffield, Liverpool) run 8-10% below the national average."
    ],
    category: "plumbing",
    relatedTrades: ["plumber", "tiler", "electrician"],
    relatedCosts:  ["bathroom-refit"],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-a-plumber-charge-per-hour-uk"],
    lastReviewed: "2026-07-15"
  },

  // ─── ELECTRICAL ─────────────────────────────────────────────
  {
    slug: "how-long-does-a-house-rewire-take",
    question: "How long does a full house rewire take in the UK?",
    shortAnswer: "A full rewire of a UK 3-bed semi takes 5-10 working days. 4-5 bed houses take 10-15 days. Occupied properties add 20-30% because of dust protection + evening work-arounds.",
    longAnswer: [
      "For a typical UK 3-bed semi, a full rewire runs 5-10 working days. That covers stripping out old cables, chasing walls, running new twin & earth cable to every socket + light, installing a new consumer unit, testing, and issuing an Electrical Installation Certificate (EIC).",
      "Larger properties (4-5 bed detached) take 10-15 days. If the property is occupied during the rewire — you're not moving out — expect 20-30% longer because of dust sheeting, room-by-room isolation, and evening work-arounds to keep essential circuits live.",
      "The finished job must be signed off with an EIC. Get a Part P registered electrician (NICEIC, NAPIT, ELECSA, Stroma) — they self-certify and notify Building Control on your behalf. Cost expectation is £3,500-£5,500 for the whole job."
    ],
    category: "electrical",
    relatedTrades: ["electrician"],
    relatedCosts:  ["house-rewire"],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-an-electrician-charge-per-hour-uk", "do-i-need-a-part-p-electrician-for-a-socket"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "what-does-an-electrician-charge-per-hour-uk",
    question: "What does an electrician charge per hour in the UK?",
    shortAnswer: "UK electricians charge £45-£75 per hour nationally in 2026. London electricians run £60-£95/hr. Day rates are £220-£380. Emergency callouts are £65-£140 for the first hour.",
    longAnswer: [
      "The national UK electrician hourly rate for 2026 is £45-£75, per The Networkers' UK Trade Price Index. Day rates work out at £220-£380 depending on region + specialism (industrial + commercial electricians charge more than domestic).",
      "London electricians charge £60-£95/hr, reflecting the standard 30-40% London premium seen across all UK trades.",
      "For emergency callouts (out-of-hours, weekends), expect £65-£140 for the first hour then the standard hourly rate. Part-P notification work (any circuit change in a special location like a bathroom, or a new circuit) requires a registered scheme member and adds £30-£60 to the invoice for the notification fee."
    ],
    category: "electrical",
    relatedTrades: ["electrician"],
    relatedCosts:  ["house-rewire"],
    relatedGrants: [],
    peopleAlsoAsk: ["how-long-does-a-house-rewire-take", "do-i-need-a-part-p-electrician-for-a-socket"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "do-i-need-a-part-p-electrician-for-a-socket",
    question: "Do I need a Part P electrician to add a new socket in the UK?",
    shortAnswer: "For a new socket added to an existing circuit in a standard room (not a bathroom or kitchen), no — DIY is legal in England + Wales. But adding a new circuit, or any work in a bathroom or outdoors, requires a Part P registered electrician.",
    longAnswer: [
      "Since the 2013 changes to Part P of the Building Regulations, adding a socket to an existing circuit in a bedroom, living room, or hallway is no longer notifiable. You can DIY it in England or Wales, provided the work is done to BS 7671 (the IET Wiring Regs) and the circuit's protective device is adequately rated.",
      "But — new circuits are still notifiable. So is any work in a bathroom or shower room ('special locations'), any outdoor electrical work (garden lights, EV chargers, outbuildings), and work in a kitchen next to a sink. All of these require a Part P registered electrician (NICEIC, NAPIT, ELECSA, Stroma) who can self-certify and notify Building Control.",
      "Scotland has different rules — all electrical work should follow BS 7671 and be certified. Northern Ireland doesn't have a Part P equivalent but insurance + resale expectations still require a registered installer for anything more than a straightforward like-for-like swap."
    ],
    category: "electrical",
    relatedTrades: ["electrician"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-an-electrician-charge-per-hour-uk", "how-long-does-a-house-rewire-take"],
    lastReviewed: "2026-07-15"
  },

  // ─── ROOFING ────────────────────────────────────────────────
  {
    slug: "how-much-does-a-new-roof-cost-uk",
    question: "How much does a new roof cost in the UK?",
    shortAnswer: "A new pitched roof on a UK 3-bed semi costs £5,500-£10,500 in 2026, including tiles, felt, battens, and labour. Full re-roofing with structural work (rafters, ridge) runs £8,500-£18,000. Flat roof replacement is £80-£120 per m² for EPDM.",
    longAnswer: [
      "For a UK 3-bed semi with a standard pitched roof, a like-for-like re-roof (strip old tiles, new felt + batten, retile) is £5,500-£10,500 in 2026. Slate re-roofing is at the top of that range; concrete tile is at the bottom. Add £1,000-£2,000 for scaffolding.",
      "If the roof timbers need repair or replacement — sagging ridge, rotten rafters, felt failure back to the deck — the total climbs to £8,500-£18,000. A full structural re-roof on a 4-bed detached can reach £22,000+ with premium slate.",
      "Flat roofs are quoted per m². EPDM (long-life rubber) runs £80-£120/m² installed. GRP fibreglass is £90-£130/m². Felt roofing is cheaper (£45-£75/m²) but has a shorter life (10-15 years vs 25-30 for EPDM/GRP)."
    ],
    category: "roofing",
    relatedTrades: ["roofer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: [],
    lastReviewed: "2026-07-15"
  },

  // ─── PLASTERING ─────────────────────────────────────────────
  {
    slug: "how-much-does-plastering-a-room-cost-uk",
    question: "How much does plastering a room cost in the UK?",
    shortAnswer: "Skim-coating an average UK bedroom (walls + ceiling, ~40m²) costs £550-£900 in 2026. Full re-plaster (browning + skim) is £800-£1,400. A ceiling only is £250-£450. Prices include materials.",
    longAnswer: [
      "Skimming (a fresh 2-3mm plaster finish over sound existing plaster or new plasterboard) is the most common job. For an average UK bedroom (~40m² of wall + ceiling), expect £550-£900 for 1-2 days' work by a solo plasterer.",
      "If the existing plaster has failed and needs to come off back to brick, you're into a full re-plaster: browning coat + finish. Same-size room runs £800-£1,400 and 3-4 days. Add £200-£500 if you want beading, corner reinforcement, or dot-and-dab boarding first.",
      "Ceiling-only work (over lath + plaster ceilings or drylining a damaged ceiling) is £250-£450 for a standard bedroom. London plasterers charge 30-40% more than the national average, per the UK Trade Price Index."
    ],
    category: "plastering",
    relatedTrades: ["plasterer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: [],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "can-i-diy-loft-insulation",
    question: "Can I DIY loft insulation, or do I need a professional in the UK?",
    shortAnswer: "Yes — laying loft insulation between rafters and joists is DIY-friendly, and materials cost £250-£450 for a typical UK 3-bed loft. A professional install costs £400-£700. Free installation is available via ECO4 or GBIS for eligible households.",
    longAnswer: [
      "For an accessible loft with joists you can walk between, DIY loft insulation is genuinely straightforward. You need mineral wool rolls (100mm + 170mm layered for the current 270mm recommended depth), a face mask + long sleeves + goggles, and 2-3 hours per bedroom-worth of loft area. Materials for a UK 3-bed loft: £250-£450.",
      "A professional install (labour + materials) costs £400-£700 and gets done in a morning. They'll also fit loft insulation stilts if you're keeping the loft usable, and top up your existing insulation if it's below the current 270mm recommendation.",
      "But — you may not need to pay at all. ECO4 and GBIS fully fund loft insulation for eligible households (means-tested benefits or Council Tax band A-D properties). The Home Upgrade Grant 2 covers loft insulation as part of whole-house retrofit packages in off-gas-grid properties. See the UK Grants Tracker."
    ],
    category: "plastering",
    relatedTrades: ["plasterer", "carpenter"],
    relatedCosts:  [],
    relatedGrants: ["eco4", "great-british-insulation-scheme", "home-upgrade-grant"],
    peopleAlsoAsk: [],
    lastReviewed: "2026-07-15"
  },

  // ─── CARPENTRY ──────────────────────────────────────────────
  {
    slug: "how-much-does-a-loft-conversion-cost-uk",
    question: "How much does a loft conversion cost in the UK?",
    shortAnswer: "A dormer loft conversion on a UK 3-bed semi costs £45,000-£65,000 in 2026. Velux-only (rooflight) conversions are cheaper at £30,000-£45,000. Full mansard + hip-to-gable jobs run £55,000-£85,000. London adds 30-35%.",
    longAnswer: [
      "The UK 2026 range for a mid-size dormer loft conversion (adds one double bedroom + en-suite) is £45,000-£65,000. That's design + structural calcs + party wall + build + finishes + first-fix + second-fix + plumbing + electrics + Building Control sign-off.",
      "A rooflight (Velux) conversion — no dormer, just windows in the existing roof plane — is the cheapest at £30,000-£45,000. Only works if you already have adequate head-height (2.2m+ under the ridge, 2.0m+ over the stairs).",
      "Full mansard or hip-to-gable conversions (used to gain a second bedroom + en-suite) run £55,000-£85,000, occasionally topping £100k in London. Most conversions in England fall under Permitted Development (no full planning app needed) — see the /planning/loft-conversion guide."
    ],
    category: "carpentry",
    relatedTrades: ["carpenter", "roofer", "electrician"],
    relatedCosts:  ["loft-conversion"],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-plastering-a-room-cost-uk"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "how-much-does-a-kitchen-extension-cost-uk",
    question: "How much does a kitchen extension cost in the UK?",
    shortAnswer: "A single-storey rear kitchen extension in the UK (15-30m²) costs £45,000-£65,000 for 2026 in mid-range spec. Small (up to 15m²) starts at £30,000. Wraparound + double-storey extensions run £75,000-£150,000. London prices are 30-40% higher.",
    longAnswer: [
      "The UK 2026 average for a single-storey rear kitchen extension in mid-range spec (15-30m², good-quality kitchen units, aluminium bifold doors, engineered oak floor) is £45,000-£65,000. That covers foundations, structural steels, brick + block build, roof, insulation, windows, doors, plaster, electrics, plumbing, kitchen fit + finishes.",
      "Small extensions (under 15m²) start at £30,000. Wraparound extensions (rear + side return combined) run £55,000-£85,000. Double-storey rear extensions are £75,000-£150,000 depending on complexity and finish.",
      "Most rear extensions under 4m single-storey (semi) or 3m (detached) fall under Permitted Development in England — no planning app needed, though you do need a Prior Approval submission if going deeper than 3m/4m. See /planning/rear-extension for the full check."
    ],
    category: "carpentry",
    relatedTrades: ["carpenter", "bricklayer", "electrician", "plumber"],
    relatedCosts:  ["kitchen-extension"],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-loft-conversion-cost-uk"],
    lastReviewed: "2026-07-15"
  },
  {
    slug: "what-does-a-carpenter-charge-per-hour-uk",
    question: "What does a carpenter charge per hour in the UK?",
    shortAnswer: "UK carpenters charge £30-£55 per hour nationally in 2026. Day rates are £180-£320. Specialist joiners (bespoke staircase, hand-cut roof, kitchen fitting) charge at the top of the range or day-rate only.",
    longAnswer: [
      "The national UK carpenter hourly rate for 2026 is £30-£55, per The Networkers' UK Trade Price Index. Day rates work out at £180-£320. First-fix carpenters (studwork, joists, roof timbers) typically sit in the middle of that range; second-fix carpenters (doors, skirting, architraves) at the top.",
      "London carpenters run £40-£70/hr with day rates of £250-£400. Specialist joiners (bespoke staircase, cut-and-pitched hand-cut roofs, high-end kitchen fitters) tend to work day-rate only at £280-£450.",
      "For quick jobs (hang a door, fit skirting, fix a squeaky floor), most carpenters have a minimum callout of 2 hours or a half-day rate."
    ],
    category: "carpentry",
    relatedTrades: ["carpenter"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-loft-conversion-cost-uk", "how-much-does-a-kitchen-extension-cost-uk"],
    lastReviewed: "2026-07-15"
  },

  // ─── PLUMBING (expansion 2026-07-20) ────────────────────────
  {
    slug: "how-much-to-move-a-radiator-uk",
    question: "How much does it cost to move a radiator in the UK?",
    shortAnswer: "Moving a single radiator in the UK costs £180-£350 in 2026 including pipework alteration, new pipe drops, and refilling the system. A pair moved during a refit runs £300-£550 total.",
    longAnswer: [
      "A standard radiator move is a half-day job for a plumber — drain the affected section, cut and re-route the copper flow + return, fit new pipe drops in the new position, refit the radiator, refill, bleed, and balance. Materials are minor (£15-£30 of copper + fittings); labour dominates the cost.",
      "If the new position requires chasing walls (concealed pipework) or lifting floorboards, add £80-£200. If the radiator is being upgraded to a bigger unit at the same time, the plumber will usually price the whole thing as one job at £300-£500.",
      "For a full-room refit where multiple radiators are moved, expect £150-£220 per radiator as part of the wider job — plumbers give volume discounts on this because the system only needs draining + refilling once."
    ],
    category: "plumbing",
    relatedTrades: ["plumber"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-a-plumber-charge-per-hour-uk", "how-much-does-a-bathroom-refit-cost-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-a-boiler-service-cost-uk",
    question: "How much does a boiler service cost in the UK?",
    shortAnswer: "A standard UK boiler service costs £75-£120 in 2026 for a 45-60 minute check by a Gas Safe engineer. Landlord Gas Safety certificates (CP12) run £75-£130 for one appliance, £15-£25 per extra.",
    longAnswer: [
      "The industry-standard annual boiler service takes 45-60 minutes and includes: gas rate check, flue integrity check, seals + pressure test, casing off + heat exchanger inspection, and a written Benchmark log entry. Most manufacturers require an annual service to keep the warranty valid — worth checking your boiler's terms.",
      "Landlord Gas Safety inspections (CP12) are legally required annually for every rented property. They typically cost £75-£130 for one gas appliance (usually the boiler) plus £15-£25 for each additional appliance (gas hob, gas fire, gas heater). Book both together — most Gas Safe engineers combine boiler service + CP12 for £110-£160.",
      "Regional pricing follows the general Gas Safe engineer rate — London and the South East are 20-30% above the national average."
    ],
    category: "plumbing",
    relatedTrades: ["gas-safe-engineer", "plumber"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-boiler-cost-to-fit-uk", "do-i-need-a-gas-safe-engineer-to-fit-a-hob"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-it-cost-to-fix-a-leaking-tap-uk",
    question: "How much does it cost to fix a leaking tap in the UK?",
    shortAnswer: "A UK plumber charges £60-£120 to fix a leaking tap in 2026, including a callout, new washer or cartridge, and refit. DIY replacement of a tap washer costs £2-£5 in parts and takes 15-30 minutes.",
    longAnswer: [
      "Most leaking taps are one of two problems: a worn compression washer (traditional taps) or a failed ceramic disc cartridge (modern lever taps). A plumber will typically diagnose in 5 minutes and fix in 20-40 depending on tap age + accessibility. The minimum callout is usually 1 hour, so you're paying £60-£90 for the visit itself plus £5-£15 in parts.",
      "If the tap body itself is corroded, the fix becomes a tap swap — labour £60-£90 plus the new tap (£25-£300 depending on quality). A kitchen mixer swap runs £100-£180 all-in; a bathroom pair £120-£220.",
      "For confident DIYers: turn off the isolation valve under the sink, unscrew the tap head, replace the washer or cartridge (screwfix.com stocks generic + brand-specific), reassemble. Parts £2-£5. Just make sure you can identify your tap type before buying."
    ],
    category: "plumbing",
    relatedTrades: ["plumber"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-a-plumber-charge-per-hour-uk", "how-much-to-move-a-radiator-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-long-does-a-bathroom-refit-take-uk",
    question: "How long does a bathroom refit take in the UK?",
    shortAnswer: "A UK mid-range bathroom refit takes 5-7 working days in 2026, using one plumber, one tiler, and a part-time electrician. Full refits with layout changes or wetroom conversion take 10-14 days.",
    longAnswer: [
      "The standard 7-day schedule: Day 1 — strip out existing suite + tiles. Day 2 — first-fix plumbing + electrics (waste, supply, cabling, extractor). Day 3 — plasterboard + patching, wet floor primer. Day 4-5 — full tiling (walls + floor). Day 6 — second-fix (new suite in, taps, shower, radiator). Day 7 — grouting, silicone, final connections, snag.",
      "A full refit with layout change (bath moved, walls repositioned, wetroom drainage) adds 3-5 days for structural + drainage work. Wetroom conversions specifically need 2-3 extra days for the tanking membrane + integrated drain fall.",
      "Timeline depends heavily on trade sequencing. If your builder isn't running three specialists in parallel, expect 10-14 days even on straightforward refits. The single biggest delay factor is materials arriving late — order the suite, tiles, and any special-order items 3+ weeks before Day 1."
    ],
    category: "plumbing",
    relatedTrades: ["plumber", "tiler", "electrician"],
    relatedCosts:  ["bathroom-refit"],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-bathroom-refit-cost-uk"],
    lastReviewed: "2026-07-20"
  },

  // ─── ELECTRICAL (expansion 2026-07-20) ──────────────────────
  {
    slug: "how-much-does-an-ev-charger-install-cost-uk",
    question: "How much does an EV charger install cost in the UK?",
    shortAnswer: "A UK home EV charger install costs £800-£1,400 in 2026 including a 7kW smart charger, cable run, and installation by an OZEV-approved electrician. Longer cable runs or consumer unit upgrades add £200-£600.",
    longAnswer: [
      "A typical driveway install for a modern semi is £800-£1,100: 7kW smart charger (Ohme, Pod Point, Zappi, Andersen — £450-£750), 6mm² tails from the consumer unit to the charger (usually 5-15m), and MCB + Type A RCD or in-unit RCBO. All work must be certified by an OZEV-approved installer to comply with 2022+ Smart Charging regulations.",
      "Longer cable runs (charger 20m+ from meter, or requiring cable-in-trench for garages/outbuildings) add £150-£400 in labour + materials. Older properties often need a consumer unit upgrade to accommodate the charger circuit — £400-£700 extra.",
      "The UK EV Chargepoint Grant (£350) is still available for flat + rental property residents. Homeowners in single-family properties lost eligibility in April 2022 but can benefit from 0% VAT on qualifying installs — worth 20% off the invoice automatically."
    ],
    category: "electrical",
    relatedTrades: ["electrician"],
    relatedCosts:  [],
    relatedGrants: ["vat-zero-rating-esm"],
    peopleAlsoAsk: ["what-does-an-electrician-charge-per-hour-uk", "do-i-need-a-part-p-electrician-for-a-socket"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-a-new-consumer-unit-cost-uk",
    question: "How much does a new consumer unit (fusebox) cost in the UK?",
    shortAnswer: "A UK consumer unit replacement costs £450-£850 in 2026 including a new 17th-Edition Type A RCBO board, install by a Part-P registered electrician, EICR test, and Building Control notification.",
    longAnswer: [
      "The current standard is a metal-enclosed consumer unit with individual RCBOs per circuit (not a split-load RCD board). This satisfies BS 7671 18th Edition Amendment 2 (2022+ builds and any new installs). Typical residential board: £180-£280 for the unit, £180-£400 for install labour, £40-£80 for Building Control notification via NICEIC/NAPIT.",
      "If the existing wiring has issues that come to light during the swap (missing earths, undersized cabling, borrowed neutrals), the electrician may need to remediate before energising — add £100-£500 depending on scope. Ask for an EICR report before quoting on an older property.",
      "This is notifiable work under Part P — must be done by a Part-P scheme member (NICEIC, NAPIT, ELECSA, Stroma) who can self-certify, or notified separately to Building Control (£120-£200 fee) if done by a non-registered electrician."
    ],
    category: "electrical",
    relatedTrades: ["electrician"],
    relatedCosts:  ["house-rewire"],
    relatedGrants: [],
    peopleAlsoAsk: ["how-long-does-a-house-rewire-take", "do-i-need-a-part-p-electrician-for-a-socket"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-it-cost-to-add-a-socket-uk",
    question: "How much does it cost to add a new socket in the UK?",
    shortAnswer: "Adding a single socket to an existing circuit costs £80-£180 in the UK in 2026 for a single-gang, £100-£220 for a double. Prices assume 1-2 hours labour + minor materials + no chasing. Full circuit additions run £250-£500+.",
    longAnswer: [
      "For an accessible existing ring or radial circuit (spur off a nearby socket, cable running through the void behind plasterboard), an electrician can add a socket in 60-90 minutes: £80-£180 all-in. This is not notifiable work in England + Wales for standard rooms.",
      "If the wall needs chasing (concrete or brick), add £30-£80. If the socket is in a bathroom, kitchen next to a sink, or outdoors, the work becomes notifiable under Part P and must be done by a scheme-member — cost climbs to £120-£250.",
      "A brand-new circuit (dedicated cable + MCB from the consumer unit — required for high-draw appliances like ovens, showers, hobs, or garden outbuildings) costs £250-£500. That's always notifiable + always needs a Part P registered electrician."
    ],
    category: "electrical",
    relatedTrades: ["electrician"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["do-i-need-a-part-p-electrician-for-a-socket", "what-does-an-electrician-charge-per-hour-uk"],
    lastReviewed: "2026-07-20"
  },

  // ─── ROOFING (expansion 2026-07-20) ─────────────────────────
  {
    slug: "how-long-does-a-new-roof-last-uk",
    question: "How long does a new roof last in the UK?",
    shortAnswer: "A new UK pitched roof lasts 40-60 years for concrete tiles, 50-80 for clay tiles, and 80-150+ for natural slate. Flat roofs: EPDM + GRP fibreglass 25-30 years; single-ply 25-40 years; felt 10-15 years.",
    longAnswer: [
      "For pitched UK roofs, life expectancy tracks material quality. Concrete tiles (Marley, Sandtoft, Redland) — 40-60 years. Clay tiles — 50-80 years and often longer on well-ventilated roofs. Natural Welsh + Spanish slate — 80-150+ years; heritage properties often have original 200-year-old slate still in service.",
      "The felt and battens under the tiles are the weak link. Modern breathable membrane (Klober, Cromar Vent 3) lasts 40+ years. Older bituminous felt has a 25-35 year life — many UK roofs need a strip + refelt long before the tiles need replacing.",
      "Flat roofs used to mean a 10-year job; modern materials extend that significantly. EPDM (Firestone RubberCover) + GRP fibreglass properly installed = 25-30 years. Single-ply (TPO, PVC) = 25-40 years. Traditional felt = 10-15 years and still commonly used on garage roofs where cost is the driver."
    ],
    category: "roofing",
    relatedTrades: ["roofer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-new-roof-cost-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-a-flat-roof-replacement-cost-uk",
    question: "How much does a flat roof replacement cost in the UK?",
    shortAnswer: "Flat roof replacement in the UK 2026 costs £80-£120 per m² for EPDM, £90-£130/m² for GRP fibreglass, £120-£180/m² for single-ply. A standard 15m² garage flat roof runs £1,200-£2,700 depending on material.",
    longAnswer: [
      "EPDM (Firestone RubberCover) is the current UK residential mainstream — £80-£120/m² fully installed including deck prep, drip trim, and pipe boots. Life expectancy 25-30 years. Best value for garage roofs, extensions, dormers, and small commercial.",
      "GRP fibreglass (fully-bonded, seamless, laid wet) — £90-£130/m². Slightly longer to install (2-3 days for 15m² vs 1 day for EPDM), but the finish is harder-wearing and takes foot traffic better. Common on balconies + roof terraces.",
      "Single-ply membrane (Sika Sarnafil, Alkorplan, Firestone UltraPly) — £120-£180/m². Premium option, hot-air welded seams, 25-40 year life. Standard on commercial + high-end residential. Not usually cost-effective for a single garage.",
      "Traditional felt (torch-on 3-layer bitumen) — £45-£75/m². Still fitted on many UK garage roofs because it's cheap; 10-15 year life. Increasingly displaced by EPDM which lasts 2-3x longer at similar price."
    ],
    category: "roofing",
    relatedTrades: ["roofer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-long-does-a-new-roof-last-uk", "how-much-does-a-new-roof-cost-uk"],
    lastReviewed: "2026-07-20"
  },

  // ─── PLASTERING (expansion 2026-07-20) ──────────────────────
  {
    slug: "can-i-plaster-over-wallpaper-uk",
    question: "Can I plaster over wallpaper in the UK?",
    shortAnswer: "No — plastering over wallpaper always fails. The plaster grabs the wallpaper's paper face, which then delaminates from the paste layer within days or months. Every reputable UK plasterer will strip wallpaper first.",
    longAnswer: [
      "The failure mode is predictable: wet plaster reactivates the wallpaper paste, the paper face bubbles, and within days you'll see the new plaster popping off in sheets. Sometimes it holds for a few months; when it goes, it takes a chunk of finish with it.",
      "Every UK plasterer worth hiring will insist on wallpaper removal before quoting. Strip cost: £150-£300 per room DIY (scoring blade + steamer + hard graft), or included in most plastering quotes at £80-£150 per room. Don't argue — the extra £100 saves a £1,000 re-do.",
      "The one exception: lining paper being over-plastered by an experienced plasterer using a PVA bonding coat + moisture-limited multi-finish. Even then, most trades won't warranty the work. If the walls are that bad, strip back to substrate and start clean."
    ],
    category: "plastering",
    relatedTrades: ["plasterer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-plastering-a-room-cost-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-long-does-plaster-take-to-dry-uk",
    question: "How long does new plaster take to dry in the UK?",
    shortAnswer: "New plaster is touch-dry in 24 hours, mist-coat ready in 5-7 days, and fully dry for full paint or paper in 14-21 days depending on room ventilation and thickness. Backing coats add 3-5 days per coat.",
    longAnswer: [
      "A skim coat over sound existing plaster or new board dries touch-dry in 24 hours. It can be mist-coated (watered-down emulsion to seal the surface) after 5-7 days in a well-ventilated room. Do not use full-strength emulsion or wallpaper paste until 14-21 days — pigment will otherwise scorch and the plaster surface will remain permanently marked.",
      "For a full re-plaster (browning coat + skim), each backing coat needs 3-5 days to dry before the next coat goes on. Total drying time before decoration: 3-4 weeks in a heated + ventilated room in winter, 2-3 weeks in summer.",
      "Signs the plaster is dry enough to decorate: uniform light pink colour (no dark patches), no cool touch, no condensation when a plastic bag is taped over a section overnight."
    ],
    category: "plastering",
    relatedTrades: ["plasterer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-plastering-a-room-cost-uk", "can-i-plaster-over-wallpaper-uk"],
    lastReviewed: "2026-07-20"
  },

  // ─── CARPENTRY / BUILDING (expansion 2026-07-20) ────────────
  {
    slug: "how-much-does-a-garage-conversion-cost-uk",
    question: "How much does a garage conversion cost in the UK?",
    shortAnswer: "A single garage conversion in the UK 2026 costs £12,000-£22,000 for a standard habitable room, £18,000-£32,000 for a room with en-suite. Double garages run £22,000-£45,000. Plans + Building Regs sign-off included.",
    longAnswer: [
      "The typical £12k-£22k spend on a single garage covers: brick up the garage door (or replace with a wall + window), floor insulation + screed to bring it level with the house, wall + roof insulation to Building Regs, first + second-fix electrics, plaster, flooring, and a single door through into the house.",
      "Adding an en-suite adds £6,000-£10,000: waste run + supply from the mains, tanking, bathroom fit-out. Adding heating (radiator run from the boiler or dedicated electric heating) is £600-£1,200. Total £18k-£32k for a bedroom + en-suite conversion.",
      "Most single-garage conversions are Permitted Development in England (no planning application needed) provided the exterior appearance change isn't major. Building Regulations approval is required for the habitable-room conversion — factor £600-£1,000 for a Building Control notification + inspections."
    ],
    category: "carpentry",
    relatedTrades: ["carpenter", "bricklayer", "plumber", "electrician"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-kitchen-extension-cost-uk", "how-much-does-a-loft-conversion-cost-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "do-i-need-planning-permission-for-a-garden-office-uk",
    question: "Do I need planning permission for a garden office in the UK?",
    shortAnswer: "Most UK garden offices don't need planning permission — they fall under Permitted Development if under 2.5m eaves height, 4m ridge (dual-pitch) or 3m (single-pitch), and cover less than 50% of the garden. Above those limits, full planning applies.",
    longAnswer: [
      "The 2015 GPDO permits garden buildings up to 2.5m eaves height + 4m ridge (dual-pitch) or 3m (single-pitch or flat), covering no more than 50% of your garden (the total including any existing outbuildings). No planning application needed if you're within those limits.",
      "Common overages that push you into full planning: multi-storey office pods, taller-than-2.5m eaves where the office is within 2m of a boundary, gardens in Conservation Areas or on Listed properties (Permitted Development is usually withdrawn), and any use that isn't 'incidental to the enjoyment of the house' — running a full business with paying customers on-site can trigger planning + business rates.",
      "Building Regulations still apply for garden offices over 15m² (or over 30m² if 1m+ from every boundary) — you'll need structural, electrical, and (if heated) insulation sign-off even under Permitted Development."
    ],
    category: "carpentry",
    relatedTrades: ["carpenter"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-garage-conversion-cost-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-long-does-a-house-extension-take-uk",
    question: "How long does a house extension take in the UK?",
    shortAnswer: "A UK single-storey rear extension takes 8-12 weeks from ground-break to keys in 2026. Add 2-4 weeks for double-storey. Pre-start (drawings, party wall, Building Control) adds 8-16 weeks before the build starts.",
    longAnswer: [
      "The build itself for a standard 20m² single-storey extension runs 8 weeks best-case, 10-12 weeks realistic with weather + variation slippage. Two weeks foundations + slab, two weeks brickwork + roof, one week watertight, two weeks first-fix + plaster, one week second-fix + snag.",
      "Double-storey adds 2-4 weeks (bigger steels, first-floor structure, extra plaster, additional plumbing runs). Wraparound extensions typically 14-18 weeks total build.",
      "Don't underestimate the pre-start. Architect drawings 4-6 weeks. Structural calcs 2-3 weeks after drawings. Building Control application 4 weeks for approval. Party wall notice 2 months minimum before works start (statutory notice period). Materials + trade booking usually 6+ weeks lead time. Realistic total from decision to keys: 18-28 weeks."
    ],
    category: "carpentry",
    relatedTrades: ["bricklayer", "carpenter", "plumber", "electrician", "roofer"],
    relatedCosts:  ["kitchen-extension"],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-kitchen-extension-cost-uk", "how-much-does-a-loft-conversion-cost-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-it-cost-to-lay-a-patio-uk",
    question: "How much does it cost to lay a patio in the UK?",
    shortAnswer: "A UK patio costs £85-£140 per m² fitted for standard sandstone or porcelain in 2026, £150-£250/m² for premium natural stone or bespoke pattern. A typical 25m² family patio runs £2,500-£5,500 with sub-base + drainage.",
    longAnswer: [
      "Standard fitted rate covers: dig out to 200mm, MOT Type 1 sub-base + whacker plate compaction, mortar bed, slab laying to fall (1:80 minimum), pointing, and clean-up. Materials at the mid-range: £30-£55/m² for Indian sandstone or 20mm porcelain; labour £55-£85/m².",
      "Premium options: yorkstone (£90-£140/m² material), granite (£75-£120/m²), or specialist porcelain (£60-£90/m²). Complex patterns (herringbone, mixed-size random) add 15-25% to labour.",
      "Access matters. If the landscaper needs to barrow everything through the house (no side gate), add 10-15% labour. Removing an existing patio + waste haulage adds £15-£30/m². A permeable + soakaway solution (SuDS-compliant, needed for larger patios in flood-risk areas) adds £20-£40/m²."
    ],
    category: "carpentry",
    relatedTrades: ["landscaper", "bricklayer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["do-i-need-planning-permission-for-a-garden-office-uk"],
    lastReviewed: "2026-07-20"
  },

  // ─── GENERAL (expansion 2026-07-20) ─────────────────────────
  {
    slug: "do-i-need-to-tip-a-uk-tradesperson",
    question: "Do I need to tip a UK tradesperson?",
    shortAnswer: "No — tipping is not expected in the UK trades industry. A written 5-star review, a photo they can use in marketing, and a referral to a friend are far more valuable than a £20 note.",
    longAnswer: [
      "UK trades price their labour fully into the invoice — there's no service culture equivalent to hospitality. A tradesperson expecting or fishing for a tip is unusual and typically not welcome from the trade's side either.",
      "What genuinely helps a good trade: (1) a public 5-star Google + platform review with a specific detail (\"turned up on time, cleaned up properly, explained the fuse work as they went\"), (2) permission to photograph the finished work for their portfolio, (3) a WhatsApp referral to a friend, neighbour, or landlord who needs similar work.",
      "For a genuinely excellent job or one that ran past scope without a variation, a cup of tea + a bacon sandwich on the last morning goes further than money. Or a bottle of decent whisky at the front-door handover on a job over £3k. Optional; appreciated; still not expected."
    ],
    category: "general",
    relatedTrades: [],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: [],
    lastReviewed: "2026-07-20"
  },

  // ─── Final expansion 2026-07-20 (30 → 40) ─────────────────

  {
    slug: "how-much-does-painting-a-house-cost-uk",
    question: "How much does painting a house cost in the UK?",
    shortAnswer: "A UK exterior repaint on a 3-bed semi costs £1,800-£4,500 in 2026 including render, woodwork, gutters and downpipes. Interior whole-house repaint: £3,500-£8,500 depending on prep + finish tier. Scaffold + MEWP hire adds £600-£1,400.",
    longAnswer: [
      "Exterior repaint on a UK 3-bed semi typically runs £1,800-£4,500 including render + soffits + fascias + gutters + downpipes + woodwork. That's 4-7 days of work by a 2-person crew plus scaffold or MEWP hire. Masonry paint life expectancy 5-8 years; gloss on woodwork 4-6 years.",
      "Interior whole-house repaint (walls + ceilings + woodwork throughout) on a 3-bed runs £3,500-£8,500 mid-range depending on prep depth + finish tier. Budget quotes cut prep + use mid-tier trade paint (Dulux Trade). Premium quotes include filler + caulk + sand between coats + Farrow & Ball or equivalent — the finish visibly lasts twice as long.",
      "Per-room costs: £250-£500 for a standard UK bedroom (prep + 2 coats walls + ceiling + woodwork). £600-£1,200 for a large open-plan living/kitchen. Larger rooms scale roughly linearly with wall area."
    ],
    category: "general",
    relatedTrades: ["painter"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-a-plumber-charge-per-hour-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "what-deposit-should-i-pay-a-uk-trade",
    question: "What deposit should I pay a UK trade?",
    shortAnswer: "For jobs £500-£5,000, 30-40% deposit on order (covers materials) then balance on completion is standard UK. £5,000-£25,000: 40% deposit + 40% milestone + 20% completion (with 5-10% held 30 days for snags). Never pay full up-front.",
    longAnswer: [
      "The standard UK residential split works like this: under £500 = pay on completion (no deposit needed). £500-£5,000 = 30-40% deposit on materials order + 60-70% on completion. £5,000-£25,000 = 40% deposit + 40% at a defined milestone + 20% on completion (with 5-10% retention held 30 days). £25,000+ = staged payments per JCT-style contract.",
      "Bespoke work (kitchens, made-to-measure windows, custom joinery) can legitimately require 50% deposit on order — the trade can't resell the item if you cancel. Anything above 50% is unusual and needs a specific written reason.",
      "Never pay 100% up-front on any job over £500. Never pay to a personal bank account without a proper invoice. Card payment via a proper processor (Stripe, iZettle) gives you chargeback rights — worth 1-2% surcharge on larger jobs."
    ],
    category: "general",
    relatedTrades: [],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["what-does-a-plumber-charge-per-hour-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-to-check-a-uk-trade-is-insured",
    question: "How do I check if a UK trade is insured?",
    shortAnswer: "Ask for a copy of their public liability insurance certificate before work starts — minimum £2m cover is standard UK. Verify the policy is current by calling the insurer's helpline. For regulated trades, also verify Gas Safe / NICEIC / MCS number at the source register.",
    longAnswer: [
      "Every legitimate UK trade carries public liability insurance — minimum £2m cover is the market standard, £5m+ for larger commercial work. Ask for a copy of the certificate BEFORE work starts. Certificates show the insurer name, policy number, insured party name, cover amount, and expiry date.",
      "To verify a certificate is current: call the insurer's broker helpline (usually printed on the certificate) with the policy number. They confirm the cover is active without disclosing sensitive details. Takes 30 seconds.",
      "For regulated trades — always cross-check the scheme registration at the source: GasSafeRegister.co.uk (gas), niceic.com / napit.org.uk (Part-P electrical), mcscertified.com (MCS renewable heating). The paper card is not enough — check the online register by licence number."
    ],
    category: "general",
    relatedTrades: ["gas-safe-engineer", "electrician", "plumber"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["do-i-need-a-gas-safe-engineer-to-fit-a-hob"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-long-does-an-eicr-last-uk",
    question: "How long does an EICR last in the UK?",
    shortAnswer: "A UK EICR (Electrical Installation Condition Report) is valid for 5 years on private-rented properties (statutory since April 2021), 10 years on owner-occupied. Landlords must have a valid EICR before letting; owner-occupiers rely on it for insurance + resale confidence.",
    longAnswer: [
      "The Electrical Safety Standards in the Private Rented Sector Regulations 2020 mandate EICR every 5 years for private-rented UK properties in England — landlords must have a satisfactory (C1/C2-free) EICR before letting. Non-compliance carries penalties up to £30,000 per property.",
      "Owner-occupied EICR recommended every 10 years or on change of occupancy — not statutory but strongly encouraged by insurers. Many buildings insurance policies now ask about EICR at renewal; some void cover on electrical-cause claims without one.",
      "EICR cost: £150-£300 for a UK 3-bed home; £250-£450 for larger properties. Any C1 (danger present) or C2 (potentially dangerous) codes must be remediated before the report is 'satisfactory' — remedial work is billed separately."
    ],
    category: "electrical",
    relatedTrades: ["electrician"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-new-consumer-unit-cost-uk", "landlord-cp12-certificates-uk-mistakes"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-replacing-windows-cost-uk",
    question: "How much does replacing windows cost in the UK?",
    shortAnswer: "Standard UK uPVC double-glazed window replacement costs £450-£850 per window fitted in 2026. Timber sash windows £900-£2,500 per window. Aluminium windows £700-£1,400. Full UK 3-bed semi (8-10 windows) typically runs £4,500-£9,500 for uPVC.",
    longAnswer: [
      "uPVC double-glazed is the UK volume market — £450-£850 per window fitted depending on size + spec (A-rated glass, argon fill, warm-edge spacer). Colour options + Georgian bars add 10-25%. A standard 3-bed UK semi with 8-10 windows: £4,500-£9,500 all-in.",
      "Timber sash windows (heritage + conservation area properties) run £900-£2,500 per window fitted. Aluminium (contemporary look, slim frames) £700-£1,400 per window. Triple glazing adds 15-25% over double.",
      "FENSA (Fenestration Self-Assessment Scheme) or CERTASS registration is essential for the installer — they self-certify the install to Building Regs Part L. Non-registered installers require you to notify Building Control separately (~£150-£400 fee). Always ask for the FENSA/CERTASS number + verify online."
    ],
    category: "general",
    relatedTrades: ["carpenter"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-a-kitchen-extension-cost-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "do-i-need-planning-permission-for-a-fence-uk",
    question: "Do I need planning permission for a fence in the UK?",
    shortAnswer: "In the UK, no planning permission needed for a fence up to 2m tall (or 1m tall if next to a road) — this falls under Permitted Development. Conservation areas, listed properties, and articles-4 areas may require permission at any height.",
    longAnswer: [
      "Standard rule: fences, walls, and gates up to 2m tall at the rear or side of a property don't need planning permission. Front-of-property boundaries next to a highway are capped at 1m (or 2m if the highway is a residential cul-de-sac — check with your council).",
      "Exceptions where permission IS needed regardless of height: Conservation Areas, Listed Buildings, properties with an Article 4 Direction restricting Permitted Development rights (common in market towns + heritage settings), and any fence that materially affects a public right of way.",
      "Shared boundary fences: check the deeds first. The T-mark on the deeds shows which side owns which fence. Replacing a shared boundary fence without the neighbour's agreement (even if you own it) opens you to a Party Wall claim. Written consent from all affected parties before you start."
    ],
    category: "general",
    relatedTrades: ["carpenter", "landscaper"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["do-i-need-planning-permission-for-a-garden-office-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-a-driveway-cost-uk",
    question: "How much does a driveway cost in the UK?",
    shortAnswer: "A UK block-paved driveway costs £85-£140 per m² fitted in 2026. Resin-bound: £70-£110 per m². Tarmac: £55-£90 per m². Concrete: £60-£95 per m². A typical 40m² driveway runs £2,200-£5,600 all-in including groundworks, edging, and SuDS-compliant drainage.",
    longAnswer: [
      "Block paving (concrete or clay pavers) is the volume UK choice — £85-£140/m² fitted including sub-base excavation, MOT Type 1 compacted layer, edging, laying course, jointing, and cleanup. Life expectancy 20-30 years with routine maintenance.",
      "Resin-bound (resin + aggregate laid over a compacted base) — £70-£110/m². Fast to install (1-3 days for a typical drive), no weeds, permeable by design (SuDS-compliant). Life 15-25 years.",
      "Since 2008, all new + replaced UK driveways over 5m² must comply with Sustainable Drainage Systems (SuDS) — either permeable paving (resin-bound, permeable block, gravel) OR drainage to a soakaway (non-permeable materials add £15-£30/m² for the soakaway install). Not optional; enforced at Building Control inspection."
    ],
    category: "general",
    relatedTrades: ["landscaper", "bricklayer"],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["how-much-does-it-cost-to-lay-a-patio-uk"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-long-does-a-uk-trade-quote-last",
    question: "How long is a UK trade quote valid for?",
    shortAnswer: "UK trade quotes typically state a validity period — most commonly 30 days. If no period is stated, the quote is valid for a 'reasonable time' (usually 3 months, per common contract law). Material prices moving is the most common reason for early re-quote requests.",
    longAnswer: [
      "A quotation in UK law is a binding offer once accepted, but only for the period stated on the quote OR a reasonable time if unstated. Most trades put 30 days on the quote to protect against material-price shifts + labour availability changes.",
      "Common triggers for early re-quote requests: steel + copper + timber price movements (all volatile 2024-2026), rising energy costs affecting supply-chain, and any change in scope you initiate (variation instructions).",
      "If a trade quotes then withdraws or raises the price before you've accepted, that's within their rights unless the quote states otherwise. Once you've formally accepted (verbally or in writing) + they've begun preparation, the price is locked."
    ],
    category: "general",
    relatedTrades: [],
    relatedCosts:  [],
    relatedGrants: [],
    peopleAlsoAsk: ["what-a-fair-uk-trade-quote-looks-like-2026", "10-questions-ask-before-hiring-uk-tradesperson"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-loft-insulation-cost-uk",
    question: "How much does loft insulation cost in the UK?",
    shortAnswer: "Professional UK loft insulation costs £400-£700 fitted (materials + labour) for a typical 3-bed loft. DIY materials only: £250-£450. Free installation is available via ECO4 or GBIS grants for eligible households — see the Grants Tracker.",
    longAnswer: [
      "Professional install for a UK 3-bed loft: £400-£700 all-in including 270mm mineral wool laid between + over joists (current recommended depth), loft ladder stilts if you want to keep the loft usable, and top-up on any existing insulation below spec.",
      "DIY materials only: £250-£450 (mineral wool rolls, safety kit, boarding if you want to walk on it). 2-3 hours per bedroom of loft area for a competent DIYer. Wear a mask + long sleeves + goggles — mineral wool is skin-irritant.",
      "For eligible households: ECO4 + Great British Insulation Scheme + Home Upgrade Grant Phase 2 all cover fully-funded loft insulation — see the UK Grants Tracker at /grants. Eligibility usually via means-tested benefits (Universal Credit, Pension Credit) or Council Tax band A-D properties with EPC rating D-G."
    ],
    category: "plastering",
    relatedTrades: ["plasterer", "carpenter"],
    relatedCosts:  [],
    relatedGrants: ["eco4", "great-british-insulation-scheme", "home-upgrade-grant"],
    peopleAlsoAsk: ["can-i-diy-loft-insulation"],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "how-much-does-a-heat-pump-install-cost-uk",
    question: "How much does a heat pump install cost in the UK?",
    shortAnswer: "An air-source heat pump install in the UK costs £8,000-£14,000 in 2026 before the Boiler Upgrade Scheme grant (£7,500 off) — net cost £500-£6,500 for eligible households. Ground-source: £18,000-£35,000 install, same £7,500 BUS grant. Radiator upgrades often needed.",
    longAnswer: [
      "Air-source heat pump (ASHP) install on a UK 3-bed semi: £8,000-£14,000 gross including the outdoor unit, indoor components, control system, and 3-5 days of MCS-certified install. The Boiler Upgrade Scheme drops £7,500 off eligible installs, leaving £500-£6,500 net.",
      "Ground-source heat pump (GSHP) — much larger install requiring bore holes or trench-laid ground loops. £18,000-£35,000 gross install, same £7,500 BUS grant. Best for larger rural properties with garden space + poor gas access.",
      "Common hidden cost: radiator upgrades. Heat pumps run cooler than gas boilers so many properties need larger radiators to maintain the same heat output — £500-£2,500 in radiator upgrades on top of the heat pump install. Get a proper heat-loss survey before quoting."
    ],
    category: "plumbing",
    relatedTrades: ["gas-safe-engineer", "plumber", "electrician"],
    relatedCosts:  ["new-boiler"],
    relatedGrants: ["boiler-upgrade-scheme", "vat-zero-rating-esm"],
    peopleAlsoAsk: ["how-much-does-a-boiler-cost-to-fit-uk"],
    lastReviewed: "2026-07-20"
  }
];

// ─── FAQ (about the Q&A hub itself) ───────────────────────────────

export const HUB_FAQS = [
  {
    q: "Where do these answers come from?",
    a: "Every answer is written by The Networkers' editorial team, cross-checked against our UK Trade Price Index data, government guidance (gov.uk, Gas Safe Register, IET Wiring Regs, Building Regulations), and industry benchmarks (BCIS, RICS, FMB). Every number links back to its source. Every answer shows the last review date."
  },
  {
    q: "How often are answers updated?",
    a: "Every answer is reviewed at least once per quarter. Answers that reference pricing (day rates, cost calculators) are refreshed monthly in sync with the UK Trade Price Index. Answers that reference grants are refreshed monthly in sync with the Grants Tracker."
  },
  {
    q: "Can I ask a new question?",
    a: "Yes. Post your question to the Yard (free) and verified trades on The Networkers answer directly. Popular questions become permanent hub answers here."
  },
  {
    q: "Is this financial or legal advice?",
    a: "No. These answers are general guidance based on published UK industry data and government sources. For specific decisions, get quotes from verified trades on The Networkers and — for gas, electrical, or structural work — always use a registered installer."
  }
];

export const CATEGORY_LABEL: Record<AnswerCategory, string> = {
  plumbing:   "Plumbing + heating",
  electrical: "Electrical",
  carpentry:  "Carpentry + building",
  plastering: "Plastering + insulation",
  roofing:    "Roofing",
  general:    "General"
};
