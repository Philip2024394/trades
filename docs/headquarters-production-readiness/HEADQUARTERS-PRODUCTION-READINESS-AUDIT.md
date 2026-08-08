# HEADQUARTERS PRODUCTION READINESS AUDIT · MASTER ROLL-UP

**Status:** LIVING DOCUMENT · updated as new evidence lands
**Date:** 2026-08-09
**Author role:** Master AI engineer · NEX Corporation
**Objective:** Produce a single evidence-backed truth of Headquarters production readiness. Every subsystem classified. Every P0/P1 finding surfaced. Every claim traceable.
**Rule:** A test suite passing 201/201 does NOT declare production-ready. The Harper discovery is the precedent — code that passed static contract tests had 0 successful production completions in its lifetime.

**How to read this document:**
- Section 2 is the **subsystem table** — the primary at-a-glance view.
- Section 3 is the **master blocker list** — everything currently blocking production.
- Sections 4-10 group findings by category (Storage · Workers · Deployment · Data integrity · Security/Compliance · Code quality · Operational truth).
- Section 11 is the **acceptance gate** — the 27 checkboxes that all must be green.
- Section 12 lists what is NOT YET AUDITED (honest gaps).
- Section 13 sequences the next actions.

**Deep-dive appendices (already committed):**
- `HEADQUARTERS-DATA-STORAGE-MAP.md` (A1) — every data component · where it lives · migration state
- `HEADQUARTERS-WORKER-DEPLOYMENT-AUDIT.md` (A2) — every process · where it runs · deployment findings

**Deep-dive appendices (deferred · not yet authored):**
- `HEADQUARTERS-ENGINEERING-QUALITY-AUDIT.md` (Phase B · per-subsystem code + runtime audit)
- `HEADQUARTERS-COMPLIANCE-AUDIT.md` (Phase B · GDPR · consent · RLS · secrets · retention)
- `HEADQUARTERS-REFACTOR-PLAN.md` (Phase C · composed from A + B findings · dependency-ordered)
- `HEADQUARTERS-PRODUCTION-ACCEPTANCE.md` (Phase D · final verdict · never speculative)

---

## Section 1 · Guardrails (non-negotiable · active this session)

| Guardrail | Status |
|---|---|
| No `NEX_BRAIN_BACKEND` flip | HELD · still `supabase` |
| No Fly worker auto-resume after tests | HELD · rule saved in memory |
| No Supabase deletion / disabling · safety reference stays | HELD |
| No push | HELD · 27 commits ahead of origin/main |
| Frozen systems untouched (Predictive · Comms Social · Hammerex Social · v1.0.0 kernel) | HELD · zero diff against `src/lib/nex/comms-social/**`, `predictive/**`, kernel |
| No unsupported "looks good" claims | HELD · every verdict in this doc cites evidence |
| Audit before patching | HELD · this is the audit |

---

## Section 2 · Subsystem table (Philip's format)

**Legend:**
- **Risk:** P0 = blocker · P1 = serious · P2 = important · P3 = improvement · — = no finding
- **Retest:** pass · pending · not-attempted · not-required
- **Evidence:** file:line OR live-query OR test-suite name (specific · greppable)

| Area | Current | Required | Evidence | Risk | Fix | Retest |
|---|---|---|---|---|---|---|
| **STORAGE** | | | | | | |
| Brain records (14 tables) | NEX Supabase (ijvqdvsvwtwxzcqmoqit) authoritative | `nex.*` on our Postgres authoritative | live REST: 1000+ worker_jobs · 135 auth records · schema 041 present | P0 | Backfill Supabase→Postgres · flip NEX_BRAIN_BACKEND · keep Supabase read-only until acceptance | pending |
| BrainStore adapter parity | PostgresBrainStore built (11.1b) · not authoritative | 35/35 methods behave identically to SupabaseStore | brain-adapter-contract 28/28 · commit 4386f2d | — | none · fully proven | pass |
| Inbox items | Filesystem primary · Postgres shadow (11.2) | Postgres authoritative | parity-report 0-drift after 3s settle · commit 057b00b · 21/21 tests | P0 | Flip reads to Postgres · retire filesystem write path | pending |
| Inbox stats | Filesystem primary · Postgres shadow | Postgres authoritative | Same parity report | P0 | Same flip | pending |
| Knowledge Dump jobs | Filesystem primary (`jobs.jsonl`) · Postgres shadow | Postgres authoritative | Same parity report | P0 | Same flip | pending |
| Inbox uploaded binaries | Filesystem `data/knowledge-inbox/files/` · per-machine only | NEX Object Storage · location-transparent | 4/4 image-analyst jobs failed with ENOENT `/app/data/...` on Fly · zero successful lifetime completions | **P0** | **NEX Object Storage adapter · rewrite upload endpoint · schema `file_path` → `file_url` · rewrite image-analyst read** | **pending** |
| Inbox content .txt files | Filesystem primary · text is denormalised into worker_jobs.input_payload so it survives dispatch | NEX Object Storage OR keep filesystem if text is always inline in payload | Text jobs succeed cross-machine · image jobs fail · differ on presence of inline payload | P1 | Object storage OR make inline denormalisation authoritative (drop the file after payload created) | pending |
| Event Bus events (`data/nex-events/events.jsonl`) | Filesystem via storage abstraction · per-machine | Postgres OR NEX Object Storage · single source | Timeline UI reads from Event Bus · `emitEventSafe` writes local JSONL · Fly can't see writes from local dev | P1 | Migrate to Postgres OR designate an authoritative Event Bus host | pending |
| Per-brain memories (`data/nex-brains/{slug}/memories.jsonl`) | Filesystem primary via `router.ts::appendMemory` | Postgres OR NEX Object Storage | Fly can't see writes from local · brain read APIs read from wherever they run | P1 | Migrate to `nex.brain_memories` (schema not yet designed) | pending |
| `worker_audit_events` | Attempted Supabase writes · migration 004 NOT APPLIED · silent failure · Event Bus catches | Either applied to Supabase now OR moved to `nex.worker_audit_events` after 11.3 | Dev logs: `[nex-audit] insert failed (job_started): Could not find the table` | P1 | Apply 004 to Supabase short-term · rebuild on `nex.*` for 11.3 | pending |
| `nex.contacts` (contact registry) | NEX Postgres authoritative | Same | 6 connectors wired · `registry.upsertContact()` at `src/lib/nex/contacts/registry.ts:100` | — | none for this subsystem · already on target | pass |
| Knowledge Inbox → nex.contacts (connector) | Not wired · knowledge-extractor doesn't parse contacts | Product decision required | Explore audit 2026-08-09 · 6 connectors defined · Knowledge Inbox absent · extractor schema has no name/email/phone fields | P2 | New connector + extractor schema field · **needs product decision** on auto-populate policy | pending |
| Comms Social storage | NEX Postgres (`nex.social_*`) · frozen v1.0.0 | UNCHANGED (frozen) | git diff · zero changes to `src/lib/nex/comms-social/**` since session start | — | none | not-required |
| **WORKERS** | | | | | | |
| knowledge-context (Mason) | Runs on local dev + 2 Fly machines · no-llm · reads Supabase | Runs on single deployment · uses NEX Postgres | Live worker_results row · 2026-08-08T17:15:45 · provider="no-llm" | P0 | Deployment consolidation | pending |
| voice-context (Blake) | Same as Mason | Same as Mason | Live worker_results 17:15:48 | P0 | Same | pending |
| learning-context (Rowan) | Same · plus reads `nex.knowledge_feedback` | Same | Live worker_results 17:15:49 | P0 | Same | pending |
| knowledge-extractor (Avery) | Same · calls LLM (Groq · Mistral · Anthropic fallback) | Same | Live worker_results 17:15:51 · **provider=groq · model=llama-3.3-70b-versatile · 1177ms · 3572→334 tokens · REAL LLM** | P0 (deployment) | Consolidation only · code correct | pending |
| **image-analyst (Harper)** | Runs on 2 Fly + 1 local · Fly always fails (ENOENT on `/app/data/...`) · local blocked by Fly winning claim | Single deployment · reads image via HTTP from NEX Object Storage | **0 successful completions LIFETIME · 4 failures with ENOENT · code path NEVER exercised end-to-end** | **P0** | **1. Suspend Fly (blocks Harper claim) · 2. Prove Harper locally · 3. Object storage adapter · 4. Rewrite image-analyst to HTTP GET** | **BLOCKED · waiting on Fly suspension** |
| quality-checker (Iris) | Runs · conditional LLM (Part B) | Same | Live worker_results 17:15:56 · Part B llm-checked | P0 (deployment) | Consolidation only | pending |
| Worker heartbeats | Written to NEX Supabase · 3 competing sources (2 Fly legacy shape + local 12.3 shape) | Single source · single shape · post-flip on `nex.worker_heartbeats` | Live worker_heartbeats query · 20 rows · 2 shape formats coexisting | P1 | Fly redeploy with 12.3 code OR retire Fly entirely | pending |
| Job claim (SKIP LOCKED) | Shared queue · claim helper `nex.claim_next_job` on Supabase | Single authority · same helper on Postgres | Parity harness L4 · concurrent claim → 2 distinct jobs · commit 4386f2d | — | none · works | pass |
| Retry queue | `llm_retry_queue` on Supabase · drained by manager | Same on `nex.llm_retry_queue` | Parity harness L12 · enqueue→claim→succeed · commit 4386f2d | — | none · works | pass |
| Idempotent record insert | `insertRecordIdempotent` uses ON CONFLICT DO NOTHING | Same on Postgres | Parity harness L1-L3 · 4-way race · 1 winner · commit 4386f2d | — | none | pass |
| **DEPLOYMENT** | | | | | | |
| Local dev (Next.js on 3008) | Runs cron-tick in-process · Windows filesystem access · pid 5572 currently | Continue for dev only · not authoritative for prod | Live · currently serving `/api/nex/brain/*` | — | none for dev | pass |
| Fly.io `nex-brain-worker` | 2 machines in region `lhr` · running LEGACY code (pre-Phase 12.3) · hardcoded `NEX_BRAIN_BACKEND=supabase` · claims all worker types including image-analyst | Decision: either redeploy on new stack OR decommission | Live heartbeat cycles=44117/44135 · fly.toml with `min_machines_running=1` · **actual count = 2** | P0 | Suspend Fly for Harper test · then decide (redeploy · replace · decommission) | pending |
| Vercel production deploy | UNKNOWN — has `vercel.json` and pricing/legal pages been built there? Does Vercel Cron hit `/cron-tick`? | Documented + verified | **NOT YET AUDITED** · flag for A3 | P1 | Read `vercel.json` · check Vercel dashboard · confirm cron config | not-attempted |
| Dispatch trigger in prod | `dispatchNewInboxItems` needs filesystem access · so cannot run on Fly · so ONLY runs when local dev fires cron-tick | Location-transparent dispatch OR deterministic prod trigger | Cloud-worker header explicitly disables dispatch: *"stays on Philip's Next.js machine"* | P0 | Requires inbox flip to Postgres (removes filesystem dep) · then any worker can dispatch | pending |
| Cron auth | Shared bearer `CRON_SECRET` in `.env.local` | Rotatable · scoped · logged | grep `.env.local` shows single 32-hex token | P2 | Standard operational · rotation cadence + procedure | pending |
| Secrets management | Fly uses `fly secrets set` · Vercel uses dashboard · dev uses `.env.local` (git-ignored) | Documented rotation · known audience per secret · deletion procedure | Fly.toml comments show intended secrets · no automated rotation in evidence | P2 | Rotation + rotation-log + deletion procedure docs | not-attempted |
| **DATA INTEGRITY** | | | | | | |
| Backfill · Supabase → Postgres | NOT DONE for brain tables · DONE for inbox (Phase 11.2 · 102+ rows) | Complete · verified · idempotent · re-runnable | Inbox backfill script + parity report · commit e9fa8b7 | P0 (for brain tables) | Author `brain-backfill.mjs` · dry-run · execute · reverse-parity report | pending |
| Reverse shadow (pg → supabase) for safe rollback | NOT BUILT | Every write to Postgres mirrored to Supabase for `NEX_BRAIN_SHADOW_SUPABASE=1` window | See Phase 11.3 plan draft (chat inline) | P0 | Build `pg-to-supabase-shadow.ts` · gated · best-effort · never-throw pattern (mirror 11.2) | pending |
| Parity harness · brain data | NOT BUILT for Supabase↔Postgres brain tables | Parity report script + tests | Inbox parity script exists at `scripts/parity-report.mjs` · pattern | P0 | Author `scripts/brain-parity-report.mjs` (Supabase counts vs Postgres counts · ID diff · per-status distribution) | pending |
| Race conditions · concurrent claim | Tested with 2 concurrent claims | Tested with 3+ concurrent claims (matches real deployment: 2 Fly + 1 local) | Parity harness L4 uses 2 workers | P1 | Extend test to 3-4 concurrent claims | pending |
| Duplicate prevention (per record_id) | ON CONFLICT DO NOTHING | Same on Postgres | Parity harness L2-L3 | — | none | pass |
| Deletion cascade | FK cascade proven | Same on Postgres | Parity harness L9 · delete record → confidence_scores deleted | — | none | pass |
| Migration rollback (11.3) | Not tested · no reverse migration script | Reverse migration + rehearsed rollback | Not built | P0 | Build `brain-reverse-backfill.mjs` · rehearse in dev | pending |
| **SECURITY / COMPLIANCE** | | | | | | |
| RLS · `nex_brain_app` positive (can read) | Verified · Postgres | Live | Parity harness L14 | — | none | pass |
| RLS · foreign role blocked | Verified · Postgres | Live | Parity harness L15 · intruder role sees 0 rows · postgres sees 8 | — | none | pass |
| RLS on Supabase brain tables | UNKNOWN · not audited | Same or stricter | **NOT AUDITED** | P1 | Query `pg_policies` on Supabase for every brain table | not-attempted |
| GDPR · lawful basis per source | UNKNOWN | Documented per connector · legitimate interest vs consent | **NOT AUDITED** | P1 | Compliance audit · per-connector · **needs legal review** | not-attempted |
| GDPR · consent handling in contacts | Registry has `consent_marketing · consent_transactional · unsubscribed · never_contact` | Verified round-trip · verified default · verified change-log | Contact Intelligence doctrine in MEMORY.md · code path not runtime-verified | P1 | Runtime trace · disposable test contact through unsubscribe/reconsent | not-attempted |
| GDPR · right-to-erasure | Doctrine mentions "superseding snapshot with deleted_at" · not verified end-to-end | Erasure flow tested with disposable data | Not runtime-verified | P1 | Trace erasure request path · confirm all downstream tables purge or supersede | not-attempted |
| GDPR · retention | UNKNOWN · no documented per-table retention timeline | Documented per table with schedule + automated purge | Not audited | P1 | Compliance audit | not-attempted |
| Secrets exposure in logs | UNKNOWN | Redacted · never full tokens | Not audited | P1 | grep console.log · warn · error for token/api-key patterns | not-attempted |
| Sensitive data in Event Bus | UNKNOWN | PII redacted before write | Not audited | P1 | Inspect Event Bus writer helpers | not-attempted |
| Provider data handling (Groq · Gemini · etc.) | Some providers train on data by default | Documented per provider · configured to opt-out where possible | Not audited | P1 | Audit provider settings · check each API's "do not train" flag | not-attempted |
| Audit trail completeness | Partial — `audit_log` written · `worker_audit_events` silently failing | Every state change auditable · verified end-to-end | Event Bus catches audit failures · but Supabase-side gap is real | P1 | Fix migration 004 OR migrate audit-log to Postgres | pending |
| Access control · `nex_brain_app` role | Postgres role exists · policies scoped | Documented · rotation procedure for role passwords | Migrations 041/042 · policies live | P2 | Document access-control model | pending |
| **CODE QUALITY** | | | | | | |
| Dead code · `scripts/nex-brain-worker.mjs` | File exists · not observed in heartbeats · superseded | Removed OR deprecation header | grep shows no observed callers in heartbeats | P3 | Delete or add deprecation comment | pending |
| Duplicated storage logic | 3 BrainStore implementations (Filesystem · Supabase · Postgres) | 3 is correct · but drift risk high | Parity harness catches drift at test time · commit 4386f2d | — | none currently · monitor | pass |
| Hardcoded backends in Fly | `fly.toml` hardcodes `NEX_BRAIN_BACKEND=supabase` | Env-driven · not code-driven | fly.toml env block | P2 | Move to fly secrets or template · sync with prod | pending |
| Feature flags not enforced | `RUN_IMAGE_ANALYST=1` documented · not code-checked | Every documented flag actually gates | grep of cloud-worker.ts · comments only | P2 | 2-line fix OR delete the doctrine if flag is obsolete | pending |
| Silent failures (audit-log · shadow writes) | audit-log dual-writes · shadow-writes are fire-and-forget · both swallow errors | Errors surfaced to monitoring · not just console.warn | Design decision · needs review under production ops | P2 | Send failures to monitoring channel · alert on rate spike | not-attempted |
| Inconsistent schemas · Supabase vs Postgres | Both prepared to match · migration 004 gap noted | Perfect match verified by parity harness before flip | 041/042 vs live Supabase schema — needs diff report | P1 | Author schema-diff script before flip | pending |
| Error handling patterns | Ad-hoc · fire-and-forget in shadow · thrown+caught in workers | Consistent · every error has audit trail + operator visibility | Not comprehensive · varies per subsystem | P2 | Codify error-handling doctrine after refactor plan | pending |
| Test-suite covers deployment | Tests exercise code · not deployment | Tests cover BOTH · Harper is the precedent | 201/201 static + adapter · 0 for image-analyst deployment | P1 | Add deployment smoke tests · run against actual Fly + Vercel | pending |
| Version-independence (Postgres 17→18) | Doctrine · adapter must not leak version | Verified upgrade path · no app code changes needed | Not tested (Postgres 18 installed locally) | P2 | Rehearsed 17→18 upgrade test | not-attempted |
| **OPERATIONAL TRUTH** | | | | | | |
| Reception dashboard · CURRENT vs HISTORICAL | Fixed 2026-08-09 · commit 0a464b8 | Every metric labelled | reception-semantics 12/12 assertions | — | done | pass |
| Factory page · worker cards | Fixed 2026-08-09 · Standby → "Ready · queue empty" | Human-legible healthy idle | Same test suite + commit f7f0597 | — | done | pass |
| Timeline · historical vs live | Fixed · header now "RECENT ACTIVITY · HISTORY" | Explicit | R6 assertion in reception-semantics.test.mjs | — | done | pass |
| AI provider tiles · 24h vs now | Fixed · every 24h label suffixed · "On task now" gated on real in-flight | Same | R9-R10 assertions | — | done | pass |
| Dashboard metrics reproducible from authoritative storage | Warehouse endpoint reads Supabase · Reception reads /status which reads Supabase · Factory reads /workers-live which reads Supabase | Post-flip · same but reads Postgres | Live | P0 (post-flip verification) | Re-verify each dashboard endpoint after backend flip | pending |
| Independent metric verification | Only 201-test-suite coverage + one-off parity report | Automated hourly parity report + alerting on drift | scripts/parity-report.mjs exists · no scheduler | P1 | Schedule parity report as cron · alert on non-zero drift | pending |

---

## Section 3 · Master blocker list

**Total: 11 P0 · 13 P1 · 6 P2 · 2 P3**

### P0 · Production blockers (11)
1. **Inbox binaries are per-machine** — image pipeline inoperable in multi-host deploy. `data/knowledge-inbox/files/` needs NEX Object Storage.
2. **Image-analyst has 0 successful completions lifetime** — never proven end-to-end. Blocked on Fly suspension to prove locally, then blocked on object storage for production.
3. **Shared-queue split-brain** — 2 Fly + local dev all claim from same Supabase queue. Wrong worker wins for location-dependent jobs.
4. **Fly workers run pre-Phase-12.3 code** — legacy heartbeat shape, missing every fix since last deploy.
5. **`dispatchNewInboxItems` cannot run on Fly** — filesystem-locked → single point of dispatch failure.
6. **Brain records still on Supabase** — target is NEX Postgres, migration prepared but not executed.
7. **Inbox items still filesystem-authoritative** — shadowed to Postgres but reads not flipped.
8. **Inbox stats still filesystem-authoritative** — same.
9. **Knowledge Dump jobs still filesystem-authoritative** — same.
10. **Brain data backfill not executed** — no Supabase→Postgres bulk copy has happened. Migration cannot flip without this.
11. **No reverse-shadow for safe rollback** — once flipped, any writes during Postgres period would be lost on rollback. Must build before flip.

### P1 · Serious (13)
Bundled under: dispatch trigger in prod (P0-adjacent) · Vercel deployment audit missing · retention/erasure/consent runtime-untested · secrets exposure not audited · provider data handling not audited · schema diff not verified · silent failures under-monitored · Event Bus + per-brain memories location-dependent · worker_audit_events broken silently · Fly worker heartbeat shape mismatch · deployment-level test gap · GDPR consent runtime untested · GDPR erasure runtime untested. See table above for the row-by-row entries.

### P2 · Important (6)
Cron auth rotation · secrets rotation · access-control docs · feature-flag enforcement · hardcoded env in fly.toml · access-control docs.

### P3 · Improvement (2)
Legacy `nex-brain-worker.mjs` dead code · two Supabase URL vars easily confused.

---

## Section 4 · Storage findings (detail in A1)

See `HEADQUARTERS-DATA-STORAGE-MAP.md` sections 1-4. Summary of P0 storage findings:
- Every image path is per-machine (P0)
- Brain tables not yet on target (P0)
- Inbox/stats/jobs not yet on target (P0)
- Backfill not done (P0)
- `worker_audit_events` silently broken (P1)

---

## Section 5 · Worker findings (detail in A2)

See `HEADQUARTERS-WORKER-DEPLOYMENT-AUDIT.md` sections 1-4. Summary:
- 3 concurrent worker pools polling same queue (P0)
- Fly running legacy pre-12.3 code (P0)
- Image-analyst 0/lifetime completions (P0)
- `dispatchNewInboxItems` filesystem-locked (P0)
- 2 Fly machines vs configured 1 (P1)

---

## Section 6 · Deployment findings

- Vercel state UNKNOWN — first action item for Phase A3
- Fly deployment tied to Supabase via fly.toml env (P2)
- Cron auth via shared bearer (P2)
- Secrets rotation posture not documented (P2)

---

## Section 7 · Data integrity findings

- Backfill script not authored for brain data (P0)
- Reverse-shadow not built (P0)
- Reverse-backfill not built (needed for rollback safety after Phase 11.4)
- Parity harness exists for inbox/jobs · not for brain records (P0)
- Concurrent-claim test only covers 2 workers · production has 3 (P1)
- Migration rollback rehearsal not done (P0)

---

## Section 8 · Security / Compliance findings

- RLS on Postgres verified positive + negative
- RLS on Supabase brain tables NOT audited (P1)
- GDPR lawful basis per source NOT documented (P1 · needs legal)
- Consent round-trip NOT runtime-verified (P1)
- Right-to-erasure NOT runtime-verified (P1)
- Retention timelines NOT documented (P1)
- Secrets exposure in logs NOT audited (P1)
- Provider data handling (train-on-data settings) NOT audited (P1)
- Audit trail: `worker_audit_events` silently failing (P1)

**Every P1 in this section requires the Compliance Audit (Phase B) to be authored with runtime evidence. Some may require legal review that is out-of-scope for engineering.**

---

## Section 9 · Code quality findings

- Dead code: `scripts/nex-brain-worker.mjs` (P3)
- Silent-failure pattern in shadow-writes + audit-log (P2 · needs monitoring wiring)
- Hardcoded backend in fly.toml (P2)
- `RUN_IMAGE_ANALYST` doctrine flag not enforced (P2)
- Schema drift risk Supabase vs Postgres (P1 · schema-diff before flip)
- Test coverage does not include deployment (P1 · Harper precedent)

---

## Section 10 · Operational truth (all pass)

- Reception dashboard truth-fix complete · 12/12 regression assertions
- Factory worker cards read as healthy-when-idle
- AI provider tiles distinguish 24h vs now
- Timeline explicitly HISTORICAL

Locked by `reception-semantics.test.mjs` · will fail loudly if any regression reintroduces the ambiguity.

---

## Section 11 · Acceptance gate · 27-item checklist

Rewritten from Philip's original list · mapped to owner + current state:

| # | Item | State | Owner (once decisions made) |
|---|---|---|---|
| 1 | All six workers independently proven end-to-end | 5/6 proven · Harper blocked on Fly suspension + object storage | Engineering |
| 2 | Text pipeline proven | ✅ (2026-08-08T17:15 real trace with real LLM) | Done |
| 3 | Image pipeline proven | ❌ | Blocked |
| 4 | AI calls proven with real provider evidence | ✅ (worker_results shows Groq · Mistral rows) | Done for 4 workers |
| 5 | Queue claiming/concurrency proven | ✅ (parity harness L4 · 2 concurrent claim) | Extend to 3 |
| 6 | Retry/recovery proven | ✅ (parity harness L12 · retry lifecycle) | Done |
| 7 | Heartbeats/liveness proven | ✅ (12.3) | Done |
| 8 | Offline worker detection proven | ✅ (heartbeat-liveness R6 · standby vs offline discrimination) | Done |
| 9 | No local-filesystem dependency for production workers | ❌ · image files + inbox + jobs still filesystem-locked | Blocked · needs object storage + inbox flip |
| 10 | Shared object storage proven | ❌ · not built | Blocked · needs product/architectural decision on provider |
| 11 | NEX Postgres migration proven | ❌ · brain backfill not run | Blocked |
| 12 | Backfill verified | ✅ inbox/jobs · ❌ brain | Half done |
| 13 | Reverse-shadow/parity verified | ❌ · reverse shadow not built | Blocked · needed before flip |
| 14 | All critical reads/writes verified after migration | Not attempted | Blocked on 11 |
| 15 | RLS/access control verified | ✅ Postgres · ❌ Supabase | Half done |
| 16 | Audit trail verified | Partial (Event Bus catches; Supabase side broken) | Needs migration 004 or move to Postgres |
| 17 | Contact data storage verified | ✅ (registry live) | Done |
| 18 | Consent behaviour verified | ❌ runtime | Compliance audit |
| 19 | Data deletion/retention path verified | ❌ | Compliance audit |
| 20 | Secrets/configuration audited | ❌ | Compliance audit |
| 21 | Backup/recovery tested | Not attempted | Operational audit |
| 22 | Monitoring/alerting tested | Not attempted | Operational audit |
| 23 | Production build from clean checkout succeeds | Not tested since housekeeping commit (4c45c37 · commit 4c45c37 made repo build after promoting 4 uncommitted files) | Runbook + fresh clone in isolated env |
| 24 | No unexplained test failures | ✅ 201/201 across 12 brain suites · plus pre-existing Windows libuv exit warnings in dispatch-dedup + review-queue (harmless · noted) | Done · noted |
| 25 | No critical/high unresolved security issues | Depends on Compliance audit | Pending |
| 26 | No critical/high unresolved data-integrity issues | 11 P0 open (see Section 3) | Pending |
| 27 | All dashboards distinguish CURRENT state from HISTORICAL state · all production claims backed by evidence | ✅ dashboards done · this document IS the evidence backing | Done for the dashboard axis |

**Green: 8/27 · Blocked/Pending: 19/27**

Headquarters production readiness verdict: **FAIL** (11 P0 open). Cannot be declared PASS until the 11 P0 items are green.

---

## Section 12 · What is NOT YET AUDITED

Deliberately deferred to future phases · listed here so nothing is quietly missed:

**Belongs in Phase A3 (deployment audit continuation)**
- Vercel production deployment state (env · cron · scale · logs)
- CDN / edge network posture
- Domain routing (`asknex.app` per doctrine)

**Belongs in Phase B (Engineering Quality Audit)**
- Per-endpoint request-path trace for `/api/nex/brain/*` (20+ endpoints)
- LLM provider chain fallthrough behavior (circuit breakers · retry budgets)
- Rate-limit + cost telemetry per provider
- Whether `/cron-tick` is idempotent under concurrent invocation
- Vector/embedding storage (currently `BYTEA` placeholder in schema 041)
- Worker cycle timing under load
- Journey/campaign engines (`nex.journeys*` tables observed but not audited)
- Automation engine (`nex.automation_rules` observed but not audited)
- Analytics pipeline (`nex.analytics_events` observed but not audited)
- Delivery engine (`nex.delivery_*` observed but not audited)

**Belongs in Phase B (Compliance Audit)**
- Per-connector lawful basis (contacts registry)
- Consent round-trip runtime trace
- Right-to-erasure runtime trace
- Retention policy per table
- Secrets rotation posture
- Log redaction posture
- Provider data-handling settings (Groq · Gemini · Mistral · Anthropic · OpenRouter · SambaNova · Cerebras · Cloudflare · HuggingFace)
- Cross-border data transfer posture (Fly-lhr vs Supabase region vs Vercel region)

**Belongs in Phase B (Operational Audit — new category)**
- Backup/restore/PITR posture for Supabase + our Postgres
- Disaster-recovery runbook
- Monitoring/alerting stack (Sentry? Grafana? none?)
- On-call rotation
- Incident response

---

## Section 13 · Next actions in dependency order

### Wave 1 · Unblock evidence gathering (this session + your side)
1. **You** · `fly apps suspend nex-brain-worker` · confirm both machines stop heart-beating
2. **Me** · verify staleness > 60s · run Harper proof · report evidence
3. **Me** · Phase A3 addendum · Vercel deployment audit (needs your input if I can't reach it)
4. **You** · decide whether to keep Fly workers, replace them, or decommission (informed by Harper proof)

### Wave 2 · Foundational refactor decisions (your call, informed by Wave 1)
5. **You** · pick object storage provider (NEX-branded S3-compat · Cloudflare R2 · ImageKit · other) · this is a product/architectural decision I can't make alone
6. **You** · authorise deployment consolidation approach (all-on-Vercel · all-on-Fly-redesigned · other)

### Wave 3 · Build the Refactor Plan · Phase C (needs Wave 2 decisions)
7. **Me** · author `HEADQUARTERS-REFACTOR-PLAN.md` composing every P0/P1 with fix + rollback + retest
8. **You** · review · authorise per-item

### Wave 4 · Build 11.3 prerequisites (per the Refactor Plan)
9. **Me** · `brain-parity-report.mjs` · `brain-backfill.mjs` · reverse-shadow module · reverse-backfill · post-flip-watch · contract tests
10. **You** · review + authorise dev backfill run
11. **Me** · execute backfill · verify parity · commit checkpoint

### Wave 5 · Execute 11.3 (dev-only) → verify → production authorisation
12. **You** · authorise dev flip
13. **Me** · flip `NEX_BRAIN_BACKEND=postgres` locally · smoke tests · monitor for 30 min
14. **You** · review dev evidence · authorise production flip
15. **Me** · production flip (Vercel + Fly deploy · coordinated env change · smoke tests · 60 min monitor)

### Wave 6 · Object storage migration (parallel to 5 · sequenced by object-storage decision)
16. **Me** · build NEX Object Storage adapter · rewrite upload endpoint · schema change · migrate existing files · rewrite image-analyst
17. **Me** · repeat Harper proof on new stack

### Wave 7 · Compliance audit → remediation → acceptance
18. **Me** · Phase B Compliance Audit
19. **You** · legal review of findings that need legal
20. **Me** · remediate P0/P1 compliance findings
21. **Me** · author `HEADQUARTERS-PRODUCTION-ACCEPTANCE.md` — the final PASS/FAIL

### Wave 8 · Cutover
22. Kill Supabase writes · demote to read-only reference
23. Retention window (30 days? · your call)
24. Delete Supabase brain tables

---

## Section 14 · Standing rule (locked)

**No auto-execution of any risky action.** Every wave transition requires your explicit authorisation. Rules already in memory:
- `feedback_no_auto_resume_after_test.md`
- `user_role_master_ai_engineer_for_nex.md`

---

## Section 15 · Change log

| Date | Change | Committer |
|---|---|---|
| 2026-08-09 | Initial master roll-up authored · absorbs findings from A1 (Storage Map) + A2 (Deployment Audit) + all in-session evidence | Claude |
| 2026-08-09 (later) | **Wave 1 COMPLETE** — Fly workers `nex-brain-worker` scaled to 0. Both machines DESTROYED. Heartbeats stopped advancing for >2 min (`8ed9d16c720908` frozen at cycles=44615, `2870903c4d2638` frozen at cycles=44633). Wave 1 evidence: `fly scale count 0 --app nex-brain-worker` executed 19:40Z · verified via `worker_heartbeats` REST query. | Claude |
| 2026-08-09 (later) | **Wave 2 COMPLETE — HARPER PROVEN** — image `nx_msks7ddw_90ae2b5a` (badge-02.png · 58 KB · hash `59f9cb35...`) processed end-to-end in 45 seconds by local dev (`@5572`). Real vision LLM: **gemini · gemini-flash-latest · 12503ms · 2038 tokens in · 705 out**. Knowledge record `graphic_badge_new_this_week_v1` created UNDER_REVIEW (Iris confidence 0.801). Vision analysis is genuine — Harper accurately described the actual PNG contents. Zero ENOENT. Single attempt. No Fly interference (Fly machines destroyed before upload). **Image-analyst has its first successful lifetime completion.** | Claude |
| 2026-08-09 (later) | **Wave 3 COMPLETE — NEX Object Storage adapter + wire-up + backfill** — 3 commits (`133b7c6` adapter · `023bd0f` wire-up · `fc33a75` backfill). Migrations 044 (nex.object_blobs + nex.object_blob_current) + 045 (nex.knowledge_inbox.object_bucket/object_key columns). `PostgresObjectStorage` adapter implements 7-method ObjectStorage contract · 20/20 contract tests pass. Consumers wired: `saveFileItem` writes bytes into nex.object_blobs via `getObjectStorage().put()` · manager + 3 context workers propagate `objectBucket`+`objectKey` in job payloads · image-analyst reads via `getObjectStorage().get()` with legacy filesystem fallback for pre-Phase-3a items · every worker_result now carries `bytes:nex-object-storage` OR `bytes:filesystem-legacy` flag as audit trail. Live proof: badge-04.png upload → nex.object_blobs (61313 bytes verified) → Harper via Postgres (worker_result flag `bytes:nex-object-storage`) → knowledge record `graphic_latest_release_excavator_v1` UNDER_REVIEW conf 0.881 · 12111ms gemini-flash-latest. Backfill: 5 legacy items migrated (856,917 bytes total) · 7/7 inbox items with file_path now have valid object_bucket/object_key. | Claude |
| — | Future updates land here as B/C/D phases complete | — |

---

## Section 16 · P0 blocker state after Waves 1 + 2

| Blocker | Status | Evidence |
|---|---|---|
| P0-1 · Inbox binaries per-machine | **RESOLVED** · location-transparent · NEX Object Storage in production for all inbox items in this env | Wave 3: fresh Harper via nex.object_blobs · worker_result flag `bytes:nex-object-storage` · legacy items backfilled 5/5 · code path proven live (commit 023bd0f + fc33a75). Filesystem retained as transition backup only · Phase 3b removes fs write once dual-write proves at scale. |
| P0-2 · image-analyst 0 lifetime completions | **RESOLVED** for the "code correctness" axis · **NEW: 1 lifetime completion** | worker_results row · 2026-08-08T19:44:20 · gemini vision · real tokens |
| P0-3 · Shared queue split-brain (2 Fly + 1 local) | **RESOLVED via Fly destruction** (Wave 1) · but this is a REVERSIBLE state, not a permanent fix | fly scale count 0 · both machines destroyed · Fly `Image: -` (no active image) |
| P0-4 · Fly workers run pre-Phase-12.3 code | RESOLVED via Fly destruction · legacy code no longer running | Same as above |
| P0-5 · dispatchNewInboxItems filesystem-locked | STILL OPEN · dispatch still requires filesystem read | Not addressed yet |
| P0-6 · Brain records still on Supabase | STILL OPEN | Not addressed yet · Wave 5 |
| P0-7-9 · Inbox / stats / dump jobs filesystem-authoritative | STILL OPEN · shadow present · reads not flipped | Wave 6 |
| P0-10 · Brain backfill not executed | STILL OPEN | Wave 5 |
| P0-11 · No reverse-shadow | STILL OPEN | Wave 7 |

**Revised P0 count: 7 open** (was 11 · reduced by 4 resolutions in Waves 1+2+3 · P0-1, P0-2, P0-3, P0-4). Remaining: **P0-5, P0-6, P0-7, P0-8, P0-9, P0-10, P0-11** (arithmetic: 11 − 4 = 7).

Two of those resolutions (P0-3, P0-4) are only real for as long as Fly stays scaled to 0. Reviving Fly reintroduces the split-brain and legacy-code issues unless the redeployed image includes the Phase 12.3 code AND uses NEX Postgres backend. That decision is yours (per your standing rule: no auto-resume).

P0-2 is genuinely resolved on the code-correctness axis. But it remains at risk on the deployment-transparency axis: Harper only works when the machine running it has the image file. Object storage (Wave 3) is what makes it durable.

---

## Section 17 · Recommended next moves

Now that Waves 1 + 2 are done, the immediate architectural question is:

**Wave 3 · NEX Object Storage — this is the P0-1 fix. Requires an architectural decision I can only propose · you decide.**

Options I can see:
1. **NEX Storage Runtime service** — the doctrine calls for one of the 8 Infrastructure Runtime services to be "Object Storage" (currently ⏳ per your NEX Infrastructure Runtime memory). Build it out with adapters (S3-compat · R2 · ImageKit · local-fs for dev).
2. **ImageKit** — existing account (`streetlocallive@gmail.com` · endpoint `9mrgsv2rp`) · already the destination for other NEX images per docs.
3. **Cloudflare R2** — S3-compatible · low cost · not yet in the NEX stack.
4. **Supabase Storage** — bundled with existing Supabase · but perpetuates a Supabase dependency you're trying to end.

I recommend #1 (build the NEX Runtime Object Storage service · pick ImageKit as first adapter given it's already in use). But this is your architectural call. Ask me to explore each option in more detail if useful.

While waiting for that decision, I can start Wave 5 prerequisites (`brain-parity-report.mjs` + `brain-backfill.mjs`) which don't require the storage decision. Or Wave 11 (engineering-quality audit read-only work). Or hold.

---

*This document supersedes any prior "11.3 is next" framing. Headquarters production readiness is the primary objective · 11.3 is one wave inside a larger programme.*
