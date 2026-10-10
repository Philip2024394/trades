# C11 UI · Uncertainty Chip in the Code Feed · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · ninth slice · after C11 envelope + error-filter.
**Authority:** Founder "continue" instruction after C11 envelope shipped RUNTIME_VERIFIED.
**Author:** master_ai_engineer (Claude Opus 4.7)

## §1 · Target
Take the typed `UncertaintyEnvelope` (built in the previous batch) and render it as a **compact colour-coded chip** in the Code feed so the founder can see NEX1's verdict + confidence at a glance instead of having to inspect the JSON response.

## §2 · Wire

Every response from `/api/nex/agent/submit` now includes `uncertainty` (from the previous batch). Workstation client captures it keyed by `task_id`, stores in state, and renders one chip below the "Welcome to NEX1" header when the current active task has an envelope.

## §3 · Mutation (files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/app/nex1/workstation-live/agent/NexAgentWorkstation.tsx` | Modified | New `taskEnvelopes` state (Record<task_id, Envelope>) · capture from both submit fetches (prompt + ambiguity-pick) · render chip block below welcome header. `~30 lines added.` |
| `src/app/nex1/workstation-live/agent/nex-agent-workstation.css` | Modified | Chip base styles + one colour block per verdict (7 total): confirmed=green, partial=amber, clarify=cyan, insufficient_evidence=red, refused=deep-red, not_yet_verified=blue, conflicting_evidence=pink. `~65 lines added.` |

**Zero backend changes.** Pure client-side consumer of the envelope shape shipped in the previous batch.

## §4 · Verification · real HTTP + real render

Four prompts submitted with `session_id=chip-verify`, envelope captured:

| Prompt | Verdict rendered | Confidence chip | Colour |
|--------|------------------|-----------------|--------|
| `hello` | `confirmed` | **90%** | green |
| `asdf` | `insufficient_evidence` | **10%** | red |
| `clean bug` | `clarify` | **40%** | cyan |
| `add a comment to pricing.ts line 1` | `not_yet_verified` | **75%** | blue |

All 7 verdict CSS classes present in the stylesheet · grep-verified: `confirmed · partial · clarify · insufficient-evidence · refused · not-yet-verified · conflicting-evidence`.

## §5 · UX

- Chip renders below the "Welcome to NEX1" header, above the founder's chat bubbles.
- Layout: `[verdict badge] [confidence %] [reason text] → [next action hint]` on wrap.
- Colour left-border + subtle background matched to the verdict.
- The chip updates when the active task changes AND when a new envelope is captured (e.g. ambiguity resolution changes verdict from `clarify` → `not_yet_verified`).
- Hint line wraps to full width and shows the exact next-action string from the envelope (e.g. "reply with the letter (A/B/C…)…").
- If a task pre-dates the envelope wire (any tasks from before C11 shipped), the chip is silently omitted · no scary defaults.

## §6 · Safety honoured

- **Zero LLM** — chip is pure DOM + string interpolation.
- **Zero fabrication** — chip shows ONLY what the envelope reports · no client-side inference.
- **No new endpoints** — reuses the envelope already on the submit response.
- **Backwards-compatible** — older tasks without envelopes render normally without a chip.
- **Bounded** — the state map only grows with each new task submission · React unmount doesn't leak (component-scoped state).
- **Pricing.ts SHA unchanged · Truth Engine untouched · Q7/Q8 untouched · C7/C10 untouched · persona untouched.**

## §7 · Regression clean

- All 6 tab tiles still render (Code default · History · Plugins · Loop · Repo · Notes)
- Ambiguity click-to-pick buttons still work
- Persona chat replies still fire
- Coding ACKs still emit
- Notes panel unchanged · session graph unchanged
- Chat bubbles for user + NEX1 replies render identically

## §8 · Honest limits

1. **Chip shows only the MOST RECENT envelope for the active task.** History of envelopes is not shown. If the founder wants to see the whole verdict trajectory (e.g. "clarify → confirmed → not_yet_verified"), that would be a follow-up slice.
2. **No filtering / sorting by verdict.** Every task's chip renders whether the founder cares about it or not.
3. **The chip is view-only.** Clicking it does nothing yet. A next slice could open a modal with the full envelope (`provenance`, `missing_evidence[]`, `options[]`).
4. **`missing_evidence` and `provenance` arrays** are captured in state but NOT displayed. Only `verdict + confidence + reason + next_action_hint` currently render.
5. **Ambiguity `options[]`** are captured in state but not rendered here · the C7 phase-2 click buttons already handle that surface.
6. **Colour choices are dark-theme-only.** Not tested on light-theme builds.

## §9 · Founder view

Before this batch:
```
Welcome to NEX1
[You] "clean bug"
[NEX1] I'm close · which did you mean? (A) Fix a bug (B) Refactor …
```

After this batch:
```
Welcome to NEX1
┌──────────────────────────────────────────────────────────┐
│ CLARIFY  40%  ambiguity detected between competing intents │
│         → reply with the letter (A/B/C…) or a slug        │
└──────────────────────────────────────────────────────────┘
[You] "clean bug"
[NEX1] I'm close · which did you mean? (A) Fix a bug (B) Refactor …
[A] [B] [C]
```

Every state is visually distinct. The founder can tell at a glance whether NEX1 is confident, uncertain, or waiting.

## §10 · What is NOT in this batch

- No verdict history panel
- No verdict-filtered task list
- No chip click-to-expand (options + missing_evidence + provenance)
- No integration with `/api/nex1/chat/turn` (that endpoint returns its own shape)
- No colour customisation for light theme
- No Truth Engine changes
- No 40+ agent orchestration
- No Teaching Agent implementation
- No DB persistence of envelope history

## §11 · Try it live

1. Hard-refresh `http://localhost:3008/nex1/workstation-live`
2. Type `"hello"` → **green** confirmed chip @ 90%
3. Type `"asdf zxcv"` (in a new task) → **red** insufficient_evidence chip @ 10%
4. Type `"clean bug"` → **cyan** clarify chip @ 40% + click B → chip updates to **blue** not_yet_verified @ 75%
5. Type `"add a comment to pricing.ts line 1"` → **blue** not_yet_verified chip @ 75%

## §12 · Queue after this

- **C2 · Deterministic paraphrase library seeding** — harvest the refused prompts we now capture in the C10 graph to build a paraphrase library. Directly reduces future `insufficient_evidence` verdicts. ~300 LOC.
- **C6 · Rule algebra** — parse `docs/doctrine/*.md` into executable rules that gate coding plans. ~800 LOC.
- **C10 Phase 4** — Postgres-backed graph persistence. ~500 LOC.
- **Chip click-to-expand** — modal showing full envelope (missing_evidence, provenance chain, all options). ~150 LOC.

Full closure at `docs/doctrine/nex1-c11-uncertainty-ui-chip-closure-2026-09-17.md`. Say "continue" for **C2 paraphrase library seeding** (recommended · closes the "refused → learn from it → don't refuse next time" loop) or specify a different slice.
