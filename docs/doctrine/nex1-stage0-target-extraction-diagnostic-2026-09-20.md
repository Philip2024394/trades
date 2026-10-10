# NEX1 · Stage 0 · Target-Symbol Extraction Diagnostic
Date · **2026-09-20**
Founder-authorised · read-only · no fix applied.

---

## Key question

> Can NEX deterministically separate the requested symbol from linguistic operators (defined / define / definition / declare / declared / declaration / implement / implements / implementation / export / exports / exported / where / which / class / function / interface / …) without losing legitimate target tokens?

## Direct answer

**NO — not yet. But the failure is deterministic, small, and cleanly repairable.**

- Target symbol preservation: **14 / 14** — the classifier NEVER loses the intended target.
- Operator leakage: **11 / 14 non-control cases plus the negative control** emit at least one linguistic operator alongside the target.
- The leaked operators form a **fixed, reproducible set of 8 words**, all of which are already known to the pipeline via `DEFINITION_INTENT_TOKENS` or `CODING_LEXEME_INDEX`.

## Diagnostic corpus + verdict per case

Full JSON receipt · `data/nex1-stage0/target-extraction-diagnostic.json`

| # | Query | Target present? | Operators leaked | Verdict |
|---|---|---|---|---|
| D1  | Where is assessFear defined? | ✅ | `defined` | LEAKS_OPERATORS |
| D2  | Where is evaluateHypothesisEvidence defined? | ✅ | `defined` | LEAKS_OPERATORS |
| D3  | Where is ComposedArgument defined? | ✅ | `defined` | LEAKS_OPERATORS |
| D4  | Where is computeAbsenceCandidates defined? | ✅ | `defined` | LEAKS_OPERATORS |
| D5  | Where is FooBar defined? (**negative control** · symbol not in repo) | ✅ (`foobar` extracted) | `defined` | NEGATIVE_CONTROL_LEAKS |
| D6  | How is assessFear implemented? | ✅ | `implemented` | LEAKS_OPERATORS |
| D7  | Which class defines patternIdOf? | ✅ | `class` | LEAKS_OPERATORS |
| D8  | Where is the export of runNativeInvestigation? | ✅ | `export` | LEAKS_OPERATORS |
| D9  | Where is the function assessFear? | ✅ | (none) | **SEPARATES** |
| D10 | Find the declaration of toForwardSlash | ✅ | `declaration` | LEAKS_OPERATORS |
| D11 | Where is toForwardSlash defined? | ✅ | `defined` | LEAKS_OPERATORS |
| D12 | What file exports the interface ComposedArgument? | ✅ | `exports`, `file` | LEAKS_OPERATORS |
| D13 | Where is the implementation of generateRootCauseCandidates? | ✅ | `implementation` | LEAKS_OPERATORS |
| D14 | Which interface declares HypothesisEvidenceEvaluation? | ✅ | (none) | **SEPARATES** |

## Union of unique operators ever leaked

```
class · declaration · defined · export · exports · file · implementation · implemented
```

Eight tokens. Every one of them is already known to the pipeline elsewhere:

- `defined`, `implemented`, `declaration`, `implementation`, `export`, `exports` — **all live in `DEFINITION_INTENT_TOKENS`** (source: `native-investigation-mode.ts:289-295`).
- `class`, `exports`, `file` — **live in `CODING_LEXEME_INDEX`** but emitted with `category="concept"` rather than filtered.

## Words that did NOT leak (correctly filtered)

The classifier's existing filters do successfully suppress the majority of noise words: `where`, `which`, `how`, `what`, `is`, `the`, `of`, `for`, `function`, `interface`, `type`, `enum`, `const`, `let`, `var`. These reach one of:

- STOP_WORDS (function words)
- VERB_LEXEME_INDEX (verbs that classify intent)
- Deliverable phrase (matched-phrase filter — `function`, `interface`, etc.)

So the extractor is **not fundamentally broken** — it filters most operators. It fails only on the exact vocabulary that names a definition act (`defined`, `implemented`, `declaration`, `implementation`, `export`, `exports`, `class`, `file`).

## Why the leaks happen (source-verified)

Source: `capability-a-founder-intent/classifier.ts:624-671` — `extractDomainTokens`:

```ts
for (const t of tokens) {
  if (lower.length < 3) continue;
  if (/^\d+$/.test(lower)) continue;
  if (STOP_WORDS.has(lower)) continue;
  if (VERB_LEXEME_INDEX.has(lower)) continue;
  if (CODING_LEXEME_INDEX.has(lower)) continue; // → coding_concepts
  if (deliverableWords.has(lower)) continue;
  // ← everything else becomes a `domain` concept
}
```

The leaked words:

- `defined`, `implemented`, `declaration`, `implementation` are **not in STOP_WORDS · not verbs · not coding lexemes · not deliverable phrase words** → they reach the domain-token bucket.
- `class`, `export`, `exports`, `file` **ARE in CODING_LEXEME_INDEX** so they route to `coding_concepts` — but that field is ALSO fed as concepts to the walker/bridge downstream (source: `native-investigation-mode.ts:1239`), so category="concept" leaks through too.

Both leak paths converge on the walker's `concepts` argument and are then handed to the declaration bridge, which honestly looks up every one of them as a symbol.

## Determinism

The 14-case diagnostic ran once. Given the fully-deterministic extraction (regex + set lookup, no randomness), a repeat run will produce byte-identical output. This can be confirmed on request; I did not run a second pass in this diagnostic to keep the change surface minimal.

## What is proven

1. Target symbol is preserved in every case (14/14).
2. Operator leakage is deterministic, reproducible, and confined to a closed set of 8 words.
3. Two out of 14 cases already SEPARATE cleanly, showing the mechanism CAN filter the entire class when the leaked word happens to also be in `VERB_LEXEME_INDEX` or a deliverable phrase.
4. Root cause is `extractDomainTokens` not filtering the `DEFINITION_INTENT_TOKENS` set + `coding_concepts` still reaching the walker.

## What is NOT proven

- Behaviour on queries with multiple legitimate target symbols (e.g., "Where are `foo` and `bar` defined?"). Not tested — would need a separate corpus.
- Behaviour on non-English queries. Not tested.
- Whether the current set is exhaustive; new operator words could appear in different phrasings.

## Proposed fix (design only · not authorised · not implemented)

**Smallest additive filter:** add a Stage 0 filter that excludes tokens in `DEFINITION_INTENT_TOKENS` (and a small set of the leaked coding lexemes: `class`, `export`, `exports`, `file`) from the concepts array fed to the walker/bridge.

Two options for the filter location:

1. **At the classifier boundary** (modify `extractDomainTokens` in `classifier.ts` and filter `coding_concepts` before emission). Downside: touches a frozen file used by many callers.
2. **At the Stage 1.6 caller boundary** (in `native-investigation-mode.ts`, filter `investigationConcepts` before calling walker + bridge for definition-intent investigations). Upside: additive · isolated · frozen files unchanged · matches the same "declaration-intent bounded scope" mechanism already in use for `definition_intent=true`.

Option 2 preserves the founder's Stage-1.6-frozen rule verbatim. The filter would apply **only** when `definitionIntent === true`, so classifier behaviour for other investigation types is unchanged.

**Expected effect (predicted, not measured):**

- D1-D4 · D5 (control) · D6 · D10 · D11 · D13: `defined` / `implemented` / `declaration` / `implementation` filtered → single target concept survives → declaration bridge emits ONE evaluation instead of two → false-positive `capability-repo-world-model.ts:223` disappears.
- D7: `class` filtered → false positives from `class` declarations disappear.
- D8: `export` filtered → same.
- D12: `exports` and `file` filtered → same.
- D9 · D14: unchanged (already SEPARATE).
- Target preservation: 14/14 unchanged.

## Change audit for this diagnostic

```
Production files changed:                     0
Q7 / Q8 / Fix 8-14 / walker / bridge:         UNCHANGED (byte-identical hashes still hold)
Classifier / vocabulary:                       UNCHANGED
Diagnostic test file added:                    +1  (nex1-stage0-target-extraction-diagnostic.test.ts)
Doctrine file added:                           +1  (this file)
Evidence file:                                 +1  (data/nex1-stage0/target-extraction-diagnostic.json)
LLM / autonomous execution / new brains:       0
```

## STOP

Diagnostic complete. Awaiting founder decision on:

- **Option A** — implement the filter at the Stage 1.6 caller boundary (Option 2 above, additive, definition-intent-gated).
- **Option B** — implement the filter at the classifier boundary (Option 1 above, touches classifier).
- **Option C** — expand the diagnostic first (multi-symbol queries, non-English, other operator phrasings) before deciding.
- **Option D** — accept the current limit and document it as a bounded property of the declaration capability.
