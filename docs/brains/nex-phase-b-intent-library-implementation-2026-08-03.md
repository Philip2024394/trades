---
authored_by: Master AI Engineer
authored_role: Phase B implementation status + wire-up guide
captured_at: 2026-08-03
capture_medium: implementation notes
governance:
  rule_a_anti_fabrication: pass · runtime shipped and tested
  rule_b_no_ai_authored:   pass on runtime; authored notes attributed
  rule_c_attributable_origin: pass · Master AI Engineer 2026-08-03
architecture_layer: L2_ROUTING · Phase B implementation
document_version: 1.0
document_type: IMPLEMENTATION_STATUS
composes_with:
  - docs/brains/nex-master-intent-library-v1-philip-2026-08-03.md (doctrine)
  - src/lib/nex/intent-router.ts (existing kind-classifier · unchanged)
  - src/lib/nex/universal-intent/ (new verb-classifier · added Phase B)
---

# Phase B · Master Intent Library Implementation Status

## What Shipped

**Data:**
- `data/nex-intent-phrasings.jsonl` — 164 seed phrasings covering all 10 universal verbs, mapped Layer 1 → Layer 2 → Layer 3 (Philip 2026-08-03 authored). Append-only.

**Library (`src/lib/nex/universal-intent/`):**
- `types.ts` — `UniversalVerb` union · `IntentRoute` · `IntentClassification` · `PhrasingRow`
- `phrasings.ts` — server-side JSONL loader with in-memory cache + `appendPhrasing()` writer
- `classify.ts` — token-Jaccard + verb-keyword fallback classifier · never throws · always returns
- `index.ts` — public exports
- `classify.test.ts` — 9 tests · all passing

**API:**
- `POST /api/nex/universal-intent` — `{ input: string }` → `{ layer1_verb, layer2_domain, layer3_capability, confidence, matched_phrasing, reason, needs_clarification }`
- `needs_clarification: true` when confidence <0.7 · caller MUST ask (Brain 14 · Never-Guess)

## Test Results

```
✓ 'build me a website' → Create/Website (high confidence)
✓ 'oak or pine' → Decide/Staircase
✓ 'teach me marketing' → Learn/Marketing
✓ 'remind me tomorrow' → Monitor/Personal
✓ 'grow my business' → Improve/Business
✓ 'automate my marketing' → Automate/Marketing
✓ 'xyz qwerty foobar' → low confidence (correctly flagged)
✓ empty input → confidence 0 (safe)
✓ novel phrasing 'create a monthly newsletter' → Create (keyword fallback works)
```

## Composition With Existing Router

The existing `src/lib/nex/intent-router.ts` picks a `kind` (navigation · database · brain · ai · messenger). The new `src/lib/nex/universal-intent/` picks a `verb` (Create · Communicate · Decide · Plan · Manage · Automate · Analyse · Learn · Improve · Monitor). **These are orthogonal.** A single user input gets classified twice:

```
User input → [intent-router.classifyIntent] → { kind, target, confidence }
                                                                    ↓
              [universal-intent.classifyUniversalIntent] → { verb, domain, capability, confidence }
                                                                    ↓
                            Router combines both to pick the specialist brain + capability handler
```

Example: *"create a facebook cover for my sale"*
- `kind = "brain"`, `target = "general"` (from existing router)
- `verb = "Create"`, `domain = "Marketing"`, `capability = "Design"` (from new layer)
- **Combined route:** load AI Designer specialist (from capability) with Marketing pack context (from domain)

## How to Wire Into the Chat Surface

Follow-up step (not shipped in Phase B):

**In `src/app/nex-app/chat/page.tsx` (or wherever user messages are handled):**

```typescript
import { classifyUniversalIntent } from "@/lib/nex/universal-intent";

async function handleUserMessage(text: string) {
  const verb = classifyUniversalIntent(text); // client-safe? currently server-only due to fs
  // OR call the API endpoint:
  const res = await fetch("/api/nex/universal-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: text }),
  });
  const verb = await res.json();

  if (verb.needs_clarification) {
    // Brain 14 · Never-Guess — don't proceed, ask a clarifying question first
    return askClarifyingQuestion(text);
  }

  // Route to the correct specialist brain + capability handler
  return route(verb.layer1_verb, verb.layer2_domain, verb.layer3_capability);
}
```

## Client-Safe Variant (future)

Current classifier uses `fs.readFileSync` (server-only). For client-side use (browser routing before API call), a follow-up should:

1. Ship the corpus as a static import at build time (`import phrasings from "@/data/nex-intent-phrasings.json"`), OR
2. Fetch `/api/nex/universal-intent/corpus` on session start and cache in localStorage.

## Corpus Growth Strategy

The 164 seed phrasings are the START, not the END:

- **Unmatched queries** (confidence <0.7) should be logged to `data/nex-router-unmatched.jsonl` for Philip review.
- Philip-approved unmatched → append to `data/nex-intent-phrasings.jsonl` via `appendPhrasing()`.
- Target: 1,000 phrasings by end of month · 10,000 by end of quarter · scale to 100k+ over time (composes with the Learning Queue in `nex-supabase-master-data-architecture-v1.md`).

## Success Metric (from doctrine)

*95% of natural user phrasings route correctly to Layer 1 + Layer 2 + Layer 3 without asking a clarifying question. The remaining 5% ask ONE targeted clarification and route on the second try.*

Current baseline: 9/9 test cases pass. Real-world telemetry after wire-up will show the true rate.

## What Phase B DID NOT Ship

- Wire-up into the chat page (follow-up task)
- Client-safe corpus loading (follow-up task)
- Unmatched-query logging endpoint (follow-up task)
- Corpus-growth admin UI for Philip (Phase F candidate)
- LLM-assisted classifier for novel phrasings (Phase E candidate)

These are intentional deferrals — Phase B ships the foundation runtime, the wire-up is a separate concern that composes with Phase C (Identity + Goal Layer UI).

## Next Recommended Phase

**Phase C · User Identity Brain + Goal Layer UI** — the chat surface change that consumes the Universal Intent Router. Landing screen becomes *"What are you trying to achieve today?"* + 7 goal cards. Identity classifier writes to Workspace so Brain 13 (Match User Knowledge) has classification data to consume.
