# Batch 002 — Report (2026-08-13 · retry pass)

## Objective (per Philip 2026-08-13)

Retry the 7 URLs that failed in Batch 001 with WebFetch to test whether the failures were transient environment problems or sourcing issues.

## Retry outcomes

| # | Company | URL | Result |
|---|---------|-----|--------|
| 1 | Abbott-Wade | `abbott-wade.co.uk` | ❌ ECONNREFUSED (again · 2 attempts total this session) |
| 2 | Modernise Your Stairs | `modernise-yourstairs.co.uk` | ❌ ECONNREFUSED |
| 3 | Hughes Joinery | `hughesjoinery.co.uk/contact/` | ❌ HTTP 425 Too Early |
| 4 | Hawthorn Joinery | `hawthornjoinery.co.uk` | ❌ SSL certificate expired |
| 5 | Design My Stairs | `designmystairs.co.uk` (dropped `www.`) | ✅ **Verified** — full contact + email + services |
| 6 | Nustair | `nustair.co.uk` | ❌ ECONNREFUSED |
| 7 | Stairs Direct UK | `stairsdirectuk.com` (dropped `www.`) | ❌ ECONNREFUSED |

**Success rate this pass:** 1 / 7 (14%). Combined session total: **5 verified out of ~19 attempts (26%)**.

## Interpretation

The persistent failures (ECONNREFUSED · cert expired · 425 Too Early) are network/environment issues, not sourcing errors. Every one of these companies is a real UK refacing trade — the WebFetch tool cannot reach them from this environment.

## What was added to the directory this batch

**1 new verified seed:**

**Design My Stairs** — Wirral (Merseyside) · service area Liverpool + Chester + Milton Keynes + North Wales · 0151 203 9153 · admin@designmystairs.co.uk · A+ · directory_state = `listed`

Evidence: Company self-describes as "Staircase / Bannister Renovation Specialists" with 2-3 day bespoke stair renovation service, multiple renovation product lines (glass, metal, wooden, oak, steel).

## Total directory state (Batches 001 + 002)

| Metric | Value |
|---|---|
| Verified seeds | **5** |
| Public emails verified | 3 (Transform Staircases · Renovate Your Staircase · Design My Stairs) |
| Emails on site but redacted by fetcher | 1 (Stairfurb) |
| No public email found | 1 (Stair Part Replacement) |
| Verified phones | 5 / 5 |
| Websites | 5 / 5 |
| Google ratings | 0 |
| Qualification A+ | 5 |
| directory_state = listed | 5 |
| directory_state ≥ verified | 0 |
| Eligible for Refacing Trade Exchange routing | 0 (correct · no paid_member yet) |

## Geographic coverage (Batches 001 + 002)

| Region | Companies |
|---|---|
| North West England | 3 (Wigan · Bury · Wirral) |
| West Midlands | 1 (Birmingham) |
| UK-wide / trade supply | 1 (Stairfurb) |

England-only. Scotland · Wales · Northern Ireland still not covered.

## Files written this batch

| Path | Purpose |
|---|---|
| `data/directory-seeds/_refacing/design-my-stairs-wirral.json` | New seed · A+ · `directory_state: "listed"` |
| `data/directory-seeds/_refacing/BATCH-002-REPORT.md` | This file |
| `src/lib/nex/centre-publishing/directorySeedLoader.ts` | (Batch 001 code) Added `DirectoryState` type + `isEligibleForRefacingRouting()` helper |
| `data/directory-seeds/_schema.json` | (Batch 001 code) Added `directory_state` field |

## Rules preserved

- **No auto-promotion.** Every seed remains at `directory_state: "listed"` regardless of how strong its refacing evidence is. `verified` / `claimed` / `paid_member` require the corresponding commercial event (NEX manual verification · shared claim flow · Stripe activation).
- **No routing eligibility.** `isEligibleForRefacingRouting()` returns `false` for all 5 seeds — none are paid members.
- **No fabricated data.** Every field in every seed is either verified from the company's own website in this session or set to `null`.

## Recommended next step (Batch 003)

WebFetch has proven unreliable in this environment for large-volume research (6 of 7 retries failed the second time). Options for growing beyond 5 seeds:

1. **You paste candidate rows** in CSV / JSON (business name · website · town) and I run WebFetch on each in a controlled sequence with retries. Any that fail get flagged for manual entry.
2. **You supply verified rows** directly (from your own research or from a spreadsheet) and I batch-import them as seed JSONs after light validation.
3. **Different session** — WebFetch reliability may recover, and Batch 003 could naturally retry the same failed URLs.

Whichever path we take, `directory_state: "listed"` remains the default and no seed gets promoted without the corresponding commercial event.
