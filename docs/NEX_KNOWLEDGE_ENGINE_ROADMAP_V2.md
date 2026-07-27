# NEX Knowledge Engine — Roadmap V2

Amends V1. Adds Vision Intelligence as **Phase 5** and re-orders priorities per Philip's directive (2026-07-27):

> *"The next major leap isn't another scoring algorithm. It's better knowledge extraction."*

## Phase 1 · CLOSED — Never reject knowledge

- All 981 images preserved and classified
- ADR-0035 · classify never reject

## Phase 2 · SHIPPED — User Understanding

- USER INTENT TOKENS per image (6-category vocab · 185+ terms)
- Query Decomposer (parses "European oak Victorian monkey tail volute" into per-fragment intent)
- Multi-image reasoning (Gold Standard — coverage % across evidence)
- POST /api/nex/knowledge/understand
- Reference doc: `src/lib/nex/knowledge/queryDecomposer.ts`

## Phase 5 · NEXT — NEX Vision V1 (was going to be Phase 3, prioritised up)

**The bottleneck isn't scoring. It's extraction depth.** Today NEX reads:
- filename
- folder path
- referring files
- collection hints
- authored descriptions

**Tomorrow it reads the pixels themselves.** For every image, vision model extracts:
- Materials (oak · walnut · pine · glass · steel · brass)
- Components (handrail · newel · baluster · volute · tread · riser · string)
- Construction (straight flight · winder · closed string · cut string · open riser)
- Style (Victorian · Georgian · Contemporary · Scandinavian · Modern)
- Interior (luxury · residential · commercial · hotel)
- Manufacturing clues (visible joinery methods · fixings · finishes)
- Installation clues (site conditions · staging · complete vs in-progress)
- Room type · lighting · finishes · colours · textures
- Search intent (what queries would surface this image?)
- AI generation hints (composition · palette · reproducible traits)

This runs even when the filename is `IMG_7421.jpg`.

## 6-Metric Axes (replaces single MASTER SCORE where meaningful)

Every image row carries 6 metrics, not one:

| Metric | Meaning | Source |
|---|---|---|
| **Image Intelligence** | Existing MASTER SCORE (0-100 across 5 axes) | Parser (ADR-0032) |
| **Knowledge Completeness** | Extracted knowledge units / max potential | Vision + parser combined |
| **Vision Confidence** | Vision model's own confidence in its extraction | Vision API response |
| **Search Coverage** | # distinct intent tokens this image covers / total known tokens | queryDecomposer × tokens |
| **Generation Readiness** | MASTER AI PROMPT quality + locked_attributes + can_become | Parser |
| **Designer Value** | Business/designer utility weighted composite | Weighted combo |

## Expected outcome (Philip's prediction)

Today:
```
Master: 0 · Excellent: 0 · Good: 5 · Specialist: 50 · Reference: 327 · Limited: 589 · Visual: 9
```

After Vision V1 rerun:
```
Master: ~80 · Excellent: ~175 · Good: ~330 · Specialist: ~215 · Reference: ~150 · Limited: ~30 · Visual: 0
```

**The images didn't change. NEX became smarter.**

## What NOT to do

- Do not retune the scoring formula. The formula is fine. The input signal is thin.
- Do not attempt to lift Limited/Visual rows manually — Vision will do it structurally.
- Do not start Phase 3 (Knowledge Graph) or Phase 4 (Generation Support) until Phase 5 lands. They both benefit massively from Vision-extracted content.

## Phase 3 · Knowledge Graph (deferred behind Vision)

Explicit graph structure. Post-Vision it becomes trivial because Vision produces the edges.

## Phase 4 · Generation Support (deferred behind Vision)

Structured brief packaging for ChatGPT/image gen. Post-Vision the briefs write themselves from extracted knowledge.

## Success signal

Rerunning the pipeline after Vision V1 shows every band population shifting UP (not because scoring changed — because extraction became richer). Success is measured by:

- Average `Knowledge Completeness` per row climbing from ~20% → ~70%
- `Search Coverage` per row climbing from ~2 fragments → ~15 fragments
- Distribution shifting from 60% Limited to <5% Limited

## References

- Roadmap V1: `trades/docs/NEX_KNOWLEDGE_ENGINE_ROADMAP_V1.md`
- Vision contract (to be built): `src/lib/nex/vision/visionExtractor.ts`
- Metrics module (to be built): `src/lib/nex/vision/metrics.ts`
- Trigger: Philip 2026-07-27 — "The next project should NOT be rescoring. It should be called NEX Vision Intelligence."
