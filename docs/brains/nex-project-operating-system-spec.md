# NEX Staircase Project Operating System — Specification

**Data files:**
- `data/staircase-project-workflow.json` — entities, states, notifications, integrations
- `data/staircase-customer-intent-profile.json` — customer profile schema

**Version:** V1
**Completes Phase 5** of Philip's roadmap.

**The pivot:** NEX stops being a Q&A tool. It becomes the operating system for the whole staircase project — from *"I want a nicer staircase"* to *"the installer signed off six months ago and the aftercare check just went out."*

Serves both sides: customer and trade.

---

## What it is (and what it is not)

**It is:** a data model + workflow + notification system + engine handoffs. The connective tissue that holds every existing NEX capability together as one running project.

**It is not:** a dashboard alone. A dashboard is one visible surface of the operating system. The operating system also includes what happens when the customer isn't looking — trades getting notified, milestones tracked, projects paused when stalled, aftercare scheduled.

---

## The core philosophy (six rules)

1. **One project = one source of truth.** Every stage references the same project record. No duplicate data.
2. **Never lose a project.** If a customer goes silent for 30 days, the project pauses (not deletes) and can resume.
3. **Reuse existing engines.** Assessment consumes photo-analysis + diagnosis engines. Design consumes design engine. Quote consumes quote engine. Suppliers consumes matching engine. Never re-implement.
4. **Both sides tracked.** Customer journey and trade journey are two views of the same project state.
5. **Trust always wins.** Verified suppliers surface first. Never rank paid placement over verification.
6. **Evidence trail everywhere.** All messages, photos and milestones persisted per the safety & liability framework.

---

## The customer journey — 7 stages

```
1. Inspiration          → save styles, materials, ideas; NEX learns preference
2. Assessment           → upload photos; NEX generates condition report
3. Design Recommendation → 3 tiers with reasoning + indicative price
4. Supplier Matching     → verified shortlist per selected design
5. Quote Request         → structured enquiry sent to shortlist
6. Installer Selection   → compare quotes and merchants
7. Project Tracking      → survey → design approval → deposit → manufacture → install → handover → aftercare
```

Each stage has:
- **Customer actions** — what the user does
- **NEX actions** — what the platform does automatically
- **Outputs** — records created / updated
- **Typical duration** — days / weeks
- **Quality gates** — e.g. safety-critical findings must be acknowledged before proceeding

---

## The trade journey — parallel to customer

Every project is also visible to the matched trade. Trade dashboard shows a 7-column pipeline:

| Column | Contents | Priority |
|---|---|---|
| **New enquiries** | Quote requests received, not yet responded | 48-hour response target |
| **Quotes out** | Sent, awaiting customer decision | — |
| **In survey** | Customer accepted, survey pending or completed | — |
| **In manufacture** | Deposit paid, in workshop | — |
| **Install scheduled** | Manufacturing done, install date booked | — |
| **Completed this month** | Delivered — source of reviews + referrals | — |
| **Aftercare due** | 6-month or annual check | — |

Trade-side metrics tracked: `avg_time_to_first_quote`, `quote_win_rate`, `customer_rating_avg`, `on_time_delivery_rate`, `aftercare_response_rate`.

The trade side matters because: **without it, the platform is one-sided and trades leave.** A network is only useful if both sides get value.

---

## Customer Intent Profile — the first-class entity

Every customer has an Intent Profile. Every downstream recommendation reads from it.

**Fields captured progressively (never front-loaded):**
- customer_type (homeowner / builder / architect / designer / developer / trade / commercial)
- budget_tier (entry / mid / premium / luxury / bespoke)
- priority (price / speed / design / craftsmanship / practicality / safety / future-proofing) — multi-select
- style_preference (10 styles + "unsure")
- house_type (Victorian terrace / 1930s semi / modern new-build / Georgian / cottage / apartment / self-build / commercial)
- timeline (urgent < 4wks / standard 4-12wks / flexible 3-6mo / long > 6mo)
- children_in_home (activates 100mm sphere + no-horizontal-rail rules)
- elderly_or_mobility_user (activates both-side handrails, contrast nosings)
- pets_in_home (harder-wearing finish recommendations)
- current_stair_status (new build / replace / refurbish / repair / unsure)
- postcode
- communication_preference
- notes (free text)

**Progressive capture** — never a form. Each field captured when it becomes relevant to the flow. `customer_type` + `postcode` at first interaction. `budget` + `priority` before design recommendations. `communication_preference` before enquiries go out.

**Refinement over time** — the profile evolves as NEX learns from behaviour. If customer selects premium option 3 times, budget_tier updates upward. Customer always sees and can correct.

## How Intent Profile shapes the flow — worked examples

| Customer profile | Design engine behaviour | Supplier matching behaviour | Quote engine behaviour |
|---|---|---|---|
| Homeowner · price-first · mid budget · 1930s semi · modern | Present mid first, include entry variant, defer premium | Prefer verified regional over premium national; show trade-account bonus | Lead with lower range; itemise labour vs material |
| Architect · craftsmanship-first · premium · luxury contemporary · new build | Present premium + luxury tiers; skip entry; curved/floating options | Prefer bespoke manufacturers with portfolio; skip kit specialists | Show full range; emphasise material spec + finish detail |
| Builder · speed-first · mid · various | Show mid; standard specs that can be manufactured quickly | Filter by lead-time availability; highlight trade-account | Fast-track lead-time badge; note if premium options add weeks |
| Elderly · safety-first · mid · traditional 1930s semi | Prefer classic_period; both-side handrails default; contrast nosings; no open risers | Prefer accessibility-credentialled suppliers | Include cost of accessibility features |

---

## Entity model

11 entities. Every field appears once (single source of truth).

- **customer** — identity + intent_profile reference
- **intent_profile** — captured progressively, refined over time
- **project** — canonical record, has one current_stage
- **inspiration_collection** — Stage 1 saved images and preferences
- **assessment** — Stage 2 photos + NEX-generated condition report
- **design_recommendation** — Stage 3 three-tier options with reasoning
- **supplier_match** — Stage 4 top-5 matched suppliers per role
- **quote_request** — Stage 5 structured enquiry sent to shortlist
- **quote_received** — reply from a merchant with price + spec + lead time
- **installer_selection** — Stage 6 comparison data + chosen merchant
- **project_milestone** — Stage 7 events (survey / deposit / manufacture / install / handover / aftercare)
- **notification** — event fired to customer or trade
- **message** — thread persisted between customer and merchant

Every record has `project_id` so all data hangs off the one canonical project.

---

## State machine

15 states with defined transitions:

```
inspiration → assessment → design_recommended → suppliers_matched
  → quotes_requested → quotes_received → installer_selected
  → survey_booked → survey_completed → design_approved
  → deposit_paid → manufacturing → installation_scheduled
  → installation_in_progress → completed → aftercare
```

Backward transitions allowed with reason logged (e.g. customer re-requests assessment after finding more defects).

---

## Notifications

**Customer-facing (9 events):** assessment complete · designs ready · quote received · quote expiring · survey scheduled · milestone completed · installation booked · handover pack ready · aftercare due.

**Trade-facing (7 events):** new enquiry · customer response · quote accepted · survey booking · milestone update needed · customer message · review received.

**System alerts (4):**
- `project_stalled_30_days` — pause + notify both sides + offer resume
- `safety_critical_finding_in_assessment` — block proceed-to-design until acknowledged
- `unverified_supplier_recommended` — auto-attach caveat wording
- `customer_data_retention_expiry` — GDPR-driven anonymisation

Channels: email · SMS · in-app · push (per `communication_preference`).

---

## Engine integrations — no duplication

The Operating System is glue. It does not re-implement any capability.

| Stage | Consumes existing engine |
|---|---|
| Assessment | `photo-analysis-rules.md` · `staircase-diagnosis-engine.json` · `staircase-defect-responsibility-matrix.json` |
| Design | `staircase-design-recommendation-rules.json` |
| Quote | `staircase-quote-engine.json` |
| Supplier match | `staircase-supplier-matching-rules.json` · `uk-merchant-directory.json` |
| Safety flags | `staircase-safety-liability-framework.md` |
| Trust rules | `nex-business-listing-and-trust-architecture.md` |
| Confidence rules | `nex-answer-engine-confidence-model.md` |
| Country context | `staircase-country-packs/*.json` |

If a project needs a capability that has no engine yet, that becomes a gap to build — never re-implemented ad hoc.

---

## The Stage 5 value proposition — structured enquiry

Traditional route:
> Customer: *"Hi, I need stairs."*
> Trade: (spends 30 minutes on the phone extracting basic information)
> Trade: (visits site to see what customer meant)
> Trade: (produces quote based on partial information)
> Customer: (gets three wildly different quotes because each trade got different information)

NEX route:
> Customer completes Stages 1-4.
> NEX auto-generates structured enquiry containing: intent profile summary, condition report, selected design tier + spec, indicative budget range, photos, postcode, preferred survey dates.
> Trade receives complete enquiry — can quote quickly and accurately.
> Three trades quote against the same brief — customer can compare like-with-like.

**This saves trades hours of back-and-forth on every job.** It also produces better outcomes for customers.

---

## Data persistence rules

- One project = one canonical record
- Never lose a project (stalled 30 days → pause, not delete)
- All milestone photos + messages persisted permanently per safety & liability evidence rules
- GDPR retention schedule for personal data (V2 detailed spec)
- Trade-side aggregated metrics (avg response time, win rate) — individual project data belongs to customer
- Customer can export project history anytime
- Customer can delete account — project records anonymised, retained for statistical / evidence purposes

---

## Success metrics — V1

**Customer side:**
- Time from enquiry to first quote
- Number of quotes received per project
- Conversion from quote → deposit
- Customer satisfaction at handover

**Trade side:**
- Qualified-enquiry conversion rate
- Average project value
- Review score average
- Repeat customer rate

**Platform side:**
- Project completion rate (start → completed)
- Aftercare response rate at 6mo / 12mo
- Stalled project recovery rate
- Trust level progression rate (Listed → Claimed → Verified)

---

## Not in V1

- Live payment processing (Stripe or trade-payments integration → V2)
- Real-time in-app messaging (V1 uses email + in-app notifications)
- In-browser CAD file rendering (V1 attaches files, V2 renders)
- AR preview of staircase in customer's own hallway
- Multi-project management for architects / developers with parallel projects
- Trade-side pricing tools (helping tradesperson build the quote inside NEX)
- Automated review request workflow
- Cross-project analytics (regional demand, popular styles) — the raw data will exist, dashboards come later
- Trade-to-trade referrals (manufacturer needs installer via NEX)

---

## The Phase 5 tick

Phase 5 is now formally shipped as a complete Project Operating System spec:

- ✅ Data model (11 entities + Customer Intent Profile as first-class)
- ✅ Workflow states (15 states + allowed transitions)
- ✅ 7-stage customer journey with actions / outputs / durations / quality gates
- ✅ Parallel 7-column trade journey with metrics
- ✅ Notification triggers (16 events across customer, trade and system)
- ✅ Engine integrations mapped (no duplication)
- ✅ Persistence rules + GDPR-awareness
- ✅ Success metrics defined for V1
- ✅ Not-in-V1 scope explicit

**The pivot is complete.** NEX now has the spec to convert a customer idea into a tracked staircase project with both sides engaged. This is what a staircase company can actually use every day.

---

## What Phase 6 looks like now

Per Philip's updated guidance: **quality over quantity.** Not 1000 random records — **250 high-quality verified records first**, then 500, then 1000+.

Each record needs: category · location · products · staircase relevance · verification status · website · last checked date + source.

That data-quality-fields requirement is the next merchant-directory extension — the current 119 records need to grow both in count and in field completeness before pushing to 250+.
