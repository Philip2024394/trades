# Australia Staircase Trade Market · Stage 2-AU Discovery Report

_Generated 2026-08-16T17:10:55.997Z · Stage 2 = discovery, not verification · zero Supabase writes_

## Result summary

| Metric | Count |
|---|---:|
| Raw candidates (across all 8 agents) | 369 |
| Within-AU duplicates removed | 37 |
| Unique AU candidates | **332** |
| Records without domain (kept for manual review) | 8 |
| Cross-country collision hits (vs live 896 UK+IE+US) | 0 |

## Per-agent contribution

| Agent | Raw count |
|---|---:|
| agent-au-1-nsw-deep.json | 71 |
| agent-au-2-vic-deep.json | 63 |
| agent-au-3-qld-deep.json | 44 |
| agent-au-4-wa-deep.json | 51 |
| agent-au-5-sa-tas.json | 50 |
| agent-au-6-act-nt-small.json | 30 |
| agent-au-7-national-manufacturers.json | 32 |
| agent-au-8-national-refacing-refurb.json | 28 |

## State distribution (unique AU)

| State | Count |
|---|---:|
| NSW | 91 |
| VIC | 65 |
| QLD | 56 |
| WA | 52 |
| SA | 28 |
| TAS | 22 |
| ACT | 14 |
| NT | 4 |
| **Total** | **332** |

## Business type distribution

| business_type_claim | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 180 |
| STAIRCASE_MANUFACTURER | 71 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 38 |
| REFURBISHMENT_SERVICE_SPECIALIST | 29 |
| STAIRCASE_INSTALLER | 11 |
| REFACING_SERVICE_SPECIALIST | 3 |

## Capability signals (top-line)

| Capability claim | Companies |
|---|---:|
| manufacture | 233 |
| design | 227 |
| timber | 212 |
| bespoke | 210 |
| balustrade | 175 |
| install | 161 |
| metal | 144 |
| handrail | 120 |
| installation | 115 |
| glass | 90 |
| kit_or_product_supplier | 68 |
| refurbishment | 42 |
| refurb | 27 |
| refacing | 18 |
| refinishing | 17 |
| heritage | 5 |
| extensible | 5 |
| repair | 3 |
| staining | 2 |

> Stage 2 claims are UNVERIFIED. Stage 3/4 verifies capability presence via direct site fetch. Do NOT treat these as `capabilities.<cap>='yes'` yet.

## Contact-channel coverage

| Channel | Records with data | % |
|---|---:|---:|
| website | 324 | 98% |
| telephone | 228 | 69% |
| email (public) | 133 | 40% |

## Cross-country collisions

No AU discovery record collided with a live UK/IE/US production row. Clean set.

## Rules preserved

- Zero Supabase writes
- Zero mutations to UK 471 / IE 50 / USA 375 (all remain frozen)
- Zero companies contacted
- Capability claims preserved as CLAIMS (not verified · not promoted to `capabilities.<cap>='yes'`)
- Every record has a source_url (Stage 3-AU can re-check)
- Within-AU dedup by normalised domain · same-domain records merged
- Cross-country matches flagged for review · never auto-discarded (Australian branch case is real)

## Files

- `C:/Users/Victus/trades/data/directory-seeds/_staircase_au_stage2/stage2-au-consolidated.json` · unified array of 332 unique AU candidates
- `C:/Users/Victus/trades/data/directory-seeds/_staircase_au_stage2/stage2-au-dedup-audit.json` · dedup audit trail
- 8 × `agent-au-*.json` · original per-agent output (unchanged)

## Next step (blocked pending Philip's approval)

Stage 3-AU · 20-record deep-verify sample. Follows the same protocol as UK / IE / USA:
- Sample across all states + business types
- Direct fetch each business's own domain
- Confirm or contradict Stage 2 capability claims
- Never elevates claims without evidence