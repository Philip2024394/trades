# ADR-0021: Intelligence Domain Separation · No Universal Knowledge Pool · Retrieval Scoped to Domain

Status: Draft (awaiting signoff)
Date: 2026-07-23
Related: ADR-0017 (Trade Brain Contract) · ADR-0016 (Memory Privacy) · ES-01 §4 (Modular monolith) · ES-02 §5 (Memory model) · ES-02 §8 (Media architecture) · Phase 24 mesh (shipped)

## Context

As Nex intelligence grows (40+ Trade Brains authored over years · Memory rollups compounding · Business Brains formalising · new modules pending), the temptation to build a "universal search over all construction knowledge" grows with it. That approach appears simpler to engineers ("one index rules all") but is catastrophic to AI quality:

- Retrieval returns unrelated content (an electrician asking about consumer units gets plumbing pipework mixed in)
- LLM context gets bloated with irrelevant tokens (higher cost per query)
- Confidence calibration collapses (system can't distinguish domain expertise from adjacent content)
- Hallucination risk increases (LLM synthesises across domains it shouldn't)
- Specialist authorship value dilutes (Author-authored Brain content becomes indistinguishable from generated aggregate)
- Latency degrades (searching millions of unrelated records for every query)

Phase 24 mesh + ADR-0017 already establish domain separation at the file and schema level for Trade Brains. Memory V1 (per ADR-0016) already has per-layer separation. Phase 26 memory categories already scope per merchant/company/project/trade/region.

**But the principle isn't codified as a first-class enforcement rule.** Without an ADR, the next engineer under deadline pressure could reasonably build a "unified knowledge search" that violates the principle, and each such violation compounds architectural drift.

This ADR codifies domain separation as a platform-wide constraint that all future intelligence work must respect.

## Decision

**Nex intelligence is organised into separated domains. Cross-domain retrieval requires explicit authorisation. No universal mixed knowledge pool exists at any level of the platform.**

### 1 · The five domain categories

Every intelligence artifact belongs to exactly one primary domain:

| Category | Domains | Owner |
|----------|---------|-------|
| **Trade Brains** | Staircase · Electrical · Plumbing · Roofing · Carpentry · Landscaping · Bricklaying · Plastering · Tiling · Painting · Heating · Solar · Kitchen Install · Bathroom Install · etc. | Named Trade Brain Author per ADR-0017 |
| **Business Brains** | Estimator · Bookkeeper · Marketing · Operations · Sales · Compliance | Product Lead per module |
| **Memory Layers** | User · Company · Project · Trade · Region · Industry · Market | Merchant · Per Phase 26 blueprint + ADR-0016 |
| **Regulatory Knowledge** | Country-specific regulations · certifications · standards | Country compliance owner |
| **Product Knowledge** | Trade Centre catalog · Marketplace listings · Manufacturer feeds | Marketplace ops |

Domain boundaries are hard. An artifact cannot belong to two primary domains. Cross-references between domains use explicit typed edges (per Knowledge Graph pattern in `bos/graph.ts`), never duplicated content.

### 2 · Five-level separation enforced per domain

Every domain must have all five separations:

| Level | Trade Brain example |
|-------|---------------------|
| **1 · Namespace** | `src/lib/nex/brains/staircase/` module path |
| **2 · Schema** | Dedicated tables scoped by `brain_slug` OR content-JSON-per-module pattern from ADR-0017 |
| **3 · Storage** | Dedicated Supabase Storage prefix `/trade-brains/staircase/{images,drawings,regulations,examples}` |
| **4 · Retrieval** | Queries include `brain_slug = <slug>` filter · retrieval fn refuses cross-Brain reads without explicit override |
| **5 · Ownership** | Named human Author per ADR-0017 · edit permissions scoped to Author for their Brain only |

Missing any level = domain separation broken.

### 3 · Routing pattern (mandatory for AI retrieval)

Every AI query follows this pipeline:

```
User query
   ↓
Intent classification (existing Phase 1 intent.ts + Phase 24 mesh planner)
   ↓
Domain selection (single primary domain or explicit multi-domain compound)
   ↓
Domain-scoped retrieval (retrieves ONLY within selected domain(s))
   ↓
Composed response (Nex voice unifier · confidence tagged per domain)
```

The domain selection step is auditable. Every LLM call log records which domain(s) contributed context. Cross-domain calls without justification are logged as anomalies.

### 4 · Cross-domain queries · default deny · explicit exceptions

Legitimate cross-domain queries exist. Two examples:
- **Multi-trade estimate**: kitchen refit consulting Carpenter + Electrician + Plumber + Tiler Brains → each contributes scoped output, mesh composes
- **Compound ask**: "loft conversion in Dublin" hits Planning + Structural + Fire Safety + Estimator per Phase 24 mesh planner

These are **explicit multi-domain compounds** where each involved domain is named upfront. They are NOT "search across all knowledge for anything relevant."

Default deny at the retrieval layer:
- Every retrieval function requires explicit `domains: string[]` parameter
- No wildcard "search everything" fallback
- Compound queries pass an array (`['carpentry', 'electrical', 'plumbing']`), never `['*']`
- Runtime rejects `['*']` or unbounded queries

### 5 · Supabase Storage bucket architecture

Formal structure per domain category:

```
/trade-brains/
   /staircase/
      /images/
      /drawings/
      /regulations/
      /examples/
      /training/         (Author-uploaded reference materials, not merchant content)
   /electrical/
      /images/
      /regulations/
      /certificates/
      /guides/
   /plumbing/
      /images/
      /guides/
   ... (per Brain)

/business-brains/
   /estimator/
      /calibration-samples/
   /bookkeeper/
      /receipt-templates/
   ... (per Brain)

/memory/
   (merchant-scoped · not domain-scoped · governed by Phase 26 media rules)

/regulations/
   /uk/
      /approved-documents/
      /part-a/  /part-b/  /part-l/  /part-p/  ...
   /ie/
      /tgds/
   /au/
      /ncc/
   ... (per country)

/products/
   /trade-centre/
   /marketplace/
   /manufacturer-feeds/
```

Every asset URI includes domain prefix. RLS + application-layer access control scopes reads to authorised domains.

### 6 · PostgreSQL for metadata + relationships

Domain separation extends to database:

- Trade Brain content in Brain-scoped tables per ADR-0017
- Cross-Brain adjacency edges in Knowledge Graph tables per Phase 25 `bos/graph.ts`
- No shared "generic knowledge" table
- Every query specifies domain(s) in WHERE clause

### 7 · Consequences of the principle

**Performance:**
- Retrieval scoped to relevant domain · smaller working set · faster queries
- LLM context bounded · lower token cost · faster responses
- Cache hit rates higher (per-domain caches, not global)

**AI quality:**
- Fewer hallucinations (LLM sees only relevant expertise)
- Confidence better calibrated (per-domain signal quality tracked)
- Author authority preserved (Brain content stays attributed to its Author)

**Engineering discipline:**
- Feature drift prevented (no "let me just add cross-domain search")
- Ownership clear (each domain has an accountable owner)
- Retrieval logic testable (domain scope is a testable invariant)

**Enforcement:**
- CI test: every retrieval function called in tests specifies domains explicitly
- Runtime log: every LLM call records domain composition
- Weekly audit: cross-domain queries reviewed for legitimacy

## Consequences (Positive · Negative · Neutral)

**Positive:**
- Nex retains its "specialist expert brains" positioning · does not devolve into "chatbot with documents"
- LLM cost per query bounded predictably
- Author work valued and preserved · specialist expertise doesn't dilute
- Adding new Trade Brain is additive (new folder + new storage prefix) without disturbing existing Brains
- Storage costs scoped and attributable per domain
- Regulatory audit clearer (regulation content lives in `/regulations/` not scattered across Brains)

**Negative:**
- Legitimate compound queries require explicit multi-domain routing (small friction at API boundary)
- Cross-Brain analogical reasoning (Roofer knowledge informing Solar PV per Phase 27 §1.6) requires explicit adjacency edges · cannot rely on universal search
- Cannot ship "unified search" feature merchants might request · must explain per-domain routing
- Onboarding engineers must learn domain boundaries before contributing to retrieval code

**Neutral:**
- Existing Phase 24 mesh already routes to specialists · this ADR codifies the pattern rather than introducing it
- Existing ADR-0017 already establishes Brain per-file separation · this ADR extends to storage + retrieval + all future intelligence modules

## Alternatives Considered

- **Universal knowledge pool with tags/labels for domain** — rejected. Tags degrade over time as content author varies. Belt-and-braces enforcement at retrieval layer is impossible without physical separation.
- **Domain separation only at file level (like ADR-0017 today)** — rejected. Doesn't cover storage buckets, doesn't prevent database queries pulling across Brains, doesn't cover future non-Brain intelligence modules.
- **Semantic domain routing via embedding similarity** — rejected for V0. Embedding-based routing is probabilistic; hard partition + explicit routing is deterministic and auditable. Semantic routing considered at V3+ as enhancement, not replacement.
- **Global search with per-user permissions** — rejected. Permissions leak-proof retrievals is difficult at scale; hard separation is easier to audit and verify.
- **Codify the principle informally in ES-01 rather than a dedicated ADR** — rejected. This principle governs feature design across every future module; it needs first-class ADR status to survive future feature pressure.
- **Allow "*" wildcard for admin/debug queries only** — accepted as narrow exception. Admin diagnostic tools (per Validation Report C-17) may query across domains for support purposes. Every admin cross-domain query logged and reviewed weekly.

## Implementation Impact

**Immediate (Phase 0 Week 3-4):**
- Supabase Storage bucket structure created per §5
- Retrieval function signatures updated to require `domains: string[]` parameter
- CI check added: retrieval functions in tests must specify domains
- Trade Brain Author tooling storage architecture reflects §5

**Phase 1 (Week 5-10):**
- Memory V1 rollups scoped per domain (trade layer already scoped per ADR-0016 · this confirms)
- Trade Brain V0 authoring loads only within its Brain folder + `/regulations/<country>/` for cross-referenced regs
- Every LLM prompt template includes domain scope in system instruction

**Phase 2+ (Week 11+):**
- Estimator queries Trade Brains individually per Phase 28 blueprint composition pattern (already aligned)
- Workforce agents scoped to their department's domains per Phase 32 blueprint (already aligned)
- Business Builder V2 magic moment loads only the merchant's declared trade Brain (already aligned)

**Ongoing:**
- Every new intelligence module (specialists · industry packs · regulator packs) declares its primary domain in its manifest
- Weekly audit of cross-domain queries in production logs
- Any cross-domain retrieval PR requires justification in commit message

## Dependencies

- **Blocks:** any future "unified search" feature · any implicit cross-domain retrieval pattern
- **Blocked by:** none · this ADR can be signed off independently of ADR-0016 through ADR-0020
- **Related:** ADR-0017 (Trade Brain Contract · establishes per-Brain file separation) · ADR-0016 (Memory Privacy · establishes per-layer memory separation) · Phase 24 mesh (routing pattern already implements the principle) · Phase 25 `bos/graph.ts` (Knowledge Graph is the sanctioned cross-domain reference pattern)

## Enforcement

**Static:**
- ESLint rule (custom) blocks retrieval calls without explicit `domains` parameter
- CI test verifies every retrieval invocation in tests specifies domains
- Storage bucket write policy rejects writes without domain prefix in path

**Runtime:**
- Every LLM call logs `context_domains: string[]` field to audit log
- Retrieval functions log domain scope + result count
- Anomaly detection: single query touching >5 domains flagged for review

**Governance:**
- Weekly audit of cross-domain queries (Product + CTO review)
- Quarterly review: is any domain accumulating "misc" content that should be split?
- New domain proposal requires PR + review (adds a folder, storage prefix, and ownership assignment)

## Sign-off Required

- [ ] CTO
- [ ] Product Lead
- [ ] Trade Brain Program Lead (impacts every Brain author's storage + retrieval)
- [ ] Backend Lead (implements retrieval scope enforcement)

---

*This ADR codifies as a first-class rule what Phase 24 mesh and ADR-0017 already practice · and extends the discipline to every future intelligence module before drift begins.*
