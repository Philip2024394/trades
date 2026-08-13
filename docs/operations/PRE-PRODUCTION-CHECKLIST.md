# Pre-production checklist

**Run this checklist end-to-end before every production release.** If any box fails, do not deploy.

## 1 · Fresh clone build

- [ ] Clone repo on a machine that has never seen it (Linux VM preferred)
  ```
  git clone <repo-url>
  cd trades
  ```
- [ ] Install dependencies with no cache
  ```
  rm -rf node_modules
  npm ci
  ```
- [ ] Typecheck passes with no ignored errors
  ```
  npx tsc --noEmit
  ```
- [ ] Lint passes
  ```
  npm run lint
  ```
- [ ] Full test suite passes
  ```
  npm test
  ```
  Expect: 236/236 brain suites + 1823/1825 W-C companion (2 pre-existing failures allowed and tracked).
- [ ] Production build succeeds without `ignoreBuildErrors` or `ignoreDuringBuilds` flags on
  ```
  npm run build
  ```

## 2 · Contract verification

- [ ] ObjectStorage contract test passes against Postgres adapter (17/17)
- [ ] BrainStore adapter parity (28/28)
- [ ] Reverse-shadow contract (15/15)
- [ ] Reception semantics regression (12/12)

## 3 · Six-worker prove-out (local topology)

- [ ] `scripts/six-worker-proveout.mjs` returns 33/33 PASS with fresh evidence
- [ ] Harper `bytes:nex-object-storage` flag observed on the fresh run
- [ ] All six worker types (Mason / Blake / Rowan / Avery / Harper / Iris) heartbeat < 9s ago at end-of-run

## 4 · Deployment smoke (staging or prod-preview)

- [ ] Vercel preview build green
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/nex/brain/status` returns 200 with recent activity
- [ ] Manual `/api/nex/brain/cron-tick` fire returns `{ ok: true, scanned: N, dispatched: M }`
- [ ] Reception dashboard renders without errors

## 5 · Env verification

- [ ] `.env.example` matches actual required vars
- [ ] Vercel env vars present: `NEX_POSTGRES_URL`, `NEX_BRAIN_BACKEND`, `NEX_OBJECT_BACKEND`, `NEX_INBOX_READ_BACKEND`, `CRON_SECRET`, every `<PROVIDER>_API_KEY`
- [ ] `LLM_ALLOW_MOCK_FALLBACK` is `false` (or unset) in production env
- [ ] `NEX_WORKER_CONSENT_V2` is NOT set in production Vercel env (only Fly startup gate)

## 6 · Rollback readiness

- [ ] Previous production deploy identified and known-good
- [ ] Runbook exists for the failure modes you anticipate
- [ ] On-call knows deploy is happening

## 7 · Communication

- [ ] Deploy window announced to team
- [ ] Status page prepared (if applicable)
- [ ] Rollback contact + escalation named

## 8 · Post-deploy watch (first 30 min)

- [ ] `nex.audit_log` fresh writes with `outcome:ok`
- [ ] No spike in 5xx in Vercel
- [ ] Worker heartbeats fresh for all 6 types
- [ ] Reception dashboard renders and metrics look normal

## 9 · Post-deploy watch (first 24 h)

- [ ] SLO metrics within bounds
- [ ] No user-reported regressions
- [ ] Cron schedules firing at expected cadence

## 10 · Sign-off

**Deployer:** __________________  **Date:** __________________
**Reviewer:** __________________  **Date:** __________________
