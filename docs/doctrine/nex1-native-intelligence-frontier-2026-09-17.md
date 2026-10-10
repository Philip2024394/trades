# NEX1 · Native Intelligence Frontier · Zero-LLM Roadmap

**Date:** 2026-09-17
**Author:** master_ai_engineer (Claude Opus 4.7)
**Type:** Architectural analysis · doctrine only · no implementation.
**Purpose:** Honest gap analysis vs Claude / Cursor / Codex + native concepts that could deliver LLM-class capability WITHOUT an LLM.

---

## Part 1 · What LLM coding systems actually give users

Cutting through marketing. What Claude/Cursor/Codex deliver:

1. **Semantic code understanding** — reason about *meaning*, not just syntax.
2. **Free-form language input** — user speaks any English, they respond.
3. **Cross-file reasoning** — pull context from anywhere in the repo.
4. **Adaptive explanations** — beginner vs senior gets different depth.
5. **Multi-file coordinated changes** — modify 5 files consistently.
6. **Inline / autocomplete suggestions** — proactive, not just reactive.
7. **Bug hypothesizing** — enumerate causes, pick most plausible.
8. **Refactor-by-intent** — "make this cleaner" without saying how.
9. **Test writing from behaviour descriptions** — "make it not crash when empty".
10. **Documentation generation** — from code + comments.
11. **Chain-of-thought traces** — visible thinking, self-critique.
12. **Long-context** — 200k tokens of repo in view.
13. **Tool use** — call APIs, run commands, fetch web pages.
14. **Prompt-engineered specialist agents** — architect / coder / reviewer roles.
15. **Session memory** — remember what the user said 20 minutes ago.

## Part 2 · What we already have that LLMs don't

Real advantages of the zero-LLM path:

| Advantage | Why it matters |
|---|---|
| **Deterministic reproducibility** | Same input → same output, always. Regression tests work. LLMs can't do this. |
| **Cited evidence chains** | Every claim has file:line. Zero hallucination possible. |
| **Provable safety boundary** | Safety is checkable code, not learned behavior. |
| **Trace-first architecture** | Every reasoning step in the trace. Full observability. |
| **Zero drift** | Knowledge doesn't silently change with model updates. |
| **Founder-owned brain** | Every rule lives in your repo. No black box. |
| **Instant learning** | New pattern = new file. No retraining. |
| **Consensus without sampling noise** | Agent disagreement = real conflict, not RNG. |
| **Structural memory** | Memory is data structures, queryable directly. Not compressed into weights. |
| **Cost-flat** | No per-token bill. Runs indefinitely. |

**We can't out-LLM the LLMs. We can build a system that does what LLMs CAN'T.**

## Part 3 · The gap · honest

Concrete things we CANNOT do today:

1. Answer arbitrary "what does this code do?" — only classified intents work.
2. Reason across files without pre-built call graphs.
3. Understand a new codebase without onboarding events firing first.
4. Handle synonyms the classifier doesn't have.
5. Generate code beyond template + operator-driven mutations.
6. Explain code at different skill levels.
7. Coordinate 5-file changes atomically.
8. Suggest inline as the user types.
9. Rewrite prose (commit messages, docs) with taste.
10. Handle definitional questions ("what does 'idempotent' mean").

## Part 4 · Native concepts that could close the gap · "LLM without LLM"

These are the innovations. Each is deterministic, evidence-based, versioned.

### C1 · Semantic tree of the codebase

Not embeddings. A **formal graph** with nodes = symbols (functions, types, files, routes, DB tables, API endpoints, doctrine rules) and edges = relationships (calls, imports, extends, returns, mutates, tested-by, documented-by, migrated-from, decided-in-ADR).

Built at index time from AST + tsc type-flow + git blame + doctrine markdown. Queryable in O(edges) time.

Query examples:
- "what returns a `User`?" → graph query, deterministic
- "what will break if I change `Task.status`?" → transitive closure over `depends_on`
- "why is `pricing.ts` written this way?" → walk `decided_in_ADR` edges

**LLMs approximate this with attention. We compute it.** No hallucination, always current.

### C2 · Deterministic paraphrase library (compiler for English)

Instead of learned embeddings, curate ~50,000 phrase → canonical-intent mappings. Version-controlled. Every founder message you correct becomes a new mapping. Grows continuously.

Structure: `phrase_fragments → intent_component`. Compose fragments into intent trees. Reject the unknown honestly.

Advantages over LLM classification:
- Every mapping is auditable. You can see WHY "sort out" mapped to `fix_bug`.
- Corrections are permanent — you say "sort out doesn't always mean fix", we remove the mapping.
- Multi-language support is additive, not fine-tuned.
- No model rot.

### C3 · Case-based reasoning (CBR)

Every completed task becomes a **case record**: `(task shape, plan, evidence, outcome, verification, corrections)`. Index by structural similarity metrics (not embeddings — hash of parameter shape, target file signature, intent slug).

New task → find 3 similar cases → adapt their plans → verify. If none similar → say so.

LLMs do this via next-token prediction. We do it via explicit retrieval + adaptation. Faster and provable.

### C4 · Type-flow reasoning

TypeScript compiler API gives you the entire type graph for free. Under-utilized today.

Answer: "which values in this function come from user input?" via taint analysis on the type graph. Deterministic. LLMs *guess* at this.

### C5 · Program synthesis for narrow domains

For bounded change types (add-comment, rename, inline-constant, extract-function, add-field-to-type):
- Enumerate candidate diffs (a small grammar covers ~90% of cases).
- Filter by type-check pass.
- Filter by test pass.
- Rank by size delta.

For these bounded domains, synthesis + verification is faster and safer than LLM generation. **We already have `capability-candidate-comparator/ranker/selector` — this is the same shape.**

### C6 · Rule algebra (Prolog-style)

Encode engineering knowledge as rules:
```
if function.calls(postgres) and not function.wraps(try_catch)
  and endpoint.public
then warn(unsafe_error_handling)
```

Rules compose predictably. `Rule_A ∧ Rule_B` gives you both effects, no surprise. LLMs can't guarantee this — they blend rules stochastically.

Add rules by adding files. Retract by removing files. Auditable knowledge.

### C7 · Interactive intent refinement

Instead of ONE classify pass with a confidence threshold, run a decision tree:
- Prompt classifier → confidence 0.62
- Ask ONE targeted question: "add or modify?"
- Answer → confidence 0.85
- Ask: "which folder?"
- Answer → confidence 0.95
- Proceed

Total: 3 turns. Faster than the 5-round agent debate. And every question is recorded — the case-based library grows.

### C8 · Precomputed answer graph

Given a fully indexed semantic tree (C1), the set of "possible questions about this codebase" is finite: for every node, for every edge type, there's a set of derivable questions.

Precompute the answers. Chat becomes a graph query, not generation.

Example: for `pricing.ts:calculateTotal`, precomputed answers include:
- "What does it do?" → walk the AST + attached spec
- "Where is it called?" → callers edge
- "What tests cover it?" → tested-by edge
- "Why is it non-integer-flooring?" → decided-in-ADR edge

LLMs synthesize this per-query. We just look it up.

### C9 · Skill compilation

Every successful verified task becomes a reusable **skill card** — a parameterized replay. `add_comment_to_line(file, line, text)` becomes a skill. Match new task to skill signature, execute in ms.

Skills compose. `refactor_extract_function(source, target)` is built from `read` + `analyse` + `rewrite` + `verify` skills. Programming-by-composition, not generation.

### C10 · Session-persistent knowledge graph (extend ConversationHead)

We already have ConversationHead. Extend it to a proper graph:
- Nodes: `founder_preference`, `current_goal`, `refused_prompt`, `active_file`, `unresolved_question`, `agreed_decision`.
- Edges: `corrected_to`, `derived_from`, `blocks`, `answers`.

Query: "what has the founder corrected me on today?" → deterministic edge walk.

LLMs approximate this via long context. We just have the graph.

### C11 · Uncertainty as first-class output

When we don't know, we don't guess. We emit:
```
{ verdict: "insufficient_evidence", options: [A, B, C], missing: ["which folder"] }
```

LLMs hallucinate confidence. Zero-LLM systems refuse honestly and offer paths forward.

**This is already partly the case with Q7/Q8. Generalize it across the pipeline.**

### C12 · Founder-voice learner

Analyze your commits + messages + doctrine files. Extract your vocabulary: which words you use for which concepts, which are red-flags ("just", "quickly"), what phrases you correct.

Adapt every reply to your voice. Not a chat personality (that's C7 from earlier). A *linguistic profile*.

This one grows silently — every message adds signal.

## Part 5 · Concrete agent-skill proposals

Composable from existing capabilities. None require an LLM. All bounded, verifiable, small.

| # | Agent | What it does | Composed from |
|---|-------|--------------|---------------|
| 1 | **Symbol Detective** | "The pricing function" → find matching symbols with confidence. AST-based fuzzy match, not embeddings. | `capability-f-discovery` + `capability-source-inspection` |
| 2 | **Contract Extractor** | Read a function, emit its formal input/output contract. | `capability-specification-extractor` + tsc type API |
| 3 | **Impact Radiator** | Proposed change → all affected files/tests via call-graph traversal. | `capability-chain-relationship-detector` + `capability-observed-chains` |
| 4 | **Test Whisperer** | Given a contract, generate acceptance tests by inverting boundaries. | `capability-verification-case-generator` + `capability-i-test-synthesis` |
| 5 | **Doctrine Enforcer** | Reject plans that violate any `docs/doctrine/*.md` rule. | Doctrine parser + `capability-h-planning` |
| 6 | **Migration Composer** | Schema-change intent → SQL + type-changes + code-changes atomically. | AST rewriter + tsc + existing migration templates |
| 7 | **Refactor Navigator** | "Make this cleaner" → enumerate candidates + rank by size delta while tests pass. | Small grammar + `capability-candidate-ranker` |
| 8 | **Cross-repo Pattern Miner** | Mine corpus for patterns · propose "this app usually does X this way". | Corpus onboarding + AST diff |
| 9 | **Session Historian** | Founder-preference model + correction history. | ConversationHead extension |
| 10 | **Ambiguity Resolver** | 55-70% confidence → generate 2-3 interpretations · ask founder. | Existing intent classifier + C7 pattern |
| 11 | **Verification-First Composer** | Test BEFORE code. Test-driven native coding. | `capability-verification-case-generator` first, then coding |
| 12 | **Documentation Weaver** | AST + comments + commits → live docs. | AST parser + git blame reader |
| 13 | **Performance Sentinel** | Warn on nested-loops, N+1, blocking IO. | AST pattern matcher |
| 14 | **Dead Code Locator** | Unused exports, unreached branches. Reachability analysis. | tsc + call-graph |
| 15 | **API Boundary Guard** | Infer contract of every public route/exported function. Warn on breaking changes. | tsc + inference rules |
| 16 | **Founder Voice Learner** | Passive linguistic profile builder. | Text analyser + persistent JSONL |
| 17 | **Anti-Pattern Vaccine** | Every rejected lesson becomes a proactive check. | Learning-ledger antiPatterns[] extension |
| 18 | **Curiosity Agent** | Unfamiliar code → ask founder OR launch mini-investigation. | Existing investigation mode + explicit trigger |

## Part 6 · The mental model · "LLM without LLM"

LLMs get power from:
- **Massive latent knowledge** (pretraining corpus)
- **Probabilistic generalisation** (attention transfer)
- **Free-form generation** (next-token sampling)

We replace each with a native equivalent:

| LLM ingredient | Native equivalent |
|---|---|
| Latent pretraining corpus | **Semantic tree of the codebase (C1) + case-based reasoning (C3) + rule algebra (C6)** |
| Attention over long context | **Precomputed answer graph (C8) + type-flow reasoning (C4)** |
| Free-form generation | **Program synthesis on bounded domains (C5) + skill compilation (C9)** |
| Instruction-following via pretraining | **Deterministic paraphrase library (C2) + interactive intent refinement (C7)** |
| Chain-of-thought | **Full trace with cited evidence — already native** |
| Self-critique | **Multi-agent consensus without RNG noise — already native** |
| Memory | **ConversationHead as graph (C10)** |
| Style | **Founder-voice learner (C12)** |

**Every LLM capability has a deterministic zero-LLM analog.** We don't have to be smaller than an LLM. We have to be more *specific*.

## Part 7 · Why this beats LLM on our workload

Our workload is:
- ONE founder
- ONE repository (mostly)
- Bounded intents (features · fixes · refactors · migrations · routes · tests · explanations)
- Doctrine-heavy
- Safety-critical
- Reproducibility mandatory

For THIS workload, the native path outperforms an LLM in almost every quality axis except free-form generation. And free-form generation is where LLMs hallucinate.

For general chat with the whole internet, LLMs win. For engineering YOUR codebase, native intelligence — done right — wins on:
- Truthfulness (cited evidence)
- Consistency (deterministic)
- Auditability (traces)
- Safety (provable)
- Cost (flat)
- Ownership (in your repo)

The LLM systems are trying to be *general*. We can be *deep*.

## Part 8 · Order of build · smallest first

If you decide to build the frontier, this is the order of maximum leverage per unit of effort:

1. **C1 · Semantic tree** — foundation for C4, C8, agents 1-6. Biggest force multiplier. Uses tsc.
2. **C10 · ConversationHead → knowledge graph** — extension of existing infra. Enables agent 9.
3. **C2 · Paraphrase library** — additive; every correction improves it. Enables agent 10.
4. **C5 · Program synthesis for bounded domains** — already partly built via candidate-comparator/ranker/selector. Extend to more grammar rules. Enables agent 7.
5. **C3 · Case-based reasoning** — extend learning-ledger (per §5 of Teaching Agent doctrine). Enables agent 9.
6. **C6 · Rule algebra** — parse doctrine markdown → executable rules. Enables agent 5.
7. **C12 · Founder-voice learner** — passive, silent, always improving.
8. **C7 · Interactive intent refinement** — restructures the classifier flow.
9. **C4 · Type-flow reasoning** — powers agents 3, 13, 14, 15.
10. **C8 · Precomputed answer graph** — biggest storage cost; do after C1 is stable.

Each of these is a small independent batch. None require an LLM. None require the 40+ agent orchestration. All can be RUNTIME_VERIFIED individually.

## Part 9 · What I am NOT proposing

- Do not build all 12 concepts at once
- Do not build all 18 agent-skills at once
- Do not touch the Truth Engine (frozen)
- Do not skip the audit → gate → implement pattern
- Do not merge this doctrine into production behaviour without your explicit authorization
- Do not treat this analysis as an implementation plan

This is a **frontier map**. It says: here is where the terrain gets interesting, and here are 20 specific footpaths. You decide which one we walk first.

## Part 10 · Founder decision surface

When you return to chat coding and want to authorize one of these, the smallest possible first slice is:

**"Build C1 · Semantic tree · phase 1 · function-and-import graph only. Read-only. Query API. No consumers yet."**

That single deliverable unlocks agents 1, 2, 3, 14, 15 as follow-ups. Each of those is a 200-line agent. Each verifiable in a real HTTP probe.

If you'd rather start smaller: **agent 10 (Ambiguity Resolver)** is buildable today with the existing classifier. It replaces `refused_no_verb_recognised` with a 3-option clarification. 1-2 days of work. Immediate UX win for chat.

Your call.
