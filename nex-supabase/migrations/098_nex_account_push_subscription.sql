-- Migration 098 · Persistent Web Push subscriptions · Bridge 89b
-- ------------------------------------------------------------------
-- One row per (account_id, endpoint). Endpoint is the browser-supplied
-- push service URL (fcm.googleapis.com, updates.push.services.mozilla.com,
-- web.push.apple.com, etc). p256dh + auth are the encryption keys the
-- browser generated. All three come from the client's
-- pushManager.subscribe() response.
--
-- An account has many subscriptions (phone + desktop + a fresh install
-- after a browser reset). On send we fan out to every row and prune
-- any that return 410 Gone or 404 Not Found so dead endpoints don't
-- keep costing HTTP round-trips.
--
-- No PII beyond what the browser API already produced. Endpoints are
-- opaque URLs · not user-readable identifiers.

create table if not exists nex_account_push_subscription (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references nex_account(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (account_id, endpoint)
);

create index if not exists nex_account_push_subscription_account_idx
  on nex_account_push_subscription (account_id, last_seen_at desc);

comment on table nex_account_push_subscription is
  'Bridge 89b · Sealed 2026-09-29. Per-device Web Push subscriptions for waking a closed tab / locked phone when a call rings or (future) an urgent message arrives. Populated by the client via pushManager.subscribe() after the user grants Notification permission. Dead endpoints (410 / 404 from the push service) are pruned by the sender on receipt.';

comment on column nex_account_push_subscription.endpoint is
  'Push service URL from PushSubscription.endpoint · unique per subscription · one account may have many (phone + desktop + browser reset).';

comment on column nex_account_push_subscription.p256dh is
  'Base64url-encoded 65-byte P-256 public key from PushSubscription.getKey("p256dh") · used by web-push to encrypt the payload envelope.';

comment on column nex_account_push_subscription.auth is
  'Base64url-encoded 16-byte auth secret from PushSubscription.getKey("auth") · required by the Web Push spec for message authentication.';

-- RLS: writers (INSERT/UPDATE/DELETE) must own the account row. Reads
-- are restricted to service-role only · no reason for one user to see
-- another user's push endpoints.

alter table nex_account_push_subscription enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nex_account_push_subscription'
      and policyname = 'nex_account_push_subscription_owner_write'
  ) then
    create policy nex_account_push_subscription_owner_write
      on nex_account_push_subscription
      for all
      to authenticated
      using (
        exists (
          select 1 from nex_account
          where nex_account.id = nex_account_push_subscription.account_id
            and nex_account.supabase_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from nex_account
          where nex_account.id = nex_account_push_subscription.account_id
            and nex_account.supabase_user_id = auth.uid()
        )
      );
  end if;
end $$;
