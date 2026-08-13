---
authored_by: Philip O'Farrell (doctrine + universal process taxonomy) · Master AI Engineer (inheritance model)
authored_role: Founder doctrine + Master AI Engineer inheritance architecture
captured_at: 2026-08-03
capture_medium: written contribution (evening dump)
governance:
  rule_a_anti_fabrication: pass · doctrine authored by Philip
  rule_b_no_ai_authored:   pass on doctrine · inheritance architecture attributed
  rule_c_attributable_origin: pass · origin = Philip O'Farrell 2026-08-03
architecture_layer: L2 · SHARED KNOWLEDGE FOUNDATION · every trade domain INHERITS this
document_version: 1.0
document_type: MEGA_DOCTRINE · foundational shared brain
composes_with:
  - docs/brains/nex-architecture-v2-refined-flow-philip-2026-08-03.md (Knowledge Layer + Domain Template refinements)
  - docs/brains/nex-domain-template-philip-2026-08-03.md (Section 1 · Knowledge · now supports inheritance)
  - docs/brains/nex-knowledge-layer-extraction-philip-2026-08-03.md (retrieval contract enforces inheritance transparently)
inheritable_by:
  - staircase (Domain 001)
  - kitchen (Domain 002)
  - windows (planned)
  - flooring (planned)
  - bathrooms (planned)
  - fitted_furniture (planned)
  - bespoke_joinery (planned)
  - doors (planned)
  - roofing (planned)
  - extensions (planned)
  - all future install trades
---

# NEX Universal Trade Layer · The Shared Business Foundation

## The Doctrine

Philip 2026-08-03: *"Don't think of quoting, site visits, and customer workflow as staircase knowledge. Think of them as trade business knowledge that every installation trade can reuse. A kitchen fitter, staircase maker, fitted furniture company, window installer, flooring contractor and bespoke joiner all follow broadly the same business process."*

**Author the Trade Business Brain BEFORE expanding into any second trade domain.** It becomes the shared foundation every trade inherits, so we never duplicate the same processes across 20+ install trades.

## The Inheritance Model

```
                    Universal Trade Layer (shared)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         Staircases       Kitchens        Windows       (each domain inherits)
              │               │               │
         Domain-specific  Domain-specific  Domain-specific
         knowledge         knowledge         knowledge
```

Every install trade INHERITS the Universal Trade Layer. Each domain only authors what makes IT unique. A kitchen fitter's site visit is 95% the same as a staircase maker's site visit — the shared knowledge lives ONCE.

## The 18 Universal Trade Processes (mandatory for every trade domain)

Philip 2026-08-03 authored list:

1. **Initial Enquiry** — how a customer first contacts a trade business
2. **Qualifying Questions** — early questions to determine if the job is a fit
3. **Site Visit Process** — visiting the customer's property
4. **Measuring Procedure** — capturing dimensions accurately
5. **Photographs Required** — what to photograph and why
6. **Quotation Workflow** — turning site data into a priced proposal
7. **Deposits and Payment Stages** — how payment is structured through the job
8. **Lead Times** — how to communicate manufacturing + install duration
9. **Manufacturing Workflow** — from approved quote to finished product
10. **Installation Workflow** — the on-site fit
11. **Variations / Change Orders** — how mid-job changes are handled
12. **Completion Checklist** — verifying the job is finished properly
13. **Warranty Process** — post-install cover
14. **Aftercare** — ongoing customer relationship
15. **Customer Communication** — the touchpoints throughout the job
16. **Health & Safety** — legal and moral safety practices
17. **Risk Assessment** — job-specific hazard evaluation
18. **Materials Ordering** — from spec to supplier

Each process becomes a shared article in `data/nex-knowledge/_shared/trade-business/articles/`. Each domain's Brain doc can reference the shared article AND author trade-specific overrides in its own `articles/` directory.

## The Directory Structure

```
data/nex-knowledge/
├── _shared/
│   └── trade-business/
│       ├── knowledge.yaml
│       ├── articles/
│       │   ├── initial-enquiry.md
│       │   ├── qualifying-questions.md
│       │   ├── site-visit-process.md
│       │   ├── measuring-procedure.md
│       │   ├── photographs-required.md
│       │   ├── quotation-workflow.md
│       │   ├── deposits-and-payment-stages.md
│       │   ├── lead-times.md
│       │   ├── manufacturing-workflow.md
│       │   ├── installation-workflow.md
│       │   ├── variations-change-orders.md
│       │   ├── completion-checklist.md
│       │   ├── warranty-process.md
│       │   ├── aftercare.md
│       │   ├── customer-communication.md
│       │   ├── health-and-safety.md
│       │   ├── risk-assessment.md
│       │   └── materials-ordering.md
│       └── faqs.jsonl          (cross-trade FAQs)
│
├── staircase/                    (Domain 001 · inherits trade-business)
│   ├── knowledge.yaml            (declares: inherits_from: [_shared/trade-business])
│   └── ...                       (staircase-specific knowledge only)
│
└── kitchen/                      (Domain 002 · inherits trade-business)
    ├── knowledge.yaml            (declares: inherits_from: [_shared/trade-business])
    └── ...                       (kitchen-specific knowledge only)
```

## The Retrieval Contract Extension

The `retrieve()` API (Phase B.5) automatically consults inherited shared brains BEFORE authoring the domain-specific response. Every domain's `knowledge.yaml` declares:

```yaml
inherits_from:
  - _shared/trade-business
  - _shared/timber-species      (optional additional shared brain)
```

When a Brain calls `retrieve({ domain: "kitchen", query: "how do I quote a job?" })`, the runtime:

1. Loads Kitchen's own knowledge (0 results — Kitchen doesn't author its own quotation article).
2. Loads inherited `_shared/trade-business/articles/quotation-workflow.md`.
3. Returns the shared article with a `source: "shared/trade-business/quotation-workflow.md"` marker.

The caller can distinguish shared vs domain-specific knowledge via the `source` field, but doesn't need to — the shared article is authoritative.

## The Override Rule

A domain can OVERRIDE a shared article if its process genuinely differs:

- **Staircase site visit** typically includes floor-to-floor measurement + headroom check + light angle — Staircase authors `data/nex-knowledge/staircase/articles/site-visit-process.md` which OVERRIDES the shared article for staircase queries.
- **Kitchen site visit** typically includes appliance survey + services location + ceiling height — Kitchen authors its own override.

Override rules:
- Domain-specific article takes precedence when both exist.
- Shared article surfaces as a "further reading" reference in the retrieve result.
- Override files must declare `overrides: _shared/trade-business/articles/{filename}` in their frontmatter for auditability.

## What Belongs in the Universal Trade Layer

Rule of thumb: if the process would broadly apply to **kitchen fitters AND staircase makers AND fitted furniture companies AND window installers AND flooring contractors AND bespoke joiners**, it belongs in Universal Trade Layer.

If the process is specific to ONE trade (e.g. "how to secret-fix T&G boards to a staircase back panel"), it belongs in that domain.

## What Does NOT Belong in the Universal Trade Layer

- Trade-specific measurements (staircase rise/going · kitchen cabinet widths · window opening dimensions)
- Trade-specific materials (staircase timber species · kitchen worktop materials · window glass grades)
- Trade-specific regulations (Approved Doc K · kitchen ventilation regs · window U-values)
- Trade-specific components (newel posts · cabinet carcasses · window frames)
- Trade-specific design taxonomy (staircase styles · kitchen layouts · window styles)

These live in their respective domain directories.

## Governance Rules

- Every article in `_shared/trade-business/` requires Rule c attribution (Philip-authored).
- Every domain that inherits from `_shared/trade-business` declares it in `knowledge.yaml`.
- The retrieve API logs which shared brains it consulted per query (Router Trace).
- Removing a shared article requires checking all inheriting domains for override implications.

## Cross-Domain Composition (composes with Architecture v2 refinement #8)

The `cross_domain_dependencies` field in a Domain's `knowledge.yaml` still applies — it declares which OTHER DOMAINS to consult (e.g. Staircase → Timber for material knowledge). The `inherits_from` field is different — it declares which SHARED FOUNDATIONS to inherit (e.g. every trade → _shared/trade-business).

Both mechanisms coexist:

```yaml
domain_id: staircase
inherits_from:
  - _shared/trade-business
cross_domain_dependencies:
  - timber
  - lighting
  - regulations
```

## The 20+ Trade Domains That Will Inherit This

Every domain in the Home & Property + Construction categories of the Global Domains Catalog inherits this layer:

**Home & Property** — Staircases · Kitchens · Bedrooms · Bathrooms · Flooring · Doors · Windows · Roofing · Extensions · Loft Conversions · Conservatories · Decking · Fencing · Landscaping · Driveways · Garages · Garden Rooms · Lighting · Smart Homes · Interior Design.

**Construction trades** — Joinery · Carpentry · Plumbing · Electrical · Heating · Air Conditioning · Insulation · Painting · Decorating.

That's 29 trades that inherit ONE shared foundation. Without this layer, we'd re-author quotation/site visit/warranty × 29 times.

## Success Metric

*Adding a new trade domain requires authoring ONLY the trade-specific knowledge. The full 18-process business workflow is inherited without duplication. A new trade goes from "empty" to "Bronze maturity" in ≤10 days of focused authoring, not weeks.*

## Enhancement Opportunity

The Universal Trade Layer is what turns Nex from "an AI that knows about staircases" into "an AI that knows how to run any install trade business." When a kitchen fitter downloads the Kitchen Industry Pack, they don't just get kitchen product knowledge — they get a complete business operating system with site visit checklists, quotation templates, warranty processes, and aftercare workflows already in place. That is the difference between a specialist tool and an operating system. **No competitor is architecting this way — every AI treats each vertical as a fresh product.**
