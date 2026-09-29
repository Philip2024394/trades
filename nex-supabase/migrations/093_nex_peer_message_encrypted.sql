-- Migration 093 · E2E-encrypted peer messages · Bridge 76
-- ------------------------------------------------------------------
-- Dual-mode: existing rows stay plaintext (`encrypted=false`, `body`
-- readable). New rows sent between two accounts that BOTH have at
-- least one active device_key row are inserted as fan-out: one row
-- per recipient device, encrypted with nacl.box.after() using the
-- pair's Curve25519 shared secret.
--
-- Fan-out model:
--   · Alice (device A1) sends "hello" to Bob (devices B1, B2).
--   · Client generates message_group_id = uuid v4.
--   · Client encrypts "hello" three times:
--       - one row addressed to B1  (nonce_1, ct_1, sender_pub=A1_pub)
--       - one row addressed to B2  (nonce_2, ct_2, sender_pub=A1_pub)
--       - one row addressed to A1  (nonce_3, ct_3, sender_pub=A1_pub)
--     Same message_group_id on all three · sender's own device row
--     lets Alice re-render her outbox after a reload without keeping
--     plaintext on the server.
--   · Insert three rows atomically. Each row has its own read_at /
--     reactions / etc — they're independent messages from the DB's
--     perspective, joined only by message_group_id for UI grouping.
--
-- Body column: kept NOT NULL for backward compat but relaxed to
-- allow the placeholder '(encrypted)' when `encrypted=true` so the
-- existing services + shell don't crash on legacy queries. Clients
-- decrypt + replace on hydration.
--
-- Delivered_at:
--   · NULL on insert
--   · Client sets it via a small server action once the ciphertext
--     is decrypted successfully · triggers Bridge 78 purge

alter table nex_peer_message
  add column if not exists encrypted           boolean       not null default false,
  add column if not exists ciphertext          bytea,
  add column if not exists nonce               bytea,
  add column if not exists sender_public_key   text,
  add column if not exists sender_device_id    text,
  add column if not exists recipient_device_id text,
  add column if not exists message_group_id    uuid,
  add column if not exists delivered_at        timestamptz;

-- Relax the existing body-length check so encrypted rows can carry
-- the sentinel body without failing the constraint.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'nex_peer_message_body_check'
      and conrelid = 'nex_peer_message'::regclass
  ) then
    alter table nex_peer_message drop constraint nex_peer_message_body_check;
  end if;
end $$;

alter table nex_peer_message
  add constraint nex_peer_message_body_check
    check (length(body) between 0 and 4000);

-- Shape check · when encrypted=true, every ciphertext column must be
-- populated. When encrypted=false, ciphertext must be null (defense
-- in depth against a legacy row accidentally carrying stale bytes).
alter table nex_peer_message
  add constraint nex_peer_message_encrypted_shape check (
    (encrypted = false and ciphertext is null and nonce is null and
     sender_public_key is null and sender_device_id is null and
     recipient_device_id is null and message_group_id is null)
    or
    (encrypted = true  and ciphertext is not null and nonce is not null and
     sender_public_key is not null and sender_device_id is not null and
     recipient_device_id is not null and message_group_id is not null)
  );

-- Index the group id so the client can quickly find sibling rows
-- (same message across devices) when it needs to update UI state.
create index if not exists nex_peer_message_group_idx
  on nex_peer_message (message_group_id)
  where message_group_id is not null;

-- Index to make Bridge 78 purge cheap · encrypted + delivered_at set
-- older than N days · candidate for removal.
create index if not exists nex_peer_message_delivered_encrypted_idx
  on nex_peer_message (delivered_at)
  where encrypted = true and delivered_at is not null;

comment on column nex_peer_message.encrypted is
  'Bridge 76 · true = ciphertext/nonce/sender_public_key/recipient_device_id populated · body is the sentinel ''(encrypted)''. false = legacy plaintext row · body is the actual message text.';

comment on column nex_peer_message.ciphertext is
  'Bridge 76 · raw bytes from nacl.box.after(plaintext, nonce, sharedSecret). Includes the 16-byte Poly1305 authentication tag.';

comment on column nex_peer_message.recipient_device_id is
  'Bridge 76 · which of the recipient''s devices this row is addressed to. Sender fans out one ciphertext per recipient device_id · rows share message_group_id.';

comment on column nex_peer_message.message_group_id is
  'Bridge 76 · groups every fan-out copy of a single logical "message send". Used by the UI to de-dupe when a user has multiple devices (only show one bubble per group).';

comment on column nex_peer_message.delivered_at is
  'Bridge 76/78 · timestamp the recipient client set after decrypting the ciphertext successfully. Rows where encrypted=true AND delivered_at IS NOT NULL become purge candidates in Bridge 78.';
