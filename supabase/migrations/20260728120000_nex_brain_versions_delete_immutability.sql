-- 20260728120000_nex_brain_versions_delete_immutability.sql
-- D4 · Complete Version Immutability (Philip 2026-07-28 · Governance Drill finding)
--
-- The existing BEFORE UPDATE trigger blocks content mutations to
-- published version rows. This migration adds the matching BEFORE
-- DELETE trigger so the audit trail cannot be silently rewritten by
-- row deletion.
--
-- Bypass ceremony: an operator who intentionally needs to delete a
-- row must issue `SET LOCAL nex.permit_version_delete = 'true'` in
-- the same transaction. This is deliberate friction — makes the intent
-- conspicuous and auditable via the session settings log.

CREATE OR REPLACE FUNCTION public.reject_brain_version_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('nex.permit_version_delete', true) IS NOT DISTINCT FROM 'true' THEN
    RETURN OLD;  -- explicit ceremony permits the delete
  END IF;
  RAISE EXCEPTION 'brain_version_delete_forbidden · hammerex_nex_brain_versions rows are immutable per ADR-0037. To delete, first: SET LOCAL nex.permit_version_delete = ''true''. (D4 · Philip 2026-07-28)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reject_brain_version_delete
  ON public.hammerex_nex_brain_versions;

CREATE TRIGGER trg_reject_brain_version_delete
  BEFORE DELETE ON public.hammerex_nex_brain_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_brain_version_delete();

COMMENT ON FUNCTION public.reject_brain_version_delete IS
  'D4 · Complete Version Immutability · Philip 2026-07-28 · Governance Drill finding';
