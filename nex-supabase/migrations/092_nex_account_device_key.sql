-- Migration 092 · Per-device Curve25519 public keys · Bridge 74
-- ------------------------------------------------------------------
-- Foundation for E2E encryption (Bridges 75-78). Each browser or app
-- install ("device") generates a Curve25519 keypair on first sign-in.
-- The PRIVATE key stays in IndexedDB and never leaves the device. The
-- PUBLIC key is uploaded here so other users can encrypt messages
-- addressed to this account+device.
--
-- Design decisions:
--   · A single account can have multiple devices (phone + desktop +
--     tablet). Sender encrypts the same message ciphertext once per
--     recipient device — small overhead vs a shared per-account key
--     that would require re-encrypting history on every new device.
--   · device_id is a client-generated opaque token stored alongside
--     the private key in IndexedDB. Regenerating IndexedDB (private
--     browsing / reset / new install) creates a fresh device_id +
--     fresh keypair · old encrypted messages sent to the old device
--     stay decryptable only if the user still holds the old private
--     key (typically they don't · lost history is the trade-off of
--     device-local storage).
--   · Public keys are 32 bytes, stored base64-encoded (44 chars) for
--     ergonomic JSON transport · text column so pg-diff tools stay
--     readable.
--   · No FK from account_id to auth.users · we key off nex_account
--     which owns the identity graph.

create table if not exists nex_account_device_key (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references nex_account(id) on delete cascade,
  device_id     text not null check (length(device_id) between 8 and 128),
  public_key    text not null check (length(public_key) between 40 and 64),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (account_id, device_id)
);

create index if not exists nex_account_device_key_account_idx
  on nex_account_device_key (account_id, last_seen_at desc);

comment on table nex_account_device_key is
  'Bridge 74 · Sealed 2026-09-29. Per-device Curve25519 public keys for E2E encryption. Private keys stay in each device''s IndexedDB. A single account may hold many device rows · senders encrypt to every active device for the recipient (fan-out per device).';

comment on column nex_account_device_key.device_id is
  'Client-generated opaque token stored alongside the private key in IndexedDB. Losing IndexedDB creates a new device_id + fresh keypair · old device rows may be pruned by a periodic sweep once their last_seen_at ages out (~30 days).';

comment on column nex_account_device_key.public_key is
  'Base64-encoded 32-byte Curve25519 public key produced by nacl.box.keyPair(). Never NULL. Immutable per (account_id, device_id) · rotating a key means creating a new device row.';

-- RLS: any authenticated user can READ every account''s public keys
-- (that''s the whole point — a stranger needs to be able to encrypt
-- to someone before they''re friends). Only the owner can INSERT or
-- UPDATE their own device rows.

alter table nex_account_device_key enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nex_account_device_key'
      and policyname = 'nex_account_device_key_public_read'
  ) then
    create policy nex_account_device_key_public_read
      on nex_account_device_key
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nex_account_device_key'
      and policyname = 'nex_account_device_key_owner_write'
  ) then
    create policy nex_account_device_key_owner_write
      on nex_account_device_key
      for all
      to authenticated
      using (
        exists (
          select 1 from nex_account
          where nex_account.id = nex_account_device_key.account_id
            and nex_account.supabase_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from nex_account
          where nex_account.id = nex_account_device_key.account_id
            and nex_account.supabase_user_id = auth.uid()
        )
      );
  end if;
end $$;
