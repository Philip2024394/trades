# NEX Staircase Knowledge Adapter

**Standing · Load-bearing · 2026-08-17**

This is the ONLY boundary between the staircase research corpus and the UI. Every staircase-facing component must import from `@/lib/staircase-knowledge` and NEVER touch the raw JSON files directly.

## Contract

- **In:** the frozen v1 research corpus at `research/v1/` (canonical source)
- **Cached copy:** `./data/*.json` (four machine-readable files snapshotted from `research/v1/`)
- **Out:** typed accessors exposed from `index.ts`

## Rule (Philip 2026-08-17)

> *"The UI should not directly interpret raw research JSON everywhere. That gives you one controlled knowledge boundary."*

## Bumping the corpus version

1. Edit source files in `research/` (working set — never `research/v1/`).
2. When ready to ship, cut a new snapshot: `research/v2/` (or `v1.1/`).
3. Copy the four JSON files from the new snapshot into `./data/`.
4. Bump the `CORPUS_VERSION` constant in `index.ts`.
5. Update this README.

## What NEVER changes

- The public API of `index.ts` — components depend on it. Additions are fine; removals/renames need a coordinated refactor.
- The rule that UI never imports from `./data/` directly. Always go through `index.ts`.

## Current version

Corpus: **v1.0.0** (2026-08-17)
Source: `C:/Users/Victus/trades/research/v1/`

## Files this adapter DOES NOT import

- `staircase-taxonomy-master.md` — narrative reference for humans
- `staircase-sources.md` — bibliography for auditors
- `research-gaps.md` — quality-system record of UNKNOWNs

These are auditable knowledge documents. If you find yourself wanting to import them, you probably want structured data — extend the JSON files instead.
