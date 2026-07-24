# Nex Business Builder V2 · Complete Redesign Specification

**Production spec · 2026-07-23**
**Purpose:** replace V1's 5-step wizard (60% drop-off in simulation) with a progressive-activation system that construction businesses enjoy completing. Ready for immediate implementation.

**Related documents:** Phase 31 Business Builder Blueprint (V1 · original design) · Pre-Launch Validation Report (why V1 fails) · Pre-Launch Implementation Plan (Sprint 3 slot) · ES-01 Engineering Bible.

**Key departure from V1:**

- V1 = 5-step onboarding wizard that gates publish → merchants abandoned when they hit a hard question
- V2 = **immediate value + progressive activation** → merchant experiences their business in Nex within 60 seconds, then unlocks capabilities over Day 1 → Week 1 → Month 1

---

## Section 1 · Design Philosophy

Business Builder V2 operates by nine principles. Every screen, every prompt, every decision defers to them.

### 1.1 Remove anxiety

- Never ask for information the merchant might not have to hand
- Never make the merchant commit before seeing value
- Never show a form that looks intimidating (long, multi-column, dense)
- **Rule:** if a question could make the merchant close the tab, it's asked later

### 1.2 Build excitement

- The merchant sees their business come alive within 60 seconds
- Every mission unlocks visible improvement to their tradesite
- Micro-celebrations for every achievement (subtle animations, not confetti overload)
- **Rule:** every interaction ends better than it started

### 1.3 Show progress

- Persistent progress indicator (Business Health Score) always visible
- Every mission clearly labelled with expected time
- Completed missions permanently visible as achievements
- **Rule:** the merchant always knows where they are and where they're going

### 1.4 Deliver value immediately

- Draft tradesite appears in <60 seconds
- Even with zero merchant input beyond "I'm an electrician in Cardiff", something real exists
- Value delivered before anything is asked
- **Rule:** value precedes ask, always

### 1.5 Teach users naturally

- No tutorial modals
- Every capability introduced when its moment arrives (Trade Centre unlocks when merchant adds their first product)
- Contextual tips replace documentation
- **Rule:** if a feature needs explaining, its introduction is broken

### 1.6 Reduce decision fatigue

- Maximum 3 options at any choice point
- Sensible defaults for everything
- "Skip for now" always available except for security-critical steps
- **Rule:** the merchant should never think "what should I pick?"

### 1.7 Celebrate achievements

- First tradesite live · first customer invited · first quote issued — all get warm acknowledgment
- Streak language ("you've been active 4 days in a row · nice")
- Milestones visible on dashboard
- **Rule:** celebrate real achievements, never trivial ones (no "you clicked a button!" nonsense)

### 1.8 Build trust

- Every AI-generated draft clearly labelled
- Every automated fact traces to source (Companies House verified · Google Maps address · etc.)
- No fake reviews, no fake credentials, no fake portfolio (constitutional)
- **Rule:** honesty is the trust foundation, not marketing

### 1.9 Never overwhelm

- One thing at a time
- Batched notifications, not drip
- Merchant chooses pace
- **Rule:** if a screen has more than one call-to-action, redesign it

---

## Section 2 · The First 60 Seconds

Screen-by-screen. The merchant's first minute on Nex determines everything.

### T+0s · The landing

**Screen:** clean single page. Nex logo (dot + wordmark per brand tokens). Single line of text:

> **"Let's set up your construction business in 60 seconds."**

Below: one large button — **"Start"** — and one small link — **"I already have an account"**.

That's the entire landing screen. No headline garbage. No feature list. No testimonials.

### T+3s · Sign-in choice

**Screen:** three sign-in options as large tiles:

- Continue with Google
- Continue with Microsoft
- Continue with email

Google + Microsoft are prioritised because they pre-populate name + business email + profile photo automatically (Automation First — see Section 4).

### T+8s · Trade selection (the only mandatory question)

**Screen:** header text:

> **"What trade are you?"**

Below: a search box that autocompletes as merchant types. Below the search box, quick-tap chips for the 12 most common trades (Electrician, Plumber, Carpenter, Roofer, Bricklayer, Kitchen Installer, Bathroom Renovator, Plasterer, Painter, Landscaper, Heating Engineer, Builder).

**Voice input available.** Merchant can tap microphone and say "electrician" — Web Speech API transcribes locally.

Merchant taps their trade → next screen.

### T+15s · Location auto-detect

**Screen:** brief moment of automation. Nex asks browser for location permission (softly, in Nex voice):

> "Quick one — can I use your location to find nearby suppliers, regs and demand signals? You can change this any time."

If yes: geolocation resolves to city/region.
If no: merchant taps their city from a shortlist or types.

No form. One tap.

### T+25s · The magic moment

**Screen:** a smooth transition. Nex says:

> "Give me 20 seconds — I'll pull together everything I already know about your business."

Loading indicator with real-time updates:

- ✓ Found your trade norms (Electrician Brain activated)
- ✓ Loaded Cardiff regulations (Part L · Part P · BS 7671)
- ✓ Found 5 local wholesalers
- ✓ Drafted your first tradesite
- ✓ Setup your CRM · SiteBook · Estimator · Workforce

This isn't decoration — every message is a real thing happening. Trade Brain V1 loads. Regulations query hits Global module. Marketplace populates. Business Builder emits manifests.

### T+45s · The reveal

**Screen:** the merchant sees THEIR draft tradesite in a split-view:

- **Left:** live preview of the tradesite with placeholder-clear areas ("Your logo goes here · your photos go here")
- **Right:** their new Nex home ("Welcome to Nex, Sarah") with the first three activation missions visible

The reveal is genuine. The tradesite has:

- Their name (from Google profile)
- Their trade (from step T+8s)
- Their region (from step T+15s)
- Draft "About us" (from Trade Brain business_tone module · placeholder for merchant to edit)
- Draft services (from Trade Brain sub-specialisations)
- Regional regulation compliance badges
- Empty portfolio ("Add your first project — 3 minutes")
- Empty testimonials ("Import from Google Business Profile · 30 seconds")

The tradesite is NOT live yet. Publish is deferred. The merchant sees their business exist without commitment.

### T+55s · Three next steps

**Screen:** Nex speaks in a chat bubble:

> "Sarah, here's what I've prepared for you. Take a look. When you're ready, three quick missions unlock most of the platform:"

Three mission cards below:

1. **Verify your business (2 min)** — Companies House lookup + optional Gas Safe/NICEIC/insurer registers
2. **Add your first project (3 min)** — one past job with photos
3. **Import your customers (2 min)** — email address, Nex pulls contacts

Each card shows: expected time · what unlocks · one clear CTA.

Above the cards: **"Or explore first"** — merchant can browse the platform without committing to missions.

### T+60s · The end of the first minute

The merchant has:

- Confirmed their trade
- Seen their business exist in Nex
- Understood Nex's value proposition (a construction business ready to run)
- Made zero commitments
- Been offered next steps, not forced into them

**No form has been submitted. Nothing has been published. Everything is reversible.**

That is the first 60 seconds.

---

## Section 3 · Conversational Onboarding

Every subsequent interaction with Business Builder is a conversation, not a form. Nex asks, merchant answers, Nex confirms and moves on.

### 3.1 Conversation shape

- Nex asks one question at a time
- Merchant answers in free text, voice, or picks from suggestions
- Nex confirms understanding before proceeding
- If Nex is uncertain, Nex asks a clarifying question (not the same question again)

Example conversation for the "Verify your business" mission:

> **Nex:** Are you registered as a limited company or sole trader?
> **Merchant:** Limited company
> **Nex:** Got it. What's your Companies House number, or do you know your business name and I'll look it up?
> **Merchant:** Waters Plumbing Cardiff Ltd
> **Nex:** [performs live Companies House lookup] Found you. Waters Plumbing Cardiff Ltd, incorporated 2019, registered address Cardiff CF10 1AB. Is that right?
> **Merchant:** Yes
> **Nex:** ✓ Verified. That's your green badge earned. Are you Gas Safe registered? I can verify against the public register.
> **Merchant:** No, I do bathrooms and general plumbing but not gas
> **Nex:** No problem. I'll note that. If you ever add gas work, we'll verify at that point.

Notice:
- Nex adapts to merchant answers
- Nex confirms before recording
- Nex says what happens next without asking permission
- No form filled in this whole exchange

### 3.2 Conversational rules

- **Nex speaks in short sentences.** Long paragraphs signal a bot.
- **Nex uses the merchant's name** occasionally, not every message.
- **Nex uses the merchant's trade vocabulary** (Trade Brain voice pack).
- **Nex never explains its architecture** ("I'm an AI that consults trade brains..."). It just does the work.
- **Nex acknowledges progress but doesn't over-praise.** ("Nice one" not "Amazing! Fantastic!")
- **Nex handles interruption gracefully.** Merchant can change subject, come back later, edit prior answers.

### 3.3 When to use forms (still)

Conversation isn't right for everything. Forms remain the correct pattern for:

- Legally sensitive fields (VAT number, bank details) — merchants expect a form
- Bulk entry (importing 50 customers)
- Precise numeric input (financial thresholds, margin percentages)

Rule: **use a form when accuracy matters more than warmth**. Otherwise, conversation.

### 3.4 Voice-first (merchant-side only)

Every conversational input supports Web Speech API voice capture (browser-native, no server-side voice). Merchant can dictate answers, review transcript, submit. Respects constitutional constraint (no voice on customer purchasing path).

---

## Section 4 · Automation First

Ninety percent of what V1 asked can be auto-populated. V2 asks for confirmation, not input.

### 4.1 Automation sources

| Source                          | What it populates                                          | Trigger                                    |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| Google/Microsoft SSO            | Name · profile photo · business email                       | Sign-in                                    |
| Browser geolocation             | City, region, timezone                                     | Sign-in (with consent)                     |
| Companies House (UK)            | Business name · registered address · director · incorporation date | Merchant enters name/number         |
| CRO (Ireland) · ASIC (Australia)| Country-specific business registers                        | Country-specific onboarding fork           |
| Gas Safe register (UK)          | Gas Safe number verification                                | Merchant self-declares                     |
| NICEIC · ELECSA · NAPIT (UK)    | Electrical certification                                    | Merchant self-declares                     |
| MCS (UK)                        | Renewable installer verification                            | Merchant self-declares                     |
| Google Maps API                 | Physical address · service area radius                      | Address entry                              |
| Google Business Profile         | Reviews · photos · opening hours                            | Merchant OAuths GBP                        |
| Existing website scrape         | About us · services · portfolio · contact                   | Merchant provides URL                      |
| Instagram / Facebook            | Portfolio photos · brand voice                              | Merchant OAuths                            |
| Email signature (parsed)        | Phone · title · company name                                | Merchant grants email access               |
| Bank feed (Open Banking)        | Transaction history · financial year · VAT scheme           | Merchant connects (optional)               |
| Xero / QuickBooks               | Customers · invoices · products                             | Merchant OAuths accounting                 |
| Trade Brain                     | Services list · pricing model · defect library · regs       | Trade selected at T+8s                     |
| Market Intelligence             | Regional benchmarks · demand signals · supplier density     | Region confirmed at T+15s                  |
| Construction Memory             | Merchant peer defaults for their tier                       | Trade + region                             |

### 4.2 Confirmation UX

Every auto-populated value is shown to the merchant with a clear provenance tag:

> **Registered address:** Cardiff CF10 1AB **[verified via Companies House · Wed 12 Sep]**
> **Business name:** Waters Plumbing Cardiff Ltd **[verified via Companies House]**
> **Service area radius:** 20 miles **[suggested by regional peer default]** — [Change]

The merchant confirms or edits. Never blank fields when data exists.

### 4.3 Data provenance

Every auto-populated field records:

- `source` (companies_house · google_business · gbp · manual · trade_brain_default)
- `source_reference` (Companies House number, GBP place ID, etc.)
- `verified_at` timestamp
- `verified_by_merchant_at` (when merchant confirmed)

This becomes the evidence chain for every claim on the merchant's tradesite. Homeowner clicks the merchant's verification badge → sees exactly what's verified against what source.

### 4.4 Automation refresh

Data ages. Nex re-verifies quarterly:

- Companies House still active → all good
- Certification (Gas Safe, NICEIC) about to expire → merchant nudged 30 days before
- Google Business Profile reviews new → offered to import
- Bank feed disconnected → prompt to reconnect

Every refresh is silent unless action is needed.

---

## Section 5 · Progressive Activation

Do not ask for everything on Day One. Design an activation roadmap that unlocks capabilities as the merchant is ready.

### 5.1 The Activation Timeline

**Day 1** (first hour of use):
- Trade selected
- Region confirmed
- Draft tradesite exists
- Business identity verified (Companies House)
- First mission chosen

**Day 1 Missions** (all optional, all <5 min):
- Add logo (or accept auto-generated wordmark)
- Add first portfolio project
- Import Google Business reviews
- Invite first customer or two

**Week 1** (after 1st visit):
- Complete tradesite launch (publish to public URL)
- Connect email (for customer inquiries + drafts)
- Optional: connect bank feed or accounting
- Hire first AI colleague (typically Estimator or Bookkeeper)

**Week 2**:
- Issue first quote through Estimator
- First customer inquiry (auto-drafted response)
- First SiteBook entry (once first project starts)

**Month 1**:
- 3-5 quotes issued
- 2-3 AI colleagues active
- Regional benchmarks visible (once K-anonymity threshold hit)
- First social post scheduled
- First scheduled report from Finance Mgr AI

**Month 3**:
- 15+ quotes · 5+ customers · steady rhythm
- Trade Brain fine-tuned to merchant patterns
- Memory-based peer benchmarking mature
- Merchant approves recommendations from CEO AI weekly

### 5.2 Unlock moments

Every unlock is a genuine value moment, not a marketing sales pitch.

| Trigger                          | Unlock                                          | How presented                                 |
| -------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| Tradesite published              | Public URL live                                 | Celebration screen + share prompts             |
| First customer added             | CRM enabled                                     | "Meet your CRM" onboarding                     |
| First quote issued               | Estimator memory begins                         | Nex explains how the next quote will be better |
| First project created            | SiteBook + Twin start                           | Onboarding cards guide first photo             |
| 5 quotes issued                  | Cross-quote insights unlocked                   | "You typically price kitchens 8% above region" |
| First payment received           | Finance Mgr AI relevant                         | "Bookkeeper AI can now start work"             |
| Reached K-anonymity threshold    | Regional benchmarks unlocked                    | "5 peers now contribute — see how you compare" |
| 30 days retention                | Trade Centre + Marketplace prompts              | Introduces monetisation features               |

### 5.3 The "not now" muscle

Every ask includes a **"not now"** or **"remind me later"** option. Merchant declines are respected. Nex doesn't nag. Instead, Nex quietly waits for the moment when the ask becomes newly relevant (e.g., merchant declines "add first project" → 3 weeks later merchant asks about portfolio → Nex offers to help add one).

### 5.4 No dark patterns

- No forced tour
- No "you must complete this to continue"
- No countdown timers pressuring completion
- No dark-pattern unsubscribe flows
- Nothing that feels manipulative

---

## Section 6 · Mission System

Missions are the atomic unit of activation. Every mission has:

- **Title** (5-8 words, action-oriented)
- **Reward** (what unlocks — visible improvement to tradesite, or AI capability, or business feature)
- **Duration** (expected time; if it feels longer, the mission is broken)
- **State** (Available / In Progress / Complete / Skipped)
- **Prerequisites** (other missions or events that must precede)

### 6.1 The mission library

Grouped by activation stage. Every mission has been tested for genuine value.

**Day 1 core (5 missions):**

1. ✔ **Add your business logo** (2 min) → tradesite looks like yours · unlocks branding personalisation
2. ✔ **Verify with Companies House** (1 min) → verified badge · unlocks tier upgrade eligibility
3. ✔ **Import Google Business reviews** (30s) → real reviews appear · unlocks testimonial surface
4. ✔ **Add your first past project** (3 min) → portfolio populated · unlocks case-study auto-drafting
5. ✔ **Invite your first customer** (2 min) → CRM live · unlocks customer analytics

**Week 1 (4 missions):**

6. ✔ **Publish your tradesite** (30s) → public URL live · unlocks lead capture
7. ✔ **Connect your email** (1 min) → inquiries route into CRM · unlocks Marketing agent
8. ✔ **Hire your first AI colleague** (5 min) → Estimator or Bookkeeper joins · unlocks their department
9. ✔ **Add trade certifications** (3 min) → verified badges displayed · unlocks premium tier eligibility

**Week 2-4 (5 missions):**

10. ✔ **Issue your first quote** (5 min) → Estimator learns your style · unlocks quote-history insights
11. ✔ **Create your first SiteBook entry** (2 min) → project timeline begins · unlocks Twin
12. ✔ **Connect your bank feed** (3 min · optional) → Finance Mgr live · unlocks financial forecasting
13. ✔ **Add a team member** (2 min · optional) → team RBAC live · unlocks multi-user
14. ✔ **Set your minimum margin floor** (1 min) → Estimator respects it · unlocks profit guardrails

**Month 1-3 (5 missions):**

15. ✔ **Complete 5 quotes** — automatic, tracked · unlocks pricing memory calibration
16. ✔ **Complete first project** — automatic · unlocks Twin handover experience
17. ✔ **Reach K-anonymity threshold** — automatic (5 regional peers contribute) · unlocks regional benchmarks
18. ✔ **Approve 30 morning briefings** — automatic · unlocks Weekly Digest option
19. ✔ **Enable Weekly Digest** — merchant choice · unlocks reduced approval fatigue

Every mission is optional. The critical path is only Missions 1-2 (identity + brand) and Mission 6 (publish tradesite). Everything else is progressive.

### 6.2 Mission UX

Every mission card:

- 40x40 icon (Lucide)
- Title (single line)
- Duration ("2 min" or "5 min")
- One clear CTA button
- Optional: "Why this matters" tooltip

Missions are shown in three groupings on the merchant home:
- **Ready for you** (unlocked, not started, 3 at a time)
- **In progress** (partially complete, 3 at a time)
- **Coming soon** (locked but visible, teaser for what's next)

### 6.3 Completion moments

When a mission completes:

- Subtle animation on the card (checkmark slide-in)
- Optional celebration message from Nex (matched to mission significance)
- Health Score updates visibly
- Next relevant mission unlocks (if any)
- Homepage refreshes with new available missions

Never obtrusive. Never blocking. Merchant continues what they were doing.

### 6.4 Skip and revisit

Every mission can be skipped. Skipped missions:

- Move to a "Later" tray
- Nex may re-offer them at a relevant moment (not before)
- Never disappear (merchant can complete them any time)

---

## Section 7 · AI Business Consultant

Nex behaves like an experienced construction business advisor throughout Business Builder V2 and beyond.

### 7.1 Consultant personality (per merchant memory rule: Nex voice)

- **Northern UK direct** — clear, brief, warm
- **Straight-talking** — doesn't over-explain, doesn't over-praise
- **Curious about the business** — asks good questions
- **Respects the merchant's expertise** — never mansplains construction
- **Practical over aspirational** — "what will help today" over "here's the dream"
- **No em dashes** (per platform rule)
- **No emojis** unless the merchant uses them first

### 7.2 Consultant behaviour

**Nex proactively:**

- Notices when something's missing ("I've prepared your profile but there's no logo — want to add one?")
- Prepares drafts before the merchant asks ("I've drafted your first customer email — want to see it?")
- Explains regional context ("Cardiff plumbers typically add 15% for tight-access properties")
- Surfaces opportunities ("Three planning applications for extensions near you this week")
- Celebrates real progress ("That's your fifth quote issued — you've saved about 6 hours of estimating time")

**Nex never:**

- Nags (Nex asks once, respects the answer)
- Fabricates numbers or credentials
- Pushes upgrades aggressively
- Uses marketing language ("game-changing", "revolutionary", etc.)
- Pretends to be human
- Sends notifications outside working hours (default; merchant can enable 24/7)

### 7.3 Consultant memory

Nex remembers what merchants say:

- If merchant says "I don't do gas work", Nex never suggests gas-work missions
- If merchant mentions their spouse works in finance, Nex adapts (they might want richer financial insights)
- If merchant expresses budget concerns, Nex prioritises cheaper missions
- If merchant works alone, Nex doesn't suggest team management

Memory is transparent. Merchant can view what Nex has learned (per Phase 26 memory transparency principles).

### 7.4 Consultant availability

- Chat is always accessible via a persistent widget
- Nex answers questions about the platform, the merchant's business, construction generally
- Nex knows what mission the merchant is on and can guide them through it
- If Nex doesn't know something, it says so ("I don't know that yet · want me to research it?")

---

## Section 8 · Business Health Score

The Business Health Score is the merchant's persistent activation metric. Visible on every screen. Drives Nex's recommendations.

### 8.1 Score composition

Score is 0-100, computed from 10 signals (each 0-10):

1. **Business profile completion** (verified identity, logo, contact, services, credentials)
2. **Portfolio presence** (past projects with photos)
3. **Customer records** (customers added or imported)
4. **Quote activity** (quotes issued in last 30 days)
5. **Financial connection** (bank / accounting / VAT scheme configured)
6. **Team presence** (owner solo counts as complete; multi-user teams score higher)
7. **SiteBook engagement** (active projects with entries)
8. **Trade Brain usage** (consultations, corrections, learnings)
9. **AI Workforce adoption** (hired agents, active approvals)
10. **Retention signal** (days active in last 30, streak length)

Each signal is deterministic. Score is the sum with weights per tier (higher tiers weight AI Workforce more).

### 8.2 Score bands

- **0-20 · Starting up** (blue) — brand new, celebrate every step
- **21-50 · Getting going** (green) — regular activation, keep going
- **51-75 · Established** (gold) — running smoothly
- **76-90 · Optimising** (purple) — power user
- **91-100 · Master** (rare) — expert integration

### 8.3 Score-driven recommendations

Nex uses the score to decide what to suggest next:

- **Low score in a specific signal** → mission suggested to address it
- **Balanced growth** → suggests the next progressive mission
- **Sudden drop** (churn signal) → gentle check-in from Nex

The merchant never sees "your score is low, upgrade." Nex only ever suggests actions, never guilt-trips.

### 8.4 Score visibility

- Small pill in header on every page: "Health 64 · Getting going"
- Click for detail: which signals contribute what
- Historical trend chart (last 30/90 days)
- Peer comparison (K-anonymised): "Your score is above average for your trade + region"

### 8.5 What the score is NOT

- Not gamification for its own sake
- Not tied to punitive downgrades
- Not visible to other merchants (except aggregate stats)
- Not a leaderboard

The score is a **navigational aid**, not a competition.

---

## Section 9 · Drop-off Analysis

Every point in the flow where a merchant could leave. Why. What V2 does differently.

### 9.1 V1 drop-off points identified

| V1 stage                           | Drop-off | Why they left                                          |
| ---------------------------------- | -------- | ------------------------------------------------------ |
| Signup form                        | 25%      | Too many fields to fill immediately                    |
| Trade selection (Step 1)           | 5%       | Fine — merchants know their trade                      |
| Region selection (Step 2)          | 8%       | Some couldn't find their exact town/city               |
| Business shape (Step 3)            | 15%      | "Not registered yet" merchants blocked                 |
| Services offered (Step 4)          | 20%      | Overwhelmed by long service list                       |
| Business goals (Step 5)            | 12%      | Felt like more forms with no reveal                    |
| Reveal + preview                   | 5%       | Some merchants felt "AI slop" first impression         |
| Draft-to-published gap             | 10%      | Merchant thought they'd finished, left before publish  |

**Total drop-off: ~60%** (accumulated across stages)

### 9.2 V2 addresses each point

| Point | V2 solution |
| ----- | ----------- |
| Signup form | Google/Microsoft SSO in one tap · email as fallback only |
| Trade selection | Same simplicity + voice input for accessibility |
| Region | Auto-detect with browser geolocation · smart fallback to city list |
| Business shape | Removed from onboarding entirely · asked later when relevant · "not registered yet" merchants proceed without blocker |
| Services offered | Trade Brain pre-fills · merchant reviews and edits · not entered from scratch |
| Business goals | Removed from onboarding · inferred from behaviour or asked contextually later |
| Reveal | Real content from Trade Brain + regional data · no lorem-ipsum · empty states honest |
| Draft-to-published | Explicit celebration when publish happens · unmistakable |

### 9.3 New V2 drop-off points to monitor

V2 introduces different risks:

| V2 point | Risk | Mitigation |
| -------- | ---- | ---------- |
| Location permission decline | Merchant declines geolocation → falls to manual city entry | Manual fallback is smooth; permission ask is friendly |
| Companies House lookup slow | API latency → merchant waits, might abandon | Background lookup with progress · merchant can continue other missions in parallel |
| First mission choice paralysis | 3 missions displayed, merchant unsure which to pick | Nex recommends one based on merchant profile |
| Empty tradesite embarrassment | Merchant thinks "this looks empty" | Nex explains "this fills up as you add content · here are 3 quick fills" |

### 9.4 Expected improvement

Simulated V2 drop-off target: **≤25%** (vs V1's 60%).

Distribution:
- Signup: 10% (down from 25% via SSO)
- First minute experience: 5% (down from 30% cumulative)
- Post-reveal: 10% (some merchants explore, don't return · re-engagement email)

Recovery mechanism: any merchant who abandons after Companies House verification is re-engaged via email + persistent resume link.

---

## Section 10 · Mobile-First Experience

Business Builder V2 is designed primarily for mobile. Desktop is derivative, not primary.

### 10.1 Why mobile-first

- Merchants often onboard on-site (van, coffee break, home evening)
- Companies House lookup + geolocation are stronger on mobile
- SSO on mobile is one-tap (biometric)
- Voice capture is more natural on mobile than desktop

### 10.2 Mobile design principles

- **Large touch targets** (48px minimum, 56px preferred for primary CTAs)
- **Thumb-reachable actions** (primary CTA in bottom half of screen)
- **One CTA per screen** (never make merchants scroll to find action)
- **Full-screen modals** on mobile (no cramped mobile-web pop-ups)
- **Reduced typing** (voice, autocomplete, pick lists)
- **Camera-first for uploads** (native camera integration for logo, photos)
- **Offline capability** for form drafts (localStorage sync on reconnect)

### 10.3 Mobile-specific flows

**Adding a logo (mission 1):**

- Tap "Add logo"
- Two options: **"Take a photo of my logo"** or **"Choose from gallery"**
- Camera opens directly (no intermediate screens)
- After capture: auto-crop suggestion, one-tap "Use this"
- Background upload, done

**Adding a portfolio project (mission 4):**

- Tap "Add project"
- Three fields: what was it, where, when (all optional except "what")
- **"Take photos now"** or **"Add photos later"**
- Camera opens, multi-shot mode
- Vision AI auto-tags photos (room, work stage)
- Draft case study generated

**Verifying Companies House:**

- Tap "Verify with Companies House"
- Business name field (autocompletes as merchant types)
- Companies House API returns results as merchant types
- One tap to confirm

Every mobile flow is ≤3 screens. Every screen ≤3 taps to complete.

### 10.4 Desktop derivative design

Desktop uses the same conversational + mission model but adapts to the wider viewport:

- Side-by-side tradesite preview + missions (per T+45s reveal)
- Multi-column mission grid
- Richer detail panels
- Same touch targets (accessibility)

Desktop is not the primary design target but is fully supported per platform rule ("Desktop + iPad are the source of truth" from merchant memory).

### 10.5 Progressive Web App (PWA)

Business Builder V2 is a PWA:

- Installable to home screen
- Offline capable for form drafts
- Push notifications for mission reminders + Nex outputs
- Camera integration
- Web Speech API for voice

Native mobile app (iOS/Android) deferred to V2+ per Phase 33 monetisation model.

---

## Section 11 · Success Metrics

Every metric measurable. Every target realistic and specific.

### 11.1 Core KPIs

| Metric | V1 baseline | V2 target | Success criteria |
| ------ | ----------- | --------- | ---------------- |
| **Activation Rate** (published tradesite) | 40% | 70% | ≥65% considered success |
| **Day-1 Completion** (identity verified + 1 mission) | 30% | 60% | ≥55% success |
| **Day-7 Retention** (return within 7 days) | 45% | 75% | ≥70% success |
| **Day-30 Retention** (active at 30 days) | 30% | 55% | ≥50% success |
| **Mission Completion** (avg missions/merchant) | N/A | 8 in first 30 days | ≥6 success |
| **Trade Brain Adoption** (consultation in first 30 days) | 25% | 60% | ≥50% success |
| **AI Workforce Adoption** (first hire in first 30 days) | 15% | 45% | ≥35% success |
| **Estimator Usage** (first quote in first 30 days) | 20% | 50% | ≥40% success |
| **Time to First Value** (see draft tradesite) | 15 min | 60 seconds | ≥95% complete in <90s |
| **Time to First Trust** (verified badge earned) | 25 min | 3 min | ≥90% complete in <5 min |
| **Customer Satisfaction** (NPS at 30 days) | N/A | 40 | ≥30 success |

### 11.2 Instrumentation

Every event tracked:

- `signup.started` · `signup.method_chosen` · `signup.completed`
- `mission.viewed` · `mission.started` · `mission.completed` · `mission.skipped`
- `nex.consultation` (chat message) · `nex.recommendation.followed` · `nex.recommendation.dismissed`
- `health_score.change` (delta)
- `activation.milestone` (tradesite published, first quote, etc.)
- `retention.return` (session count per merchant per week)
- `dropoff.point` (last event before abandonment)

All events flow into `hammerex_nex_analytics_events` per ES-02.

### 11.3 Weekly review

Product team reviews KPIs weekly. Each metric has an owner. Deviations from target trigger investigation, not panic.

### 11.4 Advisory panel qualitative feedback

Quantitative KPIs augmented by advisory panel qualitative signals:

- "Would you recommend Nex to a friend?" (NPS)
- "What was the best moment?" (peak signal)
- "What was the worst moment?" (friction signal)
- "What almost made you quit?" (drop-off risk)
- "What surprised you?" (delight signal)

Every advisory panel session captures these five open-ended questions.

---

## Section 12 · Implementation

Production-ready engineering spec. Ready for Sprint 3 delivery per Implementation Plan.

### 12.1 Database updates

New tables:

```
hammerex_nex_builder_sessions_v2 (
  id UUID PRIMARY KEY,
  merchant_slug TEXT,        -- null until identity verified
  user_id UUID REFERENCES auth.users(id),
  state JSONB NOT NULL,       -- session state (persisted every step)
  activation_score INTEGER,   -- 0-100
  current_missions UUID[],
  completed_missions UUID[],
  skipped_missions UUID[],
  resume_token TEXT UNIQUE,
  last_active_at TIMESTAMPTZ,
  device_context JSONB,       -- desktop | mobile | tablet
  entry_source TEXT,          -- google | microsoft | email | organic
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

hammerex_nex_missions (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  title TEXT,
  description TEXT,
  duration_minutes INTEGER,
  category TEXT,              -- day1_core | week1 | month1
  prerequisites TEXT[],       -- other mission slugs
  unlocks TEXT[],             -- features/tables/agents that become available
  is_optional BOOLEAN
);

hammerex_nex_merchant_missions (
  id UUID PRIMARY KEY,
  merchant_slug TEXT,
  mission_slug TEXT,
  state TEXT CHECK (state IN ('available', 'in_progress', 'complete', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  data JSONB
);

hammerex_nex_activation_history (
  id BIGSERIAL,
  merchant_slug TEXT,
  event_kind TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ
);
```

Extend existing:

```
ALTER TABLE hammerex_nex_verified_claims ADD COLUMN
  source_reference TEXT,       -- Companies House number, GBP place ID
  verified_by_merchant_at TIMESTAMPTZ,
  refresh_scheduled_at TIMESTAMPTZ;
```

### 12.2 API changes

New endpoints:

```
POST   /api/nex/builder/v2/session/start
       Request: { entry_source, device_context }
       Response: { session_id, resume_token, magic_first_screen_state }

POST   /api/nex/builder/v2/session/<id>/answer
       Request: { question_key, answer, voice_input?: true }
       Response: { next_question | mission_unlocked | completion }

POST   /api/nex/builder/v2/session/<id>/checkpoint
       Autosave on every meaningful state change

GET    /api/nex/builder/v2/session/<resume_token>
       Resume from anywhere

POST   /api/nex/builder/v2/verify/companies-house
       Request: { search: string }
       Response: { candidates: [{ name, number, address, incorporated_at }] }

POST   /api/nex/builder/v2/verify/gas-safe
POST   /api/nex/builder/v2/verify/niceic
POST   /api/nex/builder/v2/verify/mcs
       Each: register lookup with fallback to manual pending

GET    /api/nex/builder/v2/missions/available
GET    /api/nex/builder/v2/missions/<slug>
POST   /api/nex/builder/v2/missions/<slug>/start
POST   /api/nex/builder/v2/missions/<slug>/complete
POST   /api/nex/builder/v2/missions/<slug>/skip

GET    /api/nex/builder/v2/health-score
       Response: { score, band, signals: {...}, recommendation: string }

POST   /api/nex/builder/v2/import/google-business
POST   /api/nex/builder/v2/import/xero
POST   /api/nex/builder/v2/import/quickbooks
       OAuth flows for automation-first data population
```

### 12.3 Frontend architecture

New React components under `src/apps/builder-v2/`:

```
builder-v2/
├── LandingScreen.tsx
├── SigninChoice.tsx
├── TradeSelection.tsx
├── LocationDetection.tsx
├── MagicMoment.tsx              // T+25s to T+45s
├── RevealScreen.tsx              // Split view
├── MissionCard.tsx
├── MissionGrid.tsx
├── HealthScoreWidget.tsx
├── NexChat.tsx                   // Persistent consultant widget
├── conversation/
│   ├── ConversationalPrompt.tsx
│   ├── VoiceInputButton.tsx
│   └── ConfirmationBanner.tsx
├── verification/
│   ├── CompaniesHouseLookup.tsx
│   └── CertificationVerifier.tsx
└── missions/
    ├── AddLogoMission.tsx
    ├── AddPortfolioProjectMission.tsx
    ├── ImportGoogleReviewsMission.tsx
    ├── InviteFirstCustomerMission.tsx
    ├── PublishTradesiteMission.tsx
    ├── ConnectEmailMission.tsx
    ├── HireFirstAIColleagueMission.tsx
    └── ...
```

### 12.4 State management

Zustand store per session with these slices:

```typescript
type BuilderState = {
  session_id: string;
  trade: string | null;
  region: RegionInfo | null;
  identity: {
    verified: boolean;
    companies_house_number?: string;
    business_name?: string;
    registered_address?: Address;
  };
  missions: {
    available: Mission[];
    in_progress: Mission[];
    completed: Mission[];
    skipped: Mission[];
  };
  health_score: number;
  activation_score_breakdown: SignalBreakdown;
  nex_consultant_state: 'idle' | 'thinking' | 'responding';
  recent_recommendations: Recommendation[];
};
```

Every state change auto-persists to `hammerex_nex_builder_sessions_v2.state` via the checkpoint API.

### 12.5 Backend architecture

Composition per ES-01 modular monolith:

- `builder/` module owns Business Builder V2 logic
- Delegates to `brains/` for Trade Brain content
- Delegates to `memory/` for regional defaults
- Delegates to `verification/` (new sub-module) for register lookups
- Emits events per ES-02 event catalog

New event kinds:

- `builder.session_started`
- `builder.trade_selected`
- `builder.region_confirmed`
- `builder.identity_verified`
- `builder.mission_completed`
- `builder.tradesite_published`

### 12.6 Notifications

- Push notification for stale sessions (24h · 3d · 7d)
- Email digest of missions available (weekly, opt-in)
- In-app celebration animations for achievements
- Weekly health score summary (opt-in)

### 12.7 AI prompts

Every prompt versioned per ES-01 §7.3. Key prompts:

- `builder-v2/reveal-intro.v1` — Nex explains what happened during the magic moment
- `builder-v2/mission-recommendation.v1` — Nex recommends next mission based on merchant context
- `builder-v2/consultation.v1` — Nex answers merchant questions during onboarding
- `builder-v2/first-morning-consultation.v1` — Day-1 morning briefing for freshly onboarded merchant

Each prompt uses Trade Brain voice pack for merchant's trade.

### 12.8 Testing plan

- **Vitest unit tests** for every mission logic + state transition
- **Integration tests** with real Postgres for full session flow
- **Playwright E2E** for first-60-seconds experience (mobile + desktop)
- **Advisory panel testing** with 15+ pilot merchants across trades
- **Load test** at 1000 concurrent sessions
- **Chaos test** on external register API failures (Companies House down)

### 12.9 Accessibility

- WCAG 2.2 AA compliance
- Voice input for every text field
- Screen reader compatible (semantic HTML, ARIA where needed)
- Keyboard navigation for every mission
- Text alternatives for celebration animations
- Colour contrast 4.5:1 minimum
- 12px text floor per platform rule

### 12.10 Performance

- **Landing screen load:** <2s p95
- **First screen paint:** <500ms p95
- **Magic moment computation:** <20s p95 (real work happening)
- **Reveal screen render:** <1s p95 after magic moment
- **Mission completion:** <3s p95
- **Chat response first token:** <400ms p95

### 12.11 Migration strategy

- V1 merchants remain on V1 (no forced migration)
- New merchants land on V2 by default
- Feature flag `builder.v2_default` controls new-merchant routing
- V1 code path remains for 90 days post-V2 GA, then removed
- Analytics compare V1 vs V2 KPIs during dual-path phase

### 12.12 Rollback strategy

- Feature flag `builder.v2_default` reverts new merchants to V1
- Sessions in-flight preserved (session data compatible)
- No data loss on rollback
- Rollback tested pre-launch

### 12.13 Definition of Done

- All Section 12.1-12.12 delivered
- Advisory panel signs off (≥8/10 satisfaction from 15+ merchants)
- Load test passes at 1000 concurrent
- Chaos tests pass
- All KPIs measured and dashboarded
- V1 → V2 migration path documented
- Rollback path tested in staging

### 12.14 Acceptance criteria

- Time-to-first-value <90 seconds for 95% of merchants
- Time-to-first-mission-complete <10 minutes for 80% of merchants
- Day-7 retention >70% for V2 cohort
- Advisory panel NPS ≥40

### 12.15 Engineering estimates

- **Session persistence + resume:** 1.5 weeks
- **Automation adapters (CH · Gas Safe · NICEIC · MCS · GBP · Xero):** 3 weeks
- **First 60 seconds flow (screens + real-time updates):** 2 weeks
- **Mission system (framework + 19 missions):** 4 weeks (parallelisable)
- **Health Score engine:** 1 week
- **Nex Consultant chat integration:** 1 week
- **Mobile PWA polish:** 1.5 weeks
- **Testing + advisory panel:** 2 weeks

**Total:** ~16 engineer-weeks with parallelisation → 4 engineers × 4 weeks = Sprint 3 delivery.

---

## Final CTO Review

Challenge every screen. Every click. Every question. Deliver a spec that's ready.

### CTO cut list (removed from V2 to keep focus)

**Cut · Business goals question (was V1 Step 5):** never asked. Inferred from behaviour.

**Cut · Business shape question (was V1 Step 3):** never asked at onboarding. Determined from Companies House when merchant verifies; sole traders proceed as "sole trader" default.

**Cut · Services offered manual entry (was V1 Step 4):** Trade Brain pre-fills; merchant edits.

**Cut · Multi-step wizard flow:** replaced with single conversation + immediate reveal.

**Cut · Long-form business profile drafting during onboarding:** happens invisibly during the magic moment.

**Cut · Manual pricing configuration:** Estimator uses regional peer defaults; merchant tweaks later.

**Cut · Team invitation during first hour:** deferred to Week 1 mission.

### CTO simplifications applied

- Reduced 5 mandatory steps to 1 (trade selection)
- Removed all pop-up modals during first 60 seconds
- Removed all tutorial overlays
- Missions replace step-based wizard
- Progressive activation replaces day-1-completion pressure

### CTO validated against Nine Design Principles

Every screen tested against §1 principles:

- Anxiety: none of the 60-second flow induces anxiety ✓
- Excitement: magic moment reveal creates genuine "wow" ✓
- Progress: health score visible throughout ✓
- Value: draft tradesite exists before anything is asked ✓
- Teaching: contextual, never modal ✓
- Decision fatigue: 3 options max at any choice ✓
- Celebration: mission completion + tradesite publish ✓
- Trust: every fact traces to source ✓
- Overwhelming: one thing at a time ✓

### CTO approval

**Approved for Sprint 3 delivery** subject to:

1. Advisory panel signs off on the reveal + first-60-seconds experience before broad rollout
2. Legal review of Companies House + register API terms (data usage rights)
3. Real Trade Brains available (Electrician + Plumber + Carpenter authored to V1 depth) before V2 launches — dependency on Sprint 2 completion of Trade Brains work

### The commitment

Business Builder V2 will not launch until:

- ≥15 advisory panel merchants complete the onboarding
- ≥8/10 report the experience as "excellent"
- ≥90% complete tradesite publish within their session
- ≥70% report intending to continue using Nex

The bar is high. The design supports it.

---

**End of Nex Business Builder V2 Specification.**

*Ready for immediate Sprint 3 implementation.*
