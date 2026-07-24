# Nex Pre-Launch Implementation Plan v1.0

**Engineering execution manual · 2026-07-23**
**Purpose:** convert every Critical + High priority issue from `NEX_PRE_LAUNCH_VALIDATION_REPORT_V1.md` into buildable engineering work. Developers execute directly from this document.

**Scope:** 16 Critical + 30 High = 46 issues. 5 sprints × 2 weeks = 10-week critical path from Validation Ready → Closed Beta.

**Related documents:** ES-01 Engineering Bible (architectural authority) · ES-02 Data & Event · ES-03 API & Service · ES-06 DevOps · Validation Report (source of every issue below).

---

## Section 1 — Master Implementation Roadmap

### 1.1 Full issue list with engineering estimates

Every Critical + High issue from the Validation Report, with effort · risk · dependencies · user impact · commercial impact. Effort in engineer-weeks (single engineer). Risk L/M/H.

| # | Issue | Effort | Risk | Depends on | User impact | Commercial impact |
|---|-------|--------|------|------------|-------------|-------------------|
| C-1 | Save Business Builder progress | 1.5w | L | Session state DB | Prevents 60% drop-off | High acquisition |
| C-2 | Companies House verification fallback | 2w | M | Support workflow | Prevents 100% blocker | High conversion |
| C-3 | Estimator sanity bands | 2w | M | Trade Brain pricing | Prevents wrong quotes | High trust |
| C-4 | Merchant-configurable minimum margin floor | 1.5w | L | Settings schema | Protects margin | High retention |
| C-5 | Weekly digest alternative | 3w | M | Notifications engine | Prevents churn driver #1 | Critical retention |
| C-6 | Approval inbox batch actions | 1w | L | Approval UI | Reduces friction | High retention |
| C-7 | K-anonymity honest surface | 1w | L | Memory reader | Prevents "give up" signal | Medium retention |
| C-8 | Memory correction UX | 2w | M | Correction chain UI | Trust building | Medium retention |
| C-9 | Empty Twin friendly state | 1w | L | Twin UI | Prevents "looks broken" | High Twin adoption |
| C-10 | Vision AI medium-confidence approval | 2w | H | Approval queue | Prevents state drift | Critical trust |
| C-11 | Payment failure recovery | 2w | M | Stripe webhooks | Prevents involuntary churn | Critical revenue |
| C-12 | VAT window reminders | 2w | L | Finance module | Reduces merchant anxiety | Medium retention |
| C-13 | Country-specific onboarding paths | 3w | M | Global regs module | Enables Ireland/Australia | High expansion |
| C-14 | On-site photo upload UX | 2w | M | Media service | Adoption blocker | High Twin+SiteBook |
| C-15 | Merchant-side voice scope capture | 2w | L | Web Speech API | On-site adoption | High engagement |
| C-16 | Multi-user team RBAC | 4w | H | Auth + RLS | Enables mid-tier | Critical enterprise |
| C-17 | Admin diagnostic tools | 3w | M | Admin surface | Support scalability | Medium ops |
| H-1 | First-morning report guardrail | 1w | L | Workforce runtime | Prevents dead trials | Medium acquisition |
| H-2 | Supplier onboarding flow | 3w | M | Business Builder fork | Missing channel | Medium expansion |
| H-3 | Bulk migration from Xero | 3w | M | Xero API + mapping | Removes migration friction | High conversion |
| H-4 | Bulk migration from ServiceTitan | 3w | M | ServiceTitan API | Same | High conversion |
| H-5 | Multi-trade completeness check | 1.5w | L | Estimator scope parser | Prevents estimate gaps | Medium trust |
| H-6 | Estimator confidence drill-down | 1.5w | L | Estimator UI | Reduces confusion | Medium trust |
| H-7 | Alternate-material picker | 2w | M | Materials module | Sales tool | Medium ARPU |
| H-8 | Agent conflict resolution UI | 2w | M | Mesh conflict engine | Reduces confusion | Medium retention |
| H-9 | Emergency stop granular scope | 1.5w | L | Workforce runtime | Safety refinement | Medium trust |
| H-10 | Vacation mode | 1w | L | Notifications | Real-world usability | Medium retention |
| H-11 | Regional dashboard teaser | 1.5w | L | Memory reader | Tier upgrade driver | High ARPU |
| H-12 | Cross-project memory search UI | 2w | L | Vector + text search | Retention driver | High retention |
| H-13 | Twin transfer to new merchant | 3w | M | Twin ownership model | Handles reality | Medium trust |
| H-14 | Timeline scrub performance | 2w | L | Twin snapshot cache | Prevents SLA breach | Medium reliability |
| H-15 | Homeowner portal notifications | 2w | L | Notify engine | Adoption booster | Medium homeowner ARPU |
| H-16 | Supplier verification badge | 1.5w | L | Register verifier | Trust surface | Medium marketplace |
| H-17 | Reverse marketplace RFQ | 3w | M | Marketplace + CRM | New channel | Medium acquisition |
| H-18 | Trade Centre order status | 2w | L | Courier APIs | Reduces support | Medium retention |
| H-19 | Cash horizon widget | 1w | L | Finance snapshot | Daily-use surface | High engagement |
| H-20 | Overdue invoice bulk chase | 1.5w | L | Draft engine | Reduces manual work | Medium finance |
| H-21 | Deposit/staged payment | 3w | M | Invoice model + Stripe | Enables big projects | High ARPU |
| H-22 | Regional regulation dashboard | 2w | L | Global regs | Compliance tool | Medium retention |
| H-23 | Multi-jurisdiction team support | 2.5w | M | Team RBAC | Cross-border merchants | Medium expansion |
| H-24 | GDPR export usability | 2w | H | Portability workflow | Compliance | Critical legal |
| H-25 | Right-to-be-forgotten workflow | 3w | H | Cascade delete | Compliance | Critical legal |
| H-26 | Mobile-friendly approval inbox | 2w | L | UI redesign | On-site usability | High engagement |
| H-27 | Offline SiteBook entries | 3w | M | Local storage sync | Real-world usability | High engagement |
| H-28 | Enterprise trial programme | 2w | L | Trial billing | Enterprise motion | High enterprise |
| H-29 | SLA dashboard per merchant | 1w | L | Uptime data | Trust surface | Medium retention |
| H-30 | Model outage graceful degradation | 3w | H | AI orchestration | Reliability | Critical trust |

**Total effort:** ~95 engineer-weeks · deliverable across 5 engineers × 10 weeks = 50 engineer-weeks with parallelisation. Selection prioritisation below.

### 1.2 Milestone grouping (5 milestones matching 5 sprints)

**Milestone 1 · Trust Foundation (Sprint 1)** — must-ship legal + safety + payment recovery
- C-11 Payment failure recovery
- C-16 Multi-user team RBAC (start · 4w spans sprints 1-2)
- H-24 GDPR export usability
- H-25 Right-to-be-forgotten workflow
- H-30 Model outage graceful degradation
- C-10 Vision AI medium-confidence approval

**Milestone 2 · Approval + Workforce Sanity (Sprint 2)** — kill the biggest churn driver
- C-5 Weekly digest alternative
- C-6 Approval inbox batch actions
- H-8 Agent conflict resolution UI
- H-9 Emergency stop granular scope
- H-10 Vacation mode
- H-1 First-morning report guardrail
- C-16 continues

**Milestone 3 · Onboarding + Estimator (Sprint 3)** — conversion + immediate value
- C-1 Save Business Builder progress
- C-2 Companies House verification fallback
- C-3 Estimator sanity bands
- C-4 Merchant margin floor
- H-3 Xero migration
- H-5 Multi-trade completeness
- H-6 Confidence drill-down
- H-7 Alternate-material picker

**Milestone 4 · On-Site + Memory + Twin (Sprint 4)** — daily-use surfaces
- C-14 Photo upload UX
- C-15 Voice scope capture
- H-27 Offline SiteBook
- H-26 Mobile approval inbox
- C-9 Empty Twin state
- H-14 Twin scrub perf
- H-15 Homeowner notifications
- C-8 Memory correction UX
- C-7 K-anonymity honest surface
- H-11 Regional teaser
- H-12 Cross-project search

**Milestone 5 · Commercial + International + Enterprise (Sprint 5)** — expansion enablers
- C-12 VAT reminders
- H-19 Cash horizon widget
- H-20 Overdue bulk chase
- H-21 Staged payments
- C-13 Country-specific onboarding
- H-22 Regional regulation dashboard
- H-23 Multi-jurisdiction team
- H-16 Supplier verification
- H-18 Trade Centre order status
- H-2 Supplier onboarding
- C-17 Admin diagnostic tools
- H-28 Enterprise trial
- H-29 SLA dashboard
- H-4 ServiceTitan migration
- H-13 Twin transfer
- H-17 Reverse marketplace

**Optimum implementation order rationale:** trust foundation first (legal + safety cannot be shortcut) → workforce sanity (kills #1 churn driver) → onboarding + estimator (conversion) → daily-use surfaces (retention) → expansion enablers (scale).

---

## Section 2 — Critical Implementation Specifications

Full 16-field specs for every Critical issue. Format is disciplined; developers pick up and implement.

### C-1 · Save Business Builder Progress

- **Problem:** 60% of merchants abandoning Business Builder mid-conversation; state lost on tab close
- **Root Cause:** onboarding session state ephemeral; no persistence, no resume
- **Engineering Solution:** persist session on every step transition; email resume link after 10 min inactivity
- **Database Changes:** table `hammerex_nex_builder_sessions` (already blueprinted per Phase 31) — add `last_active_at`, `completion_state` enum, `resume_token`
- **API Changes:** `POST /api/nex/builder/sessions/<id>/checkpoint` on every step transition · `GET /api/nex/builder/sessions/<resume_token>` resumes
- **Frontend Changes:** autosave indicator · resume banner on return · session-list surface in Studio
- **Backend Changes:** session-state serialiser · resume-link generator · Vercel Cron for stale-session email (24h · 3d · 7d)
- **AI Changes:** none · deterministic
- **UX Changes:** progress bar with 5 checkpoints · "you can leave anytime" copy
- **Testing:** session persistence across browser close · resume from email link · session expiry after 30 days
- **Security:** resume tokens signed (JWT) · single-use per email cycle · rate limit resume-link generation
- **Migration:** additive · no data migration
- **Rollback:** feature flag `builder.persistent_sessions` · toggle off returns to ephemeral behaviour
- **Definition of Done:** merchant closes tab at step 3 · receives email in 10 min · clicks link · returns to step 3 · completes onboarding
- **Acceptance Criteria:** drop-off between step-1 and step-5 measured at <25% (vs 60% baseline in simulation)

### C-2 · Companies House Verification Fallback

- **Problem:** merchant blocked entirely when Companies House API is down
- **Root Cause:** hard dependency without fallback
- **Engineering Solution:** graceful degradation → manual verification queue with 24h SLA
- **Database Changes:** `hammerex_nex_verified_claims` (per Phase 31) — add `verification_status` enum (`auto_verified` | `pending_manual` | `manually_verified` | `rejected`)
- **API Changes:** `POST /api/nex/builder/sessions/<id>/request-manual-verification` · `GET /api/nex/admin/verification-queue` (admin)
- **Frontend Changes:** verification-pending badge on merchant profile · admin verification queue UI
- **Backend Changes:** verification retry queue (1min, 5min, 30min) · fallback to manual after 3 failures
- **AI Changes:** none
- **UX Changes:** "we're verifying you (usually 24h)" copy · unblocked onboarding continuation
- **Testing:** simulate CH API down · verify graceful degradation · test admin approval flow
- **Security:** admin verification requires 2FA · audit log every manual verification
- **Migration:** additive
- **Rollback:** feature flag `verification.manual_fallback` · toggle off requires API up
- **Definition of Done:** merchant onboards through CH-down scenario · admin approves manually · merchant unblocked within 24h
- **Acceptance Criteria:** zero blocked onboardings during CH outage in simulation

### C-3 · Estimator Sanity Bands

- **Problem:** Vision AI extracts wrong dimensions → estimate off 200%+ · merchant sends embarrassing quote
- **Root Cause:** no cross-check between AI-extracted values and typical bands per scope
- **Engineering Solution:** every measurement extracted by Vision cross-checked against typical bands from Trade Brain pricing_model · outliers flagged
- **Database Changes:** `hammerex_nex_estimator_bands` — subject, region, trade, min_typical, max_typical, updated_at · seeded from Phase 27 Brain pricing_model
- **API Changes:** `POST /api/nex/estimator/sessions/<id>/generate` returns `sanity_flags: SanityFlag[]` when any measurement outside band
- **Frontend Changes:** flagged line items highlighted with warning icon · merchant sees "this looks unusually high/low — verify measurement"
- **Backend Changes:** sanity check function in estimator pipeline · runs post-Vision, pre-composition
- **AI Changes:** confidence adjusted downward for out-of-band measurements
- **UX Changes:** warning inline · click to re-enter manually · "AI vs typical" comparison
- **Testing:** feed known-bad photos · verify sanity flags fire · verify merchant can correct
- **Security:** none
- **Migration:** seed table from Brain data
- **Rollback:** feature flag `estimator.sanity_bands`
- **Definition of Done:** merchant uploads photo of 5m wall · Vision extracts 15m by error · sanity band flags · merchant corrects to 5m · quote correct
- **Acceptance Criteria:** in 100 simulated bad-photo tests, ≥95% of >50% off-band values are flagged

### C-4 · Merchant Margin Floor

- **Problem:** Estimator suggests price below merchant's minimum acceptable margin
- **Root Cause:** merchant-specific margin not captured; Estimator uses regional median
- **Engineering Solution:** merchant setting `minimum_margin_pct` · Estimator warns + refuses to draft below without explicit override
- **Database Changes:** `hammerex_nex_merchant_settings` — column `minimum_margin_pct` (default 15) · column `minimum_margin_pct_override_reason` (audit log per override)
- **API Changes:** `PATCH /api/nex/merchants/<slug>/margin-settings` · `POST /api/nex/estimator/sessions/<id>/override-margin` with reason
- **Frontend Changes:** margin setting in Studio Settings · override dialog with reason field · warning banner in estimate preview
- **Backend Changes:** margin check in Profit Optimiser (Phase 28) · block draft below floor without override token
- **AI Changes:** Estimator prompt includes margin floor · CEO AI daily report flags margin drift
- **UX Changes:** merchant-set slider (10-40% typical range) · in-preview margin display with red state below floor
- **Testing:** margin-below-floor scenarios · override with reason · CEO briefing surfaces
- **Security:** override audit-logged with actor + reason
- **Migration:** default all existing merchants to 15% floor · prompt them to review during first login post-deploy
- **Rollback:** feature flag `estimator.margin_floor`
- **Definition of Done:** merchant sets 25% floor · Estimator drafts at 22% · warning shown · merchant either accepts override or edits scope
- **Acceptance Criteria:** simulated merchants who set a floor never send quotes below without acknowledgment

### C-5 · Weekly Digest Alternative

- **Problem:** approval fatigue is #1 churn driver · 40 approvals/day burns merchants out
- **Root Cause:** per-action approval is the only mode
- **Engineering Solution:** merchant-selectable approval cadence · realtime · daily digest · weekly digest
- **Database Changes:** `hammerex_nex_workforce_approval_preferences` — merchant_slug, cadence enum (`realtime` | `daily` | `weekly`), daily_time · weekly_day
- **API Changes:** `PATCH /api/nex/workforce/approval-preferences` · `GET /api/nex/workforce/digest/<cadence>/preview`
- **Frontend Changes:** cadence toggle in Workforce settings · digest email with inline approve/reject · digest surface in Studio (bulk-review UI)
- **Backend Changes:** digest composer (aggregates pending approvals per cadence) · scheduled sender · retention flag preserves urgent approvals from batching
- **AI Changes:** CEO AI composes digest narrative in Nex voice · groups by agent · sorts by priority
- **UX Changes:** merchant sees consolidated Monday briefing · can approve entire batches with sub-selects · "keep as realtime" toggle per action class (e.g. keep payments realtime, batch everything else)
- **Testing:** merchant on weekly · approvals accumulate through week · Monday digest ships · batch approve works
- **Security:** urgent + financial actions never batched · always immediate
- **Migration:** default all existing merchants to realtime · prompt during first login post-deploy
- **Rollback:** feature flag `workforce.digest_mode`
- **Definition of Done:** merchant switches to weekly · Monday 8am receives digest with 20+ pending approvals · reviews in 15 min · approves batch
- **Acceptance Criteria:** simulated merchants on weekly-digest cadence show measurably lower churn signal than realtime

### C-6 · Approval Inbox Batch Actions

- **Problem:** merchants approve individually · slow · repetitive
- **Root Cause:** approval UI is one-at-a-time
- **Engineering Solution:** multi-select + bulk approve/reject actions with per-item override
- **Database Changes:** none
- **API Changes:** `POST /api/nex/workforce/approvals/batch/approve` accepts array · same for reject · atomic (all-or-none per merchant preference)
- **Frontend Changes:** checkbox column · "Select all" per agent group · bulk approve button · confirmation dialog with count
- **Backend Changes:** batch handler · idempotency per approval_id
- **AI Changes:** none
- **UX Changes:** grouped by agent · sortable by priority · keyboard shortcuts (Space to select, Enter to approve)
- **Testing:** batch of 20 approvals · atomic success · atomic failure recovery
- **Security:** audit log records batch operation with all approval_ids
- **Migration:** additive
- **Rollback:** feature flag `workforce.batch_actions`
- **Definition of Done:** merchant selects 15 approvals · clicks approve · sees success · agents execute
- **Acceptance Criteria:** time-to-approve-daily-batch drops by 70% vs individual clicking

### C-7 · K-anonymity Honest Surface

- **Problem:** merchants see "not enough data" and give up
- **Root Cause:** K-anonymity gate returns empty state without context
- **Engineering Solution:** when K threshold not met, show what would be visible + estimated timeline to unlock (based on merchant density growth rate)
- **Database Changes:** track contributor count over time per rollup slice for growth-rate calculation
- **API Changes:** `GET /api/nex/memory/rollup?subject=X&region=Y` returns `{status: 'insufficient_data', current_contributors, min_required, estimated_days_to_unlock}` when gate not met
- **Frontend Changes:** informative empty state showing progress toward unlock · "3 of 5 merchants in your region have contributed — likely unlocked within 6 weeks" · subscribe-to-notify option
- **Backend Changes:** growth-rate calculator (rolling 90-day contribution count) · unlock predictor
- **AI Changes:** none
- **UX Changes:** progress bar toward K-min · optimistic timeline
- **Testing:** low-density region shows honest state · gradual unlock as contributors accumulate
- **Security:** contributor count itself is a bounded read (never reveals identities)
- **Migration:** additive
- **Rollback:** feature flag `memory.honest_density_surface`
- **Definition of Done:** merchant in low-density Cardiff sub-trade sees "3/5 contributors · likely 6 weeks to unlock" instead of empty state
- **Acceptance Criteria:** exit-survey signal from "gave up" reduced measurably vs baseline

### C-8 · Memory Correction UX

- **Problem:** merchant sees wrong benchmark · no correction path
- **Root Cause:** correction chain is a backend feature · no UI
- **Engineering Solution:** inline "correct this" button on every displayed benchmark/memory row
- **Database Changes:** none (correction chain already exists per Phase 26)
- **API Changes:** `POST /api/nex/memory/<id>/correction` with `value`, `reason`, `evidence_url?`
- **Frontend Changes:** small pencil icon on every memory-derived number · click opens correction dialog · corrected values immediately visible in merchant's view · corrections aggregate for cross-tenant re-eval
- **Backend Changes:** correction handler · re-eval cron aggregates corrections into rollup adjustment
- **AI Changes:** CEO AI notes corrections in weekly briefing
- **UX Changes:** correction is casual · one click · one text field · reason optional
- **Testing:** correction persists · appears in merchant's view · aggregates cross-tenant
- **Security:** correction author logged · audit trail per row
- **Migration:** additive
- **Rollback:** feature flag `memory.inline_correction`
- **Definition of Done:** merchant sees "regional median day rate £280" · corrects to £320 with reason "London zone 1" · own view updates · aggregate re-evaluates
- **Acceptance Criteria:** correction rate >5% of displayed memory rows over 30 days (healthy engagement signal)

### C-9 · Empty Twin Friendly State

- **Problem:** new Twin looks broken to merchant + homeowner
- **Root Cause:** Twin UI assumes populated state
- **Engineering Solution:** guided onboarding cards for first-time Twin state
- **Database Changes:** none
- **API Changes:** `GET /api/nex/twin/<project_id>` returns `is_empty: true` with `suggested_actions` array when no events
- **Frontend Changes:** empty-state UI with 3 cards: "Upload first photo" · "Record first delivery" · "Send Twin link to customer" · each is one click to action
- **Backend Changes:** suggestion generator based on project scope
- **AI Changes:** Site Mgr AI drafts a welcome message for merchant + homeowner
- **UX Changes:** friendly onboarding · never shows "0 events" as a bare number
- **Testing:** new Twin renders empty state · guided action completes · state transitions naturally
- **Security:** none
- **Migration:** additive
- **Rollback:** feature flag `twin.empty_state_ui`
- **Definition of Done:** merchant creates Twin · sees three actionable cards · uploads first photo · Twin state populated
- **Acceptance Criteria:** 80%+ of new Twins have first event within 24 hours (vs simulated 45%)

### C-10 · Vision AI Medium-Confidence Approval

- **Problem:** wrong Vision classification silently updates Twin state
- **Root Cause:** all Vision output auto-appends to Twin log
- **Engineering Solution:** Vision events at medium confidence route through approval inbox before appending
- **Database Changes:** `hammerex_nex_twin_events` adds `approval_state` enum (`auto_appended` | `pending_approval` | `approved` | `rejected`) · `approval_required_confidence` merchant setting
- **API Changes:** `POST /api/nex/workforce/approvals/<id>/approve` handles Vision approvals · Twin timeline shows pending events greyed
- **Frontend Changes:** pending Vision events shown with "review before adding" affordance · approve inline
- **Backend Changes:** Vision reconciler queues medium-confidence events instead of appending · high-confidence appends directly · low-confidence logged for training but never applied
- **AI Changes:** confidence threshold per Vision finding type (defect detection stricter than progression detection)
- **UX Changes:** merchant sees "3 pending Twin updates" in Approval Inbox
- **Testing:** medium-confidence findings enter queue · approval appends event · rejection discards
- **Security:** rejections logged for pattern analysis
- **Migration:** additive · existing events unaffected
- **Rollback:** feature flag `vision.confidence_gate`
- **Definition of Done:** blurry photo generates medium-confidence "possible damp patch" finding · merchant sees in queue · reviews · rejects · Twin unchanged
- **Acceptance Criteria:** false-positive Twin appends drop by 90%+ in simulation

### C-11 · Payment Failure Recovery

- **Problem:** Stripe subscription payment fails · merchant service degraded
- **Root Cause:** no automated retry + notification flow
- **Engineering Solution:** 3-retry ladder · dunning emails · grace period · graceful downgrade
- **Database Changes:** `hammerex_nex_subscription_events` — event_kind, merchant_slug, next_retry_at, grace_period_ends_at, notification_state
- **API Changes:** `POST /api/nex/webhooks/stripe` handles `invoice.payment_failed` · merchant portal `GET /api/nex/finance/subscription/status`
- **Frontend Changes:** in-Studio banner when payment failed (dismissible for 24h) · payment method update flow
- **Backend Changes:** retry scheduler (1d · 3d · 7d) · downgrade job at 14d grace-period end · notification composer
- **AI Changes:** Finance Mgr AI drafts personalised dunning message
- **UX Changes:** friendly copy ("looks like your card had an issue — quick update takes 30 seconds")
- **Testing:** Stripe webhook simulation · full retry ladder · grace period expiry · downgrade path
- **Security:** payment method update via Stripe Customer Portal (never handled by Nex directly)
- **Migration:** additive
- **Rollback:** feature flag `payments.recovery_ladder`
- **Definition of Done:** simulated failed payment · dunning ladder triggers · merchant updates card on day 5 · subscription resumes
- **Acceptance Criteria:** involuntary-churn rate <2% of failed-payment events (vs simulated 15%)

### C-12 · VAT Window Reminders

- **Problem:** merchants miss VAT deadlines
- **Root Cause:** no proactive reminder
- **Engineering Solution:** Finance Mgr AI drafts VAT return + calendar reminders at 30d/14d/7d/1d before deadline
- **Database Changes:** `hammerex_nex_merchant_vat_schedule` — merchant_slug, scheme (Cash/Accrual), quarter_end, submitted_at
- **API Changes:** `GET /api/nex/finance/vat/window` (existing per ES-03) · `POST /api/nex/finance/vat/return/draft`
- **Frontend Changes:** VAT dashboard widget · countdown display · draft review UI
- **Backend Changes:** VAT deadline cron (daily) · deadline calculator per scheme · reminder scheduler
- **AI Changes:** Finance Mgr composes draft return · flags anomalies (unusually high input VAT etc.)
- **UX Changes:** reminders in Approval Inbox as normal items
- **Testing:** VAT schedule triggers reminders at correct dates · draft accuracy against known scenarios
- **Security:** VAT data is sensitive · encrypted at rest per PII column policy
- **Migration:** merchants self-configure scheme + quarter-end on first login
- **Rollback:** feature flag `finance.vat_reminders`
- **Definition of Done:** merchant with VAT quarter ending 31 March receives reminder 1 March · reviews draft on 25 March · submits on 27 March
- **Acceptance Criteria:** 90%+ of merchants who complete VAT setup receive timely reminders

### C-13 · Country-Specific Onboarding Paths

- **Problem:** Ireland/Australia merchants forced through UK-first flow
- **Root Cause:** onboarding assumes UK
- **Engineering Solution:** country detection at Business Builder start · fork to country-specific path
- **Database Changes:** `hammerex_nex_builder_sessions` add `country_iso` column · country-specific step templates
- **API Changes:** `POST /api/nex/builder/sessions` accepts optional `country` parameter · `GET /api/nex/builder/steps?country=IE` returns country-specific step config
- **Frontend Changes:** country selector at step 1 · localised copy per country · country-specific verification (Companies House UK · CRO IE · ASIC AU)
- **Backend Changes:** country-specific verification adapters · country-specific regulation snapshot loaded
- **AI Changes:** Brain regional variant loaded on country selection
- **UX Changes:** UK is default · IE/AU/others fork clearly
- **Testing:** IE merchant onboards with CRO verification · AU merchant with ASIC · regulation set matches country
- **Security:** country data drives GDPR / privacy regime application
- **Migration:** existing merchants default to UK · can update in Settings
- **Rollback:** feature flag `builder.country_specific` (revert to UK-only if breaks)
- **Definition of Done:** IE merchant onboards with CRO number verified · sees Irish Building Regulations Part L in generated content
- **Acceptance Criteria:** IE + AU pilot cohort onboards without support tickets about "UK-only" issues

### C-14 · On-Site Photo Upload UX

- **Problem:** phone workflow painful · camera → gallery → upload → wait
- **Root Cause:** upload flow not optimised for on-site mobile
- **Engineering Solution:** camera-first single-tap flow · background upload · offline queue
- **Database Changes:** `hammerex_nex_upload_intents` (per ES-03) tracks queued uploads
- **API Changes:** `POST /api/nex/media/upload/presigned` returns direct-to-storage URL · `POST /api/nex/media/upload/finalise` records asset
- **Frontend Changes:** PWA camera integration · gallery of pending uploads · retry state visible · haptic feedback on capture
- **Backend Changes:** background worker processes finalise events · variant generator for web/thumbnail
- **AI Changes:** Vision auto-tags photo (room, work stage) on upload
- **UX Changes:** one-tap capture · optional voice caption (see C-15) · immediate feedback
- **Testing:** on-site simulation (weak signal · offline · reconnect) · upload succeeds when signal returns · no duplicate uploads
- **Security:** photos encrypted in transit · signed URLs · merchant-scope only
- **Migration:** additive
- **Rollback:** feature flag `media.mobile_upload_v2` · fallback to current flow
- **Definition of Done:** merchant on-site with 3G · captures 5 photos · uploads succeed in background · appears in SiteBook
- **Acceptance Criteria:** median time-to-upload-visible-in-SiteBook <30 seconds

### C-15 · Merchant-Side Voice Scope Capture

- **Problem:** typing on-site painful · Phase 28 voice constraint means server-side voice AI forbidden
- **Root Cause:** platform rule "no voice on customer purchasing path"
- **Engineering Solution:** browser-native Web Speech API for merchant-side transcription · merchant reviews text before it enters pipeline
- **Database Changes:** none (transcript enters normal text pipeline)
- **API Changes:** none new (uses existing text APIs)
- **Frontend Changes:** microphone button on SiteBook + Estimator + Chat · Web Speech API captures locally · text displayed · edit before submit
- **Backend Changes:** none · deliberately client-side only
- **AI Changes:** none · transcript is text like any other
- **UX Changes:** merchant walks around site · dictates scope · reviews transcript · edits · submits
- **Testing:** cross-browser Web Speech API (Chrome · Safari · Firefox) · accuracy sanity check · edit flow
- **Security:** audio never leaves merchant's device · no server-side voice storage
- **Migration:** additive
- **Rollback:** feature flag `ui.voice_capture` · falls back to text-only
- **Definition of Done:** merchant on-site opens SiteBook · presses mic · dictates 30-second scope note · reviews text · submits
- **Acceptance Criteria:** voice-capture usage on mobile SiteBook >30% of entries within 60 days of ship

### C-16 · Multi-User Team RBAC

- **Problem:** ES-01 §14.1 flagged as under-designed · mid-tier merchants need team support
- **Root Cause:** Y1 shortcut deferred RBAC beyond owner
- **Engineering Solution:** 5-role hierarchy per ES-01 §8.2 · scoped per module + per Workforce agent
- **Database Changes:** `hammerex_nex_team_members` (merchant_slug, user_id, role, scope_json, invited_by, joined_at) · `hammerex_nex_permissions` (role, module, action, scope) · `hammerex_nex_role_grants` (custom overrides)
- **API Changes:** `POST /api/nex/merchants/<slug>/team` (invite) · `PATCH .../team/<id>` (change role) · `DELETE .../team/<id>` · every API endpoint enforces permission decorator
- **Frontend Changes:** Team management page in Studio · invite flow · role assignment · impersonation view for owners
- **Backend Changes:** permission middleware wraps every endpoint · RLS policies extended to team members · audit log records actor per action
- **AI Changes:** workforce agents respect team-member permissions (Bookkeeper AI approves only Finance-role team members)
- **UX Changes:** owner sees team list · roles assigned per module · unclear permissions gracefully hidden
- **Testing:** owner + admin + manager + member + auditor scenarios · permission escalation attempts blocked · RLS enforcement
- **Security:** RLS + application-layer double-check · 2FA required for Owner + Admin roles · session per-team-member
- **Migration:** existing merchants become sole owners · can invite team on rollout
- **Rollback:** feature flag `auth.team_rbac` · single-user mode preserved
- **Definition of Done:** owner invites bookkeeper as Manager (Finance scope) · bookkeeper logs in · sees Finance surfaces · blocked from Estimator + Marketing
- **Acceptance Criteria:** 30% of mid-tier merchants adopt team feature within 90 days

### C-17 · Admin Diagnostic Tools

- **Problem:** support has no way to inspect merchant issues
- **Root Cause:** no admin surface exists
- **Engineering Solution:** admin console with merchant impersonation (audited) · Twin inspector · memory browser · agent activity viewer
- **Database Changes:** `hammerex_nex_admin_actions` (staff_user_id, target_merchant_slug, action, reason, occurred_at) · immutable audit log
- **API Changes:** `POST /api/nex/admin/impersonate` (2FA required) · `GET /api/nex/admin/merchants/<slug>/memory-browser` · `GET /api/nex/admin/twin/<project_id>/inspector`
- **Frontend Changes:** admin surface at `/admin/*` · role-gated · merchant search · impersonation banner ("You're viewing Sam Smith's account · Return to Admin")
- **Backend Changes:** impersonation session · admin RLS bypass with audit · PII masking option
- **AI Changes:** none
- **UX Changes:** admin sees exact same UI as merchant (empathy) · every action logged
- **Testing:** impersonation audit · PII masking · admin can't accidentally cause writes
- **Security:** admin actions immutably logged · PII masking option for support tier 1 · 2FA required · admin sessions time-limited (2h max)
- **Migration:** initial admin roles seeded to team
- **Rollback:** feature flag `admin.console_v1`
- **Definition of Done:** support agent receives ticket · impersonates merchant · sees exact issue · resolves · every step audited
- **Acceptance Criteria:** support ticket resolution time drops 40%+ vs no-admin-tool baseline

---

## Section 3 — UI Improvements

Redesigned flows for the friction points. Fewer clicks, clearer states.

### 3.1 Business Builder redesign

**Before:** 5-step wizard · fixed order · abandons on close · publishes as a big cliff.

**After:**
- Chat-native · one message at a time
- Autosaves on every step (C-1)
- Progress bar with 5 checkpoints visible
- Preview updates live as merchant answers · seen at all times in split-view
- Publish is a "review + confirm" moment, not a submit-and-wait
- Country fork at step 1 (C-13)
- Return-by-email persistent link

**Click reduction:** save-and-resume adds 0 clicks · direct publish flow removes 3 clicks · country-specific removes 5 US/AU-specific error-recovery clicks.

### 3.2 Estimator redesign

**Before:** multi-input dashboard uploading photos + brief + budget simultaneously feels overwhelming.

**After:**
- Linear conversation: "tell me about the job" → "upload photos" → "any measurements?" → "budget?" → "review"
- Voice capture at every text step (C-15)
- Sanity band flags inline (C-3)
- Confidence drill-down button on every line (H-6)
- Three-tier price toggle at review
- Interactive proposal preview single-page (not multi-tab)

**Click reduction:** linear flow -6 clicks · voice capture -4 typing steps · single-page review -3 tabs.

### 3.3 SiteBook redesign (mobile-first)

**Before:** desktop-optimised · mobile is scaled-down · painful on phone.

**After:**
- Mobile-first PWA
- One-tap capture from home screen (C-14)
- Voice note during upload (C-15)
- Offline queue with sync indicator (H-27)
- Timeline is scrollable date-grouped list on mobile
- Snag button always visible bottom-right

**Click reduction:** camera-to-uploaded from 6 taps to 2 · voice adds 0 typing.

### 3.4 Digital Twin redesign

**Before:** timeline scrubber assumes populated Twin · empty state looks broken.

**After:**
- Empty state with 3 action cards (C-9)
- Timeline snapshots per week for perf (H-14)
- Homeowner-invite prompt on Twin creation
- Merchant-side quick-actions on every timeline event

**Click reduction:** onboarding cards drive first event -3 clicks vs figuring it out.

### 3.5 Memory correction UX

**Before:** benchmark shown as number · no interaction.

**After:**
- Every displayed memory-derived number has an inline "correct this?" affordance (C-8)
- Correction dialog is one text field · reason optional
- Corrections aggregate cross-tenant with proper K gating

**Click reduction:** 2-click correction from 0 (previously impossible).

### 3.6 Approval Centre redesign

**Before:** list of individual approvals · click each.

**After:**
- Cadence selector (realtime · daily · weekly) at top (C-5)
- Grouped by agent · collapsible
- Multi-select with checkboxes (C-6)
- Bulk approve/reject with confirmation
- Emergency stop button persistent header
- Vacation mode toggle (H-10)

**Click reduction:** bulk approval reduces 40 individual clicks to 1-3 batch approves.

### 3.7 On-site photo upload (redesigned)

**Before:** camera → gallery → upload → progress → confirm.

**After:**
- One-tap from PWA home screen
- Immediate visual confirmation
- Background upload with retry
- Auto-tag by Vision
- Voice caption optional

**Click reduction:** 6 → 2 taps.

---

## Section 4 — AI Improvements

Engineering specs for the AI-specific improvements.

### 4.1 Memory Correction UX (C-8) — see Section 2

### 4.2 Estimator Sanity Bands (C-3) — see Section 2

### 4.3 Vision AI Confidence Workflow (C-10) — see Section 2

Additional: confidence thresholds tuned per finding type (safety-critical findings always require approval regardless of confidence · aesthetic findings can auto-append at higher threshold).

### 4.4 Weekly Digest AI (C-5) — see Section 2

Digest composition principles:
- Group by agent · sort by impact
- CEO AI writes 3-sentence summary at top
- Individual items expandable
- One-click actions per group

### 4.5 Approval Batching (C-6) — see Section 2

### 4.6 Model Failure Recovery (H-30)

- **Problem:** Anthropic API outage disrupts chat + all agent operations
- **Engineering Solution:** graceful degradation per feature · fallback provider per capability · canned responses for critical paths
- **Database Changes:** `hammerex_nex_ai_provider_status` — provider, capability, status, since
- **API Changes:** `/api/internal/ai/*` routes through fallback ladder · exposes provider used in response headers
- **Frontend Changes:** subtle banner "AI service degraded — some features slower" when in fallback mode
- **Backend Changes:** health check per provider per 30s · circuit breaker per capability · fallback order: primary → alternate → canned
- **AI Changes:** every capability has documented fallback (Claude Opus → Claude Haiku → cached similar response → canned polite refusal)
- **UX Changes:** merchant sees honest state · no silent failure
- **Testing:** chaos test simulating each provider outage per month
- **Security:** none additional
- **Migration:** additive
- **Rollback:** feature flag per fallback tier
- **Definition of Done:** Anthropic outage simulated · chat continues via Haiku · Estimator uses cached similar responses · merchants see banner
- **Acceptance Criteria:** feature-level uptime maintained at 99% during provider outage

### 4.7 Confidence Indicators (existing throughout Nex)

Standardise visual language:
- **High confidence:** solid green dot · no caveat
- **Medium confidence:** yellow dot · brief caveat sentence
- **Low confidence:** amber dot · "based on limited data" caveat · offer drill-down

### 4.8 AI Explanation Improvements

- Every AI-drafted line item has "why?" button
- Expands to show: input signals · reasoning steps · evidence chain
- Never opaque

### 4.9 Emergency Stop Behaviour (H-9 granular scope)

- **Problem:** all-or-nothing halt disrupts benign departments
- **Engineering Solution:** granular pause per agent + per action class
- **Database Changes:** `hammerex_nex_workforce_pauses` — merchant_slug, agent_id (null=all), action_class (null=all), paused_at, expires_at
- **API Changes:** `POST /api/nex/workforce/pause` with agent + action_class · `DELETE .../pause/<id>` to resume
- **Frontend Changes:** persistent "Pause AI activity" button expands to granular selector · "Pause Marketing for 2 days" affordance
- **Backend Changes:** every agent task check active pauses before executing
- **AI Changes:** agents log "paused by merchant" state visibly
- **Testing:** granular pause · verify only scoped agents pause · unscoped ones continue
- **Security:** pause action logged
- **Migration:** additive
- **Rollback:** feature flag `workforce.granular_pause`
- **Definition of Done:** merchant pauses Marketing agent for 3 days · other agents continue · resumes automatically
- **Acceptance Criteria:** emergency-stop misuse (accidental full halt) drops in usage data

---

## Section 5 — Commercial Improvements

### 5.1 Merchant Margin Floor (C-4) — see Section 2

### 5.2 Payment Recovery (C-11) — see Section 2

### 5.3 VAT Reminders (C-12) — see Section 2

### 5.4 Country-Specific Onboarding (C-13) — see Section 2

### 5.5 Subscription Improvements

- **Cash horizon widget (H-19)** — persistent dashboard tile showing 30/60/90-day cash · live-updated · one click to Finance Mgr drill-down
- **Overdue invoice bulk chase (H-20)** — Finance Mgr drafts chase message per overdue invoice · merchant reviews list · approves batch send
- **Deposit/staged payment (H-21)** — quote model supports milestone-linked invoices · Stripe partial-capture · merchant configures per project

### 5.6 Retention Engineering

Cross-cutting concerns:
- Weekly digest AI (C-5) — biggest single driver
- Empty state improvements across every module
- Vacation mode (H-10)
- First-morning report guardrail (H-1)
- Payment failure recovery (C-11)

Retention becomes a first-class engineering concern with a dedicated owner per ES-10 §12.3.

### 5.7 Merchant Success Flows

- **Trial-to-paid conversion nudges** — trigger merchant-specific value moments at day 5, 10, 12 of Free trial
- **Downgrade path** — clear disclosure of what's lost · save option
- **Reactivation** — churned merchant receives 30-day and 90-day check-ins with "your data is preserved"

---

## Section 6 — Enterprise Improvements

### 6.1 Multi-User RBAC (C-16) — see Section 2

### 6.2 Admin Diagnostic Centre (C-17) — see Section 2

### 6.3 Audit Tools

- Every action logged per ES-02 §9
- Merchant-facing audit log surface (filterable, exportable)
- Admin-facing platform-wide audit log
- GDPR-compliant retention per action class

### 6.4 Platform Health Dashboard

- Per-merchant SLA dashboard (H-29)
- Uptime status per feature
- Incident history
- Personal API usage per merchant

### 6.5 Permission Management

- Fine-grained per-module + per-Workforce-agent permissions
- Custom role support (Business tier and above)
- Bulk permission edit for team management

---

## Section 7 — Missing Features Supporting the Improvements

Small features required to complete the Critical/High fixes. Nothing invented.

- **Session-state persistence infrastructure** — required by C-1 · reusable across Estimator sessions + Twin viewer state + settings edits
- **Web Speech API wrapper module** — required by C-15 · reusable across every text input in the platform
- **Feature-flag admin UI** — required for staged rollout of every improvement · currently DB-only
- **Retry queue viewer** — required by C-11 payment recovery · useful for all task-queue debugging
- **PII masking module** — required by C-17 admin tools · reusable for GDPR exports (H-24)
- **Notification cadence engine** — required by C-5 weekly digest · reusable for VAT reminders (C-12) and any future scheduled comms
- **Confidence rendering component** — reusable across every AI output · single implementation

---

## Section 8 — Sprint Planning

Ten weeks · five sprints · 5 engineers · parallelised where dependencies allow.

### Sprint 1 (Weeks 1-2) — Trust Foundation

**Objectives:** ship legal compliance + safety infrastructure + payment reliability

**Deliverables:**
- C-11 Payment failure recovery
- H-24 GDPR export usability (finish)
- H-25 Right-to-be-forgotten workflow
- H-30 Model outage graceful degradation
- C-10 Vision AI medium-confidence approval
- C-16 Multi-user RBAC (start · continues into Sprint 2)

**Dependencies:** legal counsel available · Stripe webhook access confirmed · Anthropic fallback provider identified

**Definition of Done:** every deliverable feature-flagged on staging · integration tests green · CTO sign-off

**Success Metrics:** zero P0 bugs in payment recovery simulation · GDPR request completes in <7 days end-to-end · model-outage chaos test survives · Vision approval queue functions correctly · RBAC data model + migrations shipped

### Sprint 2 (Weeks 3-4) — Approval + Workforce Sanity

**Objectives:** kill approval fatigue as biggest churn driver

**Deliverables:**
- C-5 Weekly digest alternative
- C-6 Batch actions
- H-8 Agent conflict resolution UI
- H-9 Granular emergency stop
- H-10 Vacation mode
- H-1 First-morning report guardrail
- C-16 Multi-user RBAC (finish)

**Dependencies:** Sprint 1 RBAC substrate

**Definition of Done:** merchant advisory panel tests weekly digest for 5 days · approval batch performance <2s at 40 items · vacation mode integration tested

**Success Metrics:** approval fatigue simulated churn signal drops ≥60% · median approval-inbox time drops ≥50%

### Sprint 3 (Weeks 5-6) — Onboarding + Estimator

**Objectives:** conversion + immediate value

**Deliverables:**
- C-1 Save Business Builder progress
- C-2 CH verification fallback
- C-3 Estimator sanity bands
- C-4 Merchant margin floor
- H-3 Xero migration
- H-5 Multi-trade completeness
- H-6 Confidence drill-down
- H-7 Alternate-material picker

**Dependencies:** Business Builder session infrastructure · Estimator pipeline stable

**Definition of Done:** advisory panel runs 5 fresh Business Builder sessions with save/resume · sanity bands prevent 95%+ of bad-photo errors

**Success Metrics:** onboarding drop-off falls ≥40% · estimate accuracy in advisory-panel review rises ≥20%

### Sprint 4 (Weeks 7-8) — On-Site + Memory + Twin

**Objectives:** daily-use surfaces

**Deliverables:**
- C-14 Photo upload UX (mobile-first)
- C-15 Voice scope capture
- H-27 Offline SiteBook
- H-26 Mobile approval inbox
- C-9 Empty Twin state
- H-14 Timeline scrub performance
- H-15 Homeowner portal notifications
- C-8 Memory correction UX
- C-7 K-anonymity honest surface
- H-11 Regional dashboard teaser
- H-12 Cross-project memory search

**Dependencies:** Media service (per ES-03) · Twin snapshot infrastructure

**Definition of Done:** on-site advisory panel test with 3G / weak signal / offline scenarios · Twin adoption improves to >60% in fresh projects

**Success Metrics:** median on-site upload time <30s · empty Twin populated within 24h in 80%+ cases

### Sprint 5 (Weeks 9-10) — Commercial + International + Enterprise

**Objectives:** expansion enablers

**Deliverables:**
- C-12 VAT reminders
- H-19 Cash horizon widget
- H-20 Overdue bulk chase
- H-21 Staged payments
- C-13 Country-specific onboarding
- H-22 Regional regulation dashboard
- H-23 Multi-jurisdiction team
- H-16 Supplier verification
- H-18 Trade Centre order status
- H-2 Supplier onboarding
- C-17 Admin diagnostic tools
- H-28 Enterprise trial
- H-29 SLA dashboard
- H-4 ServiceTitan migration
- H-13 Twin transfer
- H-17 Reverse marketplace

**Dependencies:** all prior sprints solid · advisory panel expanded to 15-20 for closed-beta validation

**Definition of Done:** Ireland + Australia onboarding paths verified with pilot merchants in those countries · admin tools resolve 40% of open support tickets

**Success Metrics:** closed-beta launch gates all green · Ireland pilot cohort onboards successfully · SLA dashboard accurate

---

## Section 9 — Go/No-Go Launch Dashboard

Live status of every launch gate. Updated weekly.

| # | Gate | Status | Owner | Progress % | Risk | Blockers |
|---|------|--------|-------|------------|------|----------|
| 1 | Top 20 Critical improvements shipped | Not Started | Product Lead | 0% | Medium | Sprint planning |
| 2 | Merchant advisory panel formalised + paid | Not Started | CS Lead | 0% | Low | Contract templates |
| 3 | 100 simulation runs across journeys | Not Started | QA Lead | 0% | Low | Simulation infrastructure |
| 4 | GDPR portability + RTBF operational | Not Started | Backend Lead | 0% | High | Legal review |
| 5 | Multi-user RBAC in Workforce V0 | Not Started | Backend Lead | 0% | High | Sprints 1-2 |
| 6 | Model outage graceful degradation tested | Not Started | AI Lead | 0% | High | Fallback provider selection |
| 7 | Legal review of consent + wholesale terms | Not Started | Legal | 0% | Medium | Counsel engagement |
| 8 | AI safety external validation initiated | Not Started | CTO | 0% | Medium | Consultant selection |
| 9 | Trade Brain author recruitment operational | Not Started | Product Lead | 0% | High | Recruitment budget |
| 10 | Retention engineering owner assigned | Not Started | CEO | 0% | Low | Role definition |

**Recommended status flow:**
- **Not Started** — no work begun
- **In Progress** — Sprint work active
- **Ready** — feature-flagged on staging · advisory panel signed off · CTO reviewed
- **Blocked** — dependency unresolved · escalate
- **Complete** — Commercial GA blessed for this gate

**Weekly review meeting:** Friday · CTO chairs · every gate owner reports · blocked items escalated

**No-Go criteria:** any gate in Blocked status at end of Sprint 5 · CTO decision needed on whether to defer Commercial GA

---

## Section 10 — Final CTO Review

Challenge every recommendation. Simplify where possible.

### 10.1 Deliverables I would cut from this plan

**H-17 Reverse marketplace** — 3 weeks for a new channel that isn't a launch-blocker · defer to post-launch backlog · saves 3 weeks

**H-4 ServiceTitan migration** — competitor migration is nice-to-have · not launch-blocker · defer to post-launch · saves 3 weeks

**H-13 Twin transfer to new merchant** — edge case affecting <1% of projects · defer to post-launch · saves 3 weeks

**H-7 Alternate-material picker** — value-add but not launch-blocker · Estimator V0 works without · defer · saves 2 weeks

**H-2 Supplier onboarding flow** — supplier-side product is different motion · defer to Phase 33 V3 · saves 3 weeks

**Total savings: 14 engineer-weeks · redirected to buffer + polish**

### 10.2 Deliverables I would combine

**H-3 Xero + H-4 ServiceTitan** — both are data migrations · design one adapter framework · saves 2 weeks vs building both bespoke

**C-14 Photo upload + C-15 Voice capture** — both are on-site UX · design as one PWA capture module · saves 1 week

### 10.3 Deliverables I would simplify

**C-16 Multi-user RBAC** — original scope has 5 roles + custom overrides. Simplify to 3 roles (Owner · Manager · Member) for V0. Custom overrides + Auditor role in V1. Saves 1.5 weeks.

**C-5 Weekly digest** — original scope has AI-composed narrative. Simplify to structured summary (agent-grouped + counts) for V0. AI narrative in V1. Saves 1 week.

**H-25 Right-to-be-forgotten** — original scope handles cascade delete + rollup regeneration. Simplify V0 to soft-delete + queue rollup regen offline. Saves 1.5 weeks.

**Total additional savings: 6 engineer-weeks**

### 10.4 Where I would invest MORE

**Retention engineering owner** — assign now, not later. This is the single biggest Y1 miss. Add 2 weeks of dedicated retention-instrumentation work in Sprint 5.

**AI safety external validation** — begin engagement in Sprint 1 not Sprint 5. Findings inform every deliverable.

**Admin diagnostic tools (C-17)** — original scope treats as one sprint deliverable. Reality is admin tools compound value across every future feature. Invest an extra week making it extensible.

### 10.5 The revised sprint totals

Original: ~95 engineer-weeks · 5 engineers × 10 weeks = 50 available · required parallelisation was aggressive.

Revised (after cuts + simplifications): ~75 engineer-weeks · 5 engineers × 10 weeks = 50 available · parallelisation is realistic · 25 weeks of buffer allocated to polish + bugfixes + advisory panel iteration.

**This is the CTO-approved plan.**

### 10.6 Non-negotiables the CTO enforces

- Every improvement must trace to a specific Validation Report finding · no scope creep
- Every improvement must have Definition of Done · no ambiguous merges
- Every improvement ships behind feature flag · no big-bang deploys
- Every improvement has documented rollback plan · no unrecoverable states
- Advisory panel reviews every sprint end · their feedback is a launch gate

### 10.7 What this achieves

At Sprint 5 end:
- 40 Critical + High issues resolved (of 46 total, with 6 deferred as post-launch improvements)
- 10 launch gates complete
- Advisory panel signs off
- Closed beta opens for 50-100 merchants
- Commercial GA target: 4 weeks after Closed Beta launch (Sprint 6-7 buffer for bugfixes)

Total elapsed: 14 weeks from now to Commercial GA readiness.

---

## Section 11 — Ready for Execution

This document is the engineering team's daily working blueprint. Every deliverable in Sections 2-6 has enough specification to write a Zod schema, a Route Handler, a React component, and a Vitest suite today.

**Immediate next steps (Week 0):**

1. CTO reviews + signs off on cuts in §10.1-10.3
2. Sprint 1 tickets created in project management from Section 2 + Section 8
3. Advisory panel scheduled for Sprint 1 end
4. Legal counsel engaged for GDPR gates
5. AI safety consultant contacted
6. Sprint 1 kickoff Monday

**No more strategy. No more blueprints. Execute.**

---

**End of Nex Pre-Launch Implementation Plan v1.0.**

*Update this document weekly against sprint progress. When Sprint 5 completes and closed beta launches, this document becomes historical reference. The next document will be the Closed Beta Feedback Log.*
