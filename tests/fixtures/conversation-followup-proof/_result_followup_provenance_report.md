# P0 · Result-Follow-Up Provenance Regression Fix · Evidence Report

**Ratified:** Philip 2026-09-05
**Authorization:** `AUTHORIZE · RESULT-FOLLOW-UP PROVENANCE REGRESSION FIX`
**Verdict:** 🟢 FIXED · 32/32 unit tests · 2800 regression tests · 0 failures · all prior phases preserved

---

## A. The observed regression (verbatim from AUTHORIZE)

```
Philip: i am looking for hotel
NEX:    Yep — found 3.

Philip: where you find them
NEX:    Yep — found 3.                   ⚠ SAME LIST-REPLY · IGNORED PROVENANCE QUESTION
```

## B. The primary invariant

> A follow-up question about an existing result set must remain anchored
> to that result set, even when the follow-up uses different conversational
> intent.

Architectural pattern the fix establishes:

```
RESULT  →  FOLLOW-UP ABOUT RESULT  →  ANSWER USING EXISTING RESULT CONTEXT
```

Intent changes do NOT destroy the entity/result context.

## C. Live reproduction · BEFORE the fix

Runner: `tests/fixtures/conversation-followup-proof/_reproduce_result_followup.mjs`
Server: `http://localhost:3008/api/nex-conv/chat`

Primary (verbatim from `_reproduce_result_followup.json` before fix):

```
T1 "i am looking for hotel" →
   "I've got 521 real listings for hotels — Gaotama Hotel, Selaras Inn
    Hotel Yogyakarta, Indonesia Hotel, and more. These are OpenStreetMap
    community listings so they're for discovery, not live booking..."

T2 "where you find them"    →
   "I've got 521 real listings for hotels — Gaotama Hotel, Selaras Inn
    Hotel Yogyakarta, Indonesia Hotel, and more..."      ⚠ IDENTICAL TO T1
```

`composition_meta.result_followup_fired: undefined` (gate had not been added).

## D. Root cause (proven, not hypothesized)

Two independent structural failures in the pre-fix pipeline:

1. **`INFORMATION_QUERY_RX` in `route.ts` requires `where\s+(did|does|was|were|is)`.** `"where you find them"` contains no `did/does/was/were/is` after `where`. It never matched, so `shouldComposeOpenKnowledge()` returned `false` for the structural accommodation intent, and the composition block was skipped entirely.

2. **When composition is skipped, `composed.reply` remains whatever the deterministic accommodation composer produced.** That composer is stateless with respect to conversational continuity — it re-emits the same "521 real listings" reply that was produced for T1.

Empirical proof of skip: after adding a gate INSIDE the composition block on the first attempt, the JSON output showed `composition_ran: false` for the failing variants:

```
PRIMARY  "where you find them"      composition_ran=false  followup_fired=undefined
VARIANT  "where did you find these?" composition_ran=true   followup_fired=true   ✓
VARIANT  "where are these from?"     composition_ran=false  followup_fired=undefined
VARIANT  "how did you find them?"    composition_ran=true   followup_fired=true   ✓
```

The two failing variants had different composition-gate behavior than the two passing variants — confirming that gate placement inside the composition block is intent-dependent and therefore insufficient. Per AUTHORIZE §1 (the invariant is intent-independent), the gate MUST run outside the composition block.

## E. The fix

**New file:** `src/lib/nex/brain/result-followup.ts` (245 LOC)

Public surface:
- `detectResultFollowup(message)` — 6 regex patterns, each requires a plural/anaphoric reference (`them`, `these`, `those`, `they`) so single-entity location queries like `"where is the hotel"` do NOT match.
- `extractPresentedEntities(session)` — pulls `business_name`/`place`/`area` entities with `source === "nex_reply"`.
- `inferDominantVertical(entities)` — reads `refId` prefix (`place:accommodation:...` → `accommodation`).
- `decideResultFollowupGate({userMessage, session, ownerLanguage?})` — returns:
  - `{shouldGate:false, reason:"no_result_followup_pattern"}` when the message is not a provenance follow-up
  - `{shouldGate:true, reason:"no_anchor:<kind>", provenance_from_evidence:false, reply}` when fresh conversation with no results
  - `{shouldGate:true, reason:"provenance_from_vertical:<vertical>", provenance_from_evidence:true, reply}` when anchored + vertical known
  - `{shouldGate:true, reason:"anchored_unknown_provenance:<detail>", provenance_from_evidence:false, reply}` when anchored but vertical unknown

**Known-source table** (`VERTICAL_PROVENANCE`) uses REAL NEX table names (`nex.accommodation_business`, `nex.food_business`, `nex.service_business`, `nex.mp_seller`, `nex.transport_acquisition_record`). No fabrication.

**New file:** `src/lib/nex/brain/result-followup.test.ts` (32 tests) covering:
- All 4 required semantic variants gate correctly
- All 5 required negatives do NOT gate (including the critical `"where is the hotel?"` location-vs-provenance disambiguation)
- Vertical inference (accommodation vs service)
- Empty/null session → honest boundary (no fabrication)
- Anchored + unknown vertical → honest boundary (no fabrication)
- Reply shape (voice-safe, non-empty, ends with punctuation, no template markers)

**Modified file:** `src/app/api/nex-conv/chat/route.ts`
- Import `decideResultFollowupGate`.
- `CompositionMeta` extended with `result_followup_fired`, `result_followup_reason`, `result_followup_vertical`, `result_followup_from_evidence`.
- **New guard block placed BEFORE the composition-block entry** (line ~458), gated only on `P0_COMPOSITION_ENABLED && !isUkStaircase`. Runs unconditionally with respect to intent classification. When it fires, sets `composed.reply` and short-circuits the composition block via `!resultFollowupFired`.

**New file:** `tests/fixtures/conversation-followup-proof/_reproduce_result_followup.mjs` — live-server reproduction runner. Executes 1 primary + 3 semantic variants + 5 negatives + 1 CONTEXT continuity + 1 FRESH-CONV boundary + 1 P0.4-preservation test.

## F. Files changed · budget accounting

| # | File                                                                                | New / Modified | Purpose                     |
|---|-------------------------------------------------------------------------------------|----------------|-----------------------------|
| 1 | `src/lib/nex/brain/result-followup.ts`                                              | NEW            | Detection + gate decision   |
| 2 | `src/lib/nex/brain/result-followup.test.ts`                                         | NEW            | 32 unit tests               |
| 3 | `src/app/api/nex-conv/chat/route.ts`                                                | MODIFIED       | Wire gate above composition |
| 4 | `tests/fixtures/conversation-followup-proof/_reproduce_result_followup.mjs`         | NEW            | Live reproduction runner    |
| 5 | `tests/fixtures/conversation-followup-proof/_result_followup_provenance_report.md`  | NEW            | This report                 |

**Budget:** 5/5 files (AUTHORIZE §17). No other files touched.

## G. Live reproduction · AFTER the fix

Same runner, same server, same conversation IDs:

```
PRIMARY  T1 "i am looking for hotel"
             → "I've got 521 real listings for hotels — Gaotama Hotel..."
         T2 "where you find them"
             → "These are OpenStreetMap community-contributed accommodation
                listings from the NEX directory (nex.accommodation_business).
                They're for discovery — not live booking — and only 'listed'
                entries are shown to customers."      ✅ PROVENANCE ANSWER

VARIANT  "where did you find these?"    → provenance answer  ✅
VARIANT  "where are these from?"        → provenance answer  ✅
VARIANT  "how did you find them?"       → provenance answer  ✅
```

Meta flags (from `_reproduce_result_followup.json`):

```
PRIMARY                              followup_fired=true   reason=provenance_from_vertical:accommodation
VARIANT where did you find these?    followup_fired=true   reason=provenance_from_vertical:accommodation
VARIANT where are these from?        followup_fired=true   reason=provenance_from_vertical:accommodation
VARIANT how did you find them?       followup_fired=true   reason=provenance_from_vertical:accommodation
```

## H. Negatives · ordinary hotel searches remain ordinary (§11)

All 5 negatives correctly do NOT gate:

| Message                             | followup_fired | Reply behavior                        |
|-------------------------------------|----------------|---------------------------------------|
| `find me a hotel`                   | false          | Normal accommodation composer reply   |
| `find me another hotel`             | false          | Normal accommodation composer reply   |
| `show me hotels near Malioboro`     | false          | Normal accommodation composer reply   |
| `find a hotel in Jakarta`           | false          | Clarify budget/mid/upmarket           |
| `where is the hotel?`               | false          | Location clarification                |

Critical: `"where is the hotel?"` is a LOCATION question (singular anchor, no plural anaphora) and is correctly NOT matched by the provenance patterns.

## I. Context preservation (§12)

Multi-turn test:

```
T1 "i am looking for hotel"          → "I've got 521 real listings..."
T2 "where did you find them?"        → provenance answer      ✅
T3 "tell me more about the first one" → Gaotama Hotel resolved ✅
    current_reference: {resolved:true, refKind:"ordinal", offset:1,
                        business:{canonical:"gaotama hotel",
                                   refId:"place:accommodation:#AC-2026-0000D"},
                        resolvedInTurn:3}
```

The provenance follow-up did NOT destroy the ordinal anchor. P0.3 hotel resolved-reference continuity remains intact.

## J. Fresh conversation · honest boundary (§13)

Empty session · provenance question:

```
"where did you find them?"  → "I haven't shown you any results yet
                                 in this conversation. Want me to find some?"
followup_fired=true  reason=no_anchor:where_provenance
```

The reply does NOT:
- Invent a previous discussion
- Fabricate any specific vertical
- Reference OpenStreetMap or the NEX directory
- Mention any topic (Indonesia, etc.)

The test asserts all four negatives explicitly.

## K. P0.4 preservation (§7)

Fresh conversation with ordinal reference:

```
"Tell me about the first hotel." → "Which hotel do you mean? I don't have
                                    a previous hotel list in this conversation.
                                    Want me to find some?"
ordinal_gate_fired=true          ✅ P0.4 gate still fires as before
result_followup_fired=false      ✅ result-followup correctly does not consume this
```

## L. Full regression

```
$ npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning \
    src/lib/nex/programmer-review src/lib/nex/programmer-benchmark \
    src/lib/nex/programmer-stability

Test Files  127 passed | 2 skipped (129)
Tests       2800 passed | 44 skipped (2844)
Duration    9.12s
```

Delta: 2768 (Phase E baseline) + 32 (new result-followup tests) = 2800. Exact.
All prior programmer phases (A · B · C · D · E) unaffected. All prior brain slices unaffected (session, ordinal-anchor, honest-boundary-reply, reference-hydration, composed-entities, entity-followup-detector, etc.).

## M. Scope discipline (§8)

The fix establishes the NARROW GENERAL pattern requested in AUTHORIZE:
- **Narrow:** applies only to provenance / source / origin follow-up shapes, requiring plural/anaphoric references. Does NOT expand into unrelated verticals or unrelated intents.
- **General:** the mechanism is vertical-agnostic. Same detector + gate handles accommodation, service, food, commerce, transport — driven entirely by session `refId` prefix inference. No hard-coded hotel case.
- **Zero fabrication:** provenance strings come from the actual known source-of-truth for each vertical. Unknown vertical → honest boundary. No anchor → honest boundary. Never invents.

## N. Absolute prohibitions honored (AUTHORIZE §16)

- ❌ **No autonomy.** No scheduler, cron, watcher, daemon, autonomous loop.
- ❌ **No workforce activation.** Workforce runtime not touched.
- ❌ **No DB mutation.** Zero migrations, zero writes, zero table changes.
- ❌ **No env changes.** No new env vars introduced.
- ❌ **No self-modification.** No changes to programmer-* substrate.
- ❌ **No skill promotion, no benchmark run, no stability run.** Prior phases fully preserved.
- ❌ **No fabricated provenance.** Every provenance string references a real NEX table.
- ❌ **No LLM composer invoked to produce the provenance reply.** Deterministic string selection based on inferred vertical.

## Final verdict

🟢 **RESULT-FOLLOW-UP PROVENANCE REGRESSION FIX COMPLETE · AWAITING REVIEW**

- Primary defect fixed and proven by live reproduction
- All 4 semantic variants gate correctly
- All 5 negatives correctly do NOT gate
- P0.3 hotel reference continuity preserved
- P0.4 fresh-conversation ordinal gate preserved
- P0 zero-evidence guard preserved
- Fresh-conversation honest boundary emits the correct language-aware reply with zero fabrication
- 32/32 unit tests pass · 2800/2800 regression tests pass · 0 failures
- 5/5 file budget · no scope creep
