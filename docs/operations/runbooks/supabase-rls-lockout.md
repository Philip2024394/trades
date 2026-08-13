# Runbook · Supabase RLS lockout

**Owner:** on-call engineer
**Severity:** P0 (reads return empty when they shouldn't)
**Related code:** legacy Supabase tables — `hammerex_*`, `app_*`

## Symptom
- Endpoints returning empty arrays despite data existing (verified via service-role query)
- Users report "everything disappeared"
- Reads succeed as `service_role` but fail as `authenticated` or `anon`

## Confirm
Run in Supabase SQL editor as service-role:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = '<affected table>';
```
- Zero rows → RLS enabled but no policies → all reads blocked
- Wrong role predicate → policies exist but exclude the caller

## Contain (reversible)
**Do NOT `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`** — that opens the table to everyone with anon key. That's a data-exfiltration risk, not a fix.

Instead:
1. Read from service-role temporarily via `getSupabaseServiceRoleClient()` while root cause is investigated
2. Document the incident window

## Diagnose
- Was a migration applied that dropped policies?
- Was `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` run without policies?
- Did a role name change silently?

## Fix
Restore policies. Standard shape (adjust per table):
```sql
-- Allow authenticated users to read their own rows
CREATE POLICY "authenticated_read_own"
  ON public.<table>
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow service_role full access
CREATE POLICY "service_role_all"
  ON public.<table>
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
```
Commit as a numbered migration under `deploy/postgres/init/` (even if applied against Supabase). This is the audit trail.

## Verify
- Query as `authenticated` role returns expected rows
- Endpoints resume normal behaviour

## Post-incident
- Add a policy-count regression test: assert every table in the RLS baseline has ≥1 policy per role class
- If a migration dropped policies, fix the migration + add a check to prevent recurrence
