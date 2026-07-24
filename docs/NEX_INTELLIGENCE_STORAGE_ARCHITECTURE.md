# Nex Intelligence Storage Architecture · v1.0

**Storage spec · 2026-07-23**
**Purpose:** the concrete Supabase Storage + PostgreSQL organisation that realises ADR-0021's Intelligence Domain Separation. Every Brain, every regulation set, every product catalog stored under domain-scoped structure.

**Related:** ADR-0021 (Intelligence Domain Separation) · ADR-0017 (Trade Brain Contract) · ADR-0016 (Memory Privacy) · ES-02 §8 (Media Architecture) · Trade Brain Author Tooling Spec.

---

## Section 1 · Storage Layer Split

Per ADR-0021 §5-6 and ES-02 §8:

| Storage type | Contents | Provider |
|--------------|----------|----------|
| **Binary assets** (images · drawings · PDFs · CAD · media) | Domain-scoped bucket prefixes | Supabase Storage |
| **Structured content + metadata** | Domain-scoped tables | Supabase PostgreSQL |
| **Vector embeddings** | Domain-scoped pgvector columns | pgvector (in PostgreSQL) |
| **Cache** | Domain-scoped keys | Upstash Redis |

## Section 2 · Supabase Storage Bucket Structure

Single bucket `hammerex-nex-media` with domain-prefixed paths (Supabase Storage doesn't have deep nested buckets, so paths carry the domain):

```
hammerex-nex-media/
│
├── trade-brains/
│   │
│   ├── staircase/                    (Staircase Brain assets)
│   │   ├── images/
│   │   ├── drawings/                 (Author-uploaded reference drawings)
│   │   ├── regulations/              (regulation excerpts cited by this Brain)
│   │   ├── examples/                 (Author-authored example projects)
│   │   └── training/                 (Author-uploaded reference materials for AI training · V3+)
│   │
│   ├── electrical/
│   │   ├── images/
│   │   ├── certificates/             (sample certificates for reference)
│   │   ├── regulations/
│   │   └── guides/
│   │
│   ├── plumbing/
│   │   ├── images/
│   │   ├── guides/
│   │   └── regulations/
│   │
│   ├── roofing/
│   ├── carpentry/
│   ├── bricklaying/
│   ├── plastering/
│   ├── tiling/
│   ├── painting/
│   ├── heating/
│   ├── solar/
│   ├── kitchen-install/
│   ├── bathroom-install/
│   └── ... (per Brain slug)
│
├── business-brains/
│   ├── estimator/
│   │   └── calibration-samples/
│   ├── bookkeeper/
│   │   └── receipt-templates/
│   ├── marketing/
│   │   └── content-templates/
│   ├── operations/
│   └── ... (per Business Brain)
│
├── regulations/                       (country-scoped regulatory content)
│   ├── uk/
│   │   ├── approved-documents/       (Part A · B · C · D · E · F · G · H · J · K · L · M · N · P · Q · R · S · T)
│   │   ├── bs-standards/
│   │   ├── nhbc/
│   │   └── labc/
│   ├── ie/
│   │   ├── tgds/                     (Technical Guidance Documents)
│   │   └── nsai/
│   ├── au/
│   │   ├── ncc/                      (National Construction Code)
│   │   └── as-standards/
│   ├── us/
│   │   ├── ibc/                      (International Building Code)
│   │   └── irc/                      (International Residential Code)
│   └── ... (per country ISO)
│
├── products/                          (product catalog + manufacturer content)
│   ├── trade-centre/
│   │   ├── product-images/
│   │   └── product-specs/
│   ├── marketplace/
│   │   └── listing-photos/
│   └── manufacturer-feeds/
│       ├── ibstock/
│       ├── wolseley/
│       └── ... (per manufacturer)
│
├── merchants/                         (per-merchant assets · owned by merchant)
│   └── <merchant-slug>/
│       ├── logos/
│       ├── brand-assets/
│       ├── portfolio/                 (real merchant portfolio photos)
│       ├── canteen-hero/
│       └── team-avatars/
│
├── projects/                          (per-project assets · scoped by merchant + project)
│   └── <merchant-slug>/
│       └── <project-id>/
│           ├── photos/                (SiteBook + Twin photos)
│           ├── videos/
│           ├── drawings/              (customer-provided plans · CAD)
│           ├── bim/                   (IFC files · V1+)
│           ├── documents/             (specs · contracts · variations)
│           └── certificates/          (completion certs · warranties)
│
├── customers/                         (per-customer assets · scoped by merchant + customer)
│   └── <merchant-slug>/
│       └── <customer-id>/
│           └── correspondence/        (email attachments · authorised uploads)
│
├── workforce/                         (AI employee assets)
│   └── avatars/                       (generated once + cached per employee identity)
│
├── reports/                           (generated PDFs · exportable content)
│   ├── handover-packs/                (per project handover)
│   ├── market-intelligence/           (Regional Market Reports · Y3+)
│   └── gdpr-exports/                  (data portability output · 7-day expiry)
│
└── admin/                             (internal · admin surface only)
    ├── audit-samples/
    └── incident-artifacts/
```

## Section 3 · Path Convention Rules

- Every path starts with a top-level domain segment (`trade-brains/` · `regulations/` · `merchants/` · etc.)
- Second segment is the domain instance (Brain slug · country ISO · merchant slug · etc.)
- Third segment is the asset kind (`images/` · `drawings/` · `regulations/` · etc.)
- Filename includes UUID + human-readable slug + extension
- No file may exist outside a domain-prefixed path (blocked at Storage policy layer)

Example: `trade-brains/staircase/images/2026-09-electrician-inspection-example-a7f3.jpg`

## Section 4 · Access Control (RLS + Storage Policies)

Per ADR-0016 tenant isolation + ADR-0021 domain separation:

### 4.1 Trade Brain assets

- **Read:** any authenticated merchant on Professional+ tier (Brain content is a platform feature)
- **Write:** Trade Brain Author for their own Brain slug (via Author tooling only, per ADR-0017)
- **Delete:** Trade Brain Program Lead only (rare · via admin console)

### 4.2 Regulations assets

- **Read:** any authenticated merchant (regulatory content is universally accessible)
- **Write:** Compliance team via versioned automation (regulator body publishes update → automated ingest)
- **Delete:** never · superseded versions retained

### 4.3 Product assets

- **Read:** any authenticated merchant + public (product images may be public for marketplace)
- **Write:** manufacturer partner via authenticated API + Trade Centre ops
- **Delete:** owning party via management console

### 4.4 Merchant assets

- **Read:** merchant team members + admin impersonation (audit-logged) + explicit share to customers
- **Write:** merchant team members with appropriate role
- **Delete:** merchant team members with appropriate role · soft-delete 30 days

### 4.5 Project assets

- **Read:** merchant team + assigned homeowner (with merchant-controlled visibility per event, per Phase 29 Twin)
- **Write:** merchant team members with project scope
- **Delete:** merchant team + soft-delete honouring 12-year construction contract retention (per ES-04 §12.1)

### 4.6 Customer assets

- **Read:** merchant team + customer themselves via secure link
- **Write:** merchant team + customer via authorised upload flow
- **Delete:** GDPR RTBF cascade per ADR-0016 + ES-04 §8.3

### 4.7 Workforce + Reports + Admin

- Scoped per module ownership rules

## Section 5 · PostgreSQL Table Organisation

Every table declares its primary domain via naming + scope column:

### 5.1 Trade Brain content tables

Per ADR-0017:

```sql
hammerex_nex_brain_content (
  id UUID PRIMARY KEY,
  brain_slug TEXT NOT NULL,          -- domain identifier
  module TEXT NOT NULL,               -- 'craft' | 'regulations' | 'materials' | ...
  ...
);

CREATE INDEX idx_brain_content_scoped ON hammerex_nex_brain_content (brain_slug, module);
```

### 5.2 Business Brain tables

```sql
hammerex_nex_business_brain_content (
  id UUID PRIMARY KEY,
  brain_slug TEXT NOT NULL,          -- 'estimator' | 'bookkeeper' | ...
  ...
);
```

### 5.3 Regulations tables

```sql
hammerex_nex_regulations (
  id UUID PRIMARY KEY,
  country_iso TEXT NOT NULL,
  regulation_id TEXT NOT NULL,       -- 'uk-part-l-2021'
  ...
);

CREATE INDEX idx_regulations_scoped ON hammerex_nex_regulations (country_iso, regulation_id);
```

### 5.4 Domain adjacency edges (for legitimate cross-Brain analogical reasoning)

Per Phase 25 `bos/graph.ts` extended by Phase 27:

```sql
hammerex_nex_graph_edges (
  from_domain TEXT NOT NULL,
  from_node_id UUID NOT NULL,
  to_domain TEXT NOT NULL,
  to_node_id UUID NOT NULL,
  edge_kind TEXT NOT NULL,           -- 'adjacent_to' | 'informed_by' | ...
  weight NUMERIC,
  confidence TEXT
);
```

Edges are the sanctioned mechanism for cross-domain reference. Direct cross-domain content copying is forbidden.

## Section 6 · Vector Embeddings (pgvector)

Per ADR-0021 §4 · embeddings scoped per domain:

- Trade Brain content: embedding column on `hammerex_nex_brain_content.embedding`
- Regulations: embedding column on `hammerex_nex_regulations.embedding`
- Product knowledge: embedding column on `hammerex_nex_products.embedding`
- Documents: embedding column on `hammerex_nex_documents.embedding`

Every semantic search specifies which embedding table to query. No universal vector index across domains.

## Section 7 · Cache Keys (Redis)

Domain-scoped Redis keys per ES-06 §14:

```
brain:<slug>:module:<name>:<version>    → cached Brain module content
brain:<slug>:facts:<subject>            → cached fact retrieval
regulations:<country>:<part>:<version>  → cached regulation content
memory:<merchant>:<subject>             → cached memory row
memory:rollup:<region>:<subject>        → cached regional rollup
```

Domain prefix always present. Cache invalidation scoped per domain.

## Section 8 · Retrieval API Contracts

Per ADR-0021 §4 default-deny:

### 8.1 Trade Brain retrieval

```typescript
async function retrieveFromBrain(input: {
  brain_slug: string;                 // REQUIRED · exactly one Brain
  query: string;
  module?: 'craft' | 'regulations' | 'materials' | 'workflow' | 'defects' | 'pricing_model';
  region?: string;
  limit?: number;
}): Promise<BrainRetrievalResult>;
```

### 8.2 Multi-Brain compound retrieval

```typescript
async function retrieveFromBrains(input: {
  brain_slugs: string[];              // REQUIRED · explicit list · no wildcards
  query: string;
  ...
}): Promise<MultiBrainRetrievalResult>;
```

### 8.3 Regulation retrieval

```typescript
async function retrieveRegulation(input: {
  country_iso: string;                // REQUIRED
  regulation_ids?: string[];
  query: string;
  ...
}): Promise<RegulationResult>;
```

### 8.4 What's forbidden

- No `retrieveFromAll(query)` global search API exists
- No `retrieveFromEverything(query)` function
- No implicit fallback to cross-domain search when scoped search returns empty

Empty results are honest (`{ status: 'not_found', suggested_domains: [...] }`), never silently expanded.

## Section 9 · CI Enforcement

Per ADR-0021 §Enforcement:

### 9.1 ESLint rule (custom)

- Blocks retrieval function calls without explicit domain parameter
- Blocks queries with `domains: ['*']` or unbounded scope
- Blocks storage writes to paths without domain prefix

### 9.2 CI tests

- Every test invoking retrieval must specify domain scope
- Every new Brain PR must include storage bucket structure setup
- Every new regulation ingest must specify country_iso

### 9.3 Weekly audit

- Cross-domain queries in production logs reviewed
- Anomaly threshold: >5 domains per query flagged
- Justification required for any query touching >2 domains

## Section 10 · Migration Path

For existing V0 substrate that predates ADR-0021:

### 10.1 Currently-shipped Phase 4 knowledge_entries table

- `hammerex_nex_knowledge_entries` (currently shipped · used by Phase 4)
- Add `domain` column · backfill from existing `trade` column
- Migrate content to domain-scoped tables during Phase 1 substrate work
- Retain knowledge_entries table for backwards compatibility · deprecate in V2

### 10.2 Storage bucket migration

- New assets written to domain-prefixed paths from Week 3
- Legacy assets migrated to new paths in Phase 1 Week 5-6 (one-off cron)
- Symlink or rewrite rule for existing URLs during transition

### 10.3 Search endpoints

- Existing global search endpoints deprecated · replaced with domain-scoped equivalents
- Deprecation notice returned in response headers 90 days before removal

## Section 11 · Dependencies

- **Blocks:** any implementation of unified search feature · any implicit cross-domain retrieval
- **Blocked by:** ADR-0021 acceptance · Trade Brain Author input on Brain-specific asset kinds
- **Related:** ADR-0016 · ADR-0017 · ADR-0021 · ES-02 · ES-04 · Trade Brain Author Tooling Spec

## Section 12 · Risks

- **Legacy content migration** — existing assets need domain classification · mitigation: one-off migration cron with manual review for ambiguous assets
- **Cross-domain query legitimacy calls** — some queries genuinely need multiple domains · mitigation: explicit multi-domain retrieval API (§8.2) is the sanctioned pattern
- **Storage cost growth** — per-domain organisation may seem to duplicate structure · mitigation: content is not duplicated, only paths structured · no cost impact
- **Retrieval friction** — engineers must always specify domain · mitigation: TypeScript compiler enforces via required parameter · ESLint enforces via lint rule · pattern becomes natural quickly

---

**End of Nex Intelligence Storage Architecture v1.0.**

*Implementation begins Phase 0 Week 3 upon ADR-0021 acceptance. Storage bucket setup + retrieval API contracts before any Brain content authoring begins.*
