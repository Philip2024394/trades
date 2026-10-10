# NEX Family Safety · Indonesian Legal Review Brief

> 2026-10-10 · prepared for appointed Indonesian privacy / child-safety counsel
> Prepared by: NEX founder's operations team · Branch of record: `nex/directory-work`
> Status: self-contained · counsel does not need access to the NEX doctrine library to answer

## Executive summary

NEX is a messaging and marketplace platform preparing to launch a
**Family Safety** layer. Several components are currently
**SIMULATED-only** (built, but with user-facing effects and third-party
notification paths disabled by default). Before any component is
flipped live for Indonesian users — and before any production child
account is created — NEX requires qualified Indonesian legal review.

The Family Safety layer includes:

1. **Family Links** — verified guardian-child relationships. Data
   layer live (migration 198, server-side services). UI deferred.
2. **SafeChat** — message classification for safety signals. Phase 1
   SIMULATED. No logging in production. No user-facing effects.
3. **Emergency Help** — one-tap emergency flow. Live in pilot. All
   external notifications SIMULATED (no real alerts broadcast).
4. **Trusted Adult Network** — non-guardian safety contacts. Data
   layer design complete. UI deferred.
5. **Missing-Child Emergency Response Workflow** — design-only; not
   built; not authorised to build.

NEX seeks Indonesian legal counsel on compliance with:

- **PP 17/2025** — child online protection
- **Permenkomdigi 9/2026** — child digital service requirements
- **UU 27/2022 (PDP)** — personal data protection law
- Any other regulation applicable to child-facing messaging +
  marketplace services (including KPAI reporting obligations and any
  BSSN requirements).

## Priority questions

Each question is prefixed with the NEX component(s) it blocks.
Priority is ordered **by product-release blocking impact**.

---

### P1 · Platform classification (BLOCKS all child-account activation)

Does NEX qualify as a "high-risk platform" under PP 17/2025? NEX
operates:

- Peer-to-peer messaging (text + encrypted Vault chat)
- A business directory (public search; no child-facing commerce by
  default)
- Emergency assistance features
- A planned Family Safety layer for children with guardian oversight

**Questions:**

- What is NEX's correct classification?
- What are the activation gates, documentation requirements, and audit
  obligations for each service tier under this classification?
- Does the business-directory surface count toward child-platform
  classification given it is adult-facing today?

---

### P2 · Age verification requirements (BLOCKS child account creation)

Permenkomdigi 9/2026 appears to require age verification for high-risk
platforms. For NEX:

- What verification methods satisfy the regulation? (declared
  date-of-birth, guardian attestation, document verification,
  third-party age-estimation service)
- What verification is required at what age thresholds?
- What record of verification must be retained, for how long, and
  under what access controls?
- Is a lightweight guardian attestation (described in P3) sufficient,
  or is third-party verification mandatory for some age bands?

---

### P3 · Guardian attestation flow (BLOCKS Family Links UI build)

**NEX's current design (sealed in migration 198):**

- Guardian attests their own identity via a WebAuthn security key (D3
  of the adopted ADR requires a hardware or platform security key).
- Guardian attests the child's age via a lightweight declared
  date-of-birth mechanism (`nex.account_age_attestation`).
- **No** ID document upload. **No** biometric capture. **No**
  third-party verifier integration today.

**Questions:**

- Is this sufficient under PP 17/2025 and Permenkomdigi 9/2026?
- If stricter verification is required, what is the minimum
  acceptable? (parental consent letter, Indonesian ID document,
  third-party age-verification service, in-person KPAI/Dukcapil
  verification?)
- What legal documentation of the attestation must be retained, and
  for how long?
- Is the WebAuthn requirement for the **guardian** (not the child)
  compatible with Indonesian norms, or does it introduce an exclusion
  problem?

---

### P4 · Message safety scanning (BLOCKS SafeChat live-mode activation)

NEX intends to run algorithmic classification over child-adjacent
messages for safety signals.

**Phase 1 (now, SIMULATED):**

- All classifications are **SIMULATED**. Logging is **disabled** in
  production (`SAFECHAT_PRIVACY_MODE=simulation`).
- No parent, child, or counterparty sees any effect.
- Encrypted (Vault) messages are **NEVER** scanned.

**Phase 3 (future · not yet authorised):**

- Child may see restriction chips on severe-category messages.
- Guardian may receive minimum-information alerts for severe-category
  messages (category + timestamp only; not message content).
- HQ Safety Operations may review flagged messages under **Tier B**
  authorisation (case-based, documented reason, audit-logged).

**Questions:**

- What Indonesian law governs algorithmic scanning of **minors'**
  communications?
- What disclosure to the user (child AND guardian) is required —
  in-product, at signup, at age-of-majority transition?
- What retention period for classification records is permitted /
  required?
- What access controls must be in place for Safety Operations
  personnel?
- What appeal path must be available to users (both the sender and
  the subject of the classification)?
- Does scanning child-to-adult messages, or adult-to-child messages,
  require **different** consent flows?

---

### P5 · CSAM detection (BLOCKS Phase 4 build)

NEX intends to integrate **PhotoDNA (Microsoft)** perceptual-hash
matching to detect known Child Sexual Abuse Material. This capability
is not built; design pending.

**Questions:**

- What is the Indonesian **reporting obligation** when CSAM is
  detected? Immediate? Within a stated hours-window?
- Which authority receives the report? Komdigi? Indonesian National
  Police (Polri)? KPAI? NCMEC via a cross-border channel?
- What record of detection + report must NEX retain?
- What immediate action is NEX obligated to take upon detection
  (restriction, account suspension, device-side lock)?
- Does Indonesian law require NEX to also report **suspected** (not
  only hash-matched known) CSAM?

---

### P6 · Emergency Help + location sharing (currently pilot; may launch publicly)

Emergency Help captures location **only at user tap**, streams **only
while the active-incident page is open**, and **never when the phone
is off**. Data is stored in NEX Postgres.

**Questions:**

- What consent model is required for emergency location capture of a
  minor?
- What retention period is permitted for emergency location data? (NEX
  currently proposes 30 days post-closure, then anonymised.)
- What access controls must be in place for emergency response
  personnel inside NEX HQ (currently sealed Tier-A/B/C model)?
- Are there Indonesian-specific obligations when the user is a minor
  AND a guardian is linked (e.g. must the guardian be notified)?

---

### P7 · Missing-child emergency workflow (design-only; not built)

Future workflow, not yet authorised to build:

- Parent / guardian reports a missing child via Emergency Help.
- HQ Safety Operations gains **Tier C break-glass** access to the
  child's recent location history + conversation **metadata** (not
  content).
- Handoff to local emergency services is available.
- Two-person authorisation is required for all Tier C access.

**Questions:**

- What legal basis authorises Tier C access to a minor's data in a
  missing-child incident?
- What documentation (case file, authorisation record, audit) must be
  produced?
- What is the proper handoff path to Indonesian police / KPAI /
  Dukcapil / other authorities?
- Is content access ever permitted during a missing-child incident, or
  must NEX remain metadata-only?

---

### P8 · Data residency

- NEX uses **Supabase (hosted)** for identity, account storage, and
  realtime messaging transport.
- NEX uses **self-hosted Postgres** for canonical business data,
  Emergency Help incidents, and SafeChat classifications.

**Questions:**

- What data residency obligations apply to **Indonesian children's**
  data under PP 17/2025, Permenkomdigi 9/2026, and UU 27/2022?
- Does any category require data to reside on Indonesian soil
  (e.g. CSAM evidence, emergency incident records, verification
  documents)?
- Does cross-border transfer of a minor's data require a specific
  mechanism (SCCs equivalent, Komdigi filing)?

---

### P9 · Retention schedules (BLOCKS retention policy adoption)

NEX currently proposes:

- **Family Links revoked rows:** 90 days operational + 2 years
  aggregated (anonymous counts) + case-duration + 7 years for
  explicit legal holds. See
  `docs/doctrine/nex-family-links-retention-policy-draft-2026-10-10.md`.
- **Emergency incident metadata:** 180 days.
- **Location history:** 30 days post-closure, then anonymised.
- **SafeChat classifications:** 30 days (DEFAULT; env-adjustable).

**Questions:**

- Are any of these **too long** or **too short** under Indonesian
  law?
- What **minimum** retention is required for safeguarding records
  (incident reports, CSAM reports, missing-child cases)?
- What **maximum** retention is permitted before data must be
  anonymised or deleted?
- Is 7 years for legal-hold family-link rows acceptable, or does
  Indonesian law impose a lower ceiling?

---

### P10 · User rights (right to erasure, right to access)

Under UU 27/2022 and related regulation, how do data subject rights
apply to:

- **Children** — do they have independent rights, or are rights
  exercised only through a guardian until a stated age?
- **Guardians** — what access to the child's data are they entitled
  to? Can they view SafeChat classifications, Emergency Help history,
  friend lists, Vault presence?
- **Deleted accounts** — what residual data can lawfully be retained
  for safety (e.g. CSAM hashes, pressure-signal case records)?
- **At majority transition** — when a child becomes an adult, what
  must happen to historical data accumulated under guardian oversight?
  Does the guardian's view-right lapse automatically?

## Timeline requests

NEX requests a completion target of **[DATE TO BE AGREED WITH
COUNSEL]**. The following components depend on this review:

- Child account activation — **BLOCKED** on P1, P2, P3
- Family Links UI build — **BLOCKED** on P2, P3, P9
- SafeChat Phase 3 user-facing — **BLOCKED** on P4, P9
- CSAM integration (Phase 4) — **BLOCKED** on P5
- Emergency Help full public launch for minors — **BLOCKED** on P6
- Missing-child workflow — **BLOCKED** on P7

Components **NOT** blocked (can continue in parallel while review is
in flight):

- SafeChat Phase 1 **SIMULATED** instrumentation on synthetic data
  only (no real users affected, no logging in production).
- Emergency Help **SIMULATED** pilot (no real external alerts).
- Family Links **data-layer** development (no real children's
  accounts; schema and services only).
- Owner-claim, business directory, and marketplace surfaces
  (adult-only features; not children's-data domains).

## Materials available to counsel

All of the following are available on request; counsel does **not**
need them to answer the priority questions above, but they provide
depth:

- Sealed doctrine documents under `docs/doctrine/`:
  - Family Links foundations: `nex-family-links-foundations-2026-10-10.md`
  - Family Links UI spec (deferred): `nex-family-links-ui-spec-2026-10-10.md`
  - Family Links decisions adopted (companion ADR): `nex-family-links-decisions-adopted-2026-10-10.md`
  - Family Links retention policy draft: `nex-family-links-retention-policy-draft-2026-10-10.md`
  - SafeChat Phase 1 SIMULATED doctrine: `nex-safechat-phase-1-simulated-2026-10-10.md`
  - SafeChat privacy audit evidence: `nex-safechat-privacy-audit-evidence-2026-10-10.md`
  - SafeChat rules v1.1.0: `nex-safechat-rules-v1-1-0-2026-10-10.md`
  - Emergency Help foundation: `nex-emergency-help-foundation-2026-10-10.md`
  - Emergency Help abuse policy: `nex-emergency-help-abuse-policy-2026-10-10.md`
  - Emergency Help police handoff: `nex-emergency-help-police-handoff-2026-10-10.md`
  - Emergency Help live location: `nex-emergency-live-location-2026-10-10.md`
- Schema definitions: `deploy/postgres/init/198_nex_family_link.sql` and surrounding migrations.
- Service layer: `src/lib/nex-native/family-links/*`, `src/lib/nex-native/safechat/*`, `src/lib/nex-native/emergency/*`.
- SafeChat classification evaluation methodology:
  `src/lib/nex-native/safechat/__eval__/` (synthetic corpus, no real
  user messages).

## Appointed-counsel sign-off block

- Date brief received: ________________
- Date engagement agreed: ________________
- Target completion date: ________________
- Counsel firm: ________________
- Lead counsel: ________________
- Scope limitations noted by counsel: ________________
- Fee basis: ________________
- Preferred reporting cadence to NEX: ________________

## NEX operator sign-off block

- Date brief sent: ________________
- NEX operator: ________________
- Primary contact for counsel questions: ________________
