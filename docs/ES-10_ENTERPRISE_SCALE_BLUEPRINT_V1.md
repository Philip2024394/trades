# ES-10 · Nex Enterprise Scale Blueprint v1.0

**Long-term operating manual · 2026-07-23**
**The final document in the Execution Series.**
**Purpose:** define how Nex evolves from a successful construction platform into the world's leading Construction Operating System over the next decade. Not by inventing new features — by scaling what already exists.

**Notes on document canon:** ES-01, ES-02, ES-03, ES-06 have been produced. ES-04 (Security & Compliance Deep-Dive), ES-05 (Testing & AI Evaluation Framework), ES-07 (Analytics & Business Intelligence Infrastructure), ES-08 (Partner Integration Framework), ES-09 (Enterprise Governance) — slots reserved for future execution series documents. This document is the capstone; it references those slots where relevant and produces guidance that would inform them.

**Integrates:** 33 phase blueprints · Master Architecture v1.0 · Build Execution Playbook · ES-01 Engineering Bible · ES-02 Data & Event · ES-03 API & Service · ES-06 DevOps & Infrastructure.

---

## Executive Summary

Nex is 33 phases of construction-industry AI. 25 phases are shipped. 7 blueprints turn into product over the next 24 months. Every document to date has answered *what* to build and *how*. This document answers *what happens after* — how the platform scales, monetises, defends its moat, and evolves over ten years without losing what makes it work.

Three strategic truths shape everything below:

1. **The moat is composition depth × time.** Not any single feature. The 5-year defensible position requires patience: keep shipping the substrate, keep merchant density growing, keep memory rollups improving. The 10-year position emerges from the compound of those years.
2. **Every scaling decision has a cost we know from prior operators.** Enterprise features have a fixed engineering cost. International expansion has a per-country cost. Wholesale revenue takes 6-18 months per deal. This document plans against those costs, not against optimistic hopes.
3. **The permanent principles matter more than any specific plan.** Ten years is longer than any specific product roadmap will remain accurate. Section 11's operating principles are the durable navigation system when the roadmap needs to adjust.

Nex is positioned to become the world's leading Construction Operating System **subject to seven strategic decisions detailed in the Board Review** (Section 12). Every decision is under management control. None require breakthrough research or heroic execution. They require sustained focus.

---

## Section 1 — Global Platform Vision

### 1.1 What Nex becomes

Nex is a construction operating system for small-to-mid businesses (SMBs) plus targeted enterprise + government use cases. It sits between the trades' phones (SiteBook) and the industry infrastructure (regulators, suppliers, insurers, homeowners). It does not compete with Autodesk BIM authoring or Procore enterprise construction management — those are enterprise-scale infrastructure. Nex owns the long tail that outnumbers them and the intelligence layer above them.

Specifically:

- **Y1-Y3:** the go-to platform for construction SMBs in launch markets (UK · IE · AU). ~50k merchants by end Y3.
- **Y3-Y5:** the default platform for launching a construction business in launch markets. ~200k merchants by end Y5.
- **Y5-Y10:** the industry infrastructure — insurers reference Nex data, local authorities consult Nex signals, manufacturers plan production against Nex demand forecasts. ~1M merchants globally by end Y10.

### 1.2 Why customers stay

Twelve reasons compounding:

1. Every quote a merchant issues via Nex accumulates in memory that only Nex holds
2. Every project builds a Twin that survives handover and stays live for the building's life
3. Every AI colleague hired accumulates business-specific knowledge that transfers with the merchant, not with a departing employee
4. Regional benchmarks improve as more merchants contribute
5. Trade Brain corrections from thousands of merchants sharpen the platform's expertise
6. Cross-project pattern lending makes each new job more predictable
7. Wholesale channel access (once earned) is not portable
8. Customer portals (SiteBook) create expectations customers now hold
9. Regulatory currency (Compliance Mgr AI) is a subscription value
10. Emergency intervention safety net has psychological value
11. Data portability rights are honoured — merchants CAN leave — which paradoxically makes them stay
12. Ecosystem network effects (referrals, marketplace, Trade Centre) grow monthly

### 1.3 Why competitors struggle to replicate

Per ES-01 §14: substrate depth × time is uncatchable at scale.

Any competitor building a rival AI construction platform from today needs to ship equivalents of every prior phase (Memory Engine, Trade Brains at depth, Estimator with Vision AI, Digital Twin with event sourcing, Market Intelligence with cross-tenant rollups) BEFORE their platform's benefits kick in. Each prior phase is 3-12 months of work with construction domain expertise required at every step. In parallel, Nex ships more.

The lead compounds. A competitor 3 years behind today will be 5 years behind in 3 years.

### 1.4 What the platform looks like

**Year 1 (2027):**
- 8,000-15,000 merchants (assumes 30% quarter-over-quarter growth from a small existing base)
- Full substrate live (Memory V1, Trade Brains V1, Estimator V1, Workforce V0)
- Employment Centre operational for pilot cohort
- UK-focused
- Team: 5-7 engineers + 4 Trade Brain Authors + 1 PM + Legal counsel retained
- Revenue: primarily subscription, ARPU ~£15/merchant/mo blended

**Year 3 (2029):**
- 50,000-100,000 merchants
- Full workforce + Business Builder + Twin V1 + Market Intelligence V1 all live
- Ireland + Australia in Commercial GA
- Enterprise pilot customers
- Team: 15-25 engineers · dedicated SRE · dedicated security · dedicated data
- Revenue: subscription-dominant, first wholesale pilot revenue, ARPU ~£30 blended
- First insurance / manufacturer partnership signed

**Year 5 (2031):**
- 200,000-400,000 merchants
- International: UK · IE · AU · NZ · possibly CA
- Enterprise tier mature
- Twin V3 + Market Intelligence V3 + Workforce V4
- Wholesale revenue meaningful (published Nex Indices, insurance data licensing, manufacturer intelligence)
- Team: 50-80 across engineering + product + go-to-market + partnerships
- Revenue: subscription + wholesale + partnership · ARPU ~£40 blended + wholesale contribution

**Year 10 (2036):**
- 1M+ merchants globally (aspirational, dependent on Y5-Y10 execution)
- Nex referenced by regulators, insurers, manufacturers, and local authorities
- Category-defining infrastructure — construction industry runs on Nex or coordinates with Nex
- Homeowner-side product mature (Twin subscriptions, warranty vaults transferable at sale)
- Team: 200-400 across all functions
- Revenue: diversified across subscription, wholesale, partnership, professional services

**Discipline:** these numbers are projections, not commitments. Anything beyond Y3 is speculative and subject to execution + macro conditions.

---

## Section 2 — Global Infrastructure

### 2.1 The scaling ladder

Per ES-06 §26 · §30:

- **Y1-3 (up to 100k merchants):** single Vercel region (fra1) · single Supabase project (EU-West) · Upstash Redis edge-close
- **Y4 (up to 500k):** add second Vercel region (US-East) for expansion prep · database read replicas · Vercel Edge Functions for latency-critical reads · CDN cache warming per region
- **Y5-7 (up to 2M):** regional Supabase projects for data residency (UK · EU · US · APAC) · cross-region event replication · regional AI provider routing · CDN cache per merchant tradesite tenant
- **Y7-10 (2M+):** specialised stores for hot workloads (ClickHouse for Twin analytics · TimescaleDB for Market Intelligence signal time-series) · dedicated ML inference regions · edge AI for latency-critical trades

### 2.2 Latency budgets

Global latency SLAs per surface:

| Surface                | Local region p95 | Cross-region p95 |
| ---------------------- | ---------------- | ---------------- |
| Public tradesite       | 200ms            | 800ms            |
| Chat response first token | 400ms         | 1500ms           |
| API standard read      | 200ms            | 800ms            |
| Twin timeline query    | 500ms            | 1500ms           |
| Media upload initiation | 500ms           | N/A              |

### 2.3 CDN strategy

- Vercel Edge Network for static + ISR-cached content
- Cloudflare CDN in front for high-volume public tradesites (V4+)
- Regional edge caches per tenant tradesite

### 2.4 Regional databases

Each region gets its own Supabase project when regulatory or latency requirements demand:

- Data residency by legal domicile of merchant
- Cross-region references via merchant_slug (not FK across regions)
- Cross-region analytics via periodic ETL to a global read-only warehouse

### 2.5 Regional AI routing

Per ES-01 §7:

- **Y1-3:** single provider per capability, single region
- **Y4+:** regional routing — European merchants get EU-hosted models where available (Anthropic EU tenancy · Azure OpenAI EU)
- **Y6+:** on-device inference for latency-critical trades (basic Vision AI runs on merchant's phone; server-side Vision for complex analyses only)

### 2.6 Disaster recovery — global

- Cross-region backups (Y4+)
- Regional failover runbooks
- Annual global DR exercise Y5+

### 2.7 Compliance

Per country:

- Data residency where legally required (Y4+)
- Regional privacy law compliance (GDPR · UK GDPR · CCPA · AU Privacy Act · IE Data Protection Act)
- Regional payment compliance (Strong Customer Authentication · PSD2 · equivalent)
- Regional AI Act compliance (EU AI Act · UK AI regulation as it emerges)

### 2.8 Geo-redundancy

- Y1-3: single region with Supabase managed failover to standby
- Y4+: multi-region primary/replica per region
- Y6+: active-active cross-region for critical read paths

### 2.9 Cost optimisation

- LLM caching aggressive (30-day TTL on identical prompts)
- Storage tiering per ES-06 §12
- Compute rightsizing quarterly review
- Reserved capacity for predictable workloads (Y3+)

---

## Section 3 — Enterprise Platform

Enterprise is a specific segment: contractors with 50+ employees, developers with multi-project portfolios, government + infrastructure procurement. Different needs, different price points.

### 3.1 SSO + identity

- **SAML 2.0** — enterprise identity providers (Okta · Azure AD · Google Workspace)
- **SCIM 2.0** — automated user provisioning + deprovisioning
- **OpenID Connect** — modern identity federation
- **Custom identity provider integration** — bespoke for large enterprises

Implementation: Supabase Auth extended with SAML addon (or third-party like WorkOS).

### 3.2 Enterprise roles + delegated admin

Beyond the RBAC in ES-01 §8.2:

- **Enterprise Owner** — root of enterprise hierarchy
- **Regional Admin** — manages one region's merchants
- **Department Head** — manages one department across regions
- **Merchant Manager** — manages a specific merchant instance
- **Delegated Auditor** — read-only across specified scope

Every role has explicit permission scope. Merchants inside an enterprise inherit some settings from parent.

### 3.3 Organisation hierarchies

Enterprise tenants can model:

- Parent company → subsidiaries
- Franchise → franchisees
- Trade association → member firms
- Government body → contractor pool

Each level has visibility + control per configuration. Data aggregation across hierarchy respects K-anonymity where relevant (a franchise HQ seeing franchisee benchmarks doesn't get PII).

### 3.4 Audit centre

- Immutable log across all activities in the enterprise
- Filterable · exportable · legally admissible
- Retention configurable (default 7 years enterprise)
- Compliance-report generation

### 3.5 Compliance dashboard

- Regulation-currency status per merchant across enterprise
- Insurance-verification status
- Certification status
- Audit-log summary per period
- Data-portability + right-to-be-forgotten request tracking

### 3.6 Enterprise AI controls

- Per-agent authority caps (enterprise overrides)
- Autonomy pauseable at enterprise level (across all subsidiary merchants)
- Custom risk rules per Trade Brain
- Per-department AI budget caps

### 3.7 Private AI models

Enterprise-only capability (Y3+):

- Optional dedicated Anthropic tenancy (isolated from other Nex customers)
- Fine-tuned Trade Brains with enterprise-proprietary knowledge (their internal SOPs, historical projects, regional expertise)
- Enterprise-tagged knowledge never crosses into cross-tenant memory (unless explicitly consented)

### 3.8 Enterprise Knowledge Graph

- Add enterprise-specific nodes (their supplier network, their approved product lists, their preferred subcontractors)
- Overlaid on the global graph
- Merchants inside the enterprise see the combined graph; global remains public

### 3.9 Enterprise Trade Brains

- Enterprise-specific fine-tuning
- Enterprise-only playbooks
- Merchant merchants inside the enterprise get enterprise-tuned Brains + global-shared Brains layered

### 3.10 Enterprise reporting

- Portfolio-level dashboards (across all their merchants)
- Custom metric definitions
- White-label branding for delivery to enterprise stakeholders
- Scheduled report delivery via secure channels (SFTP · signed URL · encrypted email)

---

## Section 4 — International Expansion

### 4.1 Country launch order (recommended)

1. **UK (already primary)** — 2026-2027
2. **Ireland** — Q3 2029 · shares language + partial regulatory framework · smallest expansion cost
3. **Australia** — Q4 2029 · English-language · large trade market · different regulations
4. **New Zealand** — Q2 2030 · piggyback on AU work
5. **Canada** — Q3 2030 · large market · bilingual (EN/FR) considerations
6. **UAE** — Q1 2031 · high-margin construction market · English-first for enterprise
7. **US** — Q3 2031 · massive market · state-by-state regulation complexity · deferred until proven playbook
8. **Continental Europe** — Y5+ · language + regulatory complexity per country
9. **Other markets** — Y7+ · demand-driven expansion

### 4.2 Per-country requirements

Every country needs:

- **Language support** — vocabulary layer per Phase 27 Brain
- **Currency** — Stripe multi-currency (already supported per ADR-0010)
- **Tax** — VAT/GST/sales-tax framework per country (Finance module extension)
- **Measurement systems** — metric default; imperial for US
- **Building regulations** — Phase 21 global regulation set extended
- **Trade licensing** — verification integration per country (Gas Safe UK · Master Plumber US · etc.)
- **Construction standards** — country-specific standards library
- **Regional Trade Brains** — Brain regional variants authored per country
- **Local suppliers** — Marketplace + Trade Centre populated with country-specific catalog
- **Regional AI models** — per §2.5

### 4.3 Per-country engineering cost

Rough estimate per country launch:

- 3 Trade Brain regional variants authored: 6 weeks × 3 = 18 weeks part-time contractor
- Regulation framework extension: 4 weeks engineering
- Tax + currency plumbing: 3 weeks engineering
- Supplier catalog seeding: 4 weeks partnership + engineering
- Language localisation (translation review, vocabulary): 4 weeks
- Country-specific verification integrations: 3 weeks engineering
- Compliance review: 4 weeks legal
- Marketing site + tradesite templates: 3 weeks
- Merchant advisory panel + pilot: 12 weeks

**Total: 6-9 months of parallelised work per country · one country at a time until playbook proven · then two at once maximum.**

### 4.4 Country launch checklist

Before Commercial GA in a new country:

- [ ] Legal counsel in-country reviews terms of use + privacy policy
- [ ] Payment infrastructure verified (Strong Customer Authentication or equivalent)
- [ ] At least one Trade Brain fully authored for that country
- [ ] Regulatory framework Phase 21 extended
- [ ] Pilot cohort of 20 merchants (paid)
- [ ] Data residency requirements met
- [ ] Support in-country hours covered
- [ ] Localised documentation

### 4.5 What is NOT launched per country initially

- Wholesale channels (only after sufficient merchant density for K-anonymity)
- Twin homeowner subscriptions (require sufficient completed projects)
- Full Employment Centre catalog (start with core 5 employees)

---

## Section 5 — Partner Ecosystem

### 5.1 Partner categories

Nex partners with:

- **Developers (SDK/API)** — build on top of Nex data + capabilities
- **Merchants (referral partners)** — established merchants recommend Nex to peers, revenue share
- **Manufacturers** — pay for premium placement + product data integration + branded packs
- **Trade associations** — co-branded AI employees, member benefit packages, industry-wide data sharing
- **Governments** — retrofit programme data · regional workforce insights · procurement pipelines
- **Training organisations** — CPD content pipeline · certification prep packages · workforce upskilling
- **Insurance carriers** — anonymised claim-risk data · quality-signal integrations
- **Financial services** — merchant financing based on Nex signals · working-capital products
- **Wholesalers + distributors** — inventory data integration · demand forecasts
- **Enterprise integrators** — implementation partners for large enterprise deployments
- **Certification bodies** — verified certification status + prep pathways

### 5.2 API marketplace

**Y3-Y4:** launch public API allowing partners to build on Nex.

- Rate-limited tiers matching partner size
- Sandbox environment for development
- Documentation + SDKs (JavaScript, Python) as priority
- Partner onboarding runbook

### 5.3 Partner portal

- Partner registration + verification
- API key management
- Usage analytics + billing (where applicable)
- Certification programs (Nex-certified integrator, Nex-certified content provider, etc.)
- Marketplace listing for partners

### 5.4 Revenue sharing models

- **Manufacturer premium placement** — flat monthly fee + optional performance bonus
- **Trade association co-branding** — flat annual license · revenue share on member conversions
- **Insurance data licensing** — annual license + per-query fees
- **Wholesaler inventory integration** — flat monthly fee + revenue share on orders through Nex
- **Enterprise integrator** — commission on referrals · certified-partner priority in queries
- **Merchant referrals** — small commission credit on referred paying merchant

### 5.5 Partner review + governance

- Every partner integration reviewed for merchant benefit
- Sponsored placements always clearly labelled per platform rules
- Partner data access scoped tightly · audited quarterly
- Merchant can opt out of any partner integration surface

---

## Section 6 — AI Evolution

### 6.1 The ten-year AI trajectory

**Y1-2 (2026-2028):** Claude Opus + OpenAI Vision + embeddings via managed APIs. Deterministic composition where possible. No fine-tuning yet.

**Y3-4 (2028-2030):** Fine-tuning becomes viable as merchant density + memory density justify training data quality. Trade Brain fine-tuning per trade × region. Vision AI fine-tuning per construction-specific defect classes.

**Y5-6 (2030-2032):** Federated learning explored for cross-merchant model improvement without data sharing. On-device inference for latency-critical trades (basic Vision AI on merchant's phone). Custom Nex-tuned model deployed alongside general models.

**Y7-8 (2032-2034):** Multi-agent construction planning matures. Autonomous project management with human checkpoints. Enterprise-tuned models widely available. Model diversity (Claude, GPT, Gemini, Nex-tuned) routed automatically per task.

**Y9-10 (2034-2036):** Predictive construction reasoning (predict entire project outcomes from initial scope). Autonomous planning of subcontractor selection + material sourcing + scheduling with human approval remaining mandatory.

### 6.2 Model-agnostic architecture

Per ES-01 §7:

- Every AI call behind the ai/ orchestration layer
- Router picks provider per capability + fallback rules
- Adapter normalises provider APIs to common interface
- Model swap effort target: 1 sprint

**Result:** if Anthropic sells to a bad actor, if OpenAI prices become punitive, if Google Vision improves 10× — Nex swaps providers in one sprint. This is competitive insurance.

### 6.3 Custom models timeline

**When to fine-tune:**

- Y3+ for Vision AI on construction-specific defect detection (large labelled dataset accumulated)
- Y4+ for Trade Brain reasoning (10k+ approved-draft signals per Brain)
- Y5+ for regional pricing calibration (rich memory rollups per region × trade)
- Y6+ enterprise-specific fine-tuning available as tier feature

**When NOT to fine-tune:**

- Whenever generic models perform >90% of fine-tuned quality
- Whenever fine-tuning delays product velocity without user benefit
- Whenever compute cost of fine-tuning exceeds year of API cost saved

### 6.4 Federated learning

Y5+ possibility. Requires:

- Merchant consent framework in place (Phase 26 memory opt-in already establishes precedent)
- Legal review per jurisdiction
- Statistical soundness verified against differential-privacy guarantees
- Only viable if generic model improvement plateaus

### 6.5 Construction Intelligence Network

The long-term vision: Nex operates the most complete real-world construction intelligence graph — regional pricing, labour dynamics, supplier reliability, regulation compliance, project outcomes — all consent-gated and K-anonymised. That graph:

- Powers Nex's own product
- Licensed to insurers, manufacturers, governments (wholesale)
- Published as public indices (branding)
- Fuels regulatory + policy improvement (civic value)

Not achievable in Y1-3. Realistic by Y5-7 given consistent execution.

### 6.6 How Nex stays AI model agnostic

Six discipline rules:

1. Every AI call goes through `ai/` — never direct SDK usage in business logic
2. Every prompt template versioned + tested + swappable
3. Every provider adapter tested against contract
4. Every model swap has a documented playbook
5. Every capability tracked across providers for benchmarking
6. Never build features that require a specific vendor's proprietary capability

If a vendor changes terms, the product survives.

---

## Section 7 — Operations

### 7.1 Customer Success

**Y1:** 1 CS lead handling advisory panel + top-tier merchants directly. Self-service for the majority.

**Y3:** 3-person CS team. Onboarding checklists, health monitoring, expansion motion.

**Y5:** Full CS org with SMB CSMs, Enterprise CSMs, dedicated retention analytics. Onboarding automation and expansion playbooks.

**Y10:** Regional CS teams matching geographic footprint.

### 7.2 Support tiers

- **Tier 1** — automated + community · self-help
- **Tier 2** — human agents · standard business hours per region
- **Tier 3** — engineering escalation · senior support
- **Enterprise** — dedicated CSM + technical account manager · agreed SLA

Support ticket routing driven by tier + urgency + subject.

### 7.3 Training + documentation

- **Y1:** essential docs + video walkthroughs · community-driven Q&A
- **Y2:** Nex Academy launches with structured curricula per role (Bookkeeper Setup · Estimator Optimisation · Twin Best Practices)
- **Y3:** Certified courses with associated credentials · trade association integration
- **Y5:** partner-taught courses (trade schools · community colleges) using Nex-provided curriculum
- **Y10:** Nex Academy is industry-standard for construction operations training

### 7.4 Engineering operations

- **Y1-2:** engineering handles ops in-team · in-hours only
- **Y3:** first SRE hire · rotating on-call
- **Y5:** 3-4 SREs · 24/7 coverage for critical surfaces · geographic on-call rotation
- **Y10:** dedicated global platform ops team

### 7.5 Incident management

- Runbook per service · updated quarterly
- Blameless post-mortem within 48 hours of Sev 1/2
- Findings feed into engineering backlog
- Executive incident review monthly

### 7.6 Platform health

- Public status page (status.thenetworkers.app)
- Real-time uptime monitoring · component-level status
- Historical uptime published quarterly
- Merchant-facing service dashboard in Studio

### 7.7 SLAs

Per ES-06 §23. Formalise SLA agreements with Enterprise customers Y2+.

### 7.8 Internal tooling

- Admin console (Y1) — merchant support, account impersonation with audit
- Feature flag management console
- Backfill + reprocess tools
- Data export self-service for engineering + support
- Merchant health dashboard for CS

---

## Section 8 — Financial Model

**Discipline:** these are projections against stated assumptions, not commitments. Update quarterly against actuals.

### 8.1 Revenue lines

- **Subscription** — dominant Y1-3 · always meaningful
- **Add-ons** — per merchant per feature (Regional Reports · Supplier Intelligence · Specialist AI hires)
- **Marketplace commissions** — NOT taken (per ADR-0003)
- **Trade Centre commissions** — NOT taken (per ADR-0003)
- **Wholesale** — supplier subscriptions · manufacturer intelligence · insurance data · government dashboards · published indices (Y3+)
- **Enterprise** — bespoke contracts · dedicated tenancies · custom Brain fine-tuning (Y3+)
- **Homeowner subscriptions** — Twin post-handover £3.99/mo (Y3+)
- **Professional services** — implementation partners · consultancy · training (Y2+)

### 8.2 Revenue projection framework

Per-merchant blended ARPU by year (assumption-based):

| Year | Merchant count target | Blended ARPU £/mo | Wholesale contribution £/mo per merchant equivalent |
| ---- | --------------------- | ------------------- | ---------------------------------------------------- |
| Y1   | 8k-15k                | £15                 | £0                                                    |
| Y3   | 50k-100k              | £30                 | £2                                                    |
| Y5   | 200k-400k             | £40                 | £8                                                    |
| Y10  | 1M+                   | £45                 | £15                                                   |

These are conservative. Every number depends on execution + macro + specific segment mix.

### 8.3 Cost lines

- **AI (LLM API)** — variable per merchant per month (target £5-15)
- **Cloud infrastructure** — variable per merchant (target £2-12 per tier per ES-06 §27)
- **Payment processing** — Stripe (2.9% + 20p typical UK)
- **Storage** — grows with photos + videos + Twin events
- **Personnel** — scales with merchant density + product breadth
- **Legal + compliance** — fixed floor + growing with international expansion
- **Marketing** — variable · underweighted in Y1-2 (product-led growth), scaled Y3+
- **Customer Success + Support** — scales with merchant count
- **R&D** — sustained investment throughout

### 8.4 Margin structure

Per-merchant contribution margin at steady state:

- Free tier: -£0.50 (subsidised viral loop per ADR-0004)
- Starter £9.99: £7.50 contribution after infrastructure + support
- Professional £14.99: £11 contribution
- Business £24.99: £18 contribution
- Works £39.99: £28 contribution
- Enterprise: 40-50% contribution margin post support

Blended contribution margin target: 65-75% at scale.

### 8.5 Capital requirements

Depends heavily on chosen growth trajectory:

- **Bootstrap route** (5-year to £5M ARR) — no external capital needed if merchant conversion holds
- **Moderate acceleration** (3-year to £10M ARR) — £2-5M capital for growth marketing + international launch
- **Aggressive growth** (2-year to £20M ARR) — £15-25M capital for team expansion + international launch + enterprise sales

Choice is strategic, not technical. Recommend moderate acceleration matched to product maturity.

### 8.6 Scaling strategy for revenue

- Y1: subscription + first specialists (Trade Expert Pack)
- Y2: full Employment Centre catalog · Regional Market Reports launch
- Y3: wholesale channel pilots · enterprise pilot revenue · homeowner subscriptions
- Y5: wholesale meaningful revenue · enterprise mature · marketplace commission model may be reconsidered if partner ecosystem justifies
- Y10: diversified revenue with subscription remaining the base

---

## Section 9 — Risk Management

### 9.1 Commercial risks

| Risk                                    | Severity | Likelihood | Mitigation                                                   |
| --------------------------------------- | -------- | ---------- | ------------------------------------------------------------ |
| Merchant conversion below assumption     | High     | Medium     | Track weekly · adjust marketing spend · improve trial UX      |
| Trial-to-paid rate <30%                  | High     | Medium     | Business Builder polish · Employee first-morning report design |
| Enterprise sales cycles longer than model | Medium   | High       | Underwrite Y3 revenue conservatively                          |
| Wholesale channel takes longer than modelled | High | High        | Underwrite Y3 wholesale as zero; Y4+ moderate                 |
| Competitor releases lookalike feature    | Medium   | High       | Compound moat wins over feature parity · keep shipping        |
| Free tier abuse (fake business creation) | Medium   | Medium     | Companies House verification · rate limits · Turnstile CAPTCHA |
| Pricing model rejection in market        | High     | Low        | Extensive pilot testing · elasticity monitoring               |

### 9.2 Technical risks

| Risk                                             | Severity | Mitigation                                                             |
| ------------------------------------------------ | -------- | ---------------------------------------------------------------------- |
| Substrate schema drift breaks downstream         | Critical | ADR-first for schemas · versioning · comprehensive test suite          |
| Vision AI misinterpretation cascades             | High     | Merchant approval on medium confidence · append-only Twin log          |
| Standing-brief scheduler misses events           | High     | Dead-letter queue · observability · retry policy                       |
| LLM cost per merchant exceeds budget            | High     | Prompt caching · Haiku for low-stakes · per-merchant cap                |
| Database exceeds Supabase managed limits         | Medium   | Scaling roadmap per ES-06 §13                                          |
| Realtime channel scaling ceiling                 | Medium   | Evaluate alternatives at 500k merchants                                 |

### 9.3 AI risks

| Risk                                                  | Severity |
| ----------------------------------------------------- | -------- |
| Fabrication in Business Builder generated content     | Critical |
| Autonomous agent external harm without approval       | Critical |
| Trade Brain drift under regulation change             | High     |
| Vendor lock-in via proprietary capability             | Medium   |
| Model version regression                              | Medium   |

Mitigations per ES-01 §14.7 · guardrails schema-level enforced.

### 9.4 Competition

- **Direct construction SaaS** — outbuild via composition depth
- **Horizontal AI platforms** — outdepth via construction specificity
- **Regional trade software** — outbreadth via ecosystem
- **New entrants with AI-first approach** — the biggest threat · 3-year head start required per §1.3
- **Enterprise construction giants (Autodesk, Procore)** — different segment · pursue partnership rather than compete

### 9.5 Legal

- Cross-tenant data licensing (wholesale) — legal review per jurisdiction · consent-first framework
- AI-employment framing — terms of use disclaim personhood · regulatory monitoring
- International expansion — country legal counsel per launch
- Autonomous action liability — approval-gate discipline · terms clarify apportionment

### 9.6 Cyber security

Per ES-01 §8. Continuous investment.

### 9.7 Scaling risks

Per ES-06 §30. Every scaling checkpoint has documented plan.

### 9.8 Platform dependency

- Vercel + Supabase + Anthropic — critical dependencies
- Contingency plans:
  - Vercel → self-hosted Next.js on containers (2-week migration)
  - Supabase → self-hosted Postgres + Auth (3-month migration)
  - Anthropic → provider swap via ai/ orchestration (1 sprint)

Never fully mitigable · essential risks accepted.

### 9.9 Economic downturns

- Construction is cyclical; downturn = merchant churn
- Diversification via international markets (offset regional downturns)
- Wholesale revenue less cyclical than merchant subscriptions
- Discretionary pricing sensitivity monitored quarterly

### 9.10 Construction market risks

- Regional demand shifts — Nex intelligence surfaces these early
- Regulatory shocks — Compliance Mgr AI + rapid regulation update pipeline
- Supply chain crises — Market Intelligence gives merchants early warning
- Trade shortages — Workforce intelligence tracks + surfaces

---

## Section 10 — Ten-Year Roadmap

### 10.1 Year 1 (2027) — Substrate + revenue

- Memory V1 · Trade Brains V1 · Estimator V1 · Workforce V0 · Employment Centre V0
- 8-15k merchants
- 5-7 engineers
- Merchant advisory panel formalised
- SOC2 Type 1 audit begins
- UK primary market

### 10.2 Year 2 (2028) — Category shift

- Workforce V2 · Business Builder V1 · Twin V0-V1 · Employment Centre V2
- 20-40k merchants
- 10-15 engineers · 1st SRE · 1st security engineer
- Enterprise pilot conversations start
- SOC2 Type 1 complete · Type 2 in progress
- Merchant advisory panel to 15-20

### 10.3 Year 3 (2029) — Wholesale opens

- Market Intelligence V0-V2 · Twin V2 · full Employment Centre with specialists
- 50-100k merchants
- 20-30 engineers · dedicated ops org
- First paying wholesale customer (supplier or manufacturer)
- Ireland + Australia Commercial GA
- SOC2 Type 2 complete
- First enterprise contract signed

### 10.4 Year 5 (2031) — Category leadership

- Twin V3-V4 · Market Intelligence V3 · Workforce V4 · Business Builder V3
- 200-400k merchants
- 50-80 across all functions
- Wholesale revenue meaningful
- 5 international markets in Commercial GA
- Insurance + manufacturer partnerships mature
- Homeowner Twin subscription meaningful revenue line

### 10.5 Year 7 (2033) — Infrastructure

- Federated learning explored · on-device inference for critical trades
- 500-750k merchants
- 100-150 across all functions
- Wholesale + partnership rivals subscription revenue in scale
- Multi-region infrastructure mature
- Enterprise revenue meaningful

### 10.6 Year 10 (2036) — Industry infrastructure

- Nex is reference point for construction SMB globally in served markets
- 1M+ merchants
- 200-400 across all functions
- Category-defining · references in regulator + insurer + academic contexts
- Diversified revenue · resilient to any single-line disruption
- Multi-decade competitive position established

---

## Section 11 — Permanent Operating Principles

These principles guide every future decision. When a decision violates a principle, the decision changes.

### 1. Construction First

Every feature, every AI capability, every partnership evaluated against: "does this help construction businesses succeed?" If the answer is no or unclear, defer.

### 2. Truth Over Hype

Every merchant-facing claim traces to evidence. Fabricated statistics, fake reviews, decorative badges — all rejected. When Nex doesn't know, Nex says so.

### 3. Human Approval for High Risk

Autonomous action for anything that touches money, external communication, legal contracts, or physical work requires human approval. Level 6 auto-execute is opt-in, capped, audited. Level 7 emergency stop always available.

### 4. AI Explains Every Decision

Every AI-drafted recommendation, every workforce action, every prediction traces back to signal + reasoning + confidence. No black-box decisions in the merchant-facing flow.

### 5. Every Feature Strengthens Another

Modules compound. New capabilities are evaluated on how they improve the substrate, not just their standalone value. Isolated features that don't strengthen adjacent modules are deprioritised.

### 6. Memory Before Automation

Nothing gets automated before it's understood. Memory captures what worked, what didn't, what merchants actually value. Automation follows evidence, not enthusiasm.

### 7. Trust Before Scale

Every scaling decision that risks trust (consent frameworks, cross-tenant data, autonomous action) is paused for trust review. Rebuilding trust is 10× harder than earning it. Never gamble it.

### 8. Open Integration

Nex integrates with merchant systems merchants already use. Data portability is a right, not a marketing bullet. If a merchant leaves, they leave with everything.

### 9. Security By Design

Every schema, every endpoint, every audit path designed for security from the first line. Retrofitting security is 10× the cost of building it in.

### 10. Long-Term Thinking

Short-term revenue decisions weighed against 10-year moat impact. Compound wins over sprint. Nex is not built for quarterly headlines; it's built to be the default construction operating system in launch markets for the next generation.

### 11. Merchants Are Colleagues, Not Users

Merchants are the reason Nex exists. Their advisory panel input shapes product. Their voices in feedback loops shape roadmap. Their success is Nex's success.

### 12. Evidence-Or-Silence

The founding principle from ADR-0004 and throughout. Every displayed fact cites evidence. Blank truth beats decorative fabrication. This is non-negotiable across every function.

---

## Section 12 — Final Board Review

**Board framing:** the Board reviews Nex as if considering a Series B investment. Every strategic assumption is challenged. Every risk is named. Every ambiguity is called out.

### 12.1 Challenges to major assumptions

**Assumption:** merchants will pay £30-60/mo blended ARPU by Y5.
**Challenge:** small trades are historically price-sensitive. The market may cap ARPU at £20-30. Mitigation: enterprise + wholesale revenue de-risks the merchant-side ARPU assumption. Board recommends underwriting Y5 revenue at £25 blended, not £40.

**Assumption:** Trade Brain Authors are recruitable at scale.
**Challenge:** master tradespeople are scarce and expensive. Y2-3 hitting 15 authored Brains requires reliable pipeline. Mitigation: build recruiter relationship with trade unions + colleges. Pay above-market honoraria. Board recommends Y1 spend meaningfully on Author recruitment infrastructure.

**Assumption:** wholesale revenue materialises in Y3.
**Challenge:** enterprise / wholesale sales cycles are 12-18 months. Real revenue is more likely Y4-5. Mitigation: do not underwrite Y3 P&L on wholesale. Any wholesale in Y3 is upside.

**Assumption:** international expansion 8 countries by Y5.
**Challenge:** per-country cost is 6-9 months. That's aggressive. Mitigation: Board recommends Y5 target of 4 countries in Commercial GA, not 8.

**Assumption:** competitors take 3+ years to catch up.
**Challenge:** well-funded competitors could accelerate via acquisition rather than build. Mitigation: acquisition target list for defensive M&A · IP protection where feasible · partnership over competition where possible.

**Assumption:** LLM costs stay proportional to revenue.
**Challenge:** model costs are outside Nex's control. Anthropic could raise prices materially. Mitigation: vendor abstraction (already in place per ES-01) · cost-tiered feature access · Haiku for high-volume tasks.

**Assumption:** merchant advisory panel scales.
**Challenge:** 5 merchants per V0 review is fine · 5 for every quarterly release across 10 concurrent slices is not. Mitigation: formalise the panel program · paid honoraria · grow to 15-20.

### 12.2 Structural weaknesses identified

1. **Free tier economics** — subsidised viral loop. If free-tier abuse grows faster than paid-tier conversion, unit economics turn negative. Monitor conversion rate rigorously.
2. **Enterprise motion undefined** — Y3+ requires dedicated enterprise sales. Enterprise motion is not a hobby. Board recommends dedicated enterprise leadership hire Y2 end.
3. **Data licensing legal precedent** — cross-tenant data licensing to insurers/manufacturers/gov may face regulatory pushback. Legal budget must accommodate this.
4. **International compliance surface** — every country adds compliance cost. Legal budget scales with expansion.
5. **Homeowner-side product needs distinct attention** — Twin homeowner subscription is a different product than merchant subscription. Requires distinct product + marketing motion.
6. **AI safety framework needs external validation** — Y2+ engage AI safety consultants for adversarial review.
7. **Retention motion is under-designed** — the Business Builder gets merchants IN. What keeps them IN Y3+? Board recommends dedicated retention product engineering by Y2.

### 12.3 Strategic recommendations

The Board recommends:

1. **Underwrite conservatively.** Board-approved P&L assumes 60% of the roadmap's revenue targets. Anything above is upside. Anything below triggers replanning.
2. **Trade Brain Authorship is the critical resource.** Invest in recruitment infrastructure Q1 2027. This is the single highest-leverage move.
3. **Merchant advisory panel formalised and paid.** Currently informal. Formalise with paid honoraria · rotating membership · structured feedback loops. Cost £50-100k/yr well spent.
4. **Enterprise leadership hire Y2 end.** Enterprise sales is a distinct motion. Don't wing it.
5. **Defensive M&A watchlist.** Identify potential acquirers or acquiree targets. Board reviews annually.
6. **AI safety external validation Y2.** Independent AI safety consultation. Costs £50-150k. Prevents category of risk.
7. **Dedicated retention engineering by Y2.** Onboarding is one motion. Retention is a distinct discipline. Assign engineering ownership.

### 12.4 Board verdict

**Nex is positioned to become the leading Construction Operating System for SMB construction businesses in launch markets, subject to the seven strategic decisions above.**

The platform is defensible. The moat is real (composition × time). The team can execute. The market is large enough to support a multi-billion-dollar outcome.

**Missing pieces:**

1. Enterprise motion not designed
2. Retention motion not designed
3. Legal framework for wholesale not formalised
4. Regional expansion cost model not tested
5. AI safety framework not externally validated
6. Trade Brain Author recruitment not systemically staffed
7. Homeowner-side product not designed as distinct motion

**Every gap is addressable in Y1-Y2 with £2-5M additional investment. None require breakthrough capability. All require deliberate leadership focus.**

**Approval:** with the seven strategic decisions committed to in writing, Board approves Series B funding of £15-25M for 24-month runway to Y3 milestones.

### 12.5 What would make Nex a definitive leader (vs merely successful)

Beyond the current plan:

1. **Consortia partnerships with UK trade associations** by Y2. Turns merchants into stakeholders. Reduces churn structurally.
2. **Official regulator partnerships** for building code updates by Y3. Nex becomes the authoritative regulation-update channel for merchants.
3. **Insurance quality signal partnership** by Y3. Insurers use Nex data to price merchant insurance. Merchants get discount for high Nex quality signals. Two-sided value.
4. **Public sector procurement inclusion** by Y4. UK public sector requires Nex-verifiable merchants for certain contract sizes. Category-locking.
5. **Trade school curriculum integration** by Y4. Every UK apprentice learns Nex as standard tool. New merchants arrive already trained.
6. **Homeowner-standard adoption** by Y5. Selling a house includes handing over Nex Twin. Estate agents reference Nex data.
7. **Global standards body observer status** by Y7. Nex becomes part of standards process (BSI, ISO construction).

These are not features. They are positioning moves. They require CEO + partnership leadership focus, not engineering. They are what turns a successful platform into the industry's operating system.

---

## Coda — The Ten-Year North Star

Nex's ten-year vision, stripped of jargon:

**Every construction business in the served markets runs on Nex. Every home has a Nex Twin. Every regulator, insurer, manufacturer and local authority consults Nex data. Every construction professional starts their career on Nex, and their team of AI colleagues follows them across their working life.**

That is what Nex becomes if every prior blueprint is executed with discipline.

The current position (25 phases shipped, 7 blueprints ready) makes it achievable. The Y1-Y2 execution determines whether it becomes real.

Nothing about this vision requires a technological breakthrough. Everything about it requires sustained focus on the substrate, the merchant, the trust, and the compound.

Ship.

---

**End of ES-10 · Enterprise Scale Blueprint v1.0.**

*Final document of the Nex Execution Series. Together with all prior blueprints, ES-01 through ES-06, the Build Execution Playbook, the Master Architecture, and the 33 phase blueprints — this constitutes the complete operating manual for Nex over the next decade.*

*Update this document as market reality reveals itself. Update the roadmap as competitive dynamics change. Never update the operating principles in Section 11 — they are permanent.*
