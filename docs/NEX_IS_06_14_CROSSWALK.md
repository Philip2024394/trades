# IS-06 through IS-14 · Crosswalk to Existing Phases

**Diagnostic document · 2026-07-23**
**Purpose:** the 9 "Industrial Intelligence" specs (IS-06 through IS-14) requested substantially overlap existing Nex phase blueprints. This document maps each IS request to the existing authoritative spec, identifies any genuine gap, and recommends action.

**Why this document instead of 9 new specs:** honest engineering values single source of truth. Duplicating phase specifications with new labels creates drift, confusion, and future maintenance burden. Where an IS request maps 1:1 to an existing phase, the existing phase spec is the authoritative reference · no rewrite adds value. Where a genuine gap exists, this document flags it precisely.

---

## Crosswalk Table

| IS Spec | Description | Maps to existing phase(s) | Additional work required |
|---------|-------------|---------------------------|--------------------------|
| **IS-06** Estimator Accuracy & Vision AI | Photo → estimate · profit protection · learning system | **Phase 28** AI Estimator Engine (blueprint) · **Phase 13** Construction Vision (shipped) · **Phase 7** est (shipped) | None — Phase 28 spec already covers all IS-06 requirements including 8 Vision AI innovations, 3-price model, profit optimiser, actual-vs-estimate calibration loop |
| **IS-07** AI Bookkeeper | Receipt intelligence · job financials · proactive alerts · invoice tracking · accountant exports | **Phase 32** Autonomous Workforce (Bookkeeper AI role) · **Phase 10** FI (shipped) · **Phase 33** Workforce Economy hire flow | Minor gap: receipt OCR flow not yet specified · add to Phase 10 FI backlog as one improvement |
| **IS-08** Trade Brain V1 · Staircases | Deep staircase intelligence including materials, measurements, regulations, pricing, installation | **Phase 27** Trade Expert Brains blueprint | Small gap: Carpenter Brain includes staircases as sub-specialisation but staircase-specific depth needs authoring. Recommend as **Carpenter Brain V1 deliverable** authored by human trade advisor per Phase 27 V0 pattern (Electrician was reference implementation; Carpenter is next) |
| **IS-09** Predictive Project Intelligence | Delay/material/labour prediction · project health score · risk recommendations | **Phase 25** BOS `predict.ts` (shipped) · **Phase 29** Digital Twin blueprint | Phase 25 BOS shipped V0 covers schedule/cost/cash/workforce/material/profit risk categories with probability + severity + suggested action. Phase 29 Twin V0-V1 extends to per-project live monitoring. IS-09 = these composed for the merchant · already planned |
| **IS-10** AI Customer Acquisition Engine | Social content generation · lead qualification · follow-up · conversion prediction | **Phase 32** Marketing Manager AI role · **Phase 5** BI (shipped) · **Phase 8** CX (shipped) | Phase 32 Marketing Mgr AI covers social drafts, lead scoring, follow-up drafts, and approval workflow. Lead qualification specifically needs one addition: **lead-scoring model** in Phase 8 CX · recommend adding as one CX improvement to Sprint 5 backlog |
| **IS-11** Construction Knowledge Graph Expansion | Nodes (trades/materials/tools/suppliers/etc) · relationships · learning loop | **Phase 25** `bos/graph.ts` (shipped as seed) · **Phase 27** Trade Brains · **Phase 26** Memory (edges from rollups) | Phase 25 shipped 8-trade seed graph with 13 edge types. Phase 27 extends. Phase 26 memory rollups feed edge weights. IS-11 = full expansion strategy which IS the ES-10 long-term roadmap. Already planned |
| **IS-12** AI Operations Manager | Daily briefing · task management · decision intelligence · team intelligence | **Phase 32** Ops Manager AI role · **Phase 25** BOS morning report (shipped) · **Phase 22** Ops (shipped) | Phase 22 Ops shipped the personalised morning briefing composer. Phase 25 BOS shipped the business intelligence layer. Phase 32 blueprints the Ops Mgr AI as always-on agent. IS-12 = all three composed · already covered |
| **IS-13** AI Sales & CRM Intelligence | Lead intelligence · customer profile · sales assistant · quote presentation · follow-up · CRM memory | **Phase 8** CX (shipped) · **Phase 32** Sales Manager + CRM Manager + Customer Success AI roles · **Phase 26** Memory | Fully covered by Phase 8 + Phase 32 blueprints. IS-13 = these composed. Quote presentation intelligence is Phase 28 Estimator's interactive proposal (already specified) |
| **IS-14** Construction Marketplace Intelligence | Project-based commerce · supplier intelligence · smart recommendations · marketplace data advantage | **Phase 17** MP (shipped) · **Phase 27** Trade Brain Materials modules · **Phase 30** Market Intelligence blueprint | Phase 17 MP shipped provides marketplace substrate. Phase 27 Brain Materials modules provide project-scoped recommendations. Phase 30 Market Intelligence blueprints the wholesale + supplier intelligence layer. IS-14 = these composed |

---

## Recommended Actions

### Actions with zero additional spec needed

- **IS-06** — build per Phase 28 blueprint. No new spec.
- **IS-09** — build per Phase 25 BOS (shipped) + Phase 29 Twin blueprint. No new spec.
- **IS-11** — build per Phase 25 (shipped) + Phase 27 blueprint. No new spec.
- **IS-12** — build per Phase 32 blueprint + Phase 22 (shipped) + Phase 25 (shipped). No new spec.
- **IS-13** — build per Phase 8 (shipped) + Phase 32 blueprint. No new spec.
- **IS-14** — build per Phase 17 (shipped) + Phase 27 + Phase 30 blueprint. No new spec.

### Actions with small additions to existing backlogs

- **IS-07** Bookkeeper — add **receipt OCR flow** to Phase 10 FI backlog. Estimated 2 weeks eng · low risk. This becomes one item in Sprint 5 or post-launch backlog.
- **IS-08** Trade Brain V1 Staircases — **Carpenter Brain authoring** as Sprint 2 deliverable per Trade Brain V1 plan. Includes staircase sub-specialisation authored by human carpenter trade advisor. No new architectural spec · this is authorship work already scheduled per Trade Brain Author recruitment plan.
- **IS-10** Customer Acquisition — add **lead-scoring model** to Phase 8 CX backlog. Estimated 3 weeks eng · medium risk (needs validation with real merchants). Post-launch improvement.

### Genuinely new work discovered

None of the IS specs identified fundamentally new architectural work not already blueprinted. This is expected given the scope of the 33 phase blueprints and the Master Architecture.

---

## Strategic Framing (from IS prompts)

The IS prompts pose good questions worth answering explicitly:

### How do these systems connect?

The intelligence loop:

- Trade Brain (Phase 27) understands the work
- Estimator (Phase 28) prices the work
- Bookkeeper (Phase 32 role) tracks the profit
- Memory (Phase 26) captures actuals for future calibration
- Market Intelligence (Phase 30) contextualises with regional signals
- Twin (Phase 29) records the live project
- Workforce (Phase 32) executes with human approval

Every completed project increments intelligence across every module. Substrate composition is the mechanism.

### What proprietary data does Nex collect?

Per Master Architecture and ES-10:

- Quote-to-close ratios (Phase 5 BI + Phase 8 CX)
- Actual vs estimated deltas (Phase 28 Estimator learning loop)
- Supplier on-time-pct + defect rates (Phase 17 MP + Phase 26 memory)
- Labour productivity per trade × region (Phase 26 memory rollups)
- Material substitution patterns (Phase 26 memory + Phase 27 Brain corrections)
- Regulation-compliance drift (Phase 21 global + Phase 27 corrections)
- Homeowner intent signals (SiteBook + Twin)
- Vision-detected defect libraries (Phase 13 CV + Phase 27 Brain defect modules)

This is Nex's uncopyable data moat. Every prior phase blueprint contributes.

### How does Nex avoid becoming a simple AI wrapper?

Four structural answers:

1. **Vertical construction depth** — 40 Trade Brains authored by human tradespeople (Phase 27)
2. **Cross-tenant memory substrate** — years of merchant density (Phase 26)
3. **Composition across 33 modules** — no single feature carries the value; the interaction does
4. **Model-agnostic architecture** — every AI call behind `ai/` orchestration layer · swap providers in one sprint (ES-01 §7)

A generic LLM wrapper couldn't reproduce Nex's outputs because Nex's outputs depend on data + specialists + memory that only Nex has.

### What should be built first?

Per Master Architecture v1.0 + Build Execution Playbook v1.0:

**Critical path:**

```
Memory V1 → Trade Brains V1 → Estimator V0 → Workforce V0 → everything else
```

**Sprint order (per Implementation Plan):**

- Sprint 1 · Trust Foundation (payment recovery, GDPR, model outage, RBAC start)
- Sprint 2 · Approval Sanity (weekly digest, batch, conflict UI, RBAC finish, Trade Brain V1 authoring)
- Sprint 3 · Onboarding + Estimator (Business Builder V2, Estimator V0-V1)
- Sprint 4 · On-Site + Memory + Twin (SiteBook V2, Chat V2, Memory V2, Twin V0)
- Sprint 5 · Commercial + International + Enterprise

No re-prioritisation is needed based on the IS series review.

---

## Final Recommendation

**Do not produce IS-06 through IS-14 as standalone specifications.**

**Do:**

1. Reference existing phase blueprints as authoritative for all IS topics
2. Add the 3 small gaps identified (Bookkeeper receipt OCR · Carpenter Brain staircase depth · Sales lead-scoring model) to existing phase backlogs
3. Execute against Master Architecture + Build Execution Playbook + Implementation Plan already produced

**Rationale:** every IS request is already addressed by the substantive documentation already produced. Rewriting under new labels creates specification drift · maintenance burden · and confusion about authoritative source. Single source of truth is a documented engineering discipline (ES-02 §1.1 principle).

**End of IS-06 through IS-14 Crosswalk.**
