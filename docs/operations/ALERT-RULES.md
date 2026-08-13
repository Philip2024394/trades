# Alert Rules · operator guide

**Owner:** on-call engineer
**Status:** F5 · schema + API live · UI pending

## What this is

`nex.alert_rules` is the operator-editable list of thresholds. When a counter (from `src/lib/nex/observability/counters.ts`, exposed via `/api/nex/observability/metrics`) crosses a rule's threshold, downstream alert dispatch (F5 phase 2 · not yet built) fires notifications.

Until the dispatcher lands, this table is the source of truth for **what alerts we intend to have.** Rules are read by dashboards to render "which counters are we watching?"

## Fields

| Field | Values | Notes |
|---|---|---|
| `counter_name` | any of the 18 counter names | e.g. `shadow.mirror_failed`, `cron_tick.failed`, `audit.emit_dropped` |
| `comparison` | `gt` · `gte` · `lt` · `lte` · `eq` | direction of the threshold check |
| `threshold` | number | numeric level to compare against |
| `window_seconds` | 1…86400 | rolling evaluation window |
| `severity` | `p0` · `p1` · `p2` · `p3` | matches incident-response levels |
| `enabled` | true/false | soft toggle; disabled rules keep history |
| `description` | free text ≤ 1000 chars | for humans |
| `channels` | jsonb array | future: email/slack/pagerduty destinations |

## API

Every endpoint requires the cron-secret bearer (`Authorization: Bearer $CRON_SECRET`).

### List all rules
```
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://YOUR-DOMAIN/api/nex/observability/alert-rules
```

### Create a rule
```
curl -H "Authorization: Bearer $CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{
       "counter_name":   "shadow.mirror_failed",
       "comparison":     "gt",
       "threshold":      5,
       "window_seconds": 300,
       "severity":       "p1",
       "enabled":        true,
       "description":    "Reverse-shadow mirror failed >5× in 5 min"
     }' \
     https://YOUR-DOMAIN/api/nex/observability/alert-rules
```

### Fetch / update / delete one rule
```
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://YOUR-DOMAIN/api/nex/observability/alert-rules/<uuid>

curl -X PATCH -H "Authorization: Bearer $CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{ "enabled": false }' \
     https://YOUR-DOMAIN/api/nex/observability/alert-rules/<uuid>

curl -X DELETE -H "Authorization: Bearer $CRON_SECRET" \
     https://YOUR-DOMAIN/api/nex/observability/alert-rules/<uuid>
```

## Recommended starter set (seed via POST after migration 048 lands)

Copy-paste the 10 rules below. They mirror the hardcoded set from `SystemHealthPanel.tsx` and cover the highest-signal counters.

| # | Counter | Comparison | Threshold | Window | Sev | Why |
|---|---|---|---|---|---|---|
| 1 | `cron_tick.fired` | `lt` | 1 | 180 | p0 | Cron stopped firing for 3 min |
| 2 | `cron_tick.failed` | `gt` | 3 | 300 | p1 | 3+ cron failures in 5 min |
| 3 | `shadow.mirror_failed` | `gt` | 10 | 300 | p1 | Reverse-shadow drift risk |
| 4 | `audit.emit_dropped` | `gt` | 0 | 300 | p1 | Audit trail losing rows |
| 5 | `manager.inbox_read_degraded` | `gt` | 1 | 300 | p1 | Inbox degraded > once |
| 6 | `router.route_failed` | `gt` | 5 | 300 | p2 | Routing errors accumulating |
| 7 | `inbox.enqueue_failed` | `gt` | 3 | 300 | p1 | Cannot enqueue new work |
| 8 | `jobs.create_failed` | `gt` | 3 | 300 | p1 | Cannot create worker jobs |
| 9 | `analytics.rollup_failed` | `gt` | 5 | 600 | p2 | D6 worker degraded (async mode) |
| 10 | `validate.row_dropped` | `gt` | 100 | 3600 | p2 | High rate of malformed input |

Save the above as `scripts/seed-alert-rules.mjs` if you want a one-command re-seed after a wipe. (Not required to ship.)

## Rotation

Alert rules are data, not code — no rotation needed. To change a threshold, PATCH the row. History is preserved via `updated_at` + `disabled_at`.

## Verifying a rule works

The alert dispatcher isn't built yet, so today "verifying" means:
1. Rule exists in the table (GET the list)
2. The referenced counter appears in `/api/nex/observability/metrics`
3. Threshold makes sense against typical counter values (query `metrics` while the system is idle to see baselines)

When the dispatcher lands (F5 phase 2), a rule marked `enabled=true` with a valid counter will actually page. Until then, `enabled=true` is a promise, not a delivery.

## Related

- Counter definitions: `src/lib/nex/observability/counters.ts`
- Metrics endpoint: `src/app/api/nex/observability/metrics/route.ts`
- Migration: `deploy/postgres/init/048_alert_rules.sql`
- Storage adapter: `src/lib/nex/observability/alert-rules.ts`
- Routes: `src/app/api/nex/observability/alert-rules/route.ts` + `[id]/route.ts`
- Incident response: `docs/operations/INCIDENT-RESPONSE.md`
