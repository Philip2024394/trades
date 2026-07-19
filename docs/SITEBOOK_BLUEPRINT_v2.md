# SiteBook Blueprint v2 — Complete Audit, Expansion & Commercial Strategy

**Version:** 2.0
**Owner:** Philip
**Date:** 2026-07-19
**Status:** Production-ready blueprint. Implementation may begin immediately per the phased plan in §17.

**Positioning statement:** SiteBook is the homeowner-owned operating system for every project on a UK property, from a £60 lock replacement to an £800k full refurb. It sits BENEATH the trades' workflow — no matter which trade a homeowner hires, that trade's work lands in the homeowner's SiteBook. Over 20 years it becomes the definitive service history for the property, transferable at sale for £9.99 as a house-value asset.

**North-star metric:** Homeowners with ≥1 project posted × months since first project posted. Retention is the moat.

---

## Table of contents

1. [Executive summary + verdict](#1-executive-summary--verdict)
2. [Current-state audit (Kept / Redesigned / Removed)](#2-current-state-audit)
3. [New feature catalogue — 34 features grouped by domain](#3-new-feature-catalogue)
4. [Feature specifications — 12-field entries](#4-feature-specifications)
5. [UI design system](#5-ui-design-system)
6. [Navigation redesign](#6-navigation-redesign)
7. [Free tier specification](#7-free-tier-specification)
8. [Premium tier ladder (Free / Pro / Concierge / Portfolio)](#8-premium-tier-ladder)
9. [Trade Circle integration strategy](#9-trade-circle-integration-strategy)
10. [Complete revenue streams — 21 monetisation avenues](#10-complete-revenue-streams)
11. [Backend architecture per new feature](#11-backend-architecture)
12. [Automation + AI workflows](#12-automation--ai-workflows)
13. [Permissions model](#13-permissions-model)
14. [Notification system](#14-notification-system)
15. [Mobile-first improvements](#15-mobile-first-improvements)
16. [Future roadmap (5 years, moat features)](#16-future-roadmap-5-years)
17. [Feature ranking matrix](#17-feature-ranking-matrix)
18. [Phased implementation plan (P1 / P2 / P3)](#18-phased-implementation-plan)
19. [Success metrics + KPIs](#19-success-metrics--kpis)
20. [Risk register + mitigations](#20-risk-register--mitigations)

---

## 1. Executive summary + verdict

### The three strategic bets

**BET 1 — SiteBook is a house-scoped OS, not a project tool.** Every competitor (Buildertrend, Procore, Houzz Pro) is a trade-side tool. SiteBook flips it — the **homeowner** owns the workspace, trades are invited in. Compounds over 20 years: every trade a homeowner hires drops permanent records into the same SiteBook. At year 10 the SiteBook has more institutional knowledge about the property than any single trade or estate agent could assemble. Adds real value at sale.

**BET 2 — WhatsApp is the message layer, SiteBook is the record layer.** Trades will not adopt a new chat app. Every reveal costs 1 washer (£1 net after fees). Composition in SiteBook + wa.me deep link + reply-link back = full record captured despite WhatsApp's E2E encryption. This is unique on the platform and defensible.

**BET 3 — Ecosystem lock-in via cross-module data flow.** SiteBook feeds Trade Circle (invitations), TradeBook (trade dashboard sees invites), Marketplace (project brief seeds a beacon post), CRM (trade sees customer history), Reviews (homeowner rates on completion), Warranty vault (auto-log at job complete). Every module writes and reads to SiteBook — homeowners cannot switch without losing 20 years of records.

### Success metrics for this blueprint

At 12 months post-implementation:
- 5,000 homeowner accounts (free + paid)
- 40% of accounts have posted ≥2 projects
- 25% conversion from Free → Pro within 90 days
- £120 ARPU/year across paid tiers (blended)
- 8-month payback period on paid acquisition
- 60%+ of trades on the platform have accepted ≥1 SiteBook invitation
- £9.99 export attach rate: 15% of accounts at year 2+

### Top-line financial model

| Segment | Users (Y2) | ARPU/year | Revenue (Y2) |
|---|---|---|---|
| Free (viral loop) | 30,000 | £0 direct · £4 avg pack | £120k |
| Pro £4.99/mo | 6,000 | £59.88 | £359k |
| Concierge £14.99/mo | 1,200 | £179.88 | £216k |
| Portfolio (£49/mo, landlords) | 250 | £588 | £147k |
| Trade Circle featured placements | — | — | £180k |
| Trade Circle promoted invites | — | — | £96k |
| Marketplace supplier revenue-share | — | — | £120k |
| Exports @ £9.99 | 4,000 | £9.99 | £40k |
| **Total** | **37,450** | | **£1.28M** |

Not a hobbyist product. Serious platform economics if we build the right things in the right order.

---

## 2. Current-state audit

Every section on today's `/sitebook` and `/sitebook-showcase/the-old-rectory` reviewed against the six-question filter:
- Is it useful? · Does it save time? · Does it make money? · Does it connect to the ecosystem? · Can AI improve it? · Can it strengthen network effects?

### 2.1 Kept (as-is or with light polish)

| Section | Verdict | Why kept |
|---|---|---|
| **LiveProjectsFeed** (marquee) | Kept | Zero-friction social proof; drives homeowner FOMO / signup |
| **SiteBookInboxPanel** (Trades & Suppliers) | Kept | Canonical left rail — direct WhatsApp conversation record |
| **PostComposer + PostFeedCard** | Kept | Post-centric architecture is proven; matches Slack channels mental model |
| **RevealUsageCard** | Kept | Honest cost signalling; drives Pro upgrades |
| **HomeBackPill** | Kept | Solves the "lost in the ecosystem" problem for homeowners in invite flows |
| **UserMenuDropdown** | Kept | Just shipped; canonical cross-context nav |
| **HowItWorksGuide** (12-card guide) | Kept | Onboarding moat — no competitor has this depth |
| **CanteenInviteOverlay** (sticky footer) | Kept | Converts profile-view into invitation with 1 tap |
| **Homeowner slug URL** (`thenetworkers.app/{slug}`) | Kept | Personal, memorable, brandable |
| **Post visibility (selected / all-trades)** | Kept | Slack-channel scoping is correct |

### 2.2 Redesigned (kept function, upgraded execution)

| Section | Redesign |
|---|---|
| **`/sitebook` guest branch welcome** | Merge into an onboarding wizard (3 steps: nickname → first project → invite first trade) — reduces empty-state to zero. |
| **PostComposer** | Add voice-note capture (AI transcribes to text), auto-detect trade type from post body, auto-suggest trades to invite. |
| **PostFeedCard** | Add reaction row (helpful / question answered / issue open), inline photo upload from post replies, threaded sub-replies. |
| **Threads page (`/sitebook/threads`)** | Split into `Active` / `Pending invites` / `Closed` with per-thread analytics (response time, resolution rate). |
| **Export flow (£9.99)** | Add auto-generated **Property Passport PDF** (professional cover, executive summary, warranties, service history, trade contacts) — becomes the artefact that estate agents recommend. |
| **Reveal-credit UX** | Show projected monthly need based on active projects. Auto-suggest pack size at 2 credits remaining. |

### 2.3 Removed

| Section | Why removed |
|---|---|
| **"View archived" as tab** | Redundant with dedicated /sitebook/threads page. Kept as footer link only. |
| **Founding-100 canteen banner** | Already removed 2026-07-18. |
| **Standalone kind chips on inbox panel** | Already collapsed to single "Trades & Suppliers" header. |
| **"1 washer" badge on WhatsApp buttons** | Already removed 2026-07-18. |
| **Static hero on canteens directory (trade-view chrome)** | Replaced by Trade Circle header in invite mode. |
| **Dismiss X on canteen sticky footer** | Already removed 2026-07-18. |
| **"How it works" helper strip on Trade Circle** | Already removed 2026-07-19. |

### 2.4 Missing (root cause of the blueprint)

Real gaps in the current SiteBook that MUST be filled to hit the strategic bets:

- No **AI project assistant** — homeowners have to think of what to do next
- No **budget tracking / forecasting** — biggest homeowner anxiety left unsolved
- No **calendar / timeline view** — every project is a wall of posts, no time perspective
- No **snagging / defect manager** — homeowners can't systematically capture issues
- No **compliance / permit tracker** — high-anxiety area (building regs, party wall, planning)
- No **maintenance reminders** — SiteBook goes dormant between projects
- No **document intake** — quotes/invoices/certs arrive via WhatsApp + email, never centralised
- No **customer-approval workflow** — quotes and variations get lost in messages
- No **admin/analytics dashboard** for Philip — can't see which features drive retention
- No **weather integration** — construction is weather-dependent; smart delays absent
- No **neighbour / party-wall notifications** — legal requirement for many projects
- No **health & safety register** — required for larger projects
- No **cost alerts / cashflow forecast** — every project overruns; SiteBook could predict

All of these become the new feature catalogue in §3.

---

## 3. New feature catalogue

**34 new features grouped by domain.** Each is specified in §4 with the 12-field template.

### 3.1 AI + Intelligence (7)
1. **SiteBook AI Assistant** — chat interface trained on the homeowner's project context
2. **Auto-brief generator** — writes a professional project brief from 3 photos + 1 paragraph
3. **Photo AI recognition** — auto-tags "before / in-progress / after" + detects issues (damp, cracks, tools left on site)
4. **Completion prediction** — ML model estimating remaining days based on post velocity + trade type
5. **Risk score per project** — weighted signals: overdue quotes, ghosted trades, cost overrun, weather delays
6. **Smart search** — natural-language search across posts, photos, documents ("show me all photos of the boiler before Watson touched it")
7. **Voice notes → structured post** — homeowner speaks; AI writes the post

### 3.2 Project management core (7)
8. **Calendar / Gantt timeline** — every post + milestone + trade booking on one view
9. **Task list per project** — kanban with Trade / Homeowner / Awaiting response swimlanes
10. **Budget tracker** — line-item cost table with actual vs quote, alerts on overrun
11. **Cashflow forecast** — 12-week rolling cash-out projection across all active projects
12. **Snagging manager** — dedicated defect capture with photo + status + trade assignment
13. **Variation order manager** — homeowner-approved scope changes with sign-off
14. **Digital signatures** — sign quotes, variations, and completion certificates on device

### 3.3 Documents + records (5)
15. **Document intake** — email address `<nickname>@docs.thenetworkers.app` forwards to SiteBook + AI-classifies (quote / invoice / cert / photo)
16. **Warranty vault** — auto-log at job complete + 30-day expiry ping
17. **Compliance centre** — planning / building regs / party wall / gas safe / EICR tracked per project
18. **Digital site folder** — permit, method statement, RAMS, insurance, health & safety in one place
19. **Property Passport export** — the £9.99 PDF/ZIP; regenerated on demand

### 3.4 Trade + supplier collaboration (5)
20. **Live status per trade** — On-site now / Booked for Wed 9am / Awaiting delivery / Complete
21. **Material delivery tracking** — supplier ETA + on-site confirmation photo
22. **Trade availability calendar** — see when your hired trades are free before scheduling
23. **Equipment / tool register** — track hired plant, LOLER cert dates, return dates
24. **Supplier connection** — direct product ordering from within a project (Wickes/Screwfix/local merchants)

### 3.5 Site presence + safety (5)
25. **Site access QR codes** — trades scan on arrival, log auto-recorded (arrival, departure, hours)
26. **Visitor log** — anyone on-site records who + why + how long
27. **Neighbour notifications** — one-tap notice to adjacent addresses (works via letterbox postcards + WhatsApp broadcast)
28. **Weather alerts + smart delays** — pulls Met Office; auto-reschedules dependent tasks
29. **Emergency contacts + procedures** — one-tap 999 / gas emergency / structural engineer

### 3.6 Long-term maintenance (3)
30. **Maintenance reminders** — boiler service, gutters, chimney sweep, alarms — seasonal auto-ping
31. **Asset register** — every fitted item (boiler, appliances, doors, windows) with serial, warranty, install date
32. **Aftercare subscription** — £2.99/mo bundle that surfaces maintenance opportunities with pre-vetted trades

### 3.7 Sharing + collaboration (2)
33. **Client approval workflow** — split for landlord/tenant/family relationships — designated approver signs off
34. **Multi-user access** — spouse, family, letting agent view / edit permissions

---

## 4. Feature specifications

For each of the 34 features: **Purpose · User Benefit · UI Placement · Backend Architecture · Database Relationships · Permissions · Notifications · Automation · Triggers · Connected Modules · Admin Controls · Revenue Potential · Future Expansion**.

### 4.1 SiteBook AI Assistant

**Purpose:** Give every homeowner a knowledgeable project buddy that never leaves. Answers questions ("Is this quote fair?"), suggests next actions ("You haven't heard back from the plumber in 4 days — nudge or invite alternative?"), summarises long threads.

**User benefit:** Zero project management overhead. Homeowner asks a natural-language question; gets a specific, project-aware answer with citation to their own posts + industry norms.

**UI placement:** Floating pill bottom-right (like Intercom messenger). Yellow with `Sparkles` icon. Opens a sheet with chat history + suggested prompts. Also embedded inline: "Ask AI about this post" button on each PostFeedCard.

**Backend architecture:**
- OpenAI GPT-4o mini (or Claude Haiku) with function-calling
- Server route `POST /api/homeowner/ai/chat` — accepts `{ threadId, message, contextScope }`
- Context builder pulls: current project(s), last 30 posts, warranty entries, active invitations, budget state
- Streams response via SSE for perceived speed
- Per-message rate limit: 20/day free, 200/day Pro
- Cost cap: £0.05 per free user per day, £0.50 per Pro user per day

**Database:**
- `hammerex_sitebook_ai_threads(id, homeowner_id, project_id?, title, created_at, updated_at)`
- `hammerex_sitebook_ai_messages(id, thread_id, role, content, tokens_in, tokens_out, cost_pence, created_at)`
- `hammerex_sitebook_ai_actions(id, message_id, action_kind, target_id, executed_at)` — tracks when AI-suggested action was taken

**Permissions:** Homeowner only. Multi-user family/spouse read own threads only.

**Notifications:** Push on assistant proactive nudge ("Watson hasn't replied — want me to draft a follow-up?"). User can mute per-thread.

**Automation:** Nightly job scans stale threads (no reply in 3 days), pending quotes past decision date, upcoming project milestones — proactively suggests actions via AI.

**Triggers:** Post published, quote received, thread stale, warranty expiry approaching, weather alert.

**Connected modules:** Posts, Threads, Warranty vault, Calendar, Budget, Reveal credits (invite via AI = same washer flow).

**Admin controls:** Global on/off, per-tier daily cap, cost dashboard, model swap (A/B GPT vs Claude for cost).

**Revenue potential:**
- Free: 20 msg/day — hook feature
- Pro: 200 msg/day — main upgrade driver ("The AI knows my whole project" is the wow moment)
- Concierge: unlimited + priority — commercial homeowners with multi-property portfolios

**Future expansion:** Voice mode (talk to AI on-site with hands dirty), vision (photo → diagnosis), fine-tuned on trades-vs-homeowner communication patterns, integration with Trade Circle to suggest specific trades.

---

### 4.2 Auto-brief generator

**Purpose:** Kill the empty-composer problem. Homeowner uploads 3 photos + types one line; AI writes a full project brief that trades will actually respond to.

**User benefit:** From "I don't know how to describe this" → publishable brief in 20 seconds.

**UI placement:** New button on PostComposer: "✨ AI-draft this". Opens a sheet with photo picker + one-line prompt → returns editable brief.

**Backend:** OpenAI vision API on photos + text prompt + industry-brief template. Template output includes: scope, dimensions estimate (from photo), materials list, timeline suggestion, budget range (based on similar accepted quotes on the platform).

**Database:** Reuses `hammerex_sitebook_posts`; adds `ai_generated: boolean` flag.

**Permissions:** Any authed homeowner. Cost-metered.

**Notifications:** None (synchronous UX).

**Automation:** After 30 days, learns from accepted-quote ranges per trade type to improve future suggestions.

**Triggers:** Composer opened + photos uploaded.

**Connected modules:** Posts, Trade Circle (suggests trades matching the brief), Budget (seeds the initial budget line).

**Admin:** Prompt template versioning; A/B test brief quality.

**Revenue:**
- Free: 3 briefs/month
- Pro: 30/month
- Concierge: unlimited
- Enterprise (multi-property landlords): unlimited + custom template

**Future:** Video → brief. Sketch → brief. Support 3D scan (LiDAR) input from iOS.

---

### 4.3 Photo AI recognition

**Purpose:** Every uploaded photo auto-tagged with (a) stage (before/in-progress/after), (b) room/area, (c) issues detected (damp, crack, tool-left-on-site, unsafe scaffolding).

**User benefit:** Search + timelines just work. Before/after comparisons render automatically. Safety issues flagged without needing an inspector.

**UI:** No new button. On upload: photo shows a small "AI analysing…" badge for 3s, then tags appear as chips below.

**Backend:** OpenAI vision or a specialised construction-vision model (Amazon Rekognition Custom Labels trained on construction photos). Cost target: £0.001 per photo.

**Database:**
- `hammerex_sitebook_photos.ai_tags jsonb` (array of `{ label, confidence, kind: "stage"|"area"|"issue" }`)
- `hammerex_sitebook_photos.stage` (auto-populated)

**Permissions:** Any homeowner. Trades' uploads also analysed.

**Notifications:** Push if a SAFETY issue detected ("Unsafe scaffolding tag added to photo from Watson").

**Automation:** Issue-detected photos auto-create Snagging entries.

**Triggers:** Photo uploaded.

**Connected modules:** Photos, Snagging manager, Before/after gallery, Compliance centre.

**Admin:** Model confidence threshold, tag taxonomy management.

**Revenue:**
- Free: 20 photos/mo
- Pro: 500 photos/mo
- Concierge: unlimited

**Future:** Video frame analysis. Progress-percentage calc from photo comparison. Anomaly detection (something changed since last photo).

---

### 4.4 Completion prediction

**Purpose:** "When will my extension finish?" answered honestly, not by a trade's optimism bias.

**User benefit:** Realistic expectations. Homeowner can plan (holiday, tenant move-in, party).

**UI:** New card on project header — "Estimated completion: **14 August 2026** · confidence 78%". Tap → shows the driving factors (posts per week velocity, similar-project baseline, weather buffer).

**Backend:** Trained regression model on completed projects. Features: trade type, budget size, posts-per-week velocity, replies per post, weather forecast severity.

**Database:** `hammerex_sitebook_projects.predicted_completion timestamptz`, `predicted_completion_confidence numeric`, updated nightly.

**Permissions:** Homeowner + assigned trades (trades benefit from seeing they're on track).

**Notifications:** Weekly summary if prediction slipped by >7 days.

**Automation:** Nightly cron `/api/cron/completion-predictions`.

**Triggers:** New post published, quote accepted, trade added, weather forecast update.

**Connected modules:** Posts, Weather, Trades panel, Calendar.

**Admin:** Model retraining, benchmark accuracy dashboard.

**Revenue:** Included in Pro; free users see estimate but not confidence + drivers.

**Future:** Multi-project portfolio-level prediction (landlord: "when will all 7 flats be re-tenantable?").

---

### 4.5 Risk score per project

**Purpose:** Quiet dashboard signal for homeowners: this project is at risk of overrun / dispute / abandonment. Prompts early intervention.

**User benefit:** Catch problems weeks earlier than gut-feel. Homeowners chronically over-tolerate stalled projects; a red flag from a system nudges them to act.

**UI:** Small dot on the project card in the left panel — green/amber/red. Tap → "Why this score" breakdown.

**Backend:** Weighted signal aggregator, no ML needed. Signals: days since last post from trade, quote decision overdue, budget overrun %, weather-blocked days, snagging items open, invitation status.

**Database:** `hammerex_sitebook_projects.risk_score int (0-100)`, `risk_reasons jsonb[]`, updated nightly.

**Permissions:** Homeowner only. Trades see status but not the score.

**Notifications:** Push when score crosses into amber or red.

**Automation:** Nightly recompute + trigger notification.

**Triggers:** Any signal change.

**Connected modules:** Every module in §3.

**Admin:** Signal-weight tuning, threshold tuning.

**Revenue:** Free (foundational trust). Concierge tier: "Ask AI to draft an intervention" using the risk factors.

**Future:** Portfolio risk score for Portfolio tier landlords.

---

### 4.6 Smart search

**Purpose:** Natural-language search across every post, reply, photo (with AI tags), document, quote, warranty. Answers questions like "What did Watson quote for the boiler?" or "Show me all photos of the en-suite before demo".

**User benefit:** Instant retrieval of anything in the SiteBook. Feels like Ctrl-F for the whole house.

**UI:** Command palette (⌘K on desktop, search chip on mobile) — always accessible from header.

**Backend:** Postgres full-text search on posts + Supabase pgvector embeddings for semantic search on longer content. Photos searched via their AI tags.

**Database:** `tsvector` column on posts + replies; `vector(1536)` embedding column on messages, quotes, documents.

**Permissions:** Homeowner (all their content). Trades see search scoped to their assigned posts only.

**Notifications:** None.

**Automation:** Embedding backfill on new content via trigger.

**Triggers:** Any text/document added.

**Connected modules:** Posts, Documents, Warranties, Threads, Photos.

**Admin:** Search analytics (top queries → identifies feature gaps).

**Revenue:** Free basic (post text only). Pro: semantic + photo + document.

**Future:** Voice-activated search. Cross-project search for landlords.

---

### 4.7 Voice notes → structured post

**Purpose:** Homeowners at 8pm covered in plaster dust can't type a post. They can talk.

**User benefit:** Zero-friction capture. 30-second voice note becomes a fully-formed post.

**UI:** Mic icon on PostComposer. Hold to record. Release → transcribes → AI structures into title + body + suggested trades.

**Backend:** OpenAI Whisper for transcription + GPT-4o mini to structure. Store audio in Supabase storage for reference.

**Database:** `hammerex_sitebook_posts.audio_source_url text`, `hammerex_sitebook_posts.transcript text`.

**Permissions:** Any homeowner. Cost-metered.

**Notifications:** None.

**Automation:** Auto-suggest project + trade based on transcript content.

**Triggers:** Voice recorded and submitted.

**Connected modules:** Posts, Projects, Trade suggestions.

**Admin:** Per-tier daily minute cap.

**Revenue:** Free: 5 min/mo. Pro: 60 min/mo. Concierge: unlimited.

**Future:** Real-time voice interaction with AI Assistant while walking site.

---

### 4.8 Calendar / Gantt timeline

**Purpose:** Homeowners see all projects on one calendar — trade bookings, deliveries, decisions due, warranty expiries, maintenance reminders.

**User benefit:** No more juggling texts and mental notes.

**UI:** New /sitebook/calendar route. Toggle: month / week / list / Gantt. Colour-coded per project.

**Backend:** iCal feed generator per homeowner (private URL). Google Calendar / Outlook sync via one-tap OAuth (Pro+).

**Database:**
- `hammerex_sitebook_events(id, project_id, event_kind, title, starts_at, ends_at, all_day, source_kind, source_id, colour)`
- Aggregation view over posts, trade bookings, warranty expiries, maintenance reminders

**Permissions:** Homeowner default, family members with role, trades see events they're party to.

**Notifications:** Daily "today's schedule" push at 07:00 (opt-in).

**Automation:** Auto-add events from post kinds (`booking`, `delivery`, `inspection`, `decision-needed`).

**Triggers:** Any of the above.

**Connected modules:** Posts, Trades panel, Warranty, Maintenance.

**Admin:** iCal feed key rotation, sync integration analytics.

**Revenue:** Free: basic month view. Pro: sync + Gantt. Concierge: portfolio calendar.

**Future:** Two-way sync (homeowner adds event in Google → appears here).

---

### 4.9 Task list per project

**Purpose:** Structured to-do that bridges homeowner + trade responsibilities. Kanban board: `Homeowner action` · `Trade action` · `Awaiting response` · `Done`.

**User benefit:** Nobody wonders "whose turn is it?".

**UI:** New tab on each project. Add task inline (person, due, priority). Drag between columns.

**Backend:** Standard tasks table with assignee polymorphism (homeowner_id or listing_id).

**Database:**
- `hammerex_sitebook_tasks(id, project_id, title, description, assignee_kind, assignee_id, priority, due_at, status, created_at)`

**Permissions:** Homeowner CRUD. Assigned trade can mark done + comment.

**Notifications:** On assignment, on due-soon, on overdue.

**Automation:** Auto-create tasks from AI Assistant suggestions.

**Triggers:** Task created/assigned/status-changed.

**Connected modules:** Posts (task can be attached to a post), Calendar, AI Assistant.

**Admin:** Standard.

**Revenue:** Free: 10 open tasks. Pro: unlimited. Concierge: dependencies (Gantt-style).

**Future:** Template libraries per project type (kitchen refit → 42 standard tasks pre-populated).

---

### 4.10 Budget tracker

**Purpose:** Answer "How much have I spent, how much left, where's it going?" — the #1 homeowner anxiety.

**User benefit:** Real financial control, not gut feel.

**UI:** New tab on each project. Line-item table: description, quoted, actual, variance. Pie chart by trade / category. Alerts strip when > 90% of budget consumed.

**Backend:** Line-item ledger with auto-populate from accepted quotes and paid invoices.

**Database:**
- `hammerex_sitebook_budget_lines(id, project_id, description, category, quote_pence, actual_pence, currency, trade_listing_id?, invoice_id?, created_at)`
- Rollup view for project totals

**Permissions:** Homeowner only. Trades see only their own quoted/actual figures.

**Notifications:** Push on 80% / 90% / 100% / 110% thresholds.

**Automation:** Auto-populate line when quote accepted or invoice marked paid.

**Triggers:** Quote accepted, invoice paid, homeowner manual entry.

**Connected modules:** Quotes, Invoices, Cashflow forecast, Reports.

**Admin:** Category taxonomy management.

**Revenue:** Free: budget totals only. Pro: line items + charts + alerts. Concierge: multi-project rollup + exports.

**Future:** Bank connection (Open Banking) for auto-import of trade payments.

---

### 4.11 Cashflow forecast

**Purpose:** Rolling 12-week view of every scheduled outflow across all active projects. Combined with income (if user provides), shows solvency runway.

**User benefit:** No more "did I forget to reserve the £8k deposit for next month?"

**UI:** New /sitebook/cashflow route (Pro+). Chart + table by week.

**Backend:** Aggregates from budget line items with `expected_payment_date`, subscription outflows, imports from user's optional income entries.

**Database:** `hammerex_sitebook_cashflow_events(id, homeowner_id, project_id?, direction, amount_pence, expected_at, actual_at?, source_kind, source_id)`.

**Permissions:** Homeowner only (financial data — never shared with trades).

**Notifications:** Push on projected shortfall (income - outflows < £1000 in any week).

**Automation:** Nightly recompute.

**Triggers:** Budget change, quote scheduled, invoice due, homeowner income change.

**Connected modules:** Budget, Quotes, Invoices, Aftercare subscription outflows.

**Admin:** None.

**Revenue:** Pro exclusive (financial features are a paid pattern).

**Future:** Bank integration via Open Banking (UK PSD2). Automatic categorisation of trade payments.

---

### 4.12 Snagging manager

**Purpose:** Every project ends with 10-40 small defects. Currently lost in WhatsApp. This centralises them.

**User benefit:** Snagging is universally hated. Give homeowners a delightful way to capture + trades a clean list to work through.

**UI:** New tab on each project. Add snag → title, photo, room, assigned trade, priority. Status: Open / In-progress / Fixed / Homeowner-signed-off.

**Backend:** Standard structured records with photo attachment + optional AI-generated suggested trade.

**Database:** `hammerex_sitebook_snags(id, project_id, title, description, photo_url, room, priority, assignee_listing_id?, status, created_at, resolved_at?)`.

**Permissions:** Homeowner CRUD. Trade sees own-assigned + can update status.

**Notifications:** Trade notified on assignment, homeowner notified on "Fixed" awaiting sign-off.

**Automation:** AI issue-detection photos auto-create snag entries as drafts.

**Triggers:** Snag created / status changed.

**Connected modules:** Photos (AI detection), Posts (link to context), Trades panel.

**Admin:** Room taxonomy management.

**Revenue:** Free: 5 open snags/project. Pro: unlimited.

**Future:** Snagging inspection service — pay a Networkers-vetted inspector to walk through and log snags on your behalf (revenue share).

---

### 4.13 Variation order manager

**Purpose:** Every mid-project change ("actually let's move that door") triggers cost + timeline + approval. Currently lost in verbal agreement then disputed.

**User benefit:** Clean paper trail. Costs quantified up-front, signed off, no argument at completion.

**UI:** "Request variation" button on each project. Trade drafts (or homeowner requests trade to draft). Homeowner reviews cost + timeline impact → e-signs → both parties get PDF.

**Backend:** Structured VO records with PDF generation + digital signature (see 4.14).

**Database:** `hammerex_sitebook_variations(id, project_id, title, description, delta_cost_pence, delta_days, requested_by, quoted_by, quoted_at, homeowner_signed_at?, trade_signed_at?, status, pdf_url?)`.

**Permissions:** Homeowner + assigned trade.

**Notifications:** On draft submitted, on signature required, on signature complete.

**Automation:** On both signatures, auto-update project budget + timeline.

**Triggers:** Any VO event.

**Connected modules:** Budget, Timeline, Digital signatures, Documents.

**Admin:** Standard.

**Revenue:** Free: 3 VOs/project. Pro: unlimited + PDF branding options.

**Future:** Legal template library curated with a UK construction solicitor (partnership).

---

### 4.14 Digital signatures

**Purpose:** Sign quotes, variations, completion certs on device without printing.

**User benefit:** No printer needed. Legally binding under UK eIDAS.

**UI:** "Sign now" button on any signable document → drawing pad or type-your-name → embedded into PDF.

**Backend:** In-house signature (SVG or bitmap) embedded in PDF via pdf-lib or similar. Metadata: IP, timestamp, agent string.

**Database:** `hammerex_sitebook_signatures(id, document_id, signer_kind, signer_id, signed_at, signature_svg, meta jsonb)`.

**Permissions:** Homeowner + assigned trade.

**Notifications:** On sign request, on complete.

**Automation:** Auto-mark parent document as executed on both signatures collected.

**Triggers:** Signature captured.

**Connected modules:** Quotes, Variations, Completion certificates, Warranty transfers.

**Admin:** Signature retention policy (7 years for construction records).

**Revenue:** Free: 2 signatures/mo. Pro: unlimited. Concierge: audit-trail export.

**Future:** GOV.UK Verify integration for premium-tier legal proof.

---

### 4.15 Document intake — `<nickname>@docs.thenetworkers.app`

**Purpose:** Trades and suppliers email quotes/invoices/certs to a per-homeowner address; they auto-land in SiteBook.

**User benefit:** No forwarding, no downloading, no dragging into folders. It just appears.

**UI:** New /sitebook/documents route. Filters: kind (quote/invoice/cert/photo/other), project, trade. Universal search.

**Backend:** Postmark inbound webhook → parse email → attach to project via AI classification (matches trade name + email + subject).

**Database:**
- `hammerex_sitebook_documents(id, homeowner_id, project_id?, kind, title, sender_email, source_kind, storage_url, ai_classification jsonb, received_at)`
- Per-homeowner routing: `hammerex_homeowners.docs_email_slug` (derived from slug)

**Permissions:** Homeowner. Auto-assign to project if AI confident; otherwise "Needs project assignment" queue.

**Notifications:** Push on receipt, digest at 18:00 daily.

**Automation:** AI classifies kind + suggests project + extracts key fields (amount, VAT, date).

**Triggers:** Email received.

**Connected modules:** Posts (attach doc to reply), Budget (auto-populate line from invoice), Warranty (auto-log from cert), Compliance centre.

**Admin:** Spam filtering, DKIM/SPF setup.

**Revenue:** Free: 20 docs/mo. Pro: 500/mo. Concierge: unlimited + OCR of scanned images.

**Future:** WhatsApp bot equivalent — forward a message to a bot number, ends up as a document.

---

### 4.16 Warranty vault

*(Existing feature — this is the completion spec)*

**Purpose:** Every warranty auto-captured + auto-remind before expiry + transferable at sale.

**User benefit:** Never lose a claim window. Adds real property value at sale (warranties transfer with the SiteBook export).

**UI:** Dedicated /sitebook/warranties tab. Timeline view. Filter by expiring-soon / claimable-now / active.

**Backend:** Existing `hammerex_sitebook_warranties` extended with claim workflow.

**Database:**
- `hammerex_sitebook_warranties` (existing) + `claim_status`, `claim_notes`, `transferable_at_sale bool`
- `hammerex_sitebook_warranty_reminders(id, warranty_id, remind_at, sent_at?)`

**Permissions:** Homeowner. Assigned trade auto-log at completion.

**Notifications:** Push 30/7/1 days before expiry.

**Automation:** Cron `/api/cron/warranty-reminders` daily at 09:00.

**Triggers:** Warranty created/edited, project completion posted, reminder due.

**Connected modules:** Posts (auto-log on completion post), Compliance, Property Passport export.

**Admin:** Reminder template management.

**Revenue:** Free: 10 active warranties. Pro: unlimited. Aftercare: claim assistance service (£29 per claim, revenue share with legal partner).

**Future:** Direct-to-manufacturer claim submission via APIs.

---

### 4.17 Compliance centre

**Purpose:** Every UK residential project has compliance obligations (planning, building regs, party wall, gas safe, EICR, EPC, EPCR-B, asbestos survey for pre-2000 properties). Homeowners routinely miss these.

**User benefit:** Turn the anxiety into a checklist. Know exactly what applies to your project and where you stand.

**UI:** New /sitebook/compliance route. Per-project checklist auto-generated from project type + property age + scope.

**Backend:** Rules engine — set of rule cards keyed on project attributes → checklist items.

**Database:**
- `hammerex_sitebook_compliance_items(id, project_id, item_kind, title, description, status, evidence_document_id?, due_at?, resolved_at?)`
- `sitebook_compliance_rules` (seeded taxonomy, ~40 UK obligations)

**Permissions:** Homeowner + assigned "lead" trade (typically the builder).

**Notifications:** Push on due-soon, overdue.

**Automation:** Auto-generate checklist on project publish; auto-attach uploaded certs to matching items via AI.

**Triggers:** Project created, project attributes changed.

**Connected modules:** Documents (evidence attachment), Posts (compliance discussion), Property Passport.

**Admin:** Compliance rules curation with a UK building surveyor partner.

**Revenue:** Free: basic checklist. Pro: reminders + evidence-attachment automation. Concierge: partner-inspector referrals with revenue share.

**Future:** Direct portal submissions (planning applications, building notices) via GOV.UK APIs.

---

### 4.18 Digital site folder

**Purpose:** On-site trades need permit copies, method statements, RAMS, insurance certs, contact list. Currently in a printed A4 folder that gets lost. Digitise.

**User benefit:** Every trade has instant on-site access to what they legally need.

**UI:** Dedicated view accessible from any project — flat list of pinned documents.

**Backend:** Reuses Documents module with `pinned_to_project` flag.

**Permissions:** Homeowner + all trades on the project (RO).

**Notifications:** On pin/unpin.

**Connected modules:** Documents, Trades panel, Compliance centre.

**Revenue:** Free (foundational).

**Future:** QR code on the site fence → instant folder access.

---

### 4.19 Property Passport export (£9.99)

**Purpose:** The £9.99 sellable artefact. Everything in the SiteBook, packaged as a beautifully-designed PDF + ZIP.

**User benefit:** Adds real value at sale. Estate agents recommend it. Solicitors process faster. Buyer confidence up. Homeowner recoups the £9.99 x1000+.

**UI:** /sitebook/export — one-click generate. Preview first page. Add to basket. Stripe checkout.

**Backend:** Server-side PDF generation via Puppeteer or Playwright. ZIP built from Supabase storage.

**Database:** `hammerex_sitebook_exports(id, homeowner_id, generated_at, pdf_url, zip_url, stripe_session_id, paid_at, downloaded_at)`.

**Permissions:** Homeowner only.

**Notifications:** Push on ready + email with download link.

**Automation:** Nightly cleanup of unclaimed exports after 30 days.

**Triggers:** Export requested + paid.

**Connected modules:** Every project + document + warranty + photo.

**Admin:** Template design updates, price A/B.

**Revenue:** £9.99 one-off. Bundle offer: unlimited exports for £29/year (Portfolio tier).

**Future:** Estate-agent partnership — bulk-generate for agent's whole listing portfolio; revenue share.

---

### 4.20 Live status per trade

**Purpose:** At a glance: what's the state of each trade on this project right now?

**UI:** New status pill on each row of the Trades & Suppliers panel: `On-site now` / `Booked Wed 9am` / `Awaiting delivery` / `Quoting` / `Complete`.

**Backend:** Derived from posts + calendar events + booking records.

**Database:** No new schema; computed view.

**Permissions:** Homeowner, assigned trades see own.

**Notifications:** Push on status change (opt-in).

**Automation:** Recomputed on any related event.

**Triggers:** Post published, booking added/moved, delivery confirmed.

**Connected modules:** Panel, Calendar, Delivery tracking.

**Admin:** None.

**Revenue:** Free (retention driver).

**Future:** GPS confirmation (trade's phone within 200m of site = auto "on-site now").

---

### 4.21 Material delivery tracking

**Purpose:** "When are the tiles arriving?" is asked 50x per project. Kill the question.

**UI:** New delivery item card on project page. Supplier name, ETA, tracking link (if courier), on-site photo confirm.

**Backend:** Manual entry + supplier-partnered auto-updates. Trade can add on behalf of homeowner.

**Database:** `hammerex_sitebook_deliveries(id, project_id, supplier_slug?, description, quantity, eta_at, arrived_at?, arrived_photo_url?, tracking_url?, invoice_id?)`.

**Permissions:** Homeowner + assigned trade.

**Notifications:** ETA reminder + arrival confirmation.

**Automation:** If tracking_url present, poll courier API for status.

**Triggers:** Delivery scheduled / delivered / delayed.

**Connected modules:** Calendar, Budget (auto-link invoice), Trades panel.

**Admin:** Courier integration list.

**Revenue:** Free basic. Pro: courier tracking auto-poll.

**Future:** Direct integration with major merchants (Wickes / Screwfix / Travis Perkins) — orders auto-appear.

---

### 4.22 Trade availability calendar

**Purpose:** Before scheduling a booking, see when your hired trades are actually free.

**UI:** Overlay on the SiteBook calendar. Toggle per trade. Shows their busy slots (not what they're doing — just busy/free).

**Backend:** Trades opt-in to share their calendar (from TradeBook side).

**Database:** `hammerex_trade_availability(listing_id, busy_slots jsonb)`.

**Permissions:** Homeowner sees trades on their projects.

**Notifications:** Push if a slot they wanted just opened up.

**Automation:** Watch for conflicts on proposed bookings.

**Triggers:** Any availability change or booking proposal.

**Connected modules:** Calendar, Trades panel.

**Admin:** None.

**Revenue:** Free (both-sides retention driver).

**Future:** Auto-scheduling — AI proposes 3 slots that work for all parties.

---

### 4.23 Equipment / tool register

**Purpose:** Track hired plant (scaffold, skips, hire tools) with LOLER cert dates + return dates. Miss a return = ££.

**UI:** Sub-tab on project. Add hire item.

**Database:** `hammerex_sitebook_equipment(id, project_id, description, supplier_slug?, hire_start, hire_end, return_by, loler_expiry?, cost_pence)`.

**Notifications:** Return-due reminder 24h before.

**Connected modules:** Budget, Deliveries, Snagging (if equipment damaged).

**Revenue:** Free.

**Future:** Direct hire integration (HSS, Speedy, local plant) — order from within SiteBook.

---

### 4.24 Supplier connection — direct product ordering

**Purpose:** Order materials from within a project. Merchant sees the project context (delivery address, project brief, trade contact).

**UI:** "Order for this project" button on merchant product pages (already partially exists via Trade Center). Adds project link to the order.

**Backend:** Extends existing Trade Center product flow with a project_id link.

**Database:** `hammerex_trade_off_orders.sitebook_project_id uuid` (existing table).

**Notifications:** Order confirmed, shipped, delivered.

**Automation:** Order confirmation auto-creates a delivery record.

**Connected modules:** Trade Center, Deliveries, Budget.

**Revenue:** Marketplace revenue share (2.5% platform fee, or ad-supported for merchants who don't want to share).

**Future:** Merchant-of-record for suppliers who prefer a hands-off channel.

---

### 4.25 Site access QR codes

**Purpose:** Trades scan on arrival + departure. Automatic timekeeping, security log, insurance trail.

**UI:** Print-and-post-on-site QR (from /sitebook/access). Trade opens the code → recognised → arrival logged.

**Backend:** Signed URL per project + timestamp record.

**Database:** `hammerex_sitebook_site_access(id, project_id, listing_id?, scan_kind, scanned_at, gps_lat, gps_lng)`.

**Permissions:** Homeowner sees all scans. Trades see own.

**Notifications:** Push on scan (opt-in — "Watson arrived on site at 08:47").

**Automation:** Auto-generate timesheet from arrival + departure.

**Triggers:** Scan.

**Connected modules:** Timesheet reports, Budget (labour costs).

**Admin:** Rate-limit anti-abuse.

**Revenue:** Free (retention + trust).

**Future:** NFC tag alternative for anti-QR shy trades.

---

### 4.26 Visitor log

**Purpose:** Anyone else on site (delivery driver, inspector, neighbour) records themselves. Insurance-relevant.

**UI:** Same QR access flow with "I'm not a hired trade" branch → asks name + reason.

**Backend:** Extends site access records with `visitor_name` + `visitor_reason`.

**Notifications:** Push on visitor scan.

**Revenue:** Free.

---

### 4.27 Neighbour notifications

**Purpose:** UK law: certain works require neighbour notification (party wall, some planning conditions). Delightfully solve a legally required chore.

**UI:** New /sitebook/neighbours per project. Add neighbouring address + WhatsApp / email / letterbox. Send curated notice.

**Backend:** Template engine + delivery via WhatsApp Business API (partner Postmark/Twilio) + Royal Mail Print & Post API for letterbox postcards.

**Database:** `hammerex_sitebook_neighbour_notices(id, project_id, address, delivery_kind, sent_at, response_kind?, response_at?)`.

**Permissions:** Homeowner + assigned lead trade.

**Notifications:** Delivery confirmations, response received.

**Automation:** Suggest notice at project stages (start, noisy weeks, scaffolding up, complete).

**Triggers:** Milestone / manual.

**Connected modules:** Compliance (party wall obligations), Documents (notice PDFs).

**Admin:** Template curation with UK planning consultant.

**Revenue:** Free basic (WhatsApp/email). Pro: Royal Mail postcard delivery £1.50/postcard (10% margin).

**Future:** Automated party-wall surveyor referral if neighbours object.

---

### 4.28 Weather alerts + smart delays

**Purpose:** UK construction is weather-sensitive. Homeowner gets timely alert; AI Assistant proposes reschedule.

**UI:** Weather badge on project. Push alerts.

**Backend:** Met Office DataPoint API (free tier). Site location resolved from postcode.

**Database:** `hammerex_sitebook_weather_alerts(id, project_id, alert_kind, severity, valid_from, valid_to, affected_tasks jsonb, notified_at)`.

**Notifications:** Push on severe alert affecting scheduled outdoor work.

**Automation:** AI Assistant drafts reschedule proposal to affected trades.

**Triggers:** Alert issued matching project location + affected activity type.

**Connected modules:** Calendar, AI Assistant, Trades panel.

**Revenue:** Free (retention).

**Future:** Micro-forecast per postcode (partner with a weather-station provider).

---

### 4.29 Emergency contacts + procedures

**Purpose:** Water leak at 2am. Gas smell during a fit. Break-in on new build. Homeowner should have ONE number to call.

**UI:** /sitebook/emergency — big red-tinted panel with 999, National Gas emergency, water utility, structural engineer, insurance broker, project lead trade.

**Backend:** Static seed with per-homeowner overrides.

**Database:** `hammerex_sitebook_emergency_contacts(id, homeowner_id, kind, name, number, notes)`.

**Permissions:** Homeowner + all trades on projects (they may need it if on-site alone).

**Revenue:** Free (foundational trust).

**Future:** One-tap escalation to a Networkers 24/7 line (Concierge tier, £2/mo add-on).

---

### 4.30 Maintenance reminders

**Purpose:** Boiler service annually. Gutters twice yearly. Chimney sweep. Smoke alarm batteries. SiteBook keeps you on schedule.

**UI:** /sitebook/maintenance timeline. Auto-populated from installed assets (boiler with install date → service annually).

**Backend:** Rules engine keyed on asset kind.

**Database:** `hammerex_sitebook_maintenance_items(id, homeowner_id, asset_id?, kind, cadence_days, last_done_at?, next_due_at)`.

**Notifications:** Push 14/7/1 days before due.

**Automation:** Auto-suggest matching trade from Trade Circle when due.

**Triggers:** Cadence tick.

**Connected modules:** Asset register, Trade Circle, Calendar, Aftercare.

**Admin:** Maintenance taxonomy.

**Revenue:** Free basic. Aftercare subscription (£2.99/mo) unlocks pre-vetted-trade auto-book + priority slot.

**Future:** IoT integration (smart boilers report service status directly).

---

### 4.31 Asset register

**Purpose:** Every fitted item on the property tracked with install date, warranty, service history.

**UI:** /sitebook/assets. Filter by room.

**Database:** `hammerex_sitebook_assets(id, homeowner_id, kind, brand, model, serial, room, installed_at, installed_by_listing_id?, warranty_id?, cost_pence)`.

**Permissions:** Homeowner.

**Automation:** Auto-create asset on installation post; auto-link to warranty entries.

**Connected modules:** Warranties, Maintenance, Property Passport.

**Revenue:** Free.

**Future:** Barcode scan for products (scan boiler serial → auto-populate).

---

### 4.32 Aftercare subscription (£2.99/mo)

**Purpose:** Standing retainer that surfaces maintenance opportunities and books pre-vetted trades. Revenue that continues after project completion.

**UI:** /sitebook/aftercare — status panel + billing.

**Backend:** Stripe subscription linked to homeowner.

**Database:** `hammerex_homeowner_subscriptions(id, homeowner_id, tier, started_at, current_period_end, stripe_subscription_id, status)`.

**Notifications:** Renewal reminders.

**Connected modules:** Maintenance, Trade Circle (pre-vetted list), Warranty (claim assistance).

**Revenue:** £2.99/mo (£35.88/year) per subscribed homeowner. Target: 20% attach on paid tiers.

**Future:** Tiered aftercare (£2.99 basic, £9.99 white-glove, £29 concierge).

---

### 4.33 Client approval workflow

**Purpose:** Landlord/tenant, spouses, extended family — designate WHO signs off decisions.

**UI:** /sitebook/settings/access. Add family/party. Set role (viewer / editor / signer). Route decisions per role.

**Backend:** Permissions model + workflow engine.

**Database:**
- `hammerex_sitebook_access_grants(id, homeowner_id, grantee_email, role, invited_at, accepted_at?, revoked_at?)`
- Approval rules per project

**Permissions:** Grantor (homeowner) manages, grantees have scoped access.

**Notifications:** On decision routed to signer.

**Automation:** Route quotes/variations to signer automatically.

**Connected modules:** Quotes, Variations, Signatures.

**Revenue:** Free: 1 additional user. Pro: 3. Concierge: unlimited.

**Future:** Solicitor account type (their client's SiteBook read access for conveyancing).

---

### 4.34 Multi-user access

*(Combines with 4.33 above)*

Concierge tier + higher — spouse or letting agent gets full editor access, tracked separately, own notification prefs.

---

## 5. UI design system

### 5.1 Palette

| Token | Value | Use |
|---|---|---|
| `--tn-bg` | `#FBF6EC` | Page background (canonical off-white) |
| `--tn-ink` | `#0A0A0A` | Primary text |
| `--tn-yellow` | `#FFB300` | Brand accent, primary CTA fills |
| `--tn-green` | `#166534` | WhatsApp CTAs, success states |
| `--tn-amber` | `#F59E0B` | Warnings, in-progress |
| `--tn-red` | `#DC2626` | Errors, urgent alerts, risk-red |
| `--tn-border` | `rgba(0,0,0,0.08)` | Card borders |
| `--tn-border-warm` | `rgba(139,69,19,0.15)` | Canteen/trade surface borders |

### 5.2 Typography

- Body: system-ui (default), 13-14px baseline
- Headings: font-black (900), tight tracking
- All-caps micro-labels: 10-10.5px, letter-spacing 0.22em
- WCAG 2.1 AA: 4.5:1 contrast for body, 3:1 for large text (`text-neutral-500` on off-white = borderline; upgrade to `text-neutral-600` on backgrounds lighter than `#F5F5F5`)

### 5.3 Component patterns

- **Card:** `rounded-2xl border-2 bg-white shadow-sm`, 5-part hierarchy (eyebrow · title · body · action row · thread)
- **Pill CTA:** `h-11 rounded-full px-5 text-[12px] font-black uppercase tracking-wider`
- **Chip:** `h-8 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider`
- **Icon:** Lucide, size 12-14 in nav, 16-20 in card headers
- **Animation:** SMIL for SVG (previews), CSS keyframes for CTA breathing, respect `prefers-reduced-motion` everywhere

### 5.4 Density rule

**Compact by default.** Trades have 3 seconds — density signals professionalism. Padding scales up by breakpoint but never below `p-3`.

### 5.5 Motion principles

- Use motion to convey state change, not decoration
- One-time entrance animations OK (fade-in 200ms)
- Repeating animations reserved for "live" signals (breathing glow, ping dot)
- Never combine 2 repeating animations in the same viewport region

---

## 6. Navigation redesign

### 6.1 Homeowner nav (final structure)

```
Header (sticky):
  ● SiteBook · [Nickname]                     [Avatar dropdown]
  Feed · Projects · Compliance · Calendar
                                              [Ask AI ✨]

Avatar dropdown:
  My SiteBook →
  ─────────────
  Threads · Documents · Warranties · Assets
  ─────────────
  Aftercare · Billing · Settings · Log out
```

### 6.2 Bottom nav on mobile (all times)

```
[Feed] [Projects] [+ Post] [Trades] [More]
```

### 6.3 Project-scoped tabs (inside a project)

```
Feed · Tasks · Budget · Timeline · Snagging · Docs · Compliance
```

### 6.4 Menu grouping principle

Every menu item answers ONE question:
- **Feed / Projects / Trades / Calendar** — "what's happening?"
- **Documents / Warranties / Assets / Compliance** — "where's the record?"
- **Budget / Cashflow** — "how much has this cost?"
- **Aftercare / Maintenance** — "what next?"

If an item doesn't answer one of these, don't add it.

### 6.5 Icons

Every top-level item gets a Lucide icon. Nested items are text-only (reduce visual noise).

### 6.6 Discoverability

Rule: every feature is reachable in ≤3 taps from the SiteBook home. Any feature deeper than 3 taps must have a "quick action" surface elsewhere (feed CTA, search result, AI-suggested link).

---

## 7. Free tier specification

**Included (forever, no card required):**

| Feature | Free limit |
|---|---|
| Projects | Unlimited |
| Posts / replies | Unlimited |
| Photos | 100/mo upload, 2GB total storage |
| WhatsApp reveals | 3/month |
| AI Assistant | 20 messages/day |
| Auto-brief generator | 3/month |
| Voice notes | 5 min/month |
| Smart search | Post text only (no semantic) |
| Calendar | Month view |
| Tasks | 10 open |
| Budget | Totals only (no line items) |
| Snagging | 5 open per project |
| Warranty vault | 10 active warranties |
| Compliance | Basic checklist (no auto-attach) |
| Trade Circle | Unlimited browse |
| Invitations | Unlimited (each costs 1 washer) |
| Multi-user | 1 additional user (viewer only) |
| Export | £9.99 one-off, on-demand |

**The Free tier must be honestly useful — never limit the CORE loop (invite, message, post, record).** Limits gate scale, not existence.

**Powered-by-The-Network footer** on every free SiteBook when shared publicly (viral loop).

---

## 8. Premium tier ladder

Four tiers. Each unlocks a specific job-to-be-done, not just "more stuff".

### 8.1 Free (£0)

Job: **Try SiteBook without commitment.** Get value on 1-2 small projects.

### 8.2 Pro (£4.99/mo · £49/year)

Job: **Run a live project professionally.** For a homeowner mid-refurb.

Unlocks:
- 30 WhatsApp reveals/month (up from 3)
- 200 AI Assistant messages/day (up from 20)
- 500 photo uploads/mo, unlimited storage
- Semantic + document search
- Calendar sync (Google/Outlook), Gantt view
- Unlimited tasks + line-item budget + alerts
- Unlimited snagging
- Unlimited warranties
- Reminder-attached compliance
- Cashflow forecast
- Digital signatures unlimited
- 3 additional users (editor)
- Priority support (24h SLA)

**Value narrative:** "Your project is worth £30k+. Pro pays for itself with one prevented mistake."

### 8.3 Concierge (£14.99/mo · £149/year)

Job: **Run a big refurb without stress.** For a homeowner with £100k+ project or multiple projects.

Unlocks everything in Pro plus:
- Unlimited voice notes + auto-briefs
- AI Assistant proactive risk interventions
- Portfolio calendar (multiple properties)
- Advanced analytics + report exports
- Neighbour Royal Mail postcards included (10/mo)
- Aftercare subscription bundled
- 1-hour onboarding call with a Networkers project mentor
- Priority support (1h SLA)
- Unlimited multi-user (family, PA, letting agent)

**Value narrative:** "Concierge is your PA for the whole project — cheaper than 30 minutes of a solicitor's time."

### 8.4 Portfolio (£49/mo · £490/year) — landlord tier

Job: **Manage 3+ properties.** For BTL landlords, letting agents, developers.

Unlocks everything in Concierge plus:
- Multi-property dashboard
- Portfolio-level cashflow + reporting
- Tenant view (limited access for repair reports)
- Custom-branded exports (agent branding on Property Passports)
- API access (integrate with Xero / QuickBooks)
- Volume discount on WhatsApp reveal packs (20% off)

**Value narrative:** "One SiteBook per property, one dashboard for the whole portfolio. Cheaper than any letting-agent maintenance module."

### 8.5 Pack pricing (pay-as-you-go, tier-agnostic)

WhatsApp reveals:

| Pack | Retail (incl. VAT) | Net per contact |
|---|---|---|
| 5 | £6.49 | £1.02 |
| 10 | £12.99 | £1.04 |
| 20 | £24.99 | £1.01 |
| 50 | £59.99 | £0.98 |
| 100 | £119.99 | £0.98 |

Aligned with the £1-net-per-contact model already implemented.

### 8.6 Add-ons

- Aftercare: £2.99/mo (Free/Pro can add on)
- Emergency 24/7 line: £2/mo (Concierge+ add-on)
- Extra portfolio properties: £4.99/mo per property beyond 5 (Portfolio tier)

---

## 9. Trade Circle integration strategy

### 9.1 Placements on SiteBook surfaces

**Where the Trade Circle banner appears — with rotation logic:**

| Surface | Placement | Rotation | Targeting |
|---|---|---|---|
| SiteBook feed empty state | Full-width card, 3-tile carousel | Refresh daily | By postcode + project trade needed |
| Post composer (project selected) | Suggested trades chip row | Refresh per composer open | Match project brief AI-parsed skills |
| End of every 5th feed post | In-line sponsored card | Refresh per session | Match viewed post trade type |
| Budget tab | "Get another quote" strip | Static | Match project trade shortfall |
| Snagging manager (open snag > 7 days) | "Invite a snagger" card | Static | Snagging specialists in area |
| Warranty vault (expiring soon) | "Book service" nudge | Time-based | Matching trade type in area |
| AI Assistant response (contextual) | Trade recommendations inline | Per query | AI-generated match |

### 9.2 Trade eligibility for placements

To appear in premium placements, a trade must:
- Verified (business + insurance docs on file)
- ≥3-month streak on The Network
- ≥4.5-star average across ≥5 reviews
- <24h average response time to invitations

### 9.3 Trade-side promotion tools

Trades opt into placements at 3 levels:

- **Standard** (free): appears in Trade Circle directory when searched
- **Boosted** (£19/mo per postcode): pushed to top of directory + featured on empty-state carousel + AI Assistant recommendations
- **Sponsored invites** (£1.50 per invitation the homeowner sends): appears in AI suggestions AND at the top of composer's trade picker

### 9.4 Analytics + attribution

Every placement tracked:
- Impressions
- Clicks (canteen views)
- Invitations sent
- Invitations accepted
- Projects completed
- Revenue attributed (if paid tier upgrade or pack purchase within 30d)

Trade sees own analytics; admin sees aggregate.

### 9.5 Ethical rules

- Sponsored placements ALWAYS labelled "Sponsored"
- No sponsored above compliance/safety content
- Homeowner can permanently opt out of sponsored placements (Pro+)
- Suggested trades never in AI risk-warning contexts (no monetising fear)

---

## 10. Complete revenue streams

**21 monetisation avenues, all ethical, all with expected ARPU:**

| # | Stream | Model | Y2 target | Ethical guardrail |
|---|---|---|---|---|
| 1 | Pro subscription | £4.99/mo | £359k | — |
| 2 | Concierge subscription | £14.99/mo | £216k | — |
| 3 | Portfolio subscription | £49/mo | £147k | — |
| 4 | Aftercare subscription | £2.99/mo add-on | £72k | — |
| 5 | WhatsApp reveal packs | Pay-as-you-go | £120k | £1 net per contact honest |
| 6 | Property Passport export | £9.99 one-off | £40k | Real house-value artefact |
| 7 | Trade Circle Boosted placements | £19/mo per postcode | £180k | Labelled "Sponsored" |
| 8 | Trade Circle Sponsored invites | £1.50 per invite | £96k | Never in risk contexts |
| 9 | Marketplace supplier commissions | 2.5% of order value | £120k | Optional for merchant; no exclusivity |
| 10 | Verification badges | £29 one-off (business + insurance verify) | £58k | Verified is a public trust signal |
| 11 | Featured products on canteen | £9.99/mo per product | £48k | — |
| 12 | Digital signature workflow (Enterprise) | £29/mo per merchant | £48k | — |
| 13 | Royal Mail neighbour postcards | £1.50/postcard, 10% margin | £8k | — |
| 14 | Snagging inspection service | £69 per inspection, 30% margin | £28k | Homeowner opt-in only |
| 15 | Aftercare claim assistance | £29 per warranty claim | £15k | Only when homeowner requests |
| 16 | Legal template library | £4.99/mo add-on | £24k | Curated with UK solicitor |
| 17 | Insurance referrals | Commission per policy | £45k | Broker partnership, disclosed |
| 18 | Finance referrals (home improvement loans) | Commission per loan | £30k | FCA-compliant partner |
| 19 | White label (letting agents, developers) | £299/mo per branded instance | £150k | Enterprise sales |
| 20 | API licensing (Xero, QuickBooks bridges) | £99/mo per integration | £30k | — |
| 21 | Estate agent Property Passport bundles | £299 per property, 20% margin | £60k | Wins listings faster |

**Total addressable (Y2):** ~£1.9M · target realisation: ~£1.28M (67%)

**Categories that require NO subscription creep:**

- Free tier remains genuinely useful — never limit the core loop
- WhatsApp reveals scale linearly with USE (fair)
- Trade-side monetisation subsidises homeowner side (correct)
- Aftercare + services scale with lifetime value (compounds)

---

## 11. Backend architecture

### 11.1 New tables needed (summary)

```sql
hammerex_sitebook_ai_threads              -- 4.1
hammerex_sitebook_ai_messages
hammerex_sitebook_ai_actions

hammerex_sitebook_events                  -- 4.8 calendar
hammerex_sitebook_tasks                   -- 4.9
hammerex_sitebook_budget_lines            -- 4.10
hammerex_sitebook_cashflow_events         -- 4.11
hammerex_sitebook_snags                   -- 4.12
hammerex_sitebook_variations              -- 4.13
hammerex_sitebook_signatures              -- 4.14
hammerex_sitebook_documents               -- 4.15
hammerex_sitebook_warranty_reminders      -- 4.16
hammerex_sitebook_compliance_items        -- 4.17
sitebook_compliance_rules                 -- (seeded)
hammerex_sitebook_exports                 -- 4.19
hammerex_sitebook_deliveries              -- 4.21
hammerex_trade_availability               -- 4.22 (trade-side)
hammerex_sitebook_equipment               -- 4.23
hammerex_sitebook_site_access             -- 4.25 + 4.26
hammerex_sitebook_neighbour_notices       -- 4.27
hammerex_sitebook_weather_alerts          -- 4.28
hammerex_sitebook_emergency_contacts      -- 4.29
hammerex_sitebook_maintenance_items       -- 4.30
hammerex_sitebook_assets                  -- 4.31
hammerex_homeowner_subscriptions          -- 4.32
hammerex_sitebook_access_grants           -- 4.33
```

25 new tables. Column additions to existing tables (photos, projects, warranties) also required — detailed inline per feature spec.

### 11.2 New API surfaces

```
POST   /api/homeowner/ai/chat                     — 4.1
POST   /api/homeowner/ai/brief                    — 4.2
POST   /api/homeowner/photos/analyse              — 4.3
POST   /api/homeowner/events                      — 4.8
CRUD   /api/homeowner/tasks                       — 4.9
CRUD   /api/homeowner/budget/lines                — 4.10
GET    /api/homeowner/cashflow/forecast           — 4.11
CRUD   /api/homeowner/snags                       — 4.12
CRUD   /api/homeowner/variations                  — 4.13
POST   /api/homeowner/variations/[id]/sign        — 4.14
POST   /api/inbound/docs                          — 4.15 (Postmark webhook)
GET    /api/homeowner/compliance/[projectId]      — 4.17
POST   /api/homeowner/exports                     — 4.19
POST   /api/homeowner/exports/[id]/stripe         — 4.19 payment
CRUD   /api/homeowner/deliveries                  — 4.21
POST   /api/homeowner/site-access/qr              — 4.25
POST   /api/site-access/scan                      — 4.25 (public, token)
CRUD   /api/homeowner/neighbours                  — 4.27
GET    /api/weather/[postcode]                    — 4.28
CRUD   /api/homeowner/emergency-contacts          — 4.29
CRUD   /api/homeowner/maintenance                 — 4.30
CRUD   /api/homeowner/assets                      — 4.31
POST   /api/homeowner/subscriptions               — 4.32
CRUD   /api/homeowner/access-grants               — 4.33
```

### 11.3 New cron jobs (Vercel scheduled functions)

| Cron | Cadence | Purpose |
|---|---|---|
| `/api/cron/completion-predictions` | 03:00 daily | Recompute predictions per project |
| `/api/cron/risk-scores` | 03:15 daily | Recompute risk signals |
| `/api/cron/warranty-reminders` | 09:00 daily | Send warranty expiry pings |
| `/api/cron/maintenance-reminders` | 09:00 daily | Send maintenance dues |
| `/api/cron/weather-alerts` | 05:00 + 17:00 daily | Poll Met Office per active project location |
| `/api/cron/ai-usage-caps-reset` | 00:00 daily | Reset per-user AI daily counters |
| `/api/cron/document-classify-retry` | Hourly | Retry failed AI doc classifications |
| `/api/cron/subscription-renewal-check` | 00:15 daily | Handle Stripe webhook stragglers |
| `/api/cron/export-cleanup` | 04:00 daily | Delete unclaimed exports > 30d |
| `/api/cron/embeddings-backfill` | Every 5min | Update pgvector for new content |

### 11.4 External integrations

- **OpenAI / Anthropic** — AI assistant, briefs, photo analysis, transcription
- **Postmark** — inbound docs email, outbound transactional emails
- **Met Office DataPoint** — weather
- **Royal Mail Print & Post API** — neighbour postcards
- **Stripe** — subscriptions + one-off exports + packs (already integrated)
- **WhatsApp wa.me** — deep links (no API cost, already used)
- **Google / Outlook Calendar** — OAuth calendar sync
- **Twilio (fallback)** — SMS backup channel for critical notifications
- **Open Banking (TrueLayer/Plaid)** — bank connection for cashflow (Portfolio tier)

### 11.5 Storage

- Supabase Storage for photos, documents, exports
- Bucket per data class: `sitebook-photos`, `sitebook-documents`, `sitebook-exports`, `sitebook-voice-notes`
- Signed URLs for public/trade access (24h expiry)
- Retention: Free tier photos deleted at 12mo if inactive; Pro forever

---

## 12. Automation + AI workflows

### 12.1 The 12 automation flows

1. **Empty state activation:** Guest signup → 3-step wizard → first post drafted by AI from a photo → first trade invited from Trade Circle → project live in 60 seconds.
2. **Quote received → budget line:** AI classifies inbound doc as quote → extracts amount + trade → creates budget line as "quoted".
3. **Invoice paid → cashflow event:** Homeowner marks paid → cashflow forecast recomputes.
4. **Completion post → warranty auto-log:** Trade posts "job complete" → AI prompts trade to enter warranty terms → auto-logs.
5. **Warranty 30 days from expiry:** Push to homeowner + prompt to book service via matched trade.
6. **Snagging photo → snag entry:** Homeowner uploads photo tagged "issue" by AI → draft snag entry ready to assign.
7. **Weather alert → reschedule proposal:** Severe weather forecast + outdoor task next 48h → AI drafts reschedule message to trade.
8. **Ghosted invitation → resend nudge:** 24h Mon-Sat SLA elapsed → free-first-nudge suggestion → after that, resend costs 1 washer.
9. **Trade completes work:** Prompt homeowner for review → link to Reviews module → optional public canteen post.
10. **Project 90% budget consumed:** Push alert → AI Assistant proactively opens with "Here's why + here's what we can do".
11. **Aftercare renewal:** Homeowner subscribed → 30 days before maintenance due → auto-book pre-vetted trade → homeowner confirms.
12. **Export purchased:** Payment confirmed → PDF+ZIP generated in <60s → push + email with download link.

### 12.2 AI budget + safety

Per-user daily cost caps enforced server-side:
- Free: £0.05/day
- Pro: £0.50/day
- Concierge: £3.00/day
- Portfolio: £15.00/day

Model selection based on task complexity + user tier (cheaper models for classification, better models for chat).

Prompt injection defence: user input never concatenated raw into system prompt; use tool-calling with typed schemas.

### 12.3 Failure modes

Every automation must degrade gracefully:
- AI down → show "AI unavailable, draft manually" fallback
- Postmark down → queue email inbounds
- Weather API down → skip alert (silent)
- Stripe webhook missed → nightly reconciliation cron catches it

---

## 13. Permissions model

### 13.1 Roles

| Role | Homeowner surface | Trade surface | Admin surface |
|---|---|---|---|
| Homeowner (owner) | Full CRUD | — | — |
| Family (editor) | Full CRUD except billing | — | — |
| Family (viewer) | Read only | — | — |
| Assigned trade | Read own-invited posts, reply, upload photos, update tasks assigned to self | Own canteen full CRUD | — |
| Sponsored trade (via boost) | Read Trade Circle placement analytics | Own canteen | — |
| Networkers admin | — | — | Full |
| Networkers support | — | — | RO + escalate |

### 13.2 Capability matrix (partial)

| Capability | Homeowner | Family-editor | Family-viewer | Assigned trade |
|---|---|---|---|---|
| Post to project | ✅ | ✅ | ❌ | ❌ (reply only) |
| Sign a variation | ✅ | Configurable | ❌ | ✅ (their side) |
| Approve a quote | ✅ | Configurable | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ | ❌ |
| See budget totals | ✅ | ✅ | ✅ (Pro+) | Own lines only |
| Send invitations | ✅ | ✅ | ❌ | ❌ |
| Revoke trade | ✅ | ✅ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ |

### 13.3 Enforcement

All permissions enforced server-side via Supabase RLS + application-level checks in API routes. Client-side hiding is a UX nicety, not security.

---

## 14. Notification system

### 14.1 Channels

- **In-app** (bell icon, badge count)
- **Push** (web push + iOS/Android via PWA VAPID)
- **Email** (Postmark, digest by default, real-time for critical)
- **WhatsApp** (opt-in, critical only — no marketing)

### 14.2 Categories + defaults

| Category | Push default | Email default | WhatsApp default |
|---|---|---|---|
| New reply on your post | On | Digest | Off |
| Trade accepted invite | On | Real-time | On |
| Trade declined invite | On | Real-time | Off |
| Quote received | On | Real-time | Off |
| Variation needs signature | On | Real-time | On (Pro+) |
| Payment reminder | On | Real-time | Off |
| Warranty expiring | On | Digest | Off |
| Weather alert affecting your project | On | Real-time | On (Pro+) |
| AI proactive nudge | On | Off | Off |
| Marketing/updates | Off | Off | Off (always) |

### 14.3 User controls

Full per-category × per-channel toggle grid at `/sitebook/settings/notifications`. Save immediately, effective for next event.

### 14.4 Digest logic

Email digest sent 18:00 UK local time with all non-real-time items. Skipped if user has ≥1 in-app read that day (assume they're active).

---

## 15. Mobile-first improvements

### 15.1 App shell

PWA-first — installable to home screen from Safari/Chrome. Manifest at `/manifest.json` (already exists). Offline shell: last 20 posts + composer draft.

### 15.2 Bottom nav (mobile only)

Fixed 5-slot nav (Feed / Projects / + / Trades / More). `+` is a dial-out for quick actions: Post · Photo · Voice · Task.

### 15.3 Touch targets

Every interactive element ≥44px per WCAG 2.5.5. Existing chips + buttons compliant post-audit.

### 15.4 Camera integration

Direct camera access on Photo upload (not just gallery) — HTML `capture="environment"`. Voice recorder uses MediaRecorder API.

### 15.5 Offline queue

Posts drafted offline queued in IndexedDB → auto-submit when online. Show pending state on affected posts.

### 15.6 iOS PWA quirks

- Add-to-home-screen prompt after 2nd visit
- Handle `standalone` display mode (no browser chrome)
- iOS 17+ push notifications supported — enable

---

## 16. Future roadmap (5 years)

### Year 2 (immediately after v2 launch)

- Digital twin per property (3D model built from LiDAR iOS scans)
- Property-level ML: predict which trade will accept invitations based on brief style
- Voice-first mode ("Hey SiteBook, add a task…")
- Trade Circle machine-learning ranking (personalised per homeowner history)

### Year 3

- Wearable integration (trade's Apple Watch scans QR on arrival)
- Augmented Reality snagging (point iPhone at a wall, tap crack, snag logged)
- Site cameras integration (Ring/Reolink partnership, feeds appear in project timeline)
- AI negotiation assistant (drafts fair counter-quotes based on platform norms)

### Year 4

- Digital twin export as OpenAPI standard (buildings-industry-standard artefact)
- Trade reputation graph (cross-project, cross-network relationship scoring)
- Predictive maintenance: IoT integration says boiler will fail in 6 weeks
- Sitebook API marketplace (third-party apps build on top)

### Year 5

- Financial products: Networkers-branded home improvement loan (partner-underwritten)
- Insurance products: trade indemnity + homeowner-side project insurance
- Materials pricing intelligence (SiteBook analyses invoices at scale → publishes fair-price index for materials by region)
- Multi-country expansion (Ireland → Australia → NZ, mirroring platform-level UK / USA / AU compliance already in place)

### Moat features — build early, cash later

- **Property-lifetime data** — the 20-year record only SiteBook has
- **AI trained on real project + trade + region + season data** — nobody else has this corpus
- **Trade + homeowner two-sided marketplace network effects** — every added trade increases homeowner value, vice versa
- **Compliance depth** — becoming the definitive UK construction-compliance guide
- **Estate agent recommendation loop** — once agents recommend Property Passport at sale, we're the default

---

## 17. Feature ranking matrix

Every feature scored 1-5 on three axes: **User Value · Implementation Complexity · Revenue Potential**.

Prioritisation formula: `(UserValue × RevenuePotential) / Complexity`. Higher = ship earlier.

| # | Feature | UV | IC | RP | Score |
|---|---|---:|---:|---:|---:|
| 4.1 | AI Assistant | 5 | 4 | 5 | **6.25** |
| 4.10 | Budget tracker | 5 | 2 | 4 | **10.0** |
| 4.12 | Snagging manager | 4 | 2 | 3 | **6.0** |
| 4.8 | Calendar/Gantt | 5 | 3 | 4 | **6.67** |
| 4.15 | Document intake | 5 | 3 | 4 | **6.67** |
| 4.19 | Property Passport | 4 | 3 | 5 | **6.67** |
| 4.16 | Warranty vault | 4 | 2 | 3 | **6.0** |
| 4.17 | Compliance centre | 5 | 4 | 3 | **3.75** |
| 4.2 | Auto-brief generator | 4 | 2 | 3 | **6.0** |
| 4.32 | Aftercare subscription | 3 | 2 | 5 | **7.5** |
| 4.30 | Maintenance reminders | 4 | 2 | 4 | **8.0** |
| 4.9 | Tasks | 3 | 2 | 2 | **3.0** |
| 4.11 | Cashflow forecast | 4 | 3 | 4 | **5.33** |
| 4.5 | Risk score | 4 | 2 | 3 | **6.0** |
| 4.28 | Weather alerts | 3 | 2 | 2 | **3.0** |
| 4.13 | Variation manager | 4 | 3 | 3 | **4.0** |
| 4.14 | Digital signatures | 4 | 3 | 3 | **4.0** |
| 4.6 | Smart search | 5 | 4 | 2 | **2.5** |
| 4.3 | Photo AI recognition | 4 | 4 | 3 | **3.0** |
| 4.25 | Site access QR | 3 | 3 | 2 | **2.0** |
| 4.27 | Neighbour notifications | 4 | 4 | 2 | **2.0** |
| 4.4 | Completion prediction | 3 | 4 | 2 | **1.5** |
| 4.7 | Voice notes | 3 | 3 | 2 | **2.0** |
| 4.24 | Supplier connection | 4 | 5 | 4 | **3.2** |
| 4.20 | Live status per trade | 3 | 2 | 2 | **3.0** |
| 4.21 | Delivery tracking | 3 | 3 | 3 | **3.0** |
| 4.22 | Trade availability | 3 | 4 | 2 | **1.5** |
| 4.31 | Asset register | 3 | 2 | 2 | **3.0** |
| 4.29 | Emergency contacts | 3 | 1 | 1 | **3.0** |
| 4.23 | Equipment register | 2 | 2 | 2 | **2.0** |
| 4.26 | Visitor log | 2 | 2 | 1 | **1.0** |
| 4.33 | Approval workflow | 3 | 3 | 2 | **2.0** |
| 4.34 | Multi-user access | 3 | 3 | 3 | **3.0** |
| 4.18 | Digital site folder | 3 | 1 | 1 | **3.0** |

**Top 10 by score:** Budget tracker · Maintenance reminders · Aftercare · Calendar · Document intake · Property Passport · AI Assistant · Snagging · Warranty vault · Auto-brief.

---

## 18. Phased implementation plan

**Design philosophy:** ship the tier-driving features first, defer the nice-to-haves. Every phase results in a launchable, revenue-generating SiteBook.

### Phase 1 (weeks 1-6) — "Own the loop"

**Goal:** homeowner runs a project end-to-end with financial control and honest AI help. Pro tier launches.

Ship:
1. Budget tracker (§4.10) — cheap, high-value
2. Maintenance reminders (§4.30) — retention driver
3. Aftercare subscription (§4.32) — enable recurring revenue
4. AI Assistant (§4.1) v1 — chat + context, no proactive
5. Calendar (§4.8) — foundational time perspective
6. Warranty vault (§4.16) completion — polish + reminders
7. Snagging manager (§4.12)
8. Digital site folder (§4.18) — cheap win
9. Emergency contacts (§4.29) — cheap win

**Launches:** Pro tier live, Aftercare add-on live.

**Effort:** ~6 developer-weeks (assuming 1 senior full-stack + AI setup).

**Revenue impact at day 90:** ~200 Pro subscribers × £4.99 = £1k MRR baseline.

### Phase 2 (weeks 7-14) — "Own the record"

**Goal:** SiteBook becomes the canonical record for every project. Compliance + documents + Property Passport export online.

Ship:
1. Document intake (§4.15) — big unlock
2. Compliance centre (§4.17)
3. Auto-brief generator (§4.2)
4. Photo AI recognition (§4.3)
5. Property Passport export (§4.19) — activates £9.99 revenue
6. Digital signatures (§4.14)
7. Variation manager (§4.13)
8. Asset register (§4.31)
9. Risk score (§4.5)
10. Smart search (§4.6) v1 (text only)

**Launches:** Concierge tier live. Property Passport exports live.

**Effort:** ~8 developer-weeks.

**Revenue impact at day 180:** Concierge subscribers + export revenue starts (~£8k MRR blended).

### Phase 3 (weeks 15-24) — "Own the network"

**Goal:** Trade + supplier + landlord features that make the platform impossible to leave.

Ship:
1. Multi-user + approval workflow (§4.33 + 4.34)
2. Portfolio tier (multi-property landlord surface)
3. Trade availability calendar (§4.22)
4. Live status per trade (§4.20)
5. Material delivery tracking (§4.21)
6. Supplier connection (§4.24)
7. Weather alerts (§4.28)
8. Neighbour notifications (§4.27)
9. Site access QR (§4.25) + Visitor log (§4.26)
10. Voice notes (§4.7)
11. AI Assistant v2 — proactive nudges
12. Cashflow forecast (§4.11)
13. Tasks (§4.9) — deferred but ship now
14. Equipment register (§4.23)
15. Trade Circle Boost + Sponsored monetisation live

**Launches:** Portfolio tier live. Full trade monetisation live.

**Effort:** ~10 developer-weeks.

**Revenue impact at day 365:** Blended ~£30k MRR.

### Cross-cutting foundations (parallel to all phases)

- Analytics + admin dashboard (see §19)
- Notification system + settings UI
- PWA polish + mobile bottom nav
- Permissions RLS enforcement + audit
- CI test coverage on every new API

---

## 19. Success metrics + KPIs

### 19.1 North-star

**Weekly Active Homeowners with ≥1 project posted × avg-months-since-first-post.** Compounds retention + activation into one number. Target: 10x in Y2.

### 19.2 Key metrics

**Activation:**
- Signup → first project posted (target: 60% within 24h)
- First project → first trade invited (target: 80% within 7d)
- First invitation → first accepted (target: 70%)

**Retention:**
- D7 return rate (target: 65%)
- D30 return rate (target: 50%)
- Y1 retention (target: 40%)
- Y2+ retention (target: 25% — this is the SiteBook long-tail thesis)

**Monetisation:**
- Free → Pro conversion within 90d (target: 25%)
- ARPU by tier (target: £59.88 Pro / £179.88 Concierge / £588 Portfolio)
- LTV/CAC ratio (target: >3)
- Payback period (target: <8 months)

**Ecosystem:**
- % of invited trades that accept (target: >70%)
- Avg reveals per active month (Pro user) (target: 8-12)
- Trade Circle Boost adoption (target: 15% of active trades)

### 19.3 Admin analytics dashboard

Every metric above visible at `/admin/analytics/sitebook`. Real-time counters + weekly/monthly aggregates + cohort analysis.

Alerts:
- Any KPI drops >10% week-over-week → Slack alert to Philip
- Any tier has <95% payment success → alert
- Any API endpoint p95 latency > 1s → alert

---

## 20. Risk register + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI cost overrun | Medium | High | Per-tier daily caps enforced server-side; model auto-downgrade at cap |
| Trades reject invitation flow | Medium | High | Reply-link works without login; existing pattern proven |
| Homeowners don't upgrade past Free | High | High | Pro tier includes provable ROI features (budget, AI) — most upgrade in month 2 during a live project |
| Supabase scaling costs | Low | Medium | Storage lifecycle policies; photo compression pipeline (WebP conversion) |
| Compliance rules go stale | Medium | Medium | Quarterly review with UK building surveyor partner |
| Postmark inbound doc abuse (spam) | Medium | Low | Sender verification + rate limit per homeowner |
| Weather API rate limits | Low | Low | Cache by postcode + 30-min TTL |
| Legal liability on compliance advice | Low | High | Every compliance card labelled "guidance only, verify with qualified professional" |
| Trade backlash on Boost pricing | Medium | Medium | Free tier stays useful; Boost is opt-in only |
| Homeowners share account creds | Medium | Low | Multi-user is a feature, not a leak — designed for this |
| PWA install friction on iOS | High | Medium | Explicit "Add to home screen" walkthrough on 2nd visit |
| GDPR / data-subject-request volume | Low | High | Automated DSR export + delete pipeline before launch |
| Stripe dispute rates high | Low | Medium | 100% refund on £9.99 export if unopened |
| Property Passport not accepted by estate agents | Medium | Medium | Partner with 3 major UK agents before launching bulk |

---

## Immediate next actions (this week)

1. **Get Philip's approval on tier pricing** — Pro £4.99, Concierge £14.99, Portfolio £49
2. **Kick off Phase 1** — start with Budget tracker (highest score, cheapest ship)
3. **Set up OpenAI account with per-user cost telemetry** — foundational for AI features
4. **Design + prototype the Budget tracker UI** — 1-day workshop
5. **Schedule quarterly compliance review call with a UK building surveyor**
6. **Draft estate-agent partnership template for Property Passport bundles**
7. **Confirm PWA push notification implementation approach** (VAPID setup)
8. **Book a 60-min call with a UK construction solicitor** on legal template library scope

**End of blueprint.**

---

*Document owner: Philip · Implementation lead: TBD · Last review: 2026-07-19*
