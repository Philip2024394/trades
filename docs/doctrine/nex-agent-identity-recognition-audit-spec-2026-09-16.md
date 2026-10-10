# NEX Agent Identity Recognition Audit · Specification

**Founder-authorised 2026-09-16 · Companion to `nex-language-architecture-doctrine.md`**

> "The current evidence doesn't prove that broken language causes the identity problem, but it gives us a very good reason to test that relationship before assigning more NEX numbers."
> — Founder, 2026-09-16

This document specifies the **Agent Identity Recognition Audit** as a required investigation before any further NEX number designation proposals. The audit tests whether NEX1's current native capabilities can correctly recognise, describe, and propose identities for agents in the codebase — WITHOUT fabricating answers.

---

## §1 · The progression this audit sits within

Founder's stated NEX architectural progression:

```
            NEX1
              │
       ┌──────┴──────┐
       ↓             ↓
 LANGUAGE      CODE UNDERSTANDING
       │             │
       └──────┬──────┘
              ↓
        AGENT RECOGNITION
              ↓
        IDENTITY PROPOSAL
              ↓
          NEX NUMBER
              ↓
       CAPABILITY TEST
              ↓
          NI STATUS
```

**Reading**: Language and Code Understanding are prerequisites for Agent Recognition. Agent Recognition is a prerequisite for Identity Proposal. Only proven identity produces a NEX Number. Only proven capability produces an NI Status.

The Language Architecture Doctrine established the language layer is fragmented. This audit tests whether that fragmentation blocks Agent Recognition.

---

## §2 · The Ten Questions

For any candidate agent X in the codebase, NEX1 must attempt to answer:

| # | Question | Answer must be backed by |
|---|---|---|
| Q1 | Is this an agent? | Structural code evidence (registered in agent-registry / exports agent-shaped module / etc.) |
| Q2 | What is its actual purpose? | Code + comments · not fabricated summary |
| Q3 | What capabilities does it contain? | AST-visible exports · registered capabilities · not inferred |
| Q4 | Who consumes it? | Grep-verified in-repo callers |
| Q5 | What does it consume? | Grep-verified import graph |
| Q6 | What domain does it belong to? | Tags · registry entries · not domain guessing |
| Q7 | Is it duplicated elsewhere? | Cross-file structural similarity · not vibe-similarity |
| Q8 | Is it currently connected to runtime? | Consumer chain reaches an active HTTP/CLI/cron path |
| Q9 | What evidence supports the identity? | File paths + line numbers + tests + registry entries |
| Q10 | Can NEX1 propose a unique identity without guessing? | Requires Q1-Q9 to be answered with concrete evidence |

**Founder rule**: If NEX1 cannot answer a question from concrete evidence → **UNKNOWN**, not a fabricated name or invented purpose.

---

## §3 · Methodology (native-only)

NEX1 must attempt each question using ONLY its native deterministic capabilities. LLM assistance is forbidden per the No-LLM Hard Rule.

**Permitted tools** (per prior NEX1-only test rules):
- `classifyFounderIntent()` — Capability A · vocabulary + verb-family + deliverable classification
- `createFileMemoryStore()` — Capability M-1 · file metadata + caller-supplied summary
- AST semantic parser (TypeScript compiler API) at `nex-agent/code-engine/adapters/ast-semantic.ts`
- Native-programming-loop's file:line regex
- Deterministic developer tools · grep, ripgrep, glob, TypeScript compiler (permitted as they are tools, not intelligence)

**Forbidden**:
- Any LLM call (Claude / GPT / Gemini / etc.)
- Fabricated summaries or purposes
- Confident answers where evidence is missing
- Substituting "developer intuition" for structural evidence

**Verdict for each answer**:
- **KNOWN** — evidence-backed answer produced
- **PARTIAL** — some evidence available but incomplete
- **UNKNOWN** — insufficient evidence; NEX1 correctly refuses to guess

---

## §4 · Test corpus (representative agents)

The audit must run against **at least two structurally different agents** to test whether NEX1's recognition scales or is single-case-fitted.

Recommended test agents (from prior audit inventory):

1. **NEX Nex Orchestrator** (`src/lib/nex/agent.ts`) — LLM-backed conversational orchestrator · AI_DELEGATED
2. **Reflex Brain** (`src/lib/nex/reflex/reflex-brain.ts`) — deterministic tier-1 pattern matcher · SPECIALIST
3. Optionally: **Security Agent** (`src/lib/nex/security-agent/security-agent.ts`) — 4th Guardian tier
4. Optionally: **Any one Coding Team agent** (`src/lib/nex-coding-team/agents/*`)

---

## §5 · Recording protocol

The audit produces one row per (agent × question) — 20+ rows total. Each row records:

- Agent ID
- Question number
- NEX1's answer (or UNKNOWN)
- Evidence source (file path + line if applicable)
- Whether the answer came from NEX1 native capabilities OR from developer tools (grep, AST) OR from fabrication (forbidden)
- Founder's Anti-Bullshit classification: FACT / INFERENCE / UNKNOWN

---

## §6 · Expected outcomes (hypotheses to test)

Founder's implicit hypothesis: NEX1 cannot answer most of the 10 questions natively. If true, this proves that the Language Architecture fragmentation feeds directly into an Agent Recognition gap.

**Predictions per question class**:

| Q | Prediction | Native tool candidate |
|---|---|---|
| Q1 (is agent?) | UNKNOWN or PARTIAL | Requires "agent detection" heuristic NEX1 does not have |
| Q2 (purpose) | UNKNOWN | Requires generative comprehension |
| Q3 (capabilities) | PARTIAL via AST | AST semantic can enumerate exports |
| Q4 (consumers) | PARTIAL via grep | Grep is a permitted developer tool |
| Q5 (imports) | PARTIAL via grep or AST | Same as Q4 |
| Q6 (domain) | UNKNOWN | Requires semantic classification of concept clusters |
| Q7 (duplicated?) | UNKNOWN | Requires cross-file semantic similarity |
| Q8 (runtime connected?) | UNKNOWN | Requires transitive-consumer analysis |
| Q9 (evidence) | PARTIAL via file memory | File Memory tracks metadata evidence |
| Q10 (unique identity?) | UNKNOWN | Depends on Q1-Q9 · unlikely to have enough evidence |

**Expected total**: ~7 UNKNOWN, 3 PARTIAL, 0 fully KNOWN per agent. If the actual outcome matches, the founder's hypothesis is confirmed with evidence.

---

## §7 · What this audit does NOT do

- Does **not** authorise implementing agent-recognition capability.
- Does **not** authorise more NEX designation proposals.
- Does **not** claim NEX1's inability is a defect — it may be an intentional scope boundary.
- Does **not** substitute for the System Connectivity Proof (Two-Proof Rule) required for any language capability.

---

## §8 · Once complete

After the audit runs, the founder decides:

1. Whether to build a native Agent Recognition capability (would become a candidate for a NEX-nn designation later).
2. Whether existing NEX designations (NEX-01 OFFICIAL · NEX-02 PROPOSED) require re-examination given the audit findings.
3. Whether the Language → Agent Recognition connection is real (i.e., does fixing language fragmentation also improve agent recognition, or are they orthogonal problems?).

---

## §9 · Immutability

This spec is v1.0. Append-only. Amendments produce dated new versions.

**SEALED · 2026-09-16 · v1.0**
