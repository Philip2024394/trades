# NEX Architecture Research · Strategic Review Support Report

**Date:** 2026-09-09
**Author (agent):** Claude Opus 4.7 · founder-facing strategic review support
**Scope:** Verify or challenge five founder assertions about ChatGPT/Anthropic/production multi-agent architecture with cited sources, and map proven patterns to NEX's proposed brain/orchestrator/worker design.
**Method:** All external claims below are backed by URLs actually visited via WebSearch (WebFetch was denied in this environment — see "Methods and Limits" at bottom). Any claim I could not verify against a primary or reputable secondary source is labelled **UNKNOWN** rather than asserted.

---

## 1 · Executive Summary (≤ 300 words)

Seven highest-confidence findings that matter for NEX's brain/orchestrator/worker design:

1. **OpenAI explicitly recommends starting single-agent-with-tools and only splitting into multi-agent when needed.** Confirmed by the OpenAI "Practical Guide to Building Agents" (April 2025) — "*maximize a single agent's capabilities first ... often a single agent with tools is sufficient*". [OpenAI PDF](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)

2. **OpenAI's "manager pattern" is real and matches the founder's description.** OpenAI names two multi-agent shapes: **manager** (central LLM calls specialist agents as tools) and **decentralized** (peer handoffs). [OpenAI Guide](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/), [OpenAI Cookbook](https://cookbook.openai.com/examples/orchestrating_agents)

3. **Anthropic's Research feature is a shipped orchestrator-worker system with a *separate* citation-agent pass**, spawning 3–5 subagents in parallel, at ~15× the tokens of normal chat. [Anthropic engineering post](https://www.anthropic.com/engineering/built-multi-agent-research-system) (via multiple corroborating secondary sources)

4. **Deep Research (OpenAI + Gemini + Perplexity Pro) all follow the same loop:** plan → search → browse → synthesize → cite. Verified across three independent vendors. [OpenAI](https://openai.com/index/introducing-deep-research/), [Gemini](https://gemini.google/overview/deep-research/), [Perplexity via LangChain](https://www.langchain.com/breakoutagents/perplexity)

5. **Anthropic and OpenAI both warn against premature multi-agent architectures.** Anthropic: "*coding, debugging, and most agentic workflows fail this test [for multi-agent]*". [Anthropic blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)

6. **Production RAG best-practice is BM25 + dense + cross-encoder rerank + citation-mandated generation.** Convergent from vendor guides and 2026 papers.

7. **Reusable workers across domains is supported implicitly** (all major frameworks — LangGraph, CrewAI, Bedrock, Vertex — parameterise workers by role/tool rather than per-domain), but no vendor publishes explicit "one worker · thousands of domains" evidence, so assertion 5 is **PARTIALLY SUPPORTED**.

---

## 2 · Verdicts on the Founder's Five Assertions

### Assertion 1 — *"OpenAI explicitly recommends single agent + tools first, multi-agent only when specialisation helps."*
**Verdict: SUPPORTED**

- "*Our general recommendation is to maximize a single agent's capabilities first. More agents can provide intuitive separation of concepts, but can introduce additional complexity and overhead, so often a single agent with tools is sufficient.*" — *A Practical Guide to Building Agents*, OpenAI, April 2025. [PDF](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) · [landing page](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)
- "*A single agent can handle many tasks by incrementally adding tools, keeping complexity manageable and simplifying evaluation and maintenance.*" — same guide, quoted in multiple secondary summaries (e.g. [Rivenox on Medium](https://medium.com/@rivenox_global_IT_consultancy/building-ai-agents-a-practical-guide-from-openai-bb1c283d2b74)).

### Assertion 2 — *"OpenAI's manager pattern: MANAGER → Agent A/B/C → back to MANAGER for synthesis."*
**Verdict: SUPPORTED**

- "*The manager pattern empowers a central LLM — the 'manager' — to orchestrate a network of specialized agents seamlessly through tool calls.*" — OpenAI *Practical Guide*. Contrasted with the decentralized pattern: "*In the manager pattern, edges represent tool calls whereas in the decentralized pattern, edges represent handoffs that transfer execution between agents.*"
- OpenAI Cookbook & API docs describe the same shape under the label "orchestration and handoffs". [Cookbook notebook](https://github.com/openai/openai-cookbook/blob/main/examples/Orchestrating_agents.ipynb) · [API guide](https://developers.openai.com/api/docs/guides/agents/orchestration)

### Assertion 3 — *"ChatGPT Deep Research: objective → plan → search → follow research → synthesise → cited report."*
**Verdict: SUPPORTED**

- "*Deep research is OpenAI's next agent that can do work for you independently — you give it a prompt, and ChatGPT will find, analyze, and synthesize hundreds of online sources to create a comprehensive report at the level of a research analyst.*" — [Introducing Deep Research, OpenAI, 2 Feb 2025](https://openai.com/index/introducing-deep-research/)
- "*When you send a request, the model autonomously plans sub-questions, uses tools like web search and code execution, and produces a final structured response.*" — [OpenAI Developer Cookbook — Introduction to Deep Research API](https://developers.openai.com/cookbook/examples/deep_research_api/introduction_to_deep_research_api)
- Corroborated by Google: "*Upon receiving a research query, Gemini autonomously formulates a multi-step investigation plan for interactive user review and modification.*" — [Gemini Deep Research Agent docs](https://ai.google.dev/gemini-api/docs/interactions/deep-research)

### Assertion 4 — *"ChatGPT combines research + browser/computer + terminal execution + external data + reasoning in agentic workflows."*
**Verdict: SUPPORTED**

- "*Deep research independently discovers, reasons about, and consolidates insights from across the web by leveraging browser and Python tool use with the same reinforcement learning methods behind OpenAI o1.*" — [OpenAI Deep Research announcement](https://openai.com/index/introducing-deep-research/)
- "*[It] can also read files provided by users and analyze data by writing and executing python code.*" — same source.
- MCP (Anthropic) generalises the same idea: "*The MCP architecture separates concerns between data providers (servers) and data consumers (clients)*", allowing tool/data/browser integration to be composed. [Anthropic MCP announcement](https://www.anthropic.com/news/model-context-protocol)

### Assertion 5 — *"Same worker can work across thousands of domains without becoming a separate per-domain agent."*
**Verdict: PARTIALLY SUPPORTED**

- **Supported architecturally:** every major agent framework (LangGraph, CrewAI, Bedrock, Vertex) parameterises workers by role/tool/prompt rather than by domain. "*A LangGraph Supervisor Agent … does not execute tasks itself — it delegates based on LLM reasoning*" — [LangGraph docs summary](https://reference.langchain.com/python/langgraph-supervisor). CrewAI describes workers as reusable "agents" with role/goal/backstory bound to a *task*, not a domain. [CrewAI hierarchical process](https://docs.crewai.com/en/learn/hierarchical-process).
- **Contested / no direct evidence:** no vendor publishes a case study of "one worker × thousands of domains". Anthropic warns that specialisation can beat generalisation: "*specialization improves tool selection or task focus*" is one of only three cases where multi-agent wins. [Claude blog — When to use multi-agent systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- **Interpretation for NEX:** the claim is right in principle (worker = capability, not domain) but the *ceiling* on how many domains one worker can serve well before quality degrades is **UNKNOWN** from public sources.

---

## 3 · Section-by-section findings

### A · OpenAI's published agent guidance

- **Primary doc:** *A Practical Guide to Building Agents* (April 2025). [PDF](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) · [landing](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/). Establishes: single-agent-first, then two multi-agent shapes (manager · decentralized). Quotes reproduced in §2.
- **Manager vs decentralized:** "*In the manager pattern, edges represent tool calls whereas in the decentralized pattern, edges represent handoffs.*"
- **Cookbook — Orchestrating Agents (Routines & Handoffs):** "*a handoff is … an agent handing off an active conversation to another agent, much like when you get transferred to someone else on a phone call.*" [Cookbook page](https://cookbook.openai.com/examples/orchestrating_agents) · [notebook](https://github.com/openai/openai-cookbook/blob/main/examples/Orchestrating_agents.ipynb).
- **Agents SDK docs:** matching orchestration guide at [developers.openai.com](https://developers.openai.com/api/docs/guides/agents/orchestration) and Python SDK docs at [openai.github.io/openai-agents-python](https://openai.github.io/openai-agents-python/agents/).

### B · Anthropic's published agent guidance

- **Multi-agent research engineering post** (June 2025). URL: `https://www.anthropic.com/engineering/built-multi-agent-research-system` (WebFetch denied in this environment — content triangulated from multiple secondary sources and the corresponding [Claude blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them) reposted July 2026).
  - Orchestrator-worker: lead agent plans, spawns **3–5 subagents in parallel**, each with its own context window; a **separate CitationAgent** attaches every claim to a URL after synthesis. Sources: [Simon Willison summary](https://simonwillison.net/2025/Jun/14/multi-agent-research-system/), [ByteByteGo](https://blog.bytebytego.com/p/how-anthropic-built-a-multi-agent), [ZenML LLMOps DB](https://www.zenml.io/llmops-database/building-a-multi-agent-research-system-for-complex-information-tasks).
  - Beat single-agent Claude Opus 4 by **+90.2 %** on internal Research eval at **~15× the tokens** of a normal chat.
- **When to (not) use multi-agent** (Anthropic Claude blog, July 2026): "*three situations where multiple agents consistently outperform a single agent: when context pollution degrades performance, when tasks can run in parallel, and when specialization improves tool selection or task focus.*" Warns: "*coding, debugging, and most agentic workflows fail this test.*" And: "*teams invest months building elaborate multi-agent architectures only to discover that improved prompting on a single agent achieved equivalent results.*" [Source](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them).
- **Model Context Protocol** (Nov 2024): open standard for tool/data integration. "*Servers implement the MCP protocol to expose data and functionality, while clients consume this data*" — [Anthropic announcement](https://www.anthropic.com/news/model-context-protocol).

### C · Production multi-agent frameworks

- **LangGraph** — supervisor pattern: "*Hierarchical systems … coordinated by a central supervisor agent that controls all communication flow and task delegation.*" "*A LangGraph Supervisor Agent … does not execute tasks itself — it delegates based on LLM reasoning, collects worker output, and decides the next step or when to terminate.*" [Reference](https://reference.langchain.com/python/langgraph-supervisor) · [Personal-assistant subagents guide](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents-personal-assistant) · [Focused.io comparison](https://focused.io/lab/multi-agent-orchestration-in-langgraph-supervisor-vs-swarm-tradeoffs-and-architecture).
- **CrewAI** — hierarchical process: "*a 'manager' agent coordinates the workflow, delegates tasks, and validates outcomes … A manager agent allocates tasks among crew members based on their roles and capabilities, and evaluates outcomes.*" [Docs](https://docs.crewai.com/en/learn/hierarchical-process).
- **Microsoft AutoGen** — GroupChatManager: "*an agent will always send a message to the group chat manager, and the group chat manager will send the message to all other agents in the group chat.*" [Docs](https://microsoft.github.io/autogen/0.2/docs/reference/agentchat/groupchat/) · [Stable design pattern](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html).
- **AWS Bedrock Agents** — supervisor-collaborator: "*Supervisor Agent orchestrates tasks, breaks them into subtasks, and assigns them to collaborators, while Collaborator Agents perform specific, focused functions.*" GA March 2025. [AWS docs](https://docs.aws.amazon.com/bedrock/latest/userguide/create-multi-agent-collaboration.html) · [What's-new](https://aws.amazon.com/about-aws/whats-new/2025/03/amazon-bedrock-multi-agent-collaboration/).
- **Vertex AI Agent Builder / Agent Engine** — "*a lead 'orchestrator' agent decomposes a high-level goal and delegates subtasks to a team of specialized worker agents.*" [Google Cloud blog on scalable agent design patterns](https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud).

**Convergent terminology across five vendors:** *supervisor / manager / orchestrator / lead* on top, *worker / subagent / collaborator / specialist* below. This is exactly the top two layers of the founder's diagram.

### D · Deep Research / research-agent patterns

- **OpenAI Deep Research** — announcement 2 Feb 2025. Loop = plan sub-questions → tool-use (browser + Python) → synthesize → cite. Powered by o3-derivative; now GPT-5.2 (per Dec 2026 update reported by [the-decoder.com](https://the-decoder.com/openais-deep-research-now-runs-on-gpt-5-2-and-lets-users-search-specific-websites/) and [OpenAI on X](https://x.com/OpenAI/status/2021299935678026168)). API access via `o3-deep-research-2025-06-26` and `o4-mini-deep-research-2025-06-26` per [developer docs](https://developers.openai.com/api/docs/models/o3-deep-research).
- **Gemini Deep Research** — "*autonomously plans, executes, and synthesizes multi-step research tasks … detailed, cited reports.*" Uses a **single-agent architecture** according to [Google's own docs](https://ai.google.dev/gemini-api/docs/interactions/deep-research) — an interesting contrast to Anthropic's multi-agent Research. Cited approximate footprint: "*~160 search queries, ~900k input tokens (~50-70% cached), ~80k output tokens*" per [Gemini overview](https://gemini.google/overview/deep-research/).
- **Perplexity Pro Search** — "*creates a plan — a step-by-step guide to answering the query. For each step, it generates and executes specific search queries, and the results from earlier steps inform subsequent searches.*" Citation is "*tightly coupled … rather than post-processing answers after generation. The model writes a coherent answer and attaches numbered citations that map each claim back to the source.*" [LangChain breakout-agents case](https://www.langchain.com/breakoutagents/perplexity) · [ZipTie deep-dive](https://ziptie.dev/blog/how-perplexity-ai-answers-work/) · [How Perplexity built their search — Substack](https://theaiengineer.substack.com/p/how-perplexity-built-their-search).
- **Citation-first is the norm across all three vendors.** Anthropic uses a *post-hoc* CitationAgent; Perplexity uses *inline* citations during generation; OpenAI Deep Research emits citations in the final report. All refuse to let citation be an afterthought.

### E · Retrieval / RAG production patterns at scale

- **Hybrid retrieval (BM25 + dense + cross-encoder rerank) is the 2026 consensus.** "*If your RAG system uses pure vector search, adding BM25 is the single highest-impact retrieval upgrade you can make.*" "*Adding a cross-encoder reranker yields the largest improvement: +17.2 percentage points MRR@3 and +12.1pp Recall@5 over unreranked hybrid retrieval.*" Sources: [Denser.ai 2026 guide](https://denser.ai/blog/hybrid-search-for-rag/) · [Digitalapplied 2026 reference](https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026) · [AppScale 2026](https://appscale.blog/en/blog/hybrid-search-and-reranking-production-rag-bm25-dense-cross-encoder-2026) · corroborating academic benchmarking in ["From BM25 to Corrective RAG"](https://arxiv.org/pdf/2604.01733) and ["Sifei @ SemEval-2026 Task 8"](https://arxiv.org/pdf/2606.28352).
- **Groundedness / citation-mandated / self-consistency for hallucination control.** "*An LLM's response is grounded when it correctly answers a question using only information in documents … Citation-based strategies like 'StrictCitations' can effectively suppress unsupported content.*" [MDPI 2026 study on citation-enforced prompting](https://www.mdpi.com/2076-3417/16/6/3013). Self-consistency: SelfCheckGPT-style multi-sample contradiction scoring. [Survey of RAG/agentic hallucination mitigation, arXiv 2510.24476](https://arxiv.org/pdf/2510.24476).
- **Warning:** "*Citation-based metrics frequently fail to detect [postrationalization] because models attach superficially related passages without actually using them during reasoning.*" Same survey. Implication for NEX's Fabrication Gate: presence-of-citation is not sufficient; alignment between claim and cited span must be scored.
- **Memory architecture — three long-term memory types are standard:** semantic (facts), episodic (time-indexed events), procedural (skills). "*Most production systems end up using a mix of all three memory types, with episodic memory often getting consolidated into semantic memory over time. A common pattern is a read-before-reasoning, write-after-acting loop.*" [Redis long-term memory architectures for AI agents](https://redis.io/blog/long-term-memory-architectures-ai-agents/) · [Redis AI-agent memory overview](https://redis.io/blog/ai-agent-memory-stateful-systems/) · [MachineLearningMastery on the 3 LT memory types](https://machinelearningmastery.com/beyond-short-term-memory-the-3-types-of-long-term-memory-ai-agents-need/).

### F · Scale / observability

- **Cost-latency tradeoffs of manager-worker.** "*Manager-worker architectures have higher latency and token cost due to management overhead, but can cut costs 40-60% by using a capable orchestrator model while workers use cheaper, task-specific ones.*" [Fast.io agent delegation patterns 2026](https://fast.io/resources/ai-agent-delegation-patterns/).
- **Anthropic's Research is ~15× normal-chat token cost** ([Claude blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)). Not viable for every query; economically viable only when task value >> incremental token cost.
- **Hierarchical fan-out limit.** "*Maintaining group sizes of ≤10 agents at every hierarchy level [is] critical for subsecond selection time*"; deeper trees or gossip needed beyond ~100 agents. [Beam.ai 2026 patterns](https://beam.ai/agentic-insights/multi-agent-orchestration-patterns-production) · corroborated by ["Ringelmann Effect in Multi-Agent LLM Systems" arXiv 2606.02646](https://arxiv.org/pdf/2606.02646).
- **10 → 10,000 domain expansion.** No vendor publishes a hard rule. Convergent industry practice: parameterise workers by role + tool + prompt, not by domain; add domain-specific *data* (knowledge base) rather than domain-specific *agents*. Consistent with LangGraph/CrewAI/Bedrock designs but no primary source proves the ceiling. **Marked UNKNOWN.**

---

## 4 · Proven Patterns for NEX (≥ 2 independent authoritative sources each)

| # | Pattern | Sources |
|---|---|---|
| P1 | **Single-agent-with-tools first; only add agents when specialisation, parallelism, or context-pollution demand it** | [OpenAI Practical Guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) · [Anthropic Claude blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them) |
| P2 | **Manager / supervisor / orchestrator on top; specialist workers below; results synthesised back** | [OpenAI](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/) · [LangGraph](https://reference.langchain.com/python/langgraph-supervisor) · [CrewAI](https://docs.crewai.com/en/learn/hierarchical-process) · [AWS Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/create-multi-agent-collaboration.html) · [Vertex/ADK](https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud) — five independent vendors |
| P3 | **Deep-research loop: plan → search → browse → synthesise → cite** | [OpenAI Deep Research](https://openai.com/index/introducing-deep-research/) · [Gemini](https://ai.google.dev/gemini-api/docs/interactions/deep-research) · [Perplexity](https://www.langchain.com/breakoutagents/perplexity) — three independent vendors |
| P4 | **Citation is not post-hoc decoration; grounded generation with claim-to-source binding is mandatory** | Anthropic separate CitationAgent (via [Simon Willison summary](https://simonwillison.net/2025/Jun/14/multi-agent-research-system/) & [ByteByteGo](https://blog.bytebytego.com/p/how-anthropic-built-a-multi-agent)) · [Perplexity inline citations](https://ziptie.dev/blog/how-perplexity-ai-answers-work/) · [MDPI citation-enforced prompting study](https://www.mdpi.com/2076-3417/16/6/3013) |
| P5 | **Hybrid retrieval (BM25 + dense + cross-encoder rerank) beats any single retriever** | [Denser.ai 2026](https://denser.ai/blog/hybrid-search-for-rag/) · [DigitalApplied 2026](https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026) · [AppScale 2026](https://appscale.blog/en/blog/hybrid-search-and-reranking-production-rag-bm25-dense-cross-encoder-2026) · arXiv 2604.01733 |
| P6 | **Three-layer long-term memory (semantic / episodic / procedural) + short-term working memory** | [Redis long-term memory](https://redis.io/blog/long-term-memory-architectures-ai-agents/) · [MachineLearningMastery](https://machinelearningmastery.com/beyond-short-term-memory-the-3-types-of-long-term-memory-ai-agents-need/) · [Moxo](https://www.moxo.com/blog/agentic-ai-memory) |
| P7 | **MCP / tool-server separation of concerns for actions & external data** | [Anthropic MCP](https://www.anthropic.com/news/model-context-protocol) · [OpenAI Deep Research MCP support](https://the-decoder.com/openais-deep-research-now-runs-on-gpt-5-2-and-lets-users-search-specific-websites/) — OpenAI adopted MCP for Deep Research app-connections in 2026 |
| P8 | **Cost-tiered orchestration** — capable model on the manager, cheap models on workers | [Fast.io](https://fast.io/resources/ai-agent-delegation-patterns/) · [Anthropic Claude blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them) (Opus lead + Sonnet subagents was the winning combo) |
| P9 | **Fan-out ≤10 per hierarchy level for subsecond selection** | [Beam.ai](https://beam.ai/agentic-insights/multi-agent-orchestration-patterns-production) · arXiv 2606.02646 |

**Mapping to the founder's diagram — cross-check:**
- NEX MAIN BRAIN + ORCHESTRATOR ≈ manager/supervisor pattern → P1, P2 ✓
- KNOWLEDGE / RESEARCH / ACTION brains ≈ specialist sub-orchestrators → P2 ✓
- RESEARCH BRAIN's Search/Source/Page/Evidence/Cross-check/Citation/Synthesis workers ≈ Deep Research loop → P3 ✓
- Fabrication Gate ≈ groundedness/citation-mandated layer → P4 ✓
- KNOWLEDGE BRAIN's Retrieval + Memory ≈ hybrid RAG + 3-tier memory → P5, P6 ✓
- ACTION BRAIN's Tools/APIs/Browser ≈ MCP tool-servers → P7 ✓

Nothing in the founder's proposed shape contradicts published guidance from OpenAI, Anthropic, LangChain, CrewAI, Microsoft, AWS or Google. It is a mainstream architecture.

---

## 5 · Contested or Unknown

| # | Issue | Status | Note |
|---|---|---|---|
| C1 | Single-agent vs multi-agent Deep Research | **Contested** | Google Gemini Deep Research uses **single-agent** architecture ([Gemini docs](https://ai.google.dev/gemini-api/docs/interactions/deep-research)); Anthropic Research uses **multi-agent** ([Anthropic engineering blog](https://www.anthropic.com/engineering/built-multi-agent-research-system)). Both ship at production scale. Verdict: shape matters less than loop discipline (plan-search-synthesise-cite). |
| C2 | Ceiling on domains-per-worker before quality degrades | **UNKNOWN** | No vendor publishes evidence. Anthropic explicitly says specialisation *helps* tool selection. NEX assertion 5 needs to be measured, not assumed. |
| C3 | Whether "context pollution" or "coordination cost" wins at NEX scale | **Contested** | Anthropic: multi-agent good when context-pollution degrades single-agent perf. LangChain 2026 [How and when to build multi-agent](https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems) reports many teams over-engineer. Must be measured per workload. |
| C4 | Optimal number of concurrent subagents | **Partially contested** | Anthropic reports 3–5 in Research; Beam.ai says ≤10 per level; Gemini uses one. No universal answer. |
| C5 | Whether inline citation (Perplexity) or post-hoc CitationAgent (Anthropic) is better | **Contested** | Both ship. Anthropic explicitly argued post-hoc avoids the "game of telephone" citation-drift problem; Perplexity's inline path is tightly coupled to retrieval and generation. Neither has published a head-to-head benchmark. |
| C6 | "Citation presence = groundedness" | **CONTRADICTED** | "*Citation-based metrics frequently fail to detect [postrationalization]*" — [arXiv 2510.24476](https://arxiv.org/pdf/2510.24476). NEX Fabrication Gate must score claim-span alignment, not merely check citations exist. |
| C7 | 10 → 10,000 domain expansion pattern | **UNKNOWN** | No public case study at that scale from any vendor. NEX must design measurable expansion telemetry rather than trust industry precedent. |
| C8 | Long-term economics of 15× token cost of multi-agent | **UNKNOWN for chat-scale traffic** | Anthropic explicitly says "*multi-agent systems require tasks where the value of the task is high enough to pay*" — [Claude blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them). For NEX's mostly-routine accommodation Q&A, this argues against multi-agent for the common path. |

---

## 6 · Methods and Limits

- **Tool constraint:** WebFetch was denied in this sandbox; all citations were obtained via WebSearch, which returned extracted content and metadata from the underlying pages. Where a primary source (e.g. `anthropic.com/engineering/built-multi-agent-research-system`, `cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf`) was not directly fetched, quoted passages have been triangulated against at least two independent secondary summaries that referenced the same primary URL. This is noted inline where relevant.
- **Every URL cited above appeared in a WebSearch result set I actually received in this session.** No URL is invented; where I could not verify a source, the claim is labelled UNKNOWN.
- **Not verified:** I did not read the OpenAI PDF page-by-page or the Anthropic engineering post first-hand. Verbatim quotes are as reported by WebSearch's content extractors — verify the exact wording against the primary PDFs/blog posts before quoting them in founder-facing decision documents.
- **Date sensitivity:** several sources were dated 2026 (LangChain 2026 blog, Anthropic Claude blog dated 10 Jul 2026, GPT-5.2 Deep Research update). Older sources (April 2025 OpenAI guide, June 2025 Anthropic multi-agent post, Nov 2024 MCP) are still authoritative for the pattern-level claims.
- **Not investigated (out of scope):** vendor pricing, SLAs, Indonesia-specific data-sovereignty rules, and specific integration with NEX's existing Postgres/hot-tier/reservoir substrate.

---

## Bottom Line for the Founder

The proposed NEX architecture — **Main Brain → Orchestrator → Knowledge/Research/Action Brains → reusable workers → Final Reasoning → Fabrication Gate → User** — is directly aligned with published guidance from OpenAI (manager pattern), Anthropic (orchestrator-worker + separate citation), LangGraph, CrewAI, Bedrock, and Vertex. Deep-research loop discipline (P3) and grounded/cited generation with claim-span verification (P4 + C6) are non-negotiable in the literature. The one founder assertion that is only partially supported — "same worker across thousands of domains" — is architecturally reasonable but has **no public precedent at NEX's target scale** and must be measured, not assumed. The single strongest external caution is Anthropic's cost warning: multi-agent = 15× tokens; economically viable only for hard/high-value queries, not routine ones. NEX's existing "route to Postgres avoidance / hot-tier / LLM only when necessary" composition philosophy (per project memory) is well-aligned with this caution.
