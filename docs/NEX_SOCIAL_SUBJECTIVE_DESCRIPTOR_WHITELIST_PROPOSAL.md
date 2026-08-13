# NEX Social · Subjective-Descriptor Whitelist · PROPOSAL

**Status:** PROPOSAL ONLY · NOT CANONICAL · NOT MERGED
**Purpose:** launch-dependency for charter v0.2 · S-III requires a whitelist of subjective descriptors before Automatic mode can be enabled for any tenant.
**Author of record:** Philip (via Claude · architect scope)
**Date drafted:** 2026-08-08
**Companion:** `docs/NEX_SOCIAL_ENGINE_CHARTER_v0.2_PROPOSAL.md` · `docs/NEX_SOCIAL_FORBIDDEN_CLAIMS_STARTER_LIST_PROPOSAL.md`

## Preamble

Charter S-III (v0.2) allows subjective descriptors (aesthetic/tone words like "beautiful", "elegant") only from a per-brand whitelist. The whitelist is merchant-authored OR accepted from a Nex-curated default. This document is the proposed Nex-curated default.

**Design principles (from Philip · 2026-08-08):**

- **Conservative.** When in doubt, leave it OFF the list. It is easier to add later than to defend an autopublished claim.
- **Trade-aware.** Some words are safe in general staircase context but not in others.
- **Absence = not permitted.** If a descriptor is not on this list AND not on a merchant-authored supplement, the LLM Generator MUST NOT emit it. Absence is treated as forbidden, not "we haven't decided."
- **Distinct from forbidden.** A word can be neither on the whitelist nor on the forbidden list — that means it's un-adjudicated and defaults to NOT PERMITTED under S-III's "no ungrounded tokens" rule.

**Two tiers:**

- **GREEN.** Aesthetic/tone words with no implicit credential, quality, comparative, warranty, regulatory, or safety implication. Autopublish-eligible without additional evidence.
- **AMBER (context-gated).** Aesthetic words that are safe in a specific bounded context but risky elsewhere. Require the context in the same post to unlock.

**Not on either list = default REFUSE.**

**Enforcement.** Brand-checker (§S-VIII) rejects any adjective/descriptor not on GREEN (unconditionally) or AMBER (with matching context). Rejected → Manual queue.

**Enforcement of "conservative" ratchet.** Adding a word to the GREEN or AMBER lists requires Philip approval. Removing a word does not require approval (safety-ratchet: easier to tighten than loosen).

**Rule of thumb for future additions.** *"If you can honestly imagine a Trading Standards officer asking 'what makes this true?' about the word — it's not GREEN. If the word carries meaning only in a specific context and would be misleading elsewhere — it's AMBER at best."*

---

## GREEN · aesthetic/tone words (autopublish-eligible)

### G1 · Visual character (safe · no implied quality tier · no credential)

| Descriptor | Why allowed | Exception evidence to escalate | Enforcement |
|---|---|---|---|
| beautiful | Aesthetic opinion · no factual assertion | n/a | GREEN |
| striking | Visual-impact tone · no comparative | n/a | GREEN |
| eye-catching | Same · descriptive of appearance | n/a | GREEN |
| attractive | Aesthetic tone | n/a | GREEN |
| handsome | Aesthetic (particularly for solid/wooden constructions) | n/a | GREEN |
| stylish | Aesthetic tone | n/a | GREEN |
| smart | Aesthetic tone (British-English meaning) | n/a | GREEN |
| distinctive | Descriptive without comparative | n/a | GREEN |
| characterful | Aesthetic tone | n/a | GREEN |

### G2 · Style-family adjectives (safe · describe style not credential)

| Descriptor | Why allowed | Exception evidence to escalate | Enforcement |
|---|---|---|---|
| modern | Style-family label | n/a | GREEN |
| contemporary | Style-family label | n/a | GREEN |
| classic | Style-family label | n/a | GREEN |
| timeless | Aesthetic longevity claim (tone) | n/a | GREEN |
| minimalist | Style descriptor | n/a | GREEN |
| industrial | Style descriptor | n/a | GREEN |
| rustic | Style descriptor | n/a | GREEN |
| understated | Style/tone | n/a | GREEN |
| refined | Aesthetic tone | Careful of implied premium-tier · but does not itself claim credentials | GREEN |
| elegant | Aesthetic tone | n/a | GREEN |
| graceful | Aesthetic tone | n/a | GREEN |
| clean-lined | Descriptive of visual geometry | n/a | GREEN |

### G3 · Room-feel descriptors (safe · about how the space feels)

| Descriptor | Why allowed | Exception evidence to escalate | Enforcement |
|---|---|---|---|
| warm | Ambience tone · no material claim | n/a | GREEN |
| welcoming | Feeling word · no functional claim | n/a | GREEN |
| inviting | Same | n/a | GREEN |
| bright | Descriptive of light | n/a | GREEN |
| light-filled | Descriptive of light | n/a | GREEN |
| airy | Feeling word · describes visual sense not measurement | n/a | GREEN |
| tranquil | Ambience | n/a | GREEN |
| calm | Ambience | n/a | GREEN |
| inspiring | Tone | n/a | GREEN |
| impressive | Tone (personal reaction · not comparative) | n/a | GREEN |
| striking | (See G1) | n/a | GREEN |

### G4 · Neutral positive descriptors of state (safe)

| Descriptor | Why allowed | Exception evidence to escalate | Enforcement |
|---|---|---|---|
| new | Factual state · verifiable from project record | n/a | GREEN |
| freshly-installed | Factual · verifiable from install date | n/a | GREEN |
| freshly-completed | Same | n/a | GREEN |
| completed | Factual | n/a | GREEN |
| finished | Factual | n/a | GREEN |
| carefully-considered | Tone (about design process · not credential) | n/a | GREEN |
| thoughtful | Tone | n/a | GREEN |
| tidy | Descriptive of appearance | n/a | GREEN |
| clean | Descriptive of appearance | n/a | GREEN |

### G5 · Colour-family descriptors (safe · matched to product record)

| Descriptor | Why allowed | Exception evidence to escalate | Enforcement |
|---|---|---|---|
| dark / darker | Colour tone | n/a | GREEN |
| light / lighter | Colour tone | n/a | GREEN |
| rich (as colour tone) | Colour descriptor | n/a | GREEN (in colour context only) |
| pale | Colour descriptor | n/a | GREEN |
| deep (as colour tone) | Colour descriptor | n/a | GREEN (in colour context only) |
| neutral | Colour-family | n/a | GREEN |
| warm-toned / cool-toned | Colour temperature | n/a | GREEN |

### G6 · Numerical descriptors (safe when derived from records)

Not adjectives per se · but pattern-matches that S-III treats as descriptors. Autopublish only when the source record supports the number exactly.

| Descriptor pattern | Why allowed | Exception evidence to escalate | Enforcement |
|---|---|---|---|
| "[N]-tread staircase" | Factual from product record | Match must be exact | GREEN if record matches |
| "[species] staircase" (e.g. "oak staircase") | Factual from product record | Match must be exact | GREEN if record matches |
| "in [colour] finish" | Factual from finish record | Match must be exact | GREEN if record matches |

---

## AMBER · context-gated descriptors (allowed only with matching context)

### A1 · "Bespoke" · "custom" · "made-to-measure"

**Why AMBER:** these words claim a specific production model (one-off manufacture). If misused they imply craftsmanship the merchant may not actually offer.

- **Unlock:** post refers to a specific project record with `production_type IN ('bespoke','custom','made_to_measure')` AND the merchant has attested this production model in the brand profile.
- **Without unlock:** REJECT.

### A2 · "Bespoke design" · "custom-designed"

**Why AMBER:** implies design service, not just manufacture.

- **Unlock:** merchant offers a design service in their `services` record AND the specific post references a project with that service applied.
- **Without unlock:** REJECT.

### A3 · "Handmade" · "hand-crafted" · "hand-built" · "hand-finished"

**Why AMBER:** production-method claim. If mass-produced with CNC + finish coating, misleading.

- **Unlock:** merchant attests production method in brand profile OR project record explicitly notes hand-work. See also Category 7 of forbidden-claims list (REVIEW-REQUIRED).
- **Without unlock:** REJECT.
- Note: this word also appears in Forbidden Category 7 as REVIEW-REQUIRED. Whitelist inclusion here does not lower the evidence bar; it merely admits the word to the LLM vocabulary once evidence exists.

### A4 · "Solid oak" · "solid walnut" · "solid [species]"

**Why AMBER:** material-composition claim (mirrors Forbidden Category 7).

- **Unlock:** product record with attested `material = "solid_{species}"`.
- **Without unlock:** REJECT (route to Manual with the specific claim named).

### A5 · "Traditional" · "traditionally-crafted"

**Why AMBER:** implies a specific technique. In staircase context "traditional joinery" has a specific meaning (mortise-and-tenon · glued-and-wedged etc.) — misuse suggests craft that isn't happening.

- **Unlock:** brand profile tone = `traditional` AND project record describes traditional joinery methods.
- **Without unlock:** REJECT.

### A6 · "Comfortable" · "easy to climb" · "ergonomic"

**Why AMBER:** in a staircase context, this can shade into an accessibility/safety claim.

- **Unlock:** the post is about a completed project the merchant has attested is accessibility-oriented OR the phrase appears clearly as aesthetic tone rather than functional claim (LLM classification, high-confidence-only).
- **Without unlock:** REJECT.

### A7 · "Spacious" · "compact"

**Why AMBER:** size claims. Fine when about the resulting space, but not measurable without floorplan data.

- **Unlock:** post is about a room-context project with attested dimensions OR clearly aesthetic ("compact design that fits the space beautifully").
- **Without unlock:** REJECT.

### A8 · "Practical" · "functional" · "hard-wearing" · "durable"

**Why AMBER:** implies performance claim.

- **Unlock:** referenced product/material has a supporting record for the claim (e.g. `hardwood_grade`, `finish_type`).
- **Without unlock:** REJECT.

### A9 · "Signature" · "signature style"

**Why AMBER:** implies distinctive-house-style claim (mild social-proof implication).

- **Unlock:** merchant has ≥ 3 published projects sharing a design DNA in the brand profile.
- **Without unlock:** REJECT.

### A10 · "Beautifully finished" · "expertly finished"

**Why AMBER:** "expertly" edges into credential territory. "Beautifully finished" is aesthetic-plus-process.

- **Unlock:** merchant brand profile has `tone ∈ {premium, traditional, refined}` AND the post references a specific finish record.
- **Without unlock:** REJECT.

---

## NOT on this list (explicit REJECT)

Words the LLM MUST NOT emit under any Automatic-mode configuration. These are neither GREEN nor AMBER. If a merchant genuinely wants to use one of these, they must (a) obtain the evidence noted in the Forbidden-Claims Starter List and (b) publish in Manual/Assisted mode after human review.

**Quality-tier claims (implied premium / exclusive):**

- premium · luxury · high-end · top-of-the-range · deluxe · superior · exclusive · elite · prestige · first-class · finest

**Credential-implying words:**

- expert · specialist · master · professional (as adjective claiming quality) · qualified · certified · trusted · established · renowned · reputable · leading · established-name

**Superlative / comparative words:**

- best · finest · greatest · number-one · #1 · unmatched · unrivalled · unbeatable · unique · one-of-a-kind · unparalleled

**Absolute claims:**

- perfect · flawless · immaculate · impeccable · pristine · always · never · every · guaranteed · assured

**Vague-safety words:**

- safe · secure (as safety claim) · child-safe · pet-safe

**Vague-green words:**

- eco-friendly · sustainable · green · natural · organic · pure · clean (as environmental claim)

**Vague-value words:**

- affordable · cheap · budget-friendly · value-for-money · great-value · bargain

**Vague-authenticity words:**

- authentic · genuine · original (in provenance sense) · real

**Vague-innovation words:**

- innovative · revolutionary · cutting-edge · state-of-the-art · pioneering · game-changing · groundbreaking

**Marketing-cliché words that carry no actual meaning:**

- amazing · incredible · fantastic · outstanding · exceptional · extraordinary · phenomenal · wonderful (in commercial context) · dream (as in "dream staircase")

---

## Interaction with the forbidden-claims list

The two lists are complementary, not overlapping:

- **Forbidden list** governs claims (statements with factual/legal/regulatory content).
- **Whitelist** governs subjective descriptors (adjectival tone without factual content).

Where a word could be either — e.g. `"trusted"` could be tone or a credential claim — the forbidden list wins (REJECT unless evidence). Where a word is ambiguous — e.g. `"reliable"` — treat as NOT ON LIST and REJECT unless the merchant adds it to their brand profile with attestation.

## Merchant supplements

Merchants may propose additions to their per-brand whitelist. Additions:

- Require merchant attestation of what evidence backs the word for their brand.
- Require Nex admin review (audited under `nex_admin_publish` grant per approved A5).
- Never permit anything already on the NOT-on-list section above without a corresponding forbidden-list evidence record.
- Are per-tenant · never global.

## Explicitly outside scope of this proposal (deferred)

- Trade-specific whitelists for kitchens · doors · flooring · roofing · joinery (each trade gets its own proposal when it onboards).
- Non-UK-English tone words (Nex is UK-English-first at launch).
- Emoji handling (Phase 1.2+).
- Cultural/seasonal descriptors (Christmas · Diwali · etc. — separate proposal).
- Video-transcript descriptor policy (Phase 1.2+ if built).

## What this proposal is NOT

- Not the final list. Additions require Philip approval. Removals do not (safety-ratchet).
- Not a merge. This document lives at `docs/NEX_SOCIAL_SUBJECTIVE_DESCRIPTOR_WHITELIST_PROPOSAL.md` and is referenced by charter v0.2 only.
- Not authorisation to build Social 1.0.
- Not authorisation to enable Automatic mode for any tenant.
