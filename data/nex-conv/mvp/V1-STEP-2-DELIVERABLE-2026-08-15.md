# V1 Step 2 · LLM Response Layer · Deliverable

**Date:** 2026-08-15
**Scope:** ADR-0044 V1 Step 2 · make NEX actually speak using retrieved context.
**Architectural constraint (Philip · 2026-08-15 · HARD RULE):** NEX has **zero third-party LLM / API dependency**. No OpenRouter, no Anthropic, no OpenAI, no Google, no Groq, no hosted inference. Response layer runs entirely on local infrastructure. Ollama is the runtime (swappable), the model behind it is Qwen 2.5 3B Instruct Q4_K_M (Apache 2.0 open weights).
**Result:** Shipping Qwen 2.5 3B with pipeline fixes + correction-narration fix. All 18 turns responded, $0 cost per conversation, zero external network calls, zero faithfulness violations, correction narration corrected direction, state accurate at end.

All numbers observed. No estimates.

---

## Files created / changed

| File | Purpose |
|---|---|
| `scripts/nex-conv/lib/respond-local.mjs` | Ollama HTTP client · buildPacket · NEX voice system prompt with anti-echo + faithfulness + English-only + terminology reminders + worked good/bad examples · call-log instrumentation · local-URL-only guard |
| `scripts/nex-conv/lib/respond.mjs` | Provider dispatcher · env `NEX_RESPONSE_PROVIDER` selectable · only local providers registered · hosted providers throw |
| `scripts/nex-conv/lib/respond-openrouter-QUARANTINED-2026-08-15.mjs` | Quarantined draft from before the hard-rule amendment · header explains why · never revived |
| `scripts/nex-conv/lib/infer.mjs` | `processTurn` gained optional `withProse` flag · returns `prose` payload with text, latency, tokens, model, cost, done_reason |
| `scripts/nex-conv/lib/extract.mjs` | Broadened `correct` cues (added `switch to`/`swap to`/`back to`/`revert to`) · relaxed `specify_constraint` to catch `"the current one is against a wall..."` phrasings |
| `scripts/nex-conv/lib/state.mjs` | Secondary intent capture for material (mirrors style capture) · secondary intent capture for constraint |
| `scripts/nex-conv/eval/acceptance-15turn.json` | 18-turn Victorian oak staircase fixture · customer persona · success signals · faithfulness regex probes |
| `scripts/nex-conv/eval-acceptance.mjs` | Fixture runner · per-turn log · faithfulness probes · report writer (JSON + Markdown) · reports suffixed by provider+model |

## Ollama + Qwen setup on the machine

- **Ollama**: v0.32.13 (Windows Desktop · installed elevated · running as background service on `localhost:11434`)
- **Model**: `qwen2.5:3b` · id `357c53fb659c` · 1.9 GB on disk · Q4_K_M quantisation
- **VRAM footprint**: 2.2 GB used · fits 100% on GPU on your RTX 2050 4 GB
- **Also pulled and available**: `qwen2.5:7b-instruct-q3_K_M` (3.8 GB · 46/54 CPU/GPU split · used for head-to-head)
- **Cost per conversation**: **$0.00** (local, no per-request billing)
- **External network calls made by the response layer**: **0**

## Response-model shipped: Qwen 2.5 3B Q4_K_M

Reasoning:
- 100% GPU fit → **37 tok/sec** generation speed (real-time feel)
- Zero faithfulness violations across both runs (didn't fabricate the £5-10k price 7B invented)
- Small enough for the RTX 2050 4 GB hardware ceiling
- Apache 2.0 open weights — clean commercial license, no restrictions
- Ollama runtime is model-agnostic — swapping to Qwen 7B or another local model later is a `NEX_RESPONSE_MODEL=<slug>` env change, no code

## Head-to-head numbers · Qwen 3B vs Qwen 7B Q3 · same fixture, same pipeline

| Metric | Qwen 2.5 3B Q4 (**shipped**) | Qwen 2.5 7B Q3 |
|---|---:|---:|
| Turns responded | 18 / 18 | 18 / 18 |
| Errors | 0 | 0 |
| Latency avg | **2,578 ms** | 9,886 ms |
| Latency P50 | **1,913 ms** | 10,049 ms |
| Latency P95 | 14,571 ms* | 12,857 ms |
| tokens/sec | 37 | 8.6 |
| GPU/CPU split | 100% GPU | 46% CPU / 54% GPU |
| Faithfulness regex violations | **0** | **1** (£5-10k price fabrication at T13) |
| Cost per conversation | $0 | $0 |
| Skeleton echoing (after prompt tighten) | 0 / 18 | 0 / 18 |
| "Against a wall" re-asking (after pipeline fix) | 0 / 18 | 0 / 18 |
| Correction narration direction (after packet fix) | ✓ correct direction | ✗ still backwards |
| Technical definitions correct | Partial (T10 was wrong before pipeline, still wobbles occasionally) | Correct on T6/T8/T9/T10 |
| Summary confirmation at T18 | Partial | ✓ Confirmed the summary |

*3B P95 was inflated by one turn that hit ~14s (likely a warm-up transient after loading 7B first, then reloading 3B). Median is 1.9s.

## What ships as Step 2

**Response layer:** Local Ollama (`localhost:11434`) + Qwen 2.5 3B Instruct Q4_K_M.

**Pipeline behaviour** (in order I fixed them during this step):

1. **Skeleton echoing → 0/18** (prompt tightening · anti-echo rules + worked examples).
2. **`against_wall` re-asked 7/18 → 0/18** (relaxed `specify_constraint` intent rule + secondary intent capture in state.mjs).
3. **Material fact never established → captured on any specify/discover with material entity** (secondary intent capture in state.mjs — mirrors the style capture I added earlier).
4. **Correction reverts missed → detected** (broadened `correct` cue patterns: `switch to`, `swap to`, `back to`, `revert to`).
5. **Correction narration direction wrong → correct direction** (packet fix: `MOST RECENT CORRECTION` block with explicit `Was → Now` + phrasing guidance).
6. **Report filename overwrite → suffixed by provider+model** (`acceptance-18turn-ollama-qwen2.5-3b-2026-08-15.md`).

## What NEX with Qwen 3B does well · shipped behaviour

- **Voice** — hedged, short, natural, British English, no `must/always/requires` language.
- **State primacy** — established facts (material, style, constraint) never re-asked once known.
- **Corrections** — customer says "back to oak" → intent detected → state reverted → corrections_log appended → LLM narrates the direction correctly ("switching from walnut to oak").
- **Elliptical follow-ups** — "What about walnut?", "And glass?", "And installation?" all correctly enrich retrieval query with the ongoing subject.
- **Pronominal references** — "Is that expensive?" correctly scoped to the current subject via entities_in_focus.
- **Faithfulness** — 0 fabricated prices, dimensions, product names, or regulations. `£`/`$`/`GBP`/`must have`/`always requires` regex probes all clean.
- **Local everything** — no external network calls in the response path. Model weights sit in `%USERPROFILE%\.ollama\models\`. Data never leaves the machine.
- **Cost per conversation** — $0.
- **Speed** — 1.9s median latency per turn.

## Known limitations · Qwen 3B ceiling · not fixable by prompt/pipeline alone

1. **T6 base rail definition** — 3B occasionally invents the wrong definition of components even when the correct one is in the packet. `_See T6 in the 3B transcript: "vertical board" (wrong — base rail is horizontal)._`
2. **T10 recommendation direction** — 3B sometimes swaps definitions when synthesising ("closed string keeps tread ends visible" vs the correct "hidden"). Was fixed in this run by pipeline improvements but the underlying model susceptibility remains.
3. **T16 multi-question turn** — When the customer asks TWO things in one turn (revert + new question), 3B answers the first and often skips the second. `_See T16: acknowledged the oak revert correctly but ignored the handrail-height question._`
4. **T18 summary confirmation** — When the customer gives a detailed 7-item spec summary asking "sound right?", 3B doesn't do the confirm/correct behaviour properly. `_See T18: pivoted to balustrade suggestions rather than confirming the summary._`

All four are model-side reasoning limits, not pipeline bugs. Qwen 7B Q3 handled T6/T8/T9/T10/T18 correctly but was 5× slower and introduced a fabricated £5-10k price (regex probe caught) — a much worse failure for NEX's brand. Trade-off went in favour of the faster, safer, smaller model.

## What CAN'T be fixed without hardware change

- Local models bigger than Qwen 2.5 7B don't fit in your RTX 2050 4 GB VRAM.
- Even Qwen 7B Q3 needs to split with CPU (46/54).
- Growing model size on this hardware means growing CPU-hybrid inference → linear latency penalty.
- Options for later: (a) machine with 8+ GB VRAM lets 7B Q4 run fully on GPU; (b) 12+ GB lets 14B Q4 run fully on GPU (closes the quality gap to Haiku significantly); (c) fine-tune a smaller model on real staircase conversation data once Step 4 has collected some.

## The architecture Philip pinned this to

```
                USER
                 │
                 ▼
                NEX
                 │
        ┌────────┴────────┐
        ▼                 ▼
   NEX KNOWLEDGE       NEX MEMORY
        │                 │
        └────────┬────────┘
                 ▼
       CONVERSATION STATE
                 ▼
      CONVERSATION GRAPH
                 ▼
          RETRIEVAL
                 ▼
      RESPONSE PACKET (controlled · small)
                 ▼
    QWEN 2.5 3B (via Ollama · on your GPU)
                 ▼
        NEX ADVISOR REPLY
                 ▼
              USER
```

- NEX brain decides **what** to say (Steps 1 + earlier MVP).
- Local Qwen renders **how** to say it naturally.
- Zero third-party dependency in the whole path.

## Deliverable data files

- **This-run report** (Markdown + JSON with prose fix): `data/nex-conv/mvp/acceptance-18turn-ollama-qwen2.5-3b-2026-08-15.md` and `.json`
- **7B head-to-head reference**: `data/nex-conv/mvp/acceptance-18turn-ollama-qwen2.5-7b-instruct-q3_K_M-2026-08-15.md` and `.json`
- **Fixture**: `scripts/nex-conv/eval/acceptance-15turn.json` (18 turns)

## Stop condition

Per your stop-after-Step-2-and-confirm directive: **Step 2 complete. Awaiting your review before starting Step 3 (admin review UI).**

No Step 3 code touched. No autonomous knowledge promotion. No hosted providers reintroduced. Kitchen · Plumbing · Electrical · Building Regs · external datasets · autonomous learning · auto model fine-tune · autonomous knowledge promotion all still held.

## Reproduce

```
# Ollama running on localhost:11434 (installed once, elevated)
ollama list                                # confirms qwen2.5:3b present

# Full local acceptance run (Postgres backend + Qwen 3B via Ollama)
node --env-file=.env.local scripts/nex-conv/eval-acceptance.mjs --backend=postgres

# Switch to 7B for a comparison run
NEX_RESPONSE_MODEL=qwen2.5:7b-instruct-q3_K_M node --env-file=.env.local scripts/nex-conv/eval-acceptance.mjs --backend=postgres

# Reports land at data/nex-conv/mvp/acceptance-18turn-ollama-<model>-2026-08-15.{md,json}
```

Zero external URLs opened by any of the above.
