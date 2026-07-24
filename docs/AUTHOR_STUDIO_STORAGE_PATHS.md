# Author Studio Storage Paths

**Reference doc · 2026-07-23**
**Purpose:** the Author Studio has two possible storage backends for draft Brain content. This document names them, describes when each is active, and states which is audit-grade.

## The two paths

### Path A · Filesystem fallback (dev-only)

**Location:** `.author-studio-drafts/<brain_slug>/<module>.json` under `process.cwd()`

**When active:**
- `hammerex_nex_brain_content` table does not exist in your Supabase
- OR the migration `brain_content_v0.sql` has not been applied
- OR the Supabase call fails with the "table does not exist" error class

**What lives there:**
- One JSON file per module the Author has saved (`craft.json`, `regulations.json`, `materials.json`, `workflow.json`, `defects.json`, `pricing_model.json`, `manifest.json`)
- Extraction runs at `.author-studio-drafts/<brain_slug>/_extraction/<run_id>.json`
- Studio export snapshots at `src/lib/nex/brains/<brain_slug>/_studio_exports/` (dev-only)

**Trade-offs:**
- ✅ Zero setup · works today on a laptop with no Supabase
- ✅ Human-readable JSON files · easy to inspect + version-control if you check them in (don't)
- ✅ Round-trips through the Brain loader boot audit successfully
- ❌ NOT audit-grade — no RLS · no scoped-to-Author enforcement · no cross-machine sync · no backup
- ❌ Nothing written to `hammerex_nex_brain_versions` · no immutable version history
- ❌ Nothing written to `hammerex_nex_brain_field_outcomes` · Field Learning Loop cannot run
- ❌ Draft could be lost by an `rm -rf .author-studio-drafts` (or by a laptop wipe)
- ❌ Multiple Authors on the same Brain would silently overwrite each other

**Use this for:** solo dev / laptop / testing the pipeline mechanics. Not for content the Founding Author actually authors long-term.

### Path B · Audit-grade DB (`hammerex_nex_brain_content` + siblings)

**Location:** Supabase Postgres, tables per `brain_content_v0.sql`

**When active:**
- The `brain_content_v0.sql` migration has been applied to your Supabase
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are in the environment
- The Studio's `_draft_store` code detects the table and prefers it over the filesystem

**What lives there:**
- `hammerex_nex_brains` — Brain registry (slug PK)
- `hammerex_nex_brain_content` — module content per Brain × module × version
- `hammerex_nex_brain_corrections` — merchant-submitted corrections (per ADR-0017 §5)
- `hammerex_nex_brain_versions` — semver history + change_kind attribution (per ADR-0017 §6 + §8)
- `hammerex_nex_brain_field_outcomes` — prediction-vs-actual field data (per ADR-0017 §8)
- `hammerex_nex_brain_learning_signals` — K-anonymised rollups (per ADR-0016 + §8)

Once `brain_vision_and_estimate_rules_v0.sql` is also applied:
- `hammerex_nex_brain_vision_examples` — Author-labelled ground truth
- `hammerex_nex_brain_estimate_rules` — Author-authored pricing rules

**Trade-offs:**
- ✅ Audit-grade — RLS-enforced · scoped-per-Author · immutable version history preserved
- ✅ Backed up by Supabase's normal backup policy
- ✅ Multi-Author / multi-Admin safe · no silent overwrites
- ✅ Field Learning Loop (ADR-0017 §8) can capture real outcomes once Runtime is live
- ✅ Merchant corrections survive across Author changes · attribution chain intact
- ❌ Requires CTO + Backend Lead + Legal Counsel signoff per `implementation/pending-migrations/APPROVAL_PACKAGE.md`
- ❌ Requires a rollback plan (though the migration file has one)

**Use this for:** anything you would want to defend in a subsequent audit, contract dispute, GDPR request, or Learning Loop retrospective. The founding-Author's real content should live here.

## Which is active for you right now?

Hit `GET /api/authors/health` and read the response:

```json
{
  "audit_grade_storage_active": true | false,
  "tables": {
    "hammerex_nex_brains": true | false | null,
    "hammerex_nex_brain_content": true | false | null,
    "hammerex_nex_brain_field_outcomes": true | false | null
  }
}
```

- Both `hammerex_nex_brains` AND `hammerex_nex_brain_content` = `true` → Path B active · audit-grade
- Either = `false` → Path A active · dev-grade
- Either = `null` → Supabase not configured · check `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

## Migrating from Path A to Path B

If you have been working in Path A (filesystem) and want to move to audit-grade DB:

1. Complete migration approval per `implementation/pending-migrations/APPROVAL_PACKAGE.md`
2. Apply `brain_content_v0.sql` to your Supabase
3. (Optional) Apply `brain_vision_and_estimate_rules_v0.sql`
4. Run `node scripts/seed-brain.mjs --slug staircase --name "Staircase Brain" --author <email>`
5. Write a one-off migration script to walk your `.author-studio-drafts/<slug>/*.json` files and insert them into `hammerex_nex_brain_content` under version `0.1.0` · status `draft`

Step 5 is not currently automated. If you have Path-A content worth migrating, write a small script or copy content module-by-module through the Studio UI once the DB table is live (the Studio auto-prefers DB when it exists — you would re-save each module in the editor and the DB write would happen).

## Rule of thumb

- **Building the pipeline · testing mechanics · toy content** → Path A is fine.
- **The Founding Author's real staircase knowledge, intended for merchants** → Path B.

The Studio does not warn you which path is active during a session. `/api/authors/health` is the reliable check. Consider running it before each authoring session as a habit.

---

**End of Author Studio Storage Paths.**
