# NEX World Activation Pack

**Founder-authored governance artefact · 2026-09-22 · not runtime · not code**

> **STATUS: FROZEN as of 2026-09-22.**
> This pack is closed as an operational-preparation wave. Nothing here is activation authority. No further engineering wave follows merely because the operational bridge exists. When the Founder decides to perform the first real activation, the next action is **Gate #1 only** — using `01-runbook-per-gate.md` and `02-audit-sql.md` — not another broad build programme.

This pack is the controlled bridge from `MACHINERY PROVEN UNDER TEST` to `PROVEN RUNNING AGAINST THE WORLD`.
Every gate transitions through a bounded, evidence-based, reversible sequence. Nothing in this pack activates anything. Every activation is a Founder decision, evidenced by observation, reversible by rollback.

---

## The locked principle

> **If real-world evidence diverges from the tested prediction, un-flip the gate. Never weaken the invariant to make the evidence fit.**

This is the single rule that governs every stage below. If observation disagrees with prediction, the fault is not in the test — it is in the environment or in NEX's fitness to run against it. The response is always to return to dormant and investigate. Not to relax a check.

---

## The evidence chain (every activation)

```
FOUNDER AUTHORISES
        ↓
ONE GATE / ONE BOUNDED SCOPE
        ↓
REAL WORLD EVENT
        ↓
NEX DATABASE EVIDENCE
        ↓
EXPECTED TEST PREDICTION
        ↓
ACTUAL OBSERVED RESULT
        ↓
      MATCH?
     ↙       ↘
   YES        NO
    ↓          ↓
 continue   UN-FLIP
    ↓          ↓
 N cycles   investigate
    ↓          ↓
 STAGE 6   no relaxation
    ↓
 GATE PROVEN
```

Stages 1-6 in words:

| Stage | Meaning |
|---|---|
| 1 | Code-ready · 503 dormant everywhere · tests pass · no real traffic |
| 2 | Founder-authorised · env var flipped in **one bounded scope** (single host / single provider / single sender / single country) |
| 3 | Real external cycle · first real fetch / tick / webhook / DNS lookup |
| 4 | Real evidence · one row lands in `bounce_log` / `discovery_cycle` / `entity` / `domain_auth` |
| 5 | Real feedback · cascade + reputation recompute observed to match test predictions |
| 6 | Sustained operation · N cycles with zero drift · zero fabrication · every gate still enforcing |

The **standing marketing status line** moves only after Stage 6 for a gate — never before, never aspirationally.

---

## The prediction → observation table (used at every activation)

Every real-world cycle is recorded by this table. It makes the first-world operation forensic rather than subjective.

| Property | Test prediction | Real observation | Match |
|---|---|---|---|
| Gate state | active | | |
| External action | exactly 1 | | |
| Evidence row | 1 | | |
| Duplicate event | rejected/idempotent | | |
| Suppression | one-way | | |
| Reputation | recomputed | | |
| Fabrication | 0 | | |
| Unexpected traffic | 0 | | |
| Gate enforcement | intact | | |

The template lives in `02-audit-sql.md` with the exact SQL that populates each row.

---

## The tiny-first-flip principle

The first flip is deliberately small. Sequential order:

1. **Gate #1 — Production PageFetcher** · ONE permitted host · ONE bounded real cycle · observe every dimension · rollback if anything differs.
2. **Gate #2 — Continuous crawler** · ONE tick · one country · watch UNIQUE constraint + two-clock discipline hold.
3. **Gate #3 — Production DomainAuthChecker** · ONE sending domain · one DNS resolution.
4. **Gate #4 — ONE provider webhook** · single provider (Resend recommended · smallest attack surface) · single controlled test event · then live traffic only after Stage 6.

Never activate all four gates together. Never skip a stage. Never open every provider webhook simultaneously.

---

## The four artefacts

| # | File | Purpose |
|---|---|---|
| 01 | [`01-runbook-per-gate.md`](./01-runbook-per-gate.md) | Exact Founder action, bounded scope, expected observables, timing bounds, abort-if conditions · per gate |
| 02 | [`02-audit-sql.md`](./02-audit-sql.md) | SQL for every row of the prediction/observation table · before-flip baseline + after-flip evidence |
| 03 | [`03-rollback-procedure.md`](./03-rollback-procedure.md) | Un-flip steps · verification queries · residue check · standing line stays unchanged |
| 04 | [`04-standing-line-governance.md`](./04-standing-line-governance.md) | Governance-only · not runtime · defines what fact-set permits a line change, who signs, and how it reverts if evidence turns |

---

## What this pack is not

- **Not runtime**: no code in this pack activates or modifies anything at runtime.
- **Not automation**: no script flips a gate. Every flip is a Founder shell action against the deployment env.
- **Not aspirational**: no phrase in this pack claims a state that has not been evidenced.
- **Not final**: after each successful gate transition, the pack is updated with the evidence-set that satisfied Stage 6.

---

## Reference · the four gates + their env vars

| Gate | Env var | Additional condition | Endpoint / code |
|---|---|---|---|
| #1 · Production PageFetcher | `NEX_PAGE_FETCHER_ACTIVATION=on` | Host in `data/nex-page-fetcher-allowlist.json` | `ProductionPageFetcher` (Session-19) |
| #2 · Continuous crawler | `NEX_DISCOVERY_CRON_ACTIVATION=on` | Deployment scheduler pings the endpoint | `/api/cron/nex-continuous-tick` (Session-19) |
| #3 · Production DomainAuthChecker | `NEX_DOMAIN_AUTH_CHECKER_ACTIVATION=on` | `nex.marketing_sender_domain_auth` has ≥1 row | `/api/cron/nex-domain-auth-refresh` (Session-19) |
| #4 · Authenticated webhooks | `NEX_WEBHOOK_ENDPOINTS_ACTIVATION=on` | Per-provider secret env var configured | `/api/webhooks/{provider}` (Session-19) |

Each env var must equal exactly `"on"` — any other string (`true`, `1`, `yes`, `ON`) is rejected by design (Session-9 · verified in acceptance).

---

## Standing marketing status line · under governance

Current line (unchanged):

> `NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.`

The line lives in `src/lib/nex/marketing/deliverability/acceptance-matrix.ts`. It never changes at runtime and never changes because something looks successful. It changes only when the evidence set defined in `04-standing-line-governance.md` is satisfied for a specific gate, and only via a code+test update signed by the Founder as part of an ADR.

---

**Preserve every invariant. Move deliberately. Prefer un-flip over relaxation.**
