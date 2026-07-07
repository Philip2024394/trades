-- ============================================================
-- V2 ECOSYSTEM FOUNDATION — EMERGENCY ROLLBACK SCRIPT
-- ============================================================
--
-- Filename intentionally begins with `_` so the Supabase migration
-- runner does NOT execute it automatically. It is an operational
-- lever kept next to the forward migrations for review clarity.
--
-- Reverses the following Phase 1 + Phase 1.5 + Phase 2 migrations:
--   20260717120000_os_business_listings.sql
--   20260717120100_os_business_apps.sql
--   20260717120200_os_trade_circle.sql
--   20260717120300_os_ecosystem_banners.sql
--   20260717120400_os_user_discovery.sql
--   20260717120500_os_consent_architecture.sql
--   20260717120600_os_entity_resolution.sql
--   20260717120700_os_abuse_detection.sql
--   20260717120800_os_sync_monitoring.sql
--   20260717120900_os_project_workflow.sql
--   20260717121000_os_project_verifications.sql
--   20260717121100_os_project_payment_records.sql
--   20260717121200_os_property_vault.sql
--   20260717121300_os_homeowner_billing.sql
--
-- BEFORE RUNNING:
--   1. Confirm no production data has been written to the V2 tables
--      that is NOT also present in legacy hammerex_trade_off_listings.
--      Query: SELECT count(*) FROM os_business_listings
--             WHERE id NOT IN (SELECT id FROM hammerex_trade_off_listings);
--      If non-zero, do NOT run this rollback — you would lose V2 data.
--   2. Confirm no downstream jobs / views depend on the V2 tables.
--   3. Take a fresh DB backup.
--   4. Run this script INSIDE a transaction so you can roll back if
--      any step fails.
--
-- Dropping in reverse-dependency order.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Drop the sync trigger FIRST — legacy writes stop propagating.
--    After this point, legacy hammerex_trade_off_listings continues
--    working exactly as it did before V2 shipped.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS hammerex_to_os_business_sync ON hammerex_trade_off_listings;
DROP FUNCTION IF EXISTS os_sync_hammerex_to_business_listings();

-- ---------------------------------------------------------------------
-- 2. Drop the monitoring layer
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS os_sync_health_check();
DROP TABLE IF EXISTS os_sync_health_reports;

-- ---------------------------------------------------------------------
-- 2a. Drop Phase 3 property-vault + homeowner billing (references
--     workflow tables, project videos link to signoffs/quotes/etc)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_homeowner_entitlements;
DROP TABLE IF EXISTS os_homeowner_subscriptions;
DROP TABLE IF EXISTS os_homeowner_plans;

DROP FUNCTION IF EXISTS os_project_record_summary(uuid);
DROP TABLE IF EXISTS os_dashboard_notice_dismissals;
DROP TABLE IF EXISTS os_dashboard_notices;
DROP TABLE IF EXISTS os_project_bundle_exports;
DROP TABLE IF EXISTS os_share_grants;
DROP TABLE IF EXISTS os_storage_usage_events;
DROP TABLE IF EXISTS os_storage_quotas;
DROP TABLE IF EXISTS os_project_videos;

-- ---------------------------------------------------------------------
-- 2b. Drop Phase 2 workflow-capture layer (in reverse-dependency order)
-- ---------------------------------------------------------------------
-- Payment records first (references milestones + quotes + business_listings)
DROP TABLE IF EXISTS os_project_payments;
DROP TABLE IF EXISTS os_project_payment_schedule_items;
DROP TABLE IF EXISTS os_project_payment_schedules;

-- Verifications next (reviews reference signoffs, warranties reference specs)
DROP TABLE IF EXISTS os_project_dispute_evidence;
DROP TABLE IF EXISTS os_project_disputes;
DROP TABLE IF EXISTS os_project_warranties;
DROP TABLE IF EXISTS os_project_reviews;

-- Workflow last of the project-scoped set (status events reference quotes/signoffs/milestones)
DROP TABLE IF EXISTS os_project_status_events;
DROP TABLE IF EXISTS os_project_signoffs;
DROP TABLE IF EXISTS os_project_milestones;
DROP TABLE IF EXISTS os_project_quote_line_items;
DROP TABLE IF EXISTS os_project_quotes;
DROP TABLE IF EXISTS os_project_participants;

-- ---------------------------------------------------------------------
-- 3. Drop abuse detection primitives
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_governance_actions;
DROP TABLE IF EXISTS os_rate_limit_events;
DROP TABLE IF EXISTS os_endorsement_ring_reports;
DROP TABLE IF EXISTS os_business_sybil_signals;
DROP TABLE IF EXISTS os_business_sybil_clusters;

-- ---------------------------------------------------------------------
-- 4. Drop entity resolution
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_business_verification_snapshots;
DROP TABLE IF EXISTS os_business_lineage_events;
DROP TABLE IF EXISTS os_property_role_bindings;
DROP TABLE IF EXISTS os_property_lineage_events;

-- ---------------------------------------------------------------------
-- 5. Drop consent architecture (safe only if no exports have been made)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_data_erasure_requests;
DROP TABLE IF EXISTS os_data_exports;
DROP TABLE IF EXISTS os_consent_grants;
DROP TABLE IF EXISTS os_consent_purposes;

-- ---------------------------------------------------------------------
-- 6. Drop user discovery
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_search_popularity;
DROP TABLE IF EXISTS os_user_recently_viewed;
DROP TABLE IF EXISTS os_user_compare_sets;
DROP TABLE IF EXISTS os_user_favourites;
DROP TABLE IF EXISTS os_user_follows;

-- ---------------------------------------------------------------------
-- 7. Drop banner engine
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_banner_clicks;
DROP TABLE IF EXISTS os_banner_impressions;
DROP TABLE IF EXISTS os_banner_slots;
DROP TABLE IF EXISTS os_business_banners;

-- ---------------------------------------------------------------------
-- 8. Drop trade circle (endorsements first — reciprocity has self-refs)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_business_reciprocity_prompts;
-- Endorsements need FK constraints dropped first because of self-ref
ALTER TABLE IF EXISTS os_business_endorsements
  DROP CONSTRAINT IF EXISTS os_business_endorsements_reciprocal_fk;
ALTER TABLE IF EXISTS os_business_endorsements
  DROP CONSTRAINT IF EXISTS os_business_endorsements_invite_fk;
DROP TABLE IF EXISTS os_business_endorsement_invites;
DROP TABLE IF EXISTS os_business_endorsements;
DROP TABLE IF EXISTS os_business_endorsement_categories;

-- ---------------------------------------------------------------------
-- 9. Drop business app content
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_business_social_links;
DROP TABLE IF EXISTS os_business_opening_hours;
DROP TABLE IF EXISTS os_business_coverage_areas;
DROP TABLE IF EXISTS os_business_videos;
DROP TABLE IF EXISTS os_business_downloads;
DROP TABLE IF EXISTS os_business_certifications;
DROP TABLE IF EXISTS os_business_portfolio_projects;
DROP TABLE IF EXISTS os_business_offers;

-- ---------------------------------------------------------------------
-- 10. Finally drop the canonical business listings table
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS os_business_listings;

-- ---------------------------------------------------------------------
-- After rollback, legacy hammerex_trade_off_listings is fully authoritative
-- again. All routes reading from it continue to work exactly as before
-- Phase 1 shipped.
-- ---------------------------------------------------------------------

COMMIT;

-- ============================================================
-- END OF ROLLBACK
-- ============================================================
