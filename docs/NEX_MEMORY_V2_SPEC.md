# Nex Construction Memory V2 · Trusted Business Memory Specification

**Production spec · 2026-07-23**
**Purpose:** transform Memory from a substrate into the merchant's permanent, trustworthy, transparent business intelligence layer. Memory becomes a primary reason customers stay with Nex.

**Departure from V1:** V1 was a working substrate with no merchant-facing surface. V2 adds the transparency, correction, control, and dashboard layer that makes Memory a durable competitive advantage.

**Related:** Phase 26 Memory Engine (V0 shipped, V1 blueprinted) · Phase 27 Trade Brains · Phase 29 Digital Twin · Chat V2 · SiteBook V2.

---

## Section 1 · Memory Philosophy — Core Principles

Construction Memory V2 defers to these 10 principles for every design decision.

1. **Truthful** — every fact traces to evidence · fabrication is prevented at schema level
2. **Transparent** — merchant sees exactly what Nex remembers, always
3. **User controlled** — merchant can edit, correct, delete anything about their business
4. **Permission based** — cross-tenant reads gated by K-anonymity; never PII crosses tenants
5. **Context aware** — retrieval loads only what's relevant, never overwhelms
6. **Long-term** — memories survive years; correction chains preserve history
7. **Business focused** — Memory is about running the business, not chatting
8. **Construction specific** — trades, materials, regulations, suppliers, projects · not generic
9. **Explainable** — every remembered fact answers "where did this come from?"
10. **Never mysterious** — no hidden AI opinions or fabricated observations

The merchant should always be able to answer:

- Why does Nex know this?
- Where did it come from?
- How is it being used?
- How do I change it?
- How do I delete it?

---

## Section 2 · Memory Type Hierarchy

Fourteen memory types with defined purpose, lifecycle, and retention.

| Type | Scope | Purpose | Lifecycle | Retention |
|------|-------|---------|-----------|-----------|
| **Business Memory** | Merchant | Company facts (name, address, tax scheme, services) | Persistent | Life of business |
| **Customer Memory** | Merchant · per customer | Customer preferences, project history, communication style | Persistent | 7 years post-relationship |
| **Project Memory** | Merchant · per project | Full project record | Persistent (never deleted) | Life of building (via Twin) |
| **Trade Memory** | Cross-tenant · per trade | Regional benchmarks per trade | Rollup-refreshed | Nightly rollup |
| **Supplier Memory** | Merchant · per supplier | Merchant's supplier performance, preferences | Persistent | Life of relationship |
| **Employee Memory** | Merchant · per employee | Skills, projects, preferences | Persistent | Employment + 3 years |
| **Equipment Memory** | Merchant · per asset | Plant + tools · service records · location | Persistent | Life of asset |
| **Material Memory** | Merchant · per SKU | Preferred products, quantities per project type | Persistent | 5 years |
| **Financial Memory** | Merchant · confidential | Margin history, quote-to-close patterns | Persistent · encrypted | 7 years for tax |
| **Construction Knowledge Memory** | Merchant + Trade Brain shared | Learned techniques + regional facts | Persistent | Indefinite |
| **Conversation Memory** | Merchant · per session | Recent Chat context | Time-bounded | 30 days rolling |
| **Temporary Working Memory** | Per session | Active workflow state | Session-scoped | Session end |
| **Archived Memory** | Merchant | Historic records, no longer active | Read-only | Indefinite (queryable) |
| **Historical Memory** | Cross-tenant aggregate | Long-term industry trends | Rollup | 10 years |

### 2.1 Lifecycle rules

- **Persistent** — never expires unless merchant deletes
- **Rollup-refreshed** — computed from atomic events on schedule
- **Time-bounded** — auto-archived after window
- **Session-scoped** — cleared on session end
- **Encrypted at rest** — for confidential types (Financial)

### 2.2 Cross-tenant contribution

Only these types contribute to cross-tenant memory (subject to opt-in + K-anonymity gate):

- Trade Memory
- Supplier Memory (anonymised)
- Material Memory (anonymised)
- Construction Knowledge Memory (validated only)
- Historical Memory (aggregated only)

PII types (Customer, Employee, Financial) never cross tenants.

---

## Section 3 · Automatic Memory Rules

Nex should remember information that creates long-term value. Never remember unnecessary information.

### 3.1 What Nex remembers automatically

- **Frequently used suppliers** — after 3+ uses
- **Preferred materials** — after 5+ same-material orders
- **Working hours** — from consistent activity patterns
- **Quoting style** — margin pattern, tone, service inclusions
- **Preferred payment terms** — from repeated invoice patterns
- **Common project types** — after 3+ similar completed projects
- **Project naming conventions** — from consistent patterns
- **Customer preferences** — mentioned by customer, confirmed by merchant
- **Trade-specific vocabulary** — merchant's terminology captured for consistent voice

### 3.2 What Nex explicitly does NOT remember

- Passing complaints or bad mood signals
- One-off exceptions
- Anything sensitive without explicit merchant confirmation
- Anything Vision AI sees but merchant doesn't confirm
- Anything from a single low-confidence source

### 3.3 The "long-term value" filter

Before writing to persistent memory, Nex asks: will this fact still matter in 6 months? If unclear, mark as tentative and confirm at first re-use.

### 3.4 Never surprise the merchant

Every automatic write is:

- Logged
- Attributed to source
- Reviewable in Memory Dashboard
- Deletable by merchant with one tap

---

## Section 4 · Memory Correction System

The critical missing piece from V1. V2 makes correction a first-class action.

### 4.1 Correction actions available on any memory

- **View** — see the memory + full history
- **Edit** — change value with reason
- **Correct** — mark previous version wrong, replace with correct
- **Delete** — remove (soft delete for 30 days · then hard delete)
- **Approve** — confirm a tentative/low-confidence memory
- **Reject** — flag as wrong, do not use
- **Merge** — combine duplicate memories about the same subject
- **Archive** — move to historical, keep queryable but don't influence AI
- **Explain** — note WHY this was wrong (feeds ML improvement Y3+)

### 4.2 Correction UX

Inline correction on every displayed memory-derived fact (per Business Builder V2 pattern):

- Pencil icon on every AI output that used memory
- Tap → correction dialog
- Correction dialog is simple: new value + optional reason + save
- Confirmation: "Fixed. Won't happen again."

### 4.3 Correction propagation

When merchant corrects:

- Memory row supersedes prior (per Phase 26 correction chain)
- Chat V2 acknowledges correction in next relevant conversation
- Trade Brain updates its use of the fact
- Cross-tenant rollup re-evaluates on next cycle
- Merchant's confidence in Nex increases (measurable via NPS)

### 4.4 Correction memory

Nex remembers corrections themselves:

- If merchant corrects the same category 3+ times, Nex asks: "I've been wrong about your supplier preferences a few times · want me to relearn from scratch?"
- Correction rate per category tracked to prevent bad memory patterns

### 4.5 Merchant explaining WHY it was wrong

Optional but powerful. Merchant reason: "You confused Wolseley Cardiff with Wolseley Newport — different branches." → feeds future accuracy.

---

## Section 5 · Memory Timeline

Every memory has a full history visible to the merchant.

### 5.1 Timeline per memory row

- Created (source, evidence, timestamp)
- Confirmed by merchant (if applicable)
- Modified (any change with author + reason)
- Superseded (by which correction)
- Related conversations (chat sessions that referenced it)
- Related projects (which projects used it)
- Trade Brain influence (which decisions were informed by it)

### 5.2 UI

Timeline is a scrollable card list per memory. Merchant can drill into any moment. Every entry has:

- Icon (created / modified / used / superseded)
- Timestamp
- Source
- Optional link (to related conversation or project)

### 5.3 Global Memory Activity Feed

Merchant can view all recent memory activity:

- What Nex learned today
- What was confirmed
- What was corrected
- What was archived

Filterable by memory type · date range · confidence level.

---

## Section 6 · Context Engine

The right memories loaded at the right time. Not everything, always.

### 6.1 Retrieval rules

Every AI operation loads a **context bundle** — a minimal set of relevant memories.

Context loaded is a function of:

- Current project (if any)
- Current customer (if any)
- Current trade (from Chat topic)
- Current location
- Current employee referenced
- Recent conversation history (last 30 min)
- Business rules that apply
- Trade Brain in scope
- Cross-referenced Twin state
- Estimator context if relevant

### 6.2 Retrieval limits

- Max 20 memory rows per context bundle
- Max 5,000 tokens of context to LLM
- Priority: high-confidence recent > low-confidence recent > high-confidence old
- Merchant-corrected memories weighted higher

### 6.3 Context transparency

Chat V2 exposes what's in context on request. "What are you using for context here?" surfaces the bundle.

### 6.4 Context switch handling

When merchant switches context (project → different project), context bundle re-loads. Previous context accessible via history.

---

## Section 7 · Memory Confidence

Every memory carries confidence. Confidence visible everywhere the memory surfaces.

### 7.1 Confidence sources

| Source | Base confidence |
|--------|-----------------|
| Verified by merchant | High |
| Derived from document with clear evidence | Medium-High |
| Vision AI (high-confidence detection) | Medium |
| Conversation (single mention) | Low-Medium |
| Imported from external tool | Medium (source-dependent) |
| Estimated from patterns | Low |
| Third-party integration verified | High |

### 7.2 Confidence display

- **High** — solid green dot
- **Medium** — yellow dot + brief caveat
- **Low** — amber dot + "not confirmed yet"

### 7.3 Low-confidence behaviour

- Not used for merchant-facing outputs without caveat
- Confirmed opportunistically (Chat asks casually)
- Auto-decays if not confirmed within a period
- Never used for financial decisions

### 7.4 Confidence adjustments over time

- Merchant confirmation → high
- Corrective action → memory retained but confidence adjusted
- Repeated evidence → confidence increases
- Contradicting evidence → confidence decreases + flag for review

### 7.5 Confidence transparency

Every displayed memory shows its confidence · click to see how confidence was calculated.

---

## Section 8 · Memory Privacy

Privacy is a competitive advantage. Not a compliance burden.

### 8.1 Tenant isolation

- RLS on every memory table (per ES-02)
- Application-layer double-check
- No cross-tenant PII crossing
- Cross-tenant rollups K-anonymity gated (tiered: K≥5 demand · K≥10 pricing · K≥20 margin per ES-01)

### 8.2 Role-based permissions (within merchant tenant)

- Owner: full memory access
- Manager: department-scoped memory
- Member: task-scoped memory
- Auditor: read-only

### 8.3 Memory export (GDPR)

- Merchant requests via Settings
- Structured JSON export of all memory rows
- Media assets included (photo URIs)
- Delivered as signed URL (7-day expiry)
- Compatible with re-import to another platform

### 8.4 Right to be forgotten

- Cascade delete across all memory tables
- Media deletion from storage
- Correction chains preserved with PII redacted (per legal retention floor)
- Contribution to cross-tenant rollups removed + rollups recomputed
- Confirmation sent

### 8.5 Consent management

- Explicit opt-in for cross-tenant contribution (per memory type)
- Opt-out immediate (no penalty)
- "Your data helped" transparency page shows anonymised examples
- Consent recorded with version + timestamp

### 8.6 Sensitive memory controls

- Financial memory encrypted at rest (application-layer)
- Customer PII columns encrypted
- Access to sensitive memory logged separately
- 2FA required for financial memory export

### 8.7 Audit log

- Every read/write logged
- Merchant can view their own audit log
- Legally admissible retention (per jurisdiction)

### 8.8 Privacy dashboard

Merchant sees:

- What Nex knows (by category)
- Who has accessed what (staff + AI agents)
- Cross-tenant contribution status
- Export + delete controls

---

## Section 9 · Memory + AI Integration

Every module gets smarter because of Memory. How each connects:

### 9.1 Trade Brains (Phase 27)

- Merchant-corrected memories override Brain defaults
- Merchant's regional variations feed Brain regional calibration
- Merchant's supplier preferences guide Brain recommendations

### 9.2 Estimator (Phase 28)

- Merchant's quote-to-close pattern trains pricing
- Merchant's actual vs estimated deltas calibrate future estimates
- Merchant's minimum margin floor enforced
- Merchant's typical suppliers preferred

### 9.3 Business Builder V2

- Regional peer memory pre-populates services
- Trade Brain memory pre-fills service descriptions
- Verified claims memory backs credentials

### 9.4 AI Workforce (Phase 32)

- Each agent reads their scope's memory
- CEO AI reads across scopes for briefings
- Memory corrections flow to agent behaviour

### 9.5 Digital Twin (Phase 29)

- Twin events write to Project Memory
- Cross-project pattern lending from Trade Memory
- Handover pack derived from Project Memory

### 9.6 Marketplace / Trade Centre

- Supplier Memory ranks suppliers per merchant
- Material Memory suggests preferred products
- Purchase history informs recommendations

### 9.7 CRM (Phase 8)

- Customer Memory personalises communication
- Payment behaviour informs risk scoring
- Preferences guide quote presentation

### 9.8 Projects (Phase 6/12)

- Project Memory tracks progression + variations
- Cross-project comparisons feed timeline estimates

### 9.9 Finance (Phase 10)

- Financial Memory guides margin recommendations
- Payment pattern predictions
- Cash flow forecasting

### 9.10 Construction Chat V2

- Every conversation loads relevant memory bundle
- Memory queries directly from Chat ("when did we finish the wall?")

---

## Section 10 · Visual Memory (Image-Based)

Photos are memory too. Vision AI extracts, links, references.

### 10.1 What Visual Memory tracks

- **Recurring designs** — the same staircase design merchant installs often
- **Recurring defects** — the same crack pattern in the same substrate
- **Customer finishes** — the specific tile the merchant tends to use for kitchens
- **Installed products** — Serial numbers extracted for warranty vault
- **Project progress** — before/after comparisons
- **Compare** — this bathroom vs the last similar bathroom

### 10.2 Retrieval

Merchant asks:

- "Show me the staircases I've built in the last year"
- "Find all bathrooms where I used Duravit fixtures"
- "Show every defect I've fixed on Elm Street"

Vector search over photo embeddings + memory row links.

### 10.3 Cross-referencing

Every photo links to:

- Project it belongs to
- Trade active at the time
- Vision AI findings
- Any related memory rows

### 10.4 Privacy

Photos never cross tenants without explicit consent + de-identification of any people/plates visible.

---

## Section 11 · Business Intelligence

Memory becomes insight. Patterns surface.

### 11.1 Discovered patterns

Every quarter, Nex reports patterns:

- Frequently delayed suppliers ("Wolseley Cardiff has been late on 4 of last 6 deliveries")
- Most profitable project types ("Kitchen refits average 32% margin · extensions 18%")
- Best-performing customer sources ("Google Business Profile referrals convert at 45% · Facebook at 12%")
- Repeat customer behaviour ("Sarah Jones has referred 3 new customers")
- Seasonal workload ("Autumn is 40% quieter · plan marketing accordingly")
- Common defects ("Substrate cracking on tiled surfaces appears in 8% of your bathroom jobs · consider substrate check upfront")
- Labour productivity ("Mike averages 20% faster on first-fix electrical than industry benchmark")

### 11.2 Presentation

- Every insight cites evidence
- Every insight has confidence
- Every insight is actionable ("would you like me to draft a note to Wolseley about the delays?")

### 11.3 What insights are NOT

- Not vanity metrics
- Not gamification
- Not comparison shaming
- Not fabricated

---

## Section 12 · Memory Dashboard

A dedicated Memory Centre. Understandable by non-technical merchants.

### 12.1 Sections

- **Search** — global search across all memory types
- **Timeline** — recent memory activity feed
- **Filters** — by type, confidence, source, date
- **Corrections** — pending suggestions to confirm/reject
- **Approvals** — items awaiting merchant confirmation
- **Recent memories** — last 30 days
- **Suggested updates** — Nex proposes changes based on new evidence
- **Confidence indicators** — filter by confidence level
- **Relationship graph** — visual link between memories, projects, customers, suppliers
- **Health score** — Memory Health (0-100) with signal breakdown
- **Activity log** — full audit

### 12.2 Memory Health Score

Score across 6 signals:

1. Coverage (do we know about your business?)
2. Accuracy (correction rate — lower is better)
3. Confidence (average confidence of stored memory)
4. Freshness (how recent + relevant)
5. Correction health (how often you correct + how it's improving)
6. Cross-tenant contribution (voluntary — score reflects your generosity to the platform)

### 12.3 What the merchant does here

- Review recent memory
- Correct anything wrong
- Delete anything unwanted
- Confirm suggestions
- Search history
- Export or delete for compliance

### 12.4 Design principles

- Zero jargon
- Every action reversible
- Merchant always feels in control
- Never scary language ("your data" not "your record")

---

## Section 13 · Implementation

### 13.1 Database

Extend existing Phase 26 tables + add:

```sql
hammerex_nex_memory_corrections_v2 (
  id UUID PRIMARY KEY,
  memory_row_id UUID,
  memory_table TEXT,
  corrected_by UUID,
  original_value JSONB,
  new_value JSONB,
  reason TEXT,
  corrected_at TIMESTAMPTZ
);

hammerex_nex_memory_confidence (
  memory_row_id UUID,
  memory_table TEXT,
  confidence TEXT,
  source TEXT,
  evidence_ref TEXT,
  updated_at TIMESTAMPTZ
);

hammerex_nex_memory_visual_index (
  id UUID PRIMARY KEY,
  merchant_slug TEXT,
  media_asset_id UUID,
  memory_row_ids UUID[],
  embedding vector(1536),
  categories TEXT[],
  created_at TIMESTAMPTZ
);

hammerex_nex_memory_health_scores (
  merchant_slug TEXT,
  score INTEGER,
  signals JSONB,
  computed_at TIMESTAMPTZ
);
```

### 13.2 Event model

Per ES-02:

- `memory.row_written` · `memory.correction_appended` · `memory.rollup_generated`
- `memory.confidence_updated` · `memory.deleted` · `memory.exported`

### 13.3 API specifications

```
GET  /api/nex/memory/v2/browse                 -- filterable, paginated
GET  /api/nex/memory/v2/<id>/history            -- timeline for a specific memory
POST /api/nex/memory/v2/<id>/correct
POST /api/nex/memory/v2/<id>/delete
POST /api/nex/memory/v2/<id>/approve
POST /api/nex/memory/v2/<id>/reject
POST /api/nex/memory/v2/search
GET  /api/nex/memory/v2/dashboard/health
GET  /api/nex/memory/v2/dashboard/insights
POST /api/nex/memory/v2/export                  -- GDPR
POST /api/nex/memory/v2/delete-all              -- Right to be forgotten
```

### 13.4 Frontend architecture

`src/apps/memory-v2/`:

- `MemoryDashboard.tsx`
- `MemoryTimeline.tsx`
- `MemoryCorrectionDialog.tsx`
- `ConfidenceIndicator.tsx` (reusable across every merchant surface)
- `MemorySearchBar.tsx`
- `MemoryHealthWidget.tsx`
- `RelationshipGraph.tsx`
- `PrivacyControls.tsx`
- `GDPRExportFlow.tsx`

### 13.5 Backend services

- `memory-v2/` module extends Phase 26 `memory/`
- Correction API
- Health Score computation cron
- Visual Memory embedding + retrieval
- Insight discovery cron (weekly)

### 13.6 AI prompt integration

- Every AI operation loads context bundle via `contextEngine.load()`
- Prompt templates include memory context section
- Confidence surfaced in every prompt-derived output

### 13.7 Knowledge Graph integration

- Memory rows link to Knowledge Graph nodes
- Corrections influence edge weights (per Phase 25 BOS graph)
- Graph queries retrieve memory-backed evidence

### 13.8 Performance targets

- Memory dashboard load: <1s
- Memory search: <500ms
- Correction save: <200ms
- Insight computation cron: overnight

### 13.9 Security

- Every read/write logged
- RLS per merchant
- PII column encryption
- Rate limiting per merchant per API endpoint

### 13.10 Testing

- Vitest unit tests for correction chain, confidence adjustment
- Integration tests with real Postgres
- Load test at 100k memory rows per merchant
- Advisory panel review of Memory Dashboard UX

### 13.11 Migration strategy

- V1 memory rows compatible with V2 schema (additive fields)
- No data migration required
- Dashboard rollout via feature flag
- Merchants gradually see new UI

### 13.12 Definition of Done

- All Section 13 delivered
- Advisory panel signs off on Memory Dashboard
- Load tests pass
- GDPR export/delete flows tested end-to-end

### 13.13 Acceptance criteria

- Merchant can view every memory about their business
- Merchant can correct any memory in <5s
- Merchant can export all memory in structured format
- Merchant can delete their business memory (with 30-day grace)

### 13.14 Engineering estimates

- Correction system + UX: 3 weeks
- Memory Dashboard: 3 weeks
- Confidence engine + display: 2 weeks
- Visual Memory + retrieval: 3 weeks
- Insights + patterns: 2 weeks
- GDPR flows: 2 weeks
- Testing + advisory panel: 2 weeks

**Total: ~17 engineer-weeks · Sprint 4 delivery target with 3-4 engineers parallelised.**

---

## Section 14 · Future Evolution

Ten-year memory roadmap.

### 14.1 Memory V3 (Y3)

- Semantic recall via vector embeddings (per Phase 26 blueprint V3)
- Cross-project pattern lending mature (Twin data density high)
- Predictive memory ("this project will likely need extra plasterboard based on similar past")
- Fine-tuned models for merchant-specific memory retrieval

### 14.2 Memory V4 (Y5)

- Cross-company benchmarking mature (regional K-anonymity rollups years-deep)
- Predictive insights ("your Q3 will likely be 12% quieter based on 5 years of pattern")
- Construction learning loops (regulation change → automatic Trade Brain updates → memory refresh)
- Knowledge Pack integration (industry-authored packs plug into memory)

### 14.3 Cross-project intelligence

- Every merchant's projects inform every other merchant's Trade Brain (K-anonymised)
- Regional-specific patterns emerge
- Industry-wide insights published (Nex Indices)

### 14.4 Trade Brain evolution

- Trade Brains learn from memory
- Regional accuracy improves
- New sub-specialisations emerge from observed patterns

### 14.5 Scalability

Millions of businesses × decades of memory:

- Partitioning strategy per Phase 26 V4
- Archival tier per ES-06
- Regional deployments per country
- Search infrastructure scales via vector store partitioning

---

## Final CTO Review

- Cut relationship graph V0 (visual novelty · defer to V1)
- Cut merchant-facing patterns dashboard (defer · start with Health Score)
- Simplify Memory Dashboard to Search + Timeline + Corrections + Health for V0
- Confirm every merchant-facing surface enforces evidence-or-silence
- Approve for Sprint 4 delivery subject to Correction API design review

**End of Nex Construction Memory V2 Spec.**
