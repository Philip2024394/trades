# SiteBook Blueprint v2.2 — FINAL (Canonical)

**Version:** 2.2 (supersedes v2.0 + v2.1)
**Owner:** Philip
**Date:** 2026-07-19
**Status:** CANONICAL. This is the blueprint Phase 1 ships against.

**Document hierarchy:**
- `v2_0` — technical reference (backend table sketches, integrations). Retained.
- `v2_1` — philosophical reset (homeowner-first cull). Superseded by this.
- `v2_2` — THIS DOC. Philosophy + decisions + Phase 1 spec. Read this first.

---

## The philosophy (Philip's words, in his voice)

> **SiteBook should feel like owning a digital house.**
>
> Not project management software.
>
> Every repair, improvement, receipt, warranty, trade, document, photo and memory simply becomes part of your home's permanent history.
>
> The homeowner doesn't manage SiteBook.
>
> **SiteBook quietly manages the home.**

This is the north star. Every design decision reduces to this. If a feature makes the homeowner feel like they're managing software, that feature has failed.

---

## The 3 permanent design rules

Every future feature — proposed by anyone, at any time — must pass all three.

### Rule 1 — Questions, not features

Homeowners never think "which feature do I need?". They think "I need to…".

Every page answers ONE user intention:
- 🏠 **What's happening today?**
- 📸 **Add a project photo**
- 💬 **Message a trade**
- 📅 **Upcoming appointments**
- 💷 **Budget remaining**
- ✅ **Things waiting for me**
- 🔍 **Find a local trade**

The homeowner never sees "Document System" · "Notification Engine" · "Warranty Vault" · "Workflow Manager" · "AI Assistant" — those are backend concepts. On the surface it's plain-English intents.

### Rule 2 — Replace work, not create work

Before shipping, answer YES to at least ONE:

- Does this **save the homeowner time?**
- Does this **reduce stress?**
- Does this **eliminate paperwork?**
- Does this **eliminate phone calls?**
- Does this **eliminate searching?**
- Does this **eliminate forgetting?**

If the answer to all six is no, **do not build it.**

### Rule 3 — Hide, don't delete

Advanced features have a legitimate place — but not on day one, and not in the main surface.

- A £2,000 bathroom renovation doesn't need Site QR codes.
- A £500,000 house extension might.

**The platform grows with the project.** Advanced surfaces auto-appear when a project crosses a scale threshold (budget, trade count, duration) — never before. Everything hidden is still in the code, still supported, still testable — just not visible until earned.

---

## The 10 decisions (Philip's tweaks applied)

| # | Decision | Verdict | Note |
|---|---|---|---|
| 1 | Family tier (£9.99) replaces "Concierge" | ✅ **Approved** | Homeowners instantly understand |
| 2 | Kill Kanban tasks | ✅ **Approved** | Simple task list only when needed |
| 3 | Kill Compliance Centre | ✅ **Approved** | Silent background prompts instead |
| 4 | Kill Risk Score | ✅ **Approved** | Plain-English alerts, no numbers |
| 5 | Kill Variation Orders | ⚠️ **SIMPLIFY not kill** | Rename to **"Changes to the quote"** with Approve / Reject buttons |
| 6 | Kill Cashflow Forecast | ✅ **Approved** | Budget tracker is enough for MVP |
| 7 | Kill Insurance / Finance referrals | ⚠️ **PARTIAL** | Don't build now; **leave data + hook architecture ready** for future FCA-compliant partnerships |
| 8 | Rename Aftercare | ⚠️ **RENAME to "Home Care"** | Clearer than "Keep it going". Also acceptable: "Looking After Your Home" or "Home Maintenance" |
| 9 | Remove How It Works from nav | ❌ **NO — keep it** | Small "Help & How It Works" section stays; new + older homeowners rely on it |
| 10 | Drop breathing animation on invite pill | ✅ **Approved** | Shipped 2026-07-19. Clean subtle UI ages better |

---

## Layout constraint — KEEP the 3-column SiteBook layout (Philip 2026-07-19)

**Do not redesign the SiteBook page layout.** The current 3-column structure — left inbox panel · centre feed · right profile/status column — stays intact. Everything new is ADDED into this layout, not replacing it.

### Current 3-column layout (unchanged)

```
─────────────────────────────────────────────────────────────────────────
  SiteBook shell header (yellow BookOpen · SiteBook · [nickname]) · [👤]
─────────────────────────────────────────────────────────────────────────
                            LiveProjectsFeed marquee (full width)
─────────────────────────────────────────────────────────────────────────
  LEFT panel                CENTER feed              RIGHT panel
  ──────────                ─────────────           ─────────────
  SiteBookInboxPanel        [Owner strip]           HowItWorks button
  (Trades & Suppliers)      [Filter tabs]           Owner profile card
  · Search project          [RevealUsageCard]       Location (inline)
  · Row list                [PostComposer]          Share URL
  · +Add trade                                      [+ new v2.2 cards
  · View archived           [PostFeedCard list]      slot in here]
                            [PostFeedCard list]
                            [Export prompt]
─────────────────────────────────────────────────────────────────────────
```

### Where new v2.2 features slot in

| New feature | Slot |
|---|---|
| **Home Care reminders card** | RIGHT panel (top, above RevealUsageCard) |
| **Simple budget card** | Inside each PostFeedCard when it belongs to a project OR as a compact tile on the CENTER feed under the composer |
| **Ask SiteBook** floating button | Bottom-right FLOATING (not in the layout — overlay) |
| **Voice notes** | Enhancement to the PostComposer (button in the composer footer) |
| **Warranty auto-log** | Silent — no UI change; visible in RIGHT panel as a compact "Recent warranties" tile |
| **Things to fix** | Per-project tile in the CENTER feed OR a compact strip inside the PostFeedCard |
| **Emergency contacts** | UserMenuDropdown menu item (not a layout slot) |
| **Welcome tour** | Full-screen overlay ONLY on first visit — no permanent layout change |
| **Help & How It Works** | Kept in the shell header nav where it already lives |
| **Changes to the quote** | Inline card in the PostFeedCard's reply thread — no new page |

### What must never happen

- **No replacement dashboard.** No "Hi Sarah, here's what's happening" full-screen card list.
- **No 4th column.** 3 columns on desktop, mobile stacks feed → left → right (or the existing mobile order).
- **No removal of current containers.** SiteBookInboxPanel, PostComposer, PostFeedCard, RevealUsageCard, owner profile card, LiveProjectsFeed all stay.
- **No renaming of existing user-facing surface labels** without approval.

---

## Bottom-left action floor (mobile)

Always visible:

```
[📸 Add photo]  [💬 Message]  [🔍 Find]  [❓ Help]  [👤 Me]
```

**❓ Help** — kept per decision #9. Opens the How-It-Works guide. Small, always there for the users who need it.

**👤 Me** — the avatar dropdown from `UserMenuDropdown`. Home surface access + settings + log out.

---

## Feature list (final — 15 items for Phase 1 through Phase 3)

### Phase 1 — "Make free delightful" (weeks 1-4)

Every homeowner GETS these on first use. None require reading a help doc. **All slot into the existing 3-column layout — no page redesign.**

1. **Ask SiteBook** — floating yellow button, plain-English chat, reply + one action button (overlay, not layout)
2. **Simple budget card** — one number, one bar per project. Slots into the CENTER feed under composer OR as a compact tile at the top of each PostFeedCard scoped to a project
3. **Home Care reminders card** — "Boiler service due — rebook Watson?". Slots into the RIGHT panel above the RevealUsageCard
4. **Warranty auto-log** — silent on job-complete; plain compact list added to the RIGHT panel below the owner profile ("Recent warranties" tile)
5. **Things to fix** — photo + one line snag capture. Slots into the PostFeedCard as an inline action + a compact per-project tile in the CENTER
6. **Voice notes composer** — hold-mic button added to the existing PostComposer's footer row
7. **Emergency contacts page** — 6 big buttons; added as a UserMenuDropdown menu item (not a layout slot)
8. **Welcome tour** (first-visit only) — full-screen overlay: 3 taps: name your SiteBook · first project · invite a trade
9. **Help & How It Works** kept in nav (decision #9) — already lives there
10. **Home screen intent cards** — DEFERRED. Any "what's happening today" summary lives at the TOP of the CENTER feed as a pinned intent-strip (not a page replacement). Scoped to Phase 2 for design review before build.

### Phase 2 — "Turn Pro on" (weeks 5-9)

Pro tier launches. Everything here is a genuine time-saver, not a paywall trap.

11. **Line-item budget view** (Pro power surface — free tier keeps totals)
12. **Calendar month view** with Google/iCal sync
13. **Document intake email** — `<slug>@docs.thenetworkers.app` — the wow feature
14. **Photo AI recognition** (silent, invisible)
15. **Auto-brief chip** in composer (silent offer to rewrite from photos + one line)
16. **AI proactive nudges** ("Watson hasn't replied in 4 days")
17. **Property Passport export** (£9.99, one button)
18. **Weather prompts in feed** (no dashboard)
19. **Changes to the quote** — trade drafts, homeowner Approves / Rejects (decision #5)

### Phase 3 — "Share + Scale" (weeks 10-14)

Family + Landlord tiers + trade-side monetisation.

20. **Share with family** — one email, everyone sees the same view
21. **Family tier** subscription (decision #1)
22. **Multi-property picker** for landlords
23. **Landlord dashboard** — 5-property "what needs attention"
24. **Custom-branded Property Passport** (Landlord)
25. **Xero/QuickBooks CSV export** (Landlord)
26. **Trade Circle Boosted placements** live (trade-side monetisation, doesn't touch homeowner UX)

### Progressive disclosure — features hidden until earned

Rule 3 in action. These features live in the codebase from day one but only surface when their trigger fires:

| Feature | Trigger to unlock |
|---|---|
| Site access QR codes | Project budget > £50k · duration > 60d |
| Visitor log | Site access enabled |
| Neighbour notifications | AI detects extension / party-wall / structural scope |
| Compliance prompts (deep) | AI detects planning / building regs likelihood |
| Cashflow forecast | Homeowner has 3+ active paid projects |
| Equipment / tool register | Trade adds first hire item |
| Site diary | Project duration > 30 days |
| RAMS / method statement pinning | Project has 3+ trades AND budget > £30k |

These are **not settings the user has to turn on**. They appear naturally when they matter. And **stay in the platform code** so scaling to £500k projects is seamless — the platform grows with the project.

---

## Insurance + Finance — architecture-ready, not built (decision #7)

Per Philip's tweak, we don't build revenue streams that risk FCA compliance or credibility. BUT we keep the data + hooks architecturally ready so future partnerships plug in cleanly:

- `hammerex_sitebook_projects.insurance_needs boolean` (kept but null-default)
- Placeholder event kinds `"finance-referral"` and `"insurance-referral"` reserved in the events table
- `/api/homeowner/partners/*` route namespace reserved
- Property Passport export includes an insurance-summary section that renders empty today

When a compliant partner is signed, we flip a feature flag and the plumbing is there. No refactor.

---

## Renaming applied

| Old name | New name | Rationale |
|---|---|---|
| Aftercare subscription | **Home Care** | Plain English (decision #8) |
| Variation Order | **Changes to the quote** | No jargon (decision #5) |
| Compliance Centre | *(removed — silent prompts only)* | Decision #3 |
| Risk Score | *(removed — plain alerts only)* | Decision #4 |
| Cashflow Forecast | *(removed — progressive disclosure only)* | Decision #6 |
| Concierge tier | **Family tier** | Plain English (decision #1) |

Codebase actions: rename any reference to "Aftercare" in `HowItWorks` manifest + strings. Rename any "Variation Order" reference to "Changes to the quote". Both surfaces already spec'd but not yet built — cleanup is trivial.

---

## Tier ladder — final

| Tier | Price | The one-sentence pitch |
|---|---|---|
| **Free** | £0 | "Full SiteBook for your home. Try it as long as you like." |
| **Pro** | £4.99/mo | "Do more. Faster. More WhatsApp invites, more AI, no ads." |
| **Family** | £9.99/mo | "Everything in Pro. Share with your family — they see the same view." |
| **Landlord** | £29/mo | "One SiteBook per property, one dashboard for all your homes." |

Add-on: **Home Care** £2.99/mo — "We'll remind you what needs doing and book you the right trade — no thinking required." Available on Free + Pro; bundled in Family + Landlord.

---

## What we ship this week

Approved-and-actionable now:

1. ✅ **Breathing animation dropped** on canteen invite pill (shipped 2026-07-19 in `CanteenInviteOverlay.tsx`)
2. Update `HowItWorks` manifest: rename references from "Aftercare" → "Home Care"; add "Changes to the quote" card
3. Scope + start Phase 1 feature #1 (Home screen redesign) — highest-value change

---

## Standing directive for me (Claude) going forward

Any future feature I propose must:

1. **Pass Rule 1** — answers ONE homeowner question, in plain English
2. **Pass Rule 2** — saves time / reduces stress / eliminates paperwork or phone calls or searching or forgetting
3. **Pass Rule 3** — either surfaces naturally at Day 1 OR sits in progressive-disclosure until earned

If I propose a feature that fails any rule, I say so explicitly + explain why the feature is worth breaking the rule for. Otherwise I don't propose it.

**Saved to memory as `feedback_sitebook_design_rules.md`** so this persists across sessions.

---

## End of canonical blueprint

*Document owner: Philip · Author: Claude (revised on Philip's direction 2026-07-19) · Phase 1 starts on Philip's approval of scope*
