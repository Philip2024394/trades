# C7 Phase 2 · Click-to-Pick Ambiguity Buttons · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · third slice · adjacent to C7 phase 1.
**Authority:** Founder "continue" instruction after C7 phase 1 shipped RUNTIME_VERIFIED.
**Author:** master_ai_engineer (Claude Opus 4.7)

## §1 · Target
C7 phase 1 shipped letter-typing resolution. Now the founder can **click** the letter instead of typing it. Same wire · same trace · same result · faster UX.

## §2 · Wire
`Ambiguity handoff step` renders inside a `.naw-chat-msg--nex1` bubble. When `body.kind === "ambiguity_clarification"` and `body.options[]` exists, StepCard renders clickable option buttons under the reply. Click posts the letter to `/api/nex/agent/submit` with `continue_task_id` set → orchestrator's C7 hook resolves it exactly like a typed letter. **Zero orchestrator changes** — this is pure UI on top of the C7 phase 1 backend.

## §3 · Mutation (files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/app/nex1/workstation-live/agent/NexAgentWorkstation.tsx` | Modified | `ambiguityPicks` state · `handleAmbiguityPick()` handler · new StepCard props · button render branch. `~90 lines added.` |
| `src/app/nex1/workstation-live/agent/nex-agent-workstation.css` | Modified | `.naw-ambig-options` + `.naw-ambig-option` + `.naw-ambig-chosen-banner` etc. `~70 lines added.` |

**Zero backend changes.** No new endpoint. No orchestrator edit. No DB migration. No LLM.

## §4 · Verification

- **Page loads** · HTTP 200 on `/nex1/workstation-live`.
- **Turn 1** · submit `"add fix"` → task `04d57861-…` → ambiguity_clarification emitted with A/B/C options.
- **Turn 2** · POST `{ prompt: "B", continue_task_id: T1 }` (simulating the button click) → status = `plan_ready` → CONSENSUS reached at round 1.

The button-click path is functionally identical to typing "B" — I verified this by hand with the actual HTTP shape the client will send.

## §5 · What the founder now experiences

Before C7 phase 2:
```
NEX1 bubble:
  I'm close · which did you mean?
    (A) Fix a bug · Got it — a fix. …
    (B) Add a new feature · Right — I've picked this up as a new feature. …
    (C) Something else · Rephrase in one sentence and I'll try again.

  Reply with the letter (A/B/C…) or rephrase in your own words.

Founder: [types "B"]  ← required typing
```

After C7 phase 2:
```
NEX1 bubble:
  I'm close · which did you mean?
    (A) Fix a bug · Got it — a fix. …
    (B) Add a new feature · Right — I've picked this up as a new feature. …
    (C) Something else · Rephrase in one sentence and I'll try again.

  [A] [B] [C]  ← clickable · disabled after pick
  ✓ You picked B · NEX1 is planning now.  ← after click
```

## §6 · UX details

- Options render as a **column of buttons** inside the NEX1 chat bubble (not below it) — visually part of the reply.
- Each button shows: `[Letter] · [Display name] · [Preview snippet]` with the letter in cyan bold.
- Hover state: cyan tint + cyan border.
- Chosen state: cyan background + `✓` mark at end + banner below saying `"✓ You picked X · NEX1 is planning now."`
- Disabled state: all buttons dim once ANY is clicked (prevents double-pick).
- The founder can STILL type the letter — both paths use the same backend wire.

## §7 · Safety boundary

- **Zero LLM.** Buttons are pure DOM + fetch to the existing submit endpoint.
- **No new authorization surface.** Buttons submit through the same `/api/nex/agent/submit` the founder uses for all messages.
- **Sandbox preserved.** The letter payload is trivially bounded (1-2 chars). No injection surface.
- **Optimistic lock is reversible.** If the fetch fails, we clear the local pick and surface the error via the existing `setErr` toast path.
- **Trace unchanged.** Same `clarification_resolved` step emits from the orchestrator. Click and type produce byte-identical traces.
- **Pricing.ts SHA unchanged. Truth Engine untouched. Q7/Q8 untouched.**

## §8 · Regression

- Existing decision-buttons on non-ambiguity steps still work (`onDecide` and `submitDecision` untouched).
- Existing chat bubbles for non-ambiguity `handoff` steps render unchanged (no options → no button UI).
- Persona replies (`hello / thanks / how are you / etc.`) render as plain bubbles.
- Coding ACKs render as plain bubbles.
- Non-clarifying workstation flows completely untouched.

## §9 · Honest limitations

1. **Optimistic UI has no server ack.** If the fetch succeeds but the SSE stream is slow, there's a moment where the button says "chosen" before the plan appears. Not a bug — matches existing decision-buttons behaviour.
2. **Pick state is not persisted across page reloads.** If the founder refreshes mid-clarification, they must click again. Persisting `ambiguityPicks` per task_id would need a small localStorage extension (not in scope).
3. **Same ambiguity offered twice** in one session would render two independent button sets. Each tracks its own picked state via `step_id` key.
4. **Screen readers get letter + display + preview.** No specific ARIA yet. Accessible enough for a founder-only tool; would need aria-label + role="group" for public use.
5. **Mobile layout** untested — buttons should stack fine because `flex-direction: column`, but I didn't visually verify on a small viewport.

## §10 · Test it live

1. Hard-refresh `http://localhost:3008/nex1/workstation-live`
2. Ensure **Code** tile is active (it's the default)
3. Type `"add fix"` in the prompt input → send
4. Wait for the NEX1 chat bubble with A/B/C buttons
5. **Click B** → button locks · banner appears · plan streams in

## §11 · Queue after this

Original queue: **C7 phase 1 → C7 phase 2 (done) → C10 → C11**.

Next natural slice is **C10 · ConversationHead as knowledge graph** — cross-turn memory foundation. That's the biggest force-multiplier for making chat feel *coherent* across many messages. ~600 LOC · read-only extension of existing infra + a new query API. Verifiable via multi-turn probes.

Say "continue" and I'll build C10 next. No further code moves without your instruction.
