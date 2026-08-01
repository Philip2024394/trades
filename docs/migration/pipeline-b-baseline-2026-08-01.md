# Pipeline B · Baseline Capture · 2026-08-01

**Purpose:** irrefutable before/after evidence for the Runtime Core v1 migration. Captured BEFORE any bridge code is written. Every row is verified against actual code paths, not assumptions.

**Scope:** the 4 failing queries Philip screenshotted from the live chat UI.

**Verification method:** `detectIntent()` output produced by actually running `node --experimental-strip-types src/lib/nex/intent.ts` on 2026-08-01. Handler mappings verified against `src/app/api/nex/chat/route.ts` switch statement (lines 143-926). Retrieval calls traced to `src/lib/nex/knowledge.ts` and `src/lib/nex/intelligence/search.ts` for `case "answer"`, and `src/lib/nex/net.ts` for `case "network"`.

---

## Query 1 · "I need a staircase."

| Field | Value |
|---|---|
| Verbatim customer text | `I need a staircase.` |
| `detectIntent` result | `{ kind: "network", question: "I need a staircase." }` |
| Matching pattern | `intent.ts:149` · `/\bi\s+need\s+(a\|an)\b/` |
| Handler called | `case "network"` in `chat/route.ts:601` |
| Downstream function | `answerNetwork()` from `src/lib/nex/net.ts` |
| Data source | To be determined in Phase M1 (30-60 min investigation) |
| **Reported response** (Philip 2026-08-01) | "manufacturing joints" |
| Expected behavior after migration | Begin buying conversation (route to staircase gateway article) |

---

## Query 2 · "What wood should I choose?"

| Field | Value |
|---|---|
| Verbatim customer text | `What wood should I choose?` |
| `detectIntent` result | `{ kind: "answer", topic: "what wood should i choose?" }` |
| Matching pattern | `intent.ts:453` · question-fallback `/^(what\|how\|why\|when\|is\|does\|do\|are\|can\|which\|who\|where)\b/` OR `/\?$/` |
| Handler called | `case "answer"` in `chat/route.ts:199` |
| Downstream function | `retrieveKnowledge(topic, 3)` from `src/lib/nex/knowledge.ts` → `hybridSearch()` from `src/lib/nex/intelligence/search.ts:22` |
| Data source | Supabase table `hammerex_nex_knowledge_entries` (published rows) · tsvector full-text search + graph expansion |
| **Reported response** (Philip 2026-08-01) | "live knot / dead knot" |
| Expected behavior after migration | Recommend suitable staircase timbers |

---

## Query 3 · "How much does a staircase cost?"

| Field | Value |
|---|---|
| Verbatim customer text | `How much does a staircase cost?` |
| `detectIntent` result | `{ kind: "answer", topic: "how much does a staircase cost?" }` |
| Matching pattern | `intent.ts:453` · question-fallback (starts with "how") |
| Handler called | `case "answer"` in `chat/route.ts:199` |
| Downstream function | `retrieveKnowledge(topic, 3)` → `hybridSearch()` |
| Data source | Supabase table `hammerex_nex_knowledge_entries` |
| **Reported response** (Philip 2026-08-01) | "manufacturing information" |
| Expected behavior after migration | Explain factors that affect price · or honestly state pricing cannot yet be estimated |
| Note | Query intent is truly `Quote`/`Pricing` but Pipeline B classifier collapses all question-shaped queries into `answer`. Runtime Core v1's Router correctly classifies as `intent=Quote · domain=Pricing · info=Pricing`. |

---

## Query 4 · "Can I have glass balustrades?"

| Field | Value |
|---|---|
| Verbatim customer text | `Can I have glass balustrades?` |
| `detectIntent` result | `{ kind: "answer", topic: "can i have glass balustrades?" }` |
| Matching pattern | `intent.ts:453` · question-fallback (starts with "can") |
| Handler called | `case "answer"` in `chat/route.ts:199` |
| Downstream function | `retrieveKnowledge(topic, 3)` → `hybridSearch()` |
| Data source | Supabase table `hammerex_nex_knowledge_entries` |
| **Reported response** (Philip 2026-08-01) | "baserail definition" |
| Expected behavior after migration | Answer the glass-balustrade question first |
| Note | Runtime Core v1's Router correctly classifies as `intent=Advise · subject=Glass balustrade · domain=Customer FAQ · info=Best Practice`. Currently no Runtime Core strategy claims this info-type (see Defect A in earlier diagnosis). |

---

## Summary · handler distribution

| Handler | Queries | Notes |
|---|---|---|
| `case "answer"` (hybridSearch on Postgres) | 3 of 4 (queries 2 · 3 · 4) | Bridge scope in Phase M3 |
| `case "network"` (`answerNetwork`) | 1 of 4 (query 1) | Investigate in Phase M1 · possible extension in Phase M4 |

## What THIS baseline does NOT capture

- The verbatim `speak` string returned by the API — only Philip's shorthand summary of the response type (e.g. "manufacturing joints"). To capture verbatim strings would require calling the live API with authenticated merchant sessions. If needed later, add screenshots/response captures to this document.
- The specific Postgres rows returned by `hybridSearch` for each query — requires DB access. Deferred until Phase M1 or M3 needs it.
- Timing / latency — not part of the failure signal.

## Post-migration validation rule

After the bridge is wired (Phase M3), re-run the 4 queries and record the new response type/handler. For migration to be considered successful:

- Query 1: should route through bridge if M1 confirms `network` scope, otherwise stays on Pipeline B path (accepted as future ticket)
- Queries 2 · 3 · 4: should return Runtime Core v1 answers when its plan.status === 'ok', fall through to Pipeline B hybridSearch when plan.status !== 'ok'
- ALL non-staircase Pipeline B intents (business_intel · project_intel · customer_intel · financial_intel · md_intel · supply_chain · project_manager · vision · network · autonomy · construction_cloud · marketplace · experience · orchestrate · world · global · business_ops · digital_twin · bos · memory · social_post · research · teach · approve_all · what_changed · invoke_studio · edit_brand · open_page): behavior IDENTICAL before/after (success criterion from Philip 2026-08-01)
