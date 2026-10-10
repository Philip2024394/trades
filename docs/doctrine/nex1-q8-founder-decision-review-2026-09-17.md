# NEX1 · Q8 Root-Cause Selection · Founder Decision Review

**Date:** 2026-09-17
**Author role:** Claude · **surfacing decisions only** · no recommendations · no rankings · no winners
**Authorization:** Founder Q8 Decision Review prompt (decision analysis only · **NO implementation**)
**External model:** NONE (this is a document based on repository evidence)
**Production code changes:** 0
**Q8 policy authored:** 0
**Q8 mechanism authored:** 0
**nex-debugger modified:** 0
**Track A:** FROZEN
**Commits:** 0 · **Pushes:** 0

---

## Instruction to founder

For every decision below · one of the following responses is required:

- **A / B / C / D / E** — select one of the presented options
- **Other:** *<founder-authored text>* — supply a founder-defined option
- **DEFER** — leave the decision unresolved · Q8 stays NOT_IMPLEMENTED for that axis
- **REJECT ALL** — none of the options apply · restate the question

**Silence is not approval.** No decision is applied until the founder writes an explicit response.

---

## Frame · three categories (do not confuse)

| Category | Meaning |
|---|---|
| **EXISTING VERIFIED FACT** | State the code / doctrine already has · established by audit |
| **CLAUDE-SURFACED OPTION** | An option Claude presents to the founder · **not a recommendation** |
| **FOUNDER DECISION REQUIRED** | Explicit founder-only decision · Claude does not select |

---

## Master status (before any decision · established by audit)

```
Q7 Ranking Policy (V1)          FOUNDER_APPROVED (2026-09-17)
Q7 Ranking Mechanism (Fix 15)   RUNTIME_VERIFIED
Q8 Policy                       NOT_FOUND  (V1 §2.23 explicitly EXCLUDES)
Q8 Mechanism (NEX1 pipeline)    NOT_IMPLEMENTED
nex-debugger selection engine   COMPONENT_COMPLETE in own domain
                                founder-authorised 2026-09-12 for OWN constitution (C-3/C-4/C-5)
                                UNCONNECTED to NEX1 pipeline
                                NOT founder-approved as NEX1 Q8
Track A                         FROZEN
```

---

## Preserved distinctions (do not blur)

- **RANK ≠ SELECTION** · Fix 15 answers `rank_position` · Q8 would answer selection
- **RANK 1 ≠ PROVEN ROOT CAUSE** (V1 §2.22)
- **RANK 1 ≠ Q8 SELECTION** (V1 §2.22)
- **DIFFERENCE ≠ PREFERENCE ≠ RANK ≠ SELECTION** (Fix 14 §6)
- **Q7 policy rules ≠ Q8 policy rules** (each layer separately founder-authorized)
- **nex-debugger's own constitution ≠ NEX1 Q8 policy** (different domains · different authorization scopes)

---

# THE 19 DECISIONS

Each decision uses the template:

```
DECISION N — <QUESTION>
CURRENT FACTS: ...
WHAT IS ALREADY KNOWN: ...
OPTIONS: A/B/C/...
ARCHITECTURAL CONSEQUENCE (per option)
WHAT REMAINS UNDECIDED
FOUNDER DECISION: [ ]
NOTES:
```

---

## DECISION 1 — Should Q8 be built for the NEX1 native investigation pipeline?

**CURRENT FACTS:**
- Q7 ranking is RUNTIME_VERIFIED (Fix 15)
- Q8 does not exist in NEX1 pipeline
- V1 §2.23 explicitly EXCLUDES Q8 · founder can extend scope by authorization

**WHAT IS ALREADY KNOWN:**
- Every Q8-relevant input is present in the packet (ranked candidates · four evidence categories · comparisons · policy_id + version · provenance · relationship IDs)
- No consumer of `candidate_rankings` beyond its own producer
- No `selectRootCause` / equivalent function anywhere in `src/lib/nex-agent`

**OPTIONS:**
- **A** — Build Q8 as a native NEX1 capability (new file · new ACTION 15 · new packet field)
- **B** — Do NOT build Q8 at this stage · leave `candidate_rankings` as terminal output
- **C** — Founder-defined option: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → NEX1 pipeline extends to Q8 · new founder policy required first (Decision 4-19 must be resolved before mechanism) · Fix 15 pattern of policy-first / mechanism-second / proof-third repeats
- B → Q7 remains terminus · users of packet must interpret rank themselves · no autonomous NEX1 selection
- C → depends on founder text

**WHAT REMAINS UNDECIDED:** Everything downstream. This is the gate decision.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 2 — If Q8 is built · what is its relationship to `nex-debugger`?

**CURRENT FACTS:**
- `src/lib/nex-debugger/types.ts:1-33` declares "authored_by = master_ai_engineer · founder-authorised 2026-09-12"
- Own constitution locked as C-3, C-4, C-5 · `authority: "descriptive_read_only"` · `authorisation: false, execution: false`
- Six ordinal outcomes: REPRODUCED / ROOT_CAUSE_SUPPORTED / ROOT_CAUSE_PLAUSIBLE / ROOT_CAUSE_UNRESOLVED / NOT_REPRODUCIBLE / INSUFFICIENT_EVIDENCE
- Selection rule: SBFL top ∩ AST-diff churn → SUPPORTED · else SBFL top alone → PLAUSIBLE · else UNRESOLVED
- Confidence classes: strong / plausible / weak / insufficient (ordinal · not numeric)
- API: `POST /api/nex/debugger/diagnose` · `GET /api/nex/debugger/self-test`
- **Grep verified NOT CONNECTED to NEX1:** `nex-debugger` does not import `nex1|native-investigation|candidate_rankings|hypothesis_evaluations`; NEX1 does not import `nex-debugger`.

**WHAT IS ALREADY KNOWN:**
- `nex-debugger` is founder-authorised **for its OWN constitution** on 2026-09-12
- That authorization is **NOT** a NEX1 Q8 authorization
- Both statements are simultaneously true

**OPTIONS:**
- **A** — Keep `nex-debugger` fully independent. Q8 (if built · Decision 1=A) is a distinct NEX1-native capability. No bridge.
- **B** — Connect `nex-debugger` into the NEX1 pipeline. NEX1 becomes an input source (evidence · candidates · rankings) to `performDiagnosis()`. `authoritative_top_candidate` becomes NEX1's Q8 output.
- **C** — Reuse selected `nex-debugger` components/rules (e.g. the four outcome classes, the ordinal confidence taxonomy) while creating a NEX1-native Q8 layer. Bridge is partial and rule-level, not code-level.
- **D** — Replace/absorb `nex-debugger` selection logic into NEX1. `nex-debugger` becomes deprecated for its own domain OR retained only for SBFL/AST-diff subroutines.
- **E** — Founder-defined architecture: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → two parallel selection engines · zero risk of unintended coupling · duplication if both eventually cover overlapping domains
- B → single selection engine (nex-debugger) · founder must decide whether its constitution C-3/C-4/C-5 is adopted as NEX1 Q8 policy OR extended · governance implication: nex-debugger constitution predates V1 policy · alignment audit needed
- C → new NEX1 Q8 code · borrows nomenclature/rules from `nex-debugger` under explicit founder ratification · no code-level dependency
- D → migration event · `nex-debugger`'s existing consumers (`/api/nex/debugger/*`) must be preserved or deprecated · testing impact non-trivial
- E → depends on founder text

**WHAT REMAINS UNDECIDED:** Adopt / bridge / replace / independent · scope of nex-debugger's role going forward · authority of its existing constitution vs a future NEX1 Q8 policy.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 3 — What does "root cause selected" actually mean in NEX1?

**CURRENT FACTS:**
- V1 §2.23 excludes "root-cause selection", "root-cause acceptance", "root-cause confirmation", "autonomous causal declaration"
- Fix 15 emits: RANKED / TIED / UNRESOLVED_ORDER (ranking states · not selection states)
- `nex-debugger` emits: REPRODUCED / ROOT_CAUSE_SUPPORTED / ROOT_CAUSE_PLAUSIBLE / ROOT_CAUSE_UNRESOLVED / NOT_REPRODUCIBLE / INSUFFICIENT_EVIDENCE (its own outcomes)

**WHAT IS ALREADY KNOWN:**
- No NEX1 Q8 selection state has been founder-defined
- States enumerated in this prompt (§6) are EXAMPLES to consider · not approved policy

**OPTIONS (example states surfaced for founder decision · not exhaustive · not approved):**
- SELECTED
- SUPPORTED
- PLAUSIBLE
- UNRESOLVED
- INSUFFICIENT_EVIDENCE
- NO_SELECTION
- TIE
- ROOT_CAUSE_SELECTED
- NO_ROOT_CAUSE_ESTABLISHED
- Founder-authored state set: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- Any state set must be:
  - **Non-overlapping** (a candidate is in exactly one state)
  - **Total** (covers every possible policy outcome including no-selection)
  - **Interpretable** by the packet consumer without ambiguity

**WHAT REMAINS UNDECIDED:** The complete authoritative state vocabulary for NEX1 Q8.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 4 — What evidence threshold would Q8 require?

**CURRENT FACTS:**
- Fix 13 emits four states per candidate: STRUCTURALLY_SUPPORTING · STRUCTURALLY_CONTRADICTING · INSUFFICIENT · UNRESOLVED
- Fix 15 uses these under V1 policy · **no threshold** (Δ ≥ 1 count difference · no weights · no confidence · no provenance)

**WHAT IS ALREADY KNOWN:**
- V1 §2.13 forbids numerical weights **for ranking**
- V1's forbidding is scoped to ranking · Q8 policy is separately authorized

**POLICY DIMENSIONS TO SURFACE (examples · founder must decide which apply):**
- minimum supporting evidence count
- contradiction handling (blocking? tolerated at some threshold?)
- unresolved handling
- insufficient handling
- candidate separation (minimum Δ between rank 1 and rank 2?)
- rank position (does only rank 1 qualify for selection?)
- minimum evidence difference
- evidence diversity (multiple relationship_ids? multiple source files?)
- independent evidence (multiple provenance origins?)
- correlated evidence (does dedup rule from Q7 §2.19 apply?)
- confidence
- provenance
- reproducibility
- behavioural evidence
- source-level evidence
- cross-file evidence

**OPTIONS:** presented as dimensions · founder decides which apply and how.

**ARCHITECTURAL CONSEQUENCE:** each dimension adopted becomes an authoritative field on the Q8 selection record. Each dimension rejected must be explicitly listed as **not used**.

**WHAT REMAINS UNDECIDED:** All threshold dimensions · every quantitative or qualitative rule.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 5 — Can Q8 select a root cause when multiple candidates remain tied?

**CURRENT FACTS:**
- Fix 15 emits TIED · scope_state ALL_TIED when all candidates share the same tuple
- V1 §1 design bias: prefer TIE / UNRESOLVED_ORDER over manufactured ranking
- **Selection is a separate layer** · V1 design bias does NOT auto-apply to Q8

**WHAT IS ALREADY KNOWN:**
- Test S corpus (5 candidates × 2 SUPP each) → ALL_TIED at rank 1
- Q7 declines to force a ranking · Q8 has no rule yet on this

**OPTIONS:**
- **A** — TIE → NO_SELECTION (Q8 declines · honest-uncertainty in selection mirrors V1 §1)
- **B** — TIE → ROOT_CAUSE_UNRESOLVED (mirrors `nex-debugger` vocabulary)
- **C** — TIE → REQUIRE_MORE_EVIDENCE (Q8 requests re-investigation with additional inputs · see Decision 18)
- **D** — Founder-defined state: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → no tie-break invented · Q8 permanently declines on tied evidence
- B → Q8 has an UNRESOLVED state distinct from NO_SELECTION · adopts nex-debugger's ordinal vocabulary or defines its own
- C → Q8 becomes a controller that loops back into Q1-Q7 · substantial architecture change · see Decision 18
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** Selection behavior when Q7 produces TIED / ALL_TIED.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 6 — What should Q8 do when the highest-ranked candidate has contradicting / unresolved / insufficient evidence?

**CURRENT FACTS:**
- V1 R-1, R-2, R-3 handle contradicting/unresolved/insufficient at RANKING level (block a candidate from outranking another)
- V1 says nothing about what selection should do given the highest-ranked candidate carries those flags
- Under V1, rank 1 can still have some contradicting evidence — it just can't have MORE than a candidate at rank 2 who has zero

**WHAT IS ALREADY KNOWN:**
- Q7 ranking rules ≠ Q8 selection rules · Q7 solves ordering · Q8 solves sufficiency
- No policy currently defines "sufficient for selection"

**OPTIONS:**
- **A** — Any contradicting/unresolved/insufficient evidence on rank 1 → BLOCK selection (strict). Emit NO_SELECTION or equivalent state.
- **B** — Threshold-based: allow selection if the counts are below founder-set thresholds (Decision 4)
- **C** — Distinguish selection tiers: SUPPORTED (zero blocking) · PLAUSIBLE (some blocking) · UNRESOLVED (any blocking on rank 1)
- **D** — Contradicting blocks · unresolved / insufficient allowed at rank 1 under separate rules
- **E** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → strict Q8 · rare selections · high honesty bias
- B → threshold policy required · Decision 4 becomes load-bearing
- C → nex-debugger-shaped tier system · founder must decide whether to adopt its C-3/C-4/C-5 constitution or write fresh
- D → asymmetric handling · complexity increases
- E → depends on founder text

**WHAT REMAINS UNDECIDED:** The rank-1-with-blocking-evidence question. This is distinct from tie behaviour (Decision 5).

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 7 — Should Q8 require evidence beyond structural evidence?

**CURRENT FACTS:**
- NEX1 pipeline currently produces STRUCTURAL evidence: source_inspections (OBSERVED) · observed_chains · chain_narratives · inferred_relationships (INFERRED) · composed_arguments (INFERRED) · hypothesis_evaluations (INFERRED)
- `nex-debugger` uses RUNTIME evidence: reproduction · coverage · SBFL · AST-diff churn

**WHAT IS ALREADY KNOWN:**
- Structural and runtime are complementary evidence classes
- Neither is currently mandatory for Q8 (Q8 does not exist)

**POSSIBLE ADDITIONAL EVIDENCE CLASSES (§10 · surfaced · not recommended):**
- structural
- runtime
- behavioural
- reproduction
- verification
- historical
- dependency
- configuration
- environmental

**OPTIONS:**
- **A** — Structural evidence alone is sufficient
- **B** — Structural required · runtime/reproduction preferred but not required
- **C** — Runtime/reproduction REQUIRED before Q8 can select (would necessitate bridge to `nex-debugger` or new runtime pipeline)
- **D** — Founder-authored evidence class matrix: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → Q8 buildable from current pipeline · no new evidence classes required
- B → Q8 has a tiered outcome (structural-only → PLAUSIBLE · structural + runtime → SUPPORTED)
- C → new evidence pipeline required · Fix 15 downstream now blocks until runtime data arrives · large architecture change
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** Whether Q8's evidence requirements extend beyond what the pipeline currently produces.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 8 — Should Q8 be allowed to say "no root cause established"?

**CURRENT FACTS:**
- V1 §1 design bias supports honest-uncertainty
- `nex-debugger` has explicit ROOT_CAUSE_UNRESOLVED and NOT_REPRODUCIBLE as "first-class successful outcomes"

**WHAT IS ALREADY KNOWN:**
- No-selection states are architecturally sound · they're not error states

**POSSIBLE STATES (surfaced):**
- ROOT_CAUSE_SELECTED
- NO_ROOT_CAUSE_ESTABLISHED
- INSUFFICIENT_EVIDENCE
- UNRESOLVED
- TIE
- REQUIRES_MORE_INVESTIGATION

**OPTIONS:**
- **A** — Yes · "no root cause established" is a first-class Q8 outcome
- **B** — Yes · but as multiple distinguishable states (NO_ROOT_CAUSE · INSUFFICIENT · UNRESOLVED · TIE · REQUIRES_MORE)
- **C** — No · Q8 always selects one candidate or defers to another layer
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → single "no" outcome · simpler policy · less nuance downstream
- B → richer state set · Decision 3 shapes this
- C → Q8 becomes forced-choice · risk of manufactured selection · violates V1 §1 bias if inherited
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** The presence and granularity of "no selection" states.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 9 — What evidence would move a candidate from "ranked" to "selected"?

**CURRENT FACTS:**
- Fix 15 emits `rank_position` (integer or null)
- V1 §2.22 preserves: RANK 1 ≠ PROVEN ROOT CAUSE · RANK 1 ≠ Q8 SELECTION
- No bridge currently exists

**WHAT IS ALREADY KNOWN:**
- Bridging rank → selection silently would violate V1 §2.22
- The bridge must be explicit and founder-authorized

**OPTIONS (bridge criteria surfaced · not selected):**
- **A** — Rank 1 alone suffices (Q7 ordering IS the selection · Q8 collapses into Q7 · essentially no Q8)
- **B** — Rank 1 + Δ ≥ N between rank 1 and rank 2 (candidate must be sufficiently ahead)
- **C** — Rank 1 + zero blocking evidence (Decision 6 = strict)
- **D** — Rank 1 + evidence threshold satisfied (Decision 4 fields)
- **E** — Rank 1 + independent evidence dimension satisfied (Decision 7 field)
- **F** — Rank 1 + reproduction (Decision 13)
- **G** — Combination · founder specifies: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → violates V1 §2.22 (rank IS selection) · would require V1 amendment · not recommended by founder in prior policy work
- B-F → each defines an explicit selection contract distinct from ranking
- G → depends on founder text

**WHAT REMAINS UNDECIDED:** The exact bridge criteria.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 10 — Should Q8 be purely deterministic (like Fix 15) or may it use another reasoning component?

**CURRENT FACTS:**
- Fix 15 is DETERMINISTIC · zero LLM · zero randomness · zero external model
- V1 policy authored deterministically
- `nex-debugger` is DETERMINISTIC · `external_llm_used: false`
- Every current Fix (1-15) is deterministic

**OPTIONS:**
- **A** — NATIVE DETERMINISTIC only (matches all prior Fixes)
- **B** — EXTERNAL MODEL ASSISTED (Q8 uses Claude/GPT/etc as a reasoning component) — **not NEX1-native**
- **C** — HYBRID (deterministic core + external-model advisory input · advisory not authoritative)
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → consistent with all prior work · Fix 15-shaped verifier matrix reusable · determinism testable via 5-run rerun
- B → introduces NEW class of dependency · NI Doctrine implications (see MEMORY.md `project_nex_ni_doctrine_2026_09_16.md`) · classification would be `AI_DELEGATED` not `NATIVE`
- C → boundary control required: what's authoritative vs advisory
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** Whether Q8 breaks the deterministic pattern.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 11 — Should confidence influence Q8 selection?

**CURRENT FACTS:**
- V1 §2.15: confidence NOT used for Q7 ranking · `confidence ≠ truth` · `confidence ≠ automatic rank`
- Q8 is a separate policy layer · V1 §2.15 does NOT automatically apply

**WHAT IS ALREADY KNOWN:**
- Fix 13 evidence records carry `confidence` (bounded ≤ 0.6)
- Fix 12 candidates carry `confidence` (bounded ≤ 0.7 · never HIGH)
- `nex-debugger` uses ordinal `confidence_class` (strong/plausible/weak/insufficient · never numeric)

**OPTIONS:**
- **A** — Q8 does NOT use confidence (mirrors V1 §2.15)
- **B** — Q8 uses ORDINAL confidence (strong/plausible/weak/insufficient) matching nex-debugger vocabulary
- **C** — Q8 uses NUMERICAL confidence with founder-set threshold
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → Q8 like Q7 · confidence is informational only · disciplined
- B → Q8 gains ordinal filter · aligns with nex-debugger (informs Decision 2)
- C → introduces numerical thresholds (Decision 4 field) · precedent-breaking
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** The role of confidence in selection.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 12 — Should provenance influence Q8 selection?

**CURRENT FACTS:**
- V1 §2.20: provenance INFORMATIONAL ONLY for Q7 · not used as ranking factor
- Q8 is a separate policy layer · V1 §2.20 does NOT automatically apply

**WHAT IS ALREADY KNOWN:**
- Every Fix 12-15 record carries provenance (source_file · line ranges)
- `nex-debugger` uses distinct provenance (SBFL coverage · AST-diff churn · reproduction fixture)

**OPTIONS:**
- **A** — Q8 does NOT use provenance (mirrors V1 §2.20)
- **B** — Q8 uses PROVENANCE DIVERSITY (evidence from ≥N distinct source_files) as a factor
- **C** — Q8 uses PROVENANCE DEPTH (evidence tracing to ≥N chain levels) as a factor
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → provenance stays informational · Q8 policy uncoupled
- B → introduces diversity threshold (Decision 4 field)
- C → introduces depth threshold (Decision 4 field)
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** Provenance's role in selection.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 13 — Should reproducibility be required before selecting a root cause?

**CURRENT FACTS:**
- NEX1 pipeline is READ-ONLY · does NOT reproduce
- `nex-debugger` DOES reproduce (via `reproduction_fixture_id` + `runReproduction`)
- Fix 15 output does NOT include reproduction data (Q8 would have to fetch it separately)

**WHAT IS ALREADY KNOWN:**
- Reproducibility is a strong evidential signal (industry-standard root-cause analysis relies on it)
- NEX1 does not currently produce it · adding it changes the read-only invariant OR requires bridge to nex-debugger

**OPTIONS:**
- **A** — Not required (Q8 selects from structural evidence alone)
- **B** — Required · Q8 must consume reproduction data (necessitates bridge · Decision 2 = B/C/D)
- **C** — Optional · Q8 selection tier depends on whether reproduction data is present (SUPPORTED vs PLAUSIBLE)
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → Q8 buildable without new evidence pipeline · Decision 7 = A alignment
- B → Q8 blocks until reproduction · large architecture change · nex-debugger becomes upstream dependency
- C → tiered Q8 outcome · reproduction is a promoter not a gate
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** Reproducibility's status in Q8.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 14 — Should Q8 be allowed to select a root cause from structural evidence alone?

**CURRENT FACTS:**
- NEX1 pipeline is primarily structural (Fix 7-15 chain)
- Structural evidence supports HYPOTHESIS and INFERRED · not PROVEN

**WHAT IS ALREADY KNOWN:**
- Fix 12/13/14/15 records are all `evidence_kind: "INFERRED"` (never PROVEN)
- Selection from INFERRED evidence would produce a Q8 selection with `evidence_kind: "INFERRED"` at best (unless bridged to reproduction / runtime data)

**OPTIONS:**
- **A** — Yes · Q8 can select from structural alone · but result carries INFERRED evidence_kind (never PROVEN)
- **B** — No · structural alone insufficient · Q8 must reach beyond into runtime/reproduction (Decision 13 = B)
- **C** — Yes · but only at a designated tier (e.g. PLAUSIBLE) · higher tiers (SUPPORTED) require non-structural evidence
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → Q8 aligns with current pipeline · never PROVEN · consistent with V1 §2.22 spirit
- B → Q8 requires additional evidence layer · likely Decision 2 = B/C/D
- C → tiered outcome · matches nex-debugger's SUPPORTED/PLAUSIBLE vocabulary
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** The evidential ceiling of structural-only selection.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 15 — What should happen when evidence is insufficient to distinguish the top candidates?

**CURRENT FACTS:**
- Fix 15 emits UNRESOLVED_ORDER when all supp=0 + at least one blocking + single tuple bucket
- Fix 15 emits ALL_TIED when all tuples identical with non-zero supporting
- `nex-debugger` has INSUFFICIENT_EVIDENCE as a first-class outcome

**WHAT IS ALREADY KNOWN:**
- Q7 already distinguishes these two Q7-level states
- Q8's response to each is undefined

**OPTIONS (per state · founder may set differently for each):**
- **A** — TIE state
- **B** — UNRESOLVED state
- **C** — INSUFFICIENT_EVIDENCE state
- **D** — REQUIRES_MORE_INVESTIGATION state (triggers Decision 18)
- **E** — NO_SELECTION state
- **F** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- Depends on state chosen · Decision 3 shapes the vocabulary · Decision 8 shapes whether "no selection" is a first-class outcome

**WHAT REMAINS UNDECIDED:** Which Q7 undifferentiated state maps to which Q8 outcome.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 16 — Should Q8 produce only a structured decision · or also a structured explanation?

**CURRENT FACTS:**
- Fix 15 output includes: `rank_position`, `ranking_state`, `differentiating_rule`, counts, dedup'd relationship_ids, policy_id + version, rule_trace
- Fix 14 forbids natural-language causal narrative
- Fix 13 forbids causal vocabulary (§12 defence-in-depth)

**WHAT IS ALREADY KNOWN:**
- Prior Fixes emit STRUCTURED evidence · never prose reasoning
- Q8 could break this pattern OR keep it

**OPTIONS:**
- **A** — Decision only (single field: state + candidate_id)
- **B** — Decision + evidence references (state + candidate_id + supporting evidence_ids + blocking evidence_ids)
- **C** — Decision + evidence references + structured reasoning (state + candidate_id + evidence_ids + rule_fired + selection_trace) — structured, still no natural-language prose
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → minimal · downstream consumer must re-fetch evidence from packet
- B → self-contained decision · consumer can audit without extra lookups
- C → richest · matches Fix 15's `rule_trace` pattern · still deterministic and non-prose
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** The output shape.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 17 — What is Q8 explicitly NOT allowed to do?

**CURRENT FACTS:**
- Fix 15 does not modify code · does not execute · has no authority · does not commit
- V1 §2.23 lists Q8 exclusions in the context of Q7 policy · not Q8's own boundaries

**WHAT IS ALREADY KNOWN:**
- Fix 12-15 all declare zero writes · zero broker calls · zero execution
- Track A is FROZEN independent of Q8

**PROPOSED BOUNDARIES (surfaced · founder must ratify):**
- No code modification
- No code execution
- No authorization
- No autonomous repair
- No deployment
- No hidden policy
- No invented evidence
- No unsupported causal claim
- No PROVEN evidence_kind (INFERRED ceiling)
- No commit
- No push
- No Track A modification
- No cross-repo action

**OPTIONS:**
- **A** — Ratify entire list above as authoritative Q8 boundary
- **B** — Ratify subset · founder redlines: *_______________________*
- **C** — Ratify list + additional boundaries: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- Each ratified boundary becomes a runtime check in the future Q8 mechanism (mirror of Fix 15's forbidden field enforcement)

**WHAT REMAINS UNDECIDED:** Which boundaries are authoritative for Q8.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 18 — Should Q8 be allowed to request additional investigation when evidence is insufficient?

**CURRENT FACTS:**
- Current NEX1 pipeline is single-pass: `runInvestigation()` runs Q1→Q7 once and returns packet
- No feedback loop from downstream capabilities back into upstream investigation

**WHAT IS ALREADY KNOWN:**
- Fix 15's UNRESOLVED_ORDER and TIED outcomes signal insufficiency
- No consumer currently reads these signals

**OPTIONS:**
- **A** — No · Q8 emits INSUFFICIENT and stops · orchestrator (external) decides whether to re-run
- **B** — Yes · Q8 can request specific additional evidence classes (per Decision 7) · orchestrator satisfies request · Q8 re-evaluates
- **C** — Yes · Q8 initiates a bounded Q1-Q7 sub-investigation with augmented parameters
- **D** — Founder-defined: *_______________________*

**ARCHITECTURAL CONSEQUENCE:**
- A → simpler · Q8 is a single-pass evaluator · matches Fix 15 pattern
- B → Q8 becomes an orchestrator interface · new contract with orchestration layer required
- C → Q8 becomes a loop controller · substantial architecture change · risk of unbounded recursion · bounded budget required
- D → depends on founder text

**WHAT REMAINS UNDECIDED:** Q8's control-flow authority.

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

## DECISION 19 — What must be true before Q8 can declare a root cause?

**CURRENT FACTS:**
- No such contract currently exists
- V1 does not define selection preconditions
- `nex-debugger` has its own preconditions (reproduction succeeded · SBFL top candidate present · AST diff churn intersection · etc)

**WHAT IS ALREADY KNOWN:**
- Founder-authored preconditions become the load-bearing contract of Q8

**FOUNDER-AUTHORING TEMPLATE (blank · Claude must not fill):**

```
Required conditions:
____________________________________________________

Required evidence:
____________________________________________________

Blocking conditions:
____________________________________________________

Allowed uncertainty:
____________________________________________________

Required verification:
____________________________________________________
```

**FOUNDER DECISION:** [ ]

**NOTES:** _______________________

---

# Cross-Decision Compact Summary

| # | Question | Options | Founder Decision |
|---|---|---|---|
| 1 | Build Q8 for NEX1? | A build · B don't · C other | ⬜ |
| 2 | Relationship with nex-debugger? | A independent · B connect · C partial reuse · D absorb · E other | ⬜ |
| 3 | What does "selected" mean? | example state set (SUPPORTED / PLAUSIBLE / UNRESOLVED / INSUFFICIENT / NO_SELECTION / TIE / other) | ⬜ |
| 4 | Evidence thresholds? | dimensions to include / exclude | ⬜ |
| 5 | Tie behaviour? | A NO_SELECTION · B UNRESOLVED · C REQUIRE_MORE · D other | ⬜ |
| 6 | Rank-1-with-blocking? | A strict block · B threshold · C tier · D asymmetric · E other | ⬜ |
| 7 | Non-structural evidence? | A structural only · B preferred · C required · D other | ⬜ |
| 8 | Allow "no root cause"? | A single · B multiple states · C never · D other | ⬜ |
| 9 | Ranked → selected bridge? | A rank 1 alone · B Δ · C zero-blocking · D thresholds · E diversity · F reproduction · G combination | ⬜ |
| 10 | Deterministic or model-assisted? | A native · B external · C hybrid · D other | ⬜ |
| 11 | Confidence in Q8? | A no · B ordinal · C numerical · D other | ⬜ |
| 12 | Provenance in Q8? | A no · B diversity · C depth · D other | ⬜ |
| 13 | Reproducibility required? | A no · B required · C optional-tier · D other | ⬜ |
| 14 | Structural-only sufficient? | A yes · B no · C tiered · D other | ⬜ |
| 15 | Insufficient distinction? | A TIE · B UNRESOLVED · C INSUFFICIENT · D REQUIRE_MORE · E NO_SELECTION · F other | ⬜ |
| 16 | Output shape? | A decision only · B + evidence · C + structured reasoning · D other | ⬜ |
| 17 | Explicit boundaries? | A ratify list · B redline · C extend | ⬜ |
| 18 | Request more investigation? | A no · B request · C sub-loop · D other | ⬜ |
| 19 | Preconditions? | founder-authored template · blank | ⬜ |

---

# Final Status

```
POLICY STATUS:              Q8 POLICY NOT YET AUTHORED
FOUNDER APPROVAL:           NOT YET GIVEN
Q8 MECHANISM:               NOT IMPLEMENTED
NEX-DEBUGGER TREATMENT:     COMPONENT_COMPLETE (own domain) · UNCONNECTED to NEX1 · NOT founder-approved as NEX1 Q8
PRODUCTION CODE CHANGES:    0
TRACK A:                    FROZEN
COMMITS:                    0
PUSHES:                     0
EXTERNAL MODEL:             NONE
```

---

# Founder Instruction for Response

Valid next responses:

1. **APPROVE ALL DEFAULTS** — not applicable · this review has no defaults · every decision is genuinely blank
2. **Per-decision response** — supply one of A/B/C/D/E or "Other: <text>" or "DEFER" for each of decisions 1-19
3. **REJECT REVIEW** — this decision framework is wrong · restate what to surface differently
4. **PAUSE** — leave Q8 unresolved indefinitely · Q7 remains the pipeline terminus

**Once founder decisions are supplied · they must be captured in a Founder-Approved Q8 Policy document (like V1 was) before any mechanism is authorized.**

**No mechanism authorization is implicit in this review.** A separate future authorization prompt (like Fix 15's) would be required to build the mechanism after the policy is founder-approved.

---

# Discipline Held (§25-§28)

- ✅ Production code changes: 0
- ✅ Q8 policy created: 0
- ✅ Q8 mechanism created: 0
- ✅ nex-debugger modified: 0
- ✅ NEX1 pipeline modified: 0
- ✅ Track A untouched (§26)
- ✅ No external model used (§27)
- ✅ No recommendation made · no option ranked · no winner declared (§23)
- ✅ No selection · no root cause declared (§28)
- ✅ No connection between nex-debugger and NEX1 (§28)
- ✅ No commits · no pushes (§28)
- ✅ HARD STOP after producing this document (§28)

---

*End of NEX1 Q8 Founder Decision Review · 2026-09-17*
