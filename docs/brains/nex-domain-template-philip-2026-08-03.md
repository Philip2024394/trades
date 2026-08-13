---
authored_by: Philip O'Farrell (template doctrine) · Master AI Engineer (schema formalisation)
authored_role: Founder template + Master AI Engineer schema
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_b_no_ai_authored: pass on template · schema attributed
  rule_c_attributable_origin: pass · origin = Philip O'Farrell 2026-08-03
architecture_layer: L2_TEMPLATE · governs how EVERY new domain is structured
document_version: 1.1
document_version_history:
  - v1.0 2026-08-03 morning · initial template
  - v1.1 2026-08-03 evening · added Maturity Levels (Bronze/Silver/Gold) + Inheritance (shared brains) + Contract Versioning
composes_with:
  - docs/brains/nex-architecture-v2-refined-flow-philip-2026-08-03.md (refinement #8)
  - docs/brains/nex-global-knowledge-domains-catalog-philip-2026-08-03.md (100+ domains use this template)
  - docs/brains/nex-universal-trade-layer-philip-2026-08-03.md (shared brain that install trades inherit)
---

# NEX Domain Template · The Repeatable Structure

## The Doctrine

Philip 2026-08-03: *"This is the biggest thing I'd add. Every new domain should follow exactly the same structure. That consistency will save enormous effort as the platform grows."*

Every new domain (Kitchen · Marketing · Finance · Travel · anything) MUST follow this template. Domain 001 (Staircase) is the reference implementation.

## The 4-Section Template (mandatory for every domain)

```
Domain: {domain_name}
├── Section 1 · Knowledge
│   ├── FAQs             (structured Q&A · authored per governance rule c)
│   ├── Images           (manifest-tagged · a_plus for hero specimens)
│   ├── Videos           (linked from manifest with duration + purpose)
│   ├── Components       (structured YAML per component family)
│   ├── Rules            (regulations · standards · compliance)
│   ├── Calculators      (parametric tools · e.g. staircase rise/going)
│   ├── Articles         (long-form brain docs)
│   ├── Gallery          (auto-generated from manifest tag intersection)
│   ├── Manufacturers    (business directory scoped to this domain)
│   └── Standards        (industry standards + certifications)
│
├── Section 2 · AI Specialists (typically 4 per domain)
│   ├── Designer         (the aesthetic + creative role)
│   ├── Engineer         (the technical + specification role)
│   ├── Quoter           (the pricing + estimation role)
│   └── Installer        (the execution + fitting role)
│
├── Section 3 · Router Tags (5 universal per domain)
│   ├── Design           (Create verb · new artefacts in this domain)
│   ├── Build            (Create + Execute verbs · make something real)
│   ├── Repair           (Improve verb · fix existing state)
│   ├── Compare          (Decide verb · A vs B in this domain)
│   └── Learn            (Learn verb · teach the concepts)
│
└── Section 4 · Workspace Objects (5 per domain, adapted per domain)
    ├── Quotes           (priced proposals in this domain)
    ├── Projects         (in-flight work in this domain)
    ├── Images           (user-uploaded + Nex-generated per domain)
    ├── Measurements     (dimensional data per domain)
    └── Customers        (people connected to this domain's work)
```

## Domain-Specific Adaptation Rules

The 4 sections are MANDATORY. The names inside each section can adapt per domain:

- **Staircase** → Section 2 = Designer + Engineer + Quoter + Installer (staircase-specific)
- **Kitchen** → Section 2 = Designer + Engineer + Quoter + Installer (kitchen-specific)
- **Marketing** → Section 2 = Strategist + Creator + Scheduler + Analyst (marketing-specific quartet)
- **Finance** → Section 2 = Accountant + Advisor + Analyst + Executor (finance-specific quartet)
- **Health** → Section 2 = Coach + Planner + Tracker + Analyst (health-specific quartet)

The QUARTET rule holds. The names adapt. The Router logic reads Section 2 uniformly regardless of the quartet's names.

## The Domain File Structure (mandatory)

Every domain lives at `data/nex-domains/{domain-slug}/` with this directory tree:

```
data/nex-domains/staircase/
├── domain.yaml                    (mandatory declaration file · see schema below)
├── faqs/
│   └── faqs.json                  (or JSONL for large corpora)
├── components/
│   ├── panel_system.yaml
│   ├── panel_backing.yaml
│   └── ... (one file per component family)
├── articles/                       (brain docs · one file per topic)
├── calculators/                    (parametric TS + YAML pairs)
├── standards/                      (regulations + compliance references)
├── manufacturers.json              (business directory scoped to this domain)
├── router-tags.yaml                (5 universal verbs mapped to sub-intents)
├── ai-specialists.yaml             (4 specialists with capability declarations)
└── workspace-schema.yaml           (5 Workspace object types + fields)
```

Domain 001 (Staircase) will be refactored INTO this structure as part of Phase B.5 (Knowledge Layer Separation).

## The domain.yaml Schema (mandatory declaration file)

```yaml
domain_id: staircase
domain_number: 001
domain_name: Staircase
domain_category: home_and_property
authored_by: philip
authored_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: pass · origin_type = named_expert · expert = Philip O'Farrell

status:
  knowledge_completion_percent: 90
  faq_count: 1980
  image_count: 816
  image_a_plus_count: 26
  component_family_count: 5
  article_count: 30
  calculator_count: 0
  regulation_count: 0

router_tags:
  - Design
  - Build
  - Repair
  - Compare
  - Learn

ai_specialists:
  - id: staircase_designer
    role: Designer
    capabilities: [design, image_matching, style_recommendation]
  - id: staircase_engineer
    role: Engineer
    capabilities: [calculation, regulation_check, structural_advice]
  - id: staircase_quoter
    role: Quoter
    capabilities: [pricing, quote_generation, variant_pricing]
  - id: staircase_installer
    role: Installer
    capabilities: [install_guidance, tool_recommendation, escalation_check]

workspace_objects:
  - type: quote
    fields: [customer_id, floor_to_floor_mm, style, materials, price_total, valid_until]
  - type: project
    fields: [customer_id, status, quote_id, install_date, photos, notes]
  - type: image
    fields: [url, staircase_kind, staircase_context, tags, source]
  - type: measurement
    fields: [project_id, floor_to_floor_mm, opening_length_mm, opening_width_mm, headroom_mm]
  - type: customer
    fields: [name, contact, project_ids, relationship_notes]

cross_domain_dependencies:
  - timber (materials + species knowledge)
  - lighting (concealed LED integration)
  - joinery (manufacturing + fitting knowledge)
  - regulations (Approved Doc K + safety standards)
  - interior_design (style compatibility)
```

## Enforcement (Router-Level)

The Router refuses to route to an incomplete domain. A domain is INCOMPLETE if:

- `domain.yaml` missing
- Any of the 4 mandatory sections missing
- `faq_count < 20`
- `image_a_plus_count < 5`
- Any AI Specialist missing capability declaration
- Any Router Tag not mapped to a universal verb

Composes with ADR-0033 (Quality Over Quantity · save refused on <70% score).

## Maturity Levels (Bronze · Silver · Gold) — Philip 2026-08-03 evening refinement

Philip: *"Distinguish between minimum entry criteria (required before a domain exists) and maturity levels. That allows an emerging domain to exist without implying it has reached full coverage."*

A domain's `maturity_level` field in `knowledge.yaml` declares one of:

### 🥉 Bronze — Minimum Viable Domain

**Router-eligible · flagged in UI as "early".**

Requirements:
- `domain.yaml` complete
- ≥20 authored FAQs (Rule c compliant)
- ≥5 A+ reference images with `subject_domain: {slug}`
- ≥1 AI Specialist declared with capability schema
- ≥3 Router Tags mapped to universal verbs
- ≥3 Workspace Object types declared
- ≥3 articles in `articles/`

Bronze domains route successfully but Nex flags responses with an *"early-stage domain — accuracy improves as we author more"* soft caveat.

### 🥈 Silver — Full Template Completion

**Router-eligible · no caveat · production-ready.**

Requirements (adds to Bronze):
- ≥100 authored FAQs
- ≥15 A+ reference images
- All 4 AI Specialists declared (Designer · Engineer · Quoter · Installer or domain equivalent)
- All 5 Router Tags mapped
- All 5 Workspace Object types with full field schemas
- ≥10 articles
- ≥1 calculator (if numeric outputs make sense for the domain)
- ≥1 regulation/standard reference (if regulatory scope applies)
- `cross_domain_dependencies` declared

Silver is the default production tier. Staircase Domain 001 sits between Silver and Gold.

### 🥇 Gold — Deep Domain with Cross-Domain Integration

**Router-eligible · surfaces as flagship domain · featured in Nex marketing.**

Requirements (adds to Silver):
- ≥500 authored FAQs
- ≥50 A+ reference images with rich descriptions
- All AI Specialists have production tool integrations (not just declarations)
- Router Tags refined with domain-specific sub-intents
- Workspace Objects fully queryable + reportable
- ≥25 articles across all major sub-topics
- ≥3 calculators
- Comprehensive regulations coverage
- ≥5 case studies (real-world completed projects)
- Cross-domain compositions ACTIVE (not just declared) — the Staircase→Timber consultation actually fires
- Learning Loops producing measurable improvements (Refinement #7)

Gold is the tier that competitors cannot match — a Gold domain represents years of Philip authoring + Claude drafting + user telemetry compounding.

### Current Domain Maturity (2026-08-03)

| Domain | Level | FAQs | A+ Images | Articles | Notes |
|---|---|---|---|---|---|
| Staircase | Silver+ (approaching Gold) | 1980 | 26 | 30 | Missing calculators + case studies for Gold |
| All other domains | Not yet Bronze | 0 | 0 | 0 | Awaiting authoring |

### Router Behaviour by Maturity

- **Bronze:** route succeeds, soft caveat appended to response.
- **Silver:** route succeeds, no caveat, standard behaviour.
- **Gold:** route succeeds, surfaces as flagship, may include cross-domain enrichment automatically.
- **Below Bronze (i.e. `domain.yaml` missing or entry criteria unmet):** route refuses, Router asks user to try a related domain OR flags for Philip authoring priority queue.

### Promotion Protocol

Bronze → Silver → Gold promotions require:
1. Automated audit against the maturity requirements above (script runs against `knowledge.yaml` + `data/nex-knowledge/{slug}/` files).
2. Philip review + explicit approval (`maturity_level` field is Philip-signed, not auto-set).
3. Router regeneration to pick up the new tier.
4. Health Dashboard update.

Composes with ADR-0033 (Quality Over Quantity) — maturity levels enforce quality gates without blocking new domains from EXISTING.

## Inheritance (v1.1 refinement · Philip 2026-08-03 evening)

Philip: *"A kitchen fitter, staircase maker, fitted furniture company, window installer, flooring contractor and bespoke joiner all follow broadly the same business process. Author a Trade Business Brain before expanding Kitchens."*

Every domain's `knowledge.yaml` may declare `inherits_from` pointing at shared brains:

```yaml
inherits_from:
  - _shared/trade-business       # every install trade inherits business process
  - _shared/timber-species       # every timber-adjacent trade
  - _shared/regulations          # cross-cutting regulatory reference
```

### The Retrieval Contract with Inheritance

When a Brain calls `retrieve({ domain: "kitchen", query })`, the runtime:

1. Loads Kitchen's own knowledge from `data/nex-knowledge/kitchen/`.
2. Loads each `inherits_from` shared brain's knowledge in order.
3. Ranks results across all sources by relevance.
4. Returns unified result set with `source` field distinguishing domain vs shared.

### The Override Rule

A domain can OVERRIDE a shared article if its process differs meaningfully:

- Shared: `_shared/trade-business/articles/site-visit-process.md` (general trade site visit).
- Override: `data/nex-knowledge/staircase/articles/site-visit-process.md` (staircase-specific, adds floor-to-floor + headroom + light angle).

Override files declare `overrides: _shared/trade-business/articles/site-visit-process.md` in their frontmatter. The domain-specific article takes precedence in retrieval; the shared article surfaces as a "further reading" reference.

### What Belongs in a Shared Brain

Rule of thumb: if a process/knowledge applies **broadly across 3+ domains**, it belongs in `_shared/`. Trade-specific processes stay in the domain.

## Contract Versioning (v1.1 refinement · Philip 2026-08-03 evening)

Philip watchpoint #4: *"Your domain template, capability schema, and API responses are becoming foundational. Treat them as versioned interfaces so future changes don't inadvertently break existing domains."*

### Mandatory Version Fields

Every domain's `knowledge.yaml` declares:

```yaml
knowledge_version: 1.0                    # this domain's own knowledge version
schema_version: domain_template_v1.1      # which Domain Template revision this conforms to
```

### The Version Compatibility Table

| Domain Template Version | knowledge.yaml required fields | Retrieval API version |
|---|---|---|
| v1.0 (2026-08-03 morning) | domain_id · sources · router_tags · ai_specialists · workspace_objects | retrieve_v1 |
| v1.1 (2026-08-03 evening) | + maturity_level · inherits_from (optional) · schema_version · cross_domain_dependencies | retrieve_v1 (compatible) |

### The Non-Breaking Change Rule

Any change to the Domain Template that would require existing domains to modify their `knowledge.yaml` is a BREAKING change and bumps the major version (v1 → v2). Additive changes bump the minor version. The retrieval library maintains backward compatibility with the previous major version.

### The Capability Schema Version

Every AI Specialist declaration includes a `schema_version` field:

```yaml
ai_specialists:
  - id: kitchen_designer
    role: Designer
    capabilities: [design, image_matching, style_recommendation, layout_planning]
    schema_version: capability_v1.0
```

Changes to what a capability declaration must contain bump `capability_v1.0` → `capability_v1.1`. Existing specialists remain valid at their declared version.

### The Retrieval API Version

The `retrieve()` return type includes an implicit version. When the return shape changes:

- Additive fields: no version bump (safe to add).
- Renamed/removed fields: bump `retrieve_v1` → `retrieve_v2`, existing callers continue to use v1 until upgraded.

This protects the 170 planned domains from being disrupted by future refinements.

## The Onboarding Sequence (for authoring a new domain)

Every new domain follows this authoring order:

1. Create `data/nex-domains/{slug}/domain.yaml` with Philip-authored declaration.
2. Author minimum 20 FAQs in `faqs/faqs.json`.
3. Add minimum 5 A+ reference images to `data/nex-image-manifest.json` with `subject_domain: {slug}`.
4. Declare AI Specialists in `ai-specialists.yaml`.
5. Declare Router Tags in `router-tags.yaml`.
6. Declare Workspace Objects in `workspace-schema.yaml`.
7. Author at least 3 brain doc articles in `articles/`.
8. Register domain in `nex-global-knowledge-domains-catalog-philip-2026-08-03.md` (update status % + brain doc path).
9. Deploy Router regeneration (pulls in the new domain).
10. Announce in the Nex Health Dashboard.

## Cross-Domain Composition Rules

Domains can DECLARE dependencies on other domains via `cross_domain_dependencies` in `domain.yaml`. When the Router routes to Domain A, it can also consult Domains B/C/D that A depends on — WITHOUT letting knowledge from A leak into B's Brain.

Example: A Staircase query pulls in Timber (materials) + Lighting (LED) + Joinery (manufacturing) knowledge. But the Timber Brain doesn't inherit Staircase FAQs — it stays a pure Timber Brain that Staircase (and Kitchen and Flooring) consult.

Composes with ADR-0033 rule #4 (Brains are ISOLATED · `oak-door.jpg` never enters STAIRCASE BRAIN).

## Success Metric

*Any new domain can be onboarded in ≤2 weeks of authoring effort, following exactly the same template, with zero Router or Brain-loader code changes required.*

## Enhancement Opportunity

The Domain Template is the reason Nex will scale to 100+ domains without architectural drift. Every competitor either has ONE monolithic model (ChatGPT · Claude · Gemini) or dozens of custom-built vertical products (Notion + Canva + Shopify + HubSpot + Salesforce all as separate apps). Nex is the first system where every domain plugs into the SAME architecture. Adding Kitchen is the same difficulty as Marketing is the same difficulty as Travel — they all use the template. That is untouchable scaling.
