# NEX Refacing · Collection Session Log

Rolling log of worker research sessions so the next session continues rather than repeating searches.

Every session appends a block to the bottom. Never edit prior blocks.

---

## Session · 2026-08-13 · Batch 003 (start)

**Region focus:** North West England (Manchester + Bolton area)
**Tools:** WebSearch + WebFetch (free · per Philip's directive · no paid APIs)
**Constraints noted:** WebFetch reliability ~30% in this environment · WebSearch is US-based so surface UK results are limited

**Search terms used:**
- `UK staircase refacing companies list Manchester Bolton refurbishment company website`

**Candidates examined this session:**

| Company | Source | WebFetch result | Save decision |
|---|---|---|---|
| Luxury Renovations · Manchester | WebSearch top hit | address/phone/email all "not stated" on target page | ❌ excluded · nothing verifiable per Rule A/B/C |
| Northwest Staircases · Manchester | WebSearch | ✅ phone + email + evidence quote | ✅ **saved** · `northwest-staircases-manchester` · NEX-D-225 · demo verified end-to-end |
| Stairfect Staircases · Bolton area | WebSearch | ✅ phone + email + focus on renovation | ⏸ candidate for next save this session |
| Abbott-Wade | Prior batches failed to fetch (`ECONNREFUSED`) | not retried this session | ⏸ retry future session |
| The Stair Shop · Stockport | not yet fetched | — | ⏸ candidate |

**Verified/saved companies this session · Batch 003 final:** 4 new records

| # | slug | town | qualification | email_status |
|---|---|---|---|---|
| 1 | northwest-staircases-manchester | Manchester | A | needs_manual_verification |
| 2 | stairfect-staircases-north-west-bolton | Bolton | A | needs_manual_verification |
| 3 | bespoke-staircase-leeds-leeds | Leeds | A | not_found |
| 4 | luxury-renovations-manchester | Manchester | B | needs_manual_verification |

**Duplicates detected & blocked · 1:**
- The Stair Shop (Stockport microsite at staircaserenovationstockport.co.uk) — fuzzy match to existing `thestairshop.co.uk` record. Likely same business, different service-area page. NOT force-created. Future admin edit could merge refacing evidence into the existing record.

**Failed WebFetch sources this session · 1:**
- Luxury Renovations landing page returned "not stated" for all contact fields · but /contact page succeeded on retry (evidence of `alex@luxury-renovations.co.uk` + 2 addresses recovered)

**Directory growth this session:**
- Before Batch 003: 6 refacing seeds
- After Batch 003: 10 refacing seeds (+4)
- Feed URL verified: `/api/nex/centre/feed?category=Staircase+Refacing` returns 10 items
- All 4 new records also visible in Trade Center via the new "Refacing" chip

**City sweep status (as of session end):**
- ✅ Manchester (partial · 4 candidates saved · more may exist)
- ✅ Bolton (Stairfect · Bespoke Staircase Leeds serves this area)
- ⏸ Stockport (skipped microsite · try dedicated Stockport-only trades next)
- ⏸ Liverpool
- ⏸ Leeds beyond Bespoke Staircase (Sheffield · York · Bradford)
- ⏸ Birmingham · London · Bristol · Newcastle · Nottingham · Leicester
- ⏸ Wales · Scotland · Northern Ireland

**Where the next session should start:**
1. **Retry queue from earlier batches** (WebFetch may recover): abbott-wade.co.uk · modernise-yourstairs.co.uk · hughesjoinery.co.uk/contact · hawthornjoinery.co.uk · nustair.co.uk · stairsdirectuk.com
2. **Manchester leftovers**: search `"staircase renovation manchester"` — check pages 2-3 of results for smaller trades
3. **Move to Liverpool** — `"staircase refurbishment liverpool"` search
4. **Then Leeds** — `"staircase renovation leeds"` search
5. **Then Birmingham → West Midlands sweep**

**Notes for next session:**
- Every email extracted by WebFetch is tagged `needs_manual_verification` — an admin should batch-verify these before any outreach campaign
- `directory_state = "listed"` is preserved on all new records (never auto-promoted)
- Sparse records (Bespoke Staircase — no email) are kept per Philip's "grow directory first, enrich later" model
- Duplicate detection blocked 1 · verify others aren't being blocked incorrectly

---

## Session · 2026-08-13 · Batch 004

**Region focus:** North West retry queue → Liverpool/Merseyside → Leeds/West Yorkshire → Birmingham/West Midlands → Bristol/South West
**Tools:** WebSearch + WebFetch (free)
**Constraints:** WebFetch reliability improved this session vs Batch 001/002

**Search terms used:**
- `UK staircase refacing companies Manchester Bolton refurbishment company website` (also Batch 003)
- `staircase refurbishment renovation company Liverpool Merseyside website`
- `staircase renovation refurbishment Leeds West Yorkshire company website`
- `staircase refurbishment Birmingham West Midlands renovation company`
- `staircase renovation refurbishment company Bristol Bath Somerset website`

**Retry queue results (6 URLs from Batch 001/002):**
| URL | Result |
|---|---|
| abbottwade.co.uk | ✅ recovered — data extracted (but dedup blocked · already existed in DB under slug `abbott-wade-staircases-warrington`) |
| modernise-yourstairs.co.uk | ❌ ECONNREFUSED (3rd fail) |
| hawthornjoinery.co.uk | ❌ SSL cert expired (2nd fail) |
| nustair.co.uk | ❌ ECONNREFUSED (2nd fail) |
| stairsdirectuk.com | ❌ ECONNREFUSED (2nd fail) |
| hughesjoinery.co.uk | ❌ HTTP 425 Too Early (2nd fail) |

**Batch 004 saves · 9 new records:**

| # | slug | town | qualification | email_status | notes |
|---|---|---|---|---|---|
| 1 | edwards-and-hampson-ltd-liverpool | Liverpool | A+ | needs_manual_verification | EH Joinery · 40+ yrs · Bootle |
| 2 | tailor-made-stairs-and-storage-solutions-liverpool | Liverpool | A+ | needs_manual_verification | Textbook overcladding · "fit over existing stairs" |
| 3 | liverpool-stair-renovations-crosby | Crosby | B | not_found | Sparse · family-run 10+ yrs |
| 4 | plr-staircase-and-joinery-leeds | Leeds | A | needs_manual_verification | Winrose Drive · 15 yrs family |
| 5 | leeds-signature-joinery-contracts-limited-leeds | Leeds | B | needs_manual_verification | Broader joinery · scope less specific |
| 6 | mdc-carpentry-services-lichfield | Lichfield | A+ | needs_manual_verification | 30+ yrs · comprehensive refacing |
| 7 | staircase-renovations-birmingham-service-page-birmingham | Birmingham | A+ | not_found | National brand service page · no contact info |
| 8 | hambledon-staircases-sturminster-newton | Sturminster Newton (Dorset) | A+ | needs_manual_verification | South West coverage · custom-manufactured |
| 9 | lucas-kane-carpentry-wells | Wells (Somerset) | A+ | needs_manual_verification | Textbook overcladding · oak over existing |

**Duplicates blocked this batch · 1:** Abbott-Wade (dedup on website domain).

**Session totals:**
- Directory before: 10 refacing seeds
- Directory after: **19 refacing seeds (+9 net)**
- Candidates examined: 12 (6 retries + 6 new discoveries via search)
- Success rate: 9/12 saved · 1 dedup · 2 skipped (Abbott-Wade dupe already counted · 6 retry failures)

**Cities/counties covered this batch:**
- Liverpool + Merseyside (+3)
- Leeds + West Yorkshire (+2)
- Lichfield (Staffordshire) (+1)
- Birmingham + West Midlands (+1)
- Sturminster Newton (Dorset) (+1)
- Wells (Somerset) (+1)

**Cumulative geographic spread (19 seeds):**
- North West England · 6 (Warrington · Wigan · Bury · Bolton · Manchester×2 · Wirral)
- Merseyside · 3 (Liverpool ×2 · Crosby)
- Yorkshire · 3 (Leeds ×3)
- West Midlands · 3 (Birmingham ×2 · Lichfield)
- South West · 2 (Wells · Sturminster Newton)
- UK-wide trade · 1 (Stairfurb)
- Test entry · 1 (tt)

**Where the next session should start:**
1. **Scotland** — `"staircase renovation Glasgow"` · `"staircase refurbishment Edinburgh"`
2. **Wales** — `"staircase refacing Cardiff"` · `"staircase refurbishment Swansea"`
3. **Northern Ireland** — `"staircase renovation Belfast"`
4. **London** — `"staircase refurbishment London"` (large market · likely many candidates)
5. **North East** — `"staircase renovation Newcastle"`
6. **Southampton/Portsmouth/Brighton south-coast sweep**
7. **East Anglia** — Cambridge · Norwich · Ipswich

**Failing URLs to retry later:** modernise-yourstairs · hawthornjoinery · nustair · stairsdirectuk · hughesjoinery (5 still failing after 2-3 attempts each · may need alternative sources)

**Housekeeping items for admin:**
- Test entry `tt-new-ross` still present — safe to delete when no longer needed for form testing
- All `needs_manual_verification` emails (13 seeds) should be batch-verified before any outreach

---
