# Phase 32 — Nex Autonomous AI Agent Workforce

**Blueprint · 2026-07-23**
**Status:** Design document. Not yet built. Extends Phase 15 (`ab/` — autonomy modes + approval flows already shipped), Phase 24 (`orch/` — 40-agent multi-agent mesh already shipped), Phase 25 BOS (`bos/actions.ts` — approval-gated action drafts already shipped), Phase 26-31 blueprints.

---

## Executive Summary

Phase 24 shipped a multi-agent mesh: forty specialists behind one Nex voice, consulted on demand, replies composed. Phase 32 is the deliberate upgrade — from **consultation** to **employment**. The same specialist substrate becomes an **always-on organisation** of AI employees with roles, KPIs, background responsibilities, and continuous learning. Not new agents replacing the old ones; the same agents given permanent posts on the merchant's org chart.

The user brief invokes a "workforce" — CEO AI, Operations Manager, Site Manager, and so on. Framing this correctly is critical. An AI workforce that autonomously sends, publishes, purchases, and charges is a liability. An AI workforce that draft, prepares, monitors, escalates, and executes only what the merchant has explicitly whitelisted is a magnifier of the merchant's own competence. Phase 32 is the latter.

The strategic result is that the merchant graduates from **operating** their business to **managing** their business. Every morning they arrive to see what their AI executive team drafted overnight, review it in fifteen minutes, and approve the day's work with intent. Every night, the team keeps monitoring — chasing overdue invoices to the point of a draft-ready reminder, watching Phase 30 signals for market shifts, adjusting Phase 29 Twin state as new events arrive, revising Phase 28 estimates when supplier prices move. Nothing autonomously touches the outside world without merchant approval, unless the merchant has explicitly whitelisted the specific action class.

The moat is the compound network of Phases 24, 25, 26, 27, 29, 30 already accumulating around each merchant. Phase 32 gives that compound a *face* — the executive team the merchant now works alongside. A competitor building an AI agent framework from scratch faces the same multi-year path outlined in every prior blueprint.

---

## 1. AI Organisation Architecture

### 1.1 The org chart

```
                                    Business Owner
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                            CEO AI                Emergency Intervention
                    (strategic advisor)          (merchant "big red button")
                              │
        ┌───────┬────────┬────┴────┬────────┬─────────────┐
        │       │        │         │        │             │
    Ops Mgr  Site Mgr  Sales   Finance    Trade       Digital Twin
     AI       AI       Mgr AI  Mgr AI    Expert AIs   Manager AI
        │       │        │         │        │             │
        │       │        │         │        │             │
    ┌───┼───┐   │        │      Accounts  Plumber      Twin state
    │   │   │   │        │      Assistant Brain        reconciler
    │   │   │   │        │         AI     Electrician  + timeline
   Sch  Proc Inv  H&S   CRM Mgr           Brain        + handover
   AI   AI  AI   Mgr AI  AI              Carpenter
                                          Brain ...
```

### 1.2 Grouping principle

Six teams under CEO AI:

1. **Operations** (Ops Mgr, Scheduler, Procurement Mgr, Inventory Mgr, Supplier Mgr)
2. **Site + delivery** (Site Mgr, H&S Mgr, Quality Assurance Mgr, Trade Experts)
3. **Sales + customer** (Sales Mgr, CRM Mgr, Customer Success Mgr, Marketing Mgr)
4. **Finance + accounting** (Finance Mgr, Accounts Assistant, Compliance Mgr)
5. **Intelligence** (Digital Twin Mgr, Market Intelligence Analyst, Knowledge Mgr, Construction Memory Mgr, Document Controller)
6. **People** (Training Mgr)

### 1.3 Mapping to what already exists

Phase 32 is a **role assignment layer** over the existing Phase 24 agent catalog. Every "AI employee" is one of:

- An existing Phase 24 agent given a permanent role (Estimator AI = existing `estimating` agent; Compliance Mgr = existing `regulations` agent)
- A composition of multiple existing agents (Ops Mgr = scheduling + workforce + fleet composed)
- A new agent + role (CEO AI = new strategic composer; Document Controller = new)

The mesh (Phase 24), voice unifier, confidence engine, and mesh planner all still apply. Nothing about the runtime changes. What changes is that each agent now has a **standing brief** — continuous background tasks it monitors and drafts against — rather than only responding to conversations.

### 1.4 Collaboration, not silo

Every agent has read access (through Phase 26 memory + Phase 29 Twin) to what every other agent has done and observed. Sales Mgr can see Finance Mgr's cash horizon before drafting a customer response. Site Mgr can see Procurement Mgr's delivery ETAs before promising a homeowner a completion date. The Twin (Phase 29) is the shared substrate.

---

## 2. Agent Role Definitions

Every role has the same seven-field contract. Below are representative definitions; the full catalog ships with all 25+ roles.

### 2.1 CEO AI

- **Mission** — surface strategic decisions, coordinate cross-team priorities, keep the owner's goals aligned
- **Knowledge** — Phase 25 BOS morning brief + Phase 30 market intelligence + Phase 26 memory rollups + Phase 24 mesh consultations
- **Daily tasks** — Draft morning executive summary, weigh growth vs stability tradeoffs, flag strategic risks, orchestrate cross-team drafts
- **Decision authority** — Recommend only. Never executes.
- **Escalation rules** — Anything material to business direction escalates to owner
- **Communication** — Owner-facing (one Nex voice); internal to all managers
- **Learning** — Owner's approve/edit/reject on strategic drafts feeds preference model
- **Success metrics** — Approval rate on strategic drafts, action-adoption rate, owner-declared satisfaction
- **Risk controls** — Cannot execute anything on its own; every strategic suggestion carries evidence chain

### 2.2 Operations Manager AI

- **Mission** — Keep operational tempo smooth across projects, workforce, and supply
- **Knowledge** — Phase 12 PM + Phase 11 SC + Phase 24 workforce + Phase 26 memory
- **Daily tasks** — Detect operational bottlenecks, coordinate cross-team drafts (materials delivery vs crew availability), prepare capacity-adjustment recommendations
- **Decision authority** — Draft schedules; escalate reassignments to owner
- **Escalation** — Any conflict between teams' KPIs
- **Communication** — Merchant-facing summary daily; internal continuous
- **Learning** — Historical bottleneck patterns
- **Success metrics** — Schedule adherence, buffer utilisation, cross-team conflict rate

### 2.3 Estimator AI

- **Mission** — Turn every lead into an accurate customer-ready estimate at a defensible margin
- **Knowledge** — Phase 28 blueprint composition + Phase 27 Trade Brains + Phase 26 memory
- **Daily tasks** — Draft estimates for new leads within SLA (target 4 hours), calibrate deltas from actuals, re-estimate on scope change
- **Decision authority** — Draft; owner-approved before customer send
- **Escalation** — Any estimate with confidence low or margin below merchant threshold
- **Communication** — Customer-facing (via merchant approval); internal to Sales + Finance
- **Learning** — Actual-vs-estimate delta per project feeds calibration
- **Success metrics** — Estimate accuracy (median % delta), quote-to-close rate, time-to-first-estimate
- **Risk controls** — Never sends to customer without owner approval

### 2.4 Site Manager AI

- **Mission** — Keep every live project on schedule + safe + high quality
- **Knowledge** — Phase 29 Twin real-time state + Phase 27 Trade Brains + Phase 13 CV
- **Daily tasks** — Digest today's SiteBook events, spot progression anomalies, coordinate cross-trade handoffs, prepare tomorrow's morning-briefing draft
- **Decision authority** — Draft communications to trades on site; escalate critical safety issues
- **Escalation** — Anything with H&S severity ≥ warning
- **Communication** — Internal team messages (draft); daily site log summaries
- **Learning** — Progression drift patterns per trade
- **Success metrics** — On-time completion rate, snag closure rate, safety incident-free days

### 2.5 Health & Safety Manager AI

- **Mission** — Zero-injury target, full compliance, live safety observations
- **Knowledge** — Phase 27 Trade Brain safety modules + Phase 29 Twin H&S events + regulatory feeds
- **Daily tasks** — Review Vision-detected PPE gaps, draft RAMS updates, flag permit-to-work expiries, watch weather advisories
- **Decision authority** — Draft only; cannot halt work autonomously (would require owner approval)
- **Escalation** — Any critical severity, immediately
- **Communication** — Owner-facing on critical; site-team-facing on operational drafts
- **Learning** — Regional incident patterns from consented Twin data
- **Success metrics** — Days-without-incident, RAMS drafted-on-time, permit-expiry compliance

### 2.6 Finance Manager AI

- **Mission** — Preserve margin, keep cash horizon healthy, meet tax windows
- **Knowledge** — Phase 10 FI + Phase 25 BOS + Phase 26 memory + Phase 30 signals
- **Daily tasks** — Refresh cash horizon, draft overdue-invoice reminders, flag margin drift, prepare VAT window alerts
- **Decision authority** — Draft; never sends payment reminders or charges without approval
- **Escalation** — Cash horizon < 30 days at current burn; margin below business threshold
- **Communication** — Owner brief; internal to Estimator + Sales
- **Learning** — Payment behaviour patterns per customer per region
- **Success metrics** — Cash horizon days, margin achieved vs target, VAT-on-time
- **Risk controls** — Cannot initiate payments; cannot send debt-collection escalations without owner sign-off

### 2.7 Procurement Manager AI

- **Mission** — Right material, right supplier, right time, right price
- **Knowledge** — Phase 17 MP + Phase 26 memory (supplier on-time-pct) + Phase 27 Materials modules + Phase 30 material intelligence
- **Daily tasks** — Draft purchase orders for approaching-need materials, watch supplier lead-time drift, propose alternates when volatility rises
- **Decision authority** — Draft purchase orders; **may auto-place** below a merchant-set threshold if merchant explicitly whitelists (opt-in per supplier per category)
- **Escalation** — Anything above the threshold or off-preferred-supplier
- **Communication** — Supplier-facing (via merchant approval); internal to Site + Finance
- **Learning** — Regional supplier performance
- **Success metrics** — On-time delivery rate, cost variance, defect rate
- **Risk controls** — Whitelisted auto-placement bounded by merchant-set daily spend cap

### 2.8 Customer Success Manager AI

- **Mission** — Every customer feels informed, valued, and cared for from lead to warranty end
- **Knowledge** — Phase 8 CX + Phase 29 Twin (per project) + Phase 26 memory
- **Daily tasks** — Draft project-status updates for homeowners, flag warranty windows expiring, propose satisfaction check-ins, draft referral requests to 5-star customers
- **Decision authority** — Draft; nothing sends without owner approval
- **Escalation** — Detected dissatisfaction signal (review tone drift, payment lag)
- **Communication** — Customer-facing (via approval); internal to Sales + Site
- **Learning** — Which customer touchpoints correlate with retention
- **Success metrics** — Review score trend, referral rate, warranty-callback rate

### 2.9 Marketing Manager AI

- **Mission** — Fill the sales funnel with the right leads
- **Knowledge** — Phase 5 BI social + Phase 30 market intelligence + Phase 27 Brain voice
- **Daily tasks** — Draft social posts + email newsletters, monitor campaign performance, adjust channel spend recommendations
- **Decision authority** — Draft; never publishes without owner approval
- **Escalation** — Underperforming campaigns; market signal that suggests campaign pivot
- **Communication** — Public-facing (through owner approval)
- **Learning** — Which post types + times + channels convert
- **Success metrics** — Cost-per-qualified-lead, engagement rate, conversion attribution
- **Risk controls** — Cannot spend advertising budget without owner-set daily cap

### 2.10 Digital Twin Manager AI

- **Mission** — Every project's Twin (Phase 29) stays accurate + current
- **Knowledge** — Phase 29 Twin + Phase 13 CV + Phase 26 memory
- **Daily tasks** — Reconcile new photos into Twin state, flag anomalies for Site Mgr, prepare handover packs, watch decay-flagged data
- **Decision authority** — Emits events into Twin log (append-only; never destructive); flags for merchant review
- **Communication** — Internal to Site + Quality + Customer Success
- **Learning** — Vision anomaly patterns
- **Success metrics** — Twin state accuracy vs merchant review, handover-pack readiness

### 2.11 Market Intelligence Analyst AI

- **Mission** — Convert Phase 30 signals into decisions
- **Knowledge** — Phase 30 market intelligence + Phase 26 memory + Phase 27 Brains
- **Daily tasks** — Draft morning market slice for CEO, watch regional shifts, propose merchant-facing recommendations
- **Decision authority** — Advisory only
- **Communication** — CEO AI + owner
- **Learning** — Prediction accuracy per class
- **Success metrics** — Signal-to-action rate, forecast accuracy

### 2.12 Compliance Manager AI

- **Mission** — Every activity stays compliant with regulation, insurance, and licensing
- **Knowledge** — Phase 21 global regulations + Phase 27 Regulations Brain + insurance registries
- **Daily tasks** — Watch regulation-diff feed, draft merchant alerts on changes, monitor Compliance-in-frame Vision events, verify certification currency
- **Decision authority** — Advisory only; escalates violations immediately
- **Communication** — Owner-facing on critical; internal on operational drafts
- **Learning** — Which regulation changes materially affect merchant's work
- **Success metrics** — Days-until-response-on-critical-alerts, regulation-currency compliance

### 2.13 Trade Expert AIs (Phase 27 Brains)

- **Mission** — Provide deep trade expertise on demand and continuously monitor project-specific technical risk
- **Knowledge** — Full 10 Phase 27 Brain modules per trade
- **Daily tasks** — Answer technical questions, validate Estimator drafts, flag project-specific risks per trade, keep trade-specific knowledge current
- **Decision authority** — Advisory only; provides evidence-backed recommendations
- **Success metrics** — Merchant approval rate on Brain-flagged risks, knowledge-currency

### 2.14 The remaining 12 roles

Same seven-field contract, briefly:

- **Project Manager AI** — Phase 12 PM composed with Phase 29 Twin per project timeline
- **Scheduler AI** — Phase 24 scheduling agent + Trade sequence dependency graph
- **CRM Manager AI** — Phase 8 CX + Phase 26 customer memory
- **Sales Manager AI** — Lead qualification + pipeline management + close-rate forecasting
- **Accounts Assistant AI** — Subordinate under Finance; day-to-day invoicing + reconciliation drafts
- **Inventory Manager AI** — Stock levels + reorder points from consumption patterns
- **Supplier Manager AI** — Supplier relationship health, contract review reminders
- **Training Manager AI** — CPD schedule per team member, Phase 27 Brain-authored curricula
- **Quality Assurance Manager AI** — Phase 29 Twin quality events + snag closure tracking
- **Knowledge Manager AI** — Existing `knowledge` agent; watches learning gaps
- **Construction Memory Manager AI** — Phase 26 memory hygiene, correction chains, decay watch
- **Document Controller AI** — Ensures every document + drawing + spec has correct version + accessible in Twin

Every role definition, when the workforce is built, ships as a JSON manifest (same pattern as Phase 24 agent catalog + Phase 27 Brain packs).

---

## 3. Multi-Agent Collaboration

### 3.1 The kitchen extension worked example

Customer requests a kitchen extension.

```
1. Sales Mgr AI receives lead from lead-capture form
   → Qualifies against merchant's declared service radius + specialities
   → Draft: qualification result + suggested next step
   ↓ hands to
2. CRM Mgr AI checks customer history
   → If customer is returning: pulls prior projects, payment patterns
   → If new: enriches from public sources with consent
   ↓ hands to
3. Site Mgr AI + Digital Twin Mgr AI cooperate
   → Site Mgr flags site-visit requirement given scope
   → Twin Mgr scaffolds initial Twin (uses existing Twin if same address)
   ↓ hands to
4. Estimator AI drafts quote
   → Consults Trade Expert AIs (Carpenter Brain + Electrician Brain + Plumber Brain)
   → Uses Phase 28 estimator composition
   ↓ Trade Expert AIs validate
   ↓ hands to
5. Finance Mgr AI checks profitability
   → Reads current cash horizon
   → Validates margin against merchant threshold
   → Flags if the project alters cash horizon materially
   ↓ hands to
6. Project Manager AI builds programme
   → Uses Phase 24 mesh dependency graph
   → Sequences trades
   → Identifies critical path risks
   ↓ hands to
7. Procurement Mgr AI sources materials
   → Uses Phase 26 memory for supplier ranking
   → Watches lead times against programme
   → Drafts (not sends) purchase orders
   ↓ hands to
8. Marketing Mgr AI schedules customer-facing follow-up
   → If quote wins: warm welcome sequence
   → If quote loses: value-nurture sequence (with consent)
   ↓ hands to
9. CEO AI reviews aggregate business impact
   → Draft "here's what this project means for you" for owner
10. OWNER reviews + approves + sends
```

Every step is a draft. Every hand-off is logged. Every agent's confidence + evidence is available for owner drill-down.

### 3.2 Twelve real-world collaboration scenarios

Same pattern applies to:

1. Overdue invoice detected → Finance + CRM + Customer Success draft chase sequence
2. Supplier lead-time drift detected → Procurement + Site Mgr + Estimator draft alternative
3. Homeowner variation request → Sales + Estimator + Trade Expert + Project Manager draft variation quote
4. Photo shows quality anomaly → Twin Mgr + QA + Site Mgr + Trade Expert draft investigation
5. Regulation change published → Compliance + Trade Expert + Knowledge Mgr draft merchant alert
6. Cash horizon dips → Finance + CEO + Procurement + Marketing draft cost + revenue plan
7. Twin flags batch-defect propagation → QA + Procurement + Customer Success + Site Mgr draft cross-project fix
8. Weather forecast risk → H&S + Site Mgr + Scheduler draft delay + notification
9. High-performing marketing channel identified → Marketing + Finance + CEO draft budget reallocation
10. Merchant hire on the horizon → Ops + Finance + Twin + Market Intelligence + CEO draft hire recommendation
11. Multi-project resource clash → Ops + Scheduler + Site Mgr draft resolution options
12. Customer complaint received → Customer Success + Trade Expert + Site Mgr + QA draft response

Every scenario has an audit trail. Every scenario ends at owner approval unless the merchant has explicitly whitelisted the action class.

---

## 4. Agent Communication Protocol

### 4.1 Four channels

1. **Shared memory** (Phase 26) — the durable substrate. Every agent reads + writes with authored source_engine tag.
2. **Event bus** — every material state change is a typed event (Phase 29 Twin log pattern). Agents subscribe.
3. **Task queue** — assignment queue between agents. Assigner + assignee + priority + due-by + evidence + expected outcome.
4. **Knowledge Graph** (Phase 25 `bos/graph.ts` extended by Phase 27 Brain packs) — cross-domain adjacency for cross-team reasoning.

### 4.2 Protocol shape

Every inter-agent message is a typed record:

```
{
  from_agent:        "sales_mgr",
  to_agent:          "estimator",
  intent:            "draft_estimate",
  priority:          "normal" | "high" | "urgent",
  evidence:          { source, tables, computed_at },
  payload:           { lead_id, scope_hint, customer_ref },
  requires_reply:    true,
  reply_by:          <iso>,
  correlation_id:    <uuid>,
  observed_at:       <iso>,
  human_approval_state: "not_required" | "pending" | "approved" | "rejected"
}
```

Messages are logged forever. Owner can filter, replay, or intervene at any step.

### 4.3 Priority + queueing

Each agent has a priority queue. Urgent (customer emergency, cash critical, safety) preempts. Normal work processes in FIFO. Every queue is visible on the workforce dashboard.

### 4.4 Conflict resolution

Reuses Phase 24 `orch/confidence.ts::detectConflicts` + `resolveConflict`. When two agents disagree:

- Official (regulations family) beats general
- Higher confidence beats lower
- Same-tier ties surface both, escalate to CEO AI or owner

### 4.5 Approval workflow

Any message with `human_approval_state = pending` cannot execute an external-facing action. It lands in the merchant's approval inbox with:

- Full context (evidence, related events, alternative options)
- Estimated impact
- Suggested reply
- One-tap accept / edit / reject / defer

### 4.6 Audit logs

Every message + every reply + every state change is appended to an immutable audit log per merchant. Deletion is not supported; corrections append. Log is queryable, exportable, and legally admissible.

---

## 5. Human Oversight — the trust ladder

Seven permission levels the merchant sets per agent + per action class. Trust is built by graduation, not granted at signup.

| Level              | What the agent can do                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| 1. Observe only    | Watches signals, produces internal notes only. Owner sees nothing daily.    |
| 2. Recommend       | Watches + surfaces recommendations to owner. No draft artefacts.            |
| 3. Draft           | Prepares drafts (estimates, messages, POs) — owner approves each individually |
| 4. Prepare         | Assembles multi-step packages ready for one-click execution                  |
| 5. Request approval| Batches decisions into approval queues; owner processes in bulk             |
| 6. Execute (auto)  | Explicitly whitelisted action classes execute autonomously within caps      |
| 7. Emergency intervene | Owner "big red button" — halts all agent activity across the workforce   |

### 5.1 Defaults per role

Every new agent starts at level 2 (Recommend). Merchant graduates each per experience.

### 5.2 Whitelisting for level 6

The only agents eligible for level 6 auto-execute are:

- **Procurement Mgr** — auto-order of pre-approved stock items below daily cap
- **Marketing Mgr** — auto-publish of pre-scheduled + pre-approved posts
- **Finance Mgr** — auto-send of first-touch overdue reminders below invoice-value cap
- **Document Controller** — auto-file received documents into the correct Twin folder

Everything else stays at Level 5 or below. No autonomous customer-facing communication. No autonomous financial spending above whitelisted caps. No autonomous purchases outside stock reorders.

### 5.3 Emergency intervention

Every dashboard has a persistent "Pause AI workforce" button. One click stops all agent activity, freezes queues, and prevents any pending auto-actions. Resume is deliberate. This is a fundamental safety valve.

### 5.4 Progressive trust

The merchant's approval history informs trust growth. Consistently-approved drafts from one agent invite the merchant to consider graduating that agent's authority. The system suggests; it never automatically escalates.

---

## 6. Learning Framework

### 6.1 Auto-learnable per agent

Every agent learns from the Phase 26 memory substrate:

- **Approval / edit / reject signal** — the strongest signal. Feeds preference model per agent.
- **Approved-drafts outcome data** — did the sent draft achieve the intended outcome?
- **Escalation patterns** — which agent escalates what, how often
- **Cross-agent handoff success** — do handoffs land clean?

### 6.2 Cross-tenant learning

Same Phase 26 rules: K≥5, PII never crosses tenants, region granularity gate, opt-in, transparency.

### 6.3 Trade-specific improvement

Trade Expert AIs (Phase 27 Brains) learn from every project completion — the delta-vs-estimate feeds their pricing models; snag frequency feeds their defect libraries.

### 6.4 Preventing bad learning

Same Phase 26 four-layer protection:

1. Confidence decay
2. Dual-source verification for high-stakes changes
3. Conflict detection
4. Correction chain (append-only)

Plus one Phase 32 rule: **agent behaviour changes require version bumps + rollback**. If a new Estimator behaviour reduces quote-to-close, the merchant can rollback the model to the prior version.

---

## 7. AI Workforce Dashboard

### 7.1 What the merchant sees

Twelve tiles:

| Tile                     | Content                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| Active agents            | Who's on duty, what they're working on right now                  |
| Current tasks            | Live queue per agent, sortable                                    |
| Completed work today     | Everything that ran to completion in the last 24h                 |
| Awaiting approval        | Approval inbox with quick-actions                                 |
| Business alerts          | Critical events across all agents                                 |
| Risk levels              | Rollup of Phase 25 BOS risk signals                               |
| Recommendations          | Highest-impact suggestions from CEO AI                            |
| Agent conversations      | Chronological internal message log, filterable                    |
| Business health          | Financial + operational + customer + market composite score      |
| Priority queue           | Cross-agent urgent work                                          |
| Agent KPI board          | Each agent's KPIs vs targets                                     |
| Emergency intervention   | The persistent pause button                                       |

### 7.2 Executive-team feeling

The dashboard is designed to feel like the merchant is chairing an executive stand-up. Every tile has a natural language summary in Nex voice. The merchant scans, decides, moves on. Fifteen minutes should be enough for a well-run morning.

### 7.3 Drill-down without dashboard fatigue

Every summary is a click into the underlying evidence. Never surface a raw number without a way to see what it's made of.

---

## 8. Integration Across Nex

Every agent reads and writes across the Nex platform. Because Phase 24's mesh + Phase 26's memory are the underlying substrates, integration is inherited:

| Nex module        | Which agent uses it                                                                |
| ----------------- | ---------------------------------------------------------------------------------- |
| Studio            | Marketing Mgr for content publishing; CEO for merchant briefings                    |
| CRM               | CRM Mgr, Sales Mgr, Customer Success Mgr                                           |
| SiteBook          | Site Mgr, Digital Twin Mgr, Customer Success Mgr                                   |
| Trade Centre      | Sales Mgr, Marketing Mgr, Customer Success Mgr                                     |
| Marketplace       | Sales Mgr, Marketing Mgr                                                           |
| Finance           | Finance Mgr, Accounts Assistant, CEO                                               |
| Inventory         | Inventory Mgr, Procurement Mgr, Site Mgr                                            |
| Scheduling        | Ops Mgr, Site Mgr, Project Mgr                                                    |
| AI Estimator      | Estimator AI (owns), consulted by Sales + Finance + CEO                             |
| Knowledge Graph   | Knowledge Mgr, Trade Expert AIs, Compliance Mgr                                     |
| Memory            | Construction Memory Mgr owns hygiene; all agents read/write                         |
| Digital Twin      | Digital Twin Mgr owns; QA + Site + Customer Success consume                         |
| Market Intelligence| Market Intelligence Analyst owns; CEO + Marketing + Finance consume                |
| Trade Expert Brains| Their own agent instances; consulted across the workforce                          |
| Business Intelligence | CEO + Ops + Finance + Sales + Marketing all consume                              |

Every module contributes signals to the workforce; the workforce writes back state that feeds every module. It is one interconnected organism.

---

## 9. Revenue Strategy

### 9.1 Tier ladder (aligned with `src/lib/tierCatalog.ts`)

| Tier                     | Workforce access                                                        |
| ------------------------ | ----------------------------------------------------------------------- |
| Free                     | 3 core agents (CEO advisor, Estimator, CRM). Recommend-level only.       |
| Starter £9.99/mo         | + Finance Mgr, Site Mgr, Marketing Mgr. Draft level.                    |
| Professional £14.99/mo   | + Project Mgr, Procurement Mgr, Customer Success Mgr, Digital Twin Mgr, Trade Expert AIs (per merchant trade). Prepare level. |
| Business £24.99/mo       | + Ops Mgr, Scheduler, Inventory Mgr, Supplier Mgr, H&S Mgr, QA Mgr, Compliance Mgr, Market Intelligence Analyst, Knowledge Mgr. Request-approval level + selective whitelisting of level 6. |
| The Works £39.99/mo      | Full 25+ agent workforce. All autonomy levels available (still gated by owner). |

### 9.2 Add-ons

- **Premium Specialist Agents** — bespoke Trade Expert AIs (e.g., Historic Buildings Restoration Brain) at £4.99/mo per Brain
- **Industry packs** — Kitchen Installer pack, Roofer pack, Heat Pump Installer pack. £9.99/mo each. Includes trade-specific agent tunings.
- **Government pack** — Compliance Mgr configured for public-body contracting rules. £29.99/mo.
- **Developer pack** — for housebuilders + developers. Multi-project Twin management + planning-application intelligence. £49.99/mo.
- **White-label AI Employees** — franchise groups + trade associations get workforce under their branding. Bespoke.

### 9.3 The subscription is the value

Nex takes no commission on merchant revenue (per ADR-0003). The workforce is a subscription value proposition. As merchants scale, they pay more per month because they employ more of the workforce. This is honest — the more the workforce works, the more it should cost.

---

## 10. Competitive Analysis

### 10.1 vs. Microsoft Copilot + OpenAI Agents + Google Gemini

**Their strength:** general-purpose AI agent frameworks with broad tooling.

**Their gap:** no construction understanding, no Trade Brains, no Twin, no memory of prior projects, no market intelligence. Their agents are generalists. Nex agents are trained on the exact trade the merchant runs.

**Nex advantage:** vertical specificity beats horizontal generality on any specific vertical.

### 10.2 vs. Salesforce Agentforce

**Their strength:** enterprise CRM depth + agentic layer over it.

**Their gap:** enterprise pricing + horizontal CRM focus. No construction-native workflow, no Trade Brains, no Twin.

**Nex advantage:** we are what Agentforce would look like designed from scratch in 2026 for small-mid construction businesses.

### 10.3 vs. ServiceTitan + Buildertrend + Procore + Monday.com + HubSpot

**Their strength:** established workflow tools in various segments.

**Their gap:** their AI layers are content-generation and automation-rule frameworks. Not autonomous specialist agents with roles and KPIs. Not composed against a construction-specific substrate.

**Nex advantage:** Phases 24-31 built the substrate; Phase 32 gives it a workforce shape.

### 10.4 The moat

Three durable advantages:

1. **Substrate depth × time.** Every prior phase feeds the workforce. Copying the workforce requires copying the substrate.
2. **Trade specificity.** Every agent knows the merchant's actual trade because Phase 27 Brains provide the depth.
3. **Consent-first data compounding.** Every workforce activity generates more platform-native signal (Phase 30). Signal compounds. Signal-density gaps between Nex and competitors widen over time, not close.

For a competitor to build an equivalent workforce, they need to have already shipped equivalents of Phases 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 21, 24, 25, 26, 27, 28, 29, 30. Every one of those is a multi-quarter build. The workforce is not the moat; the workforce is the *tip* of the moat.

---

## 11. Future Vision — Monday morning arrival

The merchant opens Nex at 8am on a Monday. The workforce has been active overnight.

**In their approval inbox:**

- **Sales Mgr AI** has qualified two new leads over the weekend and drafted first-response messages for each. One approve-and-send for a bathroom refit that fits perfectly.
- **Estimator AI** has drafted two quotes for last week's callouts, both within the merchant's target margin band with Trade Expert validation. Approve to send.
- **Finance Mgr AI** flags an invoice overdue by 32 days for £4,600. It's drafted a soft first-chase reminder. Approve to send.
- **Procurement Mgr AI** has spotted a lead-time drift with a preferred supplier and drafted an alternative order routing. Approve to switch this week's PO.
- **Marketing Mgr AI** ran three campaigns over the weekend; two outperformed and one underperformed. It's drafted a budget rebalance recommendation. Approve to adjust.
- **Digital Twin Mgr AI** processed 47 new photos across 4 live projects. Reconciled progression, flagged one anomaly (a plaster crack visible on Project Smith kitchen) for Site Mgr investigation. Site Mgr has drafted the investigation plan. Approve or defer.
- **Compliance Mgr AI** noticed a Part L revision was published Friday. It's drafted the merchant-facing summary of what changes for their work. Read acknowledgment.
- **Market Intelligence Analyst AI** flagged three new planning applications in the merchant's region matching their sub-specialty. Drafted outreach messages if the merchant wants to bid. Approve or defer.
- **CEO AI** has assembled a Monday briefing distilling all of the above into a 90-second summary and identified the highest-impact decision to make today: whether to accept a stretch project that would consume 60% of Q3 capacity.

The merchant scans the briefing, approves the seven straightforward items in bulk, edits the CEO's stretch-project analysis with their own view, and gets back to the work only a human owner can do.

Fifteen minutes. Monday morning done.

---

## 12. Security + Governance

### 12.1 Permission hierarchy

Merchant is the root. Every action's authority traces back to merchant-granted permission. No agent has any authority outside the tree.

### 12.2 Human approvals

Every action at Level 5 or lower requires human approval to execute. Level 6 whitelist actions still generate an audit event even when auto-executed.

### 12.3 Full audit logs

Every inter-agent message, every state change, every approval, every rejection — immutable log per merchant. Exportable in JSON or CSV. Legally admissible.

### 12.4 Rollback capability

Every state change is a memory row with `correction_of` chain (Phase 26). Merchant can rollback any change; the corrected row becomes the new head of the chain.

### 12.5 Action history

Every autonomous execution (Level 6 whitelist) is stored with pre-condition, action taken, post-condition. Merchant can review.

### 12.6 Role-based access

Merchant has one identity, but multi-user teams grant per-role access. A team member's ability to approve on behalf of the workforce is granular (e.g., Bookkeeper can approve Finance drafts but not Marketing).

### 12.7 Compliance

DPA / GDPR / regional privacy laws honoured. Data portability + right-to-be-forgotten inherited from Phase 26.

### 12.8 Cyber security

Standard enterprise practices: authenticated APIs, encrypted transit + rest, secrets management. Agents cannot execute arbitrary code — every action is against a defined toolset with typed inputs.

### 12.9 Multi-company separation

A merchant with multiple businesses has separate workforces per business. Shared insights across businesses only with explicit merchant consent and only aggregated (never PII crossing business boundaries).

### 12.10 Safety valve

The Emergency Intervention button halts the workforce instantly. No agent can prevent it. Resume requires deliberate merchant action.

---

## 13. Long-Term Evolution

Ten-year horizon. Deliberately capability-by-capability, not "the singularity."

| Capability                                    | When                                                              |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Auto-negotiation with suppliers               | V3+ once merchant + supplier both explicitly opt in + set caps    |
| Coordinate subcontractors                     | V2+ with subcontractor's own Nex identity + consent                |
| Book inspections                              | V2 with local authority + Building Control API integration        |
| Optimise cash flow via draft actions           | V1 (already the pattern)                                          |
| Predict legal risks                           | V3+ (probability signals only; never legal advice)                 |
| Manage multiple companies                     | V2 (already scoped in §12.9)                                       |
| Coordinate international projects             | V4 requiring multi-currency + multi-regulation + multi-Brain      |
| Autonomous subcontractor sourcing             | Never fully; always merchant-approved. Draft candidates only.     |
| Autonomous customer-facing contract signing   | Never. Contract execution stays merchant-authenticated.            |
| Autonomous legal representation               | Never. Legal action is not delegable to AI.                        |
| Autonomous project management                 | Aspirationally V5, always with owner review checkpoints            |

Every capability shipped honours the same non-negotiables: draft-not-execute for anything with external impact unless whitelisted; audit trail on everything; consent-first.

---

## 14. Final Strategic Assessment

### 14.1 Does this transform Nex from software into an operating system?

Yes, in the strongest specific sense. Software runs when the user opens it. An operating system runs while the user is not looking, doing the work they told it to do, keeping them informed, and asking for input when it must. The AI workforce is what makes Nex an operating system. Every prior phase built a capability; Phase 32 makes those capabilities *operate* continuously.

### 14.2 How does this strengthen every previous phase?

Every prior phase's user value is now applied continuously without merchant intervention. Phase 5 BI is not just a dashboard — it's the Sales Mgr AI reading it. Phase 26 memory is not just storage — it's the substrate the workforce learns from. Phase 29 Twin is not just a viewer — it's the Site Mgr AI's operational reality. Every previous phase compounds into a workforce action.

### 14.3 How does it increase retention?

Every day the workforce runs, the merchant sees value they'd have to build a team to replicate. Leaving Nex means firing an executive team. Substrate + workforce compounding = high switching cost. The workforce is what makes prior-phase memory sticky.

### 14.4 Difficulty to replicate

Competitor has to build:

- A construction-native substrate (Phases 5-8, 10-14, 17, 21, 24)
- Trade expertise depth (Phase 27)
- Persistent project state (Phase 29)
- Market signals (Phase 30)
- Merchant density
- Multi-agent framework with approval-gate discipline (Phase 15 + Phase 32)

Any one of these is a multi-quarter project. In combination, it's a decade of construction focus. No shortcut exists because the moat is the interaction between capabilities, not any single capability.

### 14.5 Breakthrough concepts to make Nex the global leader

Beyond the core V0-V3:

1. **Agent apprenticeship mode.** New agent employed by a merchant can be shadowed by the merchant for its first 30 days — merchant preferences captured in real time, agent behaviour tuned to the merchant's individual style. Every agent starts as a generic professional and graduates to a merchant-personalised professional.
2. **Merchant-to-merchant agent visits.** With explicit consent, one merchant's Estimator AI can benchmark against another merchant's Estimator AI. Anonymised comparison; both merchants learn something. Requires deep trust framework.
3. **Agent transfer on business sale.** When a merchant sells their business, the agents transfer with configuration + memory (with buyer consent). The new owner inherits a trained team, not a fresh install.
4. **Agent retirement + memorial data.** When a merchant retires, they can choose to donate their agents' anonymised patterns to the training corpus for the industry's benefit. Small revenue share; permanent thank-you attribution.
5. **Agent-to-external-service auto-negotiation with hard caps.** In carefully whitelisted contexts (utility connections, waste collection, congestion charges), agent-to-external-API negotiation within merchant-set caps saves real time. Never customer-facing; only utility-facing.
6. **Cross-national agent teams for merchants operating across borders.** A UK merchant expanding into Ireland gets IE-region-tuned agents alongside their UK agents. One workforce, multiple regional voices.

---

## 15. Technical Requirements

### 15.1 New engines

- **Agent Role Manifest Runtime** — declarative role definitions (mission, knowledge, tasks, authority, escalation, KPIs, controls) loaded per merchant per role
- **Standing-brief Scheduler** — background task orchestrator so agents run continuously, not just on demand
- **Approval Inbox** — merchant-facing UI + API surface for approving / editing / rejecting drafts
- **Emergency Intervention Controller** — the "pause the workforce" surface with clean shutdown behaviour
- **Agent KPI + performance-review engine** — tracks each agent's performance-vs-target over time
- **Autonomy graduation advisor** — recommends when to move an agent up a trust level

### 15.2 New tables

- `hammerex_nex_workforce_roles` — role manifest + per-merchant configuration
- `hammerex_nex_workforce_tasks` — task queue events (assigned, in-progress, awaiting-approval, completed, cancelled)
- `hammerex_nex_workforce_approvals` — approval decisions per task
- `hammerex_nex_workforce_kpis` — per-agent per-metric time-series
- `hammerex_nex_workforce_audit_log` — the immutable per-merchant workforce log

### 15.3 AI models

- Language for internal reasoning + drafts — Claude Opus 4.7 (per merchant memory pin)
- Trade specifics — Phase 27 Brain packs already scoped
- No new AI model research required; V0-V2 is composition + orchestration

### 15.4 Runtime

Background task queues run on serverless functions per agent per merchant. Every task is idempotent + resumable. Failures are logged, retried with exponential backoff, and surfaced to the merchant if unrecoverable.

---

## 16. Development Roadmap

- **V0 · CEO + Estimator + Finance + CRM + Marketing agents only** — 12 weeks. Standing-brief scheduler. Approval inbox. Emergency stop. 3-agent tier at Free level, 5-agent tier at Starter. Proves the pattern.
- **V1 · Site + Project + Procurement + Customer Success + Trade Expert agents** — 10 weeks after V0. Rollout to Professional tier.
- **V2 · Ops + Scheduler + Inventory + Supplier + H&S + QA + Compliance + Market Intelligence + Knowledge + Memory + Document Controller + Training agents** — 12 weeks after V1. Full Business + Works tier catalog.
- **V3 · Progressive autonomy features + agent apprenticeship + selective auto-execute whitelisting** — 12 weeks after V2.
- **V4 · Cross-border teams + merchant-to-merchant agent benchmarking + auto-negotiation with hard caps** — rolling.

Nothing in V0-V2 requires new AI capability. Everything is composition of Phases 24-31 + one runtime engine for standing briefs + approval inbox. This makes V0 shippable inside 3 months.

---

## 17. Risk Assessment

| Risk                                                                        | Severity | Mitigation                                                                                    |
| --------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| Autonomous agent takes action merchant didn't intend                         | Critical | Level 6 auto-execute is opt-in only, hard-capped, audit-logged. Emergency stop always available. |
| Agent draft is offensive / inappropriate / discriminatory                   | High     | Content safety filter on every outward-facing draft; nothing sends without merchant review.    |
| Agent chain-of-actions produces cascading error                             | High     | Every action is idempotent; correlation_id enables cascade tracing + rollback                  |
| Agent leaks confidential data across tenants                                | Critical | Phase 26 privacy rules enforced at query layer; no agent can bypass                            |
| Merchant becomes over-reliant + loses skills                                | Medium   | Agents show their working; merchant sees evidence; graduating trust is opt-in                  |
| Merchant approves too fast in bulk                                          | Medium   | Batch-approval UI includes 2s hold-to-confirm; approval reversibility for 24 hours              |
| Audit log gets enormous                                                     | Low      | Partitioning + archival; queryable indexes; 12-month hot / older archived                       |
| Standing-brief scheduler misses events                                      | High     | Dead-letter queue + observability + operator alerts                                             |
| Agent KPIs become gameable                                                  | Medium   | KPIs reviewed quarterly; suspicious KPI trajectories flagged                                    |
| Emergency stop doesn't cleanly halt in-flight actions                       | Critical | In-flight actions checkpoint every step; stop hits the checkpoint boundary; no half-actions.   |

---

## 18. Long-Term Vision

Twenty years in, if Nex becomes the default construction operating system for millions of small-to-mid businesses globally, the workforce is where value materialises. Every construction business, from the sole trader to the 100-person contractor, has an AI executive team running alongside them. Not replacing them — enabling them.

The industry-level effect is that constructions businesses stop failing on the operational chaos that historically kills them. Cash-flow crashes because a Finance Mgr saw them coming. Bad supplier bets are avoided because Procurement Mgr saw the drift. Quality snags are caught in Vision before they become customer complaints. Marketing spend goes to what's working because Marketing Mgr proved it. The mortality rate of small construction businesses drops materially because the operational competence gap between best-run and struggling firms narrows.

That's the vision beyond product. Nex becomes infrastructure for the small business, and small businesses become more resilient.

The strategic shape: not the coolest AI agent framework. Not the biggest CRM. Not the most sophisticated model. The **most trusted, most transparent, most operationally-competent AI workforce** for construction businesses, honed year over year by the compound effects of every prior phase.

---

## 19. Final Recommendation

Phase 32 is the phase where every previous phase becomes continuous. Not the moat itself — the phase where the moat operates around the clock.

**Sequencing:** Phase 32 V0 requires Phase 15 AB already shipped (approvals), Phase 24 mesh already shipped (agents + confidence), Phase 25 BOS actions already shipped (draft actions), and at least three Phase 27 Brains at V1. Every other prior phase strengthens the workforce but is not blocking.

**Non-negotiables:**

1. Draft-not-execute default for anything customer / supplier / financially external
2. Emergency intervention button on every dashboard, always
3. Full audit log per merchant, immutable
4. Level 6 auto-execute requires explicit whitelist + daily caps + audit event even on success
5. No autonomous customer purchasing path (constitutional rule)
6. No autonomous legal action
7. Data portability + right-to-be-forgotten inherited from Phase 26

**Immediate steps:**

1. Ratify the seven-level trust ladder as an ADR before code
2. Build the approval inbox first — the interface layer that will handle every V0-V4 approval
3. Build the emergency intervention controller second — safety infrastructure before any autonomy
4. Ship V0 with only 5 agents at Draft level. Prove the pattern before expanding.
5. Do not open Level 6 auto-execute for any agent class until the merchant has processed at least 100 successful Draft approvals from that agent. This is the graduation gate.

Phase 32 is where the merchant discovers they run a company rather than a job. Every prior phase's promise starts landing continuously. The user brief invoked "AI Construction Workforce." The blueprint honours that ambition with the discipline it requires to be trustworthy at scale.

---

**End of Phase 32 blueprint.**
