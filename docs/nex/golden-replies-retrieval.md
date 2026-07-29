# NEX Golden Reply Retrieval — Operations

> Patch A infrastructure (2026-07-29): server-side stage classification, embedding-based retrieval from `docs/nex/golden-replies.md`, few-shot injection into the composer prompt, telemetry to `hammerex_nex_events`.
>
> See:
> - `docs/nex/golden-replies.md` — the human-approved library (57 entries)
> - `docs/nex/conversation-character-layer.md` — Principles 0006–0013 (the *why*)
> - `docs/nex/conversation-intelligence-library.md` — intent classifier spec (the *what*)

---

## The pipeline

```
User turn
   │
   ▼
Client classifyIntent()   ─►  social intent? ─► short-circuit reply (no API)
   │
   ▼   (technical intent — go to server)
POST /api/nex/staircase-chat
   │  { message, history, conversation_id, intent, recent_ids }
   ▼
classifyStage()                  → { stage }
intentToFamily()                 → { intent_family }
retrieveGoldenReplies()          → top-3 examples (cosine + intent + stage bonuses, minus recent_ids)
serialiseGoldenExamples()        → few-shot block
composeStaircaseAnswer(...)      → LLM with enriched system prompt
logNexChatReply(...)             → hammerex_nex_events row
   │
   ▼
Response: { answer, ..., conversation_id, stage, retrieved_ids }
   │
   ▼
Client updates recentGoldenIdsRef (last 6 IDs, LRU)
```

---

## First-time setup

Retrieval degrades to `[]` (base composer voice, no regressions) until the embeddings file exists. To populate:

```bash
export OPENAI_API_KEY=sk-...
npm run nex:embed-golden
```

Runs `scripts/embed-golden-replies.mjs`:
- Parses `docs/nex/golden-replies.md`
- Calls OpenAI `text-embedding-3-small` for each entry's `User:` field (1536 dims)
- Writes `data/nex/golden-replies.embeddings.json`
- Cost: ~57 embeddings × ~40 tokens each ≈ negligible (well under $0.01)

**Dry-run first** to verify the parser catches all 57 entries without spending API credit:

```bash
npm run nex:embed-golden:dry
```

Expected output tail: `Parsed 57 entries from docs/nex/golden-replies.md` followed by an `A-01 · social · opening · Pure greeting` style table.

**Commit the generated JSON.** The retriever loads it at boot with no runtime index rebuild.

---

## Re-running after library edits

Any time `docs/nex/golden-replies.md` changes (new entry, edited reply, changed section), re-run `npm run nex:embed-golden` and commit the JSON in the same PR. The retriever caches `LIBRARY` at module init — on Next.js, this means the change picks up on the next server restart / deploy.

Rule: **never edit `data/nex/golden-replies.embeddings.json` by hand.** It's a build artefact.

---

## Ranking formula

```
score = cosine_similarity(user_message, entry.input)
        + 0.15 if entry.intent_family === user_intent_family
        + 0.05 if entry.stage         === user_stage
```

Cosine dominates (typical range 0.2–0.9). The bonuses act as tie-breakers, not overrides — so a semantically correct entry from a different family can still win if the classifier misfires.

**Recency exclusion:** `recent_ids` (last 6 IDs from client) are filtered out BEFORE scoring, so the same 3 examples don't repeat across a long price discussion.

## Threshold gate (Patch A.1)

Even after ranking, if the top match's **raw cosine similarity** (before intent/stage bonuses) is below `MIN_COSINE_THRESHOLD = 0.40`, the retriever returns **no examples** rather than injecting weak matches. Poor examples poison the LLM's imitation — the base voice is better than mimicking an irrelevant Golden Reply.

Threshold bands as calibration guide:

| Raw cosine | Interpretation | Action |
|---|---|---|
| ≥ 0.60 | clearly on-topic | inject top 3 |
| 0.40 – 0.60 | same domain, imperfect | inject with intent/stage bonuses |
| < 0.40 | clearly off-topic | **gate — inject nothing** |

The threshold applies to raw cosine so intent/stage bonuses can't push a semantically weak match past the gate.

**Tuning:** the Patch B eval harness logs `top_cosine` per turn. If the p95 of "should have injected but didn't" cases sits below 0.40, lower it. If false-positive injections are the problem, raise it. Never guess — measure.

---

## Telemetry

Each turn writes one `hammerex_nex_events` row:

```
event_type:  "nex_chat_reply"
entity_type: "nex_conversation"
entity_id:   <conversation_id>
metadata: {
  brain_slug, intent, intent_matched, intent_family,
  stage, retrieved_ids, user_message_length,
  response_length, had_greeting,
  top_cosine,           // raw cosine of best candidate (before bonuses)
  retrieval_gated       // true when threshold caused no injection
}
```

Useful queries:
- **Retrieval hit distribution** — `SELECT metadata->'retrieved_ids' FROM hammerex_nex_events WHERE event_type = 'nex_chat_reply'` → which entries are pulled most / never.
- **Stage distribution** — `SELECT metadata->>'stage', count(*) FROM hammerex_nex_events WHERE event_type = 'nex_chat_reply' GROUP BY 1`
- **Fallthrough rate** — `SELECT count(*) FILTER (WHERE metadata->>'intent_matched' = 'false')::float / count(*) FROM hammerex_nex_events WHERE event_type = 'nex_chat_reply'`
- **Response length by stage** — helps spot cases where the model is over-answering.
- **Gate rate** — `SELECT count(*) FILTER (WHERE (metadata->>'retrieval_gated')::boolean)::float / count(*) FROM hammerex_nex_events WHERE event_type = 'nex_chat_reply'` → fraction of turns where the threshold blocked injection. Baseline for Patch B tuning.
- **Cosine distribution** — `SELECT width_bucket((metadata->>'top_cosine')::float, 0, 1, 10) AS bucket, count(*) FROM hammerex_nex_events WHERE event_type = 'nex_chat_reply' GROUP BY 1 ORDER BY 1` → histogram of top-match strength. Tells us where 0.40 sits in real usage.

Telemetry failure is silent by design — a DB hiccup never blocks a user reply.

---

## Feature-flag safety

- `NEX_BRAIN_RUNTIME_ENABLED=1` gates the whole endpoint (unchanged).
- `OPENAI_API_KEY` missing → retrieval returns `[]`, no few-shots, composer runs as before.
- `data/nex/golden-replies.embeddings.json` missing → same graceful degradation.
- `conversation_id` missing → server mints a UUID and echoes it back.
- `intent` missing → treated as `general` (no bonus in ranking, still retrieves by cosine).
- `recent_ids` missing → no exclusion, still works.

**No path where Patch A breaks the existing chat.**

---

## What's next (Patch B — deferred)

- **200-question evaluation harness** — run diverse turns through the API, score each reply with the 7 gates from `golden-replies.md`, publish before/after delta.
- **Retrieval diagnostics UI** — show the retrieved IDs alongside each reply in dev mode.
- **Missing-entry detector** — flag turns where cosine top-1 < 0.5 (suggests the library has a gap; queue for human review before adding a new entry per ADR-0041).
- **had_greeting telemetry hook** — client passes the classifier's `hasGreeting` flag through so we can measure how often mixed-message replies actually acknowledge the greeting.
