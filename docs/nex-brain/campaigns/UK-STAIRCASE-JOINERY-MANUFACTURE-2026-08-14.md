# UK Staircase Joinery & Manufacturers Campaign

**Campaign id:** `staircase_manufacture`
**Opened:** 2026-08-14 · Philip
**Status:** LIVE
**Target:** 200+ verified reachable UK staircase / joinery / manufacture company URLs before any large batch run.

## Purpose

Populate the NEX directory with companies that **genuinely design and/or manufacture staircases in the UK**. This is a discovery-first campaign — we do not manufacture a domain list from memory. Every candidate URL must come from a real source and pass DNS preflight before it enters the fetch queue.

The immediate goal is coverage · the longer-term goal is a live matching pool for homeowner enquiries that fall outside pure refacing (e.g. "I need a new staircase built" or "we're extending — new staircase required").

## Governing rules (locked · standing)

1. **Never fabricate a domain.** Every candidate URL comes from a human/verified source (an operator saw it, or a discovery bookmark exposed it). Pattern-guessing (`https://<brand>staircases.co.uk`) is banned. See `project_nex_url_provenance_and_status_separation_2026_08_13.md`.
2. **DNS preflight before enqueue.** Handled by `enqueueUrl()` in `src/lib/nex/collection/urlQueueDb.ts`. Unresolvable hosts are rejected at paste time — never reach the worker.
3. **Discovery vs candidate is a first-class distinction.** Directory / search pages (Yell, Checkatrade, Houzz, Bark, MyBuilder, Trustatrader, BWF, ICF) are stored as `kind='discovery'` bookmarks — NEX never fetches them. The operator browses them by hand to find real company URLs.
4. **One company · one seed.** Additional pages (about, contact, staircase-service, joinery-service) MERGE evidence into the existing seed via `mergeCapabilitiesIntoSeed()`. Never create a duplicate.
5. **80-point auto-review threshold.** ≥80 auto-passes into the directory · <80 lands in `needs_review` for human confirmation. Never inflate. Never fabricate. See `project_nex_brain_confidence_rule_2026_08_13.md`.
6. **Classification is per-page evidence.** `MANUFACTURE`, `BOTH`, `INSTALLER`, `SUPPLIER`, `NEEDS_REVIEW`, `NOT_RELEVANT` — set independently by the worker from page content. `BOTH` = "does refacing AND manufacture", not a marketplace category.
7. **Observed numbers only.** Report actual pass/review/fail ratios from the current dataset. Never predict percentages from a small sample. See the Confidence Rule.
8. **The Trade Card Rule applies.** Listed manufacturers appear in the directory + are discoverable · but cannot receive homeowner enquiries until they claim + become a paid Refacing / Manufacture Member. `directory_state != paid_member` = discoverable, not routable. See `project_nex_trade_card_rule_2026_08_13.md`.

## Discovery bookmark starter set

Configured on `TRADE_CATEGORY_REGISTRY.staircase_manufacture.discoverySources`:

- Checkatrade · Staircases · UK
- Checkatrade · Joinery · UK
- Yell · Staircase Manufacturers · UK
- Yell · Joiners · UK
- Bark · Staircase Manufacturer · UK
- Houzz UK · Stairs & Railings professionals
- Trustatrader · Joiners & Carpenters · UK
- MyBuilder · Carpenters & Joiners · UK
- British Woodworking Federation · member directory
- Institute of Carpenters · member directory

These render at the top of `/nex-app/nex-brain/collector/queue?collection_type=staircase_manufacture`. The operator opens each in a new tab, finds real company websites listed there, and pastes the **company's own URL** into the queue below (not the directory search page).

## Ingest flow

```
Sources (discovery bookmarks)
  ↓ operator browses · finds real UK staircase/joinery company URLs
Paste box (CANDIDATE URLs · one per line)
  ↓ POST /api/nex/collection/queue · collection_type=staircase_manufacture
enqueueUrl()
  ├── invalid URL             → rejected (invalid_url) · visible in rejected list
  ├── DNS unresolvable        → rejected (dns_error) · visible in rejected list · never queued
  ├── known discovery domain  → stored as kind='discovery' · never fetched
  └── passes DNS + is candidate → status='queued'
Worker (POST /api/nex/collection/process-url-queue)
  ├── fetch page + up to 4 follow pages (contact/about/services)
  ├── extract company + email + phone + postcode + evidence
  ├── multi-service classify → REFACING · MANUFACTURE · BOTH · INSTALLER · SUPPLIER · NEEDS_REVIEW · NOT_RELEVANT
  ├── score 0-100 (name 20 · email 15 · phone 15 · postcode 10 · service 15 · multi +5 · evidence 10 · qual 10)
  ├── ≥80: MERGE (existing company) OR INSERT (new directory seed)
  └── <80: status='needs_review' · lands in the human review queue
```

## Failure surface

Each failure category has a suggested action — see `src/lib/nex/collection/failureCategorisation.ts`:

| Category | Meaning | Action |
|---|---|---|
| `dns` | Domain does not resolve · dead / fabricated / typo | Discard from active queue · keep audit |
| `http_403` | Reachable but bot-blocked | Manual review · real site behind WAF |
| `http_404` | Reachable but page dead | Manual review · URL likely wrong |
| `http_5xx` | Server error | Retry once · likely transient |
| `timeout` | Slow server | Retry once |
| `ssl` | Cert / hostname mismatch | Manual review · their cert issue |
| `not_html` | PDF / image / redirect-to-app | Discard · wrong content type |
| `extraction` | Fetch succeeded · no signals | Review · site loaded, no signals |
| `transient_or_blocked` | Domain resolves · bare "fetch failed" | Manual review · re-verify DNS |
| `other` | Unclassified | Manual look · pattern unknown |

Dashboard shows this breakdown live at `/nex-app/nex-brain/collector/queue?collection_type=staircase_manufacture`.

## Never do

- **Never** ask an AI to invent a list of "200 UK staircase joinery companies" — that's the failure mode that produced 81.8% dead domains on the 2026-08-13 refacing dump.
- **Never** paste a directory search page as a CANDIDATE URL (Yell / Checkatrade / Houzz / Bark / Trustatrader / MyBuilder). They go in as `DISCOVERY` (or are auto-routed to discovery by `inferUrlKind()`).
- **Never** reprocess failed URLs blindly. First categorise (`node scripts/nex-brain/categorise-failed-url-queue.mjs`) then decide per category.
- **Never** inflate a score to reach 80. Missing evidence stays missing.
- **Never** create parallel directory tables · everything routes through `insertDirectorySeed` + `mergeCapabilitiesIntoSeed`.

## Verification target

**200+ verified reachable UK staircase/joinery company URLs** in `nex_collection_url_queue` where:
- `collection_type = 'staircase_manufacture'`
- `kind = 'candidate'`
- `status IN ('queued','completed','duplicate','needs_review')` (not `failed`)

We do not process a large batch until we have that verified pool. Coverage before conversion.

## Related documents

- `project_nex_trade_card_rule_2026_08_13.md`
- `project_nex_brain_confidence_rule_2026_08_13.md`
- `project_nex_url_provenance_and_status_separation_2026_08_13.md`
- `project_nex_refacing_member_entitlement_2026_08_13.md`
- `src/lib/nex/centre-publishing/tradeCategoryRegistry.ts` · `STAIRCASE_MANUFACTURE`
- `src/lib/nex/collection/urlQueueDb.ts` · `enqueueUrl` · `queueFailureCategories`
- `src/lib/nex/collection/failureCategorisation.ts` · shared categoriser
- `scripts/nex-brain/categorise-failed-url-queue.mjs` · offline categorisation with DNS re-verify
