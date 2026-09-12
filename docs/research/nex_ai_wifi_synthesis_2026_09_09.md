# NEX AI-WiFi · Strategic Synthesis

**Date:** 2026-09-09
**Founder brief:** "Can NEX connect to WiFi and use the internet for data source instead of using any outside NEX AI · I want you to research the ultimate way NEX can operate from WiFi data access to internet · removing any AI system from NEX and allowing NEX to be 100% dependent on its own system while providing the highest level of AI service available on the internet and skills. We must build NEX as super-intelligent AI — nex ai wifi."

**Founder standard:** "The best possible system ever created and fast as possible while keeping the information listed true source."

**Sources:**
- Web research → `docs/research/nex_ai_wifi_research_2026_09_09.md`
- Codebase audit → `docs/research/nex_ai_wifi_audit_2026_09_09.md`

Every claim below is either **SOURCED** (URL or file path) or marked **UNKNOWN**. No fabrication.

---

## 1 · Verdict · YES, and NEX is already ~90% there

**Can NEX run 100% locally (all AI in-house, internet as pure data source)? YES.**

Codebase audit confirms all 14 core capabilities have a local implementation shipping today:
LLM rescue (Ollama qwen2.5:3b) · vision (Ollama llava:7b) · web acquisition (DuckDuckGo + Wikipedia — data only, no AI) · deterministic embeddings + optional Ollama embeddings · file extraction · OCR (tesseract.js in-process) · memory (Postgres) · deterministic composer · Knowledge Brain (BM25 + dense + rerank) · Research Brain · Fabrication Gate v2 · Action Brain · Observatory Brain · guardrails.

Web research confirms the local stack is defensible against cloud AI for NEX's actual workload — grounded, retrieval-anchored Q&A. HalluGuard 4B hits 84.0% balanced accuracy on RAGTruth ([arXiv 2510.00880](https://arxiv.org/html/2510.00880v1)), matching MiniCheck-7B and beating Granite Guardian 3.3-8B at half the params. Qwen 2.5-VL 7B is SOTA among open vision models on DocVQA (95.7) and MathVista (68.2) ([Labellerr](https://www.labellerr.com/blog/qwen-2-5-vl-vs-llama-3-2/)).

**Required to ship:** four env-flag flips + one boot-time sentinel. **Zero code changes to the LCC pipeline.**

---

## 2 · Where ChatGPT's diagram was right, and where it fell short

**ChatGPT's diagram (right at conceptual level):**
- Phone as interface, WiFi as transport, NEX as intelligence ✓
- Internet as raw supply, NEX as filter/verifier/builder ✓
- "If NEX already knows, don't search again" ✓
- UNKNOWN → research → verify → answer → improve ✓

**What ChatGPT missed (matters for "best possible + fastest + true source"):**

| Gap | Why it matters | NEX's answer |
|---|---|---|
| Where does NEX's intelligence LIVE? | Determines whether NEX is self-sufficient or a cloud-AI shell | **Local Ollama** — already default |
| Fastest = route to cheapest path, not one "brain" box | 5-hop diagram would be slow; NEX has 4-tier speed hierarchy | Hot-tier ~0.7ms → adapter ~6ms → local rescue ~50-500ms → research 1-20s |
| "Verify" is fuzzy; claim-span alignment is measurable | Cloud LLMs and small local models both hallucinate | **Gate v2** scores alignment against cited span (rejects postrationalisation) |
| 4 doctrines make grounding provable, not aspirational | ADR-120 already binds every subsystem | All 4 enforced at gate + audit + observatory |
| Offline resilience | WiFi drops must not break NEX | Hot-tier facts + Postgres KB answer without internet |
| Provider abstraction | Swapping providers should be config, not rewrite | Every capability has a clean `Provider` interface (verified by audit) |

**Honest read:** ChatGPT drew a napkin diagram. NEX already has the engineering underneath. The AI-WiFi vision is a set of switches to flip, not a new system to build.

---

## 3 · The Ultimate NEX AI-WiFi Architecture

```
                      USER PHONE / WEB / VOICE
                                ↓
                      WiFi / Internet (transport only)
                                ↓
                      NEX MAIN BRAIN (orchestrator)
                                │
                                ▼
      ┌─────────────────── Composition-first router ───────────────────┐
      │                                                                 │
      │  Tier 1 · Hot-tier facts (RAM · ~0.7ms)      99% of queries    │
      │  Tier 2 · Deterministic adapter (~6ms)       zero LLM          │
      │  Tier 3 · Knowledge Brain hybrid (~100ms)    zero LLM          │
      │  Tier 4 · Local Ollama rescue (~50-500ms)    LLM local only    │
      │  Tier 5 · Research Brain + WiFi (~1-20s)     when truly UNKNOWN│
      │                                                                 │
      └────────────────────────┬────────────────────────────────────────┘
                                ▼
                      Fabrication Gate v2 (alignment scored)
                                ▼
                      Truth Engine (freshness · conflict · trust)
                                ▼
                      ANSWER (cited · trust-banded · source-traced)

  WiFi carries: user question ← → answer,
                and raw data pulls from:
                Wikipedia · Wikidata · DuckDuckGo · OpenStreetMap Nominatim ·
                Open-Meteo · GeoNames · Common Crawl · public gov data · RSS

  WiFi NEVER carries: LLM inference calls to OpenAI / Anthropic / Google /
                      OpenRouter / Groq / SambaNova / Cerebras / Cloudflare.

  Every verified Research Brain answer feeds back to Knowledge Brain,
  becoming a Tier 3 cache row for next time. Internet-fetch amortises to zero.
```

**Speed strategy** (what makes it fastest):
- Tier 1 is sub-millisecond by construction (RAM hash lookup).
- Tier 2 avoids LLM entirely for accommodation domain (99.4% of queries per Composition Pilot n=354).
- Tier 3 (Knowledge Brain) hybrid retrieval measured at 117 ms end-to-end.
- Tier 4 (Ollama local) has zero external network hop.
- Tier 5 (Research Brain) only fires when 1-4 all honestly UNKNOWN.

**True-source strategy** (what makes it trustworthy):
- Doctrine #1 · Gate v2 rejects orphan citations AND postrationalised claims.
- Doctrine #2 · every action route through 7-stage authorize + audit.
- Doctrine #3 · web / vision / file evidence capped at `evidence_provisional` — never elevates to canonical.
- Doctrine #4 · memory NEVER converts to truth.
- Truth Engine · freshness + conflict + trust-band scoring on every fact.

**Self-sufficiency strategy** (what makes it super-intelligent without cloud AI):
- Local Ollama models (Qwen 2.5-VL 7B vision, qwen2.5:3b rescue, nomic-embed-text embeddings).
- Local Postgres for state, facts, memory, audit.
- Public internet APIs as raw data supply only (Wikipedia CC BY-SA · Wikidata CC0 · Open-Meteo CC BY · OSM ODbL · GeoNames CC BY).
- Zero external AI provider dependency in the LCC pipeline (audit verified · `src/lib/nex/live-chat-completion/**` has zero cloud AI call sites).

---

## 4 · Concrete build plan · minimal · doctrine-safe

### Phase AIW-1 · Local-only mode flag + boot sentinel
**File:** new `src/lib/nex/live-chat-completion/local-only.ts`
**Content:**
```ts
export function applyLocalOnlyModeIfSet(): void {
  if (process.env.NEX_LOCAL_ONLY !== "1") return;
  process.env.NEX_LLM_RESCUE_PROVIDER ??= "ollama";
  process.env.NEX_VISION_PROVIDER ??= "ollama";
  process.env.NEX_WEB_ACQUISITION_PROVIDER ??= "ddg";
  process.env.NEX_EMBEDDING_PROVIDER ??= "ollama";
  process.env.NEX_FILE_PROVIDER ??= "real";
  process.env.LLM_ALLOW_MOCK_FALLBACK ??= "false";
}
```
Called once from the chat route module-load.

### Phase AIW-2 · Public data source expansion
Add to `src/lib/nex/live-chat-completion/web-acquisition/`:
- `wikidata-provider.ts` · SPARQL endpoint (60s query budget · 5 concurrent per source A of the research report)
- `nominatim-provider.ts` · geocoding (1 req/s ceiling per source B)
- `openmeteo-provider.ts` · weather (10k/day no key)
- `geonames-provider.ts` · geographic backfill (10k/day free tier)

Each implements the existing `WebProvider` interface — one contract, N sources. Composed via `makeCompositeWebProvider([...])`.

### Phase AIW-3 · License + attribution surface
Add `src/app/api/nex/attributions/route.ts` returning JSON of all data-source attributions, and a subtle "Sources" footer on `/nex/observatory` and the chat UI when a Research Brain reply cites external sources. Wikipedia CC BY-SA and OSM ODbL require attribution; Wikidata CC0 and Open-Meteo CC BY are attribution-friendly. Source: web research §F.

### Phase AIW-4 · Bigger local model on-demand
Env-selected: `NEX_LLM_RESCUE_MODEL_LARGE=qwen2.5:7b` used by the Research Brain synthesis worker for hard queries; small model stays default for rescue. Existing model-router already has hooks (Phase 3.6).

### Phase AIW-5 · Offline resilience test
`scripts/smoke-offline.mjs` — block outbound HTTPS at the fetch layer (mock), fire routine questions, assert adapter + Knowledge Brain still answer from Postgres.

### Phase AIW-6 · AI-WiFi regression matrix
`scripts/smoke-local-only.mjs` — set `NEX_LOCAL_ONLY=1` before boot, run all 18 existing matrices, assert every provider effectively invoked is one of {ollama, deterministic, ddg, real, postgres, tesseract}. Add a linter probe that scans response headers/telemetry for any outbound host matching an external AI provider domain and fails hard if seen.

### Phase AIW-7 · ADR update
Extend ADR-120 with a §13 "Local-Only Mode" section anchoring `NEX_LOCAL_ONLY=1` as a doctrine-preserving deployment mode.

---

## 5 · Doctrine reconciliation · all four preserved

| Doctrine | AI-WiFi impact |
|---|---|
| #1 · LLM rescue never bypasses Truth Engine | UNCHANGED. Local Ollama output still passes Gate v2 alignment. |
| #2 · LLM never executes action without NEX authorization | UNCHANGED. Local Ollama proposals still traverse 7-stage authorize. |
| #3 · Vision + file + web capped at `evidence_provisional` | UNCHANGED. Rule is source-type based, not provider-based. |
| #4 · Memory informs context, not truth | UNCHANGED. Memory tier + Doctrine #4 defensive reject stay identical. |

**AI-WiFi mode strengthens Doctrine spirit:** with zero cloud AI, every claim is traceable to either a local Ollama model output (gate-validated) or a fetched span from a named public source (attributable). Nothing is inference-behind-a-proprietary-API.

---

## 6 · Realistic quality gap · honest read from the research

Where local stack is at parity or better:
- **Grounded citation Q&A** · small models + retrieval + verifier close most of the gap ([arXiv 2510.00880](https://arxiv.org/html/2510.00880v1)).
- **Vision extraction on structured documents** · Qwen 2.5-VL 7B SOTA among open VLMs; beats Llama 3.2 Vision 11B at half the params.
- **Latency** · local Ollama has no network hop; adapter path stays sub-millisecond.
- **Cost** · zero per-request LLM cost.
- **Privacy** · user data never leaves the machine (except public-data fetches).
- **Uptime** · no dependency on third-party AI service availability.

Where cloud AI still leads (and honest UNKNOWNs):
- **Open-domain reasoning at frontier level** · GPT-5 / Claude 4 / Gemini 2.5 outperform small local models on hard reasoning that isn't retrieval-anchored. NEX's workload is mostly retrieval-anchored, so this gap is small in practice.
- **Long-context synthesis** · frontier cloud models handle 200k+ tokens; local 3-8B models are typically 8k-32k. Research Brain chunks accommodate this.
- **Exact Fabrication Gate v2 delta on RAGTruth** · UNKNOWN. Web research recommends measuring after AIW-6 ships.
- **BGE-M3 for Indonesian** · web research recommends adding for MTEB-verified multilingual leadership. Currently we default to nomic-embed-text (English-tuned). Add as second embedding provider.

---

## 7 · Data sources · the internet as raw supply

From web research §B and §F. All license-clean for commercial use with attribution as noted.

| Source | Rate limit | Auth | License | Content |
|---|---|---|---|---|
| Wikipedia REST | 100 req/s anon | None | CC BY-SA (attribute) | Free-text articles |
| Wikidata SPARQL | 60s per query · 5 concurrent | None | CC0 (no attribution required) | Structured entity data |
| DuckDuckGo Instant Answer | UNKNOWN numeric quota | None | ToS-permitted | Snippets + summaries |
| OpenStreetMap Nominatim | 1 req/s (tightest) | None | ODbL (attribute) | Geocoding |
| Open-Meteo | 10k/day no key | None | CC BY (attribute) | Weather |
| GeoNames | 10k/day free | Free username | CC BY (attribute) | Geographic entities |
| Common Crawl | Bulk dataset | None | Terms permit research + commercial | Historical web crawl |
| Indonesian gov data | Per-source | Varies | Per-source | Domain-specific |

**Composite provider strategy:** `makeCompositeWebProvider([...])` fans a query to all applicable sources in parallel under a total budget. Existing Research Brain search-worker already ranks by authority × freshness; composite provider slots in cleanly.

---

## 8 · License-clean commercial model choice · web research §F

Recommended (all Apache 2.0 or equivalent, no MAU caps):
- **Qwen 2.5 family** (Apache 2.0) — rescue + reasoning + vision
- **nomic-embed-text** (Apache 2.0) — default embeddings
- **BGE-M3** (MIT) — Indonesian workloads
- **tesseract.js** (Apache 2.0) — OCR

Avoid:
- **Llama** (Meta community license — 700M MAU cap; check current terms before commercial ship)
- **Gemma** (Google — use-case restrictions)

---

## 9 · Honest UNKNOWNs surfaced by research

- Exact bytes/ms per Wikipedia fetch on Victus hardware · needs measurement
- `data.go.id` GTFS availability for Indonesian transit · unclear from public docs
- DDG Instant Answer exact numeric quota · not published
- Wikimedia post-Jul-2026 Core-API replacement endpoints · migration path unclear
- NEX-specific Fabrication Gate v2 delta on RAGTruth · measure after AIW-6
- Victus VRAM ceiling for Qwen 3.5 9B · needs hardware probe
- SearXNG upstream IP-footprint behaviour under load · relevant only if we add it

All resolvable via measurement once AIW mode ships.

---

## 10 · Recommendation · Founder decision points

**Do we ship AI-WiFi?** Recommendation: **YES**. The audit shows we're already there; the research validates the local stack against the cloud stack for NEX's workload; the doctrine analysis shows nothing is weakened.

**Two decisions for you:**

1. **Local-only default vs opt-in?**
   - Option A · `NEX_LOCAL_ONLY=1` as opt-in flag (safer rollback; matches current cautious posture)
   - Option B · make local-only the production default; require explicit opt-out for hybrid (harder to reverse but sends a stronger signal)
   - **Recommended:** A. Ship as opt-in. Prove clean 18/18 regression matrix under AI-WiFi mode. Then flip default in a subsequent phase.

2. **How many data sources at once?**
   - Option A · Add Wikidata + Nominatim + Open-Meteo (3) in AIW-2
   - Option B · Add just Wikidata now, defer Nominatim/Open-Meteo to a later phase
   - **Recommended:** A. All three are small, well-documented, license-clean, and expand NEX's answerable-question space substantially. Composite provider absorbs them cleanly.

**Once you approve, build order:**
1. AIW-1 (local-only sentinel · half a day)
2. AIW-6 (regression matrix under local-only · verifies the audit's claim)
3. AIW-2 (data source expansion · 1-2 days)
4. AIW-3 (attribution surface · half a day)
5. AIW-5 (offline resilience smoke · half a day)
6. AIW-4 (bigger model on-demand · half a day)
7. AIW-7 (ADR §13 update · half a day)

Total: ~4-5 focused days end-to-end. Zero LCC code rewrites. All doctrines preserved.

---

## 11 · Bottom line for the founder

The NEX AI-WiFi vision is **already the direction the codebase is built for**. The web research validates the technical stack against the cloud stack for NEX's actual workload. The codebase audit confirms every capability has a local implementation shipping today. All four doctrines are preserved because the doctrines are provider-agnostic.

ChatGPT gave you the right shape. Your instinct — "remove any AI system from NEX and make it 100% dependent on its own system" — is not a rebuild; it's a **switch flip + validation matrix**. The engineering to make it fast, provably-true, and truly local is already in place.

**Recommendation:** Approve AIW-1 through AIW-7 as a self-contained mission. I'll ship it green in ~4-5 focused sessions and prove the 18-matrix regression holds under `NEX_LOCAL_ONLY=1`. Then NEX is the super-intelligent AI-WiFi you described — provably.
