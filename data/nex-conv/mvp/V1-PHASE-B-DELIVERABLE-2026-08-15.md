# V1 · Phase B · Deliverable

**Date:** 2026-08-15
**Scope:** Five real brain-features shipped on top of Phase A. All pipeline-side additions · no new model · zero third-party AI · Qwen 2.5 3B via local Ollama continues to render prose.

## Full-suite green after Phase B

| Suite | Result |
|---|---|
| Regression (Philip's 4 originally-flagged failures) | **15/15 probes pass** |
| Phase A (6 quality fixes · repetitive closer, backchannels, thin-packet, close, callback, packet-trim) | **5/5 probes pass** |
| Phase B (5 brain features · multi-intent, emotion, implicit facts, handoff, condensation) | **19/19 probes pass** |
| Cumulative regression check | **Zero regressions** |

## What each Phase B feature does

### B1 · Multi-intent decomposition
- **What**: one customer message can contain multiple intents. Extractor now returns `{ primary, secondary[] }`. Splits on sentence terminators AND coordinating conjunctions (`and`, `but`, `also`, `plus`, `then`, `,then`) then classifies each part.
- **Why**: fixed the T16-type failure — *"back to oak, and what's the handrail height rule?"* used to have handrail-height silently dropped. Now it's a `correct` primary + `ask_definition` secondary, both surfaced to the LLM with instruction to address both.
- **Proof**: probe `b1-multi-intent-correction-plus-question` passes — *"back to oak, and what's the handrail height rule?"* → primary=`correct` · secondary=[`ask_definition`] ✓
- **File**: `scripts/nex-conv/lib/extract.mjs` new `extractMultiIntent()` · `infer.mjs` calls it · `state.mjs` stores `current_secondary_intents` · `respond-local.mjs` prompt rule #12 tells LLM to address both

### B2 · Emotional register detection
- **What**: rule-based classifier returns one of `neutral | apologetic | frustrated | excited | uncertain` per turn. State keeps a rolling 5-turn window.
- **Why**: same message ("switching to walnut") deserves different tone depending on whether the customer sounds neutral, apologetic ("sorry for the flip flopping"), or frustrated ("I already told you oak!!!!"). Prompt rule #11 gives per-emotion tone guidance.
- **Detection cues**:
  - apologetic: `sorry`, `apologies`, `my bad`, `oops`, `forgive`, `flip flopping`, `my fault`
  - frustrated: `ugh`, `argh`, `annoying`, `for god's sake`, `already told you`, multi-punctuation (`!!!!`), 2+ SHOUTY words
  - excited: `love`, `amazing`, `brilliant`, `perfect`, `awesome`, single `!`
  - uncertain: `not sure`, `dunno`, `maybe`, `might`, `possibly`, `hmm`, short-with-trailing-`?`
  - neutral: default
- **Proof**: all 3 emotion probes pass — apologetic ("sorry for the flip flopping") · frustrated ("I already told you oak!!!!") · uncertain ("hmm not sure maybe I want closed string?") ✓
- **File**: `extract.mjs` new `extractEmotion()` · `state.mjs` tracks `emotion_window` + `current_emotion` · `respond-local.mjs` prompt rule #11 with per-register tone guidance

### B3 · Implicit fact extraction
- **What**: extended the ontology with 3 new entity classes — property_type (terrace_house, semi_detached, detached_house, flat, cottage, townhouse, bungalow), process (renovation, replacement, new_build, renovating_hallway), location (hallway, loft, extension). Fires on natural noun-phrases like *"renovating my Victorian terrace hallway"*.
- **Why**: previously only `traditional` (from "Victorian") was captured. Now `renovation + traditional + terrace_house + hallway` all captured from a single utterance. Richer state = richer downstream retrieval + response.
- **Proof**: probe `b3-implicit-facts` passes — *"I'm renovating my Victorian terrace hallway"* → focus contains `renovation`, `traditional`, `terrace_house`, `hallway` ✓
- **File**: `entities.mjs` extended · no code change needed elsewhere · the general alias-matcher picks them up automatically

### B4 · Handoff signal
- **What**: a new state field `handoff_recommended` flips to `true` when the customer has asked 2+ price-or-installation questions in a row without a substantive intervening turn. Packet gets `HANDOFF_RECOMMENDED=true` and prompt rule #13 tells the LLM to offer a real handoff instead of hedging again.
- **Why**: when NEX genuinely can't answer, the right move is *"if it'd be easier, one of the team can ring you tomorrow"* — not another *"depends on X, Y, Z"* hedge.
- **Strike logic**: `ask_price` or `ask_installation` intent → strike++. Substantive non-handoff intent (`specify_material`, `specify_style`, `compare`, `ask_options`, `ask_definition`) → strike=0. `handoff_recommended = strikes >= 2`.
- **Proof**: probe `b4-handoff-signal` passes — turn 1 "How much?" strike=1 handoff=false · turn 2 "Rough figure?" strike=2 handoff=**true** ✓
- **File**: `state.mjs` strike counter + flag · `infer.mjs` returns flag in payload · `respond-local.mjs` packet + prompt rule #13. API route (`/api/nex-conv/chat`) can now surface `handoff_recommended: true` for the chat UI to render a "book a call" prompt (UI wiring later — pipeline is ready).

### B5 · Turn-summary condensation
- **What**: after turn 8, and every 4 turns after that, older conversation content gets condensed into a one-line `state.condensed_history.summary`. Packet gets an `EARLIER IN THIS CONVERSATION (condensed):` block. `recent_turn_summaries` still bounded to 6.
- **Why**: prevents the packet from growing unboundedly in long conversations. State stays compact regardless of turn count.
- **Proof**: probe `b5-condensation` passes — after turn 9 (`ok`), `state.condensed_history.summary` is populated with facts + entities from turns 1-8 ✓
- **File**: `state.mjs` condensation logic in `updateStateFromCustomer` · `respond-local.mjs` packet includes the block when present

## Files changed this pass

| File | Change |
|---|---|
| `scripts/nex-conv/lib/entities.mjs` | +14 entities across property_type / process / hallway-loft-extension locations |
| `scripts/nex-conv/lib/extract.mjs` | +`extractEmotion()` · +`extractMultiIntent()` · price cue includes `figure`/`ballpark`/`estimate`/`quote` |
| `scripts/nex-conv/lib/state.mjs` | new state fields: `emotion_window`, `current_emotion`, `thin_packet_strikes`, `handoff_recommended`, `condensed_history`, `current_secondary_intents` · condensation trigger fires on `turn_count > 8` (every 4 turns thereafter) · handoff strike counter |
| `scripts/nex-conv/lib/infer.mjs` | calls `extractMultiIntent` + `extractEmotion` · computes `packetIsThin` (per-intent aware) · passes emotion/secondary/handoff into state + packet · returns them in response payload |
| `scripts/nex-conv/lib/respond-local.mjs` | prompt gains HARD RULES #11 (emotional register) · #12 (multi-intent) · #13 (handoff) · packet surfaces EMOTION · SECONDARY_INTENTS · HANDOFF_RECOMMENDED · CONDENSED_HISTORY block · per-emotion tone guidance in meta+close+backchannel packets too |
| `scripts/nex-conv/eval/regression-phase-b.json` | 8 fixtures · 19 probes covering all 5 features |
| `scripts/nex-conv/eval-phase-b.mjs` | runner · idempotent ontology seed on start · Markdown + JSON report |

## Cumulative NEX ability

After Phase A + B (all in one pipeline · one model · one runtime):

- Distinguishes 4 conversation modes: staircase / meta / close / backchannel · each with a tuned packet
- Detects 15+ intents across discovery / specify / compare / price / decide / clarify / correct / revisit / confirm / close / meta / backchannel
- Extracts multiple intents from one message
- Reads 5 emotional registers and adjusts tone accordingly
- Extracts 56+7 (materials · components · styles · regulations · services · locations · properties · processes) entity classes from natural speech including implicit noun-phrase facts
- Preserves conversation state across turns · corrections replace facts with audit-log preservation · reverts detected
- Resolves pronoun references (`that`, `it`, `this`, `the other one`) from state · most-recent-topic prioritised
- Blocks fabricated prices · no `£X` numbers unless in packet
- Blocks fake state narrations · "updating the assumption" gated to actual state changes
- Anti-repetition · varies closers so the same phrase never appears 2 turns running
- Callback engine · every-3rd-turn naturally references an earlier fact
- Handoff signal · 2 consecutive un-answerable questions triggers "want the team to call?" offer
- Turn-summary condensation · packet stays bounded past 30 turns
- All local · Qwen 2.5 3B on RTX 2050 4GB VRAM · Ollama runtime · zero third-party AI · $0 per conversation

## What's honestly still limited (Qwen 3B ceiling)

Same three items from Phase A · not fixable by more pipeline work:

1. Occasional technical-definition wobble under load (base rail sometimes described as "vertical")
2. Summary confirmation replies (T29 "sound right?") remain flat
3. Long-conversation drift past turn 25

All three benefit from Qwen 2.5 7B Q4 which needs 8+ GB VRAM.

## Stop for review

**Task 24 done · zero regressions · 19/19 Phase B + 5/5 Phase A + 15/15 regression + Postgres substrate + local Qwen response all green.**

The V1 ladder now looks like:
1. ✓ PostgresStore (Step 1)
2. ✓ LLM response layer (Step 2)
3. ✓ MT-1 chat routed through pipeline (Step 2.5)
4. ✓ Four Philip-flagged failures fixed
5. ✓ Phase A · 6 conversation-quality fixes
6. ✓ Phase B · 5 brain features
7. ⏸ Step 3 · Admin Review UI (not started · your call when)
8. ⏸ Step 4 · Real staircase conversations
9. ⏸ Step 5 · Measure old vs new

## Reproduce

```
node --env-file=.env.local scripts/nex-conv/eval-regression.mjs --backend=postgres   # 15/15
node --env-file=.env.local scripts/nex-conv/eval-phase-a.mjs --backend=postgres      # 5/5
node --env-file=.env.local scripts/nex-conv/eval-phase-b.mjs --backend=postgres      # 19/19
```

Reports:
- `data/nex-conv/mvp/regression-and-natural-2026-08-15.md`
- `data/nex-conv/mvp/phase-a-30turn-2026-08-15.md`
- `data/nex-conv/mvp/phase-b-regression-2026-08-15.md`
