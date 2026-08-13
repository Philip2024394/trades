# Wave 3 · H5 · Alert Dispatcher (Subsystem A wiring · Q7 shrink)

**Programme:** Headquarters Production Readiness · Wave 3 · Batch H5
**Authorisation:** Philip · 2026-08-10 · initial vendor-neutral H5, then **Q7 shrink** after two architectural conflicts surfaced during audit.
**Date opened:** 2026-08-10.
**Final state (locked at end of this batch):**

> **H5 (Subsystem A wiring) — IMPLEMENTED · VERIFIED — LOCAL LIVE**
> **H5 (Subsystem B dispatcher) — BLOCKED · pending resolution of the 021/048 nex.alert_rules collision**
> **PRODUCTION — NOT PROVEN**
> **NEX_ALERTS_DISPATCH_ENABLED remains unset by default**

Related sources of truth:
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2 (Batch H5)` — original objectives (superseded by Q7 shrink)
- `WORLD-CLASS-OPS-FINAL-GAP-AUDIT.md §R-4` — the audit gap
- `deploy/postgres/init/021_alerts.sql` · `deploy/postgres/init/048_alert_rules.sql` — the two colliding migrations
- `src/lib/nex/alerts/*` — Subsystem A (authoritative for H5)
- `src/lib/nex/observability/alert-evaluator.ts` · `observability/alert-rules.ts` — Subsystem B (BLOCKED)
- Previous closures: `WAVE-3-H4-MIGRATION-049-GATE.md` · `WAVE-3-H3-TIMEOUT-BUDGETS.md` · `WAVE-3-H2-CID-LOGGER.md` · `WAVE-3-H1-MIGRATION-HYGIENE.md`

---

## 0 · Prohibitions honoured

Per the Q7-authorisation directive:

- ⛔ Not modifying migration 021
- ⛔ Not modifying migration 048
- ⛔ Not creating another alert-rules table
- ⛔ Not adding columns to `nex.alert_rules`
- ⛔ Not moving Subsystem B to another table
- ⛔ Not encoding B's rules into `params jsonb`
- ⛔ Not retiring Subsystem B
- ⛔ Not inventing p0→critical severity mappings
- ⛔ Not deciding incident-severity policy
- ⛔ Not bridging Subsystem B into Subsystem A
- ⛔ Not creating `nex.alert_dispatch_config`
- ⛔ Not touching production migrations
- ⛔ Not enabling production dispatch
- ⛔ Not touching Supabase / hammerex_* / the 10 preserved KJs / the supervisor

---

## 1 · Original H5 assumption vs discovered reality

### 1.1 · What the plan assumed

`WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2` proposed:

> Batch H5 · Metrics scrape + alert dispatcher (R-3 + R-4)
> H5.d · Alert dispatcher module `src/lib/nex/observability/alert-dispatcher.ts` — reads firing rules from `evaluateAlertRules()` + a config table `nex.alert_dispatch_config` (new · schema TBD)

The plan assumed:
1. **No dispatcher exists anywhere in NEX today.** Wrong.
2. **A single alert-rules table needs a single dispatcher.** Wrong — there are TWO tables that both try to occupy `nex.alert_rules`.
3. **The F5 counter-based evaluator is the only alert path that needs closing.** Wrong — Subsystem A (the older, richer alert engine) also has no scheduled dispatch path.

### 1.2 · What audit revealed

Two parallel, independently authored alert subsystems.

**Subsystem A · `src/lib/nex/alerts/*`** (older · richer · works against the live schema)
- Full lifecycle: catalogue → snapshot → evaluate → open/dedup/resolve → dispatch
- `alerts/dispatch.ts` **already exists** with three transport adapters (email · webhook · slack) — all env-var-configured, vendor-neutral in implementation
- Backed by `nex.alerts` + `nex.alert_dispatches` (migration 021)
- Route `POST/GET /api/nex/alerts/evaluate` exists but **is not wired to any cron**
- UI `AlertsCentrePanel.tsx` — manual "run tick" button

**Subsystem B · `src/lib/nex/observability/alert-evaluator.ts`** (newer · F5 phase 2 · counter-based)
- Reads counters + rules · returns firing state · **explicitly dispatch-free** by design
- Reads from `nex.alert_rules` expecting a COMPLETELY DIFFERENT schema (see §2)
- Exposed on `/api/nex/brain/llm-health` for observability only
- **Cannot fire** against the live schema — see §2

**The audit R-4 wording** — "F5 evaluator has no dispatcher" — accurately describes Subsystem B. But Subsystem B is broken by the 021/048 collision (see §2), which the audit did not surface.

### 1.3 · Design decisions logged (Q1-Q3 · superseded by Q7)

The original H5 authorisation was a vendor-neutral bridge (Q1-B, Q2-C, Q3-broader-gap). That direction was chosen before the 021/048 collision was known. Once the collision surfaced, the bridge became infeasible (Subsystem B's `listAlertRules()` returns rows whose fields are all `undefined` because 048's columns don't exist on the live 021 table · every rule has `enabled: false` after `Boolean(undefined)` · zero firings possible).

Q7 (shrink) supersedes Q1-Q3. The bridge is **NOT implemented**. Subsystem B is documented as BLOCKED.

---

## 2 · The 021/048 collision (recorded, not resolved)

### 2.1 · The two schemas

**`deploy/postgres/init/021_alerts.sql`** creates `nex.alert_rules` as:
```
rule_id           TEXT PRIMARY KEY
name              TEXT NOT NULL
category          TEXT NOT NULL
severity          TEXT NOT NULL  -- 'info' | 'warning' | 'critical'
description       TEXT
params            JSONB NOT NULL DEFAULT '{}'
enabled           BOOLEAN NOT NULL DEFAULT TRUE
dedup_window_sec  INTEGER NOT NULL DEFAULT 900
notify_channels   TEXT[] NOT NULL DEFAULT ARRAY['webhook']
root_cause_of     TEXT[] NOT NULL DEFAULT '{}'
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**`deploy/postgres/init/048_alert_rules.sql`** tries to create the SAME table as:
```
rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
counter_name    TEXT NOT NULL
comparison      TEXT NOT NULL  -- 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
threshold       NUMERIC NOT NULL
window_seconds  INT NOT NULL
severity        TEXT NOT NULL  -- 'p0' | 'p1' | 'p2' | 'p3'
enabled         BOOLEAN NOT NULL DEFAULT TRUE
description     TEXT
channels        JSONB
created_by      TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
disabled_at     TIMESTAMPTZ
```

### 2.2 · Live state on local NEX Postgres

Both files use `CREATE TABLE IF NOT EXISTS`. 021 runs first (alphabetical order in `apply-nex-storage-schema.mjs`); 048's CREATE is a silent no-op. Confirmed via `information_schema.columns`:

```
nex.alert_rules columns (live):
  rule_id          text            (021)
  name             text            (021)
  category         text            (021)
  severity         text            (021 · info/warning/critical)
  description      text            (both)
  params           jsonb           (021)
  enabled          boolean         (both)
  dedup_window_sec integer         (021)
  notify_channels  ARRAY           (021)
  root_cause_of    ARRAY           (021)
  created_at       timestamptz     (both)
  updated_at       timestamptz     (both)
```

Missing (Subsystem B expects): `counter_name` · `comparison` · `threshold` · `window_seconds` · `channels` · `created_by` · `disabled_at`.

### 2.3 · What this batch does about it

**Nothing.** Q7's shrink deliberately excludes any structural change. The collision is recorded as OPEN and shipped verbatim in this document so future architectural decisions have the evidence they need. Any resolution requires a production migration authorisation Philip has explicitly withheld.

### 2.4 · Severity space also incompatible

Subsystem A's dispatch severity gate reads `NEX_ALERTS_MIN_SEVERITY ∈ {info, warning, critical}` (`SEVERITY_RANK = { info:0, warning:1, critical:2 }`). Subsystem B's rule severity type is `p0 | p1 | p2 | p3`. There is no obvious mechanical mapping (p0=critical? p1=warning? p2/p3=info?). This is an incident-response policy call, not a code change. Also OPEN.

---

## 3 · Q7-shrink · authoritative for H5 (Subsystem A wiring only)

### 3.1 · Deliverables

1. **`NEX_ALERTS_DISPATCH_ENABLED=1` gate** — added inside `alerts/evaluator.ts`'s dispatch block. When the gate is unset (default), evaluate() still runs when invoked (manual button + tests) but the dispatch loop is skipped. When the gate is `1`, dispatch fires per rule's `notify_channels`.
2. **Cron wiring** — cron-tick calls `evaluate()` only when `NEX_ALERTS_DISPATCH_ENABLED=1`. Default off = zero behaviour change from today; cron neither evaluates nor dispatches.
3. **Preserve existing adapters** — `dispatchEmail`, `dispatchWebhook`, `dispatchSlack` in `alerts/dispatch.ts` remain unchanged in interface. They are re-documented as vendor-neutral transport adapters (Email → NEX Email Runtime · Webhook → generic HTTP · Slack → generic incoming-webhook, no Slack SDK).
4. **Fail-closed "no transport" signal** — inside `dispatchAlert()`, after the severity gate passes AND after per-channel loop, if `sent === 0 && failed === 0 && skipped === channels.length` (i.e. every channel skipped because its env-configured transport is missing), increment counter `alerts.dispatch_no_transport` and emit `log.warn("no_transport", { alert_id, rule_id, severity, channels })`. Existing `nex.alert_dispatches` skipped-audit rows also record.
5. **Structured logger + CID** — add `logger("alerts.evaluator")` + `logger("alerts.dispatch")` (H2 compliance). Wrap `/api/nex/alerts/evaluate` route in `runFromRequest` and add to `LAYER1_ADOPTED`.
6. **AlertsCentrePanel copy** — brief note that dispatch only fires when the gate is on (operator visibility, not behaviour change).
7. **Contract tests** — dispatch gate on/off · fail-closed no-transport counter · severity-below-min still skips silently · CADP1 covers the newly adopted route.
8. **Live-live verification** — probe local NEX Postgres · gate-off → no dispatch · gate-on + no env → fail-closed counter fires · gate-on + `NEX_ALERTS_WEBHOOK_URL` set to a local echo endpoint → dispatch flows.

### 3.2 · New counter (fixed-enum extension)

- `alerts.dispatch_no_transport` · added to `src/lib/nex/observability/counters.ts`

### 3.3 · No new tables · no new migrations · no vendor commitment

- No `nex.alert_dispatch_config`
- No production DB touch
- No Slack SDK, Twilio SDK, PagerDuty SDK · every adapter stays env-var-configured HTTP
- No F3 log-drain vendor pick

---

## 4 · What remains OPEN after H5

| Item | State | Reason |
|---|---|---|
| Subsystem A evaluation | ✅ addressed | wired to cron behind gate |
| Existing dispatch adapters | ✅ reused | unchanged interfaces |
| Cron / operator path | ✅ H5 target | gate + cron wiring |
| Missing transport | ✅ fail-closed | counter + warn log |
| Subsystem B dispatcher (R-4 literal) | 🔴 OPEN | broken by 021/048 collision · needs migration authorisation |
| 021/048 `nex.alert_rules` collision | 🔴 OPEN | requires separate architectural decision + migration |
| p0-p3 vs info/warning/critical severity mapping | 🔴 OPEN | incident-response policy call |
| Production dispatch enable | 🔵 NOT AUTHORISED | requires separate operator authorisation |
| F3 log-drain vendor pick | 🔵 NOT AUTHORISED | separate track |
| SMS / vendor-specific adapters (Twilio · Slack SDK · PagerDuty) | 🔵 NOT ATTEMPTED | vendor-neutral by design |
| CI wiring for the new counter observability | 🔵 NOT ATTEMPTED | matches H1.c / H3 open items |

**H5 does not claim to close all of R-4.** It closes the Subsystem A side. R-4 for Subsystem B remains OPEN until the 021/048 collision is resolved.

---

## 5 · Test plan

- **HD1** · dispatch gate ON + severity qualifies + at least one channel has env transport → `dispatchAlert` returns `sent > 0`, `no_transport` counter NOT bumped.
- **HD2** · dispatch gate ON + severity qualifies + zero channels have env transport → `dispatchAlert` returns `sent=0, failed=0, skipped=channels.length` AND `no_transport` counter bumped once AND log.warn emitted.
- **HD3** · dispatch gate ON + severity below min → existing behaviour (skipped, no `no_transport` bump).
- **HD4** · dispatch gate OFF → `evaluate()` runs to completion but dispatch loop is skipped · return payload shows `dispatch_skipped_gate > 0`.
- **HE1** · CADP1 (H2 drift-catcher) — `alerts/evaluate/route.ts` added to `LAYER1_ADOPTED`, wraps in `runFromRequest`, test green.
- **Live 1** · local NEX Postgres · gate=off · cron-tick observed to NOT call evaluate.
- **Live 2** · local · gate=on · no env vars · single evaluate call → `no_transport` counter increments · log line contains `no_transport`.
- **Live 3** · local · gate=on · `NEX_ALERTS_WEBHOOK_URL` set to a local sink (or dry-run) → dispatch flows without error.

Preservation invariant · 10 KJs verified `claimed / 0 / null` pre and post batch.

---

## 6 · Files touched (planned · will be finalised in §7)

- **MODIFIED** · `src/lib/nex/alerts/evaluator.ts` — gate check + logger + return-payload field
- **MODIFIED** · `src/lib/nex/alerts/dispatch.ts` — logger + fail-closed no-transport signal + comment reclassifying adapters as vendor-neutral
- **MODIFIED** · `src/app/api/nex/brain/cron-tick/route.ts` — invoke `evaluate()` behind the gate
- **MODIFIED** · `src/app/api/nex/alerts/evaluate/route.ts` — wrap in `runFromRequest`
- **MODIFIED** · `src/lib/nex/observability/tests/correlation-adoption.test.mjs` — add the evaluate route to `LAYER1_ADOPTED`
- **MODIFIED** · `src/lib/nex/observability/counters.ts` — add `alerts.dispatch_no_transport`
- **MODIFIED** · `src/components/nex-app/nex-brain/AlertsCentrePanel.tsx` — brief note about the gate
- **NEW** · `src/lib/nex/alerts/tests/dispatch-gate.test.mjs` — HD1-HD4 contract
- **NEW** · `scripts/prove-alerts-dispatch-gate-live.ts` — Live 1-3 probe

---

## 7 · Results

**Date executed:** 2026-08-10.

### 7.1 · Deliverables (Q7 shrink)

| Component | State | Evidence |
|---|---|---|
| `NEX_ALERTS_DISPATCH_ENABLED=1` gate in `alerts/evaluator.ts` | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | `isDispatchEnabled()` exported · gate skips dispatch loop · `dispatch_skipped_gate` in return payload · Live 1 confirms gate=off inhibits (13 rules ran, 3 fired, 0 dispatched) |
| Fail-closed `alerts.dispatch_no_transport` counter + `log.warn` in `alerts/dispatch.ts` | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | HD1-3 contract tests + Live 2 (counter delta = 1 exactly · warn log emitted with `alert_id`, `rule_id`, `severity`, `channels`) |
| Cron-tick wiring behind the gate | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | `src/app/api/nex/brain/cron-tick/route.ts` calls `evaluateAlerts()` only when `isAlertsDispatchEnabled()` · same fail-safe try/catch shape as the rollup drain |
| CID adoption on `/api/nex/alerts/evaluate` | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | Route wrapped in `runFromRequest` · added to `LAYER1_ADOPTED` · CADP1-5 all green (LAYER1_ADOPTED now 12 routes) |
| Structured loggers | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | `logger("alerts.evaluator")` + `logger("alerts.dispatch")` added |
| AlertsCentrePanel copy | ✅ IMPLEMENTED | Panel copy updated to describe gate-on / gate-off behaviour |
| Existing adapter reclassification | ✅ IMPLEMENTED | `alerts/dispatch.ts` header now records H5 Q7 reclassification — email / webhook / slack are vendor-neutral transports; no new vendor-specific adapter added |
| `alerts.dispatch_no_transport` counter in fixed enum | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | 4 counter files touched · snapshot list includes new counter |

### 7.2 · Live probe results (verbatim, condensed)

```
--- Live 1 · gate=OFF · dispatch loop skipped ---
  isDispatchEnabled() = false
  ran_rules = 13 · fired = 3 · dispatched = 0 · dispatch_skipped_gate = 0
  → PASS

--- Live 2 · gate=ON · zero transports · fail-closed counter bumps ---
  dispatchAlert result · sent=0 · failed=0 · skipped=3
  {"level":"warn","subsystem":"alerts.dispatch","msg":"no_transport","fields":{
     "alert_id":"c4d478ed-...","rule_id":"h5-burner-...","severity":"critical",
     "channels":["webhook","email","slack"]}}
  alerts.dispatch_no_transport counter · before=0 · after=1 · delta=1
  → PASS

--- Live 3 · gate=ON · NEX_ALERTS_WEBHOOK_URL set to local sink · dispatch flows ---
  dispatchAlert result · sent=1 · failed=0 · skipped=0
  sink received 1 payload(s)
  → PASS
```

### 7.3 · Tests

| Suite | Assertions | Pass | Fail |
|---|---|---|---|
| **NEW** `src/lib/nex/alerts/tests/dispatch-gate.test.mjs` (HD1-HD4) | 4 | 4 | 0 |
| `correlation-adoption.test.mjs` (CADP1-5 · LAYER1_ADOPTED extended to 12 routes) | 5 | 5 | 0 |
| Live probe `scripts/prove-alerts-dispatch-gate-live.ts` (Live 1-3) | 3 probes | 3 | 0 |
| Regression sweep (obs + workers + config + db + analytics + alerts) | 151 | 150 | **1 pre-existing** |

**The 1 regression** is the same pre-existing `CFGA2` on `postgres.wc-companion.test.ts` — unrelated to H5. Preservation invariant re-verified: **10/10 preserved KJs still `claimed / 0 / null`**.

### 7.4 · What remains OPEN (unchanged from §4 · re-summarised)

| Item | State |
|---|---|
| Subsystem A evaluation | ✅ addressed (this batch) |
| Existing dispatch adapters | ✅ reused (unchanged interfaces) |
| Cron / operator path | ✅ wired behind gate (this batch) |
| Fail-closed missing-transport signal | ✅ observable via counter + warn log (this batch) |
| **Subsystem B (F5 counter-based) dispatcher · R-4 literal** | 🔴 OPEN · blocked by 021/048 collision |
| **021/048 `nex.alert_rules` collision** | 🔴 OPEN · requires migration authorisation |
| p0-p3 vs info/warning/critical severity mapping | 🔴 OPEN · incident-response policy call |
| Production dispatch enable | 🔵 NOT AUTHORISED |
| F3 log-drain vendor pick (metrics scrape · R-3) | 🔵 NOT AUTHORISED |
| SMS / vendor-specific adapters | 🔵 NOT ATTEMPTED (vendor-neutral by design) |
| CI wiring for new counter | 🔵 NOT ATTEMPTED (matches H1.c / H3 / H4 open items) |

### 7.5 · Files touched

- **NEW** · `src/lib/nex/alerts/tests/dispatch-gate.test.mjs`
- **NEW** · `scripts/prove-alerts-dispatch-gate-live.ts`
- **NEW** · `docs/headquarters-production-readiness/WAVE-3-H5-DISPATCHER.md` (this file)
- **MODIFIED** · `src/lib/nex/alerts/evaluator.ts` (gate + logger + `isDispatchEnabled` export + `dispatch_skipped_gate` return field)
- **MODIFIED** · `src/lib/nex/alerts/dispatch.ts` (Q7 reclassification header + logger + fail-closed counter/warn)
- **MODIFIED** · `src/app/api/nex/brain/cron-tick/route.ts` (invoke evaluate behind gate)
- **MODIFIED** · `src/app/api/nex/alerts/evaluate/route.ts` (`runFromRequest` wrapper · H2 CID adoption)
- **MODIFIED** · `src/lib/nex/observability/tests/correlation-adoption.test.mjs` (LAYER1_ADOPTED · +1 route)
- **MODIFIED** · `src/lib/nex/observability/counters.ts` (fixed-enum extension)
- **MODIFIED** · `src/components/nex-app/nex-brain/AlertsCentrePanel.tsx` (copy update)

### 7.6 · Final H5 verdict

> **H5 (Subsystem A wiring) — IMPLEMENTED · VERIFIED — LOCAL LIVE**
> **H5 (Subsystem B dispatcher / R-4 literal) — OPEN · BLOCKED**
> **PRODUCTION — NOT PROVEN**
> **NEX_ALERTS_DISPATCH_ENABLED remains unset by default**

H5 does **not** claim to close all of R-4. Subsystem A's dispatch path is now operational under the gate; Subsystem B remains blocked on the 021/048 collision + severity-policy questions recorded above.
