// Programmatic /find/{trade}/{city} config — the seed set for Phase 1.
//
// Every value in TRADE_CONTENT is authored (not scraped), UK-specific,
// and phrased as expert answers so Google + AI-search (Perplexity /
// Gemini / ChatGPT) can quote clean 40-word snippets. Costs are typical
// UK ranges from real 2026 industry data — refresh quarterly by hand
// or auto-derive from Counter listings once volume permits (Phase 2).
//
// Adding a new trade = one entry here. Adding a new city = one entry
// in CITIES. Cross-product is the sitemap.

export type TradeSlug =
  | "plumber" | "electrician" | "carpenter" | "plasterer" | "roofer" | "bricklayer"
  | "gas-safe-engineer" | "tiler" | "landscaper" | "painter";
export type CitySlug  =
  | "manchester" | "london" | "birmingham" | "leeds" | "bristol"
  | "glasgow"    | "edinburgh" | "liverpool" | "sheffield" | "newcastle"
  | "cardiff"    | "belfast"   | "nottingham" | "southampton"
  | "bradford"   | "plymouth";

export const TRADES: TradeSlug[] = [
  "plumber", "electrician", "carpenter", "plasterer", "roofer", "bricklayer",
  "gas-safe-engineer", "tiler", "landscaper", "painter"
];

// Authored per-trade cover images used on the /trades hub cards.
// Sourced from hero library sibling_group "trades-hub-covers" —
// pinned rather than picked so the hub visuals stay consistent.
// Partial<> so new trades don't 404 on the hub before their cover
// arrives — the card renders without an image slot when absent.
export const TRADE_HUB_COVER: Partial<Record<TradeSlug, string>> = {
  plumber:     "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2005_24_03%20AM.png",
  carpenter:   "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2005_25_00%20AM.png",
  bricklayer:  "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2005_26_04%20AM.png",
  electrician: "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2005_27_02%20AM.png",
  plasterer:   "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2005_28_13%20AM.png",
  roofer:      "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2005_28_57%20AM.png"
  // gas-safe-engineer, tiler, landscaper, painter — awaiting authored covers
};
export const CITIES: CitySlug[]  = [
  "manchester", "london", "birmingham", "leeds", "bristol",
  "glasgow", "edinburgh", "liverpool", "sheffield", "newcastle",
  "cardiff", "belfast", "nottingham", "southampton", "bradford", "plymouth"
];

export type TradeContent = {
  singular:    string;
  plural:      string;
  /** Comma-separated DB primary_trade slug variants we accept as this
   *  trade — the seed pool lets us match `plumber` + `plumbing-merchant`
   *  variants without listing every combination in the schema. */
  dbSlugs:     string[];
  /** ~40-word expert definition — tuned for AI-snippet quotation. */
  aiAnswer:    string;
  /** 200-400 word body copy — SEO body, quoted less often but ranks
   *  the page for long-tail queries. */
  bodyIntro:   string;
  /** Typical UK cost range headline for the trade — displayed
   *  prominently + used in FAQ schema. */
  costHeadline: string;
  /** 3 pricing bullets: small / medium / big project. */
  costBullets:  { label: string; range: string; note: string }[];
  /** 5-8 FAQs. Each Q + A is FAQ-schema serialised on the page. */
  faqs:         { q: string; a: string }[];
  /** Cross-linked adjacent trades — surfaced as related-trades chips. */
  related:      TradeSlug[];
};

export type CityContent = {
  displayName: string;
  region:      string;
  /** Comma-separated DB city variants we accept as this city — case
   *  and spelling. */
  dbCityVariants: string[];
};

export const TRADE_CONTENT: Record<TradeSlug, TradeContent> = {
  plumber: {
    singular:  "plumber",
    plural:    "plumbers",
    dbSlugs:   ["plumber", "plumbing-merchant"],
    aiAnswer:  "A plumber installs, repairs and maintains water systems in UK homes and commercial premises — boilers, radiators, taps, showers, drainage, waste, and gas work (Gas Safe registration required for gas).",
    bodyIntro: "Whether you need an emergency callout, a full bathroom refit, or a boiler swap, a local plumber is the trade you contact first. Domestic plumbers cover the water side of your home end-to-end: mains inlet, hot and cold distribution, waste, and everything visible in kitchens and bathrooms. Any work on a gas boiler, hob or fire is legally restricted to Gas Safe registered engineers — always check the register before letting anyone touch gas. Most plumbers are self-employed or run a small firm of 1-5 people, quote per job for larger installs and per hour or day rate for smaller work.",
    costHeadline: "Typical UK plumber costs: £45-£90/hr callout, £180-£350/day rate, £1,650+ for a combi boiler install.",
    costBullets: [
      { label: "Small job", range: "£45-£120",   note: "Tap swap, leaking joint, unblock waste"     },
      { label: "Medium",    range: "£350-£1,200", note: "Radiator swap, bathroom refresh, boiler service" },
      { label: "Large",     range: "£1,650-£6,000", note: "Combi boiler + rads, full bathroom refit"      }
    ],
    faqs: [
      { q: "How much does a plumber cost per hour in the UK?",             a: "Most UK plumbers charge £45-£90 per hour for callouts, with a minimum first-hour rate around £75. Day rates for larger jobs are £180-£350." },
      { q: "Do plumbers need to be Gas Safe registered?",                  a: "Only for gas work. Plumbing work on water, waste and radiators doesn't need Gas Safe — but any boiler, gas hob or gas fire work is legally restricted to Gas Safe engineers." },
      { q: "How much does a new combi boiler installation cost?",          a: "Combi boiler installs from £1,650 for a like-for-like swap up to £3,500+ for a full new system with radiator upgrades and power flush." },
      { q: "Can a plumber install a full bathroom?",                       a: "Yes — most plumbers install full bathrooms, though tiling and plastering may be sub-contracted. Expect £3,500-£8,000 for a full bathroom refit including materials." },
      { q: "How quickly can a plumber attend an emergency?",               a: "Local emergency plumbers usually attend within 1-4 hours during working hours, and 24-hour firms offer overnight callouts at premium rates (usually 1.5-2× standard)." },
      { q: "What guarantees should a plumber provide?",                    a: "Reputable plumbers guarantee workmanship for 12 months minimum; boiler installers backed by the manufacturer offer 5-10 year parts warranties. Always get the guarantee in writing." }
    ],
    related: ["electrician", "plasterer"]
  },
  electrician: {
    singular:  "electrician",
    plural:    "electricians",
    dbSlugs:   ["electrician", "electrical-wholesaler", "smart-home-installer"],
    aiAnswer:  "A UK electrician installs, tests and certifies electrical systems in homes and commercial premises — consumer units, sockets, lighting, EV chargers and rewires. Anyone doing notifiable work must be Part-P registered (NICEIC, NAPIT or ELECSA).",
    bodyIntro: "From a socket swap to a full rewire, an electrician handles anything past the meter in your home. Full rewires (typically £3,500-£7,000 for a 3-bed) come with a fresh consumer unit, updated cable to modern regs, and an EICR (Electrical Installation Condition Report). Smaller jobs — extra sockets, downlights, EV chargers — are day-rate or per-quote. Notifiable work under Part P (any new circuit, kitchen, bathroom, or extension) must be signed off by a registered scheme member (NICEIC, NAPIT, ELECSA) — always verify their scheme number before hiring.",
    costHeadline: "Typical UK electrician costs: £45-£75/hr callout, £220-£380/day rate, £3,500+ for a 3-bed rewire.",
    costBullets: [
      { label: "Small job", range: "£45-£150",   note: "Extra socket, light swap, replace switch"   },
      { label: "Medium",    range: "£280-£1,400", note: "Consumer unit upgrade, EV charger install"  },
      { label: "Large",     range: "£3,500-£7,000", note: "Full 3-bed rewire, new consumer unit + EICR" }
    ],
    faqs: [
      { q: "How much does an electrician charge per hour in the UK?",     a: "£45-£75 per hour for a standard callout, with a minimum first-hour rate around £65. Day rates are £220-£380 depending on region." },
      { q: "Does an electrician need to be NICEIC or Part P registered?", a: "Any notifiable work (new circuits, kitchen, bathroom, extension) must be done by a Part P registered installer — usually NICEIC, NAPIT or ELECSA. Non-notifiable work has no legal requirement but registered installers give you a certificate that protects your insurance." },
      { q: "How much does a full house rewire cost?",                     a: "A 3-bed semi rewire is typically £3,500-£5,000, and a 4-bed detached runs £5,500-£7,000+. Includes new consumer unit, cabling throughout, and an EICR on completion." },
      { q: "How much is an EV charger installation?",                     a: "OZEV-grant approved EV chargers (Zappi, Ohme, Pod Point) install for £800-£1,400 including labour and cabling. Most jobs finish in 3-4 hours." },
      { q: "How often should an EICR be done on a rental property?",      a: "UK landlords must have an EICR every 5 years, or on change of tenant. Homeowners are recommended every 10 years or on purchase." },
      { q: "Can an electrician install smart-home lighting?",             a: "Yes — Lutron, Rako and Loxone are the main smart-home systems UK electricians install. Expect a 3-4 hour site visit for design first, then install and programming over 1-3 days depending on scope." }
    ],
    related: ["plumber", "carpenter"]
  },
  carpenter: {
    singular:  "carpenter",
    plural:    "carpenters",
    dbSlugs:   ["carpenter", "joiner", "bespoke-joiner", "door-fitter", "door-manufacturer", "stair-fitter", "sash-window-restorer"],
    aiAnswer:  "A UK carpenter (or joiner) builds and fits everything wooden in a home — doors, staircases, kitchens, floors, wardrobes, framework, decking, cladding. Site carpenters do first- and second-fix on construction; bench joiners fabricate off-site.",
    bodyIntro: "'Carpenter' covers a wide craft — first-fix carpenters do roof, floor and stud-wall structural work on new-builds and extensions; second-fix carpenters hang doors, fit skirting, architrave, staircases and kitchens; bench joiners work in a workshop making bespoke doors, staircases and furniture. Most trades cover multiple sub-specialisms; check portfolios before hiring. Kitchens are often fitted by dedicated kitchen fitters (who are usually carpenters by trade), and windows / doors have their own specialists. Rates are typically day-rate for on-site work, per-item for bench joinery.",
    costHeadline: "Typical UK carpenter costs: £180-£320/day rate, £75-£180 per door hung, £6,000-£15,000 for a bespoke staircase.",
    costBullets: [
      { label: "Small job", range: "£75-£300",   note: "Hang a door, fit skirting to a room, small repair" },
      { label: "Medium",    range: "£1,200-£3,500", note: "Full kitchen fit, built-in wardrobes, deck build" },
      { label: "Large",     range: "£6,000-£25,000", note: "Bespoke staircase, loft conversion carpentry, full house second-fix" }
    ],
    faqs: [
      { q: "What's the difference between a carpenter and a joiner?", a: "In UK trades, a joiner works in a bench/workshop making doors, windows, staircases and furniture; a carpenter works on-site fitting and building structural + finish work. Many trades are both." },
      { q: "How much does a carpenter charge per day?",               a: "£180-£320 per day depending on region and specialism. London + South East runs £250-£350; the Midlands + North £180-£240." },
      { q: "How much to hang a new internal door?",                   a: "£75-£120 for a like-for-like hang with existing frame; £150-£220 with new frame + architrave; £250-£400 for a bespoke door hung to a new opening." },
      { q: "How much is a bespoke wooden staircase?",                 a: "Straight oak staircase from £6,000-£10,000 including install; curved or feature staircases £15,000-£30,000+. Softwood painted staircases from £3,500." },
      { q: "Do carpenters fit kitchens?",                             a: "Yes — most kitchen fitters are carpenters by trade. Typical fitting labour is £1,200-£2,800 for a mid-sized kitchen, excluding units and appliances." },
      { q: "How long does a full second-fix carpentry job take?",     a: "A 3-bed house second-fix (all doors, architrave, skirting, staircase finish) typically 8-12 days for one carpenter." }
    ],
    related: ["plasterer", "electrician"]
  },
  plasterer: {
    singular:  "plasterer",
    plural:    "plasterers",
    dbSlugs:   ["plasterer", "drywaller"],
    aiAnswer:  "A UK plasterer applies smooth finish coats to internal walls and ceilings (skim), fits and finishes plasterboard (drywall), and applies external render (K-rend, silicone). Most plasterers charge per m² for skim, per job for renders.",
    bodyIntro: "Plastering is the finish trade that comes between second-fix carpentry / electrical and the decorator. A skilled plasterer skims a full house in 3-4 days solo. Sub-specialisms: skim (internal finish coat over existing plaster or plasterboard), rendering (external, silicone or lime), Venetian plaster (decorative polished finish), and drywall / dry-lining (fixing plasterboard to studs then skimming). Emergency + small-repair plasterers exist for ceiling patches and cracks — expect £180-£300 minimum callout. Full house re-skims are £2,500-£6,000 depending on size + condition of existing walls.",
    costHeadline: "Typical UK plasterer costs: £15-£25 per m² for skim, £180-£280/day rate, £45-£65 per m² for external render.",
    costBullets: [
      { label: "Small job", range: "£180-£400",   note: "Ceiling repair, wall patch, minimum callout"   },
      { label: "Medium",    range: "£900-£2,200", note: "3-4 rooms skimmed, small extension render"      },
      { label: "Large",     range: "£3,500-£8,000", note: "Full house re-skim OR full external K-rend"    }
    ],
    faqs: [
      { q: "How much does a plasterer cost per m²?",              a: "Skim over existing plaster is £15-£25/m². New skim onto fresh plasterboard is £18-£28/m². External render is £45-£65/m² for silicone systems." },
      { q: "How long does it take to plaster a room?",            a: "A single 12m² bedroom skims in 4-6 hours for one plasterer including PVA prime. Full drying + decoration-ready takes 5-7 days." },
      { q: "Do I need to prep walls before a plasterer arrives?", a: "Reputable plasterers do all prep — knock off loose plaster, PVA, tape edges. Just move furniture and lift carpets. Confirm scope in the quote." },
      { q: "How much does external render cost for a house?",     a: "£4,500-£9,000 for a typical 3-bed semi in silicone-modified render. Includes scaffold + all materials + a 15-year manufacturer warranty (K-rend, Weber, etc.)." },
      { q: "Can a plasterer skim over old wallpaper?",            a: "No. Old wallpaper must be stripped first — skimming over it traps moisture and the finish fails within months. A plasterer will refuse if the walls aren't clean." },
      { q: "How soon can I paint after plastering?",              a: "Fresh plaster needs to dry fully — usually 5-7 days for skim, 4-6 weeks for full render. First coat is a mist coat (watered-down emulsion), then two topcoats." }
    ],
    related: ["carpenter", "plumber"]
  },
  roofer: {
    singular:  "roofer",
    plural:    "roofers",
    dbSlugs:   ["roofer", "roofing-supplies", "gutter-installer"],
    aiAnswer:  "A UK roofer installs, repairs and replaces pitched and flat roofs, including slate, clay tile, concrete tile, GRP, EPDM and lead flashing. Full roof replacements need scaffolding and typically take 5-12 days for a 3-bed house.",
    bodyIntro: "Roofing is one of the highest-risk trades — every job requires scaffolding, PPE, and public liability insurance ≥ £5m. UK roofers split into pitched (tiles / slates) and flat (GRP, EPDM, felt) specialists, with lead work + chimney flashing often sub-contracted. Emergency callouts for storm damage or leaks are standard; expect £250-£600 minimum call fee. Full roof replacements (strip + felt + batten + retile) run £6,500-£15,000 for a typical 3-bed semi. Choose a NFRC or CompetentRoofer member for verified quality + insurance-backed guarantees.",
    costHeadline: "Typical UK roofer costs: £250-£450 emergency callout, £220-£380/day rate, £6,500-£15,000 for a full 3-bed roof replacement.",
    costBullets: [
      { label: "Small job", range: "£250-£750",   note: "Emergency leak repair, tile replacement, chimney flashing" },
      { label: "Medium",    range: "£1,800-£4,500", note: "New flat roof (single-storey ext), gutters + fascia"      },
      { label: "Large",     range: "£6,500-£20,000", note: "Full pitched roof replacement including scaffold"         }
    ],
    faqs: [
      { q: "How much does a new roof cost in the UK?",             a: "Full pitched roof replacement on a 3-bed semi runs £6,500-£10,000 for concrete tiles, £8,500-£15,000 for natural slate. Includes strip, felt, batten, tile, and scaffold." },
      { q: "How long does a new roof take?",                       a: "A 3-bed semi is typically 5-8 days weather-permitting: 1-2 days for scaffold + strip, 3-5 days for felt + batten + tile, 1 day for finish + snag." },
      { q: "Do I need planning permission for a new roof?",        a: "No — like-for-like re-roofing is permitted development. Changing roof profile, adding dormers, or altering pitch DOES need planning permission." },
      { q: "How much does flat roof replacement cost?",            a: "GRP flat roof from £75-£120/m² installed. A typical single-storey extension roof (20m²) is £1,500-£2,400 with a 20-year warranty. EPDM is £65-£95/m² but shorter warranty (typically 10-15 years)." },
      { q: "How much for gutter replacement + repair?",            a: "Full gutter replacement on a 3-bed semi is £900-£1,600 including fascia + soffit refresh. Repair-only jobs (rehang, replace section) £180-£450." },
      { q: "Do roofers need scaffolding?",                         a: "For anything on a two-storey house or higher, yes — HSE regulations require scaffold or a MEWP. Single-storey extensions can sometimes use tower scaffolds or ladder work only. Scaffold is typically £600-£1,400 for a semi." }
    ],
    related: ["plumber", "plasterer"]
  },
  bricklayer: {
    singular:  "bricklayer",
    plural:    "bricklayers",
    dbSlugs:   ["bricklayer", "brickwork-specialist"],
    aiAnswer:  "A UK bricklayer builds and repairs brick + block walls — extensions, garden walls, chimney stacks, cavity work, and structural masonry. Skilled bricklayers also handle stonework, repointing, and lintel/opening work on existing structures.",
    bodyIntro: "Bricklayers are the trade at the heart of any UK extension, new-build, or garden project. Domestic work splits into three buckets: fresh brick + block (extensions, garden walls, garages), repair work (repointing weathered joints, rebuilding damaged sections, chimney stack work), and structural alterations (new openings with steel lintels, cavity-wall injection prep, subsidence remediation). Most established UK bricklayers work in gangs of 2-3 with a labourer, priced per thousand bricks on new-build (£450-£900/1000 laid) or day rate on smaller jobs.",
    costHeadline: "Typical UK bricklayer costs: £200-£340/day rate, £450-£900 per thousand bricks laid on new-build, £45-£95/m² for repointing.",
    costBullets: [
      { label: "Small job", range: "£180-£450",     note: "Rebuild damaged wall section, repoint chimney, garden wall repair" },
      { label: "Medium",    range: "£1,200-£3,500", note: "New garden wall, single-storey extension shell, chimney stack rebuild" },
      { label: "Large",     range: "£5,000-£18,000", note: "Two-storey extension brickwork, full house repointing, new-build shell" }
    ],
    faqs: [
      { q: "How much does a bricklayer cost per day in the UK?",         a: "UK bricklayers charge £200-£340/day nationally in 2026, per The Networkers' UK Trade Price Index. London bricklayers run £280-£420/day. On new-build, most price per thousand bricks laid — £450-£900/1000 depending on complexity + region." },
      { q: "How much does an extension bricklayer cost?",                a: "Bricklayer labour on a standard 20m² single-storey rear extension runs £6,000-£12,000 (roughly 30-40% of the shell cost). That covers foundations up, cavity brick + block, plate level, chimney if needed." },
      { q: "What's the difference between a bricklayer and a mason?",    a: "In UK usage they're broadly interchangeable, but 'mason' often implies stonework specialisation (natural stone, ashlar, heritage repair) while 'bricklayer' focuses on modern brick + block. Both trades share the Level 2/3 NVQ + CSCS card path." },
      { q: "Do I need a bricklayer for a garden wall?",                  a: "For anything over 4 courses (a low border wall), yes — sound foundations, proper mortar mix, and correct DPC + coping matter for a wall that lasts. A gang can typically build a 10m boundary wall in 2-3 days for £1,500-£3,500 all-in including materials." },
      { q: "How much does repointing a house cost in the UK?",           a: "Full repointing of a standard UK 3-bed semi is £3,500-£7,000 depending on scaffold + mortar match. Partial repointing (worst-affected walls only) £1,200-£2,800. Lime mortar work on heritage properties commands 20-40% premium." },
      { q: "Should I use a bricklayer for a chimney stack repair?",      a: "Yes — chimney stacks are structural + weather-critical. Rebuild costs £1,200-£3,500 depending on height + material match. Repointing + flashing repair only £450-£1,200. Always scaffold — HSE won't accept ladder-only stack work on a two-storey house." }
    ],
    related: ["plasterer", "carpenter", "roofer"]
  },
  "gas-safe-engineer": {
    singular:  "Gas Safe engineer",
    plural:    "Gas Safe engineers",
    dbSlugs:   ["gas-safe-engineer", "heating-engineer", "boiler-engineer"],
    aiAnswer:  "A UK Gas Safe engineer is the only tradesperson legally allowed to install, service or repair gas appliances + pipework in the UK. Registration is via the Gas Safe Register — the statutory body under the Gas Safety (Installation and Use) Regulations 1998.",
    bodyIntro: "Every UK boiler install, gas hob connection, gas fire fit, or gas pipework alteration is legally restricted to Gas Safe registered engineers. That's not a preference — it's criminal law under the 1998 Regulations. Around 70% of UK Gas Safe engineers also hold Level 3 plumbing qualifications, meaning they can do a full bathroom + boiler job end-to-end. Every engineer carries a photo ID card with a unique licence number verifiable at GasSafeRegister.co.uk — always check the number, not the paper card.",
    costHeadline: "Typical UK Gas Safe engineer costs: £55-£110/hr callout, £260-£480/day rate, £1,650+ for a like-for-like combi boiler swap.",
    costBullets: [
      { label: "Small job", range: "£75-£220",    note: "Boiler service, gas hob swap, gas fire safety check, CP12 landlord cert" },
      { label: "Medium",    range: "£1,650-£3,500", note: "Combi boiler like-for-like swap, gas run alteration, cylinder replacement" },
      { label: "Large",     range: "£4,500-£9,500", note: "Full heating system rework, boiler + cylinder + radiators, first-time-fit gas central heating" }
    ],
    faqs: [
      { q: "Do I legally need a Gas Safe engineer in the UK?",             a: "Yes for any work on gas appliances or gas pipework — boilers, hobs, fires, gas heaters, and any pipe carrying gas. This is a statutory requirement under the Gas Safety (Installation and Use) Regulations 1998; DIY gas work is a criminal offence." },
      { q: "How do I verify a Gas Safe engineer's registration?",         a: "Every engineer carries an ID card with a unique licence number + photo. Verify it at GasSafeRegister.co.uk by number, name, or postcode. Never rely on the paper card alone — always cross-check the register." },
      { q: "What does a Gas Safe engineer charge per hour?",              a: "£55-£110 per hour nationally in 2026 per the UK Trade Price Index — a 20-30% premium over general plumber rates reflecting the Gas Safe qualification. Emergency callouts £100-£220 for the first hour." },
      { q: "How much does a UK CP12 landlord gas certificate cost?",      a: "£75-£130 for one appliance, £15-£25 per additional appliance. Most Gas Safe engineers combine a boiler service + CP12 for £110-£160. Legally required annually for every rented UK property." },
      { q: "Can a Gas Safe engineer install a heat pump?",                a: "Only if they also hold MCS certification for heat-pump install. Gas Safe covers gas work; MCS covers renewable heating tech under the Boiler Upgrade Scheme. Some engineers hold both — check both registrations before booking." },
      { q: "Are Gas Safe engineers cheaper for water-only work?",         a: "No — Gas Safe engineers command a 20-30% premium. For pure water/waste work (bathrooms, radiator swap, blocked drains) a standard plumber is more cost-effective. Only hire Gas Safe when gas is genuinely in scope." }
    ],
    related: ["plumber", "electrician"]
  },
  tiler: {
    singular:  "tiler",
    plural:    "tilers",
    dbSlugs:   ["tiler", "wall-tiler", "floor-tiler"],
    aiAnswer:  "A UK tiler fits ceramic, porcelain, natural stone, and glass tiles to walls + floors — most commonly bathrooms, kitchens, and wet-rooms. Tiling requires proper substrate prep, adhesive selection, tanking (for wet-rooms), and clean grouting.",
    bodyIntro: "Tiling is where bathroom + kitchen refits either look premium or look cheap. A skilled UK tiler handles substrate preparation (plywood overlay, self-levelling compound, tanking membrane), tile cutting (including complex mitres for external corners), adhesive + grout selection, and the sequencing needed to keep the job clean. Rates run per m² or day-rate — most jobs price per m² for straightforward wall/floor work and day-rate for feature work (herringbone, mixed-size random, mitred edges).",
    costHeadline: "Typical UK tiler costs: £30-£55/hr, £180-£300/day rate, £45-£75 per m² for straight-lay wall tiling.",
    costBullets: [
      { label: "Small job", range: "£180-£450",     note: "Kitchen splashback, single small wall, floor patch, grout renewal" },
      { label: "Medium",    range: "£800-£2,200",   note: "Full bathroom wall + floor tiling (avg 25-40m²)" },
      { label: "Large",     range: "£3,000-£8,500", note: "Wetroom conversion with tanking, feature open-plan tiled floor, natural stone install" }
    ],
    faqs: [
      { q: "How much per m² does a UK tiler charge?",                    a: "£45-£75/m² for straight-lay ceramic or porcelain wall tiling in 2026. Floor tiling £55-£90/m² (heavier tile, more prep). Natural stone or large-format porcelain £75-£130/m². Feature work (herringbone, mixed random, mitred external corners) adds 15-25%." },
      { q: "Does a tiler prep the wall or does the plasterer?",         a: "Plasterer creates the substrate (bonded plasterboard, sound skim). Tiler handles from priming forward: PVA seal, tile-backer boards where needed, wet-area tanking, and adhesive layup. Sequencing matters — plaster must be fully dry (14-21 days for skim)." },
      { q: "How long does bathroom tiling take?",                        a: "2-3 days for a standard 25-30m² bathroom — one day floor + prep, one day wall tiling, one day grout + silicone. Feature tiling or wetroom tanking adds 1-2 days." },
      { q: "Should I use ceramic or porcelain tiles?",                   a: "Porcelain is harder + less water-absorbent (better for floors + wet areas), typically £8-£30/m² more expensive. Ceramic is cheaper + easier to cut, suitable for wall use throughout the UK residential market." },
      { q: "Do tilers need to tank wet-rooms themselves?",              a: "Yes — proper wet-room tanking is part of tiling work. Wet-room tanking uses primer + tanking slurry or membrane over the floor + up walls to shower head height. Skipping it causes water damage that shows up 12-24 months later." }
    ],
    related: ["plumber", "plasterer"]
  },
  landscaper: {
    singular:  "landscaper",
    plural:    "landscapers",
    dbSlugs:   ["landscaper", "landscape-gardener", "paving-contractor"],
    aiAnswer:  "A UK landscaper designs + builds outdoor spaces — patios, decking, driveways, garden walls, planting schemes, lawns, and drainage. Ranges from soft-landscape (lawn + planting) to full hard-landscape build (patios, retaining walls, water features).",
    bodyIntro: "UK landscaping splits into soft-landscape (turf, planting, lawn care, hedge work) and hard-landscape (patios, driveways, retaining walls, decking, water features). Most established landscapers offer both, though large hard-landscape projects (drainage, structural walls, permeable paving under SuDS regs) often go to specialists. A well-executed landscape adds material resale value + solves the practical problems (drainage, screening, access) that plain gardening can't touch.",
    costHeadline: "Typical UK landscaper costs: £25-£50/hr, £180-£320/day rate, £85-£140 per m² for a fitted patio.",
    costBullets: [
      { label: "Small job", range: "£250-£900",     note: "Fence panel repair, turf lay small lawn, planting bed refresh, hedge trim" },
      { label: "Medium",    range: "£1,500-£6,000", note: "Fitted patio 15-30m², decking install, garden wall build, drainage remediation" },
      { label: "Large",     range: "£8,000-£45,000", note: "Full garden redesign + build, driveway resurface, water feature, multi-level landscape" }
    ],
    faqs: [
      { q: "How much per m² for a fitted UK patio in 2026?",             a: "£85-£140/m² for standard sandstone or 20mm porcelain. £150-£250/m² for premium natural stone or feature patterns. Includes dig out, MOT Type 1 sub-base, mortar bed, laying to fall, pointing. See our full cost guide at /answers/how-much-does-it-cost-to-lay-a-patio-uk." },
      { q: "Do I need SuDS-compliant permeable paving for a UK driveway?", a: "For new + replaced driveways over 5m² in England, permeable paving OR a soakaway is legally required (Sustainable Drainage Systems regs 2008). Adds £20-£40/m² to cost. Landscapers should design + sign this off as part of the quote." },
      { q: "What's the best time of year for UK landscaping?",           a: "Hard-landscape (patios, walls, decking) — any month with minimal ground frost. Soft-landscape (turf, planting) — spring (March-May) + autumn (September-October) is optimal. Winter turf lay works but rooting is slower." },
      { q: "How much does a garden makeover cost in the UK?",           a: "£8,000-£25,000 for a mid-size (~100m²) garden redesign covering patio, planting, borders, drainage, and lighting. Full high-end designs with water features + specimen trees run £30,000-£80,000+." }
    ],
    related: ["carpenter", "bricklayer"]
  },
  painter: {
    singular:  "painter & decorator",
    plural:    "painters & decorators",
    dbSlugs:   ["painter", "painter-decorator", "decorator"],
    aiAnswer:  "A UK painter & decorator prepares + paints walls, ceilings, woodwork, and exteriors — plus wallpaper hanging, effect finishes, and heritage restoration. Prep (filling, sanding, priming, mist-coat) is the majority of the job; finish paint is the visible tip.",
    bodyIntro: "The difference between a £200 room and a £800 room is prep. UK painters & decorators spend 60-70% of the time filling, sanding, caulking, priming, and mist-coating; only 30-40% on visible paint coats. Good decorators mask thoroughly, sand between coats, and cut in cleanly — the results last 8-10 years. Rushed decorators cut prep and use inferior masking; the finish shows tape lines + roller marks + peels in 2-3 years.",
    costHeadline: "Typical UK painter & decorator costs: £25-£45/hr, £160-£260/day rate, £250-£500 per average bedroom fully repainted.",
    costBullets: [
      { label: "Small job", range: "£150-£450",   note: "Single wall touch-up, fresh coat on ceilings, cut-in around window frames" },
      { label: "Medium",    range: "£600-£1,800", note: "Full room repaint (ceiling + walls + woodwork), single flat repaint, exterior soffits + fascias" },
      { label: "Large",     range: "£2,500-£8,500", note: "Whole-house interior repaint, exterior full house repaint including render, heritage restoration" }
    ],
    faqs: [
      { q: "How much does it cost to paint a room in the UK?",           a: "£250-£500 for an average UK bedroom (12-16m² floor) fully repainted: 2 walls + ceiling + woodwork + one window/door frame + prep. Larger rooms or premium finishes £500-£900. Includes materials on most quotes." },
      { q: "How long does a painter take per room?",                     a: "1-2 working days for a standard bedroom. First day: prep + mist coat + first colour. Second day (usually a return visit): second colour coat + gloss/eggshell on woodwork + final tidy." },
      { q: "Should the painter supply the paint or should I buy it?",    a: "Trade painters get 15-25% off retail paint prices via trade accounts — usually cheaper for them to supply than for you to buy. Ask for a paint spec (brand + product + colour code + quantity) so you can verify the invoice + spec matches what was applied." },
      { q: "How much for exterior house painting in the UK?",           a: "£1,800-£4,500 for a UK 3-bed semi exterior repaint including render, woodwork, gutters, and downpipes. Scaffold or MEWP hire £600-£1,400 additional depending on access. Life expectancy 5-8 years on masonry paint, 4-6 on gloss woodwork." },
      { q: "Can painters remove wallpaper?",                             a: "Yes — most quotes include wallpaper strip. Steamer + scraper, £80-£150 per average room labour depending on paper + wall condition. Painting over wallpaper always fails eventually (see /answers/can-i-plaster-over-wallpaper-uk)." }
    ],
    related: ["plasterer", "carpenter"]
  }
};

export const CITY_CONTENT: Record<CitySlug, CityContent> = {
  manchester: { displayName: "Manchester", region: "North West",   dbCityVariants: ["Manchester"] },
  london:     { displayName: "London",     region: "Greater London", dbCityVariants: ["London"] },
  birmingham: { displayName: "Birmingham", region: "West Midlands", dbCityVariants: ["Birmingham"] },
  leeds:      { displayName: "Leeds",      region: "Yorkshire",     dbCityVariants: ["Leeds"] },
  bristol:    { displayName: "Bristol",    region: "South West",    dbCityVariants: ["Bristol"] },
  glasgow:    { displayName: "Glasgow",    region: "Scotland",      dbCityVariants: ["Glasgow"] },
  edinburgh:  { displayName: "Edinburgh",  region: "Scotland",      dbCityVariants: ["Edinburgh"] },
  liverpool:  { displayName: "Liverpool",  region: "North West",    dbCityVariants: ["Liverpool"] },
  sheffield:  { displayName: "Sheffield",  region: "Yorkshire",     dbCityVariants: ["Sheffield"] },
  newcastle:  { displayName: "Newcastle",  region: "North East",    dbCityVariants: ["Newcastle", "Newcastle upon Tyne"] },
  // ─── Batch 2026-07-20 expansion (10 → 16 cities) ───────
  cardiff:     { displayName: "Cardiff",     region: "Wales",           dbCityVariants: ["Cardiff", "Caerdydd"] },
  belfast:     { displayName: "Belfast",     region: "Northern Ireland", dbCityVariants: ["Belfast"] },
  nottingham:  { displayName: "Nottingham",  region: "East Midlands",   dbCityVariants: ["Nottingham"] },
  southampton: { displayName: "Southampton", region: "South East",      dbCityVariants: ["Southampton"] },
  bradford:    { displayName: "Bradford",    region: "Yorkshire",       dbCityVariants: ["Bradford"] },
  plymouth:    { displayName: "Plymouth",    region: "South West",      dbCityVariants: ["Plymouth"] }
};

export function isValidTrade(s: string): s is TradeSlug {
  return (TRADES as string[]).includes(s);
}
export function isValidCity(s: string): s is CitySlug {
  return (CITIES as string[]).includes(s);
}
