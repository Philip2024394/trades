# NEX SafeChat Privacy Audit · Evidence · 2026-10-10

Sealed by SafeChat Privacy Audit (V1) · branch `nex/directory-work` · not pushed.

This document is EVIDENCE, not a plan. It records what passed, what was fixed,
how to re-verify, and the one open question for the founder.

---

## 1 · Flag defaults (post-audit)

| Flag | Default | Behaviour |
|---|---|---|
| `NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED` | **OFF** (flipped from ON on 2026-10-10) | Only `="true"` enables logging. Every other value — unset, empty, "yes", "True", "1", "false" — resolves to OFF. |
| `NEX_SAFECHAT_USER_FACING_ENABLED` | OFF | Phase 2+ sentinel. Phase 1 code never reads it. |
| `NEX_SAFECHAT_RETENTION_DAYS` | 30 | Consumed by `_safechat-retention-sweep.mjs`. |
| `NEX_SAFECHAT_AUTHORISED_BY` | unset | REQUIRED when Phase 1 logging is ON. Flag audit script FAILS otherwise. |

Rationale (sealed in the function doctrine comment): *Any environment that has
not explicitly authorised SafeChat Phase 1 logging must not be writing
classification records. Flipping default OFF ensures a dev who pulls the repo
and starts the server does not accumulate real-user classification data without
explicit opt-in.*

---

## 2 · Leak discovered + patched

**File · line:** `src/lib/nex-native/safechat/classifier.ts:191`

**Shape:** `RuleMatchEntry.matchedText` on pattern entries was being set to
`p.matchedText`, which is a direct substring of the sender's message body
(from `pattern-detector.ts:110`: `matchedText: m[0]`). That substring then
flowed into `JSON.stringify(ruleMatches)` at `classification-logger.ts:64` and
was persisted to the `rule_matches` jsonb column — a body-text leak into DB.

**Narrow patch (logger boundary, not classifier):**
`src/lib/nex-native/safechat/classification-logger.ts` now redacts
`matchedText` to the sentinel `"[redacted]"` for every pattern entry before
INSERT via `redactRuleMatchesForPersistence()`. The signal aggregator does
NOT read `matchedText` so redaction is lossless for downstream consumers.
Pattern IDs, signal types, severities, languages and dictionary terms are all
preserved — none of those derive from the message body.

**Verifying guard:** `privacy-audit.test.ts` scenarios S2 and S11 assert the
needle `needle_text_zebra_quokka_7xyz` never appears in the stringified
`rule_matches` column, even when a pattern regex explicitly matches the
needle.

---

## 3 · Privacy properties · test matrix

| # | Property | Test (file :: name) | Result |
|---|---|---|---|
| S1 | No needle in any SQL bind | `privacy-audit.test.ts :: S1` | PASS |
| S1b | No needle in `message_ref` | `privacy-audit.test.ts :: S1b` | PASS |
| S1c | No needle in `language_detected` | `privacy-audit.test.ts :: S1c` | PASS |
| S2 | No needle in `rule_matches` jsonb; `matchedText` redacted | `privacy-audit.test.ts :: S2` | PASS |
| S2b | Vocabulary `term` = dictionary term, not body | `privacy-audit.test.ts :: S2b` | PASS |
| S3 | Signals jsonb is boolean/numeric only | `privacy-audit.test.ts :: S3` | PASS |
| S4 | No needle in console.log/warn/error/info/debug + stdout/stderr | `privacy-audit.test.ts :: S4` | PASS |
| S4b | Classifier soft-fail warning omits body | `privacy-audit.test.ts :: S4b` | PASS |
| S5 | Thrown error `.message` + `.stack` omit body | `privacy-audit.test.ts :: S5` | PASS |
| S6 | DB write failure soft-fail log omits body | `privacy-audit.test.ts :: S6` | PASS |
| S6b | NOT NULL-style error path omits body | `privacy-audit.test.ts :: S6b` | PASS |
| S7 | Hook returns `undefined` when logger throws | `privacy-audit.test.ts :: S7` | PASS |
| S7b | Hook returns `undefined` when classifier throws | `privacy-audit.test.ts :: S7b` | PASS |
| S8 | `ClassificationResult` serialised holds no body | `privacy-audit.test.ts :: S8` | PASS |
| S8b | Hook function has no attached body-carrying property | `privacy-audit.test.ts :: S8b` | PASS |
| S9 | `messageRef` is opaque, caller-provided | `privacy-audit.test.ts :: S9` | PASS |
| S10 | Classifier module exports no body-keyed cache | `privacy-audit.test.ts :: S10` | PASS |
| S10b | Logger module exports no body-keyed cache | `privacy-audit.test.ts :: S10b` | PASS |
| S11 | 20-needle fuzz pass · each absent from every bound param | `privacy-audit.test.ts :: S11` | PASS |

**Total · 19 privacy tests · 19 PASS.**

Full SafeChat suite: 10 files, **156 tests, 156 PASS, 0 fail.**

---

## 4 · Retention sweep

Module: `src/lib/nex-native/safechat/retention-sweep.ts`
Script: `scripts/nex-canonical/_safechat-retention-sweep.mjs`

- Deletes rows from `nex.safechat_classification` where
  `classified_at < now() - (retentionDays || ' days')::interval`.
- Idempotent: second run returns `deletedCount = 0`.
- `retentionDays` must be a positive integer; `0`, negative, NaN, and
  fractional values are rejected.
- Script is session-identity gated: refuses to run unless
  `current_database() = 'nex_dev'`.
- Dry-run mode `--dry-run` reports the count without issuing a DELETE.

Unit tests: `retention-sweep.test.ts` · **13 tests, 13 PASS.**

---

## 5 · Flag audit script

Script: `scripts/nex-canonical/_safechat-flag-audit.mjs`

Reports:
- `NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED` + effective (ON/OFF)
- `NEX_SAFECHAT_USER_FACING_ENABLED` + effective (ON/OFF)
- `NEX_SAFECHAT_RETENTION_DAYS` + effective (days)
- `NEX_SAFECHAT_AUTHORISED_BY`

Fails CI (exit 1) if:
- Phase 1 logging is ON and `NEX_SAFECHAT_AUTHORISED_BY` is unset, OR
- Phase 2 user-facing flag is ON, OR
- Retention window is non-positive.

Current repo environment: `exit 0 · OK · all SafeChat flags at safe defaults`
(verified live by the audit at seal time).

---

## 6 · How to re-verify (one-liner each)

```
npx vitest run src/lib/nex-native/safechat
node scripts/nex-canonical/_safechat-flag-audit.mjs
node scripts/nex-canonical/_safechat-retention-sweep.mjs --dry-run
```

(The retention-sweep dry-run requires a live DB connection via
`NEX_POSTGRES_URL` and will refuse to proceed unless
`current_database() = 'nex_dev'`.)

---

## 7 · Open questions for founder

1. **Retention target.** 30 days is the default. If a tighter window
   (e.g. 7 days) is preferred for Phase 1, flip
   `NEX_SAFECHAT_RETENTION_DAYS` and schedule the sweep.
2. **CI integration.** The flag-audit script is written to be CI-friendly
   (exit 0/1). Not yet wired into any GitHub Actions workflow — awaiting
   founder sign-off before adding.
3. **Cron scheduling.** The retention sweep must be scheduled externally
   (Vercel Cron / GitHub Actions / Supabase pg_cron). Not scheduled by
   this audit · founder decision pending.

---

## 8 · Confirmations

- No new user-facing surface was added.
- No vocabulary / pattern / taxonomy expansion.
- No Phase 2 primitives introduced.
- No DB schema change (migration 199 untouched).
- No DB write performed by this audit.
- V2 / V3 / V4 scopes untouched.
