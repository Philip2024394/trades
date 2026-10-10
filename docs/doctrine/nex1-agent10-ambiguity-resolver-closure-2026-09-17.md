# Agent 10 · Ambiguity Resolver · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §5 · first slice · smallest verifiable increment.
**Authority:** Founder-authorised via AskUserQuestion (Recommended · fastest win).
**Author:** master_ai_engineer (Claude Opus 4.7)
**Discipline:** Completion Contract — every field below is real evidence, not narration.

---

## §1 · Target

Replace the generic "refused_no_verb_recognised / I couldn't classify" behaviour when the classifier is mid-confidence (0.35–0.55) with **2-3 concrete interpretation options** the founder can pick with a single letter.

## §2 · Goal

Zero-LLM · deterministic · reproducible. Given the same prompt, same options every time. No hallucination. No RNG.

## §3 · Evidence · what did NOT exist before

- The classifier returned top-1 intent + a single confidence number.
- When confidence < 0.55, the pipeline emitted `clarifyingQuestions(intent)` — the intent's own clarifier questions from `code-intent-registry.ts` — even if two intents were tied.
- The founder never saw the second candidate. Silent commitment to top-1.

## §4 · Root cause

The classifier does not expose top-K. Neither does `parseIntent` from the language engine (single-intent return). The registry HAS all the scoring signal (trigger_tokens + trigger_phrases + confidence_base per intent) but it was never surfaced as a ranking.

## §5 · Plan

1. Build a new **`capability-ambiguity-resolver.ts`** that scores EVERY registry intent against the prompt with a deterministic formula.
2. Detect ambiguity via 5 rules: R1 top-1 not too vague · R2 top-1 not clear-winner · R3 top-1 vs top-2 gap tight · R4 top-1 not chat-only · R5 ≥2 competing intents.
3. Wire into orchestrator at the exact point where clarifying-questions were about to fire.
4. Emit a `handoff` step with the options; task stays `clarifying`.
5. Verify with direct probe + end-to-end HTTP.

## §6 · Safety boundary (assertions honoured)

- **Zero LLM** — module has no `fetch`, no external calls, no provider imports. Grep-verified.
- **Deterministic** — the scoring is pure math over the frozen registry. Same input → same output.
- **No file writes** — the resolver reads the registry constant, nothing else.
- **No pipeline widening** — the resolver runs ONLY inside the `if (confidence < 0.55 || kind === "unknown")` branch that already existed. Never on high-confidence prompts.
- **Chat-only intents preserved** — R4 short-circuits before ambiguity flows so persona replies still fire for `small_talk / gratitude / help_request / etc.`
- **Truth Engine untouched** — no imports from `src/lib/nex/truth-engine/*`.
- **Pricing.ts SHA unchanged.**

## §7 · Authorization

Founder AskUserQuestion answered: **"Agent 10 · Ambiguity Resolver (Recommended · fastest win)"** with preview:
```
Founder: "can you make it faster"
Classifier: confidence 0.62 (was refused_no_verb)
NEX1 now: "I'm close · which did you mean?
  (A) refactor for performance
  (B) reduce a specific slow path
  (C) something else · describe it"
```

## §8 · Mutation (all files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/lib/nex-agent/language/capability-ambiguity-resolver.ts` | **NEW · 245 lines** | Top-K scorer + 5-rule ambiguity detector + option formatter. |
| `src/lib/nex-agent/core/orchestrator.ts` | Modified | Import + short-circuit in the `< 0.55` branch. `~20 lines added.` |
| `src/app/api/nex1/ambiguity-probe/route.ts` | **NEW · 42 lines** | Diagnostic endpoint for probing the resolver without going through the orchestrator's confidence gate. |

**Zero other files modified.**

## §9 · Execution

Turbopack dev compiled all three files cleanly. Server remained on `http://localhost:3008` throughout. No restarts required. Zero TypeScript errors on the edited files.

## §10 · Verification · direct probe (12 cases against the resolver module)

| Prompt | Decision | Top-3 scored | Options emitted |
|--------|----------|--------------|-----------------|
| `hello` | proceed | small_talk:0.36 | — (chat_dominant) |
| `asdf zxcv` | refuse | (none) | — (too_vague) |
| `add fix` | **clarify** | fix_bug:0.46 · add_feature:0.42 | A:fix_bug B:add_feature C:unknown |
| `clean bug` | **clarify** | fix_bug:0.46 · refactor:0.44 | A:fix_bug B:refactor C:unknown |
| `rename add` | **clarify** | refactor:0.44 · add_feature:0.42 | A:refactor B:add_feature C:unknown |
| `test refactor` | **clarify** | add_test:0.45 · refactor:0.44 | A:add_test B:refactor C:unknown |
| `help me fix` | proceed | help_request:0.59 · fix_bug:0.46 | — (chat_dominant · help_request wins) |
| `code` | proceed | capabilities:0.35 | — (chat_dominant) |
| `add or fix or refactor` | **clarify** | fix_bug:0.46 · refactor:0.44 · add_feature:0.42 | A/B/C/D four-way |
| `make new endpoint or migration` | **clarify** | add_api_route:0.61 · add_migration:0.47 · add_feature:0.42 | A/B/C/D four-way |
| `refactor pricing` | proceed | refactor:0.44 | — (single-intent, no competition) |
| `add a comment to pricing.ts` | proceed | add_feature:0.42 | — (single-intent) |

**6 clarify · 6 proceed/refuse · zero misfires.**

## §11 · Verification · end-to-end (5 cases via `POST /api/nex/agent/submit`)

| Prompt | Result |
|--------|--------|
| `add fix` | ✓ AMBIG · A:fix_bug B:add_feature C:unknown · reply starts `"I'm close · which did you mean?"` |
| `clean bug` | ✓ AMBIG · A:fix_bug B:refactor C:unknown |
| `rename add` | ✓ AMBIG · A:refactor B:add_feature C:unknown |
| `test refactor` | ✓ AMBIG · A:add_test B:refactor C:unknown |
| `add or fix or refactor` | Coding ACK (`Got it · fix mode…`) — classifier had confidence ≥ 0.55 so my resolver was never invoked. **Correct behaviour** · the resolver only runs when the classifier is uncertain. |

## §12 · Regression (persona replies still work)

| Prompt | Reply |
|--------|-------|
| `hello` | "Hi. Late one — what are we shipping?" |
| `thanks` | "No worries. Ready for the next one." |
| `how are you` | "Solid · no downtime. What do you want me to look at?" |
| `add a comment to pricing.ts` | "OK · feature build. Scanning the repo…" |

## §13 · Completeness · what this batch DID and did NOT do

**Did:**
- Deterministic top-K scoring across the full CODE_INTENT_REGISTRY.
- 5-rule ambiguity detection with configurable thresholds (CFG constants).
- Chat-only exemption (small_talk / gratitude / help_request / etc. bypass resolver).
- End-to-end wire in the orchestrator.
- Diagnostic probe endpoint for verification.
- Real HTTP verification of 12 direct + 5 end-to-end + 4 regression cases.
- Doctrine written.

**Did NOT:**
- No LLM added anywhere.
- No new database migration.
- No changes to Q7/Q8/Truth Engine/ConversationHead.
- No changes to persona replies from previous batch.
- No changes to the workstation UI code.
- No implementation of C1-C12 or agents 1-9, 11-18.
- No agent-to-agent teaching wire.
- No 40+ agent orchestration.

## §14 · Trace evidence

Each ambiguity firing emits **two** step rows to `nex_agent.task_steps`:
- `actor=nex1 · step_kind=thought · body.kind=ambiguity_diagnostic` (audit trail: primary/alternates/options)
- `actor=nex1 · step_kind=handoff · body.kind=ambiguity_clarification` (the user-facing text)

Both are queryable in the trace forever.

## §15 · Final state

- Server: HTTP 200 on `/nex1/workstation-live`
- Endpoint `/api/nex1/ambiguity-probe?prompt=…` live for diagnostics
- Ambiguity resolver: **RUNTIME_VERIFIED**
- Persona replies: unchanged
- Coding ACKs: unchanged
- Zero LLM in the chat pipeline: unchanged
- Founder's Completion Contract: honoured (real evidence, no half-finished claims)

## §16 · Known limitations · disclosed honestly

1. **Classifier confidence gate can be too generous.** Prompts like "add or fix or refactor" have enough length to push `classifyPrompt` above 0.55, so the resolver never sees them. To surface those in ambiguity mode, `classifyPrompt`'s heuristics would need to be inverted — not in scope for this batch.
2. **Short mid-confidence prompts still fall through to questions.** E.g. `refactor pricing` (16 chars) triggers the length penalty in `classifyPrompt`, confidence drops to ~0.49, resolver runs, no ambiguity found (single competing intent), falls through to `clarifyingQuestions` — same behaviour as before. If you want short-prompt coding ACKs even without ambiguity, that's a separate improvement.
3. **Founder cannot yet click A/B/C to auto-resume.** The options are TEXT for now. The founder must reply with a rephrase to progress. Wiring the decision-buttons UI to the ambiguity options is the next natural step (part of the Skill Compilation frontier concept C9).
4. **Chat-only precedence is strict.** "help me fix" resolves to `help_request` (chat_dominant) not the ambiguity `fix_bug / help_request` because chat-only intents win by design (R4). If you want "help me fix X" to route to `fix_bug`, adjust R4 or add a phrase to `help_request` that requires objectless intent.

## §17 · Queue · next slices (per your "unlocks the most next-slices" answer)

Per frontier §5, the natural queue after Agent 10 is:
1. **C7 · Interactive intent refinement** (build on this resolver — decision buttons, multi-turn refinement)
2. **C10 · ConversationHead as knowledge graph** (memory for the refinement conversation)
3. **C11 · Uncertainty as first-class output** (generalise the "clarify vs refuse vs proceed" tri-state)

Each is a separate authorization gate before it runs.

## §18 · Founder next step

Two options:

- **Approve queue continuation:** I proceed to C7 next batch.
- **Test this in the workstation first:** hard-refresh `http://localhost:3008/nex1/workstation-live`, type an ambiguous prompt like "add fix" or "clean bug", and confirm the reply shows the A/B/C/D options in the Code feed. Then approve the next batch.

**No further code moves until you say.**
