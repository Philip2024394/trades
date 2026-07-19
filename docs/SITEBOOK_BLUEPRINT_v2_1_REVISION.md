# SiteBook Blueprint v2.1 — Homeowner-First Revision

**Version:** 2.1 (revises v2.0 · 2026-07-19)
**Owner:** Philip
**Status:** Approved for scope reset. Supersedes v2's feature list. Retains v2's backend groundwork where the underlying data model doesn't change.

**Companion document:** `docs/SITEBOOK_BLUEPRINT_v2.md` (v2.0) is the technical reference. This revision is the design directive. Where they conflict, this revision wins.

---

## What changed philosophically

The v2 blueprint was technically correct and strategically wrong. It described a Procore competitor. Real SiteBook users use Facebook, WhatsApp, Amazon and their online banking. If they need training, we've failed.

The new litmus test for every feature:

**Would an ordinary homeowner immediately understand why this exists, without help, on first use?**

If the honest answer is "probably not", the feature is:
1. **Simplified** to one card, one button, one sentence, OR
2. **Automated** — happens in the background, no user action, OR
3. **Moved to Advanced Settings** (where curious users can find it) OR
4. **Removed** entirely.

Products that pass the litmus test: Facebook, Google Photos, Uber, Amazon, Monzo, Netflix. Predictable · calm · one purpose per screen.

Products that fail it: Procore, Buildertrend, Monday.com, ClickUp, Notion (for non-power-users), Jira. These are for professionals who chose complexity.

**SiteBook is for the other 95% of homeowners.**

---

## The 7 rules SiteBook now lives by

1. **One question per screen.** If a page tries to answer more than one, redesign it.
2. **Automate before asking.** If the platform can figure it out (kind, project, filing, category), do it. Don't ask.
3. **Menus stay small.** Every menu item that isn't used weekly = candidate for merge, hide, or remove.
4. **No jargon, ever.** No "risk score", no "compliance", no "variation order", no "kanban", no "gantt". Plain English or nothing.
5. **Never punish free tier.** Free must be genuinely useful. Pro simply SAVES TIME — it doesn't add missing basics.
6. **Sponsored content stays labelled + relevant + never above safety.** Trust > revenue, always.
7. **Homeowner feels: in control, calm, unconfused.** Every design decision passes this test.

---

## Feature verdicts — brutal, honest review

Every v2 feature (34) + every currently-live SiteBook feature (10) reclassified. Reasoning follows the 7 rules.

### Legend
- **KEEP** — ship as spec'd, meets the bar
- **SIMPLIFY** — right idea, wrong depth — reduce scope
- **AUTOMATE** — right idea, wrong surface — hide it, do it silently
- **ADVANCED** — legitimate niche need — put in settings, not main nav
- **REMOVE** — doesn't belong in the homeowner-first SiteBook

### 4.1 AI Assistant → **SIMPLIFY**
Homeowners understand "Ask a question about my house". They don't understand "AI assistant". Rename to **"Ask SiteBook"**, single floating button (like Google's mic on iOS). Answers in plain English, always with an action button ("Send Watson a nudge?" / "Add this to my to-do?"). No context menus, no thread management, no "tools & functions" panel. **One button, one input, one reply.**

### 4.2 Auto-brief generator → **AUTOMATE**
No separate "AI-draft this" button. When homeowner starts a new post, the composer detects the photos + short line and QUIETLY offers a rewrite chip: *"Want us to write this properly?"* One tap accepts. That's it.

### 4.3 Photo AI recognition → **AUTOMATE**
Silent. Zero UI. Photos just get organised. If someone taps a photo they see plain tags ("before · en-suite · Watson uploaded") — not a "manage AI tags" panel.

### 4.4 Completion prediction → **REMOVE**
"Estimated completion 14 Aug · confidence 78%" is a chart nerd's dream and a homeowner's confusion. If we ever need to say something, replace with plain English on the AI reply: *"Looks like about 3 weeks left based on how the plumbing is going."* No dashboard.

### 4.5 Risk score → **REMOVE**
Corporate jargon. Replaced by the AI proactively nudging: *"Watson hasn't replied in 4 days. Want me to send him a friendly nudge?"* — that's what a risk score IS, in the homeowner's language.

### 4.6 Smart search → **SIMPLIFY**
Just make the search field WORK. Don't call it "smart", don't advertise the tech. Search returns posts, photos, docs, warranties in one list. Zero settings.

### 4.7 Voice notes → **KEEP**
Homeowners get this immediately. Mic button on the composer. Hold, talk, release. Post appears written up. This is a Facebook-friendly interaction.

### 4.8 Calendar / Gantt → **SIMPLIFY**
Kill the Gantt entirely. Homeowners have zero use for Gantt. Keep a month view — same UX as Google Calendar / iOS Calendar. Shows: trade bookings, delivery dates, warranty expiries, maintenance reminders. Sync to Google/iCal via one toggle (Pro tier). That's it.

### 4.9 Task list per project → **REMOVE for MVP · AUTOMATE later**
Homeowners don't want kanban boards. Replace with a single prompt at the top of each project: **"What's next?"** — AI-drafted, actionable, one line. If the user genuinely needs a to-do list, they'll type it into a post. Formal tasks come back only if usage data proves demand.

### 4.10 Budget tracker → **SIMPLIFY**
NOT line-item accounting. Just: **"You've spent £4,300 of £8,000. That's 54%."** with a simple bar. Tap → shows each trade + how much. That's the whole budget UI. Adding line items is a Pro power feature, not the default.

### 4.11 Cashflow forecast → **REMOVE**
"12-week rolling cash-out projection" is chief-finance-officer territory. No homeowner ever asked for this. Kill it.

### 4.12 Snagging manager → **SIMPLIFY + RENAME**
Homeowners don't say "snagging". They say **"Things to fix"**. One button on each project: "Add something to fix" → photo + one line. Trade sees it in their invite thread. Done when photo confirms fix. No workflow, no priorities, no room taxonomy.

### 4.13 Variation order manager → **REMOVE**
"Variation order" is builder-speak. When plans change, it's just a NEW POST. If money changes, it goes into Budget. If timing changes, calendar updates. No third concept needed.

### 4.14 Digital signatures → **AUTOMATE, minimal**
Only where legally needed (accepting a quote, marking a job complete). Not a "signatures module". Just a "Accept quote" button that captures a signature + timestamp behind the scenes.

### 4.15 Document intake email → **AUTOMATE + KEEP**
This is a wow feature IF invisible. Every homeowner gets a magic email like `sarah-oldrectory@docs.thenetworkers.app`. Anything sent there just appears in the right project. Zero user setup. Zero user management. That's Amazon-tier UX.

### 4.16 Warranty vault → **SIMPLIFY + RENAME**
"Vault" is corporate. Just **"My warranties"** — a plain list. On each: what · who · expires · one-tap rebook when expiring. Auto-log on job complete via AI. Done.

### 4.17 Compliance centre → **AUTOMATE**
No "compliance centre" tab. Instead: the AI proactively pings when a project probably needs building regs / party wall / planning: *"Extensions like this usually need a building notice — want me to explain?"* One button opens a plain guide. No frameworks, no rules engines, no per-project checklists visible.

### 4.18 Digital site folder → **REMOVE**
Trades already see documents pinned to their invite. No separate concept needed.

### 4.19 Property Passport export → **KEEP**
The £9.99 export is exactly the right kind of feature — one button, £9.99, get a beautiful PDF + ZIP. Never expose the machinery underneath.

### 4.20 Live status per trade → **SIMPLIFY**
Just status chips already on the panel (Invited / Booked / Working / Complete). No dashboard, no analytics view.

### 4.21 Material delivery tracking → **SIMPLIFY**
Just adds a "Delivery due" row on the project when someone sets one. Kill the courier-API polling, kill the module. Plain text row, plain reminder.

### 4.22 Trade availability calendar → **REMOVE**
Trade problem, not homeowner problem. Trades set their own availability; homeowner asks + trade replies via WhatsApp. Zero UI needed on homeowner side.

### 4.23 Equipment / tool register → **REMOVE**
Trade problem. LOLER cert dates are for the trade, not the homeowner.

### 4.24 Supplier connection → **SIMPLIFY**
"Order for this project" button on Trade Center product page — link back to SiteBook project so delivery + budget records automatically. Zero new UI on SiteBook side.

### 4.25 Site access QR → **ADVANCED**
Cool for a £300k extension, overkill for a lock replacement. Move to Advanced Settings. Turn on per-project, print poster. Off by default.

### 4.26 Visitor log → **REMOVE**
Nobody actually uses these. Insurance argument is real but rare — resurrect later if data shows demand.

### 4.27 Neighbour notifications → **AUTOMATE**
Not a "neighbour module". When the AI detects a project probably requires party-wall notice (e.g. extensions, structural), it proactively suggests: *"You may need to notify next door — want me to prepare a friendly note?"* One tap → drafts + shows delivery options (WhatsApp / email / Royal Mail postcard £1.50). Off the AI, no menu.

### 4.28 Weather alerts → **AUTOMATE**
Not a module. AI drops a plain-English note in the feed: *"Storm forecast Wednesday — Watson's exterior work might slip."* One button: *"Ask Watson to reschedule."* No weather tab.

### 4.29 Emergency contacts → **KEEP**
One page, big buttons: 999, gas emergency, water, insurance, project lead. Static. Zero cleverness.

### 4.30 Maintenance reminders → **SIMPLIFY**
Just a card at the top of the home screen: *"Your boiler is due a service. Book Watson again?"* One button. Auto-generated from asset install dates. No settings screen, no cadence config, no "maintenance module".

### 4.31 Asset register → **SIMPLIFY + RENAME**
"Things in my house" — a plain scrolling list with a photo + name + install date + warranty status. Add via photo (AI reads brand/model where possible). No brand/model/serial/room taxonomy visible.

### 4.32 Aftercare subscription → **KEEP but SIMPLIFY messaging**
Rename Aftercare → **"Keep it going"** (or similar plain language). £2.99/mo. Sold as: *"We'll remind you what needs doing and book you the right trade — no thinking required."*

### 4.33 Client approval workflow → **REMOVE**
Real answer: share the SiteBook with your spouse via the same "Add family" toggle. If both need to approve, they text each other — not our problem. No workflow engine.

### 4.34 Multi-user access → **SIMPLIFY**
Just **"Share with family"** — one email invite, they see everything. No permission grid, no role picker, no capability matrix. If Pro user wants read-only for accountant, that's an Advanced setting later.

---

### Currently-live features (already in production)

| Feature | Verdict | Note |
|---|---|---|
| LiveProjectsFeed | **KEEP** | Zero friction, social proof, already automated |
| SiteBookInboxPanel | **KEEP** | Canonical simple layout, one purpose |
| PostComposer + PostFeedCard | **KEEP** | Facebook-like, immediate recognition |
| RevealUsageCard | **SIMPLIFY** | Ship shows: **"3 WhatsApp invites left this month"** — drop the monthly bar chart + pack math |
| HomeBackPill | **KEEP** | Small, clear, one purpose |
| UserMenuDropdown | **KEEP** | Facebook-style dropdown, familiar |
| HowItWorksGuide | **KEEP but AUTOMATE surfacing** | Instead of a "How it works" button in nav, surface it as a first-visit welcome tour, then quietly retire from main nav |
| CanteenInviteOverlay | **SIMPLIFY** | Drop the "breathing" glow. Just a solid pill. Motion = attention noise once seen |
| Threads page (`/sitebook/threads`) | **REMOVE separate page** | Redundant with the inbox panel. Anything the threads page did, the panel + filter chip does inline |
| Homeowner slug URL | **KEEP** | Personal + brandable |
| Post visibility (selected / all-trades) | **SIMPLIFY** | Rename to **"Just these trades"** vs **"All trades on this project"** — plainer language |

---

## What the homeowner actually sees (canonical surface)

### Top nav (5 items max, ever)

```
Home  ·  Projects  ·  Trades  ·  Photos  ·  More
```

That's it. Everything else lives under one of these or the avatar dropdown.

### Bottom nav on mobile (identical 5 slots)

Same 5. Plus a floating **+** in the centre for "New post / photo / voice".

### The 5 screens = 5 answers

| Screen | Answers |
|---|---|
| **Home** | "What's happening on my house right now?" |
| **Projects** | "How is each of my projects going?" |
| **Trades** | "Who am I working with?" |
| **Photos** | "Show me every photo of my house, sorted by project" |
| **More** | "Warranties · Things in my house · Aftercare · Settings" (one link each) |

Every page loads with ONE big answer at the top + supporting detail below. No dashboards. No tab bars per page. No filter panels open by default.

### Ask SiteBook

Floating yellow button, bottom-right, on every page. Homeowner taps → asks anything in plain English → answer + one action button. That's the AI.

---

## Automation catalog — the 20 things SiteBook does silently

Everything below happens without the user pressing a button:

1. **Post kind detected** from the wording — no "pick a kind" dropdown
2. **Trade auto-tagged** — if the post mentions "Watson", he's auto-cc'd
3. **Photo stage detected** (before / in-progress / after) — no picker
4. **Photo issues auto-flagged** (damp, cracks, unsafe scaffolding) → adds to "Things to fix"
5. **Warranty auto-logged** when a "job complete" post lands
6. **Budget line auto-added** when a quote is accepted or invoice paid
7. **Delivery reminder auto-scheduled** when someone mentions a delivery date
8. **Weather-affected task auto-flagged** by AI reading the calendar
9. **Party-wall / building-regs prompt** auto-triggered when project scope indicates it
10. **Maintenance reminders auto-generated** from installed asset dates
11. **Emails to `<slug>@docs.thenetworkers.app` auto-filed** into the right project
12. **Ghosted invitation auto-nudge** at 24-hour SLA
13. **Trade suggested** for a new project based on post content
14. **Project brief auto-drafted** from photos + one-line prompt
15. **Voice note transcribed + structured** into a post
16. **AI Assistant proactive nudges** on stale threads / pending decisions
17. **Push notifications digested** — no spam, one 18:00 summary + real-time for genuinely urgent
18. **Auto-invitation to leave a review** on job complete
19. **Property Passport auto-updated** every night (ready to export at any moment)
20. **Ecosystem sync** — invitation to trade updates their TradeBook, invoice creates cashflow entry, warranty populates Passport, all invisibly

If we later realise the user wants to CONTROL any of these, we add ONE toggle in More → Settings → What SiteBook does automatically. Not a "control panel". A short list of toggles with plain descriptions.

---

## Revised tier ladder — plain-English names, no "Concierge"

| Tier | Price | Plain-English pitch |
|---|---|---|
| **Free** | £0 | "Full SiteBook for your home. Try it as long as you like." |
| **Pro** | £4.99/mo | "Do more. Faster. More WhatsApp invites, more AI, no ads." |
| **Family** | £9.99/mo | "Everything in Pro. Share with your family — they see the same view." |
| **Landlord** | £29/mo | "One SiteBook per property, one dashboard for all your homes." |

### What each tier UNLOCKS (not "removes limits from")

**Free** — the full loop:
- Unlimited projects, posts, replies
- 3 WhatsApp invites / month
- 20 "Ask SiteBook" questions / day
- Photo storage (2GB)
- Budget totals (one number)
- Maintenance reminders
- Warranty tracking
- Property Passport export at £9.99 when they want it

**Pro (£4.99/mo)** — for the homeowner mid-project:
- 30 WhatsApp invites / month
- 200 questions/day for the AI
- Unlimited photo storage
- Line-item budget (the deeper view)
- Google/iCal calendar sync
- Push notifications for weather + risk
- Priority reply (24h)

**Family (£9.99/mo)** — Pro plus:
- 3 additional accounts (spouse, kids, parent)
- Shared push notifications
- Family-visible calendar

**Landlord (£29/mo)** — Family plus:
- Up to 5 properties (one SiteBook each)
- Cross-property dashboard: what needs attention across the portfolio
- Custom-branded Property Passport exports
- API access (Xero / QuickBooks) — for those who want it

### Anti-tier rules

- Free stays USEFUL forever. Never move a basic feature into Pro to force upgrades.
- No tier gets "priority support" as the main pitch — that's a garbage upgrade.
- No feature gets locked to Family/Landlord that isn't fundamentally about MULTIPLE PEOPLE or MULTIPLE PROPERTIES.

---

## Revised phased plan — build only what a Facebook user would understand

### Phase 1 (weeks 1-4) — "Make free delightful"

Ship features every homeowner GETS on first use:

1. **Simplified budget card** — "Spent £4,300 of £8,000" — one bar on each project
2. **Maintenance reminder card** — "Boiler service due — rebook Watson?" — one button, one card
3. **Ask SiteBook** — floating yellow button, opens simple chat, replies + one action button
4. **Warranty auto-log** — silent on job-complete post; simple list at More → My warranties
5. **"Things to fix"** — rename snagging, add issue = photo + one line
6. **Voice note composer** — hold mic, talk, release
7. **Emergency contacts page** — 6 buttons
8. **First-visit welcome tour** — 3 taps to nickname → post → invite

**Launches:** genuinely delightful free tier.
**Effort:** ~4 dev-weeks.

### Phase 2 (weeks 5-9) — "Turn Pro on"

Ship features that busy-project homeowners will pay £4.99/mo for:

1. **Line-item budget view** (Pro power surface)
2. **Calendar month view** with iCal sync
3. **Document intake email** — `<slug>@docs.thenetworkers.app` — the wow feature
4. **Photo AI recognition** (silent, invisible)
5. **Auto-brief chip** in composer (silent offer to rewrite)
6. **AI proactive nudges** ("Watson hasn't replied in 4 days")
7. **Property Passport export** at £9.99 (self-service, one button)
8. **Weather prompts in feed** (no dashboard)

**Launches:** Pro tier live.
**Effort:** ~5 dev-weeks.

### Phase 3 (weeks 10-14) — "Share + Scale"

Family + Landlord features:

1. **Share with family** — one email invite, everyone sees the same view
2. **Family tier subscription**
3. **Multi-property picker** for landlords
4. **Landlord dashboard** — 5-property "what needs attention" list
5. **Custom-branded Property Passport** (Landlord)
6. **Xero/QuickBooks CSV export** (Landlord)
7. **Trade Circle Boosted placements** live (trade-side monetisation without touching homeowner surface)

**Launches:** Family + Landlord tiers, Trade Circle monetisation live.
**Effort:** ~5 dev-weeks.

### Deliberately deferred (revisit only if data demands)

- Kanban tasks
- Gantt timelines
- Risk scores
- Compliance frameworks / centres
- Variation orders
- Site QR / visitor log
- Trade availability calendars
- Equipment registers
- Digital site folders
- Approval workflows (permissions grid)
- Cashflow forecasts

If real users repeatedly ask for any of these AFTER using the simpler platform, we build a simpler version then. Not before.

---

## Anti-features — what we consciously will NEVER build

Explicit list so we don't drift back:

- **No kanban boards.** Ever.
- **No Gantt charts.** Ever.
- **No "risk score" visible to homeowners.** AI just nudges.
- **No "compliance centre" tab.** AI just prompts when it matters.
- **No "variation order" concept.** Changes are just posts.
- **No permission matrix.** Family share is on/off.
- **No filter panels open by default.** One list, one search.
- **No dashboards with 8+ widgets.** Every page has ONE big answer.
- **No "advanced settings" in the main nav.** They live under Settings.
- **No forced onboarding wizards.** A gentle 3-step welcome, skippable.
- **No trade-industry jargon anywhere in the UI.**
- **No "Concierge" / "Enterprise" branding.** Plain-English tier names only.
- **No AI branding gymnastics** — no "Powered by GPT" / "Machine learning insights" copy. Just "Ask SiteBook".
- **No progress bars for AI.** Instant reply or nothing.
- **No pop-up upgrade modals during active project work.** Upgrade prompts only in Settings + gentle in-line ("Upgrade for more" pills).

---

## Trade Circle — homeowner-side rules

Sponsored trades remain a real revenue source, but the ETHICAL rules from v2 are hardened here:

1. **Sponsored placements labelled "Sponsored" always.** Small, honest, but visible.
2. **Never above safety, compliance, or emergency content.**
3. **Never triggered by AI risk warnings.** ("Watson's late" doesn't monetise fear.)
4. **Never interrupts the feed.** Only in dedicated Trade Circle surfaces + at end-of-feed carousel.
5. **Free-tier users can opt out of sponsored placements in Settings.** (Pro+ opt-out is automatic — cleaner experience is part of what they paid for.)
6. **Recommendations feel useful, not salesy.** Copy tone: *"3 local carpenters like Sarah nearby"* — not "Sponsored partner offer!"

---

## Admin revenue — hardened list, ethical guardrails

Kept from v2 §10 but with the following removed / hardened:

**REMOVE from revenue map:**
- Insurance referrals (we're not authorised, credibility risk)
- Finance / loan referrals (FCA compliance risk, deferred)
- Snagging inspection service (feels like upsell during stress)

**HARDEN (add guardrails):**
- Boosted placements: cap at 20% of visible directory results (never dominates)
- Sponsored invites: max 1 per invitation modal (no spam)
- Aftercare claim assistance (£29): only offered when a real claim is due, not proactively
- Legal template library: shipped only when we have a solicitor partner attesting to templates

**KEEP as spec'd:**
- All 4 subscription tiers
- WhatsApp reveal packs
- Property Passport £9.99 exports
- Featured products on canteens
- Marketplace commissions (opt-in for merchants)
- Verification badges
- White-label for letting agents (Landlord tier upgrade path)
- Estate-agent Passport bundles (partnership channel)

**Revised Y2 target:** ~£1.0M (down from £1.28M in v2) — the honest number after removing the reputationally-risky streams.

---

## What Philip should approve / delete

**One-line decisions I need from you:**

1. **Kill or keep Concierge tier name?** — my recommendation: kill, replace with Family (£9.99). ✅ / ❌
2. **Kill or keep Kanban tasks?** — my recommendation: kill for MVP. ✅ / ❌
3. **Kill or keep Compliance Centre?** — my recommendation: kill; AI prompts instead. ✅ / ❌
4. **Kill or keep Risk Score?** — my recommendation: kill; AI nudges instead. ✅ / ❌
5. **Kill or keep Variation Order?** — my recommendation: kill; posts + budget handle it. ✅ / ❌
6. **Kill or keep Cashflow Forecast?** — my recommendation: kill for MVP. ✅ / ❌
7. **Kill or keep Insurance/Finance referrals?** — my recommendation: kill (compliance risk). ✅ / ❌
8. **Rename Aftercare?** — my recommendation: yes, to "Keep it going" or similar plain English. ✅ / ❌
9. **Move HowItWorks button out of main nav → welcome tour only?** — my recommendation: yes. ✅ / ❌
10. **Drop the "breathing glow" motion on canteen invite pill?** — my recommendation: yes, motion noise once seen. ✅ / ❌

**Reply "yes to all" or list overrides. Once confirmed, Phase 1 kicks off with a scoped 8-feature spec.**

---

## Honest self-criticism of my v2 blueprint

Since you asked for it:

**What I got wrong in v2:**

- **Over-engineered.** 34 features when 15 would have been enough.
- **Named things wrong.** "Concierge", "Portfolio", "Compliance Centre", "Variation Manager", "Risk Score" — all sounded professional to me and would sound alien to a homeowner.
- **Treated homeowners like project managers.** They're not. They're tired people with a leaky boiler.
- **Confused feature completeness with product quality.** Every feature I added made SiteBook bigger, not better.
- **Imported patterns from Procore + Notion + Monday.com** — the exact platforms Philip explicitly said SiteBook is NOT.
- **Optimised for revenue-per-user, not for retention through simplicity.** Long-term the simpler product will out-earn the complex one because retention compounds.

**What v2 got right that stays:**

- Positioning as house-scoped OS (not project tool) — correct
- WhatsApp as message layer, SiteBook as record layer — correct
- Property Passport as £9.99 sellable artefact — correct
- Trade Circle integration + Boost monetisation — correct
- Free tier as viral loop — correct
- 4-tier ladder (just renamed) — correct

**Lesson:** Complexity is easy to add and hard to remove. Simplicity is harder to design and impossible to undo the value of. This revision resets to the harder job.

---

## End of revision

*Document owner: Philip · Blueprint hierarchy: v2.0 (technical reference) → v2.1 (this — design directive) · Next: Phase 1 spec after Philip approves the 10 decisions above.*
