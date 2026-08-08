-- NEX Comms Centre · Social · Phase 8 · analytics_events INSERT grant
--
-- Charter §S-XI: Social integrates with existing Attribution by
-- writing into the canonical nex.analytics_events stream. The
-- nex_social_app role needs SELECT + INSERT on that table. It does
-- NOT need UPDATE or DELETE · Social never modifies existing
-- analytics rows.
--
-- Also grant read on nex.attributions (Attribution's credit rows) so
-- the Social ROI reader can query them without needing admin bypass.

GRANT SELECT, INSERT ON nex.analytics_events TO nex_social_app;
GRANT SELECT          ON nex.attributions    TO nex_social_app;
GRANT SELECT          ON nex.conversion_events TO nex_social_app;

-- RLS on analytics_events was set up for service_role only. Add a
-- scoped policy allowing nex_social_app to INSERT rows whose provider
-- starts with 'social:' (so nex_social_app can never impersonate an
-- email or other subsystem's events) and SELECT rows the same way.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='nex' AND tablename='analytics_events' AND policyname='social_app_insert_social_events') THEN
    CREATE POLICY "social_app_insert_social_events" ON nex.analytics_events
      FOR INSERT TO nex_social_app
      WITH CHECK (provider LIKE 'social:%');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='nex' AND tablename='analytics_events' AND policyname='social_app_select_social_events') THEN
    CREATE POLICY "social_app_select_social_events" ON nex.analytics_events
      FOR SELECT TO nex_social_app
      USING (provider LIKE 'social:%');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='nex' AND tablename='attributions' AND policyname='social_app_select_attributions') THEN
    CREATE POLICY "social_app_select_attributions" ON nex.attributions
      FOR SELECT TO nex_social_app
      USING (true);   -- ROI reader needs cross-subsystem view · Attribution is observational (invariant #14)
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='nex' AND tablename='conversion_events' AND policyname='social_app_select_conversions') THEN
    CREATE POLICY "social_app_select_conversions" ON nex.conversion_events
      FOR SELECT TO nex_social_app
      USING (true);
  END IF;
END $$;
