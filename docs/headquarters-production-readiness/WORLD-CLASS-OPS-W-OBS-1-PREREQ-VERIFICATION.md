# W-OBS-1 · Path A Layer 1 · Prerequisite Runtime Verification Report

**Programme:** Headquarters Production Readiness · W-OBS-1 Path A implementation
**Prerequisite target:** `nex.events.correlation_id` column existence
**Authorization scope:** Philip 2026-08-11 · *"Before implementation reaches the sequencing point involving nex.events.correlation_id, Claude must perform the documented runtime verification. That verification should be reported separately. If the runtime state differs from source/migration expectations, stop and reassess rather than designing around the assumption."*
**Discipline:** STOP + REPORT before any implementation touches `nex.events`.

## Verification method

Two possible verification paths existed:

1. **Live PG shell** — run `\d nex.events` against production or dev DB.
2. **Source-of-truth migration inspection** — read `deploy/postgres/init/001_events.sql` + subsequent ALTER TABLE migrations.

**Path 1 could not be executed in this environment** — the local PG server on `localhost:5433` (the `NEX_POSTGRES_URL=postgresql://…localhost:5433/nex_dev` target) has been documented as DOWN across the last several sessions. No live query possible without operator intervention.

**Path 2 was executed** — source is authoritative for the schema NEX-side; live drift would still need re-verification, but source is the primary evidence.

## Source verification results

**`deploy/postgres/init/001_events.sql:6-24`** — the canonical `nex.events` table definition:

```sql
CREATE TABLE IF NOT EXISTS nex.events (
  event_id             UUID PRIMARY KEY,
  event_type           TEXT NOT NULL,
  source               TEXT NOT NULL,
  actor_id             TEXT,
  timestamp            TIMESTAMPTZ NOT NULL,
  business_id          UUID,
  related_department   TEXT,
  related_brain        TEXT,
  related_job          TEXT,
  related_contact      TEXT,
  outcome              TEXT NOT NULL,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  reversible           BOOLEAN NOT NULL DEFAULT FALSE,
  reverse_of           TEXT,
  supersedes           TEXT,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Search for later ALTER TABLE adding `correlation_id`:**

```
grep -rnE "ALTER TABLE nex\.events.*correlation_id" deploy/postgres/init/
→ (no matches)
```

**Finding: `nex.events` has NO `correlation_id` column.** It has a `payload JSONB` column and several typed fields (`related_job`, `related_brain`, `related_contact`, `related_department`) which are the existing extensibility surface.

## How existing writers already handle nex.events

Grep for actual writers surfaced two production callers using the JSONB-payload pattern (not columns):

- `src/lib/nex/alerts/evaluator.ts:193`
  ```
  INSERT INTO nex.events (event_type, payload)
  VALUES ('system.health_alert', $1::jsonb)
  ```
- `src/lib/nex/delivery/audit.ts:30`
  ```
  INSERT INTO nex.events (event_type, payload)
  VALUES ($1, $2::jsonb)
  ```

**Established pattern:** every extra field lives inside the `payload` JSONB blob. The typed columns (`related_job`, `related_brain`, etc.) exist for known-hot query paths; everything else goes in `payload`.

## Does emitSignal currently write to nex.events?

Grep for signals.ts writers to nex.events: **NO direct write**. The signal path emits to `console.warn` and calls `emitEventSafe` (a separate subsystem). There is no coupling today between `signals.ts` and `nex.events` — the plan's §9 assumption ("Storage adapter writes it to `nex.events.correlation_id`") was OVERBROAD.

## Reassessment

The stop condition specified by Philip is: *"If the runtime state differs from source/migration expectations, stop and reassess rather than designing around the assumption."*

**The runtime state DOES differ from my plan's §9 assumption.** My plan said *"If the `correlation_id` column exists → populate from ALS. If the column does NOT exist → Layer 2 migration required to add it."* Reality: the column does not exist AND Layer 2 is not authorized AND the existing writers use `payload` JSONB, not columns.

**Reassessment options:**

### Option 1 · Persist CID inside `payload->>'correlation_id'` (Layer 1 compatible · no schema change)

- Matches the existing pattern used by `alerts/evaluator.ts` and `delivery/audit.ts`
- Matches the plan's own §5 approach for inbox items (`payload.correlation_id`)
- Zero schema change · zero migration · Layer 1 compatible
- Forensic query becomes `SELECT * FROM nex.events WHERE payload->>'correlation_id' = 'X'`
- Query performance: without a GIN index on `payload->>'correlation_id'`, this is a sequential scan · acceptable at current row counts · would become slow at scale (>100k rows)
- **Path forward if this option chosen:** proceed with Layer 1 implementation · plan §9 wording amended in the plan doc

### Option 2 · Add nex.events.correlation_id column (requires Layer 2 authorization · currently NOT authorized)

- Cleanest forensic query · indexable · matches the plan's original intent
- Requires a migration + backfill (NULL for historical rows)
- **Explicitly outside the Layer 1 authorization boundary**
- Path forward: STOP Layer 1 · request Layer 2 authorization · migration lands · then Layer 1 proceeds

### Option 3 · Defer nex.events CID persistence entirely · Layer 1 covers ALS + inbox + workers only

- Signals emit CID to `console.warn` + `emitEventSafe` (whatever that writes to today) but do NOT persist to `nex.events` under Layer 1
- Forensic query for `nex.events` CID matching is unavailable until Layer 2 authorized
- Other Layer 1 pieces (middleware · ALS · inbox → worker chain · error-envelope) proceed unchanged
- Path forward: proceed with Layer 1 minus the `nex.events` write · document the gap · Layer 2 candidacy criterion becomes "nex.events forensic query need"

## Which option matches the plan and authorization?

- **Option 1** matches the plan's own established pattern (§5 for inbox) and requires no scope change. Existing writers already use this shape. Nothing in the authorization prohibits it — the "no schema change" rule is satisfied because `payload` is an existing JSONB column.
- **Option 2** requires Layer 2 authorization which is explicitly NOT granted.
- **Option 3** ships less capability but is the most conservative.

## Recommendation

**Option 1** — persist CID inside `nex.events.payload->>'correlation_id'`, matching the existing `alerts/evaluator.ts` and `delivery/audit.ts` pattern. Amend the Path A plan §9 accordingly (documentation-only tweak to the plan doc · nothing else). Continue Layer 1 implementation.

**Justification:**

1. Zero schema change · Layer 2 boundary intact
2. Matches an established production pattern in the same repo
3. Consistent with the plan's own §5 (inbox items also use JSONB payload for CID)
4. Query performance concern is acceptable at current row counts · becomes a Layer 2 trigger criterion later (aligns with the 4-week measurement gate)
5. Rollback discipline preserved · JSONB field additions are reversible

## But this is a design decision that requires your authorization

Per the stop protocol I am NOT proceeding without confirmation. Options in front of you:

- **(A) Approve Option 1** — I amend Path A plan §9 to reflect the JSONB pattern · then proceed with Layer 1 implementation
- **(B) Authorize Option 2** — Layer 2 authorization granted · new authorization to add the column via migration · then Layer 1 proceeds after migration lands
- **(C) Approve Option 3** — Layer 1 ships without `nex.events` write · smaller scope · Layer 2 criteria expanded later
- **(D) Redirect entirely** — different path

## Runtime re-verification requirement (regardless of option chosen)

Whichever option is chosen, before Layer 1 lands in production, run a live PG shell verification:

```sql
\d nex.events
```

If runtime shows the column present when source doesn't (e.g., someone added it out-of-band), stop again and reconcile the source-drift before continuing.

## Boundaries preserved by stopping here

| | Status |
|---|---|
| Implementation | ❌ none · stopped before Step 1 of the sequencing plan |
| Middleware | ❌ untouched |
| Workers | ❌ untouched |
| Migrations | ❌ none |
| Schema change | ❌ none |
| Commit | ❌ none |
| Push | ❌ none |
| F12 · READY (d9df9ed) | untouched |
| Step 11 · READY (e8444a0) | untouched |
| F12.b · OPEN | separate |
| Layer 2 boundary | INTACT · not crossed |
| Path A plan doc | untouched (will need small §9 amendment if Option 1 chosen) |

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Prerequisite verification executed · source-of-truth basis · runtime PG shell verification deferred (PG on 5433 down) · finding: nex.events has NO correlation_id column · 3 options presented · stopped for authorization | Claude (verification-only per Philip's stop protocol) |
