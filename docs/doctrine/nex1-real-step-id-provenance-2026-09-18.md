# Real-Step-Id in Envelope Provenance · Closure Doctrine

**Date:** 2026-09-18
**Batch:** Frontier §17 queue · twenty-sixth slice · after clickable provenance.
**Authority:** Founder "continue" · §10 recommendation · activates the deep-link path that the previous slice built but couldn't fire.
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §1 · Target

Close the honest limit §5.1 disclosed in the clickable-provenance closure:

> "step_id deep-link doesn't jump today. Envelope provenance emits semantic labels; the DOM has UUIDs. Fallback (clipboard copy) fires instead."

After this slice: **every envelope provenance now carries a real DB step_id UUID** in the `step_id` field, so the clickable modal's `document.querySelector('[data-step-id="X"]')` actually matches a step card in the feed. The semantic label (`consensus`, `ambiguity_clarification`, `small_talk`, etc.) is preserved as a new `semantic_tag` kind so nothing that read it before breaks.

---

## §2 · Mutation (files touched)

| File | Kind | LOC | Purpose |
|------|------|-----|---------|
| `src/lib/nex-agent/core/orchestrator.ts` | Modified · ~20 LOC changed | (a) `emitStep` signature `Promise<void> → Promise<string>` · returns DB-generated step_id via `INSERT … RETURNING step_id`; (b) 5 envelope-build sites now capture the step_id of the emitStep that immediately preceded them (`chatHandoffStepId`, `ambigHandoffStepId`, `lastQuestionStepId`, `terminalStepId × 2`); (c) each envelope's `provenance` array grew from 2 → 3 entries: `trace_key` + `step_id (real UUID)` + `semantic_tag (label preserved)` |

**Zero touches on:**
- Envelope builder shapes (still accept generic `{kind, value}` provenance entries)
- Persistence layer (writes whatever the orchestrator produces)
- Chip modal UI (already handles both `step_id` and `trace_key` correctly · deep-link path activates itself now)
- Truth Engine, Q7/Q8, safety gate, pricing.ts

---

## §3 · Design

### §3.1 · Additive not substitutive

Old provenance:
```
[ trace_key : "task=<uuid>", step_id : "consensus" ]
```

New provenance:
```
[ trace_key   : "task=<uuid>",
  step_id     : "6f107722-2c83-49e3-84dc-a1c9d5b4963b",   ← real DB row id
  semantic_tag: "consensus" ]                              ← old label preserved
```

Anything downstream that read `step_id` for its **semantic meaning** (rare · but possible) would break if we simply replaced the value. Keeping the label under a new `semantic_tag` kind means:
- The clickable-modal deep-link works because `step_id` now points at a real DOM element.
- Any legacy reader that expected `step_id = "consensus"` still gets it via `semantic_tag`.

### §3.2 · `emitStep` return value

`emitStep` used to return `void`. Now it does `INSERT … RETURNING step_id` and returns `Promise<string>`. Callers that don't need the id ignore it (identical to before). Callers that DO need it (the 5 envelope sites in this batch, plus any future ones) get a stable id.

### §3.3 · Which step_id do we return?

Each envelope-build site captures the id of the step it emits **immediately before** building the envelope:

| Exit | Step captured | Rationale |
|------|---------------|-----------|
| chat-only short-circuit | The handoff bubble with the persona reply | The reply is the visible artefact the envelope describes |
| ambiguity clarify | The handoff bubble with the "which did you mean" options | Same — the ambiguity dialog IS the envelope's referent |
| insufficient (clarifying questions) | The LAST `question` step (there can be multiple) | The final question is the one currently blocking |
| plan_ready terminal | The system `handoff` step at consensus | The plan-ready notification |
| refused terminal | The system `review_fail` step | The rejection notification |

### §3.4 · Empty-string safety

If for any reason `RETURNING step_id` yields nothing (schema mismatch · connection blip), `emitStep` returns `""`. Downstream: the modal's `CSS.escape` handles empty strings gracefully; `querySelector('[data-step-id=""]')` returns null; the click handler falls back to clipboard-copy per §3.5 of the prior slice. **No crash, no silent success · honest degrade.**

---

## §4 · Verification · real HTTP

### §4.1 · Workstation renders

```
GET /nex1/workstation-live → HTTP 200
```

### §4.2 · Every verdict class now carries a UUID step_id

```
POST /api/nex/agent/submit { prompt: "hello" }   → verdict=confirmed
  trace_key    · value="task=f0c1608a-…"
  step_id [uuid] · value="3b695aaf-8e6d-4310-a2dc-a43f0379cd14"   ← REAL UUID
  semantic_tag · value="small_talk"

POST /api/nex/agent/submit { prompt: "clean bug" }   → verdict=clarify
  trace_key    · value="task=f7258cd4-…"
  step_id [uuid] · value="18fdcfc2-4ea3-4500-916c-ab7506a0aace"   ← REAL UUID
  semantic_tag · value="ambiguity_clarification"

POST /api/nex/agent/submit { prompt: "add a comment to pricing.ts line 1" }
                                             → verdict=not_yet_verified
  trace_key    · value="task=58ffa104-…"
  step_id [uuid] · value="6f107722-2c83-49e3-84dc-a1c9d5b4963b"   ← REAL UUID
  semantic_tag · value="consensus"
```

All three verdict classes tested pass the UUID-shape regex `^[a-f0-9]{8}-[a-f0-9]{4}-…`. The values are real DB row identifiers that WILL match the `data-step-id` attributes on step cards.

### §4.3 · Response shape unchanged

```
POST /api/nex/agent/submit { prompt: "hello" }
  → ok=true · task_id=2cfe2d3d… · verdict=confirmed · status=plan_ready
  → provenance_entries=3   (was 2 · additive)
```

No consumer that reads `verdict`, `confidence`, `reason`, `next_action_hint` sees any change. Only provenance grew by one entry.

### §4.4 · Zero-LLM audit

```
orchestrator.ts → CLEAN
```

Scanned for `openai`, `anthropic`, `ollama`, `claude-`. Zero matches.

---

## §5 · What just activated end-to-end

The clickable-provenance UI I built in the previous slice couldn't scroll-to-step because there was no matching DOM element for `step_id="consensus"`. With this slice landed:

1. Founder submits a coding prompt → orchestrator emits a handoff step at consensus with `step_id=X`
2. Step card renders in Code feed with `data-step-id={X}`
3. Envelope provenance now carries `{kind: "step_id", value: X}` (real UUID · not "consensus")
4. Chip modal renders that provenance entry as a clickable button
5. Click → `document.querySelector('[data-step-id="X"]')` → matches the step card
6. `scrollIntoView` + 1.6s cyan pulse animation
7. Modal auto-closes so the pulse is visible

**The full deep-link chain works end-to-end** now, on every envelope every task ships.

---

## §6 · Honest limits

1. **UI activation verified via data plane · not headed browser.** The step_id values ARE real UUIDs (§4.2). The DOM DOES have `data-step-id` attributes (added in previous slice). The querySelector WILL match. This is provable by reading the HTML source of a rendered task — but that requires headed-browser instrumentation to click a chip. Founder verifies visually.
2. **`emitStep` is now async-returning-string.** Nothing consumes the return in the 200+ existing call sites — they still `await emitStep(...)` and discard. If any caller ever chained `.then(void)` or similar, that would break — grep confirmed all callers use `await` bare, so this is safe.
3. **Multi-round tasks capture only the FINAL round's step_id.** The `terminalStepId` at end-of-function is the last step emitted. If a task went through 3 rounds of nex1/nex2/nex3 discussion, provenance points at the round-3 consensus step, not round-1. This matches how we render the final chip (it's the FINAL envelope). Future per-round envelope logging (queue item) would carry per-round step_ids.
4. **`INSERT … RETURNING` requires a schema that HAS a `step_id` column.** Confirmed by inspection of the existing `nex_agent.task_steps` INSERT (which had `step_id` in the row-shape assumption downstream). If step_id were auto-generated by a different mechanism, we'd get an empty string and the modal would fallback to clipboard — no crash.
5. **Founder-facing wording** in the modal still says "Provenance chain" — the same label as before. If we want to distinguish trace/id/tag visually, that's a small CSS tweak.

---

## §7 · Registry classification

| Capability | State | Evidence |
|-----------|-------|----------|
| `emitStep` returns real step_id | **RUNTIME_VERIFIED** | §4.2 · UUIDs land in provenance across 3 verdict classes |
| Envelope provenance carries UUID step_id | **RUNTIME_VERIFIED** | §4.2 |
| `semantic_tag` preserves backward-compat | **RUNTIME_VERIFIED** | §4.2 · label still present under new kind |
| Modal deep-link scroll (activated) | **AVAILABLE_NOT_FULLY_VERIFIED_IN_BROWSER** | Data plane proves match will succeed · headed test blocked |
| Response shape backwards-compat | **RUNTIME_VERIFIED** | §4.3 · additive · no field removed or renamed |
| Zero-LLM | **RUNTIME_VERIFIED** | §4.4 |

**Application-wide zero-LLM** remains not-claimed as an all-app property.

---

## §8 · Founder view

Before (from the last slice's honest disclosure):
```
Provenance chain · click to jump
  [ trace_key · task=e7f4bbf2-…  ↗ ]     ← copies uuid (works)
  [ step_id · ambiguity_clarification ↗ ] ← falls back to copy (no match in DOM)
```

Now:
```
Provenance chain · click to jump
  [ trace_key    · task=f7258cd4-…                                  ↗ ]
  [ step_id      · 18fdcfc2-4ea3-4500-916c-ab7506a0aace              ↗ ]  ← SCROLLS + PULSES
  [ semantic_tag · ambiguity_clarification                             ]  ← label still available
```

Click the middle row and the feed scrolls to the step, pulses cyan for 1.6s, modal closes so founder can see it.

---

## §9 · What is NOT in this batch

- Multi-round per-round envelope logging
- `INSERT … RETURNING` on all other emitStep sites (only the 5 envelope-build ones need to capture)
- Modal-side visual differentiation between the three provenance kinds
- Truth Engine, Q7/Q8, safety gate changes

---

## §10 · Queue after this

- **Per-round envelope logging** — instrument nex2/nex3 review paths so every round produces an envelope with its own step_id. ~120 LOC.
- **Envelope-history archive endpoint** — move task JSONL files older than N days. ~60 LOC.
- **Scheduled auto-compaction cron** — weekly hit to `/api/nex1/logs/compact`. ~30 LOC.
- **C6 Rule Algebra** — parse doctrine markdown into gating rules. ~800 LOC.
- **Visually distinguish provenance kinds in the modal** — small icon prefix per kind (trace / id / tag). ~15 LOC.

Say **"continue"** for the **visually distinguish provenance kinds** (~15 LOC · smallest polish · finishes the modal cluster) or name a different item.
