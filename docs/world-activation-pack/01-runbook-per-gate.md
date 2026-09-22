# 01 · First-Real-Cycle Runbook · Per Gate

**Founder-authored governance artefact · 2026-09-22**

One runbook per gate. Executed in strict sequence — no gate advances until the previous has reached Stage 6.

For each gate below, the runbook has the same shape:

- **Preconditions** — must all be TRUE before the flip
- **Founder action** — the exact env-var / file operation
- **Bounded scope** — the smallest possible first cycle
- **Expected observables** — what tests predicted
- **Timing bounds** — how long the cycle should take
- **Abort-if** — conditions that trigger immediate rollback

---

## Gate #1 · Production PageFetcher · first-real-cycle runbook

### Preconditions

- [ ] `data/nex-page-fetcher-allowlist.json` reviewed · signed_by=founder · signed_at set · only intentionally-vetted hosts present
- [ ] `NEX_PAGE_FETCHER_ACTIVATION` is unset or ≠ `"on"` (starting from dormant)
- [ ] `NULL_FETCHER` verified as module default via test G2 in `production-page-fetcher.test.ts`
- [ ] Robots checker chosen and injected (production should use a real robots parser, not the default allow-all)
- [ ] Baseline audit run (see `02-audit-sql.md · §1`) — record before-state

### Founder action

```bash
# ONE bounded scope · fetch a single URL against a single allowlisted host
export NEX_PAGE_FETCHER_ACTIVATION=on

# Invoke the fetcher once via a Founder-only preview API OR a bounded script
# (implementation choice · not part of this pack)
```

Restrict the first invocation to **one specific URL** on **one allowlisted host**. Not a full walker cycle. Not multiple pages.

### Bounded scope

- Host: single entry from allowlist (recommended: `www.robotstxt.org` — smallest possible)
- URL: single path (recommended: `https://www.robotstxt.org/robotstxt.html`)
- Politeness: only one fetch — min_interval is not yet exercised
- Duration cap: 15 seconds hard timeout

### Expected observables

| Property | Prediction |
|---|---|
| Endpoint HTTP call count | exactly 1 · to the allowlisted host only |
| Fetch result `kind` | `responded` (or `responded_zero` if body empty) |
| `status_code` | 200 |
| `url_final` host | same as request host |
| `bytes` | ≤ `max_bytes` in allowlist row |
| DB writes from PageFetcher itself | 0 (fetcher does not persist) |
| Any fetch to a non-allowlisted host | 0 |
| Politeness `last_fetch_at_ms` map | contains 1 entry for the fetched host |

### Timing bounds

- fetch completion: < 5s under normal network conditions · < 15s hard cap
- follow-up second fetch to same host attempted immediately: must return `rate_limited` (proves politeness is enforced live)

### Abort-if

- Fetch returns `blocked_by_governance` when it shouldn't → allowlist file or env var not what expected → **un-flip**
- Fetch returns `responded` from a host **not** in the allowlist → invariant broken → **un-flip immediately** + investigate before any further flip
- Any DB row appears in `discovery_business_evidence` or `discovery_entity` during this test → out of scope for this stage → **un-flip**
- Follow-up rapid fetch does NOT return `rate_limited` → politeness gate broken → **un-flip**
- Fetch redirects to a non-allowlisted host and returns `responded` (should be `blocked_by_governance`) → redirect gate broken → **un-flip immediately**

### Stage progression

- Stage 3 · one URL fetched, one `responded` result
- Stage 4 · optional next: run a bounded walker cycle limited to one entity URL, verify one row lands in `discovery_business_evidence` if evidence exists; verify zero rows land otherwise
- Stage 5 · not applicable to PageFetcher directly (no feedback loop) · move to Gate #2
- Stage 6 · N=10 cycles across the same allowlisted host over 24-hour window · zero blocked/robots-denied cycles diverge from prediction

---

## Gate #2 · Continuous crawler activation · first-real-cycle runbook

### Preconditions

- [ ] Gate #1 has reached Stage 6 for at least one host
- [ ] `NEX_DISCOVERY_CRON_ACTIVATION` is unset or ≠ `"on"`
- [ ] Deployment scheduler configured but **not yet triggered**
- [ ] `nex.discovery_orchestrator_tick` table exists and has zero rows for the target minute_bucket
- [ ] At least one country in scope has been quiet longer than its `cadence_seconds`

### Founder action

```bash
export NEX_DISCOVERY_CRON_ACTIVATION=on

# Trigger ONE tick manually (not scheduler yet):
curl -X POST -H "x-worker-id: founder-first-tick" \
     https://<deployment>/api/cron/nex-continuous-tick
```

### Bounded scope

- Exactly one tick — not the scheduler on cadence yet
- Worker ID: unique first-tick worker id (`founder-first-tick`)
- Countries permitted: whatever the orchestrator plans within its bounded `max_countries_per_tick`

### Expected observables

| Property | Prediction |
|---|---|
| HTTP response | 200 · body has `{ok:true, state:"active", tick, reap}` |
| New rows in `nex.discovery_orchestrator_tick` | exactly 1 |
| Tick `outcome` | one of `partial` / `no_work` / `superseded` |
| `nex.discovery_country_state` rows updated | ≥0 · every update is a `claim_at` write for a country within cadence |
| Reaper rows cleaned | 0 for a fresh flip · non-zero only if prior stalled state exists |
| Any real HTTP fetch outside of Gate #1 allowlist | 0 |
| A second immediate tick with same worker_id + minute_bucket | returns existing row (idempotency) |

### Timing bounds

- Tick completion: < 5 seconds
- Reaper phase: < 500ms unless clean-up work exists

### Abort-if

- Second tick creates a new row for the same worker+minute → idempotency broken → **un-flip**
- Any fetch occurs to a host outside Gate #1 allowlist → cross-gate leak → **un-flip immediately**
- Tick outcome is `error` and detail indicates a governance boundary crossed → **un-flip**
- Orchestrator plans a country within its cadence_seconds window (two-clock discipline violated) → **un-flip**

### Stage progression

- Stage 3 · one manual tick returns `active`
- Stage 4 · one row in `discovery_orchestrator_tick`
- Stage 5 · a second manual tick idempotency-returns the same row
- Stage 6 · scheduler configured to fire every 5 minutes for N=12 ticks (1 hour) with zero divergence

---

## Gate #3 · Production DomainAuthChecker · first-real-cycle runbook

### Preconditions

- [ ] Gate #2 has reached Stage 6
- [ ] `NEX_DOMAIN_AUTH_CHECKER_ACTIVATION` is unset or ≠ `"on"`
- [ ] `nex.marketing_sender_domain_auth` has at least one row with `sending_domain` set (recommended: seed with the Founder's own owned domain)
- [ ] DNS reachability from the deployment verified (a `dig` from the deployment against `1.1.1.1` returns TXT for the target domain)

### Founder action

```bash
export NEX_DOMAIN_AUTH_CHECKER_ACTIVATION=on

# Trigger ONE refresh manually:
curl -X POST https://<deployment>/api/cron/nex-domain-auth-refresh
```

### Bounded scope

- Exactly one domain — recommended: Founder's own sending domain
- One DNS query pass (SPF + DKIM selectors + DMARC)

### Expected observables

| Property | Prediction |
|---|---|
| HTTP response | 200 · body has `{ok:true, state:"active", refreshed:1, results:[…]}` |
| `nex.marketing_sender_domain_auth` row updated | `check_source="node-dns-txt"` · `last_verified_at` set to now |
| SPF status | one of `pass`/`soft_fail`/`hard_fail`/`missing`/`permerror` · NEVER `unknown` unless network failed |
| DKIM status | one of `pass`/`fail`/`missing`/`no_signature` |
| DMARC status | one of `pass`/`reject_policy`/`quarantine_policy`/`none_policy`/`missing`/`fail` |
| Any state = `pass` when TXT record does NOT exist | 0 |
| Any HTTP fetch made | 0 (DNS only) |

### Timing bounds

- Refresh completion for one domain: < 15 seconds (13 DKIM selectors × 3s timeout worst case)

### Abort-if

- Any row reports `spf_status=pass` for a domain whose TXT record does not contain `v=spf1` → fabrication → **un-flip immediately** + investigate
- `check_source` is not `node-dns-txt` → wrong checker injected → **un-flip**
- Refresh makes an HTTP call to fetch the SNS signing cert (SES-SNS-adjacent code path) → boundary crossed → **un-flip immediately**
- `NULL_DOMAIN_CHECKER` is now the effective default in code inspection (module reassignment) → boundary crossed → **un-flip**

### Stage progression

- Stage 3 · one refresh returns `active`
- Stage 4 · one row updated in `marketing_sender_domain_auth`
- Stage 5 · classifyReputation for the sender using this domain now factors in the auth state (verifiable via `/api/nex/founder/marketing/deliverability`)
- Stage 6 · scheduler runs domain refresh every N hours across N=5 domains with zero fabrication

---

## Gate #4 · Authenticated provider webhook · first-real-cycle runbook

### Preconditions

- [ ] Gate #3 has reached Stage 6
- [ ] `NEX_WEBHOOK_ENDPOINTS_ACTIVATION` is unset or ≠ `"on"`
- [ ] Only ONE provider secret is configured (recommended: `NEX_RESEND_WEBHOOK_SECRET` first · smallest verifier surface · Svix scheme well-tested)
- [ ] The other four provider secrets remain unset · endpoints for them stay dormant
- [ ] A **controlled test event** is prepared: a real Resend account is configured to send ONE controlled test event to `/api/webhooks/resend`

### Founder action

```bash
# Configure ONE secret only:
export NEX_RESEND_WEBHOOK_SECRET=<founder-signed-secret>
export NEX_WEBHOOK_ENDPOINTS_ACTIVATION=on

# Verify dormancy for other providers before activation:
curl https://<deployment>/api/webhooks/sendgrid   # expect: endpoint_state:"active" but POST would 503 on missing secret
curl https://<deployment>/api/webhooks/mailgun    # expect: same
# (POST is where the per-provider secret gate fires)

# Cause ONE controlled test event from Resend to fire against the endpoint
# (send a real email from the Founder's Resend account to a controlled address
#  that will bounce · a known-invalid mailbox like x@test.invalid works)
```

### Bounded scope

- Exactly one signed event from exactly one provider
- Event kind: recommended `hard_bounce` (single-step cascade · maximally testable)
- Recipient: a controlled address (never a real user)

### Expected observables

| Property | Prediction |
|---|---|
| HTTP response to Resend | 202 · body has `{ok:true, result:{kind:"recorded", classified_kind:"hard_bounce", …}}` |
| New rows in `nex.marketing_bounce_log` | exactly 1 with `esp="resend"` · `classifier_kind="hard_bounce"` · `event_fingerprint` set |
| Row in `nex.marketing_contact` for recipient | `hard_bounced=TRUE` · `opt_out=TRUE` · `opt_out_reason="hard_bounce"` |
| Row in `nex.marketing_opt_out` | exactly 1 for the recipient |
| Reputation recompute | if the outgoing message correlates via `provider_message_id → send_log → campaign.metadata.sender_id`, `marketing_sender_reputation` gets a new row |
| Second POST of the same signed body | returns 202 with `kind:"already_recorded"` · no new rows |
| A tampered POST with the same signature | returns 401 · zero rows written |
| A POST to `/api/webhooks/sendgrid` | returns 503 · secret not configured |

### Timing bounds

- Endpoint response: < 500ms for the verify+classify+record path
- Reputation recompute: < 2 seconds

### Abort-if

- Signature verification passes for a payload tampered after signing → verifier failure → **un-flip immediately**
- `bounce_log` row appears with `classifier_kind="hard_bounce"` but the raw Resend payload was not a bounce → classifier misclassification → **un-flip** and investigate classifier
- `marketing_contact.opt_out` flag flips for a contact whose email is NOT the recipient in the payload → cascade targeting wrong row → **un-flip immediately**
- Second identical POST creates a second row → idempotency broken → **un-flip**
- Any endpoint other than `/api/webhooks/resend` accepts a POST (returns non-503) with a dormant secret → per-provider gate broken → **un-flip immediately**
- Any suppression state reverses (a `hard_bounced=TRUE` contact returns to `FALSE`) → one-way cascade broken → **un-flip** (this is the most severe class of divergence)

### Stage progression

- Stage 3 · one signed real event delivered · 202 returned
- Stage 4 · one row lands in `bounce_log` + `marketing_contact` cascade + `marketing_opt_out` row
- Stage 5 · replay proves idempotency · tamper proves fail-closed · reputation recompute observed
- Stage 6 · N=100 real events over 7 days across the Resend account with zero divergence from prediction table · only after this does Gate #4 for a SECOND provider come into consideration

---

## The pack's own governance

If any gate's Stage-6 evidence set differs from prediction — including in a way that seems benign — the correct response is to un-flip that gate, record the divergence, and revise the runbook (or the underlying code) before another attempt. The runbook is truth-preserving, not aspiration-preserving.
