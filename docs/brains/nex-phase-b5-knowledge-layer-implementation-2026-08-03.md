---
authored_by: Master AI Engineer
authored_role: Phase B.5 implementation status + wire-up guide
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass · runtime shipped + tested
  rule_b_no_ai_authored:   pass on runtime; authored notes attributed
  rule_c_attributable_origin: pass · Master AI Engineer 2026-08-03
architecture_layer: L2 · Phase B.5 implementation
document_version: 1.0
document_type: IMPLEMENTATION_STATUS
composes_with:
  - docs/brains/nex-knowledge-layer-extraction-philip-2026-08-03.md (doctrine)
  - docs/brains/nex-domain-template-philip-2026-08-03.md (with Maturity Levels refinement)
---

# Phase B.5 · Knowledge Layer Extraction — Implementation Status

## Redirect Origin

Philip 2026-08-03 evening: *"I would prioritise Phase B.5. The reason is architectural rather than domain-specific. If the Knowledge Layer becomes the stable abstraction first, then every subsequent domain — including Kitchens — can be authored against that finalized contract."*

Phase C (Identity + Goal Layer UI) was PAUSED after this redirect. Phase B.5 ships first; Phase C resumes with the Knowledge Layer contract already stable.

## What Shipped

**Doctrine:**
- `docs/brains/nex-knowledge-layer-extraction-philip-2026-08-03.md` — the full extraction doctrine + directory structure + retrieval contract + migration plan
- Refinement added to `docs/brains/nex-domain-template-philip-2026-08-03.md` — Bronze/Silver/Gold maturity levels

**Runtime library (`src/lib/nex/knowledge-layer/`):**
- `types.ts` — `KnowledgeItem` · `RetrieveRequest` · `RetrieveResult` · `MaturityLevel` · `KnowledgeYamlDeclaration`
- `retrieve.ts` — narrow retrieval interface with legacy fallback (loads from `knowledge/{domain}.json` + `data/nex-image-manifest.json` when `data/nex-knowledge/{domain}/` doesn't exist yet)
- `index.ts` — public exports
- `retrieve.test.ts` — 7 tests, all passing

**Placement note:** the new library lives at `src/lib/nex/knowledge-layer/` (with hyphen), NOT `src/lib/nex/knowledge/`, because the latter contains a pre-existing legacy retrieval implementation over `knowledge_master.json`. The two coexist; new code uses `knowledge-layer/`, old code continues to work.

## The Retrieval Contract (Brain-facing API)

```typescript
import { retrieve } from "@/lib/nex/knowledge-layer";

const result = retrieve({
  domain: "staircase",
  query: "how do I panel my staircase wall?",
  filters: {
    tags: ["panelling"],
    audience_level: 2,
    a_plus_only: false,
  },
  limit: 5,
  min_relevance: 0.1,
  min_confidence: 0.7,
});

// result = {
//   items: [ { type: "faq" | "image", id, relevance, summary, content, ... } ],
//   overall_confidence: 0.34,
//   sources: ["knowledge/staircase.json", "nex-image-manifest.json"],
//   domain: "staircase",
//   needs_clarification: true,          // <0.7 → caller must ask (Brain 14)
//   trace_reason: "retrieval confidence 0.34 below threshold 0.70 · ..."
// }
```

## Retrieval Algorithm

- **Question-weighted Jaccard** — FAQ scoring is 75% question tokens + 25% answer tokens. Question form matches user query form more than answer body.
- **Tag intersection filter** — filters apply BEFORE ranking so tag-scoped queries stay fast.
- **A+ filter** — `a_plus_only: true` restricts to human-verified rich-metadata items.
- **Audience-level filter** — respects the customer's expertise register (composes with Brain 13).
- **item_types filter** — restrict to `["faq"]` · `["image"]` · combinations.
- **Overall confidence** — mean of top-3 relevance scores.
- **needs_clarification** — set true when overall confidence < `min_confidence` (default 0.7). Composes with Brain 14 (Never-Guess) — the caller MUST ask a clarifying question rather than proceeding.
- **trace_reason** — human-readable string for the Router Trace (Architecture v2 refinement #10).

## Legacy Fallback Behaviour

If `data/nex-knowledge/{domain}/faqs.jsonl` exists → load from there (modern path).
Else if `knowledge/{domain}.json` exists → load from there (legacy path).
Else → return empty.

This means **the Staircase domain works TODAY without any migration**. When Task #91 (Staircase migration) runs, the retrieve function transparently switches to the modern path.

## Test Results

```
✓ returns FAQ results for a staircase query (legacy fallback)  · items > 0 · sources > 0
✓ filters by a_plus_only                                        · every returned image is a_plus
✓ returns needs_clarification=true for a query with no matches  · confidence 0
✓ returns empty result for a domain that doesn't exist          · items 0
✓ handles empty query safely                                    · trace_reason contains "empty"
✓ respects item_types filter                                    · only FAQs returned
✓ populates trace_reason for Router Trace                       · trace_reason > 10 chars

7/7 passing · 490ms
```

## How Brains Consume the Knowledge Layer

Every future Brain follows this pattern (illustrative — not yet wired into existing Brains):

```typescript
// Inside a Brain's response handler:
import { retrieve } from "@/lib/nex/knowledge-layer";
import { classifyUniversalIntent } from "@/lib/nex/universal-intent";

async function respondToUser(userInput: string, userRegister: "homeowner" | "builder" | ...) {
  const intent = classifyUniversalIntent(userInput);
  if (intent.needs_clarification) return askClarifying(userInput);

  const knowledge = retrieve({
    domain: intent.layer2_domain.toLowerCase(),  // e.g. "staircase"
    query: userInput,
    filters: { audience_level: userRegister === "homeowner" ? 2 : 3 },
    min_confidence: 0.7,
  });

  if (knowledge.needs_clarification) return askClarifying(userInput);

  // Brain composes response using retrieved items · foundation brain rules apply
  return composeResponse(knowledge, intent, userRegister);
}
```

## The Domain Template + Maturity Levels

Updated in `docs/brains/nex-domain-template-philip-2026-08-03.md`:

- **Bronze** — Minimum viable · router-eligible with soft caveat · 20 FAQs · 5 A+ images · 1 AI Specialist · 3 Router Tags · 3 Workspace Objects · 3 articles.
- **Silver** — Production ready · no caveat · 100 FAQs · 15 A+ images · 4 Specialists · all 5 Router Tags · full Workspace schemas · 10 articles · 1 calculator · 1 regulation ref · cross_domain_dependencies declared.
- **Gold** — Flagship · 500 FAQs · 50 A+ images · Specialists have production tool integrations · Router Tags refined with sub-intents · 25 articles · 3 calculators · comprehensive regs · 5 case studies · active cross-domain compositions · Learning Loops producing measurable improvements.

Current status:
- **Staircase** — Silver+ (approaching Gold) · 1980 FAQs · 26 A+ images · 30 articles · missing calculators + case studies for Gold.
- **All other 169 domains** — Not yet Bronze · awaiting authoring.

## What Phase B.5 DID NOT Ship

- **Staircase migration** — moved to Task #91 (dedicated session · substantive authoring work).
- **YAML declaration file parsing** — deferred until yaml package is added; declaration file is optional for basic retrieval.
- **Vector embedding pipeline** — Phase F.5 (after token-Jaccard proves the shape).
- **Cross-domain auto-consultation runtime** — Phase C.5 (Router composes multiple retrieve calls automatically).
- **Admin UI for authoring** — Phase F.5 (or later).
- **Wire-up into existing Brains** — Follow-up · each Brain gets refactored to use retrieve() one at a time.

## Composition Summary

```
User input
    ↓
Universal Intent classifier         (verb + domain + capability + needs_clarification)
    ↓
Identity classifier (Phase C)       (register: homeowner/builder/architect/...)
    ↓
Knowledge Layer retrieve()          (RETRIEVED items + confidence + trace_reason)
    ↓
Foundation Brain composer           (Brains 1-15 fire pipeline based on registers + retrieval)
    ↓
Action Engine (Phase F.5)           (executes based on verb + capability)
    ↓
Workspace persistence               (durable artefacts)
    ↓
Response
```

## Next Recommended Phase

**Phase C · User Identity Brain + Goal Layer UI** — resume the phase paused for this redirect. The Identity classifier + 7-goal-card landing UI is the visible surface where the Knowledge Layer contract meets users. With Phase B.5 shipped, Phase C can build against a finalized retrieval interface.
