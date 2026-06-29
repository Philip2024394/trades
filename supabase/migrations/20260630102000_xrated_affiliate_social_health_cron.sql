-- Xrated Trades — Affiliate Programme Phase 2.
-- Social-link health cron registration.
--
-- pg_cron can't run Node scripts directly; it can only execute SQL or
-- HTTP-extension calls. We use the `net.http_get` helper from the
-- supabase pg_net extension to hit our internal route once an hour.
-- The route does the actual HEAD-check loop and updates status /
-- last_checked_at on every social-link row.
--
-- We deliberately keep the cron OFF the build path: if pg_net isn't
-- available the migration falls back to logging a notice and exits
-- cleanly. Vercel Cron is the authoritative scheduler (see vercel.json
-- → /api/cron/social-link-health, hourly); this pg_cron entry is a
-- belt-and-braces backup.
do $$
declare
  has_pg_cron boolean;
  has_pg_net  boolean;
  app_origin  text := coalesce(
    current_setting('app.public_origin', true),
    'https://xratedtrade.com'
  );
  cron_secret text := coalesce(
    current_setting('app.cron_secret', true),
    ''
  );
begin
  select count(*) > 0 into has_pg_cron
  from pg_extension where extname = 'pg_cron';
  select count(*) > 0 into has_pg_net
  from pg_extension where extname = 'pg_net';

  if not has_pg_cron then
    raise notice 'pg_cron not installed — Vercel Cron is the authoritative schedule.';
    return;
  end if;
  if not has_pg_net then
    raise notice 'pg_net not installed — Vercel Cron is the authoritative schedule.';
    return;
  end if;

  -- Drop any previous registration so re-applying the migration is safe.
  perform cron.unschedule(jobid)
  from cron.job where jobname = 'xrated_affiliate_social_health';

  perform cron.schedule(
    'xrated_affiliate_social_health',
    '0 * * * *',
    format(
      $job$ select net.http_get(
        url := %L,
        headers := jsonb_build_object('Authorization', %L)
      ); $job$,
      app_origin || '/api/cron/social-link-health',
      'Bearer ' || cron_secret
    )
  );
end;
$$;
