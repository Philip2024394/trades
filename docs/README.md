# Documentation

Entry point for anyone (human or AI) trying to understand this codebase.

## Start here

- **[BLUEPRINT.md](./BLUEPRINT.md)** — auto-generated map of every app, lib module, platform area, page, API endpoint, migration, and cron. Regenerate with `node scripts/scan-blueprint.mjs`. Read this first.

- **[features/index.md](./features/index.md)** — human-curated feature index. One line per feature area with a pointer to detail. Read this to understand *what the app does*, not just what files exist.

- **[DECISIONS/](./DECISIONS/)** — Architecture Decision Records. Every important architectural choice with the reasoning captured at the time. Immutable once written.

## When you make a change

1. **Adding a new app** (`src/apps/{name}/`) → add a one-line `README.md` in the folder describing what it does.
2. **Adding a new lib module** (`src/lib/{name}/`) → same, or put the summary as the first `//` comment on `index.ts`.
3. **Adding a new page or API route** → put a `//` comment at the top of the file summarising what it does. That comment is what shows in `BLUEPRINT.md`.
4. **Making an architectural decision** (naming, tier structure, tech choice) → write an ADR in `DECISIONS/` numbered sequentially.
5. **At the end of a meaningful commit** → run `node scripts/scan-blueprint.mjs` to refresh the blueprint.

## Why this structure

The codebase is too big to hold in memory — neither a new engineer nor an AI assistant can absorb 50k lines in a session. Instead we make the repo self-describing:

- The blueprint scanner walks the file tree and dumps a fresh map. No manual work; runs in ~2s.
- The features index gives narrative context the scanner can't infer.
- ADRs preserve the *why* behind choices so nobody unravels them by accident.

Read `BLUEPRINT.md` + `features/index.md` and you know the app in ~5 minutes.
