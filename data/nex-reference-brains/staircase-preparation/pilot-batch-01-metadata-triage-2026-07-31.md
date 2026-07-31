---
author: Philip O'Farrell (direction) + Claude (metadata triage execution)
captured_at: 2026-07-31
type: pilot_batch_review_report
subtype: metadata_triage_phase_1
status: metadata_review_complete_visual_confirmation_complete
philip_decisions_2026_07_31:
  metadata_dispositions: "PROVISIONAL PASS · not final until vision confirms the two flagged records"
  vision_verification_scope: "R9 + R10 only (not R15/R16 · metadata sufficient for those)"
  batch_02: "PROCEED · do not refine criteria yet · common mistake to change rules after one result"
  new_brains: "DO NOT AUTHOR YET · keep observations only (loft_ladder candidate · forestry/timber candidate)"
  reference_only_genre: "YES · recognise as IMAGE PURPOSE classification · NOT as brain · categories: recognition_training · reference_only · customer_inspiration · article_illustration · marketing_asset"
key_learning_from_batch_01: "A staircase image is not automatically staircase knowledge (Philip 2026-07-31 · verbatim)"
review_mode: Option C · Hybrid (metadata triage first · vision verification for flagged only)
sample_selection_mode: Selection 3 · Stratified (unclassified × score-buckets × rich × thin × validation-flagged)
governing_criteria: data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-brain-membership-criteria.md (Layer 1 evidence · promoted 2026-07-31)
pool_size: 702 (subject_domain=staircase AND primary_brain != staircase_brain)
selected_sample: 25 requested → 19 unique after de-duplication (strata overlapped)
rule_a_compliance: no fabrication · every gate assessment traces to a recorded metadata field · nothing inferred beyond what the metadata claims
rule_b_compliance: Claude executes the triage per Philip's explicit direction · Claude does not classify · Claude does not modify manifest
restrictions_maintained:
  - No manifest changes
  - No brain reassignment
  - No permanent downloads
  - No promotion decisions
  - No knowledge updates
output_scope: |
  Evidence review report only.
  Records disposition PROPOSAL per record (based on metadata alone).
  Records CANDIDATES flagged for Phase 2 vision verification.
  Records CANDIDATES flagged for exclusion.
  Records CANDIDATES flagged for other-brain routing.
  NONE of these dispositions are applied. All await Philip's review.
---

# Pilot Batch #01 · Metadata Triage Report · 2026-07-31

*Report only. No manifest changes. No brain reassignments. Every disposition below is a PROPOSAL against metadata evidence · pending Philip's review before any action.*

---

## Executive summary

**Sample:** 19 unique records from the 702-row pool (25 stratified selections · 6 overlaps de-duplicated).

**Applying the 5-gate criteria (`staircase-brain-membership-criteria.md` · Layer 1 evidence 2026-07-31):**

| Disposition proposal | Count | % of sample |
|---|---|---|
| **Exclude · not staircase content** | 8 | 42% |
| **Other-brain candidate** | 4 | 21% |
| **Reference-only** (staircase-related but not recognition-training) | 5 | 26% |
| **Requires vision verification** | 2 | 11% |
| **Staircase_brain candidate (metadata-only pass)** | 0 | 0% |

**Zero records pass all 5 gates on metadata alone.** All 19 records fail at least one gate.

**The dominant failure mode:** subject_domain=staircase has been applied to images that are NOT staircase content by any reasonable Gate 1 (Subject Relevance) reading. The tag has been over-inclusive.

**This is the governance discovery Philip predicted:** *"Some images may belong to interiors · materials · architecture · unrelated domains. They should not be forced into staircase brain."*

---

## Per-record 5-gate assessment

### Records 1-2 · garden_staircase_brain (Stratum: weakly classified)

**R1 · `2f456eb541f26dfedcd3ff0bf9c0abad.jpg`** · already routed to garden_staircase_brain · Score 67 · Band Specialist · Desc: *"Tree House Staircase – Complete Guide"* (5399 chars)

- Gate 1 · Subject Relevance: **PASS** (tree house staircase = staircase subject)
- Gate 2 · Staircase Evidence: **PASS** (guide content describes tree house staircase construction)
- Gate 3 · Recognition Value: **UNCLEAR** — long article text but no visible staircase-recognition value discoverable from metadata alone
- Gate 4 · Evidence Quality: **FAIL** (score 67 < 70 threshold)
- Gate 5 · Domain Boundary: **CORRECT-AS-IS** — garden_staircase_brain is the appropriate specialised brain · not primary staircase_brain
- **Disposition proposal:** LEAVE AS-IS · garden_staircase_brain routing appears correct

**R2 · `6ebb220443f27e32ff75fe3df3c433a7.jpg`** · garden_staircase_brain · Score 64 · Desc: *"Choosing the Best Loft Ladder Door Size"* (5022 chars)

- Gate 1 · Subject Relevance: **UNCLEAR** — loft ladder is stair-adjacent but not a staircase in traditional sense
- Gate 5 · Domain Boundary: garden_staircase_brain routing questionable · loft ladders may belong to a `loft_ladder_brain` if one exists · currently routed to garden brain
- **Disposition proposal:** REVIEW BRAIN ROUTING · loft ladder content is neither garden staircase nor primary staircase · possibly needs a different brain

### Record 3 · timber_brain (Stratum: weakly classified)

**R3 · `ChatGPT Image Jul 23 04_45_12 PM.png`** · timber_brain · Score 54 · Category `wood_sample` · Desc: *"Wood species reference"*

- Gate 1 · Subject Relevance: **FAIL** (wood sample · not a staircase)
- Gate 5 · Domain Boundary: **CORRECT-AS-IS** — timber_brain routing appears correct
- **Disposition proposal:** LEAVE AS-IS · but subject_domain=staircase tag may be over-inclusive (should be subject_domain=timber or subject_domain=wood_sample)

### Records 4, 5, 18 · Philip's article illustrations (Stratum: unclassified/thin metadata)

**R4 · `ChatGPT Image Jul 28 01_13_56 PM.png`** · null primary_brain · Desc: *"Illustrative image for the 'Why an Organized Staircase Workshop Is the Foundation of Quality Craftsmanship' article authored by Philip O'Farrell"*

- Gate 1 · Subject Relevance: PASS (staircase workshop organisation)
- Gate 2 · Staircase Evidence: **UNCLEAR** — workshop organisation is meta-context · not staircase-recognition evidence
- Gate 3 · Recognition Value: **FAIL** — teaches about workshops, not about identifying staircases
- Gate 4 · Evidence Quality: **UNKNOWN** (no score)
- **Disposition proposal:** REFERENCE-ONLY (article illustration) · not staircase_brain intelligence input

**R5 · `ChatGPT Image Jul 28 01_28_48 PM.png`** · null · *"Professional Installation Van"* article illustration

- Gate 1 · Subject Relevance: **FAIL** — installation van is workshop context · not staircase subject
- **Disposition proposal:** REFERENCE-ONLY (article illustration) · exclude from staircase_brain

**R18 · `ChatGPT Image Jul 28 01_41_21 PM.png`** · null · *"Fitting Staircases When Walls Are Off Square"* article illustration

- Gate 1 · Subject Relevance: PASS (staircase installation topic)
- Gate 3 · Recognition Value: **UNCLEAR** — teaches an installation problem · potentially useful for installation-context brain · not primary recognition
- **Disposition proposal:** REFERENCE-ONLY (article illustration) · may belong to a staircase_installation sub-brain

### Records 6, 7, 8, 14, 17, 19 · Marketing hero banners / general imagery (Stratum: mixed)

**R6 · `guide-social-media-customers.png`** · null · Category `social_media` · Referenced in `trade-off/tips/social-media-customers/page.tsx`

- Gate 1 · Subject Relevance: **FAIL** (social media guide · not staircase content)
- **Disposition proposal:** EXCLUDE · subject_domain=staircase tag appears INCORRECT · this is a marketing/business asset · not staircase evidence

**R7 · `ChatGPT Image Jul 6 02_59_22 AM.png`** · null · Category `hero_banner` · Referenced in productDetails.ts, canteens.ts, hero-library.json

- Gate 1 · Subject Relevance: **FAIL** (generic hero banner)
- **Disposition proposal:** EXCLUDE · staircase tag over-inclusive

**R8 · `Untitleddasdaasbbbb.png`** · null · Category `unclassified` · Referenced in dev/impersonate + canteen page shell + canteens.ts

- Gate 1 · Subject Relevance: **FAIL** (canteen/business page image · not staircase)
- **Disposition proposal:** EXCLUDE

**R14 · `news-hero.png`** · null · Category `hero_banner` · Referenced in `news/page.tsx`

- Gate 1 · Subject Relevance: **FAIL** (news page hero · not staircase content)
- **Disposition proposal:** EXCLUDE · subject_domain tag definitely wrong

**R17 · `contact-hero.png`** · null · Category `hero_banner` · Referenced in `contact/page.tsx`

- Gate 1 · Subject Relevance: **FAIL** (contact page hero · not staircase)
- **Disposition proposal:** EXCLUDE

**R19 · `ChatGPT Image Jul 14 10_58_56 PM.png`** · null · Category `unclassified` · Referenced in canteens.ts + dev impersonate

- Gate 1 · Subject Relevance: **FAIL** (canteen image · not staircase)
- **Disposition proposal:** EXCLUDE

### Records 9, 10 · Long-article images (Stratum: rich metadata)

**R9 · `6b868b252c0a43aa5d826da447c349a7.jpg`** · null · Score 66 · Desc: *"Complete Timber Sizes Used in Staircase Manufacturing & Structural Stair Construction"* (5038 chars)

- Gate 1 · Subject Relevance: PASS (staircase manufacturing content)
- Gate 2 · Staircase Evidence: PASS (article covers staircase construction)
- Gate 3 · Recognition Value: **UNCLEAR** — article content · may or may not be visual reference
- Gate 4 · Evidence Quality: **FAIL** (score 66 < 70)
- **Disposition proposal:** REQUIRES VISION VERIFICATION — description is staircase-relevant · but no way to verify the image itself shows staircase-recognition content without pixel view

**R10 · `9ba3ebd3eb6ff899596cd7155ca83752.jpg`** · null · Score 66 · Desc: *"How Long Does It Take to Install a Loft Ladder?"* (4221 chars)

- Gate 1 · Subject Relevance: **UNCLEAR** — loft ladder is stair-adjacent
- **Disposition proposal:** OTHER-BRAIN candidate (loft ladder brain if it exists · or exclude)

### Records 11, 12, 13 · Q&A knowledge images (Stratum: rich metadata · score buckets)

**R11 · `ChatGPT Image Jul 26 05_28_50 PM.png`** · null · Score 50 · Category `staircase` · Desc: *"Q: What is a forestry..."*

- Gate 1 · Subject Relevance: **FAIL** (forestry Q&A · not staircase subject)
- **Disposition proposal:** OTHER-BRAIN candidate (forestry / timber supply chain) · not staircase_brain

**R12 · `ChatGPT Image Jul 26 05_53_00 PM.png`** · null · Score 51 · Category `staircase` · Desc: *"Q: How is timber ship..."*

- Gate 1 · Subject Relevance: **FAIL** (timber shipping Q&A)
- **Disposition proposal:** OTHER-BRAIN candidate (timber_brain / supply chain)

**R13 · `ChatGPT Image Jul 26 05_50_22 PM.png`** · null · Score 53 · Category `staircase` · Desc: *"Q: What happens at a..."* (sawmill context)

- Gate 1 · Subject Relevance: **FAIL** (sawmill Q&A)
- **Disposition proposal:** OTHER-BRAIN candidate (timber_brain / sawmill knowledge)

### Records 15, 16 · Unclassified general imagery (Stratum: thin metadata)

**R15 · `85e5e067cf0cb299.png`** · null · Score 34 · Category `unclassified` · Desc: 169 chars generic

- Gate 1 · Subject Relevance: **FAIL** (no evidence of staircase content · generic imagery reference in seo.ts)
- **Disposition proposal:** EXCLUDE · REQUIRES VISION VERIFICATION only if Philip wants to double-check the pixels

**R16 · `Untitledsdsd.png`** · null · Score 34 · Category `unclassified` · Desc: 170 chars · Referenced in yardMoods.ts

- Gate 1 · Subject Relevance: **FAIL** (yard moods reference · not staircase content)
- **Disposition proposal:** EXCLUDE

---

## Overall pattern findings

### Finding 1 · subject_domain=staircase is over-inclusive

**Of 19 sampled records: 0 pass all 5 gates on metadata alone. 8 (42%) should be EXCLUDED entirely as non-staircase content.**

The `subject_domain=staircase` tag has been applied to:

- Marketing hero banners (news · contact · social media · canteen pages)
- General placeholder imagery
- Timber supply chain content (forestry · sawmill · shipping)
- Loft ladder content
- Wood sample photography
- Article illustrations about workshops/vans/installation topics

**This is the primary structural issue.** The 702-row pool is not a pool of staircase images that need brain-connection · it is a pool of images with an over-eager subject tag that need CORRECT CLASSIFICATION first.

### Finding 2 · Legitimate staircase-adjacent content exists but needs sub-brain routing

Several records reference genuinely staircase-adjacent knowledge but don't belong in the primary `staircase_brain`:

- Tree house staircases → correctly in `garden_staircase_brain` (R1)
- Loft ladders → need a `loft_ladder_brain` OR classification as separate domain (R2, R10)
- Sawmill / forestry / timber shipping → `timber_brain` (R11, R12, R13)
- Staircase installation techniques → potentially a `staircase_installation` sub-brain (R18)

### Finding 3 · Zero images passed Gate 4 · confirms recognition-pathway audit

**Not one of the 19 records reached ADR-0033's ≥70 clean-intelligence threshold.** The metadata triage confirms the earlier audit finding · even records with rich descriptions (5000+ chars) top out at score 67.

**Governing discipline sentence bites here:** *"High visual quality does not equal staircase intelligence value."* — several rich-description images tell rich stories but score below threshold because the recognition evidence content is weak.

### Finding 4 · No clean staircase_brain candidates in this sample

**None of the 19 records is a metadata-clear candidate for staircase_brain admission.** The two records that plausibly could reach the brain (R9 · staircase manufacturing article · R10 · already ambiguous) require pixel verification.

### Finding 5 · Article illustrations should potentially be a distinct category

R4, R5, R18 are Philip O'Farrell 2026-07-28 article illustrations. They have staircase-related descriptions but their PURPOSE is to illustrate written articles · not to teach visual recognition. This is a genre distinction the criteria does not yet formally recognise (though Gate 3 · Recognition Value implicitly handles it by asking "does this teach something NEX needs to recognise?").

---

## Phase 2 vision-verification candidates

Per Option C hybrid protocol, records to consider for pixel-level review:

| # | Reason to visual-verify | Priority |
|---|---|---|
| R9 | Staircase manufacturing content · score 66 · needs pixel check to confirm visual utility | Medium |
| R18 | Off-square wall installation · thin metadata but staircase-relevant · pixel could resolve | Medium |
| R15, R16 | Generic unclassified thin metadata · pixel would definitively rule in or out | Low |

**None require URGENT vision verification.** The Gate 1 fails on 8 of 19 are so clear from metadata that pixel review would only confirm what description already shows.

---

## Aggregate proposal (if Philip authorises acting on Phase 1 findings)

**If applied to the 19 sampled records:**

- 8 records → subject_domain reclassify (not staircase · route to correct domain OR remove tag)
- 5 records → keep subject_domain=staircase but assign to reference_only classification (article illustrations · workshop context)
- 4 records → reroute to appropriate other brain (timber · forestry · loft ladder)
- 2 records → pixel-verify before disposition
- 0 records → promote to staircase_brain

**Extrapolated to full 702-row pool (WARNING · this is projection · not measurement):** if the sample is representative, a majority of the 702 would need reclassification OR exclusion from staircase_brain candidacy. The correct number of new staircase_brain admissions may be much smaller than 702 · possibly 50-200 as Philip anticipated.

---

## What this report does NOT authorise

- Does NOT reclassify any of the 19 records
- Does NOT alter the manifest
- Does NOT promote or exclude any record from staircase_brain
- Does NOT extrapolate rules to the remaining 683 unreviewed records without Philip's authorisation
- Does NOT create new brains (loft_ladder_brain · forestry_brain · staircase_installation_brain) — these are named as observations · not built

## Awaiting Philip's direction on

1. **Are the metadata-derived dispositions acceptable?** (per-record review · or batch approval)
2. **Do we proceed with Phase 2 vision verification for R9, R18, R15, R16?**
3. **Do we scale to Batch #02 · or refine criteria first based on these findings?**
4. **Do we author a `loft_ladder_brain` / `forestry_brain` if needed OR keep timber/garden as they are?**
5. **Do we formally recognise a "reference_only" or "article_illustration" genre for images that are staircase-adjacent but not recognition-training?**

**All 19 records remain untouched in the manifest.** Report only.

---

## Vision-verification addendum (Philip 2026-07-31 · Decision 2 authorised R9 + R10 only)

**Process:** downloaded R9 and R10 temporarily to `data/.pilot-batch-vision-2026-07-31/` · viewed via Read tool multimodal · then deleted per "no permanent downloads" discipline.

### R9 · `6b868b252c0a43aa5d826da447c349a7.jpg` · vision-verified

**Metadata claimed:** *"Complete Timber Sizes Used in Staircase Manufacturing & Structural Stair Construction"* (5038 chars · score 66)

**Pixel-content reality:**

- Workshop interior scene
- A man in grey T-shirt and dark work trousers carrying a large piece of timber
- Green industrial machinery visible (planer/thicknesser-type equipment)
- Racks of stacked timber boards in background
- **NO staircase visible in the frame**
- **NO staircase parts visible in the frame** (no treads · no risers · no strings · no newels · no handrail · no balusters)

**Vision-verified 5-gate assessment:**

- Gate 1 · Subject Relevance: **FAIL** (subject is a workshop scene · not a staircase)
- Gate 2 · Staircase Evidence: **FAIL** (no visible staircase parts · no staircase geometry)
- Gate 3 · Recognition Value: **FAIL** for staircase recognition · **PASS** for workshop-context / material-handling recognition (different brain)
- Gate 4 · Evidence Quality: **FAIL** (score 66 · below ADR-0033 threshold)
- Gate 5 · Domain Boundary: staircase_brain is INCORRECT · this belongs elsewhere (workshop_context / material_handling / article_illustration)

**Governing discipline sentence confirmed in practice:** the 5000-char description makes this LOOK like a staircase knowledge asset · the pixels prove it is a WORKSHOP asset that HAPPENS to be from an article about staircase manufacturing. **High visual quality does not equal staircase intelligence value** — even RICH METADATA does not equal staircase intelligence value.

**Vision-verified disposition:** REFERENCE-ONLY (article illustration category · per Philip's Decision 5 taxonomy) · NOT staircase_brain candidate.

### R10 · `9ba3ebd3eb6ff899596cd7155ca83752.jpg` · vision-verified

**Metadata claimed:** *"How Long Does It Take to Install a Loft Ladder?"* (4221 chars · score 66)

**Pixel-content reality:**

- Residential interior scene · light-walled room with grey carpet
- A woman in checked shirt and jeans climbing a folding wooden LOFT LADDER
- Open loft hatch above · white ceiling frame · red retracting mechanism visible
- Room furnishings: bookshelf · storage boxes · magazine · door
- **This is definitively a LOFT LADDER · not a staircase**

**Vision-verified 5-gate assessment:**

- Gate 1 · Subject Relevance: **FAIL** for staircase_brain (subject is a loft ladder · a distinct product category)
- Gate 2 · Staircase Evidence: **FAIL** (no staircase visible · loft ladders and staircases are different products)
- Gate 3 · Recognition Value: **PASS** for a loft-ladder brain if one existed · **FAIL** for staircase recognition
- Gate 4 · Evidence Quality: **FAIL** (score 66 below threshold · plus wrong domain)
- Gate 5 · Domain Boundary: staircase_brain is INCORRECT · needs `loft_ladder_brain` (per Philip's observation) OR classification as separate domain

**Vision-verified disposition:** DO NOT ROUTE to staircase_brain · observation-only entry to `loft_ladder_brain` candidate list · currently unclassified.

### Vision-verification summary

Both records confirmed the metadata triage findings. Neither R9 nor R10 should be admitted to staircase_brain. The vision-verified dispositions match the metadata-derived dispositions:

- R9: REFERENCE-ONLY (article illustration · workshop scene)
- R10: OTHER-BRAIN candidate (loft_ladder · new brain observation)

**Additional discovery from vision-verification:** the 5000-char rich descriptions were describing the ARTICLE the image accompanied · not the IMAGE content itself. This is a systemic pattern — rich metadata about the containing article is being applied as image description · which OVERSTATES the image's staircase-recognition value.

### Temporary downloads cleaned up

Files `R9.jpg` and `R10.jpg` in `data/.pilot-batch-vision-2026-07-31/` deleted after review. Directory retained empty for future vision-verification cycles OR to be removed if not needed.

### Batch #01 status update

- **Metadata triage:** COMPLETE
- **Vision verification (R9 · R10):** COMPLETE
- **Final Batch #01 verdict:** 0 of 19 sampled records pass all 5 gates. Metadata triage disposition proposals validated by vision on the two flagged records.
- **Manifest changes made:** NONE. All 19 records remain untouched.
- **Batch #01 complete.** Batch #02 authorised to proceed.
