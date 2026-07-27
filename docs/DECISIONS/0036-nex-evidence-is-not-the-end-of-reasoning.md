# ADR-0036: Evidence is Not the End of Reasoning

Status: Accepted · **IMMUTABLE** · extends ADR-0034 Gold Standard
Date: 2026-07-27

> **Philip's directive (2026-07-27):** *"Evidence coverage is only one stage. After reporting evidence coverage, NEX MUST continue reasoning. Evidence should become the starting point for reasoning. That's the difference between a search engine and a true Architectural Knowledge Engine."*

## Context

Phase 2 shipped a Query Decomposer + Multi-image combiner that responds with *"These N images collectively cover X% of your request."* Technically correct. But it stops one step too early. A user reads *"29% coverage"* as *"NEX only understands 29%"* — which is the OPPOSITE of what NEX actually understood (100%).

Worse, the response stops at evidence. It doesn't attempt to close the gap through relationship traversal, inheritance, or generation.

## Decision

### Evidence is stage 1, not the final answer

For every user query, the answer flow is now:

```
1. Understand         — decompose query into fragments (existing)
2. Direct Evidence    — search manifest for exact matches (existing)
3. Relationships      — for uncovered fragments, traverse the knowledge graph
4. Inheritance        — collection + brain inheritance fills further gaps
5. Generation Brief   — remaining gaps compile into a ChatGPT-ready brief
6. Final Answer       — assembled response with all 5 layers reported
```

**Evidence coverage below 100% NEVER ends the response.** NEX continues reasoning through steps 3-5 and reports what it can infer, what it can generate, and what its overall capability is on the query.

### The 5 metrics (replaces single "coverage %")

Every `/api/nex/knowledge/understand` response returns:

- **Understanding %** — how well NEX decomposed the query into recognised fragments
- **Direct Evidence %** — % of fragments covered by exact image matches in the manifest
- **Knowledge Relationships %** — % of remaining fragments covered by inferred relationships (parent · child · sibling · collection inheritance · architectural · material · manufacturing · designer · installation)
- **Generation Readiness %** — % of remaining fragments that can be composed into a generation brief for ChatGPT/image-gen
- **Overall Capability %** — weighted composite reflecting NEX's ability to serve this specific query end-to-end

The user experiences NEX as understanding them (Understanding %) even when the direct library thin (Direct Evidence %). The other metrics show NEX is still working the problem, not giving up.

### The 9 relationship traversals (for uncovered fragments)

For every fragment the direct evidence didn't cover, NEX must attempt:

1. **Parent relationships** — is the fragment covered by a parent image of a covered one?
2. **Child relationships** — is the fragment covered by a child (derivative) of a covered one?
3. **Sibling relationships** — is the fragment covered by a sibling in the same family_tree branch?
4. **Collection inheritance** — is the fragment covered by other images in the same collection at higher confidence?
5. **Architectural relationships** — is the fragment stylistically related to fragments covered (Victorian ↔ Georgian ↔ Edwardian)?
6. **Material relationships** — is the fragment a material relative (oak ↔ hardwood ↔ American oak)?
7. **Manufacturing relationships** — is the fragment covered by a related manufacturing method?
8. **Designer relationships** — is the fragment covered by a designer/collection style?
9. **Installation relationships** — is the fragment covered by an install-context image?

Each traversal that fires adds to `Knowledge Relationships %`. Fragments not covered by any traversal fall through to Generation Readiness (Phase 4 · deferred build).

### The final answer template

Response body (client-renderable):

```
"I understand your request completely. (Understanding: 100%)

Direct evidence covers 29% of your request:
  ✓ European oak — 2 matching images
  ✓ Luxury — 3 matching images

The uncovered fragments have relationship-level coverage:
  ~ Straight flight — inherited from Straight-Flight collection (78% confidence)
  ~ Monkey tail volute — architecturally related to Victorian handrail images
  ~ Pink runner — material relationship with luxury runner images
  ~ Victorian — style relationships across 12 collection images
  ~ Townhouse — application relationships across 8 collection images

Generation Readiness: 94%
I can compose a structured brief for ChatGPT/image-gen that captures all 7 fragments
with the extracted knowledge in your library.

Overall Capability: 92%
NEX understands your request, has partial direct evidence, rich relationship
coverage, and is generation-ready. Would you like to see the images, the
relationships, or the generation brief?"
```

**Never end at coverage %.** Always continue through relationships → generation → final assembled answer.

## Consequences

**Positive:**
- Users experience NEX as *understanding* them, not *failing* them.
- The 5-metric split makes NEX's actual capability visible without exposing scoring internals as if they were user-facing quality judgments.
- Evidence-poor libraries (Phase 1 state) still produce meaningful responses because relationship traversals + generation briefs compensate.
- Every uncovered fragment becomes an opportunity to demonstrate reasoning, not a failure.
- Search feels like a conversation with an expert, not a database lookup.

**Negative:**
- Response payloads grow (5 metrics + relationship reports + generation brief structure).
- Relationship traversals require the knowledge graph (Phase 3) to be fully valuable. Until Phase 3, traversals return partial coverage based on tags + collection membership + family_tree — still useful, not fully powerful.
- Generation Readiness metric only fills once Phase 4 (generation brief compiler) is built. Until then it reports "N% brief-composable" based on the fragments alone.

**Neutral:**
- Existing `/api/nex/knowledge/understand` endpoint shape changes. Any consumer expecting the old `coverage_percent` field must update; new shape carries all 5 metrics plus the old one as `direct_evidence_percent` for compat.

## Enforcement

- `/api/nex/knowledge/understand` returns the 5-metric shape + reasoning continuation output.
- **Any consumer surface that renders `"0 results found"` or stops at direct evidence coverage** is in violation of ADR-0036 and must be updated to continue through the reasoning pipeline.
- The user-facing headline NEVER leads with a percentage below 90% without qualifying words. *"29% coverage"* is banned as a lead. *"I understand your request completely. Direct evidence covers 29%; relationships and generation cover the rest."* is the correct form.
- Any relationship traversal that returns nothing must be honestly reported as *"no relationships found for X — but generation brief is available"*, not silently dropped.

## Related

- ADR-0034 (Knowledge Engine + Gold Standard) — this ADR is the operational contract for the Gold Standard.
- ADR-0035 (Classify Never Reject) — enables the relationship traversal because all bands are queryable.
- Phase 3 (Knowledge Graph) — where relationship traversals become fully powered.
- Phase 4 (Generation Support) — where Generation Readiness metric fills fully.
- Memory: `feedback_nex_evidence_is_not_the_end.md`
- Trigger: Philip 2026-07-27 — *"Claude is still stopping one step too early. Evidence should become the starting point for reasoning."*
