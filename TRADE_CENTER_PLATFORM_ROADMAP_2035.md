# Trade Center — Platform Evolution Roadmap 2026 → 2035

**Owner:** Philip O'Farrell
**Status:** Canonical evolution roadmap — how the platform grows for a decade without another architectural rewrite
**Version:** 1.0 · 2026-07-11
**Parent docs:** `TRADE_CENTER_2_SPEC.md` · `TRADE_CENTER_DESIGN_PRINCIPLES.md` · `TRADE_CENTER_PLATFORM_ARCHITECTURE.md`

---

## 0. Purpose

This document answers ONE question:

> **"How does the platform grow over the next decade without another architectural rewrite?"**

It is not a feature roadmap. It is an **evolution roadmap** — a decade-long plan for what changes phase by phase, what MUST remain immutable, what scales, what's intentionally left out, and how each phase transitions to the next without breaking anything users have already learned.

If the architecture is right, every future feature is a plugin addition. This doc proves the architecture is right by showing how five phases of growth all fit inside the same shell.

---

## 1. The Meta-Principle That Governs All Phases

**The shell never changes.**

- Users learn the shell once. They learn it for a decade.
- Plugins evolve, are added, are sunset. The shell endures.
- Every phase below adds plugins. NO phase changes the shell.
- If a phase requires a shell change, this doc is amended before that phase begins — and only with explicit sign-off.

Think Windows Explorer, macOS Finder, Figma's toolbar, VS Code's activity bar. Users spent years learning them. The apps around them changed radically. The shell held.

**Corollary:** the only architectural change permitted between phases is the addition of a new PLATFORM SERVICE (like the AI dispatcher, universal search, workflow engine, telemetry bus). Even those additions must respect the Final Principle: shell owns experience, plugins own business logic, services own data, infrastructure owns reliability.

---

## 2. Phase 1 — Foundation (2026)

**Duration:** ~20 weeks from Week 0
**Ambition:** prove the platform can host plugins cleanly, predictably, and indefinitely.

### 2.1 Plugins delivered

- Platform Shell (v1)
- Plugin System (registry, install CLI, validation)
- Marketplace (Plugin #1 — proof the contract works)
- Merchants
- Orders
- Messaging
- AI (as a platform service; contributes UI slots)
- Universal Search (as a platform service)
- Workspace (Home dashboard, Today's Work strip)

### 2.2 What changes

- Existing codebase's ecommerce shape → workspace shape
- Existing `hammerex_*` tables → `tc_*` schema namespace
- Existing routes wrapped into the plugin registry system
- Existing session cookie extended with capability claims
- Existing merchant profiles / reviews / canteens migrated as plugin data (community canteens → Community plugin surface, coming Phase 2)

### 2.3 What remains immutable

- The PluginContract v1.1 shape
- The five-layer architecture
- The event bus schema envelope
- The capability model (adding new capabilities is fine; changing the model is not)
- The Platform Design System primitive contracts
- The Final Principle

### 2.4 What scales

- Number of plugins (starts ~10)
- Event volume (thousands/day → millions/day)
- User count (~50k trades UK)
- Country count (UK-only → Ireland end of phase)

### 2.5 What is intentionally left out

- Mobile-native apps (browser + PWA only for now)
- Fully offline-first (drafts only)
- Third-party plugins (internal only in Phase 1)
- Government / regulatory integrations
- Enterprise API for external consumers
- White-label capability (in the spec's tier list but not activated)

### 2.6 Technical risks

- **Event bus mis-design.** If ordering guarantees are wrong, we spend Phase 2 debugging cross-plugin workflows. Mitigation: durable event log from day one; every event carries `version` and `correlationId`.
- **Plugin coupling creep.** Under Week 3–4 deadline pressure, engineers reach for a shortcut import. Mitigation: ESLint boundary rules enforced at PR time; the Platform Validation Test in Week 0 proves the wall holds.
- **"Everything emits" discipline erodes.** Adding an event feels like busywork when the deadline looms. Mitigation: telemetry auto-instrumentation makes emission the cheapest option; PR review rejects silent mutations.
- **Postgres NOTIFY throughput.** At high event volume, single-server LISTEN/NOTIFY hits limits. Mitigation: architecture allows migration to Kafka/Redpanda without changing the plugin-facing contract.

### 2.7 Commercial risks

- **Users don't grasp workspace vs marketplace.** The Simple/Workspace mode selector must feel invisible. Mitigation: 30-day inactivity downgrade + soft upgrade prompt on first workspace action.
- **Onboarding friction rejects casual users.** Every workspace feature that requires a Saved List, Quote, or Order to unlock is friction. Mitigation: keep Free tier deliberately generous on Marketplace-only usage.
- **Tier boundary confusion.** Trades don't know if they need Pro. Mitigation: workspace onboarding tour shows Pro features contextually, doesn't upsell out of context.

### 2.8 Migration strategy

- Existing `hammerex_*` tables kept live during Phase 1
- New writes go to `tc_*`; reads have adapters that check both
- Existing users grandfathered — same login, same slug
- Cutover per plugin, not big-bang: Merchants first, then Marketplace, then Orders
- Rollback plan: shell can be disabled via feature flag reverting the whole platform to the old routes for 24h

### 2.9 Phase 1 exit criteria

- Platform Validation Test passes (§8)
- All 9 Phase 1 plugins live for Professional tier
- p95 TTFB < 400ms
- Zero cross-plugin imports in codebase (CI-enforced)
- 100% of state changes emit events (spot-checked audit)
- Command palette in daily active use by ≥ 40% of Professional users
- Migration from `hammerex_*` complete; legacy tables read-only

---

## 3. Phase 2 — Business Operating System (2027)

**Duration:** ~12 months
**Ambition:** trades don't just BUY through Trade Center. They RUN their business through it.

### 3.1 Plugins delivered

- Projects (job-level container)
- Quotes (v2 — beyond the basic PDF)
- Estimator (v2 — trade-specific calculators)
- Invoices (issued + received; VAT-compliant per country)
- Scheduling (job calendar, delivery slots, appointments)
- Inventory (merchant-side, tied to Marketplace listings)
- Customers (lightweight CRM for trades — their clients, not our merchants)
- Suppliers (buy-side directory + relationship tracking)
- Document Storage (contracts, drawings, sign-offs)
- Business Analytics (per-plugin dashboards composed)
- Community (canteens migrated in from spec §19.9)

### 3.2 What changes

- Trade Center becomes the primary work surface for merchants (not just buyers)
- ~20 total plugins live
- Cross-plugin workflows fire multi-step (Quote → Invoice → Payment → Analytics)
- AI moves from "answer" to "compose" (drafts quotes, drafts invoices, suggests scheduling)
- Multi-user businesses (teams) activate on Enterprise tier

### 3.3 What remains immutable

- Shell (§1)
- PluginContract
- Event bus
- Capability model (new capabilities added, not restructured)
- Layer boundaries
- Platform Design System (extended with new primitives, contracts unchanged)

### 3.4 What scales

- Cross-plugin workflow count (5 in Phase 1 → 50+ in Phase 2)
- AI tool count (~15 in Phase 1 → ~100 in Phase 2)
- Business complexity (single-user → 3-10 person teams)
- Country count (UK+IE → +AU +US)

### 3.5 What is intentionally left out

- Recruitment (Phase 3)
- Training (Phase 3)
- Insurance (Phase 3)
- Government integrations (Phase 5)
- Full-fat CRM (kept lightweight; QuickBooks/HubSpot integrations first)
- Video calls (Phase 3)

### 3.6 Technical risks

- **Workflow engine complexity.** As workflows compose, debugging failed steps 8 hops deep becomes hard. Mitigation: correlation IDs across every step; workflow inspector in Admin console from day one.
- **Cross-plugin transactional integrity.** Quote → Invoice may span two plugins; a failed second step needs a compensating first. Mitigation: saga pattern is native to the workflow engine (already in v1.1 architecture).
- **Multi-user permission edge cases.** Two team members editing the same Quote at 3pm on a Friday. Mitigation: capability model + optimistic concurrency + PDS's `<Form>` locks on aggregate.
- **AI cost drift.** Every plugin adds tools; costs balloon. Mitigation: cost router at `/api/ai/dispatch` per §7 of architecture; per-tier quotas enforced.

### 3.7 Commercial risks

- **Competing with QuickBooks / Xero / Trello.** We can't outbuild them at accounting or PM in isolation. Mitigation: trades-native workflow (Quote → Invoice) integrated end-to-end; **integrate** not replicate the accounting engine — Xero / QB via API in Phase 2.
- **Tier confusion redoubles.** Professional gets crowded; Enterprise justification harder. Mitigation: Enterprise = teams. Full stop. Everything else Pro.
- **Business owners resist changing tools.** Existing accountants push back against workflow disruption. Mitigation: Trade Center exports to their existing accountant; ingestion, not replacement.

### 3.8 Migration strategy

- Phase 2 plugins install atomically — no forced migration
- Trades opt into each plugin (they see it in the Marketplace tier or Business dashboard)
- Data model additive; no breaking changes to Phase 1 schemas
- Teams (Enterprise) require an explicit upgrade + role composition workflow

### 3.9 Phase 2 exit criteria

- Full Quote → Invoice → Payment → Analytics workflow demonstrable
- ≥ 10% of Professional users on multi-plugin workflow daily
- Team-based businesses ≥ 500 across UK
- Ireland + Australia + US live
- Third-party accounting integration (Xero UK / MYOB AU / QB US) shipped

---

## 4. Phase 3 — Construction Network (2028 – 2029)

**Duration:** ~18 months
**Ambition:** Trade Center is the industry graph. Every trade, merchant, product, job, supplier, insurer connected.

### 4.1 Plugins delivered

- Recruitment
- Training
- Certification
- Equipment Hire
- Trade Finance
- Insurance
- Property (job-address lookups; residential + commercial listings)
- Fleet
- Vehicle Marketplace
- Trade Communities (Community plugin at scale)
- Knowledge Exchange (peer-to-peer question/answer, ranked by verified skill)

### 4.2 What changes

- User profiles become RICH — verification, qualifications, employment history, insurance
- Canteens grow from communities → the primary discourse layer for the industry
- Third-party financial products (Trade Finance, Insurance) live via regulated partners
- Data graph starts to have real economic value

### 4.3 What remains immutable

- Shell
- PluginContract
- Event bus
- Capability model
- Layer boundaries
- Platform Design System
- The Final Principle

### 4.4 What scales

- User count (~50k UK → ~500k global)
- Cross-country deployment
- Third-party integrations (financial partners, insurance carriers, training providers)
- Canteen membership counts (from ~200 per → ~10k+ per active canteen)

### 4.5 What is intentionally left out

- Government APIs (Phase 5)
- Carbon reporting (Phase 5)
- Autonomous AI purchasing (Phase 4)
- Third-party plugin marketplace (Phase 5)

### 4.6 Technical risks

- **Identity verification at scale.** Manual verification doesn't scale to 500k users. Mitigation: automated verification pipeline for identity (Onfido or equivalent) and business (Companies House / equivalent per country); manual review only for edge cases.
- **Multi-country regulatory compliance.** Trade Finance in UK ≠ AU ≠ US. Mitigation: financial products delivered via regulated partners in each country, never issued by Trade Center itself. Trade Center is the surface; partners bear the regulation.
- **Canteen moderation at scale.** At 10k+ members per canteen, moderation queue is a full-time job per canteen. Mitigation: AI-assisted moderation contributed as a platform service; community moderators promoted from verified members.

### 4.7 Commercial risks

- **Financial products require regulated partners.** A misstep destroys trust across the entire platform. Mitigation: partner selection through diligence panels; every financial action shows the actual issuer prominently.
- **Recruitment competes with Indeed/LinkedIn.** We can't match their scale on general jobs. Mitigation: trades-only, verified-only. Focus on the "I need a Gas Safe engineer this weekend" moment neither Indeed nor LinkedIn serves.
- **Insurance kills margins if we underprice.** Broker economics are ugly. Mitigation: revenue-share with brokers, not direct issuance.
- **Property marketplace overlaps Rightmove/Zoopla.** Don't compete on residential search. Mitigation: property-for-trades — commercial refurbs, HMO conversions, developer jobs. B2B property.

### 4.8 Migration strategy

- Phase 3 plugins install per-country as regulatory + partner readiness allows
- Each financial product goes through a pilot with real merchants before broad availability
- Recruitment starts on canteen-verified users only (built-in reputation from Phase 1-2)

### 4.9 Phase 3 exit criteria

- 500k+ verified trades globally
- Trade Finance issued to ≥ 5000 businesses
- ≥ 20 active canteens with ≥ 5000 members each
- Recruitment placements ≥ 10k / month
- Insurance policies bound ≥ 2000 / month

---

## 5. Phase 4 — Intelligent Platform (2030 – 2032)

**Duration:** ~24 months
**Ambition:** AI moves from copilot (answers questions) to agent (takes actions under policy).

### 5.1 Plugins / capabilities delivered

- AI Agents (procurement, ordering, scheduling — with explicit user policy)
- Procurement Automation
- Predictive Ordering (based on job pattern, supplier trust, seasonality)
- Supply Chain Intelligence (real-time visibility on merchant inventory + supplier availability)
- Market Pricing (dynamic pricing intelligence)
- Business Recommendations (proactive suggestions per business)
- Automated Purchasing (delegated by user policy)
- Document Understanding (drawings, quotes, invoices auto-parsed)
- Voice Workflows (hands-free operation from a job site)
- AR Measuring (phone camera → material estimate)

### 5.2 What changes

- AI moves from `answer` to `act`. Copilot → Agent.
- User policy becomes a first-class primitive ("Purchase if unit price ≤ £X AND merchant trust ≥ Y AND delivery ≤ Z days")
- Document Understanding = camera → structured data (drawings, invoices, quotes)
- Voice becomes primary input on job sites (Voice Workflows)
- AR replaces manual measuring

### 5.3 What remains immutable

- Shell
- PluginContract (AI Agents register as plugin capabilities, not new contract kinds)
- Event bus
- Capability model (agents check capabilities like users do)
- Layer boundaries
- Workflow engine (agents are just fancy workflow initiators)
- Platform Design System

### 5.4 What scales

- AI cost per user (needs aggressive optimisation — mitigation: fine-tuned small models per task)
- Regulatory compliance around autonomous B2B commerce
- Trust — biggest scaling challenge (see below)

### 5.5 What is intentionally left out

- Fully autonomous end-to-end operations (human-in-loop retained)
- AI-driven pricing manipulation (kept transparent)
- Autonomous financial decisions above policy-defined caps
- AI-generated merchant content (fake reviews, fake profiles — banned)

### 5.6 Technical risks

- **Agent reliability at scale.** Autonomous purchasing that goes wrong loses trust immediately. Mitigation: every autonomous action is dry-run first, requires explicit user policy consent, and produces a full audit trail. Every action can be reversed within 24h.
- **Hallucination in high-stakes decisions.** Model invents a supplier that doesn't exist. Mitigation: tool-use only — no free-text purchase decisions. All actions go through verified plugin tools.
- **Explainability.** "Why did the agent buy this?" must always be answerable. Mitigation: every agent decision emits an event with reasoning chain preserved.

### 5.7 Commercial risks

- **Trust in AI-driven purchases.** Users may not want the AI to buy anything, even under policy. Mitigation: opt-in per action class; default state is "suggest, don't act."
- **Failure attribution.** When the agent buys the wrong thing, who pays? Mitigation: platform indemnification within defined policy limits; excess is user's responsibility.
- **Regulatory framework for autonomous B2B.** Some jurisdictions may restrict. Mitigation: legal review before each country deployment.

### 5.8 Migration strategy

- Agents ship as OPT-IN by default, forever
- Each new agent capability starts on Enterprise, then Professional after 90 days of production data
- User policy templates provided (conservative / balanced / aggressive) but user always customises
- Every agent action can be undone within 24h without penalty

### 5.9 Phase 4 exit criteria

- ≥ 100k businesses using at least one Agent capability
- ≥ 50% of Professional users with a Voice Workflow in daily rotation
- AR measuring accuracy ≥ 92% vs measuring tape
- Zero regulatory incidents

---

## 6. Phase 5 — Industry Platform (2033 – 2035)

**Duration:** ~24 months
**Ambition:** Trade Center becomes industry infrastructure. Governments, competitors, third-party developers all consume it.

### 6.1 Plugins / capabilities delivered

- Government Integrations (per country: building control, HMRC/HMRC-equivalent, planning)
- Tax Integrations (Making Tax Digital UK, ATO AU, IRS US)
- Building Regulations (structured per country; per-trade compliance flows)
- Compliance (audit trail, evidence packaging for regulators)
- Digital Product Passports (EU DPP live 2027; global adoption follows)
- Carbon Reporting (Scope 1/2/3 for construction firms)
- Construction Data Exchange (industry-wide interoperability)
- Enterprise APIs (partners consume Trade Center as a data layer)
- Partner Marketplace (Salesforce, SAP, Oracle integrations)
- Third-party Plugin Store (external developers ship plugins per PluginContract)
- Platform Health (public SLO dashboard, incident transparency)

### 6.2 What changes

- Trade Center becomes infrastructure. It's less an app; more a utility.
- Third-party developers ship plugins for a live user base.
- Government regulators consume APIs.
- Competing platforms integrate our data via published APIs.
- Business model shifts: revenue from platform fees (external plugin marketplace), not just tier subscriptions.

### 6.3 What remains immutable

- Shell (still hasn't changed after 10 years — proves the architecture)
- PluginContract (versioned; v1 → v2 breaking changes require 12-month deprecation)
- Event bus
- Capability model
- Layer boundaries
- Platform Design System
- Final Principle

### 6.4 What scales

- Third-party developer ecosystem (from 0 to 10k+ developers)
- Cross-industry integrations
- Government regulatory reporting (jurisdictional × sector × trade)
- Data volume — Trade Center becomes a first-class industry dataset

### 6.5 What is intentionally left out

- Sunset options for legacy plugins that no one uses
- Retirement of unused capabilities
- Non-construction sectors (adjacent yes; unrelated no)

### 6.6 Technical risks

- **Multi-tenant data sovereignty.** Some countries require in-country data. Mitigation: regional Postgres deployments; the country_code column enables sharding.
- **Regulatory API stability.** Governments change APIs; if we consume them the wrong way, features break. Mitigation: adapter pattern in the Integrations plugin; contracts versioned; changes trigger event, not silent failure.
- **Third-party plugin security review at scale.** 100 external plugins/month can't be manually reviewed. Mitigation: signed plugins, automated security scans, capability sandbox at runtime; trust tiers per developer.

### 6.7 Commercial risks

- **Platform economics.** How do revenue share, plugin pricing, and platform fees interact without killing the developer ecosystem? Mitigation: Apple/Stripe-style transparent split; developers keep the majority.
- **Antitrust exposure.** As market share grows, regulators watch. Mitigation: neutrality — Trade Center never favours its own plugins over verified third-party ones; audit-friendly.
- **Government regulation of platforms.** DMA-style rules in EU. Mitigation: architect for interoperability from day one; capability model + published API means we can't wall garden even if we wanted to.

### 6.8 Migration strategy

- Government + Enterprise APIs stable within 12 months of launch (guarantees for partner adoption)
- Plugin Store opens with strict verification (core partners only), gradually opens to community
- Every deprecation goes through a 12-month notice period

### 6.9 Phase 5 exit criteria

- ≥ 10k third-party developers with published plugins
- ≥ 3 governments consuming Enterprise APIs at scale
- ≥ £100M annual revenue from platform fees + tier subscriptions
- Zero shell rewrites in 10 years

---

## 7. The Architectural Test For Every Future Feature

**Every future feature answers ONE question first:**

> **"Does this require changing the shell?"**

If the answer is **yes** → the feature is probably wrong. Rework it.
If the answer is **no** → build it as a plugin, a capability contribution, or an infrastructure addition.

The shell must remain stable. Everything else evolves around it.

### 7.1 Concrete examples

| Proposed feature | Requires shell change? | Verdict |
|---|---|---|
| Add "Fleet Management" to primary rail | No (register via manifest, primary rail slot available) | ✅ Ship |
| Add "Video call" capability inside Messages | No (Messages plugin contributes new UI + AI tool) | ✅ Ship |
| Add a new top-level tab beside primary rail | Yes (structural shell change) | ❌ Rework |
| Add carbon reporting per merchant | No (Compliance plugin registers widget on merchant profile) | ✅ Ship |
| Change the command palette layout | Yes (shell change) | ❌ Rework unless architectural amendment |
| Add a new capability (`fleet.dispatch`) | No (plugin declares in manifest) | ✅ Ship |
| Add a new right-panel slot type | Yes (shell change, requires amendment) | ❌ Rework unless justified |
| Add a plugin that needs a new database schema | No (`tc_{plugin}.*`, plugin owns it) | ✅ Ship |
| Add analytics for a plugin | No (auto-instrumented; custom via manifest.telemetry) | ✅ Ship |

**If in doubt, the answer is No.** Build a plugin.

---

## 8. Week 0 Demonstration Criteria (Philip's approval gate)

Before Week 1 begins, the platform MUST demonstrate all ten of these — in the presence of Philip:

1. **The shell boots.** Blank shell renders; primary rail renders from registry; top bar renders; command palette opens on ⌘K.
2. **Plugins register automatically.** Adding a plugin folder → auto-discovered on next boot; removing it → no trace.
3. **The command palette discovers plugin commands.** Actions from every installed plugin appear in ⌘K grouped by module.
4. **Universal Search indexes multiple plugin types.** Query returns grouped results across ≥ 3 different provider kinds simultaneously.
5. **AI discovers plugin tools dynamically.** Copilot uses tools registered by multiple plugins in a single conversation.
6. **A plugin can be installed and removed without editing any existing code.** Grep-verified; no diff outside the plugin folder.
7. **Event propagation works across plugins.** Plugin A emits → Plugin B's handler runs; correlation ID traces both.
8. **Workflow orchestration triggers correctly from emitted events.** Event fires → workflow starts → steps execute in order → completion event emitted.
9. **Telemetry records activity automatically.** Auto-baseline metrics (`plugin.request.count`, `plugin.event.emitted`, etc.) captured without any instrumentation code in the demo plugin.
10. **The shell behaves identically regardless of which plugins are installed.** Uninstall 3 plugins → shell still works, primary rail collapses gracefully, no errors.

If all ten pass, the architecture has achieved its goal.

---

## 9. Phase Transitions — How We Know We're Ready

Never move to the next phase because the calendar says so. Move when the exit criteria pass.

| Phase | Exit Signal |
|---|---|
| Phase 1 → 2 | Platform Validation Test passes + 9 Phase 1 plugins in daily use + zero cross-plugin imports |
| Phase 2 → 3 | Multi-plugin workflows (Quote→Invoice→Payment→Analytics) live for ≥ 10% of Professional users |
| Phase 3 → 4 | 500k verified users globally + Trade Finance issued at scale + Community moderation self-sustaining |
| Phase 4 → 5 | ≥ 100k businesses using at least one Agent capability + zero regulatory incidents |
| Phase 5 → next | Platform-as-infrastructure: 10k+ third-party developers + government API adoption |

Skipping ahead is forbidden. Each phase compounds trust with the prior phase. Skipping breaks the compound.

---

## 10. Migration Strategy Across Phases

### 10.1 The additive rule

Every migration is additive. Schemas add columns, not remove them. Events add fields, not remove them. Plugins are deprecated with 12-month windows, never yanked.

### 10.2 The compatibility promise

- PluginContract v1 → v2 breaking change: 12-month deprecation
- Event schema v1 → v2 breaking change: dual-emit for 6 months
- Capability rename: alias for 6 months
- Route change: 301 permanent + `Cache-Control: 31536000`
- Feature flag kill: 30-day notice

### 10.3 Data continuity

- Every user's data survives every phase transition
- Every merchant's identity survives every phase transition
- Every canteen post from 2026 is still visible in 2035

### 10.4 The user promise

**Users never re-learn the shell.** They learn it in 2026. It works the same in 2035. Everything else grows around them.

---

## 11. Amendment Process

Amendments to this doc are how we admit the future is different from what we expected in 2026. That's healthy. What's not healthy is silent drift.

- Amendment requires: written proposal, rationale, Philip sign-off, version bump
- Amendments that change a phase's plugin list: informational
- Amendments that change what's immutable in a phase: STRATEGIC — require 30-day review window
- Amendments that change the Final Principle: architectural surgery — require re-approval of all four platform docs

Prior versions archived at `docs/architecture/history/roadmap-v{n}.md`.

---

## 12. Referenced Docs

- `TRADE_CENTER_2_SPEC.md` — product specification (what we build)
- `TRADE_CENTER_DESIGN_PRINCIPLES.md` — constitution (what deserves to be built)
- `TRADE_CENTER_PLATFORM_ARCHITECTURE.md` — master architecture (how anything plugs in at all)
- `project_trade_center_is_os_not_ecommerce.md` — memory pin
- `project_trade_center_design_principles_gate.md` — memory pin
- `project_trade_center_platform_directives.md` — memory pin
- `project_trade_center_platform_architecture.md` — memory pin
- `project_trade_center_evolution_roadmap.md` — memory pin (this doc)

---

**End of evolution roadmap.**

*In 2035, when someone reads this document, the platform will still have the same shell. That's the goal.*

*The plugins will be different. The users' work will be different. The country list will be different. The AI capabilities will be different.*

*But when a plasterer opens Trade Center in 2035, the sidebar will be where it was in 2026. The palette will still be ⌘K. The Home dashboard will still be Today's Work. The shell will still be theirs.*

*That's what an operating system is supposed to do.*
