---
authored_by: Philip O'Farrell (pipeline directive) · Master AI Engineer (pipeline architecture)
authored_role: Founder directive + Master AI Engineer runtime design
captured_at: 2026-08-03
capture_medium: written contribution (evening redirect)
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · Phase D.5 · SUPERSEDES rushing to Domain 003
document_version: 1.0
document_type: MEGA_DOCTRINE · governs the complete pipeline that composes ALL runtime libraries
composes_with:
  - src/lib/nex/identity/ (Phase C · classifier)
  - src/lib/nex/universal-intent/ (Phase B · 10-verb Router)
  - src/lib/nex/knowledge-layer/ (Phase B.5 · retrieval)
  - Foundation Brain 15 (End With Value)
  - Coverage / Health / Dashboard doctrine + 5-Metric Model
---

# NEX End-to-End Pipeline · The Complete User Journey

## The Directive

Philip 2026-08-03: *"I would avoid adding Domain 003 immediately. Instead, I'd focus on proving the complete user journey from end to end. If this entire pipeline works smoothly, you'll have validated not just the architecture, but the complete operating model."*

**This doctrine is Phase D.5** — inserted between Phase C (Identity + Goal UI) and Phase D (Industry Packs). It proves the platform end-to-end before more surface area is added.

## The 11-Stage Pipeline

Every user request flows through this pipeline in order. Each stage is independently testable · independently measurable · independently swappable.

```
1. User opens Nex          → session starts · workspace loads (if returning)
2. Identity recognised     → classifyIdentity() → { register, confidence }
3. Goal selected           → GoalLayer card click OR inferred from first message
4. Intent classified       → classifyUniversalIntent() → { verb, domain, capability }
5. Knowledge retrieved     → retrieve({ domain, query, filters }) → items + sources
6. Coverage checked        → domain.knowledge.yaml maturity_level + coverage_by_sub_area
7. Confidence calculated   → per-layer confidence composited into overall response confidence
8. Response assembled      → items composed into user-facing text via Foundation Brains
9. Sources attached        → related_assets + retrieved item sources cited in response
10. Learning captured      → if approved · append to data/nex-learning-log.jsonl
11. Dashboard updated      → next dashboard refresh reflects this interaction
```

## Why Each Stage Exists

- **Stages 1-3** are the ENTRY — who is asking · what they want · what surface they came in via.
- **Stages 4-5** are the ROUTING — what universal action + which domain knowledge to consult.
- **Stages 6-7** are the QUALITY GATE — do we have enough knowledge + confidence to answer, or must we ask a clarifying question (Brain 14)?
- **Stages 8-9** are the RESPONSE — turning retrieved knowledge into a user-facing answer with cited evidence.
- **Stages 10-11** are the LEARNING LOOP — every interaction improves future interactions (Refinement #7).

## The Router Trace (per-request)

Every pipeline run produces a machine-readable Router Trace showing every stage's inputs, outputs, and confidence. The Trace is:

- Returned in the API response for debugging (dev mode).
- Logged to telemetry for aggregation into the Knowledge Dashboard.
- Available to the user on request ("why did Nex recommend this?") — Evidence Quality metric.
- Used by future Learning Loops (Phase F.5) to identify patterns.

Example trace:

```
TRACE for query "how do I choose a kitchen worktop?"
──────────────────────────────────────────────────────────────
1. Session          | session_id: abc123 · new_visitor
2. Identity         | register: homeowner_informed · confidence: 0.82
3. Goal             | inferred from intent: home_property
4. Intent           | verb: Decide · domain: kitchen · capability: Recommend · confidence: 0.94
5. Knowledge        | 5 items retrieved · sources: [nex-knowledge/kitchen/faqs.jsonl · articles/kitchen-worktop-types.md] · confidence: 0.87
6. Coverage         | kitchen domain = silver · worktops sub-area coverage = 92%
7. Confidence       | intent 0.94 · domain 0.99 · knowledge 0.87 · overall 0.91
8. Response         | assembled via Foundation Brains 5+6+9+15 · 4 items cited
9. Sources          | 3 FAQ links + 1 article link attached
10. Learning        | captured to learning-log · session_id + trace_hash
11. Dashboard       | metrics incremented (retrieval_confidence + coverage_query)
──────────────────────────────────────────────────────────────
NEXT STEP OFFERED: "Want me to compare quartz vs porcelain for your specific budget?"
```

## The Confidence Composition Formula

Overall response confidence combines all layers:

```
overall = min(
  identity.confidence,
  intent.confidence,
  knowledge.overall_confidence
) * coverage_multiplier

where coverage_multiplier =
  1.0  if domain maturity ≥ silver
  0.85 if bronze
  0.6  if pending (soft caveat)
```

If `overall < 0.7`, Brain 14 (Never-Guess) fires:
- Nex does NOT respond with an answer.
- Nex asks ONE targeted clarifying question.
- The response includes `needs_clarification: true` and the specific missing signal.

## The Response Assembly Contract (Stage 8)

For MVP (Phase D.5), response assembly is template-based composition:

1. **Opening** (Brain 1 · General Chat) — natural greeting or acknowledgement.
2. **Recommendation body** (Brain 6 · Recommendations) — one clear recommendation + reason + trade-off + alternative.
3. **Translation** (Brain 5 · Explaining Technical) — jargon rendered in the user's register (Brain 13).
4. **Image insertion** (Brain 12 · Show-Don't-Tell) — if a >0.85 A+ image match exists.
5. **Sources** — cited item IDs surfaced inline.
6. **Next step** (Brain 15 · End With Value) — specific offered action.

The composition ORDER is deterministic. The CONTENT is drawn from retrieved knowledge items. **No fabrication** — every claim traces back to a retrieved item or a Rule c source (composes with Brain 14 · Never-Guess).

Post-MVP (Phase E onwards), an LLM will assemble responses using the same 6-step template but with richer language generation.

## The Learning Capture Contract (Stage 10)

Every pipeline run appends a row to `data/nex-learning-log.jsonl`:

```json
{
  "timestamp": "2026-08-04T09:12:34Z",
  "session_id": "abc123",
  "trace_hash": "sha256(trace)",
  "input": "how do I choose a kitchen worktop?",
  "identity_register": "homeowner_informed",
  "identity_confidence": 0.82,
  "intent_verb": "Decide",
  "intent_domain": "kitchen",
  "intent_capability": "Recommend",
  "intent_confidence": 0.94,
  "knowledge_items_retrieved": 5,
  "knowledge_sources": ["nex-knowledge/kitchen/faqs.jsonl", "kitchen/articles/kitchen-worktop-types.md"],
  "knowledge_confidence": 0.87,
  "coverage_maturity": "silver",
  "overall_confidence": 0.91,
  "needs_clarification": false,
  "response_length_chars": 512,
  "user_success_signal": null,     // populated later when workspace persistence lands
  "was_useful_feedback": null      // populated when user thumb-ups / follows next step
}
```

The learning log is the raw material for:
- Coverage Score refinement (which queries fail?).
- Retrieval Accuracy measurement (does the top item align with what worked?).
- Answer Quality auditing (sampled responses reviewed).
- Evidence Quality auditing (are the sources authoritative?).
- User Success tracking (Phase F telemetry).

## The Dashboard Update Contract (Stage 11)

The Knowledge Dashboard reads the learning log on refresh and computes:

- **Rolling 7-day counts** — FAQs added · articles added · queries served · queries clarified · queries zero-result.
- **Confidence distribution** — histogram of overall_confidence across last 100 queries.
- **Domain query heat map** — which domains are hit most often · which sub-areas have low coverage vs high query volume (authoring priority signal).
- **Register distribution** — which user registers are engaging (drives Foundation Brain 13 training focus).
- **Clarification rate** — what % of queries trigger Brain 14 · trending down = system improving.

## The MVP Scope for Phase D.5

**Ship:**
- Pipeline orchestrator library (`src/lib/nex/pipeline/`) composing identity + universal-intent + knowledge-layer.
- Simple template-based response assembler.
- Learning capture (append-only JSONL).
- API endpoint `POST /api/nex/converse`.
- Router Trace returned in every response.
- Tests validating a full end-to-end query works.

**Defer:**
- LLM-based response assembly (Phase E).
- Real-time dashboard rendering (Phase F).
- User success telemetry (Phase F).
- Learning loop that actually IMPROVES future responses (Phase F.5).
- Multi-domain retrieval per query (Phase E).

## Success Criteria for Phase D.5

*A single POST to `/api/nex/converse` with a real user question produces:*

- ✓ A response text that answers the question OR asks a targeted clarification.
- ✓ A full Router Trace showing every stage's decisions.
- ✓ Cited sources for every factual claim.
- ✓ A learning-log row appended.
- ✓ A confidence score honestly reflecting the pipeline's certainty.
- ✓ Zero fabricated content (all claims trace to retrieved items).
- ✓ A next-step offer (Brain 15).

*The pipeline works for at least ONE Kitchen query AND ONE Staircase query — proving cross-domain composition.*

## Composition Summary

```
[User input]
    ↓
[POST /api/nex/converse]
    ↓
pipeline.converse(input, session_id)
    ↓
├─ classifyIdentity()          [Phase C]
├─ classifyUniversalIntent()   [Phase B]
├─ retrieve(domain, query)     [Phase B.5]
├─ checkCoverage(domain)       [Phase B.5 · knowledge.yaml]
├─ computeConfidence()         [this phase]
├─ assembleResponse()          [this phase · template MVP]
├─ attachSources()             [this phase]
├─ captureLearning()           [this phase · append to log]
└─ updateDashboardSignals()    [this phase · async no-op MVP]
    ↓
[Response + Trace + Sources]
```

## What This Proves

Philip's watchpoints operationalised:

- **Layer independence** — every stage calls a narrow API from an existing library · zero coupling.
- **New domain validation** — the same pipeline serves Kitchen AND Staircase without special-casing.
- **Classifier telemetry** — every query logs to `nex-learning-log.jsonl` for future analysis.
- **Contract versioning** — pipeline declares `pipeline_version: 1.0` · schema versioned per response.

## Enhancement Opportunity

Every AI competitor's "pipeline" is opaque model inference. Nex's pipeline is 11 distinct, inspectable, testable stages — each one a swappable module. When something goes wrong, we know exactly which stage failed. When something goes right, we can measure why. **That inspectability IS the operating system.** No competitor can debug their own responses this cleanly. That is untouchable operational maturity.
