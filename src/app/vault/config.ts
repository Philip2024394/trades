// The Vault — long-form editorial articles.
//
// Sixth Phase 2 SEO surface. Where the other surfaces are structured
// data (Price Index, Grants) or programmatic (city×trade, cost,
// planning), the Vault owns the informational-intent + "how do I"
// queries that reward long-form content:
//   • "questions to ask before hiring a tradesperson uk"
//   • "how to spot a cowboy trader"
//   • "plumber vs gas safe engineer"
//   • "what a fair quote looks like"
//   • "trade deposits milestones retention"
//
// Every article emits Article + FAQPage JSON-LD. Categories map to
// the same 4 pillars used across the platform (hire / price /
// explain / project). Every article cross-links to relevant tools
// (/check-quote, /price-index, /grants, /trades/[trade]).

export type VaultCategory = "hiring" | "pricing" | "trades-explained" | "projects" | "legal-regs";

export type VaultSection = {
  heading:  string;
  /** Rendered as HTML — allows <strong> and inline <a>. Kept minimal. */
  body:     string;
};

export type VaultArticle = {
  slug:            string;
  title:           string;
  /** One-liner for cards + meta description. */
  standfirst:      string;
  category:        VaultCategory;
  author:          string;
  /** Optional — articles ship without a cover if authored one hasn't
   *  landed yet. Hub + leaf gracefully render an eyebrow-only card. */
  heroImage?:      string;
  heroAlt?:        string;
  readingMinutes:  number;
  publishedAt:     string;
  lastReviewedAt:  string;
  sections:        VaultSection[];
  faqs:            Array<{ q: string; a: string }>;
  /** Slugs of related trades → /trades/[trade]. */
  relatedTrades:   string[];
  /** Related editorial slugs → /vault/[slug]. */
  relatedArticles: string[];
  /** Tools to cross-sell in the sidebar/foot. */
  relatedTools:    Array<"price-index" | "check-quote" | "grants" | "answers" | "careers" | "planning" | "cost">;
};

export const CATEGORY_LABEL: Record<VaultCategory, string> = {
  "hiring":           "Hiring",
  "pricing":          "Quotes & pricing",
  "trades-explained": "Trades explained",
  "projects":         "Home projects",
  "legal-regs":       "Legal & regs"
};

export const AUTHOR_DEFAULT = "The Networkers Editorial";

// Cover images sourced from the hero library — sibling group
// "vault-editorial-covers". 1:1 mapping — every article has its
// own authored cover. Never reuse a cover across two articles.
const COVER = {
  hiringChecklist:         "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_38_46%20AM.png",
  cowboyRedFlags:          "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_37_40%20AM.png",
  fairQuote:               "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_39_25%20AM.png",
  paymentTerms:            "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_40_07%20AM.png",
  plumberVsGasSafe:        "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_40_50%20AM.png",
  kitchenFittersVsJoiners: "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_41_30%20AM.png",
  extensionTimeline:       "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_42_11%20AM.png",
  bathroomResale:          "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_42_59%20AM.png"
} as const;

/** /vault hub hero banner. Burned-in branding — never overlay text. */
export const VAULT_HUB_HERO =
  "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_43_33%20AM.png";

export const ARTICLES: VaultArticle[] = [
  {
    slug: "10-questions-ask-before-hiring-uk-tradesperson",
    title: "10 questions to ask before hiring a UK tradesperson",
    standfirst:
      "The right ten questions filter the professionals from the chancers before any deposit is paid. Print this list, use it on your next three quotes.",
    category: "hiring",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.hiringChecklist,
    heroAlt:   "Homeowner interviewing a tradesperson at the kitchen table",
    readingMinutes: 6,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Why these ten questions matter",
        body: `Every UK bad-trade story has the same shape — a homeowner who didn't ask the right questions at the door. The ten below cover competence, insurance, expectations, and payment. Any pro will answer all ten in under 15 minutes; anyone who bristles at question seven has told you what you need to know.`
      },
      {
        heading: "The ten questions",
        body: `<strong>1. What's your Gas Safe / NICEIC / NAPIT / MCS number?</strong> Any regulated trade has one. Verify it on the register — not the paper card.

<strong>2. Can you send me photos of the last three jobs you completed?</strong> Not a portfolio — the last three. Recent, real, dated.

<strong>3. Do you carry public liability insurance? What's the cover level?</strong> Minimum £2m public liability. Ask for a copy of the certificate before work starts.

<strong>4. Who else will be on site? Are they employed or subbies?</strong> You want to know who's coming through your door and who's responsible if there's damage.

<strong>5. What's the payment schedule?</strong> Never full up-front. Fair split is materials-on-order + milestone + snag-retention. See our <a href="/vault/uk-trade-payments-deposits-milestones-retention">deposits guide</a>.

<strong>6. What's your quote fixed price vs. day rate?</strong> Fixed price protects you from scope creep; day rate protects the trade from unknowns. For clean jobs — fixed. Unknowns (leak trace, hidden damage) — day rate is fair.

<strong>7. What warranty do you offer on labour + parts?</strong> Standard is 12 months labour, plus manufacturer warranty on parts. Anything shorter needs a reason.

<strong>8. Will you certify / self-notify the work?</strong> Gas, electrics, structural, and controlled waste all need certification. If the trade can't self-notify, factor Building Control fees into the quote.

<strong>9. What could push the price up mid-job? How will we agree it?</strong> Every honest trade has a "variation" process. Get it in writing before Day 1.

<strong>10. If we have a dispute, what's your process?</strong> Chartered members (CIPHE, NICEIC, FMB) have industry dispute resolution. Independent trades — ask how they've handled a disagreement in the past.`
      },
      {
        heading: "What to do with the answers",
        body: `Bin any trade who won't answer questions 1, 3, or 5. Slow-play any trade who fudges question 7 or 8. Prioritise the trade who answers all ten cleanly, even if their quote is 10% higher — the delta usually comes back in fewer callbacks and cleaner sign-offs.`
      }
    ],
    faqs: [
      {
        q: "Should I ask these questions on WhatsApp or in person?",
        a: "WhatsApp is fine for the first pass — you'll get honest, considered answers. Follow up in person for the ones that matter to you (usually 1, 3, 5, 8). A trade willing to sit and answer them at your kitchen table is already telling you something positive."
      },
      {
        q: "What if the trade refuses to answer question 7 about warranty?",
        a: "That's the tell. Every honest UK trade offers 12 months labour warranty on their own work; the parts warranty comes from the manufacturer. A trade who dodges this question either doesn't stand behind their work or is planning to disappear."
      }
    ],
    relatedTrades:   ["plumber", "electrician", "carpenter", "gas-safe-engineer"],
    relatedArticles: ["how-to-spot-cowboy-tradesperson-uk", "uk-trade-payments-deposits-milestones-retention"],
    relatedTools:    ["check-quote", "answers", "trades"] as VaultArticle["relatedTools"]
  },
  {
    slug: "how-to-spot-cowboy-tradesperson-uk",
    title: "How to spot a cowboy tradesperson in the UK — 12 red flags",
    standfirst:
      "The bad ones sound convincing until you know the signals. Twelve red flags every UK homeowner should recognise before writing a cheque.",
    category: "hiring",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.cowboyRedFlags,
    heroAlt:   "Suspicious unmarked white van in a residential driveway",
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "The 12 red flags",
        body: `<strong>1. Cash-only, no invoice.</strong> Every legitimate UK trade is VAT-registered above £90k turnover and offers a proper invoice.

<strong>2. Insists on full payment up-front.</strong> Fair deposit is materials-on-order (usually 30-40%). Full up-front is theft in slow motion.

<strong>3. No fixed address, no landline, mobile-only, unmarked van.</strong> Not conclusive alone, but a stack of three or four is a pattern.

<strong>4. "I was just in the area — I noticed your roof / driveway / gutters need doing."</strong> The classic doorstep tell. Real trades don't cold-canvass residential streets.

<strong>5. Quote handwritten on the back of a card, or verbal only.</strong> Every UK trade can produce a written quote by email or WhatsApp within 48 hours.

<strong>6. Massive pressure to sign today.</strong> Legitimate trades work weeks or months out. "Today only" is a sales tactic, not a schedule.

<strong>7. Won't share their Gas Safe / NICEIC / MCS number.</strong> Regulated work — no number, no job. Non-negotiable.

<strong>8. Can't or won't provide public liability insurance certificate.</strong> Minimum £2m. Ask for a copy in writing.

<strong>9. Refuses to let you photograph their van or ID.</strong> Every honest trade is happy to be identified. Refusal is a huge tell.

<strong>10. No online presence at all — no Google reviews, no Companies House, no LinkedIn.</strong> A trade running 5+ years leaves footprints. Absence is unusual.

<strong>11. "The materials cost more than expected" — mid-job.</strong> Sometimes true. But if it's the second or third such call, you're being softened for a bigger ask.

<strong>12. Damages something small early on, brushes it off.</strong> A cracked tile "we'll sort at the end." Often they don't — and by the end you've paid enough that arguing feels petty.`
      },
      {
        heading: "What to do if you spot one mid-job",
        body: `Stop paying immediately. Photograph everything, document the last verified work, and if gas/electrical is involved, don't operate the appliance until it's re-certified. Trading Standards (0808 223 1133) accepts reports. For high-value work, a solicitor's letter often triggers refund + walk-away without going to court.`
      }
    ],
    faqs: [
      {
        q: "What's the safest way to find a trade in the UK?",
        a: "Personal referral first. Failing that, verified directories with real reviews (like The Networkers) beat lead-broker marketplaces where anyone can pay to appear. Check every credential yourself on the source register — not a paper card."
      },
      {
        q: "Can I get my money back if I've paid a cowboy?",
        a: "Sometimes. Chargeback via your bank works if you paid by card and the work is materially undelivered. Small Claims Court (up to £10k) is realistic for straightforward disputes. For cash payments — much harder. Prevention costs less than cure."
      }
    ],
    relatedTrades:   ["plumber", "electrician", "roofer", "gas-safe-engineer"],
    relatedArticles: ["10-questions-ask-before-hiring-uk-tradesperson", "uk-trade-payments-deposits-milestones-retention"],
    relatedTools:    ["check-quote", "answers", "trades"] as VaultArticle["relatedTools"]
  },
  {
    slug: "what-a-fair-uk-trade-quote-looks-like-2026",
    title: "What a fair UK trade quote looks like in 2026",
    standfirst:
      "Line-by-line anatomy of a quote you should sign — and the shortcuts + gaps that tell you to walk away.",
    category: "pricing",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.fairQuote,
    heroAlt:   "Quote document beside a mug of tea on a kitchen table",
    readingMinutes: 7,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "The eight things a fair UK quote includes",
        body: `<strong>1. Trade's full name, business name, address, phone.</strong> Sole traders don't need a company — but they do need a real, checkable identity.

<strong>2. Job description in enough detail to bind them.</strong> "Refit bathroom" is not enough. "Remove existing suite, install X bath, Y basin, Z WC, retile walls 2.4m ceiling, floor 3.2m², reglaze shower" is.

<strong>3. Materials list — brand + model + quantity.</strong> "Basin — Roca Debba wall-hung 450mm × 1" not "Basin, £150".

<strong>4. Labour cost — day rate or lump sum, both spelled out.</strong> If the quote is £3,200 lump sum, note the day-rate equivalent so you understand what you're buying.

<strong>5. Timeline — start date + expected end date + working days per week.</strong> Not "we'll fit you in".

<strong>6. Payment schedule — deposit, milestones, final.</strong> See <a href="/vault/uk-trade-payments-deposits-milestones-retention">payment schedule guide</a>. Standard 40/40/20 is fair for most residential work.

<strong>7. Warranty terms — labour + parts, in months.</strong> UK standard is 12 months labour on the trade's own work.

<strong>8. VAT + total.</strong> Total inc VAT is what matters. On energy-saving materials, 0% VAT should be applied automatically — see the <a href="/grants#vat-zero-rating-esm">0% VAT scheme</a>.`
      },
      {
        heading: "What to do if the quote is missing 3 or more of these",
        body: `Ask for a revised quote. If the trade balks or delivers something equally vague, move on. A quote is a professional document — a trade who can't produce one is telling you what they're like to deal with when things get tricky.`
      },
      {
        heading: "Comparing quotes: it's not always the cheapest",
        body: `Get 3 quotes. If they cluster within 15%, the middle is usually the right one. If one is 40% below the others, that's a warning — either they've missed something and will hit you with variations, or they're subcontracting to the cheapest labour.

Use our <a href="/check-quote">Quote Sanity Checker</a> for an instant fair/high/low read against the UK Trade Price Index.`
      }
    ],
    faqs: [
      {
        q: "How long should a UK trade take to send a quote?",
        a: "Simple jobs (like-for-like boiler swap, bathroom refit): 48-72 hours after the site visit. Complex jobs (extensions, full renovation): 5-10 working days. Any trade taking more than 2 weeks without a reason has moved on — chase or drop."
      },
      {
        q: "Are trade quotes legally binding in the UK?",
        a: "A quote is a binding offer once you accept it, provided it's specific enough. An estimate isn't — it's a best-guess. Look at the word: 'quote' or 'quotation' = binding when accepted; 'estimate' = ballpark only."
      }
    ],
    relatedTrades:   ["plumber", "electrician", "carpenter"],
    relatedArticles: ["uk-trade-payments-deposits-milestones-retention", "10-questions-ask-before-hiring-uk-tradesperson"],
    relatedTools:    ["check-quote", "price-index", "cost"] as VaultArticle["relatedTools"]
  },
  {
    slug: "uk-trade-payments-deposits-milestones-retention",
    title: "UK trade payments: deposits, milestones + retention explained",
    standfirst:
      "How to structure trade payments so both sides are protected — the exact split we recommend for jobs from £500 to £50,000.",
    category: "pricing",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.paymentTerms,
    heroAlt:   "Payment schedule sketched out on a builder's clipboard",
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Why the split matters",
        body: `A fair payment schedule protects both sides. The trade can order materials without floating the cost themselves; the homeowner never has more money exposed than work delivered. The split changes with job size.`
      },
      {
        heading: "Under £500 — pay on completion",
        body: `Small jobs (blocked drain, single radiator swap, hang three doors) — pay in full on completion. No deposit needed. If a trade insists on a deposit for a sub-£500 job, they're either new to trading or a red flag.`
      },
      {
        heading: "£500 - £5,000 — 40% deposit, 60% on completion",
        body: `Bathroom refit, boiler install, small rewire. Deposit covers materials on order. Balance is paid on completion + sign-off. Homeowner keeps 5-10% "snag retention" for 14 days if the trade agrees.`
      },
      {
        heading: "£5,000 - £25,000 — 40% deposit, 40% milestone, 20% completion (10% retention 30 days)",
        body: `Kitchen refit, loft conversion, half-house rewire. Milestone is typically first-fix or watertight. Final 10% held back for 30 days protects against snagging that only shows up after settlement.`
      },
      {
        heading: "£25,000+ — staged payments per JCT-style schedule",
        body: `Extension, whole-house renovation. Use a proper stage schedule — foundation complete / plate level / watertight / plaster complete / snag / final. Each stage is a defined payment. For jobs above £50k, a written contract (JCT Homeowner form is free) is genuinely worth it.`
      },
      {
        heading: "Retention: keep the last 5-10% for 30 days",
        body: `Retention is your snag insurance. Radiators that don't quite balance, a tile that grouts loose, a door that catches on the frame after settlement. Retention gives you a lever to get them fixed without a fight.

A trade who refuses retention on a job over £5k is telling you they don't stand behind their work. Legitimate trades expect it.`
      }
    ],
    faqs: [
      {
        q: "Can a UK tradesperson ask for a bigger deposit than 40%?",
        a: "Sometimes — legitimately. Bespoke items (kitchens, custom joinery, made-to-measure windows) may require 50% on order because the trade has no resale market if you cancel. Anything above 50% is unusual and needs a specific reason."
      },
      {
        q: "How do I pay a trade safely?",
        a: "Bank transfer with a proper invoice — most common. Card via a proper processor (Stripe, iZettle) — small extra protection via chargeback rights. Cash — legal, but no paper trail if things go wrong. Never wire money to a personal account without an invoice."
      }
    ],
    relatedTrades:   ["plumber", "electrician", "carpenter", "bricklayer"],
    relatedArticles: ["what-a-fair-uk-trade-quote-looks-like-2026", "10-questions-ask-before-hiring-uk-tradesperson"],
    relatedTools:    ["check-quote", "price-index"] as VaultArticle["relatedTools"]
  },
  {
    slug: "plumber-vs-gas-safe-engineer-uk",
    title: "Plumber vs Gas Safe engineer: which do you actually need?",
    standfirst:
      "The two overlap in ways that confuse UK homeowners. Clear rules for when 'a plumber' is enough — and when you legally need a Gas Safe engineer.",
    category: "trades-explained",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.plumberVsGasSafe,
    heroAlt:   "Plumber's tool kit beside a Gas Safe ID card",
    readingMinutes: 4,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "The legal line",
        body: `Under the Gas Safety (Installation and Use) Regulations 1998, any work on a UK gas appliance or gas pipework is legally restricted to Gas Safe registered engineers. That's a criminal offence to bypass — no ifs, no exemptions.

Water, drainage, waste, and heating systems that don't touch gas — those are open trades. Any competent plumber can do them.`
      },
      {
        heading: "When 'a plumber' is enough",
        body: `<strong>Bathroom refit</strong> — new bath, basin, WC, taps, shower valve, wet tiling: plumber.

<strong>Kitchen plumbing</strong> — new sink, dishwasher, washing machine, water softener: plumber.

<strong>Radiators</strong> — swap a rad, add a rad, balance the system: plumber.

<strong>Blocked drains, waste pipe leaks, water tank replacements</strong>: plumber.`
      },
      {
        heading: "When you legally need a Gas Safe engineer",
        body: `<strong>Boiler install, service, repair, remove</strong>: Gas Safe.

<strong>Gas hob install</strong> or move: Gas Safe.

<strong>Gas fire, gas oven, gas water heater</strong>: Gas Safe.

<strong>Any pipework carrying gas</strong>, including capping off an unused gas point: Gas Safe.

<strong>Adding a new gas run</strong> from the meter: Gas Safe.

You can verify any engineer's registration at GasSafeRegister.co.uk — search by number, name, or postcode.`
      },
      {
        heading: "The overlap: most Gas Safe engineers are also plumbers",
        body: `Roughly 70% of UK Gas Safe registered engineers hold the full Level 3 plumbing NVQ + WRAS + Unvented certification. They can do everything a plumber can plus gas.

That means: if you have gas work in the project (even a small bit — moving a gas hob, capping a redundant fire), hire the Gas Safe engineer for the whole job. Simpler, single point of accountability.

If the project is purely water, hire the plumber. Gas Safe premium is 20-30% on the rate — worth paying only for actual gas work.`
      }
    ],
    faqs: [
      {
        q: "Can a plumber connect my new gas cooker?",
        a: "Only if that plumber is also Gas Safe registered. The label 'plumber' doesn't grant gas rights — Gas Safe registration does. Always verify the number, not the marketing."
      },
      {
        q: "What does a Gas Safe engineer typically charge in the UK?",
        a: "£55-£110 per hour, £260-£480 per day (2026 rates — see the UK Trade Price Index). Emergency callouts run £100-£220 for the first hour. That's ~20-30% above general plumber rates, which is the market's fair price for the gas qualification premium."
      }
    ],
    relatedTrades:   ["plumber", "gas-safe-engineer"],
    relatedArticles: ["what-a-fair-uk-trade-quote-looks-like-2026"],
    relatedTools:    ["price-index", "check-quote", "answers"] as VaultArticle["relatedTools"]
  },
  {
    slug: "kitchen-fitters-vs-bespoke-joiners-uk",
    title: "Kitchen fitters vs bespoke joiners: the £5,000 difference",
    standfirst:
      "Both fit kitchens; they don't compete on the same jobs. Here's how to know which one you need — and why the price gap is honest.",
    category: "trades-explained",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.kitchenFittersVsJoiners,
    heroAlt:   "Handmade kitchen cabinetry alongside a flat-pack unit",
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Kitchen fitter = installer, not maker",
        body: `A kitchen fitter installs manufactured units (Howdens, Wren, Magnet, DIY Kitchens, IKEA). They fit carcasses, hang doors, cut worktops, plumb the sink, wire in appliances, tile the splashback. They don't make the units.

Fitters are fast and accurate on standard units. A typical mid-size fitted kitchen install is 5-8 days once the kitchen has arrived on site.`
      },
      {
        heading: "Bespoke joiner = maker + fitter",
        body: `A bespoke joiner builds the units in a workshop then installs them. Every piece is made to the room's exact dimensions — no fillers, no compromise on the awkward wall. Materials are usually a step up (birch ply carcasses, solid timber doors, hand-painted or spray-lacquered finish).

Bespoke joinery adds 6-14 weeks to the timeline (workshop time) and £8,000-£25,000+ to the invoice compared to a fitted kitchen of the same size.`
      },
      {
        heading: "When each one is right",
        body: `<strong>Standard house, standard layout, budget conscious</strong> — fitter, mid-range brand (Howdens, Wren, DIY Kitchens). Total spend £10,000-£25,000.

<strong>Awkward room, older property, distinctive design brief</strong> — bespoke joiner. Total spend £25,000-£70,000+.

<strong>Rental / flip / new-build</strong> — fitter always. Bespoke doesn't recover its cost on resale in this segment.

<strong>Forever home with a character kitchen brief</strong> — bespoke. The finish difference will still be visible 20 years in.`
      },
      {
        heading: "How to tell you're being sold the wrong one",
        body: `A "bespoke" quote that comes back inside a week is a fitter using a manufacturer's flexible unit range. That's fine — but it isn't bespoke; don't pay bespoke pricing for it.

A "fitter" who charges £30,000+ for a standard kitchen is padding materials. Look at the invoice — if it's 40%+ labour on a manufacturer's units, get another quote.`
      }
    ],
    faqs: [
      {
        q: "How much does a bespoke kitchen cost in the UK?",
        a: "£25,000-£70,000 for most residential jobs. Very high-end bespoke (heritage properties, complex materials like brass inlay + stone tops) can reach £150,000+. The workshop time — 8-14 weeks — is why the timeline stretches versus a fitted kitchen."
      },
      {
        q: "Do bespoke joiners fit their own kitchens?",
        a: "Usually yes — the whole point of bespoke is that the joiner controls fit + finish end-to-end. A very few operate as makers only, subcontracting the install. Ask upfront who's on the tools during the fit week."
      }
    ],
    relatedTrades:   ["carpenter"],
    relatedArticles: ["what-a-fair-uk-trade-quote-looks-like-2026"],
    relatedTools:    ["cost", "price-index", "trades"] as VaultArticle["relatedTools"]
  },
  {
    slug: "uk-extension-8-week-timeline-planning-to-keys",
    title: "UK single-storey extension: 8-week timeline from planning to keys",
    standfirst:
      "The realistic week-by-week schedule for a 20m² rear extension in the UK — and where things typically slip.",
    category: "projects",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.extensionTimeline,
    heroAlt:   "Rear kitchen extension under construction with steel beam visible",
    readingMinutes: 6,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Week 0-4: pre-start (before you break ground)",
        body: `<strong>Weeks -8 to -4:</strong> Architect drawings + structural calcs (£1,500-£4,000). Party wall notice served if a neighbour boundary is within 3m.

<strong>Weeks -4 to 0:</strong> Building Control application submitted. Skips + scaffolding + welfare unit booked. Steel beams ordered (10-14 day lead time). Materials scheduled by builder.

Skipping this pre-start work is the #1 cause of 4-week delays mid-build. Get every drawing signed off before the diggers arrive.`
      },
      {
        heading: "Week 1: strip out + foundations",
        body: `Existing patio doors + brickwork removed. Trench for new foundations dug, inspected by Building Control, poured. Steel goggle-plate installed at trench level.`
      },
      {
        heading: "Week 2-3: brickwork up to DPC + oversite slab",
        body: `Brick and blockwork to damp-proof course. Beam-and-block or PIR-insulated concrete slab laid. First inspection at DPC.`
      },
      {
        heading: "Week 4-5: walls to plate level + roof frame",
        body: `Cavity walls up to wall-plate. Roof timbers cut and pitched. Steel beam lifted in over the old rear wall opening (this is the biggest single-day event — often needs a crane).`
      },
      {
        heading: "Week 6: watertight + windows in",
        body: `Roof covering finished (tiles, single-ply, or flat roof membrane). Rooflight in. Bifold or french doors installed. Property is now watertight.`
      },
      {
        heading: "Week 7: first-fix + plaster",
        body: `Electrics roughed in (sockets, lighting, CCTV, alarm cables). Plumbing first-fix (waste, supply, radiator drops). Plasterboard + skim.`
      },
      {
        heading: "Week 8: second-fix + finishing",
        body: `Kitchen or utility units in. Flooring down. Skirting, architrave, painting. Sockets + switches + light fittings in. Final Building Control inspection + completion certificate.

Total: 8 weeks, best case, on a straightforward 20m² rear extension. Real world with weather, delivery slips, and one small variation typically adds 2 weeks.`
      },
      {
        heading: "Where extensions slip",
        body: `<strong>Steel beam delivery</strong> — usually the critical-path item. Confirm the order at Week -4, not Week 4.

<strong>Party wall dispute</strong> — can add 4-8 weeks if the neighbour insists on a surveyor.

<strong>Weather</strong> — flat roofs can't go on in heavy rain; heavy frost stops brickwork. UK Jan-Feb is high-risk.

<strong>Variations</strong> — every homeowner change mid-build adds a week. Lock the spec at Day 1.`
      }
    ],
    faqs: [
      {
        q: "Do I need planning permission for a rear kitchen extension in the UK?",
        a: "Usually no — most single-storey rear extensions fall under Permitted Development (up to 4m for a semi, 3m for a terrace in England). Larger extensions need Prior Approval or full planning. See our <a href='/planning/rear-extension'>rear extension planning guide</a>."
      },
      {
        q: "What's the average UK cost for a 20m² kitchen extension?",
        a: "£45,000-£65,000 mid-range spec for 2026, per our <a href='/cost/kitchen-extension'>kitchen extension cost calculator</a>. London adds 30-40%, northern cities are 8-12% below the national average."
      }
    ],
    relatedTrades:   ["bricklayer", "carpenter", "electrician", "plumber", "roofer"],
    relatedArticles: ["bathroom-refit-uk-what-adds-resale-value-2026"],
    relatedTools:    ["cost", "planning", "price-index"] as VaultArticle["relatedTools"]
  },
  {
    slug: "bathroom-refit-uk-what-adds-resale-value-2026",
    title: "Bathroom refit UK 2026: what actually adds resale value",
    standfirst:
      "Every £5,000 spent on a bathroom returns different amounts. Here's what UK estate agents in 2026 say buyers actually pay a premium for.",
    category: "projects",
    author:   AUTHOR_DEFAULT,
    heroImage: COVER.bathroomResale,
    heroAlt:   "Freshly refitted UK family bathroom with walk-in shower",
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "What buyers pay a premium for in 2026",
        body: `<strong>Walk-in shower + double basin</strong> in the main family bathroom. Adds £5,000-£12,000 to sale price on a £400k+ property, per Rightmove's 2026 buyer preference data.

<strong>Underfloor heating.</strong> Reads as a premium finish. Adds £2,000-£5,000 to perceived value on a mid-range property.

<strong>Neutral, high-quality tiling floor-to-ceiling.</strong> White, cream, or pale stone. Bold patterns date fast — buyers subtract £3,000-£8,000 to re-tile.

<strong>Chrome or matt-black fittings (not brass, not gold).</strong> Warm metallics have peaked and are on the way out; matt-black + chrome are the safe long-term choices for resale.

<strong>Extractor + LED lighting on separate switches.</strong> Sounds trivial but every home buyer notices bad bathroom lighting.`
      },
      {
        heading: "What doesn't return its cost",
        body: `<strong>Jacuzzi baths.</strong> Cost £2,000-£4,000 to install; buyers subtract £1,500-£3,000 for maintenance concerns. Skip.

<strong>Colour suites (black bath, coloured basin).</strong> Kills 10-15% of viewings. If you personally love it, know you're leaving £5,000+ on the table at sale.

<strong>Bidets.</strong> Take up space; nobody uses them. Remove and gain floor room.

<strong>Very cheap suite in a premium property.</strong> The eye recognises a £299 vanity in a £500k home. Match the finish to the property tier.`
      },
      {
        heading: "The £8,000 sweet spot",
        body: `On a £350-£550k UK property, an £8,000 spend broken down as £3,000 suite + £2,000 tiling + £1,500 electrics + £1,500 labour typically returns £10,000-£16,000 at sale — the highest ROI band in home improvements right now. Above £15,000 spend, returns diminish.`
      },
      {
        heading: "Timing the sale",
        body: `Refit at least 12 months before listing. A brand-new bathroom reads as "flip" — a 12-24-month-lived-in refit reads as "the owners upgraded because they cared". Sounds petty; it moves offers.`
      }
    ],
    faqs: [
      {
        q: "How much does a mid-range bathroom refit cost in the UK 2026?",
        a: "£5,500-£8,500 including new suite, tiling, plumbing, electrics, 5-7 days labour. See the <a href='/cost/bathroom-refit'>bathroom refit cost calculator</a> for regional pricing."
      },
      {
        q: "Do I need a plumber and a tiler for a bathroom refit?",
        a: "Usually yes plus an electrician. Some plumbers tile — but the finish rarely matches a dedicated tiler's work. On any refit above £5k, budget for three specialists coordinated by whoever's project managing. If you're paying a builder to manage, the coordination fee is 10-15%."
      }
    ],
    relatedTrades:   ["plumber", "tiler", "electrician"],
    relatedArticles: ["what-a-fair-uk-trade-quote-looks-like-2026"],
    relatedTools:    ["cost", "check-quote", "trades"] as VaultArticle["relatedTools"]
  },

  // ─── Expansion batch 2026-07-20 (8 → 16 articles) ─────────

  {
    slug: "uk-building-regulations-extensions-what-you-need",
    title: "UK Building Regulations for extensions — what you need before starting",
    standfirst:
      "Planning permission is one gate; Building Regs is a separate one. Here's exactly what your builder + Building Control need signed off before, during, and after the build.",
    category: "legal-regs",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 6,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Planning permission vs Building Regulations — two different things",
        body: `<strong>Planning</strong> is about whether you're allowed to build the thing at all. It regulates size, siting, appearance, neighbourhood impact. Handled by your local council's planning department.

<strong>Building Regulations</strong> is about whether the thing is safely + soundly built. Structural integrity, fire safety, drainage, ventilation, insulation, electrical, gas. Handled by Building Control — either your local council or an approved private inspector.

Every UK extension needs Building Regs approval, even when it's Permitted Development for planning. The two are separate legal gates.`
      },
      {
        heading: "The Building Regs approval routes",
        body: `<strong>Full Plans application</strong> — submit detailed drawings + structural calcs BEFORE work starts. Building Control reviews, approves, then inspects at stages. Slower + more paperwork but zero risk of a mid-build surprise. Standard for extensions over ~15m² and any project with steel or complex structural work.

<strong>Building Notice</strong> — no drawings, just start building + notify. Building Control inspects live as work progresses. Faster but any failed inspection means you tear it out + rebuild at your cost. Only realistic for very small, simple extensions with an experienced builder.

<strong>Approved Inspector (private)</strong> — same rules as council Building Control but you appoint a private inspector. Often faster + more flexible. Slightly more expensive (£800-£1,500 vs council £400-£900 for a small extension).`
      },
      {
        heading: "Inspections you'll get during the build",
        body: `Typical inspection stages for a single-storey rear extension:

<strong>1. Foundations excavated</strong> — before pour. Check depth + soil.
<strong>2. Foundations poured + damp course</strong> — before brickwork rises.
<strong>3. Drainage</strong> — before backfill of any waste run.
<strong>4. Structural — steel installed</strong> — before plaster covers it.
<strong>5. Insulation</strong> — before plasterboard fixes over it.
<strong>6. Completion</strong> — full sign-off, issues Completion Certificate.

Your builder books these; you shouldn't have to chase. Missing an inspection means demolishing back to that stage to prove compliance.`
      },
      {
        heading: "The Completion Certificate matters at resale",
        body: `Building Regs sign-off produces a Completion Certificate. Keep it in your house deeds — every future buyer's solicitor asks for it. Without it, buyers negotiate 5-10% off the sale price to cover the risk, and mortgage lenders can refuse to lend.

If you inherit a property with unsigned-off building work, you can apply retrospectively (Regularisation) — but it's more expensive + means opening up finished walls for inspection.`
      }
    ],
    faqs: [
      { q: "How much does Building Regs approval cost in the UK?", a: "£400-£900 for council Building Control on a small extension; £800-£1,500 for a private Approved Inspector. Larger + more complex projects scale from there. Cost is separate from planning application fees + separate from the actual build cost." },
      { q: "Can I DIY building work under Building Regs?",         a: "Yes for most non-notifiable work, provided it's built to standard + you can prove it. High-risk work (gas, notifiable electrics, structural, drainage) needs a registered installer or full Building Control inspection. DIY = self-notify + inspect + certify — realistically only makes sense on small projects." }
    ],
    relatedTrades: ["bricklayer", "carpenter", "electrician", "plumber"],
    relatedArticles: ["uk-extension-8-week-timeline-planning-to-keys"],
    relatedTools: ["cost", "planning"] as VaultArticle["relatedTools"]
  },

  {
    slug: "party-wall-notices-uk-homeowner-rules",
    title: "Party wall notices — the 3 rules every UK homeowner should know",
    standfirst:
      "Extend within 3m of a boundary, dig near a neighbour's foundations, or knock through a shared wall — the Party Wall etc. Act 1996 applies. Get the notice right + save months of delay.",
    category: "legal-regs",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Rule 1: three types of work trigger party-wall notice",
        body: `<strong>Work on a party wall itself</strong> — cutting into it (steel beam pocket), demolishing + rebuilding, raising or lowering height, chimney breast removal.

<strong>New building within 3m of a boundary</strong> AND at a depth greater than the neighbour's foundations. Most extensions with strip foundations fall here.

<strong>New excavation within 6m</strong> if it hits a 45° angle from the base of the neighbour's foundations. Basements, deep foundations, retaining walls.

Any one triggers the Act. All three trigger notice periods before you can start.`
      },
      {
        heading: "Rule 2: notice periods are statutory — you can't shortcut them",
        body: `<strong>2 months</strong> for excavation work.
<strong>1 month</strong> for work on a party wall itself.

The clock starts when the neighbour receives the notice, not when you send it. Serve by post or in person + keep proof of delivery.

Neighbour has 14 days to respond. Options: <strong>consent</strong> (job proceeds), <strong>dissent</strong> (surveyors get involved), or <strong>no response</strong> (deemed dissented — surveyors get involved).`
      },
      {
        heading: "Rule 3: if the neighbour dissents, a Party Wall Award is required",
        body: `Both sides appoint a party-wall surveyor (or agree one shared surveyor). The surveyor(s) draw up an Award — a legal document covering scope of work, working hours, protection measures, damage liability, and dispute resolution.

<strong>Cost:</strong> £900-£1,800 per surveyor for a straightforward Award; £3,000-£8,000 for complex jobs with multiple neighbours + basement/deep-work involvement. You pay for BOTH sides (yours + theirs) unless the neighbour is being unreasonable + the surveyor rules otherwise.

<strong>Timeline:</strong> 4-12 weeks typical. Complex jobs can run 3-6 months. Start party-wall notice as early as possible — before drawings are even finalised — because it's the biggest single delay factor on most extensions.`
      }
    ],
    faqs: [
      { q: "Can I ignore party-wall rules if my neighbour is friendly?",  a: "Legally, no — the Act applies regardless. Practically, if the neighbour consents in writing you avoid the surveyor step. But even friendly neighbours become adversarial when foundations crack or vibration damages plaster. Written consent + a photographic Schedule of Condition (both properties) protects everyone." },
      { q: "What happens if I start work without serving notice?",         a: "The neighbour can seek an injunction to stop work + claim damages. Any damage caused becomes your automatic liability with no surveyor to mediate. Most solicitors advise proceeding to full notice + Award even mid-build if you started without one — it's easier to remedy the process than defend the omission." }
    ],
    relatedTrades: ["bricklayer", "carpenter"],
    relatedArticles: ["uk-extension-8-week-timeline-planning-to-keys", "uk-building-regulations-extensions-what-you-need"],
    relatedTools: ["planning", "cost"] as VaultArticle["relatedTools"]
  },

  {
    slug: "how-to-write-a-trade-project-brief-uk",
    title: "How to write a project brief a UK trade will actually quote from",
    standfirst:
      "A vague brief gets a vague quote — or none at all. Here's the exact structure UK trades want to see before they'll take you seriously.",
    category: "hiring",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 4,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Why brief quality determines quote quality",
        body: `A tradesperson quoting from a good brief can lock the price. A tradesperson quoting from a vague description quotes high (to protect their margin against unknowns) or won't quote at all. Every hour you spend on the brief saves multiple hours of back-and-forth + more accurate pricing.`
      },
      {
        heading: "The 6 sections every project brief needs",
        body: `<strong>1. Scope in one sentence.</strong> "Full family bathroom refit — remove existing suite, retile floor + walls, install new suite, add extractor."

<strong>2. Property basics.</strong> Address, postcode, property type (semi/terrace/detached), age, listed status yes/no.

<strong>3. Access + working conditions.</strong> Off-street parking? Stairs to work area? Family living in the house during works? Working hours preference?

<strong>4. Products chosen (or budget for products).</strong> "Roca Debba basin + WC + Grohe thermostatic shower valve — codes attached" OR "£800 budget for suite, £30/m² tile budget, decorate later."

<strong>5. Timeline expectation.</strong> When you want it done. Any hard dates (wedding, sale, tenants moving in).

<strong>6. Photos + measurements.</strong> Every wall, floor + fixture. Rough dimensions to nearest 100mm. 5-10 photos of the current state.`
      },
      {
        heading: "What a good brief looks like",
        body: `Real example: "Family bathroom refit, 22 St Something Rd Manchester M14 5RB — semi-detached 1930s, off-street parking. Remove existing suite + strip tiles. Install new: Roca Debba 450 wall-hung basin, Roca Meridian close-coupled WC, Ideal Standard Freedom 1700 bath, Grohe Grohtherm 1000 shower valve + rail. Full-height tile — porcelain 600×300 (£28/m² budget). Extractor fan direct to outside wall. Working days 8-5 Mon-Fri, we'll move out for the 6 days of works. Wanted complete by mid-September for a family visit — start date flexible before that. 8 photos attached + a rough sketch with measurements."

Any trade can quote that inside 48 hours. Compare to: "Need a bathroom done, whenever you can, get back to me."`
      }
    ],
    faqs: [
      { q: "Should I get the trade to write the specification?",           a: "For simple jobs, no — you drive it. For extensions or complex projects, yes — an architect or the lead builder produces a proper specification. Halfway house on medium jobs (kitchen refit, large bathroom): you sketch the scope, the trade quotes off it, then you both agree a written Statement of Work before signing." },
      { q: "How much detail is 'too much' in a brief?",                     a: "There's no such thing. Trades appreciate over-detailed briefs — it means less risk of variations mid-job. The floor of detail is enough to bind the quote; anything above that helps." }
    ],
    relatedTrades: ["plumber", "electrician", "carpenter", "plasterer"],
    relatedArticles: ["10-questions-ask-before-hiring-uk-tradesperson", "what-a-fair-uk-trade-quote-looks-like-2026"],
    relatedTools: ["check-quote", "answers"] as VaultArticle["relatedTools"]
  },

  {
    slug: "reading-a-uk-trade-invoice-line-by-line",
    title: "Reading a UK trade invoice — line by line",
    standfirst:
      "A well-structured invoice tells you exactly what you paid for and gives you legal footing if anything goes wrong. Here's what to look for + what to challenge.",
    category: "pricing",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 4,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "What a proper UK trade invoice includes",
        body: `<strong>Trader identification</strong> — full name or business name, address, contact details.

<strong>Company + tax registration</strong> — Companies House number (if a Ltd co), VAT number if VAT-registered (turnover >£90k triggers mandatory VAT registration).

<strong>Unique invoice number + date issued.</strong>

<strong>Line items</strong> — each service or material item on its own line, with quantity + unit price.

<strong>Sub-total, VAT amount, total inc VAT.</strong> Zero VAT lines allowed for qualifying energy-saving materials — see the 0% VAT ESM scheme.

<strong>Payment terms + due date.</strong>

<strong>Warranty terms + duration.</strong>`
      },
      {
        heading: "Red flags to challenge before you pay",
        body: `<strong>Handwritten "cash job — no VAT".</strong> Either they're VAT-registered (legally must charge + document VAT) or they're under the threshold (no VAT — but still need a proper invoice with their name/address). Cash + no paper = zero chargeback rights + tax risk to you as a witness.

<strong>Vague single-line "labour + materials, £3,200".</strong> Ask for itemisation. Trades who won't itemise are usually padding.

<strong>Sudden variations you didn't sign off.</strong> Every scope change should have a written variation instruction from you before it's invoiced.

<strong>VAT charged when the invoice says 0% VAT ESM.</strong> Energy-saving materials in qualifying installs attract 0% VAT (until April 2027). If the trade charges 20% and the install qualifies, you're overpaying 20%.`
      }
    ],
    faqs: [
      { q: "Do I need a VAT invoice from every UK trade?",             a: "Only from VAT-registered trades. Under-threshold sole traders don't need to issue VAT invoices — but they still need to issue a proper invoice with their name/address + line items + total. 'Cash, no paperwork' is not acceptable at any level." },
      { q: "Can I withhold payment for defective work?",                a: "Yes — proportionally. Withhold enough to cover the cost of remedial work by another trade, pay the balance. Send a written notice explaining what you're withholding + why. Never withhold the full amount for a partial defect — that opens you to a debt-collection response." }
    ],
    relatedTrades: [],
    relatedArticles: ["uk-trade-payments-deposits-milestones-retention", "what-a-fair-uk-trade-quote-looks-like-2026"],
    relatedTools: ["check-quote", "grants"] as VaultArticle["relatedTools"]
  },

  {
    slug: "uk-boiler-size-guide-kw-ratings-household-needs",
    title: "UK boiler size guide — kW ratings + your actual household needs",
    standfirst:
      "Over-sized boilers waste gas + short-cycle; under-sized boilers can't heat the house. Sizing depends on radiator count, cylinder capacity, and simultaneous hot-water demand.",
    category: "trades-explained",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "The two kW numbers on a boiler",
        body: `Modern UK boilers show two ratings: <strong>central heating kW</strong> (how much heat it puts into radiators) and <strong>domestic hot water kW</strong> (how much heat it delivers to the tap on demand).

Combi boilers show both — CH is usually 24-30kW, DHW usually 28-42kW (higher because on-demand hot water needs the burner at full tilt).

System + regular boilers show only the CH kW (the cylinder handles hot water separately).`
      },
      {
        heading: "How to size — combi boiler",
        body: `<strong>1-2 bed flat, 1 bathroom:</strong> 24-28kW combi.
<strong>3-bed semi, 1 bathroom + en-suite:</strong> 28-32kW combi.
<strong>4-bed detached, 2 bathrooms:</strong> 32-38kW combi — but consider system + cylinder for peak-time hot water.
<strong>5+ bed or 3+ bathrooms:</strong> Combi rarely suffices. Go system boiler + 200L+ cylinder.`
      },
      {
        heading: "How to size — system + regular boilers",
        body: `Size the CH kW to the total radiator BTU output plus the cylinder recovery load. Rough rule: 1kW per 20m² of well-insulated floor area OR sum radiator kW ratings.

<strong>Cylinder:</strong> 150L for 1-2 people; 200L for a family of 3-4; 250-300L for large families + high hot-water demand.

An over-sized boiler with under-sized radiators short-cycles — burns fuel, wears the boiler, doesn't heat the house well. Match the whole system, not just the boiler.`
      },
      {
        heading: "When to swap from combi to system",
        body: `<strong>You need two showers running simultaneously.</strong> Combi can't; system + cylinder can.

<strong>You have low mains pressure (below 1.5 bar).</strong> Combi struggles; system + cylinder + pump handles it.

<strong>You're installing solar-thermal or a heat pump.</strong> Both need a cylinder — combi is incompatible.`
      }
    ],
    faqs: [
      { q: "Can I just upgrade my old boiler to a bigger one?",             a: "Not without checking. Bigger boiler needs bigger gas supply (22mm pipe minimum for 30kW+; check the meter capacity too), plus radiators must be sized to match. Gas Safe engineer sizes the whole system + confirms feasibility before quoting." },
      { q: "How long should a UK boiler last?",                              a: "10-15 years typical; 20+ years for well-maintained heavy-duty models. Warranties run 5-12 years depending on brand + installer accreditation. Annual service is usually required to keep the warranty valid — factor £75-£130/year." }
    ],
    relatedTrades: ["gas-safe-engineer", "plumber"],
    relatedArticles: ["plumber-vs-gas-safe-engineer-uk"],
    relatedTools: ["cost", "price-index", "grants"] as VaultArticle["relatedTools"]
  },

  {
    slug: "kitchen-worktop-showdown-quartz-granite-laminate-2026",
    title: "Kitchen worktop showdown — quartz vs granite vs laminate 2026",
    standfirst:
      "Same size kitchen, three worktop choices, wildly different price + lifespan. Here's when each one is actually right.",
    category: "projects",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "Laminate — £150-£450 per linear metre supplied",
        body: `Chipboard core with a printed decorative layer + wear surface. Modern laminates (Egger, Formica) mimic stone convincingly at 3-5m viewing distance.

<strong>Life:</strong> 8-12 years typical. Fails at joints (water ingress swells the core) and at edge banding.

<strong>Best for:</strong> Rental properties, flips, budget refits, temporary kitchens before a bigger renovation. Nothing wrong with laminate in the right context.`
      },
      {
        heading: "Granite — £350-£800 per linear metre supplied + installed",
        body: `Natural stone slab, cut + polished to fit. Each piece is unique — pick the actual slab at the yard before templating.

<strong>Life:</strong> 25-50 years. Effectively permanent if sealed annually.

<strong>Best for:</strong> Traditional + Shaker kitchens where you want visible natural texture. Withstands heat + knife marks. Heavy — needs strong base units + often needs a support brace on long unsupported spans.`
      },
      {
        heading: "Quartz (engineered stone) — £400-£900 per linear metre supplied + installed",
        body: `93-97% crushed natural quartz + resin binder. Uniform colour + pattern (unlike granite's natural variation). Silestone, Caesarstone, Compac, Neolith are the mainstream UK brands.

<strong>Life:</strong> 20-30+ years. Non-porous, no sealing required.

<strong>Best for:</strong> Contemporary + high-end kitchens where uniformity matters. Handles heat better than laminate + more scratch-resistant than granite. Preferred choice for most 2026 UK premium kitchens.

<strong>Health warning:</strong> Since 2024, HSE has flagged silicosis risk to workers cutting quartz. Confirm your fabricator uses wet-cut process + proper dust extraction. This is the worker's risk, not the homeowner's — but check the paper trail.`
      },
      {
        heading: "Sintered stone (Dekton, Neolith Ultrasize) — £500-£1,200 per m",
        body: `The premium 2026 option. Manufactured under intense heat + pressure. Impervious to heat, scratch, UV, stain. Life expectancy indefinite.

<strong>Best for:</strong> Outdoor kitchens, top-end contemporary interiors, high-heat use (chef-style ranges). Overkill in most standard residential kitchens.`
      }
    ],
    faqs: [
      { q: "Which worktop is the best value for money?",                    a: "Quartz — over a 20-year timeframe. Laminate's low upfront cost is offset by a mid-cycle replacement (every 8-12 years); granite costs slightly more but delivers 25-50 year life; quartz sits between them in cost + hits the sweet spot on longevity + finish. Laminate wins on 5-year value only." },
      { q: "Can I fit worktops myself?",                                    a: "Laminate — yes, straight cuts + jig-drilled hob/sink cutouts. Granite + quartz + sintered — no. Templating requires laser measurement + specialist wet-cutting kit + a 3-4 person lift to install a 3m slab. Fabricator + fitter usually a single company." }
    ],
    relatedTrades: ["carpenter"],
    relatedArticles: ["kitchen-fitters-vs-bespoke-joiners-uk"],
    relatedTools: ["cost", "check-quote"] as VaultArticle["relatedTools"]
  },

  {
    slug: "landlord-cp12-certificates-uk-mistakes",
    title: "Landlord CP12 gas certificates — 7 mistakes UK landlords keep making",
    standfirst:
      "The CP12 is one of the highest-liability documents in UK landlord compliance. Get it wrong and prosecutions can hit £6,000 per property.",
    category: "legal-regs",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 4,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "The 7 mistakes",
        body: `<strong>1. Letting it expire mid-tenancy.</strong> Annual renewal is statutory — every 12 months from the previous inspection date, not calendar year. Late renewal creates a gap that's evidence in any incident.

<strong>2. Skipping the tenant copy.</strong> You must give the current tenant a copy within 28 days of the inspection AND give it to new tenants at move-in. Both requirements — not one or the other.

<strong>3. Missing appliances.</strong> Every gas appliance in the rented property needs to be on the certificate. Gas hob, oven, boiler, fire, heater. The engineer picks them up on inspection; you flag any that aren't obvious (e.g. gas point capped behind a fridge).

<strong>4. Using an unregistered engineer.</strong> Only Gas Safe registered engineers can issue a valid CP12. Verify their licence number at GasSafeRegister.co.uk before + after — the CP12 must show the registered engineer's number.

<strong>5. Ignoring flagged remedial actions.</strong> Any "at-risk" or "immediately-dangerous" flag on the certificate is a duty to remediate. Continuing to let a property with unresolved dangerous appliances is a strict-liability offence.

<strong>6. Not keeping historic copies.</strong> Keep every CP12 for 2 years minimum (statutory) — practically, keep them for the life of the property. Deposit disputes + tenant claims routinely go back further.

<strong>7. Skipping empty periods.</strong> Between tenancies is still landlord-liable. Your CP12 clock keeps ticking even with no tenant. If it expires while empty, you can't legally re-let until it's renewed.`
      },
      {
        heading: "Cost + timing",
        body: `£75-£130 for a single-appliance CP12; £15-£25 per additional appliance. Combined boiler service + CP12 typically £110-£160. Book 2-3 weeks before expiry — Gas Safe engineer availability tightens in October-January as boiler-service demand peaks.`
      }
    ],
    faqs: [
      { q: "What happens if my UK CP12 expires and there's an incident?",   a: "You're liable for prosecution + civil claim + insurance void. HSE penalties in 2026 average £6,000 per property + criminal record. Unlimited fine if convicted in Crown Court. Expiry alone (no incident) still carries civil enforcement + tenant compensation claim risk." },
      { q: "Is a CP12 the same as an EICR?",                                 a: "No — different documents. CP12 = gas safety, annual, mandatory. EICR (Electrical Installation Condition Report) = electrical, every 5 years, mandatory for private rentals since April 2021. Book both together to reduce hassle." }
    ],
    relatedTrades: ["gas-safe-engineer", "electrician"],
    relatedArticles: ["plumber-vs-gas-safe-engineer-uk"],
    relatedTools: ["price-index"] as VaultArticle["relatedTools"]
  },

  {
    slug: "uk-home-emergency-insurance-what-it-covers",
    title: "UK home emergency insurance — what it actually covers (and what it doesn't)",
    standfirst:
      "Sold at £5-£25/month as peace of mind. In reality, the exclusions matter more than the coverage. Read this before you renew.",
    category: "hiring",
    author:   AUTHOR_DEFAULT,
    readingMinutes: 5,
    publishedAt:    "2026-07-20",
    lastReviewedAt: "2026-07-20",
    sections: [
      {
        heading: "What home emergency insurance actually covers",
        body: `Home emergency policies pay for callout + labour (usually capped at £250-£1,000 per claim) when your home becomes uninhabitable or unsafe due to a covered incident. Typical covered incidents:

<strong>Plumbing + drainage:</strong> Burst pipes, blocked toilets/drains, hot water failure.
<strong>Heating + boiler:</strong> Complete boiler failure, no heating.
<strong>Electrics:</strong> Total power failure, dangerous wiring exposed.
<strong>Roofing:</strong> Storm damage causing internal leaks.
<strong>Security:</strong> Broken door/window locks after break-in.
<strong>Pests:</strong> Wasps + rats (sometimes).`
      },
      {
        heading: "The exclusions — where the fine print bites",
        body: `<strong>Age of appliance.</strong> Most policies exclude boilers over 7-10 years old — the exact age you'd need the cover most. Read the definition of "eligible boiler" carefully.

<strong>Pre-existing conditions.</strong> Any fault that existed before the policy started is excluded. Providers use "reasonably discoverable at the point of policy start" as their test.

<strong>Non-urgent work.</strong> A boiler that "kind of works" won't trigger cover. Cover requires the home to be uninhabitable OR the fault to be unsafe.

<strong>Cosmetic damage.</strong> The leak is covered; the ruined ceiling is on your buildings insurance.

<strong>Repeat callouts on same fault.</strong> Most policies allow 1-3 claims per year, then decline.

<strong>Cost cap.</strong> Once labour + parts exceed the per-claim cap, you pay the excess. Big-ticket repairs (boiler replacement) blow through the cap immediately.`
      },
      {
        heading: "The maths: is it worth it?",
        body: `£15/month = £180/year. Over 5 years = £900.

Callout + first-hour emergency plumber = £75-£150. Boiler service = £75-£130. Even 2 emergency callouts + 5 annual services = £900 out-of-pocket over 5 years — roughly break-even.

<strong>When home emergency insurance is worth it:</strong> Elderly household who can't handle sudden 4am incidents; property let to tenants where you need a rapid response; second homes where you're not on-site to manage.

<strong>When it's not:</strong> You're on-site + comfortable calling a trade directly. In that case, £15/month into a savings pot is genuinely better protection.`
      }
    ],
    faqs: [
      { q: "Does home emergency come with my building insurance?",           a: "Sometimes bundled at renewal — often not. Check your schedule. If it IS bundled, verify the same exclusions apply. If it isn't, buy separately only if you meet one of the 'worth it' criteria above." },
      { q: "Is British Gas HomeCare worth it?",                              a: "Depends on your boiler age + your household. HomeCare's core value is unlimited annual boiler service + priority booking — genuinely useful if you have an old boiler and can't wait 5-10 days for a service in October. Less compelling on a modern warranty-backed boiler." }
    ],
    relatedTrades: ["gas-safe-engineer", "plumber", "electrician", "roofer"],
    relatedArticles: [],
    relatedTools: ["price-index", "check-quote"] as VaultArticle["relatedTools"]
  }
];

export const HUB_FAQS = [
  {
    q: "Who writes the articles in The Vault?",
    a: `${AUTHOR_DEFAULT} — our in-house editorial desk. Every article is cross-checked against the UK Trade Price Index, industry regulator guidance (Gas Safe Register, NICEIC, MCS, RICS), and reviewed quarterly. Every article shows its last-reviewed date.`
  },
  {
    q: "How often is The Vault updated?",
    a: "New articles land weekly during active build. Every existing article is reviewed at least quarterly, or immediately when a regulation or pricing update affects it. Any article referencing pricing is refreshed monthly in sync with the UK Trade Price Index."
  },
  {
    q: "Can I suggest a topic or ask a specific question?",
    a: "Yes — post your question free to The Yard, or check the /answers hub. Popular questions get promoted into full Vault articles."
  }
];
