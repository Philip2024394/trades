# 04 · Standing-Line Governance

**Founder-authored governance artefact · 2026-09-22 · governance only · not runtime**

The standing marketing status line is the single sentence of external-facing truth about NEX Managed Email Marketing's operational state. This document defines who can change it, when it may change, what it is permitted to say, and how it reverts if evidence turns.

## Current line

> **NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.**

Location: `src/lib/nex/marketing/deliverability/acceptance-matrix.ts` · exported by `buildAcceptanceMatrix()` as `standing_marketing_status_line`.

Rendered by:

- `/api/nex/founder/marketing/acceptance-matrix` (Session-11 · Founder-only)
- `/nex-head-quarters/email-marketing` live-intelligence panel (Session-18 · Founder-only)
- Every session receipt in `docs/world-activation-pack/` and every memory file

## The core rule

> The standing line changes only when the evidence set defined in this document is satisfied for a specific gate, and only via a code+test update signed by the Founder as part of an ADR.

The runtime is never permitted to update the line. There is no admin surface, no cron job, no API mutation, no environment variable, no configuration file that can rewrite this sentence. Its editing surface is source control.

---

## Why the line is governance-only

1. **It is a promise.** Every place NEX renders the line, a homeowner or a peer might read it. Promises to real users must not update themselves when the machinery guesses it is winning.
2. **It is falsifiable.** Every phrase in the allowed set is either directly evidenced or directly refuted by the audit tables in `02-audit-sql.md`. A subjective "looks good" is never enough.
3. **It is the boundary between machinery and world.** The word "PROVEN" earns real weight only when preceded by observation that matches prediction across a Stage-6 evidence set. Any earlier claim erodes the boundary.
4. **It is public.** The line is not an internal debug string. It is what NEX says about itself. Treating it as governance keeps that discipline visible.

---

## Who may propose a line change

Only the Founder. No engineer, no automated agent, no support process, no monitoring system may propose or apply a line change on their own authority. An engineer may notice that a gate has reached Stage 6 and prepare the ADR draft, but the change itself requires the Founder's explicit sign-off in the ADR.

---

## When the line may change · the fact set required

For each gate reaching Stage 6, the following must all be true and citable:

1. **Founder-authorised**: env var set to `"on"` in the deployment, per gate's runbook (§01)
2. **Bounded first cycle recorded**: BEFORE and AFTER audit snapshots (§02) exist and are stored with the ADR
3. **Prediction → observation table**: every row is ✓ MATCH · zero ✗ DIVERGE · zero ? UNKNOWN
4. **N cycles sustained**: the gate has run its Stage-6 minimum number of cycles (see §01 per gate) with zero divergence across ALL cycles
5. **Zero governance boundaries crossed**: audit query for "unexpected traffic" and "gate enforcement" both return zero across the full sustained window
6. **Zero fabrication**: audit query for "fabrication" returns zero
7. **Rollback tested at least once**: at some point during the Stage-6 window (typically at Stage 3-4), the gate was un-flipped and re-verified dormant, then re-flipped by explicit re-authorisation. Untested rollbacks are not acceptable.

The ADR that proposes the line change must cite each of the seven items above with concrete evidence (query results, timestamps, tick_seqs, event_ids, ADR references).

---

## The allowed phrase set

The line is not free-form. Each allowed variant is a narrower true statement. The rule is: a line may only tighten toward reality, never loosen toward aspiration.

### Baseline (current)

> `NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.`

### After exactly one gate reaches Stage 6

Format: name the gate that is proven, keep the negative for the rest.

> `NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · GATE #{n} ({name}) PROVEN RUNNING AGAINST THE WORLD · GATES {list} STILL DORMANT.`

Example after Gate #1 (PageFetcher) reaches Stage 6 for its bounded scope:

> `NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · GATE #1 (PageFetcher) PROVEN RUNNING AGAINST THE WORLD (one host: overpass.osm.ch) · GATES #2/#3/#4 STILL DORMANT.`

### After two gates reach Stage 6

Same shape; two gates named, two still dormant.

### After three gates reach Stage 6

Same shape; three gates named, one still dormant.

### After all four gates reach Stage 6 for their initial bounded scopes

> `NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · ALL FOUR GATES PROVEN RUNNING AGAINST THE WORLD (bounded scopes: {details}) · WORLD-SCALE OPERATION STILL PENDING.`

### After sustained multi-scope operation across all four gates

Only at this point is the negative clause finally retired.

> `NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST AND RUNNING AGAINST THE WORLD.`

There is no version of the line that claims world-proof before four gates × Stage 6 × sustained multi-scope. The word "world" attaches to observation, not to code readiness.

### Prohibited variants

Any of the following are structural violations of this document. If any of these ever appear in the codebase, revert immediately via a new ADR:

- "PROVEN AT WORLD SCALE" without four gates × sustained multi-scope evidence
- "PROVEN IN PRODUCTION" (the word "production" is not what governs — evidence is)
- Any variant that removes the negative clause before it is fact
- Any variant added by an automated process
- Any variant that reads better than the current one but is not narrower and truer

---

## Change process

1. **ADR draft.** File under `docs/DECISIONS/` with next available number. Title: "Standing marketing status line: adopt variant for Gate #{n} Stage-6".
2. **Evidence citation.** ADR body includes:
   - Concrete audit-query results (from §02) for BEFORE and AFTER of the qualifying flip
   - Prediction → observation table with every row ✓
   - The N-cycle sustained-window log
   - The rollback-test evidence
   - Any related tick_seqs, event_ids, bounce_log fingerprints
3. **Founder signature.** Explicit sign-off in the ADR (name + date + phrase "I authorise this line change per docs/world-activation-pack/04").
4. **Code + test update in the same commit.**
   - `src/lib/nex/marketing/deliverability/acceptance-matrix.ts` · edit the constant
   - `src/lib/nex/marketing/deliverability/__tests__/acceptance-matrix.test.ts` · update the assertion for the new line verbatim
   - `docs/world-activation-pack/README.md` · update the "Current line" section
5. **Regression.** Full marketing + discovery-world + discovery-intel test suite must pass at the new line.
6. **Memory record.** New session receipt in `~/.claude/projects/.../memory/` capturing the line change with evidence pointers.

Any step skipped → ADR rejected. No exceptions.

---

## Revert process

If, after a line change, evidence turns — a gate that reached Stage 6 later exhibits divergence at Stage 6+ — the line reverts.

Revert is not a demotion but a correction. It follows the same process:

1. New ADR (never edit the old one) titled "Standing marketing status line: revert variant for Gate #{n} due to evidence turn".
2. Cite the divergent evidence.
3. Founder signature.
4. Code + test update reverting the constant to the prior variant (or an even narrower one).
5. Regression passes at the reverted line.
6. Memory record.
7. **The affected gate goes back to Stage 1** and follows §01 from the top when re-attempted.

There is no version of "keep the line, downgrade the gate quietly". Every world-facing claim must remain synchronised with observation.

---

## The runtime is never permitted to touch this

Explicit list of what may NOT do:

- No API endpoint may accept a `PATCH` or `POST` that rewrites the constant
- No environment variable may override the constant value
- No feature flag may branch to a different variant at runtime
- No database column may store an alternative line consumed by any renderer
- No LLM output is permitted to appear in the standing line under any circumstance
- No monitoring rule may auto-adjust the line
- No CI job may edit `acceptance-matrix.ts` without a corresponding ADR file staged in the same commit

If any of the above are ever proposed, cite this document to reject.

---

## Summary

The standing line is under governance because it is public, promissory, and falsifiable. It moves only when evidence has already moved. It moves through source control, ADRs, and Founder signature — never through runtime magic. It moves forward only when a gate has genuinely proven itself, and backward the moment evidence contradicts it.

**Preserve every invariant. Move deliberately. Prefer un-flip over relaxation. Prefer a true narrower line over a wider aspirational one.**
