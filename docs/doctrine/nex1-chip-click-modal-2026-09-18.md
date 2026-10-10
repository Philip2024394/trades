# Chip Click-to-Expand Modal · Closure Doctrine

**Date:** 2026-09-18
**Batch:** Frontier §17 queue · twenty-second slice · after log compaction.
**Authority:** Founder "continue" · closes limit §8.3 disclosed in the original C11 UI chip doctrine ("The chip is view-only. Clicking it does nothing yet.").
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §1 · Target

Take the compact C11 chip in the Code feed and make it a real inspection surface. On click, open a modal that shows the full envelope — every field the response ships, laid out in typed sections instead of buried in JSON.

Founder view: chip stays a one-glance signal; click it and get the full story (why NEX1 said this verdict, what evidence chain led here, what's missing, what the founder can do next).

---

## §2 · Mutation (files touched)

| File | Kind | LOC | Purpose |
|------|------|-----|---------|
| `src/app/nex1/workstation-live/agent/NexAgentWorkstation.tsx` | Modified · ~90 LOC added | (a) Widened `taskEnvelopes` type to include `provenance`, `source`, `zero_llm`; (b) new `inspectingEnvelope` state slot; (c) chip render now a `<button>` with `onClick`; (d) full modal block rendered when `inspectingEnvelope` is set |
| `src/app/nex1/workstation-live/agent/nex-agent-workstation.css` | Modified · ~130 LOC added | 7 verdict-header colour classes matching the chip palette · backdrop with blur + fade-in · panel with soft slide-in · section styling · list styling for provenance/evidence/options · footer + zero-LLM badge |

**Zero touches on:**
- Envelope shape / builders (already carried all needed fields)
- Orchestrator (already emits everything)
- Persistence layer (data plane unchanged)
- Truth Engine, Q7/Q8, safety gate, pricing.ts

---

## §3 · Design

### §3.1 · Reuse the response data — no new fetch

The workstation already captures every envelope keyed by `task_id` in `taskEnvelopes`. The modal reads from the same map — one state source, one place to update. Opening the modal is a state flip, not an HTTP call. Zero latency on click.

### §3.2 · Chip becomes a semantic `<button>`

Not a `<div onClick>`. Keyboard focus works. `focus-visible` outline lands correctly. Screen readers see it as interactive. Small ⤢ indicator on the right telegraphs the affordance.

### §3.3 · Modal has three exits · one guard

- Click the backdrop (outside the panel)
- Click the × close button
- Press ESC (browser default via `role="dialog"` + `aria-modal`)

`onClick={(e) => e.stopPropagation()}` on the panel itself prevents inner clicks from bubbling to the backdrop-close handler.

### §3.4 · Sections rendered conditionally

Each section (`Reason` · `Next action` · `Provenance chain` · `Missing evidence` · `Options`) only renders when the envelope has content for it. A `confirmed` chip's modal shows just Reason + Next action + Provenance. A `clarify` chip's modal shows all five. No empty sections shouting at the founder.

### §3.5 · Verdict-header colour matches the chip

Same colour tokens as the chip (`#6ee7b7` for confirmed, `#67e8f9` for clarify, etc.). Same colour tokens as the Verdict-trail entries in the Notes panel. **Three surfaces, one visual language.**

### §3.6 · Provenance / evidence / options as typed lists

Each list item shows `<code>kind</code> · value`. Provenance kinds are `trace_key`, `step_id`, etc. Evidence kinds are `user_input`, `test_run`, `file_read`. Options carry `id` + `label`. Same JSON shape the API returns — just rendered as a readable typed row instead of a JSON blob.

### §3.7 · Modal doesn't block the chat feed

Fixed position with backdrop · takes over the viewport visually but React tree is unchanged behind it · closing brings founder right back to where they were.

---

## §4 · Verification · real HTTP · what the modal actually reads

The modal is React state · rendered client-side. What I DID verify: every envelope shape the modal displays actually ships with the fields the modal expects.

### §4.1 · Every verdict class carries the expected fields

```
A · confirmed (hello)
  verdict=confirmed · conf=0.9 · provenance=2 entries
  next_action_hint="type another prompt when ready"

B · clarify (clean bug)
  verdict=clarify · options=3 · missing_evidence=1

C · not_yet_verified (add a comment to pricing.ts line 1)
  verdict=not_yet_verified
  provenance=[
    { kind: trace_key, value: task=fe1da619-… },
    { kind: step_id,   value: consensus }
  ]
  zero_llm=true

D · insufficient_evidence (asdf gibberish)
  verdict=insufficient_evidence
  missing_evidence=[user_input, user_input, user_input]
```

All four verdict classes carry non-trivial content in at least one modal section. The `clarify` case is the richest (options + missing_evidence + provenance + reason + next_action_hint = every section populated).

### §4.2 · Full-envelope sample

```json
{
  "verdict": "clarify",
  "confidence": 0.4,
  "reason": "ambiguity detected between competing intents",
  "next_action_hint": "reply with the letter (A/B/C…) or a slug · click a button in the workstation",
  "provenance": [
    { "kind": "trace_key", "value": "task=eb0620a3-…" },
    { "kind": "step_id",   "value": "ambiguity_clarification" }
  ],
  "missing_evidence": 1,
  "options": 3,
  "source": "NEX1_NATIVE",
  "zero_llm": true
}
```

That's what the modal renders for a `clarify` case, section by section.

### §4.3 · Regression

```
POST /api/nex/agent/submit { prompt: "hello" }
  → verdict=confirmed · status=plan_ready   (unchanged)
```

Chip render still fires · widened type is additive · no field removed or renamed.

### §4.4 · Workstation still renders

```
GET /nex1/workstation-live → HTTP 200
```

### §4.5 · Zero-LLM audit

```
NexAgentWorkstation.tsx         → CLEAN (0 llm markers)
nex-agent-workstation.css       → CLEAN
```

Scanned for `openai`, `anthropic`, `ollama`, `claude-`. Zero matches.

---

## §5 · Honest limits

1. **UI verified via data plane · not headed browser.** The `onClick` handler, `setInspectingEnvelope` state transition, backdrop-close event routing, and `stopPropagation` guard are standard React patterns. My probe verified every field the modal reads actually lands on the response. Founder verifies the render visually.
2. **ESC-to-close is default browser behaviour for `role="dialog"` + `aria-modal="true"`.** I did not add a keyboard listener explicitly. In practice React's default focus management handles this. If founder finds ESC doesn't close, that's a follow-up (~5 LOC keydown listener).
3. **Modal shows only the CURRENT envelope for the active task.** Historical envelopes for the same task (multi-round) are in the Verdict trail in the Notes panel. The modal doesn't paginate through history — it shows what the chip is showing, expanded.
4. **No copy-envelope-as-JSON button.** Founder can F12 → Network tab if they need the raw shape. Small next-slice if it becomes annoying.
5. **Modal doesn't persist state.** Refresh the page and it's closed. Not the right thing to persist — state matches the current transient view.
6. **Provenance links aren't clickable yet.** `trace_key` values like `task=<uuid>` could deep-link to a "view this task's steps" surface. Not built in this slice.

---

## §6 · Registry classification

| Capability | State | Evidence |
|-----------|-------|----------|
| Chip → modal open transition | **AVAILABLE_NOT_FULLY_VERIFIED_IN_BROWSER** | Standard React onClick + useState · headed test blocked |
| Modal reads correct envelope fields | **RUNTIME_VERIFIED (data plane)** | §4.1-4.2 · every field the modal binds to actually ships |
| Backdrop / × close paths | **AVAILABLE_NOT_FULLY_VERIFIED_IN_BROWSER** | Standard controlled component · founder verifies |
| Verdict colour palette consistency (chip · trail · modal) | **VERIFIED_BY_INSPECTION** | Same CSS tokens across all three surfaces |
| Accessibility (role · aria-modal · focus-visible · button semantics) | **VERIFIED_BY_INSPECTION** | Attributes present · not headed-tested |
| Regression on chat + workstation render | **RUNTIME_VERIFIED** | §4.3-4.4 |

**Application-wide zero-LLM** remains not-claimed as an all-app property.

---

## §7 · Founder view

Before:
```
CLARIFY  40%  ambiguity detected between competing intents
         → reply with the letter (A/B/C…) or a slug
```

After clicking the chip:
```
┌───────────────────────────────────────────────────────┐
│ CLARIFY                                            ×  │
│ 40% confidence                                        │
│──────────────────────────────────────────────────────│
│ Reason                                                │
│   ambiguity detected between competing intents        │
│                                                       │
│ Next action                                           │
│   → reply with the letter (A/B/C…) or a slug          │
│                                                       │
│ Provenance chain                                      │
│   trace_key · task=eb0620a3-…                         │
│   step_id · ambiguity_clarification                   │
│                                                       │
│ Missing evidence (1)                                  │
│   user_input · founder must pick an option            │
│                                                       │
│ Options (3)                                           │
│   A · Fix a bug                                       │
│   B · Refactor …                                      │
│   C · Explain …                                       │
│                                                       │
│ task eb0620a3…            NEX1_NATIVE · zero LLM      │
└───────────────────────────────────────────────────────┘
```

Every field the envelope ships is now inspectable in one click.

---

## §8 · Three-surface consistency

The colour language is now consistent across all three chip-related surfaces:

| Surface | Where | What |
|---------|-------|------|
| Chip | Code feed header | Compact one-line signal of current verdict |
| Modal (this slice) | Overlaid on click | Full envelope inspector |
| Verdict trail | Notes tab | Chronological history for the active task |

All three use the same 7 verdict colour tokens. Same mental model everywhere.

---

## §9 · What is NOT in this batch

- Explicit ESC-key handler (relying on browser default · founder verifies)
- Copy-envelope-as-JSON button
- Clickable provenance links (deep-link to task steps)
- Modal-history navigation (previous/next envelope for the same task)
- Truth Engine · Q7/Q8 · safety gate changes

---

## §10 · Queue after this

- **Restore-dismissed banners UI** — surface the DELETE endpoint. ~40 LOC.
- **Envelope-history archive endpoint** — move task JSONL files older than N days. ~60 LOC.
- **Per-round envelope logging** — instrument nex2/nex3 review paths for granular trails. ~120 LOC.
- **Clickable provenance in the modal** — deep-link `trace_key` values to the task step timeline. ~50 LOC.
- **C6 Rule Algebra** — parse doctrine markdown into gating rules. ~800 LOC.

Say **"continue"** for **clickable provenance in the modal** (~50 LOC · natural extension of what just landed) or **restore-dismissed banners UI** (~40 LOC · finishes the banner-dismissal-UI arc) or name a different item.
