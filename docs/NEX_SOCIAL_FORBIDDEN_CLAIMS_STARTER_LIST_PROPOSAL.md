# NEX Social · Forbidden-Claims Starter List · PROPOSAL

**Status:** PROPOSAL ONLY · NOT CANONICAL · NOT MERGED
**Purpose:** launch-dependency for charter v0.2 · S-III + S-VIII require a non-empty forbidden-claims list before Automatic mode can be enabled for any tenant.
**Author of record:** Philip (via Claude · architect scope)
**Date drafted:** 2026-08-08
**Companion:** `docs/NEX_SOCIAL_ENGINE_CHARTER_v0.2_PROPOSAL.md`

## Preamble

This is a *starter* list — the minimum viable rule set for Policy-checker (§S-VIII) to block/route the highest-risk claims that could expose merchants to legal, regulatory, GDPR, consumer-protection, or reputational harm. It is intentionally conservative. Additions require Philip's approval; removals require Philip's approval + a documented reason. The list is trade-agnostic at its base with a staircase-specific supplement (Nex's current primary trade); other trade supplements land as separate proposals when those trades onboard.

**Two enforcement tiers:**

- **HARD-BLOCKED.** Claim is refused by Policy-checker regardless of merchant approval mode. Post routes to Manual only if merchant edits the claim out. Cannot be autopublished under any category.
- **REVIEW-REQUIRED.** Claim is permitted only when accompanied by an evidence record of the specified type. Absent evidence → Manual queue. Merchant can attach evidence and re-submit.

**Detection scope.** Policy-checker matches on the semantic claim (LLM classification), not raw regex. Hashtags · captions · alt-text · CTAs · image overlays (if OCR available) all count. Detection matrix is version-pinned; version bumps require an amendment-style note.

**Evidence records.** All exception-permitting evidence lives in named tables: `nex.social_qualification_records` · `nex.social_warranty_records` · `nex.social_offer_records` · `nex.social_review_records` · `nex.social_award_records` · `nex.social_certification_records` · `nex.social_press_records`. Each evidence row carries `merchant_attested_at` · `evidence_url_optional` · `verifier` · `expires_at`. Absent, expired, or unattested evidence rows do NOT unlock the claim.

**Rule of thumb for future additions.** *"If the merchant would need to defend this claim in a Trading Standards enquiry, in an ASA complaint, or in a small-claims dispute — it belongs on this list."*

---

## Category 1 · Guarantees and warranties (HARD-BLOCKED)

Legally-binding promises that create warranty obligations under the Consumer Rights Act 2015 and equivalent UK/EU consumer protection law. Autopublishing these unbacked exposes the merchant to warranty claims they never intended to make.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "lifetime guarantee" / "guaranteed for life" | Perpetual warranty obligation | Requires signed `warranty_record` explicitly written by merchant · duration = "lifetime" clearly defined (of product · of purchaser · of installation) · exclusions listed | HARD-BLOCKED |
| "N-year guarantee" / "N-year warranty" | Time-bound warranty obligation | `warranty_record` with matching duration + exclusions | HARD-BLOCKED |
| "money-back guarantee" / "satisfaction guaranteed" | Refund obligation | `warranty_record` specifying refund terms | HARD-BLOCKED |
| "no-quibble refund" / "no questions asked" | Absolute refund promise | `warranty_record` with the specific policy | HARD-BLOCKED |
| "risk-free" | Implies zero-liability guarantee | `warranty_record` scoping what risk is covered | HARD-BLOCKED |
| "we guarantee [outcome]" | Outcome warranty | `warranty_record` for the specific outcome | HARD-BLOCKED |
| "100% [satisfaction/quality]" | Absolute promise | `warranty_record` + rationale | HARD-BLOCKED |

## Category 2 · Qualifications and credentials (HARD-BLOCKED without record)

Unbacked credential claims are a Trading Standards issue AND platform-policy risk on Meta/LinkedIn. Autopublished credential fraud damages the whole platform, not just the merchant.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "certified [X]" / "[X]-certified" | Professional-body claim | `certification_record` with issuing body · certificate ID · expiry | HARD-BLOCKED |
| "licensed [X]" | Regulatory licence claim | `certification_record` referencing the licence + issuer | HARD-BLOCKED |
| "accredited" / "accredited by [X]" | Accreditation claim | `certification_record` referencing accreditor | HARD-BLOCKED |
| "insured" / "fully insured" / "public liability insured" | Insurance claim (regulated by FCA-adjacent trading standards) | `certification_record` type=insurance + policy expiry | HARD-BLOCKED |
| "approved by [authority]" | Third-party approval | `certification_record` from authority | HARD-BLOCKED |
| "official [X]" / "official [brand] partner" | Partnership/authorisation claim | Written partnership evidence in `certification_record` | HARD-BLOCKED |
| "member of [trade body]" | Trade-body membership | `certification_record` with membership number + expiry | HARD-BLOCKED |
| "[N] years' experience" | Verifiable factual claim | Company founded-date in profile ≥ N years ago | REVIEW-REQUIRED |
| "master craftsman" / "master [trade]" | Credential claim implying accreditation | `certification_record` OR merchant-attested experience with disclaimer | REVIEW-REQUIRED |

## Category 3 · Comparative and superlative claims (HARD-BLOCKED)

ASA CAP Code chapter 3.33-3.42 governs comparative advertising. Superlatives without substantiation are the most common ASA complaint category. Also carries defamation risk when a competitor is named.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "cheapest" / "lowest price" | Superlative comparative price claim | Requires dated price survey evidence + geographic scope | HARD-BLOCKED |
| "best" / "the best" / "[N]'s best" | Superlative quality claim | Independent survey/award evidence with scope + date | HARD-BLOCKED |
| "finest" / "highest-quality" | Superlative quality claim | Same as "best" | HARD-BLOCKED |
| "leading" / "market-leading" | Market position claim | Independent market-share data + scope + date | HARD-BLOCKED |
| "number one" / "#1 [X]" | Ranking claim | Independent ranking with scope + date | HARD-BLOCKED |
| "unbeatable [price/quality/service]" | Superlative | Substantiation required · rarely defensible | HARD-BLOCKED |
| "unique" / "one of a kind" | Uniqueness claim | Genuinely-unique product record + evidence | HARD-BLOCKED |
| "cheaper than [competitor]" / "better than [competitor]" | Named-competitor comparative | Named-competitor comparatives require dated evidence + legal review | HARD-BLOCKED |
| "unlike other [trade]s" | Implicit comparative | Substantiation required | HARD-BLOCKED |
| "no one else does [X]" | Uniqueness/comparative | Substantiation required | HARD-BLOCKED |

## Category 4 · Social-proof claims (REVIEW-REQUIRED)

Reviews, awards, and testimonials require verifiable evidence under CAP Code chapter 3.45. Fabricated social proof is one of the most damaging categories if discovered.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "award-winning" / "award-nominated" | Award claim | `award_record` with issuer + year + category | REVIEW-REQUIRED |
| "voted [X]" / "voted best [Y]" | Voting/poll claim | `award_record` referencing the poll + methodology + date | REVIEW-REQUIRED |
| "as seen on [TV/press]" | Media appearance claim | `press_record` with URL/citation + date | REVIEW-REQUIRED |
| "featured in [publication]" | Media claim | `press_record` with citation | REVIEW-REQUIRED |
| "[N]-star rated" / "[N]-star reviews" | Rating claim | `review_record` aggregate + platform + sample size + date | REVIEW-REQUIRED |
| "over [N] happy customers" / "N+ customers" | Volume claim | Verifiable count (from Nex-integrated CRM or attested) + date | REVIEW-REQUIRED |
| "customers love us" / "highly reviewed" | Vague social proof | `review_record` aggregate ≥ 4.0 avg on ≥ 20 reviews | REVIEW-REQUIRED |
| "recommended by [X]" | Third-party recommendation | Written recommendation evidence | REVIEW-REQUIRED |
| "trusted by [X]" | Trust claim | Client list evidence OR aggregate `review_record` | REVIEW-REQUIRED |

## Category 5 · Pricing and offer claims (HARD-BLOCKED without offer record)

The Consumer Protection from Unfair Trading Regulations 2008 governs price claims. Unbacked "sale" claims are enforceable. Also violates Meta/IG commerce policies.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "free" / "no cost" | Free-offer claim (CPRs strict) | `offer_record` with type=free + terms + expiry | HARD-BLOCKED |
| "N% off" / "N% discount" | Discount claim | `offer_record` with baseline price + discount + expiry | HARD-BLOCKED |
| "sale" / "on sale" / "clearance" | Reduced-price claim | `offer_record` with reference price + duration | HARD-BLOCKED |
| "limited time" / "for a limited period" | Urgency claim | `offer_record` with explicit expiry | HARD-BLOCKED |
| "while stocks last" | Scarcity claim | `offer_record` with stock scope | HARD-BLOCKED |
| "book today" / "today only" / "ends [date]" | Date-driven urgency | `offer_record` with matching date | HARD-BLOCKED |
| "no VAT" / "VAT-free" | Tax claim (HMRC risk) | Only when merchant is genuinely VAT-exempt AND `offer_record` covers | HARD-BLOCKED |
| "trade price" / "wholesale" | Pricing tier | `offer_record` scoping who qualifies | HARD-BLOCKED |
| "exclusive [offer/deal]" | Uniqueness + offer | `offer_record` + `award_record`-style exclusivity substantiation | HARD-BLOCKED |
| "no obligation" | Contract-terms claim | `offer_record` OR merchant-attested standard terms | REVIEW-REQUIRED |
| "no hidden fees" | Pricing-transparency claim | Merchant-attested pricing policy | REVIEW-REQUIRED |

## Category 6 · Safety, health, and regulatory claims (HARD-BLOCKED)

Health, safety, and regulatory claims are the highest-liability category. Staircase-specific building-regulation claims can affect building-control sign-off and insurance validity.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "safe for children" / "child-safe" | Safety claim (product liability) | `certification_record` referencing applicable safety standard | HARD-BLOCKED |
| "fire-rated" / "fire-resistant" | Fire-safety claim (Regulatory Reform Order) | `certification_record` referencing test standard (BS 476 etc.) | HARD-BLOCKED |
| "building-regulations-compliant" / "meets Part [X]" | Building-regs claim | `certification_record` referencing the specific Part + assessor | HARD-BLOCKED |
| "structural warranty" / "N-year structural" | Structural warranty | `warranty_record` from an accredited provider (Premier Guarantee · LABC · etc.) | HARD-BLOCKED |
| "load-tested to [N]kg" | Structural claim | `certification_record` with test report + facility | HARD-BLOCKED |
| "wheelchair accessible" / "DDA-compliant" | Accessibility regulatory claim | `certification_record` with accessibility assessor | HARD-BLOCKED |
| "non-toxic" / "food-safe" / "chemical-free" | Health claim (regulated) | `certification_record` referencing test standard | HARD-BLOCKED |
| "hypoallergenic" | Health claim | `certification_record` | HARD-BLOCKED |

## Category 7 · Origin, authenticity, and material claims (REVIEW-REQUIRED to HARD-BLOCKED)

Product origin/material claims are governed by consumer-protection law and specific material standards (e.g., "solid oak" vs veneered has a legal definition).

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "solid [wood species]" (e.g. "solid oak") | Material-composition claim (misrepresentation risk) | Product record with attested material spec | REVIEW-REQUIRED |
| "hardwood" | Species-family claim | Product record with attested species | REVIEW-REQUIRED |
| "[species]-veneered" / "veneer" | Composition claim | Product record | REVIEW-REQUIRED |
| "British-made" / "made in [country]" | Origin claim (CoO rules) | Product record with attested manufacturing location | REVIEW-REQUIRED |
| "handmade" / "hand-crafted" / "hand-built" | Production method (misrepresentation if mass-produced) | Merchant attestation with production description | REVIEW-REQUIRED |
| "bespoke" / "custom-made" | Custom-production claim | Merchant attestation | REVIEW-REQUIRED |
| "reclaimed" / "salvaged" | Origin claim | Merchant attestation with source | REVIEW-REQUIRED |
| "sustainably sourced" | Environmental (see Cat 9) | See Category 9 | HARD-BLOCKED |
| "authentic [style/period]" (e.g. "authentic Victorian") | Style-authenticity claim | Merchant attestation with rationale | REVIEW-REQUIRED |

## Category 8 · Locality and service-area claims (REVIEW-REQUIRED)

Local claims are simple but frequently overreached. A merchant registered in Nottingham posting "serving Leicester and Derby" without service-radius evidence is a factual claim without grounding.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "serving [area]" | Service-area claim | Merchant service-area record covering the named area | REVIEW-REQUIRED |
| "[N]'s local [trade]" | Locality claim | Company address in [N] region | REVIEW-REQUIRED |
| "[N]'s [trade]" (possessive locality) | Same | Same | REVIEW-REQUIRED |
| "based in [area]" | Address claim | Company address record | REVIEW-REQUIRED |
| "family-run" / "family business" | Ownership-structure claim | Merchant attestation | REVIEW-REQUIRED |
| "established [year]" / "since [year]" | Founding-date claim | Company founded-date record | REVIEW-REQUIRED |
| "independent" | Ownership claim (not a chain/franchise) | Merchant attestation | REVIEW-REQUIRED |

## Category 9 · Environmental and sustainability claims (HARD-BLOCKED)

Green claims are the newest and most aggressively-enforced regulatory area (CMA Green Claims Code · ASA · Trading Standards). Autopublishing these is high-risk.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "eco-friendly" / "environmentally friendly" | Vague green claim (CMA Code violation) | `certification_record` with specific environmental substantiation | HARD-BLOCKED |
| "sustainable" / "sustainably sourced" | Sustainability claim | `certification_record` (FSC · PEFC · similar) | HARD-BLOCKED |
| "carbon-neutral" / "net-zero" | Carbon claim | `certification_record` with verified methodology | HARD-BLOCKED |
| "green" / "planet-friendly" | Vague green claim | `certification_record` | HARD-BLOCKED |
| "recycled [N]%" | Recycled-content claim | `certification_record` with material breakdown | HARD-BLOCKED |
| "biodegradable" / "compostable" | Disposal claim (regulated) | `certification_record` with standard | HARD-BLOCKED |
| "chemical-free" / "toxin-free" | Composition claim (vague/misleading) | `certification_record` with specific chemical scope | HARD-BLOCKED |
| "natural" | Vague claim (see CMA Code) | Merchant attestation + rationale | REVIEW-REQUIRED |
| "responsibly sourced" | Sourcing claim | `certification_record` OR supplier-chain attestation | REVIEW-REQUIRED |

## Category 10 · Implicit trust claims in hashtags and short-form (REVIEW-REQUIRED)

Hashtags and short CTAs frequently encode credential claims without seeming to. Charter S-III treats these as claims.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| `#TrustedBuilder` / `#Trusted[Trade]` | Implicit credential | `certification_record` (e.g. TrustMark) | REVIEW-REQUIRED |
| `#Insured[Trade]` | Implicit insurance claim | `certification_record` type=insurance | HARD-BLOCKED |
| `#Certified[X]` | Implicit certification | `certification_record` | HARD-BLOCKED |
| `#Award[Winning/ed]` | Implicit award claim | `award_record` | REVIEW-REQUIRED |
| `#Best[X]In[Location]` | Superlative + locality | Same as Category 3 rules | HARD-BLOCKED |
| `#GuaranteedQuality` / `#Guaranteed[X]` | Implicit guarantee | `warranty_record` | HARD-BLOCKED |
| `#FullyInsured` | Insurance claim | `certification_record` | HARD-BLOCKED |
| `#Master[Trade]` | Credential | Same as Category 2 rules | REVIEW-REQUIRED |
| `#Expert[Trade]` | Credential | Same | REVIEW-REQUIRED |

## Staircase-specific supplement (Nex primary trade)

Beyond the trade-agnostic set above, staircase-specific claims that intersect Part K of the Building Regulations · fire safety · structural integrity.

| Claim pattern | Why restricted | Exception evidence | Enforcement |
|---|---|---|---|
| "meets Part K" / "Part-K compliant" | Regulatory (staircase-specific) | `certification_record` referencing Part K assessor | HARD-BLOCKED |
| "designed to Part K" | Regulatory | `certification_record` OR chartered designer attestation | HARD-BLOCKED |
| "compliant with British Standards" / "BS 585" / "BS 6180" | Standards claim | `certification_record` with specific BS reference | HARD-BLOCKED |
| "fire-escape staircase" / "certified fire escape" | Life-safety claim | `certification_record` with fire assessor | HARD-BLOCKED |
| "reinforced [component]" | Structural claim | Product record with structural spec | REVIEW-REQUIRED |
| "load-tested" | Structural claim | `certification_record` with test | HARD-BLOCKED |
| "[N]-year structural warranty" | See Category 6 | See Category 6 | HARD-BLOCKED |
| "commercial-grade" | Product-tier claim | Merchant attestation + rationale | REVIEW-REQUIRED |
| "listed-building-approved" / "conservation-area-approved" | Planning-permission claim | Planning-permission evidence | HARD-BLOCKED |

## Enforcement summary

- Any post whose content matches a HARD-BLOCKED pattern (and lacks the required evidence record) is refused by Policy-checker regardless of merchant category-approval state.
- Any post matching a REVIEW-REQUIRED pattern without the required evidence record is routed to Manual queue with the specific pattern named in the merchant-facing UI ("This post claims [X]; please attach [Y] evidence or edit the claim").
- Pattern detection version is pinned in configuration; version bumps require a proposal note recording the change and its expected effect on false-positive/false-negative rates.
- Evidence records are per-tenant · authored by the merchant · attested with IP/timestamp · retention 24 months (per approved A2) · re-attestation prompted 30 days before `expires_at`.

## Explicitly outside scope of this starter list (deferred)

- Full trade-family supplements for kitchens · doors · flooring · roofing · joinery · etc. (each is a separate proposal when that trade onboards).
- Non-UK regulatory regimes (US · EU-27 · other) — each requires a separate proposal per jurisdiction.
- OCR of on-image text (Phase 1.2+ if built).
- Multi-language claim detection (Nex is UK-English-first at launch).

## What this proposal is NOT

- Not the final list. Additions require Philip approval. Removals require Philip approval + reason.
- Not a merge. This document lives at `docs/NEX_SOCIAL_FORBIDDEN_CLAIMS_STARTER_LIST_PROPOSAL.md` and is referenced by the v0.2 charter proposal only.
- Not authorisation to build Social 1.0. The list becomes operational only when charter v0.2 is accepted, Amendment #16 is merged, and Phase 0 enforcement scaffolding is written.
- Not authorisation to enable Automatic mode for any tenant.
