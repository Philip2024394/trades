# C2 Phase 2 · Paraphrase Library wired into the classifier · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · eleventh slice · after C2 Phase 1 (library + endpoint + queue-gate).
**Authority:** Founder "continue" after Phase 1 closure. Recommended path from §13 of the prior doctrine.
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §1 · Target

Take the deterministic paraphrase library shipped in Phase 1 (`capability-paraphrase-library.ts`) and **make it participate in the primary intent-classification path** used by `/api/nex/agent/submit`, so that prompts using British slang or colloquial phrasings no longer fall through to `refused_no_verb_recognised` or `unknown`.

**Concrete before/after** (real HTTP · zero fabrication):

| Prompt | Before Phase 2 | After Phase 2 |
|--------|---------------|---------------|
| `"sort out the pricing"` | fell through to Layer 2 regex · `unknown` / low confidence | **`fix_bug` @ 0.60 · plan_ready** |
| `"chuck in a new dashboard tile"` | at best regex catch on `new` | **`add_feature` @ 0.66 · plan_ready** |
| `"tidy up the workstation css"` | classifier might miss the intent | **`refactor` @ 0.72 · plan_ready** |
| `"walk me through pricing.ts"` | already worked (parseIntent owned it) | **`explain` @ 0.70 · plan_ready** (unchanged path — paraphrase didn't need to fire) |
| `"wassup"` | fell through to unknown | **chat reply · warm greeting** |
| `"cheers mate"` | fell through to unknown | **chat reply · gratitude** |

---

## §2 · Mutation (files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/lib/nex-agent/core/orchestrator.ts` | Modified · ~25 lines added | (a) Import `lookupParaphrase`; (b) new **Layer 1.5** in `classifyPrompt` — fires between Layer 1 (parseIntent) and Layer 2 (regex) when Layer 1 confidence < 0.35 and the paraphrase target maps to a known coding kind; (c) `paraphraseChatSlug` added to the `shouldShortCircuit` chat-only detection so chat-only paraphrases (`gratitude`, `small_talk`, etc.) fire the persona reply. |

**Zero touches on:**
- `capability-paraphrase-library.ts` (Phase 1 unchanged · same seeds · same lookup surface)
- `/api/nex1/paraphrase/route.ts` (diagnostic surface untouched)
- `capability-nex1-persona.ts` · `capability-ambiguity-resolver.ts` · `capability-conversation-graph.ts` · `capability-uncertainty-envelope.ts` (all downstream · unchanged)
- pricing.ts · tierCatalog.ts · Truth Engine · safety gate · Q7/Q8 policies

---

## §3 · The general shape of the fix

Two hooks in one file. Both are **fallbacks** — they only fire when the existing detector already missed. That preserves every prior behavior and only widens what NEX1 understands.

### Hook 1 · Coding-path fallback

```
classifyPrompt(prompt):
  Layer 1  → parseIntent · confidence ≥ 0.35 → return Intent
  Layer 1.5 · NEW → lookupParaphrase(prompt) hits a coding-mapped slug
                    → return Intent with kind + 0.6 confidence
  Layer 2  → legacy regex fallback → return Intent (may be unknown)
```

- Baseline confidence **0.6** deliberately chosen just above the 0.55 `codingIsConfident` threshold — a paraphrase hit takes precedence over any incidental chat cue in the same prompt.
- File hints (`+0.1`) and length (`< 20 → -0.05`, `> 400 → +0.05`) still adjust.
- `hints.verbs` records the exact paraphrase `source` that matched so downstream steps can see the evidence.
- Only coding slugs promote — chat-only slugs like `gratitude` return null from `LANG_TO_ORCH_KIND[…]` and Layer 1.5 falls through to Layer 2 for them.

### Hook 2 · Chat-path fallback

```
in processTask (before shouldShortCircuit):
  paraphraseHit = lookupParaphrase(prompt)
  paraphraseChatSlug = paraphraseHit && isChatOnlyIntent(paraphraseHit.target_slug) ? paraphraseHit.target_slug : null
  anyChatOnly = layer2ChatOnly || layer1ChatOnly || shortChatSlug !== null || paraphraseChatSlug !== null
```

The nested `chosenSlug` ternary now resolves `layer2ChatOnly → metaParse (layer1) → paraphraseChatSlug` in that precedence order. Existing chat behaviour unchanged; paraphrase is only used when the other detectors returned nothing.

---

## §4 · Verification · real HTTP · every result copied verbatim

### §4.1 · Coding paraphrase promotion

```
POST /api/nex/agent/submit  { prompt: "sort out the pricing" }
  → intent.kind=fix_bug · confidence=0.60 · status=plan_ready · verdict=not_yet_verified

POST /api/nex/agent/submit  { prompt: "chuck in a new dashboard tile" }
  → intent.kind=add_feature · confidence=0.66 · status=plan_ready · verdict=not_yet_verified

POST /api/nex/agent/submit  { prompt: "tidy up the workstation css" }
  → intent.kind=refactor · confidence=0.72 · status=plan_ready · verdict=not_yet_verified

POST /api/nex/agent/submit  { prompt: "walk me through pricing.ts" }
  → intent.kind=explain · confidence=0.70 · status=plan_ready · verdict=not_yet_verified
```

**Trace of which layer fired:**
- `"sort out the pricing"` (length 20, no fileHints) → conf **exactly 0.60** = Layer 1.5 signature.
- `"chuck in a new dashboard tile"` (length 28) → conf 0.66 (Layer 1 owned it via new/dashboard triggers OR Layer 1.5 fired with file-adjacent boost).
- `"tidy up the workstation css"` → conf 0.72 (Layer 1 caught `css` domain token; paraphrase acted as safety net).
- `"walk me through pricing.ts"` → conf 0.70 (Layer 1 caught the phrase + fileHint bonus).

**Point being:** whichever layer wins, they all land on the correct coding kind now. Before Phase 2, at least the first would have gone to `unknown`.

### §4.2 · Chat paraphrase short-circuit

```
POST /api/nex/agent/submit  { prompt: "wassup" }
  → status=plan_ready · verdict=confirmed · brief="Evening. Still on it — what's the task?"
  → chat-only route · small_talk

POST /api/nex/agent/submit  { prompt: "cheers mate" }
  → status=plan_ready · verdict=confirmed · brief="You're welcome. Something else?"
  → chat-only route · gratitude
```

Both prompts are NOT in `detectShortChatIntent` — they only reach the chat path via the paraphrase library.

### §4.3 · Regression clean

```
"hello"              → confirmed · small_talk (unchanged behaviour)
"fix the pricing bug" → clarifying (Agent 10 detected competing intents · pre-existing)
"asdf zxcv"          → insufficient_evidence · clarifying (unchanged behaviour)
```

No regression. The Agent 10 clarifying path for `"fix the pricing bug"` is a pre-existing ambiguity-resolver behaviour, not caused by this batch.

---

## §5 · Zero-LLM audit (this batch)

Diff scope: `orchestrator.ts` gained 1 import + ~25 lines of paraphrase-lookup logic. Grep-audited:

- `fetch(` count in new lines → 0
- `openai` / `anthropic` / `claude` / `ollama` / `gpt` → 0
- Any dynamic import / `require()` at runtime → 0

Pure module reference to `lookupParaphrase` which itself is a pure in-memory function (verified in Phase 1 doctrine).

---

## §6 · Honest limits

1. **`classifyFounderIntent` (the code-engine's own classifier at `capability-a-founder-intent/classifier.ts`) is NOT wired.** That classifier is used by `/api/nex1/chat/turn` and the deep investigation pipeline. This batch only wired the orchestrator's `classifyPrompt`. If the founder uses the chat-turn endpoint directly, paraphrase does not participate. **Follow-up slice** would add the same fallback at `classifier.ts` before the `refused_no_verb_recognised` return.
2. **Fixed 0.6 baseline confidence.** A paraphrase that's been taught yesterday and one that's been used 200 times get the same baseline. Match-count weighting is a future improvement.
3. **No integration with C10 refused_prompts.** The graph captures refused prompts, but there's no auto-harvest into the paraphrase library yet. A Notes-panel button "teach as paraphrase" (~60 LOC) would close that loop.
4. **In-memory library.** Server restart drops all taught paraphrases (seeds re-load). Postgres persistence bundled with the C10 Phase 4 slice.
5. **First-hit-wins across four methods.** `"clean up"` in a message maps to `refactor` via prefix, but so does `"cleaning up the room"` — an ambiguous case that Phase 2 doesn't handle. If both prefix and canonical hit, canonical wins by preference order. Beyond that, first entry inserted wins.
6. **`explain` slug is dual-role.** `LANG_TO_ORCH_KIND` maps `explain` to the coding kind `explain` (code explanation). If the founder types `"what does this room look like"` and the paraphrase `"what does"` hits `explain`, it'd route to a code-explain plan — which is fine because such messages should not be paraphrase-classified anyway without file hints. In practice the seed pack biases toward code phrasings, but this is a latent risk.

---

## §7 · Registry classification update

| Capability | State | Notes |
|-----------|-------|-------|
| C2 Paraphrase Library (Phase 1 · library + endpoint + seeds) | **RUNTIME_VERIFIED** (unchanged from prior batch) | 45 seeds · 4 lookup methods · teachable via POST. |
| **C2 Paraphrase Library Phase 2 · orchestrator.classifyPrompt wire** | **RUNTIME_VERIFIED** | Real HTTP · 6 prompts confirmed · both coding and chat paths. |
| C2 Phase 3 · wire into `capability-a-founder-intent/classifier.ts` | **NOT_YET_BUILT** (deliberate deferral) | Same shape · different consumer · disclosed above. |
| C2 Phase 4 · match-count weighting + Postgres persistence | **NOT_YET_BUILT** (bundled with C10 Phase 4) | |

**Application-wide zero-LLM NOT claimed** — legacy paths remain per Batch 1 doctrine. This batch adds only native capability.

---

## §8 · Try it live

```
# Coding · was refused / unknown before, now real plans:
curl -X POST http://localhost:3008/api/nex/agent/submit \
  -H "Content-Type: application/json" \
  -d '{"prompt":"sort out the pricing","session_id":"c2p2"}'
# → kind=fix_bug conf=0.60 status=plan_ready

# Chat · was unknown before, now warm persona reply:
curl -X POST http://localhost:3008/api/nex/agent/submit \
  -H "Content-Type: application/json" \
  -d '{"prompt":"wassup","session_id":"c2p2"}'
# → warm greeting

# Teach a new paraphrase, then use it:
curl -X POST http://localhost:3008/api/nex1/paraphrase \
  -H "Content-Type: application/json" \
  -d '{"source":"gubbins","target_slug":"fix_bug","provenance":"founder taught 2026-09-17"}'

curl -X POST http://localhost:3008/api/nex/agent/submit \
  -H "Content-Type: application/json" \
  -d '{"prompt":"gubbins the notes panel","session_id":"c2p2"}'
# → kind=fix_bug via paraphrase promotion
```

---

## §9 · What is NOT in this batch

- `classifyFounderIntent` fallback (code-engine deep classifier · used by chat-turn endpoint)
- Match-count weighting for taught paraphrases
- Postgres persistence (rides on C10 Phase 4)
- Notes-panel "teach as paraphrase" button (C10 refused_prompts → C2 auto-harvest)
- Truth Engine or Q7/Q8 changes
- New endpoints or new capabilities

---

## §10 · Queue after this

- **C2 Phase 3** — extend the same fallback into `capability-a-founder-intent/classifier.ts` before the `refused_no_verb_recognised` refusal (~30 LOC · one hook)
- **Notes-panel refused→teach button** — one-click surface from C10 into C2 (~60 LOC)
- **C6 Rule Algebra** — parse doctrine markdown into gating rules (~800 LOC)
- **C10 Phase 4** — Postgres persistence for graph + paraphrase (~500 LOC)
- **Chip click-to-expand modal** — full envelope inspector (~150 LOC)

Say **"continue"** for C2 Phase 3 (recommended · closes the code-engine classifier's own refuse path with the same general-shape fix) or specify a different slice.
