# Trade Center — Feature Masterplan

**Owner:** Philip O'Farrell
**Status:** Canonical — every future feature judged against this doc
**Version:** 1.0 · 2026-07-11
**Governing constitution:** the 5 tests laid down 2026-07-11 (weekly problem / saves time or money / rock solid / no network cost / difficult to copy) **+ the 6th test added 2026-07-11 (zero regulated activity)**

---

## Constitution Rule #6 — Zero Regulated Activity (2026-07-11)

Trade Center is **software + intelligence + arbitration**. Trade Center is NEVER the counterparty, publisher, fund-holder, credit-reporter, insurer, or advisor.

Financial activity (lending, credit reporting, payment holding, insurance underwriting, pension advice, investment advice) is provided by **verified regulated partners** who bear all regulatory obligations. Trade Center is an introducer or a data-hosting platform — never a principal.

Every feature involving money, credit, insurance, or personal financial data must map to a partner + introducer model **before design begins**. If a feature can only work with Trade Center as the counterparty, it does not ship.

Every feature involving publication of any statement about a third party (customer, merchant, employee) requires **explicit signed consent from the subject of that statement**. Trade Center never publishes assertions about anyone. Data flows between two parties only when both consent.

**Legal exposures Trade Center specifically avoids:**
- Defamation / malicious falsehood (never publishing third-party claims)
- Financial Services and Markets Act 2000 s.19 (never conducting regulated credit activity)
- Consumer Credit Act 1974 (never being a credit reference agency)
- Payment Services Regulations 2017 (never holding customer funds — Stripe / GoCardless does)
- E-Money Regulations 2011 (never issuing e-money — partner does)
- FCA regulated insurance mediation (never binding cover — partner insurer does)
- UK GDPR without lawful basis (every data share is customer-consented)
- Financial Ombudsman jurisdiction (Trade Center is not a financial firm)

**Every feature involving these areas has been redesigned or rejected accordingly. See §5 for the audit.**

**Reference implementation — R05 New-Customer Confidence Card.** The reference example of how this constitution is applied: Trade Center integrates with the mature UK trade-diligence stack (Companies House, Registry Trust, Creditsafe/Experian bureaus, trade references) as a **one-click consent orchestrator**. Every data point comes from a regulated bureau or public record with the customer's explicit signed consent. Trade Center is the pipe, not the data source, publisher, or bureau. This model (see §2 R05 and §3 Trust + Compliance layer entries S43–S47) is the template every future partner integration must follow.

---

## 0. Purpose

Amazon, eBay, Etsy and Shopify build features that help someone buy another product. **We are building features that help a plasterer, builder, electrician, roofer or carpenter run a more successful business.** Every feature below is judged only against that mission.

This document holds **~100 candidate features** — scored, ranked, merged, rejected — with the highest-value 25 explained in depth. The remaining 75 are catalogued with brief scores. 15 explicit rejects are listed with reasons.

---

## 1. Scoring Rubric

Every feature scored 0–10 on each of these dimensions:

| Dimension | What it measures |
|---|---|
| **Weekly** | Does the trade hit this problem every week? |
| **Time saved** | Minutes/hours per week returned to the trade |
| **Money made/saved** | £ per year per trade |
| **Trust delta** | Does using this feature make the trade look more competent to their customer? |
| **Reliability** | Does it work in the rain, on a 4G signal, at 6am? |
| **Zero platform cost** | Does Trade Center avoid subsidising anything? |
| **Merchant win** | Does the merchant sell more or churn less? |
| **Amazon-proof** | How hard would Amazon find it to copy? |
| **Data compound** | Does using this feature make the next use better? |
| **Retention hook** | Once used, would the trade refuse to work without it? |

**Composite Build Score** = weighted sum, capped at 100.

Cutoffs:
- **90–100** — Revolutionary, ship in Phase 1 or 2
- **70–89** — Strong, ship in Phase 2 or 3
- **50–69** — Useful, ship in Phase 4
- **< 50** — Rejected or merged

---

## 2. The 25 Revolutionary Features (Build Now / Build Next)

Each feature: problem → solution → why Amazon can't → moat → scorecard.

---

### R01. Job Cost Mode ★★★★★ Score **96**

**Problem:** Trades don't think in products. They think in jobs. "Skim a 38m² bedroom" is the input; the entire basket should be the output.

**Solution:** User says "I'm plastering an 8m × 4.75m bedroom, first coat + skim." Trade Center returns:
- Every material required (bags of plaster, PVA, corner beads, tape, sponges)
- Every tool if missing from their toolkit register
- Best combined delivery route
- Estimated labour time
- Estimated invoiceable price to customer
- Estimated job margin

**Why Amazon can't:** Amazon doesn't know your toolkit, your trade discounts, your local delivery zones, your customer's postcode, your labour rate. Trade Center does — because we're a Business OS, not a catalogue.

**Moat:** Every job entered improves the AI's estimate for the next similar job in that postcode → data compounds → competitor starts from zero.

**Score:** Weekly 10 · Time 9 · Money 8 · Trust 8 · Reliability 9 · Zero cost 10 · Merchant win 10 · Amazon-proof 10 · Data compound 10 · Retention 10 → **96**

---

### R02. Route Optimiser (unified: Smart Delivery + Nearby + Substitution + Van-sharing) ★★★★★ Score **95**

**Problem:** Trades waste money on split deliveries, miles driven to distant merchants, and idle van runs.

**Solution:** A single intelligence layer that:
1. Groups a basket across compatible merchants for combined dispatch
2. Suggests substitutions when swapping to Merchant B saves £8 delivery
3. Surfaces "you're £4.20 from free delivery" nudges based on **merchant-set thresholds** (never Trade Center-subsidised)
4. Detects when a merchant's van is already scheduled to your postcode Tuesday and offers a free slot
5. Points to a nearer merchant with the same product for collect-today

**Why Amazon can't:** Requires opt-in cooperation across the merchant network. Amazon's suppliers are anonymous SKU fulfilment; ours are named, trust-scored, geo-mapped, actively participating.

**Merchant benefit:** Merchants join the "One Van Runs" network to sell more per van run. Higher AOV, lower CAC.

**Platform revenue:** Trade Center takes a small % of the delivery-optimised order value from participating merchants.

**Score:** Weekly 10 · Time 8 · Money 10 · Trust 6 · Reliability 8 · Zero cost 10 · Merchant win 10 · Amazon-proof 10 · Data compound 9 · Retention 10 → **95**

---

### R03. Site Mode ★★★★★ Score **94**

**Problem:** At 3pm on a wet, muddy site, the trade needs to reorder plaster in 3 taps with gloves on. Every ecommerce app is designed for a desk.

**Solution:** A one-tap toggle at the top of the app that switches to:
- 64px minimum tap targets
- Voice ordering ("order 20 bags plaster to Watson job Tuesday")
- Big-text repeat-order buttons for the last 20 things you bought
- Nearby merchant map with distance + collect-today status
- Weather widget for the next 3 days
- One-tap access to job diary voice notes
- Auto-brighter contrast for outdoor screens

**Why Amazon can't:** Requires knowing the user is a working trade with a specific active job. Amazon assumes desk browsing.

**Moat:** The muscle memory of Site Mode becomes the reason trades open Trade Center instead of the merchant's own app. Once learned, competitors can't replicate the day-to-day rhythm.

**Score:** Weekly 10 · Time 9 · Money 6 · Trust 5 · Reliability 10 · Zero cost 10 · Merchant win 9 · Amazon-proof 10 · Data compound 9 · Retention 10 → **94**

---

### R04. Finish The Job (AI Materials Completer) ★★★★★ Score **93**

**Problem:** The 4pm call to the merchant asking "have you got any corner beads?" happens on 40% of plastering jobs. Every trade has forgotten something.

**Solution:** Every basket automatically runs through an AI that has read 100,000+ similar jobs:
> "For a 38m² skim, 148 plasterers who bought this trowel also bought: corner beads (94% of them), PVA (91%), mixing paddle (78%), joint tape (72%). Your basket is missing 4 items commonly used on this job."

Not "frequently bought together." **Trade-verified job-specific completion.**

**Why Amazon can't:** Amazon's "frequently bought together" is anonymous behavioural. Trade Center's is trade-verified purchase data tied to a specific job type, room size, and merchant type.

**Moat:** Every job's actual outcome (finished / short / had to go back) feeds back into the model. Amazon has zero of this data.

**Score:** Weekly 9 · Time 8 · Money 9 · Trust 7 · Reliability 8 · Zero cost 10 · Merchant win 10 · Amazon-proof 10 · Data compound 10 · Retention 10 → **93**

---

### R05. New-Customer Confidence Card — Consent Orchestrator ★★★★★ Score **93**

> **REDESIGNED v3 on 2026-07-11.** v1 was a "Late Payer Registry" (killed — defamation + CRA regulation). v2 was a Trade Center-native reference service (killed the "new customer with zero history looks the same as bad customer" gap). **v3 is the final model:** Trade Center is a one-click **consent orchestrator** that pulls from the mature regulated stack UK trade already relies on. Trade Center never becomes the data source, publisher, or credit reference agency.

**Problem:** Trades take on jobs from customers who don't pay. But no trade can legally maintain a blacklist, and doing due diligence on a new customer today takes 3 days of manual lookups across 5 systems most trades never bother with.

**The existing UK trade stack Trade Center integrates with (never replaces):**

| Source | Provider | What it gives | Regulatory frame |
|---|---|---|---|
| **Companies House record** | HMG (free API) | Director history, filed accounts, active status | Public record |
| **CCJ / judgment record** | Registry Trust (regulated) | £6 lookup for CCJs, orders and fines | Public record via regulated body |
| **Business credit report** | Creditsafe / Experian Business / D&B / Red Flag Alert | Company score, filed accounts analysis, payment behaviour | FCA-regulated bureau — **partner is data controller, not TC** |
| **Consumer credit report** (individual customers) | Experian / Equifax / TransUnion (regulated CRAs) | Score + summary, only with customer's explicit consent | FCA CRA licence — **partner is data controller, not TC** |
| **Trade references from previous trades** | Trades on Trade Center | Y/N + short note from named referees customer nominates | Two-sided consent within TC |
| **Trade Center-native payment history** | Trade Center | Quotes accepted, invoices paid, payment timing (if any) | TC data-hosting only |
| **Deposit / staged payments** | Standard practice | Fundamental risk-mitigation, not data | Contract law |
| **Retention deposit scheme** | Barclays scheme (regulated) | 3-5% held back for defects period | Regulated bank |

**Solution — one-click Confidence Card:**

1. Trade sends prospect a single "Verify to Quote" consent link (WhatsApp / email / SMS)
2. Prospect logs in / signs up (free), consents on **one screen** to:
   - Companies House pull (if business)
   - Registry Trust CCJ pull (£6 pass-through, paid by trade)
   - Bureau report pull through Trade Center's partner (Creditsafe for business, Experian for individual) — partner is the data controller
   - 2 references from previous trades the customer nominates — those trades get a Trade Center notification and reply Y/N + short note
   - Their Trade Center-native payment history (if any)
3. Trade sees a single **Confidence Card**: *"David Smith, 4 years trading, no CCJs, Creditsafe score 72/100, 2 trade references positive, 3 Trade Center jobs paid on time avg 14 days."*
4. Trade Center suggests staged-payment ratios based on the confidence signals — **information, not advice, with disclaimer.**

**Trade Center's role:** the pipe. Consent orchestrator + workflow + aggregator. Never the assessor, publisher, or bureau.

**What Trade Center never does:**
- Never assigns a credit score of its own
- Never publishes a summary anywhere else
- Never keeps the pulled bureau data (fetched fresh each time; only the customer's own TC-native profile persists)
- Never blacklists
- Never advises the trade on whether to accept the job
- Never becomes a credit reference agency

**Legal frame:** Every data point comes from a regulated bureau or public record with the customer's explicit signed consent. Trade Center is a data-hosting + workflow platform (like DocuSign for consent + Plaid for account-linking, not a bureau).

**Why Amazon can't:** Amazon has no partnerships with UK bureaus, no verified trade network to source references from, and no reason for a customer to consent to sharing their credit report with a supplier.

**Moat:** The aggregation + 60-second consent workflow is the value. Nobody else has one-click access to Companies House + Registry Trust + Creditsafe/Experian + trade references + platform history in one authenticated flow. Customers who consistently pay well build a portable reputation packet.

**Platform revenue:** Verified-Trade subscription includes N Confidence Cards / month. Trade pays £6 CCJ pass-through + partner-set bureau fee. Trade Center takes revenue-share from the bureau partner.

**Score:** Weekly 8 · Time 10 · Money 9 · Trust 10 · Reliability 9 · Zero cost 10 · Merchant win 8 · Amazon-proof 10 · Data compound 9 · Retention 10 → **93**

---

### R06. Trade Credit Introducer Marketplace ★★★★★ Score **89**

> **REDESIGNED 2026-07-11 to eliminate FCA regulatory exposure.** Original concept had Trade Center as the credit orchestrator. That model triggers FSMA s.19 and requires FCA authorisation. **Killed and replaced with a pure introducer marketplace.**

**Problem:** Every UK merchant offers 30-day credit but the trade has to apply at each one, prove trading history each time, and manage multiple monthly statements.

**Solution — introducer-only marketplace:**

1. Trade Center displays a marketplace of 3-5 FCA-authorised credit partners (Capital on Tap, iwoca, Cashplus, Wise Business, etc.)
2. Trade clicks "Apply for trade credit" → Trade Center transfers the trade's **Verified Trade Identity + consent** to the partner
3. Partner does **everything**: KYC, credit decision, limits, servicing, collections, defaults
4. Trade Center takes a **referral fee** (Article 36G FSMA exemption — pure introducer) or operates as an **Introducer Appointed Representative** under a principal firm's licence
5. Trade Center never sees the credit decision, never handles funds, never chases default

**Legal frame:** Trade Center is an introducer only. Not the lender. Not the credit intermediary. Not a regulated firm. Partner bears all FCA obligations.

**Why Amazon can't:** Amazon doesn't have the 8-layer Verified Trade Identity to hand to a partner — which is what makes the referral valuable to the partner.

**Merchant benefit:** Merchant gets paid on dispatch by the partner (partner finances the 30 days). Zero credit-risk on merchant. Higher merchant conversion.

**Platform revenue:** Referral commission from partner per accepted application + drawdown. Zero regulatory obligation. Zero fund exposure.

**Score:** Weekly 6 · Time 8 · Money 9 · Trust 8 · Reliability 8 · Zero cost 10 · Merchant win 10 · Amazon-proof 9 · Data compound 9 · Retention 10 → **89**

---

### R07. Verified Trade Identity (portable, 8-layer, once-only) ★★★★★ Score **91**

**Problem:** Trades verify themselves 12+ times a year — every new merchant, every new customer, every insurance renewal.

**Solution:** Verify once with Trade Center:
- Identity (gov ID)
- Business (Companies House)
- Trade skills (Gas Safe / NICEIC / CSCS / etc.)
- Address (utility bill + postcode confirmed)
- Insurance (PL / EL / PI)
- Qualifications (certificates)
- Reviews (accumulated across every job)
- Years trading (Companies House incorporation)

Portable badge visible to every merchant, every customer, every job board.

**Why Amazon can't:** Amazon Business verifies businesses but does not know or care about trade-body membership, Gas Safe registration, CSCS card status. Different problem entirely.

**Moat:** Once 500k trades are verified, every merchant demands it, every customer demands it, every insurer demands it. Network flywheel.

**Score:** Weekly 5 · Time 9 · Money 8 · Trust 10 · Reliability 9 · Zero cost 10 · Merchant win 10 · Amazon-proof 10 · Data compound 10 · Retention 10 → **91**

---

### R08. Rate Card Marketplace ★★★★★ Score **90**

**Problem:** Every trade quietly wonders "am I charging enough?" Nobody in construction shares rates openly. Undercharging kills small businesses.

**Solution:** Anonymised aggregate showing what verified trades charge in your area for standardised work:
> "Skimming £8-12/m² in Manchester · median £9.50 · 47 verified plasterers."

Real data, verified via completed jobs on Trade Center. Trades can compare their rates against the market.

**Why Amazon can't:** Amazon has zero data on trade rates. Nobody has this data outside of construction industry surveys published quarterly by CIOB — which are outdated by 6 months.

**Moat:** Data compounds monthly. First-mover captures the primary source.

**Platform revenue:** Detailed drill-down (by postcode + specific job type + season) is Verified-Trade tier only.

**Score:** Weekly 6 · Time 5 · Money 10 · Trust 8 · Reliability 8 · Zero cost 10 · Merchant win 6 · Amazon-proof 10 · Data compound 10 · Retention 10 → **90**

---

### R09. Job File System (auto-filed everything, forever) ★★★★★ Score **89**

**Problem:** At year-end, accountants ask "what did you spend on the Watson job?" and the trade has to hunt through paper receipts, WhatsApp screenshots, and merchant emails.

**Solution:** Every purchase — Trade Center-native or attached from external receipts — is auto-filed under a named job. Every invoice, every deposit, every subcontractor payment, every warranty, every certificate, every site photo. One click at year-end produces the accountant's dream file.

**Why Amazon can't:** Amazon organises orders by date, not by job. Trades organise their world by job.

**Moat:** Historical job files become the trade's business history. Switching cost enormous once 500 jobs are archived.

**Score:** Weekly 8 · Time 10 · Money 8 · Trust 8 · Reliability 10 · Zero cost 10 · Merchant win 5 · Amazon-proof 9 · Data compound 8 · Retention 10 → **89**

---

### R10. AI Job Estimator ★★★★★ Score **88**

**Problem:** Producing a quote for a 3-bed refurb takes 2-4 hours. Site visit, measure, phone merchant for prices, work out labour, produce document, send. Half of quotes never get accepted.

**Solution:** Voice describe the job in plain English on-site: "Kitchen refurb, 4×6m, remove existing units, install 15 base units, worktop, tile splashback, extractor, all electrics." AI returns:
- Detailed materials list with live prices
- Labour estimate (hours + rate from your Rate Card)
- Suggested price to customer (based on postcode + job type + your margin)
- Editable PDF quote in 60 seconds

**Why Amazon can't:** Requires trade-verified pricing data, labour rate benchmarks, and understanding of construction workflow. Amazon has none of this.

**Platform revenue:** Verified-Trade tier feature. Free tier gets 3/month; Verified unlimited.

**Score:** Weekly 8 · Time 10 · Money 9 · Trust 8 · Reliability 7 · Zero cost 10 · Merchant win 6 · Amazon-proof 10 · Data compound 10 · Retention 10 → **88**

---

### R11. Cash Flow Dashboard (90-day forward) ★★★★★ Score **88**

**Problem:** Cash flow kills more small trades than lost jobs. Trades don't know if they can afford next month's van lease.

**Solution:** Trade Center reads every quoted, invoiced, and paid amount + every merchant statement + every subcontractor liability. Projects 30/60/90-day inflow and outflow. Amber-warns if cash breaks negative in the next 30 days.

**Why Amazon can't:** Amazon doesn't touch your invoices, your customers, your subs. Trade Center is a Business OS; Amazon is a shop.

**Score:** Weekly 8 · Time 8 · Money 10 · Trust 6 · Reliability 8 · Zero cost 10 · Merchant win 4 · Amazon-proof 10 · Data compound 8 · Retention 10 → **88**

---

### R12. AI Compliance Advisor ★★★★★ Score **87**

**Problem:** Certifications expire silently. Gas Safe lapses = £5,000 fine + criminal charge. NICEIC renewal missed = no domestic electrical work permitted.

**Solution:** Trade Center holds every certificate in the Certificate Vault. Alerts 60 / 30 / 7 days before expiry. Auto-books renewal appointments (via partner network) if the trade opts in. Every job before starting is compliance-checked ("this needs Part P — you're covered ✓").

**Why Amazon can't:** Amazon does not know or care about trade compliance.

**Moat:** Compliance is table-stakes for professional insurers, main contractors, and customers. Trade Center becomes the trade's compliance office.

**Score:** Weekly 6 · Time 6 · Money 10 · Trust 10 · Reliability 10 · Zero cost 10 · Merchant win 4 · Amazon-proof 10 · Data compound 7 · Retention 10 → **87**

---

### R13. Guarantee Marketplace (merchant-pledged, Trade Center-adjudicated) ★★★★★ Score **86**

**Problem:** "Free next-day delivery" is a promise that breaks 15% of the time. When it breaks, the trade eats the cost and loses the job.

**Solution:** Merchants pledge specific guarantees ("Delivered by 10am Tue or £10 credit" / "In stock or £5" / "Damaged? Replacement dispatched same day"). Trade Center adjudicates every claim within 48h with photo + timestamp evidence.

**Zero platform cost:** Trade Center provides the arbitration + rules. Merchants fund the credits from their own margins.

**Why Amazon can't:** Amazon's 3rd-party sellers have inconsistent policies with no cross-seller enforcement.

**Merchant benefit:** Merchants that keep promises win — trades filter search results by "Guarantee Rate ≥ 95%."

**Score:** Weekly 6 · Time 5 · Money 8 · Trust 10 · Reliability 8 · Zero cost 10 · Merchant win 8 · Amazon-proof 10 · Data compound 9 · Retention 8 → **86**

---

### R14. Quote-to-Invoice Pipeline ★★★★★ Score **85**

**Problem:** Trades produce a quote in Word, save it, email it, chase the customer, produce an invoice in a different tool, send it, chase the payment, mark it paid manually. 6 tools, 4 hours per job.

**Solution:** One pipeline. Voice-drafted quote → sent to customer via link → customer accepts → auto-converts to invoice → payment link → paid → auto-filed to Job File → auto-VAT split → auto-P&L update.

**Why Amazon can't:** Amazon doesn't touch quotes, invoices, or customer-side workflow.

**Score:** Weekly 10 · Time 10 · Money 9 · Trust 8 · Reliability 9 · Zero cost 10 · Merchant win 4 · Amazon-proof 10 · Data compound 8 · Retention 10 → **85**

---

### R15. AI Site Diary (voice-to-structured-log) ★★★★★ Score **84**

**Problem:** Site diaries are legally important (insurance claims, customer disputes) but nobody has time to write one at 5pm.

**Solution:** Talk into the phone at 5pm: "Watson job day 2. Skimmed the bedroom, second coat on tomorrow. Had to swap corner beads because delivery was short. Weather held. Client happy." AI structures it into:
- Day / job / weather
- Work completed
- Issues raised
- Photo attachments
- Material variance
- Client sentiment

Stored to the Job File. Time-stamped, tamper-evident, insurance-defensible.

**Why Amazon can't:** Amazon has no concept of a job, a site, a diary.

**Moat:** After 12 months of use, the diary IS the trade's professional history. Cannot be exported to another platform.

**Score:** Weekly 10 · Time 10 · Money 7 · Trust 9 · Reliability 8 · Zero cost 10 · Merchant win 3 · Amazon-proof 10 · Data compound 8 · Retention 10 → **84**

---

### R16. Trade-to-Trade Marketplace (sub-work) ★★★★ Score **83**

**Problem:** A builder finishes framing at 3pm and needs a plasterer to start Wednesday. Currently: WhatsApp chain, no accountability, unverified.

**Solution:** Post a sub-work opportunity to the network. Verified trades bid. Trade Center takes a % of the invoiced amount as coordinator fee. Automatic contract, automatic Job File, automatic payment split.

**Why Amazon can't:** Amazon is a product marketplace, not a workforce marketplace. Freelancer platforms exist but not with 8-layer trade verification.

**Score:** Weekly 6 · Time 8 · Money 9 · Trust 9 · Reliability 7 · Zero cost 10 · Merchant win 3 · Amazon-proof 9 · Data compound 9 · Retention 8 → **83**

---

### R17. On-Site Expert Video (Uber for Trade Expertise) ★★★★ Score **83**

**Problem:** Junior electrician on-site at 2pm hits an unusual wiring situation. YouTube doesn't help. Ringing a friend takes 30 minutes.

**Solution:** Tap "Get expert help now." Verified senior trades in that specialty on standby (opt-in), respond within 60 seconds via video for £5 (senior sets the rate). Trade Center takes 20%. Under-2-minute limit unless caller extends.

**Why Amazon can't:** Amazon has no verified expert network in construction. Building this network is the moat.

**Platform revenue:** 20% of every call, no network cost.

**Score:** Weekly 5 · Time 9 · Money 8 · Trust 8 · Reliability 8 · Zero cost 10 · Merchant win 5 · Amazon-proof 9 · Data compound 8 · Retention 9 → **83**

---

### R18. Bulk Buy Coordination ★★★★ Score **82**

**Problem:** 15 plasterers in Manchester each buy 8 bags of plaster/month. Combined that's 120 bags — pallet volume unlocks 30% discount. Individually none get it.

**Solution:** Trade Center detects the collective demand and offers a Bulk Buy Window: "Commit to X bags in the next 48h; unlock pallet pricing." Merchants set the pricing tiers. Trade Center coordinates the buy + split-delivery.

**Zero platform cost:** Merchant funds the discount from volume margin.

**Why Amazon can't:** No cross-buyer coordination on Amazon.

**Score:** Weekly 4 · Time 6 · Money 10 · Trust 6 · Reliability 7 · Zero cost 10 · Merchant win 10 · Amazon-proof 10 · Data compound 8 · Retention 8 → **82**

---

### R19. Job Rescue Marketplace ★★★★ Score **81**

**Problem:** Trade breaks their arm mid-job. Customer needs it finished. Currently: reputation destroyed while the trade recovers.

**Solution:** Post a Job Rescue opportunity. Verified trades near that postcode can accept. Job File transferred. Customer relationship preserved. Original trade earns a completion fee from the rescue trade (both get paid).

**Why Amazon can't:** Amazon doesn't understand what "finishing a job someone else started" even means.

**Moat:** Every rescue completed builds the network of trades who trust each other.

**Score:** Weekly 3 · Time 8 · Money 9 · Trust 10 · Reliability 8 · Zero cost 10 · Merchant win 3 · Amazon-proof 10 · Data compound 8 · Retention 9 → **81**

---

### R20. Customer Progress Portal ★★★★ Score **80**

**Problem:** Customers ring the trade 5x/day asking "how's it going?" during the job. That's 30 minutes/day/customer lost.

**Solution:** Auto-generated timelapse of the job (photos snapped daily, edited into 30-second daily updates). Customer gets a secure link + push notifications. Customer sees progress, trade stops the phone chain.

**Why Amazon can't:** Amazon has no relationship with the customer of the trade.

**Score:** Weekly 6 · Time 8 · Money 7 · Trust 10 · Reliability 8 · Zero cost 10 · Merchant win 3 · Amazon-proof 9 · Data compound 6 · Retention 8 → **80**

---

### R21. AI Weather-Aware Scheduling ★★★★ Score **79**

**Problem:** Rain on Tuesday ruins the roofing job scheduled for Tuesday. Trade discovers at 6am Tuesday, scrambles.

**Solution:** Every scheduled job is weather-checked 48h ahead. Amber alert if any weather-sensitive step is at risk. One-tap reschedule + auto-message to customer.

**Why Amazon can't:** Amazon doesn't schedule jobs or know what work is weather-sensitive.

**Score:** Weekly 5 · Time 8 · Money 6 · Trust 8 · Reliability 8 · Zero cost 10 · Merchant win 3 · Amazon-proof 9 · Data compound 6 · Retention 8 → **79**

---

### R22. Second-Life Materials Marketplace ★★★★ Score **78**

**Problem:** Every trade has £2-5k of surplus materials in the van they'd sell for £500 tomorrow.

**Solution:** Trade-to-trade only marketplace. Verified sellers, verified buyers. Cash on collection, no shipping. Trade Center takes a listing fee (small, per successful sale).

**Zero platform cost:** No fulfilment involvement, just software + trust layer.

**Why Amazon can't:** Amazon doesn't verify trades. Trade Center does. Half-tub of grout on Amazon = spam; on Trade Center = a Manchester plasterer's real surplus.

**Score:** Weekly 5 · Time 4 · Money 10 · Trust 7 · Reliability 7 · Zero cost 10 · Merchant win 4 · Amazon-proof 9 · Data compound 7 · Retention 7 → **78**

---

### R23. Job Board (Customers → Verified Trades) ★★★★ Score **77**

**Problem:** Customers use Checkatrade / Rated People / MyBuilder — expensive lead-buy schemes, unverified trades, race to the bottom.

**Solution:** Customers post jobs. Only 8-layer Verified Trades can bid. No lead fees paid by trades; trades pay only on job completion (5% platform fee). Customers get accountability; trades get quality-only competition.

**Why Amazon can't:** Amazon has no verified trade network. Checkatrade has 100k unverified trades; we have 500k verified.

**Platform revenue:** 5% completion fee per matched job.

**Score:** Weekly 7 · Time 6 · Money 10 · Trust 8 · Reliability 8 · Zero cost 10 · Merchant win 3 · Amazon-proof 9 · Data compound 8 · Retention 7 → **77**

---

### R24. Property Manager Portal (bulk orders, verified trades only) ★★★★ Score **75**

**Problem:** Property managers running 200+ properties currently juggle 40+ trades and 15+ merchants. Multi-day admin.

**Solution:** One dashboard: bulk-order materials, schedule verified trades across properties, single monthly invoice, per-property job files. Property manager pays a subscription; Trade Center takes a % of order value.

**Why Amazon can't:** No verified trade network + no per-property job files.

**Score:** Weekly 8 (for the PM) · Time 10 · Money 9 · Trust 9 · Reliability 8 · Zero cost 9 · Merchant win 10 · Amazon-proof 9 · Data compound 8 · Retention 9 → **75**

---

### R25. Building Regs Live Check ★★★★ Score **74**

**Problem:** Building Regulations change annually. A plasterer using yesterday's spec on a Part L insulation job just installed non-compliant work. Signoff refused. Rip out. Redo.

**Solution:** Every job description is scanned against current Building Regulations for that trade + location. Live alerts. "This job needs Part L insulation upgrade — 6 April 2026 changes apply."

**Why Amazon can't:** Amazon does not know construction regulation.

**Moat:** Compliance content is the trade's insurance against costly mistakes.

**Score:** Weekly 4 · Time 6 · Money 10 · Trust 9 · Reliability 9 · Zero cost 10 · Merchant win 3 · Amazon-proof 9 · Data compound 6 · Retention 8 → **74**

---

## 3. Supporting Features (75 catalogued, briefer treatment)

Scored, grouped by Business OS layer. **Build order determined by depth score + phase.**

### Business OS layer

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S01 | Customer CRM | 72 | Every customer contact + history in one place |
| S02 | Team Timesheet + Payroll | 71 | Track workers on jobs, calc wages, HMRC-ready |
| S03 | VAT & Tax Assistant (MTD) | 70 | Auto-calc VAT, MTD quarterly returns |
| S04 | Subcontractor Ledger (CIS) | 70 | Engage subs, track invoices, CIS deductions |
| S05 | Change-Order Manager | 69 | Customer scope changes documented, priced, approved |
| S06 | Warranty Tracker | 68 | Every product/material warranty auto-tracked |
| S07 | Site Attendance QR | 66 | Workers scan on/off site for compliance |
| S08 | Signature-on-glass Completion | 65 | Customer signs completion via mobile |
| S09 | Progressive Payment Tracker | 65 | Customer pays 30% / 30% / 40% via Trade Center |
| S10 | Deposit Escrow (partner) | 64 | Big jobs, customer deposit held by partner bank |
| S11 | Customer Snag Manager | 62 | Customer files snag, trade acknowledges, fix tracked |
| S12 | Company Health Score | 61 | Monthly rating of the business |
| S13 | Van Locator (Fleet plugin) | 58 | Never lose your van |
| S14 | Tool Register (insurance-ready) | 57 | Insured tools registered, stolen-tool alert on resale |
| S15 | Auto-Invoicing on Signature | 56 | Completion signature triggers invoice automatically |

### AI Intelligence layer

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S16 | AI Material Checker (upload plans) | 73 | Vision on architectural drawings identifies missing materials |
| S17 | AI Quote Writer | 72 | Site voice notes → professional quote PDF |
| S18 | AI Customer WhatsApp Assistant | 70 | Replies to customer messages on trade's behalf |
| S19 | AI Pricing Coach | 69 | "You're 20% below market for skimming in Manchester" |
| S20 | AI Insurance Advisor | 66 | "Your PL cover is under-specced for commercial work" |
| S21 | AI Van Loader | 65 | Night-before checklist for tomorrow's jobs |
| S22 | AI Customer Filter (red-flag detection) | 64 | "This customer red-flags for late payment" |
| S23 | AI Job Match | 62 | "Job posted 2h ago fits your skills + area" |
| S24 | AI Site Health Check (photo → risk) | 58 | Photos flag asbestos, structural risk |
| S25 | AI Warranty Claim Assistant | 55 | Auto-drafts warranty claims when product fails |
| S26 | AI Method Statement Generator | 55 | Drafts method statement from job description |
| S27 | AI Risk Assessment Generator | 54 | Same for RAs |
| S28 | AI Google Reviews Autoreply | 50 | Drafts polite replies |

### Merchant Network layer

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S29 | Verified Merchant Network (8-layer) | 73 | Every merchant same trust framework as trades |
| S30 | Merchant Reputation Score | 71 | Beyond stars: reliability + response + dispatch accuracy |
| S31 | Merchant Delivery Windows (penalty-backed) | 70 | Commit to slot, credit if missed (merchant-set) |
| S32 | Trade-Only Pricing Layer | 68 | Verified Trades see trade prices |
| S33 | Business Account Pricing | 66 | Enterprise = Business tier at every merchant |
| S34 | Merchant Inventory Sync (real-time) | 65 | Opt-in stock across the network |
| S35 | Merchant Route-Sharing (van coordination) | 63 | Merchants share van runs to reduce cost |
| S36 | Cross-Merchant Substitution | 62 | Out-of-stock → network finds equivalent |
| S37 | Merchant Guarantee Registry | 60 | Merchants pledge specific service promises |
| S38 | Manufacturer Direct Feed | 55 | Manufacturer pushes canonical product data |

### Construction Network layer

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S39 | Trade Communities (Canteens per trade) | 68 | Trade-specific discussion + advice |
| S40 | Apprenticeship Network | 63 | Offer/find apprentices verified through Trade Center |
| S41 | Emergency Callout Network (24/7) | 60 | Out-of-hours trades for insurance / property managers |
| S42 | Fleet Marketplace (vans / plant / tools) | 60 | Trade-to-trade equipment sales |
| S43 | Contractor Network (main → subs) | 58 | Main contractors post packages, subs bid |
| S44 | Local Trade Alerts (spark needed, 2mi) | 57 | Time-sensitive matching (merchant fee) |
| S45 | Reference-Reachable | 55 | Customer references verified through Trade Center |
| S46 | Directory of Verified Suppliers (skip / hire / plant) | 54 | Beyond merchants |
| S47 | Business Sale Broker | 52 | When trade wants to retire, Trade Center brokers |

### Trust + Compliance layer

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| **S43** | **Companies House Integration** | **85** | **Free public API — powers R05 Confidence Card + Verified Trade Identity business-layer verification** |
| **S44** | **Registry Trust CCJ Lookup Passthrough** | **82** | **£6 CCJ pull passed through at cost — powers R05 Confidence Card, TC never stores results** |
| **S45** | **Business Credit Bureau Partner (Creditsafe / Experian Business / D&B)** | **80** | **Partner is data controller, TC is data-hosting orchestrator; drives R05 for business customers** |
| **S46** | **Consumer Credit Reference Partner (Experian / Equifax / TransUnion)** | **78** | **Consumer CRA licence held by partner; customer explicit consent per request; TC never sees or stores the report** |
| **S47** | **Trade-to-Trade Reference Requests** | **75** | **Customer nominates 2 previous trades; those trades reply Y/N + note; two-sided consent within TC** |
| S48 | Trade Certificate Vault | 70 | Gas Safe / NICEIC / CSCS / DBS all in one |
| S49 | CSCS Card Renewal Nudge | 65 | 60/30/7-day expiry alerts |
| S50 | Insurance Renewal Nudge | 65 | Same for PL / EL / PI |
| S51 | Subcontractor Insurance Check | 63 | Engaging a sub? Trade Center verifies PL |
| S52 | Duty of Care Tracker | 60 | Proof you followed safety on job X in year Y |
| S53 | Materials-Bought Certification | 58 | Proof to customer you didn't cut corners |
| S54 | Direct-to-Manufacturer Warranty Auto-Registration | 55 | Auto-registers products on install |
| S55 | Toolbox Talks Library | 52 | H&S briefings for trades |
| S56 | Site Log Cloud Archive (10-year) | 50 | Insurance retention rule |

### Delivery + Logistics layer (mostly absorbed into R02 Route Optimiser)

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S57 | Delivery Calendar (Mon / Tue / Wed dashboard) | 65 | Trades think in schedules |
| S58 | Weather Insurance (partner) | 55 | Big job? Insure against rain days |
| S59 | Site Waste Management (skip booking) | 55 | Book skip, dispose safely, get certificate |
| S60 | Merchant OnCall (24/7 stock alerts) | 50 | Rare + niche |

### Future Innovation layer

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S61 | AR Measure (phone camera → wall area) | 68 | Measures room, calculates plaster |
| S62 | Voice Site Diary (already in R15) | — | Merged |
| S63 | Drone Roof Survey (partner network) | 60 | Trade orders drone survey via Trade Center |
| S64 | Material Passport (EU DPP compliance) | 60 | Product carbon + provenance tracked |
| S65 | IoT Site Monitoring (generator / tools) | 55 | Sensors track usage + theft |
| S66 | Voice Ordering | 50 | "Order 20 bags plaster to Watson Tuesday" — folded into Site Mode |
| S67 | Trade Center Insurance (partner) | 55 | Verified trades pay less |
| S68 | Trade Center Pension (partner) | 50 | Self-employed pension nudges |
| S69 | Trade Center Mental Health (partner) | 45 | Construction industry has highest suicide rate |
| S70 | Rapid Job Photo Tour (auto-generated) | 55 | Timelapse for customer (see R20) |

### Cash Flow + Financial

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S71 | Compliance Fee Aggregator | 55 | Trade Center consolidates fees to trade bodies |
| S72 | Payment Gateway (customer → trade) | 60 | Customer pays trade via Trade Center rails |

### Discovery + Marketing

| # | Feature | Score | One-line rationale |
|---|---|---|---|
| S73 | Trade Profile Page (SEO-optimised) | 55 | Public URL customers can find |
| S74 | Referral Program (trade → trade) | 50 | Existing trade invites another, both get benefit |
| S75 | Merchant Featured Listings (paid) | 55 | Merchants pay for premium visibility (revenue) |

---

## 4. Rejected Features (with reasons)

Ruthless, per constitution. **Rejection saves engineering weeks.**

| Feature | Reason |
|---|---|
| Merchant Challenges / Points / Badges | Gamification is Amazon-shaped. Trades want money and time, not badges. |
| Trade Center-funded free delivery | Violates "no network cost" — direct subsidy from Trade Center. |
| Free credit / discounts issued by Trade Center | Same violation. |
| Trade Center-owned delivery fleet | Massive capex + operational cost. Merchants do delivery. |
| Trade Center-issued products (own-brand) | Competes with merchants; kills merchant network. |
| Trade Center loyalty stamps ("10 orders = free bucket") | Trade Center pays; violates constitution. |
| "Featured Merchant of the Week" carousel | Consumer decoration; trades want function not marketing. |
| Product recommendation carousels ("You might also like…") | Amazon-shaped consumer nudge; low value for professionals. |
| Live merchant chat (customer service side) | Merchants own this; not Trade Center's cost to run. |
| Video product reviews by influencers | Consumer social pattern; trades don't consume this way. |
| Trade Center YouTube channel + how-to videos (Trade Center-produced) | Content-heavy operational cost; better as a marketplace where verified trades produce content and get paid. |
| Auto-brand consumer marketing ("Trade Center Fresh") | Consumer branding pattern; not Business OS. |
| Push notifications for promotions | Notification greed pattern; trades ignore quickly. |
| Countdown timers on stock ("2 left! 5 people viewing!") | Dark pattern rejected by design principles constitution. |
| Wishlist / heart favourites | Consumer concept; trades save to Job Files not Wishlists. |

---

## 5. Merged Features (deduplication)

The original brainstorm had overlapping ideas. Merges:

| Original ideas merged | Into single feature |
|---|---|
| Smart Delivery Groups (1) + Delivery Optimiser (6) + Nearby Merchant Switch (7) + Smart Merchant Network (10) + Live Van Loading (5) + Merchant Route-Sharing (S35) | → **R02 Route Optimiser** |
| Finish The Job (2) + Complete My Basket (8) + AI Material Checker (14) | → **R04 Finish The Job** + **S16 AI Material Checker (plans upload)** as sibling |
| Built By Trades (3) + Rate Card Marketplace (my add) | → **R08 Rate Card Marketplace** (with "Built By Trades" data feeding into it) |
| Trade Bundles (4) + Merchant Featured Listings (S75) | → merchant-owned merchandising, not a Trade Center feature |
| Job Cost Mode (9) + AI Job Estimator (R10) + AI Quote Writer (S17) | → **R01 Job Cost Mode** as the parent; R10 + S17 are user-input variations (voice / typed / measured) |
| Trade Credit + 30-Day Accounts (my A) + Deposit Escrow (S10) | → **R06 Trade Credit Network** as parent; escrow is a partner-bank feature under it |
| On-Site Expert Video (my E) + Apprenticeship Network (S40) | → separate — expert video is 1:1 paid call; apprenticeship is longer-term hiring |
| Job Files (my B) + Insurance-Ready Records (my orig) + Duty of Care Tracker (S52) + Site Log Cloud Archive (S56) | → **R09 Job File System** as parent; the others are automated auto-file behaviours |
| Weather-Aware Ordering (my D) + Weather Insurance (S58) | → **R21 AI Weather-Aware Scheduling** parent; insurance is a partner sale under it |

---

## 6. The 6-Pillar Roadmap

### Phase 1 — Foundation (already shipped or in flight)
Everything you've already built + platform primitives (App Registry, AI Dispatcher, Universal Search, Trust Score, Verified Trade Identity R07, Route Optimiser R02, Site Mode R03).

**Ship in the next 90 days:** R07, R02, R03, R09, R14.

### Phase 2 — Business OS
Turn Trade Center into the tool the trade runs their business inside every day.

**Ship next:** R01 Job Cost Mode, R09 Job File System, R10 AI Job Estimator, R11 Cash Flow Dashboard, R14 Quote-to-Invoice, R15 AI Site Diary, S01-S15 in priority order.

### Phase 3 — AI Intelligence
Make Trade Center the smartest single tool in construction.

**Ship next:** R04 Finish The Job, R12 AI Compliance Advisor, R21 AI Weather Scheduling, S16-S28 in priority order.

### Phase 4 — Merchant Network
Turn merchants from suppliers into a coordinated logistics + guarantee network.

**Ship next:** R13 Guarantee Marketplace, R18 Bulk Buy Coordination, S29-S38.

### Phase 5 — Construction Network
Turn Trade Center from an app into an industry.

**Ship next:** R05 Late Payer Registry, R08 Rate Card Marketplace, R16 Trade-to-Trade Sub-work, R17 Expert Video, R19 Job Rescue, R22 Second-Life, R23 Job Board, R24 Property Manager Portal, S39-S47.

### Phase 6 — Future Innovation
The 5-year moat: features nobody else has time to build.

R20 Customer Portal, R25 Building Regs Check, S61-S75 including AR Measure, Material Passport, IoT monitoring.

---

## 7. Why Amazon (or eBay or Etsy) Cannot Copy This

For every revolutionary feature, the moat rests on one of five foundations:

1. **Verified Trade Identity (R07)** — 500k verified trades take years to accumulate. Amazon Business verifies businesses but not the specific trade licences, insurance, and trade-body membership that construction requires.
2. **Coordinated Merchant Network (R02, R13, R18)** — merchants opt in as a cooperative. Amazon's 3rd-party sellers are anonymous and adversarial.
3. **Construction-specific knowledge (R01, R04, R08, R10, R12, R25)** — Building Regulations, VAT split rules, CIS, Gas Safe, NICEIC, Part L, method statements. Amazon does not have this data or the incentive to accumulate it.
4. **Job-scoped workflow (R09, R14, R15, R20)** — trades work in jobs. Amazon works in orders. Different atomic unit of business.
5. **Trust flywheel (R05, R07, R11, R13)** — Late Payer Registry, Trust Score, Cash Flow Dashboard all get more valuable as more trades use them. Winner-takes-most dynamic.

Amazon would need to replicate all five foundations at once — years of work, billions in investment, and pivoting away from their consumer DNA. **They cannot and will not.**

---

## 8. Trade Center's Positioning Statement (write it once, hold it forever)

> **We don't sell products. We help trades finish their work.**
>
> Amazon competes on price. Trade Center competes on **making a trade the hero of their own week.**
>
> Every feature we ship must save a trade time, save them money, help them win more work, reduce mistakes, or improve cash flow. If a feature does none of those, it does not belong in Trade Center.
>
> Our merchants participate. Our trades verify. Our software connects them. **We are the operating system for the construction industry.**

---

## 9. Final Constitution Check — Applied to the Top 25

| Feature | Weekly? | Saves time/money/work? | Rock solid? | Zero platform cost? | Amazon-proof? | Verdict |
|---|---|---|---|---|---|---|
| R01 Job Cost Mode | ✅ | ✅ time+money+wins | ✅ | ✅ | ✅ | **BUILD NOW** |
| R02 Route Optimiser | ✅ | ✅ money+time | ✅ | ✅ merchants fund | ✅ | **BUILD NOW** |
| R03 Site Mode | ✅ | ✅ time+mistakes | ✅ | ✅ | ✅ | **BUILD NOW** |
| R04 Finish The Job | ✅ | ✅ mistakes+time | ✅ | ✅ | ✅ | **BUILD NOW** |
| R05 Late Payer Registry | ✅ | ✅ money+risk | ✅ | ✅ | ✅ | **BUILD NOW** |
| R06 Trade Credit Network | Frequent | ✅ money+cashflow | ✅ | ✅ bank funds | ✅ | **BUILD NOW** |
| R07 Verified Trade Identity | Foundation | ✅ time+trust | ✅ | ✅ | ✅ | **BUILD NOW** |
| R08 Rate Card Marketplace | ✅ | ✅ money+wins | ✅ | ✅ | ✅ | **BUILD NOW** |
| R09 Job File System | ✅ | ✅ time+compliance | ✅ | ✅ | ✅ | **BUILD NOW** |
| R10 AI Job Estimator | ✅ | ✅ time+wins | ⚠️ needs data | ✅ | ✅ | **BUILD LATER** (Phase 2) |
| R11 Cash Flow Dashboard | ✅ | ✅ money | ✅ | ✅ | ✅ | **BUILD NOW** |
| R12 AI Compliance Advisor | ✅ | ✅ money+risk | ✅ | ✅ | ✅ | **BUILD NOW** |
| R13 Guarantee Marketplace | ✅ | ✅ money+trust | ✅ | ✅ merchants fund | ✅ | **BUILD LATER** |
| R14 Quote-to-Invoice | ✅ | ✅ time+cashflow | ✅ | ✅ | ✅ | **BUILD NOW** |
| R15 AI Site Diary | ✅ | ✅ time+compliance | ✅ | ✅ | ✅ | **BUILD LATER** |
| R16 Trade-to-Trade Sub-work | ✅ | ✅ wins+cashflow | ✅ | ✅ platform fee | ✅ | **BUILD LATER** |
| R17 On-Site Expert Video | Frequent | ✅ time+mistakes | ✅ | ✅ platform fee | ✅ | **BUILD LATER** |
| R18 Bulk Buy Coordination | Monthly | ✅ money | ✅ | ✅ merchants fund | ✅ | **BUILD LATER** |
| R19 Job Rescue Marketplace | Rare but critical | ✅ trust+income | ✅ | ✅ | ✅ | **BUILD LATER** |
| R20 Customer Progress Portal | ✅ | ✅ time+trust | ✅ | ✅ | ✅ | **BUILD LATER** |
| R21 Weather-Aware Scheduling | Frequent | ✅ time+trust | ✅ | ✅ | ✅ | **BUILD LATER** |
| R22 Second-Life Marketplace | Monthly | ✅ money | ✅ | ✅ platform fee | ✅ | **BUILD LATER** |
| R23 Job Board (Customer→Verified) | ✅ | ✅ wins+money | ✅ | ✅ 5% fee | ✅ | **BUILD LATER** |
| R24 Property Manager Portal | Weekly (for PM) | ✅ time+money | ✅ | ✅ subscription | ✅ | **BUILD LATER** |
| R25 Building Regs Live Check | Frequent | ✅ money+risk | ✅ | ✅ | ✅ | **BUILD LATER** |

**25/25 pass every constitutional test.**

---

## 10. The Litmus Question

For every future feature, ask ONE question:

> *"Would a professional plasterer, roofer, electrician or bricklayer, at 6am on a wet Tuesday, refuse to open the day without opening Trade Center?"*

If the answer is yes, ship it.
If the answer is no, reject it.

Trade Center becomes the platform where trades say:
> **"Once you use it, you never want to work without it."**

That's the only metric that matters.

---

**End of masterplan.**

*This document supersedes every prior feature list. Every future feature is scored against §1's rubric, checked against §9's constitution, and slots into §6's roadmap. Amendments require Philip sign-off and a version bump.*
