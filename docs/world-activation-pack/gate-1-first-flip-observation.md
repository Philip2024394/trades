# Gate #1 · First-Real-Flip · Observation Form

**Founder-controlled operational artefact · empty until real evidence is recorded**

This form is filled in **by the Founder at the deployment**, at the moment of the first real Gate #1 flip. It is not filled in by NEX. It captures the concrete evidence set required by §04 · Standing-Line Governance to move any variant of the line.

If any row is DIVERGE or UNKNOWN, the flip has failed and Gate #1 stays dormant. Do not weaken the invariant.

---

## 1 · Flip metadata

| Field | Value |
|---|---|
| Founder | |
| Deployment identifier | |
| Flip started at (ISO-8601 UTC) | |
| Flip ended at (ISO-8601 UTC) | |
| Env var set | `NEX_PAGE_FETCHER_ACTIVATION=on` |
| Allowlist signed_by | |
| Allowlist signed_at | |
| Robots checker injected | |
| Bounded scope · host | |
| Bounded scope · URL | |

---

## 2 · Prediction → observation table

Populate every row. **DIVERGE or UNKNOWN in any row = whole flip DIVERGES** (see §02 · Audit SQL).

| Property | Test prediction | Real observation | Match |
|---|---|---|---|
| Gate state | `NEX_PAGE_FETCHER_ACTIVATION=on` · allowlist file present + signed | | |
| External action | exactly 1 HTTP request to the allowlisted host | | |
| Fetch outcome kind | `responded` or `responded_zero` | | |
| Fetch `status_code` | 200 | | |
| Fetch `url_final` host | equals request host | | |
| Fetch `bytes` | ≤ `max_bytes` from allowlist row | | |
| Evidence row · business_evidence added | 0 (pure fetch) OR 1 (if a bounded walker cycle was authorised) | | |
| Duplicate event · immediate 2nd fetch same host | `rate_limited` | | |
| Suppression | N/A | N/A | ✓ |
| Reputation | N/A | N/A | ✓ |
| Fabrication | 0 evidence rows from non-allowlisted hosts | | |
| Unexpected traffic | 0 HTTP fetches outside the allowlist | | |
| Gate enforcement · NULL_FETCHER default | still module default (verified via `production-page-fetcher.test.ts` G2 · re-run pre-flip) | | |

Fill "Match" with `✓` (observation equals or subsumes prediction), `✗ DIVERGE` (any difference), or `? UNKNOWN` (could not measure).

---

## 3 · Audit-SQL evidence set

Paste raw query output verbatim. Do not summarise. Do not paraphrase.

### 3.1 · BEFORE snapshot (from `02-audit-sql.md · Gate #1 · BEFORE`)

```
evidence_rows_total        =
entity_rows_total          =
most_recent_evidence       =
most_recent_entity_update  =
```

### 3.2 · AFTER snapshot (from `02-audit-sql.md · Gate #1 · AFTER`)

```
evidence_rows_total        =
entity_rows_total          =
most_recent_evidence       =
```

New evidence rows in the last 60 seconds (list `source_url · evidence_kind · created_at` verbatim, one per line):

```
(paste rows here, or write "0 rows" if none)
```

Any evidence row from a non-allowlisted host?

```
(paste rows here, or write "0 rows")
```

---

## 4 · Timing bounds

| Bound | Prediction | Observed | Match |
|---|---|---|---|
| Fetch completion | < 5s typical · < 15s hard cap | | |
| Rate-limited response on immediate 2nd fetch | < 100ms | | |

---

## 5 · Abort-if triggers

Check every box that is NOT triggered. Any triggered box = un-flip per §03.

- [ ] Fetch did NOT return `blocked_by_governance` unexpectedly
- [ ] Fetch did NOT return `responded` from a non-allowlisted host
- [ ] No business_evidence row appeared for an off-scope host
- [ ] Immediate 2nd fetch DID return `rate_limited`
- [ ] Redirect did NOT return `responded` for a non-allowlisted host
- [ ] Robots checker was not bypassed
- [ ] Size cap was not exceeded
- [ ] Timeout did not fire silently

If any box is unchecked → **un-flip** per `03-rollback-procedure.md · Gate #1`.

---

## 6 · Stage decision

At the end of the bounded first flip, one of:

- [ ] **STAGE 3 REACHED** · first real fetch returned as predicted · proceed to Stage 4 (evidence + drill-in verification via HQ)
- [ ] **STAGE 6 REACHED** · N=10 sustained cycles over 24 hours zero divergence · qualifies for §04 line variant "Gate #1 (PageFetcher) PROVEN RUNNING AGAINST THE WORLD"
- [ ] **DIVERGE** · un-flipped · investigation opened · no line change

The **STAGE 6 REACHED** box is not checkable until 24 hours + 10 cycles have elapsed and every one of them matches its prediction table. Do not backdate.

---

## 7 · Post-flip verification

- [ ] Standing marketing status line unchanged (still `MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD` for now)
- [ ] Rollback procedure tested at least once during Stage 3-5 window (un-flipped, verified dormant, re-flipped by explicit re-authorisation)
- [ ] Full deliverability + discovery-world + discovery-intel regression run POST-flip (688/688 or higher) · zero new failures
- [ ] Founder ADR draft prepared IF Stage 6 reached (per §04 · governance change process)

---

## 8 · Founder signature

By signing below, the Founder confirms every row of §2, §3, §4, §5 has been personally observed and no row was recorded by any automated process.

| Field | Value |
|---|---|
| Founder name | |
| Signed at (ISO-8601 UTC) | |
| Governance clause acknowledged | "I authorise this evidence set per `04-standing-line-governance.md`" |

---

**This form is empty by design. It exists to be filled in with real observation, once, when the first real flip is performed. Nothing about it activates anything.**
