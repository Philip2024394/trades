# NEX1 · Multi-Verb Classifier Diagnostic Audit

**Date:** 2026-09-16
**Status:** READ-ONLY AUDIT · zero code changes · zero designations moved · no fix authorized · Track A untouched
**Author:** master_ai_engineer — NOT NEX1 runtime
**Governing directive:** Founder direction · *"Do NOT authorize one of the three Test-F fixes yet. Inspect the existing multi-verb classifier architecture before changing semantic priority."*
**Undercount Protection Rule applied.**

---

## §1 · Purpose

Test F failed because the classifier's first-hit-earliest tiebreak selected BUILD over INVESTIGATE when both verbs tied at count 1. Before authorizing any fix, this audit answers the founder's six diagnostic questions using **the existing code** as evidence.

Every claim is cited to file:line.

---

## §2 · The six founder questions · answered from code

### Q1 · How is `verb_family` supposed to represent multiple intents?

**Answer:** `verb_family` is a single winner. Multi-intent information exists elsewhere in the same result object.

Evidence (`types.ts:141-176 · Nex1IntentClassified`):
- Line 145: `verb_family: Nex1VerbFamily` — single family
- Line 147: `verb_family_confidence` — "verb-hit-count for primary / total verb hits" (i.e. `topCount / totalHits`)
- Line 149: `verb_hits: readonly Nex1VerbHit[]` — **ALL verb hits, ordered by span position** (not just the winner)
- Line 165: `ambiguities: readonly Nex1AmbiguityFlag[]` — includes `multiple_verb_families_close` per types.ts:84

**Multi-intent representation is intentional and already emitted.** The architecture separates:
- **Primary intent** (`verb_family`) — one winner for downstream single-family consumers
- **All intent evidence** (`verb_hits`) — full detected list
- **Ambiguity signal** (`ambiguities` with `multiple_verb_families_close`) — explicit flag when tied

### Q2 · Does downstream code assume exactly one family?

**Answer:** Only Investigation Mode is a production consumer of `verb_family` outside the classifier. It DOES assume exactly one family — and does not consult the multi-intent evidence.

Evidence:
- Grep across `src/`: `verb_family` references in 8 files
- Non-test consumers: exactly TWO — `classifier.ts` (producer) and `native-investigation-mode.ts` (only consumer)
- All 6 other references are test files
- `native-investigation-mode.ts:241`:
  ```
  if (classified.verb_family !== "INVESTIGATE") {
    return finalise({ ... verdict: "REFUSED_NON_INVESTIGATE_INTENT" ... });
  }
  ```
- Investigation Mode never inspects `verb_hits` and never inspects `ambiguities`

**The classifier's multi-intent output is not being consumed by its primary downstream consumer.** This is the specific asymmetry causing Test F.

### Q3 · Is BUILD winning Test F intentional architecture?

**Answer:** Intentional design · but the intent is "when tied, pick the earliest-mentioned action" — not "BUILD should beat INVESTIGATE."

Evidence (`classifier.ts:686-712`):
```
// Winner = family with highest count. Tiebreak = family whose FIRST hit appears earliest.
...
if (tiedTop) {
  tiedFamilies.sort((a, b) => (firstHitIndex.get(a) ?? 0) - (firstHitIndex.get(b) ?? 0));
  winner = tiedFamilies[0]!;
  trace.push(`tiebreak · tied_families=[${tiedFamilies.join(",")}] · winner_by_first_appearance=${winner}`);
}
```

**No family has semantic priority over any other in this design.** The rule is neutral — first mentioned wins. That happens to disadvantage sentence-final imperatives (like Test F's "Investigate which files omit...") because they always appear after descriptive verbs.

This is a **specification consequence · not a bug**. But whether the specification serves NEX1's investigation goals is the question.

### Q4 · Is there already a secondary intent / ambiguity representation?

**Answer:** YES · fully implemented and emitted.

Evidence:
- `types.ts:84`: `"multiple_verb_families_close"` is a legitimate ambiguity kind
- `classifier.ts:854-858`:
  ```
  if (verbResult.tiedTop) {
    ambiguities.push({
      kind: "multiple_verb_families_close",
      detail: `two or more verb families tied on hit count · resolved by earliest first-appearance`,
    });
  }
  ```
- `classifier.test.ts:149`: existing test verifies the flag is emitted for `"build the module and fix the failing tests inside it"` (BUILD+FIX tied)

**Investigation Mode could consume this flag today.** It does not.

### Q5 · Would changing priority create regressions?

**Answer:** Depends on WHERE the change is made.

**If the CLASSIFIER's tiebreak rule changes (e.g. "INVESTIGATE always wins in a tie"):**
- Affects the ONE existing multi-verb tiebreak test: `classifier.test.ts:141-149` expects `verb_family === "FIX"` for the goal `"build the module and fix the failing tests inside it"`. This test does not involve INVESTIGATE so may not directly regress · but the tiebreak semantics changing centrally would affect any future multi-family goal that happens to include INVESTIGATE.
- Ripple risk: any downstream consumer of `verb_family` (currently only Investigation Mode) gets different routing for tied cases.

**If INVESTIGATION MODE'S consumption changes (opt-in on tied cases when INVESTIGATE is in hits):**
- Affects only `native-investigation-mode.ts` — a single, contained file
- No classifier semantics change
- Test C already covers "present requirement" cases (no false positive); can be re-verified after change
- Investigation Mode is READ-ONLY · worst case is a valid problem gets an investigation packet it didn't strictly need · zero authority impact

**Investigation Mode consumption change is dramatically lower risk** than tiebreak change.

### Q6 · Does the classifier already emit enough for Investigation Mode to decide?

**Answer:** YES — this is the key finding.

The classifier emits per every classification result:
- `verb_family` — winner
- `verb_hits` — all detected verbs with families and spans
- `verb_family_confidence` — 0.5 when 1-1 tied · 1.0 when unambiguous
- `ambiguities.multiple_verb_families_close` — explicit flag for tied cases

Investigation Mode can make a more nuanced decision:
```
Accept if:
  verb_family === "INVESTIGATE"  (unambiguous investigation)
  OR
  (tiedTop AND verb_hits.some(h => h.family === "INVESTIGATE"))
     ← consume the existing ambiguity signal
```

**No new classifier data required. No new architecture. Just consume what's already emitted.**

---

## §3 · Test F trace re-explained via existing multi-intent representation

Test F problem: *"The TypeScript, ESLint and Vitest verification chain has files that construct partial invocations. Investigate which files omit required specialist kinds."*

Classifier output (verified by direct probe):
- `verb_family`: `BUILD` ← chosen by tiebreak
- `verb_family_confidence`: `0.5` ← 1/2 · matches definition
- `verb_hits`: `[BUILD:construct, INVESTIGATE:investigate]` ← both detected
- `ambiguities`: would include `multiple_verb_families_close` (implicitly · since tiedTop is true) — need to verify this was actually observed

Investigation Mode saw only `verb_family !== "INVESTIGATE"` → refused. **It never looked at `verb_hits`.**

The information required to accept Test F was in the classifier output. It was discarded.

---

## §4 · The three fixes reconsidered per §5 evidence

The prior report proposed three fixes for Test F. Re-evaluating via Undercount Protection:

| Fix | Layer changed | Regression surface | Reversibility | Verdict |
|---|---|---|---|---|
| 1 · Investigation bias in tiebreak | Classifier core | All future multi-family goals · existing tiebreak test | Requires classifier + test update | HIGH RISK |
| 2 · Multi-verb classification (packet carries multiple) | Classifier types + all consumers | Would break existing single-family consumers · type changes | Non-trivial rollback | HIGH RISK |
| 3 · Grammatical role detection | Classifier core (new capability) | Substantial new logic + tests | New capability · larger surface | HIGHEST RISK |

**Neither the prior report nor this audit considered a fourth option:**

**Fix 4 · Investigation Mode consumes existing ambiguity signal.** Zero classifier change. ~5 LOC in native-investigation-mode.ts. Fully reversible via single revert.

**Undercount Protection Rule caught this.** The classifier already does the work — Investigation Mode wasn't consuming it.

---

## §5 · The smallest reversible change (if the founder authorizes any fix)

**Proposed (not authorized · founder-only decision):**

In `native-investigation-mode.ts` after line 240, change:

```
if (classified.verb_family !== "INVESTIGATE") {
```

to something equivalent to:

```
const hasInvestigateHit = classified.verb_hits.some(h => h.family === "INVESTIGATE");
const hasMultiVerbAmbiguity = classified.ambiguities.some(
  a => a.kind === "multiple_verb_families_close"
);
const acceptedAsInvestigation =
  classified.verb_family === "INVESTIGATE" ||
  (hasInvestigateHit && hasMultiVerbAmbiguity);

if (!acceptedAsInvestigation) {
  return finalise({ ... verdict: "REFUSED_NON_INVESTIGATE_INTENT" ... });
}
```

**Semantics:**
- Unambiguous INVESTIGATE → proceed (unchanged)
- Non-INVESTIGATE with zero INVESTIGATE hits → refuse (unchanged)
- **Mixed / tied case with INVESTIGATE in hits AND `multiple_verb_families_close` flag → proceed**

**Downstream evidence packet would need to note the tie explicitly** — Investigation Mode should record that classifier reported multi-verb ambiguity and it accepted anyway. This preserves the truth-doctrine principle: never silently discard the ambiguity signal.

**Regression check:** Test C (present requirement · unambiguous INVESTIGATE) unchanged. Tests A, D, E unchanged. Test B (unambiguous INVESTIGATE after prior fix) unchanged. **Only Test F changes** — from refused to accepted-into-investigation.

**If accepted, does absence detection then find the right answer for Test F?** Unknown. Would need to run the test. But if it does, the fix is minimal. If it doesn't, we learn a new precise thing about Investigation Mode reasoning.

**This is the founder's stated criterion:** "If B and F then reach Investigation Mode but fail to diagnose correctly, that failure becomes extremely valuable."

---

## §6 · What this audit does NOT do

- Does NOT implement the proposed Fix 4
- Does NOT modify classifier tiebreak
- Does NOT add new capability
- Does NOT change any test
- Does NOT commit
- Does NOT change any designation
- Does NOT touch Track A (C6 · G15 · C1 · C3 · Truth Engine Gate 3 · founder authority)

Freeze on all authority chains: INTACT.

---

## §7 · Recommendation (evidence-based · founder-only decision)

Per founder direction: audit before authorizing any fix.

**Findings summary:**

1. Multi-verb ambiguity signal ALREADY EXISTS in classifier output (`verb_hits` + `ambiguities.multiple_verb_families_close`)
2. Investigation Mode is the ONLY production consumer of `verb_family` — a single, contained file
3. The classifier's tiebreak rule is neutral (earliest first-appearance) · not INVESTIGATE-biased · not BUILD-biased
4. Test F is a valid consequence of the specification · not a bug in the classifier
5. The smallest reversible change is at the Investigation Mode consumption layer (~5 LOC · single file) · not at the classifier core
6. **Undercount Protection triggered a fourth option** the prior report did not consider — connect existing multi-intent signal rather than change semantic priority

**If the founder authorizes a fix,** the recommendation is Fix 4 (Investigation Mode ambiguity-signal consumption) · with mandatory:
- Explicit trace entry when a tied case is accepted
- Evidence packet field recording that classifier ambiguity was consumed
- Rerun Tests A-F for regression
- Rerun classifier's own `classifier.test.ts` for regression

**If the founder does NOT authorize a fix,** Test F remains an honestly-reported gap · not silently patched.

---

## §8 · What Test F would actually tell us if it reaches Investigation Mode

Per founder direction:
> *"If B and F then reach Investigation Mode but fail to diagnose correctly, that failure becomes extremely valuable. It would tell us the next real limitation is reasoning/evidence analysis rather than routing."*

If Fix 4 is authorized and Test F proceeds:
- **If absence detection surfaces `cap-spec-bridge.ts` at rank 1** → the routing layer was the only gap · investigation reasoning generalises
- **If absence detection does NOT surface the target** → we have a genuinely new investigative reasoning gap · distinct from the ones already identified

Both outcomes are informative. Both are diagnostic wins.

---

## §9 · Track A confirmation

- **C6** activation still awaiting founder-only offline actions
- **G15** trust set still empty (fail-closed)
- **C1** orchestrator → WO-04 wiring still not implemented
- **C3** programming-mission → WO-07 wiring still not implemented
- **Truth Engine Gate 3** remains CLOSED
- **NEX-13/14/15/16** designations remain PROPOSED
- **Founder authority module** never modified

**Track A: UNCHANGED THROUGHOUT.**

---

## §10 · Summary of the truthful position

**What this audit produced:** an evidence-based reclassification of Test F's failure mode. The failure is neither a classifier bug nor a fundamental reasoning gap — it is Investigation Mode not consuming multi-verb information the classifier already emits.

**What this audit did not produce:** any code change · any test change · any authorization advance.

**What is now available for founder decision:**
- **Do NOT fix:** Test F remains transparently gated at Investigation Mode entry · report honestly
- **Authorize Fix 4:** ~5 LOC in one file · consume existing ambiguity signal · rerun A-F · learn what happens
- **Authorize Fix 1/2/3 anyway** (higher-risk approaches from prior report)

Every option preserves Track A · zero-LLM constitution · read-only investigation · Prove-Before-Progression discipline.

**No option is executed by this audit. Founder-only decision.**

---

**End of multi-verb classifier diagnostic audit · Undercount Protection Rule triggered a lower-risk option (Fix 4) not present in the prior report · founder-only decision on whether/how to proceed.**
