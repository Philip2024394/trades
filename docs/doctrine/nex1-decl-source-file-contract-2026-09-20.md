# NEX1 · `decl@` scope-identifier contract
Date · **2026-09-20**
Trigger · Founder acceptance of Stage 1.6 with recommended containment (2026-09-20).
Scope · Documented contract + canonical accessor. **No** modification of Q7 / Q8 / bridge internals.

---

## Rule (locked)

The single valid marker for a Stage 1.6 declaration-derived Q7/Q8 scope is the string constant `DECLARATION_SCOPE_PREFIX = "decl@"` exported from `src/lib/nex-agent/code-engine/capability-declaration-bridge.ts` and re-exported from `src/lib/nex-agent/code-engine/capability-selection-kind.ts`.

When the marker is present at the START of any of the following string fields, that string is a **scoped candidate identifier**, NOT a filesystem path:

- `CandidateRanking.candidate_id`                              (Q7)
- `CandidateRanking.source_file`                               (Q7)
- `RankingScope.source_file`                                   (Q7)
- `CandidateSelection.source_file`                             (Q8, persisted)
- `CandidateSelection.selected_candidate`                      (Q8)
- `CandidateSelection.rankings_reference.source_file`          (Q8)
- `InvestigationConclusionEntry.source_file`                   (Q8 persistence store)
- `InvestigationConclusionEntry.selected_candidate`            (Q8 persistence store)

Real filesystem paths for the same records are always available verbatim in the corresponding `provenance[i].source_file` field. Provenance is the strongest source of truth for a real path.

## Downstream discipline

Any code that:
- resolves a path with `path.resolve` / `path.join`,
- calls `fs.exists` / `fs.stat` / `fs.readFileSync`,
- constructs an IDE deep-link (`file://…`, `vscode://…`, GitHub blob URL, etc.),
- constructs a UI hyperlink or filesystem-tree presentation,
- diffs, patches, edits, or applies operators to the file,

**MUST** route through the canonical accessor `realSourceFile(sel)` in `capability-selection-kind.ts` before touching the value.

Any code that:
- filters, groups, or presents selections by kind (declaration vs root-cause),
- deduplicates across kinds,

**SHOULD** use `scopeKind(scopeKey)` or `interpretSelection(sel)` from the same module.

## Storage discipline

Persistence layers may store `source_file` verbatim (the prefix is content, not path). This is the current behaviour of `investigation-conclusion-store.ts` and it does not need to change.

When a persistence layer emits a search query keyed on `source_file` (equality-match), the query MUST use the SAME string form as was stored. That is, if a caller is searching for declaration-derived answers about `src/lib/foo.ts` they must query for `decl@src/lib/foo.ts` OR use `scopeKind` + `stripDeclarationScope` to unify the query form.

The retrieval layer at `capability-experience-retrieval.ts` currently equality-matches; consumers of this retrieval must either:

- pass the raw scoped identifier (correct when they know they are looking for a specific declaration scope), OR
- perform TWO queries (one raw, one with `decl@` prefix) and merge, OR
- call `interpretSelection` on retrieved records for post-filter classification.

No change is required to the retrieval layer.

## Grep of existing consumers (audited 2026-09-20)

23 files reference `candidate_selection` / `selection.source_file` / `selected_candidate`. None perform any of:
- `fs.exists(sel.source_file)`
- `path.resolve(sel.source_file)`
- `readFileSync(sel.source_file)`
- IDE deep-link construction from `sel.source_file`.

The identified usages are:
- **Storage**: `investigation-conclusion-store.ts` — stores as opaque string. Safe.
- **API**: `src/app/api/nex1/investigate/run/route.ts` — hands off to storage. Safe.
- **Retrieval**: `capability-experience-retrieval.ts` — equality-match filter. Safe.
- **Diagnostic tests and this session's own E2E test** — apply the strip helper. Safe.

No existing consumer requires modification.

## Enforcement

- Constant `DECLARATION_SCOPE_PREFIX` is locked to the literal `"decl@"` by test `capability-selection-kind.test.ts::"DECLARATION_SCOPE_PREFIX is exactly the string 'decl@'"`. Any change to the constant will fail regression.
- `realSourceFile()` post-condition: return value never starts with the prefix. Verified by test.
- `interpretSelection()` returns a strongly-typed structure that separates `scope_key` (may be prefixed) from `real_source_file` (never prefixed), preventing shape confusion at the call site.

## Non-goals

- This contract does NOT authorise adding a new discriminator field to `CandidateSelection` or `CandidateRanking`. Doing so would require reopening Q7 / Q8 policy files, which the founder acceptance decision explicitly declined.
- This contract does NOT address the remaining Stage 1 investigation limitations (walker scan budget, multi-line same-file disambiguation, cross-language declarations, etc.). Those are separate work items.

## Change control

- Any future addition of a NEW scope-prefix marker (e.g., `usage@`, `caller@`) must:
  1. Land a new constant in a discipline module,
  2. Update this doctrine file,
  3. Update `scopeKind()` / `interpretSelection()` in `capability-selection-kind.ts`,
  4. Update the enforcement test to cover the new marker.

## Change audit for this containment

```
Production files created:                    2 (capability-selection-kind.ts + .test.ts)
Doctrine files created:                      1 (this file)
Q7 / Q8 / Fix 8-14 / walker / bridge:        UNCHANGED (byte-identical hashes preserved)
native-investigation-mode.ts:                UNCHANGED for this containment (bridge wire-in from 2026-09-20 unchanged)
LLM / autonomous execution / new brains:     0
```
