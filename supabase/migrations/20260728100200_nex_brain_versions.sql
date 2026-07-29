-- 20260728100200_nex_brain_versions.sql
-- Living Trade Brains · Version History · ADR-0037
--
-- Immutable version storage. One row per published version. Never
-- mutated. Retire via `retired_at` timestamp. Rollback = update
-- brains.current_version_id to a prior row.
--
-- Also holds the Brain Package portability metadata: signature,
-- checksum, public-key ref, portable manifest. Schema laid now so
-- packages can be signed + exported + imported later without a
-- database redesign.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_versions (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug        text          NOT NULL
                                  REFERENCES public.hammerex_nex_brains(slug)
                                  ON DELETE RESTRICT,
  version_semver    text          NOT NULL,
  -- e.g. "1.0.0" · "2.3.1" · unique per brain_slug
  manifest_json     jsonb         NOT NULL,
  modules_json      jsonb         NOT NULL,
  authored_by       text          NOT NULL,
  authored_at       timestamptz   NOT NULL,
  published_at      timestamptz   NULL,
  published_by      text          NULL,
  superseded_by     uuid          NULL
                                  REFERENCES public.hammerex_nex_brain_versions(id)
                                  ON DELETE SET NULL,
  retired_at        timestamptz   NULL,
  retire_reason     text          NULL,
  readiness_score_json jsonb      NULL,
  regression_result_json jsonb    NULL,

  -- ─── Compatibility Matrix (Philip 2026-07-28 · future insurance) ───
  -- Every version declares which Brain API contract it targets, and
  -- what runtime version range it needs. Matches how Kubernetes,
  -- Android, npm and Chrome extensions handle backward compatibility.
  -- Old brains keep working on new runtimes because they declare
  -- `brain_api_version=1` instead of silently breaking.
  brain_api_version        text     NOT NULL DEFAULT '1.0',
  -- Brain API contract this version follows. Runtime dispatches to the
  -- correct handler based on this value.
  minimum_runtime_version  text     NOT NULL DEFAULT '1.0',
  -- Minimum Nex Runtime version this brain needs. Install / activation
  -- refuses if the running runtime is older.
  current_runtime_version  text     NULL,
  -- Historical record: the Nex Runtime version that PUBLISHED this
  -- brain version. Useful for provenance, debugging, and compatibility
  -- audits ("published under runtime 3.2, running on 4.1").

  -- ─── Brain Package portability (schema laid now, wired later) ───
  package_checksum         text     NULL,
  -- sha256 of the canonicalised version content · null when not packaged
  package_signature        text     NULL,
  -- detached signature bytes (base64) · null when not packaged
  package_public_key_ref   text     NULL,
  -- identifier of the public key used to sign · e.g. "nex-official:2026-q3"
  package_manifest_json    jsonb    NULL,
  -- portable manifest describing dependencies · capabilities · requirements ·
  -- issuer · license · issued_at · valid_until · so packages can be verified
  -- without hitting the origin server
  portable                 boolean  NOT NULL DEFAULT true,
  -- whether this version can be exported as a signed portable package
  imported_from_package_id uuid     NULL,
  -- if this version was imported from an external portable package,
  -- the source package's globally-unique id (matches brains.package_id)

  metadata          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (brain_slug, version_semver)
);

-- Now that both tables exist, add the FK from brains.current_version_id
-- back to versions.id. DEFERRABLE so the brain row can be created
-- before its first version exists.
ALTER TABLE public.hammerex_nex_brains
  ADD CONSTRAINT fk_brains_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES public.hammerex_nex_brain_versions(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS ix_brain_versions_slug_published
  ON public.hammerex_nex_brain_versions (brain_slug, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS ix_brain_versions_authored_by
  ON public.hammerex_nex_brain_versions (authored_by, authored_at DESC);
CREATE INDEX IF NOT EXISTS ix_brain_versions_live
  ON public.hammerex_nex_brain_versions (brain_slug)
  WHERE published_at IS NOT NULL AND retired_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_brain_versions_package_import
  ON public.hammerex_nex_brain_versions (imported_from_package_id)
  WHERE imported_from_package_id IS NOT NULL;

ALTER TABLE public.hammerex_nex_brain_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brain_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "public_read_published" ON public.hammerex_nex_brain_versions
  FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND retired_at IS NULL);
CREATE POLICY "authenticated_read_all" ON public.hammerex_nex_brain_versions
  FOR SELECT TO authenticated USING (true);

-- Immutability trigger. Content fields are frozen once inserted.
-- retired_at, retire_reason, superseded_by, and package signing fields
-- can be updated post-insert (retirement + retro-signing are valid ops).
CREATE OR REPLACE FUNCTION public.reject_brain_version_content_mutation()
RETURNS trigger AS $$
BEGIN
  IF (NEW.manifest_json  IS DISTINCT FROM OLD.manifest_json)  OR
     (NEW.modules_json   IS DISTINCT FROM OLD.modules_json)   OR
     (NEW.brain_slug     IS DISTINCT FROM OLD.brain_slug)     OR
     (NEW.version_semver IS DISTINCT FROM OLD.version_semver) OR
     (NEW.authored_by    IS DISTINCT FROM OLD.authored_by)    OR
     (NEW.authored_at    IS DISTINCT FROM OLD.authored_at)    OR
     (NEW.published_at   IS DISTINCT FROM OLD.published_at    AND OLD.published_at IS NOT NULL)
  THEN
    RAISE EXCEPTION 'hammerex_nex_brain_versions rows are immutable · ADR-0037 · mutation blocked';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brain_versions_immutable
  BEFORE UPDATE ON public.hammerex_nex_brain_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_brain_version_content_mutation();

COMMENT ON TABLE public.hammerex_nex_brain_versions IS
  'Living Trade Brains · Immutable Version History + Brain Package portability metadata · ADR-0037';
