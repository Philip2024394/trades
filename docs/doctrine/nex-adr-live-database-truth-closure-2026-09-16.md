# NEX ADR Live Database Truth Closure · 2026-09-16

**Status:** READ-ONLY AUDIT · freeze preserved · no writes · no migrations · no remediation
**Method:** Live diagnostic queries via `pg` 8.22.0 (Node.js) against configured Postgres URL
**Substrate reached:** `postgres@localhost:5433/nex_dev`
**Executed by:** Claude Code (NEX1 development workstation) — NOT NEX1 runtime
**Session freeze reference:** post-audit principles locked · APPLY MIGRATION not authorised · no code changes made
**Scripts of record:**
- `scripts/nex1-live-db-truth-audit/probe.mjs` (7 primary queries · read-only transaction)
- `scripts/nex1-live-db-truth-audit/probe-2.mjs` (schema introspection · evidence distribution)

**Truth taxonomy applied throughout:**
- **PROVEN** — evidence produced by live query
- **NOT PROVEN** — live query produced negative evidence (state does not exist)
- **UNKNOWN** — no query result available to close the question
- **NOT APPLICABLE** — question is not addressable in this substrate

---

## §1 · Purpose

Close the seven live-database UNKNOWNs preserved in the earlier audit
`nex-adr-database-state-verification-2026-09-16.md` (which had no live DB access).
This audit does **not** rewrite that earlier document. It stands alongside it as fresh
evidence per Historical Wave Receipt Immutability Doctrine (2026-09-15).

The prior audit answered structural questions from repo state alone. This audit adds
runtime state from the live substrate.

---

## §2 · Environment verification (pre-connection)

| Check | Result |
|---|---|
| `psql` binary in PATH | **NOT PRESENT** (Windows shell) |
| `pg` NPM module installed | **PRESENT** — v8.22.0 at `node_modules/pg/package.json` |
| `.env.local` file exists at repo root | **PRESENT** |
| `NEX_POSTGRES_URL` non-empty line count | 1 |
| `NEX_LANGUAGE_POSTGRES_URL` non-empty line count | 0 |
| `NEX_TAXONOMY_POSTGRES_URL` non-empty line count | 1 |
| Credential printed to output at any point | **NO** — only host displayed |
| Transaction mode | `SET default_transaction_read_only = on` + `BEGIN READ ONLY` |
| Query surface | `SELECT` + `information_schema` only · zero writes |

**Verdict — audit hygiene:** PROVEN read-only. No mutations, no credential leakage.

---

## §3 · Question 1 · Do the seven ADR-0308 semantic-layer tables exist?

**Method:** `SELECT EXISTS ... FROM information_schema.tables WHERE table_schema = 'nex'`

| ADR-0308 table | Live state |
|---|---|
| `nex.concepts` | **PRESENT** |
| `nex.concept_senses` | **PRESENT** |
| `nex.contexts` | **PRESENT** |
| `nex.relationships` | **PRESENT** |
| `nex.questions` | **PRESENT** |
| `nex.answers` | **PRESENT** |
| `nex.evidence` | **PRESENT** |

**Verdict:** **PROVEN — all seven tables exist in `nex_dev.nex` schema.**

**Column-shape verification** (nex.concepts):
`concept_id, canonical_key, display_name, layer, status, created_at, updated_at`

This matches the ADR-0308 v1 schema definition. No renames, no drift.

---

## §4 · Question 2 · What are the current row counts?

| Table | Row count | Notes |
|---|---|---|
| `nex.concepts` | **44** | Matches reconciliation-evidence.json (44 documented) |
| `nex.concept_senses` | **51** | Matches reconciliation-evidence.json (51 documented) |
| `nex.contexts` | **224** | Not previously documented in evidence file |
| `nex.relationships` | **0** | ⚠ Empty — see §6 |
| `nex.questions` | **60** | |
| `nex.answers` | **62** | |
| `nex.evidence` | **173** | Distribution examined in §7 |

**Verdict:** **PROVEN — row counts captured for all seven tables.**

**concepts insertion timestamp range** (from `MIN(created_at)` / `MAX(created_at)`):
- First seen: `2026-09-10T17:16:15.570Z`
- Last seen: `2026-09-10T17:39:26.919Z`
- Window: **23 minutes** on the day ADR-0308 was authored.

**Inference (labelled INFERRED, not proven causally):** the 44 concepts were bootstrapped
in a single ~23-minute session on 2026-09-10. Consistent with a one-shot seed run
concurrent with ADR-0308 authorship.

---

## §5 · Question 3 · Do the 44 canonical_keys match reconciliation-evidence.json?

**Method:** live `SELECT canonical_key FROM nex.concepts ORDER BY canonical_key` compared
against `semantic_layer.concepts[].canonical_key` array from `data/nex-english-source-map/reconciliation-evidence.json`.

| Metric | Value |
|---|---|
| Expected canonical_keys (evidence file) | 44 |
| Live canonical_keys (nex_dev) | 44 |
| Missing from live (present in evidence, absent in DB) | **0** |
| Extra in live (present in DB, absent in evidence) | **0** |
| Set-equal | **TRUE** |

**Verdict:** **PROVEN — exact match. The 44 concepts documented in reconciliation-evidence.json ARE the 44 concepts in `nex_dev.nex.concepts`.**

The reconciliation-evidence file is faithful to live substrate as of 2026-09-16 read.

---

## §6 · Question 4 · State of `nex.relationships`

- Table exists: **YES**
- Row count: **0**
- Column shape: not fully introspected in this pass; existence and count are the answer.

**Verdict:** **PROVEN — `nex.relationships` is empty.**

**Architectural significance (labelled OBSERVATION):**
The relationships infrastructure was created but has never been populated. ADR-0308 defines
concept-to-concept relationships (parent/child, aliases, sense-of) as part of the semantic
layer, but the 2026-09-10 bootstrap seeded concepts + senses only — no relationships.

**This does not indicate a defect** — it indicates the semantic layer is *bootstrap-complete
but relationship-empty*. Any downstream reader assuming relationships exist would return
zero rows without error.

---

## §7 · Question 5 · Evidence for migration 006 invocation

**Method:** search for common migration-tracking tables.

| Candidate table | Search scope | Found |
|---|---|---|
| `schema_migrations` | all schemas via `information_schema.tables` | **NO** |
| `supabase_migrations` | all schemas | **NO** |
| `_prisma_migrations` | all schemas | **NO** |
| `knex_migrations` | all schemas | **NO** |
| `migration_history` | all schemas | **NO** |

**Verdict:** **NOT PROVEN — no migration tracking table exists in `nex_dev`.**

**Evidence chain reconstructed from indirect signals:**

1. **All seven ADR-0308 tables PRESENT** (§3) — the migration ran, or an equivalent DDL.
2. **44 concepts bootstrap in a 23-minute window on 2026-09-10** (§4) — matches ADR-0308's
   authorship date.
3. **No down-migration file exists** — searched `db/migrations/*down*`, no matches.
4. **Only one migration file matches**: `db/migrations/006_nex_english_brain_v1.sql` (146 lines).

**Combined verdict:** The seven tables exist and are seeded consistently with what migration
006 would produce. There is **no explicit tracking record** confirming migration 006 was the
invocation vehicle. The migration may have been applied by ad-hoc `psql < 006_nex_english_brain_v1.sql`
or an equivalent one-off runner that does not write a tracking row.

**Label:** LIVE STATE CONSISTENT WITH MIGRATION 006 APPLIED · INVOCATION VEHICLE UNPROVEN.

---

## §8 · Question 6 · Guardian / evidence audit around the 44 concepts

**Live distribution of `nex.evidence` rows by `subject_kind`:**

| subject_kind | Row count |
|---|---|
| `answer` | 62 |
| `question` | 60 |
| `sense` | 51 |
| **`concept`** | **0** |

Total: 173 rows (matches §4 row count).

**Column shape of `nex.evidence`:**
`evidence_id · subject_kind · subject_id · source_ref · trust_layer · confidence · captured_at · captured_by · cycle_run_id`

**Verdict:** **NOT PROVEN — zero evidence rows reference concept subjects.**

**Structural observation (labelled OBSERVATION):**
Evidence rows cover senses (51 · exact 1:1 with concept_senses row count), questions
(60 · exact 1:1 with questions row count), and answers (62 · exact 1:1 with answers row count).
Concepts themselves have **no evidence-layer attestation**.

**Implication (labelled INFERRED):** the bootstrap process attached provenance to
sub-concept objects (senses, questions, answers) but NOT to the concepts themselves. Under
ADR-0308 Rule 6 (Guardian audit chain), concepts without evidence rows have no captured
provenance trail — their existence is asserted by the migration + reconciliation-evidence.json
file, not by the evidence table.

**This is a live-state contradiction with ADR-0308 Rule 6** if that rule was intended to
require concept-level evidence. Founder-only interpretation.

---

## §9 · Question 7 · Does a down-migration exist in the repository?

**Method:** Glob patterns against `db/migrations/`.

| Pattern | Matches |
|---|---|
| `db/migrations/**/*nex_english_brain*` | `006_nex_english_brain_v1.sql` (up only) |
| `db/migrations/006*` | `006_nex_english_brain_v1.sql` (up only) |
| `db/migrations/*down*` | **NONE** |

**Verdict:** **NOT PROVEN — no down-migration file exists for migration 006.**

**Rollback readiness implication (labelled OBSERVATION):** if `nex_dev.nex.*` tables need to
be reverted, no scripted rollback exists. Any rollback would require hand-written `DROP TABLE`
statements. This is consistent with `CREATE TABLE IF NOT EXISTS` in the up-migration — the
migration was designed to be idempotent forward, not reversible.

---

## §10 · Broader schema observation (context, not verdict)

The `nex` schema contains **253 tables** total. The 7 ADR-0308 semantic-layer tables are
a small subset. The remaining ~246 tables are the product schema (accommodation, food,
marketing, mp_*, brain_*, worker_*, service_*, provider_*, delivery_*, etc.).

**Implication for freeze:** the semantic-layer tables coexist with a large product schema
in the same database. Any future migration work on `nex.concepts` etc. must be validated
for name collisions and cross-schema references. This audit did not perform that broader
sweep — flagged for future work only.

---

## §11 · Reconciliation Matrix

Comparison of the earlier audit's UNKNOWNs vs live findings:

| Question | 2026-09-16 doc-only audit | 2026-09-16 live audit |
|---|---|---|
| Do the 7 tables exist? | UNKNOWN | **PROVEN — all 7 present** |
| Row counts? | UNKNOWN | **PROVEN — captured** |
| 44 canonical_keys match evidence file? | UNKNOWN | **PROVEN — exact match** |
| Which DB holds authoritative data? | Assumed `nex_dev` per env | **PROVEN — nex_dev @ localhost:5433** |
| Migration 006 invoked? | UNKNOWN | LIVE STATE CONSISTENT · INVOCATION VEHICLE UNPROVEN |
| `nex.relationships` state? | UNKNOWN | **PROVEN — empty (0 rows)** |
| Guardian evidence for 44 concepts? | UNKNOWN | **NOT PROVEN — zero concept-subject rows** |
| Down-migration exists? | Assumed no | **NOT PROVEN — confirmed no** |

**Net result:** 6 UNKNOWNs closed to PROVEN or NOT PROVEN · 1 residual (migration invocation
vehicle) still not attributable to a specific tool because no tracking table exists.

---

## §12 · Contradictions surfaced (informational · not remediated)

Per freeze, no code changes were made. These are logged for founder disposition.

1. **ADR-0308 Rule 6 (Guardian evidence chain) vs live evidence table** — concepts have
   zero evidence rows despite 173 evidence rows existing for their sub-objects. Either:
   (a) Rule 6 was not intended to require concept-level evidence, (b) the bootstrap
   process was incomplete, or (c) concept provenance is captured elsewhere
   (reconciliation-evidence.json itself may be the intended attestation record).
   **Founder-only judgement.**

2. **`nex.relationships` empty** — infrastructure exists, no data. Consistent with
   bootstrap-only seed. **Not a defect on evidence available.** Requires founder direction
   on whether relationship population is part of a later ADR wave.

3. **No migration tracking table** — the codebase has no `schema_migrations` (or equivalent)
   mechanism. Migration 006 was applied by an unknown vehicle. **Introducing tracking
   would be a code change** and is out of scope for this freeze.

4. **No down-migration** — rollback is manual only. **Not remediated per freeze.**

---

## §13 · Final Four-Question Founder Table

| Question | Answer | Evidence |
|---|---|---|
| **Q1 · Is the ADR-0308 semantic layer live in production dev DB?** | **YES** — all 7 tables present, 44 concepts + 51 senses seeded, canonical_keys exact-match reconciliation file. | §3, §4, §5 |
| **Q2 · Was migration 006 actually applied?** | **CONSISTENT (probable) · INVOCATION VEHICLE UNPROVEN** — schema and row shape match what 006 would produce, but no tracking table records the invocation. | §7 |
| **Q3 · Is the audit/evidence chain complete under ADR-0308 Rule 6?** | **NO** — 173 evidence rows exist but zero reference concepts directly. Concept provenance lives in `reconciliation-evidence.json`, not in `nex.evidence`. Founder interpretation required. | §8 |
| **Q4 · Can the migration be safely rolled back if needed?** | **NO SCRIPTED ROLLBACK EXISTS** — no down-migration file, no tracking mechanism. Any revert would be hand-written DDL. Introducing rollback tooling is out of scope for the current freeze. | §9 |

---

## §14 · Freeze preserved

**Actions taken in this audit:**
- Wrote 2 read-only probe scripts (`scripts/nex1-live-db-truth-audit/*.mjs`)
- Executed queries within an explicit `BEGIN READ ONLY` transaction
- Wrote this audit document

**Actions NOT taken:**
- No writes to any database
- No migrations applied
- No code in `src/` modified
- No commits, no pushes
- No changes to Capability A, Context Evidence Gate, agent designations, or intelligence profiles
- No architectural decisions made
- No NEX designation status changed

**Freeze status:** INTACT.

---

## §15 · Recommended next step (proposed only · founder-only approval)

Given the live substrate matches the reconciliation evidence file exactly, the earlier
UNKNOWN "is migration 006 already applied?" is effectively resolved to YES-EQUIVALENT.
The founder previously held APPLY MIGRATION pending precisely because this was UNKNOWN.

**PROPOSAL (not decided):** treat migration 006 as *already applied on nex_dev* and shift the
open question from "should we apply" to "should we introduce migration tracking + a
down-migration to formalise this state." That is a separate architectural decision — flagged,
not proposed to execute.

---

**End of audit · freeze preserved · no NEX designations changed · no capability claims made.**
