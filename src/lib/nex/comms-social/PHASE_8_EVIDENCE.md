# Phase 8 · Evidence Report

**Date:** 2026-08-08
**Scope:** Attribution Integration · social publishes + clicks feed the existing Attribution machinery (Phase 5.3) via canonical `nex.analytics_events`. No parallel attribution system.
**Status:** ✅ PHASE 8 COMPLETE.

## Charter compliance summary (S-XI hardened)

| Requirement | Phase 8 status |
|---|---|
| Social emits into canonical `nex.analytics_events` (§S-XI) | ✅ every publish records `event_type='delivered', provider='social:<platform>'` · verified AI8 |
| UTM auto-append on outbound links | ✅ `analytics/utm.ts` · non-destructive · applied by worker before `adapter.publish` · verified AI1/AI2 |
| Merchant-supplied UTMs preserved | ✅ `if (!u.searchParams.has(k))` guard · verified AI2 |
| Regex only matches http(s) | ✅ `URL_RE = /\bhttps?:\/\/[^\s<>"]+/g` · verified AI3 |
| Tracking-redirect endpoint | ✅ `GET /api/nex/comms-social/track` · records `event_type='clicked'` · redirects 302 · verified AI4/AI5 |
| Track rejects non-http schemes | ✅ verified AI6 |
| Track requires `to` param | ✅ verified AI7 |
| ROI reader reuses `nex.attributions` + `nex.conversion_events` | ✅ `analytics/roi.ts` · joins on source_event_id · filters `provider LIKE 'social:%'` |
| ROI language never says "Social generated £X" | ✅ verified AI9: `£X of conversions had a Social touchpoint in the attribution window (<model> · <window>d)` |
| No parallel attribution tables introduced | ✅ zero new attribution tables · only a scoped RLS policy on existing `nex.analytics_events` for `nex_social_app` |

## Files changed / added

### New migration
- `deploy/postgres/init/037_comms_social_analytics_grant.sql` — grants `nex_social_app` INSERT + SELECT on `nex.analytics_events` (scoped to rows where `provider LIKE 'social:%'`), SELECT on `nex.attributions` + `nex.conversion_events`. Attribution is observational · no new invariant.

### New runtime (3 files)
- `src/lib/nex/comms-social/analytics/utm.ts` — `appendUtmsToCaption` · non-destructive URL rewriting.
- `src/lib/nex/comms-social/analytics/publish-audit.ts` — `recordSocialPublishEvent` · `recordSocialClick`.
- `src/lib/nex/comms-social/analytics/roi.ts` — `computeSocialRoi` · returns explicit `language_hint`.

### New API routes (2 files)
- `GET /api/nex/comms-social/track?to=&post=&platform=&variant=` — records click + 302 redirects.
- `GET /api/nex/comms-social/analytics/roi?tenant_id=&model=&window_days=` — reads attributions.

### Worker update
- `src/lib/nex/comms-social/worker/worker.ts` — before publish: caption runs through `appendUtmsToCaption` (dynamic import) · after publish success: `recordSocialPublishEvent` emits canonical `delivered` event.

### New tests
- `src/lib/nex/comms-social/tests/attribution-integration.test.mjs` · 10 assertions · 10/10.

## Exact test counts

| Suite | Result |
|---|---|
| Phase 0-7 (26 suites) | 216/216 |
| **attribution-integration** (P8) | **10/10** |
| **Total** | **226/226** across 27 suites |

## Doctrine faith kept
- Attribution invariant #14 (observational) preserved · Social READS attributions, never writes them.
- Charter S-XI language discipline enforced in code (language_hint field) · UI renders verbatim.
- Predictive OBSERVATION mode active.
- Hammerex untouched · 7 v1.0.0 hashes match.
- Boundary verifier zero violations.
