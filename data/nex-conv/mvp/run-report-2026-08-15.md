# NEX Conversation Learning MVP · Run Report

- ADR: **ADR-0044** · pilot brain: **staircase_brain**
- Started: `2026-08-14T21:20:34.668Z`
- Finished: `2026-08-14T21:21:10.819Z`
- Total wall time: **36151ms**

## Dataset

| Source | Parsed |
|---|---|
| image-batches | 282 |
| conv-intel-docs | 554 |
| conversation-examples | 29 (14 conversations) |

## Storage counts (after ingestion)

| Table | Count |
|---|---|
| knowledge_items | 865 |
| knowledge_items_live | 208 |
| knowledge_items_draft | 657 |
| entities | 56 |
| intents | 16 |
| edges | 4602 |
| states | 0 |
| turns | 0 |
| outcomes | 0 |
| feedback | 0 |

## Ingestion validation

| Result | Count |
|---|---|
| Live | 208 |
| Draft (0.50 ≤ confidence < 0.70) | 657 |
| Rejected (< 0.50 or schema fail) | 0 |

## Edges

- Proposed: **4602** · Accepted: **4602** · Rejected: **0**

| edge_type | count |
|---|---|
| related_to | 1667 |
| requires | 1058 |
| elaborates | 999 |
| comparison_to | 697 |
| prices | 133 |
| corrects | 48 |

## Embedding (bge-small-en-v1.5 · local · Xenova/@xenova/transformers)

| Metric | Value |
|---|---|
| Model | Xenova/bge-small-en-v1.5 (quantised) |
| Dim | 384 |
| Warm-up ms | 496 |
| Total embed calls | 865 |
| Total embed ms | 191181 |
| Avg embed ms/call | 221.02 |

## Ingestion stage timings (ms)

| Stage | ms |
|---|---|
| seed_ms | 46 |
| parse_ms | 307 |
| dedupe_ms | 6 |
| dupes_dropped | 0 |
| validate_ms | 0 |
| embed_ms | 24589 |
| write_items_ms | 1209 |
| link_ms | 9463 |

## Evaluation

- Conversations: **9** · Total turns: **23**
- Assertions: **37/37** passed (**100%**)
- Full-pass conversations: **9/9**
- Avg turn latency: **21.5ms** · P95: **41ms**

### Per-conversation results

| ID | Purpose | Pass rate |
|---|---|---|
| `eval-001-materials-follow-up` | Follow-up 'what about walnut' must retain staircase context established in turn 1. | 8/8 (100%) |
| `eval-002-correction` | Correction from oak to walnut must replace the material fact and preserve the old value in corrections_log. | 5/5 (100%) |
| `eval-003-pronoun-that` | Referring to prior recommendation with 'is that expensive' should retrieve pricing knowledge scoped to the current subject. | 3/3 (100%) |
| `eval-004-comparison` | 'Which is better' should be classified as compare and retrieve items involving both options. | 3/3 (100%) |
| `eval-005-constraint` | Constraint 'against a wall' should establish construction_context fact + influence subsequent retrieval. | 3/3 (100%) |
| `eval-006-topic-return` | After a topic diversion, returning to earlier subject should resurface the earlier established facts. | 4/4 (100%) |
| `eval-007-unrelated-topic` | Off-topic question should not retrieve confidently-scoped staircase items (retrieval quality proxy). | 2/2 (100%) |
| `eval-008-clarification-triggered` | Genuinely ambiguous input should NOT confidently retrieve a specific answer. | 1/1 (100%) |
| `eval-009-multi-turn-chain` | A 5-turn conversation should keep entities_in_focus growing coherently and not lose earlier facts. | 8/8 (100%) |

### Per-turn detail (each conversation)

#### eval-001-materials-follow-up — 8/8

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | What does an oak staircase cost? | ask_price | staircase,price,oak | — | staircase,price,oak | 0.469 | "What's the difference between oak and walnut for stairs?" | ✓ entities_in_focus == oak,staircase,price |
| 2 | What about walnut? | ask_what_about | walnut | — | staircase,price,oak,walnut | 0.546 | "What's the difference between oak and walnut for stairs?" | ✓ intent==ask_what_about · ✓ entities_in_focus contains walnut,staircase · ✓ state.current_topic == staircase |
| 3 | And glass? | ask_what_about | glass | — | staircase,price,oak,walnut,glass | 0.36 | Customer: "Modern glass balustrade staircase — what will it cost and what does t | ✓ intent==ask_what_about · ✓ entities_in_focus contains glass,staircase |
| 4 | And installation? | ask_what_about | installation | — | staircase,price,oak,walnut,glass,installation | 0.454 | Turn 1: > Customer: "I want a modern staircase with a nice big first step, glass | ✓ intent==ask_what_about · ✓ entities_in_focus contains installation,staircase |

#### eval-002-correction — 5/5

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | I want an oak staircase. | specify_material | staircase,oak | walnut | staircase,oak | 0.517 | "What's the difference between oak and walnut for stairs?" | ✓ state.material == oak |
| 2 | What are my options for the balusters? | ask_definition | baluster | walnut | staircase,oak,baluster | 0.384 | Example: > "This varies by manufacturer — 900 mm supplied length for stair balus | ✓ entities_in_focus contains baluster,oak |
| 3 | No, walnut. | correct | walnut | walnut | staircase,oak,baluster,walnut | 0.529 | "What's the difference between oak and walnut for stairs?" | ✓ intent==correct · ✓ state.material == walnut · ✓ corrections_log length >= 1 |

#### eval-003-pronoun-that — 3/3

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | Can I have a bullnose starting step? | ask_definition | bullnose,starting_step | — | bullnose,starting_step | 0.518 | "Do I have to carpet the bullnose too?" | ✓ entities_in_focus contains bullnose,starting_step |
| 2 | Is that expensive? | ask_price | price | — | bullnose,starting_step,price | 0.394 | "Do I have to carpet the bullnose too?" | ✓ intent==ask_price · ✓ topK ∩ bullnose > 0 |

#### eval-004-comparison — 3/3

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | I'm choosing between closed string and cut string. | statement | closed_string,cut_string,string | — | closed_string,cut_string,string | 0.497 | Use when: explaining the three-way base-rail rule (closed-string vs cut-string v | ✓ entities_in_focus contains closed_string,cut_string |
| 2 | Which is better for a modern home? | ask_recommendation | contemporary | — | closed_string,cut_string,string,contemporary | 0.376 | Slightly — a cut wall string can be quicker to fit against an existing plaster w | ✓ intent==ask_recommendation · ✓ topK ∩ closed_string\|cut_string\|contemporary > 0 |

#### eval-005-constraint — 3/3

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | My staircase is against a wall on one side. | specify_constraint | against_wall,staircase | — | against_wall,staircase | 0.699 | "I've got a staircase against a wall | ✓ state.constraint contains against_wall |
| 2 | What starting-step options do I have? | ask_options | starting_step | — | against_wall,staircase,starting_step | 0.625 | "Can I have a curved starting step if the stairs are against a wall?" | ✓ entities_in_focus contains starting_step,against_wall · ✓ topK ∩ starting_step\|against_wall > 0 |

#### eval-006-topic-return — 4/4

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | I want an oak staircase. | specify_material | staircase,oak | oak | staircase,oak | 0.517 | "What's the difference between oak and walnut for stairs?" | ✓ state.material == oak |
| 2 | What are the building regulations for handrail height? | ask_definition | building_regs,handrail_height,handrail | oak | staircase,oak,building_regs,handrail_height,handrail | 0.501 | Customer: How high should the handrail be? NEX: Great question. Handrail height  | ✓ entities_in_focus contains handrail,building_regs |
| 3 | Back to the oak. What does it cost? | ask_price | price,oak | oak | staircase,oak,building_regs,handrail_height,handrail,price | 0.414 | Customer: "Modern glass balustrade staircase — what will it cost and what does t | ✓ intent==ask_price · ✓ topK ∩ oak\|price > 0 |

#### eval-007-unrelated-topic — 2/2

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | What time is it? | ask_definition |  | — |  | 0.228 | Turn 1: > Customer: "Modern cantilever staircase — what will it cost and does it | ✓ intent not in specify_material\|ask_price · ✓ topK[0].score < 0.6 |

#### eval-008-clarification-triggered — 1/1

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | Can you make the bottom look more open? | ask_definition |  | — |  | 0.291 | Customer: Can you make the bottom look more open? NEX: Yes — I'd recommend a flu | ✓ topK[0].score < 0.85 |

#### eval-009-multi-turn-chain — 8/8

| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |
|---|---|---|---|---|---|---|---|---|
| 1 | I want a modern oak staircase. | specify_material | staircase,contemporary,oak | oak | staircase,contemporary,oak | 0.453 | How they might describe it: - "I want to refurb my stairs but keep some of the t | ✓ state.material == oak · ✓ state.style == contemporary |
| 2 | Against a wall on one side. | specify_constraint | against_wall | oak | staircase,contemporary,oak,against_wall | 0.463 | "I've got a staircase against a wall | ✓ state.constraint contains against_wall |
| 3 | Show me the balustrade options. | ask_options | balustrade | oak | staircase,contemporary,oak,against_wall,balustrade | 0.405 | Example: > Customer: "I want a wide first step in oak with glass balustrade abov | ✓ entities_in_focus contains balustrade,oak,against_wall |
| 4 | What about glass? | ask_what_about | glass | oak | staircase,contemporary,oak,against_wall,balustrade,glass | 0.484 | Yes — full glass infill panels with an oak top rail. Common for modern homes tha | ✓ intent==ask_what_about · ✓ entities_in_focus contains glass,balustrade,oak,against_wall |
| 5 | And installation cost? | ask_price | installation,price | oak | staircase,contemporary,oak,against_wall,balustrade,glass | 0.564 | Fire escapes are heavily specification-dependent — number of storeys, load ratin | ✓ intent==ask_price · ✓ entities_in_focus contains installation,price |
