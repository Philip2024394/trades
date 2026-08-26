# NEX Business Listing Scorer · ≥90 Auto-List Contract (v0.1 · 2026-08-23)

**Status:** DRAFT · awaiting Philip approval
**Doctrine anchor:** `project_nex_90pct_business_listing_doctrine_2026_08_23`
**Supersedes on auto-list:** Task #88 Phase 1 "no auto-promotion" lock

---

## 1 · Design objective

Produce a per-listing `(QUALITY: 0-100, SAFETY: PASS|REVIEW|FAIL)` verdict such that:

- **QUALITY ≥90 AND SAFETY=PASS → AUTO-LIST** (promotion engine flips `claim_status: discovered → listed`)
- **QUALITY 60-89 OR SAFETY=REVIEW → HQ REVIEW** (surfaces in HQ · never on public directory)
- **QUALITY <60 OR SAFETY=FAIL → INVISIBLE** (stays discovered · flagged for enrichment / purge)

The scorer must be:

1. **Vertical-agnostic** — one implementation scores food, accommodation, and future verticals from a common evidence shape.
2. **Calibrated for real data** — ≥90 must be achievable by a genuinely excellent listing (not aspirationally impossible). Diagnostic dry-run against the current 1320 discovered rows below.
3. **Truth-invariant** — every earned point references real evidence with provenance. No fabricated signals.
4. **Explainable** — the per-tier breakdown makes it obvious to admin why any given listing landed at its score.

## 2 · Why the current scorer needs replacing (evidence)

Dry-run of `scoreBusiness()` from `scripts/nex-promotion/quality-score.mjs` against **1320 real discovered rows** (439 food + 881 accommodation):

| Metric | Food (439) | Accommodation (881) |
|---|---|---|
| Rows ≥90 | **0** | **0** |
| Max observed | 80 | 85 |
| Median | 50 | 45 |
| Mean | 51.3 | 51.2 |

**Root cause — points lost per criterion (average across all rows):**

| Criterion | Food avg loss | Accom avg loss | Diagnosis |
|---|---|---|---|
| contact (WA/phone) | **-13.75** | **-14.02** | Only 5.5% food · 0.1% accom have contact — OSM rarely populates |
| website | -9.86 | -9.38 | Only 1.4% food · 6.2% accom — OSM rarely populates |
| freshness (2yr window) | -7.54 | -7.06 | Only 24.6% food · 29.4% accom pass — OSM tags age quickly |
| social | -5.00 | -5.00 | **0% have social links** in either vertical |

The current scorer punishes rows for **data OSM doesn't provide**, not for actual quality. Meanwhile it credits nothing for signals that DO exist and matter (star_rating, room_count, amenities on accommodation; source-agreement across enrichment; category-tag directness; coord precision; identity strength).

## 3 · Proposed scoring contract (v0.1) · 100-point scale

### 3a · Mandatory floors (0 pts but required · failure caps QUALITY at 40)

A listing that fails ANY mandatory floor cannot exceed QUALITY=40 regardless of other evidence. These are the "cannot auto-list without this" invariants:

- `MAND_NAME` — real name · length ≥3 · not `unnamed / unknown / n/a / test`
- `MAND_COORD` — valid lat/lng · within vertical/city bbox · not (0,0) · not GPS placeholder
- `MAND_CATEGORY` — category from vertical whitelist (food: 4-value enum · accom: 7-value enum)

### 3b · Tier A · CORE IDENTITY (40 pts)

Every listing scores here — this is the "who is this business" foundation.

| Field | Max | Rule |
|---|---|---|
| Identity strength | 10 | 5 base for real name + 5 if name ≥8 chars AND has ≥2 distinct words (rejects generic tags) |
| Location precision | 15 | 5 for valid coords + 5 if within tight city polygon (not just bbox) + 5 if coords have ≥5 decimal places (~1m precision) |
| Address quality | 10 | 3 if any non-blank address + 3 if contains street number (digit) + 2 if district populated + 2 if city populated |
| Category confidence | 5 | 5 if category derived directly from OSM primary tag (tourism=hotel · amenity=restaurant) · 3 if classifier-inferred from secondary tags · 0 if guessed from name |

### 3c · Tier B · CONTACTABILITY (20 pts · with compensation)

The single-most-empty tier on real data. Designed so **any two channels earn full 20 pts** — a business with WA + website scores as "highly contactable" even if OSM lacks phone.

| Channel | Points if present |
|---|---|
| WhatsApp | 12 |
| Phone | 8 |
| Website | 8 |
| Social (any platform) | 5 |

- **Take the highest 20-point-cap combination.** WhatsApp + website = 20 (capped). Phone + website + social = 20 (capped). WhatsApp alone = 12. Nothing = 0.
- **Compensation ceiling is 20**, so no listing gets "over-credited" for having six channels.

### 3d · Tier C · FRESHNESS + PROVENANCE (20 pts)

Signals that make NEX confident this listing IS this business, and RECENTLY.

| Signal | Max | Rule |
|---|---|---|
| Freshness (graceful decay) | 10 | 10 if `last_verified_at` within 12 mo · 6 if 12-24 mo · 3 if 24-36 mo · 0 if older/null |
| Provenance depth | 5 | 5 if ≥3 independent `field_provenance` sources · 3 if 2 sources · 0 if 1 source |
| Source agreement | 5 | 5 if name+address+coords AGREE across ≥2 sources · 3 if 2 of 3 agree · 0 if single-source (nothing to compare) |

### 3e · Tier D · VERTICAL EVIDENCE (20 pts · plug-in per vertical)

Each vertical registers its own 20-pt slate — same scorer function, vertical-specific evidence weights.

**Accommodation (20 pts):**

| Signal | Max | Rule |
|---|---|---|
| Star rating with source | 6 | 6 if star_rating set AND star_rating_source is reputable (OSM verified / owner / Google) |
| Room count | 3 | 3 if room_count > 0 |
| Amenities richness | 6 | (count of amenities) → 0/2/4/6 for 0/1-2/3-5/6+ |
| Third-party rating | 5 | 5 if rating IS set AND review_count ≥3 |

**Food (20 pts):**

| Signal | Max | Rule |
|---|---|---|
| Opening information | 8 | 8 if `opening_information` JSONB has ≥1 day populated |
| Secondary category tokens | 8 | 4 base if `categories[]` non-empty · +4 if ≥2 approved secondary tokens |
| Third-party rating | 4 | 4 if rating set AND review_count ≥3 |

### 3f · Score bands (revised)

| QUALITY | Meaning | Combined with SAFETY=PASS |
|---|---|---|
| **≥90** | Excellent · genuinely publish-ready · multi-source, contactable, fresh, vertical-rich | **AUTO-LIST** |
| 75-89 | Strong but incomplete · one tier weak | HQ REVIEW · likely-approve |
| 60-74 | Middle · needs enrichment before publish | HQ REVIEW · admin adjudicates |
| 40-59 | Thin evidence · publish-blocked | INVISIBLE · flagged for enrichment |
| <40 | Mandatory floor failed · unfit | INVISIBLE · candidate for purge |

## 4 · SAFETY axis · design contract

SAFETY is a **veto**, independent of the QUALITY score. Any signal below → SAFETY=FAIL. Soft signals → SAFETY=REVIEW.

### 4a · FAIL signals (auto-list blocked absolutely)

- `SAFETY_DUPLICATE` — `dedupe_hash` collision with an EXISTING `listed/claimed/paying` row (never publish a duplicate)
- `SAFETY_IDENTITY_COLLISION` — same name (normalised) + coords within 50m of an EXISTING owner-claimed row from a different source (owner claim wins)
- `SAFETY_COORD_INVALID` — outside vertical's city polygon · null · (0,0)  (mandatory floor overlap · double-checked here)
- `SAFETY_NAME_PLACEHOLDER` — regex match for `test / tbd / xxx / example / lorem` etc.
- `SAFETY_PHONE_PLACEHOLDER` — all same digit · sequential (12345) · +1 555 · known test numbers
- `SAFETY_WEBSITE_PLACEHOLDER` — example.com · localhost · IP-only · known test domains
- `SAFETY_CONFLICTING_EVIDENCE` — two sources disagree on the SAME field with equal weight AND no resolution rule (e.g. two names, neither owner-provenanced)

### 4b · REVIEW signals (queued for admin adjudication, never auto-list)

- `SAFETY_THIN_PROVENANCE` — single source claiming a QUALITY≥90 listing (source agreement never possible with n=1)
- `SAFETY_STALE_ONLY` — last_verified_at > 3 years AND no enrichment update
- `SAFETY_ISOLATED_COORDS` — no other businesses within 500m radius (possible ghost / mis-geocode)
- `SAFETY_UNEXPECTED_CATEGORY_FOR_LOCATION` — e.g. "hotel" in a residential-only zone (needs a district-purpose lookup we don't have yet · deferred)

### 4c · PASS

Default when no FAIL or REVIEW signal fires.

## 5 · Dry-run projections (proposed scorer vs current data)

**⚠️ Deferred until Philip approves Section 3 tier weights.** Once approved, `scripts/nex-promotion/_analyse-proposed-scorer.mjs` runs the design against all 1320 rows and reports:

- New band distribution per vertical
- % that would auto-list under `QUALITY≥90 AND SAFETY=PASS`
- % that would land in HQ REVIEW
- Top 5 reasons rows fall short of 90 (per vertical)

If the answer is still "0 auto-list" that's a **data enrichment problem**, not a scorer problem — the correct response is to build the enrichment pipeline (2nd-source cross-reference · owner-claim funnel · contact discovery), not to lower the bar.

## 6 · Non-changes preserved

- **Walker stays pure acquisition** — Walker never touches this scorer.
- **Truth Invariant** — every earned point references a real DB field with provenance.
- **Task #88 Phase 1 non-behaviours preserved for Phase 2 promotion engine** — no outreach on auto-list · no owner-invite · no third-party publish.
- **HQ Directory Factory** untouched — that's category-level scoring · this is business-level.

## 7 · Open questions for Philip

1. **Middle-band split** — is the "HQ REVIEW" band `60-89` (single wide band) or `60-74` (needs enrichment) + `75-89` (likely-approve, faster review)?
2. **Enrichment triggers** — should QUALITY 40-59 automatically trigger a second-source enrichment attempt (Google Places · Wikidata) before HQ Review, or is that a separate future subsystem?
3. **Cross-vertical calibration** — should Tier D weights sum to exactly 20 per vertical (as designed) or should verticals with richer evidence (accommodation) legitimately outscore thin verticals (food) on a `120-cap` allowance?
4. **SAFETY=REVIEW routing** — do REVIEW-flagged rows go to the HQ Directory Factory Candidates page (existing UI) or need a dedicated HQ "Safety Review" queue?
5. **Freshness for accommodation** — hotels/villas don't update OSM tags as often as restaurants. Should the freshness window be per-vertical (24 mo for accom · 12 mo for food) rather than global?
6. **Publisher gate** — once auto-list flips `claim_status='listed'`, does the row also need `hero_image_approved=true` before appearing on the public directory (existing image doctrine), or can text-only listings surface?

## 8 · Implementation staging (AFTER approval · not now)

1. Prototype `scoreBusinessV2()` as design tool · run dry-run against real data · report numbers.
2. Philip signs off on tier weights + SAFETY signals.
3. Create `nex.business_listing_score` overlay table (polymorphic across verticals via `vertical` + `business_ref` composite key) + audit table.
4. Refactor `run-quality-check.mjs` to be vertical-agnostic + run non-stop alongside acquisition walkers.
5. Build `nex.promotion_engine` component — reads overlay, checks `QUALITY≥90 AND SAFETY=PASS`, flips `claim_status`. Kill-switch env var.
6. New HQ page: `/nex-head-quarters/promotion-review` (middle band + SAFETY=REVIEW queue).
7. Regression suite covers every SAFETY signal + auto-list edge case.
8. Kill-switch OFF → smoke test → Philip flips ON.
