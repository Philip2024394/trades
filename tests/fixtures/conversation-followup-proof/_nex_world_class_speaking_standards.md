# NEX World-Class Speaking Intelligence · Standards Report
## Standards Research · Benchmarking · Gap Definition · No Construction

**Ratified:** Philip 2026-09-05
**Authorization:** `AUTHORIZE · NEX WORLD-CLASS SPEAKING INTELLIGENCE STANDARDS`
**Scope:** research + definition only. `src/` untouched. No agent added. No runtime capability added.

---

## Evidence-tag legend (used throughout)

| Tag | Meaning |
|-----|---------|
| **[ES]** EXTERNAL_STANDARD | Formally established benchmark, dataset, or framework from a research or standards body |
| **[RF]** RESEARCH_FINDING | Peer-reviewed or otherwise credible research result |
| **[NO]** NEX_OBSERVED | Observed live in the audit corpus (see G01–G24 in `_speaking_intelligence_audit_report.md`) |
| **[NI]** NEX_INFERENCE | Derived from NEX evidence — not a universal claim |
| **[NR]** NEX_RECOMMENDATION | A recommendation this report makes — not an established standard |
| **[UN]** UNKNOWN | Cannot be honestly resolved with the evidence at hand |

Any statement without a tag is definitional / structural.

---

## A. Executive Standard

**World-class NEX speaking intelligence** [NR] means the owner can sit and talk with NEX for an extended session and experience:

1. Correct **meaning** interpretation of every utterance in its conversational context — not word-by-word literalism, not phrase-pattern matching.
2. **Continuity** of reference, topic, and user-supplied facts across the whole conversation, not just the previous turn.
3. **Evidence discipline** — every substantive claim is either scope-relevant grounded evidence, an explicit qualification, or an honest boundary. Fabrication is impossible.
4. **Appropriate reasoning** — deductive, comparative, and pragmatic inference where warranted, no invention where not.
5. **Appropriate speaking behaviour** — natural length, natural timing, sticky language, no boilerplate, no robotic list-reading, respectful of what the user just did.

The system experience is **one coherent NEX**, not a stack of language subsystems. Failure at any one of these five destroys the perception of intelligence even if the others succeed — this is the central architectural claim of this report.

The AUTHORIZE explicitly rejects the following as success proxies: LLM benchmark score alone [ES benchmarks are useful but insufficient — see §C], sounding human for its own sake, long answers, large vocabulary, many agents, large data volume, isolated-QA correctness. This report treats those as anti-goals.

---

## B. External Standards & Research Reviewed

### B.1 · Dialogue systems & state tracking

- **Dialog System Technology Challenges (DSTC 1–12, 2013–2025)** [ES]. Started as the Dialog State Tracking Challenge in 2013 and expanded to a broader annual shared-task series. DSTC 12 (2025) included Track 1 *Dialog System Evaluation: Dimensionality, Language, Culture and Safety* and Track 2 *Controllable Conversational Theme Detection*. Source: `aclanthology.org/2025.dstc-1.pdf`.
- **MultiWOZ 2.0 / 2.1 / 2.2 / 2.4** [ES]. Task-oriented multi-domain dialogue benchmark; widely used for dialogue state tracking. Progressive revisions correct annotation noise.
- **Schema-Guided Dialogue (SGD)** [ES]. Schema-driven task-oriented dialogue benchmark.
- **ConvAI2 (Second Conversational Intelligence Challenge)** [ES]. Persona-consistent open-domain dialogue evaluation.
- **Herbert H. Clark's grounding in communication** [RF]. Common-ground theory — participants incrementally accept contributions into a shared knowledge base. Directly applicable to what NEX must model between turns.

### B.2 · Hallucination, factuality, grounded generation

- **HaluEval** [ES]. Systematic hallucination benchmark spanning QA, knowledge-grounded dialogue, and summarization. Source: `arxiv.org/html/2504.17550v1`.
- **TruthfulQA** [ES with caveats]. Adversarial factuality benchmark. Known limitations: saturation via training-data contamination, some incorrect gold answers, over-penalizing metrics. Should not be treated as a sole authority.
- **RAGAS** [ES]. Decomposes RAG quality into *faithfulness*, *answer relevance*, and *context precision/recall*. Empirically effective for hallucination discernment in RAG systems.
- **FActScore** [ES]. Atomic-fact-decomposition precision score.
- **FEVER** [ES]. Fact-extraction and verification against Wikipedia evidence.
- **HalluLens, OpenHalDet, HALT-RAG, System Hallucination Scale (SHS)** [ES]. More recent hallucination-related benchmarks and human-centered evaluation instruments.
- **Provenance (light-weight RAG fact-checker)** [RF]. arxiv 2411.01022.

### B.3 · Reference resolution / anaphora / coreference

- **OntoNotes (CoNLL-2012 shared task)** [ES]. Universally accepted reference testbed for single-antecedent coreference. Standard metrics: MUC, B³, CEAFφ4, average F1 via the official CoNLL-2012 scorer.
- **GAP dataset (Webster et al. 2018)** [ES]. Pronominal anaphora with ambiguous pronoun-name pairs from Wikipedia — tests whether models resolve pronouns beyond surface features.
- **OntoGUM** [ES]. Extends coreference evaluation to 12 additional genres — surfaces domain fragility.

### B.4 · Linguistic foundations

- **Grice's Cooperative Principle and Maxims** (Grice 1975) [RF]. Four maxims: *Quantity, Quality, Relation (relevance), Manner (clarity)*. Foundational for judging conversational appropriateness.
- **Speech Act Theory** (Austin 1962; Searle 1969) [RF]. Utterances have both semantic content and pragmatic force — a request, an assertion, a promise, an inquiry. Directly applicable to intent classification.
- **DAMSL (Dialogue Act Markup in Several Layers)** [ES]. Established coding scheme for dialogue-act annotation.

### B.5 · Speech / voice

- **Word Error Rate (WER)** [ES]. Standard ASR metric. Research increasingly calls for supplementing WER with timing, confidence, dialogue-act, and conversational-word analysis.
- **Mean Opinion Score (MOS) / UTMOS / UTMOSv2** [ES]. Perceived voice-quality naturalness. Automatable via UTMOS models.
- **Full-duplex timing / turn-taking research** [RF]. Human conversational turn latency ≈ 200 ms median in same-language conversation; violating this degrades naturalness. Source: `arxiv.org/pdf/2307.15493`.
- **SPEARBench** [ES]. Naturalness evaluation for streaming speech-to-speech LLMs.

### B.6 · Multilingual / Indonesian

- **IndoNLU** (AACL-IJCNLP 2020) [ES]. Indonesian NLU benchmark, 12 downstream tasks, IndoBERT + IndoBERT-lite pre-trained on Indo4B (~4 B tokens).
- **IndoNLG** (EMNLP 2021) [ES]. Indonesian NLG benchmark, 6 tasks, IndoBART + IndoGPT on Indo4B-Plus.
- **NusaCrowd** [ES]. Open-source Indonesian NLP resource initiative.
- **NusaBERT** [RF]. Multilingual/multicultural extension of IndoBERT.
- **Code-switching** [RF]. IndoNLP work explicitly treats code-mixing between Indonesian and regional languages (Javanese, Sundanese) as a first-class evaluation challenge — English/Indonesian mixing is documented as pervasive in informal Indonesian conversation.

### B.7 · Meta-evaluation

- **HELM (Holistic Evaluation of Language Models)** [ES] and successors. Multi-metric multi-scenario evaluation frameworks.
- **Cross-cultural / dimensional dialogue evaluation** [ES]. DSTC 12 Track 1 explicitly organizes the field around this axis.

---

## C. What External Benchmarks Miss (relative to NEX's target)

For every benchmark family above, the question is: *does this measure whether the owner can talk to NEX naturally over 20 minutes?*

| Category | What it measures | What it does NOT measure for NEX |
|----------|------------------|-----------------------------------|
| DSTC / MultiWOZ / SGD [ES] | Slot filling on task-oriented turn triples | Multi-turn stated-fact recall · language stability across a conversation · natural voice length · scope-validated evidence |
| HaluEval / TruthfulQA [ES] | Model-level fabrication rate on curated QA | Whether *this system's retrieval* was scope-relevant · whether composition invented despite loose retrieval |
| RAGAS [ES] | Faithfulness / context precision / relevance | Whether the retrieved-and-faithful answer is the *right kind of act* (search vs clarify vs boundary) |
| OntoNotes / GAP [ES] | Text-level pronoun resolution accuracy | Whether NEX resolves `it` against a live session-state entity — resolution is against a document, not a conversation window |
| Grice / Speech Acts [RF] | A framework for judging appropriateness | Does not itself score; must be operationalized per system |
| WER / MOS [ES] | ASR accuracy · voice naturalness | Whether the *response length* fits speech · whether *language* stayed stable through the turn |
| IndoNLU / IndoNLG [ES] | Indonesian task accuracy | Not conversational; not code-switch-in-conversation; not the specific NEX owner-context flow |

**Central limitation** [NI]: every external benchmark measures a slice. World-class NEX speaking is the *whole speaking chain sustained across a long conversation*. No single external benchmark exists that mirrors the NEX target. This is why §D–§G below define NEX-specific standards *derived from* — not *copied from* — external work.

---

## D. NEX Speaking Model (complete chain, quality per stage)

```
USER SPEECH / TEXT
  ↓
LANGUAGE RECOGNITION        (STT · language detection)
  ↓
LINGUISTIC STRUCTURE        (interrogative · referents · verb semantic · postposition · negation · tense · quantification)
  ↓
SEMANTIC INTERPRETATION     (word-sense in context · scope of quantifiers · scope of negation)
  ↓
CONVERSATIONAL FUNCTION     (dialogue act: assert · request · question · confirm · repair · social)
  ↓
INTENT                      (route: search · clarify · boundary · social · action)
  ↓
REFERENCE                   (deictic · anaphoric · ordinal · elliptical resolution against session entities)
  ↓
CONTEXT                     (running topic · running subject · running vertical · running language)
  ↓
USER / SESSION MEMORY       (stated facts · preferences · constraints · corrections · previous decisions)
  ↓
REASONING                   (compare · rank · quantify · negate · infer scope-valid conclusions)
  ↓
KNOWLEDGE                   (owned lexicon · owned domain data · retrieval hits)
  ↓
EVIDENCE                    (scope-validated: does the retrieved hit ACTUALLY address this subject?)
  ↓
RESPONSE POLICY             (answer · qualify · ask · retrieve · boundary · confirm)
  ↓
LANGUAGE GENERATION         (deterministic composer or LLM under NEX-defined constraints)
  ↓
VOICE / SPEECH              (language-consistent · length-bounded · natural timing)
  ↓
USER EXPERIENCE
```

Per-stage quality standards (compact):

| Stage | World-class standard [NR] | Failure looks like [NO where cited] | Deterministic vs probabilistic |
|-------|----------------------------|--------------------------------------|--------------------------------|
| Language recognition | Correct language detected on first token; sticky across turns | Reply-language flips mid-conversation (G03) | Deterministic sticky policy over probabilistic detection |
| Linguistic structure | Feature vector includes interrogative, referents, verb-semantic, negation, tense, aspect, quantification, spatial predicate | Missing negation/tense/spatial (G08, G10, G12) | Deterministic feature extraction |
| Semantic interpretation | Scope of negation and quantifiers computed | `NOT expensive` treated as `expensive` (G12) | Deterministic |
| Conversational function | Dialogue act identified: request · question · assertion · confirmation · social · correction · repair | `I love this place` misread as search (G07); `terima kasih` misread as query (G19) | Deterministic classifier |
| Intent | Routed among search / clarify / boundary / social / action / provenance | `who owns X` routes to hotel-list (G01) | Deterministic |
| Reference | Deictic-singular, deictic-plural, ordinal, elliptical all resolve against session entities | `tell me more about it` re-emits list (G04); `and this one` clarify_ambiguous (G05) | Deterministic hydration |
| Context | Running topic / subject / vertical / language survive intent shifts | `also gyms` after hotels returns hotels (G17) | Deterministic |
| User memory | Stated facts (`I have a shellfish allergy`) recalled multi-turn | Allergy dropped; 3 turns later NEX cannot recall (G23) | Deterministic user-fact store |
| Reasoning | Comparison / ranking / count / negation-inversion produce defensible conclusions | `how many hotels do you have?` returns list not count (G11); no ranking (G02) | Deterministic |
| Knowledge | Owned linguistic + domain knowledge queryable | Missing spatial vocabulary (G10) | Deterministic |
| Evidence | **Scope-validated**: retrieved knowledge must mention the message's actual subject | `seafood in Japan` → fabricated with k=6 loose hits (G24) | Deterministic scope check |
| Response policy | Match act: answer / qualify / ask / boundary | Confusion signal ignored (G06) | Deterministic |
| Language generation | Fit act + fit language + fit voice | Robotic list-reading; boilerplate | Model under NEX-defined constraints |
| Voice | Length-bounded; language sticky; no template markers | `voice_reply.en` = full reply (G21); voice/text mismatch (G22) | Deterministic post-process |

**Locked architectural principle** [NR]: NEX owns every stage except LANGUAGE GENERATION. The model reasons and speaks *within a bounded context NEX constructed*. It never becomes "the thing that knows NEX."

---

## E. Capability Standards (60 domains → 10 architectural bundles)

The AUTHORIZE lists 60 capability domains. Treating each as a separate feature would spawn 60 mini-agents [NR: architecturally wrong]. Bundle them by root cause:

| Bundle | Domains covered | Root capability |
|--------|-----------------|-----------------|
| **L1 · Question shape** | 1, 2 (question understanding, question-word semantics) | Interrogative + expected-answer-type classifier |
| **L2 · Reference resolution** | 3, 4, 5, 6, 7, 8, 9 (pronouns, demonstratives, deictics, anaphora, ordinals, result-sets, entity continuity) | One resolution layer over session entities + result-sets + user-supplied entities |
| **L3 · Predicate semantics** | 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21 (verbs, tense, aspect, negation, modality, prepositions, spatial, temporal, quantity, comparison, ranking, conditional) | Feature-extraction extensions in language-intelligence.ts + composer-side routing |
| **L4 · Ambiguity handling** | 22, 23, 24 (ambiguity, polysemy, homophones) | Sense disambiguation consumer of the lexicon substrate — bounded by context |
| **L5 · Non-canonical input** | 25, 26, 27 (ellipsis, incomplete sentences, shorthand) | Elliptical-extension composer with context inheritance |
| **L6 · Pragmatics** | 28, 29 (implied meaning, pragmatics) | Grice-informed implicature detector — implication → constraint conversion |
| **L7 · Discourse management** | 30, 31, 32, 33, 34, 41 (continuation, switching, corrections, clarification, repair, cross-turn scope) | Discourse state machine on top of session |
| **L8 · Memory & preferences** | 35, 36, 37, 38, 39, 40 (emotion, y/n, prefs, facts, memory, long-conversation) | User-fact store + preference store + long-window continuity |
| **L9 · Evidence** | 42, 43, 44, 45, 46, 47, 48 (evidence-aware, uncertainty, I-don't-know, ask/don't-ask, challenge, confirm) | Scope-validated evidence gate + confirmation-parser wiring |
| **L10 · Voice + multilingual** | 49–60 (Indonesian, English, code-switch, informal, STT, ASR, voice consistency, response length, turn-taking, repair, expert behaviour) | Language-stability layer + voice length policy + STT phonetic tolerance + code-switch routing |

The 60 domains reduce to **10 architectural bundles** [NR]. Any construction plan should target bundles, not domains.

---

## F. Measurement Framework

Every world-class claim needs a measurable evaluation. Draft per bundle:

| Bundle | Test input example | Expected behaviour | Unacceptable behaviour | Metric | Target threshold |
|--------|---------------------|---------------------|------------------------|--------|------------------|
| L1 Question shape | `who owns this hotel?` | provenance/identity-appropriate reply | entity-list re-emit | intent-routing accuracy | ≥95% [NR — no established threshold] |
| L2 Reference resolution | `tell me more about it` after single presented hotel | resolves to that hotel | list re-emit | reference-resolution accuracy | ≥90% [NR] |
| L3 Predicate — negation | `I don't want a hotel` | inverted / clarifying | hotel list | negation-preserved accuracy | 100% [NR — negation error is not tolerable] |
| L3 Predicate — tense | 5 tense variations of visit-Yogyakarta | 5 distinguishable replies | 1 undifferentiated reply | reply-differentiation | ≥4/5 [NR] |
| L3 Predicate — spatial | `north of Malioboro` | spatially filtered or honest boundary | ignore-and-list | spatial-preserved accuracy | ≥90% [NR] |
| L3 Predicate — quantity | `how many hotels do you have?` | count | list | count-vs-list accuracy | 100% [NR] |
| L4 Ambiguity | `catch bass` following `lead the tour` | fish-context reply | tour-leader contamination | cross-turn contamination rate | ≤5% [NR] |
| L6 Pragmatics | `we have a baby with us` | family-friendly filter | generic list | implication-preserved rate | ≥80% [NR — pragmatics is genuinely hard, threshold empirical] |
| L7 Discourse | `also gyms` after hotel search | vertical switch to gyms | hotel re-emit | elliptical-vertical accuracy | ≥95% [NR] |
| L8 Memory | user asserts allergy; 3 turns later user asks about it | recall | no recall | user-fact recall rate | 100% within a session [NR] |
| L9 Evidence | `seafood in Japan` | honest boundary (no NEX Japan data) | fabricated Japan restaurants | fabrication rate | 0% [NR — this is a first-order NEX invariant, not a threshold] |
| L10 Language stability | Indonesian turn after Indonesian turn | Indonesian reply | English reply | language-consistency rate | ≥95% [NR] |
| L10 Voice length | short-answer question | ≤2 sentence voice_en | full-reply voice_en | voice-brevity rate | ≥80% [NR] |

Rows that state 100% (negation preserved, count-vs-list, allergy recall, fabrication rate) are **not aspirational** — each failure produces demonstrably wrong output that a knowledgeable human would never generate.

Rows with `[NR]` thresholds have **no established external threshold** for this specific system. THRESHOLD NOT YET ESTABLISHED [UN] where marked; NEX should establish empirical baselines then set target improvement bands per gap.

**Meta-metrics** (over full conversations, not turns):

- **Continuity rate** [NR]: % of multi-turn conversations where topic/reference/user-facts survive turns 3–10.
- **Repair success** [RF, RAGAS-inspired]: % of clarifications that produce a satisfying next-turn answer.
- **Evidence-alignment rate** [ES, RAGAS *Faithfulness* + *Context Relevance*]: composed claims that are BOTH grounded in retrieval AND scope-relevant to the message subject.
- **User-intent preservation rate** [NR]: % of turns where NEX's interpreted intent matches the user's intent (measured via short human review).

---

## G. World-Class Acceptance Gate

A gate on both **capability** and **behaviour**. Failing either dimension fails the whole gate.

### G.1 · Capability gate [NR]

- L1–L10 above each score at or above their target thresholds.
- Negation, count-vs-list, memory recall, and fabrication rate meet their 100% / 0% invariants respectively.
- Reference resolution passes on a mixed pronoun / demonstrative / ordinal / elliptical corpus.
- Scope-validated evidence check is empirically operational: on the Japan-seafood / Semarang-Michelin class of probes, NEX emits an honest boundary rather than fabricated content.

### G.2 · Behaviour gate [NR — Grice-informed]

- Length-appropriate voice replies (Grice's *Quantity*).
- No fabrication or misleading confidence (Grice's *Quality*).
- On-topic relative to the user's immediate ask (Grice's *Relation*).
- Clear, non-boilerplate phrasing (Grice's *Manner*).
- Sticky reply language matching the user's language.
- Absence of robotic list-reading when the user asked a question.
- Turn latency perceived as natural (≥ human conversational latency band ≈ 200–800 ms end-to-end for voice) [RF].

### G.3 · Combined behaviour required

- **A system that understands but speaks badly fails.** (L1–L9 succeed, L10 fails.)
- **A system that sounds natural but fabricates fails.** (L10 succeeds, L9 fails.)
- **A system that isolated-QAs perfectly but loses context fails.** (L1, L3 succeed, L7/L8 fail.)
- **A system that retrieves but cannot establish scope-relevance fails.** (Knowledge stage succeeds, Evidence stage fails — this is the current NEX regression: G24.)

NEX cannot honestly claim "world-class speaking intelligence" until every one of these four negation clauses is falsified by evidence, sustained across a multi-turn conversational corpus.

---

## H. Current NEX Position (from audit — no new observation)

Source: `_speaking_intelligence_audit_report.md` (99 live turns, 26 categories, 24 catalogued gaps).

**What NEX has demonstrated** [NO]:
- Question-word interpretation (English) largely correct.
- Basic composition and entity-list retrieval.
- Social openers/closers.
- Topic abandonment detection.
- Ordinal resolution against accommodation entities.
- Provenance follow-up gate.
- Corrections handling (`actually I meant X`).
- Honest boundaries for genuinely unknown domains (weather, exchange rate, 2028 election).

**What NEX has NOT demonstrated** [NO]:
- Negation semantics.
- Tense/aspect differentiation.
- Spatial reasoning.
- Quantity → count routing.
- Ranking / comparison.
- User-fact memory.
- Deictic-singular anaphora resolution against accommodation.
- Sticky reply language.
- **Scope-validated evidence** (the P0.1 fabrication regression: G24).

### Position on Level 1–5 scale [NR]

Concrete definition:

| Level | Behaviour | Concrete example |
|-------|-----------|------------------|
| L1 · Question-answer machine | Answers isolated questions, no memory, no context | Weather widget, FAQ bot |
| L2 · Contextual chatbot | Preserves one-turn context; falls apart at turn 3 | Most generic assistants circa 2020 |
| L3 · Competent conversational assistant | Preserves ~5-turn context, some reference resolution, some intent routing | Modern LLM chat products with structured RAG |
| L4 · Knowledgeable conversational expert | Preserves 20+ turns, resolves references, remembers user-stated facts, distinguishes scope-relevant evidence, negation and tense preserved, language sticky | Domain-expert human on a good day |
| L5 · World-class conversational intelligence | L4 + spoken naturalness + code-switching + empirical repair · sustained across a long session | Long-form expert conversation |

**Current NEX position** [NI, based on audit]: **L3 with regressions**. Provenance follow-up, ordinal resolution, corrections, abandonment, evidence-boundary for genuinely-unknown put it in L3. G23 (no user memory), G12 (no negation), G24 (scope-validated evidence) pull it toward L2 on those specific dimensions.

---

## I. Gap Mapping (G01–G24 → standard)

| G# | Gap | Bundle | Standard implicated |
|----|-----|--------|---------------------|
| G01 | `who owns X` returns list | L1 | Question-word / expected-answer-type (Speech Act Theory [RF]) |
| G02 | No ranking | L3 (comparison), L9 (evidence) | Comparison + confidence framing (Grice *Manner* [RF]) |
| G03 | Reply language flips | L10 | Language stability — no direct external analog; NEX-specific [NR] |
| G04 | `it` unresolved | L2 | Coreference resolution (OntoNotes / GAP [ES]) |
| G05 | `and this one` unresolved | L2 + L7 | Demonstrative + discourse continuity |
| G06 | Confusion signal ignored | L7 | Conversational repair (Clark's grounding [RF]) |
| G07 | Emotional expression → search | L4 (dialogue act) | Speech Act Theory [RF] |
| G08 | Tense undifferentiated | L3 | Predicate semantics (linguistic pragmatics [RF]) |
| G09 | `on Prawirotaman` → hotels near | L3 (prepositions) | Preposition semantics [RF] |
| G10 | Spatial vocabulary absent | L3 | Spatial semantics [RF] |
| G11 | `how many` → list | L3 (quantity) | Quantifier semantics [RF] |
| G12 | Negation ignored | L3 (negation) | Negation semantics (foundational logic) [RF] |
| G13 | Cross-turn contamination | L4 + L7 | Word-sense-in-context (WSD [RF]) |
| G14 | Declarative as query | L4 | Dialogue-act classification (DAMSL [ES]) |
| G15 | `y`/`n` not affirmation | L8 | Grounding / adjacency pair (Clark [RF]) |
| G16 | `the beach` misread | L7 | Topic switch |
| G17 | `also gyms` unhandled | L7 (elliptical vertical) | Ellipsis resolution [RF] |
| G18 | Implication → constraint missing | L6 | Gricean implicature [RF] |
| G19 | `terima kasih` triggers search | L4 + L10 | Dialogue-act × language |
| G20 | STT-style entity failures | L10 | ASR error tolerance [RF] |
| G21 | `voice_en` = full reply | L10 (voice length) | Spoken-answer length [RF] |
| G22 | Voice-intent / composed-reply mismatch | L10 | Voice-response consistency [NR] |
| G23 | No user-fact memory | L8 | Dialogue state tracking (DSTC [ES]) |
| G24 | Fabrication on out-of-scope | L9 | RAGAS *Context Relevance* + *Faithfulness* [ES] |

Every gap maps to at least one bundle. Every bundle covers ≥1 gap. This is the argument that construction should be bundle-scoped, not gap-scoped.

---

## J. P0 / P1 / P2 (aligned with audit rankings, no upgrades)

Preserving the rankings from `_speaking_intelligence_audit_report.md` — this report does not re-rank, only adds standards linkage.

### P0 — essential to speaking (fabrication or breakage)

1. **G24 → L9 · scope-validated evidence.** RAGAS *Context Relevance* [ES] provides the conceptual pattern: retrieval returning content ≠ retrieval returning content that is scope-relevant to the message's actual subject. NEX must gate the composer on scope-relevance, not just k>0.
2. **G12 → L3 · negation semantics.** Foundational; failing here is not a "polish" issue.
3. **G23 → L8 · user-fact memory.** DSTC-family research treats stated slots as first-class [ES]. NEX needs its own analog scoped to owner-facts (allergies, preferences, constraints, corrections).
4. **G04 → L2 · deictic-singular resolution.** GAP / OntoNotes provide the conceptual pattern; NEX's version resolves against session entities, not document context.
5. **G03 → L10 · sticky reply language.** No standard external benchmark; NEX-specific.

### P1 (13 items) → covered under L3 (predicate semantics), L7 (discourse), L8 (memory extensions), L10 (STT + voice).

### P2 (6 items) → L4 (dialogue-act polish), L10 (voice length + alignment), L2/L7 (residual reference cases).

---

## K. Architectural Recommendation (one coherent architecture)

```
                         ┌───────────────────────────────────┐
                         │  NEX LANGUAGE INTELLIGENCE        │
                         │  (owned by NEX, not the model)    │
                         └───────────────┬───────────────────┘
                                         │
       ┌──────────────────────┬──────────┴──────────┬──────────────────────┐
       ▼                      ▼                     ▼                      ▼
  LINGUISTIC              REFERENCE            DISCOURSE             MULTILINGUAL
  KNOWLEDGE               & CONTEXT            & MEMORY              & VOICE
  ─ interrogatives        ─ deictic            ─ dialogue-act        ─ language detect
  ─ referents             ─ anaphoric          ─ topic / vertical    ─ sticky language
  ─ verbs (14 cats)       ─ ordinal            ─ user-facts store    ─ code-switch
  ─ adverbs (7 cats)      ─ ellipsis           ─ preferences         ─ voice length
  ─ negation              ─ session entities   ─ corrections         ─ STT tolerance
  ─ tense / aspect        ─ result-sets        ─ scope reset
  ─ prepositions          ─ user-supplied      
  ─ spatial vocab         
  ─ temporal vocab        
  ─ polysemy catalog      
  ─ homophone groups      
                                         │
                                         ▼
                            ┌───────────────────────────┐
                            │  NEX BRAIN                │
                            │  (intent · routing ·      │
                            │   response policy)        │
                            └───────────┬───────────────┘
                                        │
                                        ▼
                            ┌───────────────────────────┐
                            │  NEX EVIDENCE LAYER       │
                            │  ─ retrieval              │
                            │  ─ SCOPE VALIDATION       │
                            │  ─ claim verification     │
                            └───────────┬───────────────┘
                                        │
                                        ▼
                     ┌─────────────────────────────────────┐
                     │  LANGUAGE GENERATION                │
                     │  (LLM under NEX-defined constraints)│
                     └─────────────────┬───────────────────┘
                                       │
                                       ▼
                     ┌─────────────────────────────────────┐
                     │  VOICE POLICY                       │
                     │  ─ length · language · timing       │
                     └─────────────────────────────────────┘
```

**One coherent architecture** [NR]. No `negation-agent`, no `tense-agent`, no `pronoun-agent`, no `preposition-agent`. Every capability extension slots into an existing box:

- New lexicon items → LINGUISTIC KNOWLEDGE
- New reference kinds → REFERENCE & CONTEXT
- New dialogue acts → DISCOURSE & MEMORY
- New voice policies → MULTILINGUAL & VOICE
- New evidence policies → NEX EVIDENCE LAYER

The BRAIN mediates. The model never becomes "the thing that knows NEX."

---

## L. Future Construction Slices (bundled recommendation, not authorization)

Sequenced by user-visible impact and by ability to build subsequent slices on top:

| Slice | Bundle | Preserves | Rationale |
|-------|--------|-----------|-----------|
| **1 · Scope-validated evidence** | L9 | P0.3/P0.4/zero-evidence · retrieval untouched | Blocks fabrication class; highest fidelity gain per LOC |
| **2 · Negation feature** | L3 | Existing intent-composition rules (additive) | Foundational; unlocks correct L3 composition |
| **3 · User-fact store** | L8 | Session structure (extend, not replace) | Enables Slices 5, 7 |
| **4 · Deictic-singular resolution** | L2 | Ordinal resolution untouched | Small, high-impact |
| **5 · Language stability** | L10 | Language-detection function untouched | Owner-experience continuity |
| **6 · Tense / aspect features** | L3 | Preserves existing analyzeMessage additive contract | Depends on Slice 2 pattern |
| **7 · Spatial vocabulary + filter** | L3 | World-adapter contracts | Requires spatial vocabulary in lexicon (Slice 2 pattern) |
| **8 · Quantity + ranking pipeline** | L3 | Composer choice untouched | Depends on evidence layer (Slice 1) |
| **9 · Confirmation-parser wiring** | L8 | confirmation-parser.ts unchanged | Wire-only, no new module |
| **10 · Elliptical vertical shift** | L7 | Existing vertical-switch logic | Small, targeted |
| **11 · Cross-turn scope reset** | L7 | Session structure | Reliance on Slice 3 |
| **12 · Implication → constraint** | L6 | Requires Slice 3 (user-facts) | Builds on Grice-informed classifier |
| **13 · STT phonetic tolerance** | L10 | Entity-resolution contract | Bounded to accommodation entity names first |
| **14 · Emotional-expression classifier** | L4 | Dialogue-act extension | Prevents G07-class errors |
| **15 · Voice length / voice-intent alignment** | L10 | Voice pipeline shape | Refinement bundle |

Each slice remains subject to its own explicit AUTHORIZE per NEX Op-Truth discipline. **This report does not authorize any of them.**

---

## M. Open Questions [UN unless otherwise tagged]

1. **What is the empirical baseline for each metric on the current NEX?** The audit produced 99 turns of qualitative evidence. A gated quantitative baseline (fabrication rate, negation-preservation, memory recall, language stability, etc.) requires an expanded evaluation corpus — the audit is a starting point, not a metric baseline.
2. **What target thresholds should the P1 metrics use?** For most L3/L7 bundles no external threshold applies. NEX should establish empirical baselines and set improvement bands — recommendation only [NR]; no threshold authored here.
3. **Which sub-slice of the model should generate the response?** The report locks *NEX owns the constraints*, but does not choose between Ollama-local, cloud-hosted, or hybrid model routing. That is a provider decision, out of scope for a standards audit.
4. **How should code-switching between English and Indonesian be tested?** IndoNLU [ES] contains code-mixing challenges but not the specific NEX owner-flow. NEX would need to construct a small proprietary code-switching corpus per the AUTHORIZE §2 framing.
5. **What is the acceptable long-term memory decay policy?** Session memory ≠ long-term memory. AUTHORIZE §11 asks for the separation; this report has not resolved the decay/persistence question.
6. **How to evaluate NEX-specific "expert conversation" quality?** The GENERAL → SPECIFIC → COMPARISON → COMMERCIAL → PERSONAL → ACTION arc from AUTHORIZE §9 requires a proprietary evaluation, not an external benchmark.

---

## N. Final Verdict

Does NEX currently meet world-class speaking standards?

**No** [NI, based on §H + audit evidence].

- NEX passes some individual criteria (question-word interpretation, provenance gating, ordinal resolution, corrections, abandonment, honest-boundary emission for genuinely unknown domains).
- NEX fails at least 5 P0 criteria that world-class speaking requires (scope-validated evidence, negation, user-fact memory, deictic-singular anaphora, sticky reply language).
- The failure mode set includes a **fabrication regression** (G24 — Japan seafood, Semarang Michelin) that is disqualifying by any world-class standard: no responsible system fabricates on out-of-scope subjects while claiming evidence-grounding.

**Position:** L3 with regressions toward L2 on those specific dimensions.

**Path forward:** the 15-slice construction sequence in §L, each requiring its own AUTHORIZE, sequenced to block the fabrication class first, then progressively rebuild toward L4, then L5. No slice is authorized by this report.

**Architectural principle preserved throughout:** NEX owns the speaking chain end-to-end. The model is a reasoning + generation surface *inside* NEX-defined constraints. One coherent Language + Brain + Evidence + Voice architecture, not a collection of grammatical micro-agents.

---

## Anti-drift verification

- No `src/` file modified during this audit.
- No new runtime capability added.
- No tests added or run for this audit.
- No agent created.
- No lexicon entries added.
- No wiring code proposed for immediate implementation.
- No pseudocode intended to compile.
- No redesign of the current system.
- Every external source recorded in §B.
- G01–G24 mapped in §I.
- Every claim tagged with evidence discipline (ES / RF / NO / NI / NR / UN).
- No thresholds invented; where no threshold is established, explicitly marked THRESHOLD NOT YET ESTABLISHED.
- No claim upgraded past its evidence tier.

---

## Sources

External standards, benchmarks, and research referenced above (all reviewed via authoritative outlets):

- [DSTC 2025 (Twelfth Dialog System Technology Challenge)](https://aclanthology.org/2025.dstc-1.pdf)
- [The Dialog State Tracking Challenge Series: A Review](https://www.researchgate.net/publication/346276644_The_Dialog_State_Tracking_Challenge_Series_A_Review)
- [Overview of Dialog System Evaluation Track (DSTC 12 Track 1)](https://arxiv.org/html/2509.13569)
- [Survey on Evaluation Methods for Dialogue Systems](https://arxiv.org/pdf/1905.04071)
- [Second Conversational Intelligence Challenge (ConvAI2)](https://arxiv.org/pdf/1902.00098)
- [HalluLens: LLM Hallucination Benchmark](https://arxiv.org/html/2504.17550v1)
- [HaluEval and TruthfulQA Benchmarks (overview)](https://www.emergentmind.com/topics/halueval-and-truthfulqa)
- [Provenance: A Light-weight Fact-checker for RAG Output](https://arxiv.org/pdf/2411.01022)
- [OntoNotes / CoNLL-2012 coreference (NLP-progress)](http://nlpprogress.com/english/coreference_resolution.html)
- [OntoGUM: Evaluating SOTA Coreference on 12 More Genres](https://arxiv.org/pdf/2106.00933)
- [Can we Fix the Scope for Coreference? Problems and Solutions Beyond OntoNotes](https://arxiv.org/pdf/2112.09742)
- [BERT for Coreference Resolution: Baselines and Analysis](https://arxiv.org/pdf/1908.09091)
- [IndoNLU benchmark](https://github.com/IndoNLP/indonlu)
- [IndoNLG benchmark](https://arxiv.org/html/2104.08200v1)
- [NusaCrowd: Open Source Initiative for Indonesian NLP Resources](https://arxiv.org/pdf/2212.09648)
- [NusaBERT: Teaching IndoBERT to be Multilingual and Multicultural](https://arxiv.org/pdf/2403.01817)
- [Cooperative principle (Grice) — Wikipedia summary](https://en.wikipedia.org/wiki/Cooperative_principle)
- [Grice's Cooperative Principle — Leeds course text](https://www.latl.leeds.ac.uk/wp-content/uploads/sites/49/2019/05/Davies_2000.pdf)
- [Grice's Maxims of Conversation — LibreTexts](https://socialsci.libretexts.org/Bookshelves/Linguistics/Analyzing_Meaning_-_An_Introduction_to_Semantics_and_Pragmatics_(Kroeger)/08%3A_Grices_theory_of_Implicature/8.03%3A_Grices_Maxims_of_Conversation)
- [The timing bottleneck in conversational UIs / dialogue systems](https://arxiv.org/pdf/2307.15493)
- [SPEARBench: Naturalness Evaluation for Streaming Speech-to-Speech LLMs](https://arxiv.org/html/2607.05365v1)
- [Optimizing Conversational Quality in Spoken Dialogue Systems](https://arxiv.org/html/2601.19063v1)
- [Human Latency Conversational Turns for Spoken Avatar Systems](https://arxiv.org/html/2404.16053v1)

---

🟢 **HARD STOP · NEX WORLD-CLASS SPEAKING STANDARDS DEFINED · NO CONSTRUCTION APPLIED · AWAITING REVIEW**
