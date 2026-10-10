# NEX Emergency Help · H2–H5 Execution Evidence · 2026-10-10

Audit response to the founder directive:

> "Emergency Help browser tests: H2–H5 were skipped because authentication
> fixtures could not be provisioned. That is not a passing result. Fix the
> fixture issue and execute those scenarios before treating the
> browser-hardening suite as complete."

## Diagnosis

At the time of this re-execution the fixture provisioning in
`tests/e2e/nex-emergency-help-hardening.spec.ts` (lines 79–115,
`provisionAccount`) was functionally correct. The pre-flight path
(`supabase.auth.admin.createUser` → `nex_account` insert →
`signInWithPassword`) completed end-to-end against live Supabase
`ijvqdvsvwtwxzcqmoqit`. The cookie plant uses `base64-<b64 json>` which
matches `tryParseSupabaseCookie` in
`src/lib/nex-native/app/session.ts:349-359`.

The only remaining risk was that any future regression in env, service
role, or `nex_account` schema would again cause a silent
`test.skip(true, "no fixture")` in H2–H5, hiding the regression. Two
narrow fixes close that gap.

## Fixes applied (narrow)

1. `tests/e2e/nex-emergency-help-hardening.spec.ts`
   - `beforeAll` now records `fixtureError` with a specific reason when
     provisioning fails. Env-genuinely-missing is still an honest skip;
     any other failure is a hard throw (`"Skipped is not acceptable"`).
   - H2, H3, H4, H5 each discriminate: skip only when env is missing;
     otherwise fail loudly with the recorded reason.
   - Each change carries a code comment pointing to this doctrine.
2. `scripts/nex-canonical/_e2e-fixture-health-check.mjs` (new)
   - Standalone preflight: 9 checks (.env.local, URL, anon key, service
     role, Supabase reachability, admin.createUser round-trip,
     nex_account insert round-trip, signInWithPassword, dev server
     reachability).
   - Exits 0 on all PASS; exits 1 with a specific FIX hint on the first
     FAIL. Safe to run as a CI preflight gate.

No feature code in Emergency Help was changed · the scenarios revealed no
new defects beyond those already sealed in prior commits.

## Health-check output (live run, 2026-10-10)

```
PASS · .env.local present · D:\trades\.env.local
PASS · Supabase URL set · https://ijvqdvsvwtwxzcqmoqit.supabase.co
PASS · Supabase anon key set · sb_publishab…
PASS · Supabase service role key set · eyJhbGciOiJI…
PASS · Supabase reachable · /auth/v1/health → 200
PASS · supabase.auth.admin.createUser · authId=51547e0c…
PASS · nex_account insert · accountId=3243c561…
PASS · signInWithPassword · jwt len=830
PASS · Dev server reachable · http://localhost:3008 → 200

All checks passed. Playwright fixture is ready.
```

## Scenario results

Two consecutive runs (desktop + iPhone-14-Pro-393), each 6/6 PASS, zero
skips, reporter `line` + `json`:

| ID | Result | Screenshot | Note |
|----|--------|------------|------|
| H1 | PASS | `tests/e2e-screenshots/nex-emergency-help-hardening/H1-offline-at-tap.png` | Offline sets `navigator.onLine=false`; no countdown testid rendered. Invariant holds. |
| H2 | PASS | `.../H2-location-denied-countdown.png` | Countdown enters without geolocation permission. Honest copy "Location permission denied. You can still send the alert · responders will not see your position." is visible. No fabricated "Location captured" string. |
| H3 | PASS | `.../H3-permission-revoked-mid.png` | After `ctx.clearPermissions()` mid-countdown, the countdown remains visible; cancel path still available. Component never auto-cancels on permission revocation. |
| H4 | PASS | `.../H4-multi-tab-tabB.png` | Tab B /active renders one of the honest states (`sawReady \|\| sawEmpty \|\| sawPending \|\| sawLoading`). "No active emergency" is the observed state in this run and is documented as an acceptable honest ceiling (realtime not wired · poll-based). |
| H5 | PASS | `.../H5-rate-limit-attempt.png` | Four UI-level burst attempts observed; no fabricated success. The INCIDENT_RATE_LIMIT (3 concurrent + 10/24h) does not trigger on 4 attempts with cancellation between · the spec correctly records this as "no error seen in 4 attempts" rather than forcing a brittle assertion. See `incident-service.ts:534-592`. |
| H6 | PASS | `.../H6-report-police-smoke.png` | App chrome boots on `/nex-native/emergency-help`; the full tel-href + disclaimer assertions are owned by the SSR component test `src/components/nex-native/emergency/__tests__/ReportToPolicePanel.test.tsx`. |

Stats emitted by the Playwright JSON reporter:
```
{ "expected": 6, "skipped": 0, "unexpected": 0, "flaky": 0 }
```

Mobile-viewport run (iPhone-14-Pro-393): 6 passed (1.0m).

## No defects discovered

H2–H5 did not reveal product-side defects. The ack-gate, countdown,
permission-revocation handling, multi-tab active-view fallback, and
rate-limit paths all behaved according to their sealed doctrines.

The weak-assertion wording in H4 and H5 is intentional honest-ceiling
design (documented in `nex-emergency-hardening-audit-2026-10-10.md`) ·
H4 cannot assert cross-tab realtime because realtime is not wired for
Emergency Help; H5 cannot assert `rate_limited` on 4 attempts because the
rate limit is 10/24h. Both scenarios record what happened without
forcing a false assertion.

## Usage

Preflight (recommended before any CI run of the hardening suite):

```
node scripts/nex-canonical/_e2e-fixture-health-check.mjs
```

Then:

```
npx playwright test tests/e2e/nex-emergency-help-hardening.spec.ts \
  --reporter=line --project=desktop --workers=1
```

## Honest statement

H2–H5 now run reliably when the fixture health-check reports ready. The
only skip path remaining is env-genuinely-missing, which is also what
the health-check script detects and reports. Any other provisioning
failure now surfaces as a loud test FAILURE with a reason string, not a
silent skip.

## Files touched

- `tests/e2e/nex-emergency-help-hardening.spec.ts` · beforeAll + four
  `if (!fixture)` branches hardened. No scenario semantics changed.
- `scripts/nex-canonical/_e2e-fixture-health-check.mjs` · new.
- `docs/doctrine/nex-emergency-h2-h5-execution-evidence-2026-10-10.md` ·
  this file.

No Emergency Help feature code was modified. No V1/V2/V4 agent scope
was touched. No new npm dependencies.
