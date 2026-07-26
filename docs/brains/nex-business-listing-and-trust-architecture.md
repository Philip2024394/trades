# NEX Business Listing & Trust Architecture

**Purpose:** Define how NEX represents, verifies and describes businesses in its directory — and critically, how NEX responds to customer queries about companies at each verification level.

**Source:** Philip's Phase 6 platform-model spec + trust-response engine (2026-07-27).

**Legal-protection critical.** Every piece of this doc is written to avoid the platform accidentally defaming a listed company or making claims it cannot support. Read before implementing any customer-facing message about a company.

---

## The core model

NEX is a **directory + marketplace**, not a lead-seller.

- The directory belongs to NEX. Being listed is not the same as controlling the listing.
- Businesses cannot pay to change facts. They can pay to unlock management rights.
- Every listing carries a verification level. NEX's response language changes with the level.
- No level is "bad" — even unclaimed listings are neutral. The absence of verification is stated, never used as an accusation.

This is the same pattern as Google Business Profile / Yelp / Houzz. NEX adopts it because it works and because it protects both customers and businesses.

---

## The 4 verification levels

Every business record in NEX carries one of four `verification_level` values:

### Level 1 — Listed
- **Badge:** grey · "Information available"
- **Meaning:** NEX knows the business exists from public information (Companies House, website scraping, trade directory imports).
- **Business relationship:** none.
- **NEX confidence:** the business exists, but nothing beyond that is confirmed.

### Level 2 — Claimed
- **Badge:** blue · "Business owner manages this profile"
- **Meaning:** the business owner has verified their email or phone with NEX and taken control of the profile.
- **Business relationship:** they can edit their own profile.
- **NEX confidence:** contact information is more likely current, but no facts have been independently verified.

### Level 3 — Verified
- **Badge:** green · "NEX verified profile"
- **Meaning:** NEX has checked company details (Companies House registration, trading address, insurance certificate on file, portfolio evidence, at least basic trade references).
- **Business relationship:** paying subscriber; NEX has done substantive checks.
- **NEX confidence:** the business is real, active and can back up basic claims.

### Level 4 — NEX Partner
- **Badge:** gold · "Trade partner"
- **Meaning:** ongoing platform relationship. Featured placement, marketplace integration, verified project history through NEX.
- **Business relationship:** premium subscriber with deep integration.
- **NEX confidence:** highest — an active reciprocal relationship.

---

## Package tiers (subscription model)

The verification levels intersect with paid packages. Verification is not automatic on payment — you can pay for management rights (Starter) without the verification tier (Verified).

| Package | Indicative price | Verification level available | What it unlocks |
|---|---|---|---|
| **Free listing** | £0 | Level 1 (Listed) | Basic profile, discoverability. No editing. |
| **Starter** | £19-29/mo | Level 2 (Claimed) | Claim profile, edit information, upload up to 10 photos, opening hours, basic analytics |
| **Trade Pro** | £49-99/mo | Level 3 (Verified) after checks | Unlimited photos, project gallery, before/after, services list, product catalogue, quote requests, customer enquiries, reviews management |
| **Premium Partner** | £199+/mo | Level 4 (Partner) after checks | Featured placement, regional advertising, lead management, CRM integration, analytics, API |

**Rule:** Payment unlocks management rights and features. Verification level requires NEX-completed checks — it is not for sale.

---

## What paying unlocks vs what stays fixed

Businesses can update:
- ✅ New showroom address
- ✅ New services offered
- ✅ Additional product categories
- ✅ New photos
- ✅ New opening times
- ✅ Special offers and promotions
- ✅ Updated contact information
- ✅ Portfolio additions

Businesses **cannot** update:
- ❌ "Established" year (verified from Companies House)
- ❌ Trade qualifications and certifications (must produce evidence)
- ❌ Verified reviews (customer-submitted, not editable by business)
- ❌ Fake insurance / accreditation claims
- ❌ Third-party accreditations they don't hold

This distinction is the **trust core** of the platform. Paying customers get control over content they own; they never get control over content that would mislead other users.

---

## The Trust Response Engine — critical wording rules

When a customer asks NEX about a company, NEX's response is gated by the company's verification level. The wording matters enormously.

### RULE 1 — Never accuse. Always state absence of verification.

**Wrong (accusatory, potentially defamatory):**
> "This company is not registered, so we cannot confirm they are legitimate."
> "This company cannot be trusted."
> "This company is fake."

**Right (neutral, factual):**
> "NEX does not currently have a verified profile for this company."
> "No NEX profile found."
> "Information unavailable — we recommend completing your own checks."

The difference is legally significant. Accusatory wording exposes NEX to defamation claims. Neutral wording states only what NEX itself has done.

### RULE 2 — Empower the customer to do their own checks.

Every response to an unverified-company query ends with a customer-action checklist:
- ✓ Previous projects
- ✓ Customer reviews (from independent sources)
- ✓ Insurance
- ✓ Written quotation
- ✓ Warranty details
- ✓ Installation experience
- ✓ Companies House registration

### RULE 3 — Be transparent about NEX's confidence level.

Say what NEX knows and does not know. Do not imply certainty NEX does not have.

---

## Response templates by verification level

### Company not in database at all

> "I cannot confirm [Company Name] as a verified NEX business partner because they do not currently have a claimed or verified profile in the NEX network.
>
> This does not mean the company is unsuitable. It means NEX has not independently verified their information.
>
> Before hiring any staircase company, check:
> - ✓ Previous projects
> - ✓ Customer reviews
> - ✓ Insurance
> - ✓ Written quotation
> - ✓ Warranty details
> - ✓ Installation experience"

### Company listed (Level 1) but not claimed

> "[Company Name] appears in the NEX directory as a listed business based on available business information.
>
> However, the company has not claimed or verified their NEX profile.
>
> Information may be limited until the business owner verifies and manages their profile.
>
> Before hiring, we recommend the standard checks: [checklist]."

### Company claimed (Level 2) but not verified

> "[Company Name] is claimed by its business owner and appears in the NEX directory with owner-managed information.
>
> NEX has not independently verified the business details, insurance, qualifications or trading history.
>
> Owner-managed information typically includes: services, opening hours, contact details, photos.
>
> Before hiring, we recommend the standard checks: [checklist]."

### Company verified (Level 3)

> "[Company Name] has a verified NEX profile.
>
> Their profile includes:
> - ✓ Verified business details (Companies House confirmed)
> - ✓ Service categories they offer
> - ✓ Project photos
> - ✓ Customer reviews from verified transactions
> - ✓ Contact information
>
> NEX recommends comparing multiple suppliers before making a final decision."

### Company Partner (Level 4)

> "[Company Name] is a NEX Trade Partner with an active platform relationship.
>
> Their profile includes: [full profile block].
>
> Trade Partner status indicates an active, ongoing relationship with the NEX platform, including verified project history and reciprocal integration.
>
> As with any purchase, we recommend comparing multiple suppliers and requesting written quotations."

---

## Reviews and evidence rules

The trade-network architecture doc (`nex-staircase-trade-network-architecture.md`) already establishes: **reviews must be from verified transactions.**

This doc adds:

- **Fake reviews are removed on detection.** No exception for paid tiers.
- **A review posted by a customer who cannot be traced back to a real completed project does not appear.** Verification is a prerequisite for publication, not an audit after the fact.
- **Businesses can respond to reviews** but cannot delete them. Response is public.
- **Disputed reviews** are held pending investigation. Neither side loses immediate face; NEX arbitrates on evidence.

---

## Anti-lead-selling rule (reaffirmed)

From the trade-network architecture doc: **Never sell leads.** Reaffirmed here because the paid-tier structure could be misread as lead sales.

- Trade Pro package includes "customer enquiries" — meaning customers can *contact* the business directly through NEX. The same enquiry is never sold to multiple competitors.
- Premium Partner includes "lead management" — meaning tools for the business to *manage* enquiries they receive, not lead purchase.

If enquiry-routing ever starts to look like a lead-sale scheme, the model has drifted and must be corrected. This is a platform-permanent rule.

---

## Verification progression — how a business moves through levels

**Listed → Claimed:**
- Business owner receives claim invitation (email or phone verification)
- Confirms they own the business
- Accepts NEX terms of use
- Chooses free listing or paid tier
- Immediate promotion to Level 2

**Claimed → Verified:**
- NEX-side checks: Companies House registration, address, insurance certificate uploaded, portfolio evidence, at least basic trade references
- Any Trade Pro subscriber can request verification review
- Turnaround target: 5-10 business days
- Successful check → Level 3 badge
- Failed check → NEX explains what evidence is needed; no penalty, they can resubmit

**Verified → Partner:**
- By NEX invitation only, based on:
  - Consistent verified quality signals over 6+ months
  - Active customer engagement
  - Willingness to integrate more deeply (API, CRM)
  - Fit with NEX's editorial curation
- Not simply a matter of paying more

---

## What NEX must not do

Regardless of level, NEX must never:

- Claim a business is "bad" or "unsuitable" without documented public evidence
- Publish accusations or unverified negative claims
- Compare businesses in ways that disparage one
- Publish private information (personal addresses, individual identities beyond public director records)
- Represent that verification level is a guarantee of quality (it is a confidence signal, not an insurance policy)
- Sell customer contact details to businesses without customer consent

---

## The strength of the model

This trust architecture is what turns NEX from a "company rating system that can create disputes" into a **neutral trade intelligence platform**.

- Customers get honest information about what NEX knows and does not know
- Businesses get discovery even without paying, and control when they pay
- NEX is legally protected because it makes only claims it can support with evidence
- The whole system scales — same rules for 100 companies as for 100,000

---

## Data implementation

Every merchant record in `data/uk-merchant-directory.json` will add three fields when this architecture is implemented:

```json
{
  "verification_level": "listed | claimed | verified | partner",
  "package_tier": "free | starter | trade_pro | premium_partner",
  "trust_metadata": {
    "claimed_at": null,
    "verified_at": null,
    "verification_notes": null,
    "insurance_on_file": false,
    "companies_house_confirmed": false
  }
}
```

V1 status: all current 88 merchants default to `verification_level: "listed"` (Level 1). Progression happens when a claim + verification workflow ships.

---

## Cross-references

- `docs/brains/nex-staircase-trade-network-architecture.md` — trust protection rules (no lead selling, verified reviews)
- `docs/brains/nex-staircase-knowledge-architecture.md` — architecture principles
- `data/uk-merchant-directory.json` — will carry verification_level per record when implemented

---

## The final rule

**A neutral platform outlasts an opinionated one.**

NEX describes what it has verified. It never claims what it cannot support. Customers make their own decisions with better information. Businesses grow their reputation on evidence. NEX is trusted because it earns that trust honestly.
