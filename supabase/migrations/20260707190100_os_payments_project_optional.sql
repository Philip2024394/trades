-- Payments can now be anchored on an engagement OR a project, not just
-- a project. Some flows (site engagements, ad-hoc trade payments) don't
-- have a linked os_projects row and shouldn't invent one.

BEGIN;

ALTER TABLE os_project_payments
  ALTER COLUMN project_id DROP NOT NULL;

COMMIT;
