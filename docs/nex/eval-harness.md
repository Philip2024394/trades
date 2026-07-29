# NEX Chat Evaluation Harness

> Patch B (2026-07-29). Turns "the reply feels better" into "we can demonstrate a 6.2pp improvement on gate 4." Runs the curated 40-question set against a live `/api/nex/staircase-chat`, scores each reply against the 7 language-quality gates from `docs/nex/golden-replies.md`, writes markdown + JSON reports, and can compare two runs to show a delta.

---

## What it produces

Every run writes a timestamped directory under `data/nex/eval/reports/<YYYY-MM-DD_HHMMSS>/`:

| File | Purpose |
|---|---|
| `summary.md` | Human-readable per-gate pass rate, overall rate, retrieval diagnostics |
| `summary.json` | Machine-readable — the same numbers, used as a baseline for the next run |
| `per-question.json` | Full record for every question — reply · stage · retrieved IDs · gate results |
| `failures.md` | Only failed questions, grouped, with the failing gate + reason + retrieved IDs |
| `delta.md` (when `--baseline` given) | Per-gate delta table + overall pp change |

---

## Modes

### Smoke test — free, no API keys except server access

```bash
npm run nex:eval -- --api http://localhost:3008 --limit 5
```

Runs 5 questions, evaluates the 4 rule-based gates (2/3/4/5). Fast, deterministic, no LLM-judge cost. Perfect for checking the pipeline is alive after a prompt or retriever change.

### Full run — all 7 gates (requires `ANTHROPIC_API_KEY`)

```bash
NEX_BRAIN_RUNTIME_ENABLED=1 \
OPENAI_API_KEY=sk-...       \
ANTHROPIC_API_KEY=sk-ant-...\
npm run nex:eval -- --api http://localhost:3008 --judge
```

- **Composer** — uses `ANTHROPIC_API_KEY` for Claude Opus 4.7 (~40 questions × ~$0.05 = ~$2)
- **Retriever** — uses `OPENAI_API_KEY` for `text-embedding-3-small` (~40 embeddings × negligible)
- **Judge** — uses `ANTHROPIC_API_KEY` for Claude Haiku 4.5 (~40 × ~$0.001 = ~$0.05)
- Total estimated cost: ~$2 per run

### Before/after — required for any prompt or retriever change

```bash
# 1. Baseline
npm run nex:eval -- --api http://localhost:3008 --judge
# → data/nex/eval/reports/2026-07-29_123456/summary.json

# 2. Make the change (edit prompt, threshold, library entry, etc.)

# 3. Re-run against the baseline
npm run nex:eval -- --api http://localhost:3008 --judge \
    --baseline data/nex/eval/reports/2026-07-29_123456/summary.json
# → new report + delta.md
```

If any gate regresses, treat the change as broken until the delta is understood.

### Dry run — parser validation only

```bash
npm run nex:eval -- --dry-run
```

Loads the question set, prints the count, exits. Useful for CI or after editing `questions.json`.

---

## The 7 gates

| Gate | Type | What it checks |
|---|---|---|
| 1. Person speaking | LLM-judge | Sounds like a UK staircase specialist face-to-face, not a search result or product page |
| 2. Complete sentences | Rule-based | No fragment-labels like *"Premium tier. Made to order."* |
| 3. No catalogue language | Rule-based | No *"Available Options"* · *"Features:"* · *"Specifications"* · *"Best seller"* |
| 4. No AI-opener phrases | Rule-based | First sentence doesn't start with *"Certainly!"* · *"Absolutely!"* · *"Let's dive in"* · *"Great question."* · *"Happy to help."* · *"Here is a quick overview"* · *"As an AI"* · *"I'd be happy to assist"* · *"Thank you for your question"* · *"In summary,"* |
| 5. GOV.UK plain English | Rule-based | UK spelling · no `e.g./i.e./etc.` · no sentence > 30 words |
| 6. Useful next step | LLM-judge | Ends with one clear thing the user knows to do next OR is a natural close |
| 7. Constitution compliance | LLM-judge | No invented prices · no pretended personal experience · no competitor disparagement · not defensive |

**Rule-based first, judge second.** The 4 rule-based gates run every time — they're deterministic and free. The 3 LLM-judged gates require `--judge` because they cost money and add latency.

---

## Target

**95% overall pass rate** before shipping a language-quality release.

Below 95% → the failing gates tell you exactly what to fix. Above 95% and one gate underperforms → the failure list identifies specific `golden-replies.md` entries to refine or missing entries to add (per ADR-0041 — only when a genuine recurring gap exists).

---

## Retrieval diagnostics (falls out of the same run)

Every `summary.md` reports:

- **Turns with retrieval** — how many questions were served with few-shots vs base voice
- **Turns gated by threshold** — how many hit `MIN_COSINE_THRESHOLD = 0.40` and got no injection
- **Unique golden IDs used** — how much of the library the retriever actually surfaces
- **Most-used IDs** — top 8, so you can see if the ranker is stuck on the same 3
- **Not seen in this run** — entries the eval never surfaced. Two possibilities: (a) library gap the question set doesn't hit, (b) the entry is redundant with a stronger one and can be retired.

This is the "retrieval diagnostics" from the original Patch B plan — no separate build needed.

---

## Missing-entry detector (falls out of `summary.md`)

Any turn with `retrieval_gated: true` in `per-question.json` is a candidate missing entry. **Do not auto-add them.** Per ADR-0041, a new golden entry only goes into `golden-replies.md` when a human editor confirms it fills a genuine recurring gap — not a one-off eval turn.

Practical workflow:
1. Run eval before a prompt/library change.
2. Filter `per-question.json` for `retrieval_gated === true`.
3. Group similar gated turns. If a pattern appears in ≥3 turns and isn't served well by any existing entry, propose a new library entry in a `golden-replies-candidates.md` scratchpad.
4. Human editor reviews, approves, moves into `golden-replies.md`, re-runs `npm run nex:embed-golden`, and re-runs the eval to confirm the gap closed.

---

## Adding questions

Edit `data/nex/eval/questions.json`. Each entry:

```json
{
  "id": "Q41",
  "user_message": "…",
  "expected_intent": "materials",
  "tags": ["price", "objection"]
}
```

**Rules:**

- IDs must be unique (`Q41` continues from the current top).
- `expected_intent` must be one of the `ChatIntent` values from `classifyIntent.ts`.
- `tags` are for grouping in reports — free-form but keep them consistent.
- **Only add questions that cover a real conversational pattern.** Duplicates dilute the pass rate signal.

After editing, `npm run nex:eval -- --dry-run` to confirm it parses.

---

## Exit code

Always `0`. This is an eval, not a build gate. The pass rate in the report is the signal — plug it into CI later if we want a threshold guard on releases.

---

## What's NOT in Patch B

Deferred until real signal proves the need:

- Retrieval diagnostics UI (the JSON report IS the diagnostic; a UI is nice-to-have)
- Automatic candidate-entry proposal (human curation is the constraint, not tooling)
- `had_greeting` telemetry hook (small; can piggyback on the next composer edit)
- Additional telemetry fields (only add when a query needs them)
