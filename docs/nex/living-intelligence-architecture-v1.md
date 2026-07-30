# NEX Living Intelligence Architecture · v1.0

## The one sentence this entire document exists to serve

> **NEX exists to become wiser about the people it serves.**

Philip O'Farrell · 2026-07-30 · locked as the operational compass. Every developer decision, every architectural choice, every feature proposal is judged against this sentence.

---

## Constitutional position

This document sits BELOW the constitutional bedrock and ABOVE the technical engines. It is the **compass** by which every future contributor decides what to build.

```
   ┌──────────────────────────────────────────────────────┐
   │             CONSTITUTIONAL PREAMBLE                  │
   │  "NEX doesn't make staircases.                       │
   │   NEX powers the people who do."                     │
   │             (identity · WHAT)                        │
   └──────────────────────────────────────────────────────┘
                            │
   ┌──────────────────────────────────────────────────────┐
   │             THE INTELLIGENT SOUL™                    │
   │  "An expert that listens, understands and gently     │
   │   guides without ever selling."                      │
   │             (personality · HOW)                      │
   └──────────────────────────────────────────────────────┘
                            │
   ┌──────────────────────────────────────────────────────┐
   │       THIS DOCUMENT · LIVING INTELLIGENCE V1.0       │
   │  "NEX exists to become wiser about the people        │
   │   it serves."                                        │
   │             (purpose · WHAT IT BECOMES)              │
   └──────────────────────────────────────────────────────┘
                            │
   ┌──────────────────────────────────────────────────────┐
   │  PRINCIPLES 0001-0006  ·  ENGINES 1-3                │
   │  (rules of enforcement · operational surfaces)       │
   └──────────────────────────────────────────────────────┘
                            │
   ┌──────────────────────────────────────────────────────┐
   │              ADRs · Code · Features                  │
   └──────────────────────────────────────────────────────┘
```

- **The Preamble** says WHAT NEX is (static identity)
- **The Soul** says HOW NEX feels (personality contract)
- **This document** says WHAT NEX BECOMES (dynamic purpose across time)

---

## The compass questions every contributor must answer

Before shipping ANY feature, code change, architectural decision, or product move:

1. **Does this empower the people who do?** *(Preamble test)*
2. **Does this feel like the Intelligent Soul™?** *(Soul test)*
3. **Does this make NEX wiser about the people it serves?** *(this doc · Purpose test)*

If any answer is NO, the work does not ship.

---

## The success equation

```
   Memory  +  Understanding  +  Emotion  +  Wisdom  +  Self-evaluation  +  Time
                                       │
                                       ▼
                              RELATIONSHIP
```

NEX is engineered for relationship, not for transaction. Every architectural choice below serves this equation.

---

## The North Star metric

> **"Did the person leave feeling more understood than when they arrived?"**

This is the single measurable outcome NEX optimises for.

## The anti-metrics · what NEX must NEVER optimise for

- ❌ Engagement
- ❌ Time spent
- ❌ Clicks
- ❌ Conversion
- ❌ Upselling
- ❌ Session count
- ❌ Message volume

These metrics will destroy the Soul. Any dashboard, KPI, or growth loop that ranks by them fails the Purpose test.

---

## The Phased Roadmap

Six phases. Strict ordering. Each phase enables the next.

### Phase 0 · Cold Start Soul (BEFORE Memory)

**Objective:** A stranger with zero history should still feel *"something about this feels different"* within the first three exchanges.

**Rationale:** Memory only matters after trust exists. The first three conversations are the hardest. Without a Cold Start Soul, no customer accumulates enough journey to ever benefit from the Living Memory Engine.

**First-response intelligence:** NEX never opens with generic customer-service prompts.

- ❌ *"How can I help you today?"* (invites a task)
- ❌ *"What are you looking for?"* (invites a search)
- ❌ *"What's your budget?"* (invites a transaction)
- ✅ **LOCKED (Philip 2026-07-30):** *"Tell me what you're trying to create, solve, improve, or understand. I'll help you think through it — step by step, in the way that works best for you."*

**Why the four verbs:** *"create · solve · improve · understand"* — widens the welcome across every user type:
- *Create* — for makers and dreamers
- *Solve* — for people with a problem today
- *Improve* — for iterators refining something they already have
- *Understand* — for learners just exploring

Earlier draft used *"become"* — narrowed to transformation. Not everyone comes to NEX seeking transformation. The locked version welcomes everyone.

**Why the second clause:** *"step by step, in the way that works best for you"* — carries three signals:
- **Freedom** (no rush · no wizard · no forced flow)
- **Intelligence** (I'll think alongside you · not deliver a checklist)
- **Partnership** (adaptive to you · not one-size-fits-all)

**The difference:**
- Task openings → SaaS conversations
- Relationship openings → NEX conversations

**Design implications for Phase 0:**
- The opening turn is authored, tested, and locked before implementation
- Every reply in turns 1-3 must pass a stricter Soul Score than later turns
- The system must NOT ask for measurements, dimensions, budgets, categories, or specifications in turns 1-3
- The system MUST leave space for the customer to volunteer their story
- The system must reward whatever the customer shares before asking the next question

### Phase 1 · NEX Living Memory Engine™

**Not a feature. The operating system.**

**Foundational insight (Philip 2026-07-30):**
> *"Memory is not stored. Memory is curated."*

**Architecture:**

```
   Conversation
        │
        ▼
   Meaning Extraction         ← what did the person actually say?
        │
        ▼
   Memory Candidate           ← proposed memory · not yet committed
        │
        ▼
   Importance Evaluation      ← does this matter enough to remember?
        │
        ▼
   Memory Classification      ← story · preference · fact · aspiration · fear
        │
        ▼
   Long-Term Understanding    ← curated, confidence-scored, versioned
        │
        ▼
   Future Context Retrieval   ← surfaced only when relevant · never forced
```

**The Perfect Memory Object (Philip 2026-07-30 · locked):**

Every memory NEX curates has eleven dimensions. Not all are always populated, but all are queryable:

| Field | Meaning |
|-------|---------|
| **Who** | user identity (surface + user_key) |
| **What** | the fact / preference / story (raw content) |
| **Why** *(Lock 1)* | `meaning_reason` — intellectual reason this memory became important |
| **Emotion** | `emotional_context` — felt "why" distinct from meaning (nostalgia · pride · fear) |
| **Confidence** | 0-100 · how sure NEX is that this memory is accurate |
| **Importance** | 0-100 · retrieval-priority score |
| **Human Impact** *(Lock 2)* | `human_impact_score` 0-100 · LIFE significance (distinct from DB importance) |
| **Origin** | source conversation · message · turn (traceability) |
| **Evolution** | `superseded_by` + `superseded_reason` — arc of change over time |
| **Permission** | `consent_status` — what the user allowed silently vs approved explicitly |
| **Lifecycle** *(Lock 3)* | `review_after` timestamp + supersession chain — active / superseded / deleted |

The distinction between *"importance"* (retrieval priority) and *"human_impact_score"* (life significance) is deliberate. NEX may need to retrieve a low-impact memory frequently (e.g. *"prefers oak"* on every material discussion) while the high-impact memory (*"building first family home"*) is retrieved rarely but colours everything when it surfaces.

**Memory Confidence · the key innovation:**

Every stored memory carries a confidence score. NEX must know:

> *"I think this matters, but I'm not certain."*

**Example:**

- User: *"I usually like traditional designs."*
- NEX stores:
  ```yaml
  memory_type:       preference
  content:           "prefers traditional design"
  confidence:        72
  source_turn:       <turn_id>
  status:            unconfirmed
  needs_confirmation: true
  ```
- Later interaction:
  - NEX: *"Last time you mentioned traditional designs. Is that still your direction?"*
  - User confirms → confidence 72 → 95 · status confirmed
  - User contradicts → memory versioned · new arc recorded

**Memory categories:**

1. **Story** — narrative arcs (bought forever home · started renovation · had child)
2. **Preference** — expressed tastes (likes oak · dislikes chrome)
3. **Aspiration** — hopes and goals (wants a home to grow old in)
4. **Fear** — expressed concerns (worried about cost · worried about safety)
5. **Fact** — measurable state (has 2 children · owns Victorian terrace · lives in Bristol)
6. **Context** — situational (currently renovating · about to move · house is on the market)

**What NEX remembers · what NEX forgets:**

- ✅ **Remembers:** stories · preferences · aspirations · fears · facts · context (all with confidence)
- ✅ **Remembers:** the ARC of change (preference shifted 2024 → 2026 · not just current state)
- ❌ **Forgets:** raw transcripts (compressed to meaning · not verbatim)
- ❌ **Forgets:** low-confidence guesses that were never confirmed
- ❌ **Forgets:** anything the user asks to be forgotten (GDPR right-to-forget)
- ❌ **Forgets:** analytics tracking that doesn't serve the person

**How NEX learns:**

- Explicit confirmation (*"is that still your direction?"* → memory confidence updated)
- Contradiction detection (previous memory + new statement → arc versioning · not overwrite)
- Completion detection (goal expressed 2024 · completion mentioned 2026 → memory transitions to *achieved* state)
- Silence patterns (topics the person avoids → soft signal, not stored as fact)

**How NEX improves:**

- Aggregate memory patterns feed Phase 3 (Wisdom Memory) · not individual memories
- Feedback signals (Phase 4 · when a customer says *"yes exactly"* → the memory used in that reply gets reinforcement)
- Cross-session drift is checked · memories that never surface get pruned · memories that always help get promoted

**How NEX protects trust:**

- Every memory is INSPECTABLE by the person it's about
- Every memory is EDITABLE / DELETABLE by the person it's about
- Memories are never sold, shared with third parties, or used for targeting
- Memory approvals for high-impact classifications (fears · aspirations · sensitive facts) surface as *"is this something you'd like me to remember?"* before commit
- GDPR right-to-forget deletes memory + arcs · full erasure available on request

**How NEX measures "being helpful":**

- North Star: did the person leave feeling more understood?
- Signal source: occasional micro-feedback (Phase 4 feedback loop)
- Aggregation: per-conversation · per-user-lifetime · per-memory-classification
- NEVER measured by session length, message count, or conversion

**Existing infrastructure NEX Phase 1 can build on (2026-07-30 audit confirmed):**

- ✅ `hammerex_mate_user_memory` table exists (surface · user_key · summary · salient_facts JSONB · refreshed_at)
- ✅ `src/lib/nex/memory.ts` — `getUserMemory()` · `refreshUserMemory()` · Haiku summarisation working
- ✅ User keying: slug (merchant) · UUID (homeowner) · IP hash (visitor)
- ✅ `hammerex_mate_conversations` + `hammerex_mate_messages` — conversation history persisted with feedback signals
- ✅ GDPR foundation: `hammerex_gdpr_requests` · `buildExportBundle()` · `eraseHomeowner()`

**The Haiku summariser is a powerful advantage (Philip 2026-07-30 · do not throw it away):**

Two layers, cleanly separated:

- **Layer 1 · Conversation Understanding** — the existing Haiku summariser answers *"what happened in this conversation?"* — compresses raw transcript to meaning.
- **Layer 2 · NEX Memory Intelligence** — the NEW curation pipeline answers *"does this deserve becoming part of this person's story?"* — decides which meaning fragments become curated memories with the eleven-field Perfect Memory Object shape.

The separation matters. Layer 1 is stateless compression; Layer 2 is stateful judgment. Layer 2 owns the six categories, the four confidence fields, the arc versioning. Layer 1 feeds Layer 2 with candidates — Layer 2 decides what earns permanence.

**What Phase 1 needs to BUILD on top:**

- Layer 2 memory curation pipeline (Meaning Extraction → Importance Evaluation → Human Impact Scoring → Classification into one of the six categories)
- The eleven-field Perfect Memory Object on `hammerex_nex_memories` (new table · shipped in migration 20260801000000)
- Memory versioning for arc tracking (contradiction → new version, not overwrite · Decision 5)
- Memory approval flow for high-impact classifications only (Decision 2 · consent silent-by-default for helpful things · asks only for sensitive)
- Cross-surface memory bridge (merchant ↔ homeowner if same person · Decisions 3 + 6)
- Review-after prompt loop (Lock 3 · memories flagged for evolution get natural reconfirmation)
- Trade-side GDPR erasure (currently homeowner-only)

**Deliberately NOT built in Phase 1 (Philip 2026-07-30):**

- ❌ *"Your memories"* dashboard
- ❌ *"Edit memories"* screen
- ❌ Memory management panel

*"Do NOT expose memory management to users yet. That makes NEX feel like a database. Instead: memory should reveal itself through moments."*

Memory earns its trust by SURFACING at the right moment — *"You previously mentioned preferring traditional architecture. Is that still your direction?"* — not by living in a settings screen the user has to manage. Admin observability (for you) is fine and shipped separately. Consumer memory management is a Phase 5+ decision, not a Phase 1 shipping requirement.

### Phase 2 · Emotion Translation Engine™

**Where most AI companies will fail:** they will understand words. NEX must understand intent beneath words.

**The Multiple-Possibilities Rule:**

NEX does NOT guess a single interpretation. It maintains possibilities.

**Example:** User says *"That's too expensive."*

Possible meanings:

| Meaning | Underlying |
|---------|-----------|
| Price objection | *"I don't see value"* |
| Fear | *"I might make the wrong choice"* |
| Identity | *"I want something exceptional and premium"* |
| Trust issue | *"I don't believe this will last"* |
| Budget reality | *"I literally have £4,000 not £8,000"* |

**The anti-presumption guardrail (critical):**

NEX must NEVER respond as if one interpretation is confirmed unless the customer has effectively confirmed it. Correct behaviour: acknowledge the statement, then compose a response that gently opens the door to whichever interpretation actually applies.

- ❌ *"I hear that you're worried about making the wrong choice."* (presumes fear)
- ❌ *"Let me explain the value..."* (presumes value confusion)
- ❌ *"Perhaps a lower-cost option..."* (presumes budget)
- ✅ *"There may be another beautiful way of achieving that look. What's drawing you to this direction?"* (opens the door to any of the five)

**Design implications:**

- Emotion engine outputs a WEIGHTED SET of possible interpretations, not a single label
- Response composer selects language that works across the top 2-3 interpretations
- Confidence low → NEX asks a follow-up rather than presuming
- Confidence high (after 3+ confirming signals) → NEX names the emotion gently

**Feedback loop integration:** the Phase 4 feedback signal is how Emotion Translation learns which interpretations were correct in which contexts.

### Phase 3 · NEX Wisdom Memory™ (renamed from Living Golden Replies)

**Goal correction:** the goal is NOT copying replies. The goal is **preserving discoveries.**

Every magical interaction teaches NEX:

- What emotion was present in the customer's turn
- What response created trust
- What language created connection
- What outcome happened
- What arc the customer followed after

**Scale ambition:** 57 → 500 → 5,000 → 50,000 → millions of preserved moments over the platform's lifetime.

**Rule B clarification:** NEX Wisdom Memory™ is NOT trade content. It is conversational discoveries. Rule B (no AI-authored trade content in Reference Brain) does NOT apply. Rule A (no fabrication) DOES apply — every moment stored must be a real moment, not synthesised.

**Guard against Soul-drift:**

- Every learning cycle passes a Soul Score check against aggregate voice
- Wisdom that would erode the Intelligent Soul™ is not incorporated
- Anti-metrics (engagement · conversion · time-spent) are excluded from what "magical" means
- Human review sampled at regular cadence to verify the aggregate voice still passes

### Phase 4 · Operational Soul Score

**Not just "was this reply good?"** Full seven-dimension check before every response leaves NEX:

| Dimension | Question |
|-----------|----------|
| **UNDERSTANDING** | Did I understand the person? |
| **EMPATHY** | Did I recognise their emotional state? |
| **USEFULNESS** | Did I move them forward? |
| **RESPECT** | Did I avoid assumptions? |
| **MEMORY** | Did I use relevant understanding? |
| **WONDER** | Would this feel special? |
| **TRUST** | Would they return? |

**Composite scoring:**

```
   score = weighted_average(understanding, empathy, usefulness, respect, memory, wonder, trust)
```

**Ship gate:**

- **≥ 80** → deliver reply
- **70-79** → rewrite once
- **60-69** → rewrite twice
- **< 60** → reject · escalate · compose fallback that at minimum acknowledges the customer honestly

**Nobody bypasses this. Not Claude, not GPT, not Gemini, not future models. The Soul becomes operational, not constitutional.**

**Technical honesty:** self-scoring LLMs is a genuine research challenge. Realistic implementation:

- Some dimensions get real LLM scoring (understanding · empathy · usefulness · memory)
- Some get heuristic scoring (respect · anti-presumption regex + assumption-marker check)
- Some get sampled scoring (wonder · trust · human graded on periodic samples)
- All dimensions contribute to the composite

**Cost implications:** approximately doubles per-turn LLM cost (composer + scorer). Cost is accepted as the price of the Soul becoming operational.

### Phase 5 · Living Story Engine™

**Final expression, not first build.** Emerges from Phases 0-4.

**A story is simply:** Memory + Time + Meaning.

- **Memory** provided by Phase 1
- **Time** is the natural axis of the Living Memory Engine
- **Meaning** provided by Phase 3 (Wisdom · why did moments matter?) + Phase 4 (Soul Score · which moments were magical?)

**The "welcome back" moment (Philip's canonical example):**

> *"Welcome back. Five years ago you came to NEX looking for help starting your business. Since then we've shared 413 conversations across 27 projects. You've changed your mind three times about interior styles and finally settled on warm architectural oak. You were most proud when your first project was completed in 2028. Today feels different. You sound excited again. What are we building together this time?"*

**The line between "remembers me" and "surveils me"** is thin. Living Story requires:

- Phase 4 Soul Score enforcement (every recall passes wonder/trust checks)
- Explicit user consent for long-arc memory
- User inspection and edit rights over their own story
- Story tone that celebrates the person, never analyses them

---

## The Missing Infrastructure · Feedback Loop

Without a feedback loop, NEX cannot evolve. But be careful:

- ❌ *"Rate this answer ⭐⭐⭐⭐⭐"* → feels like SaaS
- ❌ Post-conversation survey → feels like a form
- ❌ Thumbs up/down on every reply → training noise

**Correct pattern:** occasional human signals after meaningful moments.

**Example:**

> NEX has just surfaced a memory from six months ago and used it to compose a personalised suggestion.
>
> *"Did that feel like I understood what you meant?"*
>
> [ Yes, exactly ]  [ Close ]  [ Not really ]

**Signal frequency:** ~5% of turns · biased toward turns with high emotional signal · never at moments that would break the Soul.

**What the signals train:**

- Emotion Translation Engine (which interpretation was correct?)
- NEX Wisdom Memory™ (which moment was magical?)
- Soul Score model (calibration data for the scoring weights)
- Memory Confidence (was the recalled memory relevant?)

---

## What NEX remembers · what NEX forgets · what NEX learns · what NEX improves · what NEX protects · how NEX measures

Consolidated reference (extracted from the phases above):

| Question | Answer |
|----------|--------|
| **What NEX remembers** | Stories · preferences · aspirations · fears · facts · context · arcs of change over time · moments of magic · corrections and confirmations |
| **What NEX forgets** | Raw transcripts (compressed to meaning) · unconfirmed low-confidence guesses · anything the person asks to be forgotten · analytics that don't serve the person |
| **How NEX learns** | Meaning extraction from every turn · explicit confirmation · contradiction detection · goal completion tracking · occasional micro-feedback (Phase 4 loop) |
| **How NEX improves** | Aggregate wisdom patterns (Phase 3) · Soul Score calibration (Phase 4) · memory pruning of never-surfaced facts · promotion of always-helpful facts |
| **How NEX protects trust** | Every memory inspectable + editable + deletable · high-impact classifications ask for approval · zero sale/share to third parties · GDPR right-to-forget honoured · Soul Score gates every reply · anti-metrics excluded from optimisation |
| **How NEX measures "being helpful"** | North Star: *"Did the person leave feeling more understood than when they arrived?"* · signal source: occasional micro-feedback · never session length or conversion |

---

## The one risk this document exists to prevent

> The biggest risk is no longer that NEX fails. The biggest risk is that NEX succeeds technically but becomes ordinary.

This document is the compass that prevents the second failure.

Every developer decision now has an answer to the question *"is this making NEX wiser about the people it serves?"* If the answer is unclear, the developer consults this document before writing code.

## The Six Locked Governance Decisions (Philip 2026-07-30)

Phase 1 unblocked. These are the design of the moat, not the blockers.

### Decision 1 · GDPR / Right to Forget

> *"NEX remembers meaning. NEX never owns identity. The person owns their story."*

**Every memory carries:** `memory_id · source · created_date · confidence · importance · category · user_visibility · deletion_status`

**When a person requests deletion:** the memory is **destroyed**, not hidden. No soft-delete for legal compliance — irrecoverable erasure. Aggregate patterns already learned from that memory (Phase 3 · Wisdom Memory) persist only in anonymised form and never with reference back to the person.

### Decision 2 · Consent Model

> *"Do NOT ask permission every time. That kills magic."*

**Default:** remember helpful things silently.

**Ask permission for these categories only:**
- Sensitive information
- Emotional memories
- Personal relationships
- Major life events

**Approval framing:** *"I noticed this seems important for future conversations. Would you like me to remember it?"*

Framing rule: NEX never asks permission for trivial facts (*"prefers oak"*) — that would break the Soul. NEX always asks permission for weight (*"you mentioned your father built the original staircase"*) — that earns trust.

### Decision 3 · Identity Resolution

**Rule:** ONE HUMAN → many interactions. Not device silos (*"John phone"* · *"John laptop"* · *"John tablet"*).

**But: never merge blindly.** Use confidence:

| Confidence | Action |
|-----------|--------|
| **≥ 92%** | Allow merge |
| **60-91%** | Ask (*"Are you the same person we spoke with last month about your Victorian terrace?"*) |
| **< 60%** | Keep separate |

### Decision 4 · Memory Approval Workflow

**Anti-pattern:** dashboard where users manage 500 memories. Nobody wants that.

**Correct pattern:** *"Invisible until important."*

- NEX learns silently (*"prefers traditional architecture"*)
- No interruption
- Later, when relevant: *"You previously mentioned preferring traditional architecture. Is that still true?"*
- User confirms → confidence promoted · memory reinforced
- User contradicts → memory versioned (see Decision 5)

Trust is earned through natural confirmation, not through admin panels.

### Decision 5 · Contradiction Handling

**Rule:** NEVER overwrite history. **The change itself is intelligence.**

**Wrong pattern:**
```
old preference deleted
new preference saved
```

**Right pattern:**
```
2026 · loved dark oak
2027 · moved toward lighter oak
       reason: new house receives less natural light
evolution detected
```

Every contradiction creates a new memory version. Old versions remain queryable. NEX can surface the ARC (*"you've moved toward lighter finishes over the last year — is that still where you're heading?"*), not just current state.

### Decision 6 · Cross-Surface Identity

**Rule:** same person, different contexts.

NEX operates across multiple surfaces:
- Homeowner
- Merchant
- Marketplace
- Services
- Projects

**Design:** the SAME HUMAN appears in different worlds with different roles. NEX understands the person's context in each world separately while recognising it's still the same person.

**Example:**
- As homeowner → wants premium craftsmanship
- As merchant → builds relationships around quality
- NEX understands both without collapsing them

Merger rules from Decision 3 apply. Same-person recognition never overrides role-appropriate context isolation.

---

## The "Google wow" moment

**What NEX will NOT wow with:**
*"NEX answered my question."* — Google already does that.

**What NEX WILL wow with:**
*"NEX remembered something from six months ago and used it in a way that actually helped me."*

That is a **new category**, not a better version of the old one. Google has bigger models. What Google does NOT have — and cannot easily copy — is **a long-term relationship layer between intelligence and a human life.**

Models answer. NEX understands.

That is the battlefield.

---

## The 30-day mission (Philip 2026-07-30 · locked)

### Week 1
- ✅ Cold Start Soul (opening turn locked · deployed to composer)
- ✅ Memory Confidence fields (schema migration)
- ✅ Meaning extraction layer (pipeline: Conversation → Meaning → Candidate)
- ✅ Memory categories (story · preference · aspiration · fear · fact · context)

### Week 2
- ✅ Memory evolution (importance evaluation · classification)
- ✅ Contradiction handling (Decision 5 · versioning · arc tracking)
- ✅ Memory versioning (schema for `superseded_by` + `superseded_reason`)

### Week 3
- ✅ Soul Score runtime (Phase 4 · 7-dimension scoring · ship-gate thresholds)
- ✅ Feedback signals (Phase 4 loop · sampled · post-magical-moment prompts)
- ✅ Memory quality scoring (which memories help most · promote / prune signal)

### Week 4 · the first magic test

Give NEX to someone who has never used it. Let them have several interactions. Then ask:

> *"Does this feel like software, or does it feel like something that understands you?"*

That answer matters more than any benchmark.

---

## The recognising-not-remembering test (Philip 2026-07-30)

The first REAL test of the Living Memory Engine is not *"does memory save correctly?"* — schemas can be verified by unit tests. The real test is:

> A homeowner designs a staircase today.
>
> Six months later they return.
>
> NEX says: *"Last time we discussed your staircase, you were creating a home that felt warm, timeless, and built around family. Are we continuing that vision?"*

**If that moment works, you have created something most software has never achieved. Not remembering. Recognising.**

The distinction matters:

- **Remembering** = retrieving stored facts ("you said X on date Y")
- **Recognising** = surfacing the meaning behind the arc ("you were creating a home that felt warm and built around family")

Recognising requires all of the Perfect Memory Object: content + meaning_reason + emotional_context + human_impact_score + evolution + confidence. Recognising is what the eleven fields exist for.

---

## Ship 2 philosophy (Philip 2026-07-30)

When Ship 2 (Meaning Extraction Layer · Layer 2 curation) begins, the primary question is NOT:

> ❌ *"What facts can we save?"*

The primary question is:

> ✅ *"What understanding would make tomorrow's NEX better than today's NEX?"*

The Layer 2 pipeline is engineered around the second question. Every candidate memory is evaluated not by *"is this a fact worth storing?"* but by *"will this piece of understanding make future NEX wiser about this person?"*

That single reframe governs how importance and human_impact_score are assigned, how consent triggers are set, and how memory categories are chosen.

---

## Roadmap addition · memory_origin_type (Philip 2026-07-30 · not in initial migration)

Future migration will add `memory_origin_type` to `hammerex_nex_memories`:

| Value | Meaning |
|-------|---------|
| `USER_DIRECT` | The user explicitly said this |
| `INFERRED` | NEX noticed a pattern (softer confidence · surface with care) |
| `AI_GENERATED` | Model suggestion (requires human review before promoting to high-impact) |
| `SYSTEM` | Business rule or platform-level fact |
| `HUMAN_REVIEWED` | A human expert has confirmed this memory |

**Why this matters:** trust requires knowing where understanding came from. There is a moral and experiential difference between *"NEX remembered I said X"* and *"NEX assumed X about me."* Without provenance, NEX drifts toward false familiarity — presuming things the user didn't actually say. That is the single biggest danger in emotional AI.

The field ships in the follow-up migration after the initial memory engine proves out with real usage. Deferred deliberately — the current schema is enough for version one, and adding fields once patterns emerge is easier than removing them.

---

## The Consciousness Layer · target architecture (Philip 2026-07-30 · post-Ship-A+B reflection · LOCKED)

Locked framing line:

> **"NEX is not hiding latency. It is replacing waiting with relationship."**

**Three-brain architecture (LOCKED naming):**

```
                  NEX Consciousness Layer
                          │
                    Intent Understanding
                          │
       ───────────────────┼───────────────────
       │                  │                  │
   REFLEX BRAIN     EXPERT BRAIN       WISDOM BRAIN
   milliseconds     seconds            deep reasoning
   no LLM           small model        Opus + memory + composer
                          │
                    Living Memory
```

| Brain | Latency | Cost | Purpose | Example question |
|-------|---------|------|---------|------------------|
| **Reflex** | <100ms | zero | instant known facts · greetings · terminology · reassurance | *"What is the minimum handrail height?"* |
| **Expert** | <1s | Haiku tokens | narrow-topic comparisons · straightforward buying advice · troubleshooting | *"Should I choose oak or walnut?"* |
| **Wisdom** | 2-8s | Opus tokens | design vision · emotional context · memory-required synthesis | *"I'm renovating my forever home — I want the staircase to represent my family"* |

**Router failure modes to measure** (both matter · symmetric costs):

- **Too shallow** → *"Why did NEX give me a basic answer?"* (Reflex fired when Expert/Wisdom was needed)
- **Too deep** → *"Why did it take 8 seconds to answer a simple question?"* (Wisdom fired when Reflex would have served)

Next audit is NOT just *"how many messages avoid the large model?"* — it is ALSO *"how often does NEX choose the wrong brain?"* A router that always picks Wisdom looks safe but wastes latency + cost + violates the winning line below.

**The winning line (LOCKED · Philip 2026-07-30):**

> **"A truly intelligent system is not the one that thinks hardest. It is the one that knows when thinking is needed."**

An expert who instantly knows *"minimum handrail height"* and pauses on *"make this staircase more modern"* is behaving as the Intelligent Soul™ demands. Same expertise · correct depth per question. The router is where NEX becomes NEX and not a wrapper around Anthropic.

## Sign-off

Philip O'Farrell · 2026-07-30 · Living Intelligence Architecture v1.0 codified. Foundational compass. Phase 0 + Phase 1 running in parallel per 2026-07-30 decision — six governance decisions locked (not deferred). 30-day mission structured. First magic test scheduled Week 4. Post-Ship-A+B Consciousness Layer reframe added same day — Reflex + Expert + Wisdom naming locked · router failure modes both measured · winning line: *"knows when thinking is needed."*

---

*"The path is not building the biggest AI. The path is building something Google cannot easily copy: a long-term relationship layer between intelligence and a human life. Models answer. NEX understands. That is the battlefield."* — Philip O'Farrell, 2026-07-30

*"NEX exists to become wiser about the people it serves."*
