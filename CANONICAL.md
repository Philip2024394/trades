# THIS IS THE NEX APP — CANONICAL REPO

**If you are an AI agent or a developer, read this before anything else.**

- Product name      : NEX
- This repo         : D:\trades  ·  github.com/Philip2024394/trades
- Dev server        : npm run dev  →  http://localhost:3008
- Vercel project    : nex-trades
- Database (spine)  : local Postgres, nex_dev on localhost:5433 (see .env.local)
- Brand module      : ONE source of truth — see src/lib/<brand module>
- Contact email     : asknexapp@gmail.com
- Target domain     : nexapp.ie  (NOT YET REGISTERED — do not switch domain references)

## There are decoy folders on this machine. They are NOT the app.
- C:\Users\Victus\_ARCHIVE_nexapp-old            → old 14-file auth sketch, absorbed into this repo
- C:\Users\Victus\_ARCHIVE_trades-harvest-deploy → git-unlinked worktree, UK trades seed JSONs
- C:\Users\Victus\_ARCHIVE_trades-data-only      → data folder, not a repo
- C:\Users\Victus\hammer                          → SEPARATE LIVE APP. Shares the hammerex_* tables.
                                                     DO NOT rename DB objects. DO NOT archive.
- C:\Users\Victus\indoo-* / indocity              → separate Indonesian apps

## Hard rules
1. NEVER rename, drop or text-replace any `hammerex_*` database object. 7,885 references.
   Those tables are shared with the hammer/ app and docs/SYSTEM_STATE.md:103 warns that
   hosing hammerex_trade_off_listings kills the entire merchant side.
2. NEVER rename an environment-variable NAME in code without changing it in Vercel too.
3. Work on a branch, never directly on main.
4. Commit with explicit file paths. NEVER `git add -A` — the tree carries 1,100+ dirty entries.
5. The `nex` schema database has NO BACKUP. Never run a destructive or bulk migration
   without a verified pg_dump first.
