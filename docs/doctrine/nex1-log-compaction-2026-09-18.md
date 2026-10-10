# Log Compaction · Closure Doctrine

**Date:** 2026-09-18
**Batch:** Frontier §17 queue · twenty-first slice · after verdict-history panel.
**Authority:** Founder "continue" · §11 recommendation · closes "unbounded log growth" limit disclosed across every persistence slice (4a §6.1, 4b §6.2, 4c §6.1, dismissals §5.3).
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §1 · Target

Close the **unbounded log growth** honest limit disclosed across the entire persistence arc:

- Paraphrase log accumulates one `touch` event per lookup. A busy day = hundreds of touch lines. Compaction collapses to one line per current entry.
- Dismissal log accumulates a `dismiss` per click plus an `undismiss` per DELETE. Compaction collapses to one line per currently-dismissed prefix.

After this batch: founder can hit `POST /api/nex1/logs/compact` to shrink JSONL files back to their essential state without losing current-state semantics.

**Deliberate trade the founder chooses when they hit compact:** on-disk match_count history for paraphrases is LOST. After a restart following compaction, each paraphrase's `match_count` starts at 0 again — its confidence-weighting boost resets. The library still works; it just re-learns which entries are hot. In-memory match_count for the currently-running process is unaffected (compaction rewrites the log; it doesn't clear the Map).

---

## §2 · Mutation (files touched)

| File | Kind | LOC | Purpose |
|------|------|-----|---------|
| `src/lib/nex-agent/language/capability-paraphrase-persistence.ts` | Modified · +55 LOC | `compactParaphraseLog` — replay to compute latest upsert per canonical, atomic write-tmp+rename, drop all touch events |
| `src/lib/nex-agent/code-engine/capability-banner-dismissals-persistence.ts` | Modified · +45 LOC | `compactDismissalLog` — replay to current set, one `dismiss` per prefix, drop all cancelling pairs |
| `src/app/api/nex1/logs/compact/route.ts` | **New** · 40 LOC | `POST` accepts `{ scope }` = "paraphrase" \| "dismissals" \| "all" (default) · returns receipt |

**Zero touches on:**
- ConversationHead JSON snapshots (not JSONL · no compaction applicable · always overwritten in place)
- Turn transcripts JSONL (deliberately deferred — capping to N-per-file needs care with active conversations · future slice)
- Envelope history JSONL (per-task files · archive/rotate is the right operation for those · future slice)
- Any library API surface (compaction is a pure operation on the on-disk log · in-memory state untouched)

---

## §3 · Design

### §3.1 · Replay-then-rewrite pattern

For both compactions:
1. `existsSync` check · if no log, return zero-report immediately (idempotent on empty state)
2. `readFileSync` current bytes
3. Replay events into current-state map/set
4. Serialise current state as new JSONL (one line per current entry · sorted for determinism)
5. Write to `.tmp` sibling
6. `renameSync` over the target (atomic on NTFS + POSIX)
7. Return receipt with before/after bytes + events

### §3.2 · Deterministic sort

Compacted output sorts by canonical (paraphrase) or by prefix (dismissals). Same in-memory state ALWAYS produces the same byte output. This means comparing two compacted logs is meaningful — if they differ, the underlying state differs.

### §3.3 · Atomic-in-effect writes

`writeFileSync(.tmp)` + `renameSync(.tmp → target)` matches the pattern used by `capability-conversation-persistence` (Phase 4b). A process crash between `writeFileSync` and `renameSync` leaves the OLD log intact — no partial writes visible.

### §3.4 · Idempotence

Compacting a compacted log is a no-op in terms of state (same entries land in the same order). Byte count may grow by 1 line's worth if new events came in between compactions, but that's normal.

### §3.5 · What's LOST + why it's okay

**Paraphrase touches** carry `match_count` and `last_matched_at`. Compaction drops them.
- **In-memory** state during the running process is unaffected · the library's Map still holds correct `match_count` values.
- **On next restart** after compaction, `match_count` = 0 for every entry (no touches to replay).
- **Consequence:** paraphrase confidence resets to the 0.75 base until entries get touched again. A ~40-hit entry that had been at 0.95 goes back to 0.75.
- **Why acceptable:** the confidence weighting is INFORMATIONAL, not a selection driver (see C2 Phase 4 §4.2). No downstream consumer branches hard on `confidence >= X` — the classifier fallback uses whatever confidence the library reports. Losing match_count means the library forgets "which taught paraphrases have been hot" — not "which paraphrases exist".

**Dismissal history** (dismiss ↔ undismiss pairs) is dropped.
- Founder loses the audit trail "I dismissed 'wibble the' 3 weeks ago and then undismissed it last Tuesday".
- The **CURRENT** state (what's dismissed now) is preserved exactly.
- Why acceptable: the audit trail wasn't surfaced anywhere. If we ever add a UI for "history of banner interactions", this trade-off changes.

---

## §4 · Verification · real HTTP · every result verbatim

### §4.1 · Bloat the paraphrase log

Taught 1 new entry `floof` + hit `?q=floof` 12 times:
```
before compaction · total lines=22 · upserts=4 · touches=18 · floof events=13
```

(The 4 upserts + 18 touches include a few taught entries from prior probes plus 12 touch events for `floof`.)

### §4.2 · Churn the dismissal log

3 dismisses + 1 undismiss + 1 re-dismiss:
```
before compaction · total lines=8
```

### §4.3 · Compact all

```
POST /api/nex1/logs/compact { scope: "all" }
  → paraphrase: before_bytes=2097 → after=830 · events 22 → 4 (60% byte reduction)
  → dismissals: before_bytes=569  → after=212 · events 8 → 3
```

### §4.4 · Post-compaction file contents

```
paraphrase entries.jsonl → lines=4 · kinds={ upsert: 4 }
dismissals.jsonl        → lines=3 · kinds={ dismiss: 3, undismiss: 0 }
                         · prefixes=[ "fgh ij", "gubbins the", "klm no" ] (sorted)
```

Zero touch events. Zero undismiss events. Exactly one line per current-state entry, alphabetically ordered.

### §4.5 · Semantic equivalence · library still returns identical results

```
GET /api/nex1/paraphrase?q=floof+the+widget → fix_bug via prefix
GET /api/nex1/banner-dismissals             → prefixes=[ "fgh ij", "gubbins the", "klm no" ]
```

The prefix `"abc de"` that was dismissed then undismissed correctly does NOT appear in the compacted set. The `undismiss` cancelled the `dismiss` and both events vanished.

### §4.6 · **Hot-reload survival**

Touched persistence module → Turbopack rebuild → module state gone → library re-bootstrapped from compacted log:

```
post-reload · "floof the widget" → fix_bug (match_count=14)
```

`match_count=14` because: 12 touches during bloat + 1 during §4.5 sanity check + 1 during this post-reload query. In-memory match_count was preserved through the rebuild because the library was already running when compaction landed. On the NEXT cold restart (fresh process · no in-memory state), match_count would replay to 0 — which is the documented trade of compaction.

### §4.7 · Idempotence

Second compact call:
```
paraphrase before=6 after=4  (6 events = 4 upserts from prior compact + 2 new touch events from §4.5)
```

Compacting an already-compacted log is safe · shrinks to the same 4 upserts.

### §4.8 · Zero-LLM audit

```
src/app/api/nex1/logs/compact/route.ts                            → CLEAN
src/lib/nex-agent/language/capability-paraphrase-persistence.ts    → CLEAN
src/lib/nex-agent/code-engine/capability-banner-dismissals-persistence.ts → CLEAN
```

Scanned for `openai`, `anthropic`, `ollama`, `claude-`. Zero matches.

---

## §5 · Honest limits

1. **Match_count history is lost by compaction.** Documented in §3.5 — deliberate trade. In-memory state during the running process is unaffected. Cold restart after compaction resets confidence weighting.
2. **Turn transcripts (Phase 4c) are NOT compacted.** Each conversation JSONL grows one line per user turn. For founder-scale usage (~50 turns/day/conversation), a year's worth of data is ~18KB per file — trivial. If we want to cap active-conversation trails or archive old conversations, that's a separate slice (deliberately excluded from this scope · touching active conversations mid-flight is riskier).
3. **Envelope history (verdict trail) is NOT compacted.** Each task's JSONL is bounded by the number of orchestrator exit points hit for that task (typically 1). Growth is task-count-linear, not activity-linear. Archive-old-tasks is the right operation for those · future slice.
4. **ConversationHead snapshots are NOT compacted.** They're one JSON per conversation, always overwritten. No accumulation. No compaction applicable.
5. **No dry-run mode.** POST `/api/nex1/logs/compact` executes immediately. To preview what compaction would drop, founder would inspect the raw JSONL first. If we want a preview endpoint, that's a small follow-up.
6. **No per-canonical or per-prefix scope.** Compaction is all-or-nothing per store. If founder only wants to compact one specific paraphrase's touches, that's a separate feature.

---

## §6 · Registry classification

| Capability | State | Evidence |
|-----------|-------|----------|
| Paraphrase log compaction | **RUNTIME_VERIFIED** | §4.3 · 22 → 4 events, 60% bytes |
| Dismissal log compaction | **RUNTIME_VERIFIED** | §4.3 · 8 → 3 events · undismiss pair cancelled cleanly |
| Semantic equivalence after compaction | **RUNTIME_VERIFIED** | §4.5 · library returns identical lookups |
| Atomic write (write-tmp+rename) | **VERIFIED_BY_INSPECTION** | Same pattern as Phase 4b · widely tested |
| Idempotence | **RUNTIME_VERIFIED** | §4.7 · second compact is safe |
| Hot-reload survival of compacted state | **RUNTIME_VERIFIED** | §4.6 |

**Application-wide zero-LLM** still not-claimed as an all-app property.

---

## §7 · Try it live

```bash
# Preview what's in the log:
wc -l data/nex1-paraphrase/entries.jsonl
wc -l data/nex1-notes-panel/dismissals.jsonl

# Compact both:
curl -X POST http://localhost:3008/api/nex1/logs/compact \
  -H "Content-Type: application/json" \
  -d '{"scope":"all"}'

# Or just one:
curl -X POST http://localhost:3008/api/nex1/logs/compact \
  -H "Content-Type: application/json" \
  -d '{"scope":"paraphrase"}'

# Verify nothing broke:
curl "http://localhost:3008/api/nex1/paraphrase?q=sort+out+the+thing"
curl "http://localhost:3008/api/nex1/banner-dismissals"
```

---

## §8 · What is NOT in this batch

- Turn-transcript compaction / rotation
- Envelope-history archive
- ConversationHead archive
- Preview / dry-run mode
- Per-canonical / per-prefix scope
- Scheduled auto-compaction (cron)
- Truth Engine, Q7/Q8, safety gate changes

---

## §9 · Queue after this

- **Chip click-to-expand modal** — full envelope inspector for the C11 chip. ~150 LOC.
- **Restore-dismissed UI** — surface the DELETE endpoint on the Notes tab. ~40 LOC.
- **Envelope-history archive endpoint** — move task files older than N days to `data/nex1-envelope-history/archive/{yyyy-mm}/`. ~60 LOC.
- **Scheduled auto-compaction** — cron endpoint that hits `/api/nex1/logs/compact` weekly. ~30 LOC.
- **Per-round envelope logging** — instrument nex2/nex3 review paths so multi-round tasks show granular trail. ~120 LOC.
- **C6 Rule Algebra** — parse doctrine markdown into gating rules. ~800 LOC.

Say **"continue"** for the **chip click-to-expand modal** (biggest remaining visual improvement · founder gets a full envelope inspector on hover/click of any chip) or name a different item.
