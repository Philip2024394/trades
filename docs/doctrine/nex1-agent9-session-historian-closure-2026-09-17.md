# Agent 9 · Session Historian · Notes Panel · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · sixth slice · after C10 Phase 2.
**Authority:** Founder "continue" instruction after C10 Phase 2 shipped RUNTIME_VERIFIED.
**Author:** master_ai_engineer (Claude Opus 4.7)

## §1 · Target
Surface the C10 conversation graph as a founder-facing panel in the workstation. Every preference, correction, refused prompt, and unresolved question NEX1 has captured for the active task is visible, live, deterministic. Zero LLM · zero fabrication.

## §2 · Wire

Adds a 6th tab tile to the workstation Right panel: **◊ Notes**. The panel fetches `GET /api/nex1/conversation-graph?conversation_id=<activeTask.task_id>` on mount, on task change, and on manual reload. Renders 4 typed sections:

1. **◇ Preferences** — cyan-bordered · with kind chip (explicit/inferred) + turn number
2. **⇄ Corrections** — orange-bordered · `from → to` with kind chip + optional context
3. **? Unresolved questions** — amber-bordered · asked_by chip + turn
4. **✓ Resolved questions** — muted green · shown when non-empty · Q/A pairs, max 5
5. **✕ Refused prompts** — red-bordered · with reason chip + detail

## §3 · Mutation (files touched)

| File | Kind | Purpose |
|------|------|---------|
| `src/app/nex1/workstation-live/agent/NotesPanel.tsx` | **NEW · 235 lines** | Read-only client component. Fetches graph snapshot · renders 5 sections with typed styling · handles no_task / loading / error / ok states · reload button. |
| `src/app/nex1/workstation-live/agent/NexAgentWorkstation.tsx` | Modified | `TabView` extended with `"notes"` · import + tile button + render branch. `~12 lines added.` |
| `src/app/nex1/workstation-live/agent/nex-agent-workstation.css` | Modified | Full section styling: `.naw-notes-root`, `.naw-notes-header`, section titles + counts + item cards, footer badge, red/amber/green count variants. `~135 lines added.` |

**Zero backend changes.** Panel is a pure consumer of the existing `/api/nex1/conversation-graph` endpoint.

## §4 · Verification · real HTTP + real graph data

**Empty-state fresh task:**
Snapshot returns `counts: {bindings:0, threads:0, preferences:0, refused_prompts:0, unresolved_questions:0, resolved_questions:0, corrections:0, decisions:0, mutations:0}` → panel renders each section with helpful hint copy ("Say 'always use X'…", "Nothing pending…", etc.).

**Seeded task with preference + refused (`"always use Math.max not ternary"`):**
- 1 preference: `"always use Math.max not ternary"` (kind=explicit)
- 1 refused prompt: reason=`refused_no_verb_recognised`
- 2 unresolved questions
- Panel displays each with typed styling ✓

**Ambiguity + resolution chain (`"clean bug"` → pick B):**
- 1 refused prompt: reason=`refused_ambiguous`
- 1 unresolved question
- **1 correction: `fix_bug → refactor` (kind=intent)** ← C7 resolution flowed into graph, panel displays as an orange-bordered card
- Panel renders the from/to as red→green colored spans ✓

## §5 · UX details

- **Header** shows the active task id (truncated to 8 chars) + total record count
- **Reload button (↻)** — manual refresh, disabled when no active task or currently loading
- **Empty state** when no task is active: friendly "pick a task from History or type a new prompt" copy — never a blank screen
- **Error state** shows the exact error message + retry hint
- **Every section has a helpful hint** when empty ("Say 'always use X'…") so the founder knows what triggers each node type
- **Footer** confirms `NEX1_NATIVE · zero LLM` badge visible at the bottom of every render

## §6 · Safety boundary honoured

- **Zero LLM.** Panel is pure fetch + render.
- **Zero fabrication.** Every row is a real graph node from the endpoint. If the endpoint returns nothing, the section shows a hint, not made-up content.
- **Read-only.** Panel never POSTs, never mutates, never writes anywhere.
- **AbortController** on fetch — component unmount / task change cancels in-flight requests cleanly.
- **cache: "no-store"** on the fetch — always fresh snapshot.
- **Pricing.ts SHA unchanged. Truth Engine untouched. Orchestrator untouched. C10 mutators untouched.**

## §7 · Regression clean

- Existing 5 tabs still work (Code default · History · Plugins · Loop · Repo).
- Ambiguity click-to-pick buttons still work.
- Persona chat replies still fire.
- Coding ACKs still emit.
- C7 clarification flow untouched.
- Repo onboarding panel untouched.

## §8 · Honest limits

1. **Panel is per-task.** Because `conversation_id = task_id`, switching between tasks in History shows each task's isolated graph. Cross-task aggregation is C10 Phase 3.
2. **No live push.** The panel does not subscribe to server-side events. It fetches on mount + task-change + manual reload. If a new graph node lands mid-view, you need to hit ↻ to see it.
3. **No filtering / search.** All entries shown, always. Would need a filter chip row for very long sessions.
4. **No pagination.** Bounded arrays (200 prefs / 500 corrections) already cap render size but a task with 500 corrections would produce a long scroll.
5. **Ambiguity chain requires a FRESH task.** If you continue an existing task where the first prompt was refused (like `"always use Math.max not ternary"`), the followup runs on the compound prompt and the ambiguity path doesn't re-fire. That's the orchestrator's continuation behaviour, not the panel's.

## §9 · What is NOT in this batch

- No Truth Engine changes
- No Q7/Q8 changes
- No orchestrator changes
- No Teaching Agent implementation (still audit-gated)
- No cross-task graph aggregation
- No live SSE push into the panel
- No natural-language preference inference beyond C10 Phase 2's 5 patterns
- No wire into `/api/nex1/chat/turn`

## §10 · Test it now

1. Hard-refresh `http://localhost:3008/nex1/workstation-live`
2. Type `"clean bug"` in the prompt → send → ambiguity options appear
3. Click **B** (or type "B") → correction fires
4. Click the **◊ Notes** tile → see 1 correction (`fix_bug → refactor`), 1 refused, 1 unresolved question
5. Optionally type `"always use Math.max not ternary"` as a fresh task → preference recorded

Every entry visible in the panel is a REAL row from `nex_agent.task_steps` and the C10 graph store. No synthesis.

## §11 · Queue after this

Original frontier queue moved another slice forward. Reasonable next options:

- **C11 · Uncertainty as first-class output** — typed response envelopes across the pipeline. Generalises the tri-state (`clarify · proceed · refuse`). ~400 LOC.
- **C10 Phase 3** — cross-task aggregation + wire into `/api/nex1/chat/turn` + auto-resolve unresolved questions when a follow-up answers them. Directly extends what just shipped. ~250 LOC.
- **C2 · Deterministic paraphrase library seeding** — now that we have real refused prompts in the graph, harvest them to build the paraphrase library. ~300 LOC seed + tooling.
- **C6 · Rule algebra** — parse `docs/doctrine/*.md` into executable rules that gate the coding plans. ~800 LOC.

Say "continue" for the recommended next (**C10 Phase 3** — closes the loop on graph auto-resolve + cross-task memory) or specify a different slice.
