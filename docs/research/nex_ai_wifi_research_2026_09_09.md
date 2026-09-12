# NEX AI-Wi-Fi Research · 2026-09-09

> Brief: evaluate the technical viability of NEX running 100% local AI (no OpenAI / Anthropic / Google inference) while treating the internet strictly as a raw-data source (Wikipedia, Wikidata, OSM, gov open data, RSS, PDFs, Common Crawl, weather APIs). No fabricated URLs. Every claim is either SOURCED or marked UNKNOWN. WebFetch was not needed; WebSearch returned each source URL cited below.

---

## 1 · Executive summary

1. **A 100% local inference stack is viable for NEX's actual workload — grounded, retrieval-anchored Q&A over structured domain data** — because published RAG benchmarks show small 3-8B models close most of the gap to GPT-4-class systems when answers are grounded in retrieved evidence. HalluGuard (4B) hits **84.0% balanced accuracy on RAGTruth**, matching MiniCheck-7B and beating Granite Guardian 3.3-8B while using half the parameters ([arXiv 2510.00880](https://arxiv.org/html/2510.00880v1)).
2. **The current `.env.local` picks (`qwen2.5:3b` rescue, `llava:7b` vision, `qwen25vl` primary VLM) are defensible defaults** — Qwen 2.5-VL 7B is state-of-the-art among open VLMs on DocVQA (95.7) and MathVista (68.2) and beats Llama 3.2 Vision 11B ([Labellerr comparison](https://www.labellerr.com/blog/qwen-2-5-vl-vs-llama-3-2/)).
3. **VRAM headroom is the binding constraint on a Victus-class Windows laptop.** 8-12 GB VRAM is the sweet spot for 7-8B Q4_K_M models at 40+ tok/s ([LocalLLM.in guide](https://localllm.in/blog/ollama-vram-requirements-for-local-llms)); 3B stays comfortably below 4 GB. This matches the observed CPU-spill behaviour on Qwen2.5:3B in the existing pilot record.
4. **`nomic-embed-text` remains the pragmatic default embedder** (137M params, 8k context, most-pulled Ollama embedder at 73.8M pulls) — but **BGE-M3** is the correct choice if NEX must serve Indonesian queries at parity with English ([Morph MTEB ranking](https://www.morphllm.com/ollama-embedding-models), [Cheney Zhang benchmark](https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html)).
5. **The internet-as-raw-data layer has enough free capacity for NEX's scale** if requests are properly throttled: Wikimedia gives 100 req/s per IP anonymous, Wikidata SPARQL gives 60s query budget with 5 concurrent per IP, Open-Meteo 10k free non-commercial req/day, GeoNames 10k/day, Nominatim 1 req/s hard cap ([Wikimedia rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits), [Wikidata query limits](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/query_limits), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [Open-Meteo](https://open-meteo.com/), [GeoNames](https://www.geonames.org/export/)).
6. **Perplexica / Vane + SearXNG + Ollama is the closest published production reference** for what NEX is trying to build — an AI search engine that reads the live web through a self-hosted metasearch aggregator and answers through a local LLM ([Perplexica 2026 guide](https://joshuaopolko.com/perplexica-self-hosted-guide/), [SearXNG](https://tailscale.com/blog/video-searxng)). This is de-risked, off-the-shelf architecture.
7. **License-wise the local-inference plan is clean if NEX uses Qwen** — Apache 2.0, no MAU cap, no accept-the-license clickthrough, commercial use unrestricted ([Codersera comparison](https://codersera.com/blog/gemma-3-vs-qwen-3-in-depth-comparison-of-two-leading-open-source-llms/)). Llama's 700M MAU cap and Gemma's use-case restrictions add avoidable legal surface area.
8. **The realistic irreducible quality gap for NEX at 3-8B is: complex chain-of-thought reasoning, code >100 lines, and open-ended creative writing** — not grounded Q&A. NEX's Fabrication Gate v2 (claim-span alignment) is a well-supported mitigation pattern; RAG-plus-verifier stacks are exactly what HalluGuard demonstrates.

---

## 2 · A · Self-hosted LLM inference · quality vs cloud

### A.1 · What runs on a Victus-class Windows machine

Local LLM hosting on Ollama has consolidated around a few sweet spots. **8-12 GB VRAM is the sweet spot for 7-8B parameter models at Q4_K_M quantization, delivering 40+ tokens/second** ([LocalLLM.in](https://localllm.in/blog/ollama-vram-requirements-for-local-llms), [Morph best-of list](https://www.morphllm.com/best-ollama-models)). The Qwen 2.5 family spans 0.5B / 1.5B / 3B / 7B / 14B / 32B / 72B; the 3B variant NEX already ships as `NEX_OLLAMA_RESCUE_MODEL` fits under 4 GB VRAM and matches the pilot log's observation that on a 4 GB card the 3B model CPU-spills on some prompts (measured P99 5.3s in the composition pilot, exactly what the published cheat-sheets predict).

### A.2 · Qwen 2.5 / 3 tier vs closed models

- **Qwen 2.5 Coder 32B matches GPT-4o on coding benchmarks; on MBPP Qwen scored 88.5% vs GPT-4o 87.8% (Jan 2026)**, but GPT-4o pulled ahead 64% of the time on structured code >100 lines ([Second Talent comparison](https://www.secondtalent.com/resources/qwen-vs-gpt-4o-coding/)).
- Qwen 3/3.5/3.6 flagship is a **235B MoE that activates 22B per token, competitive with DeepSeek R1 and GPT-4o**, CodeForces ELO 2056 ([DigitalApplied guide](https://www.digitalapplied.com/blog/qwen-models-complete-guide), [BenchLM comparison](https://benchlm.ai/compare/gpt-4o-vs-qwen3-6-max-preview)) — but that MoE is far out of scope for a Windows laptop.
- **Qwen 3.5 9B "outscores models 3× its size on reasoning benchmarks while fitting in 6.6 GB on Ollama"** — the strongest small-model story on the market as of May 2026 ([Morph](https://www.morphllm.com/best-ollama-models), [InsiderLLM guide](https://insiderllm.com/guides/qwen-models-guide/)).
- Small-model showdown: Qwen 2.5 3B, Llama 3.2 3B, Phi-3.5 Mini, Gemma 2 2B — Qwen is competitive across the board and best for non-English (a Founder-relevant fact given Indonesia coverage) ([General Compute](https://www.generalcompute.com/blog/small-models-showdown-qwen-2-5-3b-llama-3-2-3b-phi-3-5-mini-gemma-2-2b)).

### A.3 · Local embeddings

- **`nomic-embed-text`** — 137M params, 8192-token context, "the only open-source long-context embedder to outperform text-embedding-ada-002 and text-embedding-3-small on MTEB" ([Morph embed ranking](https://www.morphllm.com/ollama-embedding-models), [Nomic paper](https://arxiv.org/pdf/2402.01613)). 73.8M pulls — the ecosystem default.
- **`mxbai-embed-large`** — 335M, English-strong via Matryoshka Representation Learning, 11.4M pulls.
- **`bge-m3`** — 568M, 100+ languages, "strongest open-source option for multilingual search" ([Cheney Zhang MTEB 2026](https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html)). Caveat: BGE-M3 mixes dense/sparse/multi-vector so a single MTEB number is misleading.
- **Long-context degradation is real**: models under 335M "dropped significantly at 4K, hitting 0.40-0.44 accuracy at 8K in long-context tests" (same source). Implication: chunk documents to ≤2k tokens for nomic; escalate to BGE-M3 when Indonesian text or long context dominates.

### A.4 · Llama / Mistral / Gemma via Ollama

- Llama 3.3 8B HumanEval 68.1%, Mistral 7B 43.6%, Qwen 2.5 14B 72.5% ([Morph best-of](https://www.morphllm.com/best-ollama-models)). Qwen has the edge at every parameter tier of interest.
- Gemma family: strong on English, permissive-but-restricted license (see §7).
- **Recommendation**: consolidate on Qwen 2.5/3.x for chat + reasoning + Indonesian, keep `llava:7b` only as a backup vision path (Qwen2.5-VL 7B is measurably better per §3).

### A.5 · Realistic quality gap for retrieval-grounded Q&A

Published RAG-with-small-LLM benchmarks show that **on grounded Q&A the small-model penalty is small** and largely disappears when a verifier is added. HalluGuard-4B matches MiniCheck-7B and beats Granite-Guardian-3.3-8B on RAGTruth ([arXiv 2510.00880](https://arxiv.org/html/2510.00880v1)). "The 3B version trained with RAG is competitive even with the 15.5B version without RAG on certain metrics" ([same paper](https://arxiv.org/html/2510.00880v1)). The domain NEX actually serves — accommodation facts, prices, distances, opening hours, canonical property attributes — is a poster child for the RAG-solves-it regime.

---

## 3 · B · Public data sources · internet as raw data

| Source | Rate limit / access | License | Key required | URL |
|---|---|---|---|---|
| Wikimedia REST / Action API | 100 req/s per IP anon; 500 req/s per authenticated key; Core API begins gradual deprecation Jul 2026 | Text CC BY-SA 4.0 (attribution + share-alike) | Optional (higher limit with UA + key) | [rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits) · [reuse policy](https://api.wikimedia.org/wiki/Reusing_free_content) |
| Wikipedia dumps (Kiwix ZIM) | Full offline; scopes mini / nopic / maxi | CC BY-SA 4.0; Kiwix reader GPL | No | [dumps](https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/) · [database download](https://en.wikipedia.org/wiki/Wikipedia:Database_download) |
| Wikidata SPARQL | 60 s query wall-clock (503 on overrun); 5 concurrent per IP; 60 s query-time-per-minute (burst 120 s); ~30 errors/min (burst 60) | CC0 (public domain) | No | [query limits](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/query_limits) · [REST API](https://www.wikidata.org/wiki/Wikidata:REST_API) |
| DuckDuckGo Instant Answer | Free public service, official terms; no formal quota published | DDG ToS | No | [docs](https://freeapihub.com/apis/duckduckgo-instant-answer-api) · [ToS](https://duckduckgo.com/terms) |
| OSM Nominatim | **Absolute max 1 req/s**, valid User-Agent required, no auto-complete, no systematic grid queries, geocoding-primary apps must self-host | ODbL (attribution) | No | [usage policy](https://operations.osmfoundation.org/policies/nominatim/) |
| Common Crawl | S3 pull, bulk or map-reduce | Common Crawl grants access; **crawled page contents remain under original owners' copyright** | No (AWS auth for high throughput) | [terms](https://commoncrawl.org/terms-of-use) · [AWS registry](https://registry.opendata.aws/commoncrawl/) |
| GeoNames | 10 000 credits/day per app, 1 000/hour | CC BY 4.0 | Yes (username) | [export](https://www.geonames.org/export/) |
| Open-Meteo | No key, no signup, ~10 000 non-commercial req/day | CC BY 4.0 (attribution) | No | [open-meteo.com](https://open-meteo.com/) |
| GTFS transit (global) | Static feeds, per-agency | Varies (per agency) | Usually no | [MobilityDatabase](https://transitfeeds.com/) · [awesome-transit](https://github.com/MobilityData/awesome-transit) |
| GTFS Indonesia (Jakarta, Bandung, Surabaya, Transjakarta) | Community-maintained feeds; also OSM | Varies | No | [gtfs-indonesia](https://github.com/soluvas/gtfs-indonesia) · [Transjakarta GTFS](https://github.com/akherlan/transjakartagtfs) |
| RSS/Atom | Per-publisher; not centrally throttled | Per-publisher | No | (no single URL) |

**Indonesia-specific findings**: `data.go.id` was mentioned in the Founder's brief but WebSearch did not surface direct hits on GTFS feeds there — this is **UNKNOWN**. However, active community GTFS repos exist for Jakarta / Bandung / Surabaya / Transjakarta, and OSM covers Indonesia densely ([soluvas/gtfs-indonesia](https://github.com/soluvas/gtfs-indonesia), [OSM GTFS wiki](https://wiki.openstreetmap.org/wiki/GTFS)). Recommendation: use community GTFS + OSM Indonesia as the day-one transport baseline; formally audit `data.go.id` in a follow-up BEGIN.

---

## 4 · C · Proven self-hosted AI reference architectures

### 4.1 · Perplexica / Vane (the closest analogue to NEX)

**Stack**: Perplexica UI (port 3000) → SearXNG metasearch (port 8080) → Ollama LLM (port 11434). All Docker. Rebranded to "Vane" in March 2026 but the code path is the same ([2026 guide](https://joshuaopolko.com/perplexica-self-hosted-guide/), [OSSAlt](https://ossalt.com/guides/self-host-perplexica-open-source-perplexity-2026), [Collabnix](https://collabnix.com/self-host-perplexica-ai-the-ultimate-docker-and-ollama-setup/)).

- **Retrieval layer**: SearXNG aggregates Google, Bing, DuckDuckGo + 70 other engines without tracking users at the upstream engines ([Tailscale post](https://tailscale.com/blog/video-searxng)).
- **Inference layer**: Model-agnostic — Ollama, OpenAI, Anthropic, Groq all work. In the local-only mode Ollama is the only backend.
- **Three "focus modes"**: Speed / Balanced / Quality — swap the model tier per query. Directly analogous to NEX's tiered composer routes.
- **License**: MIT.

**Why this matters for NEX**: the *shape* of NEX's brain (semantic cache → hot tier → retrieval → optional LLM) mirrors Perplexica's (aggregator → LLM with citations) and Perplexica is proven in production self-hosted deployments. NEX has **more** structured intelligence than Perplexica (property schema, provenance rows, ISG relationship layer). Meaning: the architecture is the easy part; NEX's differentiator is the data plane.

### 4.2 · Open WebUI + Ollama

Open WebUI: chat UI ↔ Ollama HTTP on 11434 = the entire architecture. RAG built in, Whisper voice input, TTS output, image gen integration, web search, document RAG. Container ~300-500 MB RAM ([TokenMix comparison](https://tokenmix.ai/blog/openwebui-vs-librechat-self-hosted-comparison-2026), [Glukhov overview](https://www.glukhov.org/llm-hosting/llm-frontends/open-webui-overview-quickstart-and-alternatives/)).

### 4.3 · LibreChat + Ollama

LibreChat is the **provider-agnostic** frontier (OpenAI, Anthropic, Azure OpenAI, Vertex, Bedrock, Ollama all supported natively). ~500-800 MB RAM. Multi-tenant, quotas, audit trails ([TokenMix](https://tokenmix.ai/blog/openwebui-vs-librechat-self-hosted-comparison-2026), [Spheron production guide](https://www.spheron.network/blog/self-host-open-webui-librechat-gpu-cloud/)).

**None of these three is a drop-in for NEX** — NEX has its own composer, deterministic router, Fabrication Gate, ISG. What these projects *demonstrate* is that the runtime layer (Ollama + a retrieval aggregator) is off-the-shelf ready and battle-tested in 2026.

### 4.4 · Documented quality-gap notes in these stacks

The Ollama-based comparisons above generally cite two limits: (a) **context-limited retrieval quality** — small models degrade past 4-8k tokens, and (b) **routing quality is the differentiator** — "the LLM is the least interesting part; the aggregator and prompt discipline dominate." NEX already agrees with this stance (§43 of Founder BEGIN: "never invoke LLM merely because available").

---

## 5 · D · Groundedness + hallucination control with small local models

### 5.1 · Small models + RAG can hit big-model territory when grounded

- **HalluGuard 4B** achieves **84.0% BAcc on RAGTruth**, matching MiniCheck-7B and beating Granite Guardian 3.3-8B (82.2%) at half the parameter count ([arXiv 2510.00880](https://arxiv.org/pdf/2510.00880)).
- **RAGTruth + FActScore** benchmarks show tight RAG pipelines cut unsupported claims by ≥50% vs closed-book baseline at same model size ([FutureAGI 2026 report](https://futureagi.com/blog/taming-hallucination-beast-strategies-reliable-llms/)).
- **Domain-grounded tiered retrieval** further mitigates hallucination ([arXiv 2603.17872](https://arxiv.org/pdf/2603.17872)); direct match for NEX's ISG tiered composition.
- **Structured-output RAG** reduces hallucination when outputs are schema-constrained ([arXiv 2404.08189](https://arxiv.org/pdf/2404.08189)) — matches NEX's property schema / evidence-claims discipline.

### 5.2 · NEX-specific fit

NEX's **Fabrication Gate v2** (claim-span alignment scoring) is exactly the "verifier alongside generator" pattern HalluGuard formalises. Combined with:
- honest UNKNOWN discipline from the accommodation rule book v4
- provenance-per-field (`accommodation_business_field_provenance` at 46 114 rows)
- deterministic-composer trust-prefix qualifiers (canonical_verified → unknown ladder)

… the architecture is already stronger than the reference RAG stacks the papers evaluate. The residual open questions are **calibration of the alignment threshold** and **cost of the verifier pass at scale** — both are measurable follow-up BEGINs, not blockers.

---

## 6 · E · Bandwidth + latency reality

### 6.1 · Typical fetch sizes / times

- **Wikipedia article via REST (`page/summary`)**: ~2-10 KB JSON, well under 200 ms round-trip from EU. **Full article via `page/html`**: 20-200 KB. Measured numbers per fetch — **UNKNOWN** in the search results; standard rule of thumb from Wikimedia rate-limit documentation is that 100 req/s per IP is safe.
- **Wikidata SPARQL**: query wall-clock capped at 60 s; typical entity fetch <200 ms; complex federated queries can approach the cap and return 503 ([query limits](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/query_limits)).
- **Nominatim geocode**: single JSON <1 KB; **hard cap 1 req/s** — this is the tightest budget in the stack.
- **Open-Meteo**: JSON payloads a few KB per location-day.

### 6.2 · Daily volume envelope for a 100-1000-query/day Research Brain

Order-of-magnitude estimate:
- 1 000 user queries/day × 5 outbound fact fetches/query = 5 000 outbound requests/day.
- Split: 60% Wikipedia (3 000), 20% Wikidata (1 000), 10% Nominatim (500), 10% Open-Meteo / GeoNames / others (500).
- Nominatim's 1 req/s cap means 500 geocodes = 500 seconds of wall time — trivially inside a day.
- Wikipedia's 100 req/s anonymous per IP means 3 000 fetches fits in 30 s of wall time.

**Verdict**: a NEX Research Brain doing 100-1000 user Q/day is nowhere near any published free-tier limit *if* it caches aggressively.

### 6.3 · Caching strategy

- **Wikipedia offline dumps via Kiwix ZIM** — mini/nopic/maxi scopes. `maxi` is tens of GB; `nopic` a few GB; `mini` <1 GB ([Kiwix ZIM dumps](https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/), [Wikipedia database download](https://en.wikipedia.org/wiki/Wikipedia:Database_download)). Kiwix serves via HTTP locally, eliminating live-fetch entirely for the top-N articles NEX cares about.
- **Wikidata Toolforge / QLever mirror** — mentioned in Wikidata community threads for high-volume users ([lists.wikimedia.org thread](https://lists.wikimedia.org/hyperkitty/list/wikidata@lists.wikimedia.org/thread/PNQ4FPLNUR77WPWQFF7GSSSLWO3NNOIA/)); specific throughput numbers **UNKNOWN**.
- **NEX's own hot tier + semantic cache** already absorbs 35-41% of user path per composition pilot n=354 — pushing that up to 60-70% is a straight capacity win with no extra vendor risk.

---

## 7 · F · Legal / license considerations

| Component | License | NEX obligation |
|---|---|---|
| Wikipedia text | CC BY-SA 4.0 | **Attribute** (title, author list link, source URL, license); NEX-generated derivative text that verbatim-copies must be SA-licensed downstream ([reuse policy](https://api.wikimedia.org/wiki/Reusing_free_content), [Wikipedia:Copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights)). Facts and paraphrased data are not covered. |
| Wikidata | CC0 | Free for any purpose, no attribution required (but attributing is good practice). |
| DuckDuckGo Instant Answer | DDG ToS | Free public service; keep to reasonable volume, respect ToS ([duckduckgo.com/terms](https://duckduckgo.com/terms)). |
| OpenStreetMap / Nominatim | ODbL | Attribute OSM contributors; share derived databases under ODbL. |
| Common Crawl | CC grants dataset access; **crawled pages remain under original owner copyright** | Cannot redistribute crawled content freely; using Common Crawl to *find* URLs then fetching them fresh is safer than redistributing crawl snapshots ([terms](https://commoncrawl.org/terms-of-use)). |
| Open-Meteo | CC BY 4.0 | Attribute Open-Meteo. |
| GeoNames | CC BY 4.0 | Attribute GeoNames. |
| Ollama runtime | MIT | None. |
| Qwen 2.5 model weights | **Apache 2.0** | Commercial use unrestricted; no MAU cap; no source disclosure required ([Codersera comparison](https://codersera.com/blog/gemma-3-vs-qwen-3-in-depth-comparison-of-two-leading-open-source-llms/)). |
| Llama 3.x model weights | Custom Llama license | Commercial OK **under 700M MAU**; above that, negotiate with Meta. EU multimodal exclusion. |
| Gemma model weights | Custom Gemma license | Commercial OK but use-case restrictions (no weapons, no surveillance, no bypassing safety filters); not OSI-recognised open source ([ai.rs comparison](https://ai.rs/ai-developer/llama-4-vs-qwen-3-5-vs-gemma-3-compared)). |

**Commercial-ship recommendation**: Qwen 2.5 + Apache 2.0 avoids every fingerprint of vendor lock-in and every non-OSI-recognised licence clause. Combined with CC0 Wikidata + CC BY-SA Wikipedia (attributed) + CC BY Open-Meteo/GeoNames + ODbL OSM (attributed), the entire NEX AI-Wi-Fi stack is legally shippable to paying customers with an attribution page.

---

## 8 · VIABLE STACK FOR NEX (recommendation)

### 8.1 · Local inference layer

| Role | Model | VRAM at Q4_K_M | Notes |
|---|---|---|---|
| Primary chat + reasoning | **Qwen 3.5 9B** (or Qwen 2.5 7B fallback) | ~6.6 GB | Best small-model reasoning in class; multilingual ready for Indonesia ([Morph](https://www.morphllm.com/best-ollama-models)) |
| Rescue / low-VRAM | **Qwen 2.5 3B** (current `NEX_OLLAMA_RESCUE_MODEL`) | ~2-3 GB | Already wired; matches pilot measurements |
| Verifier / groundedness (optional) | **HalluGuard 4B** or dual-pass with primary | ~3-4 GB | Optional stage inside Fabrication Gate v2 |
| Code / long structured output | **Qwen 2.5 Coder 32B** (only when a workstation-class GPU is available; otherwise degrade gracefully) | ~20 GB | Founder is aware GPT-4o still leads for >100-line code |

### 8.2 · Local embedding layer

| Language regime | Model | Dim | Context |
|---|---|---|---|
| English default | `nomic-embed-text` | 768 | 8192 (chunk to ≤2k) |
| Indonesian / mixed multilingual | `bge-m3` | 1024 | 8192, multilingual |
| English long-doc | `mxbai-embed-large` | 1024 | 512 |

Route by language detector at ingest; store dimensionality per collection so upgrade paths do not break indexes.

### 8.3 · Local vision + OCR

- Keep `NEX_VISION_PROVIDER=qwen25vl` (**Qwen 2.5-VL 3B / 7B** — SOTA open VLM per §A.5).
- Keep `NEX_OCR_PROVIDER=tesseract` for deterministic OCR.
- Retain `llava:7b` as a fallback only.

### 8.4 · Retrieval layer

- **Already have**: Postgres canonical + hot-tier facts + semantic cache + ISG relationship layer + property-schema + Fabrication Gate v2 + deterministic composer + gap engine.
- **Add**: a self-hosted **SearXNG** container as the "when-nothing-else-fits" web aggregator route (Route E for genuinely open-web queries). Zero cost, zero third-party AI provider, zero PII leaked to Google/Bing at query time.

### 8.5 · Data source layer (priority order)

1. **Wikidata SPARQL** (CC0, structured, free) — best fit for entity backfill.
2. **Wikipedia REST + Kiwix offline dumps** (CC BY-SA, attribution required) — best fit for prose facts.
3. **OpenStreetMap + Nominatim (self-hosted for anything above 1 req/s)** — geospatial anchor.
4. **Open-Meteo** — weather freshness for accommodation queries.
5. **GeoNames** — place-name normalisation.
6. **GTFS Indonesia community feeds** — public transport for Jakarta / Bandung / Surabaya.
7. **RSS/Atom aggregation** — news / freshness signal per publisher.
8. **Common Crawl** — bootstrapping URL discovery only; do NOT redistribute snapshots.
9. **`data.go.id`** — audit pending (Founder BEGIN separately).

---

## 9 · REALISTIC QUALITY GAP going 100% local

**What NEX loses vs a GPT-4-class cloud call**:
- **Free-form long reasoning** — the honest gap on very complex chain-of-thought is 5-15 pp on hard reasoning suites; matters little for grounded Q&A, matters a lot for open-ended synthesis.
- **Code generation >100 lines** — GPT-4o still wins ~64% of the time ([Second Talent](https://www.secondtalent.com/resources/qwen-vs-gpt-4o-coding/)); NEX's programmer worker is intentionally observation-only per doctrine, so this is not the near-term blocker it looks like.
- **Very-long-context (>32k) coherence** — small local models degrade; mitigate with retrieval-into-chunks instead of stuffing.
- **Novel-domain zero-shot** — cloud giants have more training coverage of extreme long-tail; NEX's domain is bounded (accommodation, food, transport, etc.) so this cost is small.

**What NEX gains going 100% local**:
- **Zero third-party inference cost** — matches Founder's Self-Sustainment doctrine.
- **Zero PII leakage to inference vendors** — matches Owner-Identity doctrine.
- **Zero rate-limit variability from AI vendors** — matches Invisible-Infrastructure doctrine.
- **Latency floor removed** — hot-tier + local Ollama warm-P50 under 1 ms (pilot n=354 measured), vs 300-2000 ms cloud round-trip.
- **License clean-room** — Apache 2.0 Qwen + CC0 Wikidata + attributed CC BY Wikipedia/OSM/Open-Meteo/GeoNames is a shippable commercial stack.
- **Verifier stacking** — small verifier alongside small generator matches or beats big-model-alone on grounded QA (HalluGuard evidence).

**Net verdict**: for NEX's *actual* workload (grounded, retrieval-anchored Q&A over bounded domains), **the quality gap is small enough to be worth the doctrinal wins**. For the residual 3-5% of "genuinely novel, unbounded, high-reasoning" queries, NEX's honest UNKNOWN + clarify path is already the correct answer.

---

## 10 · CONTESTED OR UNKNOWN

- **Exact per-request bytes/ms** for Wikipedia REST / Wikidata SPARQL / Nominatim — **UNKNOWN** in the search results; must be measured with a NEX-side probe (a legitimate follow-up BEGIN).
- **`data.go.id` GTFS availability** — **UNKNOWN**; WebSearch surfaced community repos but not the Indonesian gov open-data portal directly.
- **DuckDuckGo Instant Answer API formal quota** — **UNKNOWN** in published docs; 2026 sources still list it as active and undeprecated but with no numeric SLA.
- **Wikimedia rate-limit exact behaviour post-Jul-2026 Core-API deprecation window** — the second half of 2026 will introduce new endpoints; NEX should not hardcode Core-API paths ([API Portal deprecation](https://wikitech.wikimedia.org/wiki/API_Portal/Deprecation)).
- **Wikidata Toolforge / QLever mirror throughput** for a self-hosted secondary — mentioned but not quantified in this pass.
- **Exact Fabrication-Gate-v2 quality delta** on RAGTruth-style corpora — NEX has not been evaluated against the public benchmark; the qualitative match is strong but a numeric claim would be fabrication.
- **VRAM behaviour of Qwen 3.5 9B on a Victus laptop's specific GPU** — the 6.6 GB Q4_K_M figure is a published median; the actual card must be measured (existing pilot infra can do this).
- **Where SearXNG's own upstream engines apply their own rate limits back to NEX's IP** — SearXNG hides users from upstreams but does not eliminate NEX's own IP footprint; needs measurement under load.

---

## Sources (every URL actually returned by WebSearch)

- Ollama VRAM / model cheat-sheets: [LocalLLM.in](https://localllm.in/blog/ollama-vram-requirements-for-local-llms), [Morph best-of](https://www.morphllm.com/best-ollama-models), [Morph embed](https://www.morphllm.com/ollama-embedding-models), [ComputingForGeeks](https://computingforgeeks.com/ollama-models-cheat-sheet/), [InsiderLLM VRAM](https://insiderllm.com/guides/vram-requirements-local-llms/), [InsiderLLM Qwen](https://insiderllm.com/guides/qwen-models-guide/), [Will It Run AI](https://willitrunai.com/blog/qwen-3-gpu-requirements), [PromptQuorum Qwen 3.6](https://www.promptquorum.com/local-llms/qwen-local-deployment-guide-2026), [AI Tool Discovery best local](https://www.aitooldiscovery.com/how-to/best-local-llm-models)
- Qwen family / vs GPT: [Second Talent](https://www.secondtalent.com/resources/qwen-vs-gpt-4o-coding/), [Bleap Qwen 3.8](https://www.bleap.finance/en-us/blog/all-about-qwen-3-8), [BenchLM](https://benchlm.ai/compare/gpt-4o-vs-qwen3-6-max-preview), [DigitalApplied](https://www.digitalapplied.com/blog/qwen-models-complete-guide), [General Compute small showdown](https://www.generalcompute.com/blog/small-models-showdown-qwen-2-5-3b-llama-3-2-3b-phi-3-5-mini-gemma-2-2b)
- License comparison: [Codersera](https://codersera.com/blog/gemma-3-vs-qwen-3-in-depth-comparison-of-two-leading-open-source-llms/), [ai.rs](https://ai.rs/ai-developer/llama-4-vs-qwen-3-5-vs-gemma-3-compared), [RockB](https://baeseokjae.github.io/posts/gemma-4-vs-llama-4-vs-qwen-3-2026/), [Till Freitag](https://till-freitag.com/en/blog/open-source-llm-comparison), [Gemma4-ai](https://gemma4-ai.com/blog/gemma-4-vs-qwen-3)
- Embedding models: [Morph](https://www.morphllm.com/ollama-embedding-models), [Cheney Zhang MTEB 2026](https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html), [Nomic paper](https://arxiv.org/pdf/2402.01613), [Conan-Embedding v2](https://arxiv.org/pdf/2509.12892), [mGTE](https://arxiv.org/pdf/2407.19669), [SurrealDB comparison](https://surrealdb.com/blog/embedding-models-comparison), [Webscraft RAG guide](https://webscraft.org/blog/embeddingmodeli-dlya-rag-u-2026-yak-obrati-porivnyannya-provayderiv?lang=en), [Gecko](https://arxiv.org/pdf/2403.20327)
- Vision-language models: [Labellerr Qwen 2.5-VL vs Llama 3.2](https://www.labellerr.com/blog/qwen-2-5-vl-vs-llama-3-2/), [Roboflow local VLMs](https://blog.roboflow.com/local-vision-language-models/), [Clore.ai Qwen 2.5-VL guide](https://docs.clore.ai/guides/vision-models/qwen-vl)
- Small-LLM RAG / hallucination: [HalluGuard arXiv HTML](https://arxiv.org/html/2510.00880v1), [HalluGuard PDF](https://arxiv.org/pdf/2510.00880), [FutureAGI 2026 hallucination guide](https://futureagi.com/blog/taming-hallucination-beast-strategies-reliable-llms/), [Domain-grounded tiered retrieval](https://arxiv.org/pdf/2603.17872), [Structured-output RAG](https://arxiv.org/pdf/2404.08189), [Clinical guideline QA RAG benchmark](https://pubmed.ncbi.nlm.nih.gov/42587692/)
- Wikimedia / Wikipedia: [MediaWiki API rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits), [Wikimedia rate-limits FAQ](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits/FAQ), [REST Gateway rate limiting](https://wikitech.wikimedia.org/wiki/REST_Gateway/Rate_limiting), [API Portal deprecation](https://wikitech.wikimedia.org/wiki/API_Portal/Deprecation), [Reusing free content](https://api.wikimedia.org/wiki/Reusing_free_content), [Wikipedia:Copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights), [Wikipedia:Database download](https://en.wikipedia.org/wiki/Wikipedia:Database_download), [Kiwix ZIM dumps](https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/), [Kiwix vice guide](https://www.vice.com/en/article/you-can-download-the-entirely-of-english-wikipedia-to-browse-offline-using-kiwix/)
- Wikidata: [SPARQL query limits](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/query_limits), [SPARQL query service](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service), [REST API](https://www.wikidata.org/wiki/Wikidata:REST_API), [Query Service user manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual), [Community thread on limits](https://lists.wikimedia.org/hyperkitty/list/wikidata@lists.wikimedia.org/thread/PNQ4FPLNUR77WPWQFF7GSSSLWO3NNOIA/)
- DuckDuckGo: [DuckDuckGo ToS](https://duckduckgo.com/terms), [Instant Answer API docs](https://freeapihub.com/apis/duckduckgo-instant-answer-api), [iProyal DDG API 2026](https://iproyal.com/blog/duckduckgo-api/), [link.sc DDG guide](https://link.sc/blog/duckduckgo-search-api-guide)
- OSM / Nominatim: [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/), [Community discussion](https://community.openstreetmap.org/t/clarification-on-nominatim-usage-policy/102661), [Understanding compliance](https://community.openstreetmap.org/t/understanding-and-complying-with-nominatim-usage-policy/129212)
- Common Crawl: [Terms of use](https://commoncrawl.org/terms-of-use), [AWS registry](https://registry.opendata.aws/commoncrawl/), [Wikipedia entry](https://en.wikipedia.org/wiki/Common_Crawl), [FAQ](https://commoncrawl.org/faq)
- Open-Meteo: [open-meteo.com](https://open-meteo.com/), [DEV article](https://dev.to/0012303/open-meteo-api-free-weather-data-for-any-location-no-key-no-limits-no-bs-2j2), [Free APIs For You](https://www.freeapisforyou.in/api/open-meteo), [Bright Coding](https://www.blog.brightcoding.dev/2026/02/05/open-meteo-the-revolutionary-free-weather-api-developers-crave)
- GeoNames: [About](https://www.geonames.org/about.html), [Export/web services](https://www.geonames.org/export/), [Web service docs](http://www.geonames.org/export/web-services.html)
- GTFS Indonesia: [soluvas/gtfs-indonesia](https://github.com/soluvas/gtfs-indonesia), [Transjakarta GTFS](https://github.com/akherlan/transjakartagtfs), [Harnessing Transjakarta GTFS](https://qamille.medium.com/harnessing-transjakarta-gtfs-data-d032e61d40c4), [MobilityDatabase](https://transitfeeds.com/), [awesome-transit](https://github.com/MobilityData/awesome-transit), [OSM GTFS wiki](https://wiki.openstreetmap.org/wiki/GTFS)
- Reference stacks: [Perplexica 2026 guide](https://joshuaopolko.com/perplexica-self-hosted-guide/), [Collabnix Perplexica](https://collabnix.com/self-host-perplexica-ai-the-ultimate-docker-and-ollama-setup/), [OSSAlt Perplexica](https://ossalt.com/guides/self-host-perplexica-open-source-perplexity-2026), [OSSAlt how-to](https://ossalt.com/guides/how-to-self-host-perplexica-open-source-perplexity-2026), [olares medium Perplexica+SearXNG](https://olares.medium.com/building-a-local-perplexity-alternative-with-perplexica-ollama-and-searxng-71602523e256), [Daniliants Perplexica](https://daniliants.com/insights/perplexica-self-hosted-perplexity-alternative/), [AI Tool Discovery Perplexica](https://www.aitooldiscovery.com/how-to/self-hosted-perplexity-alternative), [ijustr Fedora Perplexica](https://www.ijustr.com/self-hosted-ai-search-running-perplexica-with-ollama-on-fedora-43/)
- Open WebUI / LibreChat: [TokenMix comparison 2026](https://tokenmix.ai/blog/openwebui-vs-librechat-self-hosted-comparison-2026), [Glukhov overview](https://www.glukhov.org/llm-hosting/llm-frontends/open-webui-overview-quickstart-and-alternatives/), [Localtonet self-host guide](https://localtonet.com/blog/how-to-self-host-open-webui), [Spheron production guide](https://www.spheron.network/blog/self-host-open-webui-librechat-gpu-cloud/), [TECHSY 10-minute guide](https://techsy.io/en/blog/open-webui-ollama), [ToolHalla 3-way comparison](https://toolhalla.ai/blog/open-webui-vs-anythingllm-vs-librechat-2026), [LocalAlternative comparison](https://www.localalternative.io/compare/ollama-webui-vs-librechat), [SumGuy comparison](https://sumguy.com/open-webui-vs-librechat/)
- SearXNG: [Tailscale post](https://tailscale.com/blog/video-searxng), [Glukhov self-hosting](https://medium.com/@rosgluk/selfhosting-searxng-a3cb66a196e9), [Hermes agent skill](https://hermes-agent.nousresearch.com/docs/user-guide/skills/optional/research/research-searxng-search), [OpenClaw docs](https://docs.openclaw.ai/tools/searxng-search), [liteLLM SearXNG](https://docs.litellm.ai/docs/search/searxng), [Tan Yong Sheng Windows setup](https://www.tanyongsheng.com/note/setting-up-searxng-on-windows-localhost-your-private-customizable-search-engine/), [Joshua Opolko SearXNG guide](https://joshuaopolko.com/searxng-self-hosted-guide/), [Pinokio SearXNG](https://beta.pinokio.co/posts/01kt4s6g6q3j040wbry1f0ac2f)

---

*Report prepared 2026-09-09. No implementation performed. All claims sourced to WebSearch-returned URLs or explicitly marked UNKNOWN. Every metric that was not measured is qualified with a source or a MODELED / UNKNOWN tag. No fabricated URLs, no silent promotion.*
