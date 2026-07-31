---
title: State of the Art · AI Knowledge Orchestration & Conversational Reasoning · Research Report for NEX
type: nex_research_report
status: REFERENCE_MATERIAL · NOT_ARCHITECTURE
created: 2026-07-31
completed: 2026-07-31
research_brief: nex-research-brief-2026-07-31-reasoning-and-retrieval-framework-for-question-router-build.md
research_agent: general-purpose (background)
governance_position_per_philip_2026_07_31: |
  "The Constitution stays yours. Standard v1 stays yours. The Router Validation Suite defines success.
   External research can suggest implementation techniques.
   If a research paper recommends a different retrieval strategy, you evaluate it against your validation suite
   rather than changing the architecture to fit the paper."
usage_directive: |
  Treat as REFERENCE MATERIAL only.
  Any technique proposed here must be evaluated against the Router Validation Suite pass/fail before adoption.
  Constitutional principles (Permanence · Evidence First · Reality-Over-Speculation · Trust Metric · Vocabulary Elasticity · Unknown Rule) are NOT amended by anything in this report.
---

# State of the Art: AI Knowledge Orchestration & Conversational Reasoning — Research Report for NEX

## Executive Framing

The central reframe of this research — *"How does an AI generate its own responses from evidence instead of retrieving pre-written answers?"* — aligns cleanly with the 2026 industry consensus. Production systems have moved from "vector search → LLM" to **stateful router-first pipelines** that (1) classify intent, (2) plan retrieval, (3) gather multiple evidence pieces, (4) judge sufficiency, and (5) compose an answer under groundedness constraints. This is the dominant architectural direction (LangGraph, LlamaIndex, Perplexity, GraphRAG, Haystack) and it maps well to NEX's five-layer / five-dimension architecture.

---

## A. State of the Art per Research Topic

### 1. Intent Classification

**Where the field is:** Three approaches coexist, each with distinct tradeoffs:

- **LLM zero/few-shot classification** — a small structured prompt asks the LLM to select from an enum (Buy/Learn/Compare/Design/Quote/Diagnose/Install/Materials/Images/Troubleshoot). Flexible, no training data, but variable and expensive per call.
- **Small dedicated classifiers** (ModernBERT, BGE, GTE, Qwen3-Embedding fine-tuned heads) — millisecond latency, ~96% accuracy on structured intent labels, but require labeled data and retraining when the label set grows.
- **Hybrid cascading routers** — heuristics first (length, obvious tokens), then a small classifier, then an LLM fallback for the uncertain tail. This is now the dominant production pattern.

**Key 2026 insight:** OpenAI's structured outputs (with `strict: true`) and Anthropic's tool-use schema make LLM-based intent classification reliable enough for production when the label set is well-defined enums. This is what makes a **five-dimension router** achievable without training a five-headed BERT model.

**Out-of-scope detection** matters as much as in-scope accuracy. Papers like MiniLM boundary learning and RefusalBench show frontier models drop below 50% refusal accuracy on multi-document tasks — meaning **an explicit "unknown" class is a first-class citizen**, not a fallback.

### 2. Multi-Stage Question Routing

**Where the field is:** The 2026 reference architecture is **router-first with lanes**:

- **Fast Lane** — cached / static / definitional (zero retrieval).
- **Standard Lane** — hybrid search (BM25 + dense + RRF + cross-encoder rerank).
- **Deep Lane** — agentic, multi-hop, tool-using, planning-required.

Concrete implementations:
- **LangGraph** models this as a `StateGraph` with `TypedDict` state and **conditional edges** — a router function inspects the state and returns the next node name. State persists via a checkpointer, so multi-turn routing is natural.
- **LlamaIndex Router Query Engine** uses an LLM selector (single or multi) to pick among named sub-engines; the **SubQuestionQueryEngine** decomposes a query into a plan of sub-questions against sub-indexes and then synthesizes.
- **Haystack** provides `TransformersTextRouter`, `TransformersZeroShotTextRouter`, `ConditionalRouter`, and `MetadataRouter` as composable branching primitives.
- **Perplexity** runs a six-stage pipeline: intent parsing → retrieval planning → hybrid retrieval → three-tier reranking → structured prompt assembly → LLM synthesis constrained by evidence.

**Key 2026 insight:** The router is not one classifier; it's a **pipeline of classifiers** where each stage narrows the search space. NEX's five dimensions (Intent → Subject → Brain → Knowledge Domain → Information Type) is architecturally identical to this cascading narrow-down pattern.

### 3. Retrieval-Augmented Generation (Evidence Orchestration)

**Where the field is:** "Naive RAG" (one embed, one search, one prompt) is now considered a legacy baseline. Production RAG in 2026 uses five canonical patterns:

1. **Iterative retrieval** — retrieve, reason, retrieve again until a stop condition.
2. **Query decomposition** — split into sub-queries, retrieve each in parallel.
3. **Hypothesis-driven retrieval** — HyDE and variants (with hallucination guardrails).
4. **Cross-corpus triangulation** — pull from multiple brains/indexes and reconcile.
5. **Evidence-weighted synthesis** — a judge model gates the answer for groundedness.

**Hybrid retrieval (BM25 + dense + RRF + cross-encoder rerank)** is the empirically dominant pattern. Reasons:
- Dense embeddings **smear identifiers, SKUs, version strings** into semantic neighborhoods → they fail on exact terms like "newel post" vs "newel cap."
- BM25 is transparent and exact but semantically blind → fails on paraphrase.
- Reciprocal Rank Fusion + reranker cuts retrieval failures **from ~35% to ~11%** in published benchmarks.

**Selective retrieval / evidence sufficiency judges** (SURE-RAG, "Trust or Abstain") are the emerging standard: the system predicts whether retrieved evidence *supports, refutes, or is insufficient* and abstains when support is absent. Direct match with NEX's Evidence First principle.

### 4. Knowledge Graphs

**Where the field is:** Microsoft's **GraphRAG** (open-sourced July 2024, now shipping inside Microsoft Discovery) established the reference pattern: extract entities and relations from unstructured text, build community hierarchies, and pre-summarize semantic clusters. Query time uses graph traversal for **multi-hop, relational, "why/how"** questions where pure vector retrieval fails.

Complementary patterns:
- **Graph Chain-of-Thought** — reasoning traversal produces a subgraph, which is then verbalized for the LLM.
- **KnowledgeNavigator** — LLM plans traversal steps over a knowledge graph.
- **HyperRAG** — n-ary facts on hypergraphs (useful when a fact involves >2 entities, e.g. `(oak, staircase, load-bearing, interior-only)`).
- **AtomicRAG** — atom-entity graphs where the *fact atom* is the retrievable unit.

**Consensus 2026 architecture:** hybrid **vector + graph + structured lookup**. Vector for candidate retrieval, graph for relational grounding and explainability, SQL/structured for exact-value lookups (dimensions, prices, codes). This is directly relevant to NEX because "the relationship graph" is already question 4 in the Terminology two-sentence rule.

### 5. Conversation Planning (When to Answer, Ask, Browse, Quote, Compare)

**Where the field is:** The field has crystallized around three concepts:

1. **Clarification need prediction** — a binary/multi-class classifier that decides *ambiguous vs. answerable* before any retrieval. Modern clarifying agents (CoA, STaR-GATE, SAGE-Agent) show +7% to +83% quality gains on ambiguous inputs vs. always-answer baselines.
2. **Dialogue state tracking (DST)** — the system maintains a **belief state** (slot → value assignments with confidence) that persists across turns. In 2026, memory is a first-class architectural component with its own benchmarks (mem0, MEMPROBE).
3. **Proactive dialogue policy** — an explicit decision head: `{answer, clarify, browse, quote, compare, defer, refuse}`. This is what NEX would call the "Judgement" layer.

**Empirical patterns:** Confidence-Aware RAG (Microsoft) and CoRefine show that combining **retrieval confidence + evidence sufficiency + intent confidence** into a single decision score dramatically reduces both over-answering (hallucination) and over-caution (excess refusal). Threshold tuning on a 0–4 scale with a starting point of ~1.5 is a documented baseline.

**Key insight for NEX:** The "Unknown Rule" is not exotic — it is the state-of-the-art selective-refusal pattern, articulated as constitutional law rather than a hyperparameter.

### 6. Response Planning (Compose vs. Retrieve)

**Where the field is:** Modern systems build a **response plan** as an explicit intermediate artifact — a small structured object like:

```
{
  intent: "compare",
  brains: ["timber", "installation"],
  needed_evidence: ["timber.oak.properties", "timber.pine.properties", ...],
  missing_evidence: ["timber.oak.hardness_kn"],
  clarifications_needed: [],
  composition_strategy: "tabular_comparison",
  citation_style: "inline_numeric"
}
```

Perplexity assembles a structured prompt with pre-embedded citation markers, then the LLM writes prose bound by that scaffold. Google Gemini's grounding API returns `groundingSupports` mapping each generated span back to `groundingChunks` — the plan is literally embedded in the output structure. LlamaIndex's SubQuestionQueryEngine generates a **query plan (DAG)** before executing. Recent work (QueryPlanner, Fang & Glass 2026) makes the DAG explicit.

**Key insight:** Composition is not "prompt the LLM with retrieved chunks." It is **plan → gather → judge → compose → attribute**, with the plan as a first-class artifact. This is the piece NEX most needs — it turns "generate from evidence" into engineering.

---

## B. Mapping State-of-the-Art Techniques to NEX's Six Diagnosed Router Failures

| # | Failure | Root Cause | State-of-Art Technique That Fixes It |
|---|---|---|---|
| 1 | *"What type of staircase?"* → returned **Installation** instead of Classification | Missing **Information-Type** dimension; keyword "staircase" dominated | **Structured intent+aspect classifier** (LLM with strict enum: `type_question` → Information Type = `Classification`). LlamaIndex Router Query Engine pattern with a `type/classification` sub-engine. |
| 2 | *"Straight flight oak staircase images"* → **Installation** instead of Reference Gallery | Modality signal (images) not extracted; treated as text query | **Facet extraction** (Google research, Multi-Facet Blending) — explicitly parse `modality: images`, `subject: straight-flight`, `material: oak`. Route on the `modality` facet first. |
| 3 | *"What size newel post?"* → **Definition** instead of Dimensions | Wh-word ("what") over-triggered; "size" as Information Type ignored | **Question-Type × Information-Type joint classifier**. "What size" is a canonical dimensional-value pattern, well-covered in the aspect-classification literature. Add a small labelled bank of Information Type patterns. |
| 4 | *"What woods are available?"* → **Timber knots** instead of Timber species | Dense embedding **lexical bleeding** — "wood" tokens pulled a specific-subtopic chunk | Classic **hybrid retrieval failure**. Fix with (a) BM25 + dense + RRF, (b) cross-encoder reranking, (c) **metadata-scoped retrieval** — Knowledge Domain filter (`species`, not `defects`) applied *before* the vector search. |
| 5 | *"need staircase"* → generic manufacturing fact instead of Purchase/Inquiry clarification | Under-specified query; no **clarification-need prediction** | **Clarification-need classifier** (CoA / STaR-GATE pattern). Confidence below threshold → dialogue policy returns `clarify` action, not `answer`. Directly implements NEX's Unknown Rule. |
| 6 | *"How much for straight flight stairs"* → unrelated sweeping-curved article instead of Pricing/Quote | Intent = `Quote` never classified; retriever fell to nearest vector neighbor | **Intent-first routing** with `Quote` as a top-level intent lane. Structured output enum forces classification; retrieval only runs *after* intent is set, scoped to the pricing brain. |

**Cross-cutting observation:** All six failures share the same root cause — **retrieval ran before classification was complete.** The state-of-the-art fix is uniform: **classify all dimensions first, then retrieve within the narrowed scope.** This is exactly NEX's five-dimension router intent, unimplemented.

---

## C. Architectural Principles That Fit NEX

### Principles to Adopt

1. **Router-First Pipeline (LangGraph pattern).** Model the runtime as a stateful graph. Each dimension is a node. Conditional edges route between them. State (the accumulating classification) is checkpointed per turn. This maps 1:1 to NEX's five-dimension router.
2. **Structured Outputs for Every Classification Stage (OpenAI/Anthropic pattern).** Every router stage returns a strict JSON object with an enum. This eliminates "close but wrong" outputs and makes each stage auditable — essential for the Trust Metric.
3. **Hybrid Retrieval Within Scoped Brains (Perplexity/Haystack pattern).** After Brain + Knowledge Domain are set, retrieve using BM25 + dense + RRF + cross-encoder rerank *scoped to that brain's evidence*. This directly kills the lexical-bleeding failures (#4).
4. **Evidence Sufficiency Judge (SURE-RAG pattern).** Before compose, a judge decides `sufficient | insufficient | conflicting`. Insufficient → clarify or defer. This is the mechanical implementation of the Unknown Rule.
5. **Response Plan as First-Class Artifact.** Between routing and composing, produce an explicit plan: `{intent, brain, needed_evidence, missing_evidence, questions_to_ask, composition_mode}`. Plan is observable, testable, and never stored — fits the Permanence Principle (plan is ephemeral, evidence pointers are permanent).
6. **Groundedness-Constrained Composition (Gemini grounding pattern).** Every generated span carries a pointer to the evidence atom it came from. Uncited spans are forbidden. This is what makes "generate from evidence" different from "retrieve pre-written answers."
7. **Faceted Classification for Information Type.** Classical library-science faceted classification (Ranganathan-style) is a near-perfect fit for NEX's Information Type dimension. It's mature, explainable, and non-ML — reality-tested for decades.
8. **Graph Traversal for Relationships (GraphRAG pattern).** Since NEX's two-sentence rule already produces a relationship graph as question 4, promoting those relationships to a query-time traversal layer is a small step that unlocks multi-hop reasoning without violating any principle.

### Principles That Would Violate NEX's Constitution

- **End-to-end fine-tuned routers** (e.g. RouterEval-style learned routers) — violate Vocabulary Elasticity (values become baked into weights) and Evidence First (opaque). Keep the router as a composed pipeline of interpretable classifiers with structured outputs.
- **Learned response synthesis heads** (e.g. RAG-fusion end-to-end training) — the LLM must not learn to produce content; it must only re-express evidence. Fine-tuning on Q&A pairs would violate both Permanence and the No-Q&A-Database ruling.
- **Reranker-only "just retrieve harder"** approaches — these push the problem into embedding quality rather than into a classified plan. NEX has already diagnosed the failure as *routing*, not *retrieval strength*.

---

## D. "Would NOT Recommend" List

Techniques popular in 2026 but incompatible with NEX's constitution:

1. **Q&A pair databases / stored response caches** — violates Permanence Principle; already rejected. Perplexity's "Fast Lane cache" is *not* stored answers, it's cached *retrieval*; do not confuse the two.
2. **Vector-search-only retrieval** — documented failure mode (lexical bleeding). Violates Trust Metric on the exact-term queries NEX depends on ("newel post," "straight flight").
3. **HyDE without a groundedness guard** — generates a hypothetical document to embed; this is a licensed hallucination path. Only acceptable behind a strict re-rank/verify gate, and never surfaced to the user.
4. **End-to-end fine-tuned intent routers** — opaque to reality signals, hard to extend when a new intent unlocks. Prefer composed classifiers with strict structured outputs.
5. **Learned dialogue policies (RL-trained "when to ask")** — the policy becomes untraceable; Unknown Rule needs to be enforceable as constitutional code, not learned behavior.
6. **Long-term "user profile memory" fabrics** (mem0-style persistent user memory) — violates Permanence for runtime state. Session state is fine; persistent per-user belief-state stores are not.
7. **"Answer at all costs" LLM synthesis** without an abstention gate — every frontier model tested by RefusalBench fails at selective refusal. The gate must be architectural, not prompted.
8. **Prompt-only routing** (no structured output enums) — variance is too high; failures like #1–#6 come from exactly this pattern.
9. **Auto-generated knowledge graphs from staircase corpus** without human curation — violates Evidence First. Graph relationships in NEX must come from Layer 1/2 authored evidence, not LLM entity extraction.
10. **Q&A-benchmark-driven optimisation** (RAGAS-style tuning against generated Q&A pairs) — moves the project backwards, already rejected.

---

## E. Recommended Implementation Sequence — Phase 2 Question Router Build

Given the current keyword-driven failure mode, this is the shortest sequence that fixes all six diagnosed failures without violating the constitution:

**Stage 0 — Instrumentation (Week 0, non-negotiable)**
- Log every question with the five router outputs (Intent, Subject, Brain, Knowledge Domain, Information Type) and the ground-truth expected output.
- Establish a small labelled corpus (~200 questions) covering the six diagnosed failures plus 20 more edge cases. This is your regression test forever.

**Stage 1 — Intent Classifier (Week 1)**
- LLM-based classifier with strict structured output. Enum: `Buy · Learn · Compare · Design · Quote · Diagnose · Install · Materials · Images · Troubleshoot · Unknown`.
- Confidence returned per call. `Unknown` returned when confidence < threshold OR when router cannot select.
- Fixes failures #1, #5, #6.

**Stage 2 — Facet / Information-Type Extractor (Week 2)**
- Parallel to Intent: extract `{modality, question_type, information_type}` as structured output.
- Question-type patterns as an authored table (not learned): `what size` → `Dimensions`; `what type` → `Classification`; `how much` → `Pricing`; `show me / images` → `Reference Gallery`.
- Fixes failures #1, #2, #3.

**Stage 3 — Brain + Knowledge Domain Router (Week 3)**
- Second LLM structured-output call, conditioned on Stage 1+2 outputs. Enum drawn from the registered brain manifest.
- If confidence < threshold → return `Unknown` and hand to clarification policy.

**Stage 4 — Scoped Hybrid Retrieval (Week 4)**
- Only after Stages 1–3 have resolved. Retrieval runs *inside* the chosen Brain + Knowledge Domain scope.
- BM25 + dense + RRF + cross-encoder rerank on the scoped candidate set.
- Fixes failure #4.

**Stage 5 — Evidence Sufficiency Judge (Week 5)**
- SURE-RAG-style: takes the retrieved evidence and the classified intent/facets, returns `sufficient | insufficient | conflicting`.
- Insufficient → clarification action. Conflicting → route to Wisdom / clarifying opener.
- Directly implements the Unknown Rule as executable code.

**Stage 6 — Response Plan Object (Week 6)**
- Produce the explicit plan artifact described in section C.5.
- Plan is logged for audit, not stored as knowledge.

**Stage 7 — Groundedness-Constrained Composer (Week 7)**
- Composer receives the plan and evidence atoms; every generated sentence must carry a citation pointer.
- Uncited spans rejected pre-emission.
- Fixes the "generate rather than retrieve" central question.

**Stage 8 — Regression Gate (Week 8)**
- The 200-question labelled corpus becomes the CI gate. Trust Metric threshold ≤ 5% incorrect enforced automatically on every router change.

**Order rationale:** Stages 1–3 fix the diagnosed routing failures with structured outputs alone (no retraining, no new infrastructure). Stages 4–5 fix the retrieval failures. Stages 6–7 realize "generate from evidence." Stage 8 protects the gains. Each stage is independently deployable and independently reversible.

---

## Uncertainties & Contested Ground

- **How much of the router should be LLM vs. small classifier** is still contested in 2026. Cascading (small first, LLM on hard tail) is the pragmatic winner for cost; pure LLM is the pragmatic winner for flexibility during scope-still-changing periods. For NEX in Phase 2, pure LLM structured outputs is the recommended starting point precisely because the label set will still evolve.
- **Graph-first vs. hybrid** is unresolved. GraphRAG is powerful but expensive to construct and maintain; for NEX's current one-brain (Terminology) scope, defer graph construction until the two-sentence-rule relationships accumulate enough mass to justify traversal. This aligns with Reality-Over-Speculation.
- **Learned dialogue policies vs. rule-based policies** — the research literature favors learned policies for open-domain, but rule-based (constitutional) policies are more auditable. NEX should stay rule-based until reality demonstrates a specific failure that rules cannot express.

---

## Sources

- Router Query Engine — LlamaIndex · https://docs.llamaindex.ai/en/v0.10.22/examples/query_engine/RouterQueryEngine/
- Sub Question Query Engine — LlamaIndex · https://llamaindexxx.readthedocs.io/en/latest/examples/query_engine/sub_question_query_engine.html
- LangGraph Stateful Agent Graphs Explained (2026) · https://futureagi.com/blog/what-is-langgraph-2026/
- Graph-Based Agent Workflow Orchestration in Production — Zylos · https://zylos.ai/research/2026-04-14-graph-based-agent-workflow-orchestration-production/
- Query Classification with Haystack TransformersTextRouter · https://haystack.deepset.ai/tutorials/41_query_classification_with_transformerstextrouter_and_transformerszeroshottextrouter
- Advanced RAG: Query Decomposition & Reasoning — Haystack · https://haystack.deepset.ai/blog/query-decomposition
- Enterprise RAG Blueprint: Router-First + Hybrid Search · https://staituned.com/learn/midway/rag-reference-architecture-2026-router-first-design
- Agentic RAG in 2026: Patterns, Code, Observability · https://futureagi.com/blog/agentic-rag-systems-2025/
- Agentic RAG Patterns 2026: Multi-Step Reasoning Guide · https://www.digitalapplied.com/blog/agentic-rag-patterns-multi-step-reasoning-guide
- Beyond Naive RAG: Building Agentic RAG in 2026 · https://medium.com/@vkrishnan9074/beyond-naive-rag-a-step-by-step-guide-to-building-agentic-rag-in-2026-fceddd989c74
- How Perplexity AI Answers Work — ZipTie · https://ziptie.dev/blog/how-perplexity-ai-answers-work/
- Behind Perplexity's Architecture — Frugal Testing · https://www.frugaltesting.com/blog/behind-perplexitys-architecture-how-ai-search-handles-real-time-web-data
- Project GraphRAG — Microsoft Research · https://www.microsoft.com/en-us/research/project/graphrag/
- GraphRAG: Unlocking LLM discovery on narrative private data · https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/
- Knowledge Base vs Knowledge Graph for LLM Systems (2026) · https://www.kloia.com/blog/knowledge-base-vs-knowledge-graph-llm
- Improve multi-hop reasoning with knowledge graphs — Neo4j · https://neo4j.com/blog/genai/knowledge-graph-llm-multi-hop-reasoning/
- Grounding with Google Search — Gemini API · https://ai.google.dev/gemini-api/docs/google-search
- Generate grounded answers with RAG — Google Cloud · https://docs.cloud.google.com/generative-ai-app-builder/docs/grounded-gen
- Tool use with Claude — Anthropic Docs · https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Programmatic tool calling — Anthropic Docs · https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
- Introducing Structured Outputs in the API — OpenAI · https://openai.com/index/introducing-structured-outputs-in-the-api/
- Function calling — OpenAI API · https://developers.openai.com/api/docs/guides/function-calling
- RefusalBench: Selective Refusal in Grounded Language Models · https://arxiv.org/html/2510.10390v1
- SURE-RAG: Sufficiency and Uncertainty-Aware Evidence Verification · https://arxiv.org/html/2605.03534
- Trust or Abstain? A Self-Aware RAG Approach · https://arxiv.org/pdf/2605.18792
- Confidence-Aware RAG — Microsoft Community Hub · https://techcommunity.microsoft.com/blog/azuredevcommunityblog/confidence-aware-rag-teaching-your-ai-pipeline-to-acknowledge-uncertainty/4515061
- Reasoning-enhanced Query Understanding through Decomposition · https://arxiv.org/html/2509.06544v1
- Small models, big results: intent extraction through decomposition — Google Research · https://research.google/blog/small-models-big-results-achieving-superior-intent-extraction-through-decomposition/
- Dynamic Model Routing and Cascading for LLM Inference: A Survey · https://arxiv.org/html/2603.04445v2
- Clarifying Agent in Dialogue Systems — Emergent Mind · https://www.emergentmind.com/topics/clarifying-agent
- Survey on Proactive Dialogue Systems · https://arxiv.org/pdf/2305.02750
- AI Agent Memory 2026 — mem0 State of the Art · https://mem0.ai/blog/state-of-ai-agent-memory-2026
- Hybrid Search: BM25, Vector & Reranking Reference 2026 · https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026
- Why Vector Search Alone Isn't Enough — InfoQ · https://www.infoq.com/articles/vector-search-hybrid-retrieval-rag/
- RAG Failure Mode Checklist — LlamaIndex · https://developers.llamaindex.ai/python/framework/optimizing/rag_failure_mode_checklist/
- Faceted classification — Wikipedia · https://en.wikipedia.org/wiki/Faceted_classification
- From Retrieval to Evidence Sufficiency — Medium / Joshua Yu · https://medium.com/@yu-joshua/from-retrieval-to-evidence-sufficiency-why-rag-needs-a-judge-before-it-answers-8719596bea75
- 20 Advanced RAG Types to Know in 2026 — Turing Post · https://www.turingpost.com/p/ragtypes

---

## Gatekeeper Reference-Position Note (per Philip 2026-07-31)

This is reference material · not architecture. Constitution stays Philip's. Standard v1 stays Philip's. Router Validation Suite defines success. Any technique proposed here must be evaluated against the Validation Suite pass/fail before adoption. Nothing in this report amends any constitutional principle.
