# ADR-0300 — NEX Own-Storage Migration Blueprint

**Founder Mission (2026-09-10):** "We never rely on third party. Move all data from Supabase to our own storage. Fully connected."

**Status:** APPROVED · Blueprint ready for phased execution.
**Author:** Master AI Engineer
**Reviewed by:** Parallel research audit (2026-09-10)

---

## 1. Discovery — what actually lives in Supabase today

Two Supabase projects hold NEX + Trades data:

### Project A · `msdonkkechxzgagyguoe.supabase.co` (Hammerex legacy)
- `hammerex_trade_off_listings` — ~5-10K rows (merchant directory)
- `hammerex_nex_whatsapp_outbox` — WhatsApp send queue
- payment webhooks, orders, billing tables
- 348 migrations in `supabase/migrations/`

### Project B · `ijvqdvsvwtwxzcqmoqit.supabase.co` (NEX brain runtime, created 2026-08-02)
- `hammerex_nex_brains` — ~20-50 rows (author-curated brains)
- `hammerex_nex_brain_versions` — ~100-200 rows (version history)
- `hammerex_nex_brain_drafts`, `_certifications`, `_dependencies`, `_answers`
- `hammerex_nex_brain_field_outcomes`, `_review_actions`, `_events`
- Events: ~10K+ rows growing

### Storage buckets (Supabase Storage)
- Transient staging + backup binaries
- Referenced via `.storage.from()` in adapters
- ImageKit already handles image delivery (hybrid model)

---

## 2. What NEX already has locally (partial migration ALREADY in place)

**This is the crucial win — much of the infrastructure exists:**

| Component | Status | Location |
|---|---|---|
| Local Postgres 16 | ✅ Running | Docker Compose · `deploy/postgres/docker-compose.yml` · port `5433` |
| Local schema | ✅ Migrations ready | `deploy/postgres/init/` (078 = accommodation_business) |
| Backend selector | ✅ Coded | `NEX_BRAIN_BACKEND=postgres` env swap · `src/lib/nex/brain/storage.ts` |
| Custom auth | ✅ Live | `src/lib/nex/identity-auth/` — NOT using Supabase Auth |
| Custom sessions | ✅ Live | `nex.user_session` table · 48-char hex tokens, HMAC-signed |
| ImageKit CDN | ✅ Live | Images already served from ImageKit, not Supabase Storage |
| Shadow-write flag | ✅ Coded | `NEX_BRAIN_SHADOW_POSTGRES` (ADR Wave 7) — dual-write ready |

**What's still on Supabase (production traffic):**
- Read/write paths for accommodation_business (9,203 rows)
- Brain runtime (all 11 core tables)
- Some binary uploads via Supabase Storage
- Real-time subscriptions (few consumers)

---

## 3. Migration strategy — 3-phase, 18-day plan

### Phase A · Dual-write (Days 1-7) — SAFE FALLBACK
- **Activate** `NEX_BRAIN_SHADOW_POSTGRES=1`
- New writes go to Supabase (primary) AND local Postgres (shadow)
- Reads still from Supabase
- Nightly parity checker: row counts + checksum by table
- **Rollback:** flip flag off, local DB discarded
- **Risk:** Very low
- **Deliverables:**
  - Backfill historical data via `pg_dump | pg_restore` (one-shot)
  - `scripts/nex-parity-checker.mjs` runs nightly, alerts on drift
  - Founder dashboard shows "Supabase primary · Postgres shadow · 100% parity"

### Phase B · Dual-read (Days 8-14) — VALIDATION
- Flip `NEX_BRAIN_BACKEND=postgres` (reads switch to local)
- Writes still dual (Postgres primary now, Supabase shadow for rollback)
- User-facing Brain queries return identical results from both DBs
- Latency measured per query type
- **Rollback:** flip read back to Supabase, full parity preserved
- **Risk:** Low
- **Deliverables:**
  - Read-comparison script (100 random queries per hour, alert on divergence)
  - Latency dashboard (Postgres vs Supabase P50/P99)
  - Query bug fixes (any Postgres-specific issues surfaced)

### Phase C · Cutover (Day 15-16) — IRREVERSIBLE
- Disable Supabase writes
- Archive Supabase Project B as read-only backup (never delete)
- Local Postgres becomes production source of truth
- **Rollback:** Only via restore from Supabase archive (RPO ≤ 24h)
- **Risk:** Very low if A+B validation passed
- **Deliverables:**
  - `NEX_BRAIN_SHADOW_SUPABASE=false` set permanently
  - Supabase Project B downgraded to free tier (read-only archive)
  - Grep-based CI check: any new `.from('supabase_client')` call fails PR

### Days 17-18 · Buffer for bug fixes and monitoring

---

## 4. Cost + resilience comparison

| Dimension | Self-hosted (chosen) | Cloud Postgres (Neon) | Supabase (today) |
|---|---|---|---|
| Monthly cost | ~$5 (electricity) | $15-50 | $50-200 |
| Data sovereignty | 100% | 0% | 0% |
| Offline capability | Yes | No | No |
| Disaster recovery | Manual (own backup) | SLA-backed | SLA-backed |
| Ops burden | High | Low | Low |
| Scale headroom | ~500 GB before tuning | ~500 GB before upgrade | Same |

**Chosen:** Self-hosted (aligns with founder mandate "never rely on third party").
**Hedge:** Cloud Postgres kept as documented rollback option if Victus infra proves unreliable.

---

## 5. Backup + failover discipline (required)

Self-hosting demands operational rigor. **Non-negotiable:**

1. **Nightly `pg_dump` to encrypted S3-compatible storage** (MinIO or Cloudflare R2, ~$1/mo)
2. **WAL archiving** to same bucket (PITR — point-in-time recovery within 24h)
3. **Monthly restore drill** — restore backup to a scratch Postgres instance, run smoke tests
4. **Alerting** on:
   - Backup script failure
   - Disk >80% full
   - Postgres process not running for >30s
   - Replication lag if we add a hot standby
5. **Off-site secondary** (optional): Cloud Postgres as async replica for geo-redundancy

---

## 6. Storage migration (Supabase Storage → ImageKit + MinIO)

Already hybrid — this is easy:
- **ImageKit** (already integrated): images + PDFs + delivery
- **MinIO** (new, optional): self-hosted S3-compatible for backups + private binaries
- **Cutover:** rewrite `.storage.from(...)` calls to ImageKit uploader or MinIO client
- **Risk:** low (URL replacement + upload retry logic)

---

## 7. Success criteria

Migration is COMPLETE when:
- ✅ Zero `@supabase/supabase-js` client usage in production code paths
- ✅ 100% Brain reads served from local Postgres (measured 30 days)
- ✅ 100% Brain writes durable on local Postgres (measured 30 days)
- ✅ Supabase Project B is archive-only (no writes for 30 days)
- ✅ Nightly backup + monthly restore drill both passing 90 days
- ✅ Founder-visible dashboard shows "Own storage: 100% · Third-party dependencies: 0"

---

## 8. What NOT to migrate

- **ImageKit** stays — it's a CDN, not a database; already fits the "own everything critical" test
- **Ollama** stays local — LLM inference is already on Victus
- **Vercel** stays for now — Next.js hosting is application layer, not data. Migrate later if founder wants.
- **PostgreSQL itself** — we're using it, we own it, that's the whole point

---

## 9. Timeline

- **Week 1:** Phase A (dual-write) — start Day 1 of authorization
- **Week 2:** Phase B (dual-read validation)
- **Week 3:** Phase C cutover + monitoring
- **Week 4:** Buffer + restore drill

**Total: 18 days risk-neutral, 30 days including monitoring.**

---

## 10. Founder authorizations required

Before starting:
1. ✅ **Storage-migration authorization** — the founder has authorized this in the 2026-09-10 brief
2. ⏳ **Infra budget** — approx $5-10/mo for MinIO backup destination (Cloudflare R2 or self-hosted)
3. ⏳ **Restore-drill schedule** — pick monthly cadence and stick to it
4. ⏳ **Ops on-call** — someone answers if Postgres goes down at 3 AM

---

**Recommendation:** Start Phase A this week. Self-hosted Postgres is the canonical path.
Archive Supabase (never delete) for 12 months as immutable backup.
