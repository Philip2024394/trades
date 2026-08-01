---
title: NEX Runtime Pipeline v1 · Specification
version: v1
status: SPECIFICATION · not yet implemented · Router v1 is the only frozen component
spec_date: 2026-07-31
authored_by: Philip O'Farrell direction · gatekeeper Claude preservation
constitutional_alignment: Permanence Principle · Evidence-First · Reality-Over-Speculation · Standard v1 Evidence/Runtime split
---

# NEX Runtime Pipeline v1 · Specification

## Pipeline (five stages · one direction · no back-channels)

Refined by Philip 2026-07-31 · **thinking is separated from writing**. The Composer produces a structured Response Plan (never English). The Language Renderer turns approved plans into prose. The LLM (if any renderer uses one) is never part of the decision-making pipeline.

```
User Question
        │
        ▼
Router v1  ────────────  Classification (frozen · Suite v1)
        │
        ▼
Evidence Retrieval Engine  ────  What evidence matches?
        │
        ▼
Evidence Package (ephemeral)
        │
        ▼
Response Composer  ─────  DETERMINISTIC · assembles evidence into a Response Plan
        │
        ▼
Response Plan (ephemeral · structured JSON)
        │
        ▼
Quality Gate  ─────────  Is this Plan fit to render?
        │
        ▼
Language Renderer  ─────  Turns approved Response Plan into prose (swappable · templates or LLM)
        │
        ▼
Customer Response
```

## Responsibilities (single-responsibility · no overlap)

| Stage | Decides | Does NOT decide |
|---|---|---|
| **Router v1** | What the user is asking | What evidence exists · what to present · what to say |
| **Retrieval Engine** | What evidence matches the classification | Whether the evidence is enough · how to present it · what to say |
| **Composer** | How to arrange evidence into a **Response Plan** (structured) | What evidence to fetch · what English to produce · whether to render |
| **Quality Gate** | Whether the Response Plan is fit to render | What the plan should contain · what English to produce |
| **Language Renderer** | How the approved plan reads in prose | Anything in the plan (may not alter, add, or remove content) |

Any change proposal that crosses one of these boundaries requires an explicit constitutional justification.

## Architectural rule · LLMs are renderers, never deciders (Philip 2026-07-31)

**The LLM is never part of the decision-making pipeline. It is only one possible rendering engine.**

By the time anything reaches a language model:

- The Router has already decided what the user is asking (frozen Suite contract)
- The Retrieval Engine has already decided what evidence matches
- The Composer has already decided which evidence leads, what supports, which images accompany, whether clarification is needed
- The Quality Gate has already decided the Plan is fit to render

The renderer's only job is to turn approved structured content into natural language. It may never invent, add, drop, or reorder Plan content. If the renderer produces prose that misrepresents the Plan, the renderer is broken · the Plan is authoritative.

This means: swapping renderers (deterministic templates → LLM → different LLM → future engine) leaves the entire upstream pipeline untouched. Router · Retrieval · Composer · Quality Gate all stay frozen. Only the rendering step changes.

## Response Plan · design contract (locked · Philip 2026-07-31)

The Response Plan is the canonical output of the Composer and the canonical input of the Quality Gate and Renderer. It is ephemeral (rebuilt per request, discarded after rendering) — same lifecycle as the Evidence Package. It is **immutable** once produced by the Composer.

**Locked field list** (Philip 2026-07-31):

```
{
  status:              "ok" | "clarify" | "unknown",
  answer_type:         string,                  // e.g. "definition" | "pricing" | "comparison" | ...
  sections:            Section[],               // ordered content blocks, may be empty
  images:              EvidenceRef[],           // ordered image record refs, may be empty
  follow_up_questions: string[],                // ordered clarifying question keys, may be empty
  citations:           EvidenceRef[],           // every evidence ref referenced anywhere in the plan
  confidence:          "high" | "medium" | "low" | "unknown",
  quality_flags:       string[],                // reserved for Quality Gate annotations
  provenance: {                                 // internal audit metadata (Philip 2026-07-31 · expanded)
    plan_version:          string,              // e.g. "1.0" · shape version, distinct from composer version
    router_version:        string,              // e.g. "0.09" · which Router produced the classification
    provider_versions:     { [evidenceType]: string },  // e.g. { images: "1.0", knowledge: "1.0" }
    strategy:              string,              // e.g. "quote" · which strategy assembled the plan
    strategy_version:      string,              // e.g. "1.0"
    composer_version:      string,
    composed_at:           ISO-8601,
    evidence_package_hash: string
  }
}
```

**Why expanded provenance matters:** when someone reports *"Nex answered this strangely"*, the plan itself shows Router version + strategy used + provider versions + evidence sources — no guessing. Debuggability becomes structural rather than investigative.

**EvidenceRef** is a minimal pointer: `{ evidenceType: string, path_or_id: string }`. Never inline body text. The renderer reads bodies from the referenced records; the plan carries pointers only. This keeps plans small, hashable, and auditable.

**Section** is a minimal content block: `{ section_type: string, evidence_refs: EvidenceRef[], key_points: string[] }`. Section shapes are refined per-Intent in Phase 7 · Phase 6 skeleton produces `sections: []`.

## Composer · design contract (locked · Philip 2026-07-31)

The Composer is deterministic. It never asks *"What should I answer?"* — only *"Given this EvidencePackage, what Response Plan can legally be produced?"*

**Fixed input:** `EvidencePackage` + `RouterDecision` + `RequestContext` (optional session/user context).
**Fixed output:** a syntactically valid `Response Plan` (structure defined above).

Hard rules:

1. **Never invent** — every EvidenceRef in the Plan must point to a record present in the incoming Package
2. **Never write prose** — the Plan is structured JSON; the only string fields are `follow_up_questions` and `key_points` inside sections (these are structured hints for the Renderer, not sentences to the customer)
3. **Prefer clarify or unknown to guessing** — if confidence is low or evidence is empty, produce `status: "clarify"` (with follow_up_questions) or `status: "unknown"` (with a truthful gap statement) · never fake `status: "ok"`
4. **Immutability** — the Plan returned by `compose()` is frozen. No downstream component may mutate it. If a downstream component needs different content, the Composer must be re-invoked.
5. **Composition strategy varies by Intent** (Show · Learn · Compare · Buy · Quote · Install · Troubleshoot · Advise · Identify · Browse) but never varies from rules 1-4

## Quality Gate · design contract (locked · Philip 2026-07-31)

The Quality Gate operates on the Response Plan, never on prose. It is a **validator, not an editor** — it never rewrites the Plan.

**Fixed input:** an immutable `Response Plan` + the source `EvidencePackage`.
**Fixed output:** exactly one of three outcomes, each with an explicit reason list:

```
{ outcome: "PASS",    reasons: [] }
{ outcome: "FAIL",    reasons: [ "No supporting evidence.", ... ] }
{ outcome: "CLARIFY", reasons: [ "Multiple staircase types matched.", ... ] }
```

Five pre-render checks (any failure produces FAIL or CLARIFY · never a rewrite):

1. Does every EvidenceRef in the Plan trace to a record in the source Evidence Package?
2. Is the answer_type consistent with the Router intent and the retrieved evidence?
3. Is the confidence level truthful (not "high" when providers returned 0 matches)?
4. Would rendering this Plan produce something a master tradesperson would recommend to a peer?
5. If confidence is low, does the Plan include follow_up_questions?

FAIL means the Composer must revise (or produce a truthful `status: "unknown"` Plan). CLARIFY means the runtime should ask the follow_up_questions before continuing.

## Language Renderer · design contract (locked · Philip 2026-07-31)

The Renderer takes an approved Response Plan and produces the natural-language customer response.

**Fixed signature:** `Renderer(plan) → text` (NOT `Renderer(plan) → modified_plan`).

Hard rules:

1. **Plan is immutable** — the renderer receives a frozen Plan and may not return a modified one. If more information is needed, the renderer **fails** · it does not edit.
2. **Read-only against the Plan** — may not add, drop, reorder, or invent Plan content · may not silently remove clarification questions · may not decide "another image would be better"
3. **Read-only against the Evidence Package** — may not go beyond referenced records
4. **Swappable** — the renderer is chosen at runtime (default: deterministic templates; alternate: LLM). Swapping renderers must not require any change to Router, Retrieval, Composer, or Quality Gate.
5. **Failure mode is silence** — if a renderer cannot produce prose from a valid Plan, it declines. The system does not fall back to inventing content.

## Evidence Retrieval Engine · design contract

The Retrieval Engine is generic. Images are one evidence type among many. New evidence types are added as providers, never as new engines.

### Input (from Router v1)

```
{
  intent: "Show",
  subject: "Straight Flight Staircase",
  brain: "Staircase",
  domain: "Reference Gallery",
  information_type: "Images",
  confidence: 0.92,
  clarify: false
}
```

### Output (EvidencePackage · canonical exchange object)

The EvidencePackage is the canonical exchange object between runtime components. It is not a bag of arrays — it is a structured envelope that carries request context · evidence · diagnostics · timing · metadata. Reserving these sections now means later runtime components (Composer · Quality Gate · failure capture) can consume additional fields without any interface change.

```
{
  request: RouterDecision,           // the classification that produced this package
  evidence: {
    knowledge:          [ ... ],
    faq:                [ ... ],
    workshopPrinciples: [ ... ],
    profiles:           [ ... ],
    images:             [ ... ],
    pricing:            [ ... ],
    drawings:           [ ... ],
    videos:             [ ... ]      // future provider
  },
  diagnostics: {
    providers_queried:  [ ... ],
    providers_matched:  [ ... ],
    warnings:           [ ... ]
  },
  timing: {
    started_at:   ISO-8601,
    completed_at: ISO-8601,
    duration_ms:  number
  },
  metadata: {
    engine_version: string,
    phase:          number
  }
}
```

Phase 1 populates the structure with all evidence arrays empty. Later phases populate provider arrays without changing the envelope.

Every provider implements the same two-method interface:

```
interface EvidenceProvider {
  canHandle(request) → boolean       // provider self-declares relevance
  retrieve(request) → EvidenceRecord[]  // provider returns matching evidence
}
```

The engine holds NO routing table. It asks every registered provider `canHandle(request)`, calls `retrieve` on those that return true, and combines the results into one EvidencePackage. Adding a new evidence type never modifies the engine — it registers a new provider and the provider decides for itself when it applies.

### Providers already-authored (Day-1 candidates)

| Provider | Source location | Status |
|---|---|---|
| Knowledge articles | `data/nex-reference-brains/staircase-preparation/**/*.md` (CKO-shaped) | Authored · needs metadata index |
| Customer FAQ | `expert-notes-philip-ofarrell/staircase-instances/` FAQ files | Authored · needs metadata index |
| Workshop principles | staircase-instances directory · principle-tagged files | Authored · needs metadata index |
| Type profiles | Staircase-type-profile files | Authored · needs metadata index |
| Images | `nex-image-manifest.json` | Authored · already indexed |

### Providers deferred (add later without engine change)

- Videos · CAD drawings · CNC files · Installation videos · PDF manuals · Building regulations · Pricing evidence

## Composer · design contract

The Composer receives the Evidence Package plus the Router classification and produces a candidate response. Two hard rules:

1. **Never invent** — every claim in the response must trace to a record in the Evidence Package
2. **Refuse when confidence low** — if Router confidence is below threshold OR the Evidence Package is empty, the Composer produces a truthful gap response, not a guess

Composition strategy varies by Intent (Show · Learn · Compare · Buy · Quote · Install · Troubleshoot · Advise · Identify · Browse) but never varies from the two hard rules.

## Quality Gate · design contract

Five pre-speech questions run before any response reaches the user:

1. Does every factual claim trace to retrieved evidence?
2. Is any invented content present?
3. Is any known gap presented as certainty?
4. Is the response length proportional to the question?
5. Would a master tradesperson recommend this response to a peer?

Any "no" on 1-4 or any "no" on 5 blocks the response · the composer is asked to revise or the gap is admitted truthfully.

## What this specification does NOT include

- Implementation code (that comes next, one provider at a time)
- Retrieval ranking algorithms (locked after real evidence packages are inspected)
- Composition templates (locked after real conversations expose real needs)
- Quality Gate exact wording (locked after real responses are inspected)

The specification names the boundaries. The implementations get built inside those boundaries, tested against Validation Suite v1, and only accepted when they pass.

## Build order (measurable · testable · reversible · phased)

### Phase 1 — Retrieval Engine Skeleton
No providers. Just the contract. Given a request, returns an EvidencePackage with every provider array empty. That empty package IS the passing structural test:

```
{ knowledge: [], faq: [], profiles: [], workshopPrinciples: [],
  images: [], pricing: [], drawings: [], diagnostics: {} }
```

### Phase 2 — Image Provider
Uses existing `nex-image-manifest.json`. Implements `canHandle` + `retrieve`. First real evidence flowing through the engine. Testable against Router "Show + Images" rows in Suite v1. No knowledge · no FAQ · no composition — just prove the provider contract.

### Phase 3 — Knowledge Index Builder (separate from retrieval)
Its only job: convert authored Markdown evidence into an indexed queryable form (`knowledge-index.json`). The Retrieval Engine NEVER parses Markdown directly — it queries the index. Same discipline that already exists for images.

### Phase 4 — Knowledge Provider
Reads the index built in Phase 3. Implements the same two-method interface. Engine now has two providers running side-by-side; both receive the same request; both return evidence independently. Testable against Router "Learn + Definition" rows.

### Phase 5 — Additional Providers (each independent)
Customer FAQ Provider · Type Profile Provider · Workshop Principle Provider · Pricing Provider · Drawing Provider · Video Provider (future). No provider knows about any other provider. Each requires its own index build first (repeating Phase 3 discipline per evidence type).

### Phase 6 — Composer Skeleton (produces Response Plan)
Deterministic. Given Evidence Package + Router decision, produces a structured Response Plan. No prose. Skeleton returns minimal plans (e.g., `answer_type: "unknown"` with clarification keys) for every request. First real proof the Composer boundary works.

### Phase 7 — Composer Strategy Plug-ins (Philip 2026-07-31 · locked pattern)
NOT a switch statement inside the Composer. Each Intent gets its own file in `scripts/strategies/`:

```
scripts/strategies/
  ├── unknown.strategy.mjs        // fallback · always registered · handles zero-evidence and low-confidence
  ├── gallery.strategy.mjs        // Show · Browse Images · Reference Gallery domains
  ├── definition.strategy.mjs     // Learn + Definition
  ├── comparison.strategy.mjs     // Compare + Comparison
  ├── installation.strategy.mjs   // Install + Installation
  ├── quote.strategy.mjs          // Quote + Buy Inquiry + Pricing domain
  └── ...                          // added one at a time as evidence justifies
```

**Composer's post-refactor responsibility (locked · Philip 2026-07-31):**
Composer knows NOTHING about business logic. It is pure orchestration. Conceptually:

```
loadStrategies() → registry
strategy = registry.findFor(router.intent)
plan     = strategy.execute({ router, evidencePackage, requestContext })
frozen   = Object.freeze(plan)
return frozen
```

**If six months from now `nex-composer-v1.mjs` contains staircase logic, pricing logic, gallery logic, FAQ logic, or workshop logic — the architecture has been violated.** Composer orchestrates. Strategies decide.

**Strategy API v1 (locked · versioned architectural contract · Philip 2026-07-31):**

The interface itself is a versioned API. Every strategy declares which Strategy API version it implements. If a future capability requires interface change, create **Strategy API v2** and let existing v1 strategies continue to work unchanged. Never quietly modify v1.

```
export const strategy = {
  strategyApiVersion: "1",                      // required · which interface version
  intentName:         string,                   // required · e.g. "quote"
  strategyVersion:    string,                   // required · e.g. "1.0" · implementation version
  canHandle(routerDecision) → boolean,          // required · provider-style self-declaration
  execute({ router, evidencePackage, requestContext }) → ResponsePlan,  // required
  explain?(plan) → StrategyDiagnostic           // optional · for engineers, never customers
};
```

Registry rejects any strategy that does not declare `strategyApiVersion: "1"`.

**Nothing more.** Every future strategy — Gallery · Quote · Definition · Comparison · Installation · FAQ · Unknown — exposes exactly this surface. That is what makes them interchangeable.

**Optional `explain(plan)` returns engineer-facing diagnostics** — never customer-facing prose. Example return shape:

```
{
  matched_intent:      "Quote",
  evidence_selected:   [ EvidenceRef, EvidenceRef ],
  evidence_rejected:   [ EvidenceRef, ... ],
  rejection_reasons:   { "images": "No image request detected", ... },
  strategy_version:    "1.0",
  decision_path:       [ "confidence>=0.7", "pricing-evidence-present", "no-images-requested" ]
}
```

When a Validation Suite row fails at Build 0.20, engineers ask the strategy *"why did you build this plan?"* rather than reading hundreds of lines of code. **Debugging becomes deterministic instead of forensic.**

**Strategy Registry (locked · deterministic selection · Philip 2026-07-31):**

The Composer never hard-codes strategy imports one-by-one. A single registry module handles it:

```
scripts/strategies/registry.mjs
  ├── registers every strategy from strategies/
  ├── validates each strategy declares strategyApiVersion: "1"
  ├── enforces intentName uniqueness (no two strategies with the same intentName)
  ├── exposes findFor(routerDecision) → strategy
  └── returns the unknown strategy when zero non-unknown strategies match
```

**Selection is deterministic · never "first match wins":**

```
candidates = strategies.filter(s => s.intentName !== "unknown" && s.canHandle(routerDecision))
if candidates.length === 0 → return unknownStrategy    // guaranteed fallback
if candidates.length === 1 → return candidates[0]      // exactly one match
if candidates.length  >  1 → THROW ConfigurationError  // engineering bug · runtime does not guess
```

Two strategies claiming the same request is a configuration bug, not a runtime dilemma. The registry surfaces it loudly rather than silently picking one.

Adding a new strategy requires exactly two edits: (1) create `strategies/<name>.strategy.mjs`, (2) add the import + register call in `strategies/registry.mjs`. Composer file is never edited again.

### Phase 8 — Quality Gate (validates Response Plan · not prose)
Mechanical checks first (every EvidenceRef traces to Package · answer_type consistent with intent · confidence truthful) · judgement checks second (would a master tradesperson recommend this).

### Phase 9 — Language Renderer (deterministic templates first)
Turns approved Response Plan into prose using deterministic templates. LLM renderer may be added later as an alternate strategy · same interface · never permitted upstream. Failure mode is silence, never invention.

### Phase 10 — Runtime Chat wiring
The end-to-end pipeline in a single callable path. Nothing new · just glue.

Each phase must pass the relevant Suite rows before the next phase begins. Regressions in earlier phases block later phases.

## Alignment with Evidence/Runtime split

This pipeline enforces Standard v1's Evidence/Runtime separation:

- **Evidence** stays permanent · lives in authored files · queried by providers
- **Runtime** stays ephemeral · retrieval package rebuilt per question · composition rebuilt per question · nothing between the Router and the response is stored

The Router itself sits at the boundary — it is frozen (evidence-like) but classifies (runtime-like). That's why Router v1 gets a freeze declaration and the runtime layers do not.
