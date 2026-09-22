# 03 · Rollback Procedure

**Founder-authored governance artefact · 2026-09-22**

If any row of the prediction → observation table is DIVERGE or UNKNOWN, the correct response is to **un-flip that gate immediately**. This document defines the exact steps.

## Governing principles

1. **Rollback is always safe.** Every gate is designed to return to dormant instantly by unsetting an env var. There is no data-migration rollback burden.
2. **The standing marketing status line does NOT change during rollback.** It only ever changes forward when Stage-6 evidence is met — never backward on rollback. If a gate rolls back before ever reaching Stage 6, no line change was needed and none happens now.
3. **Residue is expected to be zero by design, but verify.** Every persistent side-effect during a partial cycle must be traceable to real evidence. Nothing is deleted on rollback — divergent evidence is preserved for forensic investigation.
4. **Rollback is never itself a fix.** After rollback, investigate the divergence, correct the code or the environment, and re-attempt from Stage 1. Do not re-flip the gate to "see if it works this time."

---

## Gate #1 · Production PageFetcher · rollback

### Step 1 · Un-flip

```bash
unset NEX_PAGE_FETCHER_ACTIVATION
# or, if the deployment uses a config file, remove the row and redeploy
```

### Step 2 · Verify dormancy

```bash
# Any subsequent fetch attempt should return blocked_by_governance
# (dev/preview only · never against a real host without Founder authorisation)
```

Query readiness aggregator:

```
GET /api/nex/founder/marketing/sending-safety-readiness
```

Expect `report.overall_state` to remain `"dormant"` or `"missing"` — never `"ready"` post-rollback.

### Step 3 · Residue check

```sql
-- Any evidence row added during the bounded window?
SELECT source_url, evidence_kind, LEFT(evidence_snippet, 80) AS snippet, created_at
  FROM nex.discovery_business_evidence
 WHERE created_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT'
 ORDER BY created_at DESC;

-- Any entity update during the bounded window?
SELECT entity_id, state, updated_at
  FROM nex.discovery_entity
 WHERE updated_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT';
```

**Do NOT delete these rows.** They are forensic evidence of what happened. If they contradict prediction, they inform the next code change.

### Step 4 · Standing line

Standing marketing status line remains verbatim:
`NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.`

No update.

---

## Gate #2 · Continuous crawler · rollback

### Step 1 · Un-flip

```bash
unset NEX_DISCOVERY_CRON_ACTIVATION
# Also disable the deployment scheduler if it was armed:
#   (Vercel Cron: remove the job from vercel.json and redeploy)
#   (external cron: comment out the cronline)
```

### Step 2 · Verify dormancy

```bash
curl https://<deployment>/api/cron/nex-continuous-tick
# Expect: HTTP 503 · body { "ok": false, "state": "endpoint_dormant", "note": "..." }
```

### Step 3 · Residue check

```sql
-- Tick rows written during the bounded window (should equal what was authorised)
SELECT tick_seq, worker_id, minute_bucket, outcome, planned_countries, created_at
  FROM nex.discovery_orchestrator_tick
 WHERE created_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT'
 ORDER BY tick_seq DESC;

-- Any country left in 'crawling' state that never completed?
SELECT dcs.iso_alpha_2, dcs.status, dcs.claim_at, dcs.claim_expires_at
  FROM nex.discovery_country_state dcs
 WHERE dcs.status = 'crawling'
   AND dcs.claim_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT';
```

Stalled claims are self-healing via the reaper — they will be marked idle after the 10-minute stall threshold OR when the next tick fires (whichever comes first, and only if the gate is re-enabled). This is by design.

**Do NOT manually reset country states.** The reaper is the correct actor.

### Step 4 · Standing line · no change.

---

## Gate #3 · Production DomainAuthChecker · rollback

### Step 1 · Un-flip

```bash
unset NEX_DOMAIN_AUTH_CHECKER_ACTIVATION
```

### Step 2 · Verify dormancy

```bash
curl https://<deployment>/api/cron/nex-domain-auth-refresh
# Expect: HTTP 503 · body { "ok": false, "state": "endpoint_dormant", "note": "..." }
```

### Step 3 · Residue check

```sql
-- Any domain_auth row updated during the bounded window
SELECT sending_domain, spf_status, dkim_status, dmarc_status,
       check_source, last_verified_at
  FROM nex.marketing_sender_domain_auth
 WHERE last_verified_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT';

-- If check_source='node-dns-txt' rows exist for domains other than the bounded target, investigate
SELECT sending_domain, last_verified_at
  FROM nex.marketing_sender_domain_auth
 WHERE check_source = 'node-dns-txt'
   AND last_verified_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT'
   AND sending_domain != 'TARGET_DOMAIN';
-- Expected: 0
```

**Do NOT delete or overwrite these rows.** If a row shows `spf_status='pass'` where DNS shows no `v=spf1`, that row is forensic proof of a checker bug and must be preserved.

### Step 4 · Standing line · no change.

---

## Gate #4 · Authenticated webhook · rollback

### Step 1 · Un-flip

```bash
unset NEX_WEBHOOK_ENDPOINTS_ACTIVATION
# AND also unset the per-provider secret to ensure double-gate:
unset NEX_RESEND_WEBHOOK_SECRET
```

Additionally: revoke the webhook subscription at the provider's dashboard so the provider stops POSTing.

### Step 2 · Verify dormancy

```bash
curl -X POST https://<deployment>/api/webhooks/resend
# Expect: HTTP 503 · body { "ok": false, "result": { "kind": "endpoint_dormant", ... } }
```

### Step 3 · Residue check

```sql
-- Bounce log rows written during the bounded window
SELECT event_id, esp, classifier_kind, event_fingerprint, received_at
  FROM nex.marketing_bounce_log
 WHERE received_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT'
 ORDER BY received_at DESC;

-- Contact suppression cascade side-effects
SELECT email, hard_bounced, opt_out, opt_out_reason, opt_out_at, complaint_count
  FROM nex.marketing_contact
 WHERE opt_out_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT'
    OR (hard_bounced = TRUE AND opt_out_at IS NOT NULL);

-- Opt-out rows created
SELECT email, reason, channel, first_recorded_at
  FROM nex.marketing_opt_out
 WHERE first_recorded_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT';

-- Reputation rows recomputed
SELECT sender_id, reputation_state, computed_at
  FROM nex.marketing_sender_reputation
 WHERE computed_at BETWEEN 'FLIP_STARTED_AT' AND 'FLIP_ENDED_AT';
```

**Contact suppressions are one-way by design.** A contact marked `hard_bounced=TRUE` during the flip stays that way. This is correct behaviour — hard-bounced addresses are non-deliverable regardless of gate state. Do not reverse.

Only investigate if:

- A suppression landed on a contact whose email was NOT the target recipient of the test event (targeting error)
- A `hard_bounced=TRUE` contact was flipped back to FALSE anywhere during or after the flip (one-way cascade broken — severe)
- Bounce_log rows appear for `esp` other than the one bounded provider (per-provider gate broken)

### Step 4 · Standing line · no change.

---

## The "un-flip is not a fix" clause

After any rollback, before re-attempting the gate, the following must all be true:

- [ ] Root cause of divergence identified (code bug, environment misconfiguration, unexpected upstream provider behaviour, or predicted-behaviour mistake in the runbook)
- [ ] Fix applied (code change · runbook revision · env correction)
- [ ] Every affected test updated to reflect the corrected prediction
- [ ] Test suite passes at the new prediction
- [ ] New baseline audit (BEFORE snapshot) recorded
- [ ] Founder re-authorises the flip explicitly

Nothing shortens this. There is no "just try again — the divergence was probably a fluke" path. Fluke-shaped divergences at gate transitions have historically been the tip of an invariant violation. Treat every DIVERGE as if it were.

---

## Universal residue-cleanup policy

**Nothing gets deleted on rollback.** Every row written during a failed flip is:

1. Real evidence · treated with the same integrity as any other evidence row
2. Forensic material · preserves the divergence for investigation
3. Sometimes still-correct data · a legitimately hard-bounced contact stays hard-bounced regardless of whether the gate that recorded it later rolled back

The rollback objective is to return the **gates** to dormant, not to undo the **evidence**. The evidence is truth even when the gate should not have been open.
