# Memory V1 · Technical Design

**Engineering design · 2026-07-23**
**Purpose:** the concrete implementation approach for Memory V1 cross-tenant rollups + K-anonymity gate + consent framework. Design only. Implementation gated on ADR-0016 acceptance.

**Related:** Phase 26 Memory Engine Blueprint · ADR-0016 (Memory Privacy Architecture) · ES-02 §5 (Memory model) · ES-04 (GDPR workflows).

**Status:** Design v1 · awaiting review. Implementation Week 5-10 per Roadmap v2 Phase 1.

---

## Section 1 · Goals

### 1.1 Product goals

- Merchants on Professional+ tier see honest regional peer benchmarks
- Merchants can opt in/out of contribution per memory category
- Merchants see "your data helped" transparency
- Merchants can correct wrong benchmark values inline
- Low-density regions show honest "not enough peers yet" state (per Validation Report C-7)

### 1.2 Engineering goals

- Zero cross-tenant PII exposure (schema-level enforcement)
- K-anonymity enforcement at reader (per ADR-0016 tiered thresholds)
- Rollups accurate within statistical bounds
- Nightly rollup completes within 2-hour window at 100k merchants
- Merchant opt-out immediate (< 5 seconds)

### 1.3 Non-goals

- Semantic/vector recall (V3+)
- Real-time rollups (nightly is fine · V2 if merchant demand justifies)
- Predictive extrapolation from thin data (violates evidence-or-silence)

---

## Section 2 · Data Model

### 2.1 New tables

Per ADR-0016 § implementation impact:

```sql
-- Trade layer · one row per (subject, region, trade, computed_at)
CREATE TABLE hammerex_nex_memory_trade (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_slug            TEXT NOT NULL,
  region_code           TEXT NOT NULL,        -- ONS region (UK) · state (AU) · province (IE)
  subject               TEXT NOT NULL,
  predicate             TEXT NOT NULL,        -- '=' | 'p50' | 'p95' | ...
  value_json            JSONB NOT NULL,
  unit                  TEXT,

  -- Aggregation metadata
  sample_size           INTEGER NOT NULL,
  min_contributor_count INTEGER NOT NULL,     -- K threshold applied
  sensitivity_tier      TEXT NOT NULL CHECK (sensitivity_tier IN ('non_pricing', 'pricing', 'margin')),

  observed_at           TIMESTAMPTZ NOT NULL,
  window_start          TIMESTAMPTZ NOT NULL,
  window_end            TIMESTAMPTZ NOT NULL,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  confidence            TEXT NOT NULL DEFAULT 'medium'
                          CHECK (confidence IN ('low', 'medium', 'high')),
  decays_at             TIMESTAMPTZ,          -- typically computed_at + 6 months

  source_engine         TEXT NOT NULL DEFAULT 'memory.rollup',

  UNIQUE (trade_slug, region_code, subject, window_start, window_end)
);

CREATE INDEX idx_memory_trade_lookup ON hammerex_nex_memory_trade
  (trade_slug, region_code, subject, computed_at DESC);

-- Region layer · one row per (subject, region, computed_at) · cross-trade
CREATE TABLE hammerex_nex_memory_region (
  -- Same shape as _trade but without trade_slug scoping
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code           TEXT NOT NULL,
  subject               TEXT NOT NULL,
  predicate             TEXT NOT NULL,
  value_json            JSONB NOT NULL,
  unit                  TEXT,
  sample_size           INTEGER NOT NULL,
  min_contributor_count INTEGER NOT NULL,
  sensitivity_tier      TEXT NOT NULL CHECK (sensitivity_tier IN ('non_pricing', 'pricing', 'margin')),
  observed_at           TIMESTAMPTZ NOT NULL,
  window_start          TIMESTAMPTZ NOT NULL,
  window_end            TIMESTAMPTZ NOT NULL,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence            TEXT NOT NULL DEFAULT 'medium',
  decays_at             TIMESTAMPTZ,
  source_engine         TEXT NOT NULL DEFAULT 'memory.rollup',
  UNIQUE (region_code, subject, window_start, window_end)
);

CREATE INDEX idx_memory_region_lookup ON hammerex_nex_memory_region
  (region_code, subject, computed_at DESC);

-- Opt-out registry · per merchant per category
CREATE TABLE hammerex_nex_memory_optout (
  merchant_slug         TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN ('trade', 'supplier', 'material', 'construction_knowledge')),
  opted_out_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opted_out_by          UUID REFERENCES auth.users(id),
  PRIMARY KEY (merchant_slug, category)
);

-- "Your data helped" transparency log
CREATE TABLE hammerex_nex_memory_transparency_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug         TEXT NOT NULL,
  contributed_to        TEXT NOT NULL,    -- 'trade_rollup:plumbing:cardiff_south'
  contributed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memory_row_id         UUID NOT NULL,    -- which merchant row contributed
  category              TEXT NOT NULL,
  peer_count            INTEGER NOT NULL  -- how many peers in that rollup
);

CREATE INDEX idx_transparency_merchant ON hammerex_nex_memory_transparency_log
  (merchant_slug, contributed_at DESC);
```

### 2.2 Existing tables extended

```sql
-- Add contributor tracking column
ALTER TABLE hammerex_nex_memory_company
  ADD COLUMN allow_cross_tenant_contribution BOOLEAN DEFAULT FALSE;

-- V0 shipped with `allow_cross_tenant_contribution` implicit false
-- V1 makes it explicit + read by rollup cron
```

---

## Section 3 · K-Anonymity Sensitivity Tiers

Per ADR-0016 § 1:

```typescript
type SensitivityTier = 'non_pricing' | 'pricing' | 'margin';

const K_THRESHOLDS: Record<SensitivityTier, number> = {
  non_pricing: 5,   // demand · search counts · project counts
  pricing:     10,  // day rates · materials cost per unit
  margin:      20,  // realised profit margin
};

// Sensitivity classification per subject prefix
const SENSITIVITY_MAP: Record<string, SensitivityTier> = {
  'demand.':        'non_pricing',
  'search.':        'non_pricing',
  'project_count.': 'non_pricing',
  'pricing.':       'pricing',
  'day_rate.':      'pricing',
  'material_cost.': 'pricing',
  'margin.':        'margin',
  'profit.':        'margin',
};
```

Sensitivity is deterministic from subject prefix. Every new subject family requires explicit sensitivity classification (CI check enforces).

---

## Section 4 · Rollup Cron Design

### 4.1 Trigger

pg_cron scheduled daily at 02:00 UTC (per ES-06 §16.2). Runs sequentially per region × trade to avoid excessive lock contention.

### 4.2 Algorithm (pseudocode)

```
for each (subject, region, trade) in candidate_rollups:
  # 1. Collect atomic rows
  contributors = SELECT DISTINCT merchant_slug
    FROM hammerex_nex_memory_company
    WHERE subject = <subject>
      AND merchant_region = <region>
      AND merchant_trade = <trade>
      AND allow_cross_tenant_contribution = TRUE
      AND merchant_slug NOT IN (SELECT merchant_slug FROM hammerex_nex_memory_optout
                                WHERE category = <category>)
      AND observed_at >= <window_start>
      AND observed_at <= <window_end>

  # 2. Apply K-anonymity gate
  sensitivity = SENSITIVITY_MAP[subject_prefix(subject)]
  k_threshold = K_THRESHOLDS[sensitivity]

  IF COUNT(contributors) < k_threshold:
    # Do not emit rollup
    LOG "insufficient contributors for <subject>/<region>/<trade>: N/{k_threshold}"
    CONTINUE

  # 3. Compute aggregates
  values = SELECT value_json FROM hammerex_nex_memory_company
           WHERE merchant_slug IN contributors
             AND subject = <subject>
             AND observed_at BETWEEN <window_start> AND <window_end>

  aggregates = compute_percentiles(values, [p50, p95])

  # 4. Write rollup
  INSERT INTO hammerex_nex_memory_trade (...)
    VALUES (<subject>, <region>, <trade>, aggregates,
            sample_size = COUNT(contributors),
            min_contributor_count = k_threshold,
            sensitivity_tier = sensitivity, ...)

  # 5. Write transparency log
  for each contributor in contributors:
    INSERT INTO hammerex_nex_memory_transparency_log (...)
```

### 4.3 Window strategy

Rolling 90-day windows recomputed nightly. Older rollups retained but not refreshed (become historical baseline).

### 4.4 Idempotency

Same window recomputed multiple times produces same result. UNIQUE constraint on (trade_slug, region_code, subject, window_start, window_end) prevents duplicates. Upsert pattern.

### 4.5 Performance targets

At 100k merchants:
- ~500 unique subjects
- ~20 UK regions × 40 trades = 800 slices
- ~500 × 800 = 400,000 candidate rollups per night
- Target: complete within 2-hour window

If nightly window exceeded: partition by region · run in parallel workers.

### 4.6 Failure handling

- Individual slice failure logged but does not halt cron
- Failure rate >5% triggers alert
- Rollup misses one night: next night catches up · no data loss

---

## Section 5 · K-Anonymity Gate at Reader

### 5.1 Reader interface

```typescript
// Public API
async function readRegionalMemory(input: {
  subject: string;
  trade?: string;
  region: string;
  merchant_slug: string;    // caller identity for tier check
}): Promise<
  | { status: 'ok'; data: MemoryRow; contributor_count: number }
  | { status: 'insufficient_data'; current_contributors: number; min_required: number; estimated_days_to_unlock: number | null }
  | { status: 'tier_locked'; required_tier: 'professional' | 'business' | 'works' }
>;
```

### 5.2 Tier check first

Cross-tenant reads require Professional tier or higher. Free/Starter merchants see tier_locked response with upgrade path.

### 5.3 K threshold enforcement

Reader always fetches from rollup table. Rollup row itself proves K threshold met (min_contributor_count column). No K math at read time.

But: reader must not return "value" without also asserting the row's min_contributor_count matches its sensitivity tier — belt-and-braces check against corrupted rows.

### 5.4 Insufficient data response

When no rollup exists (K not met yet):
- Count contributors currently
- Predict days-to-unlock from contributor growth rate (per Validation Report C-7)
- Return honest state, not empty

### 5.5 Reader caching

- Redis cache per (subject, region, trade) with 5-minute TTL
- Invalidated on new rollup write
- Reduces DB read load for frequently-queried benchmarks

---

## Section 6 · Consent Framework

### 6.1 Onboarding

Per Business Builder V2, merchant sees consent options during Missions 6-10 timeframe (after first project or first quote issued). Not at signup (per ADR-0016 § defaults).

### 6.2 Consent UI

Settings > Data > Regional Intelligence:

```
Regional Intelligence · Contribution

Nex uses aggregated data from merchants like you to show
you regional peer benchmarks · pricing insights · demand signals.

Your contribution helps other merchants in your region.
Your identifying information NEVER crosses tenant boundaries.

You can opt in or out per category at any time.

☐ Contribute Trade Memory
  Your project counts + trade activity feed regional demand signals
  K-anonymity: at least 5 merchants must contribute before ANY data is visible

☐ Contribute Supplier Memory
  Your anonymised supplier performance data feeds supplier rankings
  K-anonymity: at least 5 merchants

☐ Contribute Material Memory
  Your material choices feed material intelligence
  K-anonymity: at least 5 merchants

☐ Contribute Construction Knowledge
  Your validated learnings feed the platform's construction knowledge
  K-anonymity: at least 5 merchants + Trade Brain Author review

[View your contribution history]
[Opt out of everything · immediate]
```

### 6.3 Opt-out immediate

- Toggle off → merchant removed from next rollup cycle
- Previous rollups regenerated in next cron cycle
- Confirmation email sent

### 6.4 "Your data helped" transparency page

Settings > Data > Contribution History:

Lists anonymised examples of rollups the merchant contributed to:

```
This year you contributed to:

· Cardiff South plumbing regional day rate (with 8 other merchants) · £287 median
· UK-wide demand signal for bathroom refits (with 145 other merchants)
· Wolseley Cardiff supplier on-time rating (with 12 other merchants)

Total contributions: 47 rollups over 6 categories
```

Refreshes weekly.

---

## Section 7 · Correction UX

### 7.1 Inline correction on rollup display

Merchant sees a rollup value in their dashboard or Chat:

> Regional median day rate for plumbers in Cardiff South: £280 (based on 8 contributors)
> [Correct this] [See who contributed anonymously]

### 7.2 Correction workflow

1. Merchant taps [Correct this]
2. Dialog: "What's the correct value?" + optional reason
3. Merchant submits
4. Correction goes to `hammerex_nex_memory_corrections_v2` (per Memory V2 · scheduled Sprint 4)
5. If correction is >20% divergent, flagged for Author review
6. Correction contributes to rollup accuracy improvement in next cycle

### 7.3 Merchant-visible correction impact

Corrections are counted. If a rollup receives >3 corrections in a week, its confidence drops from `medium` to `low` and it's flagged for review.

---

## Section 8 · Migration Order

### 8.1 Migration sequence

1. Create `hammerex_nex_memory_trade` table
2. Create `hammerex_nex_memory_region` table
3. Create `hammerex_nex_memory_optout` table
4. Create `hammerex_nex_memory_transparency_log` table
5. Add `allow_cross_tenant_contribution` column to `hammerex_nex_memory_company`
6. Deploy reader code (returns tier_locked or insufficient_data initially)
7. Deploy consent UI
8. Deploy rollup cron (initially producing empty rollups)
9. Migrate 10 pilot merchants to consent framework
10. Wait 2 weeks · verify K-anonymity gate honoured
11. Roll out to all Professional+ merchants

### 8.2 Rollback plan

- Feature flag `memory.v1_enabled` gates all V1 code
- Toggle off returns to V0 (owner-only reads)
- Rollup crons paused via cron scheduling flag
- Data preserved (no destructive migration)

### 8.3 Idempotency

Every rollup cron cycle idempotent. Restart-safe.

---

## Section 9 · Testing Strategy

Per ES-05 requirements:

### 9.1 Unit tests

- K-threshold classification per subject
- Rollup aggregate math correctness
- Consent framework transitions
- Correction chain integrity

### 9.2 Integration tests (Testcontainers Postgres)

- Rollup cron on synthetic data · verify K-anonymity honoured
- Reader returns correct state per tier + K conditions
- Opt-out immediately affects next rollup
- Cross-tenant attempted read blocked

### 9.3 Adversarial tests

- Attempt to bypass K-anonymity via subject-prefix manipulation
- Attempt to identify individual merchants via low-density rollups
- Attempt cross-tenant PII leak via rollup payload
- Attempt to inject fake contributors via database access

### 9.4 Load tests

- Rollup cron at 100k merchants · 2-hour SLA
- Reader latency at 10k concurrent queries · p95 < 500ms

### 9.5 Advisory panel review

- 5 pilot merchants review consent UI clarity
- 5 pilot merchants review "not enough peers yet" state
- 5 pilot merchants review correction UX
- NPS captured pre/post

---

## Section 10 · Performance Targets

- Rollup cron completes: <2 hours at 100k merchants
- Regional reader response: <500ms p95 (cached) · <2s p95 (uncached)
- Consent toggle to effective: <5 seconds
- Correction submission: <200ms
- Opt-out to full rollup regeneration: <24 hours (next cron cycle)

---

## Section 11 · Monitoring

### 11.1 Metrics tracked

- Rollup cycle duration per night
- Rollup cycle success/failure rate
- Number of rollups produced per night (per sensitivity tier)
- Regional reader p95 latency
- Cache hit rate on regional reads
- Merchant opt-in rate per category
- Correction rate per rollup

### 11.2 Alerts

- Rollup cycle exceeds 2h · P2 alert
- Rollup cycle failure rate >5% · P1 alert
- Regional reader p95 >2s · P2 alert
- Opt-in rate drop >20% week-over-week · P3 investigation
- Correction rate >5% for specific rollup · P3 review

---

## Section 12 · Dependencies

- **Blocks:** Phase 30 Market Intelligence V0 · Memory V2 Dashboard (needs V1 data to display) · regional benchmark features across Estimator + Workforce
- **Blocked by:** ADR-0016 Accepted · consent UI design · Author input on Memory V2 correction workflow (Author-shared corrections trigger regeneration)
- **Related:** ES-04 (encryption + GDPR workflows) · ES-05 (adversarial test cases)

## Section 13 · Risks

- **Slow contributor accumulation** — low-density regions won't unlock K=10 pricing for months · mitigation: honest UX per Validation Report C-7 · encourage contribution during onboarding
- **Correction manipulation** — merchants correcting to bias benchmarks · mitigation: outliers flagged · Author review · corrections logged with author
- **Rollup cron duration** — may exceed 2h at scale · mitigation: partition by region · parallelise workers · monitor
- **Cache staleness** — merchants see stale benchmark · mitigation: 5-min TTL · Realtime channel invalidation on rollup update
- **Cross-jurisdiction expansion** — IE + AU rollups need distinct pipelines · deferred to Y2 with dedicated design

---

## Section 14 · Immediate Next Steps

- Week 3-4 (Phase 0):
  - Review this design with CTO + Backend Lead
  - Advisory panel input on consent UI copy
  - Finalise sensitivity classification for known subjects (comprehensive map)

- Week 5-6 (Phase 1):
  - Migrations authored + reviewed
  - Reader interface implemented (returns tier_locked initially)
  - Consent UI shipped behind feature flag

- Week 7-8 (Phase 1):
  - Rollup cron implemented + tested
  - Pilot merchant migration
  - Advisory panel review of end-to-end flow

- Week 9-10 (Phase 1):
  - Production rollout to Professional+ tier merchants
  - Monitoring dashboards live
  - Iteration based on early usage data

---

**End of Memory V1 Technical Design v1.0.**

*Implementation gated on ADR-0016 acceptance (target Phase 0 Week 2 end).*
