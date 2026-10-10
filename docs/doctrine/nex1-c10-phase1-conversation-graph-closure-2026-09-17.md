# C10 Phase 1 · Conversation Knowledge Graph · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · fourth slice · after C7 phase 2.
**Authority:** Founder "continue" instruction after C7 phase 2 shipped RUNTIME_VERIFIED.
**Author:** master_ai_engineer (Claude Opus 4.7)

## §1 · Target
Extend the existing ConversationHead into a proper typed knowledge graph. Four new typed collections beyond bindings + threads: **preferences · refused_prompts · unresolved_questions · corrections**. Deterministic mutators + query API + graph-aware reference resolver. Zero LLM. Zero wiring into consumers this batch — Phase 2 will wire.

## §2 · Why phase-split
Full C10 was estimated 600 LOC across storage + wire. Building it all in one batch would either:
- Half-verify the wire path (violates Completion Contract), or
- Force a mega-verification suite that eats budget

Phase 1 delivers a FULLY VERIFIED storage + query layer with a diagnostic endpoint. Phase 2 wires chat-turn/orchestrator to auto-populate as real turns happen. Both are independent, each RUNTIME_VERIFIED.

## §3 · Mutation (files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/lib/nex-agent/code-engine/capability-conversation-context.ts` | Modified | Extended `ConversationHead` interface with 4 new arrays + 4 new node types (`FounderPreference`, `RefusedPrompt`, `UnresolvedQuestion`, `Correction`). Defensive initialization in `getConversationHead()` for older heads. `~55 lines added.` |
| `src/lib/nex-agent/code-engine/capability-conversation-graph.ts` | **NEW · 315 lines** | Mutator functions · graph snapshot query · graph-aware reference resolver · convenience selectors. |
| `src/app/api/nex1/conversation-graph/route.ts` | **NEW · 96 lines** | Diagnostic REST surface · GET snapshot/resolve · POST all 5 mutators. |

**Zero backend orchestrator changes.** No DB migration. No LLM. No changes to Q7/Q8/Truth Engine/persona/ambiguity paths.

## §4 · Node schemas

**FounderPreference** — durable prefs, dedupes by sha1(text). Fields: `id · text · captured_turn · captured_at · kind (explicit|inferred) · derived_from_thread_id`.

**RefusedPrompt** — history of refusals with reason. Fields: `turn · at · prompt · reason · detail`.

**UnresolvedQuestion** — questions NEX1 asked, still open until answered. Fields: `id · asked_turn · asked_at · question · asked_by (nex1|system) · resolved · resolved_turn · resolved_answer · thread_id`. Movable between unresolved / resolved via `resolveQuestion()`.

**Correction** — "no, do X instead of Y" moments. Fields: `turn · at · kind (intent|target|value|wording|other) · from_value · to_value · context · thread_id`.

## §5 · Storage discipline

- All arrays are append-only in normal use; corrections/questions get a `resolved` flag rather than deletion so the audit trail is intact.
- Every array is bounded (MAX_PREFERENCES=200 · MAX_REFUSED_HISTORY=200 · MAX_UNRESOLVED=100 · MAX_CORRECTIONS=500 · MAX_TEXT_LEN=240). Overflow drops oldest.
- Persistence is the same globalThis singleton the existing ConversationHead uses. Cross-turbopack-reload survivability inherited.

## §6 · Verification · 9-case real HTTP

| # | Test | Result |
|---|------|--------|
| 1 | Fresh conversation · empty graph snapshot | counts all 0 · ok=true ✅ |
| 2 | addPreference · new pref | pref_id sha1 · deduped=false ✅ |
| 3 | addPreference · duplicate | deduped=true (same sha1) ✅ |
| 4 | addRefusedPrompt · reason preserved | ok=true · reason=refused_no_verb_recognised ✅ |
| 5 | addUnresolvedQuestion + resolveQuestion | q resolved=true · answer=src/lib ✅ |
| 6 | addCorrection · intent kind | from=add_feature · to=fix_bug ✅ |
| 7 | Full snapshot after 6 mutations | {preferences:1, refused:1, unresolved:0, resolved:1, corrections:1} ✅ |
| 8 | Resolver · message w/o pronoun | 0 hits ✅ |
| 9 | Resolver · pronoun · no active_target on fresh convo | 0 hits ✅ |

## §7 · Graph-aware reference resolver

Replaces the single-target `resolvePronounToActiveTarget()`. Walks bindings first (highest confidence), then active_target, then most-recent thread target (fallback), then recent mutations. Returns ranked candidates with:

```
{ source, value, binding_name?, thread_id?, confidence, why }
```

Deterministic tiers:
- Binding name match → 0.9
- Active target + file hint → 0.75
- Active target · generic pronoun → 0.6
- Fallback thread target → 0.55
- Recent mutation → 0.5

## §8 · Query API

- `getGraphSnapshot(cid)` — full flat snapshot with counts.
- `resolveReference(cid, message)` — ranked ReferenceHit[].
- `getPreferences(cid) · getUnresolvedQuestions(cid) · getRefusedPrompts(cid) · getCorrections(cid)` — typed selectors.

## §9 · Safety boundary

- **Zero LLM** — grep-verified module has no `fetch`/`http`/provider imports.
- **Deterministic** — sha1 IDs, timestamp-only side effects, no randomness.
- **Backwards-compatible** — the new fields are initialized on both fresh and older heads. Existing code that touches `head.threads` / `head.bindings` continues to work unchanged.
- **Bounded** — every append trims to a max size to prevent unbounded growth.
- **No cross-conversation leakage** — every operation is keyed by conversation_id.
- **Truth Engine untouched. Q7/Q8 untouched. Persona untouched. Ambiguity path untouched.**

## §10 · Honest limits (what did NOT ship this batch)

1. **No auto-population from real turns.** `chat-turn` / `orchestrator.ts` do not call these mutators yet. That's Phase 2 · explicit follow-up batch. Right now the graph fills only via the diagnostic POST endpoint.
2. **Reference resolver not wired into any consumer.** It's callable but nothing calls it — same reason as (1).
3. **No inference-based preference extraction.** Preferences must be `addPreference()`-ed explicitly. Auto-detecting them from founder messages ("always X" / "never Y") is a separate slice.
4. **No cross-conversation memory.** Every conversation_id has its own isolated graph. Global founder-preference persistence would need a separate module.
5. **No graph indices.** All queries are O(N) scans over arrays. Fine for current sizes; needs indices if a conversation exceeds ~10k events.
6. **UI does not surface the graph yet.** No workstation panel showing preferences/corrections. Would be a natural C10 phase 3.

## §11 · Diagnostic endpoint (verify anytime)

```
GET  /api/nex1/conversation-graph?conversation_id=X
GET  /api/nex1/conversation-graph?conversation_id=X&resolve=<message>
POST /api/nex1/conversation-graph
     body: { conversation_id, op, payload }
     ops: addPreference · addRefusedPrompt · addUnresolvedQuestion
        · resolveQuestion · addCorrection
```

Every response includes `zero_llm: true` + `source: NEX1_NATIVE`.

## §12 · Queue after this

Original queue: **C7 phase 1 → C7 phase 2 → C10 phase 1 (done) → C10 phase 2 → C11**.

**Natural next slice options:**

- **C10 phase 2 · wire into consumers.** chat-turn detects preference statements ("always X") → addPreference. Ambiguity resolver on unresolved → addUnresolvedQuestion. C7 resolver on pick → addCorrection when a different slug was chosen than expected. Orchestrator on refuse → addRefusedPrompt. Then the graph auto-populates from real turns and the reference resolver becomes useful in the pipeline. ~300 LOC · verifiable via multi-turn probes.

- **C11 · Uncertainty as first-class output.** Generalise the tri-state (clarify · proceed · refuse) with typed responses across the pipeline. Currently only ambiguity uses it explicitly. ~400 LOC · verifiable via type-safe response envelope probes.

- **Session Historian (Agent 9).** Reads the C10 graph and surfaces a "founder profile" panel in the workstation. Requires C10 phase 2 first for real data.

## §13 · What I did NOT do

- Zero orchestrator changes
- Zero chat-turn changes
- Zero DB migrations
- Zero LLM
- No 40+ agent orchestration
- No Truth Engine changes
- No Teaching Agent implementation (still audit-gated)
- No workstation UI code touched

Say "continue" for **C10 phase 2** (auto-populate from real turns · biggest force multiplier for chat feel). Or pick a different slice.
