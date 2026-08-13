# HEADQUARTERS COMPLIANCE AUDIT · PHASE B

**Status:** DRAFT · evidence-based findings · engineering-scoped
**Date:** 2026-08-10
**Author role:** Master AI engineer · NEX Corporation
**Objective:** Runtime evidence for master audit Section 8 items · surface every gap needing legal review · never invent legal conclusions.
**Rule:** File:line evidence for every claim. `NEEDS LEGAL` marker for anything outside engineering scope.

---

## URGENT · secrets exposure flag (surfaced during audit)

**File:** `C:\Users\Victus\trades\.env.local:36`

The Stripe LIVE secret key (`STRIPE_SECRET_KEY = sk_live_51P6F3n...`) sits in `.env.local`. Line 34-35 carries an operator comment: *"rotate after setup since transmitted in chat"*. **This audit cannot confirm the rotation happened.** Recommend Philip verify at https://dashboard.stripe.com/apikeys · roll if any doubt. Same review for every provider key listed in §5 below.

---

## Section 1 · Per-connector lawful basis (contacts registry)

Six contact connectors identified. All in-code assumptions; no external legal document cross-referenced.

| # | Connector | Data source | Assumed basis (code) | Evidence | Ratchet applies |
|---|---|---|---|---|---|
| 1 | trades | `hammerex_trade_off_listings` (Supabase legacy) | Legitimate interest (directory signup) · `consent_marketing=NULL` `consent_transactional=TRUE` | `src/lib/nex/contacts/connectors/trades.ts:22-26` | ✅ |
| 2 | newsletter | `hammerex_xrated_newsletter_subscribers` | Explicit consent + consent_text stored | `newsletter.ts:8-16, 67-99` | ✅ complaints → `never_contact=true` |
| 3 | crm | `app_crm_contacts` | Legitimate interest (prior merchant interaction) · `consent_marketing=NULL` | `crm.ts:30-31, 128-132` | ✅ |
| 4 | contact-form | `/api/contact` submissions | Transactional (enquiry reply) | `contact_form.ts:68-69` | ✅ |
| 5 | manual | Admin-added via HQ | Admin discretion · ratchet still applies | `manual.ts:24` + `registry.ts:114-129` | ✅ |
| 6 | csv | Admin file upload | Admin discretion (bulk import foundation) | `csv.ts:39` | ✅ |

**FINDING [P1 · NEEDS LEGAL]:** Lawful basis per connector is not formally documented. The registry ratchet enforces the technical contract (`registry.ts:114-129`) but no policy document states *why* each connector maps to its assumed basis. Specifically needs legal review:
- (a) Is trades directory signup sufficient for `consent_transactional=TRUE`?
- (b) Does CRM extraction without re-consent breach GDPR Article 6?
- (c) Does CSV bulk import require batch consent audit before upsert?

---

## Section 2 · Consent handling code paths

### 2.1 Where consent fields are written

| Operation | Location | Pattern |
|---|---|---|
| Upsert | `registry.upsertContact()` | Ratchet at `registry.ts:114-129` — once FALSE never TRUE without admin reinstate |
| Hard bounce | `compliance.engine::applyStateChange()` | → `suppressed_hard` + `never_contact=TRUE` · `engine.ts:276-297` |
| Soft-bounce threshold | same | → `suppressed_soft` after N bounces · `engine.ts:300-314` |
| Complaint | same | → `complaint` + implicit `never_contact` · `engine.ts:319-329` |
| Unsubscribe | same | → `unsubscribed` + sets `unsubscribe_at` · `engine.ts:332-343` |
| Manual reinstate | `manualReinstate()` | → `allowed` + resets counters · `engine.ts:362-368` |

### 2.2 Where consent is read to gate outbound sends

`src/lib/nex/notifications/compliance.ts:26-60` — one unified `checkNotificationCompliance()` runs across email/SMS/WhatsApp/push/in_app:
- `never_contact=TRUE` → block
- `unsubscribe_at` set → block
- `kind='marketing'` ∧ `consent_marketing≠TRUE` → block
- `kind='transactional'` ∧ `consent_transactional=FALSE` → block

### 2.3 Changelog / audit trail

Every mutation appends one row to `nex.compliance_events` (append-only) via `engine.ts:219-228`. Schema at `deploy/postgres/init/020_compliance_engine.sql:30-49`.

### 2.4 Runtime verification

**FINDING [P1]:** No disposable contact has been walked through active → unsubscribe webhook → next-send-blocked. Code path is verified; the round-trip runtime trace is missing. Fix: `scripts/prove-unsubscribe-roundtrip.mjs` that creates a burner contact, fires a fake unsubscribe event, calls the notifications gate, asserts `allowed:false, reason:"unsubscribed"`, and cleans up.

---

## Section 3 · Right-to-erasure paths

### 3.1 Erasure initiation

**No DELETE / erasure code path found.** Schema is ready (`nex.contacts.deleted_at TIMESTAMPTZ` per `deploy/postgres/init/012_contact_intelligence.sql:24`) but no code writes to it.

Every SELECT filters `WHERE ... deleted_at IS NULL` (`registry.ts:91`, `engine.ts:76,114,128,151`) — so once you set it, everything hides. But nothing sets it.

### 3.2 Cascade coverage

Setting `deleted_at` does NOT cascade to:
- `nex.contact_sources` (no FK)
- `nex.contact_merges` (no FK)
- `nex.events` (`related_contact TEXT`, not FK)
- `nex.compliance_events` (`contact_id UUID`, not FK, immutable table)

**FINDING [P0 · NEEDS LEGAL AND ENGINEERING]:** Right-to-erasure is not implementable today. Two required paths:
1. **Engineering:** `POST /api/nex/contacts/{id}/erase` + `scripts/erase-contact.mjs` that sets `deleted_at=NOW()` on the canonical row and either deletes or anonymises identifiers (`email`, `phone`, `name`) on historical snapshots.
2. **Legal:** Confirm whether soft-delete (`deleted_at`) is sufficient for GDPR Article 17 or if anonymisation-in-place is required — audit trails (`nex.events`, `nex.compliance_events`) may be retained under Article 17(3)(b) if the identifier is anonymised.

---

## Section 4 · Retention policy per table

No TTL, no retention column, no scheduled DELETE found in any migration. Every relevant table effectively retains forever:

| Table | Retention (code) | Evidence |
|---|---|---|
| `nex.contacts` | forever | `deploy/postgres/init/006_contacts.sql:45` comment says "retention: forever" |
| `nex.contact_sources` | forever | `012_contact_intelligence.sql` — no TTL, no ON DELETE trigger |
| `nex.contact_merges` | forever | same, append-only |
| `nex.contact_duplicate_suggestions` | forever | resolved rows never purged |
| `nex.compliance_events` | forever | `020_compliance_engine.sql:66` comment says "never mutated after insert" |
| `nex.events` | forever | `001_events.sql:40` comment says "retention forever · audit truth" |

**FINDING [P1 · NEEDS LEGAL]:** GDPR Article 5(1)(e) (storage limitation): personal data must be kept "no longer than necessary." Contacts registry has no documented retention window. Options:
1. Document per-lifecycle-stage retention (e.g., archived contacts purge at 3y, active kept indefinitely)
2. Auto-purge `never_contact=true` + `unsubscribed` after 18 months
3. Formally justify indefinite retention per Article 6(1)

---

## Section 5 · Secrets management

| Secret | Storage | Rotation |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local:3` | 70+ year expiry — non-urgent but no procedure |
| `GROQ_API_KEY` | `.env.local` + Fly secrets | None documented |
| `GOOGLE_GEMINI_API_KEY` | same | None |
| `ANTHROPIC_API_KEY` | same | None |
| `STRIPE_SECRET_KEY` | `.env.local:36` (LIVE) | **Comment says "rotate after setup since transmitted in chat" — unconfirmed if rotated** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local:37` (public) | N/A |
| `ADMIN_COOKIE_SECRET` | `.env.local:14` (96-byte hex) | None |
| `XRATED_VAPID_PRIVATE_KEY` | `.env.local:30` (server-side only) | None |
| `CRON_SECRET` | Not visible in `.env.local` dump; likely per-env | None documented |

**FINDING [P2]:** No rotation cadence, no rotation procedure, no rotation audit log. Fix: `docs/operations/SECRETS-ROTATION.md` per-secret rotation cadence + runbook.

**FINDING [P1]:** Stripe LIVE key was transmitted in chat per comment — Philip must confirm rotation happened.

---

## Section 6 · Log redaction

Sample spot-checks came back clean:
- `audit-log.ts:212-213` logs `event_type` + `error.message` — safe.
- `compliance/engine.ts:289` logs provider name + `bounce_subtype` — safe.
- `llm.ts:100-108` LlmCallResult logs `tokens_in/out` + `ms` — safe, does not log response payload to console.
- `audit-log.ts:51-69` mirrors to Event Bus with `error_snippet` truncated to 240 chars (`audit-log.ts:207`).

**FINDING [P2]:** No centralised redaction policy. Future code changes could accidentally log a raw provider response with an API key echoed in an error payload. Fix: add a `redactSensitiveData()` helper (see §9) + an ESLint rule flagging `console.*` inside middleware/worker inner loops.

---

## Section 7 · Provider data handling (train-on-data)

| Provider | Default model | Opt-out status | Notes |
|---|---|---|---|
| Anthropic | claude-haiku-4-5-20251001 | ✅ Anthropic default is no-training on API usage | Only provider currently safe by default |
| Groq | llama-3.3-70b-versatile | ❌ UNKNOWN | `llm.ts:134` — no opt-out header sent |
| Gemini | gemini-flash-latest | ❌ UNKNOWN | `llm.ts:138` — uses -latest alias |
| Mistral | mistral-small-latest | ❌ UNKNOWN | `llm.ts:132` |
| OpenRouter | nvidia/nemotron-3-ultra-550b:free | ❌ UNKNOWN | aggregator; per-model ToS varies |
| SambaNova | Meta-Llama-3.3-70B-Instruct | ❌ UNKNOWN | `llm.ts:130` |
| Cerebras | gpt-oss-120b | ❌ UNKNOWN | `llm.ts:142` |
| Cloudflare Workers AI | @cf/meta/llama-3.3-70b-instruct-fp8-fast | ❌ UNKNOWN | `llm.ts:144` |
| HuggingFace | meta-llama/Llama-3.3-70B-Instruct | ❌ UNKNOWN | `llm.ts:147` |

Code has no opt-out header, no `do_not_train` flag on `LlmCallOptions` (`llm.ts:84-98`).

**FINDING [P1 · NEEDS LEGAL]:** For production, either:
1. Document a training-opt-in policy per provider, OR
2. Add per-provider opt-out headers where supported, OR
3. Restrict production to providers with confirmed no-train defaults (Anthropic; verify others).

DPA (data processing addendum) needed for every provider handling personal data.

---

## Section 8 · Cross-border data transfer

| Component | Region |
|---|---|
| Fly.io `nex-brain-worker` (DECOMMISSIONED) | London (lhr) per `fly.toml:45` |
| Supabase legacy | EU (default region) |
| NEX Postgres (target) | **UNKNOWN** — `NEX_POSTGRES_URL` not visible in this audit |
| Vercel | global edge · origin region unclear |
| Email/SMS providers | not audited here |

**FINDING [P1 · NEEDS LEGAL AND OPS]:** Region for NEX Postgres must be established before production launch. If NEX Postgres is non-EU, Supabase → NEX Postgres migration during Wave 5 is a cross-border transfer requiring SCCs/BCRs. Vercel Edge routing may also cross regions.

Fix (ops):
1. Philip confirms NEX Postgres region + documents it in `deploy/VERCEL-DEPLOYMENT.md`.
2. If non-EU, legal must supply appropriate transfer mechanism.

---

## Section 9 · Sensitive data in Event Bus

**Writer:** `audit-log.ts:51-69` mirrors payload to Event Bus.

Fields written:
- ✅ `worker_type`, `provider`, `model`, `confidence`, `latency_ms`, `raw_outcome` — metadata, safe.
- ⚠️ `error_snippet` — truncated to 240 chars but could still leak DB error detail.
- ⚠️ `...input.details` — spread as-is, no validation of caller-supplied fields.

Compliance events (`engine.ts:219-228`) similarly spread `input.metadata` without redaction.

**FINDING [P2]:** No systematic redaction. Future contributors could accidentally leak PII/keys. Fix: helper (rough shape) in `src/lib/nex/observability/redact.ts`:
```ts
export function redactSensitiveData<T>(obj: T): T {
  if (typeof obj !== "object" || obj === null) return obj;
  const safe: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (/email|phone|apikey|secret|token|password|authorization/i.test(k)) safe[k] = "[REDACTED]";
    else safe[k] = redactSensitiveData(v);
  }
  return safe as T;
}
```
Wire on every `payload` shape before write.

---

## Section 10 · RLS on Supabase brain tables

Cannot verify without operator DB access. Postgres brain tables are verified (parity harness L14-15).

**OPERATOR-RUN query** against Supabase `ijvqdvsvwtwxzcqmoqit`:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'hammerex_trade_off_listings',
    'hammerex_xrated_newsletter_subscribers',
    'app_crm_contacts'
  )
ORDER BY tablename, policyname;
```
Expected: each table returns at least one policy row. No policies = RLS off = world-readable.

---

## Findings summary

| # | Section | Priority | NEEDS LEGAL? |
|---|---|---|---|
| 1 | Connector lawful basis | P1 | YES |
| 2 | Consent round-trip runtime test gap | P1 | NO |
| 3 | Erasure path missing | **P0** | YES |
| 4 | Retention policy absent | P1 | YES |
| 5 | Stripe key possibly leaked in chat · rotation cadence missing | P1/P2 | NO |
| 6 | Log-redaction policy | P2 | NO |
| 7 | Provider training opt-out unknown | P1 | YES |
| 8 | Cross-border transfer path unknown | P1 | YES |
| 9 | Event Bus payload redaction | P2 | NO |
| 10 | Supabase RLS unverified | P1 | NO (operator-run) |

**Counts:** 1 P0 (erasure) · 6 P1 · 3 P2 · 5 items require legal review.

## Operator-run checklist

1. Rotate Stripe LIVE key if not already done (§5).
2. Confirm NEX Postgres region (§8).
3. Run pg_policies query on Supabase (§10).

## Legal-review checklist

- [ ] Connector lawful basis (§1)
- [ ] Erasure sufficiency (soft-delete vs anonymisation) (§3)
- [ ] Retention schedule per lifecycle stage (§4)
- [ ] Provider DPAs + training-opt-out defaults (§7)
- [ ] SCCs/BCRs for any non-EU transfer (§8)

## Acceptance-gate impact (master audit Section 11)

| # | Item | Impact |
|---|---|---|
| 18 | Consent behaviour verified | ❌ FAIL — runtime test missing (§2.4) |
| 19 | Data deletion/retention path verified | ❌ FAIL — erasure code missing (§3), retention undocumented (§4) |
| 20 | Secrets/configuration audited | ⏳ PARTIAL — surface enumerated, rotation cadence missing (§5), Stripe key possibly leaked |

None of items 18/19/20 will flip to PASS without engineering AND (for §1/§3/§4/§7/§8) legal input.
