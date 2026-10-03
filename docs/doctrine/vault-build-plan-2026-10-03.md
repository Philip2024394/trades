# NEX Vault · Build Plan · founder-sealed 2026-10-03

**Status:** Sealed. Supersedes the pre-crash build-order. Doctrine-level — any deviation requires founder re-approval, not implementation detail.

**Governs:**

- `src/app/nex-native/vault/**`
- `src/lib/nex-native/vault/**` (future)
- `nex-supabase/migrations/128_*` and later Vault migrations
- Supabase bucket `nex-vault-files` (future)
- UI copy about Vault anywhere in the product

**Context:** Vault doctrine itself — Philosophy (8 rules), Set A (SA1-SA10), Set B (Q1-Q10) — remains sealed in `docs/NEX/RESEARCH/vault-research.md` and `docs/NEX/RESEARCH/vault-security-architecture-research.md`. This document covers *how* to implement what the doctrine specifies. A previous build plan was discarded because it conflated private Supabase storage with E2E Vault encryption and scheduled uploads before storage foundations.

---

## Load-bearing invariant

**A successful Supabase upload is NOT proof of Vault encryption.** Private access-controlled storage is a prerequisite for E2E Vault encryption — not a substitute for it. UI must not claim encryption until Phase A ships. See Set A SA6, Set A SA9, Philosophy rule 1 ("A compromise of NEX's servers or database must not by itself reveal the contents of a user's Vault").

---

## D1 · Chat-move AND friend-move both ship in v1

Both activation primitives are in scope for v1. They are distinct operations with distinct scope, distinct confirmation copy, and distinct DB rows. One does not imply the other.

### D1.a · Move conversation to Vault

**Scope:** moves a single `nex_peer_conversation` into Vault. The friend (the counterparty `nex_account` referenced by the conversation) stays in normal Contacts, search, and suggestions.

**Server behaviour:**

- Insert `nex_vault_entry` row with `(account_id = session.account.id, entry_kind = 'conversation', ref_id = conversation.id, moved_at = now())`.
- Main inbox query (`listPeerConversations(account_id)`) filters out conversation ids where a matching `nex_vault_entry` row exists for the same account.
- Vault chats-room query returns only entries where `account_id = session.account.id AND entry_kind IN ('conversation', 'friend')`.
- Visible to the moving user only. Peer sees nothing change. No notification, no delivery, no read-receipt side-effect, no participant-list change.

**Confirmation copy (locked):**

> **Move this conversation to Vault?**
>
> This chat will disappear from your main inbox and only be reachable from Vault. **{Friend name}** stays in your Contacts and will not know this chat was moved. You can move it back any time.
>
> [ Cancel ]   [ Move to Vault ]

### D1.b · Move friend to Vault

**Scope:** moves the friend AND every `nex_peer_conversation` the viewer has with them. The friend disappears from the viewer's Contacts, friend-search results, autocomplete, "suggested friends", group-create picker — any list of people. Inside Vault, the friend is fully usable: chat, send files, call. Peer continues to see the viewer normally (one-sided hide per Set A).

**Server behaviour:**

- Insert `nex_vault_entry` row with `(account_id = session.account.id, entry_kind = 'friend', ref_id = friend_account.id, moved_at = now())`.
- Every query that reads from `nex_friend_edge` or lists people in the viewer's address book filters out `ref_id` values present in the viewer's `nex_vault_entry` rows with `entry_kind = 'friend'`.
- Any conversation with that friend is implicitly hidden from the main inbox for the viewer (resolved by the inbox query joining through `nex_friend_edge` + the friend's `nex_vault_entry` row — avoids duplicate per-conversation rows).
- Vault chats-room query surfaces the friend card. Tapping it opens their full chat history inside Vault.
- Peer is NOT notified. Peer's view of the viewer is unchanged. Peer's `nex_friend_edge` row is unchanged.

**Confirmation copy (locked):**

> **Move {Friend name} to Vault?**
>
> This friend will disappear from your Contacts, search, and group picker. All your chats with them move into Vault with them. They won't know. You can move them back any time.
>
> [ Cancel ]   [ Move to Vault ]

### D1.c · Remove from Vault

Separate action. Reverses D1.a or D1.b by deleting the matching `nex_vault_entry` row. The conversation/friend reappears in normal surfaces. No data is lost; no cryptographic operation.

**Confirmation copy (locked):**

> **Move {Friend name | this conversation} back to Contacts?**
>
> It will reappear in your main inbox and Contacts. {Friend name | They} will not be notified either way.
>
> [ Cancel ]   [ Move back ]

### D1.d · Unfriend is NOT remove-from-Vault

Unfriend severs the `nex_friend_edge` relationship on both sides. Remove-from-Vault only deletes a one-sided visibility shim. These are different buttons in different places with different consequences. A user may unfriend a vaulted friend; doing so deletes both the edge AND the vault entry.

**Confirmation copy for unfriend-while-vaulted (locked):**

> **Unfriend {Friend name}?**
>
> {Friend name} is currently in your Vault. Unfriending will remove them from Vault AND end the friendship on both sides. They will see you disappear from their Contacts. This cannot be undone from the app.
>
> [ Cancel ]   [ Unfriend ]

### D1.e · Rules the migration cannot violate

- `nex_vault_entry` is **per viewer**. There is NO shared "this chat is vaulted globally" row. Visibility is one-sided per account.
- Deleting the counterparty's `nex_account` (SA9 cryptographic erasure) does NOT cascade-delete the viewer's `nex_vault_entry`. The viewer's row references a dangling id; UI resolves to an "unknown contact" placeholder inside Vault.
- Deleting the viewer's `nex_account` DOES cascade-delete all their `nex_vault_entry` rows (SA9 cryptographic erasure of the viewer's Vault state).
- No `revealed_at`, `last_viewed_at`, or `view_count` columns. Vault entry metadata is `moved_at` only. SA6 absolute: no server-side observation of Vault access patterns.
- RLS: `SELECT`, `INSERT`, `UPDATE`, `DELETE` all restricted to `account_id = auth.uid()`-resolved account. Service-role bypass is forbidden except for cascade-delete triggered by `nex_account` deletion.

---

## D2 · Private Supabase storage is a SEPARATE stage from E2E Vault encryption

**New bucket:** `nex-vault-files`. Private. Owner-scoped RLS. **Never reuse any existing public bucket** (`nex-peer-chat-attachments`, `nex-chat-theme-hero`, `nex-theme-sticker`, etc.) for Vault files.

**Metadata table:** `nex_vault_file` with `(id, account_id, category, folder_path, display_name, mime_type, byte_size, bucket_path, created_at, updated_at)`.

- `account_id` → owner. RLS enforces `account_id = session.account.id` on all CRUD.
- `category` → one of `documents | photos | videos | plans | important | archived`. Drives which room the file appears in.
- `folder_path` → nullable text, lightweight folder support without a tree table.
- `bucket_path` → the storage-object key inside `nex-vault-files`. One-way derivation from `(account_id, id)` to prevent path collisions and path-guessing.

**Downloads:** short-lived signed URLs via `/api/nex/vault/files/[fileId]/signed-url`. Server verifies the file belongs to the caller's `account_id` before issuing. Default TTL 60 seconds. No long-lived or public URLs.

**Explicit boundary (load-bearing):** Private + owner-scoped + signed-URL ≠ E2E encrypted. In Stage 4 state the server CAN read bytes (service-role can read the bucket). Phase A (not yet authorised) adds client-side encryption with keys the server never holds, which is when Philosophy rule 1 is actually satisfied. Until then every UI surface that lists Vault files must carry the honest-limits disclaimer established on `/vault/settings`.

---

## D3 · Vault inbox header copy

Locked:

- **Title:** `Vault · Chats & Friends`
- **Subtitle:** `Private chats`

Do not alter these strings in any surface without reopening D3.

---

## D4 · Settings page scope

- Built in Stage 2.
- Working navigation + ONLY controls that are genuinely implemented.
- **No fake controls.** The following are explicitly forbidden on the Stage 2 settings page: biometric unlock, recovery-code setup, device management, encryption toggles, PIN change (until real PIN auth ships), "trusted devices", "audit log", "export my Vault".
- Honest-limits footer visible until Phase A ships. Current text (keep in sync with `src/app/nex-native/vault/settings/page.tsx`):

> **What this Vault is today**
>
> Vault uses your normal NEX account authentication. The six-digit PIN entry you unlocked with is currently a prototype — real PIN verification arrives with a later security stage. Rooms, chats and future files are treated as account-authenticated data, not yet protected by the PIN or end-to-end encryption.
>
> Recovery, device management, and encryption controls will appear here when the real security architecture ships. Nothing fake lives on this screen.

---

## Build order (sealed sequence)

| Stage | Scope | Produces | Does NOT produce |
|---|---|---|---|
| **2** | Room navigation, room shells, theme inheritance, working settings destination | UI shell · doorway skin resolved from `chat_theme` · session guards · 7 rooms + settings | Any persistence · any move operation · any file upload |
| **3** | Supabase-backed chat and friend moves | Migration 128 (`nex_vault_entry`) · `moveChatToVault` / `moveFriendToVault` / `removeFromVault` server actions · Vault chats-room wired · main inbox + contacts filtered · long-press affordance · test coverage | File storage · E2E encryption · upload UI |
| **4** | Private storage foundation | Migration 129 (`nex_vault_file` + `nex-vault-files` bucket + RLS) · signed-URL endpoint | Upload UI · E2E encryption · OCR · voice recording |
| **5** | Wire 6 file rooms to Stage 4 | Documents / Photos / Videos / Plans / Important / Archived list files from `nex_vault_file` · empty-state preserved when no files · open-file via signed-URL | Upload UI · reorder / rename / delete UI beyond v1 minimum |
| **6** | Quick actions (where honest) | **Upload** (file picker → bucket + metadata) · **New Folder** (lightweight `folder_path` write) | **Scan** (deferred, OCR is a separate founder decision) · **Voice Note** (deferred, MediaRecorder flow is a separate founder decision) |
| **7** | Full acceptance + security proofs | Vitest coverage on actions + queries · authenticated acceptance script across all stages · RLS proofs · signed-URL expiry proofs · final report | Phase A (E2E encryption) · Phase B (Vault Secrets surface) |

Each stage requires separate founder authorisation to begin AND separate founder authorisation to commit. Migrations are **written** at each stage but applied to the live Supabase project (`ijvqdvsvwtwxzcqmoqit`) only after founder reviews the SQL. The bucket + its RLS policies in Stage 4 are **specified** in SQL but created on the live project only after founder reviews and approves the policy wording.

---

## PIN screen status (sticky disclaimer)

The six-digit PIN entry is a **prototype**. There is no key derivation, no HSM, no constant-time comparison, no attempt lockout, no device binding. Any surface built in Stages 3-6 is protected by the user's NEX session, NOT the PIN. Every surface that stores or lists Vault data must carry the honest-limits disclaimer established on `/vault/settings` until real PIN auth lands.

---

## What triggers doctrine re-approval

- Any attempt to collapse Stages 4+5+6 into one stage.
- Any UI copy that implies encryption / E2E / "unhackable" / "nobody can see this" / "military-grade" / any phrase on the sealed banned-marketing list.
- Any migration adding to `nex_vault_entry` beyond `(id, account_id, entry_kind, ref_id, moved_at)`.
- Any migration adding `revealed_at`, `last_viewed_at`, `view_count`, or similar observation column to `nex_vault_entry` or `nex_vault_file`.
- Any shared/global "this is vaulted" row — breaks the one-sided-hide invariant.
- Any "contact support to reset Vault" affordance — forbidden by Set A SA6.
- Any shadow-admin key, legal-hold override, or server-side plaintext read path once Phase A ships.

---

## Change log

- 2026-10-03 · founder-sealed · supersedes pre-crash plan · adds load-bearing storage-vs-encryption boundary (D2) · locks D1 confirmation copy · locks D3 header copy · locks D4 fake-control prohibitions · reorders stages so storage foundation precedes any room wiring.
