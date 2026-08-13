# Amendment #16 · DRAFT · NOT MERGED

**Status:** proposal only · awaits Philip's explicit merge instruction
**Author of record:** Philip (via Claude · architect scope)
**Date drafted:** 2026-08-08
**Target file when merged:** `docs/COMMUNICATIONS_CENTRE_ARCHITECTURE_v1.0.md`
**Prerequisite for merge:** Predictive v0.1 proven against real evidence + explicit Social 1.0 greenlight
**Purpose:** ratify the Social Engine charter into the top-level architecture doctrine so Social 1.0 code can begin without violating the frozen-kernel discipline.

---

## Proposed edit to the Amendments block (top of `docs/COMMUNICATIONS_CENTRE_ARCHITECTURE_v1.0.md`)

Append the following line to the existing amendment list:

```
- **1.0.6 (TBD)** — 16th invariant added (Social Engine is an additive module bound by its own charter) ahead of Phase Social 1.0. The Nex Social Engine is an additive layer over the frozen v1.0.0 kernel; it must not modify any of the 7 frozen interface hashes. All Social Engine behaviour is governed by `docs/NEX_SOCIAL_ENGINE_CHARTER.md` and its 12 candidate invariants (S-I through S-XII).
```

## Proposed edit to the Invariants section

Add invariant **16** immediately after invariant **15** (Prediction Is Not Execution). Exact text:

```
16. **Social Engine is an additive module bound by its own charter.** The Nex Social Engine — all code under `src/lib/nex/social/**`, `src/app/api/nex/social/**`, `src/components/nex-app/nex-brain/Social*`, and all `nex.social_*` database tables — is an additive layer over the frozen v1.0.0 kernel. It MUST NOT modify any of the 7 frozen interface hashes (delivery/types, analytics/types, compliance/types, alerts/types, composer/types, campaigns/types, segments/types). It MUST NOT reuse Comms Centre tables for Social data — Social state lives exclusively in the `nex.social_*` namespace. All Social Engine invariants (S-I tenant isolation · S-II provider adapter isolation · S-III content grounding · S-IV rights classification required · S-V approval-default-ON · S-VI one-way publishing pipeline · S-VII idempotency required · S-VIII multi-stage safety validation Fact→Rights→Policy→Brand→Platform · S-IX OAuth-only tokens encrypted · S-X analytics grounded in provider APIs · S-XI Business ROI via existing Attribution · S-XII Social 1.x does NOT consume Predictive Engine) are locked in `docs/NEX_SOCIAL_ENGINE_CHARTER.md` and are enforceable at commit time via the same hash-verification pattern used for the v1.0 interfaces. The charter is authoritative; if a proposed change would violate one of the S-I…S-XII invariants, the architecture — not just the implementation — is at risk. (Amendment 1.0.6 · added ahead of Phase Social 1.0 · full doctrine in `docs/NEX_SOCIAL_ENGINE_CHARTER.md`.)
```

## Merge checklist (must ALL be true before this amendment lands in v1.0 doc)

- [ ] Predictive v0.1 observation-mode has formally concluded (Philip declares v0.1 outcome from real evidence).
- [ ] Philip has issued the explicit Social greenlight (words like *"start building Social 1.0"* / *"begin Social implementation"*).
- [ ] The 7 v1.0.0 frozen interface hashes verified matching manifest at merge time.
- [ ] `docs/NEX_SOCIAL_ENGINE_CHARTER.md` is present and unchanged since v0.1 ratification (or updated with a follow-up amendment).
- [ ] Philip has explicitly said *"merge amendment 16"* or equivalent.

Do not merge on my own initiative. Ever.

## What this amendment does NOT do

- Does not authorise Social 1.0 implementation on its own (that is a separate explicit greenlight).
- Does not modify any existing invariant #1 through #15.
- Does not touch the v1.0 charter body outside the two edits above.
- Does not change any frozen interface.
- Does not add or modify any schema.
- Does not touch Predictive, Attribution, Journey, Experiments, Compliance, Delivery, or any existing subsystem.

## Why this amendment first, before any Social code

The pattern that carried Comms Centre v1.0.0 → v1.0.5 (five successful amendments · seven consecutive additive phases · zero frozen-kernel hash drift) was: doctrine amendment lands FIRST, then implementation. Social 1.0 must follow the same discipline. This draft is ready-to-merge so that the moment Philip greenlights Social, the doctrine step is a one-command commit rather than a fresh design session.

## Enforceability plan (what makes S-I…S-XII actually binding)

At the time Social 1.0 code lands (not now), the charter invariants become enforceable by:

1. **Hash-verified charter reference in CI.** The SHA-256 of `docs/NEX_SOCIAL_ENGINE_CHARTER.md` is checked into a manifest; a change requires an amendment commit before Social code changes land.
2. **Import lint at commit time.**
   - `src/lib/nex/social/**` must not import `@/lib/nex/delivery/*`, `@/lib/nex/compliance/*`, or `@/lib/nex/predictive/*` (S-XII).
   - Only `src/lib/nex/social/adapters/*.ts` may import a social provider SDK (S-II).
3. **Schema namespace lint.** All Social migrations live under `deploy/postgres/init/*.sql` with tables prefixed `nex.social_*` (§27 of charter).
4. **RLS policy on every Social table** with `tenant_id` predicate (S-I).
5. **Frozen v1.0.0 hash check** unchanged on every Social commit (existing discipline).

Enforcement code lands with Social 1.0 phase 0 (charter-enforcement scaffolding), before phase 1.0 (Foundation). No exceptions.

---

## Status right now (2026-08-08)

- This draft: **NOT MERGED.**
- v1.0 architecture doc: **untouched at v1.0.5.**
- Social Engine: **not authorised for build.**
- Predictive: **observation-mode active.**
- Standing question: still *"Does the real data prove that Predictive v0.1 works?"* — still unanswered.

Awaiting the two upstream conditions before this amendment moves from draft to merged.
