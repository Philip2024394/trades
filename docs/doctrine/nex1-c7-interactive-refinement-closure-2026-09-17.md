# C7 · Interactive Intent Refinement · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue slice · after Agent 10.
**Authority:** Founder-authorised · "continue" instruction after Agent 10 shipped RUNTIME_VERIFIED.
**Author:** master_ai_engineer (Claude Opus 4.7)
**Discipline:** Completion Contract §14 · real evidence, honest limits.

## §1 · Target
Turn Agent 10's text options ("A/B/C/D") into a real feedback loop. When the founder replies with a letter, slug, display name, or a distinctive word — resolve the ambiguity deterministically, force the chosen intent through the pipeline, and skip re-classification.

## §2 · Root cause
Agent 10 emitted options but the follow-up reply went through the SAME classifier again. A reply of "A" would classify as unknown (no verb) and refuse. The founder had to rephrase the full request instead of just picking.

## §3 · Plan
1. Build a **clarification resolver** with 4 match methods (letter · slug · display · trigger) + explicit-none.
2. Hook it early in `processTask` — read the task's own trace for a recent `ambiguity_clarification` step, resolve the reply, set `forcedIntentSlug`.
3. Downstream: when `forcedIntentSlug !== null` → skip chat short-circuit, skip ambiguity resolver, force `intent` with confidence 0.9, proceed to coding ACK + discussion.

## §4 · Mutation (files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/lib/nex-agent/language/capability-clarification-resolver.ts` | **NEW · 175 lines** | 4-method resolver + `extractLatestReply()` helper. |
| `src/lib/nex-agent/core/orchestrator.ts` | Modified | `fetchLastAmbiguityOptions()` helper (Postgres query) · C7 hook at processTask entry · intent override · chat short-circuit gate. `~50 lines added.` |

**Zero other files modified.** No new endpoints. No DB migrations. No LLM. No changes to Q7/Q8/Truth Engine/persona.

## §5 · Verification · Turn 1 + Turn 2

**Turn 1** · submit `"add fix"` (task T1):
- status: `clarifying`
- ambiguity fired · options `A:fix_bug | B:add_feature | C:unknown`

**Turn 2** · submit `"A"` with `continue_task_id = T1`:
- status: `plan_ready`
- Trace: `plan proposed` → `ROUND 1 · nex2 architecture scan` → `ROUND 1 · nex3 security scan` → `✓ CONSENSUS reached` → `plan handed to founder`

**Live confirmation** · the founder now completes an ambiguous exchange in TWO clicks: type "add fix", type "A".

## §6 · All 4 methods live-verified

| Reply | Method | Resolved slug |
|-------|--------|---------------|
| `A` | letter | fix_bug ✓ |
| `b` | letter | add_feature ✓ |
| `fix_bug` | slug | fix_bug ✓ |
| `fix a bug` | display | fix_bug ✓ |
| `the fix one` | trigger (fell through display · "fix" is 3 chars) | fix_bug ✓ |
| `bug` | trigger | fix_bug ✓ |
| `none` | (explicit_none) | unresolved · explicit_none ✓ |
| `asdf` | (no match) | unresolved · no_match ✓ |

Zero misfires · every reply either resolves to the intended slug OR returns the correct unresolved reason.

## §7 · Safety boundary honoured

- **Zero LLM** in resolver (grep-verified · pure regex + registry lookup).
- **Deterministic** · same reply + same options → same result every time.
- **Sandboxed** · resolver only accepts options passed to it · cannot force intents outside the registry.
- **Trace transparency** · both `clarification_resolved` and `clarification_unresolved` emit `thought` steps with full context (reply · options · method · matched-on).
- **Truth Engine untouched.** Pricing.ts SHA unchanged.
- **Chat-only intents preserved** · resolver is not called for those (they short-circuit before ambiguity).

## §8 · What the founder now sees

Before this batch:
```
Founder: "add fix"
NEX1:    "I'm close · which did you mean? (A) Fix a bug (B) Add a new feature (C) Something else"
Founder: "A"
NEX1:    "refused_no_verb_recognised" ❌
```

After this batch:
```
Founder: "add fix"
NEX1:    "I'm close · which did you mean? (A) Fix a bug (B) Add a new feature (C) Something else"
Founder: "A"
NEX1:    "Got it · fix mode. Reading the affected files and drafting the diff." ✅
         [then real plan_ready in ~5s]
```

## §9 · Trace-level receipts

Every resolved turn emits TWO diagnostic steps (both `step_kind=thought` · hidden from chat UI · queryable forever):

- `clarification_resolved` — kind, method, matched_on, resolved_slug, prior_options, reply
- Followed by the coding ACK (`kind=coding_ack` · visible in chat)

For unresolved replies, a `clarification_unresolved` step lands with the reason. The pipeline then falls back to normal classification so the founder isn't stuck.

## §10 · Honest limitations disclosed

1. **Continuation requires `continue_task_id`.** The workstation client already sends this when `activeTask.status === "clarifying"`, but external API callers must include it explicitly. Not auto-detected.
2. **Ambiguous plain-English replies** ("do both" · "either") still resolve via triggers rather than intent. If "both" appears with a bug-adjacent word, it'll pick fix_bug. That's the trigger method by design.
3. **Only the LATEST reply is considered.** If the founder types multiple `[FOUNDER REPLY]` sections across many turns, only the last one is scored. The full history remains in the trace.
4. **No decision-button UI yet.** The founder still types A/B/C rather than clicking. Wiring the workstation StepCard to render decision buttons on `ambiguity_clarification` handoffs is the natural NEXT slice (C7 phase 2). Not in this batch.
5. **"the fix one"** lands via trigger rather than display because "fix" is 3 characters — my display-substring filter requires ≥4-char distinctive terms to avoid false-positive matches on common words. Result slug is still correct.

## §11 · Regression

Persona replies unchanged:
- `hello` → warm greeting ✓
- `thanks` → gratitude reply ✓
- `refactor the pricing function` → coding ACK ✓
- Chat short-circuit still short-circuits when appropriate ✓
- Non-continuation prompts hit the classifier normally ✓ (C7 hook is gated on `continue_task_id`-driven `[FOUNDER REPLY]` marker)

## §12 · Queue after C7 (per your "unlocks most next-slices" answer)

Original queue: **C7 → C10 → C11**. After C7 verified, the natural next is:

- **C10 · ConversationHead as knowledge graph** — extend existing ConversationHead with typed nodes (`founder_preference · current_goal · refused_prompt · active_file · unresolved_question · agreed_decision`). Unlocks Session Historian (agent 9) + real cross-turn memory. ~600 LOC.
- **C7 phase 2** (adjacent · could go next) — wire the workstation StepCard to render clickable buttons for `ambiguity_clarification` handoffs. Removes typing burden. ~150 LOC.
- **C11 · Uncertainty as first-class output** — generalise the tri-state (clarify · proceed · refuse) across the whole pipeline. Currently only the ambiguity path uses it explicitly. ~400 LOC.

## §13 · What did NOT ship in this batch

- No 40+ agent orchestration.
- No agent-to-agent teaching wire.
- No Teaching Agent implementation (audit only per §19 gate).
- No Truth Engine changes.
- No Q7/Q8 changes.
- No workstation UI code touched.
- No new DB migrations.
- No LLM anywhere.

## §14 · Founder next step

**Test it in the workstation:** hard-refresh `http://localhost:3008/nex1/workstation-live`, type `"add fix"`, wait for the A/B/C prompt, then type `"A"`. You'll see the coding ACK + plan flow instantly.

**Or authorize next slice:** say "continue" and I'll build C10 (ConversationHead knowledge graph) next.

No further code moves without your instruction.
