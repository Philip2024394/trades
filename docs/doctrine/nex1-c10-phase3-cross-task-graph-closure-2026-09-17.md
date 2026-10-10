# C10 Phase 3 · Cross-Task Session Graph + Auto-Resolve · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · seventh slice · after Session Historian.
**Authority:** Founder "continue" instruction after Session Historian shipped RUNTIME_VERIFIED.
**Author:** master_ai_engineer (Claude Opus 4.7)

## §1 · Target · three pieces in one batch

1. **Cross-task aggregation** — `session_id` passthrough so all tasks in one browser tab share ONE conversation graph.
2. **Auto-resolve on C7 pick** — when the founder resolves an ambiguity by clicking a letter, the most recent unresolved question in that graph auto-resolves with the picked slug.
3. **Client-side session id** — workstation generates a stable id in localStorage, includes it on every submit + ambiguity-pick fetch.

## §2 · Mutation (files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/app/api/nex/agent/submit/route.ts` | Modified | Accept optional `session_id` on request · pass it through to `processTask` · echo it in the response. `~10 lines added.` |
| `src/lib/nex-agent/core/orchestrator.ts` | Modified | New `ProcessTaskOptions.conversationId` param · derived `graphKey = opts?.conversationId ?? taskId` used in ALL 7 graph mutation call-sites · C7 resolved branch now calls `resolveQuestion()` on the last unresolved question. `~25 lines changed.` |
| `src/app/nex1/workstation-live/agent/NexAgentWorkstation.tsx` | Modified | Stable `sessionId` state (localStorage-persisted) · included in prompt submit body + ambiguity-pick body · Notes panel now receives `sessionId` as `activeTaskId` so it displays the session-wide graph. `~15 lines added.` |

**Zero LLM. Zero DB migration.** All 3 pieces backwards-compatible — omit `session_id` and behaviour matches Phase 2 (per-task isolation).

## §3 · Verification · real HTTP end-to-end

Session `s-verify-1789660383`, 3 tasks / 3 API calls:

| Turn | Prompt | Result | Session graph after |
|------|--------|--------|---------------------|
| 1 | `"always use Math.max not ternary"` | classifier refused (no verb) + preference detector fired | preferences=1 · refused=1 · unresolved=2 |
| 2a | `"clean bug"` (new task, same session) | ambiguity fired | refused=2 · unresolved=3 |
| 2b | `"B"` (continuation of task 2) | C7 resolved to refactor · correction recorded · **1 unresolved auto-resolved** | corrections=1 · resolved=1 · unresolved=2 |

**Final session graph:**
- preferences: `always use Math.max not ternary` (from task 1)
- corrections: `fix_bug → refactor` (from task 2's C7 pick)
- resolved: 1 (auto-resolved with answer `"founder picked refactor via letter=\"B\""`)
- unresolved: 2 (task 1's clarifying questions the founder never answered)
- refused: 2 (one per task)

**Both tasks contributed to ONE graph** — Phase 3 aggregation confirmed. The remaining unresolved count of 2 is correct: task 1's clarifiers were skipped when the founder moved to task 2.

## §4 · Design decisions

- **Session id lives client-side** in localStorage under key `nex1_session_id`. Persists across tab closes on the same origin. Fresh tab (no localStorage) → new session id. Founder can clear it via devtools → gets a fresh graph.
- **Auto-resolve is precise** — resolves the LAST unresolved question added to that session graph, not all of them. When founder picks a C7 option, that's overwhelmingly the question that just got asked; older unresolved ones stay open honestly.
- **Backwards-compatible** — Every existing caller that doesn't send `session_id` still works. `graphKey` falls back to `taskId`. Older tests and existing tasks are unaffected.
- **Notes panel now shows session graph** — the panel's `activeTaskId` prop is now the sessionId (with per-task fallback), so preferences accumulated across many tasks all show together.

## §5 · Safety honoured

- **Zero LLM.** All work is regex-driven pattern detection + straight state mutation.
- **Deterministic.** Same inputs → same outputs.
- **Bounded.** `session_id` length capped at 120 chars in the submit route; graph arrays capped from Phase 1 (200 prefs / 500 corrections / etc.).
- **Best-effort mutation.** Every graph write wrapped in `try {} catch {}` — orchestrator never breaks if the graph module throws.
- **Auto-resolve is scoped to one question.** Cannot silently mark multiple questions resolved from a single pick.
- **Pricing.ts SHA unchanged · Truth Engine untouched · Q7/Q8 untouched · persona untouched · C7 flow untouched (only extended).**

## §6 · Regression

- Callers without `session_id` (older probes, direct API users) still get per-task graphs.
- Ambiguity resolution end-to-end still works (click-to-pick + typed letter both).
- Persona chat replies unchanged.
- Coding ACKs unchanged.
- Notes panel renders identically when either sessionId OR taskId is used as the key.

## §7 · Honest limits

1. **localStorage is per-origin, not per-user.** Different browsers or private windows will each generate their own session.
2. **`/api/nex1/chat/turn` still uses its native `conversation_id`, not `session_id`.** The two systems can theoretically use different ids. Unifying them would need a small routing shim — not in scope for this batch.
3. **Auto-resolve marks only the LAST question.** If the founder answers a question that was asked 3 turns ago and 2 more questions have been asked since, only the newest one auto-resolves. That's honest but occasionally the wrong pick.
4. **Session id reset means graph reset.** Clearing localStorage forgets everything. Server-side persistence (Postgres-backed graph) is Phase 4 territory.
5. **Cross-browser + cross-device sync not implemented.** Each device is its own session.

## §8 · What is NOT in this batch

- No cross-browser / cross-device session sync
- No wire into `/api/nex1/chat/turn`
- No natural-language preference inference beyond Phase 2's 5 regex patterns
- No Postgres-backed graph persistence (still globalThis in-memory + JSON)
- No workstation UI to show session id / reset session
- No 40+ agent orchestration
- No Teaching Agent implementation
- No Truth Engine changes

## §9 · Test it now

1. Hard-refresh `http://localhost:3008/nex1/workstation-live`
2. Type `"always use Math.max not ternary"` → send
3. Wait for a plan / refused / whatever the classifier does
4. Type `"clean bug"` in a fresh turn → ambiguity buttons appear
5. Click **B** (refactor)
6. Open the **◊ Notes** tile
7. You should see:
   - **1 preference** from turn 1
   - **1 correction** (fix_bug → refactor) from turn 3
   - **1 resolved question** ("founder picked refactor via letter=\"B\"")
   - The **session id** is stable across both tasks

## §10 · Queue after this

- **C11 · Uncertainty as first-class output** — typed response envelopes across the pipeline. ~400 LOC.
- **C2 · Deterministic paraphrase library seeding** — harvest the refused prompts we're now capturing. ~300 LOC.
- **C6 · Rule algebra** — parse `docs/doctrine/*.md` into executable rules that gate coding plans. ~800 LOC.
- **C10 Phase 4** — Postgres-backed graph persistence + `/api/nex1/chat/turn` wire + session-list UI. ~500 LOC.

Full closure at `docs/doctrine/nex1-c10-phase3-cross-task-graph-closure-2026-09-17.md`. Say "continue" for **C11** (natural next per the frontier map) or specify a different slice.
