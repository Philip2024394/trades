# 02 · Pre/Post-Flip Audit SQL

**Founder-authored governance artefact · 2026-09-22**

Every query below is read-only. Nothing here mutates state. Every one populates one row of the prediction → observation table.

Convention:

- Every gate has a **BEFORE** snapshot (run in the last 60 seconds before the flip)
- Every gate has an **AFTER** snapshot (run in the first 60 seconds after the bounded cycle completes)
- Every observation is the **delta** between BEFORE and AFTER

The word `TARGET_*` in a query is a placeholder — Founder substitutes the concrete scope before running.

---

## Universal · gate state (all gates)

```sql
-- Env-var presence (run from a shell on the deployment box):
--   echo "NEX_PAGE_FETCHER_ACTIVATION=$NEX_PAGE_FETCHER_ACTIVATION"
--   echo "NEX_DISCOVERY_CRON_ACTIVATION=$NEX_DISCOVERY_CRON_ACTIVATION"
--   echo "NEX_DOMAIN_AUTH_CHECKER_ACTIVATION=$NEX_DOMAIN_AUTH_CHECKER_ACTIVATION"
--   echo "NEX_WEBHOOK_ENDPOINTS_ACTIVATION=$NEX_WEBHOOK_ENDPOINTS_ACTIVATION"

-- Alternative · call the readiness aggregator (Session-9):
--   GET /api/nex/founder/marketing/sending-safety-readiness
--   Compare `report.gates` and `report.verifiers[].secret_configured` between BEFORE and AFTER.
```

---

## Gate #1 · Production PageFetcher · audit SQL

Note: `PageFetcher` itself does not persist rows. Auditing this gate means auditing the DOWNSTREAM effects if a walker cycle was allowed.

### BEFORE

```sql
-- Baseline: what evidence exists right now?
SELECT
  (SELECT COUNT(*) FROM nex.discovery_business_evidence) AS evidence_rows_total,
  (SELECT COUNT(*) FROM nex.discovery_entity) AS entity_rows_total,
  (SELECT MAX(created_at) FROM nex.discovery_business_evidence) AS most_recent_evidence,
  (SELECT MAX(updated_at) FROM nex.discovery_entity) AS most_recent_entity_update;
```

### AFTER (immediately following the ONE bounded fetch)

```sql
-- Delta from BEFORE
SELECT
  (SELECT COUNT(*) FROM nex.discovery_business_evidence) AS evidence_rows_total,
  (SELECT COUNT(*) FROM nex.discovery_entity) AS entity_rows_total,
  (SELECT MAX(created_at) FROM nex.discovery_business_evidence) AS most_recent_evidence;

-- New evidence rows added in the last 60 seconds (should be 0 for the pure-fetch stage · non-zero only if a walker cycle was authorised)
SELECT source_url, evidence_kind, LEFT(evidence_snippet, 100) AS snippet, created_at
  FROM nex.discovery_business_evidence
 WHERE created_at >= now() - INTERVAL '60 seconds'
 ORDER BY created_at DESC;

-- Any evidence row whose source_url host is NOT on the allowlist? (this should be 0 · fabrication check)
-- Compare source_url host against the allowlist file (external inspection):
SELECT source_url, created_at
  FROM nex.discovery_business_evidence
 WHERE created_at >= now() - INTERVAL '60 seconds';
-- Then in shell: for each source_url, verify hostname appears in data/nex-page-fetcher-allowlist.json
```

### Prediction → observation table for Gate #1

| Property | Test prediction | Real observation (fill in) | Match |
|---|---|---|---|
| Gate state | `NEX_PAGE_FETCHER_ACTIVATION=on` | | |
| External action | exactly 1 HTTP request to allowlisted host | | |
| Evidence row | 0 (pure fetch · no walker) OR 1 (if walker bounded to one URL) | | |
| Duplicate event | rate_limited on immediate 2nd fetch | | |
| Suppression | N/A for this gate | N/A | ✓ |
| Reputation | N/A for this gate | N/A | ✓ |
| Fabrication | 0 evidence rows from non-allowlisted hosts | | |
| Unexpected traffic | 0 HTTP fetches outside the allowlist | | |
| Gate enforcement | `NULL_FETCHER` still module default (verified via `production-page-fetcher.test.ts` G2) | | |

---

## Gate #2 · Continuous crawler · audit SQL

### BEFORE

```sql
SELECT COUNT(*) AS ticks_total,
       COUNT(*) FILTER (WHERE minute_bucket >= date_trunc('minute', now())) AS ticks_this_minute,
       MAX(created_at) AS most_recent_tick
  FROM nex.discovery_orchestrator_tick;

SELECT COUNT(*) AS active_leases,
       COUNT(*) FILTER (WHERE status = 'crawling') AS crawling_now
  FROM nex.discovery_country_state
 WHERE claim_expires_at > now();
```

### AFTER (immediately following the ONE manual tick)

```sql
-- Exactly one new tick row expected
SELECT tick_seq, worker_id, minute_bucket, outcome, planned_countries, saturation, ms
  FROM nex.discovery_orchestrator_tick
 WHERE created_at >= now() - INTERVAL '60 seconds'
 ORDER BY tick_seq DESC;

-- Idempotency: second POST with same worker_id + minute_bucket should return the SAME tick_seq
-- (compare tick_seq before and after second POST)

-- Reaper action: how many stalled cycles cleaned?
SELECT COUNT(*) FILTER (WHERE reaped_at >= now() - INTERVAL '60 seconds') AS just_reaped
  FROM nex.discovery_cycle;

-- Two-clock discipline check: any country planned within its cadence_seconds window?
SELECT dcs.iso_alpha_2, dcs.status, dcs.claim_at, wc.cadence_seconds
  FROM nex.discovery_country_state dcs
  JOIN nex.discovery_programme_country dpc USING (programme_id, iso_alpha_2)
  JOIN nex.world_country wc USING (iso_alpha_2)
 WHERE dcs.claim_at >= now() - INTERVAL '60 seconds'
   AND dcs.claim_at - dcs.last_completed_at < make_interval(secs => wc.cadence_seconds);
-- Expected: 0 rows (any row is a two-clock violation)
```

### Prediction → observation table for Gate #2

| Property | Test prediction | Real observation | Match |
|---|---|---|---|
| Gate state | `NEX_DISCOVERY_CRON_ACTIVATION=on` | | |
| External action | exactly 1 POST to `/api/cron/nex-continuous-tick` | | |
| Evidence row | exactly 1 new row in `discovery_orchestrator_tick` | | |
| Duplicate event | 2nd immediate tick same worker+minute → same `tick_seq` returned | | |
| Suppression | N/A for this gate | N/A | ✓ |
| Reputation | N/A for this gate | N/A | ✓ |
| Fabrication | 0 rows in `discovery_cycle` with `worker_id` NOT matching this tick | | |
| Unexpected traffic | 0 HTTP fetches to hosts outside Gate #1 allowlist | | |
| Gate enforcement | Two-clock discipline: 0 countries planned within cadence_seconds | | |

---

## Gate #3 · Production DomainAuthChecker · audit SQL

### BEFORE

```sql
SELECT sending_domain, spf_status, dkim_status, dmarc_status,
       check_source, last_verified_at
  FROM nex.marketing_sender_domain_auth
 WHERE sending_domain = 'TARGET_DOMAIN';
```

### AFTER (immediately following the ONE refresh)

```sql
-- Same row · check_source must be 'node-dns-txt', last_verified_at bumped
SELECT sending_domain, spf_status, spf_record, dkim_status, dkim_selector,
       dmarc_status, dmarc_policy, dmarc_pct,
       aligned, check_source, check_method,
       last_verified_at, last_check_error
  FROM nex.marketing_sender_domain_auth
 WHERE sending_domain = 'TARGET_DOMAIN';

-- No 'pass' where the TXT record doesn't exist (fabrication check)
-- External verification: dig +short TXT TARGET_DOMAIN | grep 'v=spf1'
-- Compare against the DB row's spf_status.

-- Any row for a domain that was NOT the target of the refresh?
SELECT sending_domain, last_verified_at
  FROM nex.marketing_sender_domain_auth
 WHERE last_verified_at >= now() - INTERVAL '60 seconds'
   AND sending_domain != 'TARGET_DOMAIN';
-- Expected: 0 rows (scope was bounded to one domain)
```

### Prediction → observation table for Gate #3

| Property | Test prediction | Real observation | Match |
|---|---|---|---|
| Gate state | `NEX_DOMAIN_AUTH_CHECKER_ACTIVATION=on` | | |
| External action | 1 DNS resolution pass for TARGET_DOMAIN (SPF + DKIM selectors + DMARC) | | |
| Evidence row | exactly 1 updated row for TARGET_DOMAIN · `check_source="node-dns-txt"` | | |
| Duplicate event | 2nd immediate refresh → row updated again · state same | | |
| Suppression | N/A for this gate | N/A | ✓ |
| Reputation | reputation for senders using this domain may reclassify (visible via `/api/nex/founder/marketing/deliverability`) | | |
| Fabrication | 0 rows report `spf_status=pass` where `dig` shows no `v=spf1` | | |
| Unexpected traffic | 0 HTTP fetches (DNS only) · 0 rows for non-target domains | | |
| Gate enforcement | `NULL_DOMAIN_CHECKER` still module default (verified via `dns-domain-auth-checker.test.ts` F2) | | |

---

## Gate #4 · Authenticated webhook (single provider) · audit SQL

### BEFORE (recommend for provider `resend` first)

```sql
-- Baseline: how many events already recorded for this provider?
SELECT COUNT(*) AS events_total_before,
       COUNT(*) FILTER (WHERE classifier_kind = 'hard_bounce') AS hard_bounces_before,
       MAX(received_at) AS most_recent_before
  FROM nex.marketing_bounce_log
 WHERE esp = 'resend';

-- Contact state before (target recipient)
SELECT email, hard_bounced, opt_out, opt_out_reason, opt_out_at, complaint_count
  FROM nex.marketing_contact
 WHERE LOWER(email) = LOWER('TARGET_RECIPIENT');
```

### AFTER (immediately following the ONE signed test event)

```sql
-- Exactly one new bounce_log row from this provider expected
SELECT event_id, esp, esp_message_id, event_type, bounce_type,
       classifier_kind, classifier_matched_signal, classifier_reason,
       event_fingerprint, received_at
  FROM nex.marketing_bounce_log
 WHERE esp = 'resend'
   AND received_at >= now() - INTERVAL '5 minutes'
 ORDER BY received_at DESC;

-- Contact suppression cascade
SELECT email, hard_bounced, opt_out, opt_out_reason, opt_out_at, complaint_count
  FROM nex.marketing_contact
 WHERE LOWER(email) = LOWER('TARGET_RECIPIENT');
-- For a hard_bounce test event, expected: hard_bounced=TRUE, opt_out=TRUE, opt_out_reason='hard_bounce'

-- Opt-out row created
SELECT email, reason, channel, metadata->>'source_event_id' AS source_event_id
  FROM nex.marketing_opt_out
 WHERE LOWER(email) = LOWER('TARGET_RECIPIENT');

-- Reputation recompute (only if provider_message_id correlates to a real send_log row)
SELECT sender_id, reputation_state, bounces_24h, complaints_24h, computed_at
  FROM nex.marketing_sender_reputation
 WHERE computed_at >= now() - INTERVAL '5 minutes';

-- Idempotency check: replay the same signed body · should NOT create a new row
-- (send the same POST body a second time via curl · re-run the first query above · row count must NOT increase)

-- Tamper check: alter one byte in the body · signature must fail · no row must be created

-- Any event recorded for a provider OTHER than resend during this window?
SELECT esp, COUNT(*)
  FROM nex.marketing_bounce_log
 WHERE received_at >= now() - INTERVAL '5 minutes'
   AND esp != 'resend'
 GROUP BY esp;
-- Expected: 0 rows

-- Cascade reversal check (must always be 0)
SELECT email, hard_bounced, opt_out
  FROM nex.marketing_contact
 WHERE hard_bounced = FALSE
   AND opt_out = FALSE
   AND email IN (SELECT email FROM nex.marketing_opt_out);
-- Expected: 0 rows (any row here means a hard_bounced=TRUE contact was un-suppressed · one-way cascade broken)
```

### Prediction → observation table for Gate #4

| Property | Test prediction | Real observation | Match |
|---|---|---|---|
| Gate state | `NEX_WEBHOOK_ENDPOINTS_ACTIVATION=on` AND `NEX_RESEND_WEBHOOK_SECRET` set | | |
| External action | exactly 1 signed POST from Resend | | |
| Evidence row | exactly 1 new `marketing_bounce_log` row · `esp="resend"` · `classifier_kind="hard_bounce"` · `event_fingerprint` set | | |
| Duplicate event | 2nd identical POST → 202 with `kind:"already_recorded"` · no new row | | |
| Suppression | `marketing_contact` cascade: `hard_bounced=TRUE` · `opt_out=TRUE` · `opt_out_reason="hard_bounce"` · `marketing_opt_out` row created | | |
| Reputation | if correlated: new row in `marketing_sender_reputation` · else no row and result reports `reputation_recomputed:false` | | |
| Fabrication | 0 rows in `bounce_log` for `esp != "resend"` in this window | | |
| Unexpected traffic | POST to `/api/webhooks/sendgrid` returns 503 (secret dormant) | | |
| Gate enforcement | tampered POST returns 401 · zero rows written · one-way cascade holds (0 rows where hard_bounced=TRUE flipped back to FALSE) | | |

---

## Universal post-flip checks

Regardless of which gate was flipped:

```sql
-- Every recorder event must have a fingerprint (idempotency invariant)
SELECT COUNT(*) FROM nex.marketing_bounce_log
 WHERE received_at >= now() - INTERVAL '5 minutes'
   AND event_fingerprint IS NULL;
-- Expected: 0

-- Every recorder event must have a classifier_kind (never NULL post-Session-7)
SELECT COUNT(*) FROM nex.marketing_bounce_log
 WHERE received_at >= now() - INTERVAL '5 minutes'
   AND classifier_kind IS NULL;
-- Expected: 0

-- No opt_out_at before opt_out=TRUE (cascade consistency)
SELECT COUNT(*) FROM nex.marketing_contact
 WHERE opt_out = FALSE
   AND opt_out_at IS NOT NULL;
-- Expected: 0
```

---

## What "MATCH" means in the observation table

- **✓ MATCH**: observed value equals or subsumes prediction (e.g., prediction=`0`, observed=`0` → ✓)
- **✗ DIVERGE**: observed value differs from prediction in any way, including "seemingly benign" surplus rows or unexpected null → **un-flip** per §01 rules
- **? UNKNOWN**: observed value could not be measured — treat as DIVERGE for governance purposes (do not proceed)

If any single row of the table is DIVERGE or UNKNOWN, the entire flip is DIVERGE. Never partial-pass.
