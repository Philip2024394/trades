# NEX LANGUAGE ARCHITECTURE DOCTRINE

**Founder-authorised · 2026-09-16 · IMMUTABLE**

> "Why does NEX have nine different ways of understanding language in the first place?"
> — Founder question, 2026-09-16.

This doctrine defines NEX's intended language architecture. It sits alongside the previously-sealed doctrines:

- Anti-Bullshit + Architectural Quality
- NEX1 No-LLM Hard Rule
- Three-Tier Acceptance
- Historical Wave Receipt Immutability
- NEX Native Intelligence (NI) Doctrine
- NEX Safety Doctrine v1.0
- NEX Designation Governance

The evidence backing this doctrine lives in `nex-language-current-state-inventory-2026-09-16.md`, which enumerates every language subsystem in NEX today with paths, tokenizers, vocabularies, and verified consumers.

---

## §1 · The problem this doctrine addresses

**FACT** — A read-only architectural audit on 2026-09-16 confirmed that NEX currently contains **at least nine parallel language subsystems**, five distinct tokenizers, and three competing intent classifiers. They do not share state. They disagree on ambiguous inputs (underscores, contractions, punctuation, stopwords). Capability A — the classifier this session has been improving through Alphas 6-10 — is a **dead-end module** with no in-repo consumer outside its own HTTP endpoint.

**FACT** — The same English sentence sent to different NEX endpoints receives different interpretations depending on which endpoint happened to receive it.

This doctrine does not blame any subsystem. It sets the architectural rules for how NEX's language layer should be structured going forward.

---

## §2 · The Two-Proof Rule

**Founder principle (2026-09-16):**

> "Tests can prove that a component works without proving that the system uses the component."

Every NEX language capability must pass **two independent proofs** before it can be claimed as functionally shipped:

### Proof 1 · Component Proof
Does this thing do what it says it does?

- Unit and integration tests demonstrate the component's behaviour.
- Verdict: `Nex1IntelligenceStatus` (NATIVE / AI_DELEGATED / HYBRID / NOT_IMPLEMENTED / UNKNOWN).

### Proof 2 · System Connectivity Proof
Is the thing actually connected to the system that needs it?

- Grep for in-repo consumers of the component's public API.
- Trace at least one representative user input from entry point to answer through the component.
- Verdict: `CONNECTED / PARTIALLY CONNECTED / NOT CONNECTED / UNKNOWN`.

**A component that passes Proof 1 but fails Proof 2 is not shipped.** It is a **dead-end island** — a real capability with no destination. This exactly describes Capability A after Alphas 6-10.

This rule is mandatory for every future NEX language shipment.

---

## §3 · The canonical target architecture

This is the architectural direction NEX language should converge toward. It is not an implementation decision. It is the map against which all current subsystems will be classified.

```
                   USER LANGUAGE
                        ↓
              CANONICAL LANGUAGE LAYER
              (normalisation · tokenisation ·
               UK-English aliases · stopwords)
                        ↓
          ┌─────────────┴─────────────┐
          ↓                           ↓
      CONTEXT                       INTENT
      (NEX-02 candidate            (classification
       Context Intelligence)        with evidence)
          ↓                           ↓
       SKILLS                       DOMAIN
       (specialist capabilities,   SPECIALISTS
        code-engine, brain,        (accommodation,
        AST, safety-doctrine)      staircase, kitchen,
          │                        merchant, etc.)
          └─────────────┬─────────────┘
                        ↓
                     BRAIN
                     (integration + memory)
                        ↓
                     ACTION
                        ↓
                     ANSWER
```

**Rules of this architecture:**

1. **One canonical language layer** — every user sentence flows through the same normaliser and tokenizer regardless of endpoint. No competing tokenizers in the canonical path.
2. **Context and Intent are separate signals** — Context (NEX-02) enriches; Intent (classifier) decides. Neither replaces the other.
3. **Skills and Domain Specialists layer above the language layer** — they consume the canonical output. They do not re-tokenise. They do not consult their own private vocabulary if the canonical vocabulary already covers the token.
4. **Brain integrates**. Actions execute. Answers return with an execution receipt (per Safety Doctrine §2 `I_DID_IT`).
5. **Nothing under the canonical layer is authoritative.** Nothing in a specialist can override the canonical output — it can only add specialist evidence.

---

## §4 · Component classification vocabulary

Every existing language subsystem will be classified as one of:

| Class | Meaning |
|---|---|
| **CORE CANDIDATE** | Belongs in the canonical language layer. Design is sound and generic. Consolidation candidate as the canonical single source of truth. |
| **SPECIALIST** | Belongs above the canonical layer as a domain- or scope-specialist. Has legitimate specialist reason to exist. Should consume the canonical output where possible. |
| **LEGACY CANDIDATE** | Historical implementation that overlaps with a CORE CANDIDATE or SPECIALIST. Should eventually be migrated to consume the canonical layer. Not scheduled for deletion by this doctrine. |
| **DEAD END** | Currently has no in-repo consumer beyond its own HTTP surface / tests. May be an unused capability, an orphaned experiment, or a component awaiting connection. |
| **UNKNOWN** | Insufficient evidence to classify. Requires deeper inspection before decision. |

**Founder governance principle for these classifications:**

> "Do not decide deprecation merely because a component is unused."

A DEAD END classification is a **diagnostic finding, not a deletion order**. Every DEAD END component:
- Retains its Component Proof (its tests still pass).
- Has architectural value if connected.
- Is candidate for wiring, not for immediate removal.

---

## §5 · NEX-02's revised purpose (still PROPOSED)

Before this audit, the Context Evidence Gate shipped in Alpha.10 was proposed as **NEX-02 · Context Intelligence** with the specific scope of "reusable requirement-gate for the classifier".

The audit findings suggest a **larger role** may be appropriate:

> NEX-02 as a **Context Intelligence layer** above individual classifiers, providing contextual evidence to multiple NEX subsystems (Capability A, universal-intent, reflex-brain, brain-language-intelligence, etc.).

However — per the founder governance rule ("Identity first → evidence → capability → maturity"):

**NEX-02 remains PROPOSED. Not OFFICIAL.**

The evidence base has grown (from "fixes one classifier" to "candidate cross-subsystem layer"), but the implementation has not yet demonstrated cross-subsystem consumption. NEX-02's `intelligence_status` remains UNKNOWN.

**Rule**: No promotion of NEX-02 to OFFICIAL until:
1. The canonical language layer is defined by this doctrine's implementation phase (future work).
2. NEX-02 is demonstrated as the shared context provider for at least two independent subsystems.
3. Founder-approval is given via `agent-designation.ts` state transition.

---

## §6 · Transition principles

Founder rules for how NEX moves from current fragmented state toward the target architecture:

1. **No rewrites.** Do not delete or replace any of the nine subsystems in this phase.
2. **No deletion by decree.** DEAD END classification does not authorise removal. A separate founder decision must retire any component.
3. **Preserve component proofs.** Every existing test suite stays green. Alpha.10's 2253 passing tests remain valid evidence.
4. **Wire before merge.** If two subsystems can share a canonical source (normaliser, tokenizer), wire the consumer to the canonical source first; retire the duplicate later.
5. **Founder approval per subsystem move.** No mass migration. Each subsystem's status change requires a proposal + evidence + founder decision.
6. **The Two-Proof Rule applies retroactively.** Every alpha claiming a language improvement must, from now on, produce both proofs before being reported as shipped.

---

## §7 · Doctrine alignment

| Existing doctrine | Relationship to this doctrine |
|---|---|
| Anti-Bullshit + Architectural Quality | This doctrine cites structural evidence rather than making claims. All findings are FACT/INFERENCE-labelled per the source doctrine. |
| NEX1 No-LLM Hard Rule | The canonical language layer (§3) must remain deterministic within NEX1's scope. Wider NEX subsystems that legitimately use LLMs (Nex Nex, Brain composers) may consume the canonical layer's output but must not replace it with LLM tokenisation. |
| Three-Tier Acceptance | This doctrine states a target architecture (CALIBRATION-level claim). The implementation phase would produce VALIDATION receipts. Full PROOF requires shipped consolidation + no user-visible regressions. |
| Historical Wave Receipt Immutability | Alpha.6-Alpha.10 receipts stay intact and unchanged. This doctrine does not rewrite their verdicts. |
| NI Doctrine · Phase 2 | The canonical layer must expose an `intelligence_status` per NI Doctrine. Its capabilities become part of the composite NEX1 profile. |
| Safety Doctrine v1.0 · §4 protected layers | The canonical language layer, once defined, joins INTELLIGENCE_CORE as a protected layer. Modifications require re-certification. |
| Designation Governance | NEX-02 stays PROPOSED. This doctrine does not promote it. |

---

## §8 · What this doctrine does NOT do

Explicit non-goals to prevent scope creep:

- Does **not** decide which subsystem becomes the canonical language layer. That is a separate architectural proposal + founder decision.
- Does **not** authorise deletion of any subsystem.
- Does **not** authorise wiring or refactoring of any subsystem.
- Does **not** promote NEX-02.
- Does **not** retire Alpha.6-Alpha.10 shipments. They remain valid Component Proofs.
- Does **not** substitute for the missing System Connectivity Proofs — those must be produced separately for each capability that claims to be shipped.
- Does **not** describe an implementation timeline.

---

## §9 · Author attribution

- **Directive author**: Founder · Philip O'Farrell, 2026-09-16
- **Technical drafter**: master_ai_engineer (Claude, Anthropic Claude Code)
- **Evidence source**: `nex-language-current-state-inventory-2026-09-16.md` (this session)
- **Trigger**: Founder question "Why does NEX have nine different ways of understanding language in the first place?" following Language Architecture Connectivity Audit findings

---

## §10 · Immutability

This document is **v1.0** and append-only.

Amendments require:
1. A new founder directive citing what specifically changes and why.
2. A new date-stamped version (e.g. `nex-language-architecture-doctrine-v1.1.md`) — never editing v1.0 in place.
3. Passing all existing invariant tests.

Per Historical Wave Receipt Immutability: if the target architecture in §3 later proves wrong, we produce a new version; we do not rewrite this one.

---

**SEALED · 2026-09-16 · v1.0**
