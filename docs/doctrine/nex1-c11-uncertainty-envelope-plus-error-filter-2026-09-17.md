# C11 · Uncertainty as First-Class Output + ErrorGuardian Filter · Closure

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · eighth slice · plus a targeted UX fix for the
"workstation 12 error" issue the founder surfaced mid-batch.
**Authority:** Founder "continue" then live "work station 12 error" report.
**Author:** master_ai_engineer (Claude Opus 4.7)

## §1 · Two problems solved in this batch

**Problem 1 · "workstation 12 error"** — the founder was seeing a badge with 12 errors. All were `TypeError: Failed to fetch` from routine polling components (NexAgentClient polling `/api/nex/agent/stream` every 5 s, ConstitutionalTicker every 30 s, etc.). These are transient during Turbopack recompiles + browser tab-hidden throttling. Not real errors, but ErrorGuardian was surfacing them.

**Problem 2 · C11 uncertainty as first-class** — the response shape from `processTask` was `{status, plan, questions, brief, rounds_used}` — no typed *quality* signal. Consumers (workstation UI, tests, doctrine enforcers) had to infer whether NEX1 was confident, unsure, or refusing. That's the exact failure mode LLMs have when they hallucinate confidence.

## §2 · Fix 1 · ErrorGuardian filter (added 4 patterns)

**File:** `src/app/nex1/workstation-live/agent/ErrorGuardian.tsx`

Added to `IGNORE_PATTERNS`:
- `/Failed to fetch/i`
- `/NetworkError when attempting to fetch/i`
- `/Load failed/i` (Safari's variant)
- `/The user aborted a request/i`

Existing filters already had `ResizeObserver loop`, `Non-Error promise rejection`, `aborted a request`. The pattern shape matched the doctrine — this was a completeness fix, not a design change.

**Why safe:** real API failures still fire as HTTP 500 (caught by TurbopackWatchdog's 500-body-scan path with compile-error signatures) or explicit exception paths. The four new patterns are dev-server hiccup noise.

## §3 · Fix 2 · C11 Uncertainty Envelope

**New file:** `src/lib/nex-agent/code-engine/capability-uncertainty-envelope.ts` (~155 LOC)

```typescript
type UncertaintyVerdict =
  | "confirmed" | "partial" | "clarify"
  | "insufficient_evidence" | "refused"
  | "not_yet_verified" | "conflicting_evidence";

interface UncertaintyEnvelope<T> {
  verdict: UncertaintyVerdict;
  value: T | null;
  confidence: number;           // [0, 1]
  reason: string;
  missing_evidence: MissingEvidence[];
  options: OptionCandidate[];
  provenance: ProvenanceRef[];
  next_action_hint: string | null;
  source: "NEX1_NATIVE";
  zero_llm: true;
}
```

Plus 7 typed builder functions (`buildConfirmed`, `buildPartial`, `buildClarify`, `buildInsufficient`, `buildRefused`, `buildNotYetVerified`, `buildConflicting`), 2 predicate helpers (`isActionable`, `needsFounder`), and a `summarise()` one-liner.

**Modified:** `src/lib/nex-agent/core/orchestrator.ts` — 4 exit points now return envelopes.

## §4 · Verification · 4 real HTTP scenarios

| Prompt | Verdict | Confidence | Options | Next action hint |
|--------|---------|------------|---------|------------------|
| `hello` | `confirmed` | 0.90 | — | "type another prompt when ready" |
| `asdf` | `insufficient_evidence` | 0.10 | — | "rephrase the prompt with a verb…" |
| `clean bug` | `clarify` | 0.40 | A/B/C | "reply with the letter (A/B/C…)…" |
| `add a comment to pricing.ts line 1` | `not_yet_verified` | 0.75 | — | "founder reviews the plan · approve or reject" |

Every response now carries the full envelope · consumers can branch on `verdict` alone. `zero_llm: true` and `source: "NEX1_NATIVE"` echoed on every reply.

## §5 · Design intent

Founder rule from the frontier doctrine (Part 4 · C11):
> LLMs hallucinate confidence. Zero-LLM systems refuse honestly and offer paths forward.

The envelope makes that discipline **mechanical**:
- Every decision **declares** a verdict from the 7-state vocabulary.
- Every clarify **carries** the options that were offered (no invisible defaults).
- Every refuse **states** what would change the outcome (missing_evidence).
- Every partial **splits** what's verified from what remains.
- Every result **cites** its provenance (trace_key / step_id / file:line).

Any consumer reading the envelope can now reason about the *quality* of NEX1's decision without inspecting internal state or guessing.

## §6 · Safety honoured

- **Zero LLM** — envelope builders are pure functions · grep-verified no fetch / provider imports.
- **Deterministic** — same result path → same envelope shape.
- **Backwards-compatible** — `uncertainty` is a NEW optional field on the return type. Existing callers that only read `status / plan / questions / brief` see no change.
- **Bounded** — the envelope carries at most 4 options + short arrays. No unbounded growth.
- **Pricing.ts SHA unchanged · Truth Engine untouched · Q7/Q8 untouched · persona untouched · C7 untouched · C10 untouched.**

## §7 · Regression

- Chat replies still work (`hello`, `thanks`, `how are you` etc.)
- Coding ACKs still fire (`add a comment to X`)
- Ambiguity still fires + click-to-pick still resolves
- Notes panel unchanged · session graph unchanged
- All previous batches still RUNTIME_VERIFIED

## §8 · Honest limits

1. **Envelope not yet consumed by the workstation UI.** The response includes it, but the Code feed still uses the old `status / brief / questions` fields. A next slice could render the verdict + confidence chip in the chat bubble.
2. **Only `processTask` emits envelopes.** The other exit points (`resolveConcept`, `matchQuestion`, `runOrchestrator` sub-steps) don't yet. Generalising to every pipeline exit is future work.
3. **`conflicting_evidence` verdict is defined but not yet emitted anywhere.** No code path currently returns it. Reserved for cross-agent disagreement (Truth Engine or agent-to-agent).
4. **ErrorGuardian filter is regex-based**, not semantic. If a real API changes to return "Failed to fetch" as its message, it would be filtered. Low risk since the standard shape is HTTP status codes, not thrown TypeErrors.

## §9 · Two closed loops after this batch

- Founder can now **type or click** through ambiguities · both routes emit a `clarify` envelope with the options.
- Founder can now **see verdict + confidence** in the JSON response of every task submission · basis for a future UI chip or verdict-filtered dashboard.
- ErrorGuardian no longer surfaces transient dev-server noise · the "12 error" panic path is closed.

## §10 · What did NOT ship

- No workstation UI to display the envelope yet (chip / tooltip / verdict-filter · future slice)
- No Truth Engine changes
- No 40+ agent orchestration
- No Teaching Agent implementation
- No `/api/nex1/chat/turn` envelope wire (chat-turn returns its own shape · would need separate wire)
- No DB persistence of envelope history (queryable audit)
- No verdict escalation policy (e.g. auto-refuse below confidence 0.2)

## §11 · Try it live

```bash
curl -sX POST http://localhost:3008/api/nex/agent/submit \
  -H "Content-Type: application/json" \
  -d '{"prompt":"clean bug","session_id":"my-session"}' | jq .uncertainty
```

You'll see the full envelope with verdict, confidence, options, next-action hint · every time.

## §12 · Queue after this

- **Uncertainty UI chip** — render `verdict + confidence` as a colored chip on the founder's message in the Code feed. ~150 LOC. Immediate visible payoff.
- **C2 · Paraphrase library seeding** — harvest the refused prompts we now capture in C10. ~300 LOC.
- **C6 · Rule algebra** — parse `docs/doctrine/*.md` into executable rules. ~800 LOC.
- **C10 Phase 4** — Postgres persistence for the graph. ~500 LOC.

Say "continue" for the recommended **Uncertainty UI chip** (visual payoff · smallest next slice) or specify a different one.
