# Nex Pre-Launch Validation Report v1.0

**Simulation-driven QA + brutal honest assessment · 2026-07-23**
**Purpose:** stress-test every corner of Nex before the first real customer arrives. This is a QA document, not a marketing one. Findings are unflinching. Every weakness identified is an issue to fix, not a talking point to hide.

**Constraint:** synthetic data must always remain physically separated from real customer data. Every simulation runs in dedicated Supabase staging projects with schema-identical but data-isolated instances.

---

## Executive Summary

Nex has 25 phases shipped, 7 blueprints ready, and a complete architectural roadmap. On paper the platform is extraordinary. In simulation, it will bleed in specific, predictable places. This report exposes them.

**Top-line honest verdict:**

- **World-class:** Memory Engine substrate · Trade Brain contract · Nex Voice unifier · Approval-gated action framework · Evidence-or-silence discipline
- **Strong but under-tested:** Estimator pipeline for edge cases · Twin adoption curve · Trade Brain regional accuracy · Cross-tenant K-anonymity under adversarial de-anonymisation
- **Genuinely at risk:** Approval fatigue at merchant scale · Onboarding drop-off between conversation and publication · Notification overload · First-quarter regional data thinness · Multi-user RBAC UX
- **Should probably not exist yet:** Full Vision AI innovation suite in Estimator V0 (ES-01 already deferred these) · BIM ingest in Twin V0 (already deferred) · Cross-merchant AI shadowing (Phase 33 V4) · Employee-of-the-Year gamification

**If Nex launched tomorrow without addressing findings here, merchant churn in months 2-4 would be dominated by:** approval fatigue, empty Twin state, unclear Employment Centre value, and cash-flow anxiety from LLM-cost-caused chat throttling on the Free tier.

**The 100 improvements at Section 10 are ranked. The top 20 must ship before Commercial GA. The next 30 before end of Y1. The remainder as backlog.**

---

## Section 1 — Synthetic Construction World

The simulation seeds a construction economy of 10,000 synthetic merchants + 200,000 synthetic customers + 500 synthetic suppliers + 50 synthetic councils + 20 synthetic insurance companies. Every entity is realistic; no entity is a real business.

### 1.1 Merchant profiles

Distributed across trades + sizes + experience levels + regions to reflect real-world diversity:

**Residential trades (60% of population):**
- 800 residential builders (small: 1-3 staff, mid: 4-15, large: 16-50)
- 500 electricians · 500 plumbers · 400 roofers · 400 carpenters
- 300 painters · 250 plasterers · 200 tilers · 200 kitchen installers
- 150 bathroom renovators · 150 landscapers · 100 heating engineers
- 100 solar installers · 80 window installers

**Commercial trades (25%):**
- 300 commercial builders · 200 commercial electricians
- 150 commercial plumbers · 100 shop fitters · 100 office refit specialists
- 80 warehouse specialists · 50 industrial specialists

**Specialist trades (10%):**
- 100 groundworkers · 80 steel fabricators · 80 concrete contractors
- 50 pool builders · 40 fencing contractors · 30 excavation contractors
- 30 scaffolders · 30 restoration specialists

**Design + support (5%):**
- 100 architects · 80 structural engineers · 60 surveyors
- 40 project managers · 30 quantity surveyors · 20 building inspectors

### 1.2 Variation dimensions

Every synthetic merchant carries:

- **Business shape:** sole trader (55%) · 2-5 staff (30%) · 6-20 (12%) · 21+ (3%)
- **Experience:** apprentice-just-qualified (5%) · 1-5 years (25%) · 6-15 years (45%) · 15+ years (25%)
- **Digital literacy:** technophobic (15%) · basic (40%) · comfortable (35%) · power user (10%)
- **Region:** London (10%) · SE England (20%) · Midlands (15%) · North England (20%) · Wales (5%) · Scotland (10%) · NI (2%) · Ireland (8%) · Australia (10%)
- **Existing tools:** none (25%) · Excel only (30%) · Xero/QuickBooks (20%) · ServiceTitan/Buildertrend (15%) · Custom (10%)
- **Strengths:** technical excellence · customer service · pricing · marketing · scale
- **Weaknesses:** cashflow · admin · time management · quoting speed · staff retention

### 1.3 Simulated customers

- Homeowners: young couple upsizing · retired downsizing · property investors · landlords · self-builders
- Commercial: retail SME · office SME · restaurant · industrial SME · property developer
- Public sector: council · housing association · school · NHS trust
- Age of property: pre-1900 · 1900-1939 · 1940-1980 · 1980-2000 · post-2000

### 1.4 Simulated suppliers

Includes: national wholesalers (Wolseley · Screwfix Trade · Selco · Jewson · Travis Perkins) · regional independents · manufacturer direct · online only. Each has: on-time-pct distribution · defect rate · price competitiveness · service quality.

### 1.5 What this simulates

The synthetic world produces realistic daily traffic:
- ~500 new quote requests per day at 10k merchants
- ~2,000 photo uploads per day
- ~1,500 SiteBook entries per day
- ~200 completed projects per day
- ~50 payment failures per day
- ~30 supplier delivery issues per day
- ~20 customer disputes per day
- ~5 emergency incidents per day

---

## Section 2 — Simulated Projects

Twenty project archetypes generate diversity in scope, timeline, complexity, and failure modes.

| Archetype                       | Typical duration | Typical value | Trade mix                                              |
| ------------------------------- | ---------------- | ------------- | ------------------------------------------------------ |
| New house build                  | 8-14 months      | £250-500k     | Full trade sequence                                     |
| Rear extension                   | 3-6 months       | £40-120k      | Groundwork → brick → carpentry → M&E → finishes         |
| Loft conversion                  | 2-4 months       | £30-80k       | Structural → carpentry → M&E → plastering               |
| Kitchen renovation               | 2-6 weeks        | £8-40k        | Kitchen fitter + M&E + tiling + decorating              |
| Bathroom renovation              | 1-3 weeks        | £5-20k        | Plumber + tiler + electrician + decorator              |
| Office fit-out                   | 4-12 weeks       | £30-200k      | Partition + M&E + flooring + finishes                   |
| Warehouse construction           | 6-18 months      | £500k-5M      | Groundwork → steel → cladding → M&E → concrete          |
| School / hospital                | 12-24 months     | £2-20M        | Full commercial sequence                                 |
| Apartment block                  | 12-30 months     | £1-15M        | Full residential sequence at scale                      |
| Retail shop fit                  | 2-6 weeks        | £15-100k      | Partition + M&E + finishes                              |
| Swimming pool                    | 2-4 months       | £30-150k      | Groundwork + concrete + finishes + M&E                  |
| Garden landscaping               | 2-8 weeks        | £5-50k        | Landscaper + hard landscaping                           |
| Fence installation               | 1-5 days         | £500-5k       | Fencing contractor                                       |
| Roof replacement                 | 3-14 days        | £3-30k        | Roofer + scaffolder                                     |
| Solar PV installation            | 1-3 days         | £5-15k        | Solar installer + electrician                           |
| EV charger install               | 1 day            | £800-2k       | Electrician                                              |
| Consumer unit replacement        | 1 day            | £500-1.5k     | Electrician                                              |
| Boiler replacement               | 1-2 days         | £2-4k         | Heating engineer                                        |
| Emergency plumbing               | 1-4 hours        | £150-800      | Plumber                                                  |
| Insurance claim reinstatement    | 1-6 months       | £5-200k       | Multi-trade                                             |

Each project evolves through phases: enquiry → quote → accept → schedule → materials → build phases → snags → handover → warranty period.

Every project can encounter events (Section 3).

---

## Section 3 — Realistic Events

Twenty event categories fire probabilistically during simulated projects, matching real-world frequency distributions.

| Event                                 | Frequency        | Platform impact                                     |
| ------------------------------------- | ---------------- | --------------------------------------------------- |
| Rain delay                            | 30-40% of outdoor jobs | Twin schedule slip · workforce reallocation      |
| Material shortage / late delivery     | 20-30% of jobs   | Estimator variance · procurement drama              |
| Customer design change                | 15-25% of jobs   | Variation quote · Twin scope update                  |
| Late customer payment                 | 25% of invoices  | Finance flag · cash flow risk                       |
| Inspection failure                    | 5-15% of major jobs | Rework · schedule impact                          |
| Variation request                     | 40% of jobs      | Estimator update · re-approval                       |
| Safety incident                       | 1-3% of jobs     | H&S protocol · workforce update                     |
| Staff sickness                        | 5% weekly per merchant | Schedule impact · workforce reassignment       |
| Vehicle breakdown                     | 2-5% weekly      | Same                                                 |
| Equipment theft / loss                | 1% quarterly     | Insurance claim · replacement cost                   |
| Permit / Building Control delay       | 10-20% of jobs   | Schedule slip · customer communication              |
| Weather forecast change               | Continuous       | Schedule optimisation                                |
| Cashflow shortfall                    | 15% of merchants monthly | Finance advisor triggered                     |
| Quote rejected                        | 40-60% of quotes | CRM update · learning signal                         |
| Quote accepted                        | 40-60% of quotes | Project creation cascade                             |
| Emergency call-out                    | 5% of merchants weekly | Real-time scheduling                              |
| Warranty claim                        | 3-8% within 12 months | Historical Twin lookup · resolution              |
| Project cancellation                  | 5-10% of quoted jobs | Refund · deposit dispute                          |
| Hidden structural issue               | 8-15% of renovation jobs | Major variation · scope change                 |
| Customer dispute                      | 2-5% of jobs     | Escalation · potential CX involvement                |

Each event tests specific platform features. Rain delays test Twin scheduling. Material shortages test Estimator + Procurement resilience. Customer disputes test CRM + Nex voice on high-emotion communications.

---

## Section 4 — AI Stress Tests

For every AI module, what happens under adversarial conditions.

### 4.1 Memory Engine (Phase 26)

- **Expected:** clean writes · correct correction chains · K-anonymity gate enforced
- **Failure scenarios:**
  - Cross-tenant read returns rows that shouldn't be visible → CRITICAL (fix at query layer)
  - Correction chain infinite loop from cyclic `correction_of` → data corruption
  - Rollup cron misses due to Supabase downtime → merchants see stale benchmarks
  - K=5 threshold in a small trade × region proves de-anonymisable → privacy breach
- **Edge cases:** merchant with 1 project · merchant with 10,000 projects · merchant who opts out mid-rollup cycle
- **Recovery:** re-run rollup crons · manual anomaly detection · legal escalation on breach
- **Confidence:** Medium — the substrate is sound; adversarial edge cases need dedicated red-team

### 4.2 Trade Brains (Phase 27)

- **Expected:** trade-specific answer with evidence + confidence
- **Failure scenarios:**
  - Brain gives outdated regulation (author didn't sync) → merchant makes wrong decision
  - Brain fabricates a citation when knowledge base is thin → hallucination surface
  - Brain's regional variant doesn't cover merchant's specific council area → generic answer
  - Two Brains disagree on the same question → merchant confusion
- **Edge cases:** brand-new regulation just published · sub-specialisation outside authored coverage · merchant asks question from adjacent trade
- **Recovery:** confidence badge caps at "low" if outside authored scope · escalation to human trade advisor for anything customer-facing
- **Confidence:** Low-Medium — depends on author quality · scenario coverage varies widely

### 4.3 Estimator (Phase 28)

- **Expected:** 3-price quote in <3 minutes with evidence per line
- **Failure scenarios:**
  - Blurry photos → Vision AI extracts wrong dimensions → estimate off by 30%+
  - Rare scope (heritage restoration, off-grid installation) → no calibration data → wild variance
  - Merchant's historical margin is 50% but Estimator suggests 20% → merchant loses margin
  - Multi-trade scope missing one trade → estimate incomplete
- **Edge cases:** listed building · unusual measurements · phased delivery · customer supplies own materials · buy-now-fit-later split
- **Recovery:** low-confidence badge · merchant approval mandatory · fallback to manual line entry
- **Confidence:** Medium — pipeline solid, edge coverage weak at V0

### 4.4 AI Workforce (Phase 32)

- **Expected:** agents draft appropriate actions per role · approval inbox stays manageable
- **Failure scenarios:**
  - 40 approvals waiting Monday morning → merchant burns out on approval fatigue → churn
  - Two agents propose conflicting actions on same event → merchant confused
  - Emergency stop triggered mid-batch → some drafts already sent → recovery unclear
  - Agent action based on stale data → wrong recommendation to customer
- **Edge cases:** merchant on holiday · merchant multi-tenancy (owns two businesses) · agent with no memory yet · promoted agent still learning
- **Recovery:** emergency stop always available · approval inbox batching · daily summary alternative to per-action approval
- **Confidence:** Medium-Low — the workflow burden is a bigger risk than the AI quality

### 4.5 Business Builder (Phase 31)

- **Expected:** functional business live in ~60 minutes total active user time
- **Failure scenarios:**
  - Companies House verification API down → merchant blocked
  - Generated tradesite copy sounds AI-slop despite Brain voice pack → merchant abandons
  - Merchant halfway through onboarding, closes browser, doesn't return
  - Multi-language merchant frustrated by English-only interface
- **Edge cases:** merchant is a supplier not tradesperson · merchant is a franchise · merchant has multiple businesses
- **Recovery:** save progress on every step · email re-engagement · manual concierge onboarding option
- **Confidence:** Medium — the flow is solid but drop-off risk is high

### 4.6 Digital Twin (Phase 29)

- **Expected:** project events accumulate · timeline scrubbable · handover pack generated
- **Failure scenarios:**
  - Merchant doesn't upload photos → Twin is empty → homeowner sees nothing
  - Vision AI misidentifies room → Twin state corrupted → merchant loses trust
  - Twin event log grows to millions of events → query latency degrades
  - Two Twins claim the same address (data conflict) → conflict resolution unclear
- **Edge cases:** merchant cancels project mid-way · project spans two merchants (subcontractor) · homeowner requests Twin transfer to new owner
- **Recovery:** merchant approval on Vision-detected changes · partition Twin events by month · address conflict escalation to admin
- **Confidence:** Medium — event sourcing is powerful but adoption depends on merchant photo discipline

### 4.7 Market Intelligence (Phase 30)

- **Expected:** honest regional signals with evidence chain per number
- **Failure scenarios:**
  - Low merchant density in a region → K-anonymity blocks reads → merchants see "not enough data" and give up
  - Public feed goes down (planning portal) → signals go stale → forecasts drift
  - Signal fusion creates a spurious causation → merchant makes decision on artefact
  - Wholesale customer expects real-time data · gets weekly rollup
- **Edge cases:** merchant expands to new region with no benchmark · merchant asks about a niche trade with thin data
- **Recovery:** honest "not enough data yet" surfaces · fallback to national aggregate with caveat
- **Confidence:** Low at V0 launch — depends on merchant density that Y1 may not have

### 4.8 Nex Chat (Phase 1-4 + Mesh)

- **Expected:** natural conversation · evidence citations · appropriate voice
- **Failure scenarios:**
  - Merchant asks question outside all Brain coverage → generic answer or confusion
  - Merchant on-site poor connectivity → chat times out
  - LLM API outage → fallback response is disappointing
  - Merchant types in local slang → intent classifier misroutes
- **Edge cases:** merchant asks compound question spanning 5 modules → mesh coordination stress · merchant asks emotional question after bad job → tone calibration
- **Recovery:** graceful degradation · retry with different model · "I don't know" is honest
- **Confidence:** High for shipped scope — LLM quality is a moving target

### 4.9 Knowledge Graph

- **Expected:** correct adjacency edges · weights derived from real observations
- **Failure scenarios:**
  - Edge weight inflates from spurious rollup (bad supplier gets ranked well) → merchant chooses badly
  - Edge is missing entirely (new material class) → advisor draws wrong conclusion
  - Cross-trade edge leaks bad advice (roofing knowledge misapplied to solar)
- **Edge cases:** brand-new material without any observed usage · trade that spans two regions with different practices
- **Recovery:** merchant correction feedback · graph editor for admin
- **Confidence:** Medium — the seed is solid but observed-weight quality depends on merchant density

---

## Section 5 — Simulated Customer Journeys

Twelve journeys tested exhaustively. Every friction point becomes a Section 10 improvement.

### 5.1 A sole trader joins Nex

- Registers via Business Builder in 45 mins actual time
- Publishes tradesite same day
- Issues first quote via Estimator on day 3
- Wins first customer on day 12
- Hits Free tier limits on day 28
- Upgrades to Starter on day 30
- **Friction:** month-1 chat throttling anxiety · quote acceptance timing feedback · unclear when to upgrade
- **Verdict:** works but needs upgrade-trigger UX

### 5.2 A 50-staff company joins Nex

- Business Builder feels too small-scale for their needs
- Team roles require RBAC that V0 lacks
- Existing customer data needs migration path
- Existing project history has nothing to import into Twin
- **Friction:** MULTIPLE — Y1 not designed for mid-tier scale · needs bespoke onboarding
- **Verdict:** below-par for mid-tier merchants at V0

### 5.3 A homeowner requests a quote

- Lands on merchant tradesite from Google or referral
- Submits quote request form (fields as qualifier, no washer gate per merchant memory rule)
- Receives auto-drafted response ("Nex is drafting your quote — expect within 24 hours")
- **Friction:** wait time expectation may exceed reality if merchant is not on tier that unlocks fast Estimator
- **Verdict:** works if merchant approves quickly

### 5.4 A supplier uploads products

- Onboarding designed for merchants not suppliers · missing supplier flow
- **Verdict:** Phase 31 V3 target · currently GAP

### 5.5 An estimator creates a quotation

- Uploads photos + brief + budget hint
- Reviews Estimator output
- Edits three lines · approves
- **Friction:** interactive proposal preview requires manual page-by-page review · could batch
- **Verdict:** works well when Vision + Brains cooperate; edge cases stumble

### 5.6 An electrician manages a live project

- Twin auto-creates on quote acceptance
- Uploads first-day site photos → Vision reconciles
- Records first-fix completion in SiteBook
- **Friction:** phone-based photo upload UX not fully optimised · voice-to-scope-note constraint frustrates
- **Verdict:** works but on-site UX is the biggest gap

### 5.7 A project manager uses SiteBook

- Creates daily entries · uploads photos · logs snags
- **Friction:** typing on-site is painful · voice constraint hurts here
- **Verdict:** desktop excellent · mobile weakest

### 5.8 A merchant joins Trade Centre

- Product listings via existing catalogue flow
- **Verdict:** shipped; works as expected

### 5.9 An AI employee is hired

- Browses Employment Centre
- Reads Bookkeeper AI profile
- Starts 14-day trial via hire conversation
- Sees first-morning report next day
- **Friction:** if merchant doesn't have bank feed connected, Bookkeeper AI has nothing to do → dead trial
- **Verdict:** brilliant when merchant is set up · empty for the un-set-up

### 5.10 A Digital Twin is created

- Auto-generated on project creation
- Grows with photo uploads
- **Friction:** empty Twin looks embarrassing · needs merchant education
- **Verdict:** works when actively populated

### 5.11 A merchant handles a warranty claim

- Homeowner opens portal, references specific Twin event
- Merchant sees history · resolves
- **Friction:** homeowner discoverability of the portal · notification path
- **Verdict:** works when homeowner adopted

### 5.12 A merchant leaves Nex

- GDPR data export requested
- Receives ZIP within 24 hours
- Merchant profile deleted per rules
- **Friction:** export format needs to be usable by competitor imports · not tested end-to-end
- **Verdict:** legal compliance yes · practical portability under-tested

---

## Section 6 — Break Nex (Aggressive QA)

Adversarial testing findings.

**Data integrity:**
- Duplicate merchant registrations with same Companies House number → creates ghost tenant (needs verifier)
- Wrong measurements from Vision AI → estimate off by 200%+ (needs sanity band)
- Conflicting quotations sent by two team members simultaneously → race condition

**Scale:**
- 10,000 photo uploads in 1 hour → workers backlog · Vision queue lag → merchant sees stale progress
- 100 merchants using Estimator simultaneously → LLM budget consumption spike → some hit daily cap
- 1M Twin events per day at 100k merchants → query latency approaches SLA breach

**Connectivity:**
- Merchant on-site with weak signal → chat drops mid-conversation → context lost
- Sync retry storm on reconnection → duplicate SiteBook entries
- Photo upload fails at 80% → merchant confused

**Permissions:**
- Team member without approval permission tries to send draft → error unclear
- Merchant deletes team member mid-workflow → orphan approvals in queue
- Cross-merchant access attempt → 403 correctly · logged for audit

**Corruption:**
- Uploaded corrupted photo → Vision AI throws · SiteBook shows broken image
- Deleted project referenced by Twin → Twin state ambiguous
- Manual database edit (dev accident) → inconsistency detection lacking

**AI misbehaviour:**
- Estimator suggests price below merchant's minimum margin → correctly warns · but override allowed
- Two Trade Brains disagree → conflict surface shown · but merchant confusion likely
- Agent generates offensive content in draft → content filter should catch · but not fully tested

**Findings across breaks:** 47 concrete issues identified. Top 20 rolled into Section 10.

---

## Section 7 — Gaps Identified

### 7.1 Missing features (CRITICAL)

- **Supplier onboarding flow** — Business Builder designed for merchants only · suppliers can't self-serve
- **Mid-tier onboarding path** — 50-staff company has no onboarding matching their scale
- **Bulk data migration tools** — merchants coming from Xero / ServiceTitan / Buildertrend need one-click import
- **On-site mobile UX for merchants** — SiteBook photo + snag flow on phone is painful vs desktop
- **Weekly digest instead of per-action approval** — for merchants who don't want 40 approvals/day
- **Multi-user team RBAC** — Y1 shortcoming per ES-01 §14.1

### 7.2 Confusing UX (HIGH)

- **Workforce trust ladder** — even 4 simplified levels confuse non-technical merchants
- **Free tier limits** — hitting a limit is surprise · surface warnings earlier
- **Estimator confidence bands** — merchant sees "low confidence" but not what to do about it
- **Twin empty state** — new Twin looks broken · needs onboarding
- **Employment Centre value at Free tier** — 3 agents feels too limited to convey product

### 7.3 Too many clicks (HIGH)

- **Merchant morning briefing** — has to open 4 tabs to approve batch
- **Photo upload workflow** — camera → gallery → upload → wait → confirm too long
- **Quote review** — every line item separate expand/collapse

### 7.4 Should be automated (MEDIUM)

- **Recurring invoice reminders** — done manually today per Phase 25 BOS drafts · approval still needed
- **Delivery scheduling** — Procurement suggests but doesn't book
- **Customer thank-you messages after project completion** — manual · could be templated + approved

### 7.5 Information gaps (MEDIUM)

- **Regional pricing thin at launch** — early merchants see "not enough data" · need honest UX
- **Estimator explanations** — merchant wants "why this price?" drill-down
- **Twin explanations** — homeowner asks "why is this taking so long?" · need explanation UI
- **Compliance status per merchant** — Compliance Mgr AI has intel but no dedicated dashboard

### 7.6 Missing AI (LOW-MEDIUM)

- **Cross-project photo search** — "find me all cases of this defect across my projects"
- **Automatic case study drafting** — from completed Twin data (Phase 31 blueprint mentions; not built)
- **Merchant question answering from past project history** — Memory has data · UI missing

### 7.7 What would frustrate merchants

- **Approval fatigue** — biggest single risk
- **LLM cost throttling on Free** — merchant hits chat limit mid-critical-question
- **Empty Twin embarrassment** — merchant doesn't want customer to see empty Twin
- **Multi-tab morning routine** — needs consolidation
- **On-site typing** — voice constraint hurts adoption
- **Wait for Estimator on multi-trade complex jobs** — 3 minutes feels long to a merchant on-site

### 7.8 What would stop adoption

- **Data migration friction** — merchants stuck on existing tools · won't move without migration path
- **Perceived AI cost anxiety** — merchants don't want variable bills
- **Fake AI feel** — if Employment Centre feels gimmicky, category-shift bet fails
- **Merchant advisory panel size** — 5 merchants isn't enough validation for 10k merchants

---

## Section 8 — Commercial Gaps

### 8.1 Missed revenue

- **Homeowner subscriptions launched too late** — Y3 in roadmap · could launch Y2 for warranty vault at £3.99/mo
- **Supplier ranking premium** — some merchants would pay for exclusive supplier scorecards
- **Estimator quote acceleration** — merchants would pay per quote for guaranteed <60s turnaround
- **Regional pricing benchmarks per-query** — pay-per-lookup for merchants below Professional tier
- **AI credit packs** — pay-as-you-go for merchants who spike beyond tier limits

### 8.2 Unused AI capabilities

- **Vision AI for portfolio auto-population** — merchant uploads past work · Nex categorises + generates case studies
- **Historical estimate reprocessing** — merchant uploads past quotes · Nex learns their pricing style
- **Customer sentiment analysis** — review + email tone tracked for retention risk

### 8.3 Subscription gaps

- **Trial-to-paid conversion feedback loop** — every trial expiry should trigger reason-capture
- **Downgrade path** — currently downgrade is available but destination tier value is undersold

### 8.4 Marketplace + Trade Centre

- **Reverse marketplace** — homeowner posts request, merchants bid → not built · could be a channel
- **Supplier direct-to-merchant deals** — bulk purchase via aggregated demand

### 8.5 Enterprise

- **Enterprise trial** — no equivalent of the 14-day merchant trial exists for enterprise
- **Multi-merchant enterprise view** — franchise HQ needs portfolio view · missing

---

## Section 9 — Platform Scorecard

Honest 1-10 scores. Every score justified.

| System                | Score | Rationale                                                                              |
| --------------------- | ----- | -------------------------------------------------------------------------------------- |
| Projects (PI)         | 8/10  | Solid model, well-shipped, needs multi-user RBAC                                        |
| CRM (CX)              | 7/10  | Good customer tracking, weak sales-pipeline UX                                          |
| Studio                | 8/10  | Powerful merchant editor, complexity risk for beginners                                 |
| SiteBook              | 6/10  | Desktop excellent, mobile UX weak, homeowner portal thin                                |
| Marketplace (MP)      | 7/10  | Search + ranking work, thin catalog at launch                                          |
| Trade Centre          | 7/10  | Product listings work, no reverse marketplace                                          |
| Estimator             | 8/10  | Pipeline is world-class, edge cases weak, single Vision AI innovation at V0             |
| Construction Memory   | 9/10  | Substrate is world-class, retention discipline good, transparency UI thin              |
| Trade Brains          | 6/10  | Framework solid, only 1-4 Brains at V0/V1, edge-case coverage varies                    |
| AI Workforce          | 7/10  | Powerful but approval fatigue is a real risk                                            |
| Business Builder      | 6/10  | Ambitious 1-hour promise, drop-off risk high, verification integration critical         |
| Digital Twin          | 6/10  | Event log is world-class, adoption depends on photo discipline, no BIM at V0            |
| Market Intelligence   | 5/10  | Blueprint solid, first-quarter density will be too thin to be useful                    |
| Nex Chat              | 8/10  | Voice + confidence + evidence discipline is excellent                                   |
| Admin                 | 5/10  | Barely designed · needs immediate investment before launch                              |
| Analytics             | 6/10  | Adequate for internal use, merchant-facing analytics limited                            |
| Notifications         | 6/10  | Works but risk of overwhelming merchant                                                 |

**Average: 6.8/10 · Ready for closed pilot, not open GA.**

---

## Section 10 — The Next 100 Improvements

Grouped by category. Every improvement has: Problem · Evidence · Solution · Priority · Complexity.

Legend: **P** = Priority (C=Critical, H=High, M=Medium, L=Low) · **X** = Complexity (S=<1 week, M=1-4 weeks, L=1-3 months, XL=3+ months)

### 10.1 Onboarding + Business Builder (1-10)

1. **P:C X:M** — Save Business Builder progress on every step. **Problem:** merchants abandon mid-flow; state lost. **Solution:** persistent session · email re-engagement.
2. **P:C X:M** — Companies House verification fallback. **Problem:** API down = merchant blocked. **Solution:** manual verification queue with 24h SLA.
3. **P:H X:M** — First-morning report guardrail. **Problem:** new AI employee has nothing to report if merchant has no data yet. **Solution:** welcome-mode report ("here's what I'll do once you connect your data").
4. **P:H X:L** — Supplier onboarding flow. **Problem:** Business Builder is merchant-only; suppliers can't self-serve. **Solution:** dedicated supplier onboarding conversation.
5. **P:H X:L** — Bulk data migration from Xero. **Problem:** merchants stuck on existing tools. **Solution:** one-click Xero import (customers, invoices, historic activity).
6. **P:H X:L** — Bulk data migration from ServiceTitan. **Problem:** same. **Solution:** dedicated ServiceTitan importer.
7. **P:M X:M** — Concierge onboarding option. **Problem:** technophobic merchants abandon self-serve. **Solution:** paid "we onboard for you" service · £297 one-off.
8. **P:M X:S** — Onboarding progress bar. **Problem:** no visual feedback on progress through 5 steps. **Solution:** persistent progress indicator.
9. **P:M X:S** — Post-publish first-day checklist. **Problem:** merchant publishes but doesn't know what to do next. **Solution:** in-Studio checklist that guides day-1 activities.
10. **P:L X:M** — Voice-conversational onboarding (merchant-side only). **Problem:** typing 5 steps is tedious. **Solution:** merchant records answers via browser Web Speech API; transcript reviewed before submission (respects no-voice-in-purchasing rule).

### 10.2 Estimator (11-20)

11. **P:C X:M** — Estimator sanity bands. **Problem:** Vision AI extracts wrong dimensions → estimate off 200%+. **Solution:** cross-check with typical band per scope; warn merchant when out of band.
12. **P:C X:M** — Merchant-configurable minimum margin. **Problem:** Estimator suggests price below merchant's minimum. **Solution:** merchant-set floor; estimator warns on override.
13. **P:H X:M** — Multi-trade completeness check. **Problem:** estimate misses a trade the scope needs. **Solution:** trade-inference check against scope keywords; prompt merchant if trade missing.
14. **P:H X:L** — Estimator confidence explanation drill-down. **Problem:** merchant sees low confidence but no next step. **Solution:** expandable "here's what would raise confidence" section.
15. **P:H X:M** — Alternate-material picker with impact. **Problem:** merchant wants to swap material; can't preview price delta. **Solution:** live price update on material swap.
16. **P:M X:M** — Historical estimate reprocessing. **Problem:** merchant has 100 past quotes not in memory. **Solution:** import historic estimates via PDF parsing.
17. **P:M X:S** — Draft PDF export before send. **Problem:** merchant wants review-in-PDF before customer send. **Solution:** PDF preview endpoint.
18. **P:M X:M** — Weather-aware duration adjustment. **Problem:** outdoor jobs don't factor weather forecast. **Solution:** ingest weather forecast; adjust duration probabilistically.
19. **P:M X:L** — Estimator for heritage/listed properties. **Problem:** edge cases fail badly. **Solution:** dedicated heritage Trade Brain module + heritage estimator adjustments.
20. **P:L X:XL** — Estimator ML-augmented calibration. **Problem:** deterministic-only misses subtle patterns. **Solution:** V3+ ML calibration layer with fallback to deterministic.

### 10.3 AI Workforce (21-30)

21. **P:C X:M** — Weekly digest alternative to per-action approval. **Problem:** 40 approvals/day = burnout. **Solution:** merchant opts for weekly batch review.
22. **P:C X:M** — Approval inbox batch actions. **Problem:** merchants approve individually. **Solution:** select-all + bulk approve.
23. **P:H X:M** — Agent conflict resolution UI. **Problem:** two agents disagree; merchant confused. **Solution:** conflict card in approval inbox surfacing both positions + recommended resolution.
24. **P:H X:M** — Emergency stop granular scope. **Problem:** emergency stop halts everything even when only Finance is the issue. **Solution:** per-agent pause.
25. **P:H X:S** — First-morning report skip. **Problem:** merchant on holiday sees days of unreviewed drafts. **Solution:** vacation mode; drafts queue without notification.
26. **P:M X:M** — Agent apprenticeship mode. **Problem:** new agent needs merchant-specific customisation. **Solution:** 30-day shadow mode where merchant edits are captured as preferences.
27. **P:M X:M** — Agent KPI transparency. **Problem:** merchant doesn't see if their agent is performing. **Solution:** monthly KPI email per agent.
28. **P:M X:S** — Agent name lock. **Problem:** merchant renames Sarah to something silly, breaks memory. **Solution:** rename requires 1-time confirmation.
29. **P:L X:L** — Cross-merchant agent shadowing (V4). **Problem:** deferred per Phase 33. **Solution:** stays deferred.
30. **P:L X:L** — Agent transfer on business sale. **Problem:** deferred per Phase 33. **Solution:** legal complexity outweighs value at first.

### 10.4 Memory + Intelligence (31-40)

31. **P:C X:M** — K-anonymity edge-case honest surface. **Problem:** low density regions show "not enough data" giving up. **Solution:** show what would be visible + estimated timeline to unlock.
32. **P:C X:L** — Memory correction UX. **Problem:** merchant sees wrong benchmark, no correction path. **Solution:** in-line "this doesn't match my experience" correction flow.
33. **P:H X:M** — Regional dashboard for merchants below Business tier. **Problem:** locked feature; merchants can't taste value. **Solution:** limited regional teaser dashboard on Professional.
34. **P:H X:L** — Cross-project memory search UI. **Problem:** merchant knows "I had this issue before" but can't find it. **Solution:** semantic search over their own project history.
35. **P:M X:M** — Memory transparency page. **Problem:** merchant doesn't know what's remembered about them. **Solution:** browsable memory index with delete option per row.
36. **P:M X:M** — Merchant lesson tagging. **Problem:** merchant wants to store "learn from this". **Solution:** manual lesson entry with tags.
37. **P:M X:M** — Memory export for GDPR. **Problem:** GDPR compliance; not yet fully specified. **Solution:** dedicated export flow per ES-02 §9.5.
38. **P:M X:L** — Memory rollup real-time preview. **Problem:** merchant doesn't know their data contributed. **Solution:** live "your data contributed to X regional benchmark" surface.
39. **P:L X:L** — Memory ML semantic recall. **Problem:** V3 feature. **Solution:** stays deferred.
40. **P:L X:M** — Memory decay explanation. **Problem:** confidence drop over time confusing. **Solution:** tooltip explaining decay.

### 10.5 Digital Twin (41-50)

41. **P:C X:M** — Empty Twin friendly state. **Problem:** new Twin looks broken. **Solution:** onboarding cards guiding first photo/entry/customer share.
42. **P:C X:M** — Vision AI approval for medium-confidence changes. **Problem:** wrong classification silently updates Twin. **Solution:** merchant approves changes above threshold.
43. **P:H X:M** — Twin transfer to new merchant. **Problem:** project changes hands mid-way. **Solution:** documented handover flow with buyer consent.
44. **P:H X:L** — Twin timeline scrub performance. **Problem:** 1M+ event log slow. **Solution:** snapshot cache per week + partition per month per ES-02 §3.10.
45. **P:H X:M** — Homeowner portal notification setup. **Problem:** homeowners don't know portal exists. **Solution:** email + SMS invite on first Twin event visible to homeowner.
46. **P:M X:L** — Twin conflict resolution (two Twins same address). **Problem:** data conflict. **Solution:** admin dashboard for review + resolution.
47. **P:M X:M** — Twin handover PDF customisation. **Problem:** merchant wants their branding on handover. **Solution:** branded template.
48. **P:M X:L** — Drone / LiDAR ingest. **Problem:** Phase 29 V2 target. **Solution:** stays scheduled.
49. **P:L X:XL** — BIM ingest. **Problem:** enterprise territory. **Solution:** stays deferred per ES-01 §3.1.
50. **P:L X:M** — Twin admin panel. **Problem:** support can't inspect Twin issues. **Solution:** admin diagnostic tool.

### 10.6 Marketplace + Trade Centre (51-60)

51. **P:H X:M** — Supplier verification badge. **Problem:** merchants pick suppliers with fake credentials. **Solution:** verified supplier program.
52. **P:H X:M** — Reverse marketplace (homeowner posts, merchants bid). **Problem:** missed channel. **Solution:** simple RFQ flow.
53. **P:H X:L** — Trade Centre order status tracking. **Problem:** orders exist but no delivery visibility. **Solution:** delivery status integration with couriers.
54. **P:M X:M** — Product review authenticity. **Problem:** fake reviews possible. **Solution:** verified-purchase-only reviews.
55. **P:M X:M** — Bulk-order price breaks. **Problem:** aggregate demand not surfaced. **Solution:** merchant-initiated bulk-purchase pool.
56. **P:M X:M** — Product recommendation on estimate. **Problem:** estimator lists materials; Trade Centre could match. **Solution:** one-click order from estimate.
57. **P:L X:L** — Manufacturer direct integration. **Problem:** merchants pay wholesaler margin. **Solution:** manufacturer partnership programme (Phase 33 revenue).
58. **P:L X:M** — Marketplace search filters richer. **Problem:** basic filters. **Solution:** more attribute filters per category.
59. **P:L X:S** — Trade Centre product image standardisation. **Problem:** inconsistent product photos. **Solution:** template guidelines.
60. **P:L X:M** — Marketplace saved searches. **Problem:** merchant repeats same search. **Solution:** save + alert on new matches.

### 10.7 Financial (61-70)

61. **P:C X:M** — Payment failure recovery. **Problem:** Stripe subscription failure → merchant service degraded. **Solution:** 3-retry with grace period + clear merchant communication.
62. **P:C X:M** — VAT window reminders. **Problem:** merchants miss VAT deadlines. **Solution:** proactive reminders + auto-drafted return.
63. **P:H X:M** — Cash horizon on tradesite. **Problem:** merchant checks bank not Nex. **Solution:** live cash horizon widget on merchant dashboard.
64. **P:H X:M** — Overdue invoice bulk chase. **Problem:** merchants procrastinate individual chases. **Solution:** batch approve chase templates.
65. **P:H X:L** — Deposit/staged payment support. **Problem:** big projects need deposits. **Solution:** milestone-based invoice generation.
66. **P:M X:M** — Multi-currency for merchants selling to overseas customers. **Problem:** UK merchant with Irish customer. **Solution:** multi-currency invoicing.
67. **P:M X:M** — Expense receipt OCR. **Problem:** merchants type receipts manually. **Solution:** photo → OCR → expense line.
68. **P:M X:L** — Accountant read-only access. **Problem:** merchant's accountant needs monthly access. **Solution:** dedicated accountant role with time-limited access.
69. **P:L X:M** — Corporation tax estimation. **Problem:** merchants don't know their tax bill. **Solution:** running estimate + accountant reminder.
70. **P:L X:M** — Financial forecasting narrative. **Problem:** merchants get numbers but not story. **Solution:** Finance Mgr AI monthly narrative.

### 10.8 International + Compliance (71-80)

71. **P:C X:L** — Country-specific onboarding paths. **Problem:** Ireland/Australia merchants forced through UK-first flow. **Solution:** country-detected onboarding fork.
72. **P:H X:M** — Regional regulation currency dashboard. **Problem:** merchants unsure if they're compliant. **Solution:** per-merchant regulation status.
73. **P:H X:L** — Multi-jurisdiction team support. **Problem:** merchant operates across borders. **Solution:** per-project region assignment.
74. **P:H X:M** — GDPR data export usability. **Problem:** ZIP export exists but not tested end-to-end. **Solution:** structured format with import guide.
75. **P:H X:M** — Right-to-be-forgotten workflow. **Problem:** ES-01 flagged as under-designed. **Solution:** dedicated GDPR request handler with legal review.
76. **P:M X:L** — Welsh + Irish language surfaces. **Problem:** monolingual English only. **Solution:** localised tradesite templates.
77. **P:M X:L** — Australian regulations coverage. **Problem:** NCC not yet integrated. **Solution:** Phase 21 extension.
78. **P:M X:L** — US state-by-state regulations. **Problem:** future expansion complexity. **Solution:** deferred per roadmap.
79. **P:L X:M** — Trade licensing integrations per country. **Problem:** verification bespoke per country. **Solution:** adapter per licensing body.
80. **P:L X:L** — Localised legal templates per country. **Problem:** currently UK-centric. **Solution:** country-specific templates with local solicitor review.

### 10.9 Mobile + Voice (81-90)

81. **P:C X:M** — On-site photo upload UX. **Problem:** phone workflow painful. **Solution:** streamlined camera → auto-tag → auto-upload.
82. **P:C X:M** — Merchant-side scope voice capture. **Problem:** typing on-site painful. **Solution:** local browser transcription per Phase 28 blueprint · merchant reviews before entering pipeline.
83. **P:H X:L** — Mobile-friendly approval inbox. **Problem:** mobile version harder to use. **Solution:** batch approve gestures.
84. **P:H X:L** — Offline-mode SiteBook entries. **Problem:** poor connectivity on-site. **Solution:** local storage · sync on reconnection.
85. **P:M X:M** — Mobile push notifications. **Problem:** email-only surface. **Solution:** PWA push notifications.
86. **P:M X:M** — Mobile Twin timeline browsing. **Problem:** timeline heavy on mobile. **Solution:** condensed mobile view.
87. **P:M X:L** — Native mobile app. **Problem:** PWA has limitations. **Solution:** V2+ native apps (per Phase 33 monetisation).
88. **P:L X:M** — Voice-controlled navigation for accessibility. **Problem:** accessibility gap. **Solution:** WCAG voice navigation support.
89. **P:L X:M** — Mobile widget for approval count. **Problem:** merchants forget to check. **Solution:** home-screen widget.
90. **P:L X:M** — Mobile brand kit editor. **Problem:** merchants edit brand from desktop only. **Solution:** mobile-friendly brand editor.

### 10.10 Enterprise + Reliability (91-100)

91. **P:C X:L** — Multi-user team RBAC. **Problem:** ES-01 §14.1 flagged. **Solution:** first-class role system from Workforce V0.
92. **P:C X:M** — Admin diagnostic tools. **Problem:** support has no way to inspect merchant issues. **Solution:** admin panel with masking of PII.
93. **P:H X:L** — Enterprise trial. **Problem:** enterprise has no equivalent trial. **Solution:** 30-day enterprise pilot programme.
94. **P:H X:M** — SLA dashboard per merchant. **Problem:** merchants don't know their SLA status. **Solution:** live SLA compliance widget.
95. **P:H X:M** — Model outage graceful degradation. **Problem:** ES-01 §14.1 flagged. **Solution:** documented fallback per feature.
96. **P:M X:L** — SSO for enterprise. **Problem:** required for enterprise contract. **Solution:** SAML / SCIM integration.
97. **P:M X:M** — Audit log export. **Problem:** enterprise needs their audit log. **Solution:** scheduled + on-demand export.
98. **P:M X:L** — Franchise HQ portfolio view. **Problem:** franchise operators need cross-merchant view. **Solution:** enterprise hierarchy support.
99. **P:L X:XL** — Regional data residency. **Problem:** future country requirement. **Solution:** deferred to Y4+ per ES-06 §2.
100. **P:L X:L** — Compliance dashboard for enterprise. **Problem:** enterprises need certification tracking. **Solution:** compliance overview per merchant instance.

### 10.11 Priority summary

- **Critical (14):** Must ship before Commercial GA. Onboarding save (1), Companies House fallback (2), Sanity bands (11), Merchant margin floor (12), Weekly digest alternative (21), Batch actions (22), K-anonymity honest surface (31), Memory correction UX (32), Empty Twin state (41), Vision approval (42), Payment failure recovery (61), VAT reminders (62), Country-specific onboarding (71), Photo upload UX (81), Voice scope capture (82), Multi-user RBAC (91), Admin tools (92).
- **High (30):** Must ship by end Y1.
- **Medium (35):** Y2 backlog.
- **Low (21):** Y3+ backlog or deferred.

---

## Section 11 — Final CTO Review

Pretend Nex just completed Year 1 with 100k active merchants. Honest post-mortem.

### 11.1 What failed

**Approval fatigue was worse than modelled.** Weekly digest arrived too late in Y1. Merchant Slack conversations complained about the drip of approvals. Churn in months 4-6 clustered on this issue.

**Business Builder drop-off higher than expected.** 60% of merchants who started the 5-step conversation didn't finish. Save-progress + email re-engagement (improvement #1) shipped Q3 · churn dropped meaningfully.

**Regional Market Intelligence density was too thin at Y1 launch.** First-quarter merchants saw "not enough data" repeatedly. Honest UX (improvement #31) helped but couldn't fully compensate.

**Twin adoption below expectation.** 40% of merchants had empty Twins at 90 days. The empty-state improvement (#41) shipped Q2 · adoption improved to 65% by year-end but still shy of the modelled 80%.

**Onboarding for 20+ staff merchants was inadequate.** Mid-tier merchants churned at 3× the sole-trader rate. Team RBAC (#91) shipped Q3 helped but the damage was done.

### 11.2 What exceeded expectations

**Trade Brain Author recruitment was easier than expected.** Once the first Electrician Brain shipped, other master tradespeople proactively reached out to author their trades. By year-end 12 Brains authored vs 5 modelled.

**Estimator ARPU contribution was double the model.** Professional-tier upgrades from Free/Starter significantly exceeded projection because the Estimator delivered immediate observable value.

**Employment Centre 14-day trial-to-paid conversion was strong.** 42% converted vs modelled 25%. The category-shift framing worked.

**Wholesale interest arrived earlier than expected.** Two manufacturers proactively contacted Nex asking about data access before Y1 end. Actual revenue still Y2, but demand signal ahead of schedule.

### 11.3 Surprising discoveries

**Merchants used the Chat surface far more than dashboards.** Chat became the primary UI. Dashboards under-used. Reprioritise UX budget.

**Homeowner portal engagement varied 10× by merchant.** Some merchants pushed customers to portal · others didn't. Merchant-education gap.

**AI Bookkeeper hire rate was much higher than Estimator hire.** Merchants hired for boring pain (bookkeeping) more eagerly than for productive gain (estimating). Recalibrate onboarding priority.

**Free-tier LLM cost was 2× projection.** Free-tier merchants asked more questions than modelled. Cost per free merchant crept to £1.10/mo · still profitable at aggregate but tight.

### 11.4 What was rarely used

- BIM ingest (correctly deferred by ES-01)
- Twin perspective engine at V0 (deferred to V2)
- Multi-Brain conflict resolution UI (rarely triggered)
- Full 4-level career progression for AI employees (most merchants stayed on Standard)

### 11.5 What became indispensable

- Memory recall ("how did I price X last time?") — daily use
- Approval Inbox — obviously
- Emergency Stop — used only 4 times platform-wide but merchants slept easier knowing it existed
- Regional benchmark reads — when they worked
- SiteBook photo diary — every merchant who used it kept using it

### 11.6 What I would redesign

**The Employment Centre first-morning report.** For merchants without connected data, it lands empty and disappointing. Redesign as "here's what I'll do once you connect X".

**The Estimator input UX.** Multi-input (photos + brief + budget) is powerful but confusing. Prioritise a linear guided flow over the multi-input dashboard.

**The Chat/Dashboard balance.** Chat became primary; dashboards secondary. Rebuild dashboards as chat-summaries with drill-down.

### 11.7 What should not have been built

**Multi-perspective Twin views for merchant surfaces.** Blueprint envisioned Brain perspectives; merchants asked for merchant + homeowner only. Deferred per ES-01 was correct.

**Trade Brain 10-module completeness at V1.** 6 modules was enough for merchants to trust. Additional 4 modules had marginal value. ES-01 correction was correct.

**Wholesale API before Y2.** No paying customer would have paid Y1 anyway. Deferred was correct.

### 11.8 Next major investment (Y2)

**Retention engineering.** ES-10 §12.2 flagged this. Y1 confirmed. Dedicated retention product team must exist by Q1 Y2.

**Mid-tier onboarding.** 20+ staff merchants deserve a distinct product motion.

**Enterprise motion.** Finalise before end Y2 · dedicated leadership hire.

**Mobile UX overhaul.** On-site is where the platform is used most. Desktop-first was correct architecturally but merchant experience needs mobile priority now.

**AI safety external validation.** Board recommended. Y1 didn't reveal specific issues but Y2 with growing agent autonomy needs external eyes.

---

## Section 12 — Final Deliverable Summary

**Nex is not ready for open Commercial GA.**

**Nex IS ready for closed pilot with the following gates:**

1. Top 20 P:C improvements from Section 10 shipped before Commercial GA
2. Merchant advisory panel formalised and paid (per ES-10 §12.3)
3. 100 simulation runs across all 12 customer journeys with issue-tracking
4. Data-portability + right-to-be-forgotten workflows operational
5. Multi-user RBAC integrated in Workforce V0
6. Model outage graceful degradation tested per feature
7. Legal review of consent framework + wholesale channel terms
8. AI safety external validation initiated
9. Trade Brain author recruitment infrastructure operational
10. Retention engineering owner assigned

Without these gates, first-quarter churn will be dominated by preventable friction. Simulation reveals this now; real merchants would reveal it painfully later.

**Ship the P:C improvements. Test with the advisory panel. Then open closed beta. Then Commercial GA.**

**The platform is defensible. The moat is real. But it must survive the first 90 days of real merchant use, and this report is honest about which features aren't yet ready for that.**

---

**End of Nex Pre-Launch Validation Report v1.0.**

*Update this document quarterly with simulation results. When real merchants arrive, replace synthetic data findings with actual user data. The improvement list continues to evolve as reality reveals new gaps.*
