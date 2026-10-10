# SafeChat rules modules

Ruleset version: **safechat-rules-v1.1.0** (2026-10-10).

The classifier delegates every risk-level decision to rule modules in
this folder. Each module owns a single category of concern:

| file | module name | owns |
|---|---|---|
| `base-rules.ts` | `base` | Level 0 (clean) and Level 1 (isolated slang) |
| `secrecy-request-rules.ts` | `secrecy_request` | privacy vs grooming-secrecy distinction |
| `grooming-pattern-rules.ts` | `grooming_pattern` | score-based grooming indicator aggregation |
| `coercion-pressure-rules.ts` | `coercion_pressure` | conversation-level pressure signals |
| `compose.ts` | n/a | composes outputs + generic Level-2 branch |
| `_frozen-v1-0-0.ts` | n/a | FROZEN baseline · do not modify |

## Composition

`compose.ts::composeResult` takes an array of `RuleModuleOutput` plus
the raw vocabulary + pattern matches and returns the final
`ClassificationResult`.

- `finalLevel = max(contributedLevel across modules + generic branch)`
- `confidence` is a density blend of module confidences + v1.0.0 signal
  weights. Capped at 1.0. **Not** a probability.
- The "generic Level 2" branch (image_request / explicit_sexual / 2+
  sensitive matches / coercion_indicator) is applied inside compose.ts
  to preserve v1.0.0 behaviour for messages that no category module
  escalated.

## Adding a new rule module

1. Create `rules/<name>-rules.ts` exporting `applyRules: RuleModule` and
   `const <NAME>_MODULE_NAME`.
2. Create `rules/<name>-rules.test.ts` with the Level 0/1/2/3 branches
   covered, including a privacy test asserting no body text leaks into
   `contributingSignals`.
3. Wire it into `classifier.ts` by adding the module to the
   `applyAllModules` call site.
4. If the module uses new signal types or vocabulary categories, extend
   `types.ts` (additively) and the v1-1-0 seed script.

## Privacy invariant

Every module's `contributingSignals` must contain **signal / category
labels only**, never a slice of the message body. The
`privacy-audit.test.ts` suite greps for a sentinel across every DB
parameter, every rule_matches entry, every signals jsonb value, and
every log channel. The redaction at `classification-logger.ts` also
scrubs `matchedText` on persist · a module leaking body text in
`contributingSignals` is a privacy regression.

## Frozen baseline

`_frozen-v1-0-0.ts` is a verbatim snapshot of the Phase 1 baseline
resolver. **Do not modify this file.** It exists so the evaluation
runner can compare v1.1.0 vs v1.0.0 side-by-side.
