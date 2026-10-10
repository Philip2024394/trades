# Migration 125 · nex_peer_message link_preview columns · Schema Review

**Status:** SCHEMA GATE APPROVED 2026-10-02 · **NOT APPLIED** · awaiting apply-mechanism review before execution.
**Author:** Produced per founder authorisation 2026-10-02 (Phase 1 link previews, Option 2 security evidence track). Schema gate decision recorded 2026-10-02: approve with amendments (this document and the SQL incorporate those amendments).
**Security evidence baseline:** 74/74 PASS across `scripts/test-link-preview-safety.mjs` (58 cases) + `scripts/test-link-preview-adversarial.mjs` (16 cases). Reports retained separately as the authority for all claims about fetcher safety.
**File reviewed:** `nex-supabase/migrations/125_nex_peer_message_link_preview.sql`.

---

## § 1 · Current relevant schema (what exists on `nex_peer_message` today)

| Column | Type | Nullable | Source |
|---|---|---|---|
| `id` | uuid | NOT NULL | Migration 047 (Bridge 47) |
| `conversation_id` | uuid FK | NOT NULL | Migration 047 |
| `sender_account_id` | uuid FK | NOT NULL | Migration 047 |
| `body` | text | NOT NULL (0..4000) | Migration 047 / 093 (length relaxed) |
| `attachment_type` | text (CHECK) | NULL | Migration 047 · extended by 065, 081, 119 |
| `attachment_url` | text | NULL | Migration 047 |
| `attachment_meta` | jsonb | NULL | Migration 065 (reactions / cart snapshots) |
| `encrypted` | boolean | NOT NULL · DEFAULT false | Migration 093 |
| `ciphertext` | text | NULL | Migration 093 |
| `nonce` | text | NULL | Migration 093 |
| `sender_public_key` | text | NULL | Migration 093 |
| `sender_device_id` | text | NULL | Migration 093 |
| `recipient_device_id` | text | NULL | Migration 093 |
| `message_group_id` | text | NULL | Migration 093 |
| `deleted_for_everyone` | boolean | NOT NULL · DEFAULT false | Migration 053 |
| `deleted_at` | timestamptz | NULL | Migration 053 |

**Existing load-bearing constraints:**

- `nex_peer_message_attachment_type_check` (Migration 119): `attachment_type IN ('image', 'video', 'audio', 'product', 'menu_item', 'cart_order', 'product_share', 'sticker')`
- `nex_peer_message_encrypted_shape` (Migration 093): plaintext/ciphertext column population is mutually exclusive by `encrypted` flag
- `nex_peer_message_body_check` (Migration 093): `length(body) BETWEEN 0 AND 4000`
- Bridge 47 RLS policies: SELECT/INSERT/UPDATE scoped to participants of the parent `nex_peer_conversation`

**Existing deletion doctrine (Migration 053):** `deleted_for_everyone = true` is set in-place; **body is intentionally preserved** so `reply_to_id` joins keep working and admin/audit can read retracted content. Client renders a tombstone placeholder by filtering on the flag.

---

## § 2 · Proposed schema delta (what Migration 125 adds)

| Change | Shape |
|---|---|
| `attachment_type` CHECK | Extend allowed set to add `'link_preview'` (9th value) |
| `link_url` | `text` · NULL · no default · CHECK length ≤ 2048 |
| `link_title` | `text` · NULL · no default · CHECK length ≤ 300 |
| `link_description` | `text` · NULL · no default · CHECK length ≤ 600 |
| `link_image_url` | `text` · NULL · no default · CHECK length ≤ 2048 |
| `link_source_domain` | `text` · NULL · no default · CHECK length ≤ 128 |
| Compound CHECK | `attachment_type != 'link_preview' OR (encrypted = false AND link_url IS NOT NULL)` |
| Trigger | `BEFORE UPDATE OF deleted_for_everyone` · scoped `WHEN` clause · nulls all five link_* columns on `false → true` transition, for `link_preview` rows only |
| Indexes | **None** · deliberate (see §9) |
| Migration history row | Version `'125'` with description + notes referencing this doc + the 74/74 security evidence |

---

## § 3 · Why each column exists

| Column | Purpose · why it's its own column (not jsonb) |
|---|---|
| `link_url` | The URL the OG fetcher LANDED on after any redirect resolution. Dedicated column so SELECT…WHERE queries can later filter / count by URL cheaply. Also the ONLY column REQUIRED when `attachment_type='link_preview'` (§4). |
| `link_title` | Server-extracted `og:title` or `<title>` fallback. Separate column because card UI reads it directly; a jsonb path lookup would be slower and less type-checkable. |
| `link_description` | Server-extracted `og:description`. Separate column for the same reasons. Max 600 chars per `LINK_PREVIEW_LIMITS` in `link-preview-fetcher.ts`. |
| `link_image_url` | Server-VALIDATED (SSRF-safe, http(s)-only, no userinfo, non-SVG) image URL from `og:image`. Separate column so a future "no-image-preview" UI toggle is one WHERE clause (`WHERE link_image_url IS NULL`). |
| `link_source_domain` | Hostname of `link_url` (post-redirect). Separate column so a future "block previews from domain X" admin tool is a one-liner (indexable later; see §9). |

Columns-not-jsonb matches the existing pattern on `nex_peer_message` (attachment_url, attachment_meta coexist; attachment_url is dedicated for the single-URL case, attachment_meta is the jsonb catch-all). Keeps the schema shape consistent across attachment types.

---

## § 4 · Constraint semantics

### 4.1 `nex_peer_message_attachment_type_check` (replaced)

Rebuilt from the Migration 119 version, adding `'link_preview'` to the allowed values. All existing rows satisfy the new constraint because their `attachment_type` values were already in the old (now-smaller) allowed set.

### 4.2 Per-column length CHECKs

Five independent CHECKs enforce the max lengths. Named individually so a single partial rollback is possible (e.g. drop just the title length cap if a legitimate seed needs to exceed 300). The caps match the server-side slicing in `src/lib/nex-native/link-preview-fetcher.ts` (defence-in-depth · if application code is bypassed, DB still rejects).

### 4.3 `nex_peer_message_link_preview_requires_plaintext` (compound CHECK)

```
attachment_type IS DISTINCT FROM 'link_preview'
OR (encrypted = false AND link_url IS NOT NULL)
```

**Reading:**

- If this row is NOT a link_preview, the constraint is trivially satisfied (no further check).
- If this row IS a link_preview:
  - `encrypted` must be `false` (plaintext · see §5).
  - `link_url` must be `NOT NULL` (every preview must identify its target).
  - The other four link_* columns MAY be NULL (title/description/image/domain are best-effort extraction and may legitimately be absent for pages that provide no OG tags).

**`IS DISTINCT FROM`** is used instead of `!=` because `attachment_type` is nullable; `NULL != 'link_preview'` evaluates to `NULL` (not TRUE), which would make the CHECK fail for every non-attachment plaintext message. `IS DISTINCT FROM` treats NULL as "distinct" and returns TRUE, as intended.

---

## § 5 · Encryption compatibility

### 5.1 Why link previews are forbidden on encrypted messages

Open Graph previews are inherently SERVER-fetched. The server cannot read ciphertext to extract a URL from an encrypted body, and even if the client supplied the URL out-of-band the preview would then be plaintext metadata attached to a nominally-encrypted row — a privacy regression without a clear user-mental-model.

**Decision 2026-10-02:** `link_preview` is a plaintext-only attachment type. Users in E2E chats can still send URLs — just as plaintext text within the encrypted body (unchanged behaviour), or as encrypted text if the body is encrypted.

### 5.2 Composition with `nex_peer_message_encrypted_shape` (Migration 093)

The existing shape CHECK is:
```
(encrypted = false AND ciphertext IS NULL AND nonce IS NULL AND ...)
OR
(encrypted = true AND ciphertext IS NOT NULL AND nonce IS NOT NULL AND ...)
```

Row-by-row composition analysis:

| Row shape | Shape CHECK | New compound CHECK | Both satisfied? |
|---|---|---|---|
| Plaintext body (no attachment) | ✓ (encrypted=false branch) | ✓ (attachment_type is NULL, DISTINCT-FROM short-circuits TRUE) | ✓ |
| Encrypted body (no attachment) | ✓ (encrypted=true branch) | ✓ (attachment_type is NULL, short-circuits) | ✓ |
| Plaintext image | ✓ | ✓ (attachment_type='image', short-circuits) | ✓ |
| Plaintext link_preview | ✓ (encrypted=false branch) | ✓ (encrypted=false AND link_url NOT NULL) | ✓ |
| Encrypted + link_preview (attempted abuse) | ✓ (ciphertext populated) | ✗ (encrypted=true but link_preview demands encrypted=false) | ✗ · **rejected at DB layer** |

The two constraints COMPOSE cleanly. No existing row shape is invalidated. Only the abuse case (encrypted + link_preview combo) is newly forbidden.

### 5.3 Downgrade impossibility

- No application code path mutates `encrypted` from `true → false` (nothing in `src/app/nex-native/_actions.ts` or server actions does an UPDATE SET encrypted=false).
- Preview columns are populated only at INSERT by the server action (never patched later).
- Even if a bug attempted to populate `link_url` on an existing encrypted row, the compound CHECK rejects the UPDATE.

---

## § 6 · Deletion behaviour (deviation from Migration 053 doctrine · FLAGGED)

### 6.1 The deviation

Migration 053 established that `delete_for_everyone` **preserves** the body (for reply joins + audit). The Phase 1 schema decision for link previews (approved by schema gate 2026-10-02) is that deletion must **zero** all five preview columns.

This is a deliberate deviation. The rationale:

- `body` is user-authored text; preserving it for audit is defensible under the "user own their speech" doctrine.
- `link_url` et al. are server-generated metadata about **third-party content**. Preserving them after retraction means NEX retains a per-conversation record of which URLs users shared, which:
  - leaks sharing-pattern data beyond what the sender intended to leave on the record
  - creates a subpoena-exposed artefact (contradicts the broader zero-knowledge messaging doctrine where NEX minimises what it holds)
  - has no reply-to-id or UI dependency (nothing in the preview column set participates in message threading)

So the trade-off cleanly favours zero-on-delete for link previews specifically, without touching the body-preserve rule for other attachment types.

### 6.2 Implementation (DB-layer trigger · not application responsibility)

The migration installs:

```sql
CREATE TRIGGER nex_peer_message_link_preview_delete_trigger
  BEFORE UPDATE OF deleted_for_everyone ON nex_peer_message
  FOR EACH ROW
  WHEN (
    NEW.attachment_type = 'link_preview'
    AND NEW.deleted_for_everyone = true
    AND OLD.deleted_for_everyone = false
  )
  EXECUTE FUNCTION nex_peer_message_zero_link_preview_on_delete();
```

**Properties:**

- `BEFORE UPDATE OF deleted_for_everyone` · fires ONLY when that column is being written. No overhead on body edits, read-receipt updates, delivery timestamps, or any other `UPDATE` path.
- `WHEN (...)` clause · further gates to `link_preview` rows transitioning `false → true` only. For every other row the trigger body never executes.
- Function sets all five `link_*` columns to NULL in the NEW row (BEFORE write, so no second UPDATE needed).

**Enforcement guarantee:** no application code path can retract a link_preview message and leave the metadata on disk. If a future caller forgets to clear the columns, the trigger does it anyway. Belt-and-braces at the DB level.

### 6.3 What is NOT cleared by the trigger

- `body` — stays preserved per Migration 053. (Body of a link_preview message is user-authored "look at this" text; preserving matches the broader body-preserve doctrine.)
- `attachment_type` — stays as `'link_preview'` so the client UI knows which tombstone shape to render.
- `deleted_at` — set by the application action (unchanged).

### 6.4 Governance

This deviation is approved by schema gate 2026-10-02 (recorded here as the authoritative source for the decision). The trigger block is retained in the migration. If a future bridge wishes to UNIFY with the body-preserve doctrine, the trigger can be dropped in a dedicated follow-up migration without touching any other section of Migration 125.

---

## § 7 · Existing-row impact

- All five new columns are `NULL` for every existing row (no default · no backfill).
- The `attachment_type` CHECK is RE-created with a superset of allowed values. Every existing row's current `attachment_type` is still in the allowed set — zero rows invalidated.
- The length CHECKs are satisfied by every existing row (all five columns are NULL).
- The compound CHECK is satisfied by every existing row (none have `attachment_type='link_preview'` yet).
- The shape CHECK (Migration 093) is unchanged.
- The RLS policies are unchanged — new columns inherit the existing participant-only policies via the parent row.
- The trigger does not fire for existing rows (no `deleted_for_everyone` transition is initiated by the migration itself).

**Net migration effect on existing rows: zero mutations.** Schema-only change. Fast migration.

---

## § 8 · Null / default behaviour

| Column | NULL semantics |
|---|---|
| `link_url` | NULL for every non-link_preview row. Required (`NOT NULL` enforced by compound CHECK) for link_preview rows. |
| `link_title` | NULL when the fetched page provided no `og:title` and no `<title>` fallback, OR when the row is not a link_preview. |
| `link_description` | NULL when the fetched page provided no `og:description`, OR for non-link_preview rows. |
| `link_image_url` | NULL when the fetched page provided no safe image URL (fetch failed, or the image URL failed SSRF validation), OR for non-link_preview rows. |
| `link_source_domain` | NULL for non-link_preview rows. The server action always populates this for link_preview rows (derived from `link_url`), so in practice link_preview + NULL source_domain never occurs. |

**No DEFAULT clauses** on any column. Explicit NULLs mean "value not provided." Defaults would cause unnecessary writes to the WAL during the migration for existing rows.

---

## § 9 · Index / query implications

**No new indexes in Phase 1.** Deliberate:

- The participant-pair SELECT (the hot path for chat rendering) is already covered by `nex_peer_message_conversation_sent_at_idx` (Migration 047) — adding link_* indexes would be useless for that path.
- "All messages from domain X" is not a Phase-1 query. If future bridges want it (abuse-pattern analytics, per-domain block list), a partial index can be added:
  ```sql
  CREATE INDEX idx_nex_peer_message_link_source_domain
    ON nex_peer_message (link_source_domain)
    WHERE link_source_domain IS NOT NULL;
  ```
  This would stay small (one row per link_preview message, not one per row).

Keeping the migration index-free avoids a long index-build on a potentially large table (`nex_peer_message` grows ~every message). Faster migration, zero scan risk.

**Row width impact:** five additional nullable text columns. For non-link_preview rows (99%+ of all messages) each new column stores a NULL header byte (1 byte or less in PostgreSQL's variable-width storage) — negligible row growth. For link_preview rows the storage is bounded by the per-column length caps (max ~5 KB combined, typically < 1 KB).

---

## § 10 · Rollback safety

The rollback block in the migration file is a BEGIN/COMMIT that:
1. Removes the migration_history row
2. Drops the trigger + the trigger function
3. Drops all six new CHECK constraints by name
4. Drops all five new columns
5. Rebuilds the `attachment_type` CHECK to its Migration-119 form

**Properties:**

- **Schema-reversible; previously deleted preview metadata is intentionally non-restorable.** The schema objects (columns, constraints, trigger, function, CHECK) can all be dropped and rebuilt cleanly. The ONE class of data mutation that cannot be undone is the trigger's zero-out of link_* columns on delete-for-everyone — but that zero-out is the explicit deletion contract, not a rollback bug.
- Columns being dropped are nullable with no default · PostgreSQL drops them without rewriting rows.
- The trigger drop is `IF EXISTS` so running the rollback on a partially-applied migration is safe.
- Rebuilding the previous `attachment_type` CHECK will succeed if-and-only-if no row has `attachment_type='link_preview'`. If any link_preview rows exist at rollback time, the CHECK rebuild will fail, forcing the operator to deal with the data first (safer than silently invalidating rows).

**Explicit non-reversible items (by design, not by bug):**
1. Any `link_*` metadata already zeroed by the deletion trigger. These rows have `deleted_for_everyone = true` and were cleared intentionally per the §6 contract.
2. Any live `link_preview` rows at rollback time will block the attachment_type CHECK rebuild. Operator must retract (via the normal delete-for-everyone path, which will zero the metadata via the trigger before it is dropped) OR delete the rows outright before completing the rollback.

---

## § 11 · Open questions requiring founder confirmation (pre-apply)

Each item below can be addressed without rewriting the migration · they're parameters or boolean toggles:

1. **Deletion deviation (§6)** — confirm the trigger-based zero-on-delete is wanted, OR unify with the Migration 053 body-preserve doctrine (drop the trigger block, let client filter by deleted_for_everyone like other attachment types).

2. **Length caps (§2 / §4.2)** — confirm 2048 / 300 / 600 / 2048 / 128. If any seem wrong (e.g. 128 is tight for a long subdomain), raise before apply.

3. **Index for source_domain (§9)** — Phase 1 ships without. Confirm or request included.

4. **Compound CHECK requiring link_url NOT NULL (§4.3)** — alternatively the preview card could be "domain-only" with just source_domain and no URL (e.g. link too long or malformed). Current CHECK forbids that. Confirm the stricter rule is wanted.

5. **Trigger fires only on `false → true` transition** — if an admin tool ever re-sets `deleted_for_everyone` back to `false`, the preview columns stay NULL (cannot restore). Confirm this is acceptable (it is, per the deletion contract, but worth explicit sign-off).

---

## § 12 · Status statements · what has and has NOT been done

**Done (this authorisation only):**
- Drafted `nex-supabase/migrations/125_nex_peer_message_link_preview.sql` (file exists on disk).
- Written this review document.

**NOT done (and NOT within this authorisation):**
- Migration 125 has **NOT** been applied to any database.
- No server action, composer, bubble renderer, or any other application-side code has been modified for link previews.
- No live chat integration.
- No OS share-sheet, native mobile bridge, or external-app sharing (TikTok, Instagram, Facebook, files, gallery) — tracked as a separate feature requiring its own explicit authorisation.
- The 74/74 security evidence baseline (`scripts/test-link-preview-safety.mjs` + `scripts/test-link-preview-adversarial.mjs`) is unchanged and remains the authority for all claims about fetcher safety.

**Next gate per founder's governance:**
- Review of this document + the migration SQL → explicit authorisation → migration execution.
- Application integration (composer, action, renderer) remains a separate authorisation after migration apply.

End of review.
