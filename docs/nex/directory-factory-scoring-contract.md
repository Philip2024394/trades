# NEX Directory Factory · Scoring Contract

**Status:** DESIGN DOCUMENT ONLY · **architecture ACCEPTED** by Philip 2026-08-23 · **specific thresholds DELIBERATELY UNLOCKED** until real candidates arrive · zero code / schema / route / migration changes made.

**Date:** 2026-08-23 (updated 2026-08-23 with Philip's philosophical expansion)

**Doctrine anchors:**
- `project_nex_directory_factory_doctrine_2026_08_22` (amended 2026-08-23 · three-tier activation)
- `project_nex_continuous_discovery_vision_self_expanding_2026_08_22`
- `project_nex_walker_stays_pure_acquisition_2026_08_22`
- `project_nex_truth_invariant_2026_08_22`
- `docs/nex/directory-factory-phase-0-plan.md`

**Governing amendment (Philip 2026-08-23 verbatim):**

> NEX should score candidates
>
> 🟢 HIGH score → AUTO-LIST → no human required
> 🟡 MEDIUM score → HQ review
> 🔴 LOW score → FAILED / don't list

**Preserved boundary:** Walker never activates directly. Every activation — HIGH or MEDIUM — goes through the Factory activation engine (Phase 3). The score routes the candidate to the right activation *path*, it does not bypass activation validation (acceptance tests, image fallback, keyword collision, route uniqueness).

---

## 0 · Philosophy (evolves in three eras)

The scorer's job is NOT just "is this category safe to publish." Philip 2026-08-23:

> "The scorer should eventually answer: 'How confident are we that this category is worth creating, and how commercially valuable could it be?' Because we're building a self-expanding marketplace, not merely an automatic database classifier."

Three eras of the scorer, each unlocked by real data:

### Era 1 · Safety-first (this document · pre-Phase-3)
Signals available: **Evidence + Quality** (tables Walker already writes to).
Question the scorer answers: *"Is this safe enough to publish without a human?"*
Purpose: prevent a Factory that auto-lists nonsense.

### Era 2 · Calibrated (post-first-real-candidates)
Signals unchanged from Era 1 · but **thresholds are re-derived from actual candidate history** instead of guessed a priori.
Question the scorer answers: *"Given what we've seen, is this candidate consistent with past HIGH-quality categories?"*
Trigger: N ≥ ~10 real candidates observed in production.

### Era 3 · Commercial (post-monetisation-hooks)
Signals expand to **Commercial** (see §1c below) — customer demand · enquiries · leads · bookings · owner response · monetisation performance.
Question the scorer answers: *"Is this category worth creating AND is it commercially valuable enough to justify NEX supporting it long-term?"*
Trigger: Rp30k wallet / Rp10k lead / membership models are live and emitting signals.

**Deliberate order:** each era's signals REPLACE nothing from the prior era — they ADD to it. A category that fails the Era-1 safety gate never gets to compete on Era-3 commercial signals.

---

## 1 · Signal catalogue

Signals NEX can compute about a candidate. Sources are ONLY tables Walker has already written to — this contract does not require a new data pipeline.

| # | Signal | Source | Type |
|---|---|---|---|
| S1 | `business_count` | `nex.category_candidate.business_count` | int (already ≥ 50 per Phase 0 CHECK) |
| S2 | `cycle_count` | `nex.category_candidate.cycle_count` | int (already ≥ 2 per Phase 0 CHECK) |
| S3 | `observation_span_days` | `MAX(created_at) - MIN(created_at)` from provenance rows of member businesses | numeric (days) |
| S4 | `osm_tag_strength` | `evidence.pattern_key` — was the classifier's primary derived from an explicit OSM tag (`shop=bakery`) vs a fuzzy secondary (`name contains "bakery"`)? | enum: `explicit-tag / semi-explicit / fuzzy` |
| S5 | `contact_completeness` | share of member businesses with `whatsapp_number OR phone` | ratio 0-1 |
| S6 | `coord_completeness` | share of member businesses with `coordinates_lat AND coordinates_lng` | ratio 0-1 |
| S7 | `address_completeness` | share of member businesses with non-null `address` | ratio 0-1 |
| S8 | `language_coverage` | brain_keywords contain both EN + `id` tokens? | enum: `en-only / id-only / both` |
| S9 | `keyword_collision_risk` | any brain keyword matches an active Registry entry's keywords? | boolean |
| S10 | `route_collision_risk` | proposed route slug matches an existing Registry `route` or focused static route? | boolean |
| S11 | `image_evidence_count` | `jsonb_array_length(image_candidates)` | int |
| S12 | `geographic_clustering` | share of businesses within a bbox of median-lat ±0.03 median-lng ±0.03 (roughly one city district) | ratio 0-1 |
| S13 | `duplicate_of_existing` | already flagged `duplicate_of_registry_id` by a prior reviewer? | boolean |
| S14 | `superseded` | already flagged `superseded_by_candidate_id`? | boolean |

**Phase 1 writer currently populates:** S1, S2, S11 (empty array). All other signals are computable on demand by the scorer without changes to the writer.

### 1c · Commercial signals (Era 3 · reserved · not implemented yet)

These join the scorer only when the monetisation pipeline is live. Sources named for planning only — none of these tables exist yet:

| # | Signal | Prospective source | Notes |
|---|---|---|---|
| C1 | `customer_demand` | Brain intent log · count of user phrases resolving to this category slug | Requires Brain to log intent resolutions with candidate_id — a hook that could be added retroactively once candidates exist |
| C2 | `enquiries` | Owner-facing enquiry table (not yet built) | Number of user-initiated conversations aimed at this category |
| C3 | `leads` | Rp10k lead-purchase table (not yet built) | Actual paid lead events targeting this category |
| C4 | `bookings` | Bookings/appointments table (not yet built) | Confirmed bookings tied to businesses in this category |
| C5 | `owner_response` | Owner claim/response events (partial today via `claim_status`) | Response rate + response time · signals whether owners engage |
| C6 | `monetisation_performance` | Rp30k wallet deposits · membership conversions · derived from monetisation ledger (not yet built) | The ultimate signal · does this category actually pay for itself? |

**Why these matter for the scorer:** a category that passes safety but produces zero enquiries or zero owner engagement over N cycles is a dead directory. The scorer's `commercial_score` (Era 3) either boosts HIGH activation (strong demand) OR downgrades to LOW (dead-on-arrival) even if quality/safety look fine.

**Not blocking Phase 3.** Phase 3 ships with Era 1 signals only. Era 3 extension is a separate future phase, tracked here so the contract does not need re-writing when monetisation lands.

---

## 2 · Score formula (proposal)

Two orthogonal outputs · both must be computed:

- **`quality_score` ∈ [0, 1]** — how strong is the evidence?
- **`safety_score` ∈ [0, 1]** — how safe is auto-activation?

Both scores must pass their tier thresholds for a candidate to be classified into that tier. A candidate with `quality=HIGH` but `safety=LOW` is downgraded to MEDIUM.

### 2a · quality_score

Weighted sum, clamped to [0, 1]:

| Signal | Weight | Contribution formula |
|---|---|---|
| S1 `business_count` | 0.30 | `min(business_count / 300, 1.0)` — asymptotes at 300 |
| S2 `cycle_count` | 0.20 | `min(cycle_count / 8, 1.0)` — asymptotes at 8 cycles |
| S3 `observation_span_days` | 0.15 | `min(observation_span_days / 14, 1.0)` — asymptotes at 2 weeks |
| S4 `osm_tag_strength` | 0.15 | `explicit-tag=1.0 / semi-explicit=0.6 / fuzzy=0.2` |
| S5-S7 completeness (avg) | 0.10 | `(contact + coord + address) / 3` |
| S12 `geographic_clustering` | 0.10 | direct ratio |

### 2b · safety_score

Multiplicative penalties · starts at 1.0 · each hazard multiplies:

| Signal | Multiplier |
|---|---|
| S9 `keyword_collision_risk` = true | × 0.0 (hard block) |
| S10 `route_collision_risk` = true | × 0.0 (hard block) |
| S13 `duplicate_of_existing` = true | × 0.0 (hard block) |
| S14 `superseded` = true | × 0.0 (hard block) |
| S4 `osm_tag_strength = fuzzy` | × 0.6 |
| S12 `geographic_clustering < 0.4` | × 0.7 |
| S8 `language_coverage != both` | × 0.85 |
| S11 `image_evidence_count == 0` | × 0.9 |

---

## 2c · Parent-vs-focused-subdirectory distinction (Philip 2026-08-23 · design flag · not yet implemented)

**Observation from first real calibration run:** all three initial candidates (`restaurant`, `coffee-cafe`, `fast-food`) triggered `keyword_collision` (safety × 0.0) because their brain_keywords overlapped with the active `/food` Registry entry (`food`, `restaurant`).

The hard-block correctly protected the Registry from a duplicate `/restaurant` when `/food` already exists.

**But** the hard-block also implicitly asserts: *"child of an active category can never become its own directory."* That's too strong.

There are two conceptually different collisions:

| Type | Example | Correct action |
|---|---|---|
| **❌ Duplicate collision** | Candidate `hotel` when Registry `hotel` already exists | Hard-block (× 0.0) — activating would be a data corruption |
| **🟡 Semantic overlap with parent** | Candidate `coffee-cafe` when parent `food` is Registry-active | Soft signal — a focused `/coffee-cafe` COULD legitimately exist if commercial evidence justifies it |

**Current Era-1 scorer treats both cases identically (hard-block).** That's the safe default for Era 1 but must not become permanent.

**Future refinement (Era 2 or Era 3 · post-calibration):**

- Detect the specific collision type by comparing the candidate's `suggested_parent_vertical` against Registry entries. If the collision is with the PARENT (same vertical, keyword match), classify as `parent-overlap` not `keyword-collision`.
- `parent-overlap` gets a SOFT multiplier (e.g. × 0.7) instead of × 0.0.
- Era 3 commercial signals (customer demand, enquiries, leads on THAT specific sub-slug) can further boost or downgrade.

**Not implemented now** because:
- We don't yet have enough calibration data to know how often parent-overlap fires vs true duplicates.
- Era 3 signals aren't wired yet (no monetisation data source).
- Locking a "soft parent-overlap" multiplier now would be inventing numbers — the same anti-pattern Philip flagged for thresholds.

**Doctrine note:** `keyword_collision` hard-block stays × 0.0 in the code until:
1. Calibration data shows N ≥ ~5 parent-overlap cases where humans would have said "yes, focused sub-directory is legitimate."
2. Era 3 commercial signals exist to justify individual sub-directory activations.
3. Philip approves a doctrine amendment introducing the soft-parent-overlap multiplier.

Until then, the 3 current candidates are recorded as **calibration-negative safety-baseline examples** in `nex.category_candidate_calibration_annotation` (verdict = LOW · reason = "parent-overlap with active /food · Era-1 correctly blocks · Era 3 revisit").

---

## 3 · Tier thresholds (PLACEHOLDER · deliberately unlocked)

**Philip 2026-08-23:** *"I would NOT lock 0.85 / 0.90 as final until we see real candidates."*

Initial working values (to be replaced by calibration once real candidates arrive):

| Tier | Working rule |
|---|---|
| **🟢 HIGH** (AUTO-LIST) | `quality_score >= 0.85` AND `safety_score >= 0.90` |
| **🟡 MEDIUM** (HQ REVIEW) | `quality_score >= 0.50` AND `safety_score >= 0.50` (and not HIGH) |
| **🔴 LOW** (FAILED) | anything else |

**Calibration protocol (Era 1 → Era 2 handoff):**
1. Phase 3 ships with these placeholder thresholds AND the kill switch DEFAULT OFF (G3). Result: **every candidate downgrades to MEDIUM regardless of score.** The scorer runs and records scores, but no auto-activation happens.
2. Walker keeps collecting. Candidates accumulate. HQ reviewers approve/reject/etc. via Phase 2.
3. After N ≥ ~10 real candidates have received human decisions, run a **calibration report** comparing the scorer's output against actual human decisions. Look for:
   - What quality/safety scores did human-approved candidates typically have?
   - What scores did human-rejected candidates typically have?
   - Is there a clean gap where all humans said "yes" above threshold X?
4. **Only after calibration report is reviewed** does Philip approve real thresholds + flip the kill switch on for HIGH auto-activation.
5. Era 2 thresholds live in a doctrine amendment · never hot-patched in code.

**Design intent (Era 1 · until calibration):**
- HIGH should be RARE (target: <10% of candidates in the first 6 months) — better a false-negative that goes to MEDIUM than a false-positive that publishes a bad directory.
- LOW should catch (a) collisions, (b) fuzzy-only OSM signal without volume, (c) short observation windows.
- MEDIUM is the default landing pad — Phase 2 UI already handles this.
- **Kill switch OFF by default means Era 1 is effectively "scorer runs but every candidate lands in MEDIUM."** This is intentional. It generates calibration data without letting the scorer publish anything unsupervised.

---

## 4 · Tier behaviors

### 🟢 HIGH · AUTO-LIST

Factory activation engine (Phase 3, not yet built):

1. Runs the full activation validation suite (regression tests, image fallback available, Brain keyword non-collision confirmed live).
2. If validation passes:
   - `INSERT INTO nex.category_registry` with `active=true`, `activated_by='factory:auto:high-score'`, `origin_candidate_id`.
   - Update `nex.category_candidate` → `admin_decision='approved'`, `admin_reviewed_by='factory:auto:high-score'`, `admin_reviewed_at=now()`, `admin_notes='auto-activated · quality=X · safety=Y'`.
   - Wire route + wheel + Brain intent + image resolver via the shared Factory primitives.
   - Emit HQ notification (Reception strip banner) so reviewers see every auto-activation.
3. If validation FAILS: downgrade to MEDIUM automatically. Never silently activate.

### 🟡 MEDIUM · HQ REVIEW

- Candidate remains `admin_decision='pending'`.
- Surfaces in the existing Phase 2 UI (`/nex-head-quarters/directory-factory`).
- Human decides Approve / Reject / Duplicate / Superseded (existing four-button flow).
- On Approve, Factory activation engine runs the SAME validation as HIGH (a human approval does not skip validation — it only bypasses the score gate).

### 🔴 LOW · FAILED

- Candidate marked `admin_decision='rejected'`, `admin_reviewed_by='factory:auto:low-score'`, `admin_notes='auto-rejected · quality=X · safety=Y · reason=<primary hazard>'`.
- Does NOT appear in Phase 2 pending list.
- Still visible in the "Recently decided" audit tail.
- Walker can re-propose the same slug in a future cycle if more evidence accumulates — the partial-unique index only blocks *active* pending/approved rows.

---

## 5 · Safeguards for HIGH auto-activation

Locked before Phase 3 ships:

- **G1 · Rate limit:** at most **N=1 auto-activation per 24 hours** (initial · tunable in a follow-up doctrine). Excess candidates that would qualify HIGH are automatically downgraded to MEDIUM until the rate window opens.
- **G2 · Reversibility:** every auto-activated category is one HQ click away from `active=false`. Registry row + candidate history preserved so a downgrade is not data loss.
- **G3 · Kill switch:** a global env var `NEX_FACTORY_AUTO_ACTIVATION_ENABLED=1` gates all auto-activation. If unset (or set to 0), Factory downgrades every candidate to MEDIUM regardless of score. Default = **off** (opt-in).
- **G4 · HQ notification:** every auto-activation writes a Reception-strip banner + a row in a `nex.factory_activation_log` audit table (schema to be defined in Phase 3 plan).
- **G5 · New-category quarantine badge:** every auto-activated directory renders a small "Recently discovered · under monitoring" badge on the public directory page for the first N cycles / D days. Reviewers can remove the badge from HQ.
- **G6 · Hard blocks in safety_score:** collision/duplicate/superseded flags multiply the safety score by **0.0** — mathematically impossible to reach HIGH threshold. This is defence in depth on top of the validation suite.

---

## 6 · Integration with existing phases

- **Phase 1 (Walker candidate writer):** unchanged. Continues writing PENDING candidates with the current thin evidence. No new signals need to be captured at write time — the scorer computes them at classification time from existing tables.
- **Phase 2 (HQ review surface):** unchanged for MEDIUM tier. HIGH tier candidates never appear in the pending list (they're already `approved` by the auto-activator). LOW tier never appears there either (they're already `rejected`). The "Recently decided" section shows all tiers uniformly.
- **Phase 3 (Factory activation engine):** must implement:
  1. The scorer function `scoreCandidateById(id) → { quality, safety, tier, primary_hazard }`.
  2. A batched classification pass that runs after Walker cycles OR on an HQ button OR on cron (design TBD in Phase 3 plan).
  3. The auto-activation path for HIGH (with safeguards G1-G6).
  4. The auto-rejection path for LOW (with the reason in admin_notes).
  5. The MEDIUM downgrade behavior when rate limit / kill switch / validation blocks HIGH.

---

## 7 · Open questions

**Q1-Q6 are deliberately UNANSWERED until Era 2 calibration** (Philip 2026-08-23):

| # | Decision | Status |
|---|---|---|
| **Q1** | HIGH tier thresholds | 🔒 **Placeholder 0.85 / 0.90 · not to be locked until calibration report** |
| **Q2** | MEDIUM tier lower bound | 🔒 Placeholder 0.50 / 0.50 · same |
| **Q3** | Weights in quality_score | 🔒 Placeholder · reweight after real data |
| **Q4** | Rate limit N per 24h | 🔒 Placeholder = 1 · revisit after calibration |
| **Q5** | Kill switch default | ✅ Confirmed **OFF** (Era 1 · scorer runs but every candidate lands in MEDIUM) |
| **Q6** | Quarantine badge duration | 🔒 Placeholder 30 days OR 2000 businesses · revisit |

**Q7-Q10 · answerable now (still design-only until Phase 3 plan drafted):**

| # | Decision | Options |
|---|---|---|
| **Q7** | Where the scorer runs | (a) after each Walker cycle in `run-live-cycle.mjs` isolated try/catch/timeout (Phase 1 pattern) · (b) periodic cron · (c) HQ-triggered batch. **Recommendation: (a) initially · every candidate auto-scored on write.** |
| **Q8** | Does the Phase 1 writer need to enrich `evidence` to store OSM-tag-strength up front? | Compute live in the scorer (no Phase 1 change) is simpler and re-runnable · enriching now bakes today's understanding into the row |
| **Q9** | Auto-detect potential duplicates before human labels them? | Yes (phase 3 pre-check) · no (only humans flag). Recommendation: yes with high confidence threshold · flag as candidate-of-candidate but never auto-mark |
| **Q10** | Auto-reject LOW candidates? | Auto-reject with reason · OR leave in pending forever. Recommendation: **leave in pending** so a later scoring pass (with better calibration) can promote them — auto-reject is a lossy operation |

---

## 7b · Era 3 questions (deferred until monetisation live)

- Commercial signal weights vs safety/quality
- How to handle a HIGH-safety category that shows ZERO commercial activity after N cycles (silent-deactivation candidate?)
- Whether Era 3 should be ABLE to override Era 1 (e.g. massive demand for a technically-fuzzy category)
- Whether owner response rate should hard-block auto-activation (a category with 0 owners engaging is dead)

---

## 8 · What Phase 3 must NOT do

- ❌ Skip the Phase 2 review flow for MEDIUM candidates.
- ❌ Activate ANY candidate without the validation suite passing (regression tests · image fallback available · Brain non-collision · route uniqueness).
- ❌ Modify the score formula silently. Any change to weights or thresholds must be a doctrine update, not a code hot-patch.
- ❌ Store the score as a hardcoded column that can't be recomputed. Scorer must be deterministic and re-runnable.
- ❌ Auto-activate when `NEX_FACTORY_AUTO_ACTIVATION_ENABLED` is unset (kill switch).
- ❌ Exceed the rate limit.
- ❌ Auto-activate categories that would collide with existing Registry ids, routes, or Brain keywords.
- ❌ Publish a directory that doesn't have at least a `CATEGORY_FALLBACK` image URL for its `parent_vertical` in `categoryFallbackLibrary`.
- ❌ Bypass the "Discovery ≠ Outreach" Walker doctrine (Gate 5 remains hard-noop).

---

## 9 · Files that WOULD be created / modified in Phase 3 (design only)

**Not created by this document. Listed for approval clarity:**

- `docs/nex/directory-factory-phase-3-plan.md` — the detailed activation-engine plan.
- `deploy/postgres/init/084_nex_factory_activation_log.sql` — audit log table for every activation attempt (accepted/rejected/downgraded).
- `src/lib/nex/factory/scoreCandidate.ts` — the deterministic scorer.
- `src/lib/nex/factory/activateCandidate.ts` — the activation engine (validation + Registry INSERT + wire routes + wheel + Brain + image resolver).
- `src/lib/nex/factory/safeguards.ts` — rate limit + kill switch + collision checks.
- Extension to `scripts/nex-acquisition/run-live-cycle.mjs` — call the scorer/classifier after `proposeCategoryCandidates`, in a fresh try/catch/timeout block (Phase 1 pattern).
- Extension to `src/app/nex-head-quarters/directory-factory/page.tsx` — surface `quality_score / safety_score / tier` badges on candidate cards + notification of auto-activations.

---

## 10 · What's already in place (nothing to redo)

- Phase 0 Registry + Candidate schema (migrations 082 + 083) — supports all needed columns.
- Phase 1 Walker candidate writer — accumulates evidence 24/7. Zero changes required for scoring to begin.
- Phase 2 HQ review surface — MEDIUM tier already routes here. Only visual additions needed (score/tier badges).
- Truth Invariant + Walker-stays-pure + Universal Image doctrines — all still binding.

---

## 11 · Confirmation of zero code / schema changes

At the moment of writing this document:
- No file in `src/**` was modified.
- No migration file was created in `deploy/postgres/init/**`.
- No file in `scripts/**` was modified.
- No route was created or altered.
- No DB was migrated.
- No test file was created or modified.

The only artifacts of this exchange are:
1. This document (`docs/nex/directory-factory-scoring-contract.md`).
2. The amendment header appended to `.claude/projects/C--Users-Victus/memory/project_nex_directory_factory_doctrine_2026_08_22.md`.

**Status after 2026-08-23 Philip review:**
- Architecture: ACCEPTED
- Scoring contract as a doctrine: ACCEPTED
- Specific numbers (Q1-Q4, Q6): **deliberately not locked** — placeholders live in code as Era 1, replaced by calibrated values as Era 2
- Kill switch (Q5): confirmed OFF by default
- Q7-Q10: still awaiting design decisions before Phase 3 plan drafts

**Governing quote (Philip 2026-08-23):**
> "NEX discovers → NEX evaluates → NEX safely expands → humans handle exceptions → NEX learns what works. That's how this becomes a genuinely self-expanding platform rather than another directory that needs an administrator feeding it manually."
