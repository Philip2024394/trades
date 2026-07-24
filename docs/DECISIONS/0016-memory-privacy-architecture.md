# ADR-0016: Memory Engine Privacy Architecture · Tiered K-Anonymity + Consent-First Contribution

Status: Draft (awaiting signoff)
Date: 2026-07-23
Related: `docs/PHASE_26_MEMORY_ENGINE_BLUEPRINT.md` · `docs/ES-01_ENGINEERING_EXECUTION_BIBLE.md` §14.1 (correction #3) · `docs/ES-02_DATA_AND_EVENT_ARCHITECTURE_V1.md` §1.6

## Context

Phase 26 Memory Engine V0 (shipped) provides owner-scoped memory rows. V1 (blocked by this ADR) introduces cross-tenant rollups that let merchants see regional peer benchmarks — a core value proposition that unlocks Professional-tier upgrades and Phase 30 Market Intelligence.

The Phase 26 blueprint originally specified a flat K-anonymity threshold of K≥5 for every cross-tenant read. ES-01 §14.1 correction #3 challenged this: **for pricing signals in small trades × small regions, K=5 is de-anonymisable by anyone with local knowledge.** A merchant in Cardiff's plumbing trade could identify the other 4 contributors and infer their pricing. That would end the consent story instantly.

Additionally, Phase 26 blueprint's consent framework needs concrete implementation to be lawful under UK DPA + GDPR + Ireland DPA + AU Privacy Act. Every merchant must have:
- Explicit opt-in per memory-type category
- Immediate opt-out (no penalty)
- "Your data helped" transparency surface
- Data portability + right-to-be-forgotten workflows

Consent is Nex's most valuable non-technical asset. It is also one-shot: a single breach or perceived breach ends contribution across the merchant base.

## Decision

**Tiered K-anonymity thresholds per metric sensitivity + explicit consent-first contribution framework.**

### 1 · Tiered K-anonymity thresholds

| Metric sensitivity | K threshold | Examples |
|--------------------|-------------|----------|
| Non-pricing signals · demand + count | **K ≥ 5** | Trade Centre search volumes · project counts · trade-mix distributions |
| Pricing signals · day rates + material costs | **K ≥ 10** | Regional day rate · materials cost per unit |
| Margin / profitability signals | **K ≥ 20** | Realised profit margin per trade × region |
| Individual customer + payment behaviour | **Never crosses tenant boundary** | Customer names · addresses · payment days per customer |

Every reader enforces the K threshold at query time. Every rollup writer records `min_contributor_count` so the reader can gate.

### 2 · Regional granularity gate

Cross-tenant reads capped at:
- UK: **ONS statistical region** (e.g. "South East England" · never "Cardiff CF10")
- Ireland: **Province** (never city or postcode)
- Australia: **State** (never suburb)
- Other countries: national aggregate only until density supports finer granularity

### 3 · Consent-first contribution

Every merchant opts in **per memory-type category** during onboarding or in Settings:
- Trade Memory contribution (regional trade averages)
- Supplier Memory contribution (anonymised supplier performance)
- Material Memory contribution (anonymised material choices)
- Construction Knowledge contribution (validated learnings)

Defaults:
- **Opted OUT** at Free tier
- **Opted OUT** at Starter tier
- **Opted-in prompt** at Professional tier upgrade (not silent enable)
- **Explicit opt-in per category** at Business+ tier

Opt-out is immediate. No penalty. Opt-out merchants retain full READ access to whatever their tier grants; they simply do not contribute.

### 4 · "Your data helped" transparency

Every merchant sees a Memory Dashboard page showing:
- Which memory-type categories they contribute to
- Anonymised examples of what their contribution unlocked (e.g. "your day rate contributed to the Cardiff South regional median with 8 other plumbers")
- Total contribution count per category
- Opt-out control per category

### 5 · Data portability + right-to-be-forgotten

Per ES-01 §14.1 correction #12 (first-class engineering):
- Portability: full merchant memory exportable as structured JSON + media manifest · signed URL 7-day expiry
- RTBF: cascade delete across all memory tables · media deletion · rollup regeneration on next cron · confirmation logged
- Legal retention floor honoured (audit log rows retained with PII redacted per jurisdiction)

### 6 · PII handling

- Application-layer encryption on PII columns (customer names · addresses · phone numbers)
- PII never crosses tenant boundary
- PII never enters cross-tenant rollups regardless of consent

## Consequences

**Positive:**
- K≥10 pricing threshold is defensible under adversarial de-anonymisation review · Cardiff plumbers can't identify each other from a K=10 rollup
- Consent-first opt-in framework is auditable and legally sound under multiple jurisdictions
- Transparency dashboard turns compliance requirement into trust advantage
- Data portability rights honoured builds retention paradox (merchants can leave, therefore they stay)

**Negative:**
- K=20 for margin metrics means margin rollups may not unlock in low-density regions for many months · merchants in those regions see "not enough peers yet" until density accumulates
- Two-year timeline before rollup density matures across all UK regions × trades · Y1 revenue projections should not depend heavily on cross-tenant reads
- Cross-tenant contribution is opt-in · initial contribution rate may be 30-50% not 100%
- Regional granularity gate (ONS region not postcode) means merchants can't get street-level intelligence · this is deliberate

**Neutral:**
- K thresholds may be revisited in 3+ years once density matures · a supersession ADR would be needed
- Regional granularity may be refined per country as density supports · never widened, only narrowed

## Alternatives Considered

- **Flat K=5 for everything** (original blueprint) · rejected · pricing rollups de-anonymisable in small trades × small regions
- **Differential privacy noise injection instead of K-anonymity** · rejected for V1 · adds implementation complexity + reduces signal quality without proportional gain at Nex scale · reconsider at Y3+
- **Postcode-level regional granularity** · rejected · single postcode may contain 2-3 merchants of a trade · trivially de-anonymisable
- **Automatic opt-in at all paid tiers** · rejected · violates consent-first principle · legal risk under UK ICO guidance
- **Federated learning instead of aggregation rollups** · rejected for V1 · research-grade complexity · revisit at Memory V3+
- **No cross-tenant reads at all** · rejected · loses primary Nex value proposition · abandons Phase 30 Market Intelligence entirely

## Implementation Impact

- `hammerex_nex_memory_trade` + `hammerex_nex_memory_region` add `min_contributor_count` column
- `hammerex_nex_memory_optout` new table (merchant · category · opted_out_at)
- `hammerex_nex_memory_transparency_log` new table (contribution reveals to merchants)
- Reader enforces K threshold via lookup against `min_contributor_count` + category sensitivity map
- Every rollup cron records `contributor_count` per rollup slice
- Memory Dashboard UI (Memory V2 spec) surfaces opt-in controls + contribution history
- `hammerex_nex_platform_gdpr_requests` new table orchestrates portability + RTBF workflows
- PII column encryption via Supabase Vault / application-layer AES-256

## Dependencies

- **Blocks:** Memory V1 · Phase 30 Market Intelligence V0 · Memory V2 Dashboard
- **Blocked by:** legal counsel review (Week 2 preparation phase)
- **Related ADRs:** none currently · this is Nex's first data-privacy ADR

## Enforcement

- Every cross-tenant memory reader must call the K-threshold gate function · unit test verifies gate cannot be bypassed
- Every new memory rollup type must specify its sensitivity tier (non-pricing / pricing / margin / never-crosses)
- New sensitivity tiers require a superseding ADR
- Quarterly audit sampling verifies K thresholds honoured in production

## Sign-off Required

- [ ] CTO
- [ ] Legal Counsel
- [ ] Product Lead
- [ ] Data Protection Officer (if appointed)
