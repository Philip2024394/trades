# ADR-0118 · NEX Media Object · Ownership + Phone-Delete Rule + 7-Day Grace

Status: **APPROVED** · Philip 2026-08-27
Companion doctrines: `project_nex_media_foundation_roadmap_2026_08_27`, `project_nex_free_infrastructure_principle_2026_08_27`
Related ADRs: 0022 (no 3rd-party image copy), 0024 (image manifest rule), 0025 (matcher thresholds), 0027 (Golden Rules), 0028 (Intelligence), 0033 (Quality over Quantity)

## Context

NEX is adding a unified media foundation (`nex.media_object`) that will underpin every future media surface — profile photos, business photos, product images/videos, short videos, LIVE recordings, voice/video messages, documents, thumbnails. This ADR sets the ownership + lifecycle rules that govern every row in that table.

## Decision

### § 1 · The uploader is the owner

The `owner_id` field is a **pure-NEX identity string** (matches the `nex.call_record` identity model — TEXT, not Supabase-auth UUID). Whoever uploads owns the media. Ownership does not transfer implicitly. Businesses / products can *reference* media via `context_ref`, but the media row itself belongs to the uploader.

### § 2 · Phone-delete does NOT delete the NEX copy

The moment a user uploads a photo, video, audio clip, or document to NEX:
- **NEX Storage is the master copy.** The phone is only the camera.
- The user deleting the file from their phone gallery / storage does NOT delete the NEX row or the R2 bytes.
- This is the entire product principle. NEX becomes the platform that owns the user's creative record; the phone becomes an input device.

### § 3 · In-NEX delete starts a 7-day grace

When a user (or admin) deletes a media object *inside NEX*:
1. Row transitions to `state = 'deleted'` immediately
2. `deleted_at = now()`
3. `hard_delete_after = now() + interval '7 days'`
4. The object becomes invisible to all read APIs (default queries filter `state = 'ready'`)
5. A janitor job (deferred until Stage 2) hard-deletes the R2 bytes when `now() > hard_delete_after`
6. Between `deleted_at` and `hard_delete_after`, an admin can restore via a support API (deferred implementation, table state supports it)

This gives NEX 7 days to recover from accidental deletion, malicious deletion by a compromised account, or content-moderation reversals.

### § 4 · Visibility defaults to PRIVATE

Every new media row is `visibility = 'private'` unless the caller explicitly sets `'unlisted'` or `'public'`. Never make anything public by default. Consent to publish is an intentional action.

- `private` — only the owner (and admins) can read
- `unlisted` — anyone with the link can read, not enumerated in public feeds
- `public` — enumerable in public surfaces (feed, marketplace, business profile)

### § 5 · Provenance is stamped once, never rewritten

- `uploaded_at` set at INSERT · never changed
- `uploaded_via` records the API route / app path that created the row · never changed
- `cycle_run_id` (when set) links walker-created media to the specific worker cycle · never changed
- `owner_id` never changes · media does not "transfer" — it is copied (new row) with new provenance

### § 6 · Never copy third-party media (ADR-0022 preserved)

Media that NEX did not receive from an authenticated owner or verifiably licence-holder MUST NOT be created via this table. Walkers may create rows with `cycle_run_id` set only when the source explicitly licenses redistribution (CC BY-SA, CC0, OSM ODbL for landmark imagery, etc.). Provenance MUST include licence details in `extras.licence`.

### § 7 · Every media row auto-manifests (ADR-0024 preserved)

The `ManifestWritingObjectStorage` decorator in the object registry writes a `nex.object_manifest` row for every `put()`. This ADR does not change that. The `media_object` row and the `object_manifest` row co-exist: `object_manifest` is the low-level byte-index (bucket · key · version · content_hash), `media_object` is the product-level record (owner · visibility · lifecycle · context).

### § 8 · Storage backend is orthogonal

`media_object` references `storage_bucket + storage_key + storage_version` — the addresses the NEX ObjectStorage abstraction uses. Which backend actually holds the bytes (filesystem, postgres, r2) is a deployment decision controlled by `NEX_OBJECT_BACKEND`. The row is portable across backends.

### § 9 · No format bias

The polymorphic `object_type` (`image | video | audio | document`) means we can add short videos, voice notes, PDFs, and podcasts against the same schema. Do not create sibling tables for individual media types. Extend this one.

## Consequences

**Positive:**
- One canonical media table underneath every future NEX product surface
- User trust: their upload becomes NEX's ward, not their phone's
- 7-day grace protects against accidental / malicious deletion
- Backend-agnostic — moving from Postgres to R2 to future backends is an ops change, not a schema migration
- Preserves all existing image doctrines (ADR-0022 · ADR-0024)

**Negative / accepted costs:**
- Storage bytes remain in R2 for 7 days after "delete" — small $ cost, worthwhile for the safety net
- Owner cannot immediately hard-delete their own media without admin action — trade-off for accident recovery
- Janitor job for hard-delete is deferred to Stage 2 — grace period is currently indefinite (rows stay `deleted` forever until janitor ships). Not a data-integrity risk; is a storage-cost creep risk mitigated by low Stage 1 volumes.

## Alternatives considered + rejected

- **Immediate hard-delete on user request** — rejected · no recovery from accidents
- **30-day grace** — rejected · disproportionate storage cost for the recovery value
- **No grace (delete = truly gone)** — rejected · zero recovery from anything
- **Feature-specific media tables (profile_photo, product_video, ...)** — rejected · fragments schema · duplicates upload paths · breaks the "one foundation" principle
- **Store bytes in Postgres BYTEA at scale** — the Postgres adapter is fine for dev/test; production media should live in R2 to keep egress $0 and Postgres row size sane

## Enforcement

- Every write to `nex.media_object` MUST come through the NEX-native upload route
  (`/api/nex-media/upload-url` + `/api/nex-media/register`) — no direct INSERT from other paths
- Every read through the API routes MUST filter `state = 'ready'` unless the caller
  is an admin or the owner requesting their own soft-deleted items
- CHECK constraints in migration 118 enforce: valid `object_type`, valid `visibility`,
  valid `state`, deletion-timestamps-paired, storage-refs-non-empty
- Regression tests (`src/lib/nex-media/*.test.ts`) cover upload → register → GET →
  DELETE → grace + manifest auto-write + visibility 404 for unauthorised
