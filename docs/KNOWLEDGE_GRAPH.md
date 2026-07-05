# Construction Knowledge Graph — Reference

> **The invariant every commit is tested against:**
> *"Does this increase the amount of reusable knowledge inside the platform? If yes, we're moving in the right direction."*

Version: 1.0.0 · Stage 1 architecture complete · Status: shipped

---

## 1. What the Graph is

A single-source-of-truth for construction industry knowledge that every downstream product generates from — websites, business modules, quote workflows, AI assistants, customer portals, calculators.

Not a template library. Not an app store. A knowledge layer that turns *what merchants actually do* into a queryable graph, then generates the presentation surfaces on top.

### 1.1 The layers

```
Construction Knowledge Graph
        │
        ├── Knowledge Domains          horizontal capabilities every
        │                              construction business needs
        │                              (Estimating, Quoting, CRM,
        │                              Compliance, and 19 to backfill)
        │
        ├── Knowledge Packages         per-trade bundles that inherit
        │                              + extend Domains with trade
        │                              specifics (5 shipped, hundreds
        │                              addable)
        │
        ├── Business Module Registry   real implementations that
        │                              satisfy Domain capabilities
        │                              (29 modules, 7 shipped)
        │
        ├── Recommendation Engine      trade → Package → capabilities →
        │                              modules ranked with reasons
        │
        ├── AI Retrieval Architecture  cited nodes from every layer,
        │                              LLM-ready
        │
        └── Adapters                   bridge existing blueprints,
                                       modules, industry-intelligence
                                       fields into the graph
```

### 1.2 Governance principles

Every architectural decision runs through five checks:

1. **Does this increase reusable knowledge?** If not, challenge the design.
2. **Is every fact cited?** Regulator URLs on compliance; internal file paths on platform facts. No bare claims.
3. **Does the runtime branch on trade or industry?** If yes, that's a code smell. Vertical-ness belongs in Packages, never in code paths.
4. **Are hallucinations survivable?** LLM output must be retrieval-constrained. Reject any output referencing a slug outside the registered corpora.
5. **Does existing knowledge survive migration?** Zero information lost when architecture evolves. Adapters preserve every pre-Graph fact.

### 1.3 What lives where

| Data | Storage |
|---|---|
| Domain definitions | `src/lib/knowledge/domains/*.ts` (manifest, one file per Domain) |
| Package definitions | `src/lib/knowledge/packages/*.ts` (manifest, one file per Package) |
| Business Modules | `src/lib/studio/modules/registry.ts` (single file, 29 modules) |
| Blueprints | `src/lib/studio/blueprints/manifests/*.ts` (51 files) |
| Merchant runtime | `studio_brands`, `studio_brand_credentials`, `studio_brand_outcomes`, `studio_layouts`, `hammerex_trade_off_listings` |

No new tables were added for the Graph itself. Every Package + Domain lives in code. This is deliberate — see §5.

---

## 2. Extension Strategy

### 2.1 Add a Domain

A Domain is added when a new horizontal capability needs a contract (e.g. Materials, Scheduling, Deliveries). Steps:

1. Add the id to `KnowledgeDomainId` union in `src/lib/knowledge/types.ts`.
2. Create `src/lib/knowledge/domains/<id>.ts` following the reference pattern.
3. Every entity contract, capability, AI hook, integration, and compliance element populated with real evidence.
4. Every compliance element carries a public `source:` URL.
5. `version: "1.0.0"` on first ship. Never leave placeholder version strings.
6. Import in the barrel: `src/lib/knowledge/index.ts` under the Slice 1.1b section.
7. `neighbours(id)` walk-graph works because `relatedDomains` on existing Domains may already reference the new id — no other edit needed.

Registry validates on `register()`:
- Semver format
- No duplicate id

### 2.2 Add a Package

A Package is added for a new trade family. Steps:

1. Create `src/lib/knowledge/packages/<slug>.ts` (kebab-case slug).
2. Declare `usesDomains: KnowledgeDomainId[]` — every referenced Domain must already exist.
3. `extensions[]` — trade-specific overlays. Only extend Domains the Package uses. Every `EntityExtension.entityId` and every `CapabilityImplementation.capabilityId` is validated against the target Domain — the registry throws on unknown references.
4. Populate `services`, `customerTypes`, `workflow`, `commonFaqs` from cited evidence (Appendix D of the Blueprint Studio PRD is the reference source).
5. `recommendedModules` — every id must exist in `BUSINESS_MODULES`.
6. `industryIntelligence` — facts only, no fabricated stats. Cite the source in a comment above the array where relevant.
7. Import in the barrel under Slice 1.7's block.

The registry's runtime validation catches:
- Duplicate id
- Invalid semver
- Empty `trades` or `usesDomains`
- Unknown Domain in `usesDomains`
- Extension targeting a Domain not in `usesDomains`
- Extension referencing an unknown entity or capability

### 2.3 Add a Business Module

Modules are the implementable capabilities that satisfy pieces of Domain contracts.

1. Add the entry to `BUSINESS_MODULES` in `src/lib/studio/modules/registry.ts`.
2. State honestly: `shipped` / `available-addon` / `partner` / `coming-soon`. Never inflate.
3. `poweredByDomain: KnowledgeDomainId[]` — Domains this Module implements pieces of.
4. `implementsCapability: string[]` — dotted refs (`<domainId>.<capabilityId>`). Every ref must exist in the target Domain.
5. `expectedByTrades: string[]` — trade slugs where this Module is table stakes.
6. `route: string | null` — Studio route for `shipped` / `available-addon`; `null` for `partner` / `coming-soon`.

The coverage report (`moduleCoverageByDomain()`) surfaces which Domain capabilities have no Module implementation yet — the roadmap for capability delivery.

### 2.4 Rules that never change

- **Runtime never branches on trade slug or Domain id.** Any code that does is a bug.
- **Every LLM output is retrieval-constrained.** Slugs must be validated against the live registries. Any unknown slug is dropped silently before the user sees the response.
- **Manifests are deep-frozen on register.** Nothing mutates a Domain or Package at runtime.
- **The barrel loader is the only side-effect that populates registries.** Never register manually inside consumer code.

---

## 3. Versioning Strategy

Every Domain and every Package carries a semver `version: "MAJOR.MINOR.PATCH"`.

### 3.1 What triggers each bump

| Change | Bump |
|---|---|
| New entity, capability, AI hook, integration, or compliance element (additive only) | MINOR |
| Renaming an entity or capability id | MAJOR |
| Removing an entity, capability, hook, integration, or compliance element | MAJOR |
| Semantic change to a capability's meaning (behaviour, not name) | MAJOR |
| Correcting a compliance source URL or regulator | PATCH |
| Adding a new `industryIntelligence` bullet or `commonFaqs` entry | PATCH |
| Editing tagline / description / notes text | PATCH |
| Bumping a referenced Domain to a MAJOR — Package must republish at MAJOR too | MAJOR |

Package's `version` is independent of the Domains it uses, except when a used Domain goes MAJOR (see the last row) — the Package's contract with the Domain changed.

### 3.2 Compatibility

Downstream consumers (Recommendation Engine, AI Brain, Studio) read Domains + Packages through the registry. They accept any version — the registry hands out the current one. There is no runtime version-matching yet because:

- Every consumer is in the same monorepo as the registries.
- Deployment is atomic (all or none).
- Third-party contributors don't exist yet (Stage 6+).

When third-party contributors land (§4), version matching becomes real:

- Package manifests will declare `usesDomains: [{ id: "estimating", version: "^2.0.0" }]`.
- Registry will refuse to register a Package that requires a MAJOR the currently-installed Domain doesn't ship.

Until then, `usesDomains: KnowledgeDomainId[]` stays a flat list.

### 3.3 Deprecation flow

When a capability or entity needs to go away:

1. Bump the Domain to a new MAJOR with the removal.
2. Old MAJOR stays available in a `domains/legacy/` folder for 90 days.
3. Every Package using the removed capability is updated to point at the replacement (or an alternative) within the window.
4. After 90 days, legacy MAJOR is deleted.

Never edit a shipped Domain file in place to remove a field. Always ship a new MAJOR.

### 3.4 What's frozen forever

Some ids are permanent contracts. Once shipped, they never change:

- Domain ids (`estimating`, `quoting`, `compliance`, `crm`, and any future addition once shipped)
- The compliance element ids on any released Domain (they'd be cited externally)
- Package ids (once a trade is on the platform, its Package id persists)

These form the platform's stable knowledge coordinates. Everything else can move.

---

## 4. Future Marketplace Strategy

Deferred to **Stage 6**. Design intent documented here so decisions we make now don't paint us into a corner.

### 4.1 What third parties will contribute

Three artefact types:

- **Domain extensions** — a new industry-specific compliance library, a new integration adapter (e.g. HubSpot connector for the CRM Domain).
- **New Packages** — a specialist trade sub-package (e.g. "Marine Roofing" as a specialist of Roofer).
- **Business Modules** — new implementations of existing capabilities (e.g. an alternative quote-pipeline module).

Domains themselves stay first-party for the platform's lifetime — the horizontal contracts are the moat.

### 4.2 Review + approval

Three-step process:

1. **Automated validation** — every submission runs against the same registry validation the first-party artefacts do. Rejection on any unknown slug, missing citation, or semver violation.
2. **Content review** — human review for factual accuracy, ASA compliance, evidence-backed claims. First-party facts require URLs; contributor facts require URLs OR "internal to <contributor>" with a stated evidence source.
3. **Publisher verification** — contributor is a UK-registered business with a Companies House number that auto-verifies through our existing scheme verifier.

### 4.3 Storage + delivery

Contributor artefacts land in a separate schema:

- `marketplace_domain_extensions`
- `marketplace_packages`
- `marketplace_modules`

Each row is a manifest (same schema as first-party files but persisted in DB). Merchants install by triggering a copy into their own scope — the platform runtime treats them identically to first-party manifests after install.

### 4.4 Revenue model (indicative)

Aligned with existing platform pricing:

- Free contributions (open-source patterns) → contributor gets attribution + platform points.
- Paid modules → 70/30 split (contributor / platform), matching Framer's marketplace convention.
- Paid Packages → same split, but Packages must be non-exclusive (any merchant of the trade can install any of several Packages).

### 4.5 What must NOT happen at marketplace launch

- Contributor modules never patch first-party module manifests.
- Contributor Packages never override first-party Domain contracts.
- Contributor content never appears in AI retrieval without the citation being to the CONTRIBUTOR, not to the platform. Full attribution isolation.

These invariants keep the moat intact even as the ecosystem opens.

---

## 5. Why the Graph lives in code, not a database

Deliberate. Trade-offs:

| Approach | Pros | Cons |
|---|---|---|
| **Code (chosen)** | Type-safe. PR-reviewable. Immutable in a build. Deep-freeze free. No runtime DB read. AI Brain can walk the whole graph in memory. | Requires a deploy to update. |
| Database | Runtime editable | Every consumer needs a fetch. Freeze-on-register impossible. Any bug in write path corrupts the graph. Third-party writes become a security surface. |

At Stage 1 with 5 Packages + 4 Domains, deploys are trivial and code is safer. When we hit Stage 6 (marketplace), contributor artefacts live in a DB — but first-party stays in code forever. Two-tier storage is the correct final shape.

---

## 6. Glossary

- **Domain** — a horizontal capability contract every construction business needs some form of. Owns entities, capabilities, AI hooks, integrations, compliance.
- **Package** — a trade-specific bundle that inherits Domains and extends them with trade knowledge. Also carries services, customer types, workflow, FAQs, recommended modules, industry intelligence.
- **Extension** — the trade-specific overlay a Package applies to a Domain it uses.
- **Capability** — a discrete unit of work a Domain enables (e.g. `material-calculator`, `quote-send`, `scheme-verifier`). Modules implement these.
- **Business Module** — an implementable capability that satisfies part of a Domain. Declares `poweredByDomain` + `implementsCapability`.
- **Resolved Package** — the flat view a consumer sees after Domain × Package inheritance is walked. Consumers read this, never the raw manifests.
- **Retrieval Node** — a cited unit of knowledge returned by the retriever. Carries `layer`, `type`, `title`, `content`, `citation`.
- **Layer** — which tier of the Graph a node comes from: `merchant` / `package` / `domain` / `global`.

---

## 7. Reference paths

| File | Purpose |
|---|---|
| `src/lib/knowledge/types.ts` | Domain types |
| `src/lib/knowledge/registry.ts` | Domain registry singleton |
| `src/lib/knowledge/domains/*.ts` | Domain manifests |
| `src/lib/knowledge/packageTypes.ts` | Package types |
| `src/lib/knowledge/packageRegistry.ts` | Package registry + `resolve()` |
| `src/lib/knowledge/packages/*.ts` | Package manifests |
| `src/lib/knowledge/recommender.ts` | Recommendation Engine |
| `src/lib/knowledge/retriever.ts` | AI Retrieval Architecture |
| `src/lib/knowledge/retrievalTypes.ts` | Retrieval node types |
| `src/lib/knowledge/adapters.ts` | Bridge to blueprints + modules + Growth Coach |
| `src/lib/knowledge/index.ts` | Barrel loader — the single import site |
| `src/lib/studio/modules/registry.ts` | Business Module inventory with capability links |
| `src/lib/studio/blueprints/manifests/*.ts` | 51 blueprints (some now carry Package-linked intelligence) |

---

## 8. Stage 1 completion + what's next

**Shipped in Stage 1:**

- S1.1 — Domain schema + registry + 4 reference Domains
- S1.2 — Package schema + inheritance mechanic + Plant Hire reference
- S1.3 — Business Modules v2 with capability links + 3 query helpers
- S1.4 — Recommendation Engine v2 with explained reasons
- S1.5 — AI Retrieval Architecture with citation
- S1.6 — Migration adapters bridging existing blueprints + modules
- S1.7 — 4 more reference Packages (Builders Merchant, Roofer, Electrician, Gas Engineer)
- S1.8 — This document

**Not yet done (deliberately deferred):**

- **S1.1b** — 19 remaining Domains (Materials, Labour, Marketing, SEO, Projects, Deliveries, Scheduling, Finance, Staff, Inventory, Health-Safety, Customers, Assets, Vehicles, Recruitment, Reviews, Reporting, Analytics, Automation). Content backfill, no architectural change. Ship 3-4 per iteration when the evidence base is solid.
- **Growth Coach migration** — currently uses hardcoded `MANDATORY_BY_TRADE`. Adapter `packagesRequiringScheme()` is in place; Growth Coach can migrate to it in a follow-up slice.
- **AI Brain LLM task** — `industry.answer` / `industry.suggest` task kinds in the Anthropic gateway that use the Retrieval Architecture as their system prompt payload.
- **Stage 6 marketplace** — as described in §4.

**The invariant that shipped everything:**

> *"Does this increase the amount of reusable knowledge inside the platform? If yes, we're moving in the right direction."*
