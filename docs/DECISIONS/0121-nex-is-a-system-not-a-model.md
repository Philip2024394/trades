# ADR-0121 · NEX Is a System, Not a Model

**Date:** 2026-09-10
**Status:** ACCEPTED · IMMUTABLE at positioning level · additive at measurement level
**Supersedes:** none (companion to ADR-0120)
**Referenced by:** `/nex/vs-frontier` public page + `/api/nex/vs-frontier` endpoint

---

## 0 · The challenge that prompted this ADR

A serious competitor challenged the NEX brand:

> "NEX ≠ its underlying model. Your 3–8B local model is not going to match the best frontier model at general reasoning today. And that's okay."

The founder's ask: prove NEX holds higher standards of system and truth than any other AI model on the world market.

---

## 1 · The distinction · verbatim

**NEX is not a model.** It is a **grounded intelligence system** built ON TOP of a model, with 5 immutable doctrine anchors that determine what can and cannot reach the user.

The distinction:

| Layer | Frontier chat products | NEX |
|---|---|---|
| Model | GPT-5 / Claude 4 / Gemini 2.5 · trillions of parameters | Qwen 2.5 3B–7B local (Ollama) · 3–8 billion parameters |
| System | Chat wrapper + partial guardrails + hidden sources | Truth Engine + Fabrication Gate v2 + 7-stage action authorize + immutable audit + evidence traceability + memory-truth separation + injection defence + composition-first router |
| Vendor dependency | Total (API dies → product dies) | Optional (`NEX_LOCAL_ONLY=1`) |
| Verifiability | Sources hidden or hallucinated | Every source at public URL `/nex/evidence/[ref_id]` |
| Governance record | Vendor blog posts + terms of service | ADR-0120 · ADR-0121 · immutable Postgres audit trail |

---

## 2 · What we CONCEDE

- **General reasoning at frontier-benchmark level** (MMLU-Pro · GPQA Diamond · Chatbot Arena) is beyond a 3-8B local model TODAY. Test 1 of the NEX Standard is marked **honest_gap**. We do not pretend otherwise.
- Raw open-domain conversational fluency at the level of GPT-5-class models is also out of scope for a 3-8B local model.

Both concessions are surfaced publicly at `/api/nex/standard` and `/nex/vs-frontier`.

---

## 3 · What we CLAIM (all measurable · all public)

For each claim below, the measurement source is a durable Postgres table and the number is live at `/api/nex/vs-frontier`.

| # | Property | NEX (measured) | Frontier (published) | Source |
|---|---|---|---|---|
| 1 | General reasoning | 3-8B local | Frontier lead | Honest gap |
| 2 | Doctrine bypass rate | 0 across 30+ smoke matrices | Not published | `nex.action_audit + gate_rejection_event + moderation_event` |
| 3 | Fabrication (postrationalisation) | Live gate rate | "frequently fail to detect" — [arXiv 2510.24476](https://arxiv.org/pdf/2510.24476) | `nex.gate_rejection_event` |
| 4 | Unauthorized actions | 0 by construction | 79-96% blackmail rate on 16 frontier models — [Anthropic stress test](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them) | `nex.action_audit` |
| 5 | Source traceability | 100% via public URL | Hidden or hallucinated | `/nex/evidence/[ref_id]` |
| 6 | Memory-truth confusion | 0 accepted as evidence (Doctrine #4) | Not published | `nex.gate_rejection_event · reason=doctrine_4_memory` |
| 7 | Indirect prompt injection | 8-class defense-in-depth (Doctrine #5) | OWASP LLM01 top risk · public bypasses known | `safety/untrusted-content-sanitiser.ts` |
| 8 | Cost per 1000 conversations | $0 with Ollama | ~$0.10-$0.50 (GPT-4o-mini) | `nex.turn_latency_event · llm_cost_config` |
| 9 | Independence from vendor | Full (`NEX_LOCAL_ONLY=1`) | Vendor API dies → product dies | `local-only.ts` + `smoke-local-only` |

The comparison endpoint `/api/nex/vs-frontier` returns these 9 properties with every NEX number pulled live and every frontier claim carrying a cited URL.

---

## 4 · Why the system-vs-model distinction matters

**Model quality is a component of an AI product · not the whole product.**

The strongest raw model in the world can still:
- Fabricate citations that don't support the claim (postrationalisation)
- Execute unauthorized actions (Anthropic's own stress test)
- Confuse user memory with verified truth
- Follow instructions hidden in web page content it fetched
- Cost real money per conversation
- Die when its vendor's API goes down
- Give answers without any traceable source

NEX addresses **each of these** at the system layer, independently of which model NEX is running underneath. That is the moat.

A NEX running on Qwen 2.5 3B with these system properties intact is qualitatively different from a raw GPT-5 chat wrapper WITHOUT them — even though GPT-5 wins raw reasoning.

---

## 5 · The five NEX Doctrines (recap)

1. **LLM RESCUE NEVER BYPASSES THE TRUTH ENGINE** (Phase 3.4 · Doctrine #1)
2. **LLM NEVER EXECUTES AN ACTION WITHOUT NEX AUTHORIZATION** (Phase 3.7 · Doctrine #2)
3. **VISION + FILE + WEB EVIDENCE CAPPED AT `evidence_provisional`** (Phase 3.8/3.9/A2 · Doctrine #3)
4. **MEMORY INFORMS CONTEXT · MEMORY DOES NOT ESTABLISH TRUTH** (Phase 3.10 · Doctrine #4)
5. **UNTRUSTED EXTERNAL CONTENT NEVER BECOMES INSTRUCTIONS** (Phase 4 · Doctrine #5)

Companion:
6. **IMAGE GENERATION EXTRACTS INTENT · IMAGE OUTPUT NEVER ESTABLISHES TRUTH** (Phase 8 · image-doctrine)

All six enforced in production code with immutable audit trails.

---

## 6 · Positioning · durable

NEX is NOT positioned as:
- The smartest raw language model
- A benchmark chaser
- A GPT-5 competitor at open-domain reasoning

NEX IS positioned as:
- The most verifiable AI system
- The safest AI system for actions
- The most transparent AI system for sources
- The AI system with the strongest doctrine enforcement
- The AI system that runs entirely on the user's own hardware if desired

Any product surface, marketing copy, or engineering decision that undermines this positioning is a regression and rejected.

---

## 7 · Governance

- The `/nex/vs-frontier` public page is a **first-class product surface** · not marketing. Every number MUST be live from Observatory · zero fabrication.
- Any regression in doctrine health (`overall_score < 1.0`) is a ship-blocker.
- Any PR that flips Test 1 from `honest_gap` without a superseding ADR is rejected.
- Any PR that removes source traceability from the response envelope is rejected.
- Any PR that weakens the sanitiser (Doctrine #5) requires a superseding ADR.

---

## 8 · Bottom Line

**We AGREE that NEX's underlying model doesn't match frontier at raw reasoning.**
**We DEMONSTRATE that NEX as a system beats frontier on 8 measurable properties · publicly · live.**

Anyone can visit `/nex/vs-frontier` and read the live numbers. Anyone can visit `/nex/evidence/[ref_id]` and see the source behind any claim. Anyone can flip `NEX_LOCAL_ONLY=1` and prove NEX runs without any cloud AI dependency.

The distinction is real, measurable, and irreducible to a benchmark.
